/**
 * Match Type Utilities
 * Helper functions for Singles, Doubles, and Mixed Doubles match support
 */

// Match type constants
export const MATCH_TYPES = {
  SINGLES: 'singles',
  DOUBLES: 'doubles',
  MIXED_DOUBLES: 'mixed_doubles'
};

/**
 * Get the required number of players for a match type
 * @param {string} matchType - "singles", "doubles", or "mixed_doubles"
 * @returns {number} Number of players required per team (1 for singles, 2 for doubles/mixed doubles)
 */
export const getRequiredPlayerCount = (matchType) => {
  return matchType === MATCH_TYPES.SINGLES ? 1 : 2;
};

/**
 * Validate that the correct number of players is selected for the match type
 * @param {Array} selectedPlayers - Array of selected player IDs
 * @param {string} matchType - "singles", "doubles", or "mixed_doubles"
 * @returns {boolean} True if valid, false otherwise
 */
export const validatePlayerSelection = (selectedPlayers, matchType = MATCH_TYPES.DOUBLES) => {
  const requiredCount = getRequiredPlayerCount(matchType);
  return selectedPlayers.length === requiredCount;
};

/**
 * Validate Mixed Doubles gender requirements (1 male + 1 female per team)
 * @param {Array} selectedPlayerIds - Array of selected player IDs
 * @param {Array} players - Array of all players
 * @returns {boolean} True if team has exactly 1 male and 1 female player
 */
export const validateMixedDoublesGenders = (selectedPlayerIds, players) => {
  // Defensive coding: validate input parameters
  if (!selectedPlayerIds || !Array.isArray(selectedPlayerIds) || selectedPlayerIds.length !== 2) {
    return false;
  }

  if (!players || !Array.isArray(players)) {
    console.error('validateMixedDoublesGenders: players must be an array', players);
    return false;
  }

  const player1 = players.find(p => p.id === selectedPlayerIds[0]);
  const player2 = players.find(p => p.id === selectedPlayerIds[1]);

  if (!player1 || !player2) return false;

  const genders = [player1.gender, player2.gender];
  const hasMale = genders.includes('M');
  const hasFemale = genders.includes('F');

  return hasMale && hasFemale;
};

/**
 * Calculate combined NTRP rating for selected players
 * For singles: returns the single player's rating
 * For doubles/mixed doubles: returns the sum of both players' ratings
 * @param {Array} selectedPlayerIds - Array of selected player IDs
 * @param {Array} players - Array of all players
 * @param {string} matchType - "singles", "doubles", or "mixed_doubles"
 * @returns {number} Combined NTRP rating
 */
export const calculateCombinedNTRP = (selectedPlayerIds, players, matchType = MATCH_TYPES.DOUBLES) => {
  // Defensive coding: validate input parameters
  if (!selectedPlayerIds || !Array.isArray(selectedPlayerIds)) {
    console.error('calculateCombinedNTRP: selectedPlayerIds must be an array', selectedPlayerIds);
    return 0;
  }

  if (!players || !Array.isArray(players)) {
    console.error('calculateCombinedNTRP: players must be an array', players);
    return 0;
  }

  const requiredCount = getRequiredPlayerCount(matchType);

  if (selectedPlayerIds.length !== requiredCount) return 0;

  if (matchType === MATCH_TYPES.SINGLES) {
    const player = players.find(p => p.id === selectedPlayerIds[0]);
    return player ? parseFloat(player.ntrpRating) : 0;
  } else {
    // Doubles or Mixed Doubles
    const player1 = players.find(p => p.id === selectedPlayerIds[0]);
    const player2 = players.find(p => p.id === selectedPlayerIds[1]);

    if (!player1 || !player2) return 0;

    return parseFloat(player1.ntrpRating) + parseFloat(player2.ntrpRating);
  }
};

/**
 * Validate that combined NTRP doesn't exceed match level
 * @param {Array} selectedPlayers - Array of selected player IDs
 * @param {Array} players - Array of all players
 * @param {string|number} matchLevel - Match level (e.g., "7.0", 7.0)
 * @param {string} matchType - "singles" or "doubles"
 * @returns {boolean} True if valid, false otherwise
 */
export const validateCombinedNTRP = (selectedPlayers, players, matchLevel, matchType = MATCH_TYPES.DOUBLES) => {
  // Defensive coding: validate input parameters
  if (!selectedPlayers || !Array.isArray(selectedPlayers)) {
    console.error('validateCombinedNTRP: selectedPlayers must be an array', selectedPlayers);
    return false;
  }

  if (!players || !Array.isArray(players)) {
    console.error('validateCombinedNTRP: players must be an array', players);
    return false;
  }

  if (!matchLevel) {
    console.error('validateCombinedNTRP: matchLevel is required', matchLevel);
    return false;
  }

  const requiredCount = getRequiredPlayerCount(matchType);
  if (selectedPlayers.length !== requiredCount) return false;

  const combinedRating = calculateCombinedNTRP(selectedPlayers, players, matchType);
  return combinedRating <= parseFloat(matchLevel);
};

