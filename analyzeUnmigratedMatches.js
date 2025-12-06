/**
 * Analyze which matches from blob storage were not migrated to individual documents
 */

import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

// Firebase configuration
const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.VITE_FIREBASE_APP_ID
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

console.log('🔍 ANALYZING UNMIGRATED MATCHES FROM BLOB STORAGE');
console.log('═══════════════════════════════════════════════════════════\n');

async function analyzeUnmigratedMatches() {
  try {
    const matchesRef = collection(db, 'matches');
    const matchesSnap = await getDocs(matchesRef);

    // Get all migrated matches
    const migratedMatches = new Map(); // Key: matchId, Value: match data
    const migratedByOriginalId = new Map(); // Key: originalId, Value: match data

    console.log('📋 Step 1: Loading migrated matches from Firestore...\n');

    for (const doc of matchesSnap.docs) {
      const docId = doc.id;

      // Skip blob documents
      if (docId === 'data' || docId === 'data_backup_blob') {
        continue;
      }

      const data = doc.data();
      migratedMatches.set(docId, data);

      // Track by original ID if it exists
      if (data.originalId) {
        migratedByOriginalId.set(data.originalId.toString(), data);
      }
      if (data.id) {
        migratedByOriginalId.set(data.id.toString(), data);
      }
    }

    console.log(`✅ Found ${migratedMatches.size} migrated matches in Firestore\n`);

    // Get blob storage matches
    console.log('📋 Step 2: Loading matches from blob storage...\n');

    const blobDocRef = matchesSnap.docs.find(d => d.id === 'data');
    if (!blobDocRef) {
      console.log('❌ No blob storage document found!');
      return;
    }

    let blobMatches = [];
    try {
      let data = blobDocRef.data().data;
      if (typeof data === 'string') {
        data = JSON.parse(data);
      }
      blobMatches = Array.isArray(data) ? data : (data.matches || []);
    } catch (e) {
      console.error('❌ Failed to parse blob data:', e.message);
      return;
    }

    console.log(`✅ Found ${blobMatches.length} matches in blob storage\n`);

    // Compare and find unmigrated matches
    console.log('📋 Step 3: Comparing blob vs migrated matches...\n');
    console.log('═══════════════════════════════════════════════════════════\n');

    const unmigratedMatches = [];
    const migratedMatchesList = [];

    for (const match of blobMatches) {
      const matchId = match.matchId || `MATCH-${match.id}`;
      const originalId = match.id?.toString();

      // Check if this match was migrated
      const isMigratedByMatchId = migratedMatches.has(matchId);
      const isMigratedByOriginalId = originalId && migratedByOriginalId.has(originalId);
      const isMigrated = isMigratedByMatchId || isMigratedByOriginalId;

      if (!isMigrated) {
        unmigratedMatches.push(match);
      } else {
        migratedMatchesList.push({
          blob: match,
          migrated: isMigratedByMatchId ? migratedMatches.get(matchId) : migratedByOriginalId.get(originalId)
        });
      }
    }

    console.log(`📊 COMPARISON RESULTS:`);
    console.log(`   - Total in blob: ${blobMatches.length}`);
    console.log(`   - Migrated: ${migratedMatchesList.length}`);
    console.log(`   - NOT migrated: ${unmigratedMatches.length}`);
    console.log('');

    // Analyze unmigrated matches
    if (unmigratedMatches.length > 0) {
      console.log('❌ UNMIGRATED MATCHES FOUND:');
      console.log('═══════════════════════════════════════════════════════════\n');

      // Group by common characteristics
      const byStatus = new Map();
      const byMatchType = new Map();
      const missingId = [];
      const missingMatchId = [];
      const hasWinner = [];
      const noWinner = [];
      const hasSets = [];
      const noSets = [];
      const hasChallengeId = [];
      const noChallengeId = [];

      unmigratedMatches.forEach(match => {
        // Status
        const status = match.status || 'undefined';
        if (!byStatus.has(status)) byStatus.set(status, []);
        byStatus.get(status).push(match);

        // Match Type
        const matchType = match.matchType || 'undefined';
        if (!byMatchType.has(matchType)) byMatchType.set(matchType, []);
        byMatchType.get(matchType).push(match);

        // Other characteristics
        if (!match.id) missingId.push(match);
        if (!match.matchId) missingMatchId.push(match);
        if (match.winner) hasWinner.push(match);
        else noWinner.push(match);
        if (match.team1Sets !== undefined && match.team2Sets !== undefined) hasSets.push(match);
        else noSets.push(match);
        if (match.challengeId) hasChallengeId.push(match);
        else noChallengeId.push(match);
      });

      console.log('📊 UNMIGRATED MATCHES BREAKDOWN:\n');

      console.log(`By Status:`);
      for (const [status, matches] of byStatus.entries()) {
        console.log(`   - ${status}: ${matches.length} matches`);
      }
      console.log('');

      console.log(`By Match Type:`);
      for (const [type, matches] of byMatchType.entries()) {
        console.log(`   - ${type}: ${matches.length} matches`);
      }
      console.log('');

      console.log(`Field Analysis:`);
      console.log(`   - Missing 'id' field: ${missingId.length}`);
      console.log(`   - Missing 'matchId' field: ${missingMatchId.length}`);
      console.log(`   - Has 'winner' field: ${hasWinner.length}`);
      console.log(`   - Missing 'winner' field: ${noWinner.length}`);
      console.log(`   - Has score (team1Sets/team2Sets): ${hasSets.length}`);
      console.log(`   - Missing score: ${noSets.length}`);
      console.log(`   - Has challengeId: ${hasChallengeId.length}`);
      console.log(`   - No challengeId (direct entry): ${noChallengeId.length}`);
      console.log('\n');

      // List each unmigrated match
      console.log('📋 DETAILED LIST OF UNMIGRATED MATCHES:\n');
      console.log('═══════════════════════════════════════════════════════════\n');

      unmigratedMatches.forEach((match, idx) => {
        console.log(`[${idx + 1}] Match #${match.id || 'NO_ID'}`);
        console.log(`    matchId: ${match.matchId || 'MISSING'}`);
        console.log(`    status: ${match.status || 'undefined'}`);
        console.log(`    matchType: ${match.matchType || 'undefined'}`);
        console.log(`    team1Id: ${match.team1Id}`);
        console.log(`    team2Id: ${match.team2Id}`);
        console.log(`    date: ${match.date || match.timestamp || match.scheduledDate || 'NO_DATE'}`);
        console.log(`    challengeId: ${match.challengeId || 'none (direct entry)'}`);
        console.log(`    winner: ${match.winner || 'none'}`);
        console.log(`    score: ${match.team1Sets !== undefined ? `${match.team1Sets}-${match.team2Sets}` : 'no score'}`);
        console.log(`    createdAt: ${match.createdAt || 'MISSING'}`);

        // Analyze why it might have been skipped
        const reasons = [];
        if (!match.id && !match.matchId) reasons.push('Missing both id and matchId');
        if (!match.team1Id || !match.team2Id) reasons.push('Missing team IDs');
        if (!match.date && !match.timestamp && !match.scheduledDate && !match.createdAt) {
          reasons.push('Missing all date fields');
        }

        if (reasons.length > 0) {
          console.log(`    ⚠️  Potential skip reasons: ${reasons.join(', ')}`);
        }
        console.log('');
      });

      // Check the original migration code logic
      console.log('═══════════════════════════════════════════════════════════');
      console.log('🔍 ANALYSIS: Why were these matches skipped?\n');

      console.log('Migration code (migrateMatches.js lines 64-72) validates:');
      console.log('   ✓ Each match must have either "id" or "matchId" field');
      console.log('   ✓ Skips matches missing BOTH fields\n');

      const invalidMatches = unmigratedMatches.filter(m => !m.id && !m.matchId);
      if (invalidMatches.length > 0) {
        console.log(`❌ ${invalidMatches.length} matches were skipped due to missing ID:\n`);
        invalidMatches.forEach((match, idx) => {
          console.log(`   [${idx + 1}] Match with teams ${match.team1Id} vs ${match.team2Id}`);
          console.log(`       Date: ${match.date || 'unknown'}`);
          console.log(`       Match Type: ${match.matchType || 'undefined'}`);
        });
        console.log('');
      }

      const validButUnmigrated = unmigratedMatches.filter(m => m.id || m.matchId);
      if (validButUnmigrated.length > 0) {
        console.log(`⚠️  ${validButUnmigrated.length} matches SHOULD have been migrated but weren't:\n`);
        validButUnmigrated.forEach((match, idx) => {
          console.log(`   [${idx + 1}] Match ID: ${match.id || match.matchId}`);
          console.log(`       Teams: ${match.team1Id} vs ${match.team2Id}`);
          console.log(`       Date: ${match.date || match.timestamp || 'unknown'}`);
          console.log(`       Match Type: ${match.matchType || 'undefined'}`);
          console.log(`       Status: ${match.status || 'undefined'}`);
          console.log(`       Has all required fields: YES`);
          console.log(`       ❓ Mystery: This should have been migrated!`);
          console.log('');
        });
      }

    } else {
      console.log('✅ ALL MATCHES FROM BLOB STORAGE HAVE BEEN MIGRATED!\n');
    }

    // Check for matches in Firestore NOT in blob (added after migration)
    console.log('═══════════════════════════════════════════════════════════');
    console.log('📋 Step 4: Checking for NEW matches added after migration...\n');

    const blobMatchIds = new Set(blobMatches.map(m => (m.matchId || `MATCH-${m.id}`)));
    const blobOriginalIds = new Set(blobMatches.map(m => m.id?.toString()).filter(Boolean));

    let newMatchesAfterMigration = 0;
    for (const [matchId, match] of migratedMatches.entries()) {
      const inBlob = blobMatchIds.has(matchId) ||
                     (match.originalId && blobOriginalIds.has(match.originalId.toString())) ||
                     (match.id && blobOriginalIds.has(match.id.toString()));

      if (!inBlob && !match.migratedFrom) {
        newMatchesAfterMigration++;
        if (newMatchesAfterMigration <= 5) { // Show first 5
          console.log(`   New match: ${matchId}`);
          console.log(`      Created: ${match.createdAt || 'unknown'}`);
          console.log(`      Status: ${match.status}`);
          console.log(`      Type: ${match.matchType || 'undefined'}`);
          console.log('');
        }
      }
    }

    console.log(`Total new matches added after migration: ${newMatchesAfterMigration}\n`);

    console.log('═══════════════════════════════════════════════════════════');
    console.log('🏁 ANALYSIS COMPLETE\n');

    // Summary
    console.log('📊 FINAL SUMMARY:');
    console.log(`   Blob storage: ${blobMatches.length} matches`);
    console.log(`   Firestore: ${migratedMatches.size} matches`);
    console.log(`   Unmigrated from blob: ${unmigratedMatches.length}`);
    console.log(`   New matches after migration: ${newMatchesAfterMigration}`);
    console.log('');

    if (unmigratedMatches.length > 0) {
      console.log('⚠️  ACTION REQUIRED:');
      console.log('   Run the "Re-Migrate All from Backup" tool to migrate missing matches.');
      console.log('   This will create individual documents for all unmigrated matches.');
    } else {
      console.log('✅ No action needed - all blob matches have been migrated!');
    }

  } catch (error) {
    console.error('❌ Error analyzing matches:', error);
    process.exit(1);
  }
}

analyzeUnmigratedMatches().then(() => {
  console.log('\n✅ Script finished');
  process.exit(0);
}).catch(err => {
  console.error('❌ Script error:', err);
  process.exit(1);
});
