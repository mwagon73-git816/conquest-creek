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

  async set(collectionName, data, docId) {
    try {
      const docRef = doc(db, collectionName, docId || 'data');
      await setDoc(docRef, {
        data: data,
        updatedAt: new Date().toISOString()
      });
      return true;
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
    const result = await storage.get(COLLECTIONS.TEAMS);
    return result ? result.data : null;
  },

  async setTeams(teams) {
    return await storage.set(COLLECTIONS.TEAMS, teams);
  },

  async getMatches() {
    const result = await storage.get(COLLECTIONS.MATCHES);
    return result ? result.data : null;
  },

  async setMatches(matches) {
    return await storage.set(COLLECTIONS.MATCHES, matches);
  },

  async getBonuses() {
    const result = await storage.get(COLLECTIONS.BONUSES);
    return result ? result.data : null;
  },

  async setBonuses(bonuses) {
    return await storage.set(COLLECTIONS.BONUSES, bonuses);
  },

  async getAuthSession() {
    const result = await storage.get(COLLECTIONS.AUTH, 'session');
    return result ? result.data : null;
  },

  async setAuthSession(session) {
    return await storage.set(COLLECTIONS.AUTH, session, 'session');
  },

  async deleteAuthSession() {
    return await storage.delete(COLLECTIONS.AUTH, 'session');
  },

  async getPhotos() {
    const result = await storage.get(COLLECTIONS.PHOTOS);
    return result ? result.data : null;
  },

  async setPhotos(photos) {
    return await storage.set(COLLECTIONS.PHOTOS, photos);
  },

  async getCaptains() {
    const result = await storage.get(COLLECTIONS.CAPTAINS);
    return result ? result.data : null;
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
  }
};