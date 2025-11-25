import React, { useState, useEffect } from 'react';
import { Calendar, Plus, Check, X, Upload, Image as ImageIcon, Clock, AlertCircle, Trash2, RefreshCw } from 'lucide-react';
import { ACTION_TYPES } from '../services/activityLogger';
import { formatNTRP, formatDynamic, formatDate } from '../utils/formatters';
import { tournamentStorage, imageStorage } from '../services/storage';
import { isSmsEnabled } from '../firebase';
import { generateMatchId, generateChallengeId } from '../utils/idGenerator';
import MatchResultsModal from './MatchResultsModal';
import { useNotification } from '../contexts/NotificationContext';
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
  getDefaultLevel
} from '../utils/matchUtils';

const MatchEntry = ({ teams, matches, setMatches, challenges, onChallengesChange, isAuthenticated, setActiveTab, players, captains, onAddPhoto, loginName, userRole, userTeamId, editingMatch, setEditingMatch, addLog }) => {
  const { showSuccess, showError, showInfo } = useNotification();
  const [showMatchForm, setShowMatchForm] = useState(false);
  const [matchFormData, setMatchFormData] = useState({
    matchType: MATCH_TYPES.DOUBLES,
    date: new Date().toISOString().split('T')[0],
    level: getDefaultLevel(MATCH_TYPES.DOUBLES),
    team1Id: '',
    team2Id: '',
    matchWinner: '', // 'team1' or 'team2' - selected before entering scores
    set1Winner: '', // Winner's score in set 1
    set1Loser: '', // Loser's score in set 1
    set2Winner: '', // Winner's score in set 2
    set2Loser: '', // Loser's score in set 2
    set3Winner: '', // Winner's score in set 3 (if needed)
    set3Loser: '', // Loser's score in set 3 (if needed)
    set1Team1: '', // Legacy - mapped from winner/loser scores
    set1Team2: '', // Legacy - mapped from winner/loser scores
    set2Team1: '', // Legacy - mapped from winner/loser scores
    set2Team2: '', // Legacy - mapped from winner/loser scores
    set3Team1: '', // Legacy - mapped from winner/loser scores
    set3Team2: '', // Legacy - mapped from winner/loser scores
    set3IsTiebreaker: false,
    team1Players: [],
    team2Players: [],
    notes: ''
  });
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [allowPlayerEdit, setAllowPlayerEdit] = useState(false);

  // Create Pending Match state
  const [showPendingMatchForm, setShowPendingMatchForm] = useState(false);
  const [pendingMatchFormData, setPendingMatchFormData] = useState({
    matchType: MATCH_TYPES.DOUBLES,
    opponentTeamId: '',
    scheduledDate: new Date().toISOString().split('T')[0],
    level: getDefaultLevel(MATCH_TYPES.DOUBLES),
    team1Players: [],
    team2Players: [],
    notes: ''
  });

  // Match Results Modal state (for entering results for pending matches)
  const [showResultsModal, setShowResultsModal] = useState(false);
  const [selectedPendingMatch, setSelectedPendingMatch] = useState(null);

  // Loading state for save operations
  const [isSaving, setIsSaving] = useState(false);

  // Pre-populate form when editing a match
  useEffect(() => {
    if (editingMatch) {
      // Skip this effect for pending matches - they're handled in handleEnterPendingResults
      if (editingMatch.isPendingMatch) {
        return;
      }

      // Convert legacy team1/team2 scores to winner/loser format
      const matchWinner = editingMatch.winner || ''; // 'team1' or 'team2'
      const set1Winner = matchWinner === 'team1' ? editingMatch.set1Team1 : editingMatch.set1Team2;
      const set1Loser = matchWinner === 'team1' ? editingMatch.set1Team2 : editingMatch.set1Team1;
      const set2Winner = matchWinner === 'team1' ? editingMatch.set2Team1 : editingMatch.set2Team2;
      const set2Loser = matchWinner === 'team1' ? editingMatch.set2Team2 : editingMatch.set2Team1;
      const set3Winner = matchWinner === 'team1' ? editingMatch.set3Team1 : editingMatch.set3Team2;
      const set3Loser = matchWinner === 'team1' ? editingMatch.set3Team2 : editingMatch.set3Team1;

      setMatchFormData({
        matchType: getMatchType(editingMatch),
        date: editingMatch.date || new Date().toISOString().split('T')[0],
        level: editingMatch.level || getDefaultLevel(getMatchType(editingMatch)),
        team1Id: editingMatch.team1Id ? editingMatch.team1Id.toString() : '',
        team2Id: editingMatch.team2Id ? editingMatch.team2Id.toString() : '',
        matchWinner: matchWinner,
        set1Winner: set1Winner || '',
        set1Loser: set1Loser || '',
        set2Winner: set2Winner || '',
        set2Loser: set2Loser || '',
        set3Winner: set3Winner || '',
        set3Loser: set3Loser || '',
        set1Team1: editingMatch.set1Team1 || '',
        set1Team2: editingMatch.set1Team2 || '',
        set2Team1: editingMatch.set2Team1 || '',
        set2Team2: editingMatch.set2Team2 || '',
        set3Team1: editingMatch.set3Team1 || '',
        set3Team2: editingMatch.set3Team2 || '',
        set3IsTiebreaker: editingMatch.set3IsTiebreaker || false,
        team1Players: editingMatch.team1Players || [],
        team2Players: editingMatch.team2Players || [],
        notes: editingMatch.notes || ''
      });
      setShowMatchForm(true);
    }
  }, [editingMatch]);

  // Helper: Sync winner/loser scores to team1/team2 scores (for backwards compatibility)
  const syncWinnerLoserToTeamScores = (winner, set1W, set1L, set2W, set2L, set3W, set3L) => {
    if (winner === 'team1') {
      return {
        set1Team1: set1W,
        set1Team2: set1L,
        set2Team1: set2W,
        set2Team2: set2L,
        set3Team1: set3W,
        set3Team2: set3L
      };
    } else if (winner === 'team2') {
      return {
        set1Team1: set1L,
        set1Team2: set1W,
        set2Team1: set2L,
        set2Team2: set2W,
        set3Team1: set3L,
        set3Team2: set3W
      };
    }
    return {};
  };

  // Tennis score validation - validates if two scores form a valid tennis set
  const validateTennisScore = (score1, score2, isTiebreaker = false, isSet3 = false) => {
    const s1 = parseInt(score1) || 0;
    const s2 = parseInt(score2) || 0;

    if (s1 === 0 && s2 === 0) return { valid: true, error: '' }; // Empty scores are okay

    // Match tiebreak (third set when split): 1-0 or 0-1 is valid
    if (isSet3 && ((s1 === 1 && s2 === 0) || (s1 === 0 && s2 === 1))) {
      return { valid: true, error: '', isMatchTiebreak: true };
    }

    if (isTiebreaker) {
      // 10-point tiebreaker: one score must be 10+, other < 10, and winner ahead by 2+
      const higher = Math.max(s1, s2);
      const lower = Math.min(s1, s2);
      if (higher < 10) return { valid: false, error: 'Tiebreaker winner must score at least 10 points' };
      if (lower >= 10) return { valid: false, error: 'Tiebreaker loser must score less than 10 points' };
      if (higher - lower < 2) return { valid: false, error: 'Tiebreaker must be won by 2+ points' };
      return { valid: true, error: '' };
    }

    // Regular set validation - check if scores form a valid tennis set
    // Valid set scores: 6-0, 6-1, 6-2, 6-3, 6-4, 7-5, 7-6 (and reverse: 0-6, 1-6, etc.)
    const higher = Math.max(s1, s2);
    const lower = Math.min(s1, s2);

    // One score must be higher than the other (no ties in tennis)
    if (s1 === s2) return { valid: false, error: 'Tennis sets cannot be tied' };

    // Valid endings: 6-0, 6-1, 6-2, 6-3, 6-4, 7-5, 7-6
    if (higher === 6 && lower <= 4) return { valid: true, error: '' };
    if (higher === 7 && (lower === 5 || lower === 6)) return { valid: true, error: '' };

    return { valid: false, error: 'Invalid tennis score (must be 6-0 through 6-4, 7-5, 7-6, or 1-0 for match tiebreak)' };
  };

  // Debug: Track form data changes
  useEffect(() => {
    console.log('🔄 Form Data Changed:', matchFormData);
    console.log('   Team 1 ID:', matchFormData.team1Id);
    console.log('   Team 2 ID:', matchFormData.team2Id);
    console.log('   Match Winner:', matchFormData.matchWinner);
    console.log('   Team 1 Players:', matchFormData.team1Players);
    console.log('   Team 2 Players:', matchFormData.team2Players);
  }, [matchFormData]);

  // Calculate match results from set scores
  const calculateMatchResults = () => {
    const { set1Team1, set1Team2, set2Team1, set2Team2, set3Team1, set3Team2, set3IsTiebreaker } = matchFormData;

    // Convert to numbers
    const s1t1 = parseInt(set1Team1) || 0;
    const s1t2 = parseInt(set1Team2) || 0;
    const s2t1 = parseInt(set2Team1) || 0;
    const s2t2 = parseInt(set2Team2) || 0;
    const s3t1 = parseInt(set3Team1) || 0;
    const s3t2 = parseInt(set3Team2) || 0;

    // Determine set winners
    const set1Winner = s1t1 > s1t2 ? 1 : (s1t2 > s1t1 ? 2 : 0);
    const set2Winner = s2t1 > s2t2 ? 1 : (s2t2 > s2t1 ? 2 : 0);
    const set3Winner = s3t1 > s3t2 ? 1 : (s3t2 > s3t1 ? 2 : 0);

    // Count sets won
    let team1Sets = 0;
    let team2Sets = 0;
    if (set1Winner === 1) team1Sets++;
    if (set1Winner === 2) team2Sets++;
    if (set2Winner === 1) team1Sets++;
    if (set2Winner === 2) team2Sets++;
    if (set3Winner === 1) team1Sets++;
    if (set3Winner === 2) team2Sets++;

    // Calculate games won
    let team1Games = s1t1 + s2t1;
    let team2Games = s1t2 + s2t2;

    // Add set 3 games
    if (set3Team1 !== '' && set3Team2 !== '') {
      if (set3IsTiebreaker) {
        // 10-point tiebreaker: count actual tiebreaker points
        // e.g., 10-7 = 10 games for team1, 7 games for team2
        team1Games += s3t1;
        team2Games += s3t2;
      } else {
        // Regular set: count actual games
        team1Games += s3t1;
        team2Games += s3t2;
      }
    }

    // Determine match winner
    let winner = '';
    if (team1Sets > team2Sets) {
      winner = 'team1';
    } else if (team2Sets > team1Sets) {
      winner = 'team2';
    }

    return {
      winner,
      team1Sets: team1Sets.toString(),
      team2Sets: team2Sets.toString(),
      team1Games: team1Games.toString(),
      team2Games: team2Games.toString(),
      isValid: set1Winner !== 0 && set2Winner !== 0 && winner !== ''
    };
  };

  const getMatchResultsDisplay = () => {
    // Use the selected winner from the dropdown, not calculated from scores
    if (!matchFormData.matchWinner) return null;

    // Check if we have valid scores
    if (!matchFormData.set1Winner || !matchFormData.set1Loser ||
        !matchFormData.set2Winner || !matchFormData.set2Loser) {
      return null;
    }

    // Get the winning team name from the selected winner
    const winningTeam = teams.find(t =>
      t.id === parseInt(matchFormData.matchWinner === 'team1' ? matchFormData.team1Id : matchFormData.team2Id)
    );
    const winnerName = winningTeam?.name || 'Winner';

    // Build score display from winner's perspective (winner's score first)
    const setScores = [];
    if (matchFormData.set1Winner && matchFormData.set1Loser) {
      setScores.push(`${matchFormData.set1Winner}-${matchFormData.set1Loser}`);
    }
    if (matchFormData.set2Winner && matchFormData.set2Loser) {
      setScores.push(`${matchFormData.set2Winner}-${matchFormData.set2Loser}`);
    }
    if (matchFormData.set3Winner && matchFormData.set3Loser) {
      const set3Label = matchFormData.set3IsTiebreaker ? ' (TB)' : '';
      setScores.push(`${matchFormData.set3Winner}-${matchFormData.set3Loser}${set3Label}`);
    }

    return {
      winnerName,
      setScores: setScores.join(', ')
    };
  };

  const sendMatchNotifications = async (matchData, isEditing = false) => {
    // Send emails if captain is entering or editing a match
    if (userRole !== 'captain' || !captains) {
      return { success: true, message: '' };
    }

    try {
      // Find opponent team ID (the team that's not the captain's team)
      const opponentTeamId = matchData.team1Id === userTeamId ? matchData.team2Id : matchData.team1Id;

      // Find both captains
      const enteringCaptain = captains.find(c =>
        c.teamId === userTeamId &&
        c.status === 'active' &&
        c.email
      );

      const opponentCaptain = captains.find(c =>
        c.teamId === opponentTeamId &&
        c.status === 'active' &&
        c.email
      );

      // Get team names
      const senderTeam = teams.find(t => t.id === userTeamId)?.name || 'Unknown Team';
      const recipientTeam = teams.find(t => t.id === opponentTeamId)?.name || 'Unknown Team';

      // Format match scores
      const setScores = [];
      if (matchData.set1Team1 && matchData.set1Team2) {
        setScores.push(`${matchData.set1Team1}-${matchData.set1Team2}`);
      }
      if (matchData.set2Team1 && matchData.set2Team2) {
        setScores.push(`${matchData.set2Team1}-${matchData.set2Team2}`);
      }
      if (matchData.set3Team1 && matchData.set3Team2) {
        const tbLabel = matchData.set3IsTiebreaker ? ' (TB)' : '';
        setScores.push(`${matchData.set3Team1}-${matchData.set3Team2}${tbLabel}`);
      }
      const matchScores = setScores.join(', ');

      let emailsSent = 0;
      let emailsFailed = 0;
      let smsSent = 0;
      let smsFailed = 0;

      // Determine email type based on whether we're editing
      const emailType = isEditing ? 'edit' : 'confirmation';
      const emailTypeVerify = isEditing ? 'edit' : 'verification';

      // Send email to entering captain (confirmation or edit notification)
      if (enteringCaptain) {
        try {
          const confirmResponse = await fetch('/.netlify/functions/send-match-notification', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              recipientEmail: enteringCaptain.email,
              recipientName: enteringCaptain.name,
              senderTeam: senderTeam,
              recipientTeam: recipientTeam,
              matchScores: matchScores,
              matchDate: matchData.date,
              matchLevel: matchData.level,
              emailType: emailType,
              editorName: loginName
            })
          });

          if (confirmResponse.ok) {
            console.log(`${isEditing ? 'Edit' : 'Confirmation'} email sent to entering captain`);
            emailsSent++;
          } else {
            console.error(`Failed to send ${isEditing ? 'edit' : 'confirmation'} email:`, await confirmResponse.text());
            emailsFailed++;
          }
        } catch (error) {
          console.error(`Error sending ${isEditing ? 'edit' : 'confirmation'} email:`, error);
          emailsFailed++;
        }

        // Send SMS to entering captain if enabled (feature flag check)
        if (isSmsEnabled() && enteringCaptain.smsEnabled && enteringCaptain.phone) {
          try {
            const smsResponse = await fetch('/.netlify/functions/send-sms-notification', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                recipientPhone: enteringCaptain.phone,
                recipientName: enteringCaptain.name,
                senderTeam: senderTeam,
                recipientTeam: recipientTeam,
                matchScores: matchScores,
                matchDate: matchData.date,
                matchLevel: matchData.level,
                smsType: emailType,
                editorName: loginName
              })
            });

            if (smsResponse.ok) {
              console.log(`${isEditing ? 'Edit' : 'Confirmation'} SMS sent to entering captain`);
              smsSent++;
            } else {
              console.error(`Failed to send ${isEditing ? 'edit' : 'confirmation'} SMS:`, await smsResponse.text());
              smsFailed++;
            }
          } catch (error) {
            console.error(`Error sending ${isEditing ? 'edit' : 'confirmation'} SMS:`, error);
            smsFailed++;
          }
        }
      }

      // Send email to opponent captain (verification or edit notification)
      if (opponentCaptain) {
        try {
          const verifyResponse = await fetch('/.netlify/functions/send-match-notification', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              recipientEmail: opponentCaptain.email,
              recipientName: opponentCaptain.name,
              senderTeam: senderTeam,
              recipientTeam: recipientTeam,
              matchScores: matchScores,
              matchDate: matchData.date,
              matchLevel: matchData.level,
              emailType: emailTypeVerify,
              editorName: loginName
            })
          });

          if (verifyResponse.ok) {
            console.log(`${isEditing ? 'Edit' : 'Verification'} email sent to opponent captain`);
            emailsSent++;
          } else {
            console.error(`Failed to send ${isEditing ? 'edit' : 'verification'} email:`, await verifyResponse.text());
            emailsFailed++;
          }
        } catch (error) {
          console.error(`Error sending ${isEditing ? 'edit' : 'verification'} email:`, error);
          emailsFailed++;
        }

        // Send SMS to opponent captain if enabled (feature flag check)
        if (isSmsEnabled() && opponentCaptain.smsEnabled && opponentCaptain.phone) {
          try {
            const smsResponse = await fetch('/.netlify/functions/send-sms-notification', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                recipientPhone: opponentCaptain.phone,
                recipientName: opponentCaptain.name,
                senderTeam: senderTeam,
                recipientTeam: recipientTeam,
                matchScores: matchScores,
                matchDate: matchData.date,
                matchLevel: matchData.level,
                smsType: emailTypeVerify,
                editorName: loginName
              })
            });

            if (smsResponse.ok) {
              console.log(`${isEditing ? 'Edit' : 'Verification'} SMS sent to opponent captain`);
              smsSent++;
            } else {
              console.error(`Failed to send ${isEditing ? 'edit' : 'verification'} SMS:`, await smsResponse.text());
              smsFailed++;
            }
          } catch (error) {
            console.error(`Error sending ${isEditing ? 'edit' : 'verification'} SMS:`, error);
            smsFailed++;
          }
        }
      }

      // Return results
      const totalNotificationsSent = emailsSent + smsSent;
      const totalNotificationsFailed = emailsFailed + smsFailed;

      if (emailsSent === 2 && smsSent === 0) {
        const message = isEditing
          ? 'Match updated. Notification emails sent to both captains.'
          : 'Match saved. Confirmation emails sent to both captains.';
        return { success: true, message };
      } else if (totalNotificationsSent > 0) {
        const emailMsg = emailsSent > 0 ? `${emailsSent} email(s)` : '';
        const smsMsg = smsSent > 0 ? `${smsSent} SMS` : '';
        const notificationTypes = [emailMsg, smsMsg].filter(Boolean).join(' and ');

        const message = totalNotificationsFailed > 0
          ? `${isEditing ? 'Match updated' : 'Match saved'}. ${notificationTypes} sent, but some notifications failed.`
          : `${isEditing ? 'Match updated' : 'Match saved'}. Notifications sent: ${notificationTypes}.`;
        return { success: true, message };
      } else if (totalNotificationsFailed > 0) {
        const message = isEditing
          ? 'Match updated but notifications failed.'
          : 'Match saved but notifications failed.';
        return { success: false, message };
      } else {
        const message = isEditing
          ? 'Match updated. No captains with notification preferences found.'
          : 'Match saved. No captains with notification preferences found.';
        return { success: true, message };
      }

    } catch (error) {
      console.error('Error sending match notifications:', error);
      return { success: false, message: 'Match saved but notifications failed.' };
    }
  };

  // Helper function to get user info for logging
  const getUserInfo = () => {
    if (userRole === 'captain') {
      const captain = captains?.find(c => c.teamId === userTeamId);
      return { name: captain?.name || loginName || 'Unknown', role: 'captain' };
    }
    return { name: loginName || 'Director', role: 'director' };
  };

  // Calculate combined NTRP for players
  const calculateCombinedNTRP = (playerIds, matchType = MATCH_TYPES.DOUBLES) => {
    return calcCombinedNTRP(playerIds, players, matchType);
  };

  // Create Pending Match directly (outside challenge system)
  const handleCreatePendingMatch = async () => {
    // Validation
    if (!pendingMatchFormData.opponentTeamId) {
      showError('Please select an opposing team.');
      return;
    }

    if (!pendingMatchFormData.scheduledDate) {
      showError('Please select a match date.');
      return;
    }

    if (!pendingMatchFormData.level) {
      showError('Please select a match level.');
      return;
    }

    // Validate player selection for captain's team
    const matchType = pendingMatchFormData.matchType || MATCH_TYPES.DOUBLES;
    const requiredCount = getRequiredPlayerCount(matchType);

    if (pendingMatchFormData.team1Players.length !== requiredCount) {
      showError(getPlayerSelectionError(matchType));
      return;
    }

    // Validate NTRP for captain's team
    const team1CombinedNTRP = calculateCombinedNTRP(pendingMatchFormData.team1Players, matchType);
    const maxNTRP = parseFloat(pendingMatchFormData.level);
    if (team1CombinedNTRP > maxNTRP) {
      showError(`${matchType === MATCH_TYPES.SINGLES ? 'Player rating' : 'Combined NTRP'} (${team1CombinedNTRP.toFixed(1)}) exceeds match level (${maxNTRP}). Please select different players.`);
      return;
    }

    // Opponent players are optional at creation - can be added later
    if (pendingMatchFormData.team2Players.length > 0 && pendingMatchFormData.team2Players.length !== requiredCount) {
      showError(`Opponent team must have 0 or ${requiredCount} player${requiredCount > 1 ? 's' : ''} selected.`);
      return;
    }

    try {
      console.log('📋 Creating pending match...');

      // Generate Match ID for the pending match
      const generatedMatchId = generateMatchId(matches || []);
      console.log('🆔 Generated Match ID for pending match:', generatedMatchId);

      // Also generate Challenge ID for tracking purposes (maintains compatibility)
      const generatedChallengeId = generateChallengeId(challenges || []);
      console.log('🆔 Generated Challenge ID for tracking:', generatedChallengeId);

      const newPendingMatch = {
        id: Date.now(),
        matchId: generatedMatchId, // Primary identifier - Match ID
        challengeId: generatedChallengeId, // Secondary identifier for tracking
        matchType: matchType,
        challengerTeamId: userTeamId, // Captain's team
        challengedTeamId: parseInt(pendingMatchFormData.opponentTeamId),
        status: 'accepted', // Goes directly to pending status
        origin: 'direct', // Track that this was created directly, not from challenge
        proposedLevel: pendingMatchFormData.level,
        acceptedLevel: pendingMatchFormData.level,
        proposedDate: pendingMatchFormData.scheduledDate,
        acceptedDate: pendingMatchFormData.scheduledDate,
        challengerPlayers: pendingMatchFormData.team1Players,
        challengedPlayers: pendingMatchFormData.team2Players,
        combinedNTRP: team1CombinedNTRP,
        challengedCombinedNTRP: pendingMatchFormData.team2Players.length === requiredCount
          ? calculateCombinedNTRP(pendingMatchFormData.team2Players, matchType)
          : 0,
        notes: pendingMatchFormData.notes.trim(),
        createdBy: getUserInfo()?.name || 'Unknown',
        createdAt: new Date().toISOString(),
        acceptedBy: getUserInfo()?.name || 'Unknown', // Same person since it's direct creation
        acceptedAt: new Date().toISOString()
      };

      // Add to challenges array (local state only - user will click "Save Data" to persist)
      const updatedChallenges = challenges ? [...challenges, newPendingMatch] : [newPendingMatch];

      // Update local state
      onChallengesChange(updatedChallenges);
      console.log('✅ Pending match created in local state!');

      // Get team names for notifications and logging
      const team1 = teams.find(t => t.id === userTeamId);
      const team2 = teams.find(t => t.id === parseInt(pendingMatchFormData.opponentTeamId));
      const team1Name = team1?.name || 'Unknown Team';
      const team2Name = team2?.name || 'Unknown Team';

      // Send notifications to opponent captain
      const opponentCaptain = captains?.find(c =>
        c.teamId === parseInt(pendingMatchFormData.opponentTeamId) &&
        c.status === 'active'
      );

      let notificationSent = false;

      if (opponentCaptain && opponentCaptain.email) {
        // Send email notification
        try {
          const emailResponse = await fetch('/.netlify/functions/send-match-notification', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              recipientEmail: opponentCaptain.email,
              recipientName: opponentCaptain.name,
              senderTeam: team1Name,
              recipientTeam: team2Name,
              matchScores: '', // No scores yet, it's pending
              matchDate: pendingMatchFormData.scheduledDate,
              matchLevel: pendingMatchFormData.level,
              emailType: 'pending_match_created',
              editorName: getUserInfo()?.name || 'Unknown'
            })
          });

          if (emailResponse.ok) {
            console.log('Pending match notification email sent to opponent captain');
            notificationSent = true;
          }
        } catch (error) {
          console.error('Error sending pending match email notification:', error);
        }

        // Send SMS if enabled and captain has opted in
        if (isSmsEnabled() && opponentCaptain.smsEnabled && opponentCaptain.phone) {
          try {
            const smsResponse = await fetch('/.netlify/functions/send-sms-notification', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                recipientPhone: opponentCaptain.phone,
                recipientName: opponentCaptain.name,
                senderTeam: team1Name,
                recipientTeam: team2Name,
                proposedDate: pendingMatchFormData.scheduledDate,
                matchLevel: pendingMatchFormData.level,
                smsType: 'pending_match_created'
              })
            });

            if (smsResponse.ok) {
              console.log('Pending match SMS notification sent to opponent captain');
              notificationSent = true;
            }
          } catch (error) {
            console.error('Error sending pending match SMS notification:', error);
          }
        }
      }

      // Activity logging
      if (addLog) {
        await addLog(
          ACTION_TYPES.PENDING_MATCH_CREATED,
          {
            team1Name,
            team2Name,
            level: pendingMatchFormData.level,
            scheduledDate: pendingMatchFormData.scheduledDate,
            origin: 'direct'
          },
          newPendingMatch.id
        );
      }

      // Reset form and close
      setPendingMatchFormData({
        matchType: MATCH_TYPES.DOUBLES,
        opponentTeamId: '',
        scheduledDate: new Date().toISOString().split('T')[0],
        level: getDefaultLevel(MATCH_TYPES.DOUBLES),
        team1Players: [],
        team2Players: [],
        notes: ''
      });
      setShowPendingMatchForm(false);

      // Success message
      const notifMsg = notificationSent
        ? ' Notification sent to opponent captain.'
        : ' (Note: No notification sent - captain not found or no contact info.)';

      console.log('==========================');
      console.log('✅ Pending Match Created!');
      console.log('==========================');
      console.log('Teams:', `${team1Name} vs ${team2Name}`);
      console.log('Date:', pendingMatchFormData.scheduledDate);
      console.log('Level:', pendingMatchFormData.level);
      console.log('Origin:', 'direct');
      console.log('Notification sent:', notificationSent);
      console.log('⚠️ Don\'t forget to click "Save Data" to persist to Firebase!');
      console.log('==========================');

      showSuccess(`Match scheduled successfully!${notifMsg} The match will appear in Pending Matches below. IMPORTANT: Click "Save Data" to persist to database.`, 6000);

    } catch (error) {
      console.error('Error creating pending match:', error);
      console.error('Error details:', {
        message: error.message,
        stack: error.stack,
        formData: pendingMatchFormData
      });
      showError(`Failed to schedule match: ${error.message}. Please try again or contact the tournament director.`);
    }
  };

  // Resize and compress image (same logic as MediaGallery)
  const processImage = (imageDataUrl) => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        // Calculate new dimensions (max 1920x1080)
        let width = img.width;
        let height = img.height;
        const maxWidth = 1920;
        const maxHeight = 1080;

        if (width > maxWidth || height > maxHeight) {
          const ratio = Math.min(maxWidth / width, maxHeight / height);
          width = Math.floor(width * ratio);
          height = Math.floor(height * ratio);
        }

        canvas.width = width;
        canvas.height = height;

        // Draw image
        ctx.drawImage(img, 0, 0, width, height);

        // Compress to target 300-500KB
        let quality = 0.9;
        let compressedDataUrl = canvas.toDataURL('image/jpeg', quality);

        // Iteratively reduce quality if needed
        while (compressedDataUrl.length > 500 * 1024 * 1.37 && quality > 0.5) {
          quality -= 0.05;
          compressedDataUrl = canvas.toDataURL('image/jpeg', quality);
        }

        resolve(compressedDataUrl);
      };
      img.src = imageDataUrl;
    });
  };

  const handleSaveMatch = async () => {
    if (!matchFormData.team1Id || !matchFormData.team2Id) {
      showError('Please select both teams.');
      return;
    }
    if (matchFormData.team1Id === matchFormData.team2Id) {
      showError('Teams must be different.');
      return;
    }

    // Validate set scores
    const results = calculateMatchResults();
    if (!results.isValid) {
      showError('Please enter valid set scores. You must enter scores for at least 2 sets with clear winners.');
      return;
    }

    // Set loading state
    setIsSaving(true);

    // Additional validation for winner-centric scoring
    if (matchFormData.matchWinner && matchFormData.set1Winner && matchFormData.set2Winner) {
      // Determine who won each set
      const set1WinnerWon = parseInt(matchFormData.set1Winner) > parseInt(matchFormData.set1Loser);
      const set2WinnerWon = parseInt(matchFormData.set2Winner) > parseInt(matchFormData.set2Loser);

      // Check if sets are split (1-1)
      const setsSplit = set1WinnerWon !== set2WinnerWon;

      // If sets are split, third set is REQUIRED
      if (setsSplit && (!matchFormData.set3Winner || !matchFormData.set3Loser)) {
        showError('Sets are split 1-1. A third set (match tiebreak) is required. Enter 1-0 for the tiebreak winner.');
        setIsSaving(false);
        return;
      }

      // If sets are NOT split (winner won both), third set should NOT be entered
      if (!setsSplit && matchFormData.set3Winner && matchFormData.set3Loser) {
        showError('The selected winner won both sets. A third set should not be entered.');
        setIsSaving(false);
        return;
      }

      // If third set is entered, validate that the selected winner actually won 2 out of 3 sets
      if (matchFormData.set3Winner && matchFormData.set3Loser) {
        const set3WinnerWon = parseInt(matchFormData.set3Winner) > parseInt(matchFormData.set3Loser);

        // Count how many sets the selected winner won
        let selectedWinnerSetsWon = 0;
        if (set1WinnerWon) selectedWinnerSetsWon++;
        if (set2WinnerWon) selectedWinnerSetsWon++;
        if (set3WinnerWon) selectedWinnerSetsWon++;

        if (selectedWinnerSetsWon < 2) {
          showError('The selected winner did not win 2 out of 3 sets. Please check your scores or select the correct winner.');
          setIsSaving(false);
          return;
        }
      }
    }

    // Determine if this is a pending match or a regular edit
    const isPendingMatch = editingMatch && editingMatch.isPendingMatch;

    // For pending matches, generate a NEW match ID. For edits, use existing ID.
    const matchId = (editingMatch && !isPendingMatch) ? editingMatch.id : Date.now();

    // Generate readable Match ID
    const matchIdReadable = (editingMatch && !isPendingMatch && editingMatch.matchId)
      ? editingMatch.matchId
      : generateMatchId(matches);

    console.log('🆔 Match ID Generation:', {
      isNewMatch: !editingMatch || isPendingMatch,
      isPendingMatch,
      editingMatchId: editingMatch?.matchId,
      generatedMatchId: matchIdReadable,
      existingMatchesCount: matches.length
    });

    const matchData = {
      matchType: matchFormData.matchType || MATCH_TYPES.DOUBLES,
      date: matchFormData.date,
      level: matchFormData.level,
      team1Id: parseInt(matchFormData.team1Id),
      team2Id: parseInt(matchFormData.team2Id),
      winner: results.winner,
      team1Sets: results.team1Sets,
      team2Sets: results.team2Sets,
      team1Games: results.team1Games,
      team2Games: results.team2Games,
      set1Team1: matchFormData.set1Team1,
      set1Team2: matchFormData.set1Team2,
      set2Team1: matchFormData.set2Team1,
      set2Team2: matchFormData.set2Team2,
      set3Team1: matchFormData.set3Team1,
      set3Team2: matchFormData.set3Team2,
      set3IsTiebreaker: matchFormData.set3IsTiebreaker,
      team1Players: matchFormData.team1Players,
      team2Players: matchFormData.team2Players,
      notes: matchFormData.notes.trim(),
      timestamp: new Date().toISOString(),
      fromChallenge: isPendingMatch, // Flag to indicate this came from a challenge
      matchId: matchIdReadable, // Readable Match ID
      originChallengeId: isPendingMatch && editingMatch ? editingMatch.challengeId : null, // Track original challenge ID
      scheduledDate: isPendingMatch && editingMatch ? editingMatch.acceptedDate : null // Preserve the originally scheduled date from challenge
    };

    // Debug: Log match save information
    console.log('=== Match Save Debug ===');
    console.log('Is Pending Match:', isPendingMatch);
    console.log('Match ID:', matchId);
    console.log('Team 1 ID:', matchData.team1Id, '(type:', typeof matchData.team1Id, ')');
    console.log('Team 2 ID:', matchData.team2Id, '(type:', typeof matchData.team2Id, ')');
    console.log('Team 1 Players:', matchData.team1Players);
    console.log('Team 2 Players:', matchData.team2Players);
    console.log('Set 3 Team 1 Score:', matchFormData.set3Team1);
    console.log('Set 3 Team 2 Score:', matchFormData.set3Team2);
    console.log('Set 3 Is Tiebreaker:', matchFormData.set3IsTiebreaker);
    console.log('Total Team 1 Sets:', results.team1Sets);
    console.log('Total Team 2 Sets:', results.team2Sets);
    console.log('Total Team 1 Games:', results.team1Games);
    console.log('Total Team 2 Games:', results.team2Games);
    console.log('Winner:', results.winner);
    console.log('Match Data to Save:', matchData);
    console.log('=======================');

    // Create complete match object
    const newMatch = {
      id: matchId,
      ...matchData
    };

    // Use Firestore transaction to save match results atomically
    console.log('🔐 Saving match results using Firestore transaction...');
    try {
      const result = await tournamentStorage.submitMatchResultsTransaction(
        newMatch,
        isPendingMatch,
        isPendingMatch ? editingMatch.id : null,
        loginName || 'Unknown'
      );

      if (!result.success) {
        // Handle different error types
        if (result.alreadyCompleted) {
          showError(`Match already entered! ${result.message}. Refreshing data...`, 6000);
          // Refresh both challenges and matches from server
          const [latestChallengesData, latestMatchesData] = await Promise.all([
            tournamentStorage.getChallenges(),
            tournamentStorage.getMatches()
          ]);
          if (latestChallengesData && onChallengesChange) {
            onChallengesChange(JSON.parse(latestChallengesData.data));
          }
          if (latestMatchesData) {
            setMatches(JSON.parse(latestMatchesData.data));
          }
        } else if (result.notFound) {
          showError(`Challenge not found! ${result.message}. Refreshing data...`, 6000);
          const latestChallengesData = await tournamentStorage.getChallenges();
          if (latestChallengesData && onChallengesChange) {
            onChallengesChange(JSON.parse(latestChallengesData.data));
          }
        } else if (result.statusChanged) {
          showError(`Challenge status changed! ${result.message}. Refreshing data...`, 6000);
          const latestChallengesData = await tournamentStorage.getChallenges();
          if (latestChallengesData && onChallengesChange) {
            onChallengesChange(JSON.parse(latestChallengesData.data));
          }
        } else {
          showError(`Failed to save match results: ${result.message}. Please try again.`);
        }
        setIsSaving(false);
        setShowMatchForm(false);
        setEditingMatch(null);
        return;
      }

      console.log('✅ Match results saved successfully via transaction!');

      // Update local state with the result from transaction
      if (editingMatch && !isPendingMatch) {
        // This was editing an existing match
        setMatches(matches.map(m =>
          m.id === editingMatch.id ? newMatch : m
        ));
      } else {
        // This was a new match
        setMatches([...matches, newMatch]);
      }

      // Update challenges if this was a pending match
      if (isPendingMatch && result.updatedChallenge && onChallengesChange) {
        const updatedChallenges = challenges.map(c =>
          c.id === editingMatch.id ? result.updatedChallenge : c
        );
        onChallengesChange(updatedChallenges);
      }
    } catch (error) {
      console.error('❌ Error in match results submission:', error);
      showError('Unexpected error saving match results. Please refresh the page and try again.');
      setIsSaving(false);
      setShowMatchForm(false);
      setEditingMatch(null);
      return;
    }

    // Handle photo upload if present
    if (photoFile && photoPreview && onAddPhoto) {
      try {
        console.log('📸 Processing and uploading match photo to Firebase Storage...');

        // Process image (resize/compress)
        const processedImage = await processImage(photoPreview);

        // Generate unique photo ID and storage path
        const photoId = Date.now().toString();
        const storagePath = `photos/${photoId}.jpg`;

        // Upload to Firebase Storage
        console.log('📤 Uploading to Firebase Storage:', storagePath);
        const imageUrl = await imageStorage.uploadImage(processedImage, storagePath);
        console.log('✅ Upload successful. Download URL:', imageUrl);

        // Get team names for display
        const team1 = teams.find(t => t.id === parseInt(matchFormData.team1Id));
        const team2 = teams.find(t => t.id === parseInt(matchFormData.team2Id));

        const photoData = {
          id: photoId,
          matchId: matchId,
          imageUrl: imageUrl, // Store download URL instead of base64
          storagePath: storagePath, // Store path for deletion
          caption: null, // No custom caption for match photos
          team1Id: parseInt(matchFormData.team1Id),
          team2Id: parseInt(matchFormData.team2Id),
          team1Name: team1 ? team1.name : 'Team 1',
          team2Name: team2 ? team2.name : 'Team 2',
          matchDate: matchFormData.date,
          uploaderName: loginName,
          uploadTimestamp: new Date().toISOString(),
          // Store all match scoring details
          winner: results.winner,
          set1Team1: matchFormData.set1Team1,
          set1Team2: matchFormData.set1Team2,
          set2Team1: matchFormData.set2Team1,
          set2Team2: matchFormData.set2Team2,
          set3Team1: matchFormData.set3Team1,
          set3Team2: matchFormData.set3Team2,
          set3IsTiebreaker: matchFormData.set3IsTiebreaker
        };

        await onAddPhoto(photoData);
        console.log('✅ Photo metadata saved to Firestore');
      } catch (error) {
        console.error('❌ Error uploading match photo:', error);
        showError('Failed to upload match photo. The match was saved but the photo upload failed. Please try uploading the photo separately via the Media Gallery.', 6000);
      }
    }

    // Add to activity log if this was from a pending match
    if (isPendingMatch && addLog) {
      const team1Name = teams.find(t => t.id === matchData.team1Id)?.name || 'Team 1';
      const team2Name = teams.find(t => t.id === matchData.team2Id)?.name || 'Team 2';
      await addLog(
        ACTION_TYPES.MATCH_CREATED,
        {
          matchId: matchId,
          teams: `${team1Name} vs ${team2Name}`,
          fromChallenge: true
        },
        matchId
      );
    }

    // Send email notifications if captain
    // For pending matches being entered, treat as new (not edit)
    const isEditForEmail = editingMatch && !isPendingMatch;
    const emailResult = await sendMatchNotifications(matchData, isEditForEmail);

    // Show appropriate success message
    if (isPendingMatch) {
      showSuccess('Match results saved successfully! Leaderboard updated.');
    } else if (userRole === 'captain' && emailResult.message) {
      showSuccess(emailResult.message);
    } else if (editingMatch) {
      showSuccess('Match updated successfully!');
    } else {
      showSuccess('Match saved successfully!');
    }

    // Final verification
    console.log('=== Match Save Complete ===');
    console.log('Match ID:', matchId);
    console.log('Match saved as:', isPendingMatch ? 'NEW from challenge' : (editingMatch ? 'EDITED existing' : 'NEW'));
    if (isPendingMatch) {
      console.log('Challenge marked as completed');
    }
    console.log('Don\'t forget to click "Save Data" to persist to Firebase!');
    console.log('==========================');

    setIsSaving(false);
    setShowMatchForm(false);
    setEditingMatch(null);
    setPhotoFile(null);
    setPhotoPreview(null);
    setAllowPlayerEdit(false);

    // Reset form data after modal closes (delay to allow animation)
    setTimeout(() => {
      setMatchFormData({
        matchType: MATCH_TYPES.DOUBLES,
        date: new Date().toISOString().split('T')[0],
        level: getDefaultLevel(MATCH_TYPES.DOUBLES),
        team1Id: '',
        team2Id: '',
        matchWinner: '',
        set1Winner: '',
        set1Loser: '',
        set2Winner: '',
        set2Loser: '',
        set3Winner: '',
        set3Loser: '',
        set1Team1: '',
        set1Team2: '',
        set2Team1: '',
        set2Team2: '',
        set3Team1: '',
        set3Team2: '',
        set3IsTiebreaker: false,
        team1Players: [],
        team2Players: [],
        notes: ''
      });
    }, 300);
  };

  const handleAddNewMatch = () => {
    setShowMatchForm(true);
    setEditingMatch(null);
    setMatchFormData({
      matchType: MATCH_TYPES.DOUBLES,
      date: new Date().toISOString().split('T')[0],
      level: getDefaultLevel(MATCH_TYPES.DOUBLES),
      team1Id: userRole === 'captain' && userTeamId ? userTeamId.toString() : '', // Auto-select captain's team
      team2Id: '',
      matchWinner: '',
      set1Winner: '',
      set1Loser: '',
      set2Winner: '',
      set2Loser: '',
      set3Winner: '',
      set3Loser: '',
      set1Team1: '',
      set1Team2: '',
      set2Team1: '',
      set2Team2: '',
      set3Team1: '',
      set3Team2: '',
      set3IsTiebreaker: false,
      team1Players: [],
      team2Players: [],
      notes: ''
    });
    setPhotoFile(null);
    setPhotoPreview(null);
    setAllowPlayerEdit(false);
  };

  const getTeamPlayers = (teamId) => {
    if (!teamId || !players) return [];
    return players.filter(p => p.teamId === parseInt(teamId) && p.status === 'active');
  };

  const handlePhotoUpload = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      showError('Invalid file type. Please upload an image file (PNG, JPG, or WEBP).');
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      showError('File size exceeds 5MB limit. Please select a smaller image file.');
      return;
    }

    setPhotoFile(file);

    // Create preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setPhotoPreview(reader.result);
    };
    reader.readAsDataURL(file);
  };

  const handleRemovePhoto = () => {
    setPhotoFile(null);
    setPhotoPreview(null);
  };

  const handlePlayerToggle = (playerId, teamNumber) => {
    const field = teamNumber === 1 ? 'team1Players' : 'team2Players';
    const currentPlayers = matchFormData[field];
    const requiredCount = getRequiredPlayerCount(matchFormData.matchType);

    if (currentPlayers.includes(playerId)) {
      // Remove player
      setMatchFormData({
        ...matchFormData,
        [field]: currentPlayers.filter(id => id !== playerId)
      });
    } else {
      // Add player - check limit based on match type
      if (currentPlayers.length >= requiredCount) {
        showError(getPlayerLimitAlert(matchFormData.matchType));
        return;
      }
      setMatchFormData({
        ...matchFormData,
        [field]: [...currentPlayers, playerId]
      });
    }
  };

  const team1Players = getTeamPlayers(matchFormData.team1Id);
  const team2Players = getTeamPlayers(matchFormData.team2Id);

  // Get pending matches from accepted challenges
  const getPendingMatches = () => {
    if (!challenges) return [];
    if (!isAuthenticated) return [];

    const accepted = challenges.filter(c => c.status === 'accepted');

    if (userRole === 'director') {
      return accepted;
    }

    if (userRole === 'captain') {
      return accepted.filter(c =>
        c.challengerTeamId === userTeamId || c.challengedTeamId === userTeamId
      );
    }

    return [];
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

  // Handle entering results for a pending match
  const handleEnterPendingResults = (pendingMatch) => {
    // Open the MatchResultsModal with the pending match data
    setSelectedPendingMatch(pendingMatch);
    setShowResultsModal(true);
  };

  // Handle match result submission from MatchResultsModal
  const handleSubmitPendingResults = async (matchResult) => {
    if (!selectedPendingMatch) return;

    // Determine which team is team1 and team2
    const team1Id = selectedPendingMatch.challengerTeamId;
    const team2Id = selectedPendingMatch.challengedTeamId;

    // Create new completed match
    const newMatch = {
      id: Date.now(),
      matchId: matchResult.matchId,
      matchType: getMatchType(selectedPendingMatch),
      date: matchResult.date,
      level: matchResult.level,
      team1Id,
      team2Id,
      ...matchResult,
      team1Players: selectedPendingMatch.challengerPlayers || [],
      team2Players: selectedPendingMatch.challengedPlayers || [],
      originChallengeId: selectedPendingMatch.challengeId,
      scheduledDate: selectedPendingMatch.acceptedDate,
      fromChallenge: true,
      timestamp: matchResult.timestamp
    };

    // Add to matches
    const updatedMatches = [...matches, newMatch];
    setMatches(updatedMatches);

    // Remove from challenges
    const updatedChallenges = challenges.filter(c => c.id !== selectedPendingMatch.id);
    onChallengesChange(updatedChallenges);

    // Log activity
    if (addLog) {
      const team1 = teams.find(t => t.id === team1Id);
      const team2 = teams.find(t => t.id === team2Id);
      const winnerTeam = matchResult.winner === 'team1' ? team1 : team2;
      const scores = `${matchResult.set1Team1}-${matchResult.set1Team2}, ${matchResult.set2Team1}-${matchResult.set2Team2}${matchResult.set3Team1 ? `, ${matchResult.set3Team1}-${matchResult.set3Team2}` : ''}`;

      addLog(
        ACTION_TYPES.MATCH_COMPLETED,
        {
          matchId: matchResult.matchId,
          team1Name: team1?.name || 'Team 1',
          team2Name: team2?.name || 'Team 2',
          winnerTeamName: winnerTeam?.name || 'Unknown',
          winner: matchResult.winner,
          scores: scores,
          level: matchResult.level,
          matchType: getMatchType(selectedPendingMatch),
          fromChallenge: true,
          originChallengeId: selectedPendingMatch.challengeId
        },
        newMatch.id
      );
    }

    // Close modal
    setShowResultsModal(false);
    setSelectedPendingMatch(null);

    // Show success notification
    showSuccess('Match results saved successfully! Leaderboard updated. IMPORTANT: Click "Save Data" to persist to database.', 6000);
  };

  // Close results modal
  const handleCloseResultsModal = () => {
    setShowResultsModal(false);
    setSelectedPendingMatch(null);
  };

  // Handle deleting a pending match (directors only)
  const handleDeletePendingMatch = (pendingMatch) => {
    if (userRole !== 'director') {
      showError('Only tournament directors can delete pending matches.');
      return;
    }

    const team1Name = getTeamName(pendingMatch.challengerTeamId);
    const team2Name = getTeamName(pendingMatch.challengedTeamId);
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

    showSuccess('Pending match deleted successfully. IMPORTANT: Click "Save Data" to persist to database.', 6000);
  };

  // Helper function to get team name
  const getTeamName = (teamId) => {
    const team = teams.find(t => t.id === teamId);
    return team ? team.name : 'Unknown Team';
  };

  // Helper function to get player names
  const getPlayerNames = (playerIds) => {
    if (!playerIds || playerIds.length === 0) return [];
    return playerIds.map(id => {
      const player = players.find(p => p.id === id);
      return player ? {
        name: `${player.firstName} ${player.lastName}`,
        rating: player.ntrpRating,
        gender: player.gender
      } : null;
    }).filter(p => p !== null);
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <Calendar className="w-6 h-6" />
          Record Match Result
        </h2>
        <div className="flex gap-2">
          {isAuthenticated && !showMatchForm && !showPendingMatchForm && userRole === 'captain' && userTeamId && (
            <button
              onClick={() => setShowPendingMatchForm(true)}
              className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 flex items-center gap-2"
            >
              <Calendar className="w-4 h-4" />
              Schedule Match
            </button>
          )}
          {isAuthenticated && !showMatchForm && !showPendingMatchForm && (userRole !== 'captain' || userTeamId) && (
            <button
              onClick={handleAddNewMatch}
              className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Record Match Results
            </button>
          )}
        </div>
      </div>

      {!isAuthenticated && (
        <div className="bg-yellow-50 border border-yellow-200 rounded p-4">
          <p className="text-sm text-yellow-800">Directors must login to record matches.</p>
        </div>
      )}

      {isAuthenticated && userRole === 'captain' && !userTeamId && (
        <div className="bg-orange-50 border border-orange-300 rounded p-4">
          <p className="text-sm text-orange-800">
            <strong>You are not assigned to a team.</strong>
            <br />
            Please contact the tournament directors to be assigned to a team before you can enter matches.
          </p>
        </div>
      )}

      {/* Create Pending Match Form - For captains to schedule matches directly */}
      {showPendingMatchForm && userRole === 'captain' && userTeamId && (
        <div className="bg-blue-50 border-2 border-blue-300 rounded-lg p-6 mb-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-xl font-bold text-blue-800 flex items-center gap-2">
              <Calendar className="w-5 h-5" />
              Schedule Match with Another Team
            </h3>
            <button
              onClick={() => {
                setShowPendingMatchForm(false);
                setPendingMatchFormData({
                  matchType: MATCH_TYPES.DOUBLES,
                  opponentTeamId: '',
                  scheduledDate: new Date().toISOString().split('T')[0],
                  level: getDefaultLevel(MATCH_TYPES.DOUBLES),
                  team1Players: [],
                  team2Players: [],
                  notes: ''
                });
              }}
              className="text-gray-500 hover:text-gray-700"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="bg-blue-100 border border-blue-200 rounded p-3 mb-4">
            <p className="text-sm text-blue-900">
              <strong>Use this to add a match you've arranged directly with another team.</strong>
              <br />
              The opponent captain will be notified, and either captain can enter results when the match is played.
            </p>
          </div>

          <div className="space-y-4">
            {/* Match Type Selection */}
            <div>
              <label className="block text-sm font-semibold mb-1">Match Type *</label>
              <select
                value={pendingMatchFormData.matchType}
                onChange={(e) => setPendingMatchFormData({
                  ...pendingMatchFormData,
                  matchType: e.target.value,
                  level: getDefaultLevel(e.target.value), // Reset level based on new match type
                  team1Players: [], // Reset player selections when match type changes
                  team2Players: []
                })}
                className="w-full px-3 py-2 border rounded"
              >
                <option value={MATCH_TYPES.DOUBLES}>Doubles</option>
                <option value={MATCH_TYPES.SINGLES}>Singles</option>
              </select>
            </div>

            {/* Opponent Team Selection */}
            <div>
              <label className="block text-sm font-semibold mb-1">Opponent Team *</label>
              <select
                value={pendingMatchFormData.opponentTeamId}
                onChange={(e) => setPendingMatchFormData({ ...pendingMatchFormData, opponentTeamId: e.target.value, team2Players: [] })}
                className="w-full px-3 py-2 border rounded"
              >
                <option value="">Select opponent team...</option>
                {teams
                  .filter(t => t.id !== userTeamId)
                  .sort((a, b) => a.name.localeCompare(b.name))
                  .map(team => (
                    <option key={team.id} value={team.id}>
                      {team.name}
                    </option>
                  ))}
              </select>
            </div>

            {/* Date and Level */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold mb-1">Match Date *</label>
                <input
                  type="date"
                  value={pendingMatchFormData.scheduledDate}
                  onChange={(e) => setPendingMatchFormData({ ...pendingMatchFormData, scheduledDate: e.target.value })}
                  className="w-full px-3 py-2 border rounded"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold mb-1">
                  Match Level * {pendingMatchFormData.matchType === MATCH_TYPES.SINGLES ? '(Individual NTRP)' : '(Combined NTRP)'}
                </label>
                <select
                  value={pendingMatchFormData.level}
                  onChange={(e) => setPendingMatchFormData({ ...pendingMatchFormData, level: e.target.value })}
                  className="w-full px-3 py-2 border rounded"
                >
                  {getLevelOptions(pendingMatchFormData.matchType).map(level => (
                    <option key={level} value={level}>{level}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Your Team Players */}
            <div>
              <label className="block text-sm font-semibold mb-2">
                Your Team Players * ({getPlayerSelectionLabel(pendingMatchFormData.matchType)})
              </label>
              <div className="max-h-60 overflow-y-auto p-3 border rounded bg-white space-y-1">
                {(() => {
                  const requiredCount = getRequiredPlayerCount(pendingMatchFormData.matchType);
                  return players
                    .filter(p => p.teamId === userTeamId)
                    .sort((a, b) => `${a.lastName}${a.firstName}`.localeCompare(`${b.lastName}${b.firstName}`))
                    .map(player => (
                      <label key={player.id} className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-2 rounded">
                        <input
                          type="checkbox"
                          checked={pendingMatchFormData.team1Players.includes(player.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              // Limit based on match type
                              if (pendingMatchFormData.team1Players.length >= requiredCount) {
                                showError(getPlayerLimitAlert(pendingMatchFormData.matchType));
                                return;
                              }
                            setPendingMatchFormData({
                              ...pendingMatchFormData,
                              team1Players: [...pendingMatchFormData.team1Players, player.id]
                            });
                          } else {
                            setPendingMatchFormData({
                              ...pendingMatchFormData,
                              team1Players: pendingMatchFormData.team1Players.filter(id => id !== player.id)
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
                  const requiredCount = getRequiredPlayerCount(pendingMatchFormData.matchType);
                  const matchType = pendingMatchFormData.matchType;
                  return (
                    <>
                      <p className="text-sm text-gray-600">
                        Selected: {pendingMatchFormData.team1Players.length} / {requiredCount} player{requiredCount > 1 ? 's' : ''}
                      </p>
                      {pendingMatchFormData.team1Players.length === requiredCount && (
                        <div className={`text-sm font-medium ${
                          calculateCombinedNTRP(pendingMatchFormData.team1Players, matchType) <= parseFloat(pendingMatchFormData.level)
                            ? 'text-green-600'
                            : 'text-red-600'
                        }`}>
                          {matchType === MATCH_TYPES.SINGLES ? 'Player Rating' : 'Combined NTRP'}: {calculateCombinedNTRP(pendingMatchFormData.team1Players, matchType).toFixed(1)}
                          {calculateCombinedNTRP(pendingMatchFormData.team1Players, matchType) > parseFloat(pendingMatchFormData.level) && (
                            <span className="block text-xs mt-0.5">
                              ⚠️ Exceeds match level ({pendingMatchFormData.level})
                            </span>
                          )}
                        </div>
                      )}
                    </>
                  );
                })()}
              </div>
            </div>

            {/* Opponent Team Players (Optional) */}
            {pendingMatchFormData.opponentTeamId && (
              <div>
                <label className="block text-sm font-semibold mb-2">
                  Opponent Team Players (Optional - can be set later)
                </label>
                <div className="max-h-60 overflow-y-auto p-3 border rounded bg-white space-y-1">
                  {players
                    .filter(p => p.teamId === parseInt(pendingMatchFormData.opponentTeamId))
                    .sort((a, b) => `${a.lastName}${a.firstName}`.localeCompare(`${b.lastName}${b.firstName}`))
                    .map(player => (
                      <label key={player.id} className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-2 rounded">
                        <input
                          type="checkbox"
                          checked={pendingMatchFormData.team2Players.includes(player.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              // Limit to 2 players
                              if (pendingMatchFormData.team2Players.length >= 2) {
                                showError('You can only select 2 players for doubles.');
                                return;
                              }
                              setPendingMatchFormData({
                                ...pendingMatchFormData,
                                team2Players: [...pendingMatchFormData.team2Players, player.id]
                              });
                            } else {
                              setPendingMatchFormData({
                                ...pendingMatchFormData,
                                team2Players: pendingMatchFormData.team2Players.filter(id => id !== player.id)
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
                    Selected: {pendingMatchFormData.team2Players.length} / 2 players
                  </p>
                  {pendingMatchFormData.team2Players.length === 2 && (
                    <div className={`text-sm font-medium ${
                      calculateCombinedNTRP(pendingMatchFormData.team2Players) <= parseFloat(pendingMatchFormData.level)
                        ? 'text-green-600'
                        : 'text-red-600'
                    }`}>
                      Combined NTRP: {calculateCombinedNTRP(pendingMatchFormData.team2Players).toFixed(1)}
                      {calculateCombinedNTRP(pendingMatchFormData.team2Players) > parseFloat(pendingMatchFormData.level) && (
                        <span className="block text-xs mt-0.5">
                          ⚠️ Exceeds match level ({pendingMatchFormData.level})
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Notes */}
            <div>
              <label className="block text-sm font-semibold mb-1">Notes (Optional)</label>
              <textarea
                value={pendingMatchFormData.notes}
                onChange={(e) => setPendingMatchFormData({ ...pendingMatchFormData, notes: e.target.value })}
                className="w-full px-3 py-2 border rounded"
                rows="2"
                placeholder="Location, time, or other details..."
              />
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2 justify-end pt-2">
              <button
                onClick={() => {
                  setShowPendingMatchForm(false);
                  setPendingMatchFormData({
                    matchType: MATCH_TYPES.DOUBLES,
                    opponentTeamId: '',
                    scheduledDate: new Date().toISOString().split('T')[0],
                    level: getDefaultLevel(MATCH_TYPES.DOUBLES),
                    team1Players: [],
                    team2Players: [],
                    notes: ''
                  });
                }}
                className="px-4 py-2 border rounded hover:bg-gray-100"
              >
                Cancel
              </button>
              <button
                onClick={handleCreatePendingMatch}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 flex items-center gap-2"
              >
                <Check className="w-4 h-4" />
                Create Pending Match
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Pending Matches Section - Only for authenticated users */}
      {isAuthenticated && (userRole !== 'captain' || userTeamId) && getPendingMatches().length > 0 && (
        <div className="mb-6">
          <h3 className="text-xl font-bold mb-3 flex items-center gap-2 text-orange-700">
            <Clock className="w-5 h-5" />
            Pending Matches ({getPendingMatches().length})
          </h3>
          <p className="text-sm text-gray-600 mb-4">
            These matches have been accepted and are waiting for results to be entered.
          </p>

          <div className="space-y-4">
            {getPendingMatches().map(pendingMatch => {
              const team1Players = getPlayerNames(pendingMatch.challengerPlayers);
              const team2Players = getPlayerNames(pendingMatch.challengedPlayers);
              const combinedNTRP1 = pendingMatch.combinedNTRP || 0;
              const combinedNTRP2 = pendingMatch.challengedCombinedNTRP || 0;

              return (
                <div
                  key={pendingMatch.id}
                  className="bg-orange-50 border-2 border-orange-300 rounded-lg p-5 hover:bg-orange-100 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      {/* Match Title */}
                      <div className="flex items-center gap-3 mb-3">
                        <h4 className="text-lg font-bold text-gray-900">
                          {getTeamName(pendingMatch.challengerTeamId)} vs {getTeamName(pendingMatch.challengedTeamId)}
                        </h4>
                        <span className="px-2 py-1 bg-orange-200 text-orange-900 text-xs font-medium rounded">
                          Level {pendingMatch.acceptedLevel || pendingMatch.proposedLevel}
                        </span>
                        <span className="px-2 py-1 bg-yellow-200 text-yellow-900 text-xs font-medium rounded flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          Pending
                        </span>
                      </div>

                      {/* Players */}
                      <div className="space-y-2 text-sm">
                        <div className="flex gap-8">
                          <div className="flex-1">
                            <div className="font-semibold text-gray-700 mb-1">
                              {getTeamName(pendingMatch.challengerTeamId)}:
                            </div>
                            {team1Players.map((player, idx) => (
                              <div key={idx} className="text-gray-600">
                                • {player.name} ({player.gender}) {player.rating} NTRP
                              </div>
                            ))}
                            {combinedNTRP1 > 0 && (
                              <div className="text-green-600 font-medium mt-1">
                                Combined: {combinedNTRP1.toFixed(1)} NTRP
                              </div>
                            )}
                          </div>

                          <div className="flex-1">
                            <div className="font-semibold text-gray-700 mb-1">
                              {getTeamName(pendingMatch.challengedTeamId)}:
                            </div>
                            {team2Players.map((player, idx) => (
                              <div key={idx} className="text-gray-600">
                                • {player.name} ({player.gender}) {player.rating} NTRP
                              </div>
                            ))}
                            {combinedNTRP2 > 0 && (
                              <div className="text-green-600 font-medium mt-1">
                                Combined: {combinedNTRP2.toFixed(1)} NTRP
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Match Details */}
                        <div className="flex gap-4 mt-3 pt-3 border-t border-orange-200">
                          {pendingMatch.acceptedDate && (
                            <div className="flex items-center gap-1 text-gray-700">
                              <Calendar className="w-4 h-4" />
                              <span>Scheduled: {formatDate(pendingMatch.acceptedDate)}</span>
                            </div>
                          )}
                          {pendingMatch.notes && (
                            <div className="text-gray-700">
                              <strong>Notes:</strong> {pendingMatch.notes}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="ml-4 flex flex-col gap-2">
                      {canEnterResults(pendingMatch) && (
                        <button
                          onClick={() => handleEnterPendingResults(pendingMatch)}
                          className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 transition-colors font-medium whitespace-nowrap"
                        >
                          <Check className="w-4 h-4" />
                          Enter Results
                        </button>
                      )}
                      {userRole === 'director' && (
                        <button
                          onClick={() => handleDeletePendingMatch(pendingMatch)}
                          className="flex items-center gap-2 bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 transition-colors font-medium whitespace-nowrap"
                          title="Delete pending match"
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
        </div>
      )}

      {/* Match Entry Modal */}
      {isAuthenticated && (userRole !== 'captain' || userTeamId) && showMatchForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-gray-200 sticky top-0 bg-white z-10">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <h3 className="text-xl font-bold">
                    {editingMatch && editingMatch.isPendingMatch ? 'Enter Match Results' : (editingMatch ? 'Edit Match' : 'Record New Match')}
                  </h3>

                  {/* Display IDs for existing matches */}
                  {editingMatch && !editingMatch.isPendingMatch && (
                    <div className="mt-1 flex items-center gap-3 text-xs text-gray-600 flex-wrap">
                      {editingMatch.matchId && (
                        <div className="font-mono bg-gray-100 px-2 py-1 rounded">
                          <span className="font-semibold">Match ID:</span> {editingMatch.matchId}
                        </div>
                      )}
                      {editingMatch.originChallengeId && (
                        <div className="text-blue-600 bg-blue-50 px-2 py-1 rounded">
                          From Challenge: {editingMatch.originChallengeId}
                        </div>
                      )}
                      {editingMatch.timestamp && (
                        <div className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          <span>Entered: {formatDate(editingMatch.timestamp)}</span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Display for pending matches */}
                  {editingMatch && editingMatch.isPendingMatch && (
                    <>
                      <div className="mt-1 flex items-center gap-3 text-xs text-gray-600 flex-wrap">
                        {editingMatch.matchId && (
                          <div className="font-mono bg-blue-100 px-2 py-1 rounded">
                            <span className="font-semibold">Match ID:</span> {editingMatch.matchId}
                          </div>
                        )}
                        {editingMatch.challengeId && editingMatch.origin !== 'direct' && (
                          <div className="font-mono bg-orange-100 px-2 py-1 rounded">
                            <span className="font-semibold">Origin Challenge ID:</span> {editingMatch.challengeId}
                          </div>
                        )}
                        {editingMatch.createdAt && (
                          <div className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            <span>Created: {formatDate(editingMatch.createdAt)}</span>
                          </div>
                        )}
                      </div>
                      <div className="mt-2 text-lg font-semibold text-gray-700 flex items-center gap-2">
                        <span>{teams.find(t => t.id === parseInt(matchFormData.team1Id))?.name || 'Team 1'}</span>
                        <span className="text-blue-600">vs</span>
                        <span>{teams.find(t => t.id === parseInt(matchFormData.team2Id))?.name || 'Team 2'}</span>
                        <span className="ml-3 px-2 py-1 bg-blue-100 text-blue-800 text-sm font-medium rounded">
                          Level {matchFormData.level}
                        </span>
                      </div>
                    </>
                  )}
                </div>
                <button
                  onClick={() => {
                    setShowMatchForm(false);
                    setEditingMatch(null);
                    setAllowPlayerEdit(false);
                    setPhotoFile(null);
                    setPhotoPreview(null);

                    // Reset form data after modal closes
                    setTimeout(() => {
                      setMatchFormData({
                        matchType: MATCH_TYPES.DOUBLES,
                        date: new Date().toISOString().split('T')[0],
                        level: getDefaultLevel(MATCH_TYPES.DOUBLES),
                        team1Id: '',
                        team2Id: '',
                        set1Team1: '',
                        set1Team2: '',
                        set2Team1: '',
                        set2Team2: '',
                        set3Team1: '',
                        set3Team2: '',
                        set3IsTiebreaker: false,
                        team1Players: [],
                        team2Players: [],
                        notes: ''
                      });
                    }, 300);
                  }}
                  className="text-gray-500 hover:text-gray-700 ml-4"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>

            <div className="px-6 py-4">
              {/* Special layout for pending match entry */}
              {editingMatch && editingMatch.isPendingMatch ? (
                (() => {
                  // Debug logging for modal rendering
                  console.log('=== MODAL RENDERING DEBUG ===');
                  console.log('Match Form Data:', matchFormData);
                  console.log('Team 1 ID:', matchFormData.team1Id);
                  console.log('Team 2 ID:', matchFormData.team2Id);
                  console.log('Team 1 Player IDs:', matchFormData.team1Players);
                  console.log('Team 2 Player IDs:', matchFormData.team2Players);

                  // Get team1Players and team2Players for the roster
                  const allTeam1Players = getTeamPlayers(matchFormData.team1Id);
                  const allTeam2Players = getTeamPlayers(matchFormData.team2Id);

                  console.log('All Team 1 Players Available:', allTeam1Players);
                  console.log('All Team 2 Players Available:', allTeam2Players);

                  // Get the actual selected player objects
                  const selectedTeam1Players = matchFormData.team1Players
                    .map(playerId => {
                      const player = players.find(p => p.id === playerId);
                      console.log(`Team 1 - Looking for player ${playerId}:`, player);
                      return player;
                    })
                    .filter(p => p !== undefined);

                  const selectedTeam2Players = matchFormData.team2Players
                    .map(playerId => {
                      const player = players.find(p => p.id === playerId);
                      console.log(`Team 2 - Looking for player ${playerId}:`, player);
                      return player;
                    })
                    .filter(p => p !== undefined);

                  console.log('Selected Team 1 Players:', selectedTeam1Players);
                  console.log('Selected Team 2 Players:', selectedTeam2Players);

                  return (
                    <div className="space-y-6">
                      {/* Players Section */}
                      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                        <div className="flex items-center justify-between mb-4">
                          <h4 className="font-semibold text-gray-900">Match Players</h4>
                          {!allowPlayerEdit && (
                            <button
                              onClick={() => {
                                console.log('Change Players clicked');
                                setAllowPlayerEdit(true);
                              }}
                              className="text-sm text-blue-600 hover:text-blue-700 underline"
                            >
                              Change Players
                            </button>
                          )}
                        </div>

                        {allowPlayerEdit && (
                          <div className="mb-3 p-3 bg-yellow-50 border border-yellow-200 rounded flex items-start gap-2">
                            <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                            <div>
                              <p className="text-sm font-medium text-yellow-900">⚠️ Changing players from originally agreed upon</p>
                              <p className="text-xs text-yellow-700 mt-1">Select different players if substitutions were made</p>
                            </div>
                          </div>
                        )}

                        <div className="grid grid-cols-2 gap-4">
                          {/* Team 1 Players */}
                          <div>
                            <div className="text-sm font-semibold text-gray-700 mb-2">
                              {teams.find(t => t.id === parseInt(matchFormData.team1Id))?.name || 'Team 1'} Players:
                            </div>
                            {!allowPlayerEdit ? (
                              <div className="space-y-2">
                                {selectedTeam1Players.length > 0 ? (
                                  selectedTeam1Players.map(player => (
                                    <div key={player.id} className="flex items-center gap-2 p-2 bg-blue-50 rounded border border-blue-200">
                                      <span className="text-sm">
                                        • {player.firstName} {player.lastName}
                                        <span className="text-gray-600 ml-1">
                                          ({player.dynamicRating ? formatDynamic(player.dynamicRating) : formatNTRP(player.ntrpRating)} NTRP)
                                        </span>
                                      </span>
                                    </div>
                                  ))
                                ) : (
                                  <div className="p-2 bg-red-50 border border-red-200 rounded text-sm text-red-600">
                                    ⚠️ No players found for this team
                                  </div>
                                )}
                              </div>
                            ) : (
                              <div className="space-y-2 border border-blue-200 rounded p-2 bg-white max-h-40 overflow-y-auto">
                                {allTeam1Players.length > 0 ? (
                                  allTeam1Players.map(player => (
                                    <label key={player.id} className="flex items-center gap-2 cursor-pointer hover:bg-blue-50 p-2 rounded">
                                      <input
                                        type="checkbox"
                                        checked={matchFormData.team1Players.includes(player.id)}
                                        onChange={() => handlePlayerToggle(player.id, 1)}
                                        className="w-4 h-4"
                                      />
                                      <span className="text-sm">
                                        {player.firstName} {player.lastName}
                                        <span className="text-gray-600 ml-1">
                                          ({player.gender}) {player.dynamicRating ? formatDynamic(player.dynamicRating) : formatNTRP(player.ntrpRating)}
                                        </span>
                                      </span>
                                    </label>
                                  ))
                                ) : (
                                  <div className="p-2 text-sm text-gray-500">
                                    No active players on this team
                                  </div>
                                )}
                              </div>
                            )}
                          </div>

                          {/* Team 2 Players */}
                          <div>
                            <div className="text-sm font-semibold text-gray-700 mb-2">
                              {teams.find(t => t.id === parseInt(matchFormData.team2Id))?.name || 'Team 2'} Players:
                            </div>
                            {!allowPlayerEdit ? (
                              <div className="space-y-2">
                                {selectedTeam2Players.length > 0 ? (
                                  selectedTeam2Players.map(player => (
                                    <div key={player.id} className="flex items-center gap-2 p-2 bg-purple-50 rounded border border-purple-200">
                                      <span className="text-sm">
                                        • {player.firstName} {player.lastName}
                                        <span className="text-gray-600 ml-1">
                                          ({player.dynamicRating ? formatDynamic(player.dynamicRating) : formatNTRP(player.ntrpRating)} NTRP)
                                        </span>
                                      </span>
                                    </div>
                                  ))
                                ) : (
                                  <div className="p-2 bg-red-50 border border-red-200 rounded text-sm text-red-600">
                                    ⚠️ No players found for this team
                                  </div>
                                )}
                              </div>
                            ) : (
                              <div className="space-y-2 border border-purple-200 rounded p-2 bg-white max-h-40 overflow-y-auto">
                                {allTeam2Players.length > 0 ? (
                                  allTeam2Players.map(player => (
                                    <label key={player.id} className="flex items-center gap-2 cursor-pointer hover:bg-purple-50 p-2 rounded">
                                      <input
                                        type="checkbox"
                                        checked={matchFormData.team2Players.includes(player.id)}
                                        onChange={() => handlePlayerToggle(player.id, 2)}
                                        className="w-4 h-4"
                                      />
                                      <span className="text-sm">
                                        {player.firstName} {player.lastName}
                                        <span className="text-gray-600 ml-1">
                                          ({player.gender}) {player.dynamicRating ? formatDynamic(player.dynamicRating) : formatNTRP(player.ntrpRating)}
                                        </span>
                                      </span>
                                    </label>
                                  ))
                                ) : (
                                  <div className="p-2 text-sm text-gray-500">
                                    No active players on this team
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                  {/* Match Date */}
                  <div>
                    <label className="block text-sm font-bold mb-2 text-gray-900">
                      Match Date Played <span className="text-red-600">*</span>
                    </label>
                    <input
                      type="date"
                      value={matchFormData.date}
                      onChange={(e) => setMatchFormData({...matchFormData, date: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  {/* Match Winner Selection */}
                  {matchFormData.team1Id && matchFormData.team2Id && !matchFormData.matchWinner && (
                    <div className="col-span-2 bg-yellow-50 border-2 border-yellow-400 rounded-lg p-4">
                      <label className="block text-sm font-bold mb-2 text-gray-900">
                        Match Winner <span className="text-red-600">*</span>
                      </label>
                      <p className="text-xs text-gray-600 mb-3">
                        Select which team won the match. Scores will be entered from the winner's perspective.
                      </p>
                      <div className="flex gap-4">
                        <label className="flex items-center gap-2 cursor-pointer bg-white px-4 py-3 rounded-lg border-2 border-gray-300 hover:border-blue-500 transition-colors flex-1">
                          <input
                            type="radio"
                            name="matchWinner"
                            value="team1"
                            checked={matchFormData.matchWinner === 'team1'}
                            onChange={(e) => setMatchFormData({...matchFormData, matchWinner: e.target.value})}
                            className="w-5 h-5"
                          />
                          <span className="font-semibold text-lg">
                            {teams.find(t => t.id === parseInt(matchFormData.team1Id))?.name || 'Team 1'}
                          </span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer bg-white px-4 py-3 rounded-lg border-2 border-gray-300 hover:border-blue-500 transition-colors flex-1">
                          <input
                            type="radio"
                            name="matchWinner"
                            value="team2"
                            checked={matchFormData.matchWinner === 'team2'}
                            onChange={(e) => setMatchFormData({...matchFormData, matchWinner: e.target.value})}
                            className="w-5 h-5"
                          />
                          <span className="font-semibold text-lg">
                            {teams.find(t => t.id === parseInt(matchFormData.team2Id))?.name || 'Team 2'}
                          </span>
                        </label>
                      </div>
                    </div>
                  )}

                  {/* Set Scores Section - Winner-Centric Entry */}
                  {matchFormData.matchWinner ? (() => {
                    // Get team names dynamically based on selected winner
                    const winningTeam = teams.find(t =>
                      t.id === parseInt(matchFormData.matchWinner === 'team1' ? matchFormData.team1Id : matchFormData.team2Id)
                    );
                    const losingTeam = teams.find(t =>
                      t.id === parseInt(matchFormData.matchWinner === 'team1' ? matchFormData.team2Id : matchFormData.team1Id)
                    );
                    const winnerName = winningTeam?.name || 'Winner';
                    const loserName = losingTeam?.name || 'Loser';

                    return (
                  <div className="bg-green-100 border-2 border-green-400 rounded-lg p-4">
                    <h4 className="font-semibold text-lg mb-2">Set Scores *</h4>
                    <p className="text-xs text-gray-700 mb-3">
                      Enter scores from {winnerName}'s perspective (winning team)
                    </p>

                    {/* Set 1 */}
                    <div className="mb-3">
                      <label className="block text-sm font-semibold mb-2">Set 1:</label>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-green-700 w-24 text-right">{winnerName}</span>
                        <input
                          type="number"
                          min="0"
                          max="7"
                          value={matchFormData.set1Winner}
                          onChange={(e) => {
                            const newData = {...matchFormData, set1Winner: e.target.value};
                            const syncedScores = syncWinnerLoserToTeamScores(
                              newData.matchWinner,
                              newData.set1Winner, newData.set1Loser,
                              newData.set2Winner, newData.set2Loser,
                              newData.set3Winner, newData.set3Loser
                            );
                            setMatchFormData({...newData, ...syncedScores});
                          }}
                          className="w-16 px-2 py-2 border-2 border-green-500 rounded text-center font-bold"
                          placeholder="6"
                        />
                        <span className="font-bold">-</span>
                        <input
                          type="number"
                          min="0"
                          max="7"
                          value={matchFormData.set1Loser}
                          onChange={(e) => {
                            const newData = {...matchFormData, set1Loser: e.target.value};
                            const syncedScores = syncWinnerLoserToTeamScores(
                              newData.matchWinner,
                              newData.set1Winner, newData.set1Loser,
                              newData.set2Winner, newData.set2Loser,
                              newData.set3Winner, newData.set3Loser
                            );
                            setMatchFormData({...newData, ...syncedScores});
                          }}
                          className="w-16 px-2 py-2 border-2 border-gray-300 rounded text-center"
                          placeholder="4"
                        />
                        <span className="text-xs font-semibold text-gray-600 w-24">{loserName}</span>
                      </div>
                      {(() => {
                        const validation = validateTennisScore(matchFormData.set1Winner, matchFormData.set1Loser, false);
                        return !validation.valid && matchFormData.set1Winner && matchFormData.set1Loser && (
                          <p className="text-xs text-red-600 mt-1">⚠️ {validation.error}</p>
                        );
                      })()}
                    </div>

                    {/* Set 2 */}
                    <div className="mb-3">
                      <label className="block text-sm font-semibold mb-2">Set 2:</label>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-green-700 w-24 text-right">{winnerName}</span>
                        <input
                          type="number"
                          min="0"
                          max="7"
                          value={matchFormData.set2Winner}
                          onChange={(e) => {
                            const newData = {...matchFormData, set2Winner: e.target.value};
                            const syncedScores = syncWinnerLoserToTeamScores(
                              newData.matchWinner,
                              newData.set1Winner, newData.set1Loser,
                              newData.set2Winner, newData.set2Loser,
                              newData.set3Winner, newData.set3Loser
                            );
                            setMatchFormData({...newData, ...syncedScores});
                          }}
                          className="w-16 px-2 py-2 border-2 border-green-500 rounded text-center font-bold"
                          placeholder="6"
                        />
                        <span className="font-bold">-</span>
                        <input
                          type="number"
                          min="0"
                          max="7"
                          value={matchFormData.set2Loser}
                          onChange={(e) => {
                            const newData = {...matchFormData, set2Loser: e.target.value};
                            const syncedScores = syncWinnerLoserToTeamScores(
                              newData.matchWinner,
                              newData.set1Winner, newData.set1Loser,
                              newData.set2Winner, newData.set2Loser,
                              newData.set3Winner, newData.set3Loser
                            );
                            setMatchFormData({...newData, ...syncedScores});
                          }}
                          className="w-16 px-2 py-2 border-2 border-gray-300 rounded text-center"
                          placeholder="3"
                        />
                        <span className="text-xs font-semibold text-gray-600 w-24">{loserName}</span>
                      </div>
                      {(() => {
                        const validation = validateTennisScore(matchFormData.set2Winner, matchFormData.set2Loser, false);
                        return !validation.valid && matchFormData.set2Winner && matchFormData.set2Loser && (
                          <p className="text-xs text-red-600 mt-1">⚠️ {validation.error}</p>
                        );
                      })()}
                    </div>

                    {/* Set 3 */}
                    <div className="mb-3">
                      <label className="block text-sm font-semibold mb-1">Set 3 (if needed):</label>
                      <p className="text-xs text-gray-600 mb-2">
                        💡 If sets are split 1-1, enter <strong>1-0</strong> for the match tiebreak winner
                      </p>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-green-700 w-24 text-right">{winnerName}</span>
                        <input
                          type="number"
                          min="0"
                          max={matchFormData.set3IsTiebreaker ? "10" : "7"}
                          value={matchFormData.set3Winner}
                          onChange={(e) => {
                            const newData = {...matchFormData, set3Winner: e.target.value};
                            const syncedScores = syncWinnerLoserToTeamScores(
                              newData.matchWinner,
                              newData.set1Winner, newData.set1Loser,
                              newData.set2Winner, newData.set2Loser,
                              newData.set3Winner, newData.set3Loser
                            );
                            setMatchFormData({...newData, ...syncedScores});
                          }}
                          className="w-16 px-2 py-2 border-2 border-green-500 rounded text-center font-bold"
                          placeholder="0"
                        />
                        <span className="font-bold">-</span>
                        <input
                          type="number"
                          min="0"
                          max={matchFormData.set3IsTiebreaker ? "10" : "7"}
                          value={matchFormData.set3Loser}
                          onChange={(e) => {
                            const newData = {...matchFormData, set3Loser: e.target.value};
                            const syncedScores = syncWinnerLoserToTeamScores(
                              newData.matchWinner,
                              newData.set1Winner, newData.set1Loser,
                              newData.set2Winner, newData.set2Loser,
                              newData.set3Winner, newData.set3Loser
                            );
                            setMatchFormData({...newData, ...syncedScores});
                          }}
                          className="w-16 px-2 py-2 border-2 border-gray-300 rounded text-center"
                          placeholder="0"
                        />
                        <span className="text-xs font-semibold text-gray-600 w-24">{loserName}</span>
                      </div>
                      {(matchFormData.set3Winner || matchFormData.set3Loser) && (
                        <>
                          <label className="flex items-center gap-2 mt-2 text-sm">
                            <input
                              type="checkbox"
                              checked={matchFormData.set3IsTiebreaker}
                              onChange={(e) => setMatchFormData({...matchFormData, set3IsTiebreaker: e.target.checked})}
                              className="w-4 h-4"
                            />
                            <span>Set 3 was a 10-point tiebreaker</span>
                          </label>
                          {(() => {
                            const validation = validateTennisScore(matchFormData.set3Winner, matchFormData.set3Loser, matchFormData.set3IsTiebreaker, true);
                            return !validation.valid && matchFormData.set3Winner && matchFormData.set3Loser && (
                              <p className="text-xs text-red-600 mt-1">⚠️ {validation.error}</p>
                            );
                          })()}
                        </>
                      )}
                    </div>

                    {/* Match Result Display */}
                    {getMatchResultsDisplay() && (
                      <div className="mt-4 p-3 bg-white rounded border-2 border-green-500">
                        <p className="text-sm font-semibold text-green-800 mb-1">Match Result:</p>
                        <p className="text-lg font-bold text-green-900">
                          Winner: {getMatchResultsDisplay().winnerName} <span className="text-blue-600">{getMatchResultsDisplay().setScores}</span>
                        </p>
                      </div>
                    )}
                  </div>
                  );
                  })() : (
                    <div className="bg-gray-100 border-2 border-gray-300 rounded-lg p-4 text-center">
                      <p className="text-gray-600 font-semibold">
                        👆 Please select the match winner above to enter scores
                      </p>
                    </div>
                  )}

                  {/* Photo Upload Section - Matches Regular Form Styling */}
                  <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <ImageIcon className="w-5 h-5 text-blue-600" />
                      <label className="block text-sm font-semibold">Upload Match Photo (Optional)</label>
                    </div>

                    {!photoPreview ? (
                      <div>
                        <input
                          type="file"
                          accept="image/jpeg,image/png,image/webp"
                          onChange={handlePhotoUpload}
                          className="w-full px-3 py-2 border rounded bg-white text-sm"
                        />
                        <p className="text-xs text-gray-600 mt-2">
                          Upload a photo from this match. Accepted formats: JPG, PNG, WEBP (max 5MB)
                        </p>
                      </div>
                    ) : (
                      <div>
                        <div className="relative inline-block">
                          <img
                            src={photoPreview}
                            alt="Match photo preview"
                            className="max-w-full h-48 object-cover rounded border-2 border-blue-300"
                          />
                          <button
                            type="button"
                            onClick={handleRemovePhoto}
                            className="absolute top-2 right-2 bg-red-600 hover:bg-red-700 text-white p-2 rounded-full"
                            title="Remove photo"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                        <p className="text-sm text-green-600 mt-2 flex items-center gap-1">
                          <Check className="w-4 h-4" /> Photo ready to upload
                        </p>
                      </div>
                    )}
                  </div>

                      {/* Notes */}
                      <div>
                        <label className="block text-sm font-semibold mb-1 text-gray-700">Notes (Optional)</label>
                        <textarea
                          value={matchFormData.notes}
                          onChange={(e) => setMatchFormData({...matchFormData, notes: e.target.value})}
                          className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                          rows="2"
                          placeholder="Match notes..."
                        />
                      </div>
                    </div>
                  );
                })()
              ) : (
                /* Original form layout for non-pending matches */
                <div className="grid grid-cols-2 gap-4">
                  {/* Match Type Selection */}
                  <div className="col-span-2">
                    <label className="block text-sm font-semibold mb-1">Match Type *</label>
                    <select
                      value={matchFormData.matchType}
                      onChange={(e) => setMatchFormData({
                        ...matchFormData,
                        matchType: e.target.value,
                        level: getDefaultLevel(e.target.value), // Reset level based on new match type
                        team1Players: [], // Reset player selections when match type changes
                        team2Players: []
                      })}
                      className="w-full px-3 py-2 border rounded"
                      disabled={!!editingMatch}
                    >
                      <option value={MATCH_TYPES.DOUBLES}>Doubles</option>
                      <option value={MATCH_TYPES.SINGLES}>Singles</option>
                    </select>
                    {editingMatch && (
                      <p className="text-xs text-gray-600 mt-1">
                        Match type cannot be changed when editing
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-semibold mb-1">Match Date *</label>
                    <input
                      type="date"
                      value={matchFormData.date}
                      onChange={(e) => setMatchFormData({...matchFormData, date: e.target.value})}
                      className="w-full px-3 py-2 border rounded"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold mb-1">
                      Match Level {matchFormData.matchType === MATCH_TYPES.SINGLES ? '(Individual NTRP)' : '(Combined NTRP)'}
                    </label>
                    <select
                      value={matchFormData.level}
                      onChange={(e) => setMatchFormData({...matchFormData, level: e.target.value})}
                      className="w-full px-3 py-2 border rounded"
                    >
                      {getLevelOptions(matchFormData.matchType).map(level => (
                        <option key={level} value={level}>{level}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold mb-1">
                      Team 1 * {userRole === 'captain' && '(Your Team)'}
                    </label>
                    <select
                      value={matchFormData.team1Id}
                      onChange={(e) => setMatchFormData({
                        ...matchFormData,
                        team1Id: e.target.value,
                        team1Players: []
                      })}
                      className="w-full px-3 py-2 border rounded"
                      disabled={userRole === 'captain' || !!editingMatch}
                    >
                      <option value="">Select Team 1...</option>
                      {teams.map(t => (
                        <option key={t.id} value={t.id}>{t.name}</option>
                      ))}
                    </select>
                    {userRole === 'captain' && !editingMatch && (
                      <p className="text-xs text-gray-600 mt-1">
                        As captain, you can only enter matches for your team
                      </p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-semibold mb-1">Team 2 *</label>
                    <select
                      value={matchFormData.team2Id}
                      onChange={(e) => setMatchFormData({
                        ...matchFormData,
                        team2Id: e.target.value,
                        team2Players: []
                      })}
                      className="w-full px-3 py-2 border rounded"
                      disabled={!!editingMatch}
                    >
                      <option value="">Select Team 2...</option>
                      {teams.map(t => (
                        <option key={t.id} value={t.id}>{t.name}</option>
                      ))}
                    </select>
                  </div>

                  {/* Match Winner Selection - NEW */}
                  {matchFormData.team1Id && matchFormData.team2Id && (
                    <div className="col-span-2 bg-yellow-50 border-2 border-yellow-400 rounded-lg p-4">
                      <label className="block text-sm font-bold mb-2 text-gray-900">
                        Match Winner <span className="text-red-600">*</span>
                      </label>
                      <p className="text-xs text-gray-600 mb-3">
                        Select which team won the match. Scores will be entered from the winner's perspective.
                      </p>
                      <div className="flex gap-4">
                        <label className="flex items-center gap-2 cursor-pointer bg-white px-4 py-3 rounded-lg border-2 border-gray-300 hover:border-blue-500 transition-colors flex-1">
                          <input
                            type="radio"
                            name="matchWinner"
                            value="team1"
                            checked={matchFormData.matchWinner === 'team1'}
                            onChange={(e) => setMatchFormData({...matchFormData, matchWinner: e.target.value})}
                            className="w-5 h-5"
                          />
                          <span className="font-semibold text-lg">
                            {teams.find(t => t.id === parseInt(matchFormData.team1Id))?.name || 'Team 1'}
                          </span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer bg-white px-4 py-3 rounded-lg border-2 border-gray-300 hover:border-blue-500 transition-colors flex-1">
                          <input
                            type="radio"
                            name="matchWinner"
                            value="team2"
                            checked={matchFormData.matchWinner === 'team2'}
                            onChange={(e) => setMatchFormData({...matchFormData, matchWinner: e.target.value})}
                            className="w-5 h-5"
                          />
                          <span className="font-semibold text-lg">
                            {teams.find(t => t.id === parseInt(matchFormData.team2Id))?.name || 'Team 2'}
                          </span>
                        </label>
                      </div>
                    </div>
                  )}

                  {/* Team 1 Players */}
                  {matchFormData.team1Id && team1Players.length > 0 && (
                    <div className="col-span-2 bg-blue-50 border border-blue-200 rounded p-3">
                      <label className="block text-sm font-semibold mb-2">
                        Team 1 Players (Optional - {getPlayerSelectionLabel(matchFormData.matchType)})
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        {team1Players.map(player => (
                          <label key={player.id} className="flex items-center gap-2 cursor-pointer hover:bg-blue-100 p-2 rounded">
                            <input
                              type="checkbox"
                              checked={matchFormData.team1Players.includes(player.id)}
                              onChange={() => handlePlayerToggle(player.id, 1)}
                              className="w-4 h-4"
                            />
                            <span className="text-sm">
                              {player.firstName} {player.lastName} ({player.gender} {player.dynamicRating ? formatDynamic(player.dynamicRating) : formatNTRP(player.ntrpRating)})
                            </span>
                          </label>
                        ))}
                      </div>
                      <p className="text-xs text-gray-600 mt-2">
                        Selected: {matchFormData.team1Players.length} / {getRequiredPlayerCount(matchFormData.matchType)} player{getRequiredPlayerCount(matchFormData.matchType) > 1 ? 's' : ''}
                      </p>
                    </div>
                  )}

                  {/* Team 2 Players */}
                  {matchFormData.team2Id && team2Players.length > 0 && (
                    <div className="col-span-2 bg-purple-50 border border-purple-200 rounded p-3">
                      <label className="block text-sm font-semibold mb-2">
                        Team 2 Players (Optional - {getPlayerSelectionLabel(matchFormData.matchType)})
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        {team2Players.map(player => (
                          <label key={player.id} className="flex items-center gap-2 cursor-pointer hover:bg-purple-100 p-2 rounded">
                            <input
                              type="checkbox"
                              checked={matchFormData.team2Players.includes(player.id)}
                              onChange={() => handlePlayerToggle(player.id, 2)}
                              className="w-4 h-4"
                            />
                            <span className="text-sm">
                              {player.firstName} {player.lastName} ({player.gender} {player.dynamicRating ? formatDynamic(player.dynamicRating) : formatNTRP(player.ntrpRating)})
                            </span>
                          </label>
                        ))}
                      </div>
                      <p className="text-xs text-gray-600 mt-2">
                        Selected: {matchFormData.team2Players.length} / {getRequiredPlayerCount(matchFormData.matchType)} player{getRequiredPlayerCount(matchFormData.matchType) > 1 ? 's' : ''}
                      </p>
                    </div>
                  )}

                  {/* Set Scores Section - Winner-Centric Entry */}
                  {matchFormData.matchWinner && (() => {
                    // Get team names dynamically based on selected winner
                    const winningTeam = teams.find(t =>
                      t.id === parseInt(matchFormData.matchWinner === 'team1' ? matchFormData.team1Id : matchFormData.team2Id)
                    );
                    const losingTeam = teams.find(t =>
                      t.id === parseInt(matchFormData.matchWinner === 'team1' ? matchFormData.team2Id : matchFormData.team1Id)
                    );
                    const winnerName = winningTeam?.name || 'Winner';
                    const loserName = losingTeam?.name || 'Loser';

                    return (
                    <div className="col-span-2 bg-green-100 border-2 border-green-400 rounded-lg p-4">
                      <h4 className="font-semibold text-lg mb-2">Set Scores *</h4>
                      <p className="text-xs text-gray-700 mb-3">
                        Enter scores from {winnerName}'s perspective (winning team)
                      </p>

                      {/* Set 1 */}
                      <div className="mb-3">
                        <label className="block text-sm font-semibold mb-2">Set 1:</label>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold text-green-700 w-24 text-right">{winnerName}</span>
                          <input
                            type="number"
                            min="0"
                            max="7"
                            value={matchFormData.set1Winner}
                            onChange={(e) => {
                              const newData = {...matchFormData, set1Winner: e.target.value};
                              // Sync to team1/team2 fields
                              const syncedScores = syncWinnerLoserToTeamScores(
                                newData.matchWinner,
                                newData.set1Winner, newData.set1Loser,
                                newData.set2Winner, newData.set2Loser,
                                newData.set3Winner, newData.set3Loser
                              );
                              setMatchFormData({...newData, ...syncedScores});
                            }}
                            className="w-16 px-2 py-2 border-2 border-green-500 rounded text-center font-bold"
                            placeholder="6"
                          />
                          <span className="font-bold">-</span>
                          <input
                            type="number"
                            min="0"
                            max="7"
                            value={matchFormData.set1Loser}
                            onChange={(e) => {
                              const newData = {...matchFormData, set1Loser: e.target.value};
                              const syncedScores = syncWinnerLoserToTeamScores(
                                newData.matchWinner,
                                newData.set1Winner, newData.set1Loser,
                                newData.set2Winner, newData.set2Loser,
                                newData.set3Winner, newData.set3Loser
                              );
                              setMatchFormData({...newData, ...syncedScores});
                            }}
                            className="w-16 px-2 py-2 border-2 border-gray-300 rounded text-center"
                            placeholder="4"
                          />
                          <span className="text-xs font-semibold text-gray-600 w-24">{loserName}</span>
                        </div>
                        {(() => {
                          const validation = validateTennisScore(matchFormData.set1Winner, matchFormData.set1Loser, false);
                          return !validation.valid && matchFormData.set1Winner && matchFormData.set1Loser && (
                            <p className="text-xs text-red-600 mt-1">⚠️ {validation.error}</p>
                          );
                        })()}
                      </div>

                      {/* Set 2 */}
                      <div className="mb-3">
                        <label className="block text-sm font-semibold mb-2">Set 2:</label>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold text-green-700 w-24 text-right">{winnerName}</span>
                          <input
                            type="number"
                            min="0"
                            max="7"
                            value={matchFormData.set2Winner}
                            onChange={(e) => {
                              const newData = {...matchFormData, set2Winner: e.target.value};
                              const syncedScores = syncWinnerLoserToTeamScores(
                                newData.matchWinner,
                                newData.set1Winner, newData.set1Loser,
                                newData.set2Winner, newData.set2Loser,
                                newData.set3Winner, newData.set3Loser
                              );
                              setMatchFormData({...newData, ...syncedScores});
                            }}
                            className="w-16 px-2 py-2 border-2 border-green-500 rounded text-center font-bold"
                            placeholder="6"
                          />
                          <span className="font-bold">-</span>
                          <input
                            type="number"
                            min="0"
                            max="7"
                            value={matchFormData.set2Loser}
                            onChange={(e) => {
                              const newData = {...matchFormData, set2Loser: e.target.value};
                              const syncedScores = syncWinnerLoserToTeamScores(
                                newData.matchWinner,
                                newData.set1Winner, newData.set1Loser,
                                newData.set2Winner, newData.set2Loser,
                                newData.set3Winner, newData.set3Loser
                              );
                              setMatchFormData({...newData, ...syncedScores});
                            }}
                            className="w-16 px-2 py-2 border-2 border-gray-300 rounded text-center"
                            placeholder="3"
                          />
                          <span className="text-xs font-semibold text-gray-600 w-24">{loserName}</span>
                        </div>
                        {(() => {
                          const validation = validateTennisScore(matchFormData.set2Winner, matchFormData.set2Loser, false);
                          return !validation.valid && matchFormData.set2Winner && matchFormData.set2Loser && (
                            <p className="text-xs text-red-600 mt-1">⚠️ {validation.error}</p>
                          );
                        })()}
                      </div>

                      {/* Set 3 */}
                      <div className="mb-3">
                        <label className="block text-sm font-semibold mb-1">Set 3 (if needed):</label>
                        <p className="text-xs text-gray-600 mb-2">
                          💡 If sets are split 1-1, enter <strong>1-0</strong> for the match tiebreak winner
                        </p>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold text-green-700 w-24 text-right">{winnerName}</span>
                          <input
                            type="number"
                            min="0"
                            max={matchFormData.set3IsTiebreaker ? "10" : "7"}
                            value={matchFormData.set3Winner}
                            onChange={(e) => {
                              const newData = {...matchFormData, set3Winner: e.target.value};
                              const syncedScores = syncWinnerLoserToTeamScores(
                                newData.matchWinner,
                                newData.set1Winner, newData.set1Loser,
                                newData.set2Winner, newData.set2Loser,
                                newData.set3Winner, newData.set3Loser
                              );
                              setMatchFormData({...newData, ...syncedScores});
                            }}
                            className="w-16 px-2 py-2 border-2 border-green-500 rounded text-center font-bold"
                            placeholder="0"
                          />
                          <span className="font-bold">-</span>
                          <input
                            type="number"
                            min="0"
                            max={matchFormData.set3IsTiebreaker ? "10" : "7"}
                            value={matchFormData.set3Loser}
                            onChange={(e) => {
                              const newData = {...matchFormData, set3Loser: e.target.value};
                              const syncedScores = syncWinnerLoserToTeamScores(
                                newData.matchWinner,
                                newData.set1Winner, newData.set1Loser,
                                newData.set2Winner, newData.set2Loser,
                                newData.set3Winner, newData.set3Loser
                              );
                              setMatchFormData({...newData, ...syncedScores});
                            }}
                            className="w-16 px-2 py-2 border-2 border-gray-300 rounded text-center"
                            placeholder="0"
                          />
                          <span className="text-xs font-semibold text-gray-600 w-24">{loserName}</span>
                        </div>
                        {(matchFormData.set3Winner || matchFormData.set3Loser) && (
                          <>
                            <label className="flex items-center gap-2 mt-2 text-sm">
                              <input
                                type="checkbox"
                                checked={matchFormData.set3IsTiebreaker}
                                onChange={(e) => setMatchFormData({...matchFormData, set3IsTiebreaker: e.target.checked})}
                                className="w-4 h-4"
                              />
                              <span>Set 3 was a 10-point tiebreaker</span>
                            </label>
                            {(() => {
                              const validation = validateTennisScore(matchFormData.set3Winner, matchFormData.set3Loser, matchFormData.set3IsTiebreaker, true);
                              return !validation.valid && matchFormData.set3Winner && matchFormData.set3Loser && (
                                <p className="text-xs text-red-600 mt-1">⚠️ {validation.error}</p>
                              );
                            })()}
                          </>
                        )}
                      </div>

                    {/* Match Result Display */}
                    {getMatchResultsDisplay() && (
                      <div className="mt-4 p-3 bg-white rounded border-2 border-green-500">
                        <p className="text-sm font-semibold text-green-800 mb-1">Match Result:</p>
                        <p className="text-lg font-bold text-green-900">
                          Winner: {getMatchResultsDisplay().winnerName} <span className="text-blue-600">{getMatchResultsDisplay().setScores}</span>
                        </p>
                      </div>
                    )}
                    </div>
                    );
                  })()}

                  {/* Show helper message if winner not selected yet */}
                  {matchFormData.team1Id && matchFormData.team2Id && !matchFormData.matchWinner && (
                    <div className="col-span-2 bg-gray-100 border-2 border-gray-300 rounded-lg p-4 text-center">
                      <p className="text-gray-600 font-semibold">
                        👆 Please select the match winner above to enter scores
                      </p>
                    </div>
                  )}

                  <div className="col-span-2">
                    <label className="block text-sm font-semibold mb-1">Notes (Optional)</label>
                    <textarea
                      value={matchFormData.notes}
                      onChange={(e) => setMatchFormData({...matchFormData, notes: e.target.value})}
                      className="w-full px-3 py-2 border rounded"
                      rows="2"
                      placeholder="Match notes..."
                    />
                  </div>

                  {/* Photo Upload Section */}
                  <div className="col-span-2 bg-blue-50 border-2 border-blue-200 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <ImageIcon className="w-5 h-5 text-blue-600" />
                      <label className="block text-sm font-semibold">Upload Match Photo (Optional)</label>
                    </div>

                    {!photoPreview ? (
                      <div>
                        <input
                          type="file"
                          accept="image/jpeg,image/png,image/webp"
                          onChange={handlePhotoUpload}
                          className="w-full px-3 py-2 border rounded bg-white text-sm"
                        />
                        <p className="text-xs text-gray-600 mt-2">
                          Upload a photo from this match. Accepted formats: JPG, PNG, WEBP (max 5MB)
                        </p>
                      </div>
                    ) : (
                      <div>
                        <div className="relative inline-block">
                          <img
                            src={photoPreview}
                            alt="Match photo preview"
                            className="max-w-full h-48 object-cover rounded border-2 border-blue-300"
                          />
                          <button
                            type="button"
                            onClick={handleRemovePhoto}
                            className="absolute top-2 right-2 bg-red-600 hover:bg-red-700 text-white p-2 rounded-full"
                            title="Remove photo"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                        <p className="text-sm text-green-600 mt-2 flex items-center gap-1">
                          <Check className="w-4 h-4" /> Photo ready to upload
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex gap-3 sticky bottom-0">
              <button
                onClick={handleSaveMatch}
                disabled={isSaving}
                className="flex-1 bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700 flex items-center justify-center gap-2 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSaving ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Saving Results...
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    {editingMatch ? 'Save Match Results' : 'Save Match'}
                  </>
                )}
              </button>
              <button
                onClick={() => {
                  setShowMatchForm(false);
                  setEditingMatch(null);
                  setPhotoFile(null);
                  setPhotoPreview(null);
                  setAllowPlayerEdit(false);

                  // Reset form data after modal closes
                  setTimeout(() => {
                    setMatchFormData({
                      date: new Date().toISOString().split('T')[0],
                      level: '7.0',
                      team1Id: '',
                      team2Id: '',
                      set1Team1: '',
                      set1Team2: '',
                      set2Team1: '',
                      set2Team2: '',
                      set3Team1: '',
                      set3Team2: '',
                      set3IsTiebreaker: false,
                      team1Players: [],
                      team2Players: [],
                      notes: ''
                    });
                  }, 300);
                }}
                className="px-6 py-2 border border-gray-300 rounded hover:bg-gray-50 flex items-center gap-2"
              >
                <X className="w-4 h-4" />
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Match Results Modal - for entering results for pending matches */}
      <MatchResultsModal
        isOpen={showResultsModal}
        match={selectedPendingMatch ? {
          team1Id: selectedPendingMatch.challengerTeamId,
          team2Id: selectedPendingMatch.challengedTeamId,
          matchId: selectedPendingMatch.matchId,
          acceptedLevel: selectedPendingMatch.acceptedLevel,
          proposedLevel: selectedPendingMatch.proposedLevel,
          acceptedDate: selectedPendingMatch.acceptedDate,
          challengeId: selectedPendingMatch.challengeId
        } : null}
        teams={teams}
        matches={matches}
        onSubmit={handleSubmitPendingResults}
        onClose={handleCloseResultsModal}
        addLog={addLog}
        ACTION_TYPES={ACTION_TYPES}
      />
    </div>
  );
};

export default MatchEntry;