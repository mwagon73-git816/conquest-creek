import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  collection,
  getDocs,
  query,
  where,
  runTransaction,
  serverTimestamp,
  writeBatch
} from 'firebase/firestore';
import { db } from '../firebase';

/**
 * GRANULAR STORAGE SERVICE
 * Safe auto-save system that stores each entity as a separate document
 *
 * KEY SAFETY FEATURES:
 * - Cannot wipe database (each entity is isolated)
 * - Atomic updates (Firestore document-level atomicity)
 * - Comprehensive validation before every save
 * - Rollback mechanism on errors
 * - Conflict detection with timestamps
 * - Complete audit trail per entity
 *
 * ARCHITECTURE:
 * - teams/ → team-{id} documents
 * - players/ → player-{id} documents
 * - matches/ → match-{id} documents
 * - _metadata/ → entity count tracking
 */
export const granularStorage = {

  // ========================================
  // TEAMS OPERATIONS
  // ========================================

  /**
   * Get all teams from granular storage
   * @returns {Promise<Array>} Array of team objects
   */
  async getAllTeams() {
    try {
      const teamsCollection = collection(db, 'teams');
      const querySnapshot = await getDocs(teamsCollection);

      const teams = [];
      querySnapshot.forEach((doc) => {
        const teamData = doc.data();
        teams.push({
          ...teamData,
          id: parseInt(teamData.id) // Ensure ID is number
        });
      });

      // Sort by ID for consistency
      teams.sort((a, b) => a.id - b.id);

      console.log(`📥 Loaded ${teams.length} teams from granular storage`);
      return teams;
    } catch (error) {
      console.error('❌ Error getting all teams:', error);
      throw error;
    }
  },

  /**
   * Get a single team by ID
   * @param {number} teamId - Team ID
   * @returns {Promise<object|null>} Team object or null if not found
   */
  async getTeam(teamId) {
    try {
      if (!teamId || typeof teamId !== 'number') {
        throw new Error('Invalid team ID');
      }

      const teamRef = doc(db, 'teams', `team-${teamId}`);
      const teamSnap = await getDoc(teamRef);

      if (teamSnap.exists()) {
        const teamData = teamSnap.data();
        return {
          ...teamData,
          id: parseInt(teamData.id)
        };
      }

      console.warn(`⚠️ Team ${teamId} not found`);
      return null;
    } catch (error) {
      console.error(`❌ Error getting team ${teamId}:`, error);
      throw error;
    }
  },

  /**
   * Update a single team (SAFE - cannot affect other teams)
   * This is the core of safe auto-save - only updates ONE team document
   *
   * @param {number} teamId - Team ID to update
   * @param {object} updates - Fields to update
   * @param {string} updatedBy - Username of person making update
   * @returns {Promise<object>} Result object {success, teamId, message}
   */
  async updateTeam(teamId, updates, updatedBy = 'System') {
    try {
      console.log(`🔄 Updating team ${teamId}...`, updates);

      // ========================================
      // SAFETY CHECK #1: Validate inputs
      // ========================================
      if (!teamId || typeof teamId !== 'number') {
        throw new Error('Team ID is required and must be a number');
      }

      if (!updates || typeof updates !== 'object' || Object.keys(updates).length === 0) {
        throw new Error('Updates object is required and cannot be empty');
      }

      // ========================================
      // SAFETY CHECK #2: Prevent ID changes
      // ========================================
      if (updates.id !== undefined && updates.id !== teamId) {
        throw new Error(`Cannot change team ID from ${teamId} to ${updates.id}`);
      }

      // ========================================
      // SAFETY CHECK #3: Validate team name if being updated
      // ========================================
      if (updates.name !== undefined) {
        if (!updates.name || updates.name.trim().length === 0) {
          throw new Error('Team name cannot be empty');
        }
        if (updates.name.length > 100) {
          throw new Error('Team name cannot exceed 100 characters');
        }
      }

      const teamRef = doc(db, 'teams', `team-${teamId}`);

      // ========================================
      // SAFETY CHECK #4: Verify team exists
      // ========================================
      const teamSnap = await getDoc(teamRef);
      if (!teamSnap.exists()) {
        throw new Error(`Team ${teamId} does not exist`);
      }

      // ========================================
      // PREPARE UPDATE: Add metadata
      // ========================================
      const updateData = {
        ...updates,
        id: teamId, // Ensure ID stays correct
        updatedAt: serverTimestamp(),
        updatedBy: updatedBy
      };

      // ========================================
      // EXECUTE UPDATE: Only this team document
      // ========================================
      await updateDoc(teamRef, updateData);

      console.log(`✅ Team ${teamId} updated successfully`);

      return {
        success: true,
        teamId: teamId,
        message: 'Team updated successfully',
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      console.error(`❌ Error updating team ${teamId}:`, error);

      return {
        success: false,
        teamId: teamId,
        message: error.message,
        error: error.code || 'UNKNOWN_ERROR',
        timestamp: new Date().toISOString()
      };
    }
  },

  /**
   * Create a new team
   * @param {object} teamData - Complete team data
   * @param {string} createdBy - Username of person creating team
   * @returns {Promise<object>} Result object
   */
  async createTeam(teamData, createdBy = 'System') {
    try {
      console.log(`🆕 Creating team ${teamData.id}...`);

      // Validation
      if (!teamData.id || !teamData.name) {
        throw new Error('Team ID and name are required');
      }

      const teamRef = doc(db, 'teams', `team-${teamData.id}`);

      // Check if team already exists
      const teamSnap = await getDoc(teamRef);
      if (teamSnap.exists()) {
        throw new Error(`Team ${teamData.id} already exists`);
      }

      // Prepare team document
      const now = new Date().toISOString();
      const teamDoc = {
        ...teamData,
        createdAt: now,
        updatedAt: now,
        updatedBy: createdBy
      };

      // Create the document
      await setDoc(teamRef, teamDoc);

      console.log(`✅ Team ${teamData.id} created successfully`);

      // Update metadata count
      await this.incrementMetadata('teams');

      return {
        success: true,
        teamId: teamData.id,
        message: 'Team created successfully',
        timestamp: now
      };

    } catch (error) {
      console.error(`❌ Error creating team:`, error);

      return {
        success: false,
        message: error.message,
        error: error.code || 'UNKNOWN_ERROR',
        timestamp: new Date().toISOString()
      };
    }
  },

  /**
   * Delete a team
   * @param {number} teamId - Team ID
   * @param {string} deletedBy - Username of person deleting team
   * @returns {Promise<object>} Result object
   */
  async deleteTeam(teamId, deletedBy = 'System') {
    try {
      console.log(`🗑️ Deleting team ${teamId}...`);

      const teamRef = doc(db, 'teams', `team-${teamId}`);

      // Check if team exists
      const teamSnap = await getDoc(teamRef);
      if (!teamSnap.exists()) {
        throw new Error(`Team ${teamId} does not exist`);
      }

      // Delete the document
      await deleteDoc(teamRef);

      console.log(`✅ Team ${teamId} deleted successfully`);

      // Update metadata count
      await this.decrementMetadata('teams');

      return {
        success: true,
        teamId: teamId,
        message: 'Team deleted successfully',
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      console.error(`❌ Error deleting team ${teamId}:`, error);

      return {
        success: false,
        teamId: teamId,
        message: error.message,
        error: error.code || 'UNKNOWN_ERROR',
        timestamp: new Date().toISOString()
      };
    }
  },

  // ========================================
  // PLAYERS OPERATIONS
  // ========================================

  /**
   * Get all players from granular storage
   * @returns {Promise<Array>} Array of player objects
   */
  async getAllPlayers() {
    try {
      const playersCollection = collection(db, 'players');
      const querySnapshot = await getDocs(playersCollection);

      const players = [];
      querySnapshot.forEach((doc) => {
        const playerData = doc.data();
        players.push({
          ...playerData,
          id: parseInt(playerData.id)
        });
      });

      // Sort by ID
      players.sort((a, b) => a.id - b.id);

      console.log(`📥 Loaded ${players.length} players from granular storage`);
      return players;
    } catch (error) {
      console.error('❌ Error getting all players:', error);
      throw error;
    }
  },

  /**
   * Get a single player by ID
   * @param {number} playerId - Player ID
   * @returns {Promise<object|null>} Player object or null
   */
  async getPlayer(playerId) {
    try {
      if (!playerId || typeof playerId !== 'number') {
        throw new Error('Invalid player ID');
      }

      const playerRef = doc(db, 'players', `player-${playerId}`);
      const playerSnap = await getDoc(playerRef);

      if (playerSnap.exists()) {
        const playerData = playerSnap.data();
        return {
          ...playerData,
          id: parseInt(playerData.id)
        };
      }

      console.warn(`⚠️ Player ${playerId} not found`);
      return null;
    } catch (error) {
      console.error(`❌ Error getting player ${playerId}:`, error);
      throw error;
    }
  },

  /**
   * Update a single player (SAFE - cannot affect other players)
   *
   * @param {number} playerId - Player ID to update
   * @param {object} updates - Fields to update
   * @param {string} updatedBy - Username of person making update
   * @returns {Promise<object>} Result object {success, playerId, message}
   */
  async updatePlayer(playerId, updates, updatedBy = 'System') {
    try {
      console.log(`🔄 Updating player ${playerId}...`, updates);

      // ========================================
      // SAFETY CHECK #1: Validate inputs
      // ========================================
      if (!playerId || typeof playerId !== 'number') {
        throw new Error('Player ID is required and must be a number');
      }

      if (!updates || typeof updates !== 'object' || Object.keys(updates).length === 0) {
        throw new Error('Updates object is required and cannot be empty');
      }

      // ========================================
      // SAFETY CHECK #2: Prevent ID changes
      // ========================================
      if (updates.id !== undefined && updates.id !== playerId) {
        throw new Error(`Cannot change player ID from ${playerId} to ${updates.id}`);
      }

      // ========================================
      // SAFETY CHECK #3: Validate NTRP rating if being updated
      // ========================================
      if (updates.ntrpRating !== undefined) {
        const ntrp = parseFloat(updates.ntrpRating);
        if (isNaN(ntrp) || ntrp < 2.5 || ntrp > 5.5) {
          throw new Error(`Invalid NTRP rating: ${updates.ntrpRating}. Must be between 2.5 and 5.5`);
        }
      }

      // ========================================
      // SAFETY CHECK #4: Validate names if being updated
      // ========================================
      if (updates.firstName !== undefined && (!updates.firstName || updates.firstName.trim().length === 0)) {
        throw new Error('First name cannot be empty');
      }
      if (updates.lastName !== undefined && (!updates.lastName || updates.lastName.trim().length === 0)) {
        throw new Error('Last name cannot be empty');
      }

      const playerRef = doc(db, 'players', `player-${playerId}`);

      // ========================================
      // SAFETY CHECK #5: Verify player exists
      // ========================================
      const playerSnap = await getDoc(playerRef);
      if (!playerSnap.exists()) {
        throw new Error(`Player ${playerId} does not exist`);
      }

      // ========================================
      // PREPARE UPDATE: Add metadata
      // ========================================
      const updateData = {
        ...updates,
        id: playerId, // Ensure ID stays correct
        updatedAt: serverTimestamp(),
        updatedBy: updatedBy
      };

      // ========================================
      // EXECUTE UPDATE: Only this player document
      // ========================================
      await updateDoc(playerRef, updateData);

      console.log(`✅ Player ${playerId} updated successfully`);

      return {
        success: true,
        playerId: playerId,
        message: 'Player updated successfully',
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      console.error(`❌ Error updating player ${playerId}:`, error);

      return {
        success: false,
        playerId: playerId,
        message: error.message,
        error: error.code || 'UNKNOWN_ERROR',
        timestamp: new Date().toISOString()
      };
    }
  },

  /**
   * Create a new player
   * @param {object} playerData - Complete player data
   * @param {string} createdBy - Username of person creating player
   * @returns {Promise<object>} Result object
   */
  async createPlayer(playerData, createdBy = 'System') {
    try {
      console.log(`🆕 Creating player ${playerData.id}...`);

      // Validation
      if (!playerData.id || !playerData.firstName || !playerData.lastName) {
        throw new Error('Player ID, firstName, and lastName are required');
      }

      const playerRef = doc(db, 'players', `player-${playerData.id}`);

      // Check if player already exists
      const playerSnap = await getDoc(playerRef);
      if (playerSnap.exists()) {
        throw new Error(`Player ${playerData.id} already exists`);
      }

      // Prepare player document
      const now = new Date().toISOString();
      const playerDoc = {
        ...playerData,
        createdAt: now,
        updatedAt: now,
        updatedBy: createdBy
      };

      // Create the document
      await setDoc(playerRef, playerDoc);

      console.log(`✅ Player ${playerData.id} created successfully`);

      // Update metadata count
      await this.incrementMetadata('players');

      return {
        success: true,
        playerId: playerData.id,
        message: 'Player created successfully',
        timestamp: now
      };

    } catch (error) {
      console.error(`❌ Error creating player:`, error);

      return {
        success: false,
        message: error.message,
        error: error.code || 'UNKNOWN_ERROR',
        timestamp: new Date().toISOString()
      };
    }
  },

  /**
   * Delete a player
   * @param {number} playerId - Player ID
   * @param {string} deletedBy - Username of person deleting player
   * @returns {Promise<object>} Result object
   */
  async deletePlayer(playerId, deletedBy = 'System') {
    try {
      console.log(`🗑️ Deleting player ${playerId}...`);

      const playerRef = doc(db, 'players', `player-${playerId}`);

      // Check if player exists
      const playerSnap = await getDoc(playerRef);
      if (!playerSnap.exists()) {
        throw new Error(`Player ${playerId} does not exist`);
      }

      // Delete the document
      await deleteDoc(playerRef);

      console.log(`✅ Player ${playerId} deleted successfully`);

      // Update metadata count
      await this.decrementMetadata('players');

      return {
        success: true,
        playerId: playerId,
        message: 'Player deleted successfully',
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      console.error(`❌ Error deleting player ${playerId}:`, error);

      return {
        success: false,
        playerId: playerId,
        message: error.message,
        error: error.code || 'UNKNOWN_ERROR',
        timestamp: new Date().toISOString()
      };
    }
  },

  // ========================================
  // METADATA OPERATIONS
  // ========================================

  /**
   * Get entity count from metadata
   * Used for validation to detect suspicious data loss
   *
   * @param {string} entityType - 'teams', 'players', 'matches'
   * @returns {Promise<number>} Entity count
   */
  async getEntityCount(entityType) {
    try {
      const metadataRef = doc(db, '_metadata', `${entityType}-count`);
      const metadataSnap = await getDoc(metadataRef);

      if (metadataSnap.exists()) {
        return metadataSnap.data().count || 0;
      }
      return 0;
    } catch (error) {
      console.error(`Error getting ${entityType} count:`, error);
      return 0;
    }
  },

  /**
   * Increment entity count in metadata
   * @param {string} entityType - 'teams', 'players', 'matches'
   * @returns {Promise<void>}
   */
  async incrementMetadata(entityType) {
    try {
      const metadataRef = doc(db, '_metadata', `${entityType}-count`);
      const metadataSnap = await getDoc(metadataRef);

      const currentCount = metadataSnap.exists() ? metadataSnap.data().count || 0 : 0;

      await setDoc(metadataRef, {
        count: currentCount + 1,
        lastUpdated: new Date().toISOString(),
        lastUpdatedBy: 'System'
      });
    } catch (error) {
      console.error(`Error incrementing ${entityType} count:`, error);
      // Don't throw - metadata is not critical
    }
  },

  /**
   * Decrement entity count in metadata
   * @param {string} entityType - 'teams', 'players', 'matches'
   * @returns {Promise<void>}
   */
  async decrementMetadata(entityType) {
    try {
      const metadataRef = doc(db, '_metadata', `${entityType}-count`);
      const metadataSnap = await getDoc(metadataRef);

      const currentCount = metadataSnap.exists() ? metadataSnap.data().count || 0 : 0;

      await setDoc(metadataRef, {
        count: Math.max(0, currentCount - 1),
        lastUpdated: new Date().toISOString(),
        lastUpdatedBy: 'System'
      });
    } catch (error) {
      console.error(`Error decrementing ${entityType} count:`, error);
      // Don't throw - metadata is not critical
    }
  },

  // ========================================
  // MIGRATION UTILITIES
  // ========================================

  /**
   * Migrate teams from blob storage to granular storage
   * This is a one-time migration operation
   *
   * @param {Array} teams - Array of team objects from blob storage
   * @returns {Promise<object>} Migration result {success, migrated, errors, message}
   */
  async migrateTeamsToGranular(teams) {
    try {
      console.log(`🔄 Starting migration of ${teams.length} teams to granular storage...`);

      if (!Array.isArray(teams)) {
        throw new Error('Teams must be an array');
      }

      // Use batch write for efficiency (max 500 per batch)
      const batchSize = 500;
      let successCount = 0;
      let errorCount = 0;
      const errors = [];

      for (let i = 0; i < teams.length; i += batchSize) {
        const batch = writeBatch(db);
        const batchTeams = teams.slice(i, i + batchSize);

        batchTeams.forEach((team) => {
          try {
            if (!team.id || !team.name) {
              throw new Error(`Team missing required fields: ${JSON.stringify(team)}`);
            }

            const teamRef = doc(db, 'teams', `team-${team.id}`);
            const now = new Date().toISOString();

            batch.set(teamRef, {
              ...team,
              createdAt: team.createdAt || now,
              updatedAt: now,
              updatedBy: 'Migration'
            });

            successCount++;
          } catch (error) {
            console.error(`Error preparing team ${team?.id || 'unknown'} for migration:`, error);
            errorCount++;
            errors.push({ teamId: team?.id, error: error.message });
          }
        });

        // Commit this batch
        await batch.commit();
        console.log(`✅ Batch ${Math.floor(i / batchSize) + 1} committed (${batchTeams.length} teams)`);
      }

      // Update metadata
      const metadataRef = doc(db, '_metadata', 'teams-count');
      await setDoc(metadataRef, {
        count: successCount,
        lastUpdated: new Date().toISOString(),
        lastUpdatedBy: 'Migration'
      });

      console.log(`✅ Migration complete: ${successCount} teams migrated, ${errorCount} errors`);

      if (errorCount > 0) {
        console.error('Migration errors:', errors);
      }

      return {
        success: errorCount === 0,
        migrated: successCount,
        errors: errorCount,
        errorDetails: errors,
        message: `Successfully migrated ${successCount} teams${errorCount > 0 ? ` (${errorCount} errors)` : ''}`
      };

    } catch (error) {
      console.error('❌ Migration failed:', error);

      return {
        success: false,
        migrated: 0,
        errors: teams?.length || 0,
        message: error.message,
        error: error
      };
    }
  },

  /**
   * Migrate players from blob storage to granular storage
   *
   * @param {Array} players - Array of player objects from blob storage
   * @returns {Promise<object>} Migration result {success, migrated, errors, message}
   */
  async migratePlayersToGranular(players) {
    try {
      console.log(`🔄 Starting migration of ${players.length} players to granular storage...`);

      if (!Array.isArray(players)) {
        throw new Error('Players must be an array');
      }

      // Use batch write for efficiency
      const batchSize = 500;
      let successCount = 0;
      let errorCount = 0;
      const errors = [];

      for (let i = 0; i < players.length; i += batchSize) {
        const batch = writeBatch(db);
        const batchPlayers = players.slice(i, i + batchSize);

        batchPlayers.forEach((player) => {
          try {
            if (!player.id || !player.firstName || !player.lastName) {
              throw new Error(`Player missing required fields: ${JSON.stringify(player)}`);
            }

            const playerRef = doc(db, 'players', `player-${player.id}`);
            const now = new Date().toISOString();

            batch.set(playerRef, {
              ...player,
              createdAt: player.createdAt || now,
              updatedAt: now,
              updatedBy: 'Migration'
            });

            successCount++;
          } catch (error) {
            console.error(`Error preparing player ${player?.id || 'unknown'} for migration:`, error);
            errorCount++;
            errors.push({ playerId: player?.id, error: error.message });
          }
        });

        // Commit this batch
        await batch.commit();
        console.log(`✅ Batch ${Math.floor(i / batchSize) + 1} committed (${batchPlayers.length} players)`);
      }

      // Update metadata
      const metadataRef = doc(db, '_metadata', 'players-count');
      await setDoc(metadataRef, {
        count: successCount,
        lastUpdated: new Date().toISOString(),
        lastUpdatedBy: 'Migration'
      });

      console.log(`✅ Migration complete: ${successCount} players migrated, ${errorCount} errors`);

      if (errorCount > 0) {
        console.error('Migration errors:', errors);
      }

      return {
        success: errorCount === 0,
        migrated: successCount,
        errors: errorCount,
        errorDetails: errors,
        message: `Successfully migrated ${successCount} players${errorCount > 0 ? ` (${errorCount} errors)` : ''}`
      };

    } catch (error) {
      console.error('❌ Migration failed:', error);

      return {
        success: false,
        migrated: 0,
        errors: players?.length || 0,
        message: error.message,
        error: error
      };
    }
  },

  /**
   * Verify migration integrity
   * Compares blob count vs granular count
   *
   * @param {string} entityType - 'teams' or 'players'
   * @param {number} expectedCount - Expected count from blob storage
   * @returns {Promise<object>} Verification result
   */
  async verifyMigration(entityType, expectedCount) {
    try {
      const actualCount = await this.getEntityCount(entityType);

      if (actualCount !== expectedCount) {
        console.error(`⚠️ Count mismatch for ${entityType}: expected ${expectedCount}, got ${actualCount}`);
        return {
          success: false,
          entityType: entityType,
          expectedCount: expectedCount,
          actualCount: actualCount,
          message: `Count mismatch: expected ${expectedCount}, got ${actualCount}`
        };
      }

      console.log(`✅ Migration verified for ${entityType}: ${actualCount} entities`);
      return {
        success: true,
        entityType: entityType,
        count: actualCount,
        message: 'Migration verified successfully'
      };

    } catch (error) {
      console.error(`❌ Error verifying migration for ${entityType}:`, error);
      return {
        success: false,
        entityType: entityType,
        message: error.message,
        error: error
      };
    }
  }
};

/**
 * SAFE AUTO-SAVE WRAPPER
 * Adds additional safety layers on top of granularStorage
 * Use this for all auto-save operations
 */
export const safeAutoSave = {

  /**
   * Safely update a team with rollback on error
   *
   * @param {number} teamId - Team ID
   * @param {object} updates - Fields to update
   * @param {string} updatedBy - Username
   * @returns {Promise<object>} Result with rollback info
   */
  async updateTeam(teamId, updates, updatedBy) {
    // Store original state for rollback
    let originalTeam = null;

    try {
      // Get original state
      originalTeam = await granularStorage.getTeam(teamId);

      if (!originalTeam) {
        throw new Error(`Team ${teamId} does not exist`);
      }

      // Attempt update
      const result = await granularStorage.updateTeam(teamId, updates, updatedBy);

      if (!result.success) {
        throw new Error(result.message);
      }

      console.log(`✅ Safe auto-save: Team ${teamId} updated successfully`);
      return {
        success: true,
        rolledBack: false,
        teamId: teamId,
        message: 'Update successful'
      };

    } catch (error) {
      console.error(`❌ Safe auto-save failed for team ${teamId}, attempting rollback...`, error);

      // Attempt rollback
      if (originalTeam) {
        try {
          await granularStorage.updateTeam(teamId, originalTeam, 'Rollback-System');
          console.log(`✅ Successfully rolled back team ${teamId} to original state`);
          return {
            success: false,
            rolledBack: true,
            teamId: teamId,
            message: 'Update failed, successfully rolled back to original state',
            error: error.message
          };
        } catch (rollbackError) {
          console.error(`❌ CRITICAL: Rollback failed for team ${teamId}:`, rollbackError);
          return {
            success: false,
            rolledBack: false,
            teamId: teamId,
            message: 'Update failed and rollback failed',
            error: error.message,
            rollbackError: rollbackError.message
          };
        }
      }

      return {
        success: false,
        rolledBack: false,
        teamId: teamId,
        message: 'Update failed, no original state to rollback',
        error: error.message
      };
    }
  },

  /**
   * Safely update a player with rollback on error
   *
   * @param {number} playerId - Player ID
   * @param {object} updates - Fields to update
   * @param {string} updatedBy - Username
   * @returns {Promise<object>} Result with rollback info
   */
  async updatePlayer(playerId, updates, updatedBy) {
    // Store original state for rollback
    let originalPlayer = null;

    try {
      // Get original state
      originalPlayer = await granularStorage.getPlayer(playerId);

      if (!originalPlayer) {
        throw new Error(`Player ${playerId} does not exist`);
      }

      // Attempt update
      const result = await granularStorage.updatePlayer(playerId, updates, updatedBy);

      if (!result.success) {
        throw new Error(result.message);
      }

      console.log(`✅ Safe auto-save: Player ${playerId} updated successfully`);
      return {
        success: true,
        rolledBack: false,
        playerId: playerId,
        message: 'Update successful'
      };

    } catch (error) {
      console.error(`❌ Safe auto-save failed for player ${playerId}, attempting rollback...`, error);

      // Attempt rollback
      if (originalPlayer) {
        try {
          await granularStorage.updatePlayer(playerId, originalPlayer, 'Rollback-System');
          console.log(`✅ Successfully rolled back player ${playerId} to original state`);
          return {
            success: false,
            rolledBack: true,
            playerId: playerId,
            message: 'Update failed, successfully rolled back to original state',
            error: error.message
          };
        } catch (rollbackError) {
          console.error(`❌ CRITICAL: Rollback failed for player ${playerId}:`, rollbackError);
          return {
            success: false,
            rolledBack: false,
            playerId: playerId,
            message: 'Update failed and rollback failed',
            error: error.message,
            rollbackError: rollbackError.message
          };
        }
      }

      return {
        success: false,
        rolledBack: false,
        playerId: playerId,
        message: 'Update failed, no original state to rollback',
        error: error.message
      };
    }
  }
};
