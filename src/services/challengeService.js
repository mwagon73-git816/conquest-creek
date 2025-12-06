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
  orderBy,
  serverTimestamp,
  runTransaction
} from 'firebase/firestore';
import { db } from '../firebase';
import { createPendingMatchFromChallenge } from './matchService';

const COLLECTION = 'challenges';

/**
 * CHALLENGE SERVICE
 *
 * Provides CRUD operations and real-time subscriptions for challenges.
 * Each challenge is stored as an individual document, eliminating race conditions
 * and data loss issues from the old blob storage architecture.
 *
 * Architecture:
 * - challenges/{challengeId} -> Individual challenge document
 * - Real-time subscriptions for auto-updates
 * - Atomic operations for challenge acceptance
 * - No more "Save Data" button required!
 */

// ========================================
// ID GENERATION
// ========================================

/**
 * Generate unique challenge ID
 * Format: CHAL-{timestamp}-{random}
 *
 * @returns {string} Unique challenge ID
 */
export const generateChallengeId = () => {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `CHAL-${timestamp}-${random}`;
};

// ========================================
// CREATE - Add new challenge
// ========================================

/**
 * Create a new challenge
 *
 * @param {object} challengeData - Challenge data
 * @param {number} challengeData.challengerTeamId - Team ID creating the challenge
 * @param {Array<number>} challengeData.challengerPlayers - Player IDs
 * @param {string} challengeData.matchType - 'singles', 'doubles', or 'mixed_doubles'
 * @param {string} challengeData.proposedLevel - Match level (e.g., '7.0')
 * @param {string} [challengeData.proposedDate] - Optional proposed date
 * @param {string} [challengeData.notes] - Optional notes
 * @param {string} createdBy - Name of user creating challenge
 * @returns {Promise<object>} Created challenge object
 */
export const createChallenge = async (challengeData, createdBy = 'Unknown') => {
  try {
    // Generate unique challenge ID
    const challengeId = generateChallengeId();
    const docRef = doc(db, COLLECTION, challengeId);

    // Prepare challenge document
    const challenge = {
      ...challengeData,
      id: Date.now(), // Numeric ID for backward compatibility
      challengeId, // String ID for Firestore document
      status: 'open',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy
    };

    // Save to Firestore
    await setDoc(docRef, challenge);

    console.log('✅ Challenge created:', challengeId);
    return { success: true, challenge };

  } catch (error) {
    console.error('❌ Error creating challenge:', error);
    return {
      success: false,
      error: error.message,
      message: `Failed to create challenge: ${error.message}`
    };
  }
};

// ========================================
// READ - Get challenges
// ========================================

/**
 * Get a single challenge by ID
 *
 * @param {string} challengeId - Challenge ID
 * @returns {Promise<object|null>} Challenge object or null if not found
 */
export const getChallenge = async (challengeId) => {
  try {
    const docRef = doc(db, COLLECTION, challengeId);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      return { id: docSnap.id, ...docSnap.data() };
    }

    console.warn(`⚠️ Challenge ${challengeId} not found`);
    return null;

  } catch (error) {
    console.error(`❌ Error getting challenge ${challengeId}:`, error);
    throw error;
  }
};

/**
 * Get all challenges
 *
 * @returns {Promise<Array>} Array of challenge objects
 */
export const getAllChallenges = async () => {
  try {
    const querySnapshot = await getDocs(collection(db, COLLECTION));
    const challenges = [];

    querySnapshot.forEach((doc) => {
      // Skip the old 'data' document if it still exists
      if (doc.id !== 'data' && doc.id !== 'data_backup_blob') {
        challenges.push({ id: doc.id, ...doc.data() });
      }
    });

    // Sort by creation date (newest first)
    challenges.sort((a, b) => {
      const dateA = new Date(a.createdAt || 0);
      const dateB = new Date(b.createdAt || 0);
      return dateB - dateA;
    });

    console.log(`📋 Loaded ${challenges.length} challenges`);
    return challenges;

  } catch (error) {
    console.error('❌ Error getting challenges:', error);
    throw error;
  }
};

/**
 * Get challenges by status
 *
 * @param {string} status - Challenge status ('open', 'accepted', 'completed')
 * @returns {Promise<Array>} Array of challenge objects
 */
