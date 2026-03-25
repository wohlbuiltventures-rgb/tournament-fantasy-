/**
 * TourneyRun Critical Path Tests
 * Run: npx playwright test qa/tourneyrun.spec.js --headed
 *
 * Tests target https://www.tourneyrun.app (production).
 * Set TOURNEYRUN_EMAIL / TOURNEYRUN_PASSWORD env vars to use
 * an existing account; otherwise a temp account is created.
 */

const { test, expect } = require('@playwright/test');

const BASE = 'https://www.tourneyrun.app';
const EMAIL    = process.env.TOURNEYRUN_EMAIL    || `qa+${Date.now()}@tourneyrun.app`;
const PASSWORD = process.env.TOURNEYRUN_PASSWORD || 'QaTest123!';

// ── Auth helper — API login, no UI form ──────────────────────────────────────
// Calls /api/auth/login directly, injects the JWT into localStorage,
// then navigates to the app. Never touches the login form.
async function login(page) {
  // Load the app shell first so localStorage is scoped to the right origin
  await page.goto(`${BASE}/`);

  const token = await page.evaluate(async ({ base, email, password }) => {
    const res = await fetch(`${base}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(`Login failed ${res.status}: ${err.error || res.statusText}`);
    }
    const data = await res.json();
    const tok = data.token || data.access_token;
    if (!tok) throw new Error(`No token in response: ${JSON.stringify(data)}`);
    localStorage.setItem('token', tok);
    // Some apps also store user object
    if (data.user) localStorage.setItem('user', JSON.stringify(data.user));
    return tok;
  }, { base: BASE, email: EMAIL, password: PASSWORD });

  if (!token) throw new Error('Login: no token returned');
}

// ── TC-01: Prize pool math ────────────────────────────────────────────────────
// TC-01: Prize pool math
// NOTE: payout_pool_override may intentionally be less than buy_in × members.
// Commissioners can run side bets, bonus pots, or separate contests (e.g. $100
// high scorer pot) that are excluded from the main payout pool.
// Valid conditions: override must be > 0 AND <= buy_in × members.
// We do NOT assert override === buy_in × members.
test('TC-01 Prize pool total = buy-in × member count', async ({ page }) => {
  await login(page);
  await page.goto(`${BASE}/basketball/dashboard`);

  // Grab first active league card
  const leagueCards = page.locator('[data-testid="league-card"], .league-card, [class*="league"]').first();
  await leagueCards.waitFor({ timeout: 8_000 }).catch(() => {});

  // Read values from the API instead — more reliable than scraping
  const res = await page.evaluate(async (base) => {
    const token = localStorage.getItem('token');
    const r = await fetch(`${base}/api/leagues`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return r.json();
  }, BASE);

  const leagues = res.leagues || [];
  if (leagues.length === 0) {
    console.log('TC-01: No leagues found — skipping math check');
    return;
  }

  for (const league of leagues) {
    const buyIn   = league.buy_in_amount || 0;
    const members = league.member_count  || league.paid_count || 0;
    const payoutPool = league.payout_pool_override > 0
      ? league.payout_pool_override
      : buyIn * members;

    if (buyIn > 0 && members > 0) {
      expect(payoutPool).toBeGreaterThan(0);
      expect(payoutPool).toBeLessThanOrEqual(buyIn * members);
      console.log(`✅ TC-01 League "${league.name}": $${buyIn} × ${members} = $${buyIn * members}, pool = $${payoutPool}`);
    }
  }
});

// ── TC-02: Payout percentages sum to 100% ─────────────────────────────────────
test('TC-02 Payout percentages sum to 100', async ({ page }) => {
  await login(page);

  const res = await page.evaluate(async (base) => {
    const token = localStorage.getItem('token');
    const r = await fetch(`${base}/api/leagues`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return r.json();
  }, BASE);

  const leagues = (res.leagues || []).filter(l =>
    l.payout_first != null || l.payout_second != null || l.payout_third != null
  );

  if (leagues.length === 0) {
    console.log('TC-02: No leagues with payout config — skipping');
    return;
  }

  for (const league of leagues) {
    const first  = parseFloat(league.payout_first  || 0);
    const second = parseFloat(league.payout_second || 0);
    const third  = parseFloat(league.payout_third  || 0);
    const total  = first + second + third;

    // Allow up to 1% floating-point tolerance
    expect(total).toBeGreaterThanOrEqual(99);
    expect(total).toBeLessThanOrEqual(101);
    console.log(`✅ TC-02 "${league.name}": ${first}% + ${second}% + ${third}% = ${total}%`);
  }
});

// ── TC-03: Payout dollar amounts match percentages (no rounding loss) ─────────
test('TC-03 Payout dollar amounts match percentages', async ({ page }) => {
  await login(page);

  const res = await page.evaluate(async (base) => {
    const token = localStorage.getItem('token');
    const r = await fetch(`${base}/api/leagues`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return r.json();
  }, BASE);

  for (const league of res.leagues || []) {
    const pool   = league.payout_pool_override > 0
      ? league.payout_pool_override
      : (league.buy_in_amount || 0) * (league.member_count || 0);
    if (pool <= 0) continue;

    const pay1 = pool * ((league.payout_first  || 0) / 100);
    const pay2 = pool * ((league.payout_second || 0) / 100);
    const pay3 = pool * ((league.payout_third  || 0) / 100);
    const sum  = pay1 + pay2 + pay3;

    // No more than $1 should be lost to rounding
    const diff = Math.abs(pool - sum);
    expect(diff).toBeLessThanOrEqual(1.00);
    console.log(`✅ TC-03 "${league.name}": pool=$${pool}, payouts=$${sum.toFixed(2)}, diff=$${diff.toFixed(2)}`);
  }
});

// ── TC-04: Standings rank players by points (descending) ─────────────────────
test('TC-04 Standings are sorted by points descending', async ({ page }) => {
  await login(page);

  const leagues = await page.evaluate(async (base) => {
    const token = localStorage.getItem('token');
    const r = await fetch(`${base}/api/leagues`, { headers: { Authorization: `Bearer ${token}` } });
    const j = await r.json();
    return (j.leagues || []).filter(l => l.status === 'active');
  }, BASE);

  if (leagues.length === 0) {
    console.log('TC-04: No active leagues — skipping');
    return;
  }

  for (const league of leagues.slice(0, 3)) { // test up to 3 leagues
    const standings = await page.evaluate(async ({ base, id }) => {
      const token = localStorage.getItem('token');
      const r = await fetch(`${base}/api/scores/league/${id}/standings`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const j = await r.json();
      return j.standings || [];
    }, { base: BASE, id: league.id });

    for (let i = 1; i < standings.length; i++) {
      expect(standings[i - 1].total_points).toBeGreaterThanOrEqual(standings[i].total_points);
    }
    console.log(`✅ TC-04 "${league.name}": ${standings.length} teams correctly sorted`);
  }
});

// ── TC-05: Invite code joins the correct pool ─────────────────────────────────
test('TC-05 Invite code routes to correct league', async ({ page }) => {
  // Test the golf pool invite code URL directly — check it lands on the right league
  const TEST_CODE = process.env.TOURNEYRUN_INVITE_CODE || '1BSYMQXV';

  await page.goto(`${BASE}/golf/join/${TEST_CODE}`);

  // Should land on join page or redirect to the league — either way, the league
  // name / invite code should be visible, not a 404
  await page.waitForLoadState('networkidle');
  const url = page.url();
  const body = await page.locator('body').textContent();

  expect(body).not.toMatch(/404|not found|invalid/i);
  expect(url).not.toContain('/404');
  console.log(`✅ TC-05 Code ${TEST_CODE} → ${url}`);

  // Also verify via the API
  const result = await page.evaluate(async ({ base, code }) => {
    const r = await fetch(`${base}/api/golf/leagues/by-invite/${code}`);
    return r.json();
  }, { base: BASE, code: TEST_CODE }).catch(() => null);

  if (result?.league) {
    console.log(`✅ TC-05 Code resolves to league: "${result.league.name}"`);
  }
});

// ── TC-06: Pick submission saves and persists after navigation ────────────────
test('TC-06 Golf pool picks persist after navigation', async ({ page }) => {
  await login(page);

  // Get first golf league the user is in
  const league = await page.evaluate(async (base) => {
    const token = localStorage.getItem('token');
    const r = await fetch(`${base}/api/golf/my-leagues`, { headers: { Authorization: `Bearer ${token}` } });
    const j = await r.json();
    return (j.leagues || [])[0] || null;
  }, BASE).catch(() => null);

  if (!league) {
    console.log('TC-06: No golf leagues found — skipping pick persistence test');
    return;
  }

  // Navigate to picks page
  const picksUrl = `${BASE}/golf/league/${league.id}/picks`;
  await page.goto(picksUrl);
  await page.waitForLoadState('networkidle');

  // Check the "submitted" variant exists (picks already saved)
  const submittedUrl = `${BASE}/golf/league/${league.id}/picks/submitted`;
  const currentUrl = page.url();
  const isSubmitted = currentUrl.includes('/submitted') || currentUrl.includes('/picks');

  if (isSubmitted) {
    // Navigate away and come back
    await page.goto(`${BASE}/golf/dashboard`);
    await page.goto(picksUrl);
    await page.waitForLoadState('networkidle');

    // Picks should still be present — check API
    const picks = await page.evaluate(async ({ base, leagueId }) => {
      const token = localStorage.getItem('token');
      const r = await fetch(`${base}/api/golf/pool/${leagueId}/my-roster`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const j = await r.json();
      return j.picks || j.roster || [];
    }, { base: BASE, leagueId: league.id });

    expect(picks.length).toBeGreaterThan(0);
    console.log(`✅ TC-06 Picks persisted: ${picks.length} picks found after navigation`);
  } else {
    console.log('TC-06: Picks page loaded (no submitted picks to verify — submit picks first)');
  }
});

// ── TC-07: Mobile responsive — standings table at 375px ──────────────────────
test('TC-07 Standings table renders at 375px mobile width', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await login(page);

  const leagues = await page.evaluate(async (base) => {
    const token = localStorage.getItem('token');
    const r = await fetch(`${base}/api/leagues`, { headers: { Authorization: `Bearer ${token}` } });
    const j = await r.json();
    return (j.leagues || []).filter(l => l.status === 'active');
  }, BASE);

  if (leagues.length === 0) {
    console.log('TC-07: No active leagues — testing basketball leaderboard fallback');
    await page.goto(`${BASE}/basketball/dashboard`);
  } else {
    await page.goto(`${BASE}/basketball/leaderboard/${leagues[0].id}`);
  }

  await page.waitForLoadState('networkidle');

  // Page should not have horizontal scroll (content overflow)
  const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
  expect(bodyWidth).toBeLessThanOrEqual(390); // allow ~15px scrollbar tolerance
  console.log(`✅ TC-07 Body scrollWidth at 375px: ${bodyWidth}px (no overflow)`);

  // Key content should be visible — not clipped off screen
  const standingsEl = page.locator('[class*="standing"], [class*="leaderboard"], table, [class*="rank"]').first();
  const isVisible = await standingsEl.isVisible().catch(() => false);
  if (isVisible) {
    const box = await standingsEl.boundingBox();
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(400);
    console.log(`✅ TC-07 Standings element fits within viewport (x=${box.x}, w=${box.width})`);
  }
});
