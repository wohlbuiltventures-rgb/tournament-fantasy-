import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useDocTitle } from '../hooks/useDocTitle';

export const FAQ_SECTIONS = [
  {
    category: 'General',
    icon: '👋',
    questions: [
      {
        q: "What is TourneyRun?",
        a: "TourneyRun is a player pool fantasy game built around the college basketball tournament. You draft real college basketball players, they score points as they play in the tournament, and whoever ends March with the most points wins the pot. It's like tournament bracket picking — but way more fun because your fate isn't decided in the first round.",
      },
      {
        q: "How is this different from a regular tournament bracket?",
        a: "Brackets are a one-and-done gamble — if a 1-seed loses on day one, your whole bracket is toast. TourneyRun is a player draft, so your roster stays alive as long as any of your players are still in the tournament. Pick smart, draft deep, and a Cinderella story can actually help you.",
      },
      {
        q: "Do I need to know a lot about college basketball to play?",
        a: "Nope. We show PPG stats, seed info, and ETP (Expected Tournament Points) right on every player card during the draft. Even if you just know the big names, you can put together a solid roster. Half the fun is making smarter picks than the guy who watches 40 games a year.",
      },
      {
        q: "Is TourneyRun free to play?",
        a: "Creating and joining leagues is free. Buy-ins are optional — your league's commissioner sets whatever amount the group agrees on, or you can play for pure bragging rights with no money involved at all.",
      },
    ],
  },
  {
    category: 'How to Play',
    icon: '🎮',
    questions: [
      {
        q: "How do I get started?",
        a: "Create an account, then either start your own league or join one with an invite code. Once everyone's in, the commissioner kicks off the snake draft. Pick your players, watch the games, and check the leaderboard as the tournament unfolds.",
      },
      {
        q: "How do I join a league?",
        a: "You need an invite code from the league commissioner — they'll share it with your group over text, GroupMe, whatever you use. Hit 'Join League', punch in the code, and you're in. Easy.",
      },
      {
        q: "How many people can be in a league?",
        a: "Up to 10 teams per league. The sweet spot is 6-10 — enough to make the draft feel competitive without stretching the player pool too thin.",
      },
      {
        q: "What happens if I miss the draft?",
        a: "Life happens. If your pick timer runs out, the system auto-drafts for you — either Best Available (highest ETP) or Smart Draft if you've upgraded. Smart Draft is $2.99 and our algorithm drafts like a seasoned pro while you're stuck at dinner: it avoids injuries, balances your roster across regions and teams, and targets the highest-upside players available. Much smarter than just grabbing the top name on the list.",
      },
    ],
  },
  {
    category: 'Draft',
    icon: '📋',
    questions: [
      {
        q: "How does the draft work?",
        a: "It's a snake draft. If you pick first in round 1, you pick last in round 2, first again in round 3, and so on. Draft order is randomized when the commissioner starts the draft. Each team gets 60 seconds per pick by default (the commissioner can adjust this).",
      },
      {
        q: "How many rounds are there?",
        a: "The commissioner sets this when creating the league — typically 8-12 rounds. More rounds means deeper rosters and more chances for a late-round sleeper to blow up.",
      },
      {
        q: "What is ETP and why should I care?",
        a: "ETP stands for Expected Tournament Points — it's a player's PPG multiplied by how many games their team is statistically projected to play based on their seed. A 1-seed with 18 PPG has a much higher ETP than a 16-seed with 20 PPG who's probably one-and-done. Sort by ETP in the draft room to see who's actually most valuable.",
      },
      {
        q: "Can I queue up picks before my turn?",
        a: "Yes — star any player to add them to your watchlist queue. When your turn comes, the system will automatically draft the top available player from your queue. Saves you from scrambling when the timer is ticking.",
      },
      {
        q: "What if a player I drafted gets injured before the tournament?",
        a: "Injured players still appear on your roster but obviously score less (or nothing) if they can't play. We flag players with recent injury news right in the draft room so you can make informed picks. Always worth a 30-second Google before you lock in.",
      },
    ],
  },
  {
    category: 'Scoring',
    icon: '📊',
    questions: [
      {
        q: "How does scoring work?",
        a: "Every real point your player scores in a tournament game counts as a fantasy point. Cooper Flagg drops 28 in a round of 16 game? That's 28 points on your leaderboard. Simple, clean, tied directly to what happens on the court.",
      },
      {
        q: "When does the leaderboard update?",
        a: "We poll ESPN's live scoring API every 5 minutes during active tournament games. Scores update in near real-time, so you can watch the leaderboard shift as games are played.",
      },
      {
        q: "Does it matter if my player's team wins or loses?",
        a: "Sort of — if your player's team gets eliminated, that player is done scoring for the rest of the tournament. But they still keep every point they scored up to that moment. A player who goes for 35 in a loss still gave you 35 points.",
      },
      {
        q: "What happens to eliminated players on my roster?",
        a: "They stay on your roster with their total points locked in — they just can't add more. You'll see them grayed out on the leaderboard with an ELIM tag. The players still alive are what determine your final standing.",
      },
    ],
  },
  {
    category: 'Buy-in & Payouts',
    icon: '💰',
    questions: [
      {
        q: "How does the buy-in work?",
        a: "The commissioner sets a buy-in amount when creating the league. Everyone in the league pays the same amount. The prize pool is just buy-in × number of teams — what you see is what you get, no house cut on the pool itself.",
      },
      {
        q: "How do payouts work?",
        a: "The commissioner sets payout percentages when creating the league — typically something like 70% to 1st, 20% to 2nd, 10% to 3rd. The exact dollar amounts show up on the leaderboard so everyone knows what they're playing for. Payouts are handled via Venmo, Zelle, or whatever your group agrees on.",
      },
      {
        q: "What if fewer people join than expected?",
        a: "The prize pool is calculated from the actual number of teams who joined, not the max. So if you set up a 10-person league but only 7 join, the pool is based on 7 buy-ins. No one pays for empty spots.",
      },
      {
        q: "Is there a platform fee?",
        a: "For leagues using the Stripe payment integration there's a small processing fee. For cash leagues where you collect money yourselves, TourneyRun is free to use — we just provide the platform.",
      },
    ],
  },
  {
    category: 'Legal',
    icon: '⚖️',
    questions: [
      {
        q: "Is this legal?",
        a: "TourneyRun is designed as a skill-based fantasy game, which is treated differently from gambling in most US states. Fantasy sports involving real player stats and strategic decision-making have legal protection under federal law (UIGEA) and in most states. That said, laws vary by state and you should check your local regulations.",
      },
      {
        q: "Which states are not supported?",
        a: "We don't support paid leagues in Washington, Idaho, Montana, Nevada, and Louisiana due to their specific fantasy sports regulations. Free leagues with no buy-in are available everywhere. We're keeping a close eye on evolving state laws and will update this list.",
      },
      {
        q: "Is my personal data safe?",
        a: "We store only what we need — your email, username, and league activity. Passwords are hashed and never stored in plain text. Payment processing is handled entirely by Stripe; we never see your card details. We don't sell your data. Ever.",
      },
      {
        q: "What if there's a dispute about the results?",
        a: "Scores are pulled directly from ESPN's official scoring API, so the data is as authoritative as it gets. If you believe there's a scoring error, reach out and we'll dig into it. The commissioner also has tools to review standings and manually flag anything that looks off.",
      },
    ],
  },
];