export const getChallengesByStatus = async (status) => {
  try {
    const q = query(
      collection(db, COLLECTION),
      where('status', '==', status),
      orderBy('createdAt', 'desc')
    );

    const querySnapshot = await getDocs(q);
    const challenges = [];

    querySnapshot.forEach((doc) => {
      if (doc.id !== 'data' && doc.id !== 'data_backup_blob') {
        challenges.push({ id: doc.id, ...doc.data() });
      }
    });

    console.log(`📋 Loaded ${challenges.length} ${status} challenges`);
    return challenges;

  } catch (error) {
    console.error(`❌ Error getting ${status} challenges:`, error);
    throw error;
  }
};

/**
 * Get challenges by team
 *
 * @param {number} teamId - Team ID
 * @returns {Promise<Array>} Array of challenge objects
 */
export const getChallengesByTeam = async (teamId) => {
  try {
    // Note: This requires getting all challenges and filtering client-side
    // because we need to check both challengerTeamId and challengedTeamId
    const allChallenges = await getAllChallenges();

    const teamChallenges = allChallenges.filter(c =>
      c.challengerTeamId === teamId ||
      c.challengedTeamId === teamId ||
      c.acceptingTeamId === teamId
    );

    console.log(`📋 Loaded ${teamChallenges.length} challenges for team ${teamId}`);
    return teamChallenges;

  } catch (error) {
    console.error(`❌ Error getting challenges for team ${teamId}:`, error);
    throw error;
  }
};

// ========================================
// UPDATE - Update challenge
// ========================================

/**
 * Update a challenge
 *
 * @param {string} challengeId - Challenge ID
 * @param {object} updates - Fields to update
 * @param {string} updatedBy - Name of user updating
 * @returns {Promise<object>} Result object
 */
export const updateChallenge = async (challengeId, updates, updatedBy = 'Unknown') => {
  try {
    const docRef = doc(db, COLLECTION, challengeId);

    // Check if challenge exists
    const docSnap = await getDoc(docRef);
    if (!docSnap.exists()) {
      throw new Error(`Challenge ${challengeId} not found`);
    }

    // Prepare update data
    const updateData = {
      ...updates,
      updatedAt: new Date().toISOString(),
      updatedBy
    };

    // Update the document
    await updateDoc(docRef, updateData);

    console.log('✅ Challenge updated:', challengeId);
    return {
      success: true,
      challengeId,
      message: 'Challenge updated successfully'
    };

  } catch (error) {
    console.error(`❌ Error updating challenge ${challengeId}:`, error);
    return {
      success: false,
      challengeId,
      error: error.message,
      message: `Failed to update challenge: ${error.message}`
    };
  }
};

/**
 * Accept a challenge using transaction (prevents race conditions)
 *
 * @param {string} challengeId - Challenge ID
 * @param {object} acceptanceData - Acceptance data
 * @param {number} acceptanceData.challengedTeamId - Team ID accepting
 * @param {Array<number>} acceptanceData.challengedPlayers - Player IDs
 * @param {string} acceptanceData.acceptedDate - Match date
 * @param {string} acceptanceData.acceptedLevel - Match level
 * @param {number} acceptanceData.challengedCombinedNTRP - Combined NTRP
 * @param {string} acceptanceData.acceptedBy - Name of captain accepting
 * @param {string} [acceptanceData.notes] - Optional notes
 * @param {string} [acceptanceData.matchId] - Optional match ID
 * @returns {Promise<object>} Result object
 */
