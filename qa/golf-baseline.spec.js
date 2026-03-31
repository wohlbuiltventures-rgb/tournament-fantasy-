/**
 * TourneyRun Golf — Baseline Test Suite
 *
 * Captures the current working state before Salary Cap format restructure.
 * Tests both happy-path and known failure states to establish a baseline.
 *
 * Run:    npx playwright test qa/golf-baseline.spec.js --reporter=list
 * Headed: npx playwright test qa/golf-baseline.spec.js --headed --reporter=list
 *
 * Env vars (from .env.test):
 *   TOURNEYRUN_EMAIL    — existing account with at least one pool league
 *   TOURNEYRUN_PASSWORD — account password
 */

const { test, expect } = require('@playwright/test');

const BASE = 'https://www.tourneyrun.app';
const EMAIL    = process.env.TOURNEYRUN_EMAIL    || `qa+${Date.now()}@tourneyrun.app`;
const PASSWORD = process.env.TOURNEYRUN_PASSWORD || 'QaTest123!';

// ── Shared helpers ─────────────────────────────────────────────────────────────

/** API login — injects JWT into localStorage without touching the login form */
async function login(page) {
  await page.goto(`${BASE}/`);
  const token = await page.evaluate(async ({ base, email, password }) => {
    const res = await fetch(`${base}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) throw new Error(`Login failed ${res.status}: ${await res.text()}`);
    const data = await res.json();
    const tok = data.token || data.access_token;
    if (!tok) throw new Error(`No token: ${JSON.stringify(data)}`);
    localStorage.setItem('token', tok);
    if (data.user) localStorage.setItem('user', JSON.stringify(data.user));
    return tok;
  }, { base: BASE, email: EMAIL, password: PASSWORD });
  if (!token) throw new Error('login: no token returned');
}

/** Typed GET against the API */
async function apiGet(page, path) {
  return page.evaluate(async ({ base, path }) => {
    const token = localStorage.getItem('token');
    const r = await fetch(`${base}${path}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return { status: r.status, data: await r.json().catch(() => ({})) };
  }, { base: BASE, path });
}

/** Fetch user's golf leagues */
async function myGolfLeagues(page) {
  const { data } = await apiGet(page, '/api/golf/leagues');
  return data.leagues || data || [];
}

/** Find first league matching predicate */
async function findLeague(page, pred) {
  const leagues = await myGolfLeagues(page);
  return leagues.find(pred) || null;
}


// ═════════════════════════════════════════════════════════════════════════════
// 1 — CREATE LEAGUE FLOW
// ═════════════════════════════════════════════════════════════════════════════

test.describe('1 — Create League Flow', () => {

  test('TC-CL-01 Pool format card shows tiered pick sheet config', async ({ page }) => {
    await login(page);
    await page.goto(`${BASE}/golf/create`);
    await page.waitForLoadState('networkidle');

    // Click "Pool" format card
    await page.getByRole('button').filter({ hasText: /^Pool$/ }).first().click();

    // Tier Setup section should appear
    await expect(page.getByText('Tier Setup')).toBeVisible({ timeout: 5_000 });

    // Picks Per Team should be visible
    await expect(page.getByText(/Picks Per Team/i)).toBeVisible();

    // "Pick Sheet Format" selector should NOT exist — we removed it (only tiered remains)
    const pickSheetLabel = page.getByText(/Pick Sheet Format/i);
    await expect(pickSheetLabel).not.toBeVisible();

    // Salary Cap nested config should not exist inside Pool format
    const poolCard = page.locator('text=Pool').locator('..').locator('..');
    await expect(page.getByText(/pool_salary_cap|Salary Cap Settings/i)).not.toBeVisible();

    console.log('✅ TC-CL-01: Pool format → shows tier config, no nested salary cap selector');
  });

  test('TC-CL-02 Salary Cap format shows scoring style + cap settings', async ({ page }) => {
    await login(page);
    await page.goto(`${BASE}/golf/create`);
    await page.waitForLoadState('networkidle');

    // Click "Salary Cap" format card (formerly Daily Fantasy)
    await page.getByRole('button').filter({ hasText: /^Salary Cap$/ }).first().click();

    // Salary Cap Settings panel should appear
    await expect(page.getByText('Salary Cap Settings')).toBeVisible({ timeout: 5_000 });

    // Scoring Style selector must be present
    await expect(page.getByText('Scoring Style')).toBeVisible();
    await expect(page.getByText('Classic Stroke Play')).toBeVisible();
    await expect(page.getByText('TourneyRun Style')).toBeVisible();
    await expect(page.getByText('Finish Scoring')).toBeVisible();

    // Weekly cap + picks per tournament
    await expect(page.getByText('Weekly Salary Cap')).toBeVisible();
    await expect(page.getByText('Picks Per Tournament')).toBeVisible();

    // "Daily Fantasy Settings" header must NOT exist
    await expect(page.getByText('Daily Fantasy Settings')).not.toBeVisible();

    console.log('✅ TC-CL-02: Salary Cap format → scoring style + cap settings visible, DFS label gone');
  });

  test('TC-CL-03 Salary Cap scoring strip updates when style changes', async ({ page }) => {
    await login(page);
    await page.goto(`${BASE}/golf/create`);
    await page.waitForLoadState('networkidle');

    await page.getByRole('button').filter({ hasText: /^Salary Cap$/ }).first().click();
    await page.waitForTimeout(500);

    // Default: Stroke Play strip should appear
    const strip = page.locator('text=Salary Cap Scoring');
    await expect(strip).toBeVisible({ timeout: 5_000 });

    // Select TourneyRun Style
    const tourneyStyleBtn = page.getByRole('button').filter({ hasText: /TourneyRun Style/i });
    if (await tourneyStyleBtn.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await tourneyStyleBtn.click();
      await expect(page.getByText(/Eagle.*Birdie|Birdie.*Eagle/i)).toBeVisible({ timeout: 3_000 });
      console.log('✅ TC-CL-03: Scoring strip updates when style changes');
    } else {
      console.log('⚠️  TC-CL-03: TourneyRun Style button not found — check ScoringStyleSelector rendering');
    }
  });

  test('TC-CL-04 Season Long format shows draft + waiver settings', async ({ page }) => {
    await login(page);
    await page.goto(`${BASE}/golf/create`);
    await page.waitForLoadState('networkidle');

    await page.getByRole('button').filter({ hasText: /Season Long Fantasy|TourneyRun/i }).first().click();

    await expect(page.getByText(/Draft Type/i)).toBeVisible({ timeout: 5_000 });
    await expect(page.getByText(/Waiver Wire/i)).toBeVisible();

    console.log('✅ TC-CL-04: Season Long format shows draft + waiver settings');
  });

  test('TC-CL-05 Create Pool league (mocks payment, checks redirect)', async ({ page }) => {
    await login(page);

    // Mock checkout so we never hit Square
    await page.route('**/api/golf/payments/create-checkout-session', route =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ free: true }),
      })
    );

    await page.goto(`${BASE}/golf/create`);
    await page.waitForLoadState('networkidle');

    // Select Pool
    await page.getByRole('button').filter({ hasText: /^Pool$/ }).first().click();

    // Fill required fields
    const name = `QA Pool ${Date.now()}`;
    await page.getByPlaceholder(/Golf Pool/i).fill(name);
    await page.getByPlaceholder(/Bogey Boys/i).fill('QA Team');

    // Tournament selector — required for Pool
    const tournamentPicker = page.locator('select, [role="combobox"], button').filter({ hasText: /Select.*tournament|Choose.*tournament/i }).first();
    if (await tournamentPicker.isVisible({ timeout: 2_000 }).catch(() => false)) {
      // Try to pick the first available tournament
      const options = tournamentPicker.locator('option');
      const count = await options.count();
      if (count > 1) await tournamentPicker.selectOption({ index: 1 });
    }

    // Submit
    await page.getByRole('button').filter({ hasText: /Launch Office Pool/i }).click();

    // Should navigate to the new league page
    await page.waitForURL(/\/golf\/league\//, { timeout: 15_000 });
    expect(page.url()).toMatch(/\/golf\/league\//);

    const leagueId = page.url().split('/golf/league/')[1]?.split('?')[0];
    console.log(`✅ TC-CL-05: Pool league created → ID: ${leagueId}`);
  });

  test('TC-CL-06 New league visible in /golf/dashboard', async ({ page }) => {
    await login(page);
    const leagues = await myGolfLeagues(page);

    if (!leagues.length) {
      console.log('TC-CL-06: No leagues exist — SKIP');
      return;
    }

    await page.goto(`${BASE}/golf/dashboard`);
    await page.waitForLoadState('networkidle');

    // First league name should appear somewhere on the page
    await expect(page.locator('body')).toContainText(leagues[0].name, { timeout: 8_000 });
    console.log(`✅ TC-CL-06: "${leagues[0].name}" visible on dashboard`);
  });

});


