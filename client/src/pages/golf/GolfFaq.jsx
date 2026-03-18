import { useState } from 'react';
import { useDocTitle } from '../../hooks/useDocTitle';

const FAQ_SECTIONS = [
  {
    category: 'Scoring',
    icon: '📊',
    questions: [
      {
        q: 'How does scoring work?',
        a: 'Points are awarded for every shot your players make: Eagle (+8), Birdie (+3), Par (+0.5), Bogey (−0.5), Double+ (−2). At the end of each tournament, finish bonuses are added: 1st (+30), Top 5 (+12), Top 10 (+8), Top 25 (+3), Made Cut (+2), Missed Cut (−5). Points accumulate all season.',
      },
      {
        q: 'What counts as a Major?',
        a: 'The four Majors are The Masters, PGA Championship, US Open, and The Open Championship (British Open). During these four events, ALL points — stroke scoring and finish bonuses — are multiplied by 1.5×. A birdie is worth 4.5 pts, a top-5 finish is worth 18 pts, etc.',
      },
      {
        q: 'Do points reset between tournaments?',
        a: 'No. Points accumulate all season long. Every birdie your players make in every event adds to their total. The manager with the highest cumulative point total at the end of the season wins.',
      },
    ],
  },
  {
    category: 'FAAB & Waivers',
    icon: '💰',
    questions: [
      {
        q: 'What is FAAB and how do I use it?',
        a: 'FAAB stands for Free Agent Acquisition Budget — each manager gets $500 to spend on waiver wire pickups throughout the season. When you want to add a free agent, you submit a blind bid. After the waiver window closes, the highest bidder wins the player. FAAB spent is gone for the season, so spend wisely.',
      },
      {
        q: 'When does the waiver wire run?',
        a: 'Waivers process between events, typically after a tournament ends and before the next one begins. Your league commissioner can also process waivers manually. During an active tournament, rosters are locked.',
      },
      {
        q: 'Can I drop a core player?',
        a: 'No. Core players (your 4 designated core roster spots) are protected and cannot be dropped. Only flex players can be dropped via the waiver wire. Choose your 4 core players carefully at the auction draft.',
      },
    ],
  },
  {
    category: 'Lineups',
    icon: '📋',
    questions: [
      {
        q: 'When does my lineup lock?',
        a: 'Lineups lock Thursday at 12:00 PM Eastern Time — when the first tee shots of the PGA Tour week go off. You must set your starting 4 core + 4 flex players before that deadline. Any players in your flex spots who do not tee it up that week score 0 for you.',
      },
      {
        q: 'What is the difference between core and flex spots?',
        a: 'Core spots (4) are permanent — you set them at the draft and cannot swap them out. Flex spots (4) are your weekly lineup choices. You pick 4 players from your roster each week to fill flex, and you can change those picks before each event locks.',
      },
      {
        q: 'What happens if I forget to set my lineup?',
        a: 'Your previous week\'s lineup carries over. If you had players in flex last week who are not in this week\'s tournament, they score 0. Always check before Thursday.',
      },
    ],
  },
  {
    category: 'Draft',
    icon: '🏌️',
    questions: [
      {
        q: 'How does the auction draft work?',
        a: 'The commissioner kicks off the draft and any manager can nominate a player for auction. All managers bid simultaneously using their $2,400 salary budget. The highest bidder wins the player. The draft continues until all roster spots are filled. You must stay within your $2,400 cap total.',
      },
      {
        q: 'What is the roster size?',
        a: 'Standard TourneyRun rosters have 8 spots: 4 core and 4 flex. Your auction budget is $2,400 to fill all 8. Average spend per player is $300, but you can stack the top and go cheap elsewhere.',
      },
      {
        q: 'Can I join mid-season?',
        a: 'If the commissioner allows it, yes. Mid-season joiners go through an accelerated draft or are assigned a roster by the commissioner. Keep in mind you will have missed points from earlier events — most leagues cap mid-season joins after the third or fourth event.',
      },
    ],
  },
  {
    category: 'Payouts',
    icon: '🏆',
    questions: [
      {
        q: 'How do payouts work?',
        a: 'The commissioner sets the payout structure when creating the league. Common formats: winner-take-all, top-2, or top-3. Your league\'s payout breakdown is shown on the leaderboard page. TourneyRun does not handle money directly — payouts are managed by your group via Venmo, Zelle, or cash.',
      },
      {
        q: 'What is the Single Game Bonus?',
        a: 'If your league enables a Single Game Bonus, a separate prize (typically $100) goes to the owner of the player who posted the highest single-round score during the season. It\'s a secondary pot that gives everyone a chance to win something even if they\'re not leading the overall standings.',
      },
      {
        q: 'Does TourneyRun take a cut?',
        a: 'No. TourneyRun does not take a rake or percentage of the pot. The platform is free to use. All buy-in money is accounted for by your group.',
      },
    ],
  },
];

function FaqItem({ q, a }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-gray-800 last:border-0">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between gap-4 py-4 text-left hover:text-white transition-colors"
      >
        <span className={`text-sm font-semibold ${open ? 'text-white' : 'text-gray-300'}`}>{q}</span>
        <svg
          className="w-4 h-4 text-gray-500 shrink-0 transition-transform duration-200"
          style={{ transform: open ? 'rotate(180deg)' : 'none' }}
          fill="none" stroke="currentColor" viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <div className="pb-4 text-gray-400 text-sm leading-relaxed">{a}</div>
      )}
    </div>
  );
}

export default function GolfFaq() {
  useDocTitle('Golf FAQ | TourneyRun');

  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      {/* Header */}
      <div className="mb-10">
        <div className="inline-flex items-center gap-2 bg-green-500/10 border border-green-500/20 text-green-400 text-xs font-bold uppercase tracking-wider px-3 py-1.5 rounded-full mb-4">
          ⛳ Golf FAQ
        </div>
        <h1 className="text-3xl sm:text-4xl font-black text-white mb-3">Frequently asked questions</h1>
        <p className="text-gray-400 text-base">Everything you need to know about TourneyRun Golf.</p>
      </div>

      {/* Sections */}
      <div className="space-y-6">
        {FAQ_SECTIONS.map(({ category, icon, questions }) => (
          <div key={category} className="bg-gray-900 border border-gray-800 rounded-2xl p-5 sm:p-6">
            <div className="flex items-center gap-2 mb-4">
              <span className="text-base">{icon}</span>
              <h2 className="text-white font-bold text-sm uppercase tracking-wider">{category}</h2>
            </div>
            <div>
              {questions.map(item => <FaqItem key={item.q} {...item} />)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