export const acceptChallenge = async (challengeId, acceptanceData) => {
  try {
    const result = await runTransaction(db, async (transaction) => {
      const challengeRef = doc(db, COLLECTION, challengeId);
      const challengeDoc = await transaction.get(challengeRef);

      if (!challengeDoc.exists()) {
        throw new Error('Challenge not found');
      }

      const challenge = challengeDoc.data();

      // Check if challenge is still open
      if (challenge.status === 'accepted') {
        const acceptedBy = challenge.acceptedBy || 'another team';
        throw new Error(`This challenge has already been accepted by ${acceptedBy}`);
      }

      if (challenge.status === 'completed') {
        throw new Error('This challenge has already been completed');
      }

      if (challenge.status !== 'open') {
        throw new Error(`Cannot accept challenge with status: ${challenge.status}`);
      }

      // Update challenge
      const updates = {
        status: 'accepted',
        challengedTeamId: acceptanceData.challengedTeamId,
        challengedPlayers: acceptanceData.challengedPlayers,
        acceptedDate: acceptanceData.acceptedDate,
        acceptedLevel: acceptanceData.acceptedLevel,
        challengedCombinedNTRP: acceptanceData.challengedCombinedNTRP,
        acceptedBy: acceptanceData.acceptedBy,
        acceptedAt: new Date().toISOString(),
        acceptNotes: acceptanceData.notes || '',
        matchId: acceptanceData.matchId || null,
        updatedAt: new Date().toISOString(),
        updatedBy: acceptanceData.acceptedBy
      };

      transaction.update(challengeRef, updates);

      return {
        success: true,
        challenge: { ...challenge, ...updates, challengeId },
        message: 'Challenge accepted successfully'
      };
    });

    if (!result.success) {
      return result;
    }

    // Create pending match from the accepted challenge
    console.log('📝 Creating pending match from accepted challenge...');
    const matchResult = await createPendingMatchFromChallenge(result.challenge);

    if (!matchResult.success) {
      console.error('⚠️ Challenge accepted but failed to create pending match:', matchResult.error);
      // Challenge is still accepted, just log the match creation failure
      return {
        ...result,
        warning: 'Challenge accepted but pending match creation failed',
        matchError: matchResult.message
      };
    }

    console.log('✅ Challenge accepted and pending match created:', challengeId);
    return {
      ...result,
      match: matchResult.match
    };

  } catch (error) {
    console.error(`❌ Error accepting challenge ${challengeId}:`, error);

    // User-friendly error messages
    if (error.message.includes('already been accepted')) {
      return {
        success: false,
        alreadyAccepted: true,
        message: error.message
      };
    }

    if (error.message.includes('Challenge not found')) {
      return {
        success: false,
        notFound: true,
        message: error.message
      };
    }

    return {
      success: false,
      error: error.message,
      message: `Failed to accept challenge: ${error.message}`
    };
  }
};

/**
 * Complete a challenge (mark as completed after match results entered)
 *
 * @param {string} challengeId - Challenge ID
 * @param {string} completedBy - Name of user completing
 * @param {string} [matchId] - Optional match ID
 * @returns {Promise<object>} Result object
 */
export const completeChallenge = async (challengeId, completedBy, matchId = null) => {
  try {
    const docRef = doc(db, COLLECTION, challengeId);

    // Check if challenge exists
    const docSnap = await getDoc(docRef);
    if (!docSnap.exists()) {
      throw new Error(`Challenge ${challengeId} not found`);
    }

    const challenge = docSnap.data();

    // Check if challenge is in 'accepted' status
    if (challenge.status !== 'accepted') {
      throw new Error(`Challenge must be in 'accepted' status to complete (current: ${challenge.status})`);
    }

    // Update to completed
    const updates = {
      status: 'completed',
      completedAt: new Date().toISOString(),
      completedBy,
      updatedAt: new Date().toISOString(),
      updatedBy: completedBy
    };

    if (matchId) {
      updates.matchId = matchId;
    }

    await updateDoc(docRef, updates);

    console.log('✅ Challenge completed:', challengeId);
    return {
      success: true,
      challengeId,
      message: 'Challenge marked as completed'
    };

  } catch (error) {
    console.error(`❌ Error completing challenge ${challengeId}:`, error);
    return {
      success: false,
      challengeId,
      error: error.message,
      message: `Failed to complete challenge: ${error.message}`
    };
  }
};

// ========================================
// DELETE - Delete challenge
// ========================================

/**
 * Delete a challenge
 *
 * @param {string} challengeId - Challenge ID
 * @returns {Promise<object>} Result object
 */
export const deleteChallenge = async (challengeId) => {
  try {
    const docRef = doc(db, COLLECTION, challengeId);

    // Check if challenge exists
    const docSnap = await getDoc(docRef);
    if (!docSnap.exists()) {
      throw new Error(`Challenge ${challengeId} not found`);
    }

    // Delete the document
    await deleteDoc(docRef);

    console.log('✅ Challenge deleted:', challengeId);
    return {
      success: true,
      challengeId,
      message: 'Challenge deleted successfully'
    };

  } catch (error) {
    console.error(`❌ Error deleting challenge ${challengeId}:`, error);
    return {
      success: false,
      challengeId,
      error: error.message,
      message: `Failed to delete challenge: ${error.message}`
    };
  }
};

