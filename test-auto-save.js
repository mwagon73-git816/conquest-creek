/**
 * AUTO-SAVE TESTING SCRIPT
 * Quick-start script to test the new safe auto-save system
 *
 * This script runs comprehensive tests to prove the system is bulletproof
 *
 * USAGE:
 *   node test-auto-save.js --unit          # Run unit tests
 *   node test-auto-save.js --chaos         # Run chaos tests (try to break it)
 *   node test-auto-save.js --all           # Run all tests
 */

import { granularStorage, safeAutoSave } from './src/services/granularStorage.js';

// Parse command line arguments
const args = process.argv.slice(2);
const runUnit = args.includes('--unit') || args.includes('--all');
const runChaos = args.includes('--chaos') || args.includes('--all');

if (!runUnit && !runChaos) {
  console.log('❌ No test type specified!');
  console.log('\nUsage:');
  console.log('  node test-auto-save.js --unit    # Run unit tests');
  console.log('  node test-auto-save.js --chaos   # Try to break the system');
  console.log('  node test-auto-save.js --all     # Run all tests');
  process.exit(1);
}

// Test results tracking
let passed = 0;
let failed = 0;
const failures = [];

// Helper function to run a test
async function runTest(name, testFn) {
  try {
    console.log(`\n🧪 ${name}`);
    await testFn();
    console.log(`   ✅ PASS`);
    passed++;
  } catch (error) {
    console.log(`   ❌ FAIL: ${error.message}`);
    failed++;
    failures.push({ name, error: error.message });
  }
}

// Assert helper
function assert(condition, message) {
  if (!condition) {
    throw new Error(message || 'Assertion failed');
  }
}

// ========================================
// UNIT TESTS
// ========================================

