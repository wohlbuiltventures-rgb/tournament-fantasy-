const express = require('express');
const { v4: uuidv4 } = require('uuid');
const authMiddleware = require('../middleware/auth');
const db = require('../db');

const router = express.Router();

function getMember(leagueId, userId) {
  return db.prepare('SELECT * FROM golf_league_members WHERE golf_league_id = ? AND user_id = ?').get(leagueId, userId);
}

// ── GET /api/golf/leagues/:id/waivers ──────────────────────────────────────────
// Available players sorted by ownership % (most owned first = most desired)
router.get('/leagues/:id/waivers', authMiddleware, (req, res) => {
  try {
    const league = db.prepare('SELECT * FROM golf_leagues WHERE id = ?').get(req.params.id);
    if (!league) return res.status(404).json({ error: 'League not found' });
    const member = getMember(req.params.id, req.user.id);
    if (!member) return res.status(403).json({ error: 'Not a member' });

    const totalMembers = db.prepare('SELECT COUNT(*) as c FROM golf_league_members WHERE golf_league_id = ?').get(req.params.id).c;

    // Players NOT on any roster in this league
    const available = db.prepare(`
      SELECT gp.*,
        (SELECT COUNT(*) FROM golf_rosters gr2
          JOIN golf_league_members glm2 ON gr2.member_id = glm2.id
          WHERE glm2.golf_league_id = ? AND gr2.player_id = gp.id AND gr2.dropped_at IS NULL
        ) as owner_count
      FROM golf_players gp
      WHERE gp.is_active = 1
        AND gp.id NOT IN (
          SELECT gr.player_id FROM golf_rosters gr
          JOIN golf_league_members glm ON gr.member_id = glm.id
          WHERE glm.golf_league_id = ? AND gr.dropped_at IS NULL
            AND glm.user_id = ?
        )
      ORDER BY owner_count DESC, gp.world_ranking ASC
    `).all(req.params.id, req.params.id, req.user.id).map(p => ({
      ...p,
      ownership_pct: totalMembers > 0 ? Math.round((p.owner_count / totalMembers) * 100) : 0,
      on_roster: p.owner_count > 0,
    }));

    // My pending bids
    const myBids = db.prepare(`
      SELECT fb.*, gp.name as player_name FROM golf_faab_bids fb
      JOIN golf_players gp ON fb.player_id = gp.id
      WHERE fb.member_id = ? AND fb.status = 'pending'
      ORDER BY fb.created_at DESC
    `).all(member.id);

    const faabSpent = db.prepare(`
      SELECT COALESCE(SUM(bid_amount), 0) as s FROM golf_faab_bids
      WHERE member_id = ? AND status = 'won'
    `).get(member.id).s;

    res.json({
      available,
      myBids,
      faabBudget: league.faab_budget || 500,
      faabRemaining: (league.faab_budget || 500) - faabSpent,
      useFaab: !!league.use_faab,
    });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
});

// ── POST /api/golf/leagues/:id/waivers/bid ─────────────────────────────────────
// Submit a FAAB bid: { player_id, drop_player_id, bid_amount }
router.post('/leagues/:id/waivers/bid', authMiddleware, (req, res) => {
  try {
    const { player_id, drop_player_id, bid_amount } = req.body;
    if (!player_id) return res.status(400).json({ error: 'player_id required' });

    const league = db.prepare('SELECT * FROM golf_leagues WHERE id = ?').get(req.params.id);
    if (!league) return res.status(404).json({ error: 'League not found' });
    if (league.format_type !== 'tourneyrun') return res.status(400).json({ error: 'FAAB bids are only available in TourneyRun mode' });
    if (!league.use_faab) return res.status(400).json({ error: 'FAAB is disabled in this league' });

    const member = getMember(req.params.id, req.user.id);
    if (!member) return res.status(403).json({ error: 'Not a member' });

    const player = db.prepare('SELECT * FROM golf_players WHERE id = ? AND is_active = 1').get(player_id);
    if (!player) return res.status(404).json({ error: 'Player not found' });

    // Verify player is not already on someone's roster (free agent check)
    const takenBy = db.prepare(`
      SELECT gr.id FROM golf_rosters gr
      JOIN golf_league_members glm ON gr.member_id = glm.id
      WHERE glm.golf_league_id = ? AND gr.player_id = ? AND gr.dropped_at IS NULL
    `).get(req.params.id, player_id);
    if (takenBy) return res.status(400).json({ error: 'Player is already on a roster — cannot bid on rostered players' });

    // Validate drop player if provided
    if (drop_player_id) {
      const isCore = db.prepare('SELECT id FROM golf_core_players WHERE member_id = ? AND player_id = ?').get(member.id, drop_player_id);
      if (isCore) return res.status(400).json({ error: 'Cannot drop a core player' });
      const onRoster = db.prepare('SELECT id FROM golf_rosters WHERE member_id = ? AND player_id = ? AND dropped_at IS NULL').get(member.id, drop_player_id);
      if (!onRoster) return res.status(400).json({ error: 'Drop player is not on your roster' });
    }

    // FAAB budget check
    const faabSpent = db.prepare(`SELECT COALESCE(SUM(bid_amount), 0) as s FROM golf_faab_bids WHERE member_id = ? AND status IN ('pending', 'won')`).get(member.id).s;
    const remaining = (league.faab_budget || 500) - faabSpent;
    const bid = Math.max(0, parseInt(bid_amount) || 0);
    if (bid > remaining) return res.status(400).json({ error: `Bid $${bid} exceeds remaining FAAB $${remaining}` });

    // Find active tournament for this bid
    const activeTournament = db.prepare("SELECT id FROM golf_tournaments WHERE status = 'active' ORDER BY start_date ASC LIMIT 1").get();

    // Check for existing bid on same player — update it
    const existingBid = db.prepare('SELECT id FROM golf_faab_bids WHERE member_id = ? AND player_id = ? AND status = ?').get(member.id, player_id, 'pending');
    if (existingBid) {
      db.prepare('UPDATE golf_faab_bids SET bid_amount = ?, drop_player_id = ? WHERE id = ?').run(bid, drop_player_id || null, existingBid.id);
      return res.json({ ok: true, updated: true, bid_amount: bid });
    }

    db.prepare(`
      INSERT INTO golf_faab_bids (id, golf_league_id, member_id, player_id, drop_player_id, bid_amount, tournament_id, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'pending')
    `).run(uuidv4(), req.params.id, member.id, player_id, drop_player_id || null, bid, activeTournament?.id || null);

    res.status(201).json({ ok: true, bid_amount: bid, faab_remaining: remaining - bid });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
});

// ── POST /api/golf/leagues/:id/waivers/claim ───────────────────────────────────
// Free agent claim (non-FAAB): { player_id, drop_player_id }
// Used when use_faab=false, or for wire-priority leagues
router.post('/leagues/:id/waivers/claim', authMiddleware, (req, res) => {
  try {
    const { player_id, drop_player_id } = req.body;
    if (!player_id) return res.status(400).json({ error: 'player_id required' });

    const league = db.prepare('SELECT * FROM golf_leagues WHERE id = ?').get(req.params.id);
    if (!league) return res.status(404).json({ error: 'League not found' });
    if (league.use_faab) return res.status(400).json({ error: 'This league uses FAAB bidding — use POST /waivers/bid' });

    const member = getMember(req.params.id, req.user.id);
    if (!member) return res.status(403).json({ error: 'Not a member' });

    const player = db.prepare('SELECT * FROM golf_players WHERE id = ? AND is_active = 1').get(player_id);
    if (!player) return res.status(404).json({ error: 'Player not found' });

    const takenBy = db.prepare(`
      SELECT gr.id FROM golf_rosters gr
      JOIN golf_league_members glm ON gr.member_id = glm.id
      WHERE glm.golf_league_id = ? AND gr.player_id = ? AND gr.dropped_at IS NULL
    `).get(req.params.id, player_id);
    if (takenBy) return res.status(400).json({ error: 'Player is already on a roster' });

    // Roster full — require a drop
    const rosterCount = db.prepare('SELECT COUNT(*) as c FROM golf_rosters WHERE member_id = ? AND dropped_at IS NULL').get(member.id).c;
    if (rosterCount >= league.roster_size) {
      if (!drop_player_id) return res.status(400).json({ error: `Roster full (${league.roster_size}). Provide drop_player_id.` });
      const isCore = db.prepare('SELECT id FROM golf_core_players WHERE member_id = ? AND player_id = ?').get(member.id, drop_player_id);
      if (isCore) return res.status(400).json({ error: 'Cannot drop a core player' });
      const dropEntry = db.prepare('SELECT * FROM golf_rosters WHERE member_id = ? AND player_id = ? AND dropped_at IS NULL').get(member.id, drop_player_id);
      if (!dropEntry) return res.status(400).json({ error: 'Drop player not on your roster' });
      db.prepare('UPDATE golf_rosters SET dropped_at = CURRENT_TIMESTAMP WHERE id = ?').run(dropEntry.id);
      db.prepare('UPDATE golf_weekly_lineups SET is_started = 0 WHERE member_id = ? AND player_id = ? AND locked = 0').run(member.id, drop_player_id);
    }

    db.prepare('INSERT INTO golf_rosters (id, member_id, player_id) VALUES (?, ?, ?)').run(uuidv4(), member.id, player_id);
    res.json({ ok: true, player });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
});

// ── GET /api/golf/leagues/:id/waivers/bids ─────────────────────────────────────
// My pending bids and budget remaining
router.get('/leagues/:id/waivers/bids', authMiddleware, (req, res) => {
  try {
    const league = db.prepare('SELECT * FROM golf_leagues WHERE id = ?').get(req.params.id);
    if (!league) return res.status(404).json({ error: 'League not found' });
    const member = getMember(req.params.id, req.user.id);
    if (!member) return res.status(403).json({ error: 'Not a member' });

    const bids = db.prepare(`
      SELECT fb.*, gp.name as player_name, gp.world_ranking, gp.salary,
        dp.name as drop_player_name
      FROM golf_faab_bids fb
      JOIN golf_players gp ON fb.player_id = gp.id
      LEFT JOIN golf_players dp ON fb.drop_player_id = dp.id
      WHERE fb.member_id = ?
      ORDER BY fb.created_at DESC
    `).all(member.id);

    const faabSpent = bids.filter(b => b.status === 'won').reduce((s, b) => s + b.bid_amount, 0);
    const pendingTotal = bids.filter(b => b.status === 'pending').reduce((s, b) => s + b.bid_amount, 0);
    const budget = league.faab_budget || 500;

    res.json({
      bids,
      budget,
      spent: faabSpent,
      pending: pendingTotal,
      remaining: budget - faabSpent,
    });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
});

// ── Waiver processing (called by a scheduled job or manually) ──────────────────
// Exported for potential use by index.js scheduler
function processWaivers(leagueId) {
  const league = db.prepare('SELECT * FROM golf_leagues WHERE id = ?').get(leagueId);
  if (!league || league.format_type !== 'tourneyrun') return { processed: 0 };

  const pendingBids = db.prepare(`
    SELECT fb.*, glm.user_id, gp.salary
    FROM golf_faab_bids fb
    JOIN golf_league_members glm ON fb.member_id = glm.id
    JOIN golf_players gp ON fb.player_id = gp.id
    WHERE fb.golf_league_id = ? AND fb.status = 'pending'
    ORDER BY fb.bid_amount DESC, fb.created_at ASC
  `).all(leagueId);

  const processedPlayers = new Set();
  let processed = 0;

  for (const bid of pendingBids) {
    if (processedPlayers.has(bid.player_id)) {
      db.prepare("UPDATE golf_faab_bids SET status = 'lost' WHERE id = ?").run(bid.id);
      continue;
    }

    // Check player still available
    const taken = db.prepare(`
      SELECT id FROM golf_rosters gr
      JOIN golf_league_members glm ON gr.member_id = glm.id
      WHERE glm.golf_league_id = ? AND gr.player_id = ? AND gr.dropped_at IS NULL
    `).get(leagueId, bid.player_id);

    if (taken) {
      db.prepare("UPDATE golf_faab_bids SET status = 'lost' WHERE id = ?").run(bid.id);
      continue;
    }

    // Execute the claim
    try {
      db.transaction(() => {
        if (bid.drop_player_id) {
          const dropEntry = db.prepare('SELECT * FROM golf_rosters WHERE member_id = ? AND player_id = ? AND dropped_at IS NULL').get(bid.member_id, bid.drop_player_id);
          if (dropEntry) db.prepare('UPDATE golf_rosters SET dropped_at = CURRENT_TIMESTAMP WHERE id = ?').run(dropEntry.id);
        }
        db.prepare('INSERT INTO golf_rosters (id, member_id, player_id) VALUES (?, ?, ?)').run(uuidv4(), bid.member_id, bid.player_id);
        db.prepare("UPDATE golf_faab_bids SET status = 'won' WHERE id = ?").run(bid.id);
      })();
      processedPlayers.add(bid.player_id);
      processed++;
    } catch (_) {
      db.prepare("UPDATE golf_faab_bids SET status = 'lost' WHERE id = ?").run(bid.id);
    }
  }

  return { processed };
}

module.exports = router;
module.exports.processWaivers = processWaivers;
