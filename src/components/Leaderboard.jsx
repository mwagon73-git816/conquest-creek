import React, { useState } from 'react';
import { Trophy, ChevronUp, ChevronDown } from 'lucide-react';
import MatchPhotos from './MatchPhotos';
import { formatNTRP } from '../utils/formatters';
import TeamLogo from './TeamLogo';

const Leaderboard = ({ teams, getLeaderboard, photos, isAuthenticated, onDeletePhoto }) => {
  const [sortColumn, setSortColumn] = useState('totalPoints');
  const [sortDirection, setSortDirection] = useState('desc');

  // Get leaderboard data with official ranks assigned
  const getLeaderboardWithRanks = () => {
    const leaderboard = getLeaderboard(); // Already sorted by totalPoints
    return leaderboard.map((team, index) => ({
      ...team,
      officialRank: index + 1
    }));
  };

  // Calculate win percentage for a team
  const calculateWinPercentage = (team) => {
    const totalGames = team.matchWins + team.matchLosses;
    if (totalGames === 0) return 0;
    return (team.matchWins / totalGames) * 100;
  };

  // Format win percentage for display
  const formatWinPercentage = (team) => {
    const totalGames = team.matchWins + team.matchLosses;
    if (totalGames === 0) return '---';
    const percentage = calculateWinPercentage(team);
    return `${percentage.toFixed(1)}%`;
  };

  // Sort the display based on current sort column/direction
  const getSortedLeaderboard = () => {
    const leaderboardWithRanks = getLeaderboardWithRanks();

    const sorted = [...leaderboardWithRanks].sort((a, b) => {
      let aValue, bValue;

      switch (sortColumn) {
        case 'team':
          aValue = a.name.toLowerCase();
          bValue = b.name.toLowerCase();
          break;
        case 'matches':
          aValue = a.matchesPlayed;
          bValue = b.matchesPlayed;
          break;
        case 'wins':
          aValue = a.matchWins;
          bValue = b.matchWins;
          break;
        case 'winPct':
          aValue = calculateWinPercentage(a);
          bValue = calculateWinPercentage(b);
          break;
        case 'winPoints':
          aValue = a.matchWinPoints;
          bValue = b.matchWinPoints;
          break;
        case 'totalBonus':
          aValue = a.bonusPoints || 0;
          bValue = b.bonusPoints || 0;
          break;
        case 'bonusApplied':
          aValue = a.cappedBonus || 0;
          bValue = b.cappedBonus || 0;
          break;
        case 'unusedBonus':
          aValue = (a.bonusPoints || 0) - (a.cappedBonus || 0);
          bValue = (b.bonusPoints || 0) - (b.cappedBonus || 0);
          break;
        case 'penalty':
          aValue = a.penalty || 0;
          bValue = b.penalty || 0;
          break;
        case 'totalPoints':
          aValue = a.totalPoints;
          bValue = b.totalPoints;
          break;
        case 'sets':
          aValue = a.setsWon;
          bValue = b.setsWon;
          break;
        case 'games':
          aValue = a.gamesWon;
          bValue = b.gamesWon;
          break;
        default:
          return 0;
      }

      if (sortColumn === 'team') {
        // String comparison
        if (sortDirection === 'asc') {
          return aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
        } else {
          return aValue > bValue ? -1 : aValue < bValue ? 1 : 0;
        }
      } else {
        // Numeric comparison
        if (sortDirection === 'asc') {
          return aValue - bValue;
        } else {
          return bValue - aValue;
        }
      }
    });

    return sorted;
  };

  // Handle column header click
  const handleSort = (column) => {
    if (sortColumn === column) {
      // Toggle direction
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      // New column - set default direction
      setSortColumn(column);
      if (column === 'team') {
        setSortDirection('asc'); // A-Z for team names
      } else {
        setSortDirection('desc'); // High to low for numbers
      }
    }
  };

  // Render sortable header
  const SortableHeader = ({ column, label, align = 'center' }) => {
    const isActive = sortColumn === column;
    const alignClass = align === 'left' ? 'text-left' : 'text-center';

    return (
      <th
        className={`${alignClass} p-2 cursor-pointer hover:bg-gray-100 select-none transition-colors ${
          isActive ? 'bg-blue-50 text-blue-700' : ''
        }`}
        onClick={() => handleSort(column)}
      >
        <div className={`flex items-center gap-1 ${align === 'center' ? 'justify-center' : ''}`}>
          <span>{label}</span>
          {isActive && (
            sortDirection === 'asc' ?
              <ChevronUp className="w-4 h-4" /> :
              <ChevronDown className="w-4 h-4" />
          )}
        </div>
      </th>
    );
  };

  const sortedLeaderboard = getSortedLeaderboard();

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
              <SortableHeader column="team" label="Team" align="left" />
              <SortableHeader column="matches" label="Matches" />
              <SortableHeader column="wins" label="W-L" />
              <SortableHeader column="winPct" label="Win Pct" />
              <SortableHeader column="winPoints" label="Win Pts" />
              <SortableHeader column="totalBonus" label="Total Bonus" />
              <SortableHeader column="bonusApplied" label="Bonus Applied" />
              <SortableHeader column="unusedBonus" label="Unused Bonus" />
              <SortableHeader column="penalty" label="Penalty" />
              <SortableHeader column="totalPoints" label="Total Pts" />
              <SortableHeader column="sets" label="Sets" />
              <SortableHeader column="games" label="Games" />
            </tr>
          </thead>
          <tbody>
            {sortedLeaderboard.map((team) => (
              <tr key={team.id} className={team.officialRank <= 2 ? 'border-b bg-yellow-50' : 'border-b'}>
                <td className="p-2 font-bold">
                  {team.officialRank}
                  {team.officialRank <= 2 && <Trophy className="inline w-4 h-4 ml-1 text-yellow-500" />}
                </td>
                <td className="p-2">
                  <div className="flex items-center gap-2">
                    <TeamLogo team={team} size="sm" showBorder={!!team.logo} />
                    <span className="font-semibold">{team.name}</span>
                  </div>
                </td>
                <td className="text-center p-2">{team.matchesPlayed}</td>
                <td className="text-center p-2">{team.matchWins}-{team.matchLosses}</td>
                <td className="text-center p-2 font-semibold text-blue-700">{formatWinPercentage(team)}</td>
                <td className="text-center p-2 font-semibold">{team.matchWinPoints}</td>
                <td className="text-center p-2 text-sm font-semibold text-purple-700">
                  {formatNTRP(team.bonusPoints || 0)}
                </td>
                <td className="text-center p-2 text-sm font-semibold text-green-700">
                  {formatNTRP(team.cappedBonus || 0)}
                </td>
                <td className="text-center p-2 text-sm font-semibold text-orange-600">
                  {formatNTRP((team.bonusPoints || 0) - (team.cappedBonus || 0))}
                </td>
                <td className="text-center p-2 text-sm font-semibold text-red-600">
                  {team.penalty || 0}
                </td>
                <td className="text-center p-2 font-bold text-lg text-blue-600">{formatNTRP(team.totalPoints)}</td>
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