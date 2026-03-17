const https = require('https');
const db = require('./db');
const { v4: uuidv4 } = require('uuid');

// ── HTTP helper ─────────────────────────────────────────────────────────────────
function fetchJson(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; TourneyRun/1.0)' },
      timeout: 15000,
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(new Error('ESPN JSON parse error')); }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('ESPN request timed out')); });
  });
}

// ── Fantasy points (same formula as commissioner entry) ────────────────────────
function calcFantasyPts(r1, r2, r3, r4, finishPos, madeCut, par, isMajor) {
  let pts = 0;
  [r1, r2, r3, r4].forEach(r => {
    if (r !== null && r !== undefined) pts += (Number(r) - par) * -1.5;
  });
  if (finishPos !== null && finishPos !== undefined) {
    if (finishPos === 1)       pts += 30;
    else if (finishPos <= 5)   pts += 12;
    else if (finishPos <= 10)  pts += 8;
    else if (finishPos <= 25)  pts += 3;
  }
  if (madeCut) pts += 2;
  else pts -= 5;
  if (isMajor) pts *= 1.5;
  return Math.round(pts * 10) / 10;
}

function recalcMemberPoints(memberId) {
  const total = db.prepare(`
    SELECT COALESCE(SUM(gs.fantasy_points), 0) as pts
    FROM golf_weekly_lineups wl
    JOIN golf_scores gs ON wl.player_id = gs.player_id AND wl.tournament_id = gs.tournament_id
    WHERE wl.member_id = ? AND wl.is_started = 1
  `).get(memberId);
  db.prepare('UPDATE golf_league_members SET season_points = ? WHERE id = ?').run(total.pts, memberId);
}

// ── Name matching ───────────────────────────────────────────────────────────────
function norm(name) {
  return (name || '').toLowerCase().trim()
    .replace(/[^a-z\s]/g, '')
    .replace(/\s+/g, ' ');
}

function matchPlayer(espnName, players) {
  const n = norm(espnName);

  // 1. Exact
  let m = players.find(p => norm(p.name) === n);
  if (m) return m;

  const parts = n.split(' ');
  if (parts.length < 2) return null;

  const last = parts[parts.length - 1];
  const firstInit = parts[0][0];

  // 2. Last name + first initial
  m = players.find(p => {
    const pp = norm(p.name).split(' ');
    return pp[pp.length - 1] === last && pp[0]?.[0] === firstInit;
  });
  if (m) return m;

  // 3. Last name only (fallback — risky, only if unique match)
  const byLast = players.filter(p => norm(p.name).split(' ').pop() === last);
  if (byLast.length === 1) return byLast[0];

  return null;
}

// ── ESPN event matching ─────────────────────────────────────────────────────────
const ESPN_SCOREBOARD = 'https://site.api.espn.com/apis/site/v2/sports/golf/pga/scoreboard';
const ESPN_LEADERBOARD = id => `https://site.api.espn.com/apis/site/v2/sports/golf/pga/leaderboard?event=${id}`;

function scoreFromEvent(event) {
  // Handle both scoreboard and leaderboard response shapes
  if (event?.competitions?.[0]?.competitors) return event.competitions[0].competitors;
  if (event?.competitors) return event.competitors;
  return [];
}

async function findEspnEvent(tournament) {
  // 1. If we already have the ESPN ID stored, use it directly
  if (tournament.espn_event_id) {
    try {
      const data = await fetchJson(ESPN_LEADERBOARD(tournament.espn_event_id));
      const ev = data?.events?.[0] || data;
      if (scoreFromEvent(ev).length > 0) return { event: ev, source: 'stored_id' };
    } catch (e) {
      console.warn('[golf-sync] Stored espn_event_id fetch failed:', e.message);
    }
  }

  // 2. Fetch scoreboard and match by name or date
  const data = await fetchJson(ESPN_SCOREBOARD);
  const events = data?.events || [];

  const tWords = norm(tournament.name).split(' ').filter(w => w.length > 3);
  const tStart = new Date(tournament.start_date);

  // Name match: majority of significant words overlap
  let best = null, bestScore = 0;
  for (const ev of events) {
    const eName = norm(ev.name || '');
    const matches = tWords.filter(w => eName.includes(w)).length;
    if (matches > bestScore) { bestScore = matches; best = ev; }
  }
  if (bestScore >= 2) {
    if (best.id) db.prepare('UPDATE golf_tournaments SET espn_event_id = ? WHERE id = ?').run(best.id, tournament.id);
    return { event: best, source: 'name_match' };
  }

  // Date fallback: start_date within 5 days
  const byDate = events.find(ev => {
    const d = new Date(ev.date || ev.competitions?.[0]?.date || '');
    return !isNaN(d) && Math.abs(d - tStart) < 5 * 86400000;
  });
  if (byDate) {
    if (byDate.id) db.prepare('UPDATE golf_tournaments SET espn_event_id = ? WHERE id = ?').run(byDate.id, tournament.id);
    return { event: byDate, source: 'date_match' };
  }

  return null;
}

