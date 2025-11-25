/**
 * Verification Script: Compare Production and Dev Databases
 *
 * This script verifies that the migration was successful by comparing
 * document counts and sampling data from both databases.
 */

import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';

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

const prodApp = initializeApp(prodConfig, 'prod');
const devApp = initializeApp(devConfig, 'dev');

const prodDb = getFirestore(prodApp);
const devDb = getFirestore(devApp);

const COLLECTIONS = [
  'teams',
  'players',
  'matches',
  'challenges',
  'captains',
  'bonuses',
  'photos',
  'activityLog',
  'tournamentData'
];

async function verifyCollection(collectionName) {
  const prodSnapshot = await getDocs(collection(prodDb, collectionName));
  const devSnapshot = await getDocs(collection(devDb, collectionName));

  const prodCount = prodSnapshot.size;
  const devCount = devSnapshot.size;

  const match = prodCount === devCount;
  const status = match ? '✅' : '❌';

  console.log(`  ${status} ${collectionName.padEnd(20)} Prod: ${prodCount.toString().padStart(4)}  Dev: ${devCount.toString().padStart(4)}  ${match ? 'MATCH' : 'MISMATCH'}`);

  // Show sample data for collections with documents
  if (prodCount > 0) {
    const sampleDoc = prodSnapshot.docs[0];
    console.log(`     Sample ID: ${sampleDoc.id}`);
  }

  return { prodCount, devCount, match };
}

async function runVerification() {
  console.log('\n╔═══════════════════════════════════════════════════════════╗');
  console.log('║           MIGRATION VERIFICATION REPORT                  ║');
  console.log('╚═══════════════════════════════════════════════════════════╝\n');

  console.log('📊 Collection Counts:');
  console.log('─'.repeat(60));

  let totalProd = 0;
  let totalDev = 0;
  let mismatches = [];

  for (const collectionName of COLLECTIONS) {
    const result = await verifyCollection(collectionName);
    totalProd += result.prodCount;
    totalDev += result.devCount;

    if (!result.match) {
      mismatches.push(collectionName);
    }
  }

  console.log('─'.repeat(60));
  console.log(`  Total Documents:         Prod: ${totalProd.toString().padStart(4)}  Dev: ${totalDev.toString().padStart(4)}\n`);

  if (mismatches.length === 0) {
    console.log('✅ VERIFICATION PASSED!');
    console.log('   All collections match between production and development.\n');
  } else {
    console.log('⚠️  VERIFICATION WARNING!');
    console.log(`   ${mismatches.length} collection(s) have mismatched counts:`);
    mismatches.forEach(name => console.log(`   - ${name}`));
    console.log('');
  }
}

runVerification().catch(console.error);
