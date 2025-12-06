import {
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  deleteDoc,
  updateDoc,
  onSnapshot,
  query,
  where,
  orderBy
} from 'firebase/firestore';
import { db } from '../firebase';

const COLLECTION = 'matches';

/**
 * MATCH SERVICE
 *
 * Provides CRUD operations and real-time subscriptions for matches.
 * Handles both pending matches (from accepted challenges) and completed matches.
 *
 * Architecture:
 * - matches/{matchId} -> Individual match document
 * - Real-time subscriptions for auto-updates
 * - Pending matches created when challenges are accepted
 * - Completed matches store full results
 */

// ========================================
// ID GENERATION
// ========================================

/**
 * Generate unique match ID
 * Format: MATCH-{timestamp}-{random}
 *
 * @returns {string} Unique match ID
 */
export const generateMatchId = () => {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `MATCH-${timestamp}-${random}`;
};

// ========================================
// CREATE - Add new match
// ========================================

/**
 * Create a new match (pending or completed)
 *
 * @param {object} matchData - Match data
 * @param {string} createdBy - Name of user creating match
 * @returns {Promise<object>} Created match object
 */
export const createMatch = async (matchData, createdBy = 'Unknown') => {
  try {
    const matchId = matchData.matchId || generateMatchId();
    const docRef = doc(db, COLLECTION, matchId);

    const match = {
      ...matchData,
      matchId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy
    };

    await setDoc(docRef, match);
    console.log('✅ Match created:', matchId);
    return { success: true, match };

  } catch (error) {
    console.error('❌ Error creating match:', error);
    return {
      success: false,
      error: error.message,
      message: `Failed to create match: ${error.message}`
    };
  }
};

/**
 * Create pending match from accepted challenge
 *
 * @param {object} challenge - Challenge object with acceptance data
 * @returns {Promise<object>} Created pending match
 */
export const createPendingMatchFromChallenge = async (challenge) => {
  try {
    const matchId = challenge.matchId || generateMatchId();

    const pendingMatch = {
      matchId,
      challengeId: challenge.challengeId,
      status: 'pending',

      // Teams
      team1Id: challenge.challengerTeamId,
      team2Id: challenge.challengedTeamId || challenge.acceptingTeamId,

      // Players with NTRP ratings
      team1Players: challenge.challengerPlayers || [],
      team2Players: challenge.challengedPlayers || challenge.acceptingPlayers || [],

      // Combined NTRP for validation
      team1CombinedNTRP: challenge.challengerCombinedNTRP || challenge.combinedNTRP,
      team2CombinedNTRP: challenge.challengedCombinedNTRP,

      // Match details
      matchType: challenge.matchType || 'doubles',
      level: challenge.acceptedLevel || challenge.proposedLevel,
      scheduledDate: challenge.acceptedDate || challenge.proposedDate,

      // Metadata
      notes: challenge.notes || '',
      acceptNotes: challenge.acceptNotes || '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdFromChallenge: true,
      fromChallenge: true  // For backward compatibility
    };

    const docRef = doc(db, COLLECTION, matchId);
    await setDoc(docRef, pendingMatch);
    console.log('✅ Pending match created from challenge:', matchId);

    return { success: true, match: pendingMatch };

  } catch (error) {
    console.error('❌ Error creating pending match:', error);
    return {
      success: false,
      error: error.message,
      message: `Failed to create pending match: ${error.message}`
    };
  }
};

// ========================================
// READ - Get matches
// ========================================

/**
 * Get a single match by ID
 *
 * @param {string} matchId - Match ID
 * @returns {Promise<object|null>} Match object or null if not found
 */
export const getMatch = async (matchId) => {
  try {
    const docRef = doc(db, COLLECTION, matchId);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      return { id: docSnap.id, ...docSnap.data() };
    }

    console.warn(`⚠️ Match ${matchId} not found`);
    return null;

  } catch (error) {
    console.error(`❌ Error getting match ${matchId}:`, error);
    throw error;
  }
};

/**
 * Get all matches
 *
 * @returns {Promise<Array>} Array of match objects
 */
export const getAllMatches = async () => {
  try {
    const querySnapshot = await getDocs(collection(db, COLLECTION));
    const matches = [];

    querySnapshot.forEach((doc) => {
      // Skip the old 'data' document if it still exists
      if (doc.id !== 'data' && doc.id !== 'data_backup_blob') {
        matches.push({ id: doc.id, ...doc.data() });
      }
    });

    // Sort by date (newest first)
    matches.sort((a, b) => {
      const dateA = new Date(a.createdAt || 0);
      const dateB = new Date(b.createdAt || 0);
      return dateB - dateA;
    });

    console.log(`📋 Loaded ${matches.length} matches`);
    return matches;

  } catch (error) {
    console.error('❌ Error getting matches:', error);
    throw error;
  }
};

