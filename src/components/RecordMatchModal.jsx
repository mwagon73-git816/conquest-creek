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
    set1Team1: '',
    set1Team2: '',
    set2Team1: '',
    set2Team2: '',
    set3Team1: '',
    set3Team2: '',
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
        set1Team1: '',
        set1Team2: '',
        set2Team1: '',
        set2Team2: '',
        set3Team1: '',
        set3Team2: '',
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

  // Calculate match results from scores
  const calculateResults = () => {
    const s1t1 = parseInt(formData.set1Team1) || 0;
    const s1t2 = parseInt(formData.set1Team2) || 0;
    const s2t1 = parseInt(formData.set2Team1) || 0;
    const s2t2 = parseInt(formData.set2Team2) || 0;
    const s3t1 = parseInt(formData.set3Team1) || 0;
    const s3t2 = parseInt(formData.set3Team2) || 0;

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

    // Determine winner
    let winner = '';
    if (team1Sets > team2Sets) winner = 'team1';
    else if (team2Sets > team1Sets) winner = 'team2';

    return { team1Sets, team2Sets, team1Games, team2Games, winner };
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
      if (!validateCombinedNTRP(formData.team1Players, formData.level, players)) {
        errors.team1NTRP = `Combined NTRP exceeds match level (${formData.level})`;
      }
    }
    if (formData.team2Players.length === requiredCount) {
      if (!validateCombinedNTRP(formData.team2Players, formData.level, players)) {
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
    if (!formData.matchWinner) errors.winner = 'Please select the winning team';

    // Score validation
    if (!formData.set1Team1 || !formData.set1Team2) errors.set1 = 'Please enter Set 1 scores';
    if (!formData.set2Team1 || !formData.set2Team2) errors.set2 = 'Please enter Set 2 scores';

    // Validate that scores match winner
    const results = calculateResults();
    if (formData.matchWinner && results.winner && formData.matchWinner !== results.winner) {
      errors.scores = 'Scores do not match the selected winner';
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
      const results = calculateResults();

      // Upload photo if provided
      let photoUrl = null;
      if (photoFile && onAddPhoto) {
        const photoResult = await onAddPhoto(photoFile);
        photoUrl = photoResult?.url || null;
      }

      await onSubmit({
        matchType: formData.matchType,
        team1Id: parseInt(formData.team1Id),
        team2Id: parseInt(formData.team2Id),
        date: formData.matchDate,
        level: formData.level,
        team1Players: formData.team1Players,
        team2Players: formData.team2Players,
        team1CombinedNTRP: calculateCombinedNTRP(formData.team1Players, players),
        team2CombinedNTRP: calculateCombinedNTRP(formData.team2Players, players),
        winner: formData.matchWinner,
        set1Team1: parseInt(formData.set1Team1),
        set1Team2: parseInt(formData.set1Team2),
        set2Team1: parseInt(formData.set2Team1),
        set2Team2: parseInt(formData.set2Team2),
        set3Team1: formData.set3Team1 ? parseInt(formData.set3Team1) : undefined,
        set3Team2: formData.set3Team2 ? parseInt(formData.set3Team2) : undefined,
        set3IsTiebreaker: formData.set3IsTiebreaker,
        team1Sets: results.team1Sets,
        team2Sets: results.team2Sets,
        team1Games: results.team1Games,
        team2Games: results.team2Games,
        notes: formData.notes,
        photoUrl,
        status: 'completed',
        completedAt: new Date().toISOString()
      });
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
                      validateCombinedNTRP(formData.team1Players, formData.level, players)
                        ? 'text-green-600'
                        : 'text-red-600'
                    }`}>
                      Combined NTRP: {calculateCombinedNTRP(formData.team1Players, players).toFixed(1)}
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
                      validateCombinedNTRP(formData.team2Players, formData.level, players)
                        ? 'text-green-600'
                        : 'text-red-600'
                    }`}>
                      Combined NTRP: {calculateCombinedNTRP(formData.team2Players, players).toFixed(1)}
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
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Match Winner *
            </label>
            <select
              value={formData.matchWinner}
              onChange={(e) => setFormData({ ...formData, matchWinner: e.target.value })}
              disabled={!formData.team1Id || !formData.team2Id}
              className={`w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                validationErrors.winner ? 'border-red-300' : 'border-gray-300'
              }`}
            >
              <option value="">Select Winner</option>
              {formData.team1Id && (
                <option value="team1">{getTeamName(formData.team1Id)} (Team 1)</option>
              )}
              {formData.team2Id && (
                <option value="team2">{getTeamName(formData.team2Id)} (Team 2)</option>
              )}
            </select>
            {validationErrors.winner && (
              <p className="text-sm text-red-600 mt-1">{validationErrors.winner}</p>
            )}
          </div>

          {/* Score Entry */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-lg font-semibold text-gray-900">Match Scores</h4>
              <p className="text-sm text-gray-600">Enter scores from winner's perspective</p>
            </div>

            {/* Set 1 */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Set 1 - {getTeamName(formData.team1Id) || 'Team 1'} *
                </label>
                <input
                  type="number"
                  min="0"
                  max="7"
                  value={formData.set1Team1}
                  onChange={(e) => setFormData({ ...formData, set1Team1: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Set 1 - {getTeamName(formData.team2Id) || 'Team 2'} *
                </label>
                <input
                  type="number"
                  min="0"
                  max="7"
                  value={formData.set1Team2}
                  onChange={(e) => setFormData({ ...formData, set1Team2: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            {validationErrors.set1 && (
              <p className="text-sm text-red-600">{validationErrors.set1}</p>
            )}

            {/* Set 2 */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Set 2 - {getTeamName(formData.team1Id) || 'Team 1'} *
                </label>
                <input
                  type="number"
                  min="0"
                  max="7"
                  value={formData.set2Team1}
                  onChange={(e) => setFormData({ ...formData, set2Team1: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Set 2 - {getTeamName(formData.team2Id) || 'Team 2'} *
                </label>
                <input
                  type="number"
                  min="0"
                  max="7"
                  value={formData.set2Team2}
                  onChange={(e) => setFormData({ ...formData, set2Team2: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            {validationErrors.set2 && (
              <p className="text-sm text-red-600">{validationErrors.set2}</p>
            )}

            {/* Set 3 */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Set 3 - {getTeamName(formData.team1Id) || 'Team 1'} (Optional)
                </label>
                <input
                  type="number"
                  min="0"
                  max="10"
                  value={formData.set3Team1}
                  onChange={(e) => setFormData({ ...formData, set3Team1: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Set 3 - {getTeamName(formData.team2Id) || 'Team 2'} (Optional)
                </label>
                <input
                  type="number"
                  min="0"
                  max="10"
                  value={formData.set3Team2}
                  onChange={(e) => setFormData({ ...formData, set3Team2: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* Set 3 Tiebreaker Checkbox */}
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="set3IsTiebreaker"
                checked={formData.set3IsTiebreaker}
                onChange={(e) => setFormData({ ...formData, set3IsTiebreaker: e.target.checked })}
                className="rounded"
              />
              <label htmlFor="set3IsTiebreaker" className="text-sm text-gray-700">
                Set 3 is a 10-point tiebreaker
              </label>
            </div>
          </div>

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
