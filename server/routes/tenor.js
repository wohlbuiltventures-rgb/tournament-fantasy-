const express = require('express');
const https = require('https');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

function fetchJSON(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { timeout: 8000 }, res => {
      let data = '';
      res.on('data', c => (data += c));
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(new Error('JSON parse failed')); }
      });
    }).on('error', reject).on('timeout', () => reject(new Error('Request timed out')));
  });
}

// Normalize GIPHY result to the shape the frontend already expects:
// { id, title, media_formats: { tinygif: { url }, gif: { url } } }
function normalizeGiphy(item) {
  return {
    id: item.id,
    title: item.title || '',
    media_formats: {
      tinygif: { url: item.images?.fixed_height_small?.url || item.images?.fixed_height?.url || '' },
      gif:     { url: item.images?.fixed_height?.url || item.images?.original?.url || '' },
    },
  };
}

// GET /api/tenor/search?q=...&limit=12
router.get('/search', authMiddleware, async (req, res) => {
  const { q = '', limit = 12 } = req.query;
  const key = process.env.GIPHY_API_KEY;
  if (!key) return res.status(503).json({ error: 'GIPHY API not configured. Add GIPHY_API_KEY to server/.env' });

  try {
    const url = `https://api.giphy.com/v1/gifs/search?api_key=${encodeURIComponent(key)}&q=${encodeURIComponent(q)}&limit=${parseInt(limit)}&rating=g&lang=en`;
    const data = await fetchJSON(url);
    res.json({ results: (data.data || []).map(normalizeGiphy) });
  } catch (err) {
    res.status(500).json({ error: 'GIPHY error: ' + err.message });
  }
});

// GET /api/tenor/trending?limit=12
router.get('/trending', authMiddleware, async (req, res) => {
  const key = process.env.GIPHY_API_KEY;
  if (!key) return res.status(503).json({ error: 'GIPHY API not configured. Add GIPHY_API_KEY to server/.env' });

  try {
    const url = `https://api.giphy.com/v1/gifs/trending?api_key=${encodeURIComponent(key)}&limit=${parseInt(req.query.limit || 12)}&rating=g`;
    const data = await fetchJSON(url);
    res.json({ results: (data.data || []).map(normalizeGiphy) });
  } catch (err) {
    res.status(500).json({ error: 'GIPHY error: ' + err.message });
  }
});

module.exports = router;