/**
 * Get matches by status
 *
 * @param {string} status - Match status ('pending', 'completed')
 * @returns {Promise<Array>} Array of match objects
 */
export const getMatchesByStatus = async (status) => {
  try {
    const q = query(
      collection(db, COLLECTION),
      where('status', '==', status),
      orderBy('createdAt', 'desc')
    );

    const querySnapshot = await getDocs(q);
    const matches = [];

    querySnapshot.forEach((doc) => {
      if (doc.id !== 'data' && doc.id !== 'data_backup_blob') {
        matches.push({ id: doc.id, ...doc.data() });
      }
    });

    console.log(`📋 Loaded ${matches.length} ${status} matches`);
    return matches;

  } catch (error) {
    console.error(`❌ Error getting ${status} matches:`, error);
    throw error;
  }
};

/**
 * Get matches by team
 *
 * @param {number} teamId - Team ID
 * @returns {Promise<Array>} Array of match objects
 */
export const getMatchesByTeam = async (teamId) => {
  try {
    // Firestore doesn't support OR queries easily, so filter client-side
    const allMatches = await getAllMatches();
    return allMatches.filter(m => m.team1Id === teamId || m.team2Id === teamId);

  } catch (error) {
    console.error(`❌ Error getting matches for team ${teamId}:`, error);
    throw error;
  }
};

// ========================================
// UPDATE - Update match
// ========================================

/**
 * Update a match
 *
 * @param {string} matchId - Match ID
 * @param {object} updates - Fields to update
 * @param {string} updatedBy - Name of user updating
 * @returns {Promise<object>} Result object
 */
export const updateMatch = async (matchId, updates, updatedBy = 'Unknown') => {
  try {
    const docRef = doc(db, COLLECTION, matchId);

    // Check if match exists
    const docSnap = await getDoc(docRef);
    if (!docSnap.exists()) {
      throw new Error(`Match ${matchId} not found`);
    }

    // Remove undefined values - Firestore doesn't accept them
    const cleanUpdates = Object.fromEntries(
      Object.entries(updates).filter(([_, value]) => value !== undefined)
    );

    // Prepare update data
    const updateData = {
      ...cleanUpdates,
      updatedAt: new Date().toISOString(),
      updatedBy
    };

    // Update the document
    await updateDoc(docRef, updateData);

    console.log('✅ Match updated:', matchId);
    return {
      success: true,
      matchId,
      message: 'Match updated successfully'
    };

  } catch (error) {
    console.error(`❌ Error updating match ${matchId}:`, error);
    return {
      success: false,
      matchId,
      error: error.message,
      message: `Failed to update match: ${error.message}`
    };
  }
};

/**
 * Complete a pending match with results
 *
 * @param {string} matchId - Match ID
 * @param {object} results - Match results
 * @param {string} results.winner - Winning team ('team1' or 'team2')
 * @param {number} results.team1Sets - Sets won by team 1
 * @param {number} results.team2Sets - Sets won by team 2
 * @param {number} results.team1Games - Games won by team 1
 * @param {number} results.team2Games - Games won by team 2
 * @param {object} results.scores - Detailed scores by set
 * @param {string} results.completedBy - Name of user completing
 * @returns {Promise<object>} Result object
 */
export const completeMatch = async (matchId, results) => {
  try {
    const updateData = {
      status: 'completed',
      winner: results.winner,
      team1Sets: results.team1Sets,
      team2Sets: results.team2Sets,
      team1Games: results.team1Games,
      team2Games: results.team2Games,
      scores: results.scores || {},
      completedAt: new Date().toISOString(),
      completedBy: results.completedBy,
      updatedAt: new Date().toISOString(),
      updatedBy: results.completedBy
    };

    await updateMatch(matchId, updateData, results.completedBy);
    console.log('✅ Match completed:', matchId);

    return {
      success: true,
      matchId,
      ...updateData
    };

  } catch (error) {
    console.error(`❌ Error completing match ${matchId}:`, error);
    return {
      success: false,
      matchId,
      error: error.message,
      message: `Failed to complete match: ${error.message}`
    };
  }
};

// ========================================
// DELETE - Delete match
// ========================================

