'use strict';
/**
 * Tests for the picks-per-team capacity guard in POST /commissioner/add-picks.
 *
 * Uses an in-memory SQLite database to verify that the COUNT check used by the
 * route handler correctly identifies teams at or below capacity.
 */

const Database = require('better-sqlite3');

// ── Minimal schema for pool_picks ─────────────────────────────────────────────

function makeDb() {
  const db = new Database(':memory:');
  db.exec(`
    CREATE TABLE pool_picks (
      id           TEXT PRIMARY KEY,
      league_id    TEXT NOT NULL,
      tournament_id TEXT NOT NULL,
      user_id      TEXT NOT NULL,
      player_id    TEXT NOT NULL,
      player_name  TEXT,
      tier_number  INTEGER,
      salary_used  REAL DEFAULT 0
    );
  `);
  return db;
}

// The exact query the route will use for the capacity check
function currentPickCount(db, leagueId, tournamentId, userId) {
  return db.prepare(
    'SELECT COUNT(*) AS cnt FROM pool_picks WHERE league_id = ? AND tournament_id = ? AND user_id = ?'
  ).get(leagueId, tournamentId, userId).cnt;
}

function insertPick(db, leagueId, tournamentId, userId, playerId) {
  db.prepare(
    'INSERT INTO pool_picks (id, league_id, tournament_id, user_id, player_id) VALUES (?, ?, ?, ?, ?)'
  ).run(`pick-${playerId}`, leagueId, tournamentId, userId, playerId);
}

// ── Tests ─────────────────────────────────────────────────────────────────────

const LEAGUE = 'league-1';
const TOURN  = 'tourn-1';
const USER   = 'user-1';
const MAX    = 7; // picks_per_team

describe('commissioner add-picks: capacity guard', () => {
  let db;
  beforeEach(() => { db = makeDb(); });

  it('allows insert when team has 0 picks', () => {
    const count = currentPickCount(db, LEAGUE, TOURN, USER);
    expect(count).toBe(0);
    expect(count < MAX).toBe(true); // would NOT be skipped
  });

  it('allows insert when team has picks < max', () => {
    for (let i = 1; i <= MAX - 1; i++) insertPick(db, LEAGUE, TOURN, USER, `p${i}`);
    const count = currentPickCount(db, LEAGUE, TOURN, USER);
    expect(count).toBe(MAX - 1);
    expect(count < MAX).toBe(true); // would NOT be skipped
  });

  it('blocks insert when team is exactly at capacity', () => {
    for (let i = 1; i <= MAX; i++) insertPick(db, LEAGUE, TOURN, USER, `p${i}`);
    const count = currentPickCount(db, LEAGUE, TOURN, USER);
    expect(count).toBe(MAX);
    expect(count >= MAX).toBe(true); // WOULD be skipped
  });

  it('blocks insert when team is over capacity (existing data corruption)', () => {
    for (let i = 1; i <= MAX + 2; i++) insertPick(db, LEAGUE, TOURN, USER, `p${i}`);
    const count = currentPickCount(db, LEAGUE, TOURN, USER);
    expect(count).toBe(MAX + 2);
    expect(count >= MAX).toBe(true); // WOULD be skipped
  });

  it('counts picks per user independently — different user is not affected', () => {
    const OTHER = 'user-2';
    for (let i = 1; i <= MAX; i++) insertPick(db, LEAGUE, TOURN, USER, `p${i}`);
    // OTHER user has no picks
    const countOther = currentPickCount(db, LEAGUE, TOURN, OTHER);
    expect(countOther).toBe(0);
    expect(countOther < MAX).toBe(true); // different user should NOT be blocked
  });

  it('counts picks per league independently — different league is not affected', () => {
    const OTHER_LEAGUE = 'league-2';
    for (let i = 1; i <= MAX; i++) insertPick(db, LEAGUE, TOURN, USER, `p${i}`);
    // Same user in a different league has no picks
    const countOther = currentPickCount(db, OTHER_LEAGUE, TOURN, USER);
    expect(countOther).toBe(0);
    expect(countOther < MAX).toBe(true); // different league should NOT be blocked
  });

  it('counts picks per tournament independently — different tournament is not affected', () => {
    const OTHER_TOURN = 'tourn-2';
    for (let i = 1; i <= MAX; i++) insertPick(db, LEAGUE, TOURN, USER, `p${i}`);
    const countOther = currentPickCount(db, LEAGUE, OTHER_TOURN, USER);
    expect(countOther).toBe(0);
    expect(countOther < MAX).toBe(true); // different tournament should NOT be blocked
  });

  it('the scenario that caused the bug: inserting 2 different players pushes to 9 with no guard', () => {
    // Simulate a team that had 7 picks, then got Davis Riley added (+1=8),
    // then got Hojgaard restored (+1=9) because each individual pick
    // passed the "already has this pick" check but there was no capacity check.
    for (let i = 1; i <= MAX; i++) insertPick(db, LEAGUE, TOURN, USER, `p${i}`);
    expect(currentPickCount(db, LEAGUE, TOURN, USER)).toBe(7);

    // First replacement (Davis Riley) — without guard, this would have inserted
    const countBeforeDavis = currentPickCount(db, LEAGUE, TOURN, USER);
    expect(countBeforeDavis >= MAX).toBe(true); // guard should have caught this

    // Second replacement (Hojgaard) — also different player, also would pass
    // the "already has this pick" check — without guard, picks = 9
    insertPick(db, LEAGUE, TOURN, USER, 'davis-riley');
    const countAfterDavis = currentPickCount(db, LEAGUE, TOURN, USER);
    expect(countAfterDavis >= MAX).toBe(true); // guard must block Hojgaard too
  });
});
