/**
 * golf-score-sync.js
 *
 * Syncs PGA Tour scores from ESPN's public leaderboard API into golf_scores.
 * Player matching: normalised name comparison (golf_players has no ESPN athlete IDs).
 * Fantasy points use the same formula as commissioner score entry (par 72, no major bonus
 * unless tourn.is_major = 1).
 *
 * exports.syncTournament(tournamentId) — called by admin routes / cron
 */

'use strict';

const db = require('./db');

const ESPN_LEADERBOARD = id =>
  `https://site.api.espn.com/apis/site/v2/sports/golf/pga/leaderboard?event=${id}`;

// Normalise a player name for fuzzy matching
function norm(name) {
  return (name || '')
    .toLowerCase()
    .replace(/[.\-''']/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// Fantasy points — configurable par baseline, commissioner formula
// Each round: (raw_score - par) * -1.5
// Finish bonuses: 1st +30, top5 +12, top10 +8, top25 +3
// Cut bonus +2; missed cut -5; major x1.5
// par defaults to 72 but can be overridden per tournament (e.g. Riviera = 71)
const DEFAULT_PAR = 72;
function calcPts(r1, r2, r3, r4, madeCut, finishPos, isMajor, par = DEFAULT_PAR) {
  let pts = 0;
  [r1, r2, r3, r4].forEach(r => {
    if (r !== null && r !== undefined) pts += (r - par) * -1.5;
  });
  if (finishPos !== null && finishPos !== undefined) {
    if      (finishPos === 1)   pts += 30;
    else if (finishPos <= 5)    pts += 12;
    else if (finishPos <= 10)   pts += 8;
    else if (finishPos <= 25)   pts += 3;
  }
  if (madeCut) pts += 2; else pts -= 5;
  if (isMajor) pts *= 1.5;
  return Math.round(pts * 10) / 10;
}

// Parse a linescore/round entry into a raw integer score (or null)
// ESPN returns both "value" (to-par) and sometimes total strokes in display fields.
// We need RAW strokes. ESPN linescores.value is usually to-par for that round.
// Convert: raw = PAR + toPar
function parseRound(entry) {
  if (!entry) return null;
  const v = entry.value ?? entry.score;
  if (v === null || v === undefined || v === '' || v === '--') return null;
  const n = Number(v);
  if (isNaN(n)) return null;

  // Heuristic: ESPN linescores.value ≤ ±20 is treated as to-par; ≥ 60 as raw strokes.
  // The gap between 21 and 59 is physically impossible in PGA play (lowest raw ever ~58,
  // highest to-par ever ~+20), so values landing there are ambiguous — log a warning
  // so misclassification is visible rather than silently producing wrong fantasy points.
  if (Math.abs(n) > 20 && n < 60) {
    console.warn(
      `[golf-score-sync] AMBIGUOUS round value=${n} (player/tourn unknown) — ` +
      `treating as raw strokes. Expected to-par ≤ ±20 or raw ≥ 60. ` +
      `Verify ESPN linescore format if fantasy points look wrong.`
    );
    return n; // treat as raw strokes
  }

  if (Math.abs(n) <= 20) return DEFAULT_PAR + n;  // to-par → raw
  return n;                                        // already raw
}

const upsertScore = db.prepare(`
  INSERT INTO golf_scores
    (id, tournament_id, player_id, round1, round2, round3, round4, made_cut, finish_position, fantasy_points, updated_at)
  VALUES
    (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' ||
     substr(lower(hex(randomblob(2))),2) || '-' ||
     substr('89ab',abs(random()) % 4 + 1, 1) ||
     substr(lower(hex(randomblob(2))),2) || '-' || lower(hex(randomblob(6))),
     ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
  ON CONFLICT(tournament_id, player_id) DO UPDATE SET
    round1 = excluded.round1,
    round2 = excluded.round2,
    round3 = excluded.round3,
    round4 = excluded.round4,
    made_cut = excluded.made_cut,
    finish_position = excluded.finish_position,
    fantasy_points = excluded.fantasy_points,
    updated_at = CURRENT_TIMESTAMP
`);

async function syncTournament(tournamentId) {
  const tourn = db.prepare('SELECT * FROM golf_tournaments WHERE id = ?').get(tournamentId);
  if (!tourn) throw new Error(`Tournament not found: ${tournamentId}`);

  const eventId = tourn.espn_event_id;
  if (!eventId) {
    console.log(`[golf-sync] No espn_event_id for "${tourn.name}" — skipped`);
    return { skipped: true, reason: 'no_espn_event_id', tournament: tourn.name };
  }

  const url = ESPN_LEADERBOARD(eventId);
  console.log(`[golf-sync] Fetching "${tourn.name}" (ESPN event ${eventId})`);

  let data;
  try {
    const res = await fetch(url, { headers: { 'Accept': 'application/json' } });
    if (!res.ok) throw new Error(`ESPN returned HTTP ${res.status} for event ${eventId}`);
    data = await res.json();
  } catch (err) {
    console.error(`[golf-sync] Fetch error: ${err.message}`);
    throw err;
  }

  // ESPN can return competitors at different paths depending on API version
  const competitors =
    data?.leaderboard?.competitors ||
    data?.leaderboard?.entries ||
    data?.events?.[0]?.competitions?.[0]?.competitors ||
    [];

  if (competitors.length === 0) {
    console.log(`[golf-sync] No competitors in ESPN response — event may not have started`);
    return { synced: 0, unmatched: 0, tournament: tourn.name };
  }

  // Build name → player_id lookup from our golf_players table
  const allPlayers = db.prepare('SELECT id, name FROM golf_players').all();
  const nameMap = new Map(allPlayers.map(p => [norm(p.name), p.id]));

  const isMajor  = !!tourn.is_major;
  const coursePar = tourn.par || DEFAULT_PAR;
  let synced = 0;
  let unmatched = 0;

  db.transaction(() => {
    for (const comp of competitors) {
      const displayName =
        comp.athlete?.displayName ||
        comp.athlete?.fullName ||
        comp.displayName || '';
      if (!displayName) continue;

      // Try exact norm match first, then last-name-only fallback
      let playerId = nameMap.get(norm(displayName));
      if (!playerId) {
        const lastName = norm(displayName).split(' ').pop();
        for (const [key, id] of nameMap) {
          if (key.split(' ').pop() === lastName) { playerId = id; break; }
        }
      }
      if (!playerId) { unmatched++; continue; }

      // Parse linescores (per-round scores)
      const linescores = comp.linescores || comp.rounds || [];
      const getR = n => {
        const ls = linescores.find(l => {
          const p = l.period?.number ?? l.period ?? l.roundNumber ?? l.number;
          return Number(p) === n;
        });
        return ls ? parseRound(ls) : null;
      };

      const r1 = getR(1), r2 = getR(2), r3 = getR(3), r4 = getR(4);

      // Cut status — ESPN status type ids: 'C' = cut, 'MDF' = made cut/didn't finish
      const statusId = comp.status?.type?.id || comp.status?.id || '';
      const madeCut = statusId !== 'C' && statusId !== 'STATUS_MISSED_CUT';

      // Finish position — "1", "T2", "CUT" etc.
      const posRaw =
        comp.status?.position?.id ||
        comp.position?.id ||
        (typeof comp.sortOrder === 'number' ? String(comp.sortOrder) : null);
      const finishPos = posRaw && /^\d+$/.test(String(posRaw).replace(/^T/, ''))
        ? parseInt(String(posRaw).replace(/^T/, ''))
        : null;

      const pts = calcPts(r1, r2, r3, r4, madeCut, finishPos, isMajor, coursePar);
      upsertScore.run(tourn.id, playerId, r1, r2, r3, r4, madeCut ? 1 : 0, finishPos, pts);
      synced++;
    }
  })();

  if (synced > 0) {
    db.prepare(`
      UPDATE golf_tournaments
      SET status = 'active', last_synced_at = CURRENT_TIMESTAMP
      WHERE id = ? AND status != 'completed'
    `).run(tournamentId);
  }

  console.log(`[golf-sync] "${tourn.name}": synced=${synced}, unmatched=${unmatched}`);
  return { synced, unmatched, tournament: tourn.name, eventId };
}

module.exports = { syncTournament };
