/**
 * Database Migration Script: Production → Development
 *
 * This script copies ALL data from the production Firebase database
 * to the development database, restoring the dev environment.
 *
 * Usage: node migrate-prod-to-dev.js
 *
 * IMPORTANT:
 * - Only READS from production (no modifications)
 * - OVERWRITES dev database (clears existing data first)
 * - Preserves all document IDs and timestamps
 * - Shows progress and verification
 */

import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, writeBatch, deleteDoc } from 'firebase/firestore';

// Production Firebase Config
const prodConfig = {
  apiKey: "AIzaSyAtptf9Inpq9E6jHGrn1q2y1Z0pjyvC8mU",
  authDomain: "conquest-of-the-creek.firebaseapp.com",
  projectId: "conquest-of-the-creek",
  storageBucket: "conquest-of-the-creek.firebasestorage.app",
  messagingSenderId: "353661688053",
  appId: "1:353661688053:web:91799d26f284c51034cdbc"
};

// Development Firebase Config
const devConfig = {
  apiKey: "AIzaSyANAhhvb1hlByD5ObPsF-6PRLavATm5W7M",
  authDomain: "conquest-of-the-creek-dev.firebaseapp.com",
  projectId: "conquest-of-the-creek-dev",
  storageBucket: "conquest-of-the-creek.firebasestorage.app",
  messagingSenderId: "288872913241",
  appId: "1:288872913241:web:01ab21e49581e282ed5448"
};

// Initialize both Firebase apps
console.log('🔧 Initializing Firebase connections...');
const prodApp = initializeApp(prodConfig, 'prod');
const devApp = initializeApp(devConfig, 'dev');

const prodDb = getFirestore(prodApp);
const devDb = getFirestore(devApp);

console.log('✅ Connected to both databases\n');

// Collections to migrate
const COLLECTIONS = [
  'teams',
  'players',
  'matches',
  'challenges',
  'captains',
  'bonuses',
  'photos',
  'activityLog',
  'tournamentData'  // Global config/settings
];

/**
 * Clear all documents from a collection in dev
 */
async function clearDevCollection(collectionName) {
  console.log(`  🧹 Clearing existing ${collectionName} in dev...`);

  try {
    const devSnapshot = await getDocs(collection(devDb, collectionName));

    if (devSnapshot.empty) {
      console.log(`     ℹ️  Collection ${collectionName} is already empty`);
      return 0;
    }

    // Delete in batches of 500 (Firestore batch limit)
    let deletedCount = 0;
    const batchSize = 500;

    for (let i = 0; i < devSnapshot.docs.length; i += batchSize) {
      const batch = writeBatch(devDb);
      const batchDocs = devSnapshot.docs.slice(i, i + batchSize);

      batchDocs.forEach(document => {
        batch.delete(doc(devDb, collectionName, document.id));
      });

      await batch.commit();
      deletedCount += batchDocs.length;
    }

    console.log(`     ✅ Cleared ${deletedCount} documents from ${collectionName}`);
    return deletedCount;
  } catch (error) {
    console.error(`     ❌ Error clearing ${collectionName}:`, error.message);
    throw error;
  }
}

/**
 * Migrate a single collection from prod to dev
 */
async function migrateCollection(collectionName) {
  console.log(`\n📦 Migrating collection: ${collectionName}`);
  console.log('─'.repeat(60));

  try {
    // Step 1: Read from production
    console.log(`  📖 Reading from production...`);
    const prodSnapshot = await getDocs(collection(prodDb, collectionName));
    const docCount = prodSnapshot.size;

    console.log(`     ✅ Found ${docCount} documents in production`);

    if (docCount === 0) {
      console.log(`     ℹ️  No documents to migrate`);
      return { migrated: 0, cleared: 0 };
    }

    // Step 2: Clear dev collection
    const clearedCount = await clearDevCollection(collectionName);

    // Step 3: Write to dev in batches
    console.log(`  💾 Writing to development...`);
    const batchSize = 500;
    let migratedCount = 0;

    for (let i = 0; i < prodSnapshot.docs.length; i += batchSize) {
      const batch = writeBatch(devDb);
      const batchDocs = prodSnapshot.docs.slice(i, i + batchSize);

      batchDocs.forEach(document => {
        const docRef = doc(devDb, collectionName, document.id);
        batch.set(docRef, document.data());
      });

      await batch.commit();
      migratedCount += batchDocs.length;

      // Show progress for large collections
      if (docCount > 100) {
        const progress = Math.round((migratedCount / docCount) * 100);
        console.log(`     ⏳ Progress: ${migratedCount}/${docCount} (${progress}%)`);
      }
    }

    console.log(`     ✅ Migrated ${migratedCount} documents`);

    // Step 4: Verify
    const devSnapshot = await getDocs(collection(devDb, collectionName));
    const verifyCount = devSnapshot.size;

    if (verifyCount === docCount) {
      console.log(`     ✅ Verification passed: ${verifyCount} documents in dev`);
    } else {
      console.log(`     ⚠️  WARNING: Count mismatch! Prod: ${docCount}, Dev: ${verifyCount}`);
    }

    return {
      migrated: migratedCount,
      cleared: clearedCount,
      verified: verifyCount === docCount
    };

  } catch (error) {
    console.error(`     ❌ Error migrating ${collectionName}:`, error.message);
    throw error;
  }
}

