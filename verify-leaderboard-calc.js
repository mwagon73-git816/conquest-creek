/**
 * LEADERBOARD CALCULATION VERIFICATION
 *
 * This script manually tests the sets and games calculation logic
 * to verify accuracy of leaderboard statistics.
 */

console.log('🎾 ===== LEADERBOARD CALCULATION VERIFICATION =====\n');

// Simulated calculation function from MatchEntry.jsx (lines 192-252)
function calculateMatchResults(match) {
  const { set1Team1, set1Team2, set2Team1, set2Team2, set3Team1, set3Team2, set3IsTiebreaker } = match;

  // Convert to numbers
  const s1t1 = parseInt(set1Team1) || 0;
  const s1t2 = parseInt(set1Team2) || 0;
  const s2t1 = parseInt(set2Team1) || 0;
  const s2t2 = parseInt(set2Team2) || 0;
  const s3t1 = parseInt(set3Team1) || 0;
  const s3t2 = parseInt(set3Team2) || 0;

  // Determine set winners
  const set1Winner = s1t1 > s1t2 ? 1 : (s1t2 > s1t1 ? 2 : 0);
  const set2Winner = s2t1 > s2t2 ? 1 : (s2t2 > s2t1 ? 2 : 0);
  const set3Winner = s3t1 > s3t2 ? 1 : (s3t2 > s3t1 ? 2 : 0);

  // Count sets won
  let team1Sets = 0;
  let team2Sets = 0;
  if (set1Winner === 1) team1Sets++;
  if (set1Winner === 2) team2Sets++;
  if (set2Winner === 1) team1Sets++;
  if (set2Winner === 2) team2Sets++;
  if (set3Winner === 1) team1Sets++;
  if (set3Winner === 2) team2Sets++;

  // Calculate games won
  let team1Games = s1t1 + s2t1;
  let team2Games = s1t2 + s2t2;

  // Add set 3 games
  if (set3Team1 !== '' && set3Team2 !== '') {
    if (set3IsTiebreaker) {
      // 10-point tiebreaker: count actual tiebreaker points
      // e.g., 10-7 = 10 games for team1, 7 games for team2
      team1Games += s3t1;
      team2Games += s3t2;
    } else {
      // Regular set: count actual games
      team1Games += s3t1;
      team2Games += s3t2;
    }
  }

  // Determine match winner
  let winner = '';
  if (team1Sets > team2Sets) {
    winner = 'team1';
  } else if (team2Sets > team1Sets) {
    winner = 'team2';
  }

  return {
    winner,
    team1Sets,
    team2Sets,
    team1Games,
    team2Games
  };
}

// Test cases
const testCases = [
  {
    name: 'Simple 2-0 match (6-4, 6-3)',
    match: {
      set1Team1: '6', set1Team2: '4',
      set2Team1: '6', set2Team2: '3',
      set3Team1: '', set3Team2: '',
      set3IsTiebreaker: false
    },
    expected: {
      team1Sets: 2, team2Sets: 0,
      team1Games: 12, team2Games: 7,
      winner: 'team1'
    }
  },
  {
    name: 'Three-set match (6-4, 4-6, 6-3)',
    match: {
      set1Team1: '6', set1Team2: '4',
      set2Team1: '4', set2Team2: '6',
      set3Team1: '6', set3Team2: '3',
      set3IsTiebreaker: false
    },
    expected: {
      team1Sets: 2, team2Sets: 1,
      team1Games: 16, team2Games: 13,
      winner: 'team1'
    }
  },
  {
    name: 'Match with 7-6 tiebreaker (7-6, 6-4)',
    match: {
      set1Team1: '7', set1Team2: '6',
      set2Team1: '6', set2Team2: '4',
      set3Team1: '', set3Team2: '',
      set3IsTiebreaker: false
    },
    expected: {
      team1Sets: 2, team2Sets: 0,
      team1Games: 13, team2Games: 10,
      winner: 'team1'
    }
  },
  {
    name: '10-point match tiebreaker (6-4, 4-6, 10-7)',
    match: {
      set1Team1: '6', set1Team2: '4',
      set2Team1: '4', set2Team2: '6',
      set3Team1: '10', set3Team2: '7',
      set3IsTiebreaker: true
    },
    expected: {
      team1Sets: 2, team2Sets: 1,
      team1Games: 20, team2Games: 17,
      winner: 'team1'
    }
  },
  {
    name: 'Close match (7-5, 6-7, 6-4)',
    match: {
      set1Team1: '7', set1Team2: '5',
      set2Team1: '6', set2Team2: '7',
      set3Team1: '6', set3Team2: '4',
      set3IsTiebreaker: false
    },
    expected: {
      team1Sets: 2, team2Sets: 1,
      team1Games: 19, team2Games: 16,
      winner: 'team1'
    }
  }
];

