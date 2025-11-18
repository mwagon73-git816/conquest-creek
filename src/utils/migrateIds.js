/**
 * Data Migration Utility for Challenge and Match IDs
 *
 * This utility adds readable IDs to existing challenges and matches
 * that were created before the ID system was implemented.
 *
 * Usage:
 * 1. Import this file in your App.jsx or admin panel
 * 2. Call migrateChallengeIds(challenges) to add IDs to challenges
 * 3. Call migrateMatchIds(matches) to add IDs to matches
 * 4. Save the updated data back to Firebase
 *
 * Note: This is a one-time migration. Once all records have IDs,
 * this utility is no longer needed.
 */

import { generateChallengeId, generateMatchId, generateLegacyChallengeId, generateLegacyMatchId } from './idGenerator';

/**
 * Migrate Challenge IDs - adds readable IDs to challenges that don't have them
 * Also adds Match IDs to accepted challenges (pending matches)
 * @param {Array} challenges - Array of challenge objects
 * @param {Array} matches - Array of match objects (for Match ID generation)
 * @returns {Object} - { challenges: updatedArray, migratedCount: number, matchIdsMigrated: number }
 */
export const migrateChallengeIds = (challenges, matches = []) => {
  if (!challenges || !Array.isArray(challenges)) {
    return { challenges: [], migratedCount: 0, matchIdsMigrated: 0 };
  }

  let migratedCount = 0;
  let matchIdsMigrated = 0;
  const sortedByDate = [...challenges].sort((a, b) => {
    const dateA = new Date(a.createdAt || 0);
    const dateB = new Date(b.createdAt || 0);
    return dateA - dateB; // Oldest first for sequential numbering
  });

  // First pass: identify which challenges need IDs
  const needsChallengeId = sortedByDate.filter(c => !c.challengeId);
  const needsMatchId = sortedByDate.filter(c => c.status === 'accepted' && !c.matchId);

  console.log('🔄 Challenge ID Migration:', {
    totalChallenges: challenges.length,
    needsChallengeId: needsChallengeId.length,
    acceptedChallenges: sortedByDate.filter(c => c.status === 'accepted').length,
    needsMatchId: needsMatchId.length
  });

  // Generate IDs for challenges that need them
  const updatedChallenges = sortedByDate.map((challenge, index) => {
    let updated = { ...challenge };

    // Add Challenge ID if missing
    if (!challenge.challengeId) {
      // Generate a new Challenge ID based on creation date
      migratedCount++;
      const year = challenge.createdAt
        ? new Date(challenge.createdAt).getFullYear()
        : new Date().getFullYear();

      // Find existing IDs for this year to ensure uniqueness
      const existingIdsForYear = sortedByDate
        .filter(c => c.challengeId && c.challengeId.startsWith(`CHALL-${year}-`))
        .map(c => {
          const match = c.challengeId.match(/CHALL-\d{4}-(\d+)/);
          return match ? parseInt(match[1], 10) : 0;
        });

      // Get the next available number for this year
      const maxNumber = existingIdsForYear.length > 0 ? Math.max(...existingIdsForYear) : 0;
      const legacyIndex = sortedByDate
        .slice(0, index + 1)
        .filter(c => !c.challengeId || c.challengeId.startsWith(`CHALL-${year}-`))
        .length;

      const nextNumber = maxNumber + legacyIndex;
      const paddedNumber = String(nextNumber).padStart(3, '0');
      const newChallengeId = `CHALL-${year}-${paddedNumber}`;

      updated.challengeId = newChallengeId;
    }

    // Add Match ID to accepted challenges (pending matches) if missing
    if (challenge.status === 'accepted' && !challenge.matchId) {
      matchIdsMigrated++;
      const year = challenge.acceptedAt
        ? new Date(challenge.acceptedAt).getFullYear()
        : (challenge.createdAt ? new Date(challenge.createdAt).getFullYear() : new Date().getFullYear());

      // Find existing Match IDs for this year (from both matches and accepted challenges)
      const existingMatchIdsForYear = [
        ...matches.filter(m => m.matchId && m.matchId.startsWith(`MATCH-${year}-`)),
        ...sortedByDate.filter(c => c.matchId && c.matchId.startsWith(`MATCH-${year}-`))
      ].map(item => {
        const match = item.matchId.match(/MATCH-\d{4}-(\d+)/);
        return match ? parseInt(match[1], 10) : 0;
      });

      // Get the next available number for this year
      const maxNumber = existingMatchIdsForYear.length > 0 ? Math.max(...existingMatchIdsForYear) : 0;
      const legacyIndex = sortedByDate
        .slice(0, index + 1)
        .filter(c => c.status === 'accepted' && (!c.matchId || c.matchId.startsWith(`MATCH-${year}-`)))
        .length;

      const nextNumber = maxNumber + legacyIndex;
      const paddedNumber = String(nextNumber).padStart(3, '0');
      const newMatchId = `MATCH-${year}-${paddedNumber}`;

      updated.matchId = newMatchId;
      console.log(`  ✅ Added Match ID to accepted challenge: ${updated.challengeId} → ${newMatchId}`);
    }

    return updated;
  });

  return {
    challenges: updatedChallenges,
    migratedCount,
    matchIdsMigrated
  };
};

/**
 * Migrate Match IDs - adds readable IDs to matches that don't have them
 * @param {Array} matches - Array of match objects
 * @param {Array} challenges - Array of challenge objects (to link originChallengeId)
 * @returns {Object} - { matches: updatedArray, migratedCount: number }
 */
