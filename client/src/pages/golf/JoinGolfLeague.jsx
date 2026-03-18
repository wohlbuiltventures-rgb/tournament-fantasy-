import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Flag, ArrowRight } from 'lucide-react';
import api from '../../api';
import { useDocTitle } from '../../hooks/useDocTitle';
import GolfPaymentModal, { wasGateDismissed } from '../../components/golf/GolfPaymentModal';

export default function JoinGolfLeague() {
  useDocTitle('Join Golf League | TourneyRun');
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [form, setForm] = useState({
    invite_code: searchParams.get('code') || '',
    team_name: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showGate, setShowGate] = useState(false);
  const [gateChecked, setGateChecked] = useState(false);
  const [hasSeasonPass, setHasSeasonPass] = useState(false);

  // Capture ref code from URL
  useEffect(() => {
    const ref = searchParams.get('ref');
    if (ref) sessionStorage.setItem('golf_ref_code', ref.toUpperCase());
  }, [searchParams]);

  // Check payment status on mount
  useEffect(() => {
    api.get('/golf/payments/status')
      .then(r => {
        setHasSeasonPass(r.data.hasSeasonPass || false);
        setGateChecked(true);
      })
      .catch(() => setGateChecked(true));
  }, []);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    // Gate 2: require Season Pass if not already paid
    if (!hasSeasonPass && !wasGateDismissed('season_pass', '')) {
      setShowGate(true);
      return;
    }

    await doJoin();
  };

  async function doJoin() {
    setLoading(true);
    try {
      const res = await api.post('/golf/leagues/join', form);
      navigate(`/golf/league/${res.data.league_id}`);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to join league');
      setLoading(false);
    }
  }

  return (
    <div className="max-w-md mx-auto px-4 py-12 sm:py-16">
      <div className="text-center mb-8">
        <div className="w-16 h-16 rounded-2xl bg-green-500/10 flex items-center justify-center mx-auto mb-4">
          <Flag className="w-8 h-8 text-green-400" />
        </div>
        <h1 className="text-2xl sm:text-3xl font-black text-white">Join a Golf League</h1>
        <p className="text-gray-400 mt-2">Enter your invite code to join the competition.</p>
      </div>

      {error && (
        <div className="bg-red-900/40 border border-red-700 text-red-300 rounded-lg p-3 text-sm mb-5">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="bg-gray-900 border border-gray-800 rounded-2xl p-5 sm:p-6 space-y-4">
        <div>
          <label className="label">Invite Code *</label>
          <input
            type="text"
            className="input text-base uppercase tracking-widest font-bold"
            placeholder="ABCD1234"
            value={form.invite_code}
            onChange={e => set('invite_code', e.target.value.toUpperCase())}
            required
            maxLength={12}
          />
        </div>
        <div>
          <label className="label">Your Team Name *</label>
          <input
            type="text"
            className="input text-base"
            placeholder="The Bogey Boys"
            value={form.team_name}
            onChange={e => set('team_name', e.target.value)}
            required
          />
        </div>

        {/* Season Pass badge if already paid */}
        {gateChecked && hasSeasonPass && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#4ade80', fontSize: 12 }}>
            <span>✓</span> 2026 Season Pass active
          </div>
        )}

        <button
          type="submit"
          disabled={loading || !gateChecked}
          className="w-full flex items-center justify-center gap-2 py-3.5 bg-green-500 hover:bg-green-400 disabled:opacity-50 text-white font-black rounded-xl transition-all shadow-lg shadow-green-500/20"
        >
          {loading ? 'Joining...' : <><span>Join League</span><ArrowRight className="w-4 h-4" /></>}
        </button>
      </form>

      {/* Gate 2: Season Pass modal */}
      {showGate && (
        <GolfPaymentModal
          type="season_pass"
          meta={{}}
          onClose={() => setShowGate(false)}
          onAlreadyPaid={() => { setHasSeasonPass(true); setShowGate(false); doJoin(); }}
        />
      )}
    </div>
  );
}
