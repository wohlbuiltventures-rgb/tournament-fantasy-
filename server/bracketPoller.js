/**
 * bracketPoller.js
 *
 * Pulls the real 2026 NCAA tournament bracket from ESPN's postseason scoreboard,
 * then fetches each team's roster and player season PPG.
 *
 * Bracket source:  ESPN postseason scoreboard, seasontype=3, groups=100
 * Roster source:   site.api.espn.com teams/{id}/roster
 * Stats source:    sports.core.api.espn.com athlete statistics
 */

const https = require('https');
const { v4: uuidv4 } = require('uuid');
const db = require('./db');

// ── Tournament dates (First Four + First Round) ───────────────────────────────
const BRACKET_DATES = ['20260318', '20260319', '20260320', '20260321'];
const SCOREBOARD    = date =>
  `https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/scoreboard?dates=${date}&groups=100&seasontype=3&limit=100`;
const ROSTER_URL    = id =>
  `https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/teams/${id}/roster`;
const PLAYER_STATS  = athleteId =>
  `https://sports.core.api.espn.com/v2/sports/basketball/leagues/mens-college-basketball/seasons/2026/types/2/athletes/${athleteId}/statistics/0`;

// ── Utilities ─────────────────────────────────────────────────────────────────

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { timeout: 15000 }, res => {
      let raw = '';
      res.on('data', c => raw += c);
      res.on('end', () => {
        try { resolve(JSON.parse(raw)); }
        catch (e) { reject(new Error(`JSON parse error (${url.slice(-60)}): ${e.message}`)); }
      });
    }).on('error', reject).on('timeout', () => reject(new Error(`Timeout: ${url.slice(-60)}`)));
  });
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

function extractRegion(headline) {
  // "NCAA Men's Basketball Championship - Midwest Region - 1st Round"
  const m = (headline || '').match(/[-–]\s*(\w+)\s+Region\s*[-–]/i);
  return m ? m[1] : null;
}

// ── Step 1 — Collect all 68 teams from postseason scoreboard ─────────────────

async function fetchBracketTeams() {
  const teams = new Map(); // teamId → { teamId, teamName, abbrev, logoUrl, seed, region }

  for (const date of BRACKET_DATES) {
    let data;
    try {
      data = await fetchJson(SCOREBOARD(date));
    } catch (err) {
      console.warn(`[bracket] Scoreboard fetch failed for ${date}:`, err.message);
      continue;
    }

    for (const event of (data.events || [])) {
      const comp   = event.competitions?.[0];
      const note   = comp?.notes?.[0]?.headline || '';
      const region = extractRegion(note);

      for (const competitor of (comp?.competitors || [])) {
        const team = competitor.team;
        const seed = competitor.curatedRank?.current;

        // Skip TBD / placeholder slots
        if (!team?.id || !team.displayName || seed === 99 || seed == null) continue;

        if (!teams.has(team.id)) {
          teams.set(team.id, {
            teamId:   team.id,
            teamName: team.displayName,
            abbrev:   team.abbreviation || '',
            logoUrl:  `https://a.espncdn.com/i/teamlogos/ncaa/500/${team.id}.png`,
            seed,
            region,
          });
        }
      }
    }
    console.log(`[bracket] ${date}: ${teams.size} teams collected so far`);
  }

  return [...teams.values()];
}

// ── Step 2 — Fetch roster player IDs for a team ───────────────────────────────

async function fetchRoster(teamId, teamName) {
  try {
    const data    = await fetchJson(ROSTER_URL(teamId));
    const athletes = data.athletes || [];
    return athletes
      .filter(p => p.id && (p.displayName || p.fullName))
      .map(p => ({
        athleteId: p.id,
        name:      p.displayName || p.fullName,
        position:  p.position?.abbreviation || p.position?.name || '',
        jersey:    p.jersey || '',
      }));
  } catch (err) {
    console.warn(`[bracket] Roster failed for ${teamName}:`, err.message);
    return [];
  }
}

// ── Step 3 — Fetch a single player's season PPG ───────────────────────────────

async function fetchPPG(athleteId) {
  try {
    const data  = await fetchJson(PLAYER_STATS(athleteId));
    const cats  = data.splits?.categories || [];
    const off   = cats.find(c => c.name === 'offensive');
    if (!off) return 0;
    const stat  = (off.stats || []).find(s => s.abbreviation === 'PPG' || s.name === 'avgPoints');
    return parseFloat(stat?.value) || 0;
  } catch {
    return 0;
  }
}