/**
 * Get user-friendly label for player selection
 * @param {string} matchType - "singles" or "doubles"
 * @returns {string} Label text (e.g., "Select 1 Player" or "Select 2 Players")
 */
export const getPlayerSelectionLabel = (matchType) => {
  const count = getRequiredPlayerCount(matchType);
  return `Select ${count} Player${count > 1 ? 's' : ''}`;
};

/**
 * Get user-friendly alert message for player selection limit
 * @param {string} matchType - "singles", "doubles", or "mixed_doubles"
 * @returns {string} Alert message
 */
export const getPlayerLimitAlert = (matchType) => {
  const count = getRequiredPlayerCount(matchType);
  let typeLabel = 'doubles';
  if (matchType === MATCH_TYPES.SINGLES) typeLabel = 'singles';
  else if (matchType === MATCH_TYPES.MIXED_DOUBLES) typeLabel = 'mixed doubles';
  return `⚠️ You can only select ${count} player${count > 1 ? 's' : ''} for ${typeLabel}.`;
};

/**
 * Get user-friendly validation error message
 * @param {string} matchType - "singles" or "doubles"
 * @returns {string} Error message
 */
export const getPlayerSelectionError = (matchType) => {
  const count = getRequiredPlayerCount(matchType);
  return `⚠️ Please select exactly ${count} player${count > 1 ? 's' : ''}.`;
};

/**
 * Format match type for display
 * @param {string} matchType - "singles", "doubles", or "mixed_doubles"
 * @returns {string} Formatted match type (e.g., "Singles", "Doubles", or "Mixed Doubles")
 */
export const formatMatchType = (matchType) => {
  if (matchType === MATCH_TYPES.SINGLES) return 'Singles';
  if (matchType === MATCH_TYPES.DOUBLES) return 'Doubles';
  if (matchType === MATCH_TYPES.MIXED_DOUBLES) return 'Mixed Doubles';
  return 'Doubles'; // Default for backwards compatibility
};

/**
 * Get match type from match/challenge object (with backwards compatibility)
 * @param {Object} match - Match or challenge object
 * @returns {string} "singles" or "doubles"
 */
export const getMatchType = (match) => {
  // If matchType is explicitly set, use it
  if (match && match.matchType) {
    return match.matchType;
  }
  // Default to doubles for backwards compatibility with existing matches
  return MATCH_TYPES.DOUBLES;
};

/**
 * Get display-ready match type with hybrid detection (explicit + inferred from genders)
 * This function checks both the explicit matchType field AND infers from player genders
 * for backward compatibility with historical matches.
 * @param {Object} match - Match or challenge object
 * @param {Array} players - Array of all players (needed for gender inference)
 * @param {number} teamId - Team ID to check (optional, defaults to team1)
 * @returns {string} Formatted match type for display: "Singles", "Doubles", or "Mixed Doubles"
 */
export const getDisplayMatchType = (match, players, teamId = null) => {
  if (!match) return 'Doubles';

  // First check if explicitly marked as mixed_doubles (new matches)
  const explicitMatchType = getMatchType(match);
  if (explicitMatchType === MATCH_TYPES.MIXED_DOUBLES) {
    return 'Mixed Doubles';
  }

  // If explicitly singles, return Singles
  if (explicitMatchType === MATCH_TYPES.SINGLES) {
    return 'Singles';
  }

  // For doubles or undefined matchType, check if it's actually mixed doubles
  // by inferring from player genders (backward compatibility for historical matches)

  // Determine which team's players to check
  let teamPlayers = null;
  if (teamId !== null) {
    // Check the specific team
    teamPlayers = match.team1Id === teamId ? match.team1Players : match.team2Players;
  } else {
    // Default to team1, or use challengerPlayers/challengedPlayers for challenges
    teamPlayers = match.team1Players || match.challengerPlayers || match.team2Players || match.challengedPlayers;
  }

  // If we have player data, check genders
  if (teamPlayers && teamPlayers.length > 0 && players && players.length > 0) {
    const playerGenders = teamPlayers.map(playerId => {
      const player = players.find(p => p.id === playerId);
      return player ? player.gender : null;
    }).filter(g => g !== null);

    const hasMale = playerGenders.includes('M');
    const hasFemale = playerGenders.includes('F');

    // If team has both male and female players, it's mixed doubles
    if (hasMale && hasFemale) {
      return 'Mixed Doubles';
    }
  }

  // Default to formatted match type (Singles or Doubles)
  return formatMatchType(explicitMatchType);
};

/**
 * Get effective match type with hybrid detection for filtering purposes
 * Returns the actual match type constant ('singles', 'doubles', or 'mixed_doubles')
 * This is used for filtering matches by type, ensuring Mixed Doubles matches are
 * correctly identified whether explicitly tagged or inferred from player genders.
 * @param {Object} match - Match or challenge object
 * @param {Array} players - Array of all players (needed for gender inference)
 * @param {number} teamId - Team ID to check (optional, defaults to team1)
 * @returns {string} Match type constant: MATCH_TYPES.SINGLES, MATCH_TYPES.DOUBLES, or MATCH_TYPES.MIXED_DOUBLES
 */
