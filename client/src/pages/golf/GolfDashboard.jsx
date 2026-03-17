import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Ticket, Plus, Flag, ChevronRight, Users, Calendar, Trophy, Star } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../api';
import { useDocTitle } from '../../hooks/useDocTitle';
import BallLoader from '../../components/BallLoader';

function NextTournamentBanner({ tournament }) {
  if (!tournament) return null;
  const isLive = tournament.status === 'active';
  const start = new Date(tournament.start_date);
  const end = new Date(tournament.end_date);
  const now = new Date();
  const daysUntil = Math.ceil((start - now) / (1000 * 60 * 60 * 24));

  const fmt = d => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const dateRange = `${fmt(start)} – ${fmt(end)}, 2026`;

  return (
    <div className={`relative overflow-hidden rounded-2xl border p-4 sm:p-5 mb-6 ${
      isLive
        ? 'bg-green-500/8 border-green-500/30'
        : tournament.is_major
        ? 'bg-yellow-500/5 border-yellow-500/25'
        : 'bg-gray-900 border-gray-800'
    }`}>
      {/* Subtle glow */}
      {isLive && (
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,_rgba(34,197,94,0.08)_0%,_transparent_60%)] pointer-events-none" />
      )}
      <div className="relative flex flex-wrap items-center gap-3 sm:gap-4">
        {/* Icon */}
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
          isLive ? 'bg-green-500/20' : tournament.is_major ? 'bg-yellow-500/10' : 'bg-gray-800'
        }`}>
          {tournament.is_major
            ? <Trophy className="w-5 h-5 text-yellow-400" />
            : <Flag className="w-5 h-5 text-green-400" />}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-0.5">
            <span className="text-white font-black text-sm sm:text-base truncate">{tournament.name}</span>
            {isLive && (
              <span className="inline-flex items-center gap-1 bg-green-500/20 border border-green-500/40 text-green-400 text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full">
                <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" /> LIVE NOW
              </span>
            )}
            {!isLive && tournament.is_major && (
              <span className="inline-block bg-yellow-500/15 border border-yellow-500/30 text-yellow-400 text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full">MAJOR</span>
            )}
            {!isLive && tournament.is_signature === 1 && !tournament.is_major && (
              <span className="inline-block bg-green-500/15 border border-green-500/30 text-green-400 text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full">SIGNATURE</span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-3 text-xs text-gray-400">
            <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> {dateRange}</span>
            <span className="text-gray-600">·</span>
            <span className="truncate">{tournament.course}</span>
          </div>
        </div>

        {/* Countdown */}
        {!isLive && daysUntil > 0 && (
          <div className="text-right shrink-0">
            <div className={`font-black text-lg tabular-nums ${tournament.is_major ? 'text-yellow-400' : 'text-green-400'}`}>
              {daysUntil}d
            </div>
            <div className="text-gray-500 text-[10px] uppercase tracking-wide">until start</div>
          </div>
        )}
        {isLive && (
          <div className="text-right shrink-0">
            <div className="text-green-400 font-black text-sm">In Progress</div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function GolfDashboard() {
  useDocTitle('Golf Dashboard | TourneyRun');
  const { user } = useAuth();
  const [leagues, setLeagues] = useState([]);
  const [nextTournament, setNextTournament] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get('/golf/leagues'),
      api.get('/golf/tournaments'),
    ]).then(([lr, tr]) => {
      setLeagues(lr.data.leagues || []);
      const tournaments = tr.data.tournaments || [];
      // Prefer active tournament, then nearest upcoming
      const live = tournaments.find(t => t.status === 'active');
      if (live) { setNextTournament(live); return; }
      const upcoming = tournaments
        .filter(t => t.status === 'scheduled')
        .sort((a, b) => new Date(a.start_date) - new Date(b.start_date));
      setNextTournament(upcoming[0] || null);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  if (loading) return <BallLoader />;

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 sm:py-10">

      {/* ── Header ── */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-8 sm:mb-10">
        <div>
          <h1 className="text-3xl sm:text-4xl font-black text-white leading-tight">
            Golf Leagues
          </h1>
          <p className="text-gray-400 mt-1">Welcome back, {user?.username}</p>
        </div>
        <div className="flex gap-3 flex-wrap">
          <Link
            to="/golf/join"
            className="inline-flex items-center gap-2 bg-gray-800 hover:bg-gray-700 border border-gray-700 hover:border-gray-500 text-gray-200 font-semibold px-4 py-2.5 rounded-full transition-all text-sm"
          >
            <Ticket className="w-4 h-4" /> Join League
          </Link>
          <Link
            to="/golf/create"
            className="inline-flex items-center gap-2 bg-green-500 hover:bg-green-400 text-white font-semibold px-4 py-2.5 rounded-full transition-all shadow-lg shadow-green-500/25 text-sm"
          >
            <Plus className="w-4 h-4" /> Create League
          </Link>
        </div>
      </div>

      {/* ── Next Tournament Banner ── */}
      <NextTournamentBanner tournament={nextTournament} />

      {/* ── Empty state ── */}
      {leagues.length === 0 && (
        <div className="relative overflow-hidden rounded-3xl border border-gray-800 bg-gray-900 p-8 sm:p-10 text-center">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_rgba(34,197,94,0.05)_0%,_transparent_70%)] pointer-events-none" />
          <div className="relative">
            <div className="w-16 h-16 rounded-2xl bg-green-500/10 flex items-center justify-center mx-auto mb-5">
              <Flag className="w-8 h-8 text-green-400" />
            </div>
            <h2 className="text-2xl font-black text-white mb-3">No leagues yet</h2>
            <p className="text-gray-400 max-w-md mx-auto mb-8">
              Create a golf league or join one with an invite code to start competing.
            </p>
            <div className="grid sm:grid-cols-2 gap-4 max-w-lg mx-auto">
              <Link
                to="/golf/create"
                className="group flex flex-col items-center gap-3 bg-gray-800 hover:bg-gray-800/80 border border-gray-700 hover:border-green-500/50 rounded-2xl p-6 transition-all hover:-translate-y-1"
              >
                <div className="w-12 h-12 rounded-xl bg-green-500/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Plus className="w-6 h-6 text-green-400" />
                </div>
                <div>
                  <div className="text-white font-black">Create a League</div>
                  <div className="text-gray-500 text-sm mt-0.5">Set the rules, invite your crew</div>
                </div>
              </Link>
              <Link
                to="/golf/join"
                className="group flex flex-col items-center gap-3 bg-gray-800 hover:bg-gray-800/80 border border-gray-700 hover:border-green-500/50 rounded-2xl p-6 transition-all hover:-translate-y-1"
              >
                <div className="w-12 h-12 rounded-xl bg-green-500/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Ticket className="w-6 h-6 text-green-400" />
                </div>
                <div>
                  <div className="text-white font-black">Join a League</div>
                  <div className="text-gray-500 text-sm mt-0.5">Enter your invite code</div>
                </div>
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* ── League cards ── */}
      {leagues.length > 0 && (
        <div className="grid gap-4 sm:gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {leagues.map(league => {
            const isComm = league.commissioner_id === user?.id;
            const statusLabel = league.draft_status === 'completed' ? 'Season Active' : 'Draft Pending';
            const statusColor = league.draft_status === 'completed' ? 'text-green-400' : 'text-blue-400';
            const statusDot   = league.draft_status === 'completed' ? 'bg-green-400' : 'bg-blue-400';

            return (
              <Link
                key={league.id}
                to={`/golf/league/${league.id}`}
                className="group relative flex flex-col rounded-2xl border border-gray-800 bg-gray-900 overflow-hidden transition-all hover:-translate-y-1 hover:border-green-500/40 hover:shadow-xl hover:shadow-green-500/10"
              >
                <div className="h-1 w-full bg-green-500" />
                <div className="p-5 flex flex-col flex-1 gap-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-lg font-black text-white leading-tight truncate">{league.name}</div>
                      <div className="flex items-center gap-1.5 mt-1.5">
                        <span className={`w-1.5 h-1.5 rounded-full ${statusDot} animate-pulse shrink-0`} />
                        <span className={`text-xs font-bold ${statusColor}`}>{statusLabel}</span>
                        {isComm && (
                          <span className="text-[10px] font-bold text-green-400 bg-green-500/15 border border-green-500/25 px-1.5 py-0.5 rounded-full ml-1">COMM</span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="bg-gray-800/60 rounded-xl px-3 py-2.5">
                      <div className="text-gray-500 text-[10px] uppercase tracking-wide mb-0.5">Your Team</div>
                      <div className="text-white text-sm font-semibold truncate">{league.team_name || '—'}</div>
                    </div>
                    <div className="bg-gray-800/60 rounded-xl px-3 py-2.5">
                      <div className="flex items-center gap-1 text-gray-500 text-[10px] uppercase tracking-wide mb-0.5">
                        <Users className="w-3 h-3" /> Members
                      </div>
                      <div className="text-white text-sm font-semibold">{league.member_count}/{league.max_teams}</div>
                    </div>
                  </div>

                  <div className="mt-auto pt-1">
                    <div className="flex items-center justify-center gap-1.5 bg-gray-800/60 hover:bg-gray-800 border border-gray-700 hover:border-gray-500 text-gray-300 hover:text-white text-sm font-medium py-2 rounded-xl transition-all">
                      Enter League <ChevronRight className="w-4 h-4" />
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