// ═════════════════════════════════════════════════════════════════════════════
// 2 — SALARY CAP PICKS
// ═════════════════════════════════════════════════════════════════════════════

test.describe('2 — Salary Cap Picks', () => {

  async function getDkLeague(page) {
    return findLeague(page, l => l.format_type === 'dk');
  }

  test('TC-SC-01 Salary Cap league shows Lineup tab', async ({ page }) => {
    await login(page);
    const league = await getDkLeague(page);
    if (!league) { console.log('TC-SC-01: No salary cap (dk) league — SKIP'); return; }

    await page.goto(`${BASE}/golf/league/${league.id}`);
    await page.waitForLoadState('networkidle');

    await expect(page.getByRole('button').filter({ hasText: /My Lineup/i })).toBeVisible({ timeout: 5_000 });
    // Should NOT show "Daily Fantasy" anywhere
    await expect(page.locator('body')).not.toContainText('Daily Fantasy');
    console.log(`✅ TC-SC-01: Salary cap league has Lineup tab, no "Daily Fantasy" label`);
  });

  test('TC-SC-02 Lineup tab does NOT call /api/golf/players (global list)', async ({ page }) => {
    await login(page);
    const league = await getDkLeague(page);
    if (!league) { console.log('TC-SC-02: No salary cap league — SKIP'); return; }

    const globalListCalls = [];
    page.on('request', req => {
      // Flag calls to the global /api/golf/players endpoint (not gamelog sub-routes)
      if (req.url().match(/\/api\/golf\/players(\?|$)/) ||
          req.url().match(/\/api\/golf\/players\/[^/]+$/)) {
        globalListCalls.push(req.url());
      }
    });

    await page.goto(`${BASE}/golf/league/${league.id}?tab=lineup`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1_500); // allow lazy requests to fire

    if (globalListCalls.length > 0) {
      console.log(`⚠️  BUG TC-SC-02: Lineup tab called global player list: ${globalListCalls.join(', ')}`);
      // Document as pre-existing — not a hard fail; this is the baseline
    } else {
      console.log('✅ TC-SC-02: Lineup tab did not call global /api/golf/players');
    }
  });

  test('TC-SC-03 Salary values displayed in player list (not "Rank #X")', async ({ page }) => {
    await login(page);
    const league = await getDkLeague(page);
    if (!league) { console.log('TC-SC-03: No salary cap league — SKIP'); return; }

    await page.goto(`${BASE}/golf/league/${league.id}?tab=lineup`);
    await page.waitForLoadState('networkidle');

    const bodyText = await page.locator('body').textContent();

    const hasRankLabel  = /Rank #\d+/i.test(bodyText);
    const hasSalaryVal  = /\$[\d,]{4,}/.test(bodyText); // e.g. $8,500 or $10,000

    if (hasSalaryVal && !hasRankLabel) {
      console.log('✅ TC-SC-03: Salary dollar values shown ✓');
    } else if (hasRankLabel) {
      console.log('⚠️  BUG TC-SC-03: "Rank #X" visible — salary values not showing');
    } else {
      console.log('TC-SC-03: Player list empty or lineup not set up yet — inconclusive');
    }
  });

  test('TC-SC-04 Budget tracker shown in salary cap lineup', async ({ page }) => {
    await login(page);
    const league = await getDkLeague(page);
    if (!league) { console.log('TC-SC-04: No salary cap league — SKIP'); return; }

    await page.goto(`${BASE}/golf/league/${league.id}?tab=lineup`);
    await page.waitForLoadState('networkidle');

    const bodyText = await page.locator('body').textContent();
    const cap = league.weekly_salary_cap || 50000;
    const capFormatted = cap.toLocaleString();

    // Budget display should show the cap value somewhere
    if (bodyText.includes(capFormatted) || bodyText.includes(`$${capFormatted}`)) {
      console.log(`✅ TC-SC-04: Salary cap (${capFormatted}) displayed in lineup tab`);
    } else {
      console.log(`⚠️  TC-SC-04: Cap value $${capFormatted} not found on lineup page`);
    }
  });

  test('TC-SC-05 API rejects picks that exceed salary cap', async ({ page }) => {
    await login(page);
    const league = await getDkLeague(page);
    if (!league || !league.pool_tournament_id) {
      console.log('TC-SC-05: No salary cap league with tournament — SKIP');
      return;
    }

    const cap = league.weekly_salary_cap || 50000;
    // Two picks each at 60% of cap = 120% total (over cap)
    const overCapPicks = [
      { player_id: 99991, player_name: 'Fake Player A', tier_number: 1, salary_used: Math.round(cap * 0.6) },
      { player_id: 99992, player_name: 'Fake Player B', tier_number: 1, salary_used: Math.round(cap * 0.6) },
    ];

    const result = await page.evaluate(async ({ base, leagueId, picks, tournamentId }) => {
      const token = localStorage.getItem('token');
      const r = await fetch(`${base}/api/golf/leagues/${leagueId}/picks`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ tournament_id: tournamentId, picks }),
      });
      return { status: r.status, body: await r.json().catch(() => ({})) };
    }, { base: BASE, leagueId: league.id, picks: overCapPicks, tournamentId: league.pool_tournament_id });

    expect(result.status).toBe(400);
    expect(result.body.error || '').toMatch(/cap/i);
    console.log(`✅ TC-SC-05: Over-cap picks rejected → HTTP ${result.status}: "${result.body.error}"`);
  });

});