// ── Core sync function ──────────────────────────────────────────────────────────
async function syncTournamentScores(tournamentId, { par = 72, silent = false } = {}) {
  const tournament = db.prepare('SELECT * FROM golf_tournaments WHERE id = ?').get(tournamentId);
  if (!tournament) throw new Error('Tournament not found');

  if (!silent) console.log(`[golf-sync] Syncing: ${tournament.name}`);

  const found = await findEspnEvent(tournament);
  if (!found) {
    if (!silent) console.warn(`[golf-sync] No ESPN event found for: ${tournament.name}`);
    return { synced: 0, notMatched: [], error: 'No matching ESPN event found' };
  }

  const { event, source } = found;
  if (!silent) console.log(`[golf-sync] Matched via ${source}: "${event.name || event.shortName}"`);

  const competitors = scoreFromEvent(event);
  if (competitors.length === 0) {
    return { synced: 0, notMatched: [], warning: 'ESPN event has no competitors yet' };
  }

  const allPlayers = db.prepare('SELECT * FROM golf_players WHERE is_active = 1').all();
  const notMatched = [];
  let synced = 0;

  const upsert = db.prepare(`
    INSERT INTO golf_scores (id, tournament_id, player_id, round1, round2, round3, round4, made_cut, finish_position, fantasy_points, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(tournament_id, player_id) DO UPDATE SET
      round1=excluded.round1, round2=excluded.round2, round3=excluded.round3, round4=excluded.round4,
      made_cut=excluded.made_cut, finish_position=excluded.finish_position,
      fantasy_points=excluded.fantasy_points, updated_at=CURRENT_TIMESTAMP
  `);

  db.transaction(() => {
    for (const comp of competitors) {
      const espnName = comp.displayName || comp.athlete?.displayName || comp.athlete?.fullName || '';
      if (!espnName) continue;

      const player = matchPlayer(espnName, allPlayers);
      if (!player) {
        notMatched.push(espnName);
        continue;
      }

      // Round scores — ESPN linescores values can be actual stroke counts
      const ls = comp.linescores || [];
      const r1 = ls[0]?.value != null ? Number(ls[0].value) : null;
      const r2 = ls[1]?.value != null ? Number(ls[1].value) : null;
      const r3 = ls[2]?.value != null ? Number(ls[2].value) : null;
      const r4 = ls[3]?.value != null ? Number(ls[3].value) : null;

      // Validate: stroke counts should be between 60-90 for a golf round
      const valid = v => v !== null && v >= 55 && v <= 95;
      const r1v = valid(r1) ? r1 : null;
      const r2v = valid(r2) ? r2 : null;
      const r3v = valid(r3) ? r3 : null;
      const r4v = valid(r4) ? r4 : null;

      // Cut status
      const statusName = (comp.status?.type?.name || comp.status?.type?.id || '').toUpperCase();
      const madeCut = !statusName.includes('CUT') && !statusName.includes('WD') && !statusName.includes('DQ');

      // Finish position — sortOrder is rank
      const finishPos = comp.sortOrder ? parseInt(comp.sortOrder) : null;

      const fp = calcFantasyPts(r1v, r2v, r3v, r4v, finishPos, madeCut, par, !!tournament.is_major);

      upsert.run(uuidv4(), tournament.id, player.id, r1v, r2v, r3v, r4v, madeCut ? 1 : 0, finishPos, fp);
      synced++;
    }
  })();

  // Recalculate member standings
  const affected = db.prepare(
    'SELECT DISTINCT wl.member_id FROM golf_weekly_lineups wl WHERE wl.tournament_id = ? AND wl.is_started = 1'
  ).all(tournament.id);
  for (const { member_id } of affected) recalcMemberPoints(member_id);

  // Store last sync time on tournament
  db.prepare('UPDATE golf_tournaments SET last_synced_at = CURRENT_TIMESTAMP WHERE id = ?').run(tournament.id);

  if (!silent) {
    console.log(`[golf-sync] Done — synced: ${synced}, unmatched: ${notMatched.length}`);
    if (notMatched.length) console.log('[golf-sync] Unmatched:', notMatched.slice(0, 10).join(', '));
  }

  return { synced, notMatched, espnEventName: event.name || event.shortName };
}

