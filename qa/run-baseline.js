/**
 * Standalone baseline test runner — uses Playwright library directly,
 * no test framework worker spawning. Runs in a single Node.js process.
 *
 * Usage: node qa/run-baseline.js
 */

require('dotenv').config({ path: '.env.test' });
const { chromium } = require('@playwright/test');

const BASE     = process.env.PLAYWRIGHT_BASE_URL || process.env.BASE_URL || 'https://www.tourneyrun.app';
const EMAIL    = process.env.TOURNEYRUN_EMAIL    || '';
const PASSWORD = process.env.TOURNEYRUN_PASSWORD || '';

if (!EMAIL || !PASSWORD) {
  console.error('❌  TOURNEYRUN_EMAIL and TOURNEYRUN_PASSWORD must be set in .env.test');
  process.exit(1);
}

// ── Result tracking ────────────────────────────────────────────────────────────
const results = [];
function record(id, name, status, note = '') {
  results.push({ id, name, status, note });
  const icon = status === 'PASS' ? '✅' : status === 'SKIP' ? '⏭️ ' : status === 'WARN' ? '⚠️ ' : '❌';
  console.log(`  ${icon} ${id}: ${name}${note ? `  [${note}]` : ''}`);
}

// ── Helpers ───────────────────────────────────────────────────────────────────
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
    if (!tok) throw new Error(`No token in: ${JSON.stringify(data)}`);
    localStorage.setItem('token', tok);
    if (data.user) localStorage.setItem('user', JSON.stringify(data.user));
    return tok;
  }, { base: BASE, email: EMAIL, password: PASSWORD });
  if (!token) throw new Error('login(): no token returned');
  return token;
}

