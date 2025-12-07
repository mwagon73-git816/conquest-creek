/**
 * Record Match Results Modal
 *
 * Allows Directors to directly record completed matches with all details.
 * Features:
 * - Team and player selection
 * - NTRP validation
 * - Match type (Doubles/Mixed)
 * - Level and date selection
 * - Score entry (sets and games)
 * - Photo upload
 * - Notes
 */

import React, { useState, useEffect } from 'react';
import { X, AlertCircle, Trophy, Upload, Image as ImageIcon } from 'lucide-react';
import {
  MATCH_TYPES,
  calculateCombinedNTRP,
  validateCombinedNTRP,
  validateMixedDoublesGenders,
  getRequiredPlayerCount,
  getLevelOptions,
  getDefaultLevel
} from '../utils/matchUtils';

export default function RecordMatchModal({
  isOpen,
  onClose,
  onSubmit,
  teams,
  players,
  onAddPhoto
}) {
  const [formData, setFormData] = useState({
    matchType: MATCH_TYPES.DOUBLES,
    team1Id: '',
    team2Id: '',
    matchDate: new Date().toISOString().split('T')[0],
    level: getDefaultLevel(MATCH_TYPES.DOUBLES),
    team1Players: [],
    team2Players: [],
    matchWinner: '',
    set1Winner: '',
    set1Loser: '',
    set2Winner: '',
    set2Loser: '',
    set3Winner: '',
    set3Loser: '',
    set3IsTiebreaker: false,
    notes: ''
  });

  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [validationErrors, setValidationErrors] = useState({});
  const [isSaving, setIsSaving] = useState(false);

  // Reset form when opened
  useEffect(() => {
    if (isOpen) {
      setFormData({
        matchType: MATCH_TYPES.DOUBLES,
        team1Id: '',
        team2Id: '',
        matchDate: new Date().toISOString().split('T')[0],
        level: getDefaultLevel(MATCH_TYPES.DOUBLES),
        team1Players: [],
        team2Players: [],
        matchWinner: '',
        set1Winner: '',
        set1Loser: '',
        set2Winner: '',
        set2Loser: '',
        set3Winner: '',
        set3Loser: '',
        set3IsTiebreaker: false,
        notes: ''
      });
      setPhotoFile(null);
      setPhotoPreview(null);
      setValidationErrors({});
    }
  }, [isOpen]);

  // Update level when match type changes
  useEffect(() => {
    setFormData(prev => ({
      ...prev,
      level: getDefaultLevel(prev.matchType),
      team1Players: [],
      team2Players: []
    }));
  }, [formData.matchType]);

  // Get roster for a team
  const getTeamRoster = (teamId) => {
    if (!teamId) return [];
    return players.filter(p => p.teamId === parseInt(teamId));
  };

  // Get team name
  const getTeamName = (teamId) => {
    const team = teams.find(t => t.id === parseInt(teamId));
    return team ? team.name : 'Unknown Team';
  };

  // Handle player selection
  const handlePlayerToggle = (teamKey, playerId) => {
    const currentPlayers = formData[teamKey];
    const requiredCount = getRequiredPlayerCount(formData.matchType);

    if (currentPlayers.includes(playerId)) {
      // Deselect player
      setFormData(prev => ({
        ...prev,
        [teamKey]: currentPlayers.filter(id => id !== playerId)
      }));
    } else {
      // Select player
      if (currentPlayers.length >= requiredCount) {
        alert(`⚠️ You can only select ${requiredCount} players for ${formData.matchType}.`);
        return;
      }
      setFormData(prev => ({
        ...prev,
        [teamKey]: [...currentPlayers, playerId]
      }));
    }
  };

  // Handle photo upload
  const handlePhotoChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file size (5MB limit)
      if (file.size > 5 * 1024 * 1024) {
        alert('Photo must be less than 5MB');
        return;
      }

      // Validate file type
      if (!file.type.startsWith('image/')) {
        alert('Please select an image file');
        return;
      }

      setPhotoFile(file);

      // Create preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotoPreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

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

  // Calculate match results from winner/loser scores
  const calculateResults = () => {
    if (!formData.matchWinner) return { team1Sets: 0, team2Sets: 0, team1Games: 0, team2Games: 0, winner: '' };

    // Sync scores to team1/team2 format
    const teamScores = syncWinnerLoserToTeamScores(
      formData.matchWinner,
      formData.set1Winner,
      formData.set1Loser,
      formData.set2Winner,
      formData.set2Loser,
      formData.set3Winner || '',
      formData.set3Loser || ''
    );

    const s1t1 = parseInt(teamScores.set1Team1) || 0;
    const s1t2 = parseInt(teamScores.set1Team2) || 0;
    const s2t1 = parseInt(teamScores.set2Team1) || 0;
    const s2t2 = parseInt(teamScores.set2Team2) || 0;
    const s3t1 = parseInt(teamScores.set3Team1) || 0;
    const s3t2 = parseInt(teamScores.set3Team2) || 0;

    // Count sets won
    let team1Sets = 0;
    let team2Sets = 0;
    if (s1t1 > s1t2) team1Sets++;
    else if (s1t2 > s1t1) team2Sets++;
    if (s2t1 > s2t2) team1Sets++;
    else if (s2t2 > s2t1) team2Sets++;
    if (s3t1 > s3t2) team1Sets++;
    else if (s3t2 > s3t1) team2Sets++;

    // Calculate games
    let team1Games = s1t1 + s2t1 + s3t1;
    let team2Games = s1t2 + s2t2 + s3t2;

    return { team1Sets, team2Sets, team1Games, team2Games, winner: formData.matchWinner };
  };

  // Validate form
  const validateForm = () => {
    const errors = {};
    const requiredCount = getRequiredPlayerCount(formData.matchType);

    // Team selection
    if (!formData.team1Id) errors.team1 = 'Please select Team 1';
    if (!formData.team2Id) errors.team2 = 'Please select Team 2';
    if (formData.team1Id && formData.team2Id && formData.team1Id === formData.team2Id) {
      errors.teams = 'Teams must be different';
    }

    // Player selection
    if (formData.team1Players.length !== requiredCount) {
      errors.team1Players = `Please select exactly ${requiredCount} players`;
    }
    if (formData.team2Players.length !== requiredCount) {
      errors.team2Players = `Please select exactly ${requiredCount} players`;
    }

    // NTRP validation
    if (formData.team1Players.length === requiredCount) {
      if (!validateCombinedNTRP(formData.team1Players, players, formData.level, formData.matchType)) {
        errors.team1NTRP = `Combined NTRP exceeds match level (${formData.level})`;
      }
    }
    if (formData.team2Players.length === requiredCount) {
      if (!validateCombinedNTRP(formData.team2Players, players, formData.level, formData.matchType)) {
        errors.team2NTRP = `Combined NTRP exceeds match level (${formData.level})`;
      }
    }

    // Mixed doubles gender validation
    if (formData.matchType === MATCH_TYPES.MIXED_DOUBLES) {
      if (formData.team1Players.length === 2) {
        if (!validateMixedDoublesGenders(formData.team1Players, players)) {
          errors.team1Gender = 'Mixed doubles requires 1 male and 1 female';
        }
      }
      if (formData.team2Players.length === 2) {
        if (!validateMixedDoublesGenders(formData.team2Players, players)) {
          errors.team2Gender = 'Mixed doubles requires 1 male and 1 female';
        }
      }
    }

    // Date
    if (!formData.matchDate) errors.date = 'Please select a date';

    // Winner selection
    if (!formData.matchWinner) {
      errors.general = 'Please select the match winner';
      setValidationErrors(errors);
      return false;
    }

    // Score validation
    if (!formData.set1Winner || !formData.set1Loser) {
      errors.general = 'Please enter Set 1 scores';
      setValidationErrors(errors);
      return false;
    }

    if (!formData.set2Winner || !formData.set2Loser) {
      errors.general = 'Please enter Set 2 scores';
      setValidationErrors(errors);
      return false;
    }

    // Validate tennis scores
    const set1Validation = validateTennisScore(formData.set1Winner, formData.set1Loser, false);
    if (!set1Validation.valid) {
      errors.general = `Set 1: ${set1Validation.error}`;
      setValidationErrors(errors);
      return false;
    }

    const set2Validation = validateTennisScore(formData.set2Winner, formData.set2Loser, false);
    if (!set2Validation.valid) {
      errors.general = `Set 2: ${set2Validation.error}`;
      setValidationErrors(errors);
      return false;
    }

    if (formData.set3Winner && formData.set3Loser) {
      const set3Validation = validateTennisScore(
        formData.set3Winner,
        formData.set3Loser,
        formData.set3IsTiebreaker,
        true
      );
      if (!set3Validation.valid) {
        errors.general = `Set 3: ${set3Validation.error}`;
        setValidationErrors(errors);
        return false;
      }
    }

    // Determine who won each set
    const set1WinnerWon = parseInt(formData.set1Winner) > parseInt(formData.set1Loser);
    const set2WinnerWon = parseInt(formData.set2Winner) > parseInt(formData.set2Loser);

    // Check if sets are split (1-1)
    const setsSplit = set1WinnerWon !== set2WinnerWon;

    // If sets are split, third set is REQUIRED
    if (setsSplit && (!formData.set3Winner || !formData.set3Loser)) {
      errors.general = 'Sets are split 1-1. A third set (match tiebreak) is required. Enter 1-0 for the tiebreak winner.';
      setValidationErrors(errors);
      return false;
    }

    // If sets are NOT split (winner won both), third set should NOT be entered
    if (!setsSplit && formData.set3Winner && formData.set3Loser) {
      errors.general = 'The selected winner won both sets. A third set should not be entered.';
      setValidationErrors(errors);
      return false;
    }

    // If third set is entered, validate that the selected winner actually won 2 out of 3 sets
    if (formData.set3Winner && formData.set3Loser) {
      const set3WinnerWon = parseInt(formData.set3Winner) > parseInt(formData.set3Loser);

      // Count how many sets the selected winner won
      let selectedWinnerSetsWon = 0;
      if (set1WinnerWon) selectedWinnerSetsWon++;
      if (set2WinnerWon) selectedWinnerSetsWon++;
      if (set3WinnerWon) selectedWinnerSetsWon++;

      if (selectedWinnerSetsWon < 2) {
        errors.general = 'The selected winner did not win 2 out of 3 sets. Please check your scores or select the correct winner.';
        setValidationErrors(errors);
        return false;
      }
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Handle submit
  const handleSubmit = async () => {
    if (!validateForm()) {
      return;
    }

    setIsSaving(true);
    try {
      // Sync scores to team1/team2 format
      const teamScores = syncWinnerLoserToTeamScores(
        formData.matchWinner,
        formData.set1Winner,
        formData.set1Loser,
        formData.set2Winner,
        formData.set2Loser,
        formData.set3Winner || '',
        formData.set3Loser || ''
      );

      const results = calculateResults();

      // Upload photo if provided
      let photoUrl = null;
      if (photoFile && onAddPhoto) {
        const photoResult = await onAddPhoto(photoFile);
        photoUrl = photoResult?.url || null;
      }

      // Build match data object, conditionally including optional fields
      const matchData = {
        matchType: formData.matchType,
        team1Id: parseInt(formData.team1Id),
        team2Id: parseInt(formData.team2Id),
        date: formData.matchDate,
        level: formData.level,
        team1Players: formData.team1Players,
        team2Players: formData.team2Players,
        team1CombinedNTRP: calculateCombinedNTRP(formData.team1Players, players, formData.matchType),
        team2CombinedNTRP: calculateCombinedNTRP(formData.team2Players, players, formData.matchType),
        winner: formData.matchWinner,
        set1Team1: parseInt(teamScores.set1Team1) || 0,
        set1Team2: parseInt(teamScores.set1Team2) || 0,
        set2Team1: parseInt(teamScores.set2Team1) || 0,
        set2Team2: parseInt(teamScores.set2Team2) || 0,
        team1Sets: results.team1Sets,
        team2Sets: results.team2Sets,
        team1Games: results.team1Games,
        team2Games: results.team2Games,
        status: 'completed',
        completedAt: new Date().toISOString()
      };

      // Conditionally add Set 3 scores if they exist
      if (teamScores.set3Team1 && teamScores.set3Team2) {
        matchData.set3Team1 = parseInt(teamScores.set3Team1);
        matchData.set3Team2 = parseInt(teamScores.set3Team2);
        matchData.set3IsTiebreaker = formData.set3IsTiebreaker;
      }

      // Conditionally add notes if provided
      if (formData.notes && formData.notes.trim()) {
        matchData.notes = formData.notes;
      }

      // Conditionally add photo URL if provided
      if (photoUrl) {
        matchData.photoUrl = photoUrl;
      }

      await onSubmit(matchData);
      onClose();
    } catch (error) {
      console.error('Error recording match:', error);
      alert('Failed to record match. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  const requiredCount = getRequiredPlayerCount(formData.matchType);
  const levelOptions = getLevelOptions(formData.matchType);

  // Get winning and losing team names for score labels
  const winningTeam = teams.find(t =>
    t.id === (formData.matchWinner === 'team1' ? parseInt(formData.team1Id) : parseInt(formData.team2Id))
  );
  const losingTeam = teams.find(t =>
    t.id === (formData.matchWinner === 'team1' ? parseInt(formData.team2Id) : parseInt(formData.team1Id))
  );
  const winnerName = winningTeam?.name || 'Winner';
  const loserName = losingTeam?.name || 'Loser';

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-6xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <Trophy className="w-6 h-6" />
              Record Match Results
            </h3>
            <p className="text-sm text-gray-600 mt-1">
              Directly record a completed match with all details
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-4 space-y-6">
          {/* General errors */}
          {(validationErrors.teams || validationErrors.scores || validationErrors.general) && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-red-700">
                {validationErrors.teams || validationErrors.scores || validationErrors.general}
              </div>
            </div>
          )}

          {/* Match Type, Level & Date */}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Match Type *
              </label>
              <select
                value={formData.matchType}
                onChange={(e) => setFormData({ ...formData, matchType: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value={MATCH_TYPES.SINGLES}>Singles</option>
                <option value={MATCH_TYPES.DOUBLES}>Doubles</option>
                <option value={MATCH_TYPES.MIXED_DOUBLES}>Mixed Doubles</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Level *
              </label>
              <select
                value={formData.level}
                onChange={(e) => setFormData({ ...formData, level: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {levelOptions.map(level => (
                  <option key={level} value={level}>{level}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Match Date *
              </label>
              <input
                type="date"
                value={formData.matchDate}
                onChange={(e) => setFormData({ ...formData, matchDate: e.target.value })}
                className={`w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  validationErrors.date ? 'border-red-300' : 'border-gray-300'
                }`}
              />
            </div>
          </div>

          {/* Team Selection */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Team 1 *
              </label>
              <select
                value={formData.team1Id}
                onChange={(e) => setFormData({ ...formData, team1Id: e.target.value, team1Players: [] })}
                className={`w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  validationErrors.team1 ? 'border-red-300' : 'border-gray-300'
                }`}
              >
                <option value="">Select Team 1</option>
                {teams.map(team => (
                  <option key={team.id} value={team.id}>{team.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Team 2 *
              </label>
              <select
                value={formData.team2Id}
                onChange={(e) => setFormData({ ...formData, team2Id: e.target.value, team2Players: [] })}
                className={`w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  validationErrors.team2 ? 'border-red-300' : 'border-gray-300'
                }`}
              >
                <option value="">Select Team 2</option>
                {teams.map(team => (
                  <option key={team.id} value={team.id}>{team.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Player Selection */}
          {formData.team1Id && formData.team2Id && (
            <div className="grid grid-cols-2 gap-4">
              {/* Team 1 Players */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {getTeamName(formData.team1Id)} Players (Select {requiredCount}) *
                </label>
                <div className="border border-gray-300 rounded p-4 max-h-48 overflow-y-auto space-y-2">
                  {getTeamRoster(formData.team1Id).map(player => (
                    <label
                      key={player.id}
                      className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-2 rounded"
                    >
                      <input
                        type="checkbox"
                        checked={formData.team1Players.includes(player.id)}
                        onChange={() => handlePlayerToggle('team1Players', player.id)}
                        className="rounded"
                      />
                      <span className="text-sm flex-1">
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
                    Selected: {formData.team1Players.length} / {requiredCount} players
                  </p>
                  {formData.team1Players.length === requiredCount && (
                    <div className={`text-sm font-medium ${
                      validateCombinedNTRP(formData.team1Players, players, formData.level, formData.matchType)
                        ? 'text-green-600'
                        : 'text-red-600'
                    }`}>
                      Combined NTRP: {calculateCombinedNTRP(formData.team1Players, players, formData.matchType).toFixed(1)}
                    </div>
                  )}
                  {validationErrors.team1Players && (
                    <p className="text-sm text-red-600">{validationErrors.team1Players}</p>
                  )}
                  {validationErrors.team1NTRP && (
                    <p className="text-sm text-red-600">{validationErrors.team1NTRP}</p>
                  )}
                  {validationErrors.team1Gender && (
                    <p className="text-sm text-red-600">{validationErrors.team1Gender}</p>
                  )}
                </div>
              </div>

              {/* Team 2 Players */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {getTeamName(formData.team2Id)} Players (Select {requiredCount}) *
                </label>
                <div className="border border-gray-300 rounded p-4 max-h-48 overflow-y-auto space-y-2">
                  {getTeamRoster(formData.team2Id).map(player => (
                    <label
                      key={player.id}
                      className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-2 rounded"
                    >
                      <input
                        type="checkbox"
                        checked={formData.team2Players.includes(player.id)}
                        onChange={() => handlePlayerToggle('team2Players', player.id)}
                        className="rounded"
                      />
                      <span className="text-sm flex-1">
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
                    Selected: {formData.team2Players.length} / {requiredCount} players
                  </p>
                  {formData.team2Players.length === requiredCount && (
                    <div className={`text-sm font-medium ${
                      validateCombinedNTRP(formData.team2Players, players, formData.level, formData.matchType)
                        ? 'text-green-600'
                        : 'text-red-600'
                    }`}>
                      Combined NTRP: {calculateCombinedNTRP(formData.team2Players, players, formData.matchType).toFixed(1)}
                    </div>
                  )}
                  {validationErrors.team2Players && (
                    <p className="text-sm text-red-600">{validationErrors.team2Players}</p>
                  )}
                  {validationErrors.team2NTRP && (
                    <p className="text-sm text-red-600">{validationErrors.team2NTRP}</p>
                  )}
                  {validationErrors.team2Gender && (
                    <p className="text-sm text-red-600">{validationErrors.team2Gender}</p>
                  )}
                </div>
              </div>
            </div>
          )}

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
                  checked={formData.matchWinner === 'team1'}
                  onChange={(e) => setFormData({...formData, matchWinner: e.target.value})}
                  disabled={!formData.team1Id || !formData.team2Id || isSaving}
                  className="w-5 h-5"
                />
                <span className="font-semibold text-lg">
                  {getTeamName(formData.team1Id) || 'Team 1'}
                </span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer bg-white px-4 py-3 rounded-lg border-2 border-gray-300 hover:border-blue-500 transition-colors flex-1">
                <input
                  type="radio"
                  name="matchWinner"
                  value="team2"
                  checked={formData.matchWinner === 'team2'}
                  onChange={(e) => setFormData({...formData, matchWinner: e.target.value})}
                  disabled={!formData.team1Id || !formData.team2Id || isSaving}
                  className="w-5 h-5"
                />
                <span className="font-semibold text-lg">
                  {getTeamName(formData.team2Id) || 'Team 2'}
                </span>
              </label>
            </div>
          </div>

          {/* Score Entry */}
          {formData.matchWinner ? (
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
                    value={formData.set1Winner}
                    onChange={(e) => setFormData({...formData, set1Winner: e.target.value})}
                    className="w-16 px-2 py-2 border-2 border-green-500 rounded text-center font-bold"
                    placeholder="6"
                    disabled={isSaving}
                  />
                  <span className="font-bold">-</span>
                  <input
                    type="number"
                    min="0"
                    max="7"
                    value={formData.set1Loser}
                    onChange={(e) => setFormData({...formData, set1Loser: e.target.value})}
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
                    value={formData.set2Winner}
                    onChange={(e) => setFormData({...formData, set2Winner: e.target.value})}
                    className="w-16 px-2 py-2 border-2 border-green-500 rounded text-center font-bold"
                    placeholder="6"
                    disabled={isSaving}
                  />
                  <span className="font-bold">-</span>
                  <input
                    type="number"
                    min="0"
                    max="7"
                    value={formData.set2Loser}
                    onChange={(e) => setFormData({...formData, set2Loser: e.target.value})}
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
                    max={formData.set3IsTiebreaker ? "10" : "7"}
                    value={formData.set3Winner}
                    onChange={(e) => setFormData({...formData, set3Winner: e.target.value})}
                    className="w-16 px-2 py-2 border-2 border-green-500 rounded text-center font-bold"
                    placeholder="0"
                    disabled={isSaving}
                  />
                  <span className="font-bold">-</span>
                  <input
                    type="number"
                    min="0"
                    max={formData.set3IsTiebreaker ? "10" : "7"}
                    value={formData.set3Loser}
                    onChange={(e) => setFormData({...formData, set3Loser: e.target.value})}
                    className="w-16 px-2 py-2 border-2 border-gray-300 rounded text-center"
                    placeholder="0"
                    disabled={isSaving}
                  />
                  <span className="text-xs font-semibold text-gray-600 w-24">{loserName}</span>
                </div>
                {(formData.set3Winner || formData.set3Loser) && (
                  <label className="flex items-center gap-2 mt-2 text-sm">
                    <input
                      type="checkbox"
                      checked={formData.set3IsTiebreaker}
                      onChange={(e) => setFormData({...formData, set3IsTiebreaker: e.target.checked})}
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

          {/* Photo Upload */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Match Photo (Optional)
            </label>
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-4">
              {photoPreview ? (
                <div className="space-y-3">
                  <img
                    src={photoPreview}
                    alt="Match preview"
                    className="max-w-full h-48 object-contain mx-auto rounded"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setPhotoFile(null);
                      setPhotoPreview(null);
                    }}
                    className="w-full px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded transition"
                  >
                    Remove Photo
                  </button>
                </div>
              ) : (
                <label className="flex flex-col items-center cursor-pointer">
                  <Upload className="w-8 h-8 text-gray-400 mb-2" />
                  <span className="text-sm text-gray-600">Click to upload photo</span>
                  <span className="text-xs text-gray-500 mt-1">PNG, JPG up to 5MB</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handlePhotoChange}
                    className="hidden"
                  />
                </label>
              )}
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Notes (Optional)
            </label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Add any additional notes about this match..."
            />
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 flex gap-3">
          <button
            onClick={handleSubmit}
            disabled={isSaving}
            className="flex-1 bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 transition-colors font-medium disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            {isSaving ? 'Recording...' : 'Record Match'}
          </button>
          <button
            onClick={onClose}
            disabled={isSaving}
            className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
