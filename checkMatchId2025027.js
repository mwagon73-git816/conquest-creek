/**
 * Check if MATCH-2025-027 exists in Firestore
 */

import { initializeApp } from 'firebase/app';
import { getFirestore, doc, getDoc, collection, getDocs } from 'firebase/firestore';
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

console.log('🔍 Checking for MATCH-2025-027...\n');

async function checkMatch() {
  // Try direct lookup
  try {
    const docRef = doc(db, 'matches', 'MATCH-2025-027');
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      console.log('✅ FOUND as document ID: MATCH-2025-027');
      const data = docSnap.data();
      console.log('\nMatch Details:');
      console.log(`   Document ID: MATCH-2025-027`);
      console.log(`   matchId: ${data.matchId}`);
      console.log(`   id/originalId: ${data.id || data.originalId}`);
      console.log(`   status: ${data.status}`);
      console.log(`   matchType: ${data.matchType}`);
      console.log(`   team1Id: ${data.team1Id}`);
      console.log(`   team2Id: ${data.team2Id}`);
      console.log(`   date: ${data.date || data.scheduledDate}`);
      console.log(`   createdAt: ${data.createdAt}`);
      console.log(`   winner: ${data.winner}`);
      console.log(`   score: ${data.team1Sets}-${data.team2Sets}`);
      console.log(`   migratedAt: ${data.migratedAt}`);
      console.log(`   migratedFrom: ${data.migratedFrom}`);
      console.log('\n✅ MATCH WAS MIGRATED!');
    } else {
      console.log('❌ NOT found with document ID: MATCH-2025-027');
      console.log('\nSearching all documents...');

      // Scan all documents
      const matchesRef = collection(db, 'matches');
      const snapshot = await getDocs(matchesRef);

      let found = false;
      for (const doc of snapshot.docs) {
        const data = doc.data();
        if (data.matchId === 'MATCH-2025-027' || data.id === 1763825713554 || data.originalId === 1763825713554) {
          console.log(`\n✅ Found match with blob id 1763825713554 as document: ${doc.id}`);
          console.log(`   matchId: ${data.matchId}`);
          console.log(`   id/originalId: ${data.id || data.originalId}`);
          console.log(`   matchType: ${data.matchType}`);
          found = true;
        }
      }

      if (!found) {
        console.log('\n❌ Match NOT FOUND in any Firestore document');
        console.log('   The match exists in blob storage but was never migrated!');
      }
    }
  } catch (error) {
    console.error('Error:', error);
  }
}

checkMatch().then(() => process.exit(0)).catch(err => {
  console.error('Script error:', err);
  process.exit(1);
});