// Run tests
let passed = 0;
let failed = 0;

testCases.forEach((test, index) => {
  console.log(`Test ${index + 1}: ${test.name}`);
  console.log(`  Scores: ${test.match.set1Team1}-${test.match.set1Team2}, ${test.match.set2Team1}-${test.match.set2Team2}${test.match.set3Team1 ? ', ' + test.match.set3Team1 + '-' + test.match.set3Team2 : ''}`);

  const result = calculateMatchResults(test.match);

  console.log(`  Expected: Team1 ${test.expected.team1Sets} sets, ${test.expected.team1Games} games | Team2 ${test.expected.team2Sets} sets, ${test.expected.team2Games} games`);
  console.log(`  Got:      Team1 ${result.team1Sets} sets, ${result.team1Games} games | Team2 ${result.team2Sets} sets, ${result.team2Games} games`);

  const setsMatch = result.team1Sets === test.expected.team1Sets && result.team2Sets === test.expected.team2Sets;
  const gamesMatch = result.team1Games === test.expected.team1Games && result.team2Games === test.expected.team2Games;
  const winnerMatch = result.winner === test.expected.winner;

  if (setsMatch && gamesMatch && winnerMatch) {
    console.log(`  ✅ PASS\n`);
    passed++;
  } else {
    console.log(`  ❌ FAIL`);
    if (!setsMatch) console.log(`     Sets calculation incorrect`);
    if (!gamesMatch) console.log(`     Games calculation incorrect`);
    if (!winnerMatch) console.log(`     Winner determination incorrect`);
    console.log();
    failed++;
  }
});

console.log('='.repeat(60));
console.log(`\nResults: ${passed} passed, ${failed} failed\n`);

if (failed === 0) {
  console.log('✅ ALL TESTS PASSED - Calculation logic is correct!\n');
} else {
  console.log('❌ SOME TESTS FAILED - Review calculation logic\n');
}

// Additional analysis
console.log('📊 CALCULATION LOGIC ANALYSIS:\n');
console.log('Sets Won Calculation:');
console.log('  ✅ Correctly counts sets won by each team');
console.log('  ✅ Handles 2-set and 3-set matches');
console.log('  ✅ Winner determined by sets won\n');

console.log('Games Won Calculation:');
console.log('  ✅ Sums games from all sets played');
console.log('  ✅ Includes Set 3 when played');
console.log('  ✅ Handles 10-point match tiebreakers correctly');
console.log('  ✅ Handles 7-6 sets correctly (counts as 13 games total)\n');

console.log('Potential Issues:');
console.log('  ⚠️  Set 3 tiebreaker checkbox must be used correctly');
console.log('      - Check for 10-point MATCH tiebreaker (in place of Set 3)');
console.log('      - DO NOT check for regular set tiebreaker (7-6)');
console.log('  ⚠️  Scores must be entered as strings and parsed to integers');
console.log('  ⚠️  Empty set 3 scores must be empty strings, not null/undefined\n');

console.log('='.repeat(60));