export const getEffectiveMatchType = (match, players, teamId = null) => {
  if (!match) return MATCH_TYPES.DOUBLES;

  // First check if explicitly marked as mixed_doubles (new matches)
  const explicitMatchType = getMatchType(match);
  if (explicitMatchType === MATCH_TYPES.MIXED_DOUBLES) {
    return MATCH_TYPES.MIXED_DOUBLES;
  }

  // If explicitly singles, return singles
  if (explicitMatchType === MATCH_TYPES.SINGLES) {
    return MATCH_TYPES.SINGLES;
  }

  // For doubles or undefined matchType, check if it's actually mixed doubles
  // by inferring from player genders (backward compatibility for historical matches)

  // Determine which team's players to check
  let teamPlayers = null;
  if (teamId !== null) {
    // Check the specific team
    teamPlayers = match.team1Id === teamId ? match.team1Players : match.team2Players;
  } else {
    // Default to team1, or use challengerPlayers/challengedPlayers for challenges
    teamPlayers = match.team1Players || match.challengerPlayers || match.team2Players || match.challengedPlayers;
  }

  // If we have player data, check genders
  if (teamPlayers && teamPlayers.length > 0 && players && players.length > 0) {
    const playerGenders = teamPlayers.map(playerId => {
      const player = players.find(p => p.id === playerId);
      return player ? player.gender : null;
    }).filter(g => g !== null);

    const hasMale = playerGenders.includes('M');
    const hasFemale = playerGenders.includes('F');

    // If team has both male and female players, it's mixed doubles
    if (hasMale && hasFemale) {
      return MATCH_TYPES.MIXED_DOUBLES;
    }
  }

  // Default to doubles (not mixed)
  return MATCH_TYPES.DOUBLES;
};

/**
 * Get level options based on match type
 * @param {string} matchType - "singles", "doubles", or "mixed_doubles"
 * @returns {Array<string>} Array of level options
 */
export const getLevelOptions = (matchType) => {
  if (matchType === MATCH_TYPES.SINGLES) {
    // Singles levels based on individual NTRP ratings
    return ['2.5', '3.0', '3.5', '4.0', '4.5', '5.0', '5.5', '6.0'];
  } else {
    // Doubles and Mixed Doubles levels based on combined NTRP ratings (2 players per team)
    return ['6.0', '6.5', '7.0', '7.5', '8.0', '8.5', '9.0', '9.5', '10.0'];
  }
};

/**
 * Get default level for match type
 * @param {string} matchType - "singles", "doubles", or "mixed_doubles"
 * @returns {string} Default level value
 */
export const getDefaultLevel = (matchType) => {
  if (matchType === MATCH_TYPES.SINGLES) {
    return '4.0'; // Default Singles level
  } else {
    return '7.0'; // Default Doubles and Mixed Doubles level
  }
};

/**
 * Determine appropriate level based on selected players and match type
 * @param {Array} playerIds - Array of selected player IDs
 * @param {Array} players - Array of all players
 * @param {string} matchType - "singles", "doubles", or "mixed_doubles"
 * @returns {string|null} Suggested level or null if can't determine
 */
export const suggestLevel = (playerIds, players, matchType) => {
  if (!playerIds || playerIds.length === 0) return null;

  const requiredCount = getRequiredPlayerCount(matchType);
  if (playerIds.length !== requiredCount) return null;

  if (matchType === MATCH_TYPES.SINGLES) {
    // For singles, use the player's individual rating
    const player = players.find(p => p.id === playerIds[0]);
    if (!player) return null;
    const rating = parseFloat(player.ntrpRating);

    // Round to nearest 0.5
    return (Math.round(rating * 2) / 2).toFixed(1);
  } else {
    // For doubles and mixed doubles, use combined rating
    const combinedRating = calculateCombinedNTRP(playerIds, players, matchType);

    // Round to nearest 0.5
    return (Math.round(combinedRating * 2) / 2).toFixed(1);
  }
};

/**
 * Validate that level is appropriate for selected players
 * @param {string} level - Selected level
 * @param {Array} playerIds - Array of selected player IDs
 * @param {Array} players - Array of all players
 * @param {string} matchType - "singles", "doubles", or "mixed_doubles"
 * @returns {boolean} True if valid
 */
export const validateLevel = (level, playerIds, players, matchType) => {
  if (!level || !playerIds || playerIds.length === 0) return true; // Allow empty

  const requiredCount = getRequiredPlayerCount(matchType);
  if (playerIds.length !== requiredCount) return true; // Let player validation handle this

  const levelNum = parseFloat(level);

  if (matchType === MATCH_TYPES.SINGLES) {
    // For singles, level should be close to player's rating
    const player = players.find(p => p.id === playerIds[0]);
    if (!player) return true;

    const rating = parseFloat(player.ntrpRating);
    // Allow level to be within 1.0 of player's rating
    return Math.abs(levelNum - rating) <= 1.0;
  } else {
    // For doubles and mixed doubles, level should accommodate combined rating
    const combinedRating = calculateCombinedNTRP(playerIds, players, matchType);
    // Level should be >= combined rating
    return levelNum >= combinedRating;
  }
};
