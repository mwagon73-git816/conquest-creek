import { doc, getDoc, setDoc, deleteDoc, collection, addDoc, query, orderBy, limit, getDocs, runTransaction, serverTimestamp } from 'firebase/firestore';
import { ref, uploadString, getDownloadURL, deleteObject } from 'firebase/storage';
import { db, storage as firebaseStorage, COLLECTIONS } from '../firebase';

export const storage = {
  async get(collectionName, docId) {
    try {
      const docRef = doc(db, collectionName, docId || 'data');
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        return docSnap.data();
      }
      return null;
    } catch (error) {
      console.error('Error getting data:', error);
      throw error;
    }
  },

  async set(collectionName, data, docId, expectedVersion = null) {
    try {
      const docRef = doc(db, collectionName, docId || 'data');

      // Conflict detection: check if data has been modified
      if (expectedVersion) {
        const currentDoc = await getDoc(docRef);
        if (currentDoc.exists()) {
          const currentVersion = currentDoc.data().updatedAt;
          if (currentVersion !== expectedVersion) {
            // Data has been modified by another user
            return {
              success: false,
              conflict: true,
              currentVersion,
              expectedVersion,
              message: 'Data has been updated by another user. Please refresh to see latest changes.'
            };
          }
        }
      }

      const newVersion = new Date().toISOString();
      await setDoc(docRef, {
        data: data,
        updatedAt: newVersion
      });

      return {
        success: true,
        version: newVersion
      };
    } catch (error) {
      console.error('Error setting data:', error);
      throw error;
    }
  },

  async delete(collectionName, docId) {
    try {
      const docRef = doc(db, collectionName, docId || 'data');
      await deleteDoc(docRef);
      return true;
    } catch (error) {
      console.error('Error deleting data:', error);
      throw error;
    }
  }
};

// Firebase Storage utility functions for image management
export const imageStorage = {
  /**
   * Uploads an image to Firebase Storage
   * @param {string} base64Data - Base64 encoded image data (data:image/jpeg;base64,...)
   * @param {string} path - Storage path (e.g., 'photos/photo123.jpg' or 'logos/team456.jpg')
   * @returns {Promise<string>} Download URL of the uploaded image
   */
  async uploadImage(base64Data, path) {
    try {
      const storageRef = ref(firebaseStorage, path);

      // Upload base64 string to Storage
      const snapshot = await uploadString(storageRef, base64Data, 'data_url');

      // Get and return the download URL
      const downloadURL = await getDownloadURL(snapshot.ref);
      return downloadURL;
    } catch (error) {
      console.error('Error uploading image to Storage:', error);
      throw error;
    }
  },

  /**
   * Deletes an image from Firebase Storage
   * @param {string} path - Storage path to delete (e.g., 'photos/photo123.jpg')
   * @returns {Promise<boolean>} Success status
   */
  async deleteImage(path) {
    try {
      const storageRef = ref(firebaseStorage, path);
      await deleteObject(storageRef);
      return true;
    } catch (error) {
      // If file doesn't exist, consider it a success
      if (error.code === 'storage/object-not-found') {
        console.warn('Image not found in Storage, already deleted:', path);
        return true;
      }
      console.error('Error deleting image from Storage:', error);
      throw error;
    }
  },

  /**
   * Gets the download URL for an image in Storage
   * @param {string} path - Storage path (e.g., 'photos/photo123.jpg')
   * @returns {Promise<string>} Download URL
   */
  async getImageURL(path) {
    try {
      const storageRef = ref(firebaseStorage, path);
      const downloadURL = await getDownloadURL(storageRef);
      return downloadURL;
    } catch (error) {
      console.error('Error getting image URL from Storage:', error);
      throw error;
    }
  }
};

