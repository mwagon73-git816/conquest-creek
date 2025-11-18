import React, { useState } from 'react';
import { TrendingUp, Edit, Trash2, ChevronDown, ChevronUp, Filter, Clock, Calendar, Check, Edit2, X, AlertCircle } from 'lucide-react';
import { formatNTRP, formatDynamic, formatDate } from '../utils/formatters';
import { ACTION_TYPES, createLogEntry } from '../services/activityLogger';
import TeamLogo from './TeamLogo';

const MatchHistory = ({ matches, setMatches, teams, isAuthenticated, setActiveTab, players, userRole, userTeamId, setEditingMatch, challenges, onEnterPendingResults, onChallengesChange, addLog }) => {
  const [showFilters, setShowFilters] = useState(false);
  const [selectedTeams, setSelectedTeams] = useState([]);
  const [selectedPlayers, setSelectedPlayers] = useState([]);
  const [matchStatusFilter, setMatchStatusFilter] = useState('all'); // 'all', 'pending', 'completed'
  const [sortOrder, setSortOrder] = useState('newest'); // 'newest' or 'oldest'

  // Edit pending match states
  const [showEditPendingModal, setShowEditPendingModal] = useState(false);
  const [editingPendingMatch, setEditingPendingMatch] = useState(null);
  const [editPendingFormData, setEditPendingFormData] = useState({
    acceptedDate: '',
    acceptedLevel: '7.0',
    team1Players: [],
    team2Players: []
  });

  // Debug: Log component props on mount and when challenges change
  React.useEffect(() => {
    console.log('=== MATCH HISTORY COMPONENT ===');
    console.log('Props received:');
    console.log('  - matches:', matches?.length || 0);
    console.log('  - teams:', teams?.length || 0);
    console.log('  - players:', players?.length || 0);
    console.log('  - challenges:', challenges?.length || 0);
    console.log('  - challenges data:', challenges);
    console.log('  - isAuthenticated:', isAuthenticated);
    console.log('  - userRole:', userRole);
    console.log('  - userTeamId:', userTeamId);
    console.log('  - onEnterPendingResults:', typeof onEnterPendingResults);
    console.log('===============================');
  }, [challenges, matches, teams, players, isAuthenticated, userRole, userTeamId]);

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

  // Get pending matches (accepted challenges not yet completed)
  const getPendingMatches = () => {
    console.log('=== MATCH HISTORY: Get Pending Matches ===');
    console.log('Challenges prop:', challenges);
    console.log('Challenges type:', typeof challenges);
    console.log('Challenges is array?:', Array.isArray(challenges));

    if (!challenges) {
      console.log('⚠️ No challenges data available');
      return [];
    }

    const pending = challenges
      .filter(c => c.status === 'accepted')
      .sort((a, b) => {
        // Sort by scheduled date (acceptedDate), respecting sortOrder toggle
        const dateA = new Date(a.acceptedDate || a.acceptedAt || a.createdAt);
        const dateB = new Date(b.acceptedDate || b.acceptedAt || b.createdAt);

        // Respect the sortOrder state
        return sortOrder === 'newest'
          ? dateB - dateA  // Newest first
          : dateA - dateB; // Oldest first
      });

    console.log('Accepted challenges found:', pending.length);
    console.log('Accepted challenges:', pending);
    return pending;
  };

  // Get team name helper
  const getTeamName = (teamId) => {
    const team = teams.find(t => t.id === teamId);
    return team ? team.name : 'Unknown Team';
  };

  // Get player names from IDs
  const getPlayerNames = (playerIds) => {
    if (!playerIds || playerIds.length === 0) return [];
    return playerIds.map(id => {
      const player = players.find(p => p.id === id);
      return player ? {
        name: `${player.firstName} ${player.lastName}`,
        rating: player.ntrpRating,
        dynamicRating: player.dynamicRating,
        gender: player.gender
      } : null;
    }).filter(p => p !== null);
  };

  // Check if user can enter results for a pending match
  const canEnterResults = (pendingMatch) => {
    if (!isAuthenticated) return false;
    if (userRole === 'director') return true;
    if (userRole === 'captain' && userTeamId) {
      return pendingMatch.challengerTeamId === userTeamId ||
             pendingMatch.challengedTeamId === userTeamId;
    }
    return false;
  };

  // Check if user can edit a pending match
  const canEditPendingMatch = (pendingMatch) => {
    if (!isAuthenticated) return false;
    // Directors can edit any pending match
    if (userRole === 'director') return true;
    // Captains can edit pending matches their team is involved in
    if (userRole === 'captain' && userTeamId) {
      return pendingMatch.challengerTeamId === userTeamId || pendingMatch.challengedTeamId === userTeamId;
    }
    return false;
  };

  // Get team roster for player selection
  const getTeamRoster = (teamId) => {
    return players.filter(p => p.teamId === teamId && p.status === 'active');
  };

  // Calculate combined NTRP rating for selected players
  const calculateCombinedNTRP = (selectedPlayerIds) => {
    if (selectedPlayerIds.length !== 2) return 0;
    const player1 = players.find(p => p.id === selectedPlayerIds[0]);
    const player2 = players.find(p => p.id === selectedPlayerIds[1]);
    if (!player1 || !player2) return 0;
    return parseFloat(player1.ntrpRating) + parseFloat(player2.ntrpRating);
  };

  // Validation: exactly 2 players must be selected
  const validatePlayerSelection = (selectedPlayers) => {
    return selectedPlayers.length === 2;
  };

  // Validation: combined NTRP doesn't exceed match level
  const validateCombinedNTRP = (selectedPlayers, matchLevel) => {
    if (selectedPlayers.length !== 2) return false;
    const combinedRating = calculateCombinedNTRP(selectedPlayers);
    return combinedRating <= parseFloat(matchLevel);
  };

  // Handle edit pending match
  const handleEditPendingMatch = (pendingMatch) => {
    setEditingPendingMatch(pendingMatch);
    setEditPendingFormData({
      acceptedDate: pendingMatch.acceptedDate || '',
      acceptedLevel: pendingMatch.acceptedLevel || pendingMatch.proposedLevel,
      team1Players: pendingMatch.challengerPlayers || [],
      team2Players: pendingMatch.challengedPlayers || []
    });
    setShowEditPendingModal(true);
  };

  // Handle deleting a pending match (directors only)
  const handleDeletePendingMatch = (pendingMatch) => {
    if (userRole !== 'director') {
      alert('⚠️ Only tournament directors can delete pending matches.');
      return;
    }

    const team1 = teams.find(t => t.id === pendingMatch.challengerTeamId);
    const team2 = teams.find(t => t.id === pendingMatch.challengedTeamId);
    const team1Name = team1?.name || 'Unknown Team';
    const team2Name = team2?.name || 'Unknown Team';
    const matchDescription = `${team1Name} vs ${team2Name} (Level ${pendingMatch.acceptedLevel || pendingMatch.proposedLevel})`;

    if (!confirm(`Are you sure you want to delete this pending match?\n\n${matchDescription}\n\nThis action cannot be undone.`)) {
      return;
    }

    // Remove the challenge from the challenges array
    const updatedChallenges = challenges.filter(c => c.id !== pendingMatch.id);
    onChallengesChange(updatedChallenges);

    // Log the deletion
    addLog(
      ACTION_TYPES.PENDING_MATCH_DELETED,
      {
        matchDescription,
        team1Name,
        team2Name,
        challengerTeamId: pendingMatch.challengerTeamId,
        challengedTeamId: pendingMatch.challengedTeamId,
        level: pendingMatch.acceptedLevel || pendingMatch.proposedLevel,
        scheduledDate: pendingMatch.acceptedDate
      },
      pendingMatch.id,
      pendingMatch,
      null
    );

    alert('✅ Pending match deleted successfully.');
  };

  const handleConfirmEditPending = () => {
    // Validation
    if (!editPendingFormData.acceptedDate) {
      alert('⚠️ Please select a match date.');
      return;
    }

    if (!validatePlayerSelection(editPendingFormData.team1Players)) {
      alert('⚠️ Please select exactly 2 players for Team 1.');
      return;
    }

    if (!validatePlayerSelection(editPendingFormData.team2Players)) {
      alert('⚠️ Please select exactly 2 players for Team 2.');
      return;
    }

    if (!validateCombinedNTRP(editPendingFormData.team1Players, editPendingFormData.acceptedLevel)) {
      const combinedRating = calculateCombinedNTRP(editPendingFormData.team1Players);
      alert(`Team 1 combined NTRP rating (${combinedRating.toFixed(1)}) exceeds match level (${editPendingFormData.acceptedLevel}).`);
      return;
    }

    if (!validateCombinedNTRP(editPendingFormData.team2Players, editPendingFormData.acceptedLevel)) {
      const combinedRating = calculateCombinedNTRP(editPendingFormData.team2Players);
      alert(`Team 2 combined NTRP rating (${combinedRating.toFixed(1)}) exceeds match level (${editPendingFormData.acceptedLevel}).`);
      return;
    }

    // Track what changed for activity log
    const changes = [];
    if (editPendingFormData.acceptedDate !== editingPendingMatch.acceptedDate) {
      changes.push('date');
    }
    if (editPendingFormData.acceptedLevel !== (editingPendingMatch.acceptedLevel || editingPendingMatch.proposedLevel)) {
      changes.push('level');
    }
    if (JSON.stringify(editPendingFormData.team1Players.sort()) !== JSON.stringify((editingPendingMatch.challengerPlayers || []).sort())) {
      changes.push('team1 players');
    }
    if (JSON.stringify(editPendingFormData.team2Players.sort()) !== JSON.stringify((editingPendingMatch.challengedPlayers || []).sort())) {
      changes.push('team2 players');
    }

    // Update pending match (which is an accepted challenge)
    const updatedChallenge = {
      ...editingPendingMatch,
      acceptedDate: editPendingFormData.acceptedDate,
      acceptedLevel: editPendingFormData.acceptedLevel,
      challengerPlayers: editPendingFormData.team1Players,
      challengedPlayers: editPendingFormData.team2Players,
      challengedCombinedNTRP: calculateCombinedNTRP(editPendingFormData.team2Players),
      combinedNTRP: calculateCombinedNTRP(editPendingFormData.team1Players),
      lastEditedBy: userRole === 'director' ? 'Tournament Director' : 'Captain',
      lastEditedAt: new Date().toISOString()
    };

    const updatedChallenges = challenges.map(c =>
      c.id === editingPendingMatch.id ? updatedChallenge : c
    );

    onChallengesChange(updatedChallenges);

    // Log the edit activity
    if (addLog && changes.length > 0) {
      const team1Name = getTeamName(editingPendingMatch.challengerTeamId);
      const team2Name = getTeamName(editingPendingMatch.challengedTeamId);
      addLog(
        ACTION_TYPES.PENDING_MATCH_EDITED,
        {
          team1Name,
          team2Name,
          changesSummary: `Updated ${changes.join(', ')}`
        },
        editingPendingMatch.id,
        editingPendingMatch,
        updatedChallenge
      );
    }

    // Reset form
    setShowEditPendingModal(false);
    setEditingPendingMatch(null);
    setEditPendingFormData({
      acceptedDate: '',
      acceptedLevel: '7.0',
      team1Players: [],
      team2Players: []
    });

    alert('✅ Pending match updated successfully!\n\n⚠️ IMPORTANT: Click the "Save Data" button to save this to the database.');
  };

  // Sort matches by scheduled date (if available), then completion date, then by timestamp
  const sortedMatches = [...matches].sort((a, b) => {
    // Prioritize scheduled date (from challenges), fallback to completion date
    const dateA = new Date(a.scheduledDate || a.date);
    const dateB = new Date(b.scheduledDate || b.date);

    // If dates are different, sort by date
    if (dateA.getTime() !== dateB.getTime()) {
      return sortOrder === 'newest'
        ? dateB.getTime() - dateA.getTime() // Newest first
        : dateA.getTime() - dateB.getTime(); // Oldest first
    }

    // If dates are the same, sort by timestamp if available
    if (a.timestamp && b.timestamp) {
      return sortOrder === 'newest'
        ? new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        : new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
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

  // Get and filter pending matches
  const allPendingMatches = getPendingMatches();

  console.log('=== FILTERING PENDING MATCHES ===');
  console.log('All pending matches before filter:', allPendingMatches.length);
  console.log('User role:', userRole);
  console.log('User team ID:', userTeamId);

  const filteredPendingMatches = allPendingMatches.filter(challenge => {
    console.log('Checking challenge:', challenge.id);

    // Captain restriction: only show challenges involving their team
    if (userRole === 'captain' && userTeamId) {
      const captainTeamInvolved = challenge.challengerTeamId === userTeamId ||
                                   challenge.challengedTeamId === userTeamId;
      console.log('  Captain filter - Team involved?', captainTeamInvolved);
      if (!captainTeamInvolved) return false;
    }

    // Team filter
    if (selectedTeams.length > 0) {
      const challengeHasSelectedTeam = selectedTeams.includes(challenge.challengerTeamId) ||
                                       selectedTeams.includes(challenge.challengedTeamId);
      if (!challengeHasSelectedTeam) return false;
    }

    // Player filter
    if (selectedPlayers.length > 0) {
      const challengePlayers = [
        ...(challenge.challengerPlayers || []),
        ...(challenge.challengedPlayers || [])
      ];
      const challengeHasSelectedPlayer = selectedPlayers.some(playerId =>
        challengePlayers.includes(playerId)
      );
      if (!challengeHasSelectedPlayer) return false;
    }

    console.log('  Challenge passed all filters');
    return true;
  });

  console.log('Filtered pending matches count:', filteredPendingMatches.length);
  console.log('Filtered pending matches:', filteredPendingMatches);
  console.log('=================================');

  const totalMatches = matches.length;
  const totalPending = allPendingMatches.length;
  const displayedMatches = filteredMatches.length;
  const displayedPending = filteredPendingMatches.length;

  // Determine what to show based on status filter
  const showPending = matchStatusFilter === 'all' || matchStatusFilter === 'pending';
  const showCompleted = matchStatusFilter === 'all' || matchStatusFilter === 'completed';

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
        Matches
      </h2>

      {/* Status Filter and Sort Order */}
      <div className="mb-4 grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-2">Filter by Status:</label>
          <select
            value={matchStatusFilter}
            onChange={(e) => setMatchStatusFilter(e.target.value)}
            className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Matches</option>
            <option value="pending">Pending Only</option>
            <option value="completed">Completed Only</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Sort Order:</label>
          <select
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value)}
            className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="newest">Newest First</option>
            <option value="oldest">Oldest First</option>
          </select>
        </div>
      </div>

      {/* Team/Player Filters Section */}
      <div className="mb-4">
        <button
          onClick={() => setShowFilters(!showFilters)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-100 hover:bg-blue-200 text-blue-800 rounded-lg transition-colors"
        >
          <Filter className="w-4 h-4" />
          <span className="font-semibold">
            {showFilters ? 'Hide Filters' : 'Show Team/Player Filters'}
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
          {showPending && showCompleted && (
            <>Showing {displayedPending} pending + {displayedMatches} completed of {totalPending + totalMatches} total matches</>
          )}
          {showPending && !showCompleted && (
            <>Showing {displayedPending} of {totalPending} pending matches</>
          )}
          {!showPending && showCompleted && (
            <>Showing {displayedMatches} of {totalMatches} completed matches</>
          )}
        </div>
      )}

      {/* Pending Matches Section */}
      {(() => {
        console.log('=== RENDERING PENDING MATCHES SECTION ===');
        console.log('showPending:', showPending);
        console.log('filteredPendingMatches.length:', filteredPendingMatches.length);
        return null;
      })()}
      {showPending && (
        <section className="mb-8">
          <h3 className="text-xl font-bold mb-4 flex items-center gap-2 text-orange-700">
            <Clock className="w-5 h-5" />
            Pending Matches ({filteredPendingMatches.length})
          </h3>
          {filteredPendingMatches.length === 0 ? (
            <p className="text-gray-500 text-center py-6 bg-gray-50 rounded border border-gray-200">
              No pending matches
            </p>
          ) : (
            <div className="space-y-3">
              {filteredPendingMatches.map(challenge => {
                const team1 = teams.find(t => t.id === challenge.challengerTeamId);
                const team2 = teams.find(t => t.id === challenge.challengedTeamId);
                const team1Players = getPlayerNames(challenge.challengerPlayers);
                const team2Players = getPlayerNames(challenge.challengedPlayers);

                // Check if match is overdue (1 day past the scheduled date)
                const isOverdue = challenge.acceptedDate && (() => {
                  // Parse date as LOCAL time, not UTC (avoid timezone issues)
                  const [year, month, day] = challenge.acceptedDate.split('-').map(Number);
                  const scheduledDate = new Date(year, month - 1, day); // Month is 0-indexed

                  // Create a date for 1 day after scheduled date (local time)
                  const oneDayAfterScheduled = new Date(year, month - 1, day + 1);

                  // Get today's date at midnight (local time)
                  const today = new Date();
                  today.setHours(0, 0, 0, 0);

                  // Debug logging
                  if (challenge.matchId === 'MATCH-2025-004') {
                    console.log('🔍 Overdue Check for MATCH-2025-004:', {
                      acceptedDate: challenge.acceptedDate,
                      scheduledDate: scheduledDate.toISOString(),
                      oneDayAfter: oneDayAfterScheduled.toISOString(),
                      today: today.toISOString(),
                      comparison: `${today.getTime()} >= ${oneDayAfterScheduled.getTime()}`,
                      isOverdue: today >= oneDayAfterScheduled
                    });
                  }

                  return today >= oneDayAfterScheduled;
                })();

                return (
                  <div
                    key={challenge.id}
                    className={`border-2 rounded-lg p-4 transition-colors ${
                      isOverdue
                        ? 'bg-red-50 border-red-400 hover:bg-red-100'
                        : 'bg-orange-50 border-orange-300 hover:bg-orange-100'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        {/* Match Title */}
                        <div className="flex items-center gap-3 mb-2">
                          <TeamLogo team={team1} size="sm" showBorder={!!team1?.logo} />
                          <h4 className="font-bold text-gray-900">
                            {getTeamName(challenge.challengerTeamId)}
                          </h4>
                          <span className="text-blue-600 font-semibold">vs</span>
                          <TeamLogo team={team2} size="sm" showBorder={!!team2?.logo} />
                          <h4 className="font-bold text-gray-900">
                            {getTeamName(challenge.challengedTeamId)}
                          </h4>
                          <span className="px-2 py-1 bg-orange-200 text-orange-900 text-xs font-medium rounded">
                            Level {challenge.acceptedLevel || challenge.proposedLevel}
                          </span>
                          <span className="px-2 py-1 bg-yellow-200 text-yellow-900 text-xs font-medium rounded flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            Awaiting Results
                          </span>
                          {isOverdue && (
                            <span className="px-2 py-1 bg-red-600 text-white text-xs font-bold rounded flex items-center gap-1 animate-pulse">
                              <AlertCircle className="w-3 h-3" />
                              Results Past Due
                            </span>
                          )}
                        </div>

                        {/* Players */}
                        <div className="grid grid-cols-2 gap-4 text-sm mb-2">
                          <div>
                            <div className="font-semibold text-gray-700 mb-1">
                              {getTeamName(challenge.challengerTeamId)} Players:
                            </div>
                            {team1Players.length > 0 ? (
                              team1Players.map((player, idx) => (
                                <div key={idx} className="text-gray-600">
                                  • {player.name} ({player.gender}) {player.dynamicRating ? formatDynamic(player.dynamicRating) : formatNTRP(player.rating)}
                                </div>
                              ))
                            ) : (
                              <div className="text-gray-500 italic">No players listed</div>
                            )}
                          </div>

                          <div>
                            <div className="font-semibold text-gray-700 mb-1">
                              {getTeamName(challenge.challengedTeamId)} Players:
                            </div>
                            {team2Players.length > 0 ? (
                              team2Players.map((player, idx) => (
                                <div key={idx} className="text-gray-600">
                                  • {player.name} ({player.gender}) {player.dynamicRating ? formatDynamic(player.dynamicRating) : formatNTRP(player.rating)}
                                </div>
                              ))
                            ) : (
                              <div className="text-gray-500 italic">No players listed</div>
                            )}
                          </div>
                        </div>

                        {/* Scheduled Date */}
                        {challenge.acceptedDate && (
                          <div className="flex items-center gap-1 text-sm text-gray-700 mb-2">
                            <Calendar className="w-4 h-4" />
                            <span>Scheduled: {formatDate(challenge.acceptedDate)}</span>
                          </div>
                        )}

                        {/* Metadata Footer - Match ID and Dates */}
                        <div className="text-xs text-gray-500 italic mt-3 pt-2 border-t border-gray-300">
                          {challenge.matchId && (
                            <span className="font-mono font-semibold">Match ID: {challenge.matchId}</span>
                          )}
                          {challenge.createdAt && (
                            <span className={challenge.matchId ? "ml-2" : ""}>
                              {challenge.matchId && "| "}Created: {formatDate(challenge.createdAt)}
                            </span>
                          )}
                          {challenge.acceptedAt && (
                            <span className="ml-2">| Accepted: {formatDate(challenge.acceptedAt)}</span>
                          )}
                        </div>
                        {challenge.notes && (
                          <div className="text-sm text-gray-600 mt-2">
                            <strong>Notes:</strong> {challenge.notes}
                          </div>
                        )}
                      </div>

                      {/* Action Buttons */}
                      <div className="ml-4 flex flex-col gap-2">
                        {/* Edit Button */}
                        {canEditPendingMatch(challenge) && (
                          <button
                            onClick={() => handleEditPendingMatch(challenge)}
                            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition-colors font-medium whitespace-nowrap"
                            title="Edit this pending match"
                          >
                            <Edit2 className="w-4 h-4" />
                            Edit
                          </button>
                        )}

                        {/* Enter Results Button */}
                        {canEnterResults(challenge) && onEnterPendingResults && (
                          <button
                            onClick={() => onEnterPendingResults(challenge)}
                            className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 transition-colors font-medium whitespace-nowrap"
                          >
                            <Check className="w-4 h-4" />
                            Enter Results
                          </button>
                        )}

                        {/* Delete Button (Directors Only) */}
                        {userRole === 'director' && (
                          <button
                            onClick={() => handleDeletePendingMatch(challenge)}
                            className="flex items-center gap-2 bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 transition-colors font-medium whitespace-nowrap"
                            title="Delete this pending match"
                          >
                            <Trash2 className="w-4 h-4" />
                            Delete
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* Completed Matches Section */}
      {showCompleted && (
        <section>
          <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
            <TrendingUp className="w-5 h-5" />
            Recently Completed Matches ({filteredMatches.length})
          </h3>
          {matches.length === 0 ? (
            <p className="text-gray-500 text-center py-6 bg-gray-50 rounded border border-gray-200">
              No completed matches yet
            </p>
          ) : filteredMatches.length === 0 ? (
            <p className="text-gray-500 text-center py-6 bg-gray-50 rounded border border-gray-200">
              No matches found matching the selected filters
            </p>
          ) : (
            <div className="space-y-3">
              {filteredMatches.slice(0, 20).map(match => {
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

                    {/* Metadata Footer - Match ID and Dates */}
                    <div className="text-xs text-gray-500 italic mt-3 pt-2 border-t border-gray-200">
                      {match.matchId && (
                        <span className="font-mono font-semibold">Match ID: {match.matchId}</span>
                      )}
                      {match.timestamp && (
                        <span className={match.matchId ? "ml-2" : ""}>
                          {match.matchId && "| "}Entered: {formatDate(match.timestamp)}
                        </span>
                      )}
                      {match.originChallengeId && (
                        <span className="ml-2">| From Challenge: {match.originChallengeId}</span>
                      )}
                    </div>
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
          })}
            </div>
          )}
        </section>
      )}

      {/* Edit Pending Match Modal */}
      {showEditPendingModal && editingPendingMatch && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-xl font-bold text-gray-900">Edit Pending Match</h3>
              <div className="flex items-center gap-3 text-xs text-gray-600 mt-1 flex-wrap">
                {editingPendingMatch.matchId && (
                  <div className="font-mono bg-blue-100 px-2 py-1 rounded">
                    <span className="font-semibold">Match ID:</span> {editingPendingMatch.matchId}
                  </div>
                )}
                {editingPendingMatch.challengeId && editingPendingMatch.origin !== 'direct' && (
                  <div className="font-mono bg-orange-100 px-2 py-1 rounded">
                    <span className="font-semibold">Origin Challenge ID:</span> {editingPendingMatch.challengeId}
                  </div>
                )}
              </div>
              <p className="text-sm text-gray-600 mt-1">
                {getTeamName(editingPendingMatch.challengerTeamId)} vs {getTeamName(editingPendingMatch.challengedTeamId)}
              </p>
              <div className="flex items-center gap-3 text-xs text-gray-500 mt-1">
                {editingPendingMatch.createdAt && (
                  <div className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    <span>Created: {formatDate(editingPendingMatch.createdAt)}</span>
                  </div>
                )}
                {editingPendingMatch.acceptedAt && (
                  <div className="flex items-center gap-1">
                    <Check className="w-3 h-3" />
                    <span>Accepted: {formatDate(editingPendingMatch.acceptedAt)}</span>
                  </div>
                )}
              </div>
            </div>

            <div className="px-6 py-4 space-y-4">
              {/* Match Date */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Match Date *
                </label>
                <input
                  type="date"
                  value={editPendingFormData.acceptedDate}
                  onChange={(e) => setEditPendingFormData({...editPendingFormData, acceptedDate: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Level */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Match Level
                </label>
                <select
                  value={editPendingFormData.acceptedLevel}
                  onChange={(e) => setEditPendingFormData({...editPendingFormData, acceptedLevel: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {['6.0', '6.5', '7.0', '7.5', '8.0', '8.5', '9.0', '9.5', '10.0'].map(level => (
                    <option key={level} value={level}>{level}</option>
                  ))}
                </select>
              </div>

              {/* Two-column player selection */}
              <div className="grid grid-cols-2 gap-4">
                {/* Team 1 Players */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {getTeamName(editingPendingMatch.challengerTeamId)} Players (Select 2) *
                  </label>
                  <div className="border border-gray-300 rounded p-4 max-h-48 overflow-y-auto space-y-2">
                    {getTeamRoster(editingPendingMatch.challengerTeamId).map(player => (
                      <label key={player.id} className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-2 rounded">
                        <input
                          type="checkbox"
                          checked={editPendingFormData.team1Players.includes(player.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              if (editPendingFormData.team1Players.length >= 2) {
                                alert('⚠️ You can only select 2 players for doubles.');
                                return;
                              }
                              setEditPendingFormData({
                                ...editPendingFormData,
                                team1Players: [...editPendingFormData.team1Players, player.id]
                              });
                            } else {
                              setEditPendingFormData({
                                ...editPendingFormData,
                                team1Players: editPendingFormData.team1Players.filter(id => id !== player.id)
                              });
                            }
                          }}
                          className="rounded"
                        />
                        <span className="text-sm">
                          {player.firstName} {player.lastName}
                          <span className="text-gray-500 ml-2">
                            ({player.gender}) {player.ntrpRating} NTRP
                          </span>
                        </span>
                      </label>
                    ))}
                  </div>
                  <div className="mt-2 space-y-1">
                    <p className="text-sm text-gray-600">
                      Selected: {editPendingFormData.team1Players.length} / 2 players
                    </p>
                    {editPendingFormData.team1Players.length === 2 && (
                      <div className={`text-sm font-medium ${
                        validateCombinedNTRP(editPendingFormData.team1Players, editPendingFormData.acceptedLevel)
                          ? 'text-green-600'
                          : 'text-red-600'
                      }`}>
                        Combined NTRP: {calculateCombinedNTRP(editPendingFormData.team1Players).toFixed(1)}
                        {!validateCombinedNTRP(editPendingFormData.team1Players, editPendingFormData.acceptedLevel) && (
                          <span className="block text-xs mt-0.5">
                            ⚠️ Exceeds match level ({editPendingFormData.acceptedLevel})
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Team 2 Players */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {getTeamName(editingPendingMatch.challengedTeamId)} Players (Select 2) *
                  </label>
                  <div className="border border-gray-300 rounded p-4 max-h-48 overflow-y-auto space-y-2">
                    {getTeamRoster(editingPendingMatch.challengedTeamId).map(player => (
                      <label key={player.id} className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-2 rounded">
                        <input
                          type="checkbox"
                          checked={editPendingFormData.team2Players.includes(player.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              if (editPendingFormData.team2Players.length >= 2) {
                                alert('⚠️ You can only select 2 players for doubles.');
                                return;
                              }
                              setEditPendingFormData({
                                ...editPendingFormData,
                                team2Players: [...editPendingFormData.team2Players, player.id]
                              });
                            } else {
                              setEditPendingFormData({
                                ...editPendingFormData,
                                team2Players: editPendingFormData.team2Players.filter(id => id !== player.id)
                              });
                            }
                          }}
                          className="rounded"
                        />
                        <span className="text-sm">
                          {player.firstName} {player.lastName}
                          <span className="text-gray-500 ml-2">
                            ({player.gender}) {player.ntrpRating} NTRP
                          </span>
                        </span>
                      </label>
                    ))}
                  </div>
                  <div className="mt-2 space-y-1">
                    <p className="text-sm text-gray-600">
                      Selected: {editPendingFormData.team2Players.length} / 2 players
                    </p>
                    {editPendingFormData.team2Players.length === 2 && (
                      <div className={`text-sm font-medium ${
                        validateCombinedNTRP(editPendingFormData.team2Players, editPendingFormData.acceptedLevel)
                          ? 'text-green-600'
                          : 'text-red-600'
                      }`}>
                        Combined NTRP: {calculateCombinedNTRP(editPendingFormData.team2Players).toFixed(1)}
                        {!validateCombinedNTRP(editPendingFormData.team2Players, editPendingFormData.acceptedLevel) && (
                          <span className="block text-xs mt-0.5">
                            ⚠️ Exceeds match level ({editPendingFormData.acceptedLevel})
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-gray-200 flex gap-3">
              <button
                onClick={handleConfirmEditPending}
                className="flex-1 bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition-colors font-medium"
              >
                Save Changes
              </button>
              <button
                onClick={() => {
                  setShowEditPendingModal(false);
                  setEditingPendingMatch(null);
                }}
                className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MatchHistory;