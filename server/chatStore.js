const { v4: uuidv4 } = require('uuid');
const { cleanText } = require('./contentFilter');

// Per-league in-memory chat history (last 50 messages)
const rooms = new Map();

function filterProfanity(text) {
  return cleanText(text);
}

function getHistory(leagueId) {
  return rooms.get(leagueId) || [];
}

function addMessage(leagueId, msg) {
  if (!rooms.has(leagueId)) rooms.set(leagueId, []);
  const msgs = rooms.get(leagueId);
  msgs.push(msg);
  if (msgs.length > 50) msgs.splice(0, msgs.length - 50);
  return msg;
}

function makeSystemMsg(text) {
  return {
    id: uuidv4(),
    isSystem: true,
    text,
    timestamp: new Date().toISOString(),
  };
}

module.exports = { getHistory, addMessage, makeSystemMsg, filterProfanity };