export const tournamentStorage = {
  async getTeams() {
    // FIXED: Return the whole result object, not just result.data
    return await storage.get(COLLECTIONS.TEAMS);
  },

  async setTeams(teams, expectedVersion = null) {
    return await storage.set(COLLECTIONS.TEAMS, teams, 'data', expectedVersion);
  },

  async getMatches() {
    // FIXED: Return the whole result object
    return await storage.get(COLLECTIONS.MATCHES);
  },

  async setMatches(matches, expectedVersion = null) {
    return await storage.set(COLLECTIONS.MATCHES, matches, 'data', expectedVersion);
  },

  async getBonuses() {
    // FIXED: Return the whole result object
    return await storage.get(COLLECTIONS.BONUSES);
  },

  async setBonuses(bonuses, expectedVersion = null) {
    return await storage.set(COLLECTIONS.BONUSES, bonuses, 'data', expectedVersion);
  },

  async getAuthSession() {
    // FIXED: Use localStorage instead of Firestore to prevent session leakage
    // Each browser maintains its own isolated session
    try {
      const sessionData = localStorage.getItem('cct_auth_session');
      if (sessionData) {
        // Return format compatible with existing code
        return { data: sessionData };
      }
      return null;
    } catch (error) {
      console.error('Error getting auth session:', error);
      return null;
    }
  },

  async setAuthSession(session) {
    // FIXED: Use localStorage instead of Firestore to prevent session leakage
    try {
      localStorage.setItem('cct_auth_session', JSON.stringify(session));
      return { success: true };
    } catch (error) {
      console.error('Error setting auth session:', error);
      throw error;
    }
  },

  async deleteAuthSession() {
    // FIXED: Use localStorage instead of Firestore to prevent session leakage
    try {
      localStorage.removeItem('cct_auth_session');
      return true;
    } catch (error) {
      console.error('Error deleting auth session:', error);
      throw error;
    }
  },

  async getPhotos() {
    // FIXED: Return the whole result object
    return await storage.get(COLLECTIONS.PHOTOS);
  },

  async setPhotos(photos, expectedVersion = null) {
    return await storage.set(COLLECTIONS.PHOTOS, photos, 'data', expectedVersion);
  },

  async getCaptains() {
    // FIXED: Return the whole result object
    return await storage.get(COLLECTIONS.CAPTAINS);
  },

  async setCaptains(captains, expectedVersion = null) {
    return await storage.set(COLLECTIONS.CAPTAINS, captains, 'data', expectedVersion);
  },

  async getChallenges() {
    return await storage.get(COLLECTIONS.CHALLENGES);
  },

  async setChallenges(challenges, expectedVersion = null) {
    return await storage.set(COLLECTIONS.CHALLENGES, challenges, 'data', expectedVersion);
  },

  /**
   * Accept a challenge using Firestore transaction to prevent race conditions
   * @param {number} challengeId - The ID of the challenge to accept
   * @param {object} acceptanceData - Data for accepting the challenge
   * @param {string} acceptanceData.challengedTeamId - ID of the team accepting
   * @param {string} acceptanceData.acceptedDate - Match date
   * @param {string} acceptanceData.acceptedLevel - Match level
   * @param {Array} acceptanceData.challengedPlayers - Player IDs
   * @param {number} acceptanceData.challengedCombinedNTRP - Combined NTRP rating
   * @param {string} acceptanceData.acceptedBy - Name of captain accepting
   * @param {string} acceptanceData.notes - Optional notes
   * @param {string} acceptanceData.matchId - Generated match ID
   * @returns {Promise<object>} Result object with success status and message
   */
  async acceptChallengeTransaction(challengeId, acceptanceData) {
    try {
      const result = await runTransaction(db, async (transaction) => {
        // Read both challenges and matches documents
        const challengesRef = doc(db, COLLECTIONS.CHALLENGES, 'data');
        const matchesRef = doc(db, COLLECTIONS.MATCHES, 'data');

        const [challengesDoc, matchesDoc] = await Promise.all([
          transaction.get(challengesRef),
          transaction.get(matchesRef)
        ]);

        if (!challengesDoc.exists()) {
          throw new Error('Challenges data not found');
        }

        const challengesData = challengesDoc.data();
        const challenges = JSON.parse(challengesData.data);

        // Find the specific challenge
        const challengeIndex = challenges.findIndex(c => c.id === challengeId);
        if (challengeIndex === -1) {
          throw new Error('Challenge not found');
        }

        const challenge = challenges[challengeIndex];

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

        // Update the challenge
        challenges[challengeIndex] = {
          ...challenge,
          status: 'accepted',
          challengedTeamId: acceptanceData.challengedTeamId,
          acceptedDate: acceptanceData.acceptedDate,
          acceptedLevel: acceptanceData.acceptedLevel,
          challengedPlayers: acceptanceData.challengedPlayers,
          challengedCombinedNTRP: acceptanceData.challengedCombinedNTRP,
          acceptedBy: acceptanceData.acceptedBy,
          acceptedAt: new Date().toISOString(),
          acceptNotes: acceptanceData.notes || '',
          matchId: acceptanceData.matchId
        };

        // Create a pending match document
        const pendingMatch = {
          id: Date.now(),
          matchId: acceptanceData.matchId,
          matchType: challenge.matchType || 'Doubles',
          date: acceptanceData.acceptedDate,
          level: acceptanceData.acceptedLevel, // CRITICAL: Level from challenge
          team1Id: challenge.challengerTeamId,
          team2Id: acceptanceData.challengedTeamId,
          team1Players: challenge.challengerPlayers || [], // Challenger's players with NTRP
          team2Players: acceptanceData.challengedPlayers || [], // Accepting team's players with NTRP
          status: 'pending', // Waiting for results
          fromChallenge: true,
          originChallengeId: challenge.id,
          scheduledDate: acceptanceData.acceptedDate,
          timestamp: new Date().toISOString(),
          notes: acceptanceData.notes || '',
          // Preserve combined NTRP ratings for validation
          team1CombinedNTRP: challenge.challengerCombinedNTRP,
          team2CombinedNTRP: acceptanceData.challengedCombinedNTRP
        };

        console.log('✅ Creating pending match:', pendingMatch);

        // Add match to matches collection
        let matches = [];
        if (matchesDoc.exists()) {
          const matchesData = matchesDoc.data();
          matches = JSON.parse(matchesData.data);
        }
        matches.push(pendingMatch);

        // Write back both updated documents
        const newVersion = new Date().toISOString();
        transaction.update(challengesRef, {
          data: JSON.stringify(challenges),
          updatedAt: newVersion
        });

        transaction.update(matchesRef, {
          data: JSON.stringify(matches),
          updatedAt: newVersion
        });

        return {
          success: true,
          message: 'Challenge accepted and match created!',
          updatedChallenge: challenges[challengeIndex],
          createdMatch: pendingMatch,
          version: newVersion
        };
      });

      return result;
    } catch (error) {
      console.error('❌ Transaction failed:', error);

      // Return user-friendly error messages
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
          message: 'This challenge no longer exists. It may have been deleted.'
        };
      }

      return {
        success: false,
        message: error.message || 'Failed to accept challenge. Please try again.'
      };
    }
  },

  /**
   * Submit match results using Firestore transaction to prevent race conditions
   * @param {object} matchData - Complete match data including results
   * @param {boolean} isPendingMatch - Whether this is from an accepted challenge
   * @param {number} challengeId - Challenge ID if this is a pending match
   * @param {string} submittedBy - Name of captain submitting results
   * @returns {Promise<object>} Result object with success status and message
   */
  async submitMatchResultsTransaction(matchData, isPendingMatch, challengeId, submittedBy) {
    try {
      const result = await runTransaction(db, async (transaction) => {
        const matchesRef = doc(db, COLLECTIONS.MATCHES, 'data');

        // If this is from a pending match, also check/update the challenge
        if (isPendingMatch && challengeId) {
          const challengesRef = doc(db, COLLECTIONS.CHALLENGES, 'data');

          // Read both documents
          const [matchesDoc, challengesDoc] = await Promise.all([
            transaction.get(matchesRef),
            transaction.get(challengesRef)
          ]);

          if (!challengesDoc.exists()) {
            throw new Error('Challenges data not found');
          }

          const challengesData = challengesDoc.data();
          const challenges = JSON.parse(challengesData.data);

          // Find the challenge
          const challengeIndex = challenges.findIndex(c => c.id === challengeId);
          if (challengeIndex === -1) {
            throw new Error('Challenge not found. It may have been deleted.');
          }

          const challenge = challenges[challengeIndex];

          // Check if results already entered
          if (challenge.status === 'completed') {
            const completedBy = challenge.completedBy || 'another captain';
            throw new Error(`Match results have already been entered by ${completedBy}`);
          }

          // Check if challenge is still accepted
          if (challenge.status !== 'accepted') {
            throw new Error(`Challenge is no longer accepted (status: ${challenge.status})`);
          }

          // Update challenge to completed
          challenges[challengeIndex] = {
            ...challenge,
            status: 'completed',
            matchId: matchData.id,
            completedAt: new Date().toISOString(),
            completedBy: submittedBy
          };

          // Write updated challenges
          const challengesVersion = new Date().toISOString();
          transaction.update(challengesRef, {
            data: JSON.stringify(challenges),
            updatedAt: challengesVersion
          });

          // Get/update matches
          let matches = [];
          if (matchesDoc.exists()) {
            const matchesData = matchesDoc.data();
            matches = JSON.parse(matchesData.data);
          }

          // Add new match
          matches.push(matchData);

          // Write updated matches
          const matchesVersion = new Date().toISOString();
          transaction.update(matchesRef, {
            data: JSON.stringify(matches),
            updatedAt: matchesVersion
          });

          return {
            success: true,
            message: 'Match results saved successfully!',
            updatedChallenge: challenges[challengeIndex],
            matchesVersion,
            challengesVersion
          };
        } else {
          // Regular match entry (not from challenge) or match edit
          const matchesDoc = await transaction.get(matchesRef);

          let matches = [];
          if (matchesDoc.exists()) {
            const matchesData = matchesDoc.data();
            matches = JSON.parse(matchesData.data);
          }

          // Check if this is an edit (match ID already exists)
          const existingMatchIndex = matches.findIndex(m => m.id === matchData.id);

          if (existingMatchIndex !== -1) {
            // Update existing match
            matches[existingMatchIndex] = matchData;
          } else {
            // Add new match
            matches.push(matchData);
          }

          // Write updated matches
          const version = new Date().toISOString();
          transaction.update(matchesRef, {
            data: JSON.stringify(matches),
            updatedAt: version
          });

          return {
            success: true,
            message: 'Match results saved successfully!',
            version
          };
        }
      });

      return result;
    } catch (error) {
      console.error('❌ Match results transaction failed:', error);

      // Return user-friendly error messages
      if (error.message.includes('already been entered')) {
        return {
          success: false,
          alreadyCompleted: true,
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

      if (error.message.includes('no longer accepted')) {
        return {
          success: false,
          statusChanged: true,
          message: error.message
        };
      }

      return {
        success: false,
        message: error.message || 'Failed to save match results. Please try again.'
      };
    }
  },

  async resetAll() {
    await storage.delete(COLLECTIONS.TEAMS);
    await storage.delete(COLLECTIONS.MATCHES);
    await storage.delete(COLLECTIONS.BONUSES);
    return true;
  },

  async addActivityLog(logEntry) {
    try {
      const logsCollection = collection(db, COLLECTIONS.ACTIVITY_LOGS);
      await addDoc(logsCollection, logEntry);
      return true;
    } catch (error) {
      console.error('Error adding activity log:', error);
      throw error;
    }
  },

  async getActivityLogs(limitCount = 100) {
    try {
      const logsCollection = collection(db, COLLECTIONS.ACTIVITY_LOGS);
      const q = query(logsCollection, orderBy('timestamp', 'desc'), limit(limitCount));
      const querySnapshot = await getDocs(q);

      const logs = [];
      querySnapshot.forEach((doc) => {
        logs.push({
          id: doc.id,
          ...doc.data()
        });
      });

      return logs;
    } catch (error) {
      console.error('Error getting activity logs:', error);
      throw error;
    }
  },

  // Players management with version tracking
  async getPlayers() {
    return await storage.get('players');
  },

  async setPlayers(players, expectedVersion = null) {
    return await storage.set('players', players, 'data', expectedVersion);
  },

  // Active session management
  async getActiveSessions() {
    const result = await storage.get('active_sessions');
    return result ? result.data : null;
  },

  async setActiveSession(username, role) {
    const sessions = await this.getActiveSessions() || [];
    const existingSessionIndex = sessions.findIndex(s => s.username === username);

    const newSession = {
      username,
      role,
      loginTime: new Date().toISOString(),
      lastActivity: new Date().toISOString()
    };

    if (existingSessionIndex >= 0) {
      sessions[existingSessionIndex] = newSession;
    } else {
      sessions.push(newSession);
    }

    // Clean up sessions older than 2 hours
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
    const activeSessions = sessions.filter(s => s.lastActivity > twoHoursAgo);

    await storage.set('active_sessions', activeSessions);
    return activeSessions;
  },

  async removeActiveSession(username) {
    const sessions = await this.getActiveSessions() || [];
    const filteredSessions = sessions.filter(s => s.username !== username);
    await storage.set('active_sessions', filteredSessions);
    return filteredSessions;
  },

  async updateSessionActivity(username) {
    const sessions = await this.getActiveSessions() || [];
    const session = sessions.find(s => s.username === username);
    if (session) {
      session.lastActivity = new Date().toISOString();
      await storage.set('active_sessions', sessions);
    }
  },

  // Import lock management
  async getImportLock() {
    const result = await storage.get('import_lock');
    return result ? result.data : null;
  },

  async setImportLock(username, operation) {
    const lock = {
      username,
      operation,
      startTime: new Date().toISOString()
    };
    await storage.set('import_lock', lock);
    return lock;
  },

  async releaseImportLock() {
    await storage.delete('import_lock');
  },

  // Get data version for conflict detection
  async getDataVersion(collectionName) {
    const result = await storage.get(collectionName);
    return result ? result.updatedAt : null;
  },

  /**
   * Validate timestamp before saving to detect conflicts
   * @param {string} collectionName - Name of collection
   * @param {string} expectedVersion - Timestamp when data was loaded
   * @returns {Promise<{valid: boolean, currentVersion: string, message: string}>}
   */
  async validateTimestamp(collectionName, expectedVersion) {
    try {
      const currentVersion = await this.getDataVersion(collectionName);

      // If no expected version provided, can't validate (backwards compatibility)
      if (!expectedVersion) {
        console.warn(`⚠️ No timestamp provided for ${collectionName} validation`);
        return {
          valid: true,
          currentVersion,
          message: 'No timestamp validation (backwards compatible)'
        };
      }

      // If current version doesn't exist, data might be new
      if (!currentVersion) {
        return {
          valid: true,
          currentVersion: null,
          message: 'No existing data found'
        };
      }

      // Compare timestamps
      if (currentVersion !== expectedVersion) {
        console.warn(`⚠️ Timestamp mismatch for ${collectionName}:`, {
          expected: expectedVersion,
          current: currentVersion
        });
        return {
          valid: false,
          currentVersion,
          message: 'Data has been modified by another user since you loaded it'
        };
      }

      // Timestamps match
      return {
        valid: true,
        currentVersion,
        message: 'Timestamp valid'
      };
    } catch (error) {
      console.error('Error validating timestamp:', error);
      return {
        valid: false,
        currentVersion: null,
        message: `Validation error: ${error.message}`
      };
    }
  },

  /**
   * Save with timestamp validation
   * Checks if data has been modified before saving
   * @param {string} collectionName - Name of collection
   * @param {any} data - Data to save
   * @param {string} expectedVersion - Timestamp when data was loaded
   * @param {boolean} force - Force save even if conflict detected
   * @returns {Promise<{success: boolean, version: string, conflict: boolean, message: string}>}
   */
  async saveWithValidation(collectionName, data, expectedVersion, force = false) {
    try {
      // Validate timestamp first
      const validation = await this.validateTimestamp(collectionName, expectedVersion);

      if (!validation.valid && !force) {
        return {
          success: false,
          conflict: true,
          version: validation.currentVersion,
          message: validation.message
        };
      }

      // Proceed with save
      const result = await storage.set(collectionName, data, 'data', expectedVersion);

      if (!result.success) {
        return {
          success: false,
          conflict: true,
          version: validation.currentVersion,
          message: result.message || 'Save failed'
        };
      }

      return {
        success: true,
        conflict: false,
        version: result.version,
        message: force ? 'Saved (overwrite forced)' : 'Saved successfully'
      };
    } catch (error) {
      console.error('Error in saveWithValidation:', error);
      return {
        success: false,
        conflict: false,
        version: null,
        message: `Save error: ${error.message}`
      };
    }
  },

  /**
   * Log conflict detection event
   * @param {string} entityType - Type of entity (e.g., 'team', 'match')
   * @param {string|number} entityId - Entity ID
   * @param {string} userAttempting - User attempting the save
   * @param {string} action - What happened ('reloaded', 'overwrote', 'canceled')
   */
  async logConflict(entityType, entityId, userAttempting, action) {
    try {
      const logEntry = {
        type: 'CONFLICT_DETECTED',
        entityType,
        entityId,
        userAttempting,
        action,
        timestamp: new Date().toISOString(),
        message: `Conflict detected when saving ${entityType} #${entityId}. User ${action} the changes.`
      };

      await addDoc(collection(db, COLLECTIONS.ACTIVITY_LOGS), logEntry);
      console.log('📝 Conflict logged:', logEntry);
    } catch (error) {
      console.error('Error logging conflict:', error);
      // Don't fail the operation if logging fails
    }
  }
};