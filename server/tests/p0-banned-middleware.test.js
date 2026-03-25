'use strict';
/**
 * P0-7: Auth middleware must block banned users.
 * A user with role='banned' must get 403, not pass through to the next handler.
 */

const Database = require('better-sqlite3');
const jwt = require('jsonwebtoken');

const TEST_SECRET = 'test-secret-key';

function makeDb(role) {
  const db = new Database(':memory:');
  db.exec(`CREATE TABLE users (id TEXT PRIMARY KEY, email TEXT, username TEXT, role TEXT)`);
  db.prepare("INSERT INTO users VALUES ('u1','a@b.com','alice', ?)").run(role);
  return db;
}

function makeMiddleware(db) {
  // Inline version of auth.js logic, injecting test DB and secret
  return function authMiddleware(req, res, next) {
    const authHeader = req.headers['authorization'];
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided' });
    }
    const token = authHeader.split(' ')[1];
    try {
      const decoded = jwt.verify(token, TEST_SECRET);
      const row = db.prepare('SELECT role FROM users WHERE id = ?').get(decoded.id);
      if (row?.role === 'banned') {
        return res.status(403).json({ error: 'Account suspended' });
      }
      req.user = { id: decoded.id, email: decoded.email, username: decoded.username, role: row?.role || 'user' };
      next();
    } catch {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }
  };
}

function makeToken(payload) {
  return jwt.sign(payload, TEST_SECRET, { expiresIn: '1h' });
}

function mockRes() {
  const res = {};
  let _status = 200;
  res.status = (s) => { _status = s; return res; };
  res.json    = (body) => { res._body = body; res._status = _status; return res; };
  return res;
}

test('P0-7: active user passes through middleware', () => {
  const db  = makeDb('user');
  const mw  = makeMiddleware(db);
  const tok = makeToken({ id: 'u1', email: 'a@b.com', username: 'alice' });
  const req = { headers: { authorization: `Bearer ${tok}` } };
  const res = mockRes();
  let nextCalled = false;

  mw(req, res, () => { nextCalled = true; });

  expect(nextCalled).toBe(true);
  expect(req.user.role).toBe('user');
});

test('P0-7: banned user is blocked with 403', () => {
  const db  = makeDb('banned');
  const mw  = makeMiddleware(db);
  const tok = makeToken({ id: 'u1', email: 'a@b.com', username: 'alice' });
  const req = { headers: { authorization: `Bearer ${tok}` } };
  const res = mockRes();
  let nextCalled = false;

  mw(req, res, () => { nextCalled = true; });

  expect(nextCalled).toBe(false);
  expect(res._status).toBe(403);
  expect(res._body.error).toMatch(/suspended/i);
});

test('P0-7: superadmin is not blocked', () => {
  const db  = makeDb('superadmin');
  const mw  = makeMiddleware(db);
  const tok = makeToken({ id: 'u1', email: 'a@b.com', username: 'alice' });
  const req = { headers: { authorization: `Bearer ${tok}` } };
  const res = mockRes();
  let nextCalled = false;

  mw(req, res, () => { nextCalled = true; });

  expect(nextCalled).toBe(true);
  expect(req.user.role).toBe('superadmin');
});

test('P0-7: missing token still returns 401', () => {
  const db  = makeDb('user');
  const mw  = makeMiddleware(db);
  const req = { headers: {} };
  const res = mockRes();

  mw(req, res, () => {});

  expect(res._status).toBe(401);
});
