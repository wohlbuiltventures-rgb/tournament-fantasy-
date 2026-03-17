import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Flag, DollarSign, Trophy, Settings, Check, Award, Target } from 'lucide-react';
import api from '../../api';
import { useDocTitle } from '../../hooks/useDocTitle';

// ── Format definitions ──────────────────────────────────────────────────────

const FORMATS = [
  {
    key: 'pool',
    Icon: Flag,
    iconBg: 'bg-green-500/10',
    iconColor: 'text-green-400',
    title: 'Pool',
    badge: 'Casual',
    badgeColor: 'bg-gray-700/60 text-gray-400 border-gray-600',
    description: 'Pick 8 golfers per tournament. Combined score vs par wins. No weekly management.',
    activeBorder: 'border-green-500/50',
    activeBg: 'bg-green-500/5',
  },
  {
    key: 'dk',
    Icon: DollarSign,
    iconBg: 'bg-blue-500/10',
    iconColor: 'text-blue-400',
    title: 'Daily Fantasy',
    badge: 'DFS',
    badgeColor: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
    description: '$50,000 salary cap resets every tournament. Pick 6 players each week from scratch.',
    activeBorder: 'border-blue-500/50',
    activeBg: 'bg-blue-500/5',
  },
  {
    key: 'tourneyrun',
    Icon: Trophy,
    iconBg: 'bg-yellow-500/10',
    iconColor: 'text-yellow-400',
    title: 'TourneyRun',
    badge: 'Signature',
    badgeColor: 'bg-green-500/15 text-green-400 border-green-500/30',
    description: 'Draft core players locked for the season. Fill flex spots via waiver wire. Majors score 1.5×.',
    activeBorder: 'border-green-500/50',
    activeBg: 'bg-green-500/5',
    recommended: true,
  },
];

// ── Shared UI components ─────────────────────────────────────────────────────

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
    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 sm:p-6">
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