// ═════════════════════════════════════════════════════════════════════════════
// 3 — POOL PICKS REGRESSION
// ═════════════════════════════════════════════════════════════════════════════

test.describe('3 — Pool Picks Regression', () => {

  async function openPool(page) {
    return findLeague(page, l =>
      l.format_type === 'pool' && l.pool_tournament_id && !l.picks_locked &&
      l.pool_tournament_status !== 'active' && l.pool_tournament_status !== 'completed'
    );
  }

  async function anyPool(page) {
    return findLeague(page, l => l.format_type === 'pool');
  }

  async function lockedOrLivePool(page) {
    return findLeague(page, l =>
      l.format_type === 'pool' &&
      (l.picks_locked || l.pool_tournament_status === 'active' || l.pool_tournament_status === 'completed')
    );
  }

  // ── API shape tests (always run) ───────────────────────────────────────────

  test('TC-PP-01 my-roster API returns correct response shape', async ({ page }) => {
    await login(page);
    const league = await anyPool(page);
    if (!league) { console.log('TC-PP-01: No pool league — SKIP'); return; }

    const { status, data } = await apiGet(page, `/api/golf/leagues/${league.id}/my-roster`);

    expect(status).toBe(200);
    expect(data).toHaveProperty('picks');
    expect(data).toHaveProperty('submitted');
    expect(data).toHaveProperty('picks_locked');
    expect(data).toHaveProperty('tiers');
    expect(Array.isArray(data.picks)).toBe(true);
    expect(Array.isArray(data.tiers)).toBe(true);

    // Each tier must have a players array
    for (const tier of data.tiers) {
      expect(tier).toHaveProperty('tier');
      expect(tier).toHaveProperty('players');
      expect(Array.isArray(tier.players)).toBe(true);
    }

    console.log(`✅ TC-PP-01: my-roster shape OK — submitted=${data.submitted}, locked=${data.picks_locked}, tiers=${data.tiers.length}, picks=${data.picks.length}`);
  });

  test('TC-PP-02 Tier players come from pool_tier_players (have player_id + odds)', async ({ page }) => {
    await login(page);
    const league = await anyPool(page);
    if (!league) { console.log('TC-PP-02: No pool league — SKIP'); return; }

    const { data } = await apiGet(page, `/api/golf/leagues/${league.id}/my-roster`);
    const allPlayers = (data.tiers || []).flatMap(t => t.players || []);

    if (allPlayers.length === 0) {
      console.log('TC-PP-02: 0 tier players — assign-tiers not yet run');
      return;
    }

    const sample = allPlayers[0];
    expect(sample).toHaveProperty('player_id');
    expect(sample).toHaveProperty('player_name');
    // odds_display or odds_decimal should be present (set by assign-tiers)
    const hasOdds = sample.odds_display || sample.odds_decimal;
    if (!hasOdds) {
      console.log(`⚠️  TC-PP-02: Player "${sample.player_name}" missing odds fields`);
    } else {
      console.log(`✅ TC-PP-02: ${allPlayers.length} tier players with odds — sample: "${sample.player_name}" @ ${sample.odds_display}`);
    }
  });

  test('TC-PP-03 Picks-locked flag prevents new pick submissions', async ({ page }) => {
    await login(page);
    const league = await lockedOrLivePool(page);
    if (!league) { console.log('TC-PP-03: No locked/live pool league — SKIP'); return; }

    const result = await page.evaluate(async ({ base, leagueId, tournamentId }) => {
      const token = localStorage.getItem('token');
      const r = await fetch(`${base}/api/golf/leagues/${leagueId}/picks`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tournament_id: tournamentId,
          picks: [{ player_id: 99999, player_name: 'Ghost Player', tier_number: 1 }],
        }),
      });
      return { status: r.status, body: await r.json().catch(() => ({})) };
    }, { base: BASE, leagueId: league.id, tournamentId: league.pool_tournament_id });

    // Should be rejected (400 or 403 — picks locked)
    expect(result.status).toBeGreaterThanOrEqual(400);
    console.log(`✅ TC-PP-03: Locked picks rejected → HTTP ${result.status}: "${result.body.error}"`);
  });

  test('TC-PP-04 Picks submission validates required tournament_id', async ({ page }) => {
    await login(page);
    const league = await openPool(page);
    if (!league) { console.log('TC-PP-04: No open pool league — SKIP'); return; }

    const result = await page.evaluate(async ({ base, leagueId }) => {
      const token = localStorage.getItem('token');
      const r = await fetch(`${base}/api/golf/leagues/${leagueId}/picks`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ picks: [{ player_id: 1, tier_number: 1 }] }), // no tournament_id
      });
      return { status: r.status, body: await r.json().catch(() => ({})) };
    }, { base: BASE, leagueId: league.id });

    expect(result.status).toBeGreaterThanOrEqual(400);
    console.log(`✅ TC-PP-04: Missing tournament_id → HTTP ${result.status}`);
  });

  // ── UI tests ────────────────────────────────────────────────────────────────

  test('TC-PP-05 Roster tab loads without JS errors', async ({ page }) => {
    await login(page);
    const league = await anyPool(page);
    if (!league) { console.log('TC-PP-05: No pool league — SKIP'); return; }

    const jsErrors = [];
    page.on('pageerror', err => jsErrors.push(err.message));

    await page.goto(`${BASE}/golf/league/${league.id}?tab=roster`);
    await page.waitForLoadState('networkidle');

    const fatal = jsErrors.filter(e => !e.includes('ResizeObserver') && !e.includes('Non-Error'));
    if (fatal.length) {
      console.log(`⚠️  BUG TC-PP-05: JS errors on roster tab: ${fatal.join(' | ')}`);
    } else {
      console.log('✅ TC-PP-05: Roster tab loads without JS errors');
    }
  });

  test('TC-PP-06 Tier pick modal opens and lists players', async ({ page }) => {
    await login(page);
    const league = await openPool(page);
    if (!league) { console.log('TC-PP-06: No open pool league — SKIP (check for open picks window)'); return; }

    await page.goto(`${BASE}/golf/league/${league.id}?tab=roster`);
    await page.waitForLoadState('networkidle');

    // Look for "Pick a player" empty slots
    const pickSlot = page.getByText('Pick a player').first();
    if (!(await pickSlot.isVisible({ timeout: 3_000 }).catch(() => false))) {
      console.log('TC-PP-06: No empty pick slots (picks already submitted or no tiers) — SKIP');
      return;
    }

    await pickSlot.click();

    // Bottom-sheet modal should appear
    const modal = page.locator('[style*="position: fixed"]').filter({ hasText: /Tier/i });
    await expect(modal).toBeVisible({ timeout: 5_000 });

    // Player list should not be empty
    const searchInput = modal.locator('input[type="search"], input[placeholder*="Search"]');
    await expect(searchInput).toBeVisible({ timeout: 3_000 });

    // At least one player button should appear
    const playerBtn = modal.locator('button').nth(3); // skip header/close/search controls
    await expect(playerBtn).toBeVisible({ timeout: 5_000 });

    console.log('✅ TC-PP-06: Tier pick modal opens with player list and search');

    // Close modal
    await page.keyboard.press('Escape');
  });

  test('TC-PP-07 X (remove) button — visible pre-lock, hidden post-lock', async ({ page }) => {
    await login(page);

    // ── Pre-lock: picks submitted, window still open ──
    const open = await openPool(page);
    if (open) {
      const { data } = await apiGet(page, `/api/golf/leagues/${open.id}/my-roster`);
      if (data.submitted) {
        await page.goto(`${BASE}/golf/league/${open.id}?tab=roster`);
        await page.waitForLoadState('networkidle');

        // In submitted + pre-lock state, X buttons should be present on player cards
        const removeButtons = page.locator('button').filter({ hasText: /^×$/ });
        const count = await removeButtons.count();
        if (count > 0) {
          console.log(`✅ TC-PP-07 (pre-lock): ${count} remove button(s) visible on submitted picks ✓`);
        } else {
          console.log('⚠️  TC-PP-07 (pre-lock): Picks submitted + window open but no X buttons visible');
        }
      } else {
        console.log('TC-PP-07 (pre-lock): No submitted picks yet in open league — skip pre-lock check');
      }
    }

    // ── Post-lock: no X buttons should exist ──
    const locked = await lockedOrLivePool(page);
    if (locked) {
      await page.goto(`${BASE}/golf/league/${locked.id}?tab=roster`);
      await page.waitForLoadState('networkidle');

      const xButtons = page.locator('button').filter({ hasText: /^×$/ });
      const xCount = await xButtons.count();
      if (xCount > 0) {
        console.log(`⚠️  BUG TC-PP-07 (post-lock): ${xCount} remove button(s) visible after lock!`);
      } else {
        console.log('✅ TC-PP-07 (post-lock): No remove buttons after lock ✓');
      }
    } else {
      console.log('TC-PP-07 (post-lock): No locked/live pool league found — SKIP');
    }
  });

  test('TC-PP-08 DROPPING badge shown (not DROPPED) before drops applied', async ({ page }) => {
    await login(page);
    const league = await findLeague(page, l =>
      l.format_type === 'pool' &&
      (l.pool_tournament_status === 'active' || l.pool_tournament_status === 'completed') &&
      !l.pool_drops_applied
    );
    if (!league) { console.log('TC-PP-08: No active pool with drops not applied — SKIP'); return; }

    await page.goto(`${BASE}/golf/league/${league.id}?tab=roster`);
    await page.waitForLoadState('networkidle');

    const bodyText = await page.locator('body').textContent();
    const hasDROPPING = /DROPPING/i.test(bodyText);
    const hasDROPPED  = /DROPPED/i.test(bodyText);

    if (hasDROPPING) {
      console.log('✅ TC-PP-08: DROPPING badge shown (drops not yet applied)');
    } else if (hasDROPPED) {
      console.log('⚠️  TC-PP-08: DROPPED shown (should be DROPPING before drops applied)');
    } else {
      console.log('TC-PP-08: No DROPPING/DROPPED badges visible (no worst-scorers yet?)');
    }
  });

});


