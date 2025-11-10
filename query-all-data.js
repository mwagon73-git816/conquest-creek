// Script to query ALL data from Conquest of the Creek Firebase database
import { initializeApp } from 'firebase/app';
import { getFirestore, doc, getDoc, collection, getDocs } from 'firebase/firestore';
import dotenv from 'dotenv';

// Load production environment variables
dotenv.config({ path: '.env.production' });

const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.VITE_FIREBASE_APP_ID
};

console.log('🔥 Connecting to Firebase...');
console.log(`📊 Project: ${firebaseConfig.projectId}`);
console.log('');

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function queryAllData() {
  try {
    console.log('═══════════════════════════════════════════════════');
    console.log('📋 QUERYING ALL COLLECTIONS AND DOCUMENTS');
    console.log('═══════════════════════════════════════════════════');
    console.log('');

    const collections = ['teams', 'matches', 'bonuses', 'photos', 'captains', 'challenges', 'players', 'activity_logs'];

    for (const collectionName of collections) {
      console.log(`\n📁 Collection: ${collectionName}`);
      console.log('─────────────────────');

      try {
        // Try to get the 'data' document
        const dataDoc = doc(db, collectionName, 'data');
        const dataSnap = await getDoc(dataDoc);

        if (dataSnap.exists()) {
          const docData = dataSnap.data();
          console.log(`✅ Found 'data' document`);
          console.log(`   updatedAt: ${docData.updatedAt || 'N/A'}`);

          // Try to parse the data field
          if (docData.data) {
            const dataType = typeof docData.data;
            console.log(`   data type: ${dataType}`);

            if (dataType === 'string') {
              try {
                const parsed = JSON.parse(docData.data);
                if (Array.isArray(parsed)) {
                  console.log(`   ✅ Parsed array with ${parsed.length} items`);

                  // Show sample items
                  if (parsed.length > 0 && collectionName === 'matches') {
                    console.log(`\n   📋 Sample Match Data (first item):`);
                    const sample = parsed[0];
                    console.log(`      ID: ${sample.id}`);
                    console.log(`      Date: ${sample.date}`);
                    console.log(`      Level: ${sample.level}`);
                    console.log(`      Team1 ID: ${sample.team1Id}`);
                    console.log(`      Team2 ID: ${sample.team2Id}`);
                    if (sample.set1Team1 !== undefined) {
                      console.log(`      Score: ${sample.set1Team1}-${sample.set1Team2}, ${sample.set2Team1}-${sample.set2Team2}`);
                    }
                  }
                } else if (typeof parsed === 'object') {
                  const keys = Object.keys(parsed);
                  console.log(`   ✅ Parsed object with keys: ${keys.join(', ')}`);

                  // For teams, show sub-arrays
                  if (collectionName === 'teams') {
                    if (parsed.teams) console.log(`      teams array: ${parsed.teams.length} items`);
                    if (parsed.players) console.log(`      players array: ${parsed.players.length} items`);
                    if (parsed.trades) console.log(`      trades array: ${parsed.trades.length} items`);
                  }
                } else {
                  console.log(`   ⚠️  Parsed to: ${typeof parsed}`);
                }
              } catch (e) {
                console.log(`   ❌ Failed to parse JSON: ${e.message}`);
                console.log(`   Raw data length: ${docData.data.length} characters`);
                console.log(`   First 100 chars: ${docData.data.substring(0, 100)}`);
              }
            } else if (Array.isArray(docData.data)) {
              console.log(`   ✅ Already an array with ${docData.data.length} items`);
            } else {
              console.log(`   ⚠️  Data is ${dataType}`);
            }
          } else {
            console.log(`   ⚠️  No 'data' field in document`);
          }
        } else {
          console.log(`❌ No 'data' document found`);

          // Try to list all documents in collection
          const colRef = collection(db, collectionName);
          const snapshot = await getDocs(colRef);
          if (snapshot.empty) {
            console.log(`   Collection is empty`);
          } else {
            console.log(`   Found ${snapshot.size} document(s):`);
            snapshot.forEach(doc => {
              console.log(`      - ${doc.id}`);
            });
          }
        }
      } catch (error) {
        console.log(`❌ Error querying ${collectionName}:`, error.message);
      }
    }

    console.log('');
    console.log('═══════════════════════════════════════════════════');

  } catch (error) {
    console.error('❌ Error querying database:', error);
    console.error(error.stack);
  }
}

// Run the query
queryAllData().then(() => {
  console.log('✅ Query completed successfully!');
  process.exit(0);
}).catch(error => {
  console.error('❌ Query failed:', error);
  process.exit(1);
});