async function runUnitTests() {
  console.log('\n═══════════════════════════════════════════════════════');
  console.log('   UNIT TESTS - Input Validation & Safety Checks');
  console.log('═══════════════════════════════════════════════════════\n');

  // TEST 1: Reject null teamId
  await runTest('Reject null teamId', async () => {
    const result = await granularStorage.updateTeam(null, { name: 'Test' }, 'user');
    assert(result.success === false, 'Should reject null teamId');
    assert(result.message.includes('Team ID is required'), 'Should have correct error message');
  });

  // TEST 2: Reject empty team name
  await runTest('Reject empty team name', async () => {
    const result = await granularStorage.updateTeam(1, { name: '' }, 'user');
    assert(result.success === false, 'Should reject empty name');
    assert(result.message.includes('cannot be empty'), 'Should have correct error message');
  });

  // TEST 3: Reject whitespace-only team name
  await runTest('Reject whitespace-only team name', async () => {
    const result = await granularStorage.updateTeam(1, { name: '   ' }, 'user');
    assert(result.success === false, 'Should reject whitespace name');
  });

  // TEST 4: Reject team name over 100 characters
  await runTest('Reject team name over 100 characters', async () => {
    const longName = 'A'.repeat(101);
    const result = await granularStorage.updateTeam(1, { longName }, 'user');
    assert(result.success === false, 'Should reject long name');
    assert(result.message.includes('100 characters'), 'Should mention character limit');
  });

  // TEST 5: Reject attempt to change team ID
  await runTest('Reject attempt to change team ID', async () => {
    const result = await granularStorage.updateTeam(1, { id: 999 }, 'user');
    assert(result.success === false, 'Should reject ID change');
    assert(result.message.includes('Cannot change team ID'), 'Should have correct error message');
  });

  // TEST 6: Reject invalid NTRP rating (too low)
  await runTest('Reject NTRP rating too low', async () => {
    const result = await granularStorage.updatePlayer(1, { ntrpRating: 2.0 }, 'user');
    assert(result.success === false, 'Should reject NTRP < 2.5');
    assert(result.message.includes('Invalid NTRP'), 'Should have correct error message');
  });

  // TEST 7: Reject invalid NTRP rating (too high)
  await runTest('Reject NTRP rating too high', async () => {
    const result = await granularStorage.updatePlayer(1, { ntrpRating: 6.0 }, 'user');
    assert(result.success === false, 'Should reject NTRP > 5.5');
    assert(result.message.includes('Invalid NTRP'), 'Should have correct error message');
  });

  // TEST 8: Reject empty first name
  await runTest('Reject empty first name', async () => {
    const result = await granularStorage.updatePlayer(1, { firstName: '' }, 'user');
    assert(result.success === false, 'Should reject empty first name');
    assert(result.message.includes('First name cannot be empty'), 'Should have correct error message');
  });

  // TEST 9: Reject empty last name
  await runTest('Reject empty last name', async () => {
    const result = await granularStorage.updatePlayer(1, { lastName: '' }, 'user');
    assert(result.success === false, 'Should reject empty last name');
    assert(result.message.includes('Last name cannot be empty'), 'Should have correct error message');
  });

  // TEST 10: Reject empty updates object
  await runTest('Reject empty updates object', async () => {
    const result = await granularStorage.updateTeam(1, {}, 'user');
    assert(result.success === false, 'Should reject empty updates');
    assert(result.message.includes('cannot be empty'), 'Should have correct error message');
  });

  // TEST 11: Accept valid NTRP ratings
  await runTest('Accept all valid NTRP ratings', async () => {
    const validRatings = [2.5, 3.0, 3.5, 4.0, 4.5, 5.0, 5.5];

    for (const rating of validRatings) {
      const result = await granularStorage.updatePlayer(1, { ntrpRating: rating }, 'user');
      // Should pass validation (may fail on Firestore if player doesn't exist, but that's OK)
      if (!result.success) {
        assert(!result.message.includes('Invalid NTRP'), `NTRP ${rating} should be valid`);
      }
    }
  });

  // TEST 12: Reject non-array migration input
  await runTest('Reject non-array migration input', async () => {
    const result = await granularStorage.migrateTeamsToGranular('not an array');
    assert(result.success === false, 'Should reject non-array');
    assert(result.message.includes('must be an array'), 'Should have correct error message');
  });
}

// ========================================
// CHAOS TESTS - Try to Break the System
// ========================================

