import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Calendar, Users, Trophy, AlertCircle, ArrowLeft, Check, Clock, X } from 'lucide-react';
import { formatDate } from '../utils/formatters';
import TeamLogo from './TeamLogo';
import {
  formatMatchType,
  getMatchType,
  MATCH_TYPES,
  validatePlayerSelection,
  getPlayerSelectionError,
  calculateCombinedNTRP,
  validateCombinedNTRP
} from '../utils/matchUtils';
import { generateMatchId } from '../utils/idGenerator';
import { tournamentStorage } from '../services/storage';

const ChallengePage = ({
  challenges,
  teams,
  players,
  captains,
  matches,
  isAuthenticated,
  userRole,
  userTeamId,
  loginName,
  onLogin,
  onChallengesChange,
  onMatchesChange
}) => {
  const { challengeId } = useParams();
  const navigate = useNavigate();
  const [challenge, setChallenge] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isAccepting, setIsAccepting] = useState(false);

  // Acceptance form state
  const [showAcceptForm, setShowAcceptForm] = useState(false);
  const [acceptFormData, setAcceptFormData] = useState({
    acceptedDate: '',
    acceptedLevel: '7.0',
    selectedPlayers: [],
    notes: ''
  });

  useEffect(() => {
    // Find challenge by ID (convert to number since URL params are strings)
    const id = parseInt(challengeId, 10);
    if (!isNaN(id)) {
      const foundChallenge = challenges.find(c => c.id === id);
      setChallenge(foundChallenge);
    }
    setLoading(false);
  }, [challengeId, challenges]);

  // Get player names
  const getPlayerNames = (playerIds) => {
    if (!playerIds || playerIds.length === 0) return 'Not selected';
    return playerIds
      .map(id => {
        const player = players.find(p => p.id === id);
        return player ? `${player.firstName} ${player.lastName}` : 'Unknown';
      })
      .join(', ');
  };

  // Check if current user can accept this challenge
  const canAccept = () => {
    if (!isAuthenticated) return false;
    if (!challenge || challenge.status !== 'open') return false;

    // Directors can accept any challenge
    if (userRole === 'director') return true;

    // Captains can accept any open challenge EXCEPT their own
    if (userRole === 'captain' && userTeamId) {
      // Can't accept your own team's challenge
      if (challenge.challengerTeamId === userTeamId) return false;
      // Can accept any other open challenge
      return true;
    }

    return false;
  };

  const handleLoginClick = () => {
    // Save return URL before redirecting to login
    sessionStorage.setItem('returnTo', window.location.pathname);
    sessionStorage.setItem('returnAction', 'accept-challenge');
    onLogin();
  };

  const handleAcceptClick = () => {
    console.log('🎾 Accept button clicked for challenge:', challenge.id);
    console.log('Challenge data:', challenge);
    console.log('User can accept:', canAccept());

    // Open acceptance form with pre-filled data
    setAcceptFormData({
      acceptedDate: challenge.proposedDate || new Date().toISOString().split('T')[0],
      acceptedLevel: challenge.proposedLevel || '7.0',
      selectedPlayers: [],
      notes: ''
    });
    setShowAcceptForm(true);
    console.log('✅ Acceptance form opened');
  };

  const handleConfirmAccept = async () => {
    console.log('🎾 Starting challenge acceptance from ChallengePage...');

    const challengeMatchType = getMatchType(challenge);

    // Validation
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

    setIsAccepting(true);

    try {
      // Determine the challenged team
      const challengedTeamId = userRole === 'captain' ? userTeamId : challenge.challengedTeamId;

      // Generate Match ID
      const generatedMatchId = generateMatchId(matches || []);
      console.log('🆔 Generated Match ID:', generatedMatchId);

      // Call Firestore transaction to accept challenge
      console.log('🔐 Calling acceptChallengeTransaction...');
      const result = await tournamentStorage.acceptChallengeTransaction(
        challenge.id,
        {
          challengedTeamId: challengedTeamId,
          acceptedDate: acceptFormData.acceptedDate,
          acceptedLevel: acceptFormData.acceptedLevel,
          challengedPlayers: acceptFormData.selectedPlayers,
          challengedCombinedNTRP: calculateCombinedNTRP(acceptFormData.selectedPlayers, challengeMatchType),
          acceptedBy: loginName || 'Unknown',
          notes: acceptFormData.notes,
          matchId: generatedMatchId
        }
      );

      console.log('📊 Transaction result:', result);

      if (!result.success) {
        console.error('❌ Transaction failed:', result.message);

        if (result.alreadyAccepted) {
          alert(`⚠️ Challenge Already Accepted!\n\n${result.message}\n\nRefreshing...`);
          // Refresh data
          const latestChallengesData = await tournamentStorage.getChallenges();
          if (latestChallengesData && onChallengesChange) {
            onChallengesChange(JSON.parse(latestChallengesData.data));
          }
          navigate('/challenges');
        } else if (result.notFound) {
          alert(`⚠️ Challenge Not Found!\n\n${result.message}`);
          navigate('/challenges');
        } else {
          alert(`❌ Error accepting challenge:\n\n${result.message}\n\nPlease try again.`);
        }
        setIsAccepting(false);
        setShowAcceptForm(false);
        return;
      }

      console.log('✅ Challenge accepted successfully!');
      console.log('📊 Created match:', result.createdMatch);

      // Update local state with result
      if (onChallengesChange) {
        const updatedChallenges = challenges.map(c =>
          c.id === challenge.id ? result.updatedChallenge : c
        );
        onChallengesChange(updatedChallenges);
      }

      // Refresh matches data to include the new pending match
      if (onMatchesChange) {
        const latestMatchesData = await tournamentStorage.getMatches();
        if (latestMatchesData) {
          onMatchesChange(JSON.parse(latestMatchesData.data));
        }
      }

      // Show success message
      alert(`✅ Challenge Accepted!\n\nMatch ${result.createdMatch?.matchId || ''} has been created with:\n• Level: ${acceptFormData.acceptedLevel}\n• Date: ${acceptFormData.acceptedDate}\n• Players: ${acceptFormData.selectedPlayers.length} selected\n\nThe match is now waiting for results to be entered.`);

      // Wait a moment for user to see the message, then redirect
      setTimeout(() => {
        navigate('/matches');
      }, 500);

    } catch (error) {
      console.error('❌ Unexpected error accepting challenge:', error);
      alert('❌ Unexpected error accepting challenge.\n\nPlease try again or refresh the page.');
    } finally {
      setIsAccepting(false);
      setShowAcceptForm(false);
    }
  };

  const getStatusBadge = () => {
    if (!challenge) return null;

    switch (challenge.status) {
      case 'open':
        return (
          <span className="inline-flex items-center gap-1 px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-semibold">
            <Clock className="w-4 h-4" />
            Open Challenge
          </span>
        );
      case 'accepted':
        return (
          <span className="inline-flex items-center gap-1 px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-semibold">
            <Check className="w-4 h-4" />
            Accepted
          </span>
        );
      case 'declined':
        return (
          <span className="inline-flex items-center gap-1 px-3 py-1 bg-red-100 text-red-800 rounded-full text-sm font-semibold">
            Declined
          </span>
        );
      default:
        return null;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
        <div className="text-center">
          <Trophy className="w-12 h-12 animate-pulse mx-auto mb-4 text-blue-600" />
          <p className="text-gray-600">Loading challenge...</p>
        </div>
      </div>
    );
  }

  if (!challenge) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full text-center">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Challenge Not Found</h2>
          <p className="text-gray-600 mb-6">
            This challenge doesn't exist or has been deleted.
          </p>
          <button
            onClick={() => navigate('/challenges')}
            className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-semibold"
          >
            <ArrowLeft className="w-4 h-4" />
            View All Challenges
          </button>
        </div>
      </div>
    );
  }

  const challengerTeam = teams.find(t => t.id === challenge.challengerTeamId);
  const challengedTeam = teams.find(t => t.id === challenge.challengedTeamId);
  const matchType = getMatchType(challenge);

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header with Back Button */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <button
            onClick={() => navigate(-1)}
            className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors mb-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>
          <h1 className="text-2xl font-bold text-gray-900">Challenge Details</h1>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="bg-white rounded-lg shadow-lg overflow-hidden">
          {/* Status Banner */}
          <div className="bg-gradient-to-r from-blue-600 to-purple-600 px-6 py-4 text-white">
            {getStatusBadge()}
          </div>

          {/* Challenge Info */}
          <div className="p-6 space-y-6">
            {/* Teams Display */}
            <div className="bg-gradient-to-r from-blue-50 to-green-50 rounded-lg p-6">
              <div className="flex items-center justify-between gap-6 flex-wrap">
                {/* Challenger Team */}
                <div className="flex-1 min-w-[200px] text-center">
                  <div className="flex flex-col items-center gap-3">
                    <TeamLogo team={challengerTeam} size="lg" showBorder={!!challengerTeam?.logo} />
                    <div>
                      <p className="font-bold text-xl text-gray-900">
                        {challengerTeam?.name || 'Unknown Team'}
                      </p>
                      <p className="text-xs text-gray-600 font-semibold uppercase tracking-wide">Challenger</p>
                    </div>
                  </div>
                </div>

                {/* VS Badge */}
                <div className="flex items-center justify-center">
                  <div className="bg-white rounded-full w-16 h-16 flex items-center justify-center shadow-lg border-4 border-yellow-400">
                    <Trophy className="w-8 h-8 text-yellow-600" />
                  </div>
                </div>

                {/* Challenged Team */}
                <div className="flex-1 min-w-[200px] text-center">
                  <div className="flex flex-col items-center gap-3">
                    {challengedTeam ? (
                      <>
                        <TeamLogo team={challengedTeam} size="lg" showBorder={!!challengedTeam?.logo} />
                        <div>
                          <p className="font-bold text-xl text-gray-900">
                            {challengedTeam.name}
                          </p>
                          <p className="text-xs text-gray-600 font-semibold uppercase tracking-wide">Challenged</p>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="w-16 h-16 rounded-full bg-gray-200 flex items-center justify-center border-4 border-dashed border-gray-400">
                          <Users className="w-8 h-8 text-gray-400" />
                        </div>
                        <div>
                          <p className="font-bold text-xl text-gray-600">
                            Open Challenge
                          </p>
                          <p className="text-xs text-gray-500 font-semibold uppercase tracking-wide">Any Team Can Accept</p>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Match Details Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Match Type */}
              <div className="bg-purple-50 rounded-lg p-4 border border-purple-200">
                <div className="flex items-center gap-2 text-purple-700 mb-2">
                  <Users className="w-5 h-5" />
                  <span className="text-sm font-semibold uppercase tracking-wide">Match Type</span>
                </div>
                <p className="text-2xl font-bold text-purple-900">
                  {formatMatchType(matchType)}
                </p>
              </div>

              {/* Match Level */}
              <div className="bg-yellow-50 rounded-lg p-4 border border-yellow-200">
                <div className="flex items-center gap-2 text-yellow-700 mb-2">
                  <Trophy className="w-5 h-5" />
                  <span className="text-sm font-semibold uppercase tracking-wide">Match Level</span>
                </div>
                <p className="text-2xl font-bold text-yellow-900">
                  {challenge.status === 'accepted' ? challenge.acceptedLevel : challenge.proposedLevel}
                </p>
              </div>

              {/* Proposed/Match Date */}
              {(challenge.acceptedDate || challenge.proposedDate) && (
                <div className="bg-blue-50 rounded-lg p-4 border border-blue-200 md:col-span-2">
                  <div className="flex items-center gap-2 text-blue-700 mb-2">
                    <Calendar className="w-5 h-5" />
                    <span className="text-sm font-semibold uppercase tracking-wide">
                      {challenge.status === 'accepted' ? 'Match Date' : 'Proposed Date'}
                    </span>
                  </div>
                  <p className="text-xl font-bold text-blue-900">
                    {formatDate(challenge.acceptedDate || challenge.proposedDate)}
                  </p>
                </div>
              )}
            </div>

            {/* Players */}
            {(challenge.challengerPlayers?.length > 0 || challenge.challengedPlayers?.length > 0) && (
              <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                <div className="flex items-center gap-2 text-gray-700 mb-3">
                  <Users className="w-5 h-5" />
                  <span className="text-sm font-semibold uppercase tracking-wide">Players</span>
                </div>
                <div className="space-y-3">
                  {challenge.challengerPlayers?.length > 0 && (
                    <div>
                      <p className="text-xs text-gray-600 font-semibold mb-1 uppercase tracking-wide">
                        {challengerTeam?.name}:
                      </p>
                      <p className="text-base text-gray-900">
                        {getPlayerNames(challenge.challengerPlayers)}
                      </p>
                    </div>
                  )}
                  {challenge.challengedPlayers?.length > 0 && (
                    <div>
                      <p className="text-xs text-gray-600 font-semibold mb-1 uppercase tracking-wide">
                        {challengedTeam?.name}:
                      </p>
                      <p className="text-base text-gray-900">
                        {getPlayerNames(challenge.challengedPlayers)}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Notes */}
            {challenge.notes && (
              <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                <p className="text-sm font-semibold text-gray-700 mb-2 uppercase tracking-wide">Notes</p>
                <p className="text-base text-gray-900">{challenge.notes}</p>
              </div>
            )}

            {/* Challenge Metadata */}
            <div className="text-xs text-gray-500 pt-4 border-t border-gray-200">
              {challenge.challengeId && (
                <p className="font-mono">Challenge ID: {challenge.challengeId}</p>
              )}
              {challenge.createdAt && (
                <p className="mt-1">Created: {formatDate(challenge.createdAt)}</p>
              )}
              {challenge.status === 'accepted' && challenge.acceptedAt && (
                <p className="mt-1">Accepted: {formatDate(challenge.acceptedAt)}</p>
              )}
            </div>

            {/* Action Buttons */}
            <div className="pt-6 border-t border-gray-200 space-y-3">
              {/* Not Authenticated */}
              {!isAuthenticated && challenge.status === 'open' && (
                <div className="bg-blue-50 border-2 border-blue-300 rounded-lg p-6 text-center">
                  <AlertCircle className="w-12 h-12 text-blue-600 mx-auto mb-3" />
                  <p className="text-base text-gray-800 font-medium mb-4">
                    You must be logged in to accept this challenge
                  </p>
                  <button
                    onClick={handleLoginClick}
                    className="w-full sm:w-auto px-8 py-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-bold text-lg shadow-lg hover:shadow-xl"
                  >
                    Login to Accept Challenge
                  </button>
                </div>
              )}

              {/* Can Accept */}
              {canAccept() && (
                <button
                  onClick={handleAcceptClick}
                  className="w-full px-8 py-4 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-bold text-lg flex items-center justify-center gap-3 shadow-lg hover:shadow-xl"
                >
                  <Check className="w-6 h-6" />
                  Accept Challenge
                </button>
              )}

              {/* Cannot Accept (Authenticated but wrong role/team) */}
              {isAuthenticated && !canAccept() && challenge.status === 'open' && (
                <div className="bg-yellow-50 border-2 border-yellow-300 rounded-lg p-6 text-center">
                  <AlertCircle className="w-10 h-10 text-yellow-600 mx-auto mb-3" />
                  <p className="text-base text-gray-800">
                    {userRole === 'captain' && challenge.challengerTeamId === userTeamId
                      ? "You cannot accept your own team's challenge"
                      : "Only team captains can accept this challenge"}
                  </p>
                </div>
              )}

              {/* Already Accepted */}
              {challenge.status === 'accepted' && (
                <div className="bg-green-50 border-2 border-green-300 rounded-lg p-6 text-center">
                  <Check className="w-12 h-12 text-green-600 mx-auto mb-3" />
                  <p className="text-lg font-semibold text-gray-900 mb-2">
                    Challenge Accepted!
                  </p>
                  <p className="text-base text-gray-700">
                    This match has been scheduled.
                  </p>
                  {isAuthenticated && (
                    <button
                      onClick={() => navigate('/matches')}
                      className="mt-4 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-semibold"
                    >
                      View Matches
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Acceptance Form Modal */}
      {showAcceptForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
              <h3 className="text-xl font-bold text-gray-900">Accept Challenge</h3>
              <button
                onClick={() => setShowAcceptForm(false)}
                disabled={isAccepting}
                className="text-gray-500 hover:text-gray-700 transition-colors disabled:opacity-50"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Match Date */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Match Date *
                </label>
                <input
                  type="date"
                  value={acceptFormData.acceptedDate}
                  onChange={(e) => setAcceptFormData({ ...acceptFormData, acceptedDate: e.target.value })}
                  disabled={isAccepting}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100"
                />
              </div>

              {/* Match Level */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Match Level *
                </label>
                <select
                  value={acceptFormData.acceptedLevel}
                  onChange={(e) => setAcceptFormData({ ...acceptFormData, acceptedLevel: e.target.value })}
                  disabled={isAccepting}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100"
                >
                  <option value="6.0">6.0</option>
                  <option value="7.0">7.0</option>
                  <option value="8.0">8.0</option>
                  <option value="9.0">9.0</option>
                </select>
              </div>

              {/* Player Selection */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Select Your Players * ({getMatchType(challenge) === MATCH_TYPES.SINGLES ? '1 player' : '2 players'})
                </label>
                <div className="space-y-2 max-h-64 overflow-y-auto border border-gray-200 rounded-lg p-3">
                  {players
                    .filter(p => p.teamId === userTeamId)
                    .map(player => (
                      <label
                        key={player.id}
                        className="flex items-center gap-3 p-2 hover:bg-gray-50 rounded cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={acceptFormData.selectedPlayers.includes(player.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
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
                          disabled={isAccepting}
                          className="w-4 h-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                        />
                        <span className="text-sm text-gray-900">
                          {player.firstName} {player.lastName} (NTRP: {player.ntrp})
                        </span>
                      </label>
                    ))}
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Notes (Optional)
                </label>
                <textarea
                  value={acceptFormData.notes}
                  onChange={(e) => setAcceptFormData({ ...acceptFormData, notes: e.target.value })}
                  disabled={isAccepting}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100"
                  placeholder="Add any notes about this match..."
                />
              </div>
            </div>

            <div className="px-6 py-4 border-t border-gray-200 flex gap-3 sticky bottom-0 bg-white">
              <button
                onClick={handleConfirmAccept}
                disabled={isAccepting}
                className="flex-1 bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 transition-colors font-bold text-lg disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isAccepting ? 'Accepting Challenge...' : 'Confirm Accept'}
              </button>
              <button
                onClick={() => setShowAcceptForm(false)}
                disabled={isAccepting}
                className="px-6 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
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

export default ChallengePage;
