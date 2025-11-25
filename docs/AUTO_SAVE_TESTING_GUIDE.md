# Auto-Save Testing Guide
## Comprehensive Testing Strategy to Prove Bulletproof Safety

**Objective:** Prove that the new auto-save system **CANNOT cause data loss** under any circumstances.

**Testing Philosophy:** Don't just test that it works - **actively try to break it** and prove you cannot.

---

## 📋 TABLE OF CONTENTS

1. [Testing Strategy](#testing-strategy)
2. [Unit Tests](#unit-tests)
3. [Integration Tests](#integration-tests)
4. [Chaos Testing](#chaos-testing)
5. [Manual Testing Procedures](#manual-testing-procedures)
6. [Performance Testing](#performance-testing)
7. [Migration Testing](#migration-testing)
8. [Production Monitoring](#production-monitoring)

---

## 🎯 TESTING STRATEGY

### Testing Pyramid

```
                    ▲
                   / \
                  /   \
                 /  E2E \          ← Few tests (5-10)
                /_______\            Critical workflows
               /         \
              /Integration\        ← Some tests (20-30)
             /   Tests     \         Multi-component
            /_______________\
           /                 \
          /   Unit Tests      \   ← Many tests (100+)
         /                     \    Individual functions
        /_______________________\
```

### Test Categories

1. **Unit Tests** - Individual function validation
   - ✅ Validates inputs
   - ✅ Handles errors correctly
   - ✅ Returns expected results
   - **Goal:** 100% code coverage

2. **Integration Tests** - Multi-component workflows
   - ✅ Update team → Updates Firestore
   - ✅ Rollback works on error
   - ✅ Concurrent updates don't conflict
   - **Goal:** All workflows tested

3. **Chaos Tests** - Actively try to break it
   - ❌ Try to wipe database (should fail)
   - ❌ Try to corrupt data (should fail)
   - ❌ Try race conditions (should handle)
   - **Goal:** Prove it's unbreakable

4. **Manual Tests** - User workflow testing
   - ✅ Real user interactions
   - ✅ Edge cases in UI
   - ✅ Usability validation
   - **Goal:** Confirm UX is safe

---

## 🧪 UNIT TESTS

### Test File: `src/services/__tests__/granularStorage.test.js`

Create this file with comprehensive unit tests:

```javascript
import { granularStorage, safeAutoSave } from '../granularStorage';
import { db } from '../../firebase';

// Mock Firestore for unit tests
jest.mock('../../firebase', () => ({
  db: {
    collection: jest.fn(),
    doc: jest.fn()
  }
}));

describe('granularStorage - Team Operations', () => {

  // ========================================
  // TEST SUITE 1: INPUT VALIDATION
  // ========================================

  describe('updateTeam - Input Validation', () => {

    test('should reject null teamId', async () => {
      const result = await granularStorage.updateTeam(null, { name: 'Test' }, 'user');

      expect(result.success).toBe(false);
      expect(result.message).toContain('Team ID is required');
    });

    test('should reject undefined teamId', async () => {
      const result = await granularStorage.updateTeam(undefined, { name: 'Test' }, 'user');

      expect(result.success).toBe(false);
      expect(result.message).toContain('Team ID is required');
    });

    test('should reject string teamId', async () => {
      const result = await granularStorage.updateTeam('123', { name: 'Test' }, 'user');

      expect(result.success).toBe(false);
      expect(result.message).toContain('must be a number');
    });

    test('should reject empty updates object', async () => {
      const result = await granularStorage.updateTeam(1, {}, 'user');

      expect(result.success).toBe(false);
      expect(result.message).toContain('cannot be empty');
    });

    test('should reject null updates object', async () => {
      const result = await granularStorage.updateTeam(1, null, 'user');

      expect(result.success).toBe(false);
      expect(result.message).toContain('Updates object is required');
    });

    test('should reject empty team name', async () => {
      const result = await granularStorage.updateTeam(1, { name: '' }, 'user');

      expect(result.success).toBe(false);
      expect(result.message).toContain('name cannot be empty');
    });

    test('should reject team name with only spaces', async () => {
      const result = await granularStorage.updateTeam(1, { name: '   ' }, 'user');

      expect(result.success).toBe(false);
      expect(result.message).toContain('name cannot be empty');
    });

    test('should reject team name over 100 characters', async () => {
      const longName = 'A'.repeat(101);
      const result = await granularStorage.updateTeam(1, { name: longName }, 'user');

      expect(result.success).toBe(false);
      expect(result.message).toContain('cannot exceed 100 characters');
    });

    test('should reject attempt to change team ID', async () => {
      const result = await granularStorage.updateTeam(1, { id: 999 }, 'user');

      expect(result.success).toBe(false);
      expect(result.message).toContain('Cannot change team ID');
    });
  });

  // ========================================
  // TEST SUITE 2: PLAYER VALIDATION
  // ========================================

  describe('updatePlayer - Input Validation', () => {

    test('should reject invalid NTRP rating (too low)', async () => {
      const result = await granularStorage.updatePlayer(1, { ntrpRating: 2.0 }, 'user');

      expect(result.success).toBe(false);
      expect(result.message).toContain('Invalid NTRP rating');
      expect(result.message).toContain('2.5 and 5.5');
    });

    test('should reject invalid NTRP rating (too high)', async () => {
      const result = await granularStorage.updatePlayer(1, { ntrpRating: 6.0 }, 'user');

      expect(result.success).toBe(false);
      expect(result.message).toContain('Invalid NTRP rating');
    });

    test('should reject non-numeric NTRP rating', async () => {
      const result = await granularStorage.updatePlayer(1, { ntrpRating: 'invalid' }, 'user');

      expect(result.success).toBe(false);
      expect(result.message).toContain('Invalid NTRP rating');
    });

    test('should reject empty first name', async () => {
      const result = await granularStorage.updatePlayer(1, { firstName: '' }, 'user');

      expect(result.success).toBe(false);
      expect(result.message).toContain('First name cannot be empty');
    });

    test('should reject empty last name', async () => {
      const result = await granularStorage.updatePlayer(1, { lastName: '' }, 'user');

      expect(result.success).toBe(false);
      expect(result.message).toContain('Last name cannot be empty');
    });

    test('should accept valid NTRP ratings', async () => {
      const validRatings = [2.5, 3.0, 3.5, 4.0, 4.5, 5.0, 5.5];

      for (const rating of validRatings) {
        // Mock Firestore to return a valid player
        const mockGetDoc = jest.fn().mockResolvedValue({
          exists: () => true,
          data: () => ({ id: 1, firstName: 'John', lastName: 'Doe', ntrpRating: 3.5 })
        });

        const result = await granularStorage.updatePlayer(1, { ntrpRating: rating }, 'user');

        // Should not fail validation (Firestore update might fail if mocked incorrectly)
        if (!result.success) {
          expect(result.message).not.toContain('Invalid NTRP rating');
        }
      }
    });
  });

  // ========================================
  // TEST SUITE 3: ENTITY EXISTENCE
  // ========================================

  describe('Entity Existence Checks', () => {

    test('should reject update to non-existent team', async () => {
      // Mock Firestore to return non-existent team
      const mockGetDoc = jest.fn().mockResolvedValue({
        exists: () => false
      });

      const result = await granularStorage.updateTeam(999, { name: 'Test' }, 'user');

      expect(result.success).toBe(false);
      expect(result.message).toContain('does not exist');
    });

    test('should reject update to non-existent player', async () => {
      // Mock Firestore to return non-existent player
      const mockGetDoc = jest.fn().mockResolvedValue({
        exists: () => false
      });

      const result = await granularStorage.updatePlayer(999, { ntrpRating: 4.0 }, 'user');

      expect(result.success).toBe(false);
      expect(result.message).toContain('does not exist');
    });
  });

  // ========================================
  // TEST SUITE 4: AUDIT TRAIL
  // ========================================

  describe('Audit Trail', () => {

    test('should add updatedBy field', async () => {
      // Mock successful update
      const mockUpdateDoc = jest.fn().mockResolvedValue(undefined);

      const result = await granularStorage.updateTeam(1, { name: 'Test' }, 'john_director');

      // Verify updatedBy is included
      expect(mockUpdateDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          updatedBy: 'john_director'
        })
      );
    });

    test('should add updatedAt timestamp', async () => {
      const mockUpdateDoc = jest.fn().mockResolvedValue(undefined);

      const result = await granularStorage.updateTeam(1, { name: 'Test' }, 'user');

      // Verify updatedAt is included (serverTimestamp)
      expect(mockUpdateDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          updatedAt: expect.anything()
        })
      );
    });
  });
});

// ========================================
// TEST SUITE 5: SAFE AUTO-SAVE WITH ROLLBACK
// ========================================

describe('safeAutoSave - Rollback Mechanism', () => {

  test('should rollback on update failure', async () => {
    // Mock: getTeam returns original data
    jest.spyOn(granularStorage, 'getTeam').mockResolvedValue({
      id: 1,
      name: 'Original Name',
      captainId: null,
      color: '#FF0000'
    });

    // Mock: first updateTeam fails
    let callCount = 0;
    jest.spyOn(granularStorage, 'updateTeam').mockImplementation(async (teamId, updates) => {
      callCount++;
      if (callCount === 1) {
        // First call fails
        return { success: false, message: 'Network error' };
      } else {
        // Second call (rollback) succeeds
        return { success: true };
      }
    });

    const result = await safeAutoSave.updateTeam(1, { name: 'New Name' }, 'user');

    expect(result.success).toBe(false);
    expect(result.rolledBack).toBe(true);
    expect(result.message).toContain('rolled back');

    // Verify rollback was called with original data
    expect(granularStorage.updateTeam).toHaveBeenCalledWith(
      1,
      expect.objectContaining({ name: 'Original Name' }),
      'Rollback-System'
    );
  });

  test('should handle rollback failure', async () => {
    // Mock: getTeam returns original data
    jest.spyOn(granularStorage, 'getTeam').mockResolvedValue({
      id: 1,
      name: 'Original Name'
    });

    // Mock: both update and rollback fail
    jest.spyOn(granularStorage, 'updateTeam').mockResolvedValue({
      success: false,
      message: 'Error'
    });

    const result = await safeAutoSave.updateTeam(1, { name: 'New Name' }, 'user');

    expect(result.success).toBe(false);
    expect(result.rolledBack).toBe(false);
    expect(result.rollbackError).toBeDefined();
  });
});

// ========================================
// TEST SUITE 6: MIGRATION
// ========================================

describe('Migration Utilities', () => {

  test('should reject non-array input', async () => {
    const result = await granularStorage.migrateTeamsToGranular('not an array');

    expect(result.success).toBe(false);
    expect(result.message).toContain('must be an array');
  });

  test('should handle teams with missing required fields', async () => {
    const invalidTeams = [
      { id: 1, name: 'Valid' },
      { id: 2 }, // Missing name
      { name: 'Missing ID' } // Missing ID
    ];

    const result = await granularStorage.migrateTeamsToGranular(invalidTeams);

    expect(result.migrated).toBe(1); // Only 1 valid team
    expect(result.errors).toBe(2); // 2 invalid teams
    expect(result.errorDetails).toHaveLength(2);
  });

  test('should batch large migrations', async () => {
    // Create 1000 teams
    const teams = Array.from({ length: 1000 }, (_, i) => ({
      id: i + 1,
      name: `Team ${i + 1}`,
      captainId: null,
      color: '#000000'
    }));

    const result = await granularStorage.migrateTeamsToGranular(teams);

    expect(result.migrated).toBe(1000);
    expect(result.errors).toBe(0);
  });
});
```

---

## 🔗 INTEGRATION TESTS

### Test File: `src/services/__tests__/granularStorage.integration.test.js`

These tests use a **real Firestore emulator** (not mocks):

```javascript
import { granularStorage, safeAutoSave } from '../granularStorage';
import { initializeTestEnvironment } from '@firebase/rules-unit-testing';

let testEnv;

beforeAll(async () => {
  // Initialize Firestore emulator
  testEnv = await initializeTestEnvironment({
    projectId: 'demo-conquest-creek-test',
    firestore: {
      host: 'localhost',
      port: 8080
    }
  });
});

afterAll(async () => {
  await testEnv.cleanup();
});

describe('Integration Tests - Real Firestore Operations', () => {

  // ========================================
  // TEST 1: FULL TEAM UPDATE WORKFLOW
  // ========================================

  test('should create, update, and delete team', async () => {
    const teamData = {
      id: 1001,
      name: 'Test Warriors',
      captainId: null,
      color: '#FF0000',
      bonuses: {
        uniformType: 'none',
        uniformPhotoSubmitted: false,
        practices: {}
      }
    };

    // Step 1: Create team
    const createResult = await granularStorage.createTeam(teamData, 'test_user');
    expect(createResult.success).toBe(true);

    // Step 2: Verify team exists
    const team = await granularStorage.getTeam(1001);
    expect(team).toBeDefined();
    expect(team.name).toBe('Test Warriors');
    expect(team.updatedBy).toBe('test_user');

    // Step 3: Update team
    const updateResult = await granularStorage.updateTeam(
      1001,
      { name: 'Updated Warriors' },
      'test_user'
    );
    expect(updateResult.success).toBe(true);

    // Step 4: Verify update
    const updatedTeam = await granularStorage.getTeam(1001);
    expect(updatedTeam.name).toBe('Updated Warriors');

    // Step 5: Delete team
    const deleteResult = await granularStorage.deleteTeam(1001, 'test_user');
    expect(deleteResult.success).toBe(true);

    // Step 6: Verify deletion
    const deletedTeam = await granularStorage.getTeam(1001);
    expect(deletedTeam).toBeNull();
  });

  // ========================================
  // TEST 2: CONCURRENT UPDATES
  // ========================================

  test('should handle concurrent updates correctly', async () => {
    // Create initial team
    await granularStorage.createTeam({
      id: 2001,
      name: 'Concurrent Test',
      captainId: null,
      color: '#000000'
    }, 'user1');

    // Simulate concurrent updates from two users
    const update1 = granularStorage.updateTeam(2001, { name: 'User 1 Name' }, 'user1');
    const update2 = granularStorage.updateTeam(2001, { color: '#FF0000' }, 'user2');

    const [result1, result2] = await Promise.all([update1, update2]);

    // Both updates should succeed (different fields)
    expect(result1.success).toBe(true);
    expect(result2.success).toBe(true);

    // Verify final state
    const finalTeam = await granularStorage.getTeam(2001);
    expect(finalTeam.name).toBe('User 1 Name');
    expect(finalTeam.color).toBe('#FF0000');

    // Cleanup
    await granularStorage.deleteTeam(2001, 'cleanup');
  });

  // ========================================
  // TEST 3: ROLLBACK ON ERROR
  // ========================================

  test('should rollback on update failure', async () => {
    // Create initial team
    await granularStorage.createTeam({
      id: 3001,
      name: 'Rollback Test',
      captainId: null,
      color: '#000000'
    }, 'user');

    // Force an error by using invalid data
    const result = await safeAutoSave.updateTeam(
      3001,
      { name: '' }, // Empty name should fail validation
      'user'
    );

    expect(result.success).toBe(false);

    // Verify original data is preserved
    const team = await granularStorage.getTeam(3001);
    expect(team.name).toBe('Rollback Test'); // Should still be original

    // Cleanup
    await granularStorage.deleteTeam(3001, 'cleanup');
  });

  // ========================================
  // TEST 4: METADATA TRACKING
  // ========================================

  test('should update metadata counts correctly', async () => {
    const initialCount = await granularStorage.getEntityCount('teams');

    // Create 3 teams
    await granularStorage.createTeam({ id: 4001, name: 'Team 1' }, 'user');
    await granularStorage.createTeam({ id: 4002, name: 'Team 2' }, 'user');
    await granularStorage.createTeam({ id: 4003, name: 'Team 3' }, 'user');

    const afterCreateCount = await granularStorage.getEntityCount('teams');
    expect(afterCreateCount).toBe(initialCount + 3);

    // Delete 1 team
    await granularStorage.deleteTeam(4001, 'user');

    const afterDeleteCount = await granularStorage.getEntityCount('teams');
    expect(afterDeleteCount).toBe(initialCount + 2);

    // Cleanup
    await granularStorage.deleteTeam(4002, 'cleanup');
    await granularStorage.deleteTeam(4003, 'cleanup');
  });

  // ========================================
  // TEST 5: ISOLATION - Cannot affect other entities
  // ========================================

  test('updating one team should NOT affect other teams', async () => {
    // Create 3 teams
    await granularStorage.createTeam({ id: 5001, name: 'Team A', color: '#000000' }, 'user');
    await granularStorage.createTeam({ id: 5002, name: 'Team B', color: '#111111' }, 'user');
    await granularStorage.createTeam({ id: 5003, name: 'Team C', color: '#222222' }, 'user');

    // Get original state
    const teamB_before = await granularStorage.getTeam(5002);
    const teamC_before = await granularStorage.getTeam(5003);

    // Update Team A
    await granularStorage.updateTeam(5001, { name: 'Team A Updated', color: '#FF0000' }, 'user');

    // Verify Team B and C are unchanged
    const teamB_after = await granularStorage.getTeam(5002);
    const teamC_after = await granularStorage.getTeam(5003);

    expect(teamB_after.name).toBe(teamB_before.name);
    expect(teamB_after.color).toBe(teamB_before.color);
    expect(teamC_after.name).toBe(teamC_before.name);
    expect(teamC_after.color).toBe(teamC_before.color);

    // Cleanup
    await granularStorage.deleteTeam(5001, 'cleanup');
    await granularStorage.deleteTeam(5002, 'cleanup');
    await granularStorage.deleteTeam(5003, 'cleanup');
  });
});
```

---

## 💥 CHAOS TESTING

### Goal: **Actively try to break the system**

These tests should **intentionally attempt to cause data loss**:

```javascript
describe('CHAOS TESTS - Try to Break the System', () => {

  // ========================================
  // CHAOS TEST 1: Try to wipe database
  // ========================================

  test('CHAOS: Attempt to wipe all teams (should be impossible)', async () => {
    // Setup: Create 5 teams
    for (let i = 1; i <= 5; i++) {
      await granularStorage.createTeam({
        id: 6000 + i,
        name: `Team ${i}`,
        captainId: null,
        color: '#000000'
      }, 'chaos_test');
    }

    // ATTACK: Try to delete all teams by passing empty array
    // (This was the bug that caused data loss in blob storage)
    try {
      // This should NOT be possible with granular storage
      // There's no "setAllTeams([]) operation"

      // Try individual deletes with invalid IDs
      await granularStorage.deleteTeam(null, 'attacker');
      await granularStorage.deleteTeam(undefined, 'attacker');
      await granularStorage.deleteTeam('invalid', 'attacker');

    } catch (error) {
      // Expected to fail
    }

    // VERIFY: All teams should still exist
    const teams = await granularStorage.getAllTeams();
    const chaosTeams = teams.filter(t => t.id >= 6001 && t.id <= 6005);

    expect(chaosTeams).toHaveLength(5);
    expect(chaosTeams.every(t => t.name.startsWith('Team'))).toBe(true);

    // Cleanup
    for (let i = 1; i <= 5; i++) {
      await granularStorage.deleteTeam(6000 + i, 'cleanup');
    }
  });

  // ========================================
  // CHAOS TEST 2: Rapid concurrent updates
  // ========================================

  test('CHAOS: 100 rapid concurrent updates to same team', async () => {
    // Setup
    await granularStorage.createTeam({
      id: 7001,
      name: 'Chaos Target',
      captainId: null,
      color: '#000000'
    }, 'chaos_test');

    // ATTACK: 100 concurrent updates
    const updates = [];
    for (let i = 0; i < 100; i++) {
      updates.push(
        granularStorage.updateTeam(7001, { name: `Update ${i}` }, `user${i}`)
      );
    }

    const results = await Promise.all(updates);

    // VERIFY: All updates should succeed or fail gracefully
    const successCount = results.filter(r => r.success).length;
    const failCount = results.filter(r => !r.success).length;

    console.log(`✅ Succeeded: ${successCount}, ❌ Failed: ${failCount}`);

    // At least some should succeed
    expect(successCount).toBeGreaterThan(0);

    // Team should still exist with valid data
    const finalTeam = await granularStorage.getTeam(7001);
    expect(finalTeam).toBeDefined();
    expect(finalTeam.name).toMatch(/Update \d+/);

    // Cleanup
    await granularStorage.deleteTeam(7001, 'cleanup');
  });

  // ========================================
  // CHAOS TEST 3: Invalid data injection
  // ========================================

  test('CHAOS: Inject malformed data (should be rejected)', async () => {
    const malformedData = [
      { id: 8001, name: null }, // Null name
      { id: 8002, name: undefined }, // Undefined name
      { id: 8003, name: 123 }, // Number instead of string
      { id: 8004, name: {} }, // Object instead of string
      { id: 8005, name: [] }, // Array instead of string
      { id: 8006, name: '<script>alert("xss")</script>' }, // XSS attempt
      { id: 8007, name: '../../../etc/passwd' }, // Path traversal
      { id: 8008, name: 'A'.repeat(10000) }, // Extremely long name
    ];

    // ATTACK: Try to create teams with malformed data
    const results = await Promise.all(
      malformedData.map(data => granularStorage.createTeam(data, 'attacker'))
    );

    // VERIFY: All should fail
    const allFailed = results.every(r => r.success === false);
    expect(allFailed).toBe(true);

    // VERIFY: No malformed teams exist in database
    const teams = await granularStorage.getAllTeams();
    const attackTeams = teams.filter(t => t.id >= 8001 && t.id <= 8008);
    expect(attackTeams).toHaveLength(0);
  });

  // ========================================
  // CHAOS TEST 4: Network interruption simulation
  // ========================================

  test('CHAOS: Simulate network failure during update', async () => {
    // Setup
    await granularStorage.createTeam({
      id: 9001,
      name: 'Network Test',
      captainId: null,
      color: '#000000'
    }, 'chaos_test');

    // Mock Firestore to simulate network error
    const originalUpdateDoc = granularStorage.updateTeam;
    jest.spyOn(granularStorage, 'updateTeam').mockRejectedValueOnce(
      new Error('Network error: UNAVAILABLE')
    );

    // ATTACK: Update during "network failure"
    let updateResult;
    try {
      updateResult = await safeAutoSave.updateTeam(9001, { name: 'Failed Update' }, 'user');
    } catch (error) {
      // Should not throw - should handle gracefully
    }

    // VERIFY: Original data should be preserved
    const team = await granularStorage.getTeam(9001);
    expect(team.name).toBe('Network Test'); // Original name

    // Restore original function
    jest.restoreAllMocks();

    // Cleanup
    await granularStorage.deleteTeam(9001, 'cleanup');
  });

  // ========================================
  // CHAOS TEST 5: Memory corruption simulation
  // ========================================

  test('CHAOS: Simulate corrupted local state (should not affect database)', async () => {
    // Setup: Create 3 teams
    await granularStorage.createTeam({ id: 10001, name: 'Safe 1' }, 'user');
    await granularStorage.createTeam({ id: 10002, name: 'Safe 2' }, 'user');
    await granularStorage.createTeam({ id: 10003, name: 'Safe 3' }, 'user');

    // Simulate bug: Local state becomes corrupted/empty
    // In the old blob system, this would wipe the database
    // With granular storage, this cannot happen

    // ATTACK: Try to "save" empty state (not possible with granular)
    // There's no way to overwrite all teams at once

    // Even if we try to delete teams with invalid data:
    try {
      await granularStorage.deleteTeam(null, 'attacker');
      await granularStorage.deleteTeam([], 'attacker');
      await granularStorage.deleteTeam({}, 'attacker');
    } catch (error) {
      // Expected to fail
    }

    // VERIFY: All teams still exist
    const team1 = await granularStorage.getTeam(10001);
    const team2 = await granularStorage.getTeam(10002);
    const team3 = await granularStorage.getTeam(10003);

    expect(team1.name).toBe('Safe 1');
    expect(team2.name).toBe('Safe 2');
    expect(team3.name).toBe('Safe 3');

    // Cleanup
    await granularStorage.deleteTeam(10001, 'cleanup');
    await granularStorage.deleteTeam(10002, 'cleanup');
    await granularStorage.deleteTeam(10003, 'cleanup');
  });
});
```

---

## 🧑‍💻 MANUAL TESTING PROCEDURES

### Pre-Migration Testing Checklist

#### Test Environment Setup
```bash
# 1. Start Firestore emulator
npm install -g firebase-tools
firebase emulators:start --only firestore

# 2. Run application against emulator
export FIRESTORE_EMULATOR_HOST="localhost:8080"
npm run dev

# 3. Verify connection
# Check browser console for: "Using Firestore emulator"
```

#### Manual Test Cases

**TEST 1: Basic Team Update**
```
✅ Steps:
1. Login as director
2. Go to Teams Management page
3. Create a new team "Test Warriors"
4. Edit team name inline to "Warriors Updated"
5. Refresh page (F5)

✅ Expected Result:
- Team name should be "Warriors Updated" after refresh
- No errors in console
- Other teams should be unchanged

❌ Failure Condition:
- Team reverts to old name
- Error in console
- Other teams affected
```

**TEST 2: Rapid Team Name Changes**
```
✅ Steps:
1. Create team "Rapid Test"
2. Quickly edit name 5 times:
   - "Rapid Test 1"
   - "Rapid Test 2"
   - "Rapid Test 3"
   - "Rapid Test 4"
   - "Rapid Test 5"
3. Wait 3 seconds
4. Refresh page

✅ Expected Result:
- Final name should be "Rapid Test 5"
- No data loss
- No errors

❌ Failure Condition:
- Name is not "Rapid Test 5"
- Console errors
- Auto-save conflicts
```

**TEST 3: Concurrent Multi-User Updates**
```
✅ Steps:
1. Open app in two different browsers (Chrome + Firefox)
2. Login as different directors in each
3. Both users edit same team name simultaneously
4. Both users save at nearly same time

✅ Expected Result:
- Last save wins (Firestore handles this)
- No data corruption
- Both users see final state after refresh

❌ Failure Condition:
- Data corruption
- Team deleted
- Errors in console
```

**TEST 4: Network Interruption**
```
✅ Steps:
1. Open browser DevTools → Network tab
2. Edit team name to "Network Test"
3. While saving, set network to "Offline" in DevTools
4. Wait for save to fail
5. Set network back to "Online"
6. Refresh page

✅ Expected Result:
- Save fails with error message
- Original team name preserved
- Can retry save after network restored

❌ Failure Condition:
- Data corrupted
- Team deleted
- Cannot recover
```

**TEST 5: Validation Tests**
```
✅ Steps:
Try these invalid inputs (all should be rejected):

1. Empty team name: ""
2. Very long name: "A" × 200 characters
3. Special characters: "<script>alert(1)</script>"
4. Null/undefined values
5. Invalid NTRP rating: 1.5
6. Invalid NTRP rating: 6.0

✅ Expected Result:
- All rejected with clear error messages
- No data saved to database
- Form validation prevents submission

❌ Failure Condition:
- Invalid data accepted
- Data saved to database
- No error message
```

**TEST 6: Cannot Wipe Database**
```
✅ Steps:
1. Create 8 teams (full league)
2. Open browser console
3. Try to manually corrupt data:
   ```javascript
   // Try to wipe all teams (should be impossible)
   const teams = [];
   // There's no way to save this with granular storage!
   ```
4. Verify all teams still exist

✅ Expected Result:
- No way to overwrite all teams at once
- Each team is protected independently
- Cannot cause database wipe

❌ Failure Condition:
- Found a way to wipe database
- Multiple teams deleted at once
```

---

## ⚡ PERFORMANCE TESTING

### Load Testing Script

```javascript
// performance-test.js
import { granularStorage } from './src/services/granularStorage.js';

async function runPerformanceTest() {
  console.log('🚀 Starting performance test...\n');

  // TEST 1: Bulk create performance
  console.log('Test 1: Bulk Create 100 Teams');
  const createStart = Date.now();

  const createPromises = [];
  for (let i = 1; i <= 100; i++) {
    createPromises.push(
      granularStorage.createTeam({
        id: 20000 + i,
        name: `Perf Test Team ${i}`,
        captainId: null,
        color: '#000000'
      }, 'perf_test')
    );
  }

  await Promise.all(createPromises);
  const createDuration = Date.now() - createStart;
  console.log(`✅ Created 100 teams in ${createDuration}ms`);
  console.log(`   Average: ${(createDuration / 100).toFixed(2)}ms per team\n`);

  // TEST 2: Bulk read performance
  console.log('Test 2: Read All Teams');
  const readStart = Date.now();

  const allTeams = await granularStorage.getAllTeams();
  const readDuration = Date.now() - readStart;

  console.log(`✅ Read ${allTeams.length} teams in ${readDuration}ms`);
  console.log(`   Average: ${(readDuration / allTeams.length).toFixed(2)}ms per team\n`);

  // TEST 3: Individual update performance
  console.log('Test 3: 100 Individual Updates');
  const updateStart = Date.now();

  const updatePromises = [];
  for (let i = 1; i <= 100; i++) {
    updatePromises.push(
      granularStorage.updateTeam(
        20000 + i,
        { name: `Updated Team ${i}` },
        'perf_test'
      )
    );
  }

  const updateResults = await Promise.all(updatePromises);
  const updateDuration = Date.now() - updateStart;
  const successCount = updateResults.filter(r => r.success).length;

  console.log(`✅ Updated ${successCount}/100 teams in ${updateDuration}ms`);
  console.log(`   Average: ${(updateDuration / 100).toFixed(2)}ms per update\n`);

  // TEST 4: Cleanup performance
  console.log('Test 4: Bulk Delete 100 Teams');
  const deleteStart = Date.now();

  const deletePromises = [];
  for (let i = 1; i <= 100; i++) {
    deletePromises.push(
      granularStorage.deleteTeam(20000 + i, 'perf_test')
    );
  }

  await Promise.all(deletePromises);
  const deleteDuration = Date.now() - deleteStart;

  console.log(`✅ Deleted 100 teams in ${deleteDuration}ms`);
  console.log(`   Average: ${(deleteDuration / 100).toFixed(2)}ms per delete\n`);

  // SUMMARY
  console.log('📊 PERFORMANCE SUMMARY:');
  console.log(`   Total time: ${createDuration + readDuration + updateDuration + deleteDuration}ms`);
  console.log(`   Create avg: ${(createDuration / 100).toFixed(2)}ms`);
  console.log(`   Read avg: ${(readDuration / allTeams.length).toFixed(2)}ms`);
  console.log(`   Update avg: ${(updateDuration / 100).toFixed(2)}ms`);
  console.log(`   Delete avg: ${(deleteDuration / 100).toFixed(2)}ms`);
}

runPerformanceTest().then(() => {
  console.log('\n✅ Performance test complete!');
  process.exit(0);
}).catch(error => {
  console.error('❌ Performance test failed:', error);
  process.exit(1);
});
```

**Run performance test:**
```bash
node performance-test.js
```

**Acceptance Criteria:**
- Create: < 100ms per team average
- Read: < 50ms per team average
- Update: < 100ms per team average
- Delete: < 100ms per team average

---

## 🔄 MIGRATION TESTING

### Migration Test Plan

**Phase 1: Dry Run**
```bash
# Preview migration without changes
node migrate-to-granular.js --dry-run

# Expected output:
# ✅ Would migrate X teams
# ✅ Would migrate Y players
# ✅ All validation checks passed
```

**Phase 2: Test Database Migration**
```bash
# 1. Backup test database
firebase firestore:export backup-test-$(date +%Y%m%d)

# 2. Run migration
node migrate-to-granular.js --migrate

# 3. Verify migration
node migrate-to-granular.js --verify

# Expected output:
# ✅ Teams count matches
# ✅ Players count matches
# ✅ Sample data verified
```

**Phase 3: Application Testing**
```
After migration:
1. Load application
2. Verify all teams display correctly
3. Verify all players display correctly
4. Test team name update
5. Test player NTRP update
6. Verify data persists after refresh
7. Check browser console for errors
```

**Phase 4: Production Migration**
```bash
# 1. BACKUP PRODUCTION DATABASE
firebase firestore:export backup-prod-$(date +%Y%m%d)

# 2. Schedule maintenance window
# Notify users app will be read-only for 30 minutes

# 3. Perform migration
node migrate-to-granular.js --migrate

# 4. Verify immediately
node migrate-to-granular.js --verify

# 5. If issues detected:
#    - Revert to blob storage reads
#    - Investigate issues
#    - Fix and retry

# 6. Monitor for 24 hours
#    - Watch error logs
#    - Check user reports
#    - Verify data integrity
```

---

## 📊 PRODUCTION MONITORING

### Monitoring Checklist

**Week 1: Post-Migration Monitoring**
- [ ] Monitor Firestore reads/writes (should decrease with granular)
- [ ] Check error logs for save failures
- [ ] Verify auto-save success rate > 99%
- [ ] Monitor user feedback for issues
- [ ] Check data integrity daily

**Metrics to Track:**
```javascript
// Auto-save success metrics
{
  "auto_save": {
    "total_attempts": 1250,
    "successful": 1247,
    "failed": 3,
    "success_rate": "99.76%",
    "avg_duration_ms": 85,
    "rollbacks": 2
  }
}
```

**Alert Thresholds:**
- ⚠️ Warning: Success rate < 99%
- 🚨 Critical: Success rate < 95%
- 🚨 Critical: Any database wipe attempt detected

**Daily Checks:**
```sql
-- Check team count hasn't decreased
SELECT COUNT(*) FROM teams;
-- Should be stable or increasing

-- Check for orphaned players
SELECT COUNT(*) FROM players WHERE teamId NOT IN (SELECT id FROM teams);
-- Should be 0 or low

-- Check recent updates
SELECT updatedAt, updatedBy FROM teams ORDER BY updatedAt DESC LIMIT 10;
-- Should show recent activity
```

---

## ✅ TEST COMPLETION CHECKLIST

Before enabling auto-save in production:

### Unit Tests
- [ ] All input validation tests pass (20+ tests)
- [ ] All entity existence tests pass
- [ ] All audit trail tests pass
- [ ] All rollback tests pass
- [ ] Code coverage > 90%

### Integration Tests
- [ ] Full CRUD workflow tests pass
- [ ] Concurrent update tests pass
- [ ] Rollback integration tests pass
- [ ] Metadata tracking tests pass
- [ ] Isolation tests pass (cannot affect other entities)

### Chaos Tests
- [ ] Cannot wipe database (attempted and failed)
- [ ] Handles 100 concurrent updates
- [ ] Rejects all malformed data
- [ ] Handles network failures gracefully
- [ ] Protects against corrupted local state

### Manual Tests
- [ ] Basic team update works
- [ ] Rapid changes handled correctly
- [ ] Multi-user concurrent updates work
- [ ] Network interruption handled
- [ ] Validation rejects invalid data
- [ ] Cannot find way to wipe database

### Performance Tests
- [ ] Create performance acceptable (< 100ms avg)
- [ ] Read performance acceptable (< 50ms avg)
- [ ] Update performance acceptable (< 100ms avg)
- [ ] No performance degradation vs blob storage

### Migration Tests
- [ ] Dry run completes successfully
- [ ] Test migration completes successfully
- [ ] Verification passes all checks
- [ ] Application works with granular storage
- [ ] Data integrity confirmed

### Production Readiness
- [ ] Monitoring dashboards set up
- [ ] Alert thresholds configured
- [ ] Rollback plan documented
- [ ] Team trained on new system
- [ ] Stakeholders approve go-live

---

## 🎓 TESTING PHILOSOPHY

**Remember:** The goal is not just to prove it works, but to **prove it cannot break**.

**Test like an attacker:**
- Don't just test happy paths
- Actively try to cause data loss
- Test worst-case scenarios
- Think "how could this go wrong?"

**When tests pass:**
- ✅ Validation works correctly
- ✅ Rollback mechanism works
- ✅ Cannot wipe database by design
- ✅ System is bulletproof

**Only then enable auto-save in production.**

---

**Next Step:** Run the unit tests and chaos tests to prove the system is unbreakable!