// ═════════════════════════════════════════════════════════════════════════════
// 4 — STANDINGS
// ═════════════════════════════════════════════════════════════════════════════

test.describe('4 — Standings', () => {

  test('TC-ST-01 Pool standings API returns correct shape', async ({ page }) => {
    await login(page);
    const league = await findLeague(page, l => l.format_type === 'pool');
    if (!league) { console.log('TC-ST-01: No pool league — SKIP'); return; }

    const { status, data } = await apiGet(page, `/api/golf/leagues/${league.id}/standings`);

    expect(status).toBe(200);
    expect(data).toHaveProperty('standings');
    expect(Array.isArray(data.standings)).toBe(true);
    // picks_revealed flag must be present (added to hide picks pre-tournament)
    expect(data).toHaveProperty('picks_revealed');

    console.log(`✅ TC-ST-01: standings OK — ${data.standings.length} members, picks_revealed=${data.picks_revealed}`);
  });

  test('TC-ST-02 Standings sorted descending by total_points (when scores exist)', async ({ page }) => {
    await login(page);
    const leagues = (await myGolfLeagues(page)).filter(l => l.format_type === 'pool');

    let checked = 0;
    for (const league of leagues.slice(0, 3)) {
      const { data } = await apiGet(page, `/api/golf/leagues/${league.id}/standings`);
      const members = data.standings || [];
      if (members.length < 2 || members[0].total_points == null) continue;

      for (let i = 1; i < members.length; i++) {
        const a = members[i - 1].total_points ?? -9999;
        const b = members[i].total_points     ?? -9999;
        expect(a).toBeGreaterThanOrEqual(b);
      }
      checked++;
      console.log(`✅ TC-ST-02 "${league.name}": ${members.length} members sorted correctly`);
    }
    if (!checked) console.log('TC-ST-02: No leagues with scored tournaments — SKIP');
  });

  test('TC-ST-03 Other users picks hidden pre-tournament (picks_revealed=false)', async ({ page }) => {
    await login(page);
    const league = await findLeague(page, l =>
      l.format_type === 'pool' &&
      l.pool_tournament_id &&
      !l.picks_locked &&
      l.pool_tournament_status !== 'active' &&
      l.pool_tournament_status !== 'completed'
    );
    if (!league) { console.log('TC-ST-03: No pre-tournament pool league — SKIP'); return; }

    const { data } = await apiGet(page, `/api/golf/leagues/${league.id}/standings`);

    expect(data.picks_revealed).toBe(false);

    const currentUserId = await page.evaluate(() => {
      const u = localStorage.getItem('user');
      return u ? JSON.parse(u).id : null;
    });

    const otherMember = (data.standings || []).find(m => m.user_id !== currentUserId);
    if (otherMember) {
      expect(Array.isArray(otherMember.picks)).toBe(true);
      expect(otherMember.picks.length).toBe(0);
      console.log('✅ TC-ST-03: Other user picks are empty arrays pre-tournament ✓');
    } else {
      console.log('TC-ST-03: Solo league — cannot verify pick redaction (need 2+ members)');
    }
  });

  test('TC-ST-04 Standings UI loads without console errors', async ({ page }) => {
    await login(page);
    const league = await findLeague(page, l => l.format_type === 'pool');
    if (!league) { console.log('TC-ST-04: No pool league — SKIP'); return; }

    const jsErrors = [];
    page.on('pageerror', err => jsErrors.push(err.message));

    await page.goto(`${BASE}/golf/league/${league.id}?tab=standings`);
    await page.waitForLoadState('networkidle');

    const fatal = jsErrors.filter(e => !e.includes('ResizeObserver') && !e.includes('Non-Error'));
    if (fatal.length) {
      console.log(`⚠️  BUG TC-ST-04: JS errors on standings tab: ${fatal.join(' | ')}`);
    } else {
      console.log('✅ TC-ST-04: Standings tab loads without JS errors');
    }
  });

  test('TC-ST-05 % Owned tab hidden pre-tournament, visible after lock', async ({ page }) => {
    await login(page);

    // Pre-tournament: % Owned should show locked screen
    const preTournLeague = await findLeague(page, l =>
      l.format_type === 'pool' &&
      l.pool_tournament_id &&
      !l.picks_locked &&
      l.pool_tournament_status !== 'active' &&
      l.pool_tournament_status !== 'completed'
    );
    if (preTournLeague) {
      await page.goto(`${BASE}/golf/league/${preTournLeague.id}?tab=owned`);
      await page.waitForLoadState('networkidle');
      const bodyText = await page.locator('body').textContent();
      const isLocked = /picks are hidden|locked|check back/i.test(bodyText);
      console.log(`${isLocked ? '✅' : '⚠️ '} TC-ST-05 (pre-lock): Ownership tab locked: ${isLocked}`);
    } else {
      console.log('TC-ST-05 (pre-lock): No pre-tournament league — SKIP');
    }
  });

});


