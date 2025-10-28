import React from 'react';
import { Trophy } from 'lucide-react';
import MatchPhotos from './MatchPhotos';

const Leaderboard = ({ teams, getLeaderboard, photos, isAuthenticated, onDeletePhoto }) => {
  return (
    <>
      {/* Match Photos Carousel */}
      <MatchPhotos
        photos={photos}
        teams={teams}
        isAuthenticated={isAuthenticated}
        onDeletePhoto={onDeletePhoto}
      />

      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
          <Trophy className="w-6 h-6 text-yellow-500" />
          Tournament Leaderboard
        </h2>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b-2">
              <th className="text-left p-2">Rank</th>
              <th className="text-left p-2">Team</th>
              <th className="text-center p-2">Matches</th>
              <th className="text-center p-2">Win Pts</th>
              <th className="text-center p-2">Bonus</th>
              <th className="text-center p-2">Total Pts</th>
              <th className="text-center p-2">Sets</th>
              <th className="text-center p-2">Games</th>
            </tr>
          </thead>
          <tbody>
            {getLeaderboard().map((team, index) => (
              <tr key={team.id} className={index < 2 ? 'border-b bg-yellow-50' : 'border-b'}>
                <td className="p-2 font-bold">
                  {index + 1}
                  {index < 2 && <Trophy className="inline w-4 h-4 ml-1 text-yellow-500" />}
                </td>
                <td className="p-2">
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded" style={{ backgroundColor: team.color }} />
                    <span className="font-semibold">{team.name}</span>
                  </div>
                </td>
                <td className="text-center p-2">{team.matchesPlayed}</td>
                <td className="text-center p-2 font-semibold">{team.matchWinPoints}</td>
                <td className="text-center p-2 text-sm">
                  {team.cappedBonus.toFixed(1)}
                  {team.bonusPoints > team.cappedBonus && (
                    <span className="text-red-500 text-xs ml-1">(capped)</span>
                  )}
                </td>
                <td className="text-center p-2 font-bold text-lg text-blue-600">{team.totalPoints.toFixed(1)}</td>
                <td className="text-center p-2 text-sm text-gray-600">{team.setsWon}</td>
                <td className="text-center p-2 text-sm text-gray-600">{team.gamesWon}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {teams.length === 0 && (
        <p className="text-center text-gray-500 py-8">No teams created yet. Directors can add teams in the Teams tab.</p>
      )}
      </div>
    </>
  );
};

export default Leaderboard;