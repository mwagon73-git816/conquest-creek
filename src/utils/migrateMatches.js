import { collection, doc, setDoc, getDocs, getDoc, writeBatch } from 'firebase/firestore';
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

    for (let i = 0; i < validMatches.length; i += batchSize) {
      const batch = writeBatch(db);
      const batchMatches = validMatches.slice(i, i + batchSize);

      for (const match of batchMatches) {
        try {
          // Generate document ID
          const docId = match.matchId || `MATCH-${match.id}`;
          const docRef = doc(db, 'matches', docId);

          // Clean up the match object
          const cleanMatch = {
            ...match,
            matchId: docId,
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
    const existingChallengeIds = new Set();

    matchesSnapshot.forEach((doc) => {
      if (doc.id !== 'data' && doc.id !== 'data_backup_blob') {
        const match = doc.data();
        if (match.matchId) {
          existingMatchIds.add(match.matchId);
        }
        if (match.challengeId) {
          existingChallengeIds.add(match.challengeId);
        }
      }
    });

    console.log(`📋 Found ${existingMatchIds.size} existing matches`);

    // Create pending matches for accepted challenges that don't have one
    let created = 0;
    let skipped = 0;
    const errors = [];

    for (const challenge of acceptedChallenges) {
      const challengeId = challenge.challengeId || challenge.id;

      // Skip if match already exists for this challenge
      if (existingChallengeIds.has(challengeId)) {
        console.log(`⏭️ Skipping ${challengeId} - match already exists`);
        skipped++;
        continue;
      }

      // Skip if this challenge already has a matchId that exists
      if (challenge.matchId && existingMatchIds.has(challenge.matchId)) {
        console.log(`⏭️ Skipping ${challengeId} - matchId ${challenge.matchId} already exists`);
        skipped++;
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
    console.log(`   - Skipped: ${skipped} (already have matches)`);
    console.log(`   - Errors: ${errors.length}`);

    return {
      success: errors.length === 0,
      created,
      skipped,
      errors: errors.length,
      errorDetails: errors,
      message: `Created ${created} pending matches${skipped > 0 ? ` (skipped ${skipped} that already exist)` : ''}${errors.length > 0 ? ` (${errors.length} errors)` : ''}`
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

    // Get count from individual documents
    const matchesCollection = collection(db, 'matches');
    const querySnapshot = await getDocs(matchesCollection);

    let docCount = 0;
    let pendingCount = 0;
    let completedCount = 0;

    querySnapshot.forEach((doc) => {
      // Skip old blob documents
      if (doc.id !== 'data' && doc.id !== 'data_backup_blob') {
        const match = doc.data();
        docCount++;
        if (match.status === 'pending') {
          pendingCount++;
        } else if (match.status === 'completed') {
          completedCount++;
        }
      }
    });

    console.log(`📊 Verification Results:`);
    console.log(`   - Blob count: ${blobCount}`);
    console.log(`   - Individual documents: ${docCount}`);
    console.log(`   - Pending matches: ${pendingCount}`);
    console.log(`   - Completed matches: ${completedCount}`);

    return {
      success: true,
      blobCount,
      documentCount: docCount,
      pendingCount,
      completedCount,
      message: `Verification complete: ${docCount} total matches (${pendingCount} pending, ${completedCount} completed)`
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
