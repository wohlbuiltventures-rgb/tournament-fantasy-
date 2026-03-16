// bad-words v4+ is ESM-only, so we load it via dynamic import() in an async
// IIFE that runs immediately when this module is required.  By the time the
// first HTTP request arrives the filter is ready; the sync helpers below fall
// back gracefully (allow / pass-through) in the extremely unlikely event that
// the import hasn't resolved yet.

let filter = null;

(async () => {
  try {
    const mod = await import('bad-words');
    const Filter = mod.default ?? mod.Filter;
    const f = new Filter({ placeHolder: '*' });

    f.addWords(
      // Racial slurs
      'nigger', 'niggers', 'nigga', 'niggas',
      'kike', 'kikes', 'spic', 'spics',
      'wetback', 'wetbacks',
      'chink', 'chinks',
      'gook', 'gooks',
      'zipperhead', 'raghead', 'towelhead',
      'sandnigger', 'beaner', 'beaners',
      'cracker', 'crackers',
      'jap', 'japs',
      'redskin', 'redskins',
      // Homophobic
      'faggot', 'faggots', 'fag', 'fags',
      'dyke', 'dykes',
      'tranny', 'trannies',
      // Ableist
      'retard', 'retards', 'retarded',
      'cripple', 'cripples',
    );

    filter = f;
  } catch (err) {
    console.error('[contentFilter] Failed to load bad-words:', err.message);
  }
})();

/**
 * Returns true if the text contains no blocked words.
 * Use for name validation — reject on false.
 */
function isClean(text) {
  if (!text || typeof text !== 'string') return true;
  if (!filter) return true;
  try {
    return !filter.isProfane(text);
  } catch {
    return true;
  }
}

/**
 * Replaces blocked words with asterisks.
 * Use for chat messages — clean rather than reject.
 */
function cleanText(text) {
  if (!text || typeof text !== 'string') return text;
  if (!filter) return text;
  try {
    return filter.clean(text);
  } catch {
    return text;
  }
}

const NAME_BLOCKED_MSG = 'That name is not allowed. Please choose a different name.';

module.exports = { isClean, cleanText, NAME_BLOCKED_MSG };
