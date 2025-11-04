import React, { useState } from 'react';
import { TrendingUp, Edit, Trash2, ChevronDown, ChevronUp, Filter } from 'lucide-react';
import { formatNTRP, formatDynamic } from '../utils/formatters';
import TeamLogo from './TeamLogo';

const MatchHistory = ({ matches, setMatches, teams, isAuthenticated, setActiveTab, players, userRole, userTeamId, setEditingMatch }) => {
  const [showFilters, setShowFilters] = useState(false);
  const [selectedTeams, setSelectedTeams] = useState([]);
  const [selectedPlayers, setSelectedPlayers] = useState([]);
  const handleEditMatch = (match) => {
    // Pass the match data to MatchEntry for editing
    setEditingMatch(match);
    setActiveTab('entry');
  };

  const handleDeleteMatch = (matchId) => {
    if (confirm('Delete this match?')) {
      setMatches(matches.filter(m => m.id !== matchId));
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      month: '2-digit', 
      day: '2-digit', 
      year: 'numeric' 
    });
  };

  const getPlayerName = (playerId) => {
    const player = players.find(p => p.id === playerId);
    if (!player) return 'Unknown Player';
    return `${player.firstName} ${player.lastName}`;
  };

  const formatSetScores = (match) => {
    const setScores = [];

    // Add Set 1
    if (match.set1Team1 !== undefined && match.set1Team2 !== undefined) {
      setScores.push(`${match.set1Team1}-${match.set1Team2}`);
    }

    // Add Set 2
    if (match.set2Team1 !== undefined && match.set2Team2 !== undefined) {
      setScores.push(`${match.set2Team1}-${match.set2Team2}`);
    }

    // Add Set 3 with tiebreaker notation if applicable
    if (match.set3Team1 !== undefined && match.set3Team2 !== undefined &&
        (match.set3Team1 !== '' || match.set3Team2 !== '')) {
      const set3Score = `${match.set3Team1}-${match.set3Team2}`;
      const tbNotation = match.set3IsTiebreaker ? ' TB' : '';
      setScores.push(set3Score + tbNotation);
    }

    // If no individual set scores available, fall back to old format
    if (setScores.length === 0) {
      return `${match.team1Sets}-${match.team2Sets} sets • ${match.team1Games}-${match.team2Games} games`;
    }

    return `(${setScores.join(', ')})`;
  };

  const handleTeamToggle = (teamId) => {
    if (selectedTeams.includes(teamId)) {
      setSelectedTeams(selectedTeams.filter(id => id !== teamId));
    } else {
      setSelectedTeams([...selectedTeams, teamId]);
    }
  };

  const handlePlayerToggle = (playerId) => {
    if (selectedPlayers.includes(playerId)) {
      setSelectedPlayers(selectedPlayers.filter(id => id !== playerId));
    } else {
      setSelectedPlayers([...selectedPlayers, playerId]);
    }
  };

  const handleClearFilters = () => {
    setSelectedTeams([]);
    setSelectedPlayers([]);
  };

  const hasActiveFilters = selectedTeams.length > 0 || selectedPlayers.length > 0;

  // Sort matches by date (newest first), then by timestamp if available
  const sortedMatches = [...matches].sort((a, b) => {
    const dateA = new Date(a.date);
    const dateB = new Date(b.date);
    
    // If dates are different, sort by date
    if (dateA.getTime() !== dateB.getTime()) {
      return dateB.getTime() - dateA.getTime(); // Newest first
    }
    
    // If dates are the same, sort by timestamp if available
    if (a.timestamp && b.timestamp) {
      return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
    }
    
    return 0;
  });

  // Apply filters
  const filteredMatches = sortedMatches.filter(match => {
    // Captain restriction: only show matches involving their team
    if (userRole === 'captain' && userTeamId) {
      const captainTeamInvolved = match.team1Id === userTeamId || match.team2Id === userTeamId;
      if (!captainTeamInvolved) return false;
    }

    // Team filter
    if (selectedTeams.length > 0) {
      const matchHasSelectedTeam = selectedTeams.includes(match.team1Id) ||
                                   selectedTeams.includes(match.team2Id);
      if (!matchHasSelectedTeam) return false;
    }

    // Player filter
    if (selectedPlayers.length > 0) {
      const matchPlayers = [
        ...(match.team1Players || []),
        ...(match.team2Players || [])
      ];
      const matchHasSelectedPlayer = selectedPlayers.some(playerId =>
        matchPlayers.includes(playerId)
      );
      if (!matchHasSelectedPlayer) return false;
    }

    return true;
  });

  const totalMatches = matches.length;
  const displayedMatches = filteredMatches.length;

  // Check if user can edit/delete a match
  const canEditMatch = (match) => {
    if (userRole === 'director') return true;
    if (userRole === 'captain' && userTeamId) {
      // Captains can only edit matches involving their team
      return match.team1Id === userTeamId || match.team2Id === userTeamId;
    }
    return false;
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
        <TrendingUp className="w-6 h-6" />
        Recent Matches
      </h2>

      {/* Filters Section */}
      <div className="mb-4">
        <button
          onClick={() => setShowFilters(!showFilters)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-100 hover:bg-blue-200 text-blue-800 rounded-lg transition-colors"
        >
          <Filter className="w-4 h-4" />
          <span className="font-semibold">
            {showFilters ? 'Hide Filters' : 'Show Filters'}
          </span>
          {hasActiveFilters && (
            <span className="bg-blue-600 text-white text-xs px-2 py-1 rounded-full">
              {selectedTeams.length + selectedPlayers.length}
            </span>
          )}
          {showFilters ? (
            <ChevronUp className="w-4 h-4" />
          ) : (
            <ChevronDown className="w-4 h-4" />
          )}
        </button>

        {showFilters && (
          <div className="mt-3 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Team Filter */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-semibold text-gray-700">
                    Filter by Team
                  </label>
                  {selectedTeams.length > 0 && (
                    <span className="text-xs text-blue-600 font-medium">
                      {selectedTeams.length} selected
                    </span>
                  )}
                </div>
                <div className="bg-white border border-blue-200 rounded p-3 max-h-48 overflow-y-auto">
                  {teams.length === 0 ? (
                    <p className="text-sm text-gray-500">No teams available</p>
                  ) : (
                    <div className="space-y-2">
                      {teams.map(team => (
                        <label
                          key={team.id}
                          className="flex items-center gap-2 cursor-pointer hover:bg-blue-50 p-1 rounded"
                        >
                          <input
                            type="checkbox"
                            checked={selectedTeams.includes(team.id)}
                            onChange={() => handleTeamToggle(team.id)}
                            className="w-4 h-4 text-blue-600"
                          />
                          <TeamLogo team={team} size="sm" showBorder={!!team.logo} />
                          <span className="text-sm">{team.name}</span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Player Filter */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-semibold text-gray-700">
                    Filter by Player
                  </label>
                  {selectedPlayers.length > 0 && (
                    <span className="text-xs text-blue-600 font-medium">
                      {selectedPlayers.length} selected
                    </span>
                  )}
                </div>
                <div className="bg-white border border-blue-200 rounded p-3 max-h-48 overflow-y-auto">
                  {!players || players.length === 0 ? (
                    <p className="text-sm text-gray-500">No players available</p>
                  ) : (
                    <div className="space-y-2">
                      {players
                        .filter(p => p.status === 'active')
                        .sort((a, b) => {
                          const nameA = `${a.lastName} ${a.firstName}`.toLowerCase();
                          const nameB = `${b.lastName} ${b.firstName}`.toLowerCase();
                          return nameA.localeCompare(nameB);
                        })
                        .map(player => (
                          <label
                            key={player.id}
                            className="flex items-center gap-2 cursor-pointer hover:bg-blue-50 p-1 rounded"
                          >
                            <input
                              type="checkbox"
                              checked={selectedPlayers.includes(player.id)}
                              onChange={() => handlePlayerToggle(player.id)}
                              className="w-4 h-4 text-blue-600"
                            />
                            <span className="text-sm">
                              {player.lastName}, {player.firstName}
                              <span className="text-xs text-gray-500 ml-1">
                                ({player.gender} {player.dynamicRating ? formatDynamic(player.dynamicRating) : formatNTRP(player.ntrpRating)})
                              </span>
                            </span>
                          </label>
                        ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Clear Filters Button */}
            {hasActiveFilters && (
              <div className="mt-4 flex justify-end">
                <button
                  onClick={handleClearFilters}
                  className="px-4 py-2 bg-red-100 hover:bg-red-200 text-red-800 rounded-lg text-sm font-semibold transition-colors"
                >
                  Clear All Filters
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Match Count Display */}
      {hasActiveFilters && (
        <div className="mb-3 px-3 py-2 bg-blue-100 text-blue-800 rounded text-sm font-semibold">
          Showing {displayedMatches} of {totalMatches} matches
        </div>
      )}

      <div className="space-y-3">
        {matches.length === 0 ? (
          <p className="text-gray-500 text-center py-8">No matches recorded yet</p>
        ) : filteredMatches.length === 0 ? (
          <p className="text-gray-500 text-center py-8">
            No matches found matching the selected filters
          </p>
        ) : (
          filteredMatches.slice(0, 20).map(match => {
            const team1 = teams.find(t => t.id == match.team1Id);
            const team2 = teams.find(t => t.id == match.team2Id);
            
            return (
              <div key={match.id} className="border rounded p-3 hover:bg-gray-50">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      {match.winner === 'team1' ? (
                        <>
                          <TeamLogo team={team1} size="sm" showBorder={!!team1?.logo} />
                          <span className="font-bold text-green-600">
                            {team1 ? team1.name : 'Team ' + match.team1Id}
                          </span>
                          <span className="text-sm">def.</span>
                          <TeamLogo team={team2} size="sm" showBorder={!!team2?.logo} />
                          <span className="font-semibold">
                            {team2 ? team2.name : 'Team ' + match.team2Id}
                          </span>
                        </>
                      ) : (
                        <>
                          <TeamLogo team={team2} size="sm" showBorder={!!team2?.logo} />
                          <span className="font-bold text-green-600">
                            {team2 ? team2.name : 'Team ' + match.team2Id}
                          </span>
                          <span className="text-sm">def.</span>
                          <TeamLogo team={team1} size="sm" showBorder={!!team1?.logo} />
                          <span className="font-semibold">
                            {team1 ? team1.name : 'Team ' + match.team1Id}
                          </span>
                        </>
                      )}
                      <span className="font-semibold text-blue-600">
                        {formatSetScores(match)}
                      </span>
                    </div>
                    <div className="text-sm text-gray-600">
                      {formatDate(match.date)}
                      {match.notes && <span className="ml-2 italic">• {match.notes}</span>}
                    </div>

                    {/* Display Players */}
                    {((match.team1Players && match.team1Players.length > 0) || 
                      (match.team2Players && match.team2Players.length > 0)) && (
                      <div className="mt-2 text-xs">
                        {match.team1Players && match.team1Players.length > 0 && (
                          <div className="text-gray-500">
                            <span className="font-semibold">{team1 ? team1.name : 'Team 1'} Players:</span>{' '}
                            {match.team1Players.map((playerId, index) => (
                              <span key={playerId}>
                                {getPlayerName(playerId)}
                                {index < match.team1Players.length - 1 ? ', ' : ''}
                              </span>
                            ))}
                          </div>
                        )}
                        {match.team2Players && match.team2Players.length > 0 && (
                          <div className="text-gray-500">
                            <span className="font-semibold">{team2 ? team2.name : 'Team 2'} Players:</span>{' '}
                            {match.team2Players.map((playerId, index) => (
                              <span key={playerId}>
                                {getPlayerName(playerId)}
                                {index < match.team2Players.length - 1 ? ', ' : ''}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  {isAuthenticated && canEditMatch(match) && (
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleEditMatch(match)}
                        className="text-blue-600 hover:text-blue-800 p-1"
                        title="Edit match"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteMatch(match.id)}
                        className="text-red-600 hover:text-red-800 p-1"
                        title="Delete match"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default MatchHistory;