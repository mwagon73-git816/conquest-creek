/**
 * Find all matches in blob storage with duplicate matchIds
 */

import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';
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

console.log('🔍 FINDING DUPLICATE MATCHIDS IN BLOB STORAGE');
console.log('═══════════════════════════════════════════════════════════\n');

async function findDuplicates() {
  try {
    const matchesRef = collection(db, 'matches');
    const snapshot = await getDocs(matchesRef);

    // Get blob storage
    const blobDoc = snapshot.docs.find(d => d.id === 'data');
    if (!blobDoc) {
      console.log('❌ No blob storage found');
      return;
    }

    let blobData = blobDoc.data().data;
    if (typeof blobData === 'string') {
      blobData = JSON.parse(blobData);
    }
    const matches = Array.isArray(blobData) ? blobData : (blobData.matches || []);

    console.log(`📋 Total matches in blob: ${matches.length}\n`);

    // Group by matchId
    const byMatchId = new Map();

    for (const match of matches) {
      const matchId = match.matchId;
      if (!matchId) {
        continue;
      }

      if (!byMatchId.has(matchId)) {
        byMatchId.set(matchId, []);
      }
      byMatchId.get(matchId).push(match);
    }

    // Find duplicates
    const duplicates = Array.from(byMatchId.entries()).filter(([_, matches]) => matches.length > 1);

    if (duplicates.length === 0) {
      console.log('✅ No duplicate matchIds found in blob storage');
      return;
    }

    console.log(`⚠️  FOUND ${duplicates.length} DUPLICATE MATCHIDS:\n`);
    console.log('═══════════════════════════════════════════════════════════\n');

    for (const [matchId, matches] of duplicates) {
      console.log(`🔴 Duplicate matchId: ${matchId}`);
      console.log(`   ${matches.length} matches share this ID:\n`);

      matches.forEach((match, idx) => {
        console.log(`   [${idx + 1}] Match with id: ${match.id}`);
        console.log(`       matchType: ${match.matchType || 'undefined'}`);
        console.log(`       status: ${match.status || 'undefined'}`);
        console.log(`       team1Id: ${match.team1Id}`);
        console.log(`       team2Id: ${match.team2Id}`);
        console.log(`       date: ${match.date || 'unknown'}`);
        console.log(`       winner: ${match.winner || 'none'}`);
        console.log('');
      });

      // Check which one got migrated
      console.log(`   Checking Firestore to see which was migrated...\n`);

      for (const doc of snapshot.docs) {
        if (doc.id === 'data' || doc.id === 'data_backup_blob') continue;

        const data = doc.data();
        if (data.matchId === matchId || doc.id === matchId) {
          console.log(`   ✅ MIGRATED: Document ${doc.id}`);
          console.log(`      Original blob id: ${data.originalId || data.id}`);
          console.log(`      matchType: ${data.matchType}`);
          console.log(`      teams: ${data.team1Id} vs ${data.team2Id}`);
          console.log('');

          // Identify which blob match this corresponds to
          const blobMatch = matches.find(m =>
            m.id === data.originalId ||
            m.id === data.id ||
            (m.id && m.id.toString() === (data.originalId || data.id)?.toString())
          );

          if (blobMatch) {
            console.log(`      ✓ This is the blob match with id: ${blobMatch.id}`);
          }
          console.log('');
        }
      }

      // Identify unmigrated matches
      const unmigrated = matches.filter(match => {
        const migrated = Array.from(snapshot.docs).some(doc => {
          if (doc.id === 'data' || doc.id === 'data_backup_blob') return false;
          const data = doc.data();
          return data.originalId === match.id ||
                 data.id === match.id ||
                 (data.originalId && data.originalId.toString() === match.id?.toString()) ||
                 (data.id && data.id.toString() === match.id?.toString());
        });
        return !migrated;
      });

      if (unmigrated.length > 0) {
        console.log(`   ❌ NOT MIGRATED (${unmigrated.length} matches):`);
        unmigrated.forEach(match => {
          console.log(`      - Match id: ${match.id}`);
          console.log(`        matchType: ${match.matchType || 'undefined'}`);
          console.log(`        teams: ${match.team1Id} vs ${match.team2Id}`);
          console.log(`        date: ${match.date}`);
          console.log('');
        });
      }

      console.log('   ═════════════════════════════════════════════════\n');
    }

    // Summary
    console.log('═══════════════════════════════════════════════════════════');
    console.log('📊 SUMMARY:');
    console.log(`   Total duplicate matchIds: ${duplicates.length}`);

    let totalUnmigrated = 0;
    for (const [_, matches] of duplicates) {
      const unmigrated = matches.filter(match => {
        const migrated = Array.from(snapshot.docs).some(doc => {
          if (doc.id === 'data' || doc.id === 'data_backup_blob') return false;
          const data = doc.data();
          return data.originalId === match.id ||
                 data.id === match.id ||
                 (data.originalId && data.originalId.toString() === match.id?.toString()) ||
                 (data.id && data.id.toString() === match.id?.toString());
        });
        return !migrated;
      });
      totalUnmigrated += unmigrated.length;
    }

    console.log(`   Total unmigrated due to duplicates: ${totalUnmigrated}`);
    console.log('');

    if (totalUnmigrated > 0) {
      console.log('⚠️  ROOT CAUSE IDENTIFIED:');
      console.log('   Matches with duplicate matchIds could not be migrated because');
      console.log('   Firestore document IDs must be unique. When the migration tried');
      console.log('   to create a document with a matchId that already existed, it');
      console.log('   either skipped or overwrote the previous match.');
      console.log('');
      console.log('💡 SOLUTION:');
      console.log('   The migration needs to handle duplicate matchIds by generating');
      console.log('   unique document IDs for matches that share the same matchId.');
      console.log('   For example: MATCH-2025-027-1, MATCH-2025-027-2, etc.');
    }

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

findDuplicates().then(() => {
  console.log('\n✅ Script finished');
  process.exit(0);
}).catch(err => {
  console.error('❌ Script error:', err);
  process.exit(1);
});
