/**
 * Check for specific match 1763825713554 in detail
 */

import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, getDoc } from 'firebase/firestore';
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

const TARGET_MATCH_ID = '1763825713554';
const TARGET_MATCH_ID_WITH_PREFIX = `MATCH-${TARGET_MATCH_ID}`;

console.log('🔍 DETAILED CHECK FOR MATCH 1763825713554');
console.log('═══════════════════════════════════════════════════════════\n');

async function checkMatch() {
  try {
    console.log('📋 Step 1: Check by direct document ID...\n');

    // Try to get document directly with various ID formats
    const possibleIds = [
      TARGET_MATCH_ID,
      TARGET_MATCH_ID_WITH_PREFIX,
      `MATCH-1763825713554`,
      '1763825713554'
    ];

    for (const id of possibleIds) {
      try {
        const docRef = doc(db, 'matches', id);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          console.log(`✅ FOUND as document ID: ${id}`);
          console.log(`   Data:`, JSON.stringify(docSnap.data(), null, 2));
          console.log('');
        } else {
          console.log(`❌ NOT found with document ID: ${id}`);
        }
      } catch (e) {
        console.log(`❌ Error checking ID ${id}: ${e.message}`);
      }
    }

    console.log('\n📋 Step 2: Scan all documents for this match...\n');

    const matchesRef = collection(db, 'matches');
    const matchesSnap = await getDocs(matchesRef);

    let foundInFirestore = false;
    let foundInBlob = false;

    for (const docSnap of matchesSnap.docs) {
      const docId = docSnap.id;
      const data = docSnap.data();

      // Check if this is the match we're looking for
      const isTargetMatch =
        docId === TARGET_MATCH_ID ||
        docId === TARGET_MATCH_ID_WITH_PREFIX ||
        data.matchId === TARGET_MATCH_ID ||
        data.matchId === TARGET_MATCH_ID_WITH_PREFIX ||
        data.id === TARGET_MATCH_ID ||
        data.id === parseInt(TARGET_MATCH_ID) ||
        data.originalId === TARGET_MATCH_ID ||
        data.originalId === parseInt(TARGET_MATCH_ID);

      if (isTargetMatch) {
        console.log(`✅ FOUND in Firestore as individual document!`);
        console.log(`   Document ID: ${docId}`);
        console.log(`   Match Data:`);
        console.log(`      matchId: ${data.matchId}`);
        console.log(`      id: ${data.id}`);
        console.log(`      originalId: ${data.originalId}`);
        console.log(`      status: ${data.status}`);
        console.log(`      matchType: ${data.matchType}`);
        console.log(`      team1Id: ${data.team1Id}`);
        console.log(`      team2Id: ${data.team2Id}`);
        console.log(`      date: ${data.date || data.scheduledDate}`);
        console.log(`      createdAt: ${data.createdAt}`);
        console.log(`      migratedAt: ${data.migratedAt}`);
        console.log(`      migratedFrom: ${data.migratedFrom}`);
        console.log('');
        foundInFirestore = true;
      }

      // Check blob storage
      if (docId === 'data' || docId === 'data_backup_blob') {
        let blobData = data.data;
        if (typeof blobData === 'string') {
          blobData = JSON.parse(blobData);
        }
        const matches = Array.isArray(blobData) ? blobData : (blobData.matches || []);

        const matchInBlob = matches.find(m =>
          m.matchId === TARGET_MATCH_ID ||
          m.matchId === TARGET_MATCH_ID_WITH_PREFIX ||
          m.id === TARGET_MATCH_ID ||
          m.id === parseInt(TARGET_MATCH_ID)
        );

        if (matchInBlob) {
          console.log(`✅ FOUND in blob storage (${docId})`);
          console.log(`   Match Data:`);
          console.log(`      id: ${matchInBlob.id}`);
          console.log(`      matchId: ${matchInBlob.matchId}`);
          console.log(`      status: ${matchInBlob.status}`);
          console.log(`      matchType: ${matchInBlob.matchType}`);
          console.log(`      team1Id: ${matchInBlob.team1Id}`);
          console.log(`      team2Id: ${matchInBlob.team2Id}`);
          console.log(`      date: ${matchInBlob.date}`);
          console.log(`      winner: ${matchInBlob.winner}`);
          console.log(`      team1Sets: ${matchInBlob.team1Sets}`);
          console.log(`      team2Sets: ${matchInBlob.team2Sets}`);
          console.log(`      createdAt: ${matchInBlob.createdAt}`);
          console.log(`      challengeId: ${matchInBlob.challengeId}`);
          console.log('');
          foundInBlob = true;
        }
      }
    }

    console.log('═══════════════════════════════════════════════════════════');
    console.log('📊 FINAL RESULT:\n');
    console.log(`   Match ${TARGET_MATCH_ID}:`);
    console.log(`      Found in Firestore individual docs: ${foundInFirestore ? '✅ YES' : '❌ NO'}`);
    console.log(`      Found in blob storage: ${foundInBlob ? '✅ YES' : '❌ NO'}`);
    console.log('');

    if (foundInBlob && !foundInFirestore) {
      console.log('⚠️  ISSUE CONFIRMED: Match exists in blob but NOT as individual document!');
      console.log('   This match was NOT properly migrated.');
    } else if (foundInFirestore && foundInBlob) {
      console.log('✅ Match exists in both blob and individual document (properly migrated)');
    } else if (foundInFirestore && !foundInBlob) {
      console.log('ℹ️  Match exists as individual document but not in blob (added after migration)');
    } else {
      console.log('❌ Match not found anywhere - may have been deleted');
    }

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

checkMatch().then(() => {
  console.log('\n✅ Script finished');
  process.exit(0);
}).catch(err => {
  console.error('❌ Script error:', err);
  process.exit(1);
});
