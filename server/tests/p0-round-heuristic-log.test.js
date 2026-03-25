'use strict';
/**
 * P0-6: parseRound heuristic must emit a warning when it fires
 * in the ambiguous zone (|n| between 20 and 60) so misclassification
 * is visible in logs rather than producing silent wrong scores.
 */

const PAR = 72;

function parseRound(entry, warn) {
  if (!entry) return null;
  const v = entry.value ?? entry.score;
  if (v === null || v === undefined || v === '' || v === '--') return null;
  const n = Number(v);
  if (isNaN(n)) return null;

  // Ambiguous zone: values between 21 and 59 could be either format.
  // ESPN to-par rarely exceeds ±20; raw scores are never below ~60 for PGA.
  if (Math.abs(n) > 20 && n < 60) {
    warn(`[golf-score-sync] AMBIGUOUS round value=${n} — treating as raw strokes (expected to-par ≤20 or raw ≥60)`);
    return n; // treat as raw
  }

  if (Math.abs(n) <= 20) return PAR + n; // to-par → raw
  return n;                              // already raw
}

test('P0-6: normal to-par value (-3) converts without warning', () => {
  const warnings = [];
  const result = parseRound({ value: -3 }, (m) => warnings.push(m));
  expect(result).toBe(69); // 72 - 3
  expect(warnings).toHaveLength(0);
});

test('P0-6: normal raw score (68) converts without warning', () => {
  const warnings = [];
  const result = parseRound({ value: 68 }, (m) => warnings.push(m));
  expect(result).toBe(68);
  expect(warnings).toHaveLength(0);
});

test('P0-6: exact boundary to-par (-20) converts without warning', () => {
  const warnings = [];
  const result = parseRound({ value: -20 }, (m) => warnings.push(m));
  expect(result).toBe(52); // 72 - 20
  expect(warnings).toHaveLength(0);
});

test('P0-6: ambiguous value (35) emits a warning', () => {
  const warnings = [];
  const result = parseRound({ value: 35 }, (m) => warnings.push(m));
  expect(result).toBe(35); // treated as raw
  expect(warnings).toHaveLength(1);
  expect(warnings[0]).toMatch(/AMBIGUOUS/);
  expect(warnings[0]).toMatch(/35/);
});

test('P0-6: null/missing entry returns null without warning', () => {
  const warnings = [];
  expect(parseRound(null, (m) => warnings.push(m))).toBeNull();
  expect(parseRound({ value: '--' }, (m) => warnings.push(m))).toBeNull();
  expect(warnings).toHaveLength(0);
});
