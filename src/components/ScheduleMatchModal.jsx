/**
 * Schedule Match Modal
 *
 * Allows Directors and Captains to create pending matches.
 * Features:
 * - Team and player selection
 * - NTRP validation
 * - Match type (Doubles/Mixed)
 * - Level and date selection
 * - Notes
 */

import React, { useState, useEffect } from 'react';
import { X, AlertCircle, Users, Calendar } from 'lucide-react';
import {
  MATCH_TYPES,
  calculateCombinedNTRP,
  validateCombinedNTRP,
  validateMixedDoublesGenders,
  getRequiredPlayerCount,
  getLevelOptions,
  getDefaultLevel
} from '../utils/matchUtils';

export default function ScheduleMatchModal({
  isOpen,
  onClose,
  onSubmit,
  teams,
  players,
  userRole,
  userTeamId
}) {
  const [formData, setFormData] = useState({
    matchType: MATCH_TYPES.DOUBLES,
    team1Id: '',
    team2Id: '',
    scheduledDate: new Date().toISOString().split('T')[0],
    level: getDefaultLevel(MATCH_TYPES.DOUBLES),
    team1Players: [],
    team2Players: [],
    notes: ''
  });

  const [validationErrors, setValidationErrors] = useState({});
  const [isSaving, setIsSaving] = useState(false);

  // Reset form when opened
  useEffect(() => {
    if (isOpen) {
      const defaultTeamId = userRole === 'captain' ? userTeamId : '';
      setFormData({
        matchType: MATCH_TYPES.DOUBLES,
        team1Id: defaultTeamId ? defaultTeamId.toString() : '',
        team2Id: '',
        scheduledDate: new Date().toISOString().split('T')[0],
        level: getDefaultLevel(MATCH_TYPES.DOUBLES),
        team1Players: [],
        team2Players: [],
        notes: ''
      });
      setValidationErrors({});
    }
  }, [isOpen, userRole, userTeamId]);

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
      await onSubmit({
        matchType: formData.matchType,
        team1Id: parseInt(formData.team1Id),
        team2Id: parseInt(formData.team2Id),
        scheduledDate: formData.scheduledDate,
        level: formData.level,
        team1Players: formData.team1Players,
        team2Players: formData.team2Players,
        team1CombinedNTRP: calculateCombinedNTRP(formData.team1Players, players),
        team2CombinedNTRP: calculateCombinedNTRP(formData.team2Players, players),
        notes: formData.notes,
        status: 'pending'
      });
      onClose();
    } catch (error) {
      console.error('Error scheduling match:', error);
      alert('Failed to schedule match. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  const requiredCount = getRequiredPlayerCount(formData.matchType);
  const levelOptions = getLevelOptions(formData.matchType);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-5xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <Calendar className="w-6 h-6" />
              Schedule Match
            </h3>
            <p className="text-sm text-gray-600 mt-1">
              Create a pending match for future results entry
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
          {(validationErrors.teams || validationErrors.general) && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-red-700">
                {validationErrors.teams || validationErrors.general}
              </div>
            </div>
          )}

          {/* Match Type & Level */}
          <div className="grid grid-cols-2 gap-4">
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
          </div>

          {/* Date */}
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

          {/* Team Selection */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Team 1 *
              </label>
              <select
                value={formData.team1Id}
                onChange={(e) => setFormData({ ...formData, team1Id: e.target.value, team1Players: [] })}
                disabled={userRole === 'captain'}
                className={`w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  validationErrors.team1 ? 'border-red-300' : 'border-gray-300'
                } ${userRole === 'captain' ? 'bg-gray-100' : ''}`}
              >
                <option value="">Select Team 1</option>
                {teams.map(team => (
                  <option key={team.id} value={team.id}>{team.name}</option>
                ))}
              </select>
              {validationErrors.team1 && (
                <p className="text-sm text-red-600 mt-1">{validationErrors.team1}</p>
              )}
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
              {validationErrors.team2 && (
                <p className="text-sm text-red-600 mt-1">{validationErrors.team2}</p>
              )}
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
                <div className="border border-gray-300 rounded p-4 max-h-64 overflow-y-auto space-y-2">
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
                      {!validateCombinedNTRP(formData.team1Players, formData.level, players) && (
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
                  {getTeamName(formData.team2Id)} Players (Select {requiredCount}) *
                </label>
                <div className="border border-gray-300 rounded p-4 max-h-64 overflow-y-auto space-y-2">
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
                      {!validateCombinedNTRP(formData.team2Players, formData.level, players) && (
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
          )}

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
            {isSaving ? 'Scheduling...' : 'Schedule Match'}
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
