import { collection, doc, setDoc, getDocs, getDoc, writeBatch, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { createPendingMatchFromChallenge } from '../services/matchService';

/**
 * MATCHES MIGRATION UTILITY
 *
 * Migrates matches from blob storage (matches/data) to individual documents.
 * Also creates pending matches from accepted challenges that don't have matches yet.
 */

/**
 * Migrate completed matches from blob storage to individual documents
 *
 * @returns {Promise<object>} Migration result
 */
export const migrateMatches = async () => {
  console.log('🚀 Starting matches migration...');

  try {
    // Read old blob data
    const oldDocRef = doc(db, 'matches', 'data');
    const oldDocSnap = await getDoc(oldDocRef);

    if (!oldDocSnap.exists()) {
      console.log('⚠️ No existing matches data found - nothing to migrate');
      return {
        success: true,
        migrated: 0,
        message: 'No existing data to migrate'
      };
    }

    const oldData = oldDocSnap.data();
    let matches = [];

    try {
      matches = typeof oldData.data === 'string'
        ? JSON.parse(oldData.data)
        : oldData.data || [];
    } catch (e) {
      console.error('❌ Failed to parse matches:', e);
      return {
        success: false,
        error: 'Parse error',
        message: `Failed to parse matches data: ${e.message}`
      };
    }

    console.log(`📋 Found ${matches.length} matches to migrate`);

    if (matches.length === 0) {
      return {
        success: true,
        migrated: 0,
        message: 'No matches found in blob storage'
      };
    }

    // Validate matches
    const validMatches = [];
    const invalidMatches = [];

    matches.forEach((match, index) => {
      if (!match.id && !match.matchId) {
        console.warn(`⚠️ Match at index ${index} missing ID, skipping`);
        invalidMatches.push({ index, reason: 'missing ID', match });
        return;
      }

      validMatches.push(match);
    });

    console.log(`✅ Valid matches: ${validMatches.length}`);
    if (invalidMatches.length > 0) {
      console.warn(`⚠️ Invalid matches (will skip): ${invalidMatches.length}`);
    }

    // Write each match as individual document
    const batchSize = 400;
    let count = 0;
    const errors = [];
    const usedDocIds = new Set(); // Track used document IDs to prevent duplicates

    for (let i = 0; i < validMatches.length; i += batchSize) {
      const batch = writeBatch(db);
      const batchMatches = validMatches.slice(i, i + batchSize);

      for (const match of batchMatches) {
        try {
          // Generate document ID with duplicate detection
          // Try to use match.matchId first, but if it's already used, fall back to unique id
          let docId;
          if (match.matchId && !usedDocIds.has(match.matchId)) {
            docId = match.matchId;
          } else {
            // Use original id to ensure uniqueness
            docId = `MATCH-${match.id}`;

            // If this is also taken (shouldn't happen), add timestamp
            if (usedDocIds.has(docId)) {
              docId = `MATCH-${match.id}-${Date.now()}`;
            }
          }

          usedDocIds.add(docId);
          const docRef = doc(db, 'matches', docId);

          // Clean up the match object
          const cleanMatch = {
            ...match,
            matchId: docId,
            originalMatchId: match.matchId !== docId ? match.matchId : undefined, // Preserve original if different
            status: match.status || 'completed', // Assume completed if no status
            migratedAt: new Date().toISOString(),
            migratedFrom: 'blob-storage'
          };

          // Ensure createdAt exists
          if (!cleanMatch.createdAt) {
            cleanMatch.createdAt = match.timestamp || new Date().toISOString();
          }

          batch.set(docRef, cleanMatch);
          count++;
        } catch (error) {
          console.error(`❌ Error preparing match ${match.id}:`, error);
          errors.push({
            matchId: match.id,
            error: error.message
          });
        }
      }

      // Commit this batch
      try {
        await batch.commit();
        console.log(`✅ Committed batch ${Math.floor(i / batchSize) + 1} (${batchMatches.length} matches)`);
      } catch (error) {
        console.error(`❌ Failed to commit batch:`, error);
        return {
          success: false,
          migrated: count,
          error: 'Batch commit failed',
          message: `Failed to commit batch: ${error.message}`
        };
      }
    }

    // Create backup
    try {
      const backupRef = doc(db, 'matches', 'data_backup_blob');
      await setDoc(backupRef, {
        ...oldData,
        backedUpAt: new Date().toISOString(),
        originalCount: matches.length,
        migratedCount: count
      });
      console.log('📦 Created backup of old blob data at matches/data_backup_blob');
    } catch (error) {
      console.error('⚠️ Failed to create backup:', error);
    }

    console.log(`✅ Matches migration complete!`);
    console.log(`   - Migrated: ${count} matches`);
    console.log(`   - Errors: ${errors.length}`);
    console.log(`   - Invalid (skipped): ${invalidMatches.length}`);

    return {
      success: errors.length === 0,
      migrated: count,
      errors: errors.length,
      errorDetails: errors,
      invalidCount: invalidMatches.length,
      message: `Successfully migrated ${count} matches${errors.length > 0 ? ` (${errors.length} errors)` : ''}${invalidMatches.length > 0 ? ` (${invalidMatches.length} invalid, skipped)` : ''}`
    };

  } catch (error) {
    console.error('❌ Matches migration failed:', error);

    return {
      success: false,
      migrated: 0,
      errors: 1,
      message: `Migration failed: ${error.message}`,
      error: error
    };
  }
};

/**
 * Create pending matches from accepted challenges that don't have matches yet
 *
 * @returns {Promise<object>} Migration result
 */
export const createPendingMatchesFromChallenges = async () => {
  console.log('🚀 Creating pending matches from accepted challenges...');

  try {
    // Get all challenges
    const challengesSnapshot = await getDocs(collection(db, 'challenges'));
    const acceptedChallenges = [];

    challengesSnapshot.forEach((doc) => {
      if (doc.id !== 'data' && doc.id !== 'data_backup_blob') {
        const challenge = doc.data();
        if (challenge.status === 'accepted') {
          acceptedChallenges.push({ id: doc.id, ...challenge });
        }
      }
    });

    console.log(`📋 Found ${acceptedChallenges.length} accepted challenges`);

    if (acceptedChallenges.length === 0) {
      return {
        success: true,
        created: 0,
        message: 'No accepted challenges found'
      };
    }

    // Get existing matches to check for duplicates
    const matchesSnapshot = await getDocs(collection(db, 'matches'));
    const existingMatchIds = new Set();
    const existingPendingByChallengeId = new Map();
    const existingCompletedByChallengeId = new Map();

    matchesSnapshot.forEach((doc) => {
      if (doc.id !== 'data' && doc.id !== 'data_backup_blob') {
        const match = doc.data();
        if (match.matchId) {
          existingMatchIds.add(match.matchId);
        }
        if (match.challengeId) {
          if (match.status === 'pending') {
            existingPendingByChallengeId.set(match.challengeId, doc.id);
          } else if (match.status === 'completed') {
            existingCompletedByChallengeId.set(match.challengeId, doc.id);
          }
        }
      }
    });

    console.log(`📋 Found ${existingMatchIds.size} existing matches`);
    console.log(`   - ${existingPendingByChallengeId.size} pending matches with challengeIds`);
    console.log(`   - ${existingCompletedByChallengeId.size} completed matches with challengeIds`);

    // Create pending matches for accepted challenges that don't have one
    let created = 0;
    let skippedPending = 0;
    let skippedCompleted = 0;
    const errors = [];

    for (const challenge of acceptedChallenges) {
      const challengeId = challenge.challengeId || challenge.id;

      // Skip if pending match already exists
      if (existingPendingByChallengeId.has(challengeId)) {
        console.log(`⏭️ Skipping ${challengeId} - pending match already exists`);
        skippedPending++;
        continue;
      }

      // Skip if completed match already exists (challenge was already played)
      if (existingCompletedByChallengeId.has(challengeId)) {
        console.log(`⏭️ Skipping ${challengeId} - completed match already exists (challenge was played)`);
        skippedCompleted++;
        continue;
      }

      // Skip if this challenge already has a matchId that exists
      if (challenge.matchId && existingMatchIds.has(challenge.matchId)) {
        console.log(`⏭️ Skipping ${challengeId} - matchId ${challenge.matchId} already exists`);
        skippedCompleted++;
        continue;
      }

      try {
        const result = await createPendingMatchFromChallenge(challenge);
        if (result.success) {
          created++;
          console.log(`✅ Created pending match for challenge ${challengeId}`);
        } else {
          errors.push({
            challengeId,
            error: result.message
          });
        }
      } catch (error) {
        console.error(`❌ Error creating pending match for challenge ${challengeId}:`, error);
        errors.push({
          challengeId,
          error: error.message
        });
      }
    }

    console.log(`✅ Pending matches creation complete!`);
    console.log(`   - Created: ${created} pending matches`);
    console.log(`   - Skipped (pending): ${skippedPending}`);
    console.log(`   - Skipped (completed): ${skippedCompleted}`);
    console.log(`   - Errors: ${errors.length}`);

    return {
      success: errors.length === 0,
      created,
      skippedPending,
      skippedCompleted,
      skipped: skippedPending + skippedCompleted,
      errors: errors.length,
      errorDetails: errors,
      message: `Created ${created} pending matches${skippedPending > 0 ? ` (skipped ${skippedPending} already pending)` : ''}${skippedCompleted > 0 ? ` (skipped ${skippedCompleted} already completed)` : ''}${errors.length > 0 ? ` (${errors.length} errors)` : ''}`
    };

  } catch (error) {
    console.error('❌ Pending matches creation failed:', error);

    return {
      success: false,
      created: 0,
      errors: 1,
      message: `Failed to create pending matches: ${error.message}`,
      error: error
    };
  }
};

/**
 * Force recreate pending matches from ALL accepted challenges
 * ONLY creates NEW matches - NEVER overwrites existing matches
 *
 * @returns {Promise<object>} Migration result
 */
export const forceRecreatePendingMatches = async () => {
  console.log('🚀 FORCE recreating pending matches from accepted challenges...');

  try {
    // Get all challenges
    const challengesSnapshot = await getDocs(collection(db, 'challenges'));
    const acceptedChallenges = [];

    challengesSnapshot.forEach((doc) => {
      if (doc.id !== 'data' && doc.id !== 'data_backup_blob') {
        const challenge = doc.data();
        if (challenge.status === 'accepted') {
          acceptedChallenges.push({ docId: doc.id, ...challenge });
        }
      }
    });

    console.log(`📋 Found ${acceptedChallenges.length} accepted challenges`);

    if (acceptedChallenges.length === 0) {
      return {
        success: true,
        created: 0,
        message: 'No accepted challenges found'
      };
    }

    // Get ALL existing matches and track which challengeIds already have matches
    const matchesSnapshot = await getDocs(collection(db, 'matches'));
    const existingMatchChallengeIds = new Set();

    matchesSnapshot.forEach((doc) => {
      if (doc.id !== 'data' && doc.id !== 'data_backup_blob') {
        const match = doc.data();
        if (match.challengeId) {
          existingMatchChallengeIds.add(match.challengeId);
          console.log(`   - Found existing match for challenge ${match.challengeId} (status: ${match.status})`);
        }
      }
    });

    console.log(`📋 Found ${existingMatchChallengeIds.size} challenges that already have matches`);

    // Create pending matches ONLY for challenges that have NO existing match
    let created = 0;
    let skipped = 0;
    const errors = [];

    for (const challenge of acceptedChallenges) {
      const challengeId = challenge.challengeId || challenge.id || challenge.docId;

      try {
        // Skip if ANY match (pending or completed) already exists for this challenge
        if (existingMatchChallengeIds.has(challengeId)) {
          console.log(`⏭️ Skipping ${challengeId} - match already exists`);
          skipped++;
          continue;
        }

        // Create NEW pending match with a unique ID that won't conflict
        const newMatchId = `MATCH-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

        const matchData = {
          matchId: newMatchId,
          challengeId,
          status: 'pending',
          team1Id: challenge.challengerTeamId,
          team2Id: challenge.challengedTeamId || challenge.acceptingTeamId,
          team1Players: challenge.challengerPlayers || [],
          team2Players: challenge.challengedPlayers || challenge.acceptingPlayers || [],
          matchType: challenge.matchType || 'doubles',
          level: challenge.acceptedLevel || challenge.proposedLevel,
          scheduledDate: challenge.acceptedDate || challenge.proposedDate,
          notes: challenge.notes || '',
          acceptNotes: challenge.acceptNotes || '',
          createdAt: new Date().toISOString(),
          createdFromChallenge: true,
          forceRecreated: true
        };

        // Use setDoc with the NEW match ID (not overwriting existing)
        await setDoc(doc(db, 'matches', newMatchId), matchData);

        // Track that this challenge now has a match
        existingMatchChallengeIds.add(challengeId);

        created++;
        console.log(`✅ Created pending match ${newMatchId} for challenge ${challengeId}`);
      } catch (error) {
        console.error(`❌ Error creating pending match for challenge ${challengeId}:`, error);
        errors.push({
          challengeId,
          error: error.message
        });
      }
    }

    console.log(`✅ FORCE pending matches creation complete!`);
    console.log(`   - Created: ${created} new pending matches`);
    console.log(`   - Skipped: ${skipped} (already have a match)`);
    console.log(`   - Errors: ${errors.length}`);

    return {
      success: errors.length === 0,
      created,
      skipped,
      errors: errors.length,
      errorDetails: errors,
      message: `Created ${created} new pending matches (skipped ${skipped} that already have matches)${errors.length > 0 ? ` (${errors.length} errors)` : ''}`
    };

  } catch (error) {
    console.error('❌ Force pending matches creation failed:', error);

    return {
      success: false,
      created: 0,
      errors: 1,
      message: `Failed to force create pending matches: ${error.message}`,
      error: error
    };
  }
};

/**
 * Re-migrate ALL matches from backup blob
 * (includes directly entered matches without challengeId)
 *
 * @returns {Promise<object>} Migration result
 */
export const reMigrateAllMatchesFromBackup = async () => {
  console.log('🚀 Re-migrating ALL matches from backup...');

  try {
    // Read backup blob data
    const backupDocRef = doc(db, 'matches', 'data_backup_blob');
    const backupDocSnap = await getDoc(backupDocRef);

    if (!backupDocSnap.exists()) {
      console.error('❌ No backup found at matches/data_backup_blob');
      return {
        success: false,
        message: 'No backup found at matches/data_backup_blob'
      };
    }

    let backupData = backupDocSnap.data().data;

    // Handle both string and object formats
    if (typeof backupData === 'string') {
      try {
        backupData = JSON.parse(backupData);
      } catch (e) {
        console.error('❌ Failed to parse backup data:', e);
        return {
          success: false,
          message: `Failed to parse backup data: ${e.message}`
        };
      }
    }

    // Handle array or object with matches property
    const matches = Array.isArray(backupData) ? backupData : (backupData.matches || backupData || []);

    if (!matches.length) {
      console.log('⚠️ No matches found in backup');
      return {
        success: true,
        created: 0,
        message: 'No matches found in backup'
      };
    }

    console.log(`📋 Found ${matches.length} matches in backup. Migrating...`);

    // Get existing migrated matches to avoid duplicates
    const existingSnapshot = await getDocs(collection(db, 'matches'));
    const existingMatchIds = new Set();
    const existingByOriginalId = new Map();

    existingSnapshot.forEach((doc) => {
      if (doc.id !== 'data' && doc.id !== 'data_backup_blob') {
        const data = doc.data();
        existingMatchIds.add(doc.id);

        // Track by original ID if different
        if (data.originalId) {
          existingByOriginalId.set(data.originalId.toString(), doc.id);
        }
        if (data.id) {
          existingByOriginalId.set(data.id.toString(), doc.id);
        }
      }
    });

    console.log(`📋 Found ${existingMatchIds.size} existing match documents`);

    // Migrate each match
    let created = 0;
    let skipped = 0;
    const errors = [];

    for (const match of matches) {
      try {
        // Check if already exists by original ID first
        if (match.id && existingByOriginalId.has(match.id.toString())) {
          console.log(`⏭️ Skipping match with original ID ${match.id} - already exists as ${existingByOriginalId.get(match.id.toString())}`);
          skipped++;
          continue;
        }

        // Generate document ID with duplicate detection
        let docId;
        if (match.matchId && !existingMatchIds.has(match.matchId)) {
          // Use match.matchId if available and not taken
          docId = match.matchId;
        } else if (match.id) {
          // Use original id to ensure uniqueness
          docId = `MATCH-${match.id}`;

          // If this is also taken (shouldn't happen after original ID check), add timestamp
          if (existingMatchIds.has(docId)) {
            docId = `MATCH-${match.id}-${Date.now()}`;
          }
        } else {
          // Last resort: generate with timestamp and counter
          docId = `MATCH-${Date.now()}-${created}`;
        }

        // Check if this docId exists (final safety check)
        if (existingMatchIds.has(docId)) {
          console.log(`⏭️ Skipping ${docId} - already exists`);
          skipped++;
          continue;
        }

        // Track this docId as used
        existingMatchIds.add(docId);
        if (match.id) {
          existingByOriginalId.set(match.id.toString(), docId);
        }

        // Determine status
        let status = match.status || 'completed';
        // If match has scores or winner, it's completed
        if (match.team1Sets !== undefined || match.team2Sets !== undefined || match.winner) {
          status = 'completed';
        }

        // Create the document
        const matchDoc = {
          ...match,
          matchId: docId,
          originalId: match.id,
          originalMatchId: match.matchId !== docId ? match.matchId : undefined, // Preserve original if different
          status: status,
          migratedAt: new Date().toISOString(),
          migratedFrom: 'backup_blob',
          reMigrated: true
        };

        // Ensure createdAt exists
        if (!matchDoc.createdAt) {
          matchDoc.createdAt = match.timestamp || match.date || new Date().toISOString();
        }

        await setDoc(doc(db, 'matches', docId), matchDoc);
        existingMatchIds.add(docId);
        if (match.id) {
          existingByOriginalId.set(match.id.toString(), docId);
        }

        created++;

        if (created % 10 === 0) {
          console.log(`✅ Migrated ${created} of ${matches.length} matches...`);
        }

      } catch (err) {
        console.error('❌ Error migrating match:', match, err);
        errors.push({
          matchId: match.id || match.matchId,
          error: err.message
        });
      }
    }

    console.log(`✅ Re-migration complete!`);
    console.log(`   - Total in backup: ${matches.length}`);
    console.log(`   - Created: ${created}`);
    console.log(`   - Skipped (already exist): ${skipped}`);
    console.log(`   - Errors: ${errors.length}`);

    return {
      success: errors.length === 0,
      total: matches.length,
      created,
      skipped,
      errors: errors.length,
      errorDetails: errors,
      message: `Re-migrated ${created} matches from backup (${skipped} already existed)${errors.length > 0 ? ` (${errors.length} errors)` : ''}`
    };

  } catch (error) {
    console.error('❌ Re-migration failed:', error);

    return {
      success: false,
      created: 0,
      errors: 1,
      message: `Failed to re-migrate from backup: ${error.message}`,
      error: error
    };
  }
};

/**
 * Full match migration - handles all scenarios correctly
 * 1. Accepted challenges → pending matches
 * 2. Completed challenges → completed matches
 * 3. Direct entry matches (no challengeId) → completed matches
 *
 * @returns {Promise<object>} Migration result
 */
export const fullMatchMigration = async () => {
  console.log('🚀 Starting full match migration...');

  try {
    // ========== STEP 1: Get all data ==========
    console.log('📋 Step 1: Loading all data...');

    // Get challenges
    const challengesSnap = await getDocs(collection(db, 'challenges'));
    const challenges = [];

    challengesSnap.forEach((doc) => {
      if (doc.id !== 'data' && doc.id !== 'data_backup_blob') {
        challenges.push({ docId: doc.id, ...doc.data() });
      }
    });

    const acceptedChallenges = challenges.filter(c => c.status === 'accepted');
    const completedChallenges = challenges.filter(c => c.status === 'completed');

    console.log(`   - Accepted challenges: ${acceptedChallenges.length}`);
    console.log(`   - Completed challenges: ${completedChallenges.length}`);

    // Get matches backup
    const backupDocRef = doc(db, 'matches', 'data_backup_blob');
    const backupDoc = await getDoc(backupDocRef);
    let backupMatches = [];

    if (backupDoc.exists()) {
      let data = backupDoc.data().data;
      if (typeof data === 'string') {
        try {
          data = JSON.parse(data);
        } catch (e) {
          console.error('Failed to parse backup:', e);
        }
      }
      backupMatches = Array.isArray(data) ? data : (data.matches || []);
    }

    console.log(`   - Backup matches: ${backupMatches.length}`);

    // Get existing migrated matches
    const existingSnap = await getDocs(collection(db, 'matches'));
    const existingByMatchId = new Map();
    const existingByChallengeId = new Map();

    existingSnap.forEach((doc) => {
      if (doc.id !== 'data' && doc.id !== 'data_backup_blob') {
        const data = doc.data();
        existingByMatchId.set(doc.id, data);
        if (data.challengeId) {
          existingByChallengeId.set(data.challengeId, { docId: doc.id, ...data });
        }
        // Also track by original ID
        if (data.originalId) {
          existingByMatchId.set(`MATCH-${data.originalId}`, data);
        }
        if (data.id) {
          existingByMatchId.set(`MATCH-${data.id}`, data);
        }
      }
    });

    console.log(`   - Already migrated: ${existingByMatchId.size}`);

    let createdPending = 0;
    let createdCompleted = 0;
    let skipped = 0;
    const errors = [];

    // ========== STEP 2: Create PENDING matches from ACCEPTED challenges ==========
    console.log('📋 Step 2: Creating pending matches from accepted challenges...');

    for (const challenge of acceptedChallenges) {
      const challengeId = challenge.challengeId || challenge.docId;

      // Check if pending match already exists
      const existing = existingByChallengeId.get(challengeId);
      if (existing && existing.status === 'pending') {
        console.log(`⏭️ Skipping ${challengeId} - pending match exists`);
        skipped++;
        continue;
      }

      // Check if completed match exists (challenge was already played)
      if (existing && existing.status === 'completed') {
        console.log(`⏭️ Skipping ${challengeId} - completed match exists`);
        skipped++;
        continue;
      }

      // Create pending match
      const matchId = challenge.matchId || `MATCH-PENDING-${Date.now()}-${createdPending}`;

      // Skip if this matchId already exists
      if (existingByMatchId.has(matchId)) {
        console.log(`⏭️ Skipping ${matchId} - matchId already exists`);
        skipped++;
        continue;
      }

      try {
        const pendingMatch = {
          matchId,
          challengeId,
          status: 'pending',
          team1Id: challenge.challengerTeamId,
          team2Id: challenge.challengedTeamId || challenge.acceptingTeamId,
          team1Players: challenge.challengerPlayers || [],
          team2Players: challenge.challengedPlayers || challenge.acceptingPlayers || [],
          matchType: challenge.matchType || 'doubles',
          level: challenge.acceptedLevel || challenge.proposedLevel,
          scheduledDate: challenge.acceptedDate || challenge.proposedDate,
          notes: challenge.notes || '',
          acceptNotes: challenge.acceptNotes || '',
          createdAt: new Date().toISOString(),
          createdFromChallenge: true,
          migratedAt: new Date().toISOString(),
          migratedFrom: 'full_migration'
        };

        await setDoc(doc(db, 'matches', matchId), pendingMatch);

        existingByChallengeId.set(challengeId, { status: 'pending' });
        existingByMatchId.set(matchId, pendingMatch);
        createdPending++;

        console.log(`✅ Created pending match ${matchId} for challenge ${challengeId}`);
      } catch (err) {
        console.error(`❌ Error creating pending match for ${challengeId}:`, err);
        errors.push({
          type: 'pending',
          challengeId,
          error: err.message
        });
      }
    }

    console.log(`✅ Created ${createdPending} pending matches`);

    // ========== STEP 3: Migrate COMPLETED matches from backup ==========
    console.log('📋 Step 3: Migrating completed matches from backup...');

    for (const match of backupMatches) {
      // Skip if this challenge already has a match
      if (match.challengeId && existingByChallengeId.has(match.challengeId)) {
        console.log(`⏭️ Skipping - challenge ${match.challengeId} already has match`);
        skipped++;
        continue;
      }

      // Generate document ID with duplicate detection
      let matchId;
      if (match.matchId && !existingByMatchId.has(match.matchId)) {
        // Use match.matchId if available and not taken
        matchId = match.matchId;
      } else if (match.id) {
        // Use original id to ensure uniqueness
        matchId = `MATCH-${match.id}`;

        // If this is also taken (check by id), add timestamp
        if (existingByMatchId.has(matchId)) {
          matchId = `MATCH-${match.id}-${Date.now()}`;
        }
      } else {
        // Last resort: generate with timestamp and counter
        matchId = `MATCH-${Date.now()}-${createdCompleted}`;
      }

      // Skip if already migrated (final safety check)
      if (existingByMatchId.has(matchId)) {
        console.log(`⏭️ Skipping ${matchId} - already exists`);
        skipped++;
        continue;
      }

      // Determine status - if it has scores or winner, it's completed
      let status = 'completed';
      if (match.status === 'pending' && !match.winner && match.team1Sets === undefined && match.team2Sets === undefined) {
        // This is actually a pending match from backup
        status = 'pending';
      }

      try {
        const matchDoc = {
          ...match,
          matchId,
          originalId: match.id,
          originalMatchId: match.matchId !== matchId ? match.matchId : undefined, // Preserve original if different
          status,
          migratedAt: new Date().toISOString(),
          migratedFrom: 'full_migration_backup'
        };

        // Ensure createdAt exists
        if (!matchDoc.createdAt) {
          matchDoc.createdAt = match.timestamp || match.date || new Date().toISOString();
        }

        await setDoc(doc(db, 'matches', matchId), matchDoc);

        if (status === 'completed') {
          createdCompleted++;
        } else {
          createdPending++;
        }

        existingByMatchId.set(matchId, matchDoc);
        if (match.challengeId) {
          existingByChallengeId.set(match.challengeId, { status });
        }

        console.log(`✅ Migrated ${status} match ${matchId}${match.challengeId ? ` (challenge ${match.challengeId})` : ' (direct entry)'}`);
      } catch (err) {
        console.error(`❌ Error migrating match ${matchId}:`, err);
        errors.push({
          type: 'backup',
          matchId,
          error: err.message
        });
      }
    }

    console.log(`✅ Full migration complete!`);
    console.log(`   - Pending matches created: ${createdPending}`);
    console.log(`   - Completed matches created: ${createdCompleted}`);
    console.log(`   - Skipped (duplicates): ${skipped}`);
    console.log(`   - Errors: ${errors.length}`);

    return {
      success: errors.length === 0,
      createdPending,
      createdCompleted,
      skipped,
      errors: errors.length,
      errorDetails: errors,
      acceptedChallenges: acceptedChallenges.length,
      backupMatches: backupMatches.length,
      message: `Full migration complete!\n` +
        `• Created ${createdPending} pending matches\n` +
        `• Created ${createdCompleted} completed matches\n` +
        `• Skipped ${skipped} duplicates\n` +
        `• Processed ${acceptedChallenges.length} accepted challenges\n` +
        `• Processed ${backupMatches.length} backup matches${errors.length > 0 ? `\n• ${errors.length} errors` : ''}`
    };

  } catch (error) {
    console.error('❌ Full migration failed:', error);

    return {
      success: false,
      createdPending: 0,
      createdCompleted: 0,
      errors: 1,
      message: `Failed to complete full migration: ${error.message}`,
      error: error
    };
  }
};

/**
 * Fix challengeId field - copy originChallengeId to challengeId for matches missing it
 *
 * @returns {Promise<object>} Fix result
 */
export const fixChallengeIdField = async () => {
  console.log('🚀 Fixing challengeId field in matches...');

  try {
    const matchesSnap = await getDocs(collection(db, 'matches'));
    let fixed = 0;
    let skipped = 0;
    let alreadyCorrect = 0;
    const errors = [];

    console.log(`📋 Found ${matchesSnap.docs.length} total documents`);

    for (const docSnap of matchesSnap.docs) {
      // Skip blob documents
      if (docSnap.id === 'data' || docSnap.id === 'data_backup_blob') {
        console.log(`⏭️ Skipping blob document: ${docSnap.id}`);
        skipped++;
        continue;
      }

      const data = docSnap.data();

      // If has originChallengeId but no challengeId, copy it
      if (data.originChallengeId && !data.challengeId) {
        try {
          await updateDoc(doc(db, 'matches', docSnap.id), {
            challengeId: data.originChallengeId
          });
          console.log(`✅ Fixed ${docSnap.id}: added challengeId = ${data.originChallengeId}`);
          fixed++;
        } catch (err) {
          console.error(`❌ Error fixing ${docSnap.id}:`, err);
          errors.push({
            matchId: docSnap.id,
            error: err.message
          });
        }
      } else if (data.challengeId) {
        // Already has challengeId
        alreadyCorrect++;
      } else {
        // No challengeId or originChallengeId (probably direct entry match)
        skipped++;
      }
    }

    console.log(`✅ Fix complete!`);
    console.log(`   - Fixed: ${fixed}`);
    console.log(`   - Already correct: ${alreadyCorrect}`);
    console.log(`   - Skipped: ${skipped}`);
    console.log(`   - Errors: ${errors.length}`);

    return {
      success: errors.length === 0,
      fixed,
      alreadyCorrect,
      skipped,
      errors: errors.length,
      errorDetails: errors,
      message: `Fixed ${fixed} matches\n` +
        `• Already correct: ${alreadyCorrect}\n` +
        `• Skipped: ${skipped} (no originChallengeId or already has challengeId)${errors.length > 0 ? `\n• Errors: ${errors.length}` : ''}`
    };

  } catch (error) {
    console.error('❌ Fix failed:', error);

    return {
      success: false,
      fixed: 0,
      errors: 1,
      message: `Failed to fix challengeId field: ${error.message}`,
      error: error
    };
  }
};

/**
 * Ensure all matches have createdAt field
 * Fixes matches that are missing createdAt (which causes them to be excluded from queries)
 *
 * @returns {Promise<object>} Fix result
 */
export const ensureCreatedAtField = async () => {
  console.log('🚀 Ensuring all matches have createdAt field...');

  try {
    const matchesSnap = await getDocs(collection(db, 'matches'));
    let fixed = 0;
    let alreadyCorrect = 0;
    let skipped = 0;
    const errors = [];

    console.log(`📋 Found ${matchesSnap.docs.length} total documents`);

    for (const docSnap of matchesSnap.docs) {
      // Skip blob documents
      if (docSnap.id === 'data' || docSnap.id === 'data_backup_blob') {
        console.log(`⏭️ Skipping blob document: ${docSnap.id}`);
        skipped++;
        continue;
      }

      const data = docSnap.data();

      // If already has createdAt, skip
      if (data.createdAt) {
        alreadyCorrect++;
        continue;
      }

      // Determine best fallback for createdAt
      let createdAt = null;

      // Priority order: date > completedAt > scheduledDate > timestamp > now
      if (data.date) {
        createdAt = data.date;
      } else if (data.completedAt) {
        createdAt = data.completedAt;
      } else if (data.scheduledDate) {
        createdAt = data.scheduledDate;
      } else if (data.timestamp) {
        createdAt = data.timestamp;
      } else {
        // Last resort: use current time
        createdAt = new Date().toISOString();
      }

      try {
        await updateDoc(doc(db, 'matches', docSnap.id), {
          createdAt
        });
        console.log(`✅ Fixed ${docSnap.id}: added createdAt = ${createdAt}`);
        fixed++;
      } catch (err) {
        console.error(`❌ Error fixing ${docSnap.id}:`, err);
        errors.push({
          matchId: docSnap.id,
          error: err.message
        });
      }
    }

    console.log(`✅ Fix complete!`);
    console.log(`   - Fixed: ${fixed}`);
    console.log(`   - Already correct: ${alreadyCorrect}`);
    console.log(`   - Skipped (blob docs): ${skipped}`);
    console.log(`   - Errors: ${errors.length}`);

    return {
      success: errors.length === 0,
      fixed,
      alreadyCorrect,
      skipped,
      errors: errors.length,
      errorDetails: errors,
      message: `Fixed ${fixed} matches\n` +
        `• Already had createdAt: ${alreadyCorrect}\n` +
        `• Skipped (blob docs): ${skipped}${errors.length > 0 ? `\n• Errors: ${errors.length}` : ''}`
    };

  } catch (error) {
    console.error('❌ Fix failed:', error);

    return {
      success: false,
      fixed: 0,
      errors: 1,
      message: `Failed to ensure createdAt field: ${error.message}`,
      error: error
    };
  }
};

/**
 * Verify matches migration
 *
 * @returns {Promise<object>} Verification result
 */
export const verifyMatchesMigration = async () => {
  try {
    console.log('🔍 Verifying matches migration...');

    // Get count from old blob
    const oldDocRef = doc(db, 'matches', 'data');
    const oldDocSnap = await getDoc(oldDocRef);

    let blobCount = 0;
    if (oldDocSnap.exists()) {
      try {
        const oldData = oldDocSnap.data();
        const matches = typeof oldData.data === 'string'
          ? JSON.parse(oldData.data)
          : oldData.data || [];
        blobCount = matches.length;
      } catch (e) {
        console.error('Failed to parse blob data:', e);
      }
    }

    // Get count from backup blob
    let backupCount = 0;
    try {
      const backupDocRef = doc(db, 'matches', 'data_backup_blob');
      const backupDocSnap = await getDoc(backupDocRef);

      if (backupDocSnap.exists()) {
        const backupData = backupDocSnap.data();
        let parsedBackup = typeof backupData.data === 'string'
          ? JSON.parse(backupData.data)
          : backupData.data || [];
        const backupMatches = Array.isArray(parsedBackup) ? parsedBackup : (parsedBackup.matches || parsedBackup || []);
        backupCount = backupMatches.length;
      }
    } catch (e) {
      console.error('Failed to parse backup data:', e);
    }

    // Get count from individual documents
    const matchesCollection = collection(db, 'matches');
    const querySnapshot = await getDocs(matchesCollection);

    let docCount = 0;
    let pendingCount = 0;
    let completedCount = 0;
    let withChallengeId = 0;
    let withoutChallengeId = 0;

    querySnapshot.forEach((doc) => {
      // Skip old blob documents
      if (doc.id !== 'data' && doc.id !== 'data_backup_blob') {
        const match = doc.data();
        docCount++;

        // Status breakdown
        if (match.status === 'pending') {
          pendingCount++;
        } else if (match.status === 'completed') {
          completedCount++;
        }

        // ChallengeId breakdown
        if (match.challengeId) {
          withChallengeId++;
        } else {
          withoutChallengeId++;
        }
      }
    });

    console.log(`📊 Verification Results:`);
    console.log(`   - Blob count: ${blobCount}`);
    console.log(`   - Backup count: ${backupCount}`);
    console.log(`   - Individual documents: ${docCount}`);
    console.log(`   - Pending matches: ${pendingCount}`);
    console.log(`   - Completed matches: ${completedCount}`);
    console.log(`   - With challengeId: ${withChallengeId}`);
    console.log(`   - Without challengeId (direct): ${withoutChallengeId}`);

    return {
      success: true,
      blobCount,
      backupCount,
      documentCount: docCount,
      pendingCount,
      completedCount,
      withChallengeId,
      withoutChallengeId,
      message: `Verification complete:\n` +
        `• Total: ${docCount} matches (${pendingCount} pending, ${completedCount} completed)\n` +
        `• With challengeId: ${withChallengeId}\n` +
        `• Without challengeId (direct): ${withoutChallengeId}\n` +
        `• Backup blob: ${backupCount} matches\n` +
        `• Original blob: ${blobCount} matches`
    };

  } catch (error) {
    console.error('❌ Verification failed:', error);
    return {
      success: false,
      message: `Verification failed: ${error.message}`,
      error: error
    };
  }
};
