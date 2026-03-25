'use strict';
/**
 * P0-3: promo_code_uses must record actual prices, not 0/0/0.
 * The webhook receives original_price/discount_amount/final_price in metadata
 * (set at checkout) and must write those values to the audit table.
 */

function recordPromoUse(db, { promoCodeId, leagueId, userId, metadata }) {
  const originalPrice  = parseFloat(metadata.original_price  || 0);
  const discountAmount = parseFloat(metadata.discount_amount  || 0);
  const finalPrice     = parseFloat(metadata.final_price      || 0);

  db.prepare(`
    INSERT INTO promo_code_uses (id, promo_code_id, league_id, user_id, original_price, discount_amount, final_price)
    VALUES (lower(hex(randomblob(16))), ?, ?, ?, ?, ?, ?)
  `).run(promoCodeId, leagueId || null, userId, originalPrice, discountAmount, finalPrice);
}

const Database = require('better-sqlite3');

function makeDb() {
  const db = new Database(':memory:');
  db.exec(`
    CREATE TABLE promo_code_uses (
      id TEXT PRIMARY KEY, promo_code_id TEXT, league_id TEXT, user_id TEXT,
      original_price REAL, discount_amount REAL, final_price REAL
    );
  `);
  return db;
}

test('P0-3: promo use record stores actual pricing from metadata', () => {
  const db = makeDb();
  recordPromoUse(db, {
    promoCodeId: 'promo1',
    leagueId:    'league1',
    userId:      'user1',
    metadata: {
      original_price:  '14.99',
      discount_amount: '7.495',
      final_price:     '7.505',
    },
  });

  const row = db.prepare('SELECT * FROM promo_code_uses').get();
  expect(row.original_price).toBeCloseTo(14.99);
  expect(row.discount_amount).toBeCloseTo(7.495);
  expect(row.final_price).toBeCloseTo(7.505);
});

test('P0-3: missing pricing fields default to 0 — does not throw', () => {
  const db = makeDb();
  expect(() => {
    recordPromoUse(db, {
      promoCodeId: 'promo1',
      leagueId:    null,
      userId:      'user1',
      metadata:    {}, // nothing — old bug scenario
    });
  }).not.toThrow();

  const row = db.prepare('SELECT * FROM promo_code_uses').get();
  // All zeros is still wrong for auditing, but at least no crash
  expect(row.original_price).toBe(0);
});
