'use strict';
/**
 * P2-3: picksByUser should be a Map, not a plain object.
 *
 * A plain object inherits from Object.prototype. If a user_id is a
 * prototype property name (e.g. 'toString', 'constructor', 'hasOwnProperty'),
 * the existence check `if (!obj[key])` evaluates to FALSE for those keys even
 * before any picks are stored — because obj['toString'] returns the inherited
 * method (truthy). This silently skips pick initialisation for those users.
 *
 * A Map has no inherited keys: map.get(key) returns undefined for any unseen
 * key, regardless of prototype.
 */

// ── Helper: group picks exactly as standingsBuilder does ──────────────────

function groupWithPlainObject(picks) {
  const picksByUser = {};
  for (const pick of picks) {
    if (!picksByUser[pick.user_id]) picksByUser[pick.user_id] = [];
    picksByUser[pick.user_id].push(pick);
  }
  return picksByUser;
}

function groupWithMap(picks) {
  const picksByUser = new Map();
  for (const pick of picks) {
    if (!picksByUser.has(pick.user_id)) picksByUser.set(pick.user_id, []);
    picksByUser.get(pick.user_id).push(pick);
  }
  return picksByUser;
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe('picksByUser grouping — Map vs plain object', () => {

  // ── Functional correctness (shared by both) ──────────────────────────────

  test('Map correctly groups picks by user_id', () => {
    const picks = [
      { user_id: 'user-a', player_id: 'p1' },
      { user_id: 'user-b', player_id: 'p2' },
      { user_id: 'user-a', player_id: 'p3' },
    ];
    const map = groupWithMap(picks);
    expect(map.get('user-a')).toHaveLength(2);
    expect(map.get('user-b')).toHaveLength(1);
    expect(map.get('user-c')).toBeUndefined();
  });

  test('Map returns undefined (falsy) for unknown user, not inherited value', () => {
    const map = groupWithMap([]);
    expect(map.get('toString')).toBeUndefined();
    expect(map.get('constructor')).toBeUndefined();
    expect(map.get('hasOwnProperty')).toBeUndefined();
    expect(map.get('__proto__')).toBeUndefined();
  });

  // ── Prototype pollution vulnerability in plain object ────────────────────

  test('plain object: obj["toString"] is truthy before any picks are stored', () => {
    // This is the bug: the existence check `if (!obj[key])` skips initialisation
    // for user IDs that collide with inherited prototype properties.
    const obj = {};
    expect(!!obj['toString']).toBe(true);      // inherited method — truthy!
    expect(!!obj['constructor']).toBe(true);   // inherited — truthy!
    expect(!!obj['hasOwnProperty']).toBe(true); // inherited — truthy!
  });

  test('plain object crashes when user_id="toString" (demonstrates the bug)', () => {
    // `if (!obj['toString'])` is false (inherited method is truthy) so the array is
    // never initialised. push() is then called on the inherited Function — TypeError.
    const picks = [{ user_id: 'toString', player_id: 'p1' }];
    expect(() => groupWithPlainObject(picks)).toThrow(TypeError);
  });

  test('Map is safe: picks for user_id="toString" are stored and retrieved correctly', () => {
    const picks = [{ user_id: 'toString', player_id: 'p1' }];
    const map = groupWithMap(picks);
    expect(map.get('toString')).toEqual([{ user_id: 'toString', player_id: 'p1' }]);
  });

  test('Map.get() for a missing user returns undefined, not inherited value', () => {
    const map = new Map();
    // Safe default fallback: map.get(id) || []
    const result = map.get('any-uuid') || [];
    expect(result).toEqual([]);
  });
});
