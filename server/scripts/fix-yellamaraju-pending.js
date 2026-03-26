'use strict';
/**
 * fix-yellamaraju-pending.js
 *
 * Diagnostic + fix for Sudarshan Yellamaraju showing is_pending=true in standings.
 *
 * ROOT CAUSE: is_pending is NOT stored in pool_picks — it is computed in
 * applyDropScoring as `!hasRounds && !isMC`. It appears because golf_scores
 * has no row (or null round1) for Yellamaraju, meaning golfSyncService.js
 * is not matching his ESPN display name to golf_players.
 *
 * This script:
 *   1. Shows current state (golf_players, golf_scores, pool_picks for Yellamaraju)
 *   2. Shows ALL pool_picks in the league with no golf_scores data (is_pending candidates)
 *   3. With --apply: directly upserts his r1=-1 into golf_scores
 *   4. With --apply: triggers golfSyncService syncTournamentScores for the tournament
 *
 * Usage:
 *   node scripts/fix-yellamaraju-pending.js          # dry-run diagnostic
 *   node scripts/fix-yellamaraju-pending.js --apply  # apply fix + trigger sync
 */

require('../golf-db');    // ensure DB is initialised and migrations run
const db = require('../db');

const APPLY = process.argv.includes('--apply');
const HOU_LEAGUE = 'ff568722-fbe9-4695-86a8-a31287c22841';
const PLAYER_NAME = 'Sudarshan Yellamaraju';

// ── 1. Locate golf_players row ───────────────────────────────────────────────
const gpRow = db.prepare(
  "SELECT id, name, country, world_ranking, is_active FROM golf_players WHERE name = ? LIMIT 1"
).get(PLAYER_NAME);
console.log('\n── golf_players ──────────────────────────────────────────────');
if (gpRow) {
  console.log(`  Found: id=${gpRow.id} name="${gpRow.name}" country=${gpRow.country} is_active=${gpRow.is_active}`);
} else {
  console.log(`  NOT FOUND in golf_players — sync cannot match him without this row!`);
  console.log(`  Fix: add "${PLAYER_NAME}" to GOLF_PLAYERS array in golf-db.js so he survives reseeds.`);
}

// ── 2. Find the Houston Open tournament ──────────────────────────────────────
const tourn = db.prepare(
  "SELECT id, name, status, espn_event_id FROM golf_tournaments WHERE name LIKE '%Houston Open%' LIMIT 1"
).get();
console.log('\n── tournament ────────────────────────────────────────────────');
if (tourn) {
  console.log(`  id=${tourn.id} name="${tourn.name}" status=${tourn.status} espn_id=${tourn.espn_event_id}`);
} else {
  console.log('  Houston Open tournament not found!');
  process.exit(1);
}

// ── 3. Check golf_scores for Yellamaraju ────────────────────────────────────
const gsRow = gpRow ? db.prepare(
  "SELECT round1, round2, round3, round4, made_cut, finish_position, fantasy_points FROM golf_scores WHERE player_id = ? AND tournament_id = ?"
).get(gpRow.id, tourn.id) : null;
console.log('\n── golf_scores ───────────────────────────────────────────────');
if (gsRow) {
  console.log(`  r1=${gsRow.round1} r2=${gsRow.round2} r3=${gsRow.round3} r4=${gsRow.round4} made_cut=${gsRow.made_cut} finish=${gsRow.finish_position} fp=${gsRow.fantasy_points}`);
  if (gsRow.round1 === null) {
    console.log('  ⚠ round1 IS NULL — this is why is_pending=true in standings');
  }
} else {
  console.log('  NO ROW in golf_scores — sync has not written data for him');
  console.log('  ⚠ This is the root cause of is_pending=true');
}

// ── 4. pool_picks row ────────────────────────────────────────────────────────
const ppRows = db.prepare(
  "SELECT user_id, player_id, player_name, tier_number FROM pool_picks WHERE league_id = ? AND player_name = ?"
).all(HOU_LEAGUE, PLAYER_NAME);
console.log('\n── pool_picks ────────────────────────────────────────────────');
if (ppRows.length > 0) {
  ppRows.forEach(r => console.log(`  user=${r.user_id} player_id=${r.player_id} tier=${r.tier_number}`));
} else {
  console.log(`  No pool_picks found for "${PLAYER_NAME}" in this league`);
}

