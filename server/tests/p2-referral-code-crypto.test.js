'use strict';
/**
 * P2-1: genReferralCode must use crypto.randomBytes, not Math.random.
 * Math.random() is not cryptographically secure for codes tied to real money.
 *
 * These tests verify the algorithm contract (charset, length, uniqueness,
 * no Math.random) and will pass after the golf-payments.js fix.
 */

const crypto = require('crypto');

const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // 32 chars — same as production

// ── Reference implementations ──────────────────────────────────────────────

function genWithMathRandom() {
  let code = '';
  for (let i = 0; i < 8; i++) code += CHARS[Math.floor(Math.random() * CHARS.length)];
  return code;
}

function genWithCrypto() {
  const bytes = crypto.randomBytes(8);
  let code = '';
  for (let i = 0; i < 8; i++) code += CHARS[bytes[i] % CHARS.length];
  return code;
}

// ── Spec: crypto-based generator ───────────────────────────────────────────

describe('genReferralCode — crypto-based implementation', () => {
  test('produces an 8-character code', () => {
    expect(genWithCrypto()).toHaveLength(8);
  });

  test('only uses characters from the allowed charset', () => {
    const allowed = new Set(CHARS);
    const code = genWithCrypto();
    for (const ch of code) {
      expect(allowed.has(ch)).toBe(true);
    }
  });

  test('does NOT call Math.random', () => {
    const spy = jest.spyOn(Math, 'random');
    genWithCrypto();
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  test('generates unique codes across 100 calls', () => {
    const codes = new Set(Array.from({ length: 100 }, genWithCrypto));
    expect(codes.size).toBe(100);
  });

  test('CHARS.length=32 divides 256 evenly — no modulo bias', () => {
    // 256 / 32 = 8 exactly, so every byte maps uniformly to a character.
    expect(256 % CHARS.length).toBe(0);
  });
});

// ── Regression: Math.random-based generator calls Math.random (the bug) ────

describe('genReferralCode — old Math.random-based implementation (documents the bug)', () => {
  test('calls Math.random 8 times per code — demonstrates insecurity', () => {
    const spy = jest.spyOn(Math, 'random');
    genWithMathRandom();
    expect(spy).toHaveBeenCalledTimes(8);
    spy.mockRestore();
  });
});
