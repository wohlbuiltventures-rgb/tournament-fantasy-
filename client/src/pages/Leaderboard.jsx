import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../api';
import { useAuth } from '../contexts/AuthContext';
import TeamAvatar from '../components/TeamAvatar';
import { useDocTitle } from '../hooks/useDocTitle';

function fmt(n) {
  if (!n && n !== 0) return '$0';
  return '$' + Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    .replace(/\.00$/, '');
}

export default function Leaderboard() {
  const { id: leagueId } = useParams();
  const { user } = useAuth();
  const [standings, setStandings] = useState([]);
  const [settings, setSettings] = useState(null);
  const [league, setLeague] = useState(null);
  const [members, setMembers] = useState([]);
  useDocTitle(league ? `${league.name} Standings | TourneyRun` : 'Standings | TourneyRun');
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [standingsRes, leagueRes] = await Promise.all([
          api.get(`/scores/league/${leagueId}/standings`),
          api.get(`/leagues/${leagueId}`),
        ]);
        setStandings(standingsRes.data.standings);
        setSettings(standingsRes.data.settings);
        setLeague(leagueRes.data.league);
        setMembers(leagueRes.data.members || []);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [leagueId]);

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12">
        <div className="animate-pulse space-y-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-20 bg-gray-800 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  // ── Prize pool calculations ──────────────────────────────────────────────
  const buyIn       = parseFloat(league?.buy_in_amount) || 0;
  const managerCount = members.length;
  const prizePool   = buyIn * managerCount;
  const pct1        = parseFloat(league?.payout_first)  || 0;
  const pct2        = parseFloat(league?.payout_second) || 0;
  const pct3        = parseFloat(league?.payout_third)  || 0;
  const bonus       = parseFloat(league?.payout_bonus)  || 0;
  const pay1        = prizePool * (pct1 / 100);
  const pay2        = prizePool * (pct2 / 100);
  const pay3        = prizePool * (pct3 / 100);
  const hasPrizePool = buyIn > 0 && managerCount > 0;

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold text-white">🏆 Leaderboard</h1>
          {league && <p className="text-gray-400 mt-1">{league.name}</p>}
        </div>
        <Link to={`/league/${leagueId}`} className="text-gray-400 hover:text-white text-sm transition-colors">
          ← Back to League
        </Link>
      </div>

      {/* Prize pool banner */}
      {hasPrizePool && (
        <div className="card p-5 mb-6 bg-gradient-to-br from-yellow-500/8 to-transparent border-yellow-500/20">
          <div className="flex items-center justify-between flex-wrap gap-4">
            {/* Total pool */}
            <div>
              <div className="text-gray-400 text-xs uppercase tracking-wider mb-1">Total Prize Pool</div>
              <div className="text-3xl font-black text-yellow-400">{fmt(prizePool)}</div>
              <div className="text-gray-500 text-xs mt-0.5">
                {fmt(buyIn)} buy-in × {managerCount} team{managerCount !== 1 ? 's' : ''}
              </div>
            </div>

            {/* Payout breakdown */}
            <div className="flex items-center gap-4 flex-wrap">
              {pct1 > 0 && (
                <div className="text-center">
                  <div className="text-lg mb-0.5">🥇</div>
                  <div className="text-white font-bold text-lg">{fmt(pay1)}</div>
                  <div className="text-gray-500 text-xs">{pct1}%</div>
                </div>
              )}
              {pct2 > 0 && (
                <div className="text-center">
                  <div className="text-lg mb-0.5">🥈</div>
                  <div className="text-white font-bold text-lg">{fmt(pay2)}</div>
                  <div className="text-gray-500 text-xs">{pct2}%</div>
                </div>
              )}
              {pct3 > 0 && (
                <div className="text-center">
                  <div className="text-lg mb-0.5">🥉</div>
                  <div className="text-white font-bold text-lg">{fmt(pay3)}</div>
                  <div className="text-gray-500 text-xs">{pct3}%</div>
                </div>
              )}
              {bonus > 0 && (
                <div className="text-center">
                  <div className="text-lg mb-0.5">⚡</div>
                  <div className="text-white font-bold text-lg">{fmt(bonus)}</div>
                  <div className="text-gray-500 text-xs">Bonus</div>
                </div>
              )}
            </div>
          </div>

          {/* Payment instructions */}
          {league.payment_instructions && (
            <div className="mt-3 pt-3 border-t border-gray-800 flex items-center gap-2 text-sm">
              <span className="text-gray-500 text-xs">Pay via:</span>
              <span className="text-green-400 font-medium text-xs">{league.payment_instructions}</span>
            </div>
          )}
        </div>
      )}

      {standings.length === 0 ? (
        <div className="card p-12 text-center text-gray-400">
          <div className="text-4xl mb-3">📊</div>
          <p>No standings yet. Stats will appear here once games are played.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {standings.map((team, i) => (
            <div
              key={team.user_id}
              className={`card overflow-hidden transition-all duration-200 ${
                team.user_id === user?.id ? 'border-brand-500/40' : ''
              }`}
            >
              {/* Team row */}
              <button
                className="w-full text-left px-5 py-4 hover:bg-gray-800/50 transition-colors"
                onClick={() => setExpanded(expanded === team.user_id ? null : team.user_id)}
              >
                <div className="flex items-center gap-4">
                  {/* Rank */}
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0 ${
                    i === 0 ? 'bg-yellow-500/20 text-yellow-400 text-lg' :
                    i === 1 ? 'bg-gray-400/20 text-gray-300' :
                    i === 2 ? 'bg-slate-700/40 text-slate-300' :
                    'bg-gray-800 text-gray-500'
                  }`}>
                    {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : i + 1}
                  </div>

                  {/* Team info */}
                  <div className="flex items-center gap-2.5 flex-1 min-w-0">
                    <TeamAvatar avatarUrl={team.avatar_url} teamName={team.team_name} size="sm" />
                    <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`font-bold text-base ${team.user_id === user?.id ? 'text-brand-400' : 'text-white'}`}>
                        {team.team_name}
                      </span>
                      {team.user_id === user?.id && (
                        <span className="text-xs bg-brand-500/20 text-brand-400 border border-brand-500/30 px-1.5 py-0.5 rounded-full">You</span>
                      )}
                    </div>
                    <div className="text-gray-500 text-sm">{team.username}</div>
                    </div>
                  </div>

                  {/* Points + Players Remaining + expand arrow */}
                  <div className="flex items-center gap-3">
                    {team.players && team.players.length > 0 && (
                      <div className="text-right hidden sm:block">
                        <div className="text-white font-bold text-sm">{team.players.filter(p => !p.is_eliminated).length}</div>
                        <div className="text-gray-500 text-xs">alive</div>
                      </div>
                    )}
                    <div className="text-right">
                      <div className="text-brand-400 font-bold text-xl">{team.total_points}</div>
                      <div className="text-gray-500 text-xs">pts</div>
                    </div>
                    <svg
                      className={`w-4 h-4 text-gray-500 transition-transform duration-200 ${expanded === team.user_id ? 'rotate-180' : ''}`}
                      fill="none" stroke="currentColor" viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>

                {/* Player preview */}
                {team.players && team.players.length > 0 && expanded !== team.user_id && (
                  <div className="mt-2 flex flex-wrap gap-1 ml-14">
                    {team.players.slice(0, 4).map(p => (
                      <span
                        key={p.player_id}
                        className={`text-xs px-2 py-0.5 rounded-full border ${
                          p.is_eliminated
                            ? 'bg-gray-800/50 text-gray-600 border-gray-700 line-through'
                            : 'bg-gray-800 text-gray-400 border-gray-700'
                        }`}
                      >
                        {p.name}
                      </span>
                    ))}
                    {team.players.length > 4 && (
                      <span className="text-xs text-gray-500">+{team.players.length - 4} more</span>
                    )}
                  </div>
                )}
              </button>

              {/* Expanded roster */}
              {expanded === team.user_id && team.players && team.players.length > 0 && (
                <div className="border-t border-gray-800 bg-gray-900/30">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-800">
                        <th className="text-left px-5 py-2 text-gray-400 font-medium">Player</th>
                        <th className="text-left px-3 py-2 text-gray-400 font-medium hidden sm:table-cell">Team</th>
                        <th className="text-right px-5 py-2 text-gray-400 font-medium">PTS</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-800/50">
                      {team.players
                        .sort((a, b) => b.fantasy_points - a.fantasy_points)
                        .map(player => (
                          <tr
                            key={player.player_id}
                            className={player.is_eliminated ? 'opacity-40' : ''}
                          >
                            <td className="px-5 py-2.5">
                              <div className="flex items-center gap-2">
                                <span className={`font-medium ${player.is_eliminated ? 'line-through text-gray-500' : 'text-white'}`}>
                                  {player.name}
                                </span>
                                {player.is_eliminated && (
                                  <span className="text-xs bg-red-900/40 text-red-400 px-1.5 py-0.5 rounded border border-red-500/30 font-bold">
                                    ELIM
                                  </span>
                                )}
                              </div>
                              <div className="text-gray-500 text-xs">{player.position}</div>
                            </td>
                            <td className="px-3 py-2.5 text-gray-400 text-xs hidden sm:table-cell">{player.team}</td>
                            <td className="px-5 py-2.5 text-right">
                              <span className={`font-bold ${player.fantasy_points > 0 ? 'text-brand-400' : 'text-gray-500'}`}>
                                {player.fantasy_points}
                              </span>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t border-gray-700">
                        <td colSpan={2} className="px-5 py-2 text-right text-gray-400 font-medium text-sm">Total</td>
                        <td className="px-5 py-2 text-right text-brand-400 font-bold">{team.total_points}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {settings && (
        <div className="card p-4 mt-6 flex items-center gap-3 text-sm">
          <span className="text-gray-400">Scoring:</span>
          <span className="bg-gray-800 px-2.5 py-1 rounded-full text-xs">
            <span className="text-gray-400">PTS: </span>
            <span className="font-bold text-brand-400">+{settings.pts_per_point} fantasy pt each</span>
          </span>
        </div>
      )}
    </div>
  );
}
