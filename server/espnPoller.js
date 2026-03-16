const https = require('https');
const { v4: uuidv4 } = require('uuid');
const db = require('./db');

const SCOREBOARD_URL = 'https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/scoreboard';
const SUMMARY_BASE = 'https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/summary?event=';

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { timeout: 10000 }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(new Error('JSON parse failed: ' + e.message)); }
      });
    }).on('error', reject).on('timeout', () => reject(new Error('Request timed out')));
  });
}

// Strip common suffixes so "Duke Blue Devils" matches "Duke"
function normalizeTeam(name) {
  if (!name) return '';
  return name.toLowerCase()
    .replace(/\s+(blue devils|tar heels|wildcats|bulldogs|jayhawks|hoosiers|spartans|wolverines|longhorns|gators|tigers|bears|eagles|hawks|wolves|cardinals|hornets|knights|rams|rebels|patriots|crimson tide|golden eagles|aggies|seminoles|sun devils|mountaineers|razorbacks|hurricanes|demon deacons|orange|boilermakers|buckeyes|hawkeyes|huskers|badgers|illini|gophers|terrapins|nittany lions|big red|commodores|black bears|red storm|friars|flyers|musketeers|blue hose|chanticleers|peacocks|retrievers|grizzlies|rainbow warriors|wolf pack|running rebels|mean green|roadrunners|owls|colonials|phoenix|flames|monarchs|seawolves|zips|penguins|express|minutemen|mastodons|falcons|bison|beavers|ducks|utes|aztecs|lobos|trojans|bruins|anteaters|highlanders|aggies|mustangs|cowboys|horned frogs|raiders|red raiders|bears|cougars|mountaineers|panthers|thunderbirds|lumberjacks|eagles|pirates|hawks|dragons|bears|tigers|lions|eagles|knights|warriors|vikings|vols|volunteers|cavaliers|hokies|yellow jackets|golden tornado|golden flashes|golden griffins|golden panthers|golden rams|golden eagles|golden bears|rainbow warriors|rainbow)\b/g, '')
    .replace(/[^a-z0-9\s]/g, '')
    .trim();
}

function teamsMatch(ourTeam, espnName) {
  if (!ourTeam || !espnName) return false;
  const a = normalizeTeam(ourTeam);
  const b = normalizeTeam(espnName);
  if (!a || !b) return false;
  // One contains the other (handles "Duke" vs "Duke Blue Devils")
  return a.includes(b) || b.includes(a);
}

function findMatchingGame(espnTeam1, espnTeam2) {
  const games = db.prepare('SELECT * FROM games WHERE is_completed = 0').all();
  for (const game of games) {
    const fwd = teamsMatch(game.team1, espnTeam1) && teamsMatch(game.team2, espnTeam2);
    const rev = teamsMatch(game.team1, espnTeam2) && teamsMatch(game.team2, espnTeam1);
    if (fwd || rev) return { game, flipped: rev };
  }
  return null;
}

function findMatchingPlayer(espnDisplayName) {
  if (!espnDisplayName) return null;
  const norm = espnDisplayName.toLowerCase().trim();

  // Exact match
  let p = db.prepare('SELECT * FROM players WHERE LOWER(name) = ?').get(norm);
  if (p) return p;

  // Last name only
  const parts = norm.split(' ');
  if (parts.length >= 2) {
    const last = parts[parts.length - 1];
    const rows = db.prepare("SELECT * FROM players WHERE LOWER(name) LIKE ?").all(`%${last}`);
    if (rows.length === 1) return rows[0];
  }

  return null;
}

async function processBoxScore(gameId, summary) {
  const playerGroups = summary.boxscore?.players || [];

  for (const group of playerGroups) {
    const statsBlock = group.statistics?.[0];
    if (!statsBlock) continue;
    const labels = statsBlock.names || statsBlock.labels || [];
    const ptsIdx = labels.indexOf('PTS');
    if (ptsIdx === -1) continue;

    const athletes = statsBlock.athletes || [];
    for (const entry of athletes) {
      const displayName = entry.athlete?.displayName || entry.athlete?.shortName;
      const pts = parseInt(entry.stats?.[ptsIdx]) || 0;
      if (!displayName) continue;

      const player = findMatchingPlayer(displayName);
      if (!player) continue;

      db.prepare(`
        INSERT INTO player_stats (id, game_id, player_id, points)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(game_id, player_id) DO UPDATE SET points = excluded.points
      `).run(uuidv4(), gameId, player.id, pts);
    }
  }
}

