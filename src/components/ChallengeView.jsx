import React, { useState } from 'react';
import { X, Calendar, Users, Trophy, Check, AlertCircle } from 'lucide-react';
import { formatDate } from '../utils/formatters';
import TeamLogo from './TeamLogo';
import { formatMatchType, getMatchType, MATCH_TYPES } from '../utils/matchUtils';

const ChallengeView = ({
  challenge,
  teams,
  players,
  captains,
  isAuthenticated,
  userRole,
  userTeamId,
  onClose,
  onAccept,
  onLogin
}) => {
  const [isAccepting, setIsAccepting] = useState(false);

  if (!challenge) return null;

  const challengerTeam = teams.find(t => t.id === challenge.challengerTeamId);
  const challengedTeam = teams.find(t => t.id === challenge.challengedTeamId);
  const matchType = getMatchType(challenge);

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
    if (challenge.status !== 'open') return false;

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

  const handleAccept = async () => {
    setIsAccepting(true);
    try {
      await onAccept(challenge);
      onClose();
    } catch (error) {
      console.error('Error accepting challenge:', error);
      alert('Failed to accept challenge. Please try again.');
    } finally {
      setIsAccepting(false);
    }
  };

  const getStatusBadge = () => {
    switch (challenge.status) {
      case 'open':
        return <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-semibold">Open</span>;
      case 'accepted':
        return <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-semibold">Accepted</span>;
      case 'declined':
        return <span className="px-3 py-1 bg-red-100 text-red-800 rounded-full text-sm font-semibold">Declined</span>;
      default:
        return null;
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Challenge Details</h2>
            <p className="text-sm text-gray-600 mt-1">
              Created {formatDate(challenge.createdAt)}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Status Badge */}
          <div className="flex items-center justify-between">
            {getStatusBadge()}
            <span className="text-sm text-gray-600">
              {formatMatchType(matchType)} Match
            </span>
          </div>

          {/* Teams */}
          <div className="bg-gradient-to-r from-blue-50 to-green-50 rounded-lg p-4">
            <div className="flex items-center justify-between gap-4">
              {/* Challenger Team */}
              <div className="flex-1 text-center">
                <div className="flex flex-col items-center gap-2">
                  <TeamLogo team={challengerTeam} size="lg" showBorder={!!challengerTeam?.logo} />
                  <div>
                    <p className="font-bold text-lg text-gray-900">
                      {challengerTeam?.name || 'Unknown Team'}
                    </p>
                    <p className="text-xs text-gray-600 font-semibold">CHALLENGER</p>
                  </div>
                </div>
              </div>

              {/* VS Badge */}
              <div className="flex items-center justify-center">
                <div className="bg-white rounded-full w-12 h-12 flex items-center justify-center shadow-md border-2 border-gray-200">
                  <Trophy className="w-6 h-6 text-yellow-600" />
                </div>
              </div>

              {/* Challenged Team */}
              <div className="flex-1 text-center">
                <div className="flex flex-col items-center gap-2">
                  {challengedTeam ? (
                    <>
                      <TeamLogo team={challengedTeam} size="lg" showBorder={!!challengedTeam?.logo} />
                      <div>
                        <p className="font-bold text-lg text-gray-900">
                          {challengedTeam.name}
                        </p>
                        <p className="text-xs text-gray-600 font-semibold">CHALLENGED</p>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="w-16 h-16 rounded-full bg-gray-200 flex items-center justify-center border-2 border-dashed border-gray-400">
                        <Users className="w-8 h-8 text-gray-400" />
                      </div>
                      <div>
                        <p className="font-bold text-lg text-gray-600">
                          Open Challenge
                        </p>
                        <p className="text-xs text-gray-500 font-semibold">ANY TEAM CAN ACCEPT</p>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Challenge Details */}
          <div className="space-y-4">
            {/* Proposed Date & Level */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="flex items-center gap-2 text-gray-700 mb-1">
                  <Calendar className="w-4 h-4" />
                  <span className="text-sm font-semibold">Proposed Date</span>
                </div>
                <p className="text-lg font-bold text-gray-900">
                  {challenge.proposedDate ? formatDate(challenge.proposedDate) : 'Not specified'}
                </p>
              </div>

              <div className="bg-gray-50 rounded-lg p-4">
                <div className="flex items-center gap-2 text-gray-700 mb-1">
                  <Trophy className="w-4 h-4" />
                  <span className="text-sm font-semibold">Match Level</span>
                </div>
                <p className="text-lg font-bold text-gray-900">
                  {challenge.proposedLevel || 'Not specified'}
                </p>
              </div>
            </div>

            {/* Players */}
            {(challenge.challengerPlayers?.length > 0 || challenge.challengedPlayers?.length > 0) && (
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="flex items-center gap-2 text-gray-700 mb-3">
                  <Users className="w-4 h-4" />
                  <span className="text-sm font-semibold">Players</span>
                </div>
                <div className="space-y-2">
                  {challenge.challengerPlayers?.length > 0 && (
                    <div>
                      <p className="text-xs text-gray-600 font-semibold mb-1">
                        {challengerTeam?.name}:
                      </p>
                      <p className="text-sm text-gray-900">
                        {getPlayerNames(challenge.challengerPlayers)}
                      </p>
                    </div>
                  )}
                  {challenge.challengedPlayers?.length > 0 && (
                    <div>
                      <p className="text-xs text-gray-600 font-semibold mb-1">
                        {challengedTeam?.name}:
                      </p>
                      <p className="text-sm text-gray-900">
                        {getPlayerNames(challenge.challengedPlayers)}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Notes */}
            {challenge.notes && (
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-sm font-semibold text-gray-700 mb-1">Notes</p>
                <p className="text-sm text-gray-900">{challenge.notes}</p>
              </div>
            )}

            {/* Accepted Details (if accepted) */}
            {challenge.status === 'accepted' && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <div className="flex items-center gap-2 text-green-800 mb-2">
                  <Check className="w-5 h-5" />
                  <span className="font-semibold">Challenge Accepted</span>
                </div>
                <div className="space-y-1 text-sm">
                  {challenge.acceptedDate && (
                    <p>
                      <span className="font-semibold">Match Date:</span>{' '}
                      {formatDate(challenge.acceptedDate)}
                    </p>
                  )}
                  {challenge.acceptedLevel && (
                    <p>
                      <span className="font-semibold">Agreed Level:</span>{' '}
                      {challenge.acceptedLevel}
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col gap-3 pt-4 border-t border-gray-200">
            {!isAuthenticated && challenge.status === 'open' && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-center">
                <AlertCircle className="w-8 h-8 text-blue-600 mx-auto mb-2" />
                <p className="text-sm text-gray-700 mb-3">
                  You must be logged in to accept this challenge
                </p>
                <button
                  onClick={onLogin}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-semibold"
                >
                  Login
                </button>
              </div>
            )}

            {canAccept() && (
              <button
                onClick={handleAccept}
                disabled={isAccepting}
                className="w-full px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-semibold text-lg flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Check className="w-5 h-5" />
                {isAccepting ? 'Accepting...' : 'Accept Challenge'}
              </button>
            )}

            {isAuthenticated && !canAccept() && challenge.status === 'open' && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-center">
                <AlertCircle className="w-6 h-6 text-yellow-600 mx-auto mb-2" />
                <p className="text-sm text-gray-700">
                  {userRole === 'captain' && challenge.challengerTeamId === userTeamId
                    ? "You cannot accept your own team's challenge"
                    : "Only team captains can accept this challenge"}
                </p>
              </div>
            )}

            <button
              onClick={onClose}
              className="w-full px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-semibold"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChallengeView;
