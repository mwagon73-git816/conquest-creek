/**
 * Search for singles match between Balls Deep and Brace for Impact
 */

import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

// Firebase configuration from environment variables
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

const TEAM1_ID = '1762137674163';
const TEAM2_ID = '1762135298581';
const TEAM1_NAME = 'Balls Deep';
const TEAM2_NAME = 'Brace for Impact';

console.log('🔍 Searching for singles match between:');
console.log(`   Team 1: ${TEAM1_NAME} (ID: ${TEAM1_ID})`);
console.log(`   Team 2: ${TEAM2_NAME} (ID: ${TEAM2_ID})`);
console.log('');

async function searchMatch() {
  try {
    const matchesRef = collection(db, 'matches');
    const matchesSnap = await getDocs(matchesRef);

    console.log(`📋 Total documents in matches collection: ${matchesSnap.docs.length}`);
    console.log('');

    // Track findings
    const matchesWithTeam1 = [];
    const matchesWithTeam2 = [];
    const singlesMatchBetweenTeams = [];
    const allMatchesBetweenTeams = [];
    let blobDocuments = [];

    // Process all documents
    for (const doc of matchesSnap.docs) {
      const docId = doc.id;
      const data = doc.data();

      // Skip and save blob documents for later
      if (docId === 'data' || docId === 'data_backup_blob') {
        blobDocuments.push({ id: docId, data });
        continue;
      }

      // Check for Team 1 (as string or number)
      const hasTeam1 =
        data.team1Id === TEAM1_ID ||
        data.team1Id === parseInt(TEAM1_ID) ||
        data.team2Id === TEAM1_ID ||
        data.team2Id === parseInt(TEAM1_ID) ||
        (data.team1Name && data.team1Name.includes(TEAM1_NAME)) ||
        (data.team2Name && data.team2Name.includes(TEAM1_NAME));

      // Check for Team 2 (as string or number)
      const hasTeam2 =
        data.team1Id === TEAM2_ID ||
        data.team1Id === parseInt(TEAM2_ID) ||
        data.team2Id === TEAM2_ID ||
        data.team2Id === parseInt(TEAM2_ID) ||
        (data.team1Name && data.team1Name.includes(TEAM2_NAME)) ||
        (data.team2Name && data.team2Name.includes(TEAM2_NAME));

      if (hasTeam1) {
        matchesWithTeam1.push({ id: docId, ...data });
      }

      if (hasTeam2) {
        matchesWithTeam2.push({ id: docId, ...data });
      }

      // Check if both teams are in this match
      if (hasTeam1 && hasTeam2) {
        allMatchesBetweenTeams.push({ id: docId, ...data });

        // Check if it's a singles match
        if (data.matchType === 'singles') {
          singlesMatchBetweenTeams.push({ id: docId, ...data });
        }
      }
    }

    // Report findings
    console.log('═══════════════════════════════════════════════════════════');
    console.log('📊 SEARCH RESULTS');
    console.log('═══════════════════════════════════════════════════════════');
    console.log('');

    console.log(`🎾 Matches involving ${TEAM1_NAME}: ${matchesWithTeam1.length}`);
    console.log(`🎾 Matches involving ${TEAM2_NAME}: ${matchesWithTeam2.length}`);
    console.log(`🤝 Matches between both teams (any type): ${allMatchesBetweenTeams.length}`);
    console.log(`🎯 SINGLES matches between both teams: ${singlesMatchBetweenTeams.length}`);
    console.log('');

    // Show singles matches between teams (the main query)
    if (singlesMatchBetweenTeams.length > 0) {
      console.log('✅ FOUND SINGLES MATCH(ES) BETWEEN TEAMS:');
      console.log('═══════════════════════════════════════════════════════════');
      singlesMatchBetweenTeams.forEach((match, idx) => {
        console.log(`\n[${idx + 1}] Match ID: ${match.id || match.matchId}`);
        console.log(`    Status: ${match.status}`);
        console.log(`    Match Type: ${match.matchType}`);
        console.log(`    Team 1 ID: ${match.team1Id}`);
        console.log(`    Team 2 ID: ${match.team2Id}`);
        console.log(`    Team 1 Players: ${JSON.stringify(match.team1Players)}`);
        console.log(`    Team 2 Players: ${JSON.stringify(match.team2Players)}`);
        console.log(`    Level: ${match.level}`);
        console.log(`    Date: ${match.scheduledDate || match.date || match.createdAt}`);
        console.log(`    Challenge ID: ${match.challengeId || 'none'}`);
        console.log(`    Created At: ${match.createdAt}`);
        console.log(`    Winner: ${match.winner || 'pending'}`);
        if (match.team1Sets !== undefined) {
          console.log(`    Score: ${match.team1Sets}-${match.team2Sets}`);
        }
      });
    } else {
      console.log('❌ NO SINGLES MATCHES FOUND between these teams in Firestore');
    }

    // Show all matches between teams (including non-singles)
    if (allMatchesBetweenTeams.length > 0 && allMatchesBetweenTeams.length > singlesMatchBetweenTeams.length) {
      console.log('\n\n📋 OTHER MATCHES BETWEEN TEAMS (non-singles):');
      console.log('═══════════════════════════════════════════════════════════');
      const nonSingles = allMatchesBetweenTeams.filter(m => m.matchType !== 'singles');
      nonSingles.forEach((match, idx) => {
        console.log(`\n[${idx + 1}] Match ID: ${match.id || match.matchId}`);
        console.log(`    Status: ${match.status}`);
        console.log(`    Match Type: ${match.matchType}`);
        console.log(`    Team 1 ID: ${match.team1Id}`);
        console.log(`    Team 2 ID: ${match.team2Id}`);
        console.log(`    Date: ${match.scheduledDate || match.date || match.createdAt}`);
      });
    }

    // Show sample matches for Team 1
    console.log(`\n\n📋 SAMPLE MATCHES FOR ${TEAM1_NAME} (first 5):`)
    console.log('═══════════════════════════════════════════════════════════');
    matchesWithTeam1.slice(0, 5).forEach((match, idx) => {
      console.log(`\n[${idx + 1}] Match ID: ${match.id || match.matchId}`);
      console.log(`    Status: ${match.status}`);
      console.log(`    Match Type: ${match.matchType}`);
      console.log(`    Team 1 ID: ${match.team1Id} vs Team 2 ID: ${match.team2Id}`);
      console.log(`    Date: ${match.scheduledDate || match.date || match.createdAt}`);
    });

    // Show sample matches for Team 2
    console.log(`\n\n📋 SAMPLE MATCHES FOR ${TEAM2_NAME} (first 5):`);
    console.log('═══════════════════════════════════════════════════════════');
    matchesWithTeam2.slice(0, 5).forEach((match, idx) => {
      console.log(`\n[${idx + 1}] Match ID: ${match.id || match.matchId}`);
      console.log(`    Status: ${match.status}`);
      console.log(`    Match Type: ${match.matchType}`);
      console.log(`    Team 1 ID: ${match.team1Id} vs Team 2 ID: ${match.team2Id}`);
      console.log(`    Date: ${match.scheduledDate || match.date || match.createdAt}`);
    });

    // Check blob storage
    console.log('\n\n📦 CHECKING BLOB STORAGE:');
    console.log('═══════════════════════════════════════════════════════════');

    for (const blob of blobDocuments) {
      console.log(`\nChecking ${blob.id}...`);

      let matches = [];
      try {
        let data = blob.data.data;
        if (typeof data === 'string') {
          data = JSON.parse(data);
        }
        matches = Array.isArray(data) ? data : (data.matches || []);
      } catch (e) {
        console.log(`   Could not parse blob: ${e.message}`);
        continue;
      }

      console.log(`   Total matches in blob: ${matches.length}`);

      // Search blob for our teams
      const blobMatchesWithTeam1 = matches.filter(m =>
        m.team1Id === TEAM1_ID || m.team1Id === parseInt(TEAM1_ID) ||
        m.team2Id === TEAM1_ID || m.team2Id === parseInt(TEAM1_ID)
      );
      const blobMatchesWithTeam2 = matches.filter(m =>
        m.team1Id === TEAM2_ID || m.team1Id === parseInt(TEAM2_ID) ||
        m.team2Id === TEAM2_ID || m.team2Id === parseInt(TEAM2_ID)
      );

      const blobMatchesBetweenTeams = matches.filter(m => {
        const hasTeam1 = m.team1Id === TEAM1_ID || m.team1Id === parseInt(TEAM1_ID) ||
                         m.team2Id === TEAM1_ID || m.team2Id === parseInt(TEAM1_ID);
        const hasTeam2 = m.team1Id === TEAM2_ID || m.team1Id === parseInt(TEAM2_ID) ||
                         m.team2Id === TEAM2_ID || m.team2Id === parseInt(TEAM2_ID);
        return hasTeam1 && hasTeam2;
      });

      const blobSinglesMatchesBetweenTeams = blobMatchesBetweenTeams.filter(m => m.matchType === 'singles');

      console.log(`   Matches with ${TEAM1_NAME}: ${blobMatchesWithTeam1.length}`);
      console.log(`   Matches with ${TEAM2_NAME}: ${blobMatchesWithTeam2.length}`);
      console.log(`   Matches between both teams: ${blobMatchesBetweenTeams.length}`);
      console.log(`   SINGLES matches between both teams: ${blobSinglesMatchesBetweenTeams.length}`);

      if (blobSinglesMatchesBetweenTeams.length > 0) {
        console.log(`\n   ✅ FOUND IN BLOB - Singles match(es) between teams:`);
        blobSinglesMatchesBetweenTeams.forEach((match, idx) => {
          console.log(`\n   [${idx + 1}] Match ID: ${match.id || match.matchId}`);
          console.log(`       Status: ${match.status}`);
          console.log(`       Match Type: ${match.matchType}`);
          console.log(`       Team 1 ID: ${match.team1Id} vs Team 2 ID: ${match.team2Id}`);
          console.log(`       Date: ${match.date || match.scheduledDate || 'unknown'}`);
          console.log(`       Challenge ID: ${match.challengeId || 'none'}`);
        });
      }
    }

    console.log('\n\n═══════════════════════════════════════════════════════════');
    console.log('🏁 SEARCH COMPLETE');
    console.log('═══════════════════════════════════════════════════════════');

  } catch (error) {
    console.error('❌ Error searching matches:', error);
    process.exit(1);
  }
}

searchMatch().then(() => {
  console.log('\n✅ Script finished');
  process.exit(0);
}).catch(err => {
  console.error('❌ Script error:', err);
  process.exit(1);
});