function recordResult(game, winnerTeam, score1, score2) {
  if (game.is_completed) return;
  const loser = winnerTeam === game.team1 ? game.team2 : game.team1;

  db.prepare(`
    UPDATE games SET is_completed = 1, winner_team = ?, team1_score = ?, team2_score = ? WHERE id = ?
  `).run(winnerTeam, score1, score2, game.id);

  db.prepare('UPDATE players SET is_eliminated = 1 WHERE team = ?').run(loser);
  console.log(`[ESPN] Game result recorded: ${game.team1} vs ${game.team2} → winner: ${winnerTeam}, loser eliminated: ${loser}`);
}

function recalculateStandings() {
  const leagues = db.prepare("SELECT id FROM leagues WHERE status IN ('drafting', 'active')").all();
  for (const league of leagues) {
    const members = db.prepare('SELECT user_id FROM league_members WHERE league_id = ?').all(league.id);
    const settings = db.prepare('SELECT pts_per_point FROM scoring_settings WHERE league_id = ?').get(league.id);
    const multiplier = settings?.pts_per_point || 1.0;

    for (const member of members) {
      const result = db.prepare(`
        SELECT COALESCE(SUM(ps.points), 0) as total
        FROM draft_picks dp
        JOIN player_stats ps ON dp.player_id = ps.player_id
        WHERE dp.league_id = ? AND dp.user_id = ?
      `).get(league.id, member.user_id);

      const total = Math.round(result.total * multiplier * 10) / 10;
      db.prepare('UPDATE league_members SET total_points = ? WHERE league_id = ? AND user_id = ?')
        .run(total, league.id, member.user_id);
    }
  }
}

async function pollESPN() {
  try {
    console.log('[ESPN] Polling scoreboard...');
    const data = await fetchJson(SCOREBOARD_URL);
    const events = data.events || [];

    let processed = 0;
    for (const event of events) {
      const comp = event.competitions?.[0];
      if (!comp) continue;

      const statusType = comp.status?.type;
      const isCompleted = statusType?.completed === true;
      const statusName = statusType?.name || '';
      const isInProgress = statusName === 'STATUS_IN_PROGRESS' || statusName === 'STATUS_HALFTIME';

      if (!isInProgress && !isCompleted) continue;

      const espnTeam1 = comp.competitors?.[0]?.team?.displayName;
      const espnTeam2 = comp.competitors?.[1]?.team?.displayName;
      const score1 = parseInt(comp.competitors?.[0]?.score) || 0;
      const score2 = parseInt(comp.competitors?.[1]?.score) || 0;

      const match = findMatchingGame(espnTeam1, espnTeam2);
      if (!match) continue;

      const { game, flipped } = match;

      try {
        const summary = await fetchJson(SUMMARY_BASE + event.id);
        await processBoxScore(game.id, summary);
        processed++;

        if (isCompleted) {
          let winnerTeam;
          if (flipped) {
            winnerTeam = score2 > score1 ? game.team1 : game.team2;
          } else {
            winnerTeam = score1 > score2 ? game.team1 : game.team2;
          }
          recordResult(game, winnerTeam, flipped ? score2 : score1, flipped ? score1 : score2);
        }
      } catch (err) {
        console.error(`[ESPN] Error processing event ${event.id}:`, err.message);
      }
    }

    if (processed > 0) {
      recalculateStandings();
      console.log(`[ESPN] Updated stats for ${processed} game(s), standings recalculated.`);
    } else {
      console.log('[ESPN] No matching in-progress/completed games found.');
    }
  } catch (err) {
    console.error('[ESPN poller] Fatal error:', err.message);
  }
}

module.exports = { pollESPN };