/**
 * Main migration function
 */
async function runMigration() {
  const startTime = Date.now();
  const results = {};
  let totalMigrated = 0;
  let totalCleared = 0;
  let errors = [];

  console.log('╔═══════════════════════════════════════════════════════════╗');
  console.log('║     CONQUEST OF THE CREEK - DATABASE MIGRATION           ║');
  console.log('║     Production → Development                              ║');
  console.log('╚═══════════════════════════════════════════════════════════╝\n');

  console.log('⚠️  WARNING: This will OVERWRITE the development database!');
  console.log('Source: conquest-of-the-creek (Production)');
  console.log('Target: conquest-of-the-creek-dev (Development)\n');

  // Migrate each collection
  for (const collectionName of COLLECTIONS) {
    try {
      const result = await migrateCollection(collectionName);
      results[collectionName] = result;
      totalMigrated += result.migrated;
      totalCleared += result.cleared;
    } catch (error) {
      console.error(`\n❌ FAILED to migrate ${collectionName}:`, error.message);
      errors.push({ collection: collectionName, error: error.message });
      results[collectionName] = { migrated: 0, cleared: 0, verified: false, error: error.message };
    }
  }

  // Summary
  const duration = ((Date.now() - startTime) / 1000).toFixed(2);

  console.log('\n');
  console.log('╔═══════════════════════════════════════════════════════════╗');
  console.log('║                   MIGRATION SUMMARY                       ║');
  console.log('╚═══════════════════════════════════════════════════════════╝\n');

  console.log('📊 Results by Collection:');
  console.log('─'.repeat(60));

  for (const [collectionName, result] of Object.entries(results)) {
    const status = result.error ? '❌ FAILED' : result.verified ? '✅ SUCCESS' : '⚠️  WARNING';
    console.log(`  ${status}  ${collectionName.padEnd(20)} ${result.migrated} docs migrated`);
  }

  console.log('─'.repeat(60));
  console.log(`  Total Documents Cleared:   ${totalCleared}`);
  console.log(`  Total Documents Migrated:  ${totalMigrated}`);
  console.log(`  Collections Processed:     ${COLLECTIONS.length}`);
  console.log(`  Errors:                    ${errors.length}`);
  console.log(`  Duration:                  ${duration}s\n`);

  if (errors.length > 0) {
    console.log('⚠️  ERRORS ENCOUNTERED:');
    errors.forEach(({ collection, error }) => {
      console.log(`  - ${collection}: ${error}`);
    });
    console.log('');
  }

  if (errors.length === 0) {
    console.log('🎉 MIGRATION COMPLETED SUCCESSFULLY!\n');
    console.log('✅ Development database has been fully restored from production');
    console.log('✅ All document IDs and timestamps preserved');
    console.log('✅ Ready for development/testing\n');
  } else {
    console.log('⚠️  MIGRATION COMPLETED WITH ERRORS\n');
    console.log('Please review the errors above and retry if necessary.\n');
  }

  // Detailed collection stats
  console.log('📋 Detailed Statistics:');
  console.log('─'.repeat(60));
  for (const [collectionName, result] of Object.entries(results)) {
    if (result.migrated > 0) {
      console.log(`  ${collectionName}:`);
      console.log(`    - Documents migrated: ${result.migrated}`);
      console.log(`    - Verified: ${result.verified ? 'Yes' : 'No'}`);
    }
  }
  console.log('');

  process.exit(errors.length > 0 ? 1 : 0);
}

// Run the migration
runMigration().catch(error => {
  console.error('\n💥 FATAL ERROR:', error);
  console.error('Stack trace:', error.stack);
  process.exit(1);
});