// ── Page ─────────────────────────────────────────────────────────────────────

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
    draft_type: 'auction',
    auction_budget: 1000,
    faab_weekly_budget: 100,
    bid_timer_seconds: 30,
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
    <div className="max-w-2xl mx-auto px-4 py-8 sm:py-10">

      <div className="mb-8">
        <h1 className="text-2xl sm:text-3xl font-black text-white">Create Golf League</h1>
        <p className="text-gray-400 mt-1 text-sm sm:text-base">Set up your PGA Tour fantasy league for the 2026 season.</p>
      </div>

      {error && (
        <div className="bg-red-900/40 border border-red-700 text-red-300 rounded-lg p-3 text-sm mb-6">{error}</div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-5">

        {/* ── 1. Choose Your Format ── */}
        <Card>
          <CardHeader icon={Trophy} title="Choose Your Format" />
          <div className="grid md:grid-cols-3 gap-3">
            {FORMATS.map(f => (
              <button
                key={f.key}
                type="button"
                onClick={() => setFormat(f.key)}
                className={`relative text-left rounded-2xl border-2 p-4 transition-all ${
                  format === f.key
                    ? `${f.activeBorder} ${f.activeBg}`
                    : 'border-gray-700 bg-gray-800/20 hover:border-gray-600'
                }`}
              >
                {/* Selected checkmark */}
                {format === f.key && (
                  <div className="absolute top-3 right-3 w-5 h-5 rounded-full bg-green-500 flex items-center justify-center">
                    <Check className="w-3 h-3 text-white" />
                  </div>
                )}

                {/* Icon box */}
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${f.iconBg}`}>
                  <f.Icon className={`w-5 h-5 ${f.iconColor}`} />
                </div>

                {/* Title + badge */}
                <div className="flex items-center gap-2 mb-1.5 flex-wrap pr-6">
                  <span className={`font-black text-sm sm:text-base ${format === f.key ? 'text-white' : 'text-gray-300'}`}>
                    {f.title}
                  </span>
                  <span className={`inline-block border px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide ${f.badgeColor}`}>
                    {f.badge}
                  </span>
                  {f.recommended && (
                    <span className="inline-block bg-green-500/20 border border-green-500/30 text-green-400 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide">
                      Default
                    </span>
                  )}
                </div>

                {/* Description */}
                <p className="text-gray-500 text-xs leading-relaxed">{f.description}</p>
              </button>
            ))}
          </div>
        </Card>

        {/* ── 2. League Basics ── */}
        <Card>
          <CardHeader icon={Flag} title="League Basics" />
          <div className="space-y-4">
            <div>
              <label className="label">League Name *</label>
              <input
                type="text"
                className="input text-base"
                placeholder={format === 'dk' ? 'DFS Golf 2026' : format === 'pool' ? 'Golf Pool 2026' : 'Golf Degens 2026'}
                value={form.name}
                onChange={e => set('name', e.target.value)}
                required
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
          </div>
        </Card>

        {/* ── 3. League Settings (format-specific) ── */}
        <Card>
          <CardHeader icon={Settings} title="League Settings" />
          <div className="space-y-5">

            <div>
              <label className="label mb-2.5">Max Teams</label>
              <PillSelector
                options={[4, 6, 8, 10, 12].map(n => ({ value: n, label: String(n) }))}
                value={form.max_teams}
                onChange={v => set('max_teams', v)}
              />
            </div>

            {/* Pool settings */}
            {format === 'pool' && (
              <div>
                <label className="label mb-2.5">Picks Per Tournament</label>
                <PillSelector
                  options={[6, 8, 10].map(n => ({ value: n, label: String(n) }))}
                  value={form.picks_per_team}
                  onChange={v => set('picks_per_team', v)}
                />
                <p className="text-gray-600 text-xs mt-2">
                  Each manager drafts this many golfers per tournament. Combined score vs par wins.
                </p>
              </div>
            )}

            {/* DK settings */}
            {format === 'dk' && (
              <div>
                <label className="label mb-2.5">Weekly Salary Cap</label>
                <PillSelector
                  options={[
                    { value: 25000,  label: '$25k'  },
                    { value: 50000,  label: '$50k'  },
                    { value: 100000, label: '$100k' },
                  ]}
                  value={form.weekly_salary_cap}
                  onChange={v => set('weekly_salary_cap', v)}
                />
                <p className="text-gray-600 text-xs mt-2">
                  Cap resets every tournament. Pick {form.starters_count} starters within the cap.
                </p>
              </div>
            )}

            {/* TourneyRun settings */}
            {format === 'tourneyrun' && (
              <>
                {/* Draft Type */}
                <div>
                  <label className="label mb-2.5">Draft Type</label>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { val: 'auction', label: 'Auction', desc: 'Nominate & bid — highest wins' },
                      { val: 'snake',   label: 'Snake',   desc: 'Classic serpentine draft'       },
                    ].map(opt => (
                      <button
                        key={opt.val}
                        type="button"
                        onClick={() => set('draft_type', opt.val)}
                        className={`p-3 rounded-xl border-2 text-left transition-all ${
                          form.draft_type === opt.val
                            ? 'border-green-500/60 bg-green-500/8'
                            : 'border-gray-700 hover:border-gray-600'
                        }`}
                      >
                        <div className={`font-bold text-sm ${form.draft_type === opt.val ? 'text-green-400' : 'text-gray-300'}`}>
                          {opt.label}
                        </div>
                        <div className="text-gray-500 text-xs mt-0.5">{opt.desc}</div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Auction Budget (only when auction) */}
                {form.draft_type === 'auction' && (
                  <div>
                    <label className="label mb-2.5">Auction Budget Per Team</label>
                    <PillSelector
                      options={[
                        { value: 500,  label: '$500'  },
                        { value: 1000, label: '$1,000' },
                        { value: 2000, label: '$2,000' },
                      ]}
                      value={form.auction_budget}
                      onChange={v => set('auction_budget', v)}
                    />
                    <p className="text-gray-600 text-xs mt-2">Credits used during the live auction to win players.</p>
                  </div>
                )}

                {/* Snake salary cap (only when snake) */}
                {form.draft_type === 'snake' && (
                  <div>
                    <label className="label mb-2.5">Draft Salary Cap</label>
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
                    <p className="text-gray-600 text-xs mt-2">Applied during the initial draft of core players.</p>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="label mb-2.5">Core Spots</label>
                    <PillSelector
                      options={[2, 3, 4, 5].map(n => ({ value: n, label: String(n) }))}
                      value={form.core_spots}
                      onChange={v => set('core_spots', v)}
                    />
                  </div>
                  <div>
                    <label className="label mb-2.5">Flex Spots</label>
                    <PillSelector
                      options={[2, 3, 4, 5, 6].map(n => ({ value: n, label: String(n) }))}
                      value={form.flex_spots}
                      onChange={v => set('flex_spots', v)}
                    />
                  </div>
                </div>
                <p className="text-gray-600 text-xs -mt-2">
                  Core players are locked for the season. Flex spots fill via waiver wire.
                  Total roster: {form.core_spots + form.flex_spots} players.
                </p>

                {/* Bid Timer (only when auction) */}
                {form.draft_type === 'auction' && (
                  <div>
                    <label className="label mb-2.5">Bid Timer</label>
                    <PillSelector
                      options={[
                        { value: 20, label: '20s' },
                        { value: 30, label: '30s' },
                        { value: 60, label: '60s' },
                      ]}
                      value={form.bid_timer_seconds}
                      onChange={v => set('bid_timer_seconds', v)}
                    />
                    <p className="text-gray-600 text-xs mt-2">Countdown resets after each new bid.</p>
                  </div>
                )}

                <div>
                  <label className="label mb-2.5">Weekly FAAB Budget</label>
                  <PillSelector
                    options={[
                      { value: 50,  label: '$50'  },
                      { value: 100, label: '$100' },
                      { value: 200, label: '$200' },
                    ]}
                    value={form.faab_weekly_budget}
                    onChange={v => set('faab_weekly_budget', v)}
                  />
                  <p className="text-gray-600 text-xs mt-2">Resets every Monday for waiver wire bidding.</p>
                </div>

                <div>
                  <label className="label mb-2.5">Waiver Wire Type</label>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { val: true,  label: 'FAAB Bidding',      desc: 'Blind bids — highest wins'   },
                      { val: false, label: 'Reverse Standings',  desc: 'Last place picks first'      },
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
                        <div className={`font-bold text-sm ${form.use_faab === opt.val ? 'text-green-400' : 'text-gray-300'}`}>
                          {opt.label}
                        </div>
                        <div className="text-gray-500 text-xs mt-0.5">{opt.desc}</div>
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        </Card>

        {/* ── 4. Buy-in (optional) ── */}
        <Card>
          <CardHeader icon={DollarSign} title="Buy-in (Optional)" />
          <div className="space-y-4">
            <div>
              <label className="label">Buy-in Per Team</label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 font-bold">$</span>
                <input
                  type="number"
                  min="0"
                  step="1"
                  className="input pl-8"
                  placeholder="0"
                  value={form.buy_in_amount}
                  onChange={e => set('buy_in_amount', e.target.value)}
                />
              </div>
            </div>
            {parseFloat(form.buy_in_amount) > 0 && (
              <div>
                <label className="label mb-2.5">Payout Split (%)</label>
                <div className="grid grid-cols-3 gap-2 sm:gap-3">
                  {[
                    { label: '1st',  key: 'payout_first',  color: 'text-yellow-400' },
                    { label: '2nd',  key: 'payout_second', color: 'text-gray-300'   },
                    { label: '3rd',  key: 'payout_third',  color: 'text-orange-400' },
                  ].map(({ label, key, color }) => (
                    <div key={key} className="bg-gray-800/50 border border-gray-700/60 rounded-xl p-3">
                      <div className={`text-xs font-semibold mb-2 flex items-center gap-1 ${color}`}>
                        <Award className="w-3 h-3 shrink-0" /> {label}
                      </div>
                      <div className="relative">
                        <input
                          type="number"
                          min="0"
                          max="100"
                          className="input pr-6 text-right font-bold py-1.5 text-sm"
                          value={form[key]}
                          onChange={e => set(key, e.target.value)}
                        />
                        <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-500 text-xs">%</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </Card>

        {/* ── Scoring reference ── */}
        {format !== 'pool' && (
          <div className="bg-green-500/5 border border-green-500/20 rounded-2xl p-4 sm:p-5">
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
          <div className="bg-blue-500/5 border border-blue-500/20 rounded-2xl p-4 sm:p-5">
            <div className="flex items-center gap-2 mb-2">
              <Target className="w-4 h-4 text-blue-400" />
              <span className="text-blue-400 font-bold text-sm">Pool Scoring</span>
            </div>
            <p className="text-gray-400 text-xs leading-relaxed">
              Points scored per golfer using eagle/birdie/par/bogey system.
              Your {form.picks_per_team} golfers' scores combine each tournament. Highest combined points wins each week.
            </p>
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
