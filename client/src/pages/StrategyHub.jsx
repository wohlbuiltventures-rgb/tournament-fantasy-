import { useState, useEffect, useMemo } from 'react';
import api from '../api';
import { useDocTitle } from '../hooks/useDocTitle';

const LS_INJURY_KEY = 'tr_last_viewed_injuries';

// ── Strategy tips ─────────────────────────────────────────────────────────────

const TIPS = [
  {
    icon: '⚖️',
    title: 'Balance your regions',
    body: "Don't load up on one region. If your 1-seed goes down early you need upside elsewhere. Spread picks across all four brackets so one bad game doesn't sink your whole roster.",
  },
  {
    icon: '🎯',
    title: "Target the 5-seeds",
    body: "5 vs 12 is the classic upset spot — but 5-seeds that survive are often high-usage scorers on legitimate round of 16 teams. They offer better ETP than most 3 or 4-seeds at a lower draft price.",
  },
  {
    icon: '📊',
    title: 'Volume beats efficiency',
    body: "A player who takes 18 shots a game accumulates points even in a loss. Usage rate matters more than field goal percentage. Target the guy whose team runs every play through him.",
  },
  {
    icon: '💎',
    title: 'Mid-majors are underrated',
    body: "A 12 or 13 seed from a high-scoring mid-major conference can rack up big numbers against early-round opponents. They go undrafted while everyone fights over the same blue-chip names.",
  },
  {
    icon: '🏹',
    title: 'Late rounds are where leagues are won',
    body: "Your picks 7-10 are pure upside. Target players on potential deep-run teams who are undervalued by other teams. One Cinderella run on your roster can vault you from last to first.",
  },
  {
    icon: '🔀',
    title: 'Hedge chalk and upside',
    body: "Mix 1-3 seeds (safe scoring floor, deep expected run) with 5-8 seeds (upside, lower draft cost). Full chalk rosters stall out when chalk falls. Full upside rosters get eliminated in round one.",
  },
  {
    icon: '⚠️',
    title: 'Check the injury report',
    body: "A Questionable designation the week before the tournament is a red flag. A player who's 70% healthy through four games is a fantasy liability. Use our injury alerts and verify before you draft.",
  },
  {
    icon: '🧠',
    title: 'Know the bracket, not just the player',
    body: "A 4-seed in an easy region is worth more than a 4-seed facing a brutal draw. Study the path to the quarterfinals before you draft — a player whose team needs to beat two 1-seeds to get there has a much lower ceiling.",
  },
];

// ── Source brand colors ───────────────────────────────────────────────────────

function sourceStyle(source) {
  const s = (source || '').toLowerCase();
  if (s.includes('espn'))            return { bg: 'bg-red-500/15',    text: 'text-red-400',    dot: 'bg-red-500'    };
  if (s.includes('cbs'))             return { bg: 'bg-blue-500/15',   text: 'text-blue-400',   dot: 'bg-blue-500'   };
  if (s.includes('bleacher'))        return { bg: 'bg-orange-500/15', text: 'text-orange-400', dot: 'bg-orange-500' };
  if (s.includes('athletic'))        return { bg: 'bg-purple-500/15', text: 'text-purple-400', dot: 'bg-purple-500' };
  if (s.includes('yahoo'))           return { bg: 'bg-violet-500/15', text: 'text-violet-400', dot: 'bg-violet-500' };
  if (s.includes('nbc') || s.includes('rotoworld')) return { bg: 'bg-sky-500/15', text: 'text-sky-400', dot: 'bg-sky-500' };
  if (s.includes('sports illustrated') || s.includes(' si ') || s === 'si') return { bg: 'bg-yellow-500/15', text: 'text-yellow-400', dot: 'bg-yellow-500' };
  if (s.includes('usa today'))       return { bg: 'bg-cyan-500/15',   text: 'text-cyan-400',   dot: 'bg-cyan-500'   };
  return { bg: 'bg-gray-700/40', text: 'text-gray-400', dot: 'bg-gray-500' };
}

