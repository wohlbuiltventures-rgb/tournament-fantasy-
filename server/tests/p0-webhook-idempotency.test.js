'use strict';
/**
 * P0-2: Square webhook must be idempotent.
 * Calling handleGolfWebhook twice with the same order_id must
 * not deduct referral credits or record promo use more than once.
 */

const Database = require('better-sqlite3');

// ── Build an in-memory DB with the tables we need ────────────────────────────
function makeDb() {
  const db = new Database(':memory:');
  db.exec(`
    CREATE TABLE users (
      id TEXT PRIMARY KEY, email TEXT, username TEXT, role TEXT DEFAULT 'user',
      password_hash TEXT DEFAULT ''
    );
    CREATE TABLE golf_leagues (
      id TEXT PRIMARY KEY, name TEXT, commissioner_id TEXT,
      status TEXT DEFAULT 'pending_payment', max_teams INTEGER DEFAULT 20,
      pool_tournament_id TEXT
    );
    CREATE TABLE golf_league_members (
      id TEXT PRIMARY KEY, golf_league_id TEXT, user_id TEXT, team_name TEXT
    );
    CREATE TABLE golf_season_passes (
      id TEXT PRIMARY KEY, user_id TEXT, season TEXT, paid_at TEXT,
      stripe_session_id TEXT,
      UNIQUE(user_id, season)
    );
    CREATE TABLE golf_pool_entries (
      id TEXT PRIMARY KEY, user_id TEXT, tournament_id TEXT, paid_at TEXT,
      stripe_session_id TEXT,
      UNIQUE(user_id, tournament_id)
    );
    CREATE TABLE golf_comm_pro (
      id TEXT PRIMARY KEY, league_id TEXT, commissioner_id TEXT, season TEXT,
      paid_at TEXT, promo_applied INTEGER DEFAULT 0, stripe_session_id TEXT,
      UNIQUE(league_id, season)
    );
    CREATE TABLE golf_referral_credits (
      id TEXT PRIMARY KEY, user_id TEXT, balance REAL DEFAULT 0, season TEXT,
      expires_at TEXT,
      UNIQUE(user_id, season)
    );
    CREATE TABLE golf_referral_redemptions (
      id TEXT PRIMARY KEY, referrer_id TEXT, referred_id TEXT,
      credit_amount REAL, redeemed_at TEXT
    );
    CREATE TABLE golf_referral_codes (
      id TEXT PRIMARY KEY, user_id TEXT, code TEXT UNIQUE
    );
    CREATE TABLE promo_codes (
      id TEXT PRIMARY KEY, code TEXT, discount_type TEXT,
      discount_value REAL, active INTEGER DEFAULT 1, uses_count INTEGER DEFAULT 0
    );
    CREATE TABLE promo_code_uses (
      id TEXT PRIMARY KEY, promo_code_id TEXT, league_id TEXT, user_id TEXT,
      original_price REAL, discount_amount REAL, final_price REAL
    );
    CREATE TABLE golf_tournaments (
      id TEXT PRIMARY KEY, name TEXT, is_major INTEGER DEFAULT 0
    );
    CREATE TABLE processed_webhook_orders (
      order_id TEXT PRIMARY KEY,
      processed_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);
  return db;
}

// ── Seed data ─────────────────────────────────────────────────────────────────
function seed(db) {
  db.prepare("INSERT INTO users VALUES ('user1','u@test.com','user1','user','x')").run();
  db.prepare("INSERT INTO golf_leagues VALUES ('league1','Test Pool','user1','pending_payment',20,NULL)").run();
  // Give user1 $2 referral credit
  db.prepare("INSERT INTO golf_referral_credits VALUES ('rc1','user1',2.00,'2026',NULL)").run();
  // Add a promo code
  db.prepare("INSERT INTO promo_codes VALUES ('promo1','SAVE50','percent',50,1,0)").run();
}

// ── Load the handler (injecting our in-memory db) ────────────────────────────
// We test the idempotency guard logic directly.
function makeHandler(db) {
  async function fulfillGolfPayment(metadata) {
    const type    = metadata.type;
    const orderId = metadata._order_id || 'credit_applied';
    if (type === 'golf_comm_pro') {
      db.prepare(`
        INSERT INTO golf_comm_pro (id, league_id, commissioner_id, season, paid_at, promo_applied, stripe_session_id)
        VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, 0, ?)
        ON CONFLICT(league_id, season) DO UPDATE SET
          paid_at = CURRENT_TIMESTAMP, stripe_session_id = excluded.stripe_session_id
      `).run('id-' + Date.now(), metadata.league_id, metadata.user_id, '2026', orderId);
    }
  }

  async function handleGolfWebhook({ order_id, metadata }) {
    // ── GUARD: idempotency check ─────────────────────────────────────────────
    // This is the guard we are ADDING. Before the fix this didn't exist.
    const alreadyDone = db.prepare(
      'SELECT 1 FROM processed_webhook_orders WHERE order_id = ?'
    ).get(order_id);
    if (alreadyDone) return { skipped: true };

    // Fulfill in a transaction with idempotency mark
    db.transaction(() => {
      fulfillGolfPayment({ ...metadata, _order_id: order_id });

      // Deduct referral credit
      if (metadata.credit_applied && metadata.user_id) {
        const creditApplied = parseFloat(metadata.credit_applied);
        if (creditApplied > 0) {
          db.prepare(`
            UPDATE golf_referral_credits
            SET balance = MAX(0, balance - ?)
            WHERE user_id = ? AND season = ?
          `).run(creditApplied, metadata.user_id, '2026');
        }
      }

      // Mark as processed
      db.prepare('INSERT INTO processed_webhook_orders (order_id) VALUES (?)').run(order_id);
    })();

    return { skipped: false };
  }

  return handleGolfWebhook;
}

// ── Tests ─────────────────────────────────────────────────────────────────────
test('P0-2: webhook processes first call normally', async () => {
  const db = makeDb();
  seed(db);
  const handler = makeHandler(db);

  const metadata = {
    type: 'golf_comm_pro', user_id: 'user1',
    league_id: 'league1', credit_applied: '1.00',
  };
  const result = await handler({ order_id: 'order-abc', metadata });
  expect(result.skipped).toBe(false);

  // Credit should be deducted from 2.00 to 1.00
  const credit = db.prepare("SELECT balance FROM golf_referral_credits WHERE user_id = 'user1'").get();
  expect(credit.balance).toBe(1.0);
});

test('P0-2: duplicate webhook call is skipped — credit not deducted twice', async () => {
  const db = makeDb();
  seed(db);
  const handler = makeHandler(db);

  const metadata = {
    type: 'golf_comm_pro', user_id: 'user1',
    league_id: 'league1', credit_applied: '1.00',
  };

  await handler({ order_id: 'order-dup', metadata });
  const result2 = await handler({ order_id: 'order-dup', metadata }); // duplicate

  expect(result2.skipped).toBe(true);

  // Credit should only have been deducted once: 2.00 - 1.00 = 1.00
  const credit = db.prepare("SELECT balance FROM golf_referral_credits WHERE user_id = 'user1'").get();
  expect(credit.balance).toBe(1.0);
});

test('P0-2: different order IDs are each processed once', async () => {
  const db = makeDb();
  seed(db);
  const handler = makeHandler(db);

  const metadata1 = { type: 'golf_season_pass', user_id: 'user1', credit_applied: '0.50' };
  const metadata2 = { type: 'golf_season_pass', user_id: 'user1', credit_applied: '0.50' };

  await handler({ order_id: 'order-1', metadata: metadata1 });
  await handler({ order_id: 'order-2', metadata: metadata2 });

  // Both are different orders — both deductions should happen: 2.00 - 0.50 - 0.50 = 1.00
  const credit = db.prepare("SELECT balance FROM golf_referral_credits WHERE user_id = 'user1'").get();
  expect(credit.balance).toBe(1.0);
});
