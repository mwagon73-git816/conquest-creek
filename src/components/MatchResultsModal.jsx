/**
 * Shared Match Results Entry Modal Component
 *
 * A reusable modal for entering match results with winner-centric scoring.
 * Used on both Matches page and Match Entry page for consistency.
 *
 * Props:
 * - isOpen: boolean - controls modal visibility
 * - match: object - match data with team IDs, level, date, matchId
 * - teams: array - list of all teams
 * - matches: array - list of matches (for ID generation)
 * - onSubmit: function - callback when results are saved (receives match data)
 * - onClose: function - callback when modal is closed
 * - addLog: function - activity logging function (optional)
 * - ACTION_TYPES: object - action type constants for logging (optional)
 */

import React, { useState } from 'react';
import { X, Save } from 'lucide-react';
import { formatDate } from '../utils/formatters';
import { generateMatchId } from '../utils/idGenerator';
import { formatMatchType, getMatchType, getDisplayMatchType } from '../utils/matchUtils';

export default function MatchResultsModal({
  isOpen,
  match,
  teams,
  players,
  matches,
  onSubmit,
  onClose,
  addLog,
  ACTION_TYPES
}) {
  // Form state
  const [resultsFormData, setResultsFormData] = useState({
    matchWinner: '',
    set1Winner: '',
    set1Loser: '',
    set2Winner: '',
    set2Loser: '',
    set3Winner: '',
    set3Loser: '',
    set3IsTiebreaker: false
  });
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  // Tennis score validation - validates if two scores form a valid tennis set
  const validateTennisScore = (score1, score2, isTiebreaker = false, isSet3 = false) => {
    const s1 = parseInt(score1) || 0;
    const s2 = parseInt(score2) || 0;

    if (s1 === 0 && s2 === 0) return { valid: true, error: '' };

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
    const higher = Math.max(s1, s2);
    const lower = Math.min(s1, s2);

    // One score must be higher than the other (no ties in tennis)
    if (s1 === s2) return { valid: false, error: 'Tennis sets cannot be tied' };

    // Valid endings: 6-0, 6-1, 6-2, 6-3, 6-4, 7-5, 7-6
    if (higher === 6 && lower <= 4) return { valid: true, error: '' };
    if (higher === 7 && (lower === 5 || lower === 6)) return { valid: true, error: '' };

    return { valid: false, error: 'Invalid tennis score (must be 6-0 through 6-4, 7-5, 7-6, or 1-0 for match tiebreak)' };
  };

  // Sync winner/loser scores to team1/team2 format
  const syncWinnerLoserToTeamScores = (winner, set1W, set1L, set2W, set2L, set3W, set3L) => {
    const isTeam1Winner = winner === 'team1';
    return {
      set1Team1: isTeam1Winner ? set1W : set1L,
      set1Team2: isTeam1Winner ? set1L : set1W,
      set2Team1: isTeam1Winner ? set2W : set2L,
      set2Team2: isTeam1Winner ? set2L : set2W,
      set3Team1: isTeam1Winner ? set3W : set3L,
      set3Team2: isTeam1Winner ? set3L : set3W
    };
  };

  // Handle modal close
  const handleClose = () => {
    setResultsFormData({
      matchWinner: '',
      set1Winner: '',
      set1Loser: '',
      set2Winner: '',
      set2Loser: '',
      set3Winner: '',
      set3Loser: '',
      set3IsTiebreaker: false
    });
    setSaveError('');
    onClose();
  };

  // Handle submit
  const handleSubmit = async () => {
    if (!match) return;

    // Validation
    if (!resultsFormData.matchWinner) {
      setSaveError('Please select the match winner');
      return;
    }

    if (!resultsFormData.set1Winner || !resultsFormData.set1Loser) {
      setSaveError('Please enter Set 1 scores');
      return;
    }

    if (!resultsFormData.set2Winner || !resultsFormData.set2Loser) {
      setSaveError('Please enter Set 2 scores');
      return;
    }

    // Validate tennis scores
    const set1Validation = validateTennisScore(resultsFormData.set1Winner, resultsFormData.set1Loser, false);
    if (!set1Validation.valid) {
      setSaveError(`Set 1: ${set1Validation.error}`);
      return;
    }

    const set2Validation = validateTennisScore(resultsFormData.set2Winner, resultsFormData.set2Loser, false);
    if (!set2Validation.valid) {
      setSaveError(`Set 2: ${set2Validation.error}`);
      return;
    }

    if (resultsFormData.set3Winner && resultsFormData.set3Loser) {
      const set3Validation = validateTennisScore(
        resultsFormData.set3Winner,
        resultsFormData.set3Loser,
        resultsFormData.set3IsTiebreaker,
        true
      );
      if (!set3Validation.valid) {
        setSaveError(`Set 3: ${set3Validation.error}`);
        return;
      }
    }

    // Determine who won each set
    const set1WinnerWon = parseInt(resultsFormData.set1Winner) > parseInt(resultsFormData.set1Loser);
    const set2WinnerWon = parseInt(resultsFormData.set2Winner) > parseInt(resultsFormData.set2Loser);

    // Check if sets are split (1-1)
    const setsSplit = set1WinnerWon !== set2WinnerWon;

    // If sets are split, third set is REQUIRED
    if (setsSplit && (!resultsFormData.set3Winner || !resultsFormData.set3Loser)) {
      setSaveError('Sets are split 1-1. A third set (match tiebreak) is required. Enter 1-0 for the tiebreak winner.');
      return;
    }

    // If sets are NOT split (winner won both), third set should NOT be entered
    if (!setsSplit && resultsFormData.set3Winner && resultsFormData.set3Loser) {
      setSaveError('The selected winner won both sets. A third set should not be entered.');
      return;
    }

    // If third set is entered, validate that the selected winner actually won 2 out of 3 sets
    if (resultsFormData.set3Winner && resultsFormData.set3Loser) {
      const set3WinnerWon = parseInt(resultsFormData.set3Winner) > parseInt(resultsFormData.set3Loser);

      // Count how many sets the selected winner won
      let selectedWinnerSetsWon = 0;
      if (set1WinnerWon) selectedWinnerSetsWon++;
      if (set2WinnerWon) selectedWinnerSetsWon++;
      if (set3WinnerWon) selectedWinnerSetsWon++;

      if (selectedWinnerSetsWon < 2) {
        setSaveError('The selected winner did not win 2 out of 3 sets. Please check your scores or select the correct winner.');
        return;
      }
    }

    setIsSaving(true);
    setSaveError('');

    try {
      // Sync scores to team1/team2 format
      const teamScores = syncWinnerLoserToTeamScores(
        resultsFormData.matchWinner,
        resultsFormData.set1Winner,
        resultsFormData.set1Loser,
        resultsFormData.set2Winner,
        resultsFormData.set2Loser,
        resultsFormData.set3Winner || '',
        resultsFormData.set3Loser || ''
      );

      // Calculate sets won and total games for each team
      let team1Sets = 0;
      let team2Sets = 0;
      let team1Games = 0;
      let team2Games = 0;

      // Set 1
      const set1Team1 = parseInt(teamScores.set1Team1) || 0;
      const set1Team2 = parseInt(teamScores.set1Team2) || 0;
      team1Games += set1Team1;
      team2Games += set1Team2;
      if (set1Team1 > set1Team2) team1Sets++;
      else if (set1Team2 > set1Team1) team2Sets++;

      // Set 2
      const set2Team1 = parseInt(teamScores.set2Team1) || 0;
      const set2Team2 = parseInt(teamScores.set2Team2) || 0;
      team1Games += set2Team1;
      team2Games += set2Team2;
      if (set2Team1 > set2Team2) team1Sets++;
      else if (set2Team2 > set2Team1) team2Sets++;

      // Set 3 (if exists)
      if (teamScores.set3Team1 && teamScores.set3Team2) {
        const set3Team1 = parseInt(teamScores.set3Team1) || 0;
        const set3Team2 = parseInt(teamScores.set3Team2) || 0;
        team1Games += set3Team1;
        team2Games += set3Team2;
        if (set3Team1 > set3Team2) team1Sets++;
        else if (set3Team2 > set3Team1) team2Sets++;
      }

      // Create match result data
      const matchResult = {
        winner: resultsFormData.matchWinner,
        ...teamScores,
        set3IsTiebreaker: resultsFormData.set3IsTiebreaker,
        team1Sets,
        team2Sets,
        team1Games,
        team2Games,
        matchId: match.matchId || generateMatchId(matches || []),
        date: match.acceptedDate || match.scheduledDate || new Date().toISOString().split('T')[0],
        level: match.acceptedLevel || match.proposedLevel || match.level,
        timestamp: new Date().toISOString()
      };

      // Call onSubmit callback with match result
      await onSubmit(matchResult);

      // Log activity if logging functions are provided
      if (addLog && ACTION_TYPES) {
        const team1 = teams.find(t => t.id === match.team1Id || t.id === match.challengerTeamId);
        const team2 = teams.find(t => t.id === match.team2Id || t.id === match.challengedTeamId);
        const isTeam1Winner = resultsFormData.matchWinner === 'team1';
        const winningTeam = isTeam1Winner ? team1 : team2;

        addLog(
          ACTION_TYPES.MATCH_COMPLETED,
          {
            matchId: matchResult.matchId,
            winnerName: winningTeam?.name || 'Unknown',
            team1Name: team1?.name || 'Team 1',
            team2Name: team2?.name || 'Team 2',
            scores: `${resultsFormData.set1Winner}-${resultsFormData.set1Loser}, ${resultsFormData.set2Winner}-${resultsFormData.set2Loser}${resultsFormData.set3Winner ? `, ${resultsFormData.set3Winner}-${resultsFormData.set3Loser}` : ''}`,
            level: matchResult.level
          },
          matchResult.id,
          null,
          matchResult
        );
      }

      // Close modal and let parent component handle success notification
      handleClose();
    } catch (error) {
      console.error('Error saving match results:', error);
      setSaveError('Failed to save match results. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen || !match) return null;

  // Get team names
  const team1 = teams.find(t => t.id === (match.team1Id || match.challengerTeamId));
  const team2 = teams.find(t => t.id === (match.team2Id || match.challengedTeamId));

  const winningTeam = teams.find(t =>
    t.id === (resultsFormData.matchWinner === 'team1' ? (match.team1Id || match.challengerTeamId) : (match.team2Id || match.challengedTeamId))
  );
  const losingTeam = teams.find(t =>
    t.id === (resultsFormData.matchWinner === 'team1' ? (match.team2Id || match.challengedTeamId) : (match.team1Id || match.challengerTeamId))
  );
  const winnerName = winningTeam?.name || 'Winner';
  const loserName = losingTeam?.name || 'Loser';

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Modal Header */}
        <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-gray-900">Enter Match Results</h2>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
            disabled={isSaving}
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6">
          {/* Match Info */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <h3 className="font-semibold text-blue-900 mb-2">Match Details</h3>
            <div className="text-sm text-blue-800 space-y-1">
              <p><strong>Match ID:</strong> {match.matchId || 'Pending'}</p>
              <p><strong>Teams:</strong> {team1?.name || 'Team 1'} vs {team2?.name || 'Team 2'}</p>
              <p><strong>Match Type:</strong> {getDisplayMatchType(match, players)}</p>
              <p><strong>Level:</strong> {match.acceptedLevel || match.proposedLevel || match.level}</p>
              <p><strong>Scheduled Date:</strong> {formatDate(match.acceptedDate || match.scheduledDate || match.date)}</p>
            </div>
          </div>

          {/* Winner Selection */}
          <div className="bg-yellow-50 border-2 border-yellow-400 rounded-lg p-4 mb-6">
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
                  checked={resultsFormData.matchWinner === 'team1'}
                  onChange={(e) => setResultsFormData({...resultsFormData, matchWinner: e.target.value})}
                  className="w-5 h-5"
                  disabled={isSaving}
                />
                <span className="font-semibold text-lg">
                  {team1?.name || 'Team 1'}
                </span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer bg-white px-4 py-3 rounded-lg border-2 border-gray-300 hover:border-blue-500 transition-colors flex-1">
                <input
                  type="radio"
                  name="matchWinner"
                  value="team2"
                  checked={resultsFormData.matchWinner === 'team2'}
                  onChange={(e) => setResultsFormData({...resultsFormData, matchWinner: e.target.value})}
                  className="w-5 h-5"
                  disabled={isSaving}
                />
                <span className="font-semibold text-lg">
                  {team2?.name || 'Team 2'}
                </span>
              </label>
            </div>
          </div>

          {/* Score Entry */}
          {resultsFormData.matchWinner ? (
            <div className="bg-green-100 border-2 border-green-400 rounded-lg p-4 mb-6">
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
                    value={resultsFormData.set1Winner}
                    onChange={(e) => setResultsFormData({...resultsFormData, set1Winner: e.target.value})}
                    className="w-16 px-2 py-2 border-2 border-green-500 rounded text-center font-bold"
                    placeholder="6"
                    disabled={isSaving}
                  />
                  <span className="font-bold">-</span>
                  <input
                    type="number"
                    min="0"
                    max="7"
                    value={resultsFormData.set1Loser}
                    onChange={(e) => setResultsFormData({...resultsFormData, set1Loser: e.target.value})}
                    className="w-16 px-2 py-2 border-2 border-gray-300 rounded text-center"
                    placeholder="4"
                    disabled={isSaving}
                  />
                  <span className="text-xs font-semibold text-gray-600 w-24">{loserName}</span>
                </div>
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
                    value={resultsFormData.set2Winner}
                    onChange={(e) => setResultsFormData({...resultsFormData, set2Winner: e.target.value})}
                    className="w-16 px-2 py-2 border-2 border-green-500 rounded text-center font-bold"
                    placeholder="6"
                    disabled={isSaving}
                  />
                  <span className="font-bold">-</span>
                  <input
                    type="number"
                    min="0"
                    max="7"
                    value={resultsFormData.set2Loser}
                    onChange={(e) => setResultsFormData({...resultsFormData, set2Loser: e.target.value})}
                    className="w-16 px-2 py-2 border-2 border-gray-300 rounded text-center"
                    placeholder="3"
                    disabled={isSaving}
                  />
                  <span className="text-xs font-semibold text-gray-600 w-24">{loserName}</span>
                </div>
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
                    max={resultsFormData.set3IsTiebreaker ? "10" : "7"}
                    value={resultsFormData.set3Winner}
                    onChange={(e) => setResultsFormData({...resultsFormData, set3Winner: e.target.value})}
                    className="w-16 px-2 py-2 border-2 border-green-500 rounded text-center font-bold"
                    placeholder="0"
                    disabled={isSaving}
                  />
                  <span className="font-bold">-</span>
                  <input
                    type="number"
                    min="0"
                    max={resultsFormData.set3IsTiebreaker ? "10" : "7"}
                    value={resultsFormData.set3Loser}
                    onChange={(e) => setResultsFormData({...resultsFormData, set3Loser: e.target.value})}
                    className="w-16 px-2 py-2 border-2 border-gray-300 rounded text-center"
                    placeholder="0"
                    disabled={isSaving}
                  />
                  <span className="text-xs font-semibold text-gray-600 w-24">{loserName}</span>
                </div>
                {(resultsFormData.set3Winner || resultsFormData.set3Loser) && (
                  <label className="flex items-center gap-2 mt-2 text-sm">
                    <input
                      type="checkbox"
                      checked={resultsFormData.set3IsTiebreaker}
                      onChange={(e) => setResultsFormData({...resultsFormData, set3IsTiebreaker: e.target.checked})}
                      className="w-4 h-4"
                      disabled={isSaving}
                    />
                    <span>Set 3 was a 10-point tiebreaker</span>
                  </label>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-gray-100 border-2 border-gray-300 rounded-lg p-4 text-center mb-6">
              <p className="text-gray-600 font-semibold">
                👆 Please select the match winner above to enter scores
              </p>
            </div>
          )}

          {/* Error Message */}
          {saveError && (
            <div className="bg-red-50 border border-red-300 rounded-lg p-3 mb-4">
              <p className="text-red-800 text-sm">⚠️ {saveError}</p>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="sticky bottom-0 bg-gray-50 border-t px-6 py-4 flex justify-end gap-3">
          <button
            onClick={handleClose}
            className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-100 transition-colors"
            disabled={isSaving}
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            className="flex items-center gap-2 bg-green-600 text-white px-6 py-2 rounded hover:bg-green-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={isSaving || !resultsFormData.matchWinner}
          >
            <Save className="w-4 h-4" />
            {isSaving ? 'Saving...' : 'Save Results'}
          </button>
        </div>
      </div>
    </div>
  );
}