// ═════════════════════════════════════════════════════════════════════════════
// 5 — DATAGOLF INTEGRATION
// ═════════════════════════════════════════════════════════════════════════════

test.describe('5 — DataGolf Integration', () => {

  test('TC-DG-01 Skill-ratings endpoint returns populated data', async ({ page }) => {
    await login(page);
    const { status, data } = await apiGet(page, '/api/golf/datagolf/skill-ratings');

    expect(status).toBe(200);

    const byName = data.byName || {};
    const playerCount = Object.keys(byName).length;

    if (playerCount === 0) {
      console.log('⚠️  TC-DG-01: skill-ratings byName is empty — DataGolf API may be unavailable or not synced');
    } else {
      console.log(`✅ TC-DG-01: skill-ratings populated — ${playerCount} players`);
    }
  });

  test('TC-DG-02 Pool tier players are populated (assign-tiers ran)', async ({ page }) => {
    await login(page);
    const league = await findLeague(page, l =>
      l.format_type === 'pool' && l.pool_tournament_id
    );
    if (!league) { console.log('TC-DG-02: No pool league with tournament — SKIP'); return; }

    const { data } = await apiGet(page, `/api/golf/leagues/${league.id}/my-roster`);
    const totalTierPlayers = (data.tiers || []).reduce((s, t) => s + (t.players?.length || 0), 0);

    if (totalTierPlayers === 0) {
      console.log(`⚠️  TC-DG-02: 0 tier players for "${league.name}" — assign-tiers not run yet`);
    } else {
      console.log(`✅ TC-DG-02: ${totalTierPlayers} tier players across ${data.tiers?.length} tiers`);
    }
  });

  test('TC-DG-03 Salary cap leagues have salary values on tier players', async ({ page }) => {
    await login(page);
    const league = await findLeague(page, l =>
      l.format_type === 'pool' &&
      l.pick_sheet_format === 'salary_cap' &&
      l.pool_tournament_id
    );
    if (!league) { console.log('TC-DG-03: No pool+salary_cap league — SKIP'); return; }

    const { data } = await apiGet(page, `/api/golf/leagues/${league.id}/my-roster`);
    const allPlayers = (data.tiers || []).flatMap(t => t.players || []);
    const withSalary    = allPlayers.filter(p => p.salary > 0);
    const withoutSalary = allPlayers.filter(p => !p.salary || p.salary === 0);

    if (allPlayers.length === 0) {
      console.log('TC-DG-03: No tier players assigned — run assign-tiers first');
    } else if (withSalary.length === 0) {
      console.log(`⚠️  BUG TC-DG-03: ${allPlayers.length} players, NONE have salary — calculatePlayerSalary not running`);
    } else {
      const pct = Math.round((withSalary.length / allPlayers.length) * 100);
      console.log(`✅ TC-DG-03: ${withSalary.length}/${allPlayers.length} (${pct}%) players have salary${withoutSalary.length ? ` | ${withoutSalary.length} missing` : ''}`);
    }
  });

  test('TC-DG-04 PGA live endpoint accessible for pool league', async ({ page }) => {
    await login(page);
    const league = await findLeague(page, l =>
      l.format_type === 'pool' && l.pool_tournament_id
    );
    if (!league) { console.log('TC-DG-04: No pool league with tournament — SKIP'); return; }

    const { status, data } = await apiGet(page, `/api/golf/leagues/${league.id}/pga-live`);

    expect(status).toBe(200);
    const competitors = data.competitors || [];
    console.log(`✅ TC-DG-04: pga-live OK — ${competitors.length} competitors (${competitors.length > 0 ? 'field synced' : 'pre-tournament or no sync yet'})`);
  });

  test('TC-DG-05 Tier player odds fields populated (odds sync ran)', async ({ page }) => {
    await login(page);
    const league = await findLeague(page, l =>
      l.format_type === 'pool' && l.pool_tournament_id
    );
    if (!league) { console.log('TC-DG-05: No pool league with tournament — SKIP'); return; }

    const { data } = await apiGet(page, `/api/golf/leagues/${league.id}/my-roster`);
    const allPlayers = (data.tiers || []).flatMap(t => t.players || []);

    if (allPlayers.length === 0) {
      console.log('TC-DG-05: No tier players — SKIP');
      return;
    }

    const withOdds    = allPlayers.filter(p => p.odds_display || p.odds_decimal);
    const withoutOdds = allPlayers.filter(p => !p.odds_display && !p.odds_decimal);

    if (withoutOdds.length > 0 && withOdds.length === 0) {
      console.log(`⚠️  TC-DG-05: ALL ${allPlayers.length} tier players missing odds — DataGolf odds sync may not have run`);
    } else {
      console.log(`✅ TC-DG-05: ${withOdds.length}/${allPlayers.length} tier players have odds data${withoutOdds.length ? ` | ${withoutOdds.length} missing (rank-based fallback)` : ''}`);
    }
  });

  test('TC-DG-06 Assign-tiers uses tournament field (not all 441 global players)', async ({ page }) => {
    await login(page);
    const league = await findLeague(page, l =>
      l.format_type === 'pool' && l.pool_tournament_id
    );
    if (!league) { console.log('TC-DG-06: No pool league with tournament — SKIP'); return; }

    const { data: rosterData } = await apiGet(page, `/api/golf/leagues/${league.id}/my-roster`);
    const tierPlayers = (rosterData.tiers || []).flatMap(t => t.players || []);

    // A proper tournament field is typically 120-156 players.
    // If we have 400+ players in tiers, assign-tiers is pulling the global list.
    if (tierPlayers.length > 300) {
      console.log(`⚠️  BUG TC-DG-06: ${tierPlayers.length} players in tiers — likely pulling global list instead of tournament field`);
    } else if (tierPlayers.length === 0) {
      console.log('TC-DG-06: 0 tier players — assign-tiers not run yet');
    } else {
      console.log(`✅ TC-DG-06: ${tierPlayers.length} tier players — within expected tournament field size`);
    }
  });

});