export const migrateMatchIds = (matches, challenges = []) => {
  if (!matches || !Array.isArray(matches)) {
    return { matches: [], migratedCount: 0 };
  }

  let migratedCount = 0;
  const sortedByDate = [...matches].sort((a, b) => {
    const dateA = new Date(a.date || a.timestamp || 0);
    const dateB = new Date(b.date || b.timestamp || 0);
    return dateA - dateB; // Oldest first for sequential numbering
  });

  // First pass: identify which matches need IDs
  const needsMigration = sortedByDate.filter(m => !m.matchId);

  // Create a map to link matches to their origin challenges (if any)
  const challengeMap = {};
  challenges.forEach(challenge => {
    if (challenge.challengeId && challenge.status === 'completed') {
      // Try to find a match that came from this challenge
      // You may need to add more sophisticated matching logic based on your data structure
      challengeMap[challenge.id] = challenge.challengeId;
    }
  });

  // Generate IDs for matches that need them
  const updatedMatches = sortedByDate.map((match, index) => {
    if (match.matchId) {
      // Already has an ID, keep it
      return match;
    }

    // Generate a new ID based on match date
    migratedCount++;
    const year = match.date
      ? new Date(match.date).getFullYear()
      : (match.timestamp ? new Date(match.timestamp).getFullYear() : new Date().getFullYear());

    // Find existing IDs for this year to ensure uniqueness
    const existingIdsForYear = sortedByDate
      .filter(m => m.matchId && m.matchId.startsWith(`MATCH-${year}-`))
      .map(m => {
        const matchPattern = m.matchId.match(/MATCH-\d{4}-(\d+)/);
        return matchPattern ? parseInt(matchPattern[1], 10) : 0;
      });

    // Get the next available number for this year
    const maxNumber = existingIdsForYear.length > 0 ? Math.max(...existingIdsForYear) : 0;
    const legacyIndex = sortedByDate
      .slice(0, index + 1)
      .filter(m => !m.matchId || m.matchId.startsWith(`MATCH-${year}-`))
      .length;

    const nextNumber = maxNumber + legacyIndex;
    const paddedNumber = String(nextNumber).padStart(3, '0');
    const newMatchId = `MATCH-${year}-${paddedNumber}`;

    // Try to find origin challenge ID if this match came from a challenge
    const originChallengeId = match.fromChallenge && challengeMap[match.id]
      ? challengeMap[match.id]
      : (match.originChallengeId || null);

    return {
      ...match,
      matchId: newMatchId,
      originChallengeId
    };
  });

  return {
    matches: updatedMatches,
    migratedCount
  };
};

/**
 * Run full migration on all data
 * @param {Object} data - { challenges: [], matches: [] }
 * @returns {Object} - { challenges: [], matches: [], challengesMigrated: number, matchesMigrated: number, pendingMatchesMigrated: number }
 */
export const migrateAllIds = (data) => {
  const { challenges = [], matches = [] } = data;

  console.log('🔄 Starting full ID migration...');

  // Migrate challenges first (including adding Match IDs to accepted challenges/pending matches)
  const {
    challenges: migratedChallenges,
    migratedCount: challengesMigrated,
    matchIdsMigrated: pendingMatchesMigrated
  } = migrateChallengeIds(challenges, matches);

  console.log('  ✅ Challenge migration complete:', {
    challengeIdsMigrated: challengesMigrated,
    pendingMatchIdsMigrated: pendingMatchesMigrated
  });

  // Then migrate completed matches (using updated challenges for origin tracking)
  const { matches: migratedMatches, migratedCount: matchesMigrated } = migrateMatchIds(matches, migratedChallenges);

  console.log('  ✅ Match migration complete:', {
    matchIdsMigrated: matchesMigrated
  });

  const totalMigrated = challengesMigrated + pendingMatchesMigrated + matchesMigrated;

  console.log('✅ Full migration complete:', {
    challengeIdsMigrated: challengesMigrated,
    pendingMatchIdsMigrated: pendingMatchesMigrated,
    completedMatchIdsMigrated: matchesMigrated,
    totalMigrated
  });

  return {
    challenges: migratedChallenges,
    matches: migratedMatches,
    challengesMigrated,
    pendingMatchesMigrated,
    matchesMigrated,
    totalMigrated
  };
};

/**
 * Check if migration is needed
 * @param {Object} data - { challenges: [], matches: [] }
 * @returns {Object} - { needsMigration: boolean, stats: { totalChallenges, challengesWithoutIds, pendingMatchesWithoutIds, totalMatches, matchesWithoutIds } }
 */
export const checkMigrationNeeded = (data) => {
  const { challenges = [], matches = [] } = data;

  const challengesWithoutIds = challenges.filter(c => !c.challengeId).length;
  const pendingMatches = challenges.filter(c => c.status === 'accepted');
  const pendingMatchesWithoutIds = pendingMatches.filter(c => !c.matchId).length;
  const matchesWithoutIds = matches.filter(m => !m.matchId).length;

  return {
    needsMigration: challengesWithoutIds > 0 || pendingMatchesWithoutIds > 0 || matchesWithoutIds > 0,
    stats: {
      totalChallenges: challenges.length,
      challengesWithoutIds,
      totalPendingMatches: pendingMatches.length,
      pendingMatchesWithoutIds,
      totalMatches: matches.length,
      matchesWithoutIds
    }
  };
};
