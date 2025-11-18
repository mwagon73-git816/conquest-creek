/**
 * ID Generator Utility for Challenges and Matches
 * Generates readable IDs in format: CHALL-YYYY-### or MATCH-YYYY-###
 */

/**
 * Generate a unique Challenge ID
 * @param {Array} existingChallenges - Array of existing challenges to ensure uniqueness
 * @returns {string} - Format: CHALL-YYYY-### (e.g., CHALL-2025-001)
 */
export const generateChallengeId = (existingChallenges = []) => {
  const year = new Date().getFullYear();
  const prefix = `CHALL-${year}-`;

  // Find the highest number for this year
  const existingIds = existingChallenges
    .filter(c => c.challengeId && c.challengeId.startsWith(prefix))
    .map(c => {
      const match = c.challengeId.match(/CHALL-\d{4}-(\d+)/);
      return match ? parseInt(match[1], 10) : 0;
    });

  const maxNumber = existingIds.length > 0 ? Math.max(...existingIds) : 0;
  const nextNumber = maxNumber + 1;

  // Pad with zeros to make it 3 digits
  const paddedNumber = String(nextNumber).padStart(3, '0');

  return `${prefix}${paddedNumber}`;
};

/**
 * Generate a unique Match ID
 * @param {Array} existingMatches - Array of existing matches to ensure uniqueness
 * @returns {string} - Format: MATCH-YYYY-### (e.g., MATCH-2025-001)
 */
export const generateMatchId = (existingMatches = []) => {
  const year = new Date().getFullYear();
  const prefix = `MATCH-${year}-`;

  // Find the highest number for this year
  const existingIds = existingMatches
    .filter(m => m.matchId && m.matchId.startsWith(prefix))
    .map(m => {
      const match = m.matchId.match(/MATCH-\d{4}-(\d+)/);
      return match ? parseInt(match[1], 10) : 0;
    });

  const maxNumber = existingIds.length > 0 ? Math.max(...existingIds) : 0;
  const nextNumber = maxNumber + 1;

  // Pad with zeros to make it 3 digits
  const paddedNumber = String(nextNumber).padStart(3, '0');

  return `${prefix}${paddedNumber}`;
};

/**
 * Generate a legacy Challenge ID for backwards compatibility
 * @param {number} timestamp - Original timestamp ID
 * @param {number} index - Index in the array (for ordering)
 * @returns {string} - Format: CHALL-LEGACY-###
 */
export const generateLegacyChallengeId = (timestamp, index) => {
  const paddedIndex = String(index + 1).padStart(3, '0');
  return `CHALL-LEGACY-${paddedIndex}`;
};

/**
 * Generate a legacy Match ID for backwards compatibility
 * @param {string} originalId - Original match ID
 * @param {number} index - Index in the array (for ordering)
 * @returns {string} - Format: MATCH-LEGACY-###
 */
export const generateLegacyMatchId = (originalId, index) => {
  const paddedIndex = String(index + 1).padStart(3, '0');
  return `MATCH-LEGACY-${paddedIndex}`;
};

/**
 * Check if an ID is a legacy ID
 * @param {string} id - The ID to check
 * @returns {boolean}
 */
export const isLegacyId = (id) => {
  return id && id.includes('LEGACY');
};

/**
 * Extract year from a Challenge or Match ID
 * @param {string} id - The ID to parse
 * @returns {number|null} - The year, or null if not found
 */
export const getYearFromId = (id) => {
  if (!id) return null;
  const match = id.match(/(CHALL|MATCH)-(\d{4})-/);
  return match ? parseInt(match[2], 10) : null;
};

/**
 * Extract sequence number from a Challenge or Match ID
 * @param {string} id - The ID to parse
 * @returns {number|null} - The sequence number, or null if not found
 */
export const getSequenceFromId = (id) => {
  if (!id) return null;
  const match = id.match(/(CHALL|MATCH)-(?:LEGACY-|\d{4}-)(\d+)/);
  return match ? parseInt(match[2], 10) : null;
};
