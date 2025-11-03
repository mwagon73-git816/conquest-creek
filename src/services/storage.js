import { doc, getDoc, setDoc, deleteDoc, collection, addDoc, query, orderBy, limit, getDocs } from 'firebase/firestore';
import { db, COLLECTIONS } from '../firebase';

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

export const tournamentStorage = {
  async getTeams() {
    // FIXED: Return the whole result object, not just result.data
    return await storage.get(COLLECTIONS.TEAMS);
  },

  async setTeams(teams) {
    return await storage.set(COLLECTIONS.TEAMS, teams);
  },

  async getMatches() {
    // FIXED: Return the whole result object
    return await storage.get(COLLECTIONS.MATCHES);
  },

  async setMatches(matches) {
    return await storage.set(COLLECTIONS.MATCHES, matches);
  },

  async getBonuses() {
    // FIXED: Return the whole result object
    return await storage.get(COLLECTIONS.BONUSES);
  },

  async setBonuses(bonuses) {
    return await storage.set(COLLECTIONS.BONUSES, bonuses);
  },

  async getAuthSession() {
    const result = await storage.get(COLLECTIONS.AUTH, 'session');
    return result ? result : null;
  },

  async setAuthSession(session) {
    return await storage.set(COLLECTIONS.AUTH, session, 'session');
  },

  async deleteAuthSession() {
    return await storage.delete(COLLECTIONS.AUTH, 'session');
  },

  async getPhotos() {
    // FIXED: Return the whole result object
    return await storage.get(COLLECTIONS.PHOTOS);
  },

  async setPhotos(photos) {
    return await storage.set(COLLECTIONS.PHOTOS, photos);
  },

  async getCaptains() {
    // FIXED: Return the whole result object
    return await storage.get(COLLECTIONS.CAPTAINS);
  },

  async setCaptains(captains) {
    return await storage.set(COLLECTIONS.CAPTAINS, captains);
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
  }
};