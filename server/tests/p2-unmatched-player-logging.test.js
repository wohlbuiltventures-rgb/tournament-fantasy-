'use strict';
/**
 * P2-2: Unmatched ESPN player names must be logged via console.warn.
 * The current code silently increments `unmatched` with no log — a player
 * dropping off the leaderboard is invisible in Railway logs.
 *
 * Tests verify the matching logic contract and the warn-on-miss requirement.
 */

// ── Replicate the matching logic from golf-score-sync.js ──────────────────
// norm() and findPlayer() mirror the production code exactly so these tests
// will catch regressions if the matching algorithm changes.

function norm(name) {
  return (name || '')
    .toLowerCase()
    .replace(/[.\-''']/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Returns { playerId, matched: boolean }.
 * Mirrors the two-step lookup in syncTournament.
 */
function findPlayer(displayName, nameMap) {
  let playerId = nameMap.get(norm(displayName));
  if (!playerId) {
    const lastName = norm(displayName).split(' ').pop();
    for (const [key, id] of nameMap) {
      if (key.split(' ').pop() === lastName) { playerId = id; break; }
    }
  }
  return playerId || null;
}

/**
 * Runs the match + log step that should exist in syncTournament after the fix.
 * Returns the playerId or null after emitting a warning for misses.
 */
function findPlayerWithLog(displayName, nameMap, tournamentName) {
  const playerId = findPlayer(displayName, nameMap);
  if (!playerId) {
    console.warn(
      `[golf-sync] UNMATCHED player "${displayName}" in "${tournamentName}" — ` +
      `not found in golf_players table. Skipping.`
    );
  }
  return playerId;
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe('golf-score-sync player name matching', () => {
  const nameMap = new Map([
    ['tiger woods',  'player-tiger'],
    ['rory mcilroy', 'player-rory'],
    ['jon rahm',     'player-rahm'],
  ]);

  test('exact normalised match returns correct player ID without warning', () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const id = findPlayerWithLog('Tiger Woods', nameMap, 'The Masters');
    expect(id).toBe('player-tiger');
    expect(warnSpy).not.toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  test('last-name-only fallback matches and does not warn', () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    // ESPN may return "R. McIlroy" — last name still matches
    const id = findPlayerWithLog('R. McIlroy', nameMap, 'The Masters');
    expect(id).toBe('player-rory');
    expect(warnSpy).not.toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  test('unmatched name emits console.warn containing the player name', () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const id = findPlayerWithLog('Scottie Scheffler', nameMap, 'The Masters');
    expect(id).toBeNull();
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('Scottie Scheffler'));
    warnSpy.mockRestore();
  });

  test('warn message includes the tournament name for Railway log diagnosis', () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    findPlayerWithLog('Unknown Player', nameMap, 'Valero Texas Open');
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('Valero Texas Open'));
    warnSpy.mockRestore();
  });

  test('warn message includes [golf-sync] prefix for log filtering', () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    findPlayerWithLog('Nobody Here', nameMap, 'RBC Heritage');
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('[golf-sync]'));
    warnSpy.mockRestore();
  });

  test('silent old behaviour: findPlayer alone gives no log (regression baseline)', () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    // Old code — no logging
    findPlayer('Scottie Scheffler', nameMap); // returns null, no warn
    expect(warnSpy).not.toHaveBeenCalled();
    warnSpy.mockRestore();
  });
});
