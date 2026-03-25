'use strict';
/**
 * P0-1: Orphaned player_id in draft_picks must produce a warning,
 * not silently contribute 0 points to a team's total.
 */

// Simulate the enriched pick object that buildStandings produces via LEFT JOIN.
// When player_id is orphaned, the LEFT JOIN returns null for all player fields.
// The fix must detect this and warn — not silently add 0 points.

function processPickPoints(pick, stats, warn) {
  // pick.name === '[unknown]' signals an orphaned player_id (from the COALESCE in the SQL)
  if (pick.name === '[unknown]') {
    warn(`[standings] ORPHANED player_id=${pick.player_id} in league=${pick.league_id} — points may be wrong`);
    // Still include the 0, but the warning makes it visible in logs
    return 0;
  }
  return (stats?.total_points ?? 0);
}

test('P0-1: active player with stats accumulates points normally', () => {
  const warnings = [];
  const pick  = { player_id: 'p1', name: 'Lebron James', league_id: 'l1' };
  const stats = { total_points: 42 };

  const pts = processPickPoints(pick, stats, (m) => warnings.push(m));
  expect(pts).toBe(42);
  expect(warnings).toHaveLength(0);
});

test('P0-1: orphaned player_id emits a warning', () => {
  const warnings = [];
  const pick  = { player_id: 'deleted-id', name: '[unknown]', league_id: 'l1' };
  const stats = { total_points: 0 };

  const pts = processPickPoints(pick, stats, (m) => warnings.push(m));
  expect(pts).toBe(0);            // still 0, but…
  expect(warnings).toHaveLength(1);
  expect(warnings[0]).toMatch(/ORPHANED/);
  expect(warnings[0]).toMatch(/deleted-id/);
});

test('P0-1: player with 0 real points does NOT trigger orphan warning', () => {
  const warnings = [];
  // A real player who simply hasn't scored — name is their actual name
  const pick  = { player_id: 'p2', name: 'Bench Warmer', league_id: 'l1' };
  const stats = { total_points: 0 };

  const pts = processPickPoints(pick, stats, (m) => warnings.push(m));
  expect(pts).toBe(0);
  expect(warnings).toHaveLength(0); // no false alarm
});
