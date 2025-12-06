/**
 * Migrate the 5 unmigrated matches that were skipped due to duplicate matchIds
 */

import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, setDoc } from 'firebase/firestore';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.VITE_FIREBASE_APP_ID
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// The 5 unmigrated matches (identified by their blob storage id)
const UNMIGRATED_IDS = [
  1763825713554, // singles: Brace for Impact vs Balls Deep
  1763932104557, // doubles
  1764045834790, // doubles
  1764158275115, // doubles
  1764991196051  // doubles (pending)
];

console.log('🔧 MIGRATING MISSING MATCHES');
console.log('═══════════════════════════════════════════════════════════\n');
console.log(`Target: ${UNMIGRATED_IDS.length} unmigrated matches\n`);

async function migrateMissingMatches() {
  try {
    // Get blob storage
    const matchesRef = collection(db, 'matches');
    const snapshot = await getDocs(matchesRef);

    const blobDoc = snapshot.docs.find(d => d.id === 'data');
    if (!blobDoc) {
      console.log('❌ No blob storage found');
      return;
    }

    let blobData = blobDoc.data().data;
    if (typeof blobData === 'string') {
      blobData = JSON.parse(blobData);
    }
    const blobMatches = Array.isArray(blobData) ? blobData : (blobData.matches || []);

    console.log('📋 Step 1: Finding unmigrated matches in blob storage...\n');

    const matchesToMigrate = [];
    for (const id of UNMIGRATED_IDS) {
      const match = blobMatches.find(m => m.id === id);
      if (match) {
        matchesToMigrate.push(match);
        console.log(`   ✓ Found match ${id}: ${match.matchType || 'undefined'} (${match.team1Id} vs ${match.team2Id})`);
      } else {
        console.log(`   ✗ Match ${id} not found in blob storage`);
      }
    }

    console.log(`\n   Total matches found: ${matchesToMigrate.length}\n`);

    if (matchesToMigrate.length === 0) {
      console.log('❌ No matches to migrate');
      return;
    }

    console.log('📋 Step 2: Migrating matches with unique document IDs...\n');

    let migrated = 0;
    const errors = [];

    for (const match of matchesToMigrate) {
      try {
        // Generate unique document ID using the original id
        // This ensures no collision with existing matchId-based documents
        const uniqueDocId = `MATCH-${match.id}`;

        console.log(`\n   Migrating match ${match.id}...`);
        console.log(`   → Document ID: ${uniqueDocId}`);

        // Prepare match document
        const matchDoc = {
          ...match,
          matchId: uniqueDocId, // Override matchId to match document ID
          originalId: match.id,
          originalMatchId: match.matchId, // Preserve the original duplicate matchId
          status: match.status || 'completed', // Default to completed if undefined
          migratedAt: new Date().toISOString(),
          migratedFrom: 'duplicate-fix-script',
          migratedReason: 'Skipped during original migration due to duplicate matchId'
        };

        // Ensure createdAt exists
        if (!matchDoc.createdAt) {
          matchDoc.createdAt = match.date || match.timestamp || new Date().toISOString();
        }

        // Create the document
        await setDoc(doc(db, 'matches', uniqueDocId), matchDoc);

        migrated++;
        console.log(`   ✅ Successfully migrated as ${uniqueDocId}`);
        console.log(`      - Match Type: ${matchDoc.matchType || 'undefined'}`);
        console.log(`      - Status: ${matchDoc.status}`);
        console.log(`      - Teams: ${matchDoc.team1Id} vs ${matchDoc.team2Id}`);
        console.log(`      - Date: ${matchDoc.date || matchDoc.scheduledDate}`);
        console.log(`      - Original matchId (duplicate): ${matchDoc.originalMatchId}`);

      } catch (err) {
        console.error(`   ❌ Error migrating match ${match.id}:`, err.message);
        errors.push({
          matchId: match.id,
          error: err.message
        });
      }
    }

    console.log('\n\n═══════════════════════════════════════════════════════════');
    console.log('📊 MIGRATION COMPLETE\n');

    console.log(`Results:`);
    console.log(`   ✅ Successfully migrated: ${migrated}`);
    console.log(`   ❌ Errors: ${errors.length}\n`);

    if (errors.length > 0) {
      console.log('Errors:');
      errors.forEach(e => {
        console.log(`   - Match ${e.matchId}: ${e.error}`);
      });
      console.log('');
    }

    if (migrated > 0) {
      console.log('✨ SUCCESS!');
      console.log('   All unmigrated matches have been added to Firestore.');
      console.log('   They should now appear in Match History and Leaderboard.\n');

      console.log('📝 Note:');
      console.log('   - These matches were given unique document IDs: MATCH-{originalId}');
      console.log('   - The original duplicate matchId is preserved in "originalMatchId" field');
      console.log('   - The "matchId" field now matches the document ID (unique)\n');
    }

  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

migrateMissingMatches().then(() => {
  console.log('✅ Script finished');
  process.exit(0);
}).catch(err => {
  console.error('❌ Script error:', err);
  process.exit(1);
});
