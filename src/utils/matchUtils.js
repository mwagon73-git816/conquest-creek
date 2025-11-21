/**
 * Match Type Utilities
 * Helper functions for Singles and Doubles match support
 */

// Match type constants
export const MATCH_TYPES = {
  SINGLES: 'singles',
  DOUBLES: 'doubles'
};

/**
 * Get the required number of players for a match type
 * @param {string} matchType - "singles" or "doubles"
 * @returns {number} Number of players required per team (1 for singles, 2 for doubles)
 */
export const getRequiredPlayerCount = (matchType) => {
  return matchType === MATCH_TYPES.SINGLES ? 1 : 2;
};

/**
 * Validate that the correct number of players is selected for the match type
 * @param {Array} selectedPlayers - Array of selected player IDs
 * @param {string} matchType - "singles" or "doubles"
 * @returns {boolean} True if valid, false otherwise
 */
export const validatePlayerSelection = (selectedPlayers, matchType = MATCH_TYPES.DOUBLES) => {
  const requiredCount = getRequiredPlayerCount(matchType);
  return selectedPlayers.length === requiredCount;
};

/**
 * Calculate combined NTRP rating for selected players
 * For singles: returns the single player's rating
 * For doubles: returns the sum of both players' ratings
 * @param {Array} selectedPlayerIds - Array of selected player IDs
 * @param {Array} players - Array of all players
 * @param {string} matchType - "singles" or "doubles"
 * @returns {number} Combined NTRP rating
 */
export const calculateCombinedNTRP = (selectedPlayerIds, players, matchType = MATCH_TYPES.DOUBLES) => {
  const requiredCount = getRequiredPlayerCount(matchType);

  if (selectedPlayerIds.length !== requiredCount) return 0;

  if (matchType === MATCH_TYPES.SINGLES) {
    const player = players.find(p => p.id === selectedPlayerIds[0]);
    return player ? parseFloat(player.ntrpRating) : 0;
  } else {
    // Doubles
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
 * @param {string} matchType - "singles" or "doubles"
 * @returns {string} Alert message
 */
export const getPlayerLimitAlert = (matchType) => {
  const count = getRequiredPlayerCount(matchType);
  const typeLabel = matchType === MATCH_TYPES.SINGLES ? 'singles' : 'doubles';
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
 * @param {string} matchType - "singles" or "doubles"
 * @returns {string} Formatted match type (e.g., "Singles" or "Doubles")
 */
export const formatMatchType = (matchType) => {
  if (matchType === MATCH_TYPES.SINGLES) return 'Singles';
  if (matchType === MATCH_TYPES.DOUBLES) return 'Doubles';
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
 * Get level options based on match type
 * @param {string} matchType - "singles" or "doubles"
 * @returns {Array<string>} Array of level options
 */
export const getLevelOptions = (matchType) => {
  if (matchType === MATCH_TYPES.SINGLES) {
    // Singles levels based on individual NTRP ratings
    return ['2.5', '3.0', '3.5', '4.0', '4.5', '5.0', '5.5', '6.0'];
  } else {
    // Doubles levels based on combined NTRP ratings (2 players per team)
    return ['6.0', '6.5', '7.0', '7.5', '8.0', '8.5', '9.0', '9.5', '10.0'];
  }
};

/**
 * Get default level for match type
 * @param {string} matchType - "singles" or "doubles"
 * @returns {string} Default level value
 */
export const getDefaultLevel = (matchType) => {
  if (matchType === MATCH_TYPES.SINGLES) {
    return '4.0'; // Default Singles level
  } else {
    return '7.0'; // Default Doubles level
  }
};

/**
 * Determine appropriate level based on selected players and match type
 * @param {Array} playerIds - Array of selected player IDs
 * @param {Array} players - Array of all players
 * @param {string} matchType - "singles" or "doubles"
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
    // For doubles, use combined rating
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
 * @param {string} matchType - "singles" or "doubles"
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
    // For doubles, level should accommodate combined rating
    const combinedRating = calculateCombinedNTRP(playerIds, players, matchType);
    // Level should be >= combined rating
    return levelNum >= combinedRating;
  }
};
