// Script to query Conquest of the Creek Firebase database for matches
import { initializeApp } from 'firebase/app';
import { getFirestore, doc, getDoc } from 'firebase/firestore';
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

async function queryMatches() {
  try {
    // Query the matches collection
    const matchesRef = doc(db, 'matches', 'data');
    const matchesSnap = await getDoc(matchesRef);

    if (!matchesSnap.exists()) {
      console.log('❌ No matches document found in the database.');
      return;
    }

    const matchesData = matchesSnap.data();
    let matches = matchesData.data || [];

    // Debug: Check data structure
    console.log('✅ Successfully retrieved matches data!');
    console.log('');

    // Parse if it's a string (JSON)
    if (typeof matches === 'string') {
      console.log('⚠️  Matches data is a JSON string, parsing...');
      try {
        matches = JSON.parse(matches);
        console.log(`✅ Parsed JSON string to array with ${Array.isArray(matches) ? matches.length : 'unknown'} items`);
      } catch (e) {
        console.error('❌ Failed to parse matches JSON:', e.message);
        matches = [];
      }
    }

    // Ensure matches is an array
    if (!Array.isArray(matches)) {
      console.log('⚠️  Matches data is not an array. Type:', typeof matches);
      console.log('⚠️  Attempting to convert to array...');
      if (typeof matches === 'object' && matches !== null) {
        matches = Object.values(matches);
        console.log(`✅ Converted to array with ${matches.length} items`);
      } else {
        matches = [];
      }
    }

    console.log('═══════════════════════════════════════════════════');
    console.log(`📊 TOTAL COMPLETED MATCHES: ${matches.length}`);
    console.log('═══════════════════════════════════════════════════');
    console.log('');

    if (matches.length === 0) {
      console.log('No completed matches found in the database.');
      return;
    }

    // Query teams to get team names
    const teamsRef = doc(db, 'teams', 'data');
    const teamsSnap = await getDoc(teamsRef);
    const teamsData = teamsSnap.exists() ? teamsSnap.data() : null;
    let teams = teamsData?.data || [];

    // Parse if it's a string (JSON)
    if (typeof teams === 'string') {
      try {
        teams = JSON.parse(teams);
      } catch (e) {
        console.error('⚠️  Failed to parse teams JSON:', e.message);
        teams = [];
      }
    }

    // Ensure teams is an array
    if (!Array.isArray(teams)) {
      console.log('⚠️  Teams data is not an array. Type:', typeof teams);
      if (typeof teams === 'object' && teams !== null) {
        teams = Object.values(teams);
        console.log(`✅ Converted teams to array with ${teams.length} items`);
      } else {
        teams = [];
      }
    }

    // Create a map of team IDs to names
    const teamMap = {};
    if (teams.length > 0) {
      teams.forEach(team => {
        teamMap[team.id] = team.name;
      });
      console.log(`📝 Loaded ${teams.length} teams for name lookup`);
    } else {
      console.log('⚠️  No teams data available for name lookup');
    }
    console.log('');

    // Display summary statistics
    console.log('📈 MATCH STATISTICS:');
    console.log('─────────────────────');

    // Calculate date range
    const dates = matches.map(m => new Date(m.date)).sort((a, b) => a - b);
    if (dates.length > 0) {
      console.log(`📅 Date Range: ${dates[0].toLocaleDateString()} to ${dates[dates.length - 1].toLocaleDateString()}`);
    }

    // Count by level
    const levelCounts = {};
    matches.forEach(match => {
      levelCounts[match.level] = (levelCounts[match.level] || 0) + 1;
    });
    console.log('\n🎾 Matches by Level:');
    Object.entries(levelCounts).sort().forEach(([level, count]) => {
      console.log(`   Level ${level}: ${count} matches`);
    });

    console.log('');
    console.log('═══════════════════════════════════════════════════');
    console.log('📋 SAMPLE MATCHES (First 10):');
    console.log('═══════════════════════════════════════════════════');
    console.log('');

    // Display first 10 matches with details
    const samplesToShow = Math.min(10, matches.length);
    for (let i = 0; i < samplesToShow; i++) {
      const match = matches[i];
      const team1Name = teamMap[match.team1Id] || `Team ${match.team1Id}`;
      const team2Name = teamMap[match.team2Id] || `Team ${match.team2Id}`;
      const matchDate = new Date(match.date).toLocaleDateString();

      console.log(`Match ${i + 1}:`);
      console.log(`  📅 Date: ${matchDate}`);
      console.log(`  🏆 Level: ${match.level}`);
      console.log(`  🎾 Teams: ${team1Name} vs ${team2Name}`);

      // Display scores
      const scores = [];
      if (match.set1Team1 !== undefined && match.set1Team2 !== undefined) {
        scores.push(`Set 1: ${match.set1Team1}-${match.set1Team2}`);
      }
      if (match.set2Team1 !== undefined && match.set2Team2 !== undefined) {
        scores.push(`Set 2: ${match.set2Team1}-${match.set2Team2}`);
      }
      if (match.set3Team1 !== undefined && match.set3Team2 !== undefined) {
        const set3Label = match.set3IsTiebreaker ? 'Tiebreaker' : 'Set 3';
        scores.push(`${set3Label}: ${match.set3Team1}-${match.set3Team2}`);
      }
      console.log(`  📊 Score: ${scores.join(', ')}`);

      // Display winner
      if (match.winner) {
        const winnerName = teamMap[match.winner] || `Team ${match.winner}`;
        console.log(`  🥇 Winner: ${winnerName}`);
      }

      // Display points
      if (match.winnerPoints !== undefined) {
        console.log(`  💰 Points: Winner ${match.winnerPoints} | Loser ${match.loserPoints}`);
      }

      // Display players if available
      if (match.team1Players && match.team1Players.length > 0) {
        console.log(`  👥 Players: ${match.team1Players.length} vs ${match.team2Players?.length || 0}`);
      }

      console.log('');
    }

    if (matches.length > 10) {
      console.log(`... and ${matches.length - 10} more matches`);
      console.log('');
    }

    console.log('═══════════════════════════════════════════════════');
    console.log('');
    console.log('Database metadata:');
    console.log(`  Last updated: ${matchesData.updatedAt || 'Unknown'}`);
    console.log('');

  } catch (error) {
    console.error('❌ Error querying database:', error);
    console.error(error.stack);
  }
}

// Run the query
queryMatches().then(() => {
  console.log('✅ Query completed successfully!');
  process.exit(0);
}).catch(error => {
  console.error('❌ Query failed:', error);
  process.exit(1);
});
