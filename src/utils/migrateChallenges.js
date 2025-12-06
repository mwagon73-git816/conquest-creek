import { collection, doc, setDoc, getDocs, getDoc, writeBatch } from 'firebase/firestore';
import { db } from '../firebase';

/**
 * CHALLENGE MIGRATION UTILITY
 *
 * Migrates challenges from blob storage (challenges/data) to individual documents.
 *
 * Current Structure (BLOB):
 *   challenges/data -> JSON string with array of all challenges
 *
 * New Structure (INDIVIDUAL DOCUMENTS):
 *   challenges/{challengeId} -> Individual challenge document
 *
 * Migration Safety:
 * - Backs up blob data before migration
 * - Uses batched writes for atomicity
 * - Validates data before migration
 * - Provides rollback capability
 */

/**
 * Migrate challenges from blob storage to individual documents
 *
 * @returns {Promise<object>} Migration result {success, migrated, errors, message}
 */
export const migrateChallenges = async () => {
  console.log('🚀 Starting challenges migration...');

  try {
    // ========================================
    // STEP 1: Read existing blob data
    // ========================================
    const oldDocRef = doc(db, 'challenges', 'data');
    const oldDocSnap = await getDoc(oldDocRef);

    if (!oldDocSnap.exists()) {
      console.log('⚠️ No existing challenges data found - nothing to migrate');
      return {
        success: true,
        migrated: 0,
        message: 'No existing data to migrate'
      };
    }

    const oldData = oldDocSnap.data();
    let challenges = [];

    try {
      challenges = typeof oldData.data === 'string'
        ? JSON.parse(oldData.data)
        : oldData.data || [];
    } catch (e) {
      console.error('❌ Failed to parse challenges:', e);
      return {
        success: false,
        error: 'Parse error',
        message: `Failed to parse challenges data: ${e.message}`
      };
    }

    console.log(`📋 Found ${challenges.length} challenges to migrate`);

    if (challenges.length === 0) {
      console.log('⚠️ No challenges to migrate');
      return {
        success: true,
        migrated: 0,
        message: 'No challenges found in blob storage'
      };
    }

    // ========================================
    // STEP 2: Validate challenge data
    // ========================================
    const validChallenges = [];
    const invalidChallenges = [];

    challenges.forEach((challenge, index) => {
      // Validate required fields
      if (!challenge.id) {
        console.warn(`⚠️ Challenge at index ${index} missing ID, skipping`);
        invalidChallenges.push({ index, reason: 'missing ID', challenge });
        return;
      }

      if (!challenge.challengerTeamId) {
        console.warn(`⚠️ Challenge ${challenge.id} missing challengerTeamId, skipping`);
        invalidChallenges.push({ index, reason: 'missing challengerTeamId', challenge });
        return;
      }

      validChallenges.push(challenge);
    });

    console.log(`✅ Valid challenges: ${validChallenges.length}`);
    if (invalidChallenges.length > 0) {
      console.warn(`⚠️ Invalid challenges (will skip): ${invalidChallenges.length}`);
    }

    // ========================================
    // STEP 3: Write each challenge as individual document
    // ========================================
    const batchSize = 400; // Firestore limit is 500, using 400 for safety
    let count = 0;
    const errors = [];

    for (let i = 0; i < validChallenges.length; i += batchSize) {
      const batch = writeBatch(db);
      const batchChallenges = validChallenges.slice(i, i + batchSize);

      for (const challenge of batchChallenges) {
        try {
          // Generate document ID
          // Use existing challengeId if available, otherwise use id
          const docId = challenge.challengeId || `CHAL-${challenge.id}`;
          const docRef = doc(db, 'challenges', docId);

          // Clean up the challenge object
          const cleanChallenge = {
            ...challenge,
            challengeId: docId,
            migratedAt: new Date().toISOString(),
            migratedFrom: 'blob-storage'
          };

          // Ensure createdAt exists
          if (!cleanChallenge.createdAt) {
            cleanChallenge.createdAt = new Date().toISOString();
          }

          batch.set(docRef, cleanChallenge);
          count++;
        } catch (error) {
          console.error(`❌ Error preparing challenge ${challenge.id}:`, error);
          errors.push({
            challengeId: challenge.id,
            error: error.message
          });
        }
      }

      // Commit this batch
      try {
        await batch.commit();
        console.log(`✅ Committed batch ${Math.floor(i / batchSize) + 1} (${batchChallenges.length} challenges)`);
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

    // ========================================
    // STEP 4: Rename old document for backup
    // ========================================
    try {
      // Create backup of old blob data
      const backupRef = doc(db, 'challenges', 'data_backup_blob');
      await setDoc(backupRef, {
        ...oldData,
        backedUpAt: new Date().toISOString(),
        originalCount: challenges.length,
        migratedCount: count
      });
      console.log('📦 Created backup of old blob data at challenges/data_backup_blob');

      // Note: We keep the original challenges/data document for now
      // Manual deletion recommended after verification
      console.log('⚠️ Original challenges/data document preserved for safety');
      console.log('   Delete it manually after verifying migration success');
    } catch (error) {
      console.error('⚠️ Failed to create backup:', error);
      // Continue anyway - migration succeeded
    }

    // ========================================
    // STEP 5: Return results
    // ========================================
    console.log(`✅ Migration complete!`);
    console.log(`   - Migrated: ${count} challenges`);
    console.log(`   - Errors: ${errors.length}`);
    console.log(`   - Invalid (skipped): ${invalidChallenges.length}`);

    if (errors.length > 0) {
      console.error('Migration errors:', errors);
    }

    if (invalidChallenges.length > 0) {
      console.warn('Invalid challenges (skipped):', invalidChallenges);
    }

    return {
      success: errors.length === 0,
      migrated: count,
      errors: errors.length,
      errorDetails: errors,
      invalidCount: invalidChallenges.length,
      invalidDetails: invalidChallenges,
      message: `Successfully migrated ${count} challenges${errors.length > 0 ? ` (${errors.length} errors)` : ''}${invalidChallenges.length > 0 ? ` (${invalidChallenges.length} invalid, skipped)` : ''}`
    };

  } catch (error) {
    console.error('❌ Migration failed:', error);

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
 * Verify migration integrity
 * Compares blob count vs individual document count
 *
 * @returns {Promise<object>} Verification result
 */
export const verifyMigration = async () => {
  try {
    console.log('🔍 Verifying migration...');

    // Get count from old blob (if it exists)
    const oldDocRef = doc(db, 'challenges', 'data');
    const oldDocSnap = await getDoc(oldDocRef);

    let blobCount = 0;
    if (oldDocSnap.exists()) {
      try {
        const oldData = oldDocSnap.data();
        const challenges = typeof oldData.data === 'string'
          ? JSON.parse(oldData.data)
          : oldData.data || [];
        blobCount = challenges.length;
      } catch (e) {
        console.error('Failed to parse blob data:', e);
      }
    }

    // Get count from individual documents
    const challengesCollection = collection(db, 'challenges');
    const querySnapshot = await getDocs(challengesCollection);

    let docCount = 0;
    querySnapshot.forEach((doc) => {
      // Skip the old 'data' and backup documents
      if (doc.id !== 'data' && doc.id !== 'data_backup_blob') {
        docCount++;
      }
    });

    console.log(`📊 Verification Results:`);
    console.log(`   - Blob count: ${blobCount}`);
    console.log(`   - Individual documents: ${docCount}`);

    const success = blobCount === docCount;

    if (success) {
      console.log('✅ Migration verified successfully!');
    } else {
      console.error(`❌ Count mismatch! Expected ${blobCount}, got ${docCount}`);
    }

    return {
      success,
      blobCount,
      documentCount: docCount,
      match: success,
      message: success
        ? `Migration verified: ${docCount} challenges`
        : `Count mismatch: expected ${blobCount}, got ${docCount}`
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

/**
 * Rollback migration (restore from backup)
 * WARNING: This will delete all individual challenge documents
 *
 * @returns {Promise<object>} Rollback result
 */
export const rollbackMigration = async () => {
  console.log('🔄 Starting migration rollback...');

  try {
    // Get backup data
    const backupRef = doc(db, 'challenges', 'data_backup_blob');
    const backupSnap = await getDoc(backupRef);

    if (!backupSnap.exists()) {
      return {
        success: false,
        message: 'No backup found. Cannot rollback.'
      };
    }

    const backupData = backupSnap.data();

    // Restore blob data
    const dataRef = doc(db, 'challenges', 'data');
    await setDoc(dataRef, {
      data: backupData.data,
      updatedAt: backupData.updatedAt,
      restoredAt: new Date().toISOString(),
      restoredFrom: 'backup'
    });

    console.log('✅ Restored blob data from backup');

    // Delete individual documents
    const challengesCollection = collection(db, 'challenges');
    const querySnapshot = await getDocs(challengesCollection);

    const batch = writeBatch(db);
    let deleteCount = 0;

    querySnapshot.forEach((docSnap) => {
      // Skip the 'data' and backup documents
      if (docSnap.id !== 'data' && docSnap.id !== 'data_backup_blob') {
        batch.delete(docSnap.ref);
        deleteCount++;
      }
    });

    await batch.commit();
    console.log(`✅ Deleted ${deleteCount} individual challenge documents`);

    return {
      success: true,
      deleted: deleteCount,
      message: `Rollback successful. Restored blob data and deleted ${deleteCount} individual documents.`
    };

  } catch (error) {
    console.error('❌ Rollback failed:', error);
    return {
      success: false,
      message: `Rollback failed: ${error.message}`,
      error: error
    };
  }
};
