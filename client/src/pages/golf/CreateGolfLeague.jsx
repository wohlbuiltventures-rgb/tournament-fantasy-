import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Target, Zap, Star, Trophy, Flag, Settings, DollarSign, Check, Award } from 'lucide-react';
import api from '../../api';
import { useDocTitle } from '../../hooks/useDocTitle';

const FORMATS = [
  {
    key: 'pool',
    Icon: Target,
    title: 'Pool',
    subtitle: 'Classic tournament pool',
    details: 'Pick 8 golfers. Combined score wins. Simple.',
    badge: 'Most Casual',
    badgeColor: 'bg-blue-500/15 border-blue-500/30 text-blue-400',
    border: 'border-blue-500/40',
    glow: 'bg-blue-500/8',
  },
  {
    key: 'dk',
    Icon: Zap,
    title: 'Daily Fantasy',
    subtitle: 'Fresh picks every week',
    details: '$50,000 cap resets each tournament. Pick 6 players. Season leaderboard tracks cumulative points.',
    badge: 'DFS Style',
    badgeColor: 'bg-purple-500/15 border-purple-500/30 text-purple-400',
    border: 'border-purple-500/40',
    glow: 'bg-purple-500/8',
  },
  {
    key: 'tourneyrun',
    Icon: Star,
    title: 'TourneyRun',
    subtitle: 'Dynasty season league',
    details: 'Draft 4 core players for the season. 4 flex spots via waiver wire. FAAB bidding or reverse-standings wire. Majors 1.5×.',
    badge: 'Signature',
    badgeColor: 'bg-green-500/15 border-green-500/30 text-green-400',
    border: 'border-green-500/40',
    glow: 'bg-green-500/8',
    recommended: true,
  },
];