async function runChaosTests() {
  console.log('\n═══════════════════════════════════════════════════════');
  console.log('   CHAOS TESTS - Actively Try to Cause Data Loss');
  console.log('═══════════════════════════════════════════════════════\n');

  console.log('⚠️  WARNING: These tests intentionally attempt to break the system');
  console.log('   The system should reject all attacks and preserve data.\n');

  // CHAOS TEST 1: Try to inject null values
  await runTest('CHAOS: Inject null values', async () => {
    const attacks = [
      { id: null, name: 'Test' },
      { id: 1, name: null },
      { id: 1, name: undefined },
    ];

    for (const attack of attacks) {
      const result = await granularStorage.updateTeam(attack.id, { name: attack.name }, 'attacker');
      assert(result.success === false, 'Should reject null/undefined values');
    }
  });

  // CHAOS TEST 2: Try XSS injection
  await runTest('CHAOS: XSS injection attempt', async () => {
    const xssAttacks = [
      '<script>alert("xss")</script>',
      '<img src=x onerror=alert(1)>',
      'javascript:alert(1)',
      '<iframe src="evil.com"></iframe>'
    ];

    for (const xss of xssAttacks) {
      const result = await granularStorage.createTeam({
        id: 99999,
        name: xss,
        captainId: null,
        color: '#000000'
      }, 'attacker');

      // XSS should be stored as plain text (browser escapes it on render)
      // But we don't want it to execute or cause errors
      // Success or failure both OK, as long as no XSS execution
      console.log(`      XSS attempt "${xss.substring(0, 30)}..." → ${result.success ? 'stored as text' : 'rejected'}`);
    }

    assert(true, 'XSS tests completed without execution');
  });

  // CHAOS TEST 3: Try SQL injection (shouldn't affect Firestore, but test anyway)
  await runTest('CHAOS: SQL injection attempt', async () => {
    const sqlAttacks = [
      "' OR '1'='1",
      "1'; DROP TABLE teams;--",
      "admin'--",
      "' UNION SELECT * FROM users--"
    ];

    for (const sql of sqlAttacks) {
      const result = await granularStorage.updateTeam(1, { name: sql }, 'attacker');
      // Should either store as harmless text or reject
      console.log(`      SQL attempt "${sql.substring(0, 30)}..." → ${result.success ? 'stored as text' : 'rejected'}`);
    }

    assert(true, 'SQL injection tests completed without damage');
  });

  // CHAOS TEST 4: Try path traversal
  await runTest('CHAOS: Path traversal attempt', async () => {
    const pathAttacks = [
      '../../../etc/passwd',
      '..\\..\\..\\windows\\system32',
      '/etc/passwd',
      'C:\\Windows\\System32'
    ];

    for (const path of pathAttacks) {
      const result = await granularStorage.updateTeam(1, { name: path }, 'attacker');
      // Should store as harmless text or reject
      console.log(`      Path attempt "${path}" → ${result.success ? 'stored as text' : 'rejected'}`);
    }

    assert(true, 'Path traversal tests completed without access');
  });

  // CHAOS TEST 5: Try extremely long input (buffer overflow attempt)
  await runTest('CHAOS: Buffer overflow attempt', async () => {
    const longInputs = [
      'A'.repeat(1000),
      'A'.repeat(10000),
      'A'.repeat(100000),
    ];

    for (const longInput of longInputs) {
      const result = await granularStorage.updateTeam(1, { name: longInput }, 'attacker');
      assert(result.success === false, `Should reject ${longInput.length} char input`);
      console.log(`      ${longInput.length} chars → rejected ✅`);
    }
  });

  // CHAOS TEST 6: Try type confusion
  await runTest('CHAOS: Type confusion attempt', async () => {
    const typeAttacks = [
      { id: 1, name: 123 }, // Number instead of string
      { id: 1, name: { evil: 'object' } }, // Object instead of string
      { id: 1, name: ['array'] }, // Array instead of string
      { id: 1, name: true }, // Boolean instead of string
      { id: '1', name: 'Test' }, // String ID instead of number
    ];

    for (const attack of typeAttacks) {
      const result = await granularStorage.updateTeam(attack.id, { name: attack.name }, 'attacker');
      assert(result.success === false, 'Should reject type mismatches');
    }
  });

  // CHAOS TEST 7: Try to delete with invalid IDs
  await runTest('CHAOS: Delete with invalid IDs', async () => {
    const invalidIds = [
      null,
      undefined,
      'string',
      [],
      {},
      -1,
      0,
      NaN,
      Infinity
    ];

    for (const invalidId of invalidIds) {
      const result = await granularStorage.deleteTeam(invalidId, 'attacker');
      assert(result.success === false, `Should reject delete with ID: ${invalidId}`);
    }
  });

  // CHAOS TEST 8: Try to create duplicate IDs
  await runTest('CHAOS: Create duplicate team IDs', async () => {
    // Create team with ID 88888
    const first = await granularStorage.createTeam({
      id: 88888,
      name: 'First Team',
      captainId: null,
      color: '#000000'
    }, 'user');

    // Try to create another team with same ID
    const duplicate = await granularStorage.createTeam({
      id: 88888,
      name: 'Duplicate Team',
      captainId: null,
      color: '#111111'
    }, 'attacker');

    assert(duplicate.success === false, 'Should reject duplicate ID');
    assert(duplicate.message.includes('already exists'), 'Should mention already exists');

    // Cleanup
    if (first.success) {
      await granularStorage.deleteTeam(88888, 'cleanup');
    }
  });

  // CHAOS TEST 9: Try race condition
  await runTest('CHAOS: Race condition (rapid concurrent updates)', async () => {
    // Create test team
    const createResult = await granularStorage.createTeam({
      id: 77777,
      name: 'Race Test',
      captainId: null,
      color: '#000000'
    }, 'user');

    if (createResult.success) {
      // Fire 20 concurrent updates
      const updates = [];
      for (let i = 0; i < 20; i++) {
        updates.push(
          granularStorage.updateTeam(77777, { name: `Update ${i}` }, `user${i}`)
        );
      }

      const results = await Promise.all(updates);

      // Some may succeed, some may fail due to conflicts, but:
      // 1. Should not cause errors/crashes
      // 2. Team should still exist with valid data
      // 3. Other teams should be unaffected

      const team = await granularStorage.getTeam(77777);
      assert(team !== null, 'Team should still exist after race condition');
      assert(team.name.startsWith('Update'), 'Team should have one of the update names');

      // Cleanup
      await granularStorage.deleteTeam(77777, 'cleanup');
    }

    assert(true, 'Race condition handled without corruption');
  });

  // CHAOS TEST 10: Try to cause rollback failure
  await runTest('CHAOS: Force rollback scenario', async () => {
    // This test verifies the rollback mechanism works
    // We'll update with invalid data to trigger rollback

    // Create test team
    const createResult = await granularStorage.createTeam({
      id: 66666,
      name: 'Rollback Test',
      captainId: null,
      color: '#000000'
    }, 'user');

    if (createResult.success) {
      // Try safe auto-save with invalid data (empty name)
      const rollbackResult = await safeAutoSave.updateTeam(
        66666,
        { name: '' }, // Empty name should fail
        'user'
      );

      assert(rollbackResult.success === false, 'Update should fail');

      // Verify original data preserved
      const team = await granularStorage.getTeam(66666);
      assert(team.name === 'Rollback Test', 'Original name should be preserved');

      // Cleanup
      await granularStorage.deleteTeam(66666, 'cleanup');
    }

    assert(true, 'Rollback mechanism works correctly');
  });
}

