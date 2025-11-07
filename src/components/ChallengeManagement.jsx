import React, { useState, useEffect } from 'react';
import { Plus, X, Check, Calendar, Users, Swords, Trophy, Clock, AlertCircle, Trash2, Edit2 } from 'lucide-react';
import { ACTION_TYPES, createLogEntry } from '../services/activityLogger';
import { formatDate } from '../utils/formatters';
import { tournamentStorage } from '../services/storage';

export default function ChallengeManagement({
  teams,
  players,
  matches,
  challenges,
  captains,
  onChallengesChange,
  onMatchesChange,
  isAuthenticated,
  userRole,
  userTeamId,
  loginName,
  addLog
}) {
  // Form states
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showAcceptForm, setShowAcceptForm] = useState(false);
  const [showEditForm, setShowEditForm] = useState(false);
  const [selectedChallenge, setSelectedChallenge] = useState(null);
  const [editingChallenge, setEditingChallenge] = useState(null);

  // Challenge creation form
  const [createFormData, setCreateFormData] = useState({
    challengerTeamId: '', // For directors to select challenging team
    proposedDate: '',
    proposedLevel: '7.0',
    selectedPlayers: [],
    notes: ''
  });

  // Challenge acceptance form
  const [acceptFormData, setAcceptFormData] = useState({
    acceptedDate: '',
    acceptedLevel: '7.0',
    selectedPlayers: [],
    notes: ''
  });

  // Challenge edit form
  const [editFormData, setEditFormData] = useState({
    proposedDate: '',
    proposedLevel: '7.0',
    selectedPlayers: [],
    notes: ''
  });

  // Get user's team
  const userTeam = teams.find(t => t.id === userTeamId);

  // Get current user info
  const getUserInfo = () => {
    if (!isAuthenticated) return null;
    if (userRole === 'director') return { name: 'Tournament Director', role: 'director' };

    // For captains, get their actual name from loginName or captains list
    if (userRole === 'captain') {
      // loginName should be the captain's full name
      if (loginName) {
        return { name: loginName, role: userRole };
      }
      // Fallback: try to find captain by teamId
      const captain = captains.find(c => c.teamId === userTeamId);
      if (captain) {
        return { name: captain.name, role: userRole };
      }
    }

    return { name: 'Captain', role: userRole };
  };

  // Filter challenges based on user role
  const getOpenChallenges = () => {
    return challenges.filter(c => c.status === 'open');
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

  // Handle create challenge
  const handleCreateChallenge = () => {
    // Determine the challenging team
    const challengerTeamId = userRole === 'captain' ? userTeamId : parseInt(createFormData.challengerTeamId);

    // Validation
    if (userRole === 'director' && !createFormData.challengerTeamId) {
      alert('⚠️ Please select a challenging team.');
      return;
    }

    // Proposed date is now optional - no validation needed

    if (!validatePlayerSelection(createFormData.selectedPlayers)) {
      alert('⚠️ Please select exactly 2 players.');
      return;
    }

    if (!validateCombinedNTRP(createFormData.selectedPlayers, createFormData.proposedLevel)) {
      const combinedRating = calculateCombinedNTRP(createFormData.selectedPlayers);
      alert(`Combined NTRP rating (${combinedRating.toFixed(1)}) exceeds match level (${createFormData.proposedLevel}). Please select different players or change the match level.`);
      return;
    }

    const newChallenge = {
      id: Date.now(),
      challengerTeamId: challengerTeamId,
      status: 'open',
      proposedDate: createFormData.proposedDate || null,
      proposedLevel: createFormData.proposedLevel,
      challengerPlayers: createFormData.selectedPlayers,
      combinedNTRP: calculateCombinedNTRP(createFormData.selectedPlayers),
      createdBy: getUserInfo()?.name || 'Unknown',
      createdAt: new Date().toISOString(),
      notes: createFormData.notes
    };

    onChallengesChange([...challenges, newChallenge]);

    // Reset form
    setCreateFormData({
      challengerTeamId: '',
      proposedDate: '',
      proposedLevel: '7.0',
      selectedPlayers: [],
      notes: ''
    });
    setShowCreateForm(false);
    alert('✅ Challenge created successfully!\n\n⚠️ IMPORTANT: Click the "Save Data" button to save this to the database.');
  };

  // Handle accept challenge
  const handleAcceptChallenge = (challenge) => {
    setSelectedChallenge(challenge);
    setAcceptFormData({
      acceptedDate: challenge.proposedDate,
      acceptedLevel: challenge.proposedLevel,
      selectedPlayers: [],
      notes: ''
    });
    setShowAcceptForm(true);
  };

  const handleConfirmAccept = async () => {
    if (!acceptFormData.acceptedDate) {
      alert('⚠️ Please select a match date.');
      return;
    }

    if (!validatePlayerSelection(acceptFormData.selectedPlayers)) {
      alert('⚠️ Please select exactly 2 players.');
      return;
    }

    if (!validateCombinedNTRP(acceptFormData.selectedPlayers, acceptFormData.acceptedLevel)) {
      const combinedRating = calculateCombinedNTRP(acceptFormData.selectedPlayers);
      alert(`Combined NTRP rating (${combinedRating.toFixed(1)}) exceeds match level (${acceptFormData.acceptedLevel}). Please select different players or change the match level.`);
      return;
    }

    // RACE CONDITION PROTECTION: Fetch fresh data to verify challenge is still open
    try {
      console.log('🔍 Checking if challenge is still available...');
      const latestChallengesData = await tournamentStorage.getChallenges();

      if (latestChallengesData) {
        const latestChallenges = JSON.parse(latestChallengesData.data);
        const latestChallenge = latestChallenges.find(c => c.id === selectedChallenge.id);

        // Check if challenge still exists and is open
        if (!latestChallenge) {
          alert('⚠️ Challenge Not Found!\n\nThis challenge has been deleted by another user.\n\nPlease refresh the page to see current challenges.');
          setShowAcceptForm(false);
          return;
        }

        if (latestChallenge.status !== 'open') {
          const acceptedBy = latestChallenge.acceptedBy || 'another team';
          alert(`⚠️ Challenge Already Accepted!\n\nThis challenge has already been accepted by ${acceptedBy}.\n\nPlease refresh the page to see current challenges.`);
          setShowAcceptForm(false);
          return;
        }

        console.log('✅ Challenge is still open, proceeding with accept');
      }
    } catch (error) {
      console.error('Error checking challenge status:', error);
      alert('⚠️ Error verifying challenge status.\n\nPlease try again or refresh the page.');
      return;
    }

    // Determine the challenged team
    const challengedTeamId = userRole === 'captain' ? userTeamId : selectedChallenge.challengedTeamId;

    // Update challenge status to accepted
    const updatedChallenges = challenges.map(c => {
      if (c.id === selectedChallenge.id) {
        return {
          ...c,
          status: 'accepted',
          challengedTeamId: challengedTeamId,
          acceptedDate: acceptFormData.acceptedDate,
          acceptedLevel: acceptFormData.acceptedLevel,
          challengedPlayers: acceptFormData.selectedPlayers,
          challengedCombinedNTRP: calculateCombinedNTRP(acceptFormData.selectedPlayers),
          acceptedBy: getUserInfo()?.name || 'Unknown',
          acceptedAt: new Date().toISOString(),
          acceptNotes: acceptFormData.notes
        };
      }
      return c;
    });

    onChallengesChange(updatedChallenges);

    // Reset form
    setShowAcceptForm(false);
    setSelectedChallenge(null);
    setAcceptFormData({
      acceptedDate: '',
      acceptedLevel: '7.0',
      selectedPlayers: [],
      notes: ''
    });

    alert('✅ Challenge accepted!\n\nThe match is now pending results.\n\n⚠️ IMPORTANT: Click the "Save Data" button to save this to the database.');
  };

  // Handle delete challenge (directors only)
  const handleDeleteChallenge = (challenge) => {
    if (!window.confirm('Are you sure you want to delete this challenge?\n\nThis action cannot be undone.')) {
      return;
    }

    const updatedChallenges = challenges.filter(c => c.id !== challenge.id);
    onChallengesChange(updatedChallenges);
    alert('✅ Challenge deleted successfully.\n\n⚠️ IMPORTANT: Click the "Save Data" button to save this to the database.');
  };

  // Handle edit challenge
  const handleEditChallenge = (challenge) => {
    setEditingChallenge(challenge);
    setEditFormData({
      proposedDate: challenge.proposedDate || '',
      proposedLevel: challenge.proposedLevel,
      selectedPlayers: challenge.challengerPlayers,
      notes: challenge.notes || ''
    });
    setShowEditForm(true);
  };

  const handleConfirmEdit = () => {
    // Validation
    if (!validatePlayerSelection(editFormData.selectedPlayers)) {
      alert('⚠️ Please select exactly 2 players.');
      return;
    }

    if (!validateCombinedNTRP(editFormData.selectedPlayers, editFormData.proposedLevel)) {
      const combinedRating = calculateCombinedNTRP(editFormData.selectedPlayers);
      alert(`Combined NTRP rating (${combinedRating.toFixed(1)}) exceeds match level (${editFormData.proposedLevel}). Please select different players or change the match level.`);
      return;
    }

    // Track what changed for activity log
    const changes = [];
    if (editFormData.proposedDate !== (editingChallenge.proposedDate || '')) {
      changes.push('date');
    }
    if (editFormData.proposedLevel !== editingChallenge.proposedLevel) {
      changes.push('level');
    }
    if (JSON.stringify(editFormData.selectedPlayers.sort()) !== JSON.stringify(editingChallenge.challengerPlayers.sort())) {
      changes.push('players');
    }
    if (editFormData.notes !== (editingChallenge.notes || '')) {
      changes.push('notes');
    }

    // Update challenge
    const updatedChallenge = {
      ...editingChallenge,
      proposedDate: editFormData.proposedDate || null,
      proposedLevel: editFormData.proposedLevel,
      challengerPlayers: editFormData.selectedPlayers,
      combinedNTRP: calculateCombinedNTRP(editFormData.selectedPlayers),
      notes: editFormData.notes,
      lastEditedBy: getUserInfo()?.name || 'Unknown',
      lastEditedAt: new Date().toISOString()
    };

    const updatedChallenges = challenges.map(c =>
      c.id === editingChallenge.id ? updatedChallenge : c
    );

    onChallengesChange(updatedChallenges);

    // Log the edit activity
    if (addLog && changes.length > 0) {
      addLog(
        ACTION_TYPES.CHALLENGE_EDITED,
        {
          challengerTeam: getTeamName(editingChallenge.challengerTeamId),
          level: editFormData.proposedLevel,
          changesSummary: `Updated ${changes.join(', ')}`
        },
        editingChallenge.id,
        editingChallenge,
        updatedChallenge
      );
    }

    // Reset form
    setShowEditForm(false);
    setEditingChallenge(null);
    setEditFormData({
      proposedDate: '',
      proposedLevel: '7.0',
      selectedPlayers: [],
      notes: ''
    });

    alert('✅ Challenge updated successfully!\n\n⚠️ IMPORTANT: Click the "Save Data" button to save this to the database.');
  };

  // Helper function to get team name
  const getTeamName = (teamId) => {
    const team = teams.find(t => t.id === teamId);
    return team ? team.name : 'Unknown Team';
  };

  // Helper function to get player names
  const getPlayerNames = (playerIds) => {
    if (!playerIds || playerIds.length === 0) return 'No players selected';
    return playerIds
      .map(id => {
        const player = players.find(p => p.id === id);
        return player ? `${player.firstName} ${player.lastName}` : 'Unknown';
      })
      .join(', ');
  };

  // Check if user can create challenges
  const canCreateChallenge = () => {
    if (!isAuthenticated) return false;
    if (userRole === 'director') return true;
    if (userRole === 'captain' && userTeamId) return true;
    return false;
  };

  // Check if user can accept a specific challenge
  const canAcceptChallenge = (challenge) => {
    if (!isAuthenticated) return false;
    if (challenge.status !== 'open') return false;
    if (challenge.challengerTeamId === userTeamId) return false; // Can't accept your own challenge

    // Any authenticated captain or director can accept any open challenge (except their own)
    if (userRole === 'director') return true;
    if (userRole === 'captain' && userTeamId) return true;

    return false;
  };

  // Check if user can edit a specific challenge
  const canEditChallenge = (challenge) => {
    if (!isAuthenticated) return false;
    if (challenge.status !== 'open') return false; // Can only edit open challenges

    // Directors can edit any challenge
    if (userRole === 'director') return true;

    // Captains can only edit challenges their team created
    if (userRole === 'captain' && userTeamId === challenge.challengerTeamId) return true;

    return false;
  };

  const levels = ['6.0', '6.5', '7.0', '7.5', '8.0', '8.5', '9.0', '9.5', '10.0'];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Swords className="w-6 h-6" />
            Challenges
          </h2>
          <p className="text-gray-600 mt-1">
            {isAuthenticated
              ? 'Create challenges and manage pending matches'
              : 'View open challenges from teams'
            }
          </p>
        </div>

        {canCreateChallenge() && !showCreateForm && (
          <button
            onClick={() => setShowCreateForm(true)}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Create Challenge
          </button>
        )}
      </div>

      {/* Create Challenge Form */}
      {showCreateForm && (
        <div className="bg-white border-2 border-blue-500 rounded-lg p-6 shadow-lg">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-bold text-gray-900">Create New Challenge</h3>
            <button
              onClick={() => setShowCreateForm(false)}
              className="text-gray-500 hover:text-gray-700"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="space-y-4">
            {/* Challenging Team */}
            {userRole === 'captain' ? (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Your Team (Challenging)
                </label>
                <div className="text-lg font-semibold text-gray-900 px-3 py-2 bg-gray-50 rounded border border-gray-300">
                  {getTeamName(userTeamId)}
                </div>
              </div>
            ) : (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Challenging Team *
                </label>
                <select
                  value={createFormData.challengerTeamId}
                  onChange={(e) => {
                    setCreateFormData({
                      ...createFormData,
                      challengerTeamId: e.target.value,
                      selectedPlayers: [] // Reset player selection when team changes
                    });
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select challenging team...</option>
                  {teams.map(team => (
                    <option key={team.id} value={team.id}>{team.name}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Proposed Date */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Proposed Date (Optional)
              </label>
              <input
                type="date"
                value={createFormData.proposedDate}
                onChange={(e) => setCreateFormData({...createFormData, proposedDate: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Level */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Level
              </label>
              <select
                value={createFormData.proposedLevel}
                onChange={(e) => setCreateFormData({...createFormData, proposedLevel: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {levels.map(level => (
                  <option key={level} value={level}>{level}</option>
                ))}
              </select>
            </div>

            {/* Player Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select 2 Players *
              </label>
              <div className="border border-gray-300 rounded p-4 max-h-48 overflow-y-auto space-y-2">
                {(() => {
                  const challengerTeamId = userRole === 'captain' ? userTeamId : parseInt(createFormData.challengerTeamId);
                  const roster = challengerTeamId ? getTeamRoster(challengerTeamId) : [];

                  if (roster.length === 0) {
                    return (
                      <p className="text-sm text-gray-500 text-center py-4">
                        {userRole === 'director' && !createFormData.challengerTeamId
                          ? 'Please select a challenging team first'
                          : 'No active players on this team'}
                      </p>
                    );
                  }

                  return roster.map(player => (
                    <label key={player.id} className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-2 rounded">
                      <input
                        type="checkbox"
                        checked={createFormData.selectedPlayers.includes(player.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            // Limit to 2 players
                            if (createFormData.selectedPlayers.length >= 2) {
                              alert('⚠️ You can only select 2 players for doubles.');
                              return;
                            }
                            setCreateFormData({
                              ...createFormData,
                              selectedPlayers: [...createFormData.selectedPlayers, player.id]
                            });
                          } else {
                            setCreateFormData({
                              ...createFormData,
                              selectedPlayers: createFormData.selectedPlayers.filter(id => id !== player.id)
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
                  ));
                })()}
              </div>
              <div className="mt-2 space-y-1">
                <p className="text-sm text-gray-600">
                  Selected: {createFormData.selectedPlayers.length} / 2 players
                </p>
                {createFormData.selectedPlayers.length === 2 && (
                  <div className={`text-sm font-medium ${
                    validateCombinedNTRP(createFormData.selectedPlayers, createFormData.proposedLevel)
                      ? 'text-green-600'
                      : 'text-red-600'
                  }`}>
                    Combined NTRP: {calculateCombinedNTRP(createFormData.selectedPlayers).toFixed(1)}
                    {!validateCombinedNTRP(createFormData.selectedPlayers, createFormData.proposedLevel) && (
                      <span className="block text-xs mt-0.5">
                        ⚠️ Exceeds match level ({createFormData.proposedLevel})
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Notes */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Notes (Optional)
              </label>
              <textarea
                value={createFormData.notes}
                onChange={(e) => setCreateFormData({...createFormData, notes: e.target.value})}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Propose dates/times, court preferences, or match details..."
              />
              <p className="text-sm text-gray-500 mt-1">
                Use this section to propose dates/times, court preferences, or any other match details
              </p>
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-4">
              <button
                onClick={handleCreateChallenge}
                className="flex-1 bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition-colors font-medium"
              >
                Create Challenge
              </button>
              <button
                onClick={() => setShowCreateForm(false)}
                className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Open Challenges */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <Trophy className="w-5 h-5 text-yellow-600" />
            Open Challenges ({getOpenChallenges().length})
          </h3>
        </div>

        <div className="divide-y divide-gray-200">
          {getOpenChallenges().length === 0 ? (
            <div className="px-6 py-8 text-center text-gray-500">
              <AlertCircle className="w-12 h-12 mx-auto mb-3 text-gray-400" />
              <p>No open challenges at this time</p>
              {canCreateChallenge() && (
                <p className="text-sm mt-1">Create a challenge to get started!</p>
              )}
            </div>
          ) : (
            getOpenChallenges().map(challenge => (
              <div key={challenge.id} className="px-6 py-4 hover:bg-gray-50 transition-colors">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h4 className="text-lg font-semibold text-gray-900">
                        {getTeamName(challenge.challengerTeamId)} - Open Challenge
                      </h4>
                      <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs font-medium rounded">
                        Level {challenge.proposedLevel}
                      </span>
                    </div>

                    <div className="space-y-1 text-sm text-gray-600">
                      {challenge.proposedDate && (
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4" />
                          <span>Proposed Match Date: {formatDate(challenge.proposedDate)}</span>
                        </div>
                      )}
                      <div className="flex items-center gap-2">
                        <Users className="w-4 h-4" />
                        <span>{getPlayerNames(challenge.challengerPlayers)}</span>
                      </div>
                      {challenge.combinedNTRP && (
                        <div className="flex items-center gap-2">
                          <Trophy className="w-4 h-4 text-green-600" />
                          <span className="font-medium text-green-600">
                            Combined NTRP: {challenge.combinedNTRP.toFixed(1)}
                          </span>
                        </div>
                      )}
                      {challenge.notes && (
                        <div className="mt-2 text-gray-700">
                          <strong>Notes:</strong> {challenge.notes}
                        </div>
                      )}
                      <div className="text-xs text-gray-500 mt-2">
                        Created by {challenge.createdBy} on {formatDate(challenge.createdAt)}
                      </div>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="ml-4 flex gap-2">
                    {/* Edit button (directors and captains who own the challenge) */}
                    {canEditChallenge(challenge) && (
                      <button
                        onClick={() => handleEditChallenge(challenge)}
                        className="flex items-center gap-1 bg-blue-600 text-white px-3 py-1.5 rounded hover:bg-blue-700 transition-colors text-sm font-medium"
                        title="Edit this challenge"
                      >
                        <Edit2 className="w-4 h-4" />
                        Edit
                      </button>
                    )}

                    {/* Directors: Show Delete button */}
                    {userRole === 'director' && (
                      <button
                        onClick={() => handleDeleteChallenge(challenge)}
                        className="flex items-center gap-1 bg-red-600 text-white px-3 py-1.5 rounded hover:bg-red-700 transition-colors text-sm font-medium"
                        title="Delete this challenge"
                      >
                        <Trash2 className="w-4 h-4" />
                        Delete
                      </button>
                    )}

                    {/* Captains: Show Accept button only if it's NOT their own challenge */}
                    {userRole === 'captain' && canAcceptChallenge(challenge) && (
                      <button
                        onClick={() => handleAcceptChallenge(challenge)}
                        className="flex items-center gap-1 bg-green-600 text-white px-3 py-1.5 rounded hover:bg-green-700 transition-colors text-sm font-medium"
                      >
                        <Check className="w-4 h-4" />
                        Accept Challenge
                      </button>
                    )}

                    {/* Public viewers: No buttons */}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Edit Challenge Modal */}
      {showEditForm && editingChallenge && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-xl font-bold text-gray-900">Edit Challenge</h3>
              <p className="text-sm text-gray-600 mt-1">
                Challenging Team: {getTeamName(editingChallenge.challengerTeamId)}
              </p>
            </div>

            <div className="px-6 py-4 space-y-4">
              {/* Proposed Date */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Proposed Date (Optional)
                </label>
                <input
                  type="date"
                  value={editFormData.proposedDate}
                  onChange={(e) => setEditFormData({...editFormData, proposedDate: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Level */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Level
                </label>
                <select
                  value={editFormData.proposedLevel}
                  onChange={(e) => setEditFormData({...editFormData, proposedLevel: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {levels.map(level => (
                    <option key={level} value={level}>{level}</option>
                  ))}
                </select>
              </div>

              {/* Player Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Select 2 Players *
                </label>
                <div className="border border-gray-300 rounded p-4 max-h-48 overflow-y-auto space-y-2">
                  {(() => {
                    const roster = getTeamRoster(editingChallenge.challengerTeamId);

                    if (roster.length === 0) {
                      return (
                        <p className="text-sm text-gray-500 text-center py-4">
                          No active players on this team
                        </p>
                      );
                    }

                    return roster.map(player => (
                      <label key={player.id} className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-2 rounded">
                        <input
                          type="checkbox"
                          checked={editFormData.selectedPlayers.includes(player.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              // Limit to 2 players
                              if (editFormData.selectedPlayers.length >= 2) {
                                alert('⚠️ You can only select 2 players for doubles.');
                                return;
                              }
                              setEditFormData({
                                ...editFormData,
                                selectedPlayers: [...editFormData.selectedPlayers, player.id]
                              });
                            } else {
                              setEditFormData({
                                ...editFormData,
                                selectedPlayers: editFormData.selectedPlayers.filter(id => id !== player.id)
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
                    ));
                  })()}
                </div>
                <div className="mt-2 space-y-1">
                  <p className="text-sm text-gray-600">
                    Selected: {editFormData.selectedPlayers.length} / 2 players
                  </p>
                  {editFormData.selectedPlayers.length === 2 && (
                    <div className={`text-sm font-medium ${
                      validateCombinedNTRP(editFormData.selectedPlayers, editFormData.proposedLevel)
                        ? 'text-green-600'
                        : 'text-red-600'
                    }`}>
                      Combined NTRP: {calculateCombinedNTRP(editFormData.selectedPlayers).toFixed(1)}
                      {!validateCombinedNTRP(editFormData.selectedPlayers, editFormData.proposedLevel) && (
                        <span className="block text-xs mt-0.5">
                          ⚠️ Exceeds match level ({editFormData.proposedLevel})
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Notes (Optional)
                </label>
                <textarea
                  value={editFormData.notes}
                  onChange={(e) => setEditFormData({...editFormData, notes: e.target.value})}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Propose dates/times, court preferences, or match details..."
                />
              </div>
            </div>

            <div className="px-6 py-4 border-t border-gray-200 flex gap-3">
              <button
                onClick={handleConfirmEdit}
                className="flex-1 bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition-colors font-medium"
              >
                Save Changes
              </button>
              <button
                onClick={() => {
                  setShowEditForm(false);
                  setEditingChallenge(null);
                }}
                className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Accept Challenge Modal */}
      {showAcceptForm && selectedChallenge && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-xl font-bold text-gray-900">Accept Challenge</h3>
              <p className="text-sm text-gray-600 mt-1">
                From: {getTeamName(selectedChallenge.challengerTeamId)} (Level {selectedChallenge.proposedLevel})
              </p>
            </div>

            <div className="px-6 py-4 space-y-4">
              {/* Match Date */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Match Date *
                </label>
                <input
                  type="date"
                  value={acceptFormData.acceptedDate}
                  onChange={(e) => setAcceptFormData({...acceptFormData, acceptedDate: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Level */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Level
                </label>
                <select
                  value={acceptFormData.acceptedLevel}
                  onChange={(e) => setAcceptFormData({...acceptFormData, acceptedLevel: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {levels.map(level => (
                    <option key={level} value={level}>{level}</option>
                  ))}
                </select>
              </div>

              {/* Player Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Select 2 Players *
                </label>
                <div className="border border-gray-300 rounded p-4 max-h-48 overflow-y-auto space-y-2">
                  {(() => {
                    const acceptingTeamId = userRole === 'captain' ? userTeamId : selectedChallenge.challengedTeamId;
                    const roster = acceptingTeamId ? getTeamRoster(acceptingTeamId) : [];

                    return roster.map(player => (
                      <label key={player.id} className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-2 rounded">
                        <input
                          type="checkbox"
                          checked={acceptFormData.selectedPlayers.includes(player.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              // Limit to 2 players
                              if (acceptFormData.selectedPlayers.length >= 2) {
                                alert('⚠️ You can only select 2 players for doubles.');
                                return;
                              }
                              setAcceptFormData({
                                ...acceptFormData,
                                selectedPlayers: [...acceptFormData.selectedPlayers, player.id]
                              });
                            } else {
                              setAcceptFormData({
                                ...acceptFormData,
                                selectedPlayers: acceptFormData.selectedPlayers.filter(id => id !== player.id)
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
                    ));
                  })()}
                </div>
                <div className="mt-2 space-y-1">
                  <p className="text-sm text-gray-600">
                    Selected: {acceptFormData.selectedPlayers.length} / 2 players
                  </p>
                  {acceptFormData.selectedPlayers.length === 2 && (
                    <div className={`text-sm font-medium ${
                      validateCombinedNTRP(acceptFormData.selectedPlayers, acceptFormData.acceptedLevel)
                        ? 'text-green-600'
                        : 'text-red-600'
                    }`}>
                      Combined NTRP: {calculateCombinedNTRP(acceptFormData.selectedPlayers).toFixed(1)}
                      {!validateCombinedNTRP(acceptFormData.selectedPlayers, acceptFormData.acceptedLevel) && (
                        <span className="block text-xs mt-0.5">
                          ⚠️ Exceeds match level ({acceptFormData.acceptedLevel})
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Notes (Optional)
                </label>
                <textarea
                  value={acceptFormData.notes}
                  onChange={(e) => setAcceptFormData({...acceptFormData, notes: e.target.value})}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Propose dates/times, court preferences, or match details..."
                />
                <p className="text-sm text-gray-500 mt-1">
                  Use this section to propose dates/times, court preferences, or any other match details
                </p>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-gray-200 flex gap-3">
              <button
                onClick={handleConfirmAccept}
                className="flex-1 bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 transition-colors font-medium"
              >
                Confirm Accept
              </button>
              <button
                onClick={() => {
                  setShowAcceptForm(false);
                  setSelectedChallenge(null);
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
}