function timeAgo(pubDateStr) {
  if (!pubDateStr) return '';
  const d = new Date(pubDateStr);
  if (isNaN(d)) return '';
  const mins = Math.floor((Date.now() - d) / 60000);
  if (mins < 60)  return `${mins}m ago`;
  if (mins < 1440) return `${Math.floor(mins / 60)}h ago`;
  return `${Math.floor(mins / 1440)}d ago`;
}

const TAG_LABELS = {
  all:         'All',
  injuries:    'Injuries',
  strategy:    'Strategy',
  sleepers:    'Sleepers',
  rankings:    'Rankings',
  predictions: 'Predictions',
  resources:   'Resources',
};

const EXTERNAL_RESOURCES = [
  {
    icon: (
      <svg className="w-7 h-7 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
          d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
    name:        'KenPom Analytics',
    description: 'The gold standard for college basketball efficiency ratings. Team tempo, offensive/defensive efficiency, and tournament predictions.',
    badge:       'Advanced Analytics',
    badgeStyle:  'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
    url:         'https://kenpom.com',
    cta:         'Visit KenPom →',
    accent:      'hover:border-emerald-500/40 hover:shadow-emerald-500/5',
  },
  {
    icon: (
      <svg className="w-7 h-7 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
          d="M16 8v8m-4-5v5m-4-2v2m-2 4h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    ),
    name:        'EvanMiya Player Ratings',
    description: 'Advanced player impact metrics and efficiency ratings. The best resource for identifying undervalued players before your draft.',
    badge:       'Player Analytics',
    badgeStyle:  'bg-purple-500/15 text-purple-400 border-purple-500/30',
    url:         'https://evanmiya.com',
    cta:         'Visit EvanMiya →',
    accent:      'hover:border-purple-500/40 hover:shadow-purple-500/5',
  },
];

// Build a player name index from an array of player objects
// Returns Map: lowercased-name/last-name -> player
function buildPlayerIndex(players) {
  const index = new Map();
  const lastNameCount = {};
  for (const p of players) {
    const lower = p.name.toLowerCase().trim();
    index.set(lower, p);
    const parts = lower.split(' ');
    const last = parts[parts.length - 1];
    lastNameCount[last] = (lastNameCount[last] || 0) + 1;
  }
  // Only index unique last names to avoid false matches
  for (const p of players) {
    const parts = p.name.toLowerCase().trim().split(' ');
    const last = parts[parts.length - 1];
    if (lastNameCount[last] === 1) index.set(`_last_${last}`, p);
  }
  return index;
}

function findPlayerInTitle(title, playerIndex) {
  const lower = title.toLowerCase();
  for (const [key, player] of playerIndex) {
    if (key.startsWith('_last_')) {
      const lastName = key.slice(6);
      if (new RegExp(`\\b${lastName}\\b`).test(lower)) return player;
    } else {
      if (lower.includes(key)) return player;
    }
  }
  return null;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function StrategyHub() {
  useDocTitle('Strategy Hub | TourneyRun');

  const [articles, setArticles]       = useState([]);
  const [loading, setLoading]         = useState(true);
  const [activeTag, setActiveTag]     = useState('all');
  const [tipsOpen, setTipsOpen]       = useState(true);
  const [players, setPlayers]         = useState([]);
  const [injuryBadge, setInjuryBadge] = useState(false);

  // Fetch players once for cross-referencing
  useEffect(() => {
    api.get('/players').then(r => setPlayers(r.data.players || [])).catch(() => {});
  }, []);

  const playerIndex = useMemo(() => buildPlayerIndex(players), [players]);

  // Fetch news articles (skip for the resources tab — it shows static cards)
  useEffect(() => {
    if (activeTag === 'resources') { setLoading(false); return; }
    setLoading(true);
    const params = activeTag !== 'all' ? `?tag=${activeTag}` : '';
    api.get(`/news${params}`)
      .then(r => {
        setArticles(r.data.articles || []);
        // Badge logic: compare latest injury article timestamp to last viewed
        if (r.data.latestInjuryAt) {
          const lastSeen = localStorage.getItem(LS_INJURY_KEY) || '';
          setInjuryBadge(r.data.latestInjuryAt > lastSeen);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [activeTag]);

  const handleTabClick = (tag) => {
    setActiveTag(tag);
    setLoading(true);
    if (tag === 'injuries') {
      localStorage.setItem(LS_INJURY_KEY, new Date().toISOString());
      setInjuryBadge(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">

      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white flex items-center gap-3">
          🧠 Strategy Hub
        </h1>
        <p className="text-gray-400 mt-1">Expert tips and the latest tournament news to sharpen your draft.</p>
      </div>

      {/* ── Strategy Tips ── */}
      <div className="mb-8">
        <button
          type="button"
          onClick={() => setTipsOpen(o => !o)}
          className="flex items-center gap-2 mb-4 group"
        >
          <h2 className="text-lg font-bold text-white group-hover:text-brand-400 transition-colors">
            Commissioner's Strategy Guide
          </h2>
          <svg
            className={`w-4 h-4 text-gray-500 transition-transform duration-200 ${tipsOpen ? 'rotate-180' : ''}`}
            fill="none" stroke="currentColor" viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {tipsOpen && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {TIPS.map((tip, i) => (
              <div key={i} className="card p-4 border-gray-800 hover:border-brand-500/30 transition-colors">
                <div className="text-2xl mb-2">{tip.icon}</div>
                <div className="text-white font-semibold text-sm mb-1.5">{tip.title}</div>
                <p className="text-gray-400 text-xs leading-relaxed">{tip.body}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── News Feed ── */}
      <div>
        {/* Filter tabs + header */}
        <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
          <h2 className="text-lg font-bold text-white">Latest Tournament News</h2>
          <div className="flex items-center gap-1.5 flex-wrap">
            {Object.entries(TAG_LABELS).map(([tag, label]) => {
              const isInjuries  = tag === 'injuries';
              const isResources = tag === 'resources';
              const isActive    = activeTag === tag;
              return (
                <button
                  key={tag}
                  type="button"
                  onClick={() => handleTabClick(tag)}
                  className={`relative px-3 py-1 rounded-full text-xs font-medium transition-colors border ${
                    isActive
                      ? isInjuries
                        ? 'bg-red-500/20 text-red-400 border-red-500/40'
                        : isResources
                        ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                        : 'bg-brand-500/20 text-brand-400 border-brand-500/40'
                      : isInjuries
                        ? 'bg-gray-800 text-red-400/70 border-red-500/20 hover:border-red-500/40 hover:text-red-400'
                        : isResources
                        ? 'bg-gray-800 text-emerald-400/70 border-emerald-500/20 hover:border-emerald-500/40 hover:text-emerald-400'
                        : 'bg-gray-800 text-gray-400 border-gray-700 hover:text-white hover:border-gray-600'
                  }`}
                >
                  {isInjuries && '🚨 '}{isResources && '🔗 '}{label}
                  {isInjuries && injuryBadge && (
                    <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full border border-gray-950 animate-pulse" />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {activeTag === 'resources' ? (
          /* ── External Resources panel ── */
          <div>
            {/* Disclaimer */}
            <div className="flex items-start gap-3 bg-gray-800/50 border border-gray-700/50 rounded-xl px-4 py-3 mb-6 text-xs text-gray-400 leading-relaxed">
              <span className="text-gray-500 shrink-0 mt-0.5">ℹ️</span>
              <span>
                These are trusted third-party resources used by serious tournament fantasy players.
                TourneyRun is not affiliated with or endorsed by any of these sites.
                All links open in a new tab.
              </span>
            </div>

            {/* Resource cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              {EXTERNAL_RESOURCES.map(r => (
                <div
                  key={r.name}
                  className={`card p-6 flex flex-col gap-4 transition-all hover:-translate-y-0.5 hover:shadow-lg ${r.accent}`}
                >
                  {/* Icon + badge row */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="w-12 h-12 rounded-xl bg-gray-800 border border-gray-700/60 flex items-center justify-center shrink-0">
                      {r.icon}
                    </div>
                    <span className={`text-[10px] font-bold px-2 py-1 rounded-full border ${r.badgeStyle}`}>
                      {r.badge}
                    </span>
                  </div>

                  {/* Name + description */}
                  <div>
                    <h3 className="text-white font-bold text-base mb-1.5">{r.name}</h3>
                    <p className="text-gray-400 text-sm leading-relaxed">{r.description}</p>
                  </div>

                  {/* CTA */}
                  <div className="mt-auto pt-1">
                    <a
                      href={r.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 bg-gray-800 hover:bg-gray-700 border border-gray-700 hover:border-gray-600 text-white font-semibold text-sm px-4 py-2 rounded-lg transition-colors"
                    >
                      {r.cta}
                    </a>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 9 }).map((_, i) => (
              <div key={i} className="card p-4 animate-pulse">
                <div className="h-3 bg-gray-800 rounded w-1/3 mb-3" />
                <div className="h-4 bg-gray-800 rounded w-full mb-2" />
                <div className="h-4 bg-gray-800 rounded w-3/4" />
              </div>
            ))}
          </div>
        ) : articles.length === 0 ? (
          <div className="card p-12 text-center">
            <div className="text-4xl mb-3">📡</div>
            <p className="text-gray-400 text-sm">No articles cached yet.</p>
            <p className="text-gray-600 text-xs mt-1">The news poller runs 60 seconds after server start — check back shortly.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {articles.map(article => {
              const ss = sourceStyle(article.source);
              const ago = timeAgo(article.published_at);
              const isInjuryArticle = article.feed_tag === 'injuries';
              const matchedPlayer = isInjuryArticle ? findPlayerInTitle(article.title, playerIndex) : null;
              return (
                <a
                  key={article.id}
                  href={article.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`card p-4 flex flex-col gap-2.5 transition-all hover:-translate-y-0.5 hover:shadow-lg group ${
                    isInjuryArticle
                      ? 'border-red-500/20 hover:border-red-500/40 hover:shadow-red-500/5'
                      : 'hover:border-brand-500/30 hover:shadow-brand-500/5'
                  }`}
                >
                  {/* Source + time */}
                  <div className="flex items-center justify-between gap-2">
                    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold ${ss.bg} ${ss.text}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${ss.dot}`} />
                      {article.source || 'News'}
                    </span>
                    {ago && <span className="text-gray-600 text-[10px] shrink-0">{ago}</span>}
                  </div>

                  {/* Injury label */}
                  {isInjuryArticle && (
                    <span className="self-start text-[10px] font-bold text-red-400 bg-red-500/10 border border-red-500/20 px-1.5 py-0.5 rounded">
                      🚨 Injury Report
                    </span>
                  )}

                  {/* Headline */}
                  <h3 className={`text-white text-sm font-semibold leading-snug transition-colors line-clamp-3 ${
                    isInjuryArticle ? 'group-hover:text-red-300' : 'group-hover:text-brand-300'
                  }`}>
                    {article.title}
                  </h3>

                  {/* Player cross-reference */}
                  {matchedPlayer && (
                    <div className="mt-1 flex items-center gap-2 bg-gray-800/60 border border-gray-700/60 rounded-lg px-3 py-2">
                      <span className="text-yellow-400 text-xs">⚠️</span>
                      <div className="flex-1 min-w-0">
                        <div className="text-white text-xs font-semibold truncate">{matchedPlayer.name}</div>
                        <div className="text-gray-500 text-[10px]">
                          {matchedPlayer.team}
                          {matchedPlayer.seed ? ` · #${matchedPlayer.seed} seed` : ''}
                          {matchedPlayer.season_ppg ? ` · ${matchedPlayer.season_ppg} PPG` : ''}
                        </div>
                      </div>
                      <span className="text-[10px] text-gray-500 shrink-0">In your pool</span>
                    </div>
                  )}

                  {/* Tag pill */}
                  <div className="mt-auto pt-1">
                    <span className="text-[10px] text-gray-600 uppercase tracking-wider">
                      {TAG_LABELS[article.feed_tag] || article.feed_tag}
                    </span>
                  </div>
                </a>
              );
            })}
          </div>
        )}

        {activeTag !== 'resources' && (
          <p className="text-gray-700 text-xs text-center mt-6">
            News sourced from Google News RSS feeds · Updated every 2 hours · Articles open in a new tab
          </p>
        )}
      </div>
    </div>
  );
}
