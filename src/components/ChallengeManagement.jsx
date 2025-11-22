import React, { useState, useEffect } from 'react';
import { Plus, X, Check, Calendar, Users, Swords, Trophy, Clock, AlertCircle, Trash2, Edit2, Filter, ChevronDown, ChevronUp, Link2 } from 'lucide-react';
import { ACTION_TYPES, createLogEntry } from '../services/activityLogger';
import { formatDate } from '../utils/formatters';
import { tournamentStorage } from '../services/storage';
import { isSmsEnabled } from '../firebase';
import TeamLogo from './TeamLogo';
import { generateChallengeId, generateMatchId } from '../utils/idGenerator';
import {
  MATCH_TYPES,
  validatePlayerSelection as validatePlayerCount,
  calculateCombinedNTRP as calcCombinedNTRP,
  validateCombinedNTRP as validateNTRPLimit,
  getRequiredPlayerCount,
  getPlayerSelectionLabel,
  getPlayerLimitAlert,
  getPlayerSelectionError,
  formatMatchType,
  getMatchType,
  getLevelOptions,
  getDefaultLevel,
  suggestLevel
} from '../utils/matchUtils';

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
  addLog,
  showToast,
  autoAcceptChallengeId,
  onAutoAcceptHandled
}) {
  // Form states
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showAcceptForm, setShowAcceptForm] = useState(false);
  const [showEditForm, setShowEditForm] = useState(false);
  const [selectedChallenge, setSelectedChallenge] = useState(null);
  const [editingChallenge, setEditingChallenge] = useState(null);

  // Filter states
  const [showFilters, setShowFilters] = useState(false);
  const [selectedTeams, setSelectedTeams] = useState([]);
  const [selectedPlayers, setSelectedPlayers] = useState([]);
  const [statusFilter, setStatusFilter] = useState('open'); // 'all', 'open', 'accepted' - defaults to 'open'
  const [matchTypeFilter, setMatchTypeFilter] = useState('all'); // 'all', 'singles', 'doubles'
  const [sortOrder, setSortOrder] = useState('newest'); // 'newest' or 'oldest'

  // Challenge creation form
  const [createFormData, setCreateFormData] = useState({
    challengerTeamId: '', // For directors to select challenging team
    matchType: MATCH_TYPES.DOUBLES, // 'singles' or 'doubles'
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
    matchType: MATCH_TYPES.DOUBLES, // 'singles' or 'doubles'
    proposedDate: '',
    proposedLevel: '7.0',
    selectedPlayers: [],
    notes: ''
  });

  // Get user's team
  const userTeam = teams.find(t => t.id === userTeamId);

  // Auto-open accept form when coming from deep link
  useEffect(() => {
    if (autoAcceptChallengeId && isAuthenticated) {
      const challenge = challenges.find(c => c.id === autoAcceptChallengeId);
      if (challenge && challenge.status === 'open') {
        // Auto-open the accept form
        handleAcceptChallenge(challenge);
      }
      // Mark as handled
      if (onAutoAcceptHandled) {
        onAutoAcceptHandled();
      }
    }
  }, [autoAcceptChallengeId, isAuthenticated, challenges]);

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

  // Filter handler functions
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

  // Get all challenges with role-based filtering
  const getAllChallenges = () => {
    return challenges.filter(challenge => {
      // Directors see all challenges
      if (userRole === 'director') return true;

      // Captains see:
      // - ALL open challenges (so they can accept any challenge)
      // - Only accepted challenges involving their team (scheduled matches)
      if (userRole === 'captain' && userTeamId) {
        if (challenge.status === 'open') {
          return true; // Show all open challenges
        }
        // For accepted/other statuses, only show challenges involving their team
        const captainTeamInvolved =
          challenge.challengerTeamId === userTeamId ||
          challenge.challengedTeamId === userTeamId;
        return captainTeamInvolved;
      }

      // Public users see all challenges
      return true;
    });
  };

  // Apply filters to challenges
  const getFilteredChallenges = () => {
    let filteredList = getAllChallenges();

    // Status filter
    if (statusFilter !== 'all') {
      filteredList = filteredList.filter(c => c.status === statusFilter);
    }

    // Team filter
    if (selectedTeams.length > 0) {
      filteredList = filteredList.filter(challenge => {
        const challengeHasSelectedTeam =
          selectedTeams.includes(challenge.challengerTeamId) ||
          (challenge.challengedTeamId && selectedTeams.includes(challenge.challengedTeamId));
        return challengeHasSelectedTeam;
      });
    }

    // Player filter
    if (selectedPlayers.length > 0) {
      filteredList = filteredList.filter(challenge => {
        const challengePlayers = [
          ...(challenge.challengerPlayers || []),
          ...(challenge.challengedPlayers || [])
        ];
        const challengeHasSelectedPlayer = selectedPlayers.some(playerId =>
          challengePlayers.includes(playerId)
        );
        return challengeHasSelectedPlayer;
      });
    }

    // Match type filter
    if (matchTypeFilter !== 'all') {
      filteredList = filteredList.filter(challenge => {
        const challengeMatchType = getMatchType(challenge);
        return challengeMatchType === matchTypeFilter;
      });
    }

    // Sort challenges by date
    filteredList.sort((a, b) => {
      const dateA = new Date(a.createdAt || 0);
      const dateB = new Date(b.createdAt || 0);
      return sortOrder === 'newest' ? dateB - dateA : dateA - dateB;
    });

    return filteredList;
  };

  // Legacy function for backward compatibility
  const getOpenChallenges = () => {
    return getFilteredChallenges().filter(c => c.status === 'open');
  };

  // Get team roster for player selection
  const getTeamRoster = (teamId) => {
    return players.filter(p => p.teamId === teamId && p.status === 'active');
  };

  // Calculate combined NTRP rating for selected players
  const calculateCombinedNTRP = (selectedPlayerIds, matchType) => {
    return calcCombinedNTRP(selectedPlayerIds, players, matchType);
  };

  // Validation: correct number of players must be selected for match type
  const validatePlayerSelection = (selectedPlayers, matchType) => {
    return validatePlayerCount(selectedPlayers, matchType);
  };

  // Validation: combined NTRP doesn't exceed match level
  const validateCombinedNTRP = (selectedPlayers, matchLevel, matchType) => {
    return validateNTRPLimit(selectedPlayers, players, matchLevel, matchType);
  };

  // Send challenge SMS notification
  const sendChallengeSMS = async (recipientCaptain, challengerTeam, challengedTeam, smsType, proposedDate = null, matchLevel = null) => {
    // Check feature flag first
    if (!isSmsEnabled()) {
      return { success: false, skipped: true };
    }

    if (!recipientCaptain || !recipientCaptain.smsEnabled || !recipientCaptain.phone) {
      return { success: false, skipped: true };
    }

    try {
      const smsResponse = await fetch('/.netlify/functions/send-sms-notification', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          recipientPhone: recipientCaptain.phone,
          recipientName: recipientCaptain.name,
          senderTeam: challengerTeam?.name || 'Unknown Team',
          recipientTeam: challengedTeam?.name || 'Unknown Team',
          proposedDate: proposedDate,
          matchLevel: matchLevel,
          smsType: smsType
        })
      });

      if (smsResponse.ok) {
        console.log(`Challenge ${smsType} SMS sent to ${recipientCaptain.name}`);
        return { success: true };
      } else {
        console.error(`Failed to send challenge ${smsType} SMS:`, await smsResponse.text());
        return { success: false, skipped: false };
      }
    } catch (error) {
      console.error(`Error sending challenge ${smsType} SMS:`, error);
      return { success: false, skipped: false };
    }
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

    if (!validatePlayerSelection(createFormData.selectedPlayers, createFormData.matchType)) {
      alert(getPlayerSelectionError(createFormData.matchType));
      return;
    }

    if (!validateCombinedNTRP(createFormData.selectedPlayers, createFormData.proposedLevel, createFormData.matchType)) {
      const combinedRating = calculateCombinedNTRP(createFormData.selectedPlayers, createFormData.matchType);
      alert(`Combined NTRP rating (${combinedRating.toFixed(1)}) exceeds match level (${createFormData.proposedLevel}). Please select different players or change the match level.`);
      return;
    }

    const generatedChallengeId = generateChallengeId(challenges);
    console.log('🆔 Generated Challenge ID:', generatedChallengeId);

    const newChallenge = {
      id: Date.now(),
      challengeId: generatedChallengeId,
      challengerTeamId: challengerTeamId,
      matchType: createFormData.matchType,
      status: 'open',
      proposedDate: createFormData.proposedDate || null,
      proposedLevel: createFormData.proposedLevel,
      challengerPlayers: createFormData.selectedPlayers,
      combinedNTRP: calculateCombinedNTRP(createFormData.selectedPlayers, createFormData.matchType),
      createdBy: getUserInfo()?.name || 'Unknown',
      createdAt: new Date().toISOString(),
      notes: createFormData.notes
    };

    onChallengesChange([...challenges, newChallenge]);

    // Reset form
    setCreateFormData({
      challengerTeamId: '',
      matchType: MATCH_TYPES.DOUBLES,
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
    const challengeMatchType = getMatchType(selectedChallenge);

    if (!acceptFormData.acceptedDate) {
      alert('⚠️ Please select a match date.');
      return;
    }

    if (!validatePlayerSelection(acceptFormData.selectedPlayers, challengeMatchType)) {
      alert(getPlayerSelectionError(challengeMatchType));
      return;
    }

    if (!validateCombinedNTRP(acceptFormData.selectedPlayers, acceptFormData.acceptedLevel, challengeMatchType)) {
      const combinedRating = calculateCombinedNTRP(acceptFormData.selectedPlayers, challengeMatchType);
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

    // Generate Match ID for the accepted challenge (pending match)
    const generatedMatchId = generateMatchId(matches || []);
    console.log('🆔 Generated Match ID for accepted challenge:', generatedMatchId);

    // Update challenge status to accepted and assign Match ID
    const updatedChallenges = challenges.map(c => {
      if (c.id === selectedChallenge.id) {
        return {
          ...c,
          status: 'accepted',
          matchId: generatedMatchId, // Assign Match ID when accepting
          challengedTeamId: challengedTeamId,
          acceptedDate: acceptFormData.acceptedDate,
          acceptedLevel: acceptFormData.acceptedLevel,
          challengedPlayers: acceptFormData.selectedPlayers,
          challengedCombinedNTRP: calculateCombinedNTRP(acceptFormData.selectedPlayers, challengeMatchType),
          acceptedBy: getUserInfo()?.name || 'Unknown',
          acceptedAt: new Date().toISOString(),
          acceptNotes: acceptFormData.notes
        };
      }
      return c;
    });

    onChallengesChange(updatedChallenges);

    // Send SMS notification to challenger captain
    const challengerTeam = teams.find(t => t.id === selectedChallenge.challengerTeamId);
    const challengedTeam = teams.find(t => t.id === challengedTeamId);
    const challengerCaptain = captains.find(c =>
      c.teamId === selectedChallenge.challengerTeamId &&
      c.status === 'active'
    );

    if (challengerCaptain) {
      sendChallengeSMS(
        challengerCaptain,
        challengedTeam,
        challengerTeam,
        'challenge_accepted',
        acceptFormData.acceptedDate,
        acceptFormData.acceptedLevel
      ).then(result => {
        if (result.success) {
          console.log('Challenge accepted SMS sent successfully');
        }
      }).catch(error => {
        console.error('Error sending challenge accepted SMS:', error);
      });
    }

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
      matchType: getMatchType(challenge),
      proposedDate: challenge.proposedDate || '',
      proposedLevel: challenge.proposedLevel,
      selectedPlayers: challenge.challengerPlayers,
      notes: challenge.notes || ''
    });
    setShowEditForm(true);
  };

  const handleConfirmEdit = () => {
    // Validation
    if (!validatePlayerSelection(editFormData.selectedPlayers, editFormData.matchType)) {
      alert(getPlayerSelectionError(editFormData.matchType));
      return;
    }

    if (!validateCombinedNTRP(editFormData.selectedPlayers, editFormData.proposedLevel, editFormData.matchType)) {
      const combinedRating = calculateCombinedNTRP(editFormData.selectedPlayers, editFormData.matchType);
      alert(`Combined NTRP rating (${combinedRating.toFixed(1)}) exceeds match level (${editFormData.proposedLevel}). Please select different players or change the match level.`);
      return;
    }

    // Track what changed for activity log
    const changes = [];
    if (editFormData.matchType !== getMatchType(editingChallenge)) {
      changes.push('match type');
    }
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
      matchType: editFormData.matchType,
      proposedDate: editFormData.proposedDate || null,
      proposedLevel: editFormData.proposedLevel,
      challengerPlayers: editFormData.selectedPlayers,
      combinedNTRP: calculateCombinedNTRP(editFormData.selectedPlayers, editFormData.matchType),
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
      matchType: MATCH_TYPES.DOUBLES,
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

  // Copy challenge link to clipboard
  const handleCopyLink = async (challenge) => {
    const baseUrl = window.location.origin;
    const challengeUrl = `${baseUrl}?challenge=${challenge.id}`;

    try {
      await navigator.clipboard.writeText(challengeUrl);
      if (showToast) {
        showToast('Link copied to clipboard! 🎾');
      } else {
        alert('Link copied to clipboard!');
      }
    } catch (error) {
      console.error('Failed to copy link:', error);
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = challengeUrl;
      textArea.style.position = 'fixed';
      textArea.style.left = '-9999px';
      document.body.appendChild(textArea);
      textArea.select();
      try {
        document.execCommand('copy');
        if (showToast) {
          showToast('Link copied to clipboard! 🎾');
        } else {
          alert('Link copied to clipboard!');
        }
      } catch (err) {
        alert('Failed to copy link. Please copy manually: ' + challengeUrl);
      }
      document.body.removeChild(textArea);
    }
  };

  // Dynamic level options based on match type
  const getAvailableLevels = (matchType) => getLevelOptions(matchType);

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

      {/* Filter Section */}
      <div className="bg-white rounded-lg shadow p-4">
        {/* Status Filter, Match Type Filter, and Sort Order */}
        <div className="mb-4 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium mb-2">Filter by Status:</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Challenges</option>
              <option value="open">Open Only</option>
              <option value="accepted">Accepted Only</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Filter by Match Type:</label>
            <select
              value={matchTypeFilter}
              onChange={(e) => setMatchTypeFilter(e.target.value)}
              className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Types</option>
              <option value={MATCH_TYPES.SINGLES}>Singles</option>
              <option value={MATCH_TYPES.DOUBLES}>Doubles</option>
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
        <div>
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
                                  ({player.gender} {player.ntrpRating})
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

        {/* Challenge Count Display */}
        {(hasActiveFilters || statusFilter !== 'all' || matchTypeFilter !== 'all') && (
          <div className="mt-3 px-3 py-2 bg-blue-100 text-blue-800 rounded text-sm font-semibold">
            Showing {getFilteredChallenges().length} of {getAllChallenges().length} challenges
          </div>
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

            {/* Match Type */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Match Type *
              </label>
              <select
                value={createFormData.matchType}
                onChange={(e) => setCreateFormData({
                  ...createFormData,
                  matchType: e.target.value,
                  proposedLevel: getDefaultLevel(e.target.value), // Update level based on match type
                  selectedPlayers: [] // Reset player selection when match type changes
                })}
                className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value={MATCH_TYPES.DOUBLES}>Doubles</option>
                <option value={MATCH_TYPES.SINGLES}>Singles</option>
              </select>
            </div>

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
                Level {createFormData.matchType === MATCH_TYPES.SINGLES ? '(Individual NTRP)' : '(Combined NTRP)'}
              </label>
              <select
                value={createFormData.proposedLevel}
                onChange={(e) => setCreateFormData({...createFormData, proposedLevel: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {getAvailableLevels(createFormData.matchType).map(level => (
                  <option key={level} value={level}>{level}</option>
                ))}
              </select>
            </div>

            {/* Player Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {getPlayerSelectionLabel(createFormData.matchType)} *
              </label>
              <div className="border border-gray-300 rounded p-4 max-h-48 overflow-y-auto space-y-2">
                {(() => {
                  const challengerTeamId = userRole === 'captain' ? userTeamId : parseInt(createFormData.challengerTeamId);
                  const roster = challengerTeamId ? getTeamRoster(challengerTeamId) : [];
                  const requiredCount = getRequiredPlayerCount(createFormData.matchType);

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
                            // Limit based on match type
                            if (createFormData.selectedPlayers.length >= requiredCount) {
                              alert(getPlayerLimitAlert(createFormData.matchType));
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
                  Selected: {createFormData.selectedPlayers.length} / {getRequiredPlayerCount(createFormData.matchType)} player{getRequiredPlayerCount(createFormData.matchType) > 1 ? 's' : ''}
                </p>
                {createFormData.selectedPlayers.length === getRequiredPlayerCount(createFormData.matchType) && (
                  <div className={`text-sm font-medium ${
                    validateCombinedNTRP(createFormData.selectedPlayers, createFormData.proposedLevel, createFormData.matchType)
                      ? 'text-green-600'
                      : 'text-red-600'
                  }`}>
                    {createFormData.matchType === MATCH_TYPES.SINGLES ? 'Player Rating' : 'Combined NTRP'}: {calculateCombinedNTRP(createFormData.selectedPlayers, createFormData.matchType).toFixed(1)}
                    {!validateCombinedNTRP(createFormData.selectedPlayers, createFormData.proposedLevel, createFormData.matchType) && (
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

      {/* Challenges List */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <Trophy className="w-5 h-5 text-yellow-600" />
            {statusFilter === 'open' ? 'Open Challenges' :
             statusFilter === 'accepted' ? 'Accepted Challenges' :
             'All Challenges'} ({getFilteredChallenges().length})
          </h3>
        </div>

        <div className="divide-y divide-gray-200">
          {getFilteredChallenges().length === 0 ? (
            <div className="px-6 py-8 text-center text-gray-500">
              <AlertCircle className="w-12 h-12 mx-auto mb-3 text-gray-400" />
              <p>
                {statusFilter === 'open' ? 'No open challenges at this time' :
                 statusFilter === 'accepted' ? 'No accepted challenges' :
                 hasActiveFilters ? 'No challenges match the selected filters' :
                 'No challenges at this time'}
              </p>
              {canCreateChallenge() && statusFilter === 'open' && !hasActiveFilters && (
                <p className="text-sm mt-1">Create a challenge to get started!</p>
              )}
            </div>
          ) : (
            getFilteredChallenges().map(challenge => (
              <div key={challenge.id} className={`px-6 py-4 hover:bg-gray-50 transition-colors ${
                challenge.status === 'accepted' ? 'bg-green-50' : ''
              }`}>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      {challenge.status === 'accepted' && challenge.challengedTeamId ? (
                        <>
                          <h4 className="text-lg font-semibold text-gray-900">
                            {getTeamName(challenge.challengerTeamId)} vs {getTeamName(challenge.challengedTeamId)}
                          </h4>
                          <span className="px-2 py-1 bg-green-100 text-green-800 text-xs font-medium rounded flex items-center gap-1">
                            <Check className="w-3 h-3" />
                            Accepted
                          </span>
                        </>
                      ) : (
                        <>
                          <h4 className="text-lg font-semibold text-gray-900">
                            {getTeamName(challenge.challengerTeamId)} - Open Challenge
                          </h4>
                          <span className="px-2 py-1 bg-yellow-100 text-yellow-800 text-xs font-medium rounded flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            Open
                          </span>
                        </>
                      )}
                      <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs font-medium rounded">
                        Level {challenge.status === 'accepted' ? challenge.acceptedLevel : challenge.proposedLevel}
                      </span>
                      <span className="px-2 py-1 bg-purple-100 text-purple-800 text-xs font-medium rounded">
                        {formatMatchType(getMatchType(challenge))}
                      </span>
                      {/* Copy Link Button - Inline with match type */}
                      <button
                        onClick={() => handleCopyLink(challenge)}
                        className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded transition-colors"
                        title="Copy shareable link for WhatsApp"
                      >
                        <Link2 className="w-3 h-3" />
                        <span className="hidden sm:inline">Copy Link for WhatsApp</span>
                      </button>
                    </div>

                    <div className="space-y-1 text-sm text-gray-600">
                      {/* Show accepted date for accepted challenges, proposed date for open challenges */}
                      {challenge.status === 'accepted' && challenge.acceptedDate ? (
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4 text-green-600" />
                          <span className="font-medium text-green-600">Match Date: {formatDate(challenge.acceptedDate)}</span>
                        </div>
                      ) : challenge.proposedDate ? (
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4" />
                          <span>Proposed Match Date: {formatDate(challenge.proposedDate)}</span>
                        </div>
                      ) : null}

                      {/* Show both teams' players for accepted challenges */}
                      {challenge.status === 'accepted' && challenge.challengedTeamId ? (
                        <div className="grid grid-cols-2 gap-4 mt-2">
                          <div>
                            <div className="flex items-center gap-2 font-semibold text-gray-700 mb-1">
                              <Users className="w-4 h-4" />
                              <span>{getTeamName(challenge.challengerTeamId)}</span>
                            </div>
                            <div className="ml-6 text-xs">
                              {getPlayerNames(challenge.challengerPlayers)}
                            </div>
                          </div>
                          <div>
                            <div className="flex items-center gap-2 font-semibold text-gray-700 mb-1">
                              <Users className="w-4 h-4" />
                              <span>{getTeamName(challenge.challengedTeamId)}</span>
                            </div>
                            <div className="ml-6 text-xs">
                              {getPlayerNames(challenge.challengedPlayers)}
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <Users className="w-4 h-4" />
                          <span>{getPlayerNames(challenge.challengerPlayers)}</span>
                        </div>
                      )}

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
                      {challenge.acceptNotes && (
                        <div className="mt-2 text-gray-700">
                          <strong>Accept Notes:</strong> {challenge.acceptNotes}
                        </div>
                      )}
                      {/* Metadata Footer - Challenge ID and Dates */}
                      <div className="text-xs text-gray-500 italic mt-3 pt-2 border-t border-gray-200">
                        {challenge.challengeId && (
                          <span className="font-mono font-semibold">Challenge ID: {challenge.challengeId}</span>
                        )}
                        {challenge.createdAt && (
                          <span className={challenge.challengeId ? "ml-2" : ""}>
                            {challenge.challengeId && "| "}Created: {formatDate(challenge.createdAt)}
                          </span>
                        )}
                        {challenge.status === 'accepted' && challenge.acceptedAt && (
                          <span className="ml-2">| Accepted: {formatDate(challenge.acceptedAt)}</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="ml-4 flex gap-2 flex-wrap">
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
              {editingChallenge.challengeId && (
                <p className="text-xs text-gray-600 mt-1 font-mono">
                  Challenge ID: {editingChallenge.challengeId}
                </p>
              )}
              <p className="text-sm text-gray-600 mt-1">
                Challenging Team: {getTeamName(editingChallenge.challengerTeamId)}
              </p>
              {editingChallenge.createdAt && (
                <p className="text-xs text-gray-500 mt-1">
                  Created: {formatDate(editingChallenge.createdAt)} by {editingChallenge.createdBy || 'Unknown'}
                </p>
              )}
            </div>

            <div className="px-6 py-4 space-y-4">
              {/* Match Type */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Match Type *
                </label>
                <select
                  value={editFormData.matchType}
                  onChange={(e) => setEditFormData({
                    ...editFormData,
                    matchType: e.target.value,
                    proposedLevel: getDefaultLevel(e.target.value), // Update level based on match type
                    selectedPlayers: [] // Reset player selection when match type changes
                  })}
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value={MATCH_TYPES.DOUBLES}>Doubles</option>
                  <option value={MATCH_TYPES.SINGLES}>Singles</option>
                </select>
              </div>

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
                  Level {editFormData.matchType === MATCH_TYPES.SINGLES ? '(Individual NTRP)' : '(Combined NTRP)'}
                </label>
                <select
                  value={editFormData.proposedLevel}
                  onChange={(e) => setEditFormData({...editFormData, proposedLevel: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {getAvailableLevels(editFormData.matchType).map(level => (
                    <option key={level} value={level}>{level}</option>
                  ))}
                </select>
              </div>

              {/* Player Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {getPlayerSelectionLabel(editFormData.matchType)} *
                </label>
                <div className="border border-gray-300 rounded p-4 max-h-48 overflow-y-auto space-y-2">
                  {(() => {
                    const roster = getTeamRoster(editingChallenge.challengerTeamId);
                    const requiredCount = getRequiredPlayerCount(editFormData.matchType);

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
                              // Limit based on match type
                              if (editFormData.selectedPlayers.length >= requiredCount) {
                                alert(getPlayerLimitAlert(editFormData.matchType));
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
                    Selected: {editFormData.selectedPlayers.length} / {getRequiredPlayerCount(editFormData.matchType)} player{getRequiredPlayerCount(editFormData.matchType) > 1 ? 's' : ''}
                  </p>
                  {editFormData.selectedPlayers.length === getRequiredPlayerCount(editFormData.matchType) && (
                    <div className={`text-sm font-medium ${
                      validateCombinedNTRP(editFormData.selectedPlayers, editFormData.proposedLevel, editFormData.matchType)
                        ? 'text-green-600'
                        : 'text-red-600'
                    }`}>
                      {editFormData.matchType === MATCH_TYPES.SINGLES ? 'Player Rating' : 'Combined NTRP'}: {calculateCombinedNTRP(editFormData.selectedPlayers, editFormData.matchType).toFixed(1)}
                      {!validateCombinedNTRP(editFormData.selectedPlayers, editFormData.proposedLevel, editFormData.matchType) && (
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
              {selectedChallenge.challengeId && (
                <p className="text-xs text-gray-600 mt-1 font-mono">
                  Challenge ID: {selectedChallenge.challengeId}
                </p>
              )}
              <p className="text-sm text-gray-600 mt-1">
                From: {getTeamName(selectedChallenge.challengerTeamId)} (Level {selectedChallenge.proposedLevel})
              </p>
              {selectedChallenge.createdAt && (
                <p className="text-xs text-gray-500 mt-1">
                  Created: {formatDate(selectedChallenge.createdAt)} by {selectedChallenge.createdBy || 'Unknown'}
                </p>
              )}
            </div>

            <div className="px-6 py-4 space-y-4">
              {/* Match Type Display */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Match Type
                </label>
                <div className="text-lg font-semibold text-gray-900 px-3 py-2 bg-gray-50 rounded border border-gray-300">
                  {formatMatchType(getMatchType(selectedChallenge))}
                </div>
              </div>

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
                  Level {getMatchType(selectedChallenge) === MATCH_TYPES.SINGLES ? '(Individual NTRP)' : '(Combined NTRP)'}
                </label>
                <select
                  value={acceptFormData.acceptedLevel}
                  onChange={(e) => setAcceptFormData({...acceptFormData, acceptedLevel: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {getAvailableLevels(getMatchType(selectedChallenge)).map(level => (
                    <option key={level} value={level}>{level}</option>
                  ))}
                </select>
              </div>

              {/* Player Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {getPlayerSelectionLabel(getMatchType(selectedChallenge))} *
                </label>
                <div className="border border-gray-300 rounded p-4 max-h-48 overflow-y-auto space-y-2">
                  {(() => {
                    const acceptingTeamId = userRole === 'captain' ? userTeamId : selectedChallenge.challengedTeamId;
                    const roster = acceptingTeamId ? getTeamRoster(acceptingTeamId) : [];
                    const challengeMatchType = getMatchType(selectedChallenge);
                    const requiredCount = getRequiredPlayerCount(challengeMatchType);

                    return roster.map(player => (
                      <label key={player.id} className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-2 rounded">
                        <input
                          type="checkbox"
                          checked={acceptFormData.selectedPlayers.includes(player.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              // Limit based on match type
                              if (acceptFormData.selectedPlayers.length >= requiredCount) {
                                alert(getPlayerLimitAlert(challengeMatchType));
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
                  {(() => {
                    const challengeMatchType = getMatchType(selectedChallenge);
                    const requiredCount = getRequiredPlayerCount(challengeMatchType);
                    return (
                      <>
                        <p className="text-sm text-gray-600">
                          Selected: {acceptFormData.selectedPlayers.length} / {requiredCount} player{requiredCount > 1 ? 's' : ''}
                        </p>
                        {acceptFormData.selectedPlayers.length === requiredCount && (
                          <div className={`text-sm font-medium ${
                            validateCombinedNTRP(acceptFormData.selectedPlayers, acceptFormData.acceptedLevel, challengeMatchType)
                              ? 'text-green-600'
                              : 'text-red-600'
                          }`}>
                            {challengeMatchType === MATCH_TYPES.SINGLES ? 'Player Rating' : 'Combined NTRP'}: {calculateCombinedNTRP(acceptFormData.selectedPlayers, challengeMatchType).toFixed(1)}
                            {!validateCombinedNTRP(acceptFormData.selectedPlayers, acceptFormData.acceptedLevel, challengeMatchType) && (
                              <span className="block text-xs mt-0.5">
                                ⚠️ Exceeds match level ({acceptFormData.acceptedLevel})
                              </span>
                            )}
                          </div>
                        )}
                      </>
                    );
                  })()}
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
