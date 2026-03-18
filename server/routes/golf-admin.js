const express = require('express');
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcryptjs');
const superadmin = require('../middleware/superadmin');
require('../golf-db');
const db = require('../db');

const router = express.Router();

// All routes require superadmin (auth + role check bundled in middleware)

// ── Leagues ───────────────────────────────────────────────────────────────────

router.get('/admin/leagues', superadmin, (req, res) => {
  try {
    const leagues = db.prepare(`
      SELECT
        gl.*,
        u.username  AS commissioner_name,
        u.email     AS commissioner_email,
        COUNT(DISTINCT glm.id) AS member_count,
        COALESCE((
          SELECT COUNT(*) FROM golf_season_passes gsp
          JOIN golf_league_members m2 ON m2.user_id = gsp.user_id
          WHERE m2.golf_league_id = gl.id AND gsp.season = '2026' AND gsp.paid_at IS NOT NULL
        ), 0) AS season_pass_count,
        COALESCE((
          SELECT COUNT(*) FROM golf_comm_pro gcp
          WHERE gcp.league_id = gl.id AND gcp.season = '2026'
            AND (gcp.paid_at IS NOT NULL OR gcp.promo_applied = 1)
        ), 0) AS comm_pro_paid
      FROM golf_leagues gl
      LEFT JOIN users u ON u.id = gl.commissioner_id
      LEFT JOIN golf_league_members glm ON glm.golf_league_id = gl.id
      GROUP BY gl.id
      ORDER BY gl.created_at DESC
    `).all();

    const withMembers = leagues.map(l => {
      const members = db.prepare(`
        SELECT glm.user_id, glm.team_name, glm.season_points, glm.joined_at,
               u.username, u.email
        FROM golf_league_members glm
        JOIN users u ON u.id = glm.user_id
        WHERE glm.golf_league_id = ?
        ORDER BY glm.season_points DESC
      `).all(l.id);
      return {
        ...l,
        members,
        season_pass_rev:  (l.season_pass_count * 4.99).toFixed(2),
        comm_pro_rev:     (l.comm_pro_paid * 19.99).toFixed(2),
      };
    });

    res.json({ leagues: withMembers });
  } catch (err) {
    console.error('[golf-admin] leagues:', err);
    res.status(500).json({ error: err.message });
  }
});