// ── Step 4 — Upsert players into DB ──────────────────────────────────────────

function upsertPlayers(players) {
  const insertStmt = db.prepare(`
    INSERT INTO players (id, name, team, position, jersey_number, seed, region, season_ppg, espn_team_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const updateStmt = db.prepare(`
    UPDATE players
    SET position = ?, season_ppg = ?, seed = ?, region = ?, espn_team_id = ?
    WHERE team = ? AND LOWER(name) = LOWER(?)
  `);

  let inserted = 0, updated = 0;

  db.transaction(() => {
    for (const p of players) {
      const existing = db.prepare(
        'SELECT id FROM players WHERE team = ? AND LOWER(name) = LOWER(?)'
      ).get(p.team, p.name);

      if (existing) {
        updateStmt.run(p.position, p.ppg, p.seed, p.region, p.teamId, p.team, p.name);
        updated++;
      } else {
        insertStmt.run(
          uuidv4(), p.name, p.team, p.position, p.jersey,
          p.seed, p.region, p.ppg, p.teamId
        );
        inserted++;
      }
    }
  })();

  return { inserted, updated };
}

// ── Main export ───────────────────────────────────────────────────────────────

async function pullBracket() {
  console.log('[bracket] ── Starting ESPN bracket + roster pull ──');
  const startTime = Date.now();

  // 1. Get all 68 teams
  const teams = await fetchBracketTeams();
  if (!teams.length) {
    console.error('[bracket] No teams found — aborting');
    return { success: false, error: 'No teams found in ESPN bracket' };
  }

  // Log bracket summary
  const byRegion = {};
  for (const t of teams) {
    const r = t.region || 'Unknown';
    if (!byRegion[r]) byRegion[r] = [];
    byRegion[r].push(`${t.seed}-${t.abbrev || t.teamName}`);
  }
  for (const [r, list] of Object.entries(byRegion)) {
    list.sort((a, b) => parseInt(a) - parseInt(b));
    console.log(`[bracket]   ${r} (${list.length}): ${list.join(', ')}`);
  }

  let totalInserted = 0, totalUpdated = 0, teamsProcessed = 0;

  // 2. For each team: fetch roster → fetch PPG per player → upsert top 5
  for (const team of teams) {
    const { teamId, teamName, seed, region } = team;

    await sleep(200); // polite delay between teams
    const rosterPlayers = await fetchRoster(teamId, teamName);

    if (!rosterPlayers.length) {
      console.warn(`[bracket]   ${teamName}: empty roster, skipping`);
      continue;
    }

    // Fetch PPG for each player sequentially
    const enriched = [];
    for (const player of rosterPlayers) {
      await sleep(80); // tight but polite between player stat calls
      const ppg = await fetchPPG(player.athleteId);
      enriched.push({ ...player, ppg, team: teamName, seed, region, teamId });
    }

    // Sort by PPG, keep top 5
    enriched.sort((a, b) => b.ppg - a.ppg);
    const top5 = enriched.slice(0, 5);

    const { inserted, updated } = upsertPlayers(top5);
    totalInserted += inserted;
    totalUpdated  += updated;
    teamsProcessed++;

    const ppgLine = top5.map(p => `${p.name} (${p.ppg})`).join(', ');
    console.log(`[bracket]   ✓ ${teamName} [${region} ${seed}]: ${ppgLine}`);
  }

  const finalCount = db.prepare('SELECT COUNT(*) as c FROM players').get().c;
  const finalTeams = db.prepare('SELECT COUNT(DISTINCT team) as c FROM players').get().c;
  const elapsed    = ((Date.now() - startTime) / 1000).toFixed(1);

  console.log(`[bracket] ── Pull complete in ${elapsed}s ──`);
  console.log(`[bracket]   Teams in bracket: ${teams.length} | DB teams: ${finalTeams} | DB players: ${finalCount}`);
  console.log(`[bracket]   Inserted: ${totalInserted} | Updated: ${totalUpdated}`);

  return {
    success:        true,
    teamsFound:     teams.length,
    teamsProcessed,
    playersInserted: totalInserted,
    playersUpdated:  totalUpdated,
    elapsed:        `${elapsed}s`,
  };
}

module.exports = { pullBracket };
