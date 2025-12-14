/**
 * Edit Pending Match Modal
 *
 * Allows Directors and match Captains to edit pending match details.
 * Features:
 * - Date and level editing
 * - Player selection changes
 * - NTRP re-validation
 * - Notes
 */

import React, { useState, useEffect } from 'react';
import { X, AlertCircle, Edit, Clock } from 'lucide-react';
import {
  MATCH_TYPES,
  calculateCombinedNTRP,
  validateCombinedNTRP,
  validateMixedDoublesGenders,
  getRequiredPlayerCount,
  getLevelOptions,
  getMatchType
} from '../utils/matchUtils';
import { formatDate } from '../utils/formatters';

export default function EditPendingMatchModal({
  isOpen,
  onClose,
  onSubmit,
  match,
  teams,
  players
}) {
  console.log('🎭 EditPendingMatchModal rendered - isOpen:', isOpen, 'match:', match);

  const [formData, setFormData] = useState({
    scheduledDate: '',
    level: '',
    team1Players: [],
    team2Players: [],
    notes: ''
  });

  const [validationErrors, setValidationErrors] = useState({});
  const [isSaving, setIsSaving] = useState(false);

  // Initialize form when match changes
  useEffect(() => {
    console.log('📝 EditPendingMatchModal useEffect - isOpen:', isOpen, 'match:', match);
    if (isOpen && match) {
      console.log('✅ Initializing form with match data:', {
        matchId: match.matchId,
        scheduledDate: match.scheduledDate || match.acceptedDate,
        level: match.level || match.acceptedLevel,
        team1Players: match.team1Players,
        team2Players: match.team2Players
      });
      setFormData({
        scheduledDate: match.scheduledDate || match.acceptedDate || new Date().toISOString().split('T')[0],
        level: match.level || match.acceptedLevel || '7.0',
        team1Players: match.team1Players || [],
        team2Players: match.team2Players || [],
        notes: match.notes || ''
      });
      setValidationErrors({});
    }
  }, [isOpen, match]);

  if (!match) {
    console.log('❌ EditPendingMatchModal - match is null, returning null');
    return null;
  }

  const matchType = getMatchType(match);
  const requiredCount = getRequiredPlayerCount(matchType);
  const levelOptions = getLevelOptions(matchType);

  console.log('🔍 Match type info:', { matchType, requiredCount, levelOptions });

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

    if (currentPlayers.includes(playerId)) {
      // Deselect player
      setFormData(prev => ({
        ...prev,
        [teamKey]: currentPlayers.filter(id => id !== playerId)
      }));
    } else {
      // Select player
      if (currentPlayers.length >= requiredCount) {
        alert(`⚠️ You can only select ${requiredCount} players for ${matchType}.`);
        return;
      }
      setFormData(prev => ({
        ...prev,
        [teamKey]: [...currentPlayers, playerId]
      }));
    }
  };

  // Validate form
  const validateForm = () => {
    const errors = {};

    // Player selection
    if (formData.team1Players.length !== requiredCount) {
      errors.team1Players = `Please select exactly ${requiredCount} players`;
    }
    if (formData.team2Players.length !== requiredCount) {
      errors.team2Players = `Please select exactly ${requiredCount} players`;
    }

    // NTRP validation
    if (formData.team1Players.length === requiredCount) {
      if (!validateCombinedNTRP(formData.team1Players, players, formData.level, matchType)) {
        errors.team1NTRP = `Combined NTRP exceeds match level (${formData.level})`;
      }
    }
    if (formData.team2Players.length === requiredCount) {
      if (!validateCombinedNTRP(formData.team2Players, players, formData.level, matchType)) {
        errors.team2NTRP = `Combined NTRP exceeds match level (${formData.level})`;
      }
    }

    // Mixed doubles gender validation
    if (matchType === MATCH_TYPES.MIXED_DOUBLES) {
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
    if (!formData.scheduledDate) errors.date = 'Please select a date';

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
      await onSubmit(match.matchId, {
        scheduledDate: formData.scheduledDate,
        level: formData.level,
        team1Players: formData.team1Players,
        team2Players: formData.team2Players,
        team1CombinedNTRP: calculateCombinedNTRP(formData.team1Players, players, matchType),
        team2CombinedNTRP: calculateCombinedNTRP(formData.team2Players, players, matchType),
        notes: formData.notes
      });
      onClose();
    } catch (error) {
      console.error('Error updating pending match:', error);
      alert('Failed to update match. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) {
    console.log('❌ EditPendingMatchModal - isOpen is false, returning null');
    return null;
  }

  console.log('✅ EditPendingMatchModal - About to render modal UI');

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-5xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                <Edit className="w-6 h-6" />
                Edit Pending Match
              </h3>
              <p className="text-sm text-gray-600 mt-1">
                {getTeamName(match.team1Id)} vs {getTeamName(match.team2Id)}
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* Match Info */}
          <div className="flex items-center gap-3 text-xs text-gray-600 mt-3 flex-wrap">
            {match.matchId && (
              <div className="font-mono bg-blue-100 px-2 py-1 rounded">
                <span className="font-semibold">Match ID:</span> {match.matchId}
              </div>
            )}
            {match.challengeId && (
              <div className="font-mono bg-orange-100 px-2 py-1 rounded">
                <span className="font-semibold">Challenge ID:</span> {match.challengeId}
              </div>
            )}
            {match.createdAt && (
              <div className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                <span>Created: {formatDate(match.createdAt)}</span>
              </div>
            )}
          </div>
        </div>

        {/* Body */}
        <div className="px-6 py-4 space-y-6">
          {/* General errors */}
          {validationErrors.general && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-red-700">
                {validationErrors.general}
              </div>
            </div>
          )}

          {/* Date & Level */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Match Date *
              </label>
              <input
                type="date"
                value={formData.scheduledDate}
                onChange={(e) => setFormData({ ...formData, scheduledDate: e.target.value })}
                className={`w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  validationErrors.date ? 'border-red-300' : 'border-gray-300'
                }`}
              />
              {validationErrors.date && (
                <p className="text-sm text-red-600 mt-1">{validationErrors.date}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Match Level *
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
          </div>

          {/* Player Selection */}
          <div className="grid grid-cols-2 gap-4">
            {/* Team 1 Players */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {getTeamName(match.team1Id)} Players (Select {requiredCount}) *
              </label>
              <div className="border border-gray-300 rounded p-4 max-h-64 overflow-y-auto space-y-2">
                {getTeamRoster(match.team1Id).map(player => (
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
                    validateCombinedNTRP(formData.team1Players, players, formData.level, matchType)
                      ? 'text-green-600'
                      : 'text-red-600'
                  }`}>
                    Combined NTRP: {calculateCombinedNTRP(formData.team1Players, players, matchType).toFixed(1)}
                    {!validateCombinedNTRP(formData.team1Players, players, formData.level, matchType) && (
                      <span className="block text-xs mt-0.5">
                        ⚠️ Exceeds match level ({formData.level})
                      </span>
                    )}
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
                {getTeamName(match.team2Id)} Players (Select {requiredCount}) *
              </label>
              <div className="border border-gray-300 rounded p-4 max-h-64 overflow-y-auto space-y-2">
                {getTeamRoster(match.team2Id).map(player => (
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
                    validateCombinedNTRP(formData.team2Players, players, formData.level, matchType)
                      ? 'text-green-600'
                      : 'text-red-600'
                  }`}>
                    Combined NTRP: {calculateCombinedNTRP(formData.team2Players, players, matchType).toFixed(1)}
                    {!validateCombinedNTRP(formData.team2Players, players, formData.level, matchType) && (
                      <span className="block text-xs mt-0.5">
                        ⚠️ Exceeds match level ({formData.level})
                      </span>
                    )}
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
            className="flex-1 bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition-colors font-medium disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            {isSaving ? 'Saving...' : 'Save Changes'}
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