// ── 5. Show ALL pending players (those with no golf_scores for this tournament) ─
console.log('\n── All picks with no golf_scores (is_pending candidates) ────');
const pendingPicks = db.prepare(`
  SELECT pp.player_name, pp.tier_number, COUNT(DISTINCT pp.user_id) as teams
  FROM pool_picks pp
  LEFT JOIN golf_players gp ON gp.name = pp.player_name
  LEFT JOIN golf_scores gs ON gs.player_id = gp.id AND gs.tournament_id = ?
  WHERE pp.league_id = ?
    AND (pp.is_withdrawn IS NULL OR pp.is_withdrawn = 0)
    AND (gs.round1 IS NULL AND gs.round2 IS NULL AND gs.round3 IS NULL AND gs.round4 IS NULL)
  GROUP BY pp.player_name, pp.tier_number
  ORDER BY teams DESC, pp.tier_number ASC
`).all(tourn.id, HOU_LEAGUE);

if (pendingPicks.length === 0) {
  console.log('  None — all players with picks have round data');
} else {
  pendingPicks.forEach(p => console.log(`  T${p.tier_number} ${p.player_name} (${p.teams} team(s))`));
  console.log(`\n  Total pending players: ${pendingPicks.length}`);
}

// ── 6. Check golf_espn_players table for him ─────────────────────────────────
const epRow = db.prepare(
  "SELECT espn_name, display_name, country_code, normalized_name FROM golf_espn_players WHERE espn_name LIKE ? LIMIT 3"
).all('%Yellamaraju%');
console.log('\n── golf_espn_players ─────────────────────────────────────────');
if (epRow.length > 0) {
  epRow.forEach(r => console.log(`  espn_name="${r.espn_name}" display="${r.display_name}" country=${r.country_code} norm="${r.normalized_name}"`));
} else {
  console.log('  No entry for Yellamaraju in golf_espn_players');
  console.log('  This means the sync has never successfully matched him to write his ESPN name');
}

// ── 7. Apply fix ─────────────────────────────────────────────────────────────
if (!APPLY) {
  console.log('\n── DRY RUN — pass --apply to write the fix ──────────────────');
  console.log('  Will upsert golf_scores for Yellamaraju with r1=-1 (per ESPN)');
  console.log('  Will then trigger syncTournamentScores to overwrite with live data');
  process.exit(0);
}

if (!gpRow) {
  console.error('\n  Cannot apply fix: Yellamaraju not in golf_players. Deploy the GOLF_PLAYERS array fix first.');
  process.exit(1);
}

// Direct golf_scores upsert — r1=-1 (to-par, per ESPN), made_cut=null (R1 in progress)
// golfSyncService will overwrite this on next sync with full accurate data.
const { v4: uuidv4 } = require('uuid');
db.prepare(`
  INSERT INTO golf_scores (id, tournament_id, player_id, round1, round2, round3, round4, made_cut, finish_position, fantasy_points, updated_at)
  VALUES (?, ?, ?, ?, NULL, NULL, NULL, NULL, NULL, 0, CURRENT_TIMESTAMP)
  ON CONFLICT(tournament_id, player_id) DO UPDATE SET
    round1 = excluded.round1,
    made_cut = excluded.made_cut,
    updated_at = CURRENT_TIMESTAMP
`).run(uuidv4(), tourn.id, gpRow.id, -1);
console.log(`\n  ✓ Upserted golf_scores: player_id=${gpRow.id} r1=-1`);

// Also seed golf_espn_players so future syncs find him
const { normalizePlayerName } = require('../utils/playerNameNorm');
db.prepare(`
  INSERT INTO golf_espn_players (espn_name, display_name, country_code, normalized_name, updated_at)
  VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
  ON CONFLICT(espn_name) DO UPDATE SET
    display_name = excluded.display_name,
    country_code = excluded.country_code,
    normalized_name = excluded.normalized_name,
    updated_at = CURRENT_TIMESTAMP
`).run(PLAYER_NAME, PLAYER_NAME, gpRow.country || 'CA', normalizePlayerName(PLAYER_NAME));
console.log(`  ✓ Seeded golf_espn_players for "${PLAYER_NAME}"`);

// Trigger live sync to overwrite with accurate ESPN data
const { syncTournamentScores } = require('../golfSyncService');
syncTournamentScores(tourn.id, { par: tourn.par || 72, silent: false })
  .then(result => {
    console.log(`\n  ✓ Sync complete: synced=${result.synced} unmatched=${result.notMatched?.length || 0}`);
    if (result.notMatched?.length) {
      console.log(`  Still unmatched after sync: ${result.notMatched.slice(0, 10).join(', ')}`);
    }

    // Verify Yellamaraju's score after sync
    const after = db.prepare(
      "SELECT round1, round2, round3, round4 FROM golf_scores WHERE player_id = ? AND tournament_id = ?"
    ).get(gpRow.id, tourn.id);
    console.log(`  Yellamaraju after sync: r1=${after?.round1} r2=${after?.round2} r3=${after?.round3} r4=${after?.round4}`);
  })
  .catch(err => {
    console.error(`\n  ✗ Sync failed: ${err.message}`);
    console.log('  The direct golf_scores upsert still applied — standings should show r1=-1 now.');
  });