function PillSelector({ options, value, onChange }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map(opt => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={`px-3.5 py-1.5 rounded-lg text-sm font-semibold border transition-all ${
            value === opt.value
              ? 'bg-green-500/20 border-green-500/60 text-green-400'
              : 'bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-600 hover:text-gray-300'
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

function Card({ children }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
      {children}
    </div>
  );
}

function CardHeader({ icon: Icon, title }) {
  return (
    <div className="flex items-center gap-2.5 mb-5 pb-4 border-b border-gray-800">
      <Icon className="w-5 h-5 text-gray-400 shrink-0" />
      <h2 className="text-white font-bold">{title}</h2>
    </div>
  );
}

export default function CreateGolfLeague() {
  useDocTitle('Create Golf League | TourneyRun');
  const navigate = useNavigate();

  const [format, setFormat] = useState('tourneyrun');
  const [form, setForm] = useState({
    name: '',
    team_name: '',
    max_teams: 8,
    buy_in_amount: '',
    payment_instructions: '',
    payout_first: 70,
    payout_second: 20,
    payout_third: 10,
    // Pool
    picks_per_team: 8,
    // DK
    weekly_salary_cap: 50000,
    starters_count: 6,
    // TourneyRun
    salary_cap: 2400,
    core_spots: 4,
    flex_spots: 4,
    faab_budget: 500,
    use_faab: true,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const payload = {
        ...form,
        format_type: format,
        buy_in_amount: parseFloat(form.buy_in_amount) || 0,
        use_faab: form.use_faab ? 1 : 0,
      };
      const res = await api.post('/golf/leagues', payload);
      navigate(`/golf/league/${res.data.league.id}`);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create league');
      setLoading(false);
    }
  };

  const selectedFmt = FORMATS.find(f => f.key === format);

  return (
    <div className="max-w-2xl mx-auto px-4 py-10">

      <div className="mb-8">
        <h1 className="text-3xl font-black text-white">Create Golf League</h1>
        <p className="text-gray-400 mt-1">Set up your PGA Tour fantasy league for the 2026 season.</p>
      </div>

      {error && (
        <div className="bg-red-900/40 border border-red-700 text-red-300 rounded-lg p-3 text-sm mb-6">{error}</div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">

        {/* ── Format selector ── */}
        <Card>
          <CardHeader icon={Trophy} title="Choose Your Format" />
          <div className="space-y-3">
            {FORMATS.map(f => (
              <button
                key={f.key}
                type="button"
                onClick={() => setFormat(f.key)}
                className={`w-full text-left rounded-xl border-2 p-4 transition-all ${
                  format === f.key
                    ? `${f.border} ${f.glow}`
                    : 'border-gray-700 hover:border-gray-600'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0">
                    <f.Icon className="w-5 h-5 mt-0.5 shrink-0 text-gray-300" />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`font-black text-base ${format === f.key ? 'text-white' : 'text-gray-300'}`}>{f.title}</span>
                        <span className={`inline-block border px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide ${f.badgeColor}`}>{f.badge}</span>
                        {f.recommended && <span className="inline-block bg-green-500/20 border border-green-500/30 text-green-400 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide">Recommended</span>}
                      </div>
                      <div className="text-gray-400 text-xs mt-0.5">{f.subtitle}</div>
                      <div className="text-gray-500 text-xs mt-1.5 leading-relaxed">{f.details}</div>
                    </div>
                  </div>
                  <div className={`w-5 h-5 rounded-full border-2 shrink-0 mt-0.5 flex items-center justify-center transition-all ${
                    format === f.key ? 'bg-green-500 border-green-500' : 'border-gray-600'
                  }`}>
                    {format === f.key && <Check className="w-3 h-3 text-white" />}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </Card>

        {/* ── League Basics ── */}
        <Card>
          <CardHeader icon={Flag} title="League Basics" />
          <div className="space-y-4">
            <div>
              <label className="label">League Name *</label>
              <input type="text" className="input text-base" placeholder={format === 'dk' ? 'DFS Golf 2026' : format === 'pool' ? 'Golf Pool 2026' : 'Golf Degens 2026'} value={form.name} onChange={e => set('name', e.target.value)} required />
            </div>
            <div>
              <label className="label">Your Team Name *</label>
              <input type="text" className="input text-base" placeholder="The Bogey Boys" value={form.team_name} onChange={e => set('team_name', e.target.value)} required />
            </div>
          </div>
        </Card>

        {/* ── Format-specific settings ── */}
        <Card>
          <CardHeader icon={Settings} title="League Settings" />
          <div className="space-y-5">

            <div>
              <label className="label mb-2.5">Max Teams</label>
              <PillSelector options={[4, 6, 8, 10, 12].map(n => ({ value: n, label: String(n) }))} value={form.max_teams} onChange={v => set('max_teams', v)} />
            </div>

            {/* Pool settings */}
            {format === 'pool' && (
              <div>
                <label className="label mb-2.5">Picks Per Team</label>
                <PillSelector options={[5, 6, 7, 8, 10, 12].map(n => ({ value: n, label: String(n) }))} value={form.picks_per_team} onChange={v => set('picks_per_team', v)} />
                <p className="text-gray-600 text-xs mt-2">Each manager picks this many golfers in a snake draft. Combined score wins.</p>
              </div>
            )}

            {/* DK settings */}
            {format === 'dk' && (
              <>
                <div>
                  <label className="label mb-2.5">Weekly Salary Cap</label>
                  <PillSelector
                    options={[
                      { value: 40000, label: '$40k' },
                      { value: 50000, label: '$50k' },
                      { value: 60000, label: '$60k' },
                    ]}
                    value={form.weekly_salary_cap}
                    onChange={v => set('weekly_salary_cap', v)}
                  />
                  <p className="text-gray-600 text-xs mt-2">Cap resets every tournament. Pick {form.starters_count} players within the cap.</p>
                </div>
                <div>
                  <label className="label mb-2.5">Starters Per Week</label>
                  <PillSelector options={[4, 5, 6].map(n => ({ value: n, label: String(n) }))} value={form.starters_count} onChange={v => set('starters_count', v)} />
                </div>
              </>
            )}

            {/* TourneyRun settings */}
            {format === 'tourneyrun' && (
              <>
                <div>
                  <label className="label mb-2.5">Draft Cap</label>
                  <PillSelector
                    options={[
                      { value: 2000, label: '$2,000' },
                      { value: 2400, label: '$2,400' },
                      { value: 2800, label: '$2,800' },
                      { value: 3200, label: '$3,200' },
                    ]}
                    value={form.salary_cap}
                    onChange={v => set('salary_cap', v)}
                  />
                  <p className="text-gray-600 text-xs mt-2">Salary cap applied during the initial draft of core players.</p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="label mb-2.5">Core Spots</label>
                    <PillSelector options={[2, 3, 4, 5].map(n => ({ value: n, label: String(n) }))} value={form.core_spots} onChange={v => set('core_spots', v)} />
                  </div>
                  <div>
                    <label className="label mb-2.5">Flex Spots</label>
                    <PillSelector options={[2, 3, 4, 5, 6].map(n => ({ value: n, label: String(n) }))} value={form.flex_spots} onChange={v => set('flex_spots', v)} />
                  </div>
                </div>
                <p className="text-gray-600 text-xs -mt-2">
                  Core players are locked for the season. Flex spots fill via waiver wire.
                  Total roster: {form.core_spots + form.flex_spots} players.
                </p>
                <div>
                  <label className="label mb-2.5">FAAB Budget Per Team</label>
                  <PillSelector
                    options={[
                      { value: 250, label: '$250' },
                      { value: 500, label: '$500' },
                      { value: 1000, label: '$1,000' },
                    ]}
                    value={form.faab_budget}
                    onChange={v => set('faab_budget', v)}
                  />
                </div>
                <div>
                  <label className="label mb-2.5">Waiver Wire Type</label>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { val: true, label: 'FAAB Bidding', desc: 'Blind bids — highest wins' },
                      { val: false, label: 'Reverse Standings', desc: 'Last place picks first' },
                    ].map(opt => (
                      <button
                        key={String(opt.val)}
                        type="button"
                        onClick={() => set('use_faab', opt.val)}
                        className={`p-3 rounded-xl border-2 text-left transition-all ${
                          form.use_faab === opt.val
                            ? 'border-green-500/60 bg-green-500/8'
                            : 'border-gray-700 hover:border-gray-600'
                        }`}
                      >
                        <div className={`font-bold text-sm ${form.use_faab === opt.val ? 'text-green-400' : 'text-gray-300'}`}>{opt.label}</div>
                        <div className="text-gray-500 text-xs mt-0.5">{opt.desc}</div>
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        </Card>

        {/* ── Buy-in (optional) ── */}
        <Card>
          <CardHeader icon={DollarSign} title="Buy-in (Optional)" />
          <div className="space-y-4">
            <div>
              <label className="label">Buy-in Per Team</label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 font-bold">$</span>
                <input type="number" min="0" step="1" className="input pl-8" placeholder="0" value={form.buy_in_amount} onChange={e => set('buy_in_amount', e.target.value)} />
              </div>
            </div>
            {parseFloat(form.buy_in_amount) > 0 && (
              <div>
                <label className="label mb-2.5">Payout Split (%)</label>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { label: '1st Place', key: 'payout_first',  color: 'text-yellow-400' },
                    { label: '2nd Place', key: 'payout_second', color: 'text-gray-300'   },
                    { label: '3rd Place', key: 'payout_third',  color: 'text-orange-400' },
                  ].map(({ label, key }) => (
                    <div key={key} className="bg-gray-800/50 border border-gray-700/60 rounded-xl p-3">
                      <div className={`text-xs font-semibold mb-2 flex items-center gap-1.5 ${color}`}>
                        <Award className="w-3.5 h-3.5" />{label}
                      </div>
                      <div className="relative">
                        <input type="number" min="0" max="100" className="input pr-6 text-right font-bold py-1.5" value={form[key]} onChange={e => set(key, e.target.value)} />
                        <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-500 text-xs">%</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </Card>

        {/* ── Scoring info ── */}
        {format !== 'pool' && (
          <div className="bg-green-500/5 border border-green-500/20 rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <Trophy className="w-4 h-4 text-green-400" />
              <span className="text-green-400 font-bold text-sm">Scoring System</span>
            </div>
            <div className="grid grid-cols-3 gap-2 text-xs text-gray-400">
              <div>Eagle → <span className="text-yellow-400 font-bold">+8 pts</span></div>
              <div>Birdie → <span className="text-green-400 font-bold">+3 pts</span></div>
              <div>Par → <span className="text-gray-300 font-bold">+0.5 pts</span></div>
              <div>Bogey → <span className="text-orange-400 font-bold">−0.5 pts</span></div>
              <div>Double+ → <span className="text-red-400 font-bold">−2 pts</span></div>
              <div>Majors → <span className="text-yellow-400 font-bold">1.5× all</span></div>
            </div>
            <p className="text-gray-500 text-xs mt-3">Finish bonuses: Win +30, Top 5 +15, Top 10 +8, Top 25 +3</p>
          </div>
        )}
        {format === 'pool' && (
          <div className="bg-blue-500/5 border border-blue-500/20 rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-2">
              <Target className="w-4 h-4 text-blue-400" />
              <span className="text-blue-400 font-bold text-sm">Pool Scoring</span>
            </div>
            <p className="text-gray-400 text-xs leading-relaxed">Points are scored per golfer using the same eagle/birdie/par/bogey system. Your {form.picks_per_team} golfers' scores combine each tournament. Lowest combined score wins each week.</p>
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full py-4 bg-green-500 hover:bg-green-400 disabled:opacity-50 text-white font-black text-base rounded-2xl transition-all shadow-lg shadow-green-500/25"
        >
          {loading ? 'Creating League...' : `Create ${selectedFmt?.title} League →`}
        </button>
      </form>
    </div>
  );
}