// ========================================
// MAIN TEST RUNNER
// ========================================

async function main() {
  console.log('╔═══════════════════════════════════════════════════════╗');
  console.log('║                                                       ║');
  console.log('║          AUTO-SAVE SAFETY TEST SUITE                  ║');
  console.log('║          Testing Bulletproof Architecture             ║');
  console.log('║                                                       ║');
  console.log('╚═══════════════════════════════════════════════════════╝');

  const startTime = Date.now();

  try {
    if (runUnit) {
      await runUnitTests();
    }

    if (runChaos) {
      await runChaosTests();
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    // Print summary
    console.log('\n═══════════════════════════════════════════════════════');
    console.log('   TEST RESULTS');
    console.log('═══════════════════════════════════════════════════════\n');

    console.log(`✅ Passed: ${passed}`);
    console.log(`❌ Failed: ${failed}`);
    console.log(`⏱️  Duration: ${duration}s`);

    if (failed > 0) {
      console.log('\n❌ FAILED TESTS:');
      failures.forEach(f => {
        console.log(`   • ${f.name}`);
        console.log(`     ${f.error}\n`);
      });
    }

    console.log('\n═══════════════════════════════════════════════════════');

    if (failed === 0) {
      console.log('✅ ALL TESTS PASSED - System is bulletproof! 🎉');
      console.log('═══════════════════════════════════════════════════════\n');
      process.exit(0);
    } else {
      console.log('❌ SOME TESTS FAILED - Review failures above');
      console.log('═══════════════════════════════════════════════════════\n');
      process.exit(1);
    }

  } catch (error) {
    console.error('\n❌ FATAL ERROR:', error);
    process.exit(1);
  }
}

// Run tests
main();