router.post('/admin/leagues/:id/archive', superadmin, (req, res) => {
  try {
    db.prepare("UPDATE golf_leagues SET status = 'archived' WHERE id = ?").run(req.params.id);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/admin/leagues/:id', superadmin, (req, res) => {
  try {
    const id = req.params.id;
    db.prepare('DELETE FROM golf_rosters WHERE member_id IN (SELECT id FROM golf_league_members WHERE golf_league_id = ?)').run(id);
    db.prepare('DELETE FROM golf_league_members WHERE golf_league_id = ?').run(id);
    db.prepare('DELETE FROM golf_comm_pro WHERE league_id = ?').run(id);
    db.prepare('DELETE FROM golf_leagues WHERE id = ?').run(id);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/admin/leagues/:id/sync', superadmin, async (req, res) => {
  try {
    // Trigger the existing golf score sync if available
    const syncFn = (() => {
      try { return require('../golf-score-sync'); } catch { return null; }
    })();
    if (syncFn?.syncLeague) {
      await syncFn.syncLeague(req.params.id);
    }
    res.json({ success: true, message: 'Sync triggered' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/admin/leagues/:id/email', superadmin, async (req, res) => {
  try {
    const league = db.prepare('SELECT * FROM golf_leagues WHERE id = ?').get(req.params.id);
    if (!league) return res.status(404).json({ error: 'League not found' });
    const members = db.prepare(`
      SELECT glm.team_name, u.email, u.username, glm.season_points
      FROM golf_league_members glm JOIN users u ON u.id = glm.user_id
      WHERE glm.golf_league_id = ?
    `).all(req.params.id);
    const { sendGolfPaymentConfirmation } = require('../mailer');
    // Send standings update email to each member
    await Promise.all(members.map(m =>
      sendGolfPaymentConfirmation(m.email, m.username, 'standings_update', {
        league_name: league.name,
      }).catch(() => {})
    ));
    res.json({ success: true, sent: members.length });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── Users ─────────────────────────────────────────────────────────────────────

router.get('/admin/users', superadmin, (req, res) => {
  try {
    const users = db.prepare(`
      SELECT
        u.id, u.email, u.username, u.role, u.created_at,
        u.gender, u.dob,
        COALESCE(gup.profile_complete, 0) AS profile_complete,
        COUNT(DISTINCT glm.id) AS league_count,
        COALESCE(sp.paid, 0) AS season_pass_paid
      FROM users u
      LEFT JOIN golf_user_profiles gup ON gup.user_id = u.id
      LEFT JOIN golf_league_members glm ON glm.user_id = u.id
      LEFT JOIN (
        SELECT user_id, 1 AS paid FROM golf_season_passes
        WHERE season = '2026' AND paid_at IS NOT NULL
      ) sp ON sp.user_id = u.id
      GROUP BY u.id
      ORDER BY u.created_at DESC
    `).all();
    res.json({ users });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/admin/users/:id/ban', superadmin, (req, res) => {
  try {
    const user = db.prepare('SELECT role FROM users WHERE id = ?').get(req.params.id);
    if (!user) return res.status(404).json({ error: 'Not found' });
    const newRole = user.role === 'banned' ? 'user' : 'banned';
    db.prepare('UPDATE users SET role = ? WHERE id = ?').run(newRole, req.params.id);
    res.json({ success: true, role: newRole });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/admin/users/:id/reset-password', superadmin, async (req, res) => {
  try {
    const tempPw = Math.random().toString(36).slice(2, 10);
    const hash = await bcrypt.hash(tempPw, 10);
    db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hash, req.params.id);
    res.json({ success: true, tempPassword: tempPw });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/admin/users/:id', superadmin, (req, res) => {
  try {
    db.prepare('DELETE FROM golf_user_profiles WHERE user_id = ?').run(req.params.id);
    db.prepare('DELETE FROM golf_referral_credits WHERE user_id = ?').run(req.params.id);
    db.prepare('DELETE FROM golf_season_passes WHERE user_id = ?').run(req.params.id);
    db.prepare('DELETE FROM golf_league_members WHERE user_id = ?').run(req.params.id);
    // Do NOT delete the users row — it may be shared with basketball leagues
    // Just ban them instead
    db.prepare("UPDATE users SET role = 'banned' WHERE id = ?").run(req.params.id);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── Players ───────────────────────────────────────────────────────────────────

router.get('/admin/players', superadmin, (req, res) => {
  try {
    const players = db.prepare(`
      SELECT gp.*,
        COALESCE(SUM(gs.fantasy_points), 0) AS season_pts
      FROM golf_players gp
      LEFT JOIN golf_scores gs ON gs.player_id = gp.id
      GROUP BY gp.id
      ORDER BY gp.world_ranking ASC NULLS LAST
    `).all();
    res.json({ players });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/admin/players/:id', superadmin, (req, res) => {
  try {
    const { name, salary, world_ranking, is_active, status, country } = req.body;
    db.prepare(`
      UPDATE golf_players SET
        name = COALESCE(?, name),
        salary = COALESCE(?, salary),
        world_ranking = COALESCE(?, world_ranking),
        is_active = COALESCE(?, is_active),
        country = COALESCE(?, country)
      WHERE id = ?
    `).run(name ?? null, salary ?? null, world_ranking ?? null,
           is_active ?? null, country ?? null, req.params.id);
    const updated = db.prepare('SELECT * FROM golf_players WHERE id = ?').get(req.params.id);
    res.json({ player: updated });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/admin/players', superadmin, (req, res) => {
  try {
    const { name, country = 'USA', world_ranking, salary = 200, is_active = 1 } = req.body;
    if (!name) return res.status(400).json({ error: 'Name required' });
    const id = uuidv4();
    db.prepare(`
      INSERT INTO golf_players (id, name, country, world_ranking, salary, is_active)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(id, name, country, world_ranking || null, salary, is_active);
    res.json({ player: db.prepare('SELECT * FROM golf_players WHERE id = ?').get(id) });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/admin/players/:id', superadmin, (req, res) => {
  try {
    db.prepare("UPDATE golf_players SET is_active = 0 WHERE id = ?").run(req.params.id);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── Financials ────────────────────────────────────────────────────────────────

router.get('/admin/financials', superadmin, (req, res) => {
  try {
    const seasonPassCount = db.prepare(
      "SELECT COUNT(*) as n, COUNT(*) * 4.99 as rev FROM golf_season_passes WHERE paid_at IS NOT NULL"
    ).get();
    const poolEntryCount = db.prepare(
      "SELECT COUNT(*) as n, COUNT(*) * 0.99 as rev FROM golf_pool_entries WHERE paid_at IS NOT NULL"
    ).get();
    const commProCount = db.prepare(
      "SELECT COUNT(*) as n, SUM(CASE WHEN paid_at IS NOT NULL THEN 19.99 ELSE 0 END) as rev FROM golf_comm_pro WHERE paid_at IS NOT NULL OR promo_applied = 1"
    ).get();
    const promoCount = db.prepare(
      "SELECT COUNT(*) as n FROM golf_comm_pro WHERE promo_applied = 1"
    ).get();

    const totalRev = (seasonPassCount.rev || 0) + (poolEntryCount.rev || 0) + (commProCount.rev || 0);

    const activeLeagues = db.prepare(
      "SELECT COUNT(*) as n FROM golf_leagues WHERE status != 'archived'"
    ).get().n;
    const totalUsers = db.prepare(
      "SELECT COUNT(DISTINCT user_id) as n FROM golf_league_members"
    ).get().n;

    const referralCredits = db.prepare(
      "SELECT COALESCE(SUM(credit_amount), 0) as total FROM golf_referral_redemptions"
    ).get().total;

    // Revenue by format
    const revenueByFormat = db.prepare(`
      SELECT
        COALESCE(gl.format_type, 'tourneyrun') AS format,
        COUNT(DISTINCT gl.id) AS leagues,
        COUNT(DISTINCT glm.user_id) AS players
      FROM golf_leagues gl
      LEFT JOIN golf_league_members glm ON glm.golf_league_id = gl.id
      GROUP BY gl.format_type
    `).all();

    // Recent payments
    const recentPayments = [
      ...db.prepare(`
        SELECT u.username, 'Season Pass' AS product, 4.99 AS amount,
               NULL AS league_name, gsp.paid_at
        FROM golf_season_passes gsp JOIN users u ON u.id = gsp.user_id
        WHERE gsp.paid_at IS NOT NULL ORDER BY gsp.paid_at DESC LIMIT 20
      `).all(),
      ...db.prepare(`
        SELECT u.username, 'Office Pool Entry' AS product, 0.99 AS amount,
               gt.name AS league_name, gpe.paid_at
        FROM golf_pool_entries gpe
        JOIN users u ON u.id = gpe.user_id
        LEFT JOIN golf_tournaments gt ON gt.id = gpe.tournament_id
        WHERE gpe.paid_at IS NOT NULL ORDER BY gpe.paid_at DESC LIMIT 20
      `).all(),
      ...db.prepare(`
        SELECT u.username, 'Commissioner Pro' AS product, 19.99 AS amount,
               gl.name AS league_name, gcp.paid_at
        FROM golf_comm_pro gcp
        JOIN users u ON u.id = gcp.commissioner_id
        JOIN golf_leagues gl ON gl.id = gcp.league_id
        WHERE gcp.paid_at IS NOT NULL ORDER BY gcp.paid_at DESC LIMIT 20
      `).all(),
    ].sort((a, b) => new Date(b.paid_at) - new Date(a.paid_at)).slice(0, 30);

    // Top referrers
    const topReferrers = db.prepare(`
      SELECT u.username,
             COUNT(*) AS referral_count,
             SUM(grd.credit_amount) AS credits_earned
      FROM golf_referral_redemptions grd
      JOIN users u ON u.id = grd.referrer_id
      GROUP BY grd.referrer_id
      ORDER BY referral_count DESC
      LIMIT 10
    `).all();

    const referralCodesIssued = db.prepare('SELECT COUNT(*) as n FROM golf_referral_codes').get().n;
    const referralRedemptions = db.prepare('SELECT COUNT(*) as n FROM golf_referral_redemptions').get().n;
    const creditsUsed = db.prepare(
      "SELECT COALESCE(SUM(CASE WHEN balance < 1 THEN 1 ELSE 0 END), 0) as n FROM golf_referral_credits"
    ).get().n;

    res.json({
      summary: {
        totalRev: totalRev.toFixed(2),
        seasonPassRev:  (seasonPassCount.rev || 0).toFixed(2),
        poolEntryRev:   (poolEntryCount.rev || 0).toFixed(2),
        commProRev:     (commProCount.rev || 0).toFixed(2),
        seasonPassCount: seasonPassCount.n,
        poolEntryCount:  poolEntryCount.n,
        commProCount:    commProCount.n,
        promoCount:      promoCount.n,
        activeLeagues,
        totalUsers,
        referralCredits: (referralCredits || 0).toFixed(2),
      },
      revenueByFormat,
      recentPayments,
      referralStats: {
        codesIssued: referralCodesIssued,
        redemptions: referralRedemptions,
        creditsEarned: (referralCredits || 0).toFixed(2),
        creditsUsed,
        topReferrers,
      },
    });
  } catch (err) {
    console.error('[golf-admin] financials:', err);
    res.status(500).json({ error: err.message });
  }
});

// ── Analytics ─────────────────────────────────────────────────────────────────

router.get('/admin/analytics', superadmin, (req, res) => {
  try {
    // Gender breakdown
    const genderData = db.prepare(`
      SELECT
        COALESCE(u.gender, 'not_provided') AS gender,
        COUNT(*) AS count
      FROM users u
      WHERE u.id IN (SELECT DISTINCT user_id FROM golf_league_members)
      GROUP BY u.gender
    `).all();

    // Age distribution (from dob)
    const ageRaw = db.prepare(`
      SELECT u.dob FROM users u
      WHERE u.dob IS NOT NULL
        AND u.id IN (SELECT DISTINCT user_id FROM golf_league_members)
    `).all();

    const ageBuckets = { '18-24': 0, '25-34': 0, '35-44': 0, '45-54': 0, '55+': 0 };
    const now = new Date();
    for (const { dob } of ageRaw) {
      const age = Math.floor((now - new Date(dob)) / (365.25 * 24 * 60 * 60 * 1000));
      if (age >= 18 && age <= 24)       ageBuckets['18-24']++;
      else if (age >= 25 && age <= 34)  ageBuckets['25-34']++;
      else if (age >= 35 && age <= 44)  ageBuckets['35-44']++;
      else if (age >= 45 && age <= 54)  ageBuckets['45-54']++;
      else if (age >= 55)               ageBuckets['55+']++;
    }

    // Signups per week (last 12 weeks) — golf users only
    const signupsPerWeek = db.prepare(`
      SELECT
        strftime('%Y-W%W', u.created_at) AS week,
        COUNT(*) AS count
      FROM users u
      WHERE u.id IN (SELECT DISTINCT user_id FROM golf_league_members)
        AND u.created_at >= date('now', '-84 days')
      GROUP BY week
      ORDER BY week ASC
    `).all();

    // Office pool entries per tournament
    const poolByTournament = db.prepare(`
      SELECT gt.name, COUNT(*) AS entries
      FROM golf_pool_entries gpe
      LEFT JOIN golf_tournaments gt ON gt.id = gpe.tournament_id
      WHERE gpe.paid_at IS NOT NULL
      GROUP BY gpe.tournament_id
      ORDER BY entries DESC
      LIMIT 10
    `).all();

    // Average league size
    const avgLeagueSize = db.prepare(`
      SELECT AVG(cnt) AS avg FROM (
        SELECT COUNT(*) AS cnt FROM golf_league_members GROUP BY golf_league_id
      )
    `).get().avg;

    // Average FAAB spend
    const avgFaab = db.prepare(`
      SELECT AVG(2400 - COALESCE(season_budget, 2400)) AS avg
      FROM golf_league_members
      WHERE season_budget < 2400
    `).get().avg;

    res.json({
      genderData,
      ageDistribution: Object.entries(ageBuckets).map(([range, count]) => ({ range, count })),
      signupsPerWeek,
      poolByTournament,
      metrics: {
        avgLeagueSize: avgLeagueSize ? avgLeagueSize.toFixed(1) : null,
        avgFaabSpend:  avgFaab ? avgFaab.toFixed(0) : null,
      },
    });
  } catch (err) {
    console.error('[golf-admin] analytics:', err);
    res.status(500).json({ error: err.message });
  }
});

// ── Dev Tools ─────────────────────────────────────────────────────────────────

router.post('/admin/dev/sync/:tournamentId', superadmin, async (req, res) => {
  try {
    const tournId = req.params.tournamentId;
    const tourn = db.prepare('SELECT * FROM golf_tournaments WHERE id = ?').get(tournId);
    if (!tourn) return res.status(404).json({ error: 'Tournament not found' });
    // Attempt to call existing sync module
    try {
      const sync = require('../golf-score-sync');
      if (sync?.syncTournament) await sync.syncTournament(tournId);
    } catch {}
    db.prepare("UPDATE golf_tournaments SET status = 'active' WHERE id = ?").run(tournId);
    res.json({ success: true, tournament: tourn.name });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/admin/dev/test-email', superadmin, async (req, res) => {
  try {
    const user = db.prepare('SELECT email, username FROM users WHERE id = ?').get(req.user.id);
    const { sendGolfPaymentConfirmation } = require('../mailer');
    await sendGolfPaymentConfirmation(user.email, user.username, 'golf_season_pass', {
      season: '2026',
    });
    res.json({ success: true, sentTo: user.email });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/admin/dev/db-health', superadmin, (req, res) => {
  try {
    const tables = [
      'golf_leagues', 'golf_league_members', 'golf_players',
      'golf_tournaments', 'golf_scores', 'golf_rosters',
      'golf_season_passes', 'golf_pool_entries', 'golf_comm_pro',
      'golf_referral_codes', 'golf_referral_credits',
    ];
    const counts = {};
    for (const t of tables) {
      try {
        counts[t] = db.prepare(`SELECT COUNT(*) as n FROM ${t}`).get().n;
      } catch {
        counts[t] = 'N/A';
      }
    }
    const lastSync = db.prepare(
      "SELECT MAX(updated_at) as t FROM golf_scores"
    ).get()?.t || null;
    res.json({ counts, lastSync, uptime: process.uptime() });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/admin/dev/sandbox', superadmin, async (req, res) => {
  try {
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
    const leagueId = uuidv4();
    const inviteCode = Math.random().toString(36).slice(2, 10).toUpperCase();
    db.prepare(`
      INSERT INTO golf_leagues (id, name, commissioner_id, invite_code, status, format_type, draft_status)
      VALUES (?, ?, ?, ?, 'lobby', 'tourneyrun', 'pending')
    `).run(leagueId, `[SANDBOX] ${user.username} Auction Test`, user.id, inviteCode);
    const memberId = uuidv4();
    db.prepare(`
      INSERT INTO golf_league_members (id, golf_league_id, user_id, team_name, season_budget)
      VALUES (?, ?, ?, ?, 2400)
    `).run(memberId, leagueId, user.id, user.username);
    // Add bot members
    const bots = ['Bot Alpha', 'Bot Beta', 'Bot Gamma', 'Bot Delta', 'Bot Epsilon', 'Bot Zeta', 'Bot Theta'];
    for (const botName of bots) {
      const botUserId = db.prepare('SELECT id FROM users WHERE username = ?').get(botName)?.id;
      if (botUserId) {
        db.prepare(`
          INSERT OR IGNORE INTO golf_league_members (id, golf_league_id, user_id, team_name, season_budget)
          VALUES (?, ?, ?, ?, 2400)
        `).run(uuidv4(), leagueId, botUserId, botName);
      }
    }
    res.json({ success: true, leagueId, inviteCode, url: `/golf/league/${leagueId}/auction` });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── Export ────────────────────────────────────────────────────────────────────

router.get('/admin/export/users', superadmin, (req, res) => {
  try {
    const rows = db.prepare(`
      SELECT
        u.username, u.email, u.gender, u.dob, u.created_at,
        COUNT(DISTINCT glm.id) AS leagues_count,
        COALESCE(sp.paid, 0) AS season_pass_paid,
        COALESCE(sp.paid * 4.99 + pe.entries * 0.99 + cp.paid * 19.99, 0) AS total_spent
      FROM users u
      LEFT JOIN golf_league_members glm ON glm.user_id = u.id
      LEFT JOIN (SELECT user_id, 1 AS paid FROM golf_season_passes WHERE season='2026' AND paid_at IS NOT NULL) sp ON sp.user_id = u.id
      LEFT JOIN (SELECT user_id, COUNT(*) AS entries FROM golf_pool_entries WHERE paid_at IS NOT NULL GROUP BY user_id) pe ON pe.user_id = u.id
      LEFT JOIN (SELECT commissioner_id, 1 AS paid FROM golf_comm_pro WHERE paid_at IS NOT NULL) cp ON cp.commissioner_id = u.id
      WHERE u.id IN (SELECT DISTINCT user_id FROM golf_league_members)
      GROUP BY u.id
      ORDER BY u.created_at DESC
    `).all();

    const header = 'username,email,gender,dob,joined_at,leagues_count,season_pass_paid,total_spent';
    const lines = rows.map(r =>
      [r.username, r.email, r.gender || '', r.dob || '', r.created_at,
       r.leagues_count, r.season_pass_paid, (r.total_spent || 0).toFixed(2)]
      .map(v => `"${String(v).replace(/"/g, '""')}"`)
      .join(',')
    );
    const csv = [header, ...lines].join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="golf-users.csv"');
    res.send(csv);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── Profile (for onboarding) ──────────────────────────────────────────────────
const authMiddleware = require('../middleware/auth');

router.get('/profile/status', authMiddleware, (req, res) => {
  try {
    const row = db.prepare('SELECT profile_complete FROM golf_user_profiles WHERE user_id = ?').get(req.user.id);
    res.json({ profileComplete: row?.profile_complete === 1 });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/profile/complete', authMiddleware, (req, res) => {
  try {
    const { gender, dob } = req.body;
    if (!gender || !dob) return res.status(400).json({ error: 'gender and dob required' });

    // Validate age 18+
    const age = Math.floor((Date.now() - new Date(dob)) / (365.25 * 24 * 60 * 60 * 1000));
    if (age < 18) return res.status(400).json({ error: 'You must be 18 or older to play.' });

    db.prepare('UPDATE users SET gender = ?, dob = ?, dob_verified = 1 WHERE id = ?')
      .run(gender, dob, req.user.id);
    db.prepare(`
      INSERT INTO golf_user_profiles (user_id, profile_complete, completed_at)
      VALUES (?, 1, CURRENT_TIMESTAMP)
      ON CONFLICT(user_id) DO UPDATE SET profile_complete = 1, completed_at = CURRENT_TIMESTAMP
    `).run(req.user.id);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
