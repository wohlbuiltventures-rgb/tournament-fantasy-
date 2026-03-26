'use strict';
/**
 * playerNameNorm.js
 *
 * Shared player-name normalisation used by all sync services and matching
 * logic so the same algorithm runs everywhere consistently.
 *
 * normalizePlayerName(name) → lowercase comparison string
 *   - Strips diacritics: ø→o, é→e, å→a, ü→u, ñ→n, ø→o, ó→o, etc.
 *   - Strips periods (J.T.→JT, C.T.→CT, R.→R)
 *   - Strips hyphens, apostrophes, curly quotes
 *   - Collapses whitespace
 *
 * matchPlayerName(espnName, players) → player object | null
 *   Multi-level fallback matching:
 *   1. Exact normalised name
 *   2. Last name + first initial
 *   3. Last name only (only if unique — risky fallback)
 *
 * Usage:
 *   const { normalizePlayerName, matchPlayerName } = require('../utils/playerNameNorm');
 */

function normalizePlayerName(name) {
  return (name || '')
    // Explicit substitutions for characters that do NOT decompose via NFD.
    // ø, æ, œ, ł, ð, þ, ß are precomposed ligatures — NFD leaves them unchanged.
    .replace(/[øØ]/g, 'o')
    .replace(/[æÆ]/g, 'ae')
    .replace(/[œŒ]/g, 'oe')
    .replace(/[łŁ]/g, 'l')
    .replace(/[ðÐ]/g, 'd')
    .replace(/[þÞ]/g, 'th')
    .replace(/ß/g, 'ss')
    // NFD decomposition strips everything else: é→e, ü→u, å→a, ñ→n, etc.
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[.\-''']/g, '')       // strip periods, hyphens, apostrophes (J.T.→jt)
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Match an ESPN display name against an array of player objects { id, name }.
 * Returns the matched player object, or null with a console.error log on miss.
 *
 * @param {string} espnName - Name from ESPN API (may have diacritics, periods, etc.)
 * @param {Array<{id: string, name: string}>} players - Players from golf_players table
 * @param {string} [tournamentName] - For log context
 * @returns {{id: string, name: string} | null}
 */
function matchPlayerName(espnName, players, tournamentName) {
  const n = normalizePlayerName(espnName);

  // 1. Exact normalised match
  let m = players.find(p => normalizePlayerName(p.name) === n);
  if (m) return m;

  const parts = n.split(' ');
  if (parts.length < 2) {
    console.error(`[sync] NO MATCH: "${espnName}"${tournamentName ? ` in "${tournamentName}"` : ''} — name too short for fallback matching`);
    return null;
  }

  const last      = parts[parts.length - 1];
  const firstInit = parts[0][0];

  // 2. Last name + first initial
  m = players.find(p => {
    const pp = normalizePlayerName(p.name).split(' ');
    return pp[pp.length - 1] === last && pp[0]?.[0] === firstInit;
  });
  if (m) return m;

  // 3. Last name only — only safe if exactly one match
  const byLast = players.filter(p => normalizePlayerName(p.name).split(' ').pop() === last);
  if (byLast.length === 1) return byLast[0];

  console.error(`[sync] NO MATCH: "${espnName}"${tournamentName ? ` in "${tournamentName}"` : ''} — not found in golf_players table`);
  return null;
}

module.exports = { normalizePlayerName, matchPlayerName };
