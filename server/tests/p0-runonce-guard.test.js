'use strict';
/**
 * P0-4: Boot-time DB mutation must use runOnce so it fires exactly once, ever.
 * After the first boot, changing the value manually must not be overwritten
 * on the next simulated boot.
 */

const Database = require('better-sqlite3');

function makeDb() {
  const db = new Database(':memory:');
  db.exec(`
    CREATE TABLE migration_log (
      name TEXT PRIMARY KEY,
      ran_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE leagues (
      id TEXT PRIMARY KEY,
      payout_pool_override REAL DEFAULT NULL
    );
    INSERT INTO leagues VALUES ('league-abc', NULL);
  `);
  return db;
}

function runOnce(db, name, fn) {
  if (db.prepare('SELECT 1 FROM migration_log WHERE name = ?').get(name)) return false;
  db.transaction(() => {
    fn();
    db.prepare('INSERT INTO migration_log (name) VALUES (?)').run(name);
  })();
  return true;
}

function simulateBoot(db) {
  runOnce(db, 'seed-payout-pool-override-league-abc', () => {
    db.prepare(
      "UPDATE leagues SET payout_pool_override = 1100 WHERE id = 'league-abc'"
    ).run();
  });
}

test('P0-4: boot sets payout_pool_override on first run', () => {
  const db = makeDb();
  simulateBoot(db);

  const league = db.prepare("SELECT payout_pool_override FROM leagues WHERE id = 'league-abc'").get();
  expect(league.payout_pool_override).toBe(1100);
});

test('P0-4: second boot does NOT overwrite a manually-changed value', () => {
  const db = makeDb();
  simulateBoot(db); // First boot — sets 1100

  // Superadmin manually changes it to 1200
  db.prepare("UPDATE leagues SET payout_pool_override = 1200 WHERE id = 'league-abc'").run();

  simulateBoot(db); // Second boot — must NOT reset to 1100

  const league = db.prepare("SELECT payout_pool_override FROM leagues WHERE id = 'league-abc'").get();
  expect(league.payout_pool_override).toBe(1200); // preserved
});

test('P0-4: migration_log entry exists after first boot', () => {
  const db = makeDb();
  simulateBoot(db);

  const logged = db.prepare("SELECT 1 FROM migration_log WHERE name = 'seed-payout-pool-override-league-abc'").get();
  expect(logged).toBeTruthy();
});
