import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Check, Lock, ArrowLeft, AlertCircle, ChevronDown, Search, X } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../api';
import { useDocTitle } from '../../hooks/useDocTitle';

// ── Countdown timer ───────────────────────────────────────────────────────────

function Countdown({ lockTime }) {
  const [remaining, setRemaining] = useState('');
  const [isUrgent, setIsUrgent] = useState(false);

  useEffect(() => {
    function tick() {
      const diff = new Date(lockTime) - Date.now();
      if (diff <= 0) { setRemaining('Picks locked'); return; }
      const d = Math.floor(diff / 86400000);
      const h = Math.floor((diff % 86400000) / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setIsUrgent(diff < 3600000); // < 1 hour
      if (d > 0) setRemaining(`${d}d ${h}h ${m}m`);
      else if (h > 0) setRemaining(`${h}h ${m}m ${s}s`);
      else setRemaining(`${m}m ${s}s`);
    }
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [lockTime]);

  return (
    <span className={`font-mono font-bold ${isUrgent ? 'text-red-400' : 'text-green-400'}`}>
      {remaining}
    </span>
  );
}

// ── Confirm modal ─────────────────────────────────────────────────────────────

function ConfirmModal({ picks, onConfirm, onCancel, submitting }) {
  return (
    <div className="fixed inset-0 bg-black/70 flex items-end sm:items-center justify-center z-50 p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 w-full max-w-sm">
        <h3 className="text-white font-black text-lg mb-2">Lock in your picks?</h3>
        <p className="text-gray-400 text-sm mb-4">You can't change them after submitting.</p>
        <div className="bg-gray-800/60 rounded-xl p-3 mb-5 max-h-48 overflow-y-auto space-y-1.5">
          {picks.map((p, i) => (
            <div key={i} className="flex items-center justify-between text-xs">
              <span className="text-gray-200">{p.player_name}</span>
              <span className="text-gray-500">Tier {p.tier_number}</span>
            </div>
          ))}
        </div>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 py-3 bg-gray-800 hover:bg-gray-700 text-gray-300 font-bold rounded-xl transition-all text-sm"
          >
            Go Back
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={submitting}
            className="flex-1 py-3 bg-green-500 hover:bg-green-400 disabled:opacity-50 text-white font-black rounded-xl transition-all text-sm"
          >
            {submitting ? 'Submitting…' : 'Submit Picks'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Tiered pick sheet ─────────────────────────────────────────────────────────

function TieredPickSheet({ tiers, selected, onToggle }) {
  const totalTarget = tiers.reduce((s, t) => s + t.picks, 0);
  const totalSelected = Object.values(selected).flat().length;
  const allComplete = tiers.every(t => (selected[t.tier] || []).length === t.picks);

  return (
    <div className="space-y-4">
      {tiers.map(tier => {
        const tierSelected = selected[tier.tier] || [];
        const complete = tierSelected.length === tier.picks;
        const sorted = [...tier.players].sort((a, b) => (a.odds_decimal || 999) - (b.odds_decimal || 999));

        return (
          <div key={tier.tier} className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
            {/* Tier header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800 bg-gray-800/40">
              <div>
                <span className="text-white font-bold text-sm">Tier {tier.tier}</span>
                {tier.odds_min && (
                  <span className="text-gray-500 text-xs ml-2">{tier.odds_min} – {tier.odds_max}</span>
                )}
              </div>
              <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${
                complete
                  ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                  : 'bg-gray-700/60 text-gray-400 border border-gray-700'
              }`}>
                {tierSelected.length} of {tier.picks} {complete ? '✓' : ''}
              </span>
            </div>

            {/* Players grid */}
            <div className="p-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
              {sorted.map(p => {
                const isSelected = tierSelected.includes(p.player_id);
                const tierFull = tierSelected.length >= tier.picks && !isSelected;
                return (
                  <button
                    key={p.player_id}
                    type="button"
                    disabled={tierFull}
                    onClick={() => onToggle(tier.tier, p.player_id, p.player_name, tier.picks)}
                    className={`flex items-center justify-between rounded-xl border-2 px-3.5 py-2.5 text-left transition-all ${
                      isSelected
                        ? 'border-green-500/60 bg-green-500/10'
                        : tierFull
                          ? 'border-gray-800 bg-gray-800/20 opacity-40 cursor-not-allowed'
                          : 'border-gray-700 bg-gray-800/30 hover:border-gray-600 active:scale-[0.98]'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      {isSelected && (
                        <div className="w-4 h-4 rounded-full bg-green-500 flex items-center justify-center shrink-0">
                          <Check className="w-2.5 h-2.5 text-white" />
                        </div>
                      )}
                      <span className={`text-sm font-semibold truncate ${isSelected ? 'text-white' : 'text-gray-300'}`}>
                        {p.player_name}
                      </span>
                    </div>
                    <span className="text-gray-500 text-xs shrink-0 ml-2">{p.odds_display}</span>
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}

      {/* Running total */}
      <div className={`flex items-center justify-center gap-2 py-3 rounded-xl border text-sm font-bold ${
        allComplete
          ? 'bg-green-500/10 border-green-500/30 text-green-400'
          : 'bg-gray-900 border-gray-800 text-gray-500'
      }`}>
        {allComplete ? '✓ ' : ''}{totalSelected} of {totalTarget} picks made
        {allComplete ? ' — ready to submit' : ''}
      </div>
    </div>
  );
}

// ── Salary cap pick sheet ─────────────────────────────────────────────────────

function SalaryCapPickSheet({ tiers, cap, totalTarget, selected, onAdd, onRemove }) {
  const [sortBy, setSortBy] = useState('salary');
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');

  const allPlayers = tiers.flatMap(t => t.players.map(p => ({ ...p, tier_number: t.tier })));
  const totalSalary = selected.reduce((s, p) => s + (p.salary_used || 0), 0);
  const remaining = cap - totalSalary;
  const pct = Math.min(100, Math.round((totalSalary / cap) * 100));
  const barColor = remaining / cap < 0.2 ? 'bg-amber-500' : 'bg-green-500';
  const overCap = totalSalary > cap;

  const displayed = allPlayers
    .filter(p => {
      if (selected.find(s => s.player_id === p.player_id)) return false;
      if (filter === 'u8') return p.salary <= 8000;
      if (filter === 'u6') return p.salary <= 6000;
      return true;
    })
    .filter(p => !search || p.player_name.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => sortBy === 'salary' ? b.salary - a.salary : sortBy === 'ranking' ? a.world_ranking - b.world_ranking : a.player_name.localeCompare(b.player_name));

  return (
    <div className="space-y-4">
      {/* Budget bar */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4 sticky top-0 z-10">
        <div className="flex items-center justify-between text-sm mb-2">
          <span className="text-gray-400 font-semibold">Budget</span>
          <span className={`font-bold ${overCap ? 'text-red-400' : remaining / cap < 0.2 ? 'text-amber-400' : 'text-gray-200'}`}>
            ${remaining.toLocaleString()} remaining of ${cap.toLocaleString()}
          </span>
        </div>
        <div className="w-full bg-gray-800 rounded-full h-2">
          <div className={`h-2 rounded-full transition-all ${overCap ? 'bg-red-500' : barColor}`} style={{ width: `${pct}%` }} />
        </div>
        <div className="flex items-center justify-between mt-2 text-xs text-gray-500">
          <span>{selected.length} of {totalTarget} picks</span>
          {overCap && <span className="text-red-400 font-bold">Over cap!</span>}
        </div>
      </div>

      {/* My picks */}
      {selected.length > 0 && (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4">
          <p className="text-gray-400 text-xs font-semibold uppercase tracking-wide mb-2">My Roster</p>
          <div className="space-y-1.5">
            {selected.map(p => (
              <div key={p.player_id} className="flex items-center justify-between">
                <span className="text-gray-200 text-sm">{p.player_name}</span>
                <div className="flex items-center gap-3">
                  <span className="text-gray-500 text-xs">${(p.salary_used || 0).toLocaleString()}</span>
                  <button type="button" onClick={() => onRemove(p.player_id)} className="text-gray-600 hover:text-red-400 transition-colors">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Search + filters */}
      <div className="space-y-2">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            type="text"
            className="input pl-9 text-sm"
            placeholder="Search players…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          {[['all','All'],['u8','Under $8k'],['u6','Under $6k']].map(([v, l]) => (
            <button key={v} type="button" onClick={() => setFilter(v)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                filter === v ? 'bg-green-500/20 border-green-500/60 text-green-400' : 'bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-600'
              }`}>{l}</button>
          ))}
          <div className="flex gap-1 ml-auto">
            {['salary','ranking','name'].map(s => (
              <button key={s} type="button" onClick={() => setSortBy(s)}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-all capitalize ${
                  sortBy === s ? 'bg-gray-700 border-gray-600 text-white' : 'bg-gray-800 border-gray-700 text-gray-500'
                }`}>{s}</button>
            ))}
          </div>
        </div>
      </div>

      {/* Available players */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
        <div className="grid grid-cols-[auto_1fr_auto_auto_auto] gap-0 text-[10px] font-bold uppercase tracking-wide text-gray-600 px-4 py-2 border-b border-gray-800">
          <span className="w-7">#</span><span>Player</span>
          <span className="w-14 text-right">Odds</span>
          <span className="w-16 text-right pr-1">Salary</span>
          <span className="w-10" />
        </div>
        <div className="divide-y divide-gray-800/50 max-h-[60vh] overflow-y-auto">
          {displayed.map(p => {
            const wouldExceed = totalSalary + (p.salary || 0) > cap;
            const alreadyFull = selected.length >= totalTarget;
            const disabled = wouldExceed || alreadyFull;
            return (
              <div key={p.player_id} className="grid grid-cols-[auto_1fr_auto_auto_auto] items-center gap-0 px-4 py-2.5">
                <span className="text-gray-500 text-xs w-7">#{p.world_ranking}</span>
                <span className="text-gray-200 text-sm font-medium">{p.player_name}</span>
                <span className="text-gray-600 text-xs w-14 text-right">{p.odds_display}</span>
                <span className="text-gray-400 text-xs font-semibold w-16 text-right pr-1">${(p.salary || 0).toLocaleString()}</span>
                <div className="w-10 flex justify-end">
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() => onAdd(p)}
                    className={`w-7 h-7 rounded-lg font-bold text-sm flex items-center justify-center transition-all ${
                      disabled
                        ? 'bg-gray-800 text-gray-600 cursor-not-allowed'
                        : 'bg-green-500/20 border border-green-500/40 text-green-400 hover:bg-green-500/30'
                    }`}
                  >+</button>
                </div>
              </div>
            );
          })}
          {displayed.length === 0 && (
            <p className="text-gray-600 text-sm text-center py-6">No players match filters</p>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function GolfPoolPicks() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();

  useDocTitle('Make Your Picks | Golf Pool');

  const [league, setLeague]           = useState(null);
  const [tiers, setTiers]             = useState([]);
  const [myPicks, setMyPicks]         = useState({ picks: [], submitted: false, picks_locked: false });
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState('');

  // Tiered selection: { [tierNum]: [player_id, ...] }
  const [tieredSel, setTieredSel]     = useState({});
  // Tiered player names for confirm modal
  const [tieredNames, setTieredNames] = useState({}); // { player_id: player_name }

  // Salary cap selection: [{ player_id, player_name, salary_used, tier_number }]
  const [capSel, setCapSel]           = useState([]);

  const [showConfirm, setShowConfirm] = useState(false);
  const [submitting, setSubmitting]   = useState(false);

  useEffect(() => {
    Promise.all([
      api.get(`/golf/leagues/${id}`),
      api.get(`/golf/leagues/${id}/picks/my`),
    ]).then(([lRes, pRes]) => {
      const l = lRes.data.league;
      setLeague(l);
      const picks = pRes.data;
      setMyPicks(picks);

      if (picks.submitted) {
        navigate(`/golf/league/${id}/picks/submitted`, { replace: true });
        return;
      }
      if (picks.picks_locked) { setLoading(false); return; }

      const tid = l.pool_tournament_id;
      if (tid) {
        api.get(`/golf/leagues/${id}/tier-players`, { params: { tournament_id: tid } })
          .then(r => { setTiers(r.data.tiers || []); setLoading(false); })
          .catch(() => setLoading(false));
      } else {
        setLoading(false);
      }
    }).catch(err => {
      const s = err.response?.status;
      if (s === 403) setError("You don't have access to this league.");
      else setError('Failed to load pick sheet.');
      setLoading(false);
    });
  }, [id]);

  function handleTieredToggle(tierNum, playerId, playerName, tierLimit) {
    setTieredSel(prev => {
      const curr = prev[tierNum] || [];
      if (curr.includes(playerId)) {
        return { ...prev, [tierNum]: curr.filter(x => x !== playerId) };
      }
      if (curr.length >= tierLimit) return prev;
      return { ...prev, [tierNum]: [...curr, playerId] };
    });
    setTieredNames(prev => ({ ...prev, [playerId]: playerName }));
  }

  function handleCapAdd(player) {
    setCapSel(prev => [...prev, {
      player_id: player.player_id,
      player_name: player.player_name,
      salary_used: player.salary || 0,
      tier_number: player.tier_number || 1,
    }]);
  }

  function handleCapRemove(playerId) {
    setCapSel(prev => prev.filter(p => p.player_id !== playerId));
  }

  function buildPicksPayload() {
    const tid = league?.pool_tournament_id;
    if (league?.pick_sheet_format === 'salary_cap') {
      return { tournament_id: tid, picks: capSel.map(p => ({ player_id: p.player_id, tier_number: p.tier_number })) };
    }
    const picks = [];
    for (const [tierNum, ids] of Object.entries(tieredSel)) {
      for (const pid of ids) {
        picks.push({ player_id: pid, player_name: tieredNames[pid] || '', tier_number: parseInt(tierNum) });
      }
    }
    return { tournament_id: tid, picks };
  }

  function buildConfirmPicks() {
    if (league?.pick_sheet_format === 'salary_cap') return capSel;
    const picks = [];
    for (const [tierNum, ids] of Object.entries(tieredSel)) {
      for (const pid of ids) {
        picks.push({ player_id: pid, player_name: tieredNames[pid] || '', tier_number: parseInt(tierNum) });
      }
    }
    return picks;
  }

  async function handleSubmit() {
    setSubmitting(true);
    setError('');
    try {
      await api.post(`/golf/leagues/${id}/picks`, buildPicksPayload());
      navigate(`/golf/league/${id}/picks/submitted`);
    } catch (err) {
      setError(err.response?.data?.error || 'Submission failed. Try again.');
      setShowConfirm(false);
    }
    setSubmitting(false);
  }

  // Submission readiness
  const isSalaryCap = league?.pick_sheet_format === 'salary_cap';
  let tiersConfig = [];
  try { tiersConfig = JSON.parse(league?.pool_tiers || '[]'); } catch (_) {}
  const totalTarget = tiersConfig.reduce((s, t) => s + (t.picks || 0), 0);
  const tieredAllDone = tiers.length > 0 && tiers.every(t => (tieredSel[t.tier] || []).length === t.picks);
  const capTotal = capSel.reduce((s, p) => s + (p.salary_used || 0), 0);
  const capAllDone = isSalaryCap && capSel.length === totalTarget && capTotal <= (league?.pool_salary_cap || 50000);
  const canSubmit = isSalaryCap ? capAllDone : tieredAllDone;

  if (loading) return (
    <div className="flex justify-center py-20">
      <div className="w-8 h-8 border-2 border-green-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  if (error && !league) return (
    <div className="max-w-2xl mx-auto px-4 py-10 text-center">
      <p className="text-gray-400">{error}</p>
      <Link to={`/golf/league/${id}`} className="text-green-400 text-sm mt-4 inline-block">← Back to league</Link>
    </div>
  );

  if (myPicks.picks_locked) return (
    <div className="max-w-2xl mx-auto px-4 py-10 text-center">
      <Lock className="w-10 h-10 text-gray-600 mx-auto mb-4" />
      <h2 className="text-white font-black text-xl mb-2">Picks are locked</h2>
      <p className="text-gray-400 text-sm mb-6">Tee time has passed. Check the leaderboard for live scoring.</p>
      <Link to={`/golf/league/${id}`} className="inline-flex items-center gap-2 bg-green-500 hover:bg-green-400 text-white font-bold px-5 py-2.5 rounded-xl transition-all text-sm">
        ← Back to League
      </Link>
    </div>
  );

  if (!league?.pool_tournament_id) return (
    <div className="max-w-2xl mx-auto px-4 py-10 text-center">
      <AlertCircle className="w-10 h-10 text-amber-400 mx-auto mb-4" />
      <h2 className="text-white font-black text-xl mb-2">Tournament not assigned</h2>
      <p className="text-gray-400 text-sm">The commissioner hasn't set up the tournament for this pool yet.</p>
    </div>
  );

  const tourn = myPicks.tournament;
  const lockTime = myPicks.lock_time;

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 pb-24">

      {/* Header */}
      <Link to={`/golf/league/${id}`} className="inline-flex items-center gap-1.5 text-gray-500 hover:text-gray-300 text-sm mb-5 transition-colors">
        <ArrowLeft className="w-4 h-4" /> {league.name}
      </Link>

      <div className="mb-5">
        <h1 className="text-2xl font-black text-white">{tourn?.name || 'Pick Sheet'}</h1>
        {lockTime && (
          <p className="text-gray-400 text-sm mt-1">
            Locks in <Countdown lockTime={lockTime} />
          </p>
        )}
      </div>

      {error && (
        <div className="bg-red-900/40 border border-red-700 text-red-300 rounded-lg p-3 text-sm mb-4">{error}</div>
      )}

      {/* Pick sheet */}
      {isSalaryCap ? (
        <SalaryCapPickSheet
          tiers={tiers}
          cap={league.pool_salary_cap || 50000}
          totalTarget={totalTarget}
          selected={capSel}
          onAdd={handleCapAdd}
          onRemove={handleCapRemove}
        />
      ) : (
        <TieredPickSheet
          tiers={tiers}
          selected={tieredSel}
          onToggle={handleTieredToggle}
        />
      )}

      {/* Sticky submit bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-gray-950/95 border-t border-gray-800 px-4 py-4 flex items-center gap-3">
        <div className="flex-1 text-xs text-gray-500">
          {isSalaryCap
            ? `${capSel.length}/${totalTarget} picks · $${capTotal.toLocaleString()} used`
            : `${Object.values(tieredSel).flat().length}/${totalTarget} picks`}
        </div>
        <button
          type="button"
          onClick={() => setShowConfirm(true)}
          disabled={!canSubmit}
          className="bg-green-500 hover:bg-green-400 disabled:opacity-40 text-white font-black px-6 py-3 rounded-xl transition-all text-sm shadow-lg shadow-green-500/20"
        >
          Submit Picks →
        </button>
      </div>

      {/* Confirm modal */}
      {showConfirm && (
        <ConfirmModal
          picks={buildConfirmPicks()}
          onConfirm={handleSubmit}
          onCancel={() => setShowConfirm(false)}
          submitting={submitting}
        />
      )}

    </div>
  );
}