function AccordionItem({ question, answer, isOpen, onToggle }) {
  return (
    <div className={`border-b border-gray-800 last:border-b-0 transition-colors ${isOpen ? 'bg-gray-900/50' : ''}`}>
      <button
        type="button"
        onClick={onToggle}
        className="w-full text-left px-5 py-4 flex items-start justify-between gap-4 hover:bg-gray-800/30 transition-colors"
      >
        <span className={`font-medium text-sm leading-snug transition-colors ${isOpen ? 'text-brand-400' : 'text-white'}`}>
          {question}
        </span>
        <svg
          className={`w-4 h-4 shrink-0 mt-0.5 text-gray-500 transition-transform duration-200 ${isOpen ? 'rotate-180 text-brand-400' : ''}`}
          fill="none" stroke="currentColor" viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {isOpen && (
        <div className="px-5 pb-4">
          <p className="text-gray-400 text-sm leading-relaxed">{answer}</p>
        </div>
      )}
    </div>
  );
}

export default function FAQ() {
  useDocTitle('FAQ | TourneyRun');
  const [open, setOpen] = useState({});

  const toggle = (sectionIdx, qIdx) => {
    const key = `${sectionIdx}-${qIdx}`;
    setOpen(prev => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-12">

      {/* Header */}
      <div className="text-center mb-10">
        <h1 className="text-4xl font-bold text-white mb-3">Frequently Asked Questions</h1>
        <p className="text-gray-400">Everything you need to know. Can't find your answer? <a href="mailto:hello@tourneyrun.app" className="text-brand-400 hover:text-brand-300 transition-colors">Drop us a line.</a></p>
      </div>

      {/* Sections */}
      <div className="space-y-6">
        {FAQ_SECTIONS.map((section, si) => (
          <div key={si} className="card overflow-hidden">
            {/* Section header */}
            <div className="px-5 py-3.5 border-b border-gray-800 flex items-center gap-2.5 bg-gray-900/40">
              <span className="text-lg">{section.icon}</span>
              <h2 className="font-bold text-white text-sm uppercase tracking-wider">{section.category}</h2>
            </div>

            {/* Questions */}
            {section.questions.map((item, qi) => (
              <AccordionItem
                key={qi}
                question={item.q}
                answer={item.a}
                isOpen={!!open[`${si}-${qi}`]}
                onToggle={() => toggle(si, qi)}
              />
            ))}
          </div>
        ))}
      </div>

      {/* Back link */}
      <div className="text-center mt-10">
        <Link to="/" className="text-gray-500 hover:text-white text-sm transition-colors">
          ← Back to TourneyRun
        </Link>
      </div>

    </div>
  );
}