// ========================================
// REAL-TIME SUBSCRIPTIONS
// ========================================

/**
 * Subscribe to all challenges (real-time updates)
 *
 * @param {function} callback - Callback function(challenges)
 * @param {function} [errorCallback] - Error callback function(error)
 * @returns {function} Unsubscribe function
 */
export const subscribeToChallenges = (callback, errorCallback) => {
  const q = query(collection(db, COLLECTION), orderBy('createdAt', 'desc'));

  return onSnapshot(
    q,
    (querySnapshot) => {
      const challenges = [];
      querySnapshot.forEach((doc) => {
        // Skip old blob documents
        if (doc.id !== 'data' && doc.id !== 'data_backup_blob') {
          challenges.push({ id: doc.id, ...doc.data() });
        }
      });

      console.log(`🔄 Real-time update: ${challenges.length} challenges`);
      callback(challenges);
    },
    (error) => {
      console.error('❌ Challenges subscription error:', error);
      if (errorCallback) errorCallback(error);
    }
  );
};

/**
 * Subscribe to challenges by status (real-time updates)
 *
 * @param {string} status - Challenge status
 * @param {function} callback - Callback function(challenges)
 * @param {function} [errorCallback] - Error callback function(error)
 * @returns {function} Unsubscribe function
 */
export const subscribeToChallengesByStatus = (status, callback, errorCallback) => {
  const q = query(
    collection(db, COLLECTION),
    where('status', '==', status),
    orderBy('createdAt', 'desc')
  );

  return onSnapshot(
    q,
    (querySnapshot) => {
      const challenges = [];
      querySnapshot.forEach((doc) => {
        if (doc.id !== 'data' && doc.id !== 'data_backup_blob') {
          challenges.push({ id: doc.id, ...doc.data() });
        }
      });

      console.log(`🔄 Real-time update: ${challenges.length} ${status} challenges`);
      callback(challenges);
    },
    (error) => {
      console.error(`❌ ${status} challenges subscription error:`, error);
      if (errorCallback) errorCallback(error);
    }
  );
};

/**
 * Subscribe to challenges by team (real-time updates)
 *
 * @param {number} teamId - Team ID
 * @param {function} callback - Callback function(challenges)
 * @param {function} [errorCallback] - Error callback function(error)
 * @returns {function} Unsubscribe function
 */
export const subscribeToChallengesByTeam = (teamId, callback, errorCallback) => {
  // This requires getting all challenges and filtering client-side
  // because we need to check multiple fields (challengerTeamId, challengedTeamId, acceptingTeamId)
  return subscribeToChallenges(
    (challenges) => {
      const teamChallenges = challenges.filter(c =>
        c.challengerTeamId === teamId ||
        c.challengedTeamId === teamId ||
        c.acceptingTeamId === teamId
      );
      console.log(`🔄 Real-time update: ${teamChallenges.length} challenges for team ${teamId}`);
      callback(teamChallenges);
    },
    errorCallback
  );
};

/**
 * Subscribe to a single challenge (real-time updates)
 *
 * @param {string} challengeId - Challenge ID
 * @param {function} callback - Callback function(challenge)
 * @param {function} [errorCallback] - Error callback function(error)
 * @returns {function} Unsubscribe function
 */
export const subscribeToChallenge = (challengeId, callback, errorCallback) => {
  const docRef = doc(db, COLLECTION, challengeId);

  return onSnapshot(
    docRef,
    (docSnap) => {
      if (docSnap.exists()) {
        const challenge = { id: docSnap.id, ...docSnap.data() };
        console.log(`🔄 Real-time update: Challenge ${challengeId}`);
        callback(challenge);
      } else {
        console.warn(`⚠️ Challenge ${challengeId} no longer exists`);
        callback(null);
      }
    },
    (error) => {
      console.error(`❌ Challenge ${challengeId} subscription error:`, error);
      if (errorCallback) errorCallback(error);
    }
  );
};
