const db = require('./db');
const { v4: uuidv4 } = require('uuid');
const { addMessage, makeSystemMsg } = require('./chatStore');

// Per-league timeout handles — keyed by leagueId
const timers = {};

/**
 * Schedule a server-side auto-pick for the current pick in a league.
 * Fires (pick_time_limit + 2) seconds after being called, then checks
 * whether the pick was already made. If not, auto-selects the highest-PPG
 * available player and emits pick_made to the room.
 *
 * Call this:
 *   - When a draft starts (after performStartDraft)
 *   - After every successful manual or auto pick (to cover the next turn)
 */
function scheduleAutoPick(leagueId, io) {
  // Cancel any pending timer for this league
  if (timers[leagueId]) {
    clearTimeout(timers[leagueId]);
    delete timers[leagueId];
  }

  const league = db.prepare('SELECT * FROM leagues WHERE id = ?').get(leagueId);
  if (!league || league.status !== 'drafting') return;

  const expectedPick = league.current_pick;
  const delay = (league.pick_time_limit + 2) * 1000; // +2s grace so client fires first

  timers[leagueId] = setTimeout(() => {
    _doAutoPick(leagueId, expectedPick, io);
  }, delay);
}

function clearAutoPick(leagueId) {
  if (timers[leagueId]) {
    clearTimeout(timers[leagueId]);
    delete timers[leagueId];
  }
}

function _doAutoPick(leagueId, expectedPick, io) {
  try {
    const league = db.prepare('SELECT * FROM leagues WHERE id = ?').get(leagueId);
    if (!league || league.status !== 'drafting') return;
    if (league.current_pick !== expectedPick) return; // pick already made

    const members = db.prepare(`
      SELECT lm.*, u.username FROM league_members lm
      JOIN users u ON lm.user_id = u.id
      WHERE lm.league_id = ? ORDER BY lm.draft_order
    `).all(leagueId);

    const numTeams = members.length;
    const totalPicks = numTeams * league.total_rounds;
    if (expectedPick > totalPicks) return;

    // Snake draft: determine who is on the clock
    const round = Math.ceil(expectedPick / numTeams);
    const pickInRound = (expectedPick - 1) % numTeams;
    const draftPos = round % 2 === 1 ? pickInRound + 1 : numTeams - pickInRound;
    const currentPicker = members.find(m => m.draft_order === draftPos);
    if (!currentPicker) return;

    // Best available player by PPG (not already drafted)
    const available = db.prepare(`
      SELECT * FROM players
      WHERE id NOT IN (SELECT player_id FROM draft_picks WHERE league_id = ?)
      ORDER BY season_ppg DESC, name ASC
      LIMIT 1
    `).get(leagueId);
    if (!available) return;

    const pickId = uuidv4();
    db.prepare(`
      INSERT INTO draft_picks (id, league_id, user_id, player_id, pick_number, round)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(pickId, leagueId, currentPicker.user_id, available.id, expectedPick, round);

    const nextPick = expectedPick + 1;
    const draftComplete = nextPick > totalPicks;

    if (draftComplete) {
      db.prepare("UPDATE leagues SET current_pick = ?, status = 'active' WHERE id = ?").run(nextPick, leagueId);
    } else {
      db.prepare('UPDATE leagues SET current_pick = ? WHERE id = ?').run(nextPick, leagueId);
    }

    // Determine next picker for the event payload
    const nextRound = Math.ceil(nextPick / numTeams);
    const nextPickInRound = (nextPick - 1) % numTeams;
    const nextDraftPos = nextRound % 2 === 1 ? nextPickInRound + 1 : numTeams - nextPickInRound;
    const nextPicker = draftComplete ? null : members.find(m => m.draft_order === nextDraftPos);

    io.to(`draft_${leagueId}`).emit('pick_made', {
      pick: {
        id: pickId,
        league_id: leagueId,
        user_id: currentPicker.user_id,
        player_id: available.id,
        pick_number: expectedPick,
        round,
        player_name: available.name,
        team: available.team,
        position: available.position,
        seed: available.seed,
        username: currentPicker.username,
      },
      nextPickUserId: nextPicker?.user_id || null,
      nextPickUsername: nextPicker?.username || null,
      draftComplete,
      currentPick: nextPick,
    });

    // System chat message
    const sysMsg = makeSystemMsg(
      `${currentPicker.team_name} selected ${available.name} with pick #${expectedPick}`
    );
    addMessage(leagueId, sysMsg);
    io.to(`draft_${leagueId}`).emit('chat_message', sysMsg);

    if (draftComplete) {
      const { getDraftState } = require('./routes/draft');
      io.to(`draft_${leagueId}`).emit('draft_completed', getDraftState(leagueId));
    } else {
      // Schedule auto-pick for the next turn
      scheduleAutoPick(leagueId, io);
    }

    console.log(`[auto-pick] ${leagueId} pick #${expectedPick}: ${available.name} (${available.season_ppg} PPG) → ${currentPicker.username}`);
  } catch (err) {
    console.error('[auto-pick] error:', err);
  }
}

module.exports = { scheduleAutoPick, clearAutoPick };