// ── Auto-sync scheduler ─────────────────────────────────────────────────────────
let _syncInterval = null;
let _lastSyncTime = null;
let _lastSyncResult = null;

async function runAutoSync() {
  const now = new Date();
  const dow = now.getDay(); // 0=Sun, 4=Thu, 5=Fri, 6=Sat

  // Only sync Thu–Sun (tournament days)
  if (![0, 4, 5, 6].includes(dow)) return;

  // Find any active tournament, or any tournament whose window overlaps today
  const tournament = db.prepare(`
    SELECT * FROM golf_tournaments
    WHERE status = 'active'
       OR (date('now') BETWEEN date(start_date, '-1 day') AND date(end_date, '+1 day'))
    ORDER BY start_date ASC LIMIT 1
  `).get();

  if (!tournament) return;

  console.log(`[golf-sync] Auto-sync triggered for: ${tournament.name}`);
  try {
    const result = await syncTournamentScores(tournament.id, { silent: false });
    _lastSyncTime = new Date().toISOString();
    _lastSyncResult = { ...result, tournamentName: tournament.name };

    // Auto-activate tournament if we got data
    if (result.synced > 0 && tournament.status === 'scheduled') {
      db.prepare("UPDATE golf_tournaments SET status = 'active' WHERE id = ?").run(tournament.id);
    }
  } catch (e) {
    console.error('[golf-sync] Auto-sync error:', e.message);
  }
}

function scheduleAutoSync() {
  if (_syncInterval) clearInterval(_syncInterval);
  // Every 30 minutes
  _syncInterval = setInterval(runAutoSync, 30 * 60 * 1000);
  // Initial run after 8s (let server fully start)
  setTimeout(runAutoSync, 8000);
  console.log('[golf-sync] Scheduled — 30 min intervals, Thu–Sun during active tournaments');
}

function getSyncStatus() {
  const active = db.prepare("SELECT id, name, status, espn_event_id, last_synced_at FROM golf_tournaments WHERE status = 'active' ORDER BY start_date ASC LIMIT 1").get();
  return {
    lastSyncTime: _lastSyncTime,
    lastSyncResult: _lastSyncResult,
    activeTournament: active || null,
    schedule: '30 min intervals, Thu–Sun',
  };
}

// ── Backfill completed tournaments that have no scores yet ─────────────────────
async function backfillCompleted() {
  const completed = db.prepare(`
    SELECT gt.* FROM golf_tournaments gt
    WHERE gt.status = 'completed'
      AND (SELECT COUNT(*) FROM golf_scores WHERE tournament_id = gt.id) = 0
    ORDER BY gt.start_date ASC
  `).all();

  if (completed.length === 0) {
    console.log('[golf-sync] Backfill: all completed tournaments already have scores.');
    return;
  }

  console.log(`[golf-sync] Backfilling ${completed.length} completed tournament(s)...`);
  for (const t of completed) {
    try {
      const result = await syncTournamentScores(t.id, { silent: false });
      console.log(`[golf-sync] Backfill ${t.name}: synced=${result.synced}`);
      // Space out requests to avoid rate limiting
      await new Promise(r => setTimeout(r, 2000));
    } catch (e) {
      console.error(`[golf-sync] Backfill error for ${t.name}:`, e.message);
    }
  }
}

module.exports = { syncTournamentScores, scheduleAutoSync, getSyncStatus, backfillCompleted };
