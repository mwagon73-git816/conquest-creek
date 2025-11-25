# Safe Auto-Save Implementation Guide
## Granular Document Storage with Bulletproof Safety

**Version:** 1.0
**Date:** 2025-01-24
**Status:** Implementation Ready

---

## 📋 TABLE OF CONTENTS

1. [Architecture Overview](#architecture-overview)
2. [Granular Storage Schema](#granular-storage-schema)
3. [Implementation Steps](#implementation-steps)
4. [Safety Mechanisms](#safety-mechanisms)
5. [Migration Strategy](#migration-strategy)
6. [Testing Plan](#testing-plan)
7. [Rollback Procedures](#rollback-procedures)

---

## 🏗️ ARCHITECTURE OVERVIEW

### Current System (Blob Storage)
```
Firestore:
  teams/data         → { data: "[...]", updatedAt: "..." }  ← ALL teams in one blob
  players/data       → { data: "[...]", updatedAt: "..." }  ← ALL players in one blob
  matches/data       → { data: "[...]", updatedAt: "..." }  ← ALL matches in one blob
```

**Problems:**
- ❌ Update one team → Must overwrite ALL teams
- ❌ Bug with empty array → Wipes entire database
- ❌ Poor conflict resolution
- ❌ No per-entity audit trail

### New System (Granular Storage)
```
Firestore:
  teams/
    team-{id}/       → { id, name, captainId, color, bonuses, updatedAt, updatedBy }

  players/
    player-{id}/     → { id, firstName, lastName, ntrpRating, teamId, updatedAt, updatedBy }

  matches/
    match-{id}/      → { id, date, team1Id, team2Id, winner, sets, games, updatedAt }

  _metadata/
    teams-count      → { count: 8, lastUpdated: "..." }
    players-count    → { count: 112, lastUpdated: "..." }
```

**Benefits:**
- ✅ Update one team → Only that team document changes
- ✅ Bug cannot affect other entities
- ✅ Excellent conflict resolution
- ✅ Complete audit trail per entity
- ✅ Real-time sync per entity
- ✅ Fast, efficient queries

---

## 📊 GRANULAR STORAGE SCHEMA

### Teams Collection Schema
```typescript
// Collection: 'teams'
// Document ID: 'team-{id}'
interface Team {
  id: number;                    // Unique team ID
  name: string;                  // Team name
  captainId: number | null;      // Captain ID (foreign key to captains)
  color: string;                 // Team color (hex)
  logo: string | null;           // Legacy base64 logo (deprecated)
  logoUrl: string | null;        // Firebase Storage URL
  logoStoragePath: string | null;// Storage path for logo
  logoUploadedAt: string | null; // Logo upload timestamp
  bonuses: {
    uniformType: 'none' | 'colors' | 'tops-bottoms' | 'custom';
    uniformPhotoSubmitted: boolean;
    practices: {
      [monthKey: string]: number; // e.g., '2025-11': 4
    };
  };
  createdAt: string;             // ISO timestamp
  updatedAt: string;             // ISO timestamp (Firestore serverTimestamp)
  updatedBy: string;             // Username who last updated
}
```

### Players Collection Schema
```typescript
// Collection: 'players'
// Document ID: 'player-{id}'
interface Player {
  id: number;                    // Unique player ID
  firstName: string;             // First name
  lastName: string;              // Last name
  gender: 'M' | 'F';            // Gender
  ntrpRating: number;            // NTRP rating (2.5-5.5)
  dynamicRating: number | null;  // Dynamic rating (optional)
  email: string;                 // Email
  phone: string;                 // Phone
  status: 'active' | 'injured' | 'inactive'; // Status
  teamId: number | null;         // Team ID (foreign key to teams)
  isCaptain: boolean;            // Is this player a captain?
  captainUsername: string;       // Captain login username
  captainPassword: string;       // Captain login password
  captainEmail: string;          // Captain email
  captainPhone: string;          // Captain phone
  createdAt: string;             // ISO timestamp
  updatedAt: string;             // ISO timestamp
  updatedBy: string;             // Username who last updated
}
```

### Matches Collection Schema
```typescript
// Collection: 'matches'
// Document ID: 'match-{id}'
interface Match {
  id: number;                    // Unique match ID
  matchId: string;               // Human-readable match ID (e.g., "M-001")
  matchType: string;             // "Doubles", "Singles", "Mixed"
  date: string;                  // Match date (ISO date string)
  level: string;                 // Match level
  team1Id: number;               // Team 1 ID
  team2Id: number;               // Team 2 ID
  team1Players: number[];        // Array of player IDs
  team2Players: number[];        // Array of player IDs
  winner: 'team1' | 'team2';     // Winner
  team1Sets: number;             // Sets won by team 1
  team2Sets: number;             // Sets won by team 2
  team1Games: number;            // Games won by team 1
  team2Games: number;            // Games won by team 2
  notes: string;                 // Match notes
  status: 'completed' | 'pending'; // Match status
  fromChallenge: boolean;        // Was this from a challenge?
  originChallengeId: number | null; // Challenge ID if from challenge
  createdAt: string;             // ISO timestamp
  updatedAt: string;             // ISO timestamp
  updatedBy: string;             // Username who last updated
}
```

### Metadata Collection Schema
```typescript
// Collection: '_metadata'
// Used for counts and validation
interface MetadataDocument {
  count: number;                 // Current entity count
  lastUpdated: string;           // Last update timestamp
  lastUpdatedBy: string;         // User who last updated
}
```

---

## 🔧 IMPLEMENTATION STEPS

### Step 1: Create Granular Storage Service
**File:** `src/services/granularStorage.js`

```javascript
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
 * Granular storage service for safe auto-save
 * Each entity is stored as a separate document
 */
export const granularStorage = {

  // ========================================
  // TEAMS OPERATIONS
  // ========================================

  /**
   * Get all teams (granular)
   * @returns {Promise<Array>} Array of team objects
   */
  async getAllTeams() {
    try {
      const teamsCollection = collection(db, 'teams');
      const querySnapshot = await getDocs(teamsCollection);

      const teams = [];
      querySnapshot.forEach((doc) => {
        teams.push({
          ...doc.data(),
          id: parseInt(doc.data().id) // Ensure ID is number
        });
      });

      // Sort by ID for consistency
      teams.sort((a, b) => a.id - b.id);

      return teams;
    } catch (error) {
      console.error('Error getting all teams:', error);
      throw error;
    }
  },

  /**
   * Get a single team by ID
   * @param {number} teamId - Team ID
   * @returns {Promise<object|null>} Team object or null
   */
  async getTeam(teamId) {
    try {
      const teamRef = doc(db, 'teams', `team-${teamId}`);
      const teamSnap = await getDoc(teamRef);

      if (teamSnap.exists()) {
        return {
          ...teamSnap.data(),
          id: parseInt(teamSnap.data().id)
        };
      }
      return null;
    } catch (error) {
      console.error(`Error getting team ${teamId}:`, error);
      throw error;
    }
  },

  /**
   * Update a single team (SAFE - cannot affect other teams)
   * @param {number} teamId - Team ID
   * @param {object} updates - Fields to update
   * @param {string} updatedBy - Username of person making update
   * @returns {Promise<object>} Result object
   */
  async updateTeam(teamId, updates, updatedBy = 'System') {
    try {
      // Validation: Ensure teamId is provided
      if (!teamId) {
        throw new Error('Team ID is required');
      }

      // Validation: Ensure updates object is provided
      if (!updates || typeof updates !== 'object') {
        throw new Error('Updates object is required');
      }

      // Validation: Check for dangerous fields
      if (updates.id !== undefined && updates.id !== teamId) {
        throw new Error('Cannot change team ID');
      }

      const teamRef = doc(db, 'teams', `team-${teamId}`);

      // Check if team exists
      const teamSnap = await getDoc(teamRef);
      if (!teamSnap.exists()) {
        throw new Error(`Team ${teamId} does not exist`);
      }

      // Prepare update data
      const updateData = {
        ...updates,
        id: teamId, // Ensure ID stays correct
        updatedAt: serverTimestamp(),
        updatedBy: updatedBy
      };

      // Update the document
      await updateDoc(teamRef, updateData);

      console.log(`✅ Team ${teamId} updated successfully`);

      return {
        success: true,
        teamId: teamId,
        message: 'Team updated successfully'
      };
    } catch (error) {
      console.error(`❌ Error updating team ${teamId}:`, error);
      return {
        success: false,
        teamId: teamId,
        message: error.message,
        error: error
      };
    }
  },

  /**
   * Create a new team
   * @param {object} teamData - Team data
   * @param {string} createdBy - Username of person creating team
   * @returns {Promise<object>} Result object
   */
  async createTeam(teamData, createdBy = 'System') {
    try {
      // Validation: Ensure teamData has required fields
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
      const teamDoc = {
        ...teamData,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
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
        message: 'Team created successfully'
      };
    } catch (error) {
      console.error(`❌ Error creating team:`, error);
      return {
        success: false,
        message: error.message,
        error: error
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
        message: 'Team deleted successfully'
      };
    } catch (error) {
      console.error(`❌ Error deleting team ${teamId}:`, error);
      return {
        success: false,
        message: error.message,
        error: error
      };
    }
  },

  // ========================================
  // PLAYERS OPERATIONS
  // ========================================

  /**
   * Get all players (granular)
   * @returns {Promise<Array>} Array of player objects
   */
  async getAllPlayers() {
    try {
      const playersCollection = collection(db, 'players');
      const querySnapshot = await getDocs(playersCollection);

      const players = [];
      querySnapshot.forEach((doc) => {
        players.push({
          ...doc.data(),
          id: parseInt(doc.data().id)
        });
      });

      // Sort by ID
      players.sort((a, b) => a.id - b.id);

      return players;
    } catch (error) {
      console.error('Error getting all players:', error);
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
      const playerRef = doc(db, 'players', `player-${playerId}`);
      const playerSnap = await getDoc(playerRef);

      if (playerSnap.exists()) {
        return {
          ...playerSnap.data(),
          id: parseInt(playerSnap.data().id)
        };
      }
      return null;
    } catch (error) {
      console.error(`Error getting player ${playerId}:`, error);
      throw error;
    }
  },

  /**
   * Update a single player (SAFE - cannot affect other players)
   * @param {number} playerId - Player ID
   * @param {object} updates - Fields to update
   * @param {string} updatedBy - Username of person making update
   * @returns {Promise<object>} Result object
   */
  async updatePlayer(playerId, updates, updatedBy = 'System') {
    try {
      // Validation
      if (!playerId) {
        throw new Error('Player ID is required');
      }

      if (!updates || typeof updates !== 'object') {
        throw new Error('Updates object is required');
      }

      if (updates.id !== undefined && updates.id !== playerId) {
        throw new Error('Cannot change player ID');
      }

      const playerRef = doc(db, 'players', `player-${playerId}`);

      // Check if player exists
      const playerSnap = await getDoc(playerRef);
      if (!playerSnap.exists()) {
        throw new Error(`Player ${playerId} does not exist`);
      }

      // Prepare update data
      const updateData = {
        ...updates,
        id: playerId,
        updatedAt: serverTimestamp(),
        updatedBy: updatedBy
      };

      // Update the document
      await updateDoc(playerRef, updateData);

      console.log(`✅ Player ${playerId} updated successfully`);

      return {
        success: true,
        playerId: playerId,
        message: 'Player updated successfully'
      };
    } catch (error) {
      console.error(`❌ Error updating player ${playerId}:`, error);
      return {
        success: false,
        playerId: playerId,
        message: error.message,
        error: error
      };
    }
  },

  /**
   * Create a new player
   * @param {object} playerData - Player data
   * @param {string} createdBy - Username of person creating player
   * @returns {Promise<object>} Result object
   */
  async createPlayer(playerData, createdBy = 'System') {
    try {
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
      const playerDoc = {
        ...playerData,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
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
        message: 'Player created successfully'
      };
    } catch (error) {
      console.error(`❌ Error creating player:`, error);
      return {
        success: false,
        message: error.message,
        error: error
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
        message: 'Player deleted successfully'
      };
    } catch (error) {
      console.error(`❌ Error deleting player ${playerId}:`, error);
      return {
        success: false,
        message: error.message,
        error: error
      };
    }
  },

  // ========================================
  // METADATA OPERATIONS
  // ========================================

  /**
   * Get entity count from metadata
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
   * @param {Array} teams - Array of team objects
   * @returns {Promise<object>} Migration result
   */
  async migrateTeamsToGranular(teams) {
    try {
      console.log(`🔄 Starting migration of ${teams.length} teams...`);

      const batch = writeBatch(db);
      let successCount = 0;
      let errorCount = 0;

      teams.forEach((team) => {
        try {
          const teamRef = doc(db, 'teams', `team-${team.id}`);
          batch.set(teamRef, {
            ...team,
            createdAt: team.createdAt || new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            updatedBy: 'Migration'
          });
          successCount++;
        } catch (error) {
          console.error(`Error preparing team ${team.id} for migration:`, error);
          errorCount++;
        }
      });

      // Commit the batch
      await batch.commit();

      // Update metadata
      const metadataRef = doc(db, '_metadata', 'teams-count');
      await setDoc(metadataRef, {
        count: successCount,
        lastUpdated: new Date().toISOString(),
        lastUpdatedBy: 'Migration'
      });

      console.log(`✅ Migration complete: ${successCount} teams migrated, ${errorCount} errors`);

      return {
        success: true,
        migrated: successCount,
        errors: errorCount,
        message: `Successfully migrated ${successCount} teams`
      };
    } catch (error) {
      console.error('❌ Migration failed:', error);
      return {
        success: false,
        migrated: 0,
        errors: teams.length,
        message: error.message,
        error: error
      };
    }
  },

  /**
   * Migrate players from blob storage to granular storage
   * @param {Array} players - Array of player objects
   * @returns {Promise<object>} Migration result
   */
  async migratePlayersToGranular(players) {
    try {
      console.log(`🔄 Starting migration of ${players.length} players...`);

      const batch = writeBatch(db);
      let successCount = 0;
      let errorCount = 0;

      players.forEach((player) => {
        try {
          const playerRef = doc(db, 'players', `player-${player.id}`);
          batch.set(playerRef, {
            ...player,
            createdAt: player.createdAt || new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            updatedBy: 'Migration'
          });
          successCount++;
        } catch (error) {
          console.error(`Error preparing player ${player.id} for migration:`, error);
          errorCount++;
        }
      });

      // Commit the batch
      await batch.commit();

      // Update metadata
      const metadataRef = doc(db, '_metadata', 'players-count');
      await setDoc(metadataRef, {
        count: successCount,
        lastUpdated: new Date().toISOString(),
        lastUpdatedBy: 'Migration'
      });

      console.log(`✅ Migration complete: ${successCount} players migrated, ${errorCount} errors`);

      return {
        success: true,
        migrated: successCount,
        errors: errorCount,
        message: `Successfully migrated ${successCount} players`
      };
    } catch (error) {
      console.error('❌ Migration failed:', error);
      return {
        success: false,
        migrated: 0,
        errors: players.length,
        message: error.message,
        error: error
      };
    }
  }
};
```

---

## 🛡️ SAFETY MECHANISMS

### 1. Validation Layer
```javascript
/**
 * Comprehensive validation before any save operation
 */
const validateBeforeSave = (entityType, entityId, updates) => {
  const errors = [];

  // Check 1: Entity ID is valid
  if (!entityId || typeof entityId !== 'number') {
    errors.push(`Invalid ${entityType} ID: ${entityId}`);
  }

  // Check 2: Updates object exists
  if (!updates || typeof updates !== 'object') {
    errors.push('Updates object is missing or invalid');
  }

  // Check 3: Cannot change ID
  if (updates.id !== undefined && updates.id !== entityId) {
    errors.push('Cannot change entity ID');
  }

  // Check 4: Required fields for specific entities
  if (entityType === 'team' && updates.name !== undefined) {
    if (!updates.name || updates.name.trim().length === 0) {
      errors.push('Team name cannot be empty');
    }
  }

  if (entityType === 'player' && updates.ntrpRating !== undefined) {
    if (updates.ntrpRating < 2.5 || updates.ntrpRating > 5.5) {
      errors.push('NTRP rating must be between 2.5 and 5.5');
    }
  }

  return {
    valid: errors.length === 0,
    errors: errors
  };
};
```

### 2. Rollback Mechanism
```javascript
/**
 * Auto-rollback on error
 */
const safeUpdate = async (entityType, entityId, updates, updatedBy) => {
  // Store original state
  const originalData = await granularStorage[`get${entityType}`](entityId);

  try {
    // Attempt update
    const result = await granularStorage[`update${entityType}`](entityId, updates, updatedBy);

    if (!result.success) {
      throw new Error(result.message);
    }

    return { success: true, rolledBack: false };
  } catch (error) {
    console.error('Update failed, rolling back:', error);

    // Rollback to original state
    try {
      await granularStorage[`update${entityType}`](entityId, originalData, 'Rollback');
      console.log('✅ Successfully rolled back to original state');
      return { success: false, rolledBack: true, error: error.message };
    } catch (rollbackError) {
      console.error('❌ CRITICAL: Rollback failed:', rollbackError);
      return { success: false, rolledBack: false, error: error.message, rollbackError: rollbackError.message };
    }
  }
};
```

### 3. Conflict Detection
```javascript
/**
 * Detect if entity was modified by another user
 */
const checkForConflicts = async (entityType, entityId, expectedUpdatedAt) => {
  const currentData = await granularStorage[`get${entityType}`](entityId);

  if (!currentData) {
    return {
      hasConflict: true,
      message: 'Entity no longer exists'
    };
  }

  if (currentData.updatedAt !== expectedUpdatedAt) {
    return {
      hasConflict: true,
      message: `This ${entityType} was modified by ${currentData.updatedBy} at ${currentData.updatedAt}`,
      currentData: currentData
    };
  }

  return {
    hasConflict: false
  };
};
```

### 4. Comprehensive Logging
```javascript
/**
 * Log all auto-save operations
 */
const logAutoSave = async (operation, entityType, entityId, updates, result) => {
  const logEntry = {
    timestamp: new Date().toISOString(),
    operation: operation,
    entityType: entityType,
    entityId: entityId,
    updates: updates,
    result: result.success ? 'success' : 'failure',
    error: result.error || null,
    rolledBack: result.rolledBack || false
  };

  console.log('📝 AUTO-SAVE LOG:', logEntry);

  // Also log to Firestore activity logs
  await tournamentStorage.addActivityLog({
    action: 'auto_save',
    actionCategory: 'auto_save',
    entityType: entityType,
    entityId: entityId,
    user: result.updatedBy || 'System',
    userRole: 'unknown',
    timestamp: logEntry.timestamp,
    details: logEntry,
    metadata: {}
  });
};
```

---

## 🔄 MIGRATION STRATEGY

### Phase 1: Dual-Write System (Week 1)
```javascript
/**
 * Write to BOTH blob and granular storage
 * Read from blob only
 */
const dualWriteUpdate = async (teamId, updates, updatedBy) => {
  // Write to blob storage (existing system)
  const blobResult = await tournamentStorage.setTeams(
    JSON.stringify(teams.map(t => t.id === teamId ? {...t, ...updates} : t))
  );

  // Write to granular storage (new system)
  const granularResult = await granularStorage.updateTeam(teamId, updates, updatedBy);

  // Log if results don't match
  if (blobResult.success !== granularResult.success) {
    console.error('⚠️ Dual-write mismatch:', { blobResult, granularResult });
  }

  // Return blob result for now (existing system)
  return blobResult;
};
```

### Phase 2: Migration Script
```javascript
/**
 * Migrate all data from blob to granular
 */
const migrateAllData = async () => {
  console.log('🔄 Starting full migration...');

  // 1. Migrate teams
  const teamsBlob = await tournamentStorage.getTeams();
  const teams = JSON.parse(teamsBlob.data);
  const teamsResult = await granularStorage.migrateTeamsToGranular(teams);
  console.log('Teams migration:', teamsResult);

  // 2. Migrate players
  const playersBlob = await tournamentStorage.getPlayers();
  const players = JSON.parse(playersBlob.data);
  const playersResult = await granularStorage.migratePlayersToGranular(players);
  console.log('Players migration:', playersResult);

  // 3. Verify counts match
  const blobTeamsCount = teams.length;
  const granularTeamsCount = await granularStorage.getEntityCount('teams');

  if (blobTeamsCount !== granularTeamsCount) {
    throw new Error(`Team count mismatch: blob=${blobTeamsCount}, granular=${granularTeamsCount}`);
  }

  console.log('✅ Migration complete and verified!');

  return {
    success: true,
    teamsCount: granularTeamsCount,
    playersCount: await granularStorage.getEntityCount('players')
  };
};
```

### Phase 3: Switch to Granular Reads
```javascript
/**
 * Read from granular storage instead of blob
 */
const loadTeams = async () => {
  // Old (blob storage)
  // const teamsBlob = await tournamentStorage.getTeams();
  // const teams = JSON.parse(teamsBlob.data);

  // New (granular storage)
  const teams = await granularStorage.getAllTeams();

  return teams;
};
```

### Phase 4: Deprecate Blob Storage
```javascript
/**
 * Stop writing to blob storage
 * Use granular storage only
 */
const updateTeam = async (teamId, updates, updatedBy) => {
  // No longer write to blob
  // const blobResult = await tournamentStorage.setTeams(...);

  // Only write to granular
  const result = await granularStorage.updateTeam(teamId, updates, updatedBy);

  return result;
};
```

---

## ✅ SUCCESS CRITERIA

- [ ] **Cannot Wipe Database**: Code bug cannot delete more than one entity
- [ ] **Atomic Updates**: Each update is isolated and transactional
- [ ] **Conflict Detection**: Detect when entity was modified by another user
- [ ] **Rollback on Error**: Auto-revert failed updates
- [ ] **Comprehensive Validation**: Multiple layers of safety checks
- [ ] **Audit Trail**: Log all changes with timestamps
- [ ] **Performance**: No degradation vs blob storage
- [ ] **Testing**: Extensive testing proves no data loss possible
- [ ] **Monitoring**: Log all auto-save operations

---

**Status:** Ready to implement
**Next Step:** Create `granularStorage.js` service
**Timeline:** 4 weeks (1 week per phase)
**Priority:** CRITICAL
