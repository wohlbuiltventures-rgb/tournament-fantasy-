const db = require('./db');
const { scheduleAutoPick } = require('./draftTimer');

/**
 * Start the draft for a league. Validates state, randomises draft order,
 * updates DB, and emits 'draft_started' via socket if io is provided.
 * Returns { success, error?, league?, members? }
 */
function performStartDraft(leagueId, io) {
  try {
    const league = db.prepare('SELECT * FROM leagues WHERE id = ?').get(leagueId);
    if (!league) return { success: false, error: 'League not found' };
    if (league.status !== 'lobby') return { success: false, error: `League is not in lobby (status: ${league.status})` };

    const members = db.prepare('SELECT * FROM league_members WHERE league_id = ?').all(leagueId);
    if (members.length < 2) return { success: false, error: 'Need at least 2 teams to start the draft' };

    // Payment gate — all members must have paid
    const unpaid = db.prepare(`
      SELECT COUNT(*) as cnt FROM league_members lm
      LEFT JOIN member_payments mp ON mp.league_id = lm.league_id AND mp.user_id = lm.user_id
      WHERE lm.league_id = ? AND (mp.status IS NULL OR mp.status != 'paid')
    `).get(leagueId);
    if (unpaid.cnt > 0) {
      return { success: false, error: `${unpaid.cnt} team${unpaid.cnt !== 1 ? 's' : ''} haven't paid yet` };
    }

    // Randomise draft order
    const shuffled = [...members].sort(() => Math.random() - 0.5);
    const updateOrder = db.prepare('UPDATE league_members SET draft_order = ? WHERE id = ?');
    db.transaction(() => shuffled.forEach((m, i) => updateOrder.run(i + 1, m.id)))();

    db.prepare("UPDATE leagues SET status = 'drafting', current_pick = 1 WHERE id = ?").run(leagueId);

    const updatedLeague = db.prepare('SELECT * FROM leagues WHERE id = ?').get(leagueId);
    const updatedMembers = db.prepare(`
      SELECT lm.*, u.username FROM league_members lm
      JOIN users u ON lm.user_id = u.id
      WHERE lm.league_id = ? ORDER BY lm.draft_order
    `).all(leagueId);

    if (io) {
      io.to(`draft_${leagueId}`).emit('draft_started', {
        league: updatedLeague,
        members: updatedMembers,
        currentPick: 1,
      });
    }

    // Kick off server-side auto-pick timer for the first pick
    if (io) scheduleAutoPick(leagueId, io);

    console.log(`[auto-start] Draft started: league=${leagueId} (${league.name})`);
    return { success: true, league: updatedLeague, members: updatedMembers };
  } catch (err) {
    console.error('performStartDraft error:', err);
    return { success: false, error: err.message };
  }
}

module.exports = { performStartDraft };
