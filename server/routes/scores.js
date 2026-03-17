const express = require('express');
const authMiddleware = require('../middleware/auth');
const { buildStandings } = require('../standingsBuilder');
const db = require('../db');

const router = express.Router();

// GET /api/scores/league/:leagueId/standings
router.get('/league/:leagueId/standings', authMiddleware, (req, res) => {
  try {
    const { leagueId } = req.params;
    const result = buildStandings(leagueId);
    if (!result) return res.status(404).json({ error: 'League not found' });

    // Include the settings from the result
    res.json({
      standings: result.standings,
      settings: result.settings,
      sgLeader: result.sgLeader,
      sgBoard: result.sgBoard,
      isLive: result.isLive,
      livePlayerIds: result.livePlayerIds,
      updatedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/scores/player/:playerId — all game stats for a player
router.get('/player/:playerId', authMiddleware, (req, res) => {
  try {
    const stats = db.prepare(`
      SELECT ps.*, g.game_date, g.round_name, g.team1, g.team2, g.winner_team
      FROM player_stats ps
      JOIN games g ON ps.game_id = g.id
      WHERE ps.player_id = ?
      ORDER BY g.game_date DESC
    `).all(req.params.playerId);

    const player = db.prepare('SELECT * FROM players WHERE id = ?').get(req.params.playerId);

    res.json({ player, stats });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
