#!/usr/bin/env node
/**
 * One-time fix: apply correct 2-letter ISO country codes to golf_players,
 * pool_tier_players, and pool_picks for the Houston Open league.
 * Also normalises any 3-letter "USA" codes → "US" globally.
 *
 * Usage:
 *   node scripts/fix-country-codes.js           # dry run
 *   node scripts/fix-country-codes.js --apply   # commit
 */

const path = require('path');
process.chdir(path.join(__dirname, '..'));

const db = require('./db');
const { syncTournamentScores } = require('./golfSyncService');

const LEAGUE_ID = 'ff568722-fbe9-4695-86a8-a31287c22841';
const DRY_RUN   = !process.argv.includes('--apply');

const FIXES = [
  { name: 'J.T. Poston',             country: 'US' },
  { name: 'David Lipsky',            country: 'US' },
  { name: 'Andrew Putnam',           country: 'US' },
  { name: 'Gary Woodland',           country: 'US' },
  { name: 'Sudarshan Yellamaraju',   country: 'CA' },
  { name: 'Karl Vilips',             country: 'AU' },
  { name: 'Aldrich Potgieter',       country: 'ZA' },
  { name: 'Christiaan Bezuidenhout', country: 'ZA' },
  { name: 'Marco Penge',             country: 'GB' },
  { name: 'Haotong Li',              country: 'CN' },
  { name: 'Nico Echavarria',         country: 'CO' },
];

async function main() {
  console.log(DRY_RUN ? '\n⚠️  DRY RUN — no changes\n' : '\n🚀  APPLY MODE\n');

  const league = db.prepare('SELECT * FROM golf_leagues WHERE id = ?').get(LEAGUE_ID);
  if (!league) { console.error('❌  League not found'); process.exit(1); }
  const tid = league.pool_tournament_id;

  // ── 1. Per-player fixes ───────────────────────────────────────────────────
  console.log('── Per-player country fixes ─────────────────────────────');
  for (const { name, country } of FIXES) {
    const gp  = db.prepare("SELECT country FROM golf_players WHERE name = ?").get(name);
    const ptp = db.prepare("SELECT country FROM pool_tier_players WHERE player_name = ? AND league_id = ?").get(name, LEAGUE_ID);
    const pp  = db.prepare("SELECT COUNT(*) as n FROM pool_picks WHERE player_name = ? AND league_id = ?").get(name, LEAGUE_ID);

    console.log(`  ${name}: gp=${gp?.country ?? 'NULL'} → ${country}  |  ptp=${ptp?.country ?? 'NULL'} → ${country}  |  picks=${pp?.n ?? 0}`);

    if (!DRY_RUN) {
      db.prepare("UPDATE golf_players SET country = ? WHERE name = ?").run(country, name);
      db.prepare("UPDATE pool_tier_players SET country = ? WHERE player_name = ? AND league_id = ?").run(country, name, LEAGUE_ID);
      db.prepare("UPDATE pool_picks SET country = ? WHERE player_name = ? AND league_id = ?").run(country, name, LEAGUE_ID);
    }
  }

  // ── 2. USA → US normalization (global) ───────────────────────────────────
  console.log('\n── USA → US normalization ───────────────────────────────');
  const gpUsa  = db.prepare("SELECT COUNT(*) as n FROM golf_players WHERE country = 'USA'").get();
  const ptpUsa = db.prepare("SELECT COUNT(*) as n FROM pool_tier_players WHERE country = 'USA'").get();
  const ppUsa  = db.prepare("SELECT COUNT(*) as n FROM pool_picks WHERE country = 'USA'").get();
  console.log(`  golf_players: ${gpUsa.n} rows with 'USA'`);
  console.log(`  pool_tier_players: ${ptpUsa.n} rows with 'USA'`);
  console.log(`  pool_picks: ${ppUsa.n} rows with 'USA'`);

  if (!DRY_RUN) {
    db.prepare("UPDATE golf_players SET country = 'US' WHERE country = 'USA'").run();
    db.prepare("UPDATE pool_tier_players SET country = 'US' WHERE country = 'USA'").run();
    db.prepare("UPDATE pool_picks SET country = 'US' WHERE country = 'USA'").run();
    console.log('  ✅  Normalised.');
  } else {
    console.log('  [DRY RUN] Would normalise all rows above.');
  }

  // ── 3. Verify spot-checks ─────────────────────────────────────────────────
  console.log('\n── Spot-check (current DB state) ────────────────────────');
  const checks = ['J.T. Poston', 'Karl Vilips', 'Marco Penge', 'Haotong Li', 'Nico Echavarria', 'Sudarshan Yellamaraju'];
  for (const name of checks) {
    const gp  = db.prepare("SELECT country FROM golf_players WHERE name = ?").get(name);
    const ptp = db.prepare("SELECT country FROM pool_tier_players WHERE player_name = ? AND league_id = ?").get(name, LEAGUE_ID);
    console.log(`  ${name.padEnd(28)} gp=${gp?.country ?? 'NULL'}  ptp=${ptp?.country ?? 'NULL'}`);
  }

  // ── 4. Sync ───────────────────────────────────────────────────────────────
  if (!DRY_RUN) {
    console.log('\n── Score sync ────────────────────────────────────────────');
    try {
      const result = await syncTournamentScores(tid, { silent: false });
      console.log('Sync:', JSON.stringify(result));
    } catch (e) {
      console.error('Sync error:', e.message);
    }
  } else {
    console.log('\n[DRY RUN] Run with --apply to commit + sync.');
  }

  console.log('\nDone.\n');
  process.exit(0);
}

main().catch(err => { console.error(err); process.exit(1); });
