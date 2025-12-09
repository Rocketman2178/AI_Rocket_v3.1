import React from 'react';
import { CheckCircle, Rocket, Users, TrendingUp, Fuel, Zap, Compass, Trophy, Flame } from 'lucide-react';

interface LaunchProgressData {
  user_id: string;
  user_email: string;
  team_name: string;
  team_total_points: number;
  current_stage: 'fuel' | 'boosters' | 'guidance' | 'ready' | 'launched';
  total_points: number;
  is_launched: boolean;
  launched_at: string | null;
  daily_streak: number;
  last_active_date: string | null;
  fuel_level: number;
  fuel_points: number;
  boosters_level: number;
  boosters_points: number;
  guidance_level: number;
  guidance_points: number;
  total_level: number;
  max_level: number;
}

interface SetupProgressPanelProps {
  progressData: LaunchProgressData[];
  loading?: boolean;
}

export const SetupProgressPanel: React.FC<SetupProgressPanelProps> = ({ progressData, loading }) => {
  if (loading) {
    return (
      <div className="p-8 text-center">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
        <p className="mt-2 text-gray-400">Loading launch preparation progress...</p>
      </div>
    );
  }

  const totalUsers = progressData.length;
  const launchedUsers = progressData.filter(p => p.is_launched).length;
  const inProgressUsers = totalUsers - launchedUsers;

  const launchRate = totalUsers > 0 ? (launchedUsers / totalUsers) * 100 : 0;

  const avgTotalPoints = totalUsers > 0
    ? progressData.reduce((sum, p) => sum + p.total_points, 0) / totalUsers
    : 0;

  const avgLevelCompleted = totalUsers > 0
    ? progressData.reduce((sum, p) => sum + p.total_level, 0) / totalUsers
    : 0;

  // Calculate distribution by current stage
  const stageDistribution = [
    { stage: 'fuel', name: 'Fuel', count: progressData.filter(p => p.current_stage === 'fuel').length, color: 'orange' },
    { stage: 'boosters', name: 'Boosters', count: progressData.filter(p => p.current_stage === 'boosters').length, color: 'cyan' },
    { stage: 'guidance', name: 'Guidance', count: progressData.filter(p => p.current_stage === 'guidance').length, color: 'purple' },
    { stage: 'ready', name: 'Ready', count: progressData.filter(p => p.current_stage === 'ready').length, color: 'green' },
    { stage: 'launched', name: 'Launched', count: progressData.filter(p => p.current_stage === 'launched').length, color: 'blue' },
  ];

  // Calculate average level per stage
  const fuelAvg = totalUsers > 0
    ? progressData.reduce((sum, p) => sum + p.fuel_level, 0) / totalUsers
    : 0;

  const boostersAvg = totalUsers > 0
    ? progressData.reduce((sum, p) => sum + p.boosters_level, 0) / totalUsers
    : 0;

  const guidanceAvg = totalUsers > 0
    ? progressData.reduce((sum, p) => sum + p.guidance_level, 0) / totalUsers
    : 0;

  // Calculate total team points
  const totalTeamPoints = progressData.reduce((sum, p) => sum + p.team_total_points, 0);

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-blue-500/10 to-blue-600/10 border border-blue-500/20 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-400">Total Users</p>
              <p className="text-3xl font-bold text-white">{totalUsers}</p>
            </div>
            <Users className="w-8 h-8 text-blue-400" />
          </div>
        </div>

        <div className="bg-gradient-to-br from-green-500/10 to-green-600/10 border border-green-500/20 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-400">Launched</p>
              <p className="text-3xl font-bold text-white">{launchedUsers}</p>
              <p className="text-xs text-green-400">{launchRate.toFixed(1)}% launch rate</p>
            </div>
            <Rocket className="w-8 h-8 text-green-400" />
          </div>
        </div>

        <div className="bg-gradient-to-br from-yellow-500/10 to-yellow-600/10 border border-yellow-500/20 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-400">In Progress</p>
              <p className="text-3xl font-bold text-white">{inProgressUsers}</p>
              <p className="text-xs text-yellow-400">Avg {avgLevelCompleted.toFixed(1)}/15 levels</p>
            </div>
            <TrendingUp className="w-8 h-8 text-yellow-400" />
          </div>
        </div>

        <div className="bg-gradient-to-br from-purple-500/10 to-purple-600/10 border border-purple-500/20 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-400">Total Points</p>
              <p className="text-3xl font-bold text-white">{totalTeamPoints.toLocaleString()}</p>
              <p className="text-xs text-purple-400">Across all teams</p>
            </div>
            <Trophy className="w-8 h-8 text-purple-400" />
          </div>
        </div>
      </div>

      {/* Current Stage Distribution */}
      <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-blue-400" />
          Users by Current Stage
        </h3>
        <div className="space-y-3">
          {stageDistribution.map((item, index) => (
            <div key={index} className="flex items-center gap-3">
              <div className="w-24 text-sm text-gray-400 flex-shrink-0 capitalize">
                {item.name}
              </div>
              <div className="flex-1 bg-gray-700 rounded-full h-6 overflow-hidden">
                <div
                  className={`
                    h-full flex items-center justify-center text-xs font-medium text-white transition-all
                    ${item.color === 'orange' ? 'bg-gradient-to-r from-orange-500 to-orange-600' : ''}
                    ${item.color === 'cyan' ? 'bg-gradient-to-r from-cyan-500 to-cyan-600' : ''}
                    ${item.color === 'purple' ? 'bg-gradient-to-r from-purple-500 to-purple-600' : ''}
                    ${item.color === 'green' ? 'bg-gradient-to-r from-green-500 to-green-600' : ''}
                    ${item.color === 'blue' ? 'bg-gradient-to-r from-blue-500 to-blue-600' : ''}
                  `}
                  style={{ width: `${totalUsers > 0 ? (item.count / totalUsers) * 100 : 0}%`, minWidth: item.count > 0 ? '30px' : '0' }}
                >
                  {item.count > 0 && item.count}
                </div>
              </div>
              <div className="w-16 text-sm text-gray-300 text-right">
                {totalUsers > 0 ? ((item.count / totalUsers) * 100).toFixed(1) : 0}%
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Average Stage Levels */}
      <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <Flame className="w-5 h-5 text-orange-400" />
          Average Stage Progress (Max Level: 5)
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-orange-500/10 border border-orange-500/20 rounded-lg p-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 bg-orange-500/20 rounded-lg flex items-center justify-center">
                <Fuel className="w-5 h-5 text-orange-400" />
              </div>
              <div>
                <p className="text-sm text-gray-400">Fuel Stage</p>
                <p className="text-2xl font-bold text-white">{fuelAvg.toFixed(1)}/5</p>
              </div>
            </div>
            <div className="w-full bg-gray-700 rounded-full h-2">
              <div
                className="bg-gradient-to-r from-orange-500 to-orange-400 h-full rounded-full transition-all"
                style={{ width: `${(fuelAvg / 5) * 100}%` }}
              />
            </div>
          </div>

          <div className="bg-cyan-500/10 border border-cyan-500/20 rounded-lg p-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 bg-cyan-500/20 rounded-lg flex items-center justify-center">
                <Zap className="w-5 h-5 text-cyan-400" />
              </div>
              <div>
                <p className="text-sm text-gray-400">Boosters Stage</p>
                <p className="text-2xl font-bold text-white">{boostersAvg.toFixed(1)}/5</p>
              </div>
            </div>
            <div className="w-full bg-gray-700 rounded-full h-2">
              <div
                className="bg-gradient-to-r from-cyan-500 to-cyan-400 h-full rounded-full transition-all"
                style={{ width: `${(boostersAvg / 5) * 100}%` }}
              />
            </div>
          </div>

          <div className="bg-purple-500/10 border border-purple-500/20 rounded-lg p-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 bg-purple-500/20 rounded-lg flex items-center justify-center">
                <Compass className="w-5 h-5 text-purple-400" />
              </div>
              <div>
                <p className="text-sm text-gray-400">Guidance Stage</p>
                <p className="text-2xl font-bold text-white">{guidanceAvg.toFixed(1)}/5</p>
              </div>
            </div>
            <div className="w-full bg-gray-700 rounded-full h-2">
              <div
                className="bg-gradient-to-r from-purple-500 to-purple-400 h-full rounded-full transition-all"
                style={{ width: `${(guidanceAvg / 5) * 100}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* User Details Table */}
      <div className="bg-gray-800/50 border border-gray-700 rounded-lg overflow-hidden">
        <div className="p-4 border-b border-gray-700">
          <h3 className="text-lg font-semibold text-white">User Progress Details</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-900/50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">User</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Team</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-400 uppercase">Current Stage</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-400 uppercase">Fuel</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-400 uppercase">Boosters</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-400 uppercase">Guidance</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-400 uppercase">Total Points</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-400 uppercase">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700">
              {progressData.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-gray-400">
                    No launch preparation data available
                  </td>
                </tr>
              ) : (
                progressData.map((user) => {
                  return (
                    <tr key={user.user_id} className="hover:bg-gray-700/30 transition-colors">
                      <td className="px-4 py-3 text-sm text-white">{user.user_email}</td>
                      <td className="px-4 py-3 text-sm text-gray-400">{user.team_name}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`
                          inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium capitalize
                          ${user.current_stage === 'fuel' ? 'bg-orange-500/20 text-orange-400' : ''}
                          ${user.current_stage === 'boosters' ? 'bg-cyan-500/20 text-cyan-400' : ''}
                          ${user.current_stage === 'guidance' ? 'bg-purple-500/20 text-purple-400' : ''}
                          ${user.current_stage === 'ready' ? 'bg-green-500/20 text-green-400' : ''}
                          ${user.current_stage === 'launched' ? 'bg-blue-500/20 text-blue-400' : ''}
                        `}>
                          {user.current_stage}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="text-sm text-white">{user.fuel_level}/5</span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="text-sm text-white">{user.boosters_level}/5</span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="text-sm text-white">{user.guidance_level}/5</span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="text-sm font-semibold text-yellow-400">{user.total_points}</span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        {user.is_launched ? (
                          <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-500/20 text-green-400 rounded text-xs font-medium">
                            <CheckCircle className="w-3 h-3" />
                            Launched
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-1 bg-yellow-500/20 text-yellow-400 rounded text-xs font-medium">
                            <TrendingUp className="w-3 h-3" />
                            In Progress
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