/**
 * Delete a match
 *
 * @param {string} matchId - Match ID
 * @returns {Promise<object>} Result object
 */
export const deleteMatch = async (matchId) => {
  try {
    const docRef = doc(db, COLLECTION, matchId);

    // Check if match exists
    const docSnap = await getDoc(docRef);
    if (!docSnap.exists()) {
      throw new Error(`Match ${matchId} not found`);
    }

    // Delete the document
    await deleteDoc(docRef);

    console.log('✅ Match deleted:', matchId);
    return {
      success: true,
      matchId,
      message: 'Match deleted successfully'
    };

  } catch (error) {
    console.error(`❌ Error deleting match ${matchId}:`, error);
    return {
      success: false,
      matchId,
      error: error.message,
      message: `Failed to delete match: ${error.message}`
    };
  }
};

// ========================================
// REAL-TIME SUBSCRIPTIONS
// ========================================

/**
 * Subscribe to all matches (real-time updates)
 *
 * @param {function} callback - Callback function(matches)
 * @param {function} [errorCallback] - Error callback function(error)
 * @returns {function} Unsubscribe function
 */
export const subscribeToMatches = (callback, errorCallback) => {
  const q = query(collection(db, COLLECTION), orderBy('createdAt', 'desc'));

  return onSnapshot(
    q,
    (querySnapshot) => {
      const matches = [];
      querySnapshot.forEach((doc) => {
        // Skip old blob documents
        if (doc.id !== 'data' && doc.id !== 'data_backup_blob') {
          matches.push({ id: doc.id, ...doc.data() });
        }
      });

      console.log(`🔄 Real-time update: ${matches.length} matches`);
      callback(matches);
    },
    (error) => {
      console.error('❌ Matches subscription error:', error);
      if (errorCallback) errorCallback(error);
    }
  );
};

/**
 * Subscribe to pending matches only (real-time updates)
 *
 * @param {function} callback - Callback function(matches)
 * @param {function} [errorCallback] - Error callback function(error)
 * @returns {function} Unsubscribe function
 */
export const subscribeToPendingMatches = (callback, errorCallback) => {
  const q = query(
    collection(db, COLLECTION),
    where('status', '==', 'pending'),
    orderBy('createdAt', 'desc')
  );

  return onSnapshot(
    q,
    (querySnapshot) => {
      const matches = [];
      querySnapshot.forEach((doc) => {
        if (doc.id !== 'data' && doc.id !== 'data_backup_blob') {
          matches.push({ id: doc.id, ...doc.data() });
        }
      });

      console.log(`🔄 Real-time update: ${matches.length} pending matches`);
      callback(matches);
    },
    (error) => {
      console.error('❌ Pending matches subscription error:', error);
      if (errorCallback) errorCallback(error);
    }
  );
};

/**
 * Subscribe to completed matches only (real-time updates)
 *
 * @param {function} callback - Callback function(matches)
 * @param {function} [errorCallback] - Error callback function(error)
 * @returns {function} Unsubscribe function
 */
export const subscribeToCompletedMatches = (callback, errorCallback) => {
  const q = query(
    collection(db, COLLECTION),
    where('status', '==', 'completed'),
    orderBy('createdAt', 'desc')
  );

  return onSnapshot(
    q,
    (querySnapshot) => {
      const matches = [];
      querySnapshot.forEach((doc) => {
        if (doc.id !== 'data' && doc.id !== 'data_backup_blob') {
          matches.push({ id: doc.id, ...doc.data() });
        }
      });

      console.log(`🔄 Real-time update: ${matches.length} completed matches`);
      callback(matches);
    },
    (error) => {
      console.error('❌ Completed matches subscription error:', error);
      if (errorCallback) errorCallback(error);
    }
  );
};

/**
 * Subscribe to matches by team (real-time updates)
 *
 * @param {number} teamId - Team ID
 * @param {function} callback - Callback function(matches)
 * @param {function} [errorCallback] - Error callback function(error)
 * @returns {function} Unsubscribe function
 */
export const subscribeToMatchesByTeam = (teamId, callback, errorCallback) => {
  // Subscribe to all matches and filter client-side
  return subscribeToMatches(
    (matches) => {
      const teamMatches = matches.filter(m =>
        m.team1Id === teamId || m.team2Id === teamId
      );
      console.log(`🔄 Real-time update: ${teamMatches.length} matches for team ${teamId}`);
      callback(teamMatches);
    },
    errorCallback
  );
};
