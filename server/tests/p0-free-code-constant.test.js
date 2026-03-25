'use strict';
/**
 * P0-5: FREE_CODE must be a single shared constant so the validation
 * check and the payment bypass always reference the same value.
 */

// Simulate the join-league logic that contains both code-checks
function makeJoinHandler(FREE_CODE) {
  return function joinLeague({ invite_code, venmo_handle, zelle_handle }) {
    const code = invite_code.toUpperCase();

    // Validation — require payment handle UNLESS it's the free code
    if (code !== FREE_CODE && !venmo_handle?.trim() && !zelle_handle?.trim()) {
      return { error: 'payment handle required', status: 400 };
    }

    // Payment bypass
    if (code === FREE_CODE) {
      return { requiresPayment: false, status: 200 };
    }

    return { requiresPayment: true, status: 200 };
  };
}

test('P0-5: free code bypasses payment handle requirement', () => {
  const FREE_CODE = 'G7V9XM6W';
  const join = makeJoinHandler(FREE_CODE);

  const result = join({ invite_code: 'G7V9XM6W', venmo_handle: '', zelle_handle: '' });
  expect(result.status).toBe(200);
  expect(result.requiresPayment).toBe(false);
  expect(result.error).toBeUndefined();
});

test('P0-5: non-free code without payment handle is rejected', () => {
  const FREE_CODE = 'G7V9XM6W';
  const join = makeJoinHandler(FREE_CODE);

  const result = join({ invite_code: 'ABCD1234', venmo_handle: '', zelle_handle: '' });
  expect(result.status).toBe(400);
  expect(result.error).toMatch(/payment handle/i);
});

test('P0-5: when FREE_CODE changes, BOTH checks use the new value', () => {
  // This is the key invariant — a single constant means they can never drift
  const FREE_CODE = 'NEWCODE9'; // simulate changing the code
  const join = makeJoinHandler(FREE_CODE);

  // Old code no longer grants free access
  const oldResult = join({ invite_code: 'G7V9XM6W', venmo_handle: '', zelle_handle: '' });
  expect(oldResult.status).toBe(400); // blocked — payment handle required

  // New code works for free
  const newResult = join({ invite_code: 'NEWCODE9', venmo_handle: '', zelle_handle: '' });
  expect(newResult.requiresPayment).toBe(false);
});
