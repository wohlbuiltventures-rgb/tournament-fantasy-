import { useDocTitle } from '../../hooks/useDocTitle';

const TIPS = [
  {
    icon: '💰',
    title: 'How to target the right salary tier',
    body: "Don't blow your entire $2,400 cap on two superstars and fill the rest with filler. The sweet spot is 3-4 mid-tier golfers ($250-350) who play consistently week after week, plus one elite anchor. Guys ranked 20-50 in the world offer near-top scoring at a fraction of the price.",
  },
  {
    icon: '🔄',
    title: 'When to stream vs hold your studs',
    body: "Your 4 core spots should be locked studs you're rostering all season. Your 4 flex spots are where you make money — stream players who are hot entering a specific course they historically dominate, then swap them after the event via FAAB. Don't be afraid to drop a $200 player who's missed 3 cuts.",
  },
  {
    icon: '📋',
    title: 'How to exploit the FAAB wire',
    body: "FAAB is a blind auction — everyone bids simultaneously, highest bid wins. The mistake most managers make is overbidding on obvious waiver targets. Instead, identify under-the-radar players returning from a break or playing a course they've won before, and snipe them for $10-30 while everyone else fights over the big name.",
  },
  {
    icon: '⭐',
    title: 'Majors strategy — who to target at 1.5×',
    body: "The four majors (Masters, PGA Championship, US Open, The Open) multiply ALL points by 1.5×. This means eagles are worth 12 pts and a top-5 finish is 18 pts. Target bombers at Augusta (Masters) and links players for The Open. A single good major week can swing your season standings by 40+ points.",
  },
  {
    icon: '✂️',
    title: 'Missed cuts kill your season',
    body: "The −5 cut penalty adds up fast. A player who misses 4 cuts costs you 20 points — the equivalent of missing a top-5 finish. Prioritize consistency over upside for your core 4 spots. Check the field strength before events: elite players routinely skip weak-field events, which creates missed-cut risk even for top-ranked golfers.",
  },
  {
    icon: '🗓️',
    title: 'Set your lineup before Thursday 12pm ET',
    body: "Thursday is the lineup lock — no exceptions. Get in the habit of setting your flex spots by Wednesday night after checking tee times and weather. Wind forecasts at 24 hours are your best friend. A player teeing off in calm conditions on Thursday morning has a massive advantage over afternoon waves in 30mph gusts.",
  },
  {
    icon: '🏌️',
    title: 'Know the course, not just the player',
    body: "PGA Tour players have wildly different course histories. A player ranked 40th in the world who has top-10s in 3 of his last 4 starts at a specific venue is worth more than his salary suggests. Check Strokes Gained: Approach stats for courses that reward iron play, and SG: Off-the-Tee for long, wide-open setups.",
  },
  {
    icon: '🎯',
    title: 'Roster construction at the auction draft',
    body: "Going into the auction, have tiers in mind: 1 elite anchor ($500+), 2-3 proven mid-tier starters ($250-400), and 3-4 value plays under $200. Leave yourself at least $150 in the tank for the last few players — managers who run dry early are forced to take scraps. Speed nominations of players you don't want early to drain your rivals' budgets.",
  },
];

export default function GolfStrategy() {
  useDocTitle('Golf Strategy | TourneyRun');

  return (
    <div className="max-w-4xl mx-auto px-4 py-10">
      {/* Header */}
      <div className="mb-10">
        <div className="inline-flex items-center gap-2 bg-green-500/10 border border-green-500/20 text-green-400 text-xs font-bold uppercase tracking-wider px-3 py-1.5 rounded-full mb-4">
          ⛳ Golf Strategy Guide
        </div>
        <h1 className="text-3xl sm:text-4xl font-black text-white mb-3">Win your golf league</h1>
        <p className="text-gray-400 text-base max-w-2xl leading-relaxed">
          Season-long golf fantasy rewards patience and smart roster management. These tips apply to the TourneyRun format — one draft, 13 events, majors at 1.5×.
        </p>
      </div>

      {/* Tips grid */}
      <div className="grid sm:grid-cols-2 gap-4 mb-10">
        {TIPS.map(({ icon, title, body }) => (
          <div
            key={title}
            className="bg-gray-900 border border-gray-800 rounded-2xl p-5 hover:border-green-500/25 transition-colors"
          >
            <div className="flex items-start gap-3 mb-2">
              <span className="text-xl shrink-0">{icon}</span>
              <h3 className="text-white font-bold text-sm leading-snug">{title}</h3>
            </div>
            <p className="text-gray-400 text-sm leading-relaxed pl-8">{body}</p>
          </div>
        ))}
      </div>

      {/* Quick reference scoring */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 sm:p-6">
        <h3 className="text-white font-bold text-sm mb-4">⚡ Quick Scoring Reference</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-2.5 text-sm mb-4">
          {[
            { label: 'Eagle',      pts: '+8',  color: 'text-yellow-400' },
            { label: 'Birdie',     pts: '+3',  color: 'text-green-400'  },
            { label: 'Par',        pts: '+0.5',color: 'text-gray-300'   },
            { label: 'Bogey',      pts: '−0.5',color: 'text-orange-400' },
            { label: 'Double+',    pts: '−2',  color: 'text-red-400'    },
            { label: '1st Place',  pts: '+30', color: 'text-green-400'  },
            { label: 'Top 5',      pts: '+12', color: 'text-green-400'  },
            { label: 'Top 10',     pts: '+8',  color: 'text-green-400'  },
            { label: 'Top 25',     pts: '+3',  color: 'text-green-400'  },
            { label: 'Made Cut',   pts: '+2',  color: 'text-green-400'  },
            { label: 'Missed Cut', pts: '−5',  color: 'text-red-400'    },
          ].map(({ label, pts, color }) => (
            <div key={label} className="flex items-center justify-between gap-2">
              <span className="text-gray-400">{label}</span>
              <span className={`font-bold ${color}`}>{pts}</span>
            </div>
          ))}
        </div>
        <div className="pt-3 border-t border-gray-800 flex items-center gap-2">
          <span className="text-yellow-400">⭐</span>
          <span className="text-yellow-400 font-bold text-sm">Majors: all points × 1.5</span>
          <span className="text-gray-600 text-xs ml-auto hidden sm:inline">Masters · PGA Champ · US Open · The Open</span>
        </div>
      </div>
    </div>
  );
}