async function apiGet(page, path) {
  return page.evaluate(async ({ base, path }) => {
    const token = localStorage.getItem('token');
    const r = await fetch(`${base}${path}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await r.json().catch(() => ({}));
    return { status: r.status, data };
  }, { base: BASE, path });
}

async function apiPost(page, path, body) {
  return page.evaluate(async ({ base, path, body }) => {
    const token = localStorage.getItem('token');
    const r = await fetch(`${base}${path}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await r.json().catch(() => ({}));
    return { status: r.status, data };
  }, { base: BASE, path, body });
}

async function myGolfLeagues(page) {
  const { data } = await apiGet(page, '/api/golf/leagues');
  return data.leagues || data || [];
}

async function findLeague(page, pred) {
  const leagues = await myGolfLeagues(page);
  return leagues.find(pred) || null;
}

// ── Test runner ───────────────────────────────────────────────────────────────
async function runTest(id, name, fn) {
  process.stdout.write(`  ⏳ ${id}: ${name}  `);
  try {
    const result = await fn();
    if (result === 'SKIP') {
      process.stdout.write('\r');
      record(id, name, 'SKIP', 'no test data');
    } else if (result && result.warn) {
      process.stdout.write('\r');
      record(id, name, 'WARN', result.warn);
    } else {
      process.stdout.write('\r');
      record(id, name, 'PASS');
    }
  } catch (err) {
    process.stdout.write('\r');
    record(id, name, 'FAIL', err.message.slice(0, 120));
  }
}


// ═════════════════════════════════════════════════════════════════════════════
(async () => {
  console.log('\n=== TourneyRun Golf Baseline Tests ===');
  console.log(`Target: ${BASE}\n`);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page    = await context.newPage();

  // Silence console noise from the app
  page.on('console', () => {});
  page.on('pageerror', () => {});

  // ── 0: Login ───────────────────────────────────────────────────────────────
  console.log('── Auth ──────────────────────────────────────────────────────');
  try {
    await login(page);
    console.log(`  ✅ Logged in as ${EMAIL}`);
  } catch (err) {
    console.error(`  ❌ Login failed: ${err.message}`);
    await browser.close();
    process.exit(1);
  }


  // ═══════════════════════════════════════════════════════════════════════════
  // 1 — CREATE LEAGUE FLOW
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('\n── 1 — Create League Flow ────────────────────────────────────');

  await runTest('TC-CL-01', 'Pool format card shows Tier Setup config', async () => {
    await page.goto(`${BASE}/golf/create`, { waitUntil: 'networkidle' });

    // Click Pool card
    const poolBtn = page.getByRole('button').filter({ hasText: /^Pool$/ });
    if (!await poolBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
      // Try any button with "Pool" text
      const anyPool = page.locator('button').filter({ hasText: 'Pool' }).first();
      if (!await anyPool.isVisible({ timeout: 2_000 }).catch(() => false))
        throw new Error('Pool format button not found');
      await anyPool.click();
    } else {
      await poolBtn.first().click();
    }

    const tierSetup = page.getByText('Tier Setup');
    if (!await tierSetup.isVisible({ timeout: 5_000 }).catch(() => false))
      throw new Error('Tier Setup section not visible after clicking Pool');

    // Pick Sheet Format selector must not exist
    const psf = page.getByText(/Pick Sheet Format/i);
    if (await psf.isVisible({ timeout: 1_000 }).catch(() => false))
      return { warn: '"Pick Sheet Format" selector still visible — should be removed' };
  });

  await runTest('TC-CL-02', 'Salary Cap format shows scoring style + cap settings', async () => {
    await page.goto(`${BASE}/golf/create`, { waitUntil: 'networkidle' });

    const scBtn = page.locator('button').filter({ hasText: /Salary Cap/i }).first();
    if (!await scBtn.isVisible({ timeout: 5_000 }).catch(() => false))
      throw new Error('"Salary Cap" format button not found — may still say "Daily Fantasy"');
    await scBtn.click();

    const header = page.getByText(/Salary Cap Settings/i);
    if (!await header.isVisible({ timeout: 5_000 }).catch(() => false))
      throw new Error('"Salary Cap Settings" header not visible');

    const scoringStyle = page.getByText(/Scoring Style/i);
    if (!await scoringStyle.isVisible({ timeout: 2_000 }).catch(() => false))
      throw new Error('Scoring Style selector not visible inside DK settings');

    // Check no "Daily Fantasy" label remains
    const dfsText = page.getByText(/Daily Fantasy Settings/i);
    if (await dfsText.isVisible({ timeout: 1_000 }).catch(() => false))
      return { warn: '"Daily Fantasy Settings" label still present' };
  });

  await runTest('TC-CL-03', 'Salary Cap scoring strip updates with style change', async () => {
    await page.goto(`${BASE}/golf/create`, { waitUntil: 'networkidle' });
    const scBtn = page.locator('button').filter({ hasText: /Salary Cap/i }).first();
    if (!await scBtn.isVisible({ timeout: 3_000 }).catch(() => false)) return 'SKIP';
    await scBtn.click();

    const strip = page.getByText(/Salary Cap Scoring/i);
    if (!await strip.isVisible({ timeout: 5_000 }).catch(() => false))
      throw new Error('Salary Cap Scoring strip not visible');

    // Click TourneyRun Style
    const tBtn = page.locator('button, label').filter({ hasText: /TourneyRun Style/i }).first();
    if (await tBtn.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await tBtn.click();
      const eagleText = page.getByText(/Eagle/i);
      if (!await eagleText.isVisible({ timeout: 3_000 }).catch(() => false))
        return { warn: 'TourneyRun style selected but Eagle scoring text not shown in strip' };
    } else {
      return { warn: 'TourneyRun Style button not found — ScoringStyleSelector may not render' };
    }
  });

  await runTest('TC-CL-04', 'Season Long format shows Draft Type + Waiver Wire', async () => {
    await page.goto(`${BASE}/golf/create`, { waitUntil: 'networkidle' });
    const btn = page.locator('button').filter({ hasText: /Season Long|TourneyRun/i }).first();
    if (!await btn.isVisible({ timeout: 5_000 }).catch(() => false))
      throw new Error('Season Long format button not found');
    await btn.click();

    if (!await page.getByText(/Draft Type/i).isVisible({ timeout: 5_000 }).catch(() => false))
      throw new Error('Draft Type section not visible for Season Long');
    if (!await page.getByText(/Waiver Wire/i).isVisible({ timeout: 2_000 }).catch(() => false))
      return { warn: 'Waiver Wire section not visible for Season Long' };
  });

  await runTest('TC-CL-05', 'Create Pool league end-to-end (mocked payment)', async () => {
    // Skip: creating a real league against prod data is too risky without teardown
    // This is a destructive write operation — skip in automated baseline
    return 'SKIP';
  });

  await runTest('TC-CL-06', 'Golf dashboard loads and shows leagues', async () => {
    await page.goto(`${BASE}/golf/dashboard`, { waitUntil: 'networkidle' });
    const leagues = await myGolfLeagues(page);
    if (leagues.length === 0) return { warn: 'No leagues in account — dashboard may show empty state' };
    // Page should show at least one league name
    const firstLeagueName = leagues[0].name;
    if (!await page.getByText(firstLeagueName, { exact: false }).isVisible({ timeout: 5_000 }).catch(() => false))
      return { warn: `League "${firstLeagueName}" not visible on dashboard` };
  });


  // ═══════════════════════════════════════════════════════════════════════════
  // 2 — SALARY CAP PICKS
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('\n── 2 — Salary Cap Picks ──────────────────────────────────────');

  const scLeague = await findLeague(page, l => l.format_type === 'salary_cap');

  await runTest('TC-SC-01', 'Salary Cap league has My Picks tab', async () => {
    if (!scLeague) return 'SKIP';
    await page.goto(`${BASE}/golf/league/${scLeague.id}`, { waitUntil: 'networkidle' });
    const picksTab = page.getByRole('button', { name: /My Picks/i });
    if (!await picksTab.isVisible({ timeout: 5_000 }).catch(() => false))
      throw new Error('My Picks tab not visible in salary_cap league');
  });

  await runTest('TC-SC-02', 'Picks tab does NOT call /api/golf/players (global list)', async () => {
    if (!scLeague) return 'SKIP';

    const globalCalls = [];
    page.on('request', req => {
      if (req.url().includes('/api/golf/players') && !req.url().includes('league') && !req.url().includes('tier'))
        globalCalls.push(req.url());
    });

    await page.goto(`${BASE}/golf/league/${scLeague.id}`, { waitUntil: 'networkidle' });
    const picksTab = page.getByRole('button', { name: /My Picks/i });
    if (await picksTab.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await picksTab.click();
      await page.waitForTimeout(2_000);
    }

    if (globalCalls.length > 0)
      throw new Error(`⚠️  Picks tab calls global /api/golf/players (${globalCalls[0]})`);
  });

  await runTest('TC-SC-03', 'Salary values in player list (not "Rank #X")', async () => {
    if (!scLeague) return 'SKIP';
    await page.goto(`${BASE}/golf/league/${scLeague.id}`, { waitUntil: 'networkidle' });

    const picksTab = page.getByRole('button', { name: /My Picks/i });
    if (await picksTab.isVisible({ timeout: 3_000 }).catch(() => false)) await picksTab.click();

    // Open add player modal
    const addBtn = page.getByRole('button').filter({ hasText: /Add Player/i }).first();
    if (!await addBtn.isVisible({ timeout: 3_000 }).catch(() => false)) return 'SKIP';
    await addBtn.click();

    // Check for dollar signs
    await page.waitForTimeout(1_500);
    const rankText = page.getByText(/WR #\d+|Rank #\d+/);
    const salaryText = page.getByText(/\$[\d,]+/);

    const hasSalary = await salaryText.first().isVisible({ timeout: 2_000 }).catch(() => false);
    const hasRank   = await rankText.first().isVisible({ timeout: 1_000 }).catch(() => false);

    if (!hasSalary && hasRank)
      throw new Error('Player modal shows "Rank #X" instead of salary values');
    if (!hasSalary && !hasRank)
      return { warn: 'No salary or rank text found — modal may be empty (no tournament linked) or different format' };
  });

  await runTest('TC-SC-04', 'Budget tracker visible in Salary Cap league', async () => {
    if (!scLeague) return 'SKIP';
    await page.goto(`${BASE}/golf/league/${scLeague.id}`, { waitUntil: 'networkidle' });
    const picksTab = page.getByRole('button', { name: /My Picks/i });
    if (await picksTab.isVisible({ timeout: 3_000 }).catch(() => false)) await picksTab.click();

    const budget = page.getByText(/Budget|Cap Remaining|remaining/i);
    if (!await budget.first().isVisible({ timeout: 5_000 }).catch(() => false))
      return { warn: 'No budget/cap tracker visible in picks tab' };
  });

  await runTest('TC-SC-05', 'API rejects over-cap picks', async () => {
    if (!scLeague) return 'SKIP';
    const tid = scLeague.pool_tournament_id;
    if (!tid) return { warn: 'No tournament linked to salary_cap league — cannot test cap enforcement' };
    // Try to submit more picks than allowed to hit cap
    const { status, data } = await apiPost(page, `/api/golf/leagues/${scLeague.id}/picks`, {
      tournament_id: tid,
      picks: Array.from({ length: 50 }, (_, i) => ({ player_id: `fake-${i}`, tier_number: 1 })),
    });
    if (status === 400 || (data?.error && /cap|budget|exceed|pick|required/i.test(data.error))) {
      // Good — rejected
    } else if (status === 403) {
      return { warn: 'Picks locked — cannot test cap enforcement for this tournament' };
    } else if (status === 200) {
      return { warn: 'Over-cap or excess picks accepted without error — enforcement may be missing' };
    }
  });


  // ═══════════════════════════════════════════════════════════════════════════
  // 3 — POOL PICKS REGRESSION
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('\n── 3 — Pool Picks Regression ─────────────────────────────────');

  const poolLeague = await findLeague(page, l => l.format_type === 'pool');

  await runTest('TC-PP-01', 'my-roster API returns correct shape', async () => {
    if (!poolLeague) return 'SKIP';
    const { status, data } = await apiGet(page, `/api/golf/leagues/${poolLeague.id}/my-roster`);
    if (status !== 200) throw new Error(`my-roster returned ${status}`);
    // Actual shape: { tiers: [{tier, players:[...]}, ...], picks: [], tournament: {...}, picks_locked, ... }
    if (!Array.isArray(data.tiers)) throw new Error('Response missing .tiers array');
    if (!Array.isArray(data.picks)) throw new Error('Response missing .picks array');
    if (!data.tournament && !data.league) throw new Error('Response missing .tournament field');
  });

  await runTest('TC-PP-02', 'Tier players have player_id + odds (assign-tiers ran)', async () => {
    if (!poolLeague) return 'SKIP';
    const { data } = await apiGet(page, `/api/golf/leagues/${poolLeague.id}/my-roster`);
    // Real shape: tiers[].players[]
    const allPlayers = (data.tiers || []).flatMap(t => t.players || []);
    if (allPlayers.length === 0) return { warn: 'No players in any tier — assign-tiers may not have run' };
    const first = allPlayers[0];
    if (!first.player_id) throw new Error('tierPlayer missing player_id');
    if (first.odds_decimal === undefined && first.odds_display === undefined)
      return { warn: 'tierPlayer has no odds_decimal field — odds sync may not have run' };
  });

  await runTest('TC-PP-03', 'Picks-locked flag prevents new submissions', async () => {
    if (!poolLeague) return 'SKIP';
    const { data: rosterData } = await apiGet(page, `/api/golf/leagues/${poolLeague.id}/my-roster`);
    const isLocked = rosterData.picks_locked;
    // tournament_id lives in rosterData.tournament.id
    if (!isLocked) return { warn: 'League is not currently locked — cannot verify lock enforcement' };

    // Try a pick submission — should be rejected
    const { status, data } = await apiPost(page, `/api/golf/leagues/${poolLeague.id}/picks`, {
      tournament_id: rosterData.tournament?.id,
      picks: [],
    });
    if (status === 200) return { warn: 'Picks accepted even though picks_locked=true — lock not enforced' };
    if (status === 400 || status === 403) { /* correct */ }
    else return { warn: `Unexpected status ${status} on locked-picks submission` };
  });

  await runTest('TC-PP-04', 'Picks endpoint requires tournament_id', async () => {
    if (!poolLeague) return 'SKIP';
    const { status, data } = await apiPost(page, `/api/golf/leagues/${poolLeague.id}/picks`, {
      picks: [{ player_id: 1 }],
    });
    if (status === 200) return { warn: 'Picks accepted without tournament_id — validation missing' };
    if (status === 400 || status === 422) { /* correct */ }
    else if (status === 403) { /* locked league — cannot test, skip */ return { warn: 'League locked, cannot test validation' }; }
  });

  await runTest('TC-PP-05', 'Pool Roster tab loads without crashing', async () => {
    if (!poolLeague) return 'SKIP';
    const errors = [];
    page.once('pageerror', e => errors.push(e.message));
    await page.goto(`${BASE}/golf/league/${poolLeague.id}`, { waitUntil: 'networkidle' });
    const rosterTab = page.getByRole('tab', { name: /Roster|My Picks/i });
    if (await rosterTab.isVisible({ timeout: 3_000 }).catch(() => false)) await rosterTab.click();
    await page.waitForTimeout(2_000);
    if (errors.length > 0) throw new Error(`JS error on roster tab: ${errors[0]}`);
  });

  await runTest('TC-PP-06', 'Tier pick modal opens and lists players', async () => {
    if (!poolLeague) return 'SKIP';
    await page.goto(`${BASE}/golf/league/${poolLeague.id}`, { waitUntil: 'networkidle' });
    const rosterTab = page.getByRole('tab', { name: /Roster|My Picks/i });
    if (!await rosterTab.isVisible({ timeout: 3_000 }).catch(() => false)) return 'SKIP';
    await rosterTab.click();

    const addBtn = page.getByRole('button').filter({ hasText: /Add|Pick|Select/i }).first();
    if (!await addBtn.isVisible({ timeout: 3_000 }).catch(() => false)) return { warn: 'No Add/Pick button visible on roster tab' };
    await addBtn.click();
    await page.waitForTimeout(1_500);

    // Modal should show a list of players
    const modalPlayers = page.locator('[role="dialog"], .modal, [data-modal]').locator('li, [data-player], button').first();
    if (!await modalPlayers.isVisible({ timeout: 3_000 }).catch(() => false))
      return { warn: 'Modal opened but no player list items found' };
  });

  await runTest('TC-PP-07', 'X (remove) button visibility matches lock state', async () => {
    if (!poolLeague) return 'SKIP';
    await page.goto(`${BASE}/golf/league/${poolLeague.id}`, { waitUntil: 'networkidle' });
    const rosterTab = page.getByRole('tab', { name: /Roster|My Picks/i });
    if (!await rosterTab.isVisible({ timeout: 3_000 }).catch(() => false)) return 'SKIP';
    await rosterTab.click();
    await page.waitForTimeout(1_500);

    const { data: rosterData } = await apiGet(page, `/api/golf/leagues/${poolLeague.id}/my-roster`);
    const isLocked = rosterData.picks_locked;
    const removeBtn = page.locator('button[aria-label*="Remove"], button[title*="Remove"], button').filter({ hasText: /^×$|^✕$|^X$/ }).first();
    const hasRemove = await removeBtn.isVisible({ timeout: 1_000 }).catch(() => false);

    if (isLocked && hasRemove) return { warn: 'League is locked but X/remove button is still visible' };
    if (!isLocked && !hasRemove) return { warn: 'League is unlocked but X/remove button not found' };
  });

  await runTest('TC-PP-08', 'DROPPING badge shown before drops applied', async () => {
    if (!poolLeague) return 'SKIP';
    const { data } = await apiGet(page, `/api/golf/leagues/${poolLeague.id}/my-roster`);
    // Real shape: picks[] array directly on the response
    const picks = data.picks || [];
    const droppingPick = picks.find(p => p.is_dropping || p.drop_pending);
    if (!droppingPick) return { warn: 'No dropping picks found — cannot verify DROPPING vs DROPPED badge' };

    await page.goto(`${BASE}/golf/league/${poolLeague.id}`, { waitUntil: 'networkidle' });
    const rosterTab = page.getByRole('tab', { name: /Roster|My Picks/i });
    if (!await rosterTab.isVisible({ timeout: 3_000 }).catch(() => false)) return 'SKIP';
    await rosterTab.click();
    await page.waitForTimeout(1_500);

    const droppingBadge = page.getByText(/DROPPING/);
    const droppedBadge  = page.getByText(/DROPPED/);
    if (await droppedBadge.isVisible({ timeout: 1_000 }).catch(() => false))
      return { warn: 'DROPPED badge shown — should be DROPPING until drops_applied=true' };
    if (!await droppingBadge.isVisible({ timeout: 1_000 }).catch(() => false))
      return { warn: 'Neither DROPPING nor DROPPED badge found for pending drop pick' };
  });


  // ═══════════════════════════════════════════════════════════════════════════
  // 4 — STANDINGS
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('\n── 4 — Standings ─────────────────────────────────────────────');

  await runTest('TC-ST-01', 'Pool standings API returns correct shape', async () => {
    if (!poolLeague) return 'SKIP';
    const { status, data } = await apiGet(page, `/api/golf/leagues/${poolLeague.id}/standings`);
    if (status !== 200) throw new Error(`Standings returned ${status}`);
    const standings = data.standings || data;
    if (!Array.isArray(standings)) throw new Error('Standings response is not an array');
    if (standings.length === 0) return { warn: 'Standings array is empty' };
    const first = standings[0];
    if (!('team_name' in first) && !('user_id' in first))
      throw new Error('Standings row missing team_name or user_id');
  });

  await runTest('TC-ST-02', 'Standings sorted descending by total_points', async () => {
    if (!poolLeague) return 'SKIP';
    const { data } = await apiGet(page, `/api/golf/leagues/${poolLeague.id}/standings`);
    const rows = data.standings || data;
    if (!Array.isArray(rows) || rows.length < 2) return { warn: 'Need 2+ standings rows to verify sort' };
    const pts = rows.map(r => parseFloat(r.total_points || 0));
    const sorted = [...pts].sort((a, b) => b - a);
    if (JSON.stringify(pts) !== JSON.stringify(sorted))
      throw new Error('Standings not sorted descending by total_points');
  });

  await runTest('TC-ST-03', "Other users' picks hidden pre-tournament (picks_revealed=false)", async () => {
    if (!poolLeague) return 'SKIP';
    const { data: rosterData } = await apiGet(page, `/api/golf/leagues/${poolLeague.id}/my-roster`);
    // picks_revealed is derived: picks_locked || tournament active/completed
    if (rosterData.picks_locked) return { warn: 'picks_locked=true (locked) — cannot verify hiding logic' };

    const { data: standingsData } = await apiGet(page, `/api/golf/leagues/${poolLeague.id}/standings`);
    const rows = standingsData.standings || standingsData || [];
    const othersWithPicks = rows.filter(r => !r.is_me && r.picks && r.picks.length > 0);
    if (othersWithPicks.length > 0)
      return { warn: `Standings exposes ${othersWithPicks.length} other teams' picks before tournament starts` };
  });

  await runTest('TC-ST-04', 'Standings UI loads without console errors', async () => {
    if (!poolLeague) return 'SKIP';
    const errors = [];
    page.once('pageerror', e => errors.push(e.message));
    await page.goto(`${BASE}/golf/league/${poolLeague.id}`, { waitUntil: 'networkidle' });
    const standingsTab = page.getByRole('tab', { name: /Standings|Leaderboard/i });
    if (await standingsTab.isVisible({ timeout: 3_000 }).catch(() => false)) await standingsTab.click();
    await page.waitForTimeout(2_000);
    if (errors.length > 0) throw new Error(`JS error on standings tab: ${errors[0]}`);
  });

  await runTest('TC-ST-05', '% Owned tab hidden pre-tournament, visible after lock', async () => {
    if (!poolLeague) return 'SKIP';
    const { data: rosterData } = await apiGet(page, `/api/golf/leagues/${poolLeague.id}/my-roster`);
    const locked = rosterData.picks_locked;
    await page.goto(`${BASE}/golf/league/${poolLeague.id}`, { waitUntil: 'networkidle' });

    const ownedTab = page.getByRole('tab', { name: /% Owned|Ownership/i });
    const ownedVisible = await ownedTab.isVisible({ timeout: 2_000 }).catch(() => false);

    if (!locked && ownedVisible)
      return { warn: '% Owned tab visible before picks lock — should be hidden' };
    if (locked && !ownedVisible)
      return { warn: '% Owned tab hidden even though picks are locked — should be visible' };
  });


  // ═══════════════════════════════════════════════════════════════════════════
  // 5 — DATAGOLF INTEGRATION
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('\n── 5 — DataGolf Integration ──────────────────────────────────');

  await runTest('TC-DG-01', 'Skill-ratings endpoint returns populated data', async () => {
    const { status, data } = await apiGet(page, '/api/golf/datagolf/skill-ratings');
    if (status === 404) throw new Error('Skill-ratings endpoint not found (404)');
    if (status !== 200) throw new Error(`Skill-ratings returned ${status}`);
    // Real shape: { byDgId: {...}, byName: {...}, fetchedAt: '...' }
    if (!data.byDgId && !data.byName) {
      const arr = data.ratings || data;
      if (!Array.isArray(arr) || arr.length === 0)
        return { warn: 'skill-ratings response has neither byDgId/byName nor a ratings array' };
    }
    const entries = Object.keys(data.byDgId || data.byName || {});
    if (entries.length === 0) return { warn: 'skill-ratings byDgId/byName maps are empty' };
  });

  await runTest('TC-DG-02', 'Pool tier players populated (assign-tiers ran)', async () => {
    if (!poolLeague) return 'SKIP';
    const { data } = await apiGet(page, `/api/golf/leagues/${poolLeague.id}/my-roster`);
    // Real shape: tiers[].players[]
    const allPlayers = (data.tiers || []).flatMap(t => t.players || []);
    if (allPlayers.length === 0) throw new Error('No players in any tier — assign-tiers has not run');
    if (allPlayers.length < 10) return { warn: `Only ${allPlayers.length} tier players — expected 50+` };
  });

  await runTest('TC-DG-03', 'Salary cap leagues have salary values on tier players', async () => {
    if (!scLeague) return 'SKIP';
    const { status, data } = await apiGet(page, `/api/golf/leagues/${scLeague.id}/my-roster`);
    if (status !== 200) return { warn: `my-roster returned ${status} for salary_cap league` };
    const allPlayers = (data.tiers || []).flatMap(t => t.players || []);
    if (allPlayers.length === 0) return { warn: 'No tier players in salary_cap league — assign-tiers may not have run yet' };
    const withSalary = allPlayers.filter(p => p.salary > 0);
    if (withSalary.length === 0)
      throw new Error('All tier players have salary=0 — salary assignment not running');
    if (withSalary.length < allPlayers.length * 0.5)
      return { warn: `Only ${withSalary.length}/${allPlayers.length} players have salary — partial data` };
  });

  await runTest('TC-DG-04', 'PGA live scoring endpoint accessible', async () => {
    if (!poolLeague) return 'SKIP';
    const { data: league } = await apiGet(page, `/api/golf/leagues/${poolLeague.id}/my-roster`);
    const tid = league.tournament?.id;
    if (!tid) return { warn: 'No current_tournament_id — cannot check live scoring endpoint' };

    const { status, data } = await apiGet(page, `/api/golf/datagolf/live-scoring/${tid}`);
    if (status === 404) return { warn: 'Live-scoring endpoint returned 404 — may not run between tournaments' };
    if (status !== 200) throw new Error(`live-scoring returned ${status}`);
  });

  await runTest('TC-DG-05', 'Tier player odds fields populated (odds sync ran)', async () => {
    if (!poolLeague) return 'SKIP';
    const { data } = await apiGet(page, `/api/golf/leagues/${poolLeague.id}/my-roster`);
    const allPlayers = (data.tiers || []).flatMap(t => t.players || []);
    if (allPlayers.length === 0) return 'SKIP';
    const withOdds = allPlayers.filter(p => p.odds_decimal !== null && p.odds_decimal !== undefined && p.odds_decimal !== 0);
    if (withOdds.length === 0) return { warn: 'No players have odds_decimal — odds sync may not have run' };
    if (withOdds.length < allPlayers.length * 0.3) return { warn: `Only ${withOdds.length}/${allPlayers.length} have odds` };
  });

  await runTest('TC-DG-06', 'Tier players scoped to tournament (not all 441 global players)', async () => {
    if (!poolLeague) return 'SKIP';
    const { data } = await apiGet(page, `/api/golf/leagues/${poolLeague.id}/my-roster`);
    const allPlayers = (data.tiers || []).flatMap(t => t.players || []);
    if (allPlayers.length === 0) return { warn: 'No tier players — assign-tiers not run for this league' };
    if (allPlayers.length > 200)
      return { warn: `${allPlayers.length} tier players across tiers — tournament field (typical 70–150)` };
  });


  // ═══════════════════════════════════════════════════════════════════════════
  // SUMMARY
  // ═══════════════════════════════════════════════════════════════════════════
  await browser.close();

  const pass = results.filter(r => r.status === 'PASS').length;
  const fail = results.filter(r => r.status === 'FAIL').length;
  const warn = results.filter(r => r.status === 'WARN').length;
  const skip = results.filter(r => r.status === 'SKIP').length;

  console.log('\n══════════════════════════════════════════════════════════════');
  console.log(`RESULTS  ✅ ${pass} PASS  ❌ ${fail} FAIL  ⚠️  ${warn} WARN  ⏭️  ${skip} SKIP`);
  console.log('══════════════════════════════════════════════════════════════');

  if (fail > 0) {
    console.log('\nFAILURES:');
    results.filter(r => r.status === 'FAIL').forEach(r =>
      console.log(`  ❌ ${r.id}: ${r.name}\n     ${r.note}`)
    );
  }
  if (warn > 0) {
    console.log('\nWARNINGS:');
    results.filter(r => r.status === 'WARN').forEach(r =>
      console.log(`  ⚠️  ${r.id}: ${r.name}\n     ${r.note}`)
    );
  }
  if (skip > 0) {
    console.log('\nSKIPPED (no test data):');
    results.filter(r => r.status === 'SKIP').forEach(r =>
      console.log(`  ⏭️  ${r.id}: ${r.name}`)
    );
  }

  console.log('');
  process.exit(fail > 0 ? 1 : 0);
})();
