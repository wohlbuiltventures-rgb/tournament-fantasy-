const express = require('express');
const db = require('../db');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

// GET /api/scores/league/:leagueId/standings
router.get('/league/:leagueId/standings', authMiddleware, (req, res) => {
  try {
    const { leagueId } = req.params;

    const settings = db.prepare('SELECT * FROM scoring_settings WHERE league_id = ?').get(leagueId);
    if (!settings) return res.status(404).json({ error: 'League not found' });

    const members = db.prepare(`
      SELECT lm.*, u.username, u.venmo_handle, lm.avatar_url
      FROM league_members lm
      JOIN users u ON lm.user_id = u.id
      WHERE lm.league_id = ?
    `).all(leagueId);

    const standings = members.map(member => {
      // Get all drafted players for this member
      const draftedPlayers = db.prepare(`
        SELECT dp.player_id, p.name, p.team, p.position, p.is_eliminated
        FROM draft_picks dp
        JOIN players p ON dp.player_id = p.id
        WHERE dp.league_id = ? AND dp.user_id = ?
      `).all(leagueId, member.user_id);

      let totalPoints = 0;
      const playerStats = draftedPlayers.map(player => {
        const stats = db.prepare(`
          SELECT COALESCE(SUM(ps.points), 0) as total_points
          FROM player_stats ps
          JOIN games g ON ps.game_id = g.id
          WHERE ps.player_id = ?
        `).get(player.player_id);

        const fantasyPoints = stats.total_points * settings.pts_per_point;

        totalPoints += fantasyPoints;

        return {
          ...player,
          stats,
          fantasy_points: Math.round(fantasyPoints * 10) / 10,
        };
      });

      // Update total_points in DB
      db.prepare('UPDATE league_members SET total_points = ? WHERE league_id = ? AND user_id = ?')
        .run(Math.round(totalPoints * 10) / 10, leagueId, member.user_id);

      return {
        ...member,
        total_points: Math.round(totalPoints * 10) / 10,
        players: playerStats,
      };
    });

    standings.sort((a, b) => b.total_points - a.total_points);

    // ── Single-game bonus leader ──────────────────────────────────────────────
    // Find the player with the highest points in a single completed game across
    // ALL players in the tournament (not only drafted ones).  Then check if
    // that player was drafted in THIS league so we can show owner info.
    const sgLeader = db.prepare(`
      SELECT
        ps.player_id,
        p.name  AS player_name,
        p.team  AS player_team,
        ps.points,
        g.team1, g.team2, g.round_name,
        dp.user_id        AS owner_user_id,
        lm2.team_name     AS owner_team_name,
        u2.username       AS owner_username,
        u2.venmo_handle   AS owner_venmo
      FROM player_stats ps
      JOIN players p  ON ps.player_id = p.id
      JOIN games g    ON ps.game_id = g.id
      LEFT JOIN draft_picks dp   ON dp.player_id = ps.player_id AND dp.league_id = ?
      LEFT JOIN league_members lm2 ON lm2.user_id = dp.user_id AND lm2.league_id = ?
      LEFT JOIN users u2 ON u2.id = dp.user_id
      WHERE g.is_completed = 1 AND ps.points > 0
      ORDER BY ps.points DESC
      LIMIT 1
    `).get(leagueId, leagueId) || null;

    // Add a human-readable opponent string (e.g. "vs BYU")
    if (sgLeader) {
      const opp = sgLeader.team1 === sgLeader.player_team ? sgLeader.team2 : sgLeader.team1;
      sgLeader.opponent = opp;
    }

    res.json({ standings, settings, sgLeader });
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
