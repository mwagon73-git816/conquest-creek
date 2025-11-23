# Timestamp Validation Implementation Guide

## Overview

This guide shows how to implement timestamp-based optimistic concurrency control to prevent users from overwriting each other's changes.

## Problem

Without timestamp validation:
1. User A loads a team/match/challenge to edit
2. User B makes changes and saves
3. User A saves their changes, **unknowingly overwriting User B's work**
4. Data loss occurs with "last write wins"

## Solution

Check if data has been modified since the user loaded it, and warn them before allowing the save.

## Architecture

### 1. Storage Layer (storage.js)

Three new functions added to `tournamentStorage`:

- **`validateTimestamp(collectionName, expectedVersion)`**
  - Checks if data has been modified
  - Returns `{valid, currentVersion, message}`

- **`saveWithValidation(collectionName, data, expectedVersion, force)`**
  - Validates timestamp before saving
  - Returns `{success, conflict, version, message}`

- **`logConflict(entityType, entityId, userAttempting, action)`**
  - Logs conflict events to activity log

### 2. React Hook (useTimestampValidation.js)

Custom hook providing:
- `recordLoad(timestamp, modifiedBy)` - Record when data was loaded
- `validateBeforeSave(currentTimestamp, currentModifiedBy, onRefresh)` - Check and prompt user
- `hasDataChanged(currentTimestamp)` - Boolean check
- `reset(newTimestamp)` - Update after successful save
- `clear()` - Clear validation state

### 3. UI Components

- `TimestampDisplay` component shows "Last updated: X minutes ago by User"
- `formatTimestamp()` utility for friendly time formatting

## Implementation Pattern

### Step 1: Add Hook to Component

```javascript
import { useTimestampValidation } from '../hooks/useTimestampValidation';

const MyComponent = ({ teams, setTeams, loginName }) => {
  const teamValidation = useTimestampValidation('team');
  const [teams, setTeams] = useState([]);
  const [teamsVersion, setTeamsVersion] = useState(null);

  // ... rest of component
};
```

### Step 2: Record Timestamp on Load

```javascript
useEffect(() => {
  const loadData = async () => {
    const teamsData = await tournamentStorage.getTeams();
    if (teamsData) {
      setTeams(JSON.parse(teamsData.data));
      setTeamsVersion(teamsData.updatedAt);
      teamValidation.recordLoad(teamsData.updatedAt, null);
    }
  };
  loadData();
}, []);
```

### Step 3: Validate Before Save

```javascript
const handleSaveTeam = async () => {
  // 1. Get current version from Firestore
  const currentVersion = await tournamentStorage.getDataVersion('teams');

  // 2. Validate with user prompt if conflict
  const shouldProceed = await teamValidation.validateBeforeSave(
    currentVersion,
    null, // or username if tracked
    async () => {
      // Refresh callback - reload fresh data
      const freshData = await tournamentStorage.getTeams();
      setTeams(JSON.parse(freshData.data));
      setTeamsVersion(freshData.updatedAt);
      teamValidation.recordLoad(freshData.updatedAt, null);
    }
  );

  // 3. If user chose to reload, stop here
  if (!shouldProceed) {
    return;
  }

  // 4. Save with validation
  const result = await tournamentStorage.saveWithValidation(
    'teams',
    updatedTeams,
    teamsVersion,
    false // set to true to force overwrite
  );

  // 5. Handle result
  if (result.conflict) {
    alert(`⚠️ Conflict: ${result.message}`);
    return;
  }

  if (result.success) {
    // Update local state with new version
    setTeamsVersion(result.version);
    teamValidation.reset(result.version, loginName);
    alert('✅ Team saved successfully!');
  } else {
    alert(`❌ Save failed: ${result.message}`);
  }
};
```

### Step 4: Add Timestamp Display (Optional)

```javascript
import { TimestampDisplay } from '../hooks/useTimestampValidation';

// In your JSX:
<TimestampDisplay
  timestamp={teamsVersion}
  updatedBy={null}
  className="mt-2"
/>
```

## Complete Example: Team Edit with Validation

```javascript
import React, { useState, useEffect } from 'react';
import { tournamentStorage } from '../services/storage';
import { useTimestampValidation, TimestampDisplay } from '../hooks/useTimestampValidation';

const TeamsManagement = ({ teams, setTeams, loginName }) => {
  const [teamsVersion, setTeamsVersion] = useState(null);
  const [editingTeam, setEditingTeam] = useState(null);
  const teamValidation = useTimestampValidation('team');

  // Load teams with timestamp tracking
  useEffect(() => {
    const loadTeams = async () => {
      const teamsData = await tournamentStorage.getTeams();
      if (teamsData) {
        setTeams(JSON.parse(teamsData.data));
        setTeamsVersion(teamsData.updatedAt);
        teamValidation.recordLoad(teamsData.updatedAt);
        console.log('📋 Teams loaded at:', teamsData.updatedAt);
      }
    };
    loadTeams();
  }, []);

  const handleSaveTeam = async () => {
    if (!editingTeam) return;

    try {
      // 1. Get current version
      const currentVersion = await tournamentStorage.getDataVersion('teams');
      console.log('🔍 Checking timestamps:', {
        loaded: teamsVersion,
        current: currentVersion
      });

      // 2. Validate with user prompt
      const shouldProceed = await teamValidation.validateBeforeSave(
        currentVersion,
        null,
        async () => {
          // Refresh callback
          console.log('🔄 Reloading teams due to conflict...');
          const freshData = await tournamentStorage.getTeams();
          setTeams(JSON.parse(freshData.data));
          setTeamsVersion(freshData.updatedAt);
          teamValidation.recordLoad(freshData.updatedAt);

          // Log the conflict
          await tournamentStorage.logConflict(
            'team',
            editingTeam.id,
            loginName,
            'reloaded'
          );
        }
      );

      if (!shouldProceed) {
        console.log('❌ Save canceled by user');
        return;
      }

      // 3. Update teams array
      const updatedTeams = teams.map(t =>
        t.id === editingTeam.id ? { ...editingTeam, ...formData } : t
      );

      // 4. Save with validation
      const result = await tournamentStorage.saveWithValidation(
        'teams',
        updatedTeams,
        teamsVersion,
        false
      );

      // 5. Handle result
      if (result.conflict) {
        alert(`⚠️ Conflict: ${result.message}`);

        // Log forced overwrite
        await tournamentStorage.logConflict(
          'team',
          editingTeam.id,
          loginName,
          'conflict_detected'
        );
        return;
      }

      if (result.success) {
        // Success - update state
        setTeams(updatedTeams);
        setTeamsVersion(result.version);
        teamValidation.reset(result.version, loginName);
        setEditingTeam(null);

        alert('✅ Team saved successfully!');
        console.log('✅ Team saved. New version:', result.version);
      } else {
        alert(`❌ Save failed: ${result.message}`);
      }
    } catch (error) {
      console.error('❌ Error saving team:', error);
      alert('❌ Unexpected error saving team. Please try again.');
    }
  };

  return (
    <div>
      <h2>Teams Management</h2>

      {/* Show last updated time */}
      <TimestampDisplay
        timestamp={teamsVersion}
        className="text-sm text-gray-500 mb-4"
      />

      {/* Team form and list... */}

      <button onClick={handleSaveTeam}>
        Save Team
      </button>
    </div>
  );
};
```

## Priority Implementation Order

### High Priority (Implement First)
1. **Team Roster Changes** - High conflict risk, multiple captains editing
2. **Match Results Entry** - Critical data, race condition possible
3. **Player Profile Updates** - Shared resource, might be edited simultaneously

### Medium Priority
4. **Challenge Creation/Edit** (if editable)
5. **Settings/Configuration Changes**

### Low Priority (Already Protected)
6. Challenge Acceptance - Already uses Firestore transactions
7. Match Results Submission - Already uses Firestore transactions

## Testing Scenarios

### Test Case 1: Basic Conflict Detection
1. Open app in two browser tabs
2. In Tab 1: Edit a team name to "Eagles A"
3. In Tab 2: Edit same team name to "Eagles B"
4. In Tab 1: Click Save (should succeed)
5. In Tab 2: Click Save (should detect conflict and prompt)

### Test Case 2: Reload Option
1. Follow Test Case 1 steps 1-4
2. In Tab 2: Click Save
3. In conflict dialog, choose "OK" (reload)
4. Verify Tab 2 now shows "Eagles A"
5. Make new edit to "Eagles C" and save successfully

### Test Case 3: Overwrite Option
1. Follow Test Case 1 steps 1-4
2. In Tab 2: Click Save
3. In conflict dialog, choose "Cancel" (overwrite)
4. Confirm overwrite in second dialog
5. Verify "Eagles B" is now saved (overwrote "Eagles A")
6. Check activity log for conflict event

### Test Case 4: Backwards Compatibility
1. Manually remove `updatedAt` from a team document in Firestore
2. Edit the team in the app
3. Verify save works without errors
4. Verify `updatedAt` is added after save

## Backwards Compatibility

The implementation handles missing timestamps gracefully:

- If `expectedVersion` is `null/undefined`, validation passes (backwards compatible)
- If `currentVersion` is `null/undefined`, validation passes (new data)
- After first save, timestamps are added for future validations

## Logging and Monitoring

All conflicts are logged to the activity log with:
- Entity type and ID
- User attempting the save
- Action taken (reloaded, overwrote, canceled)
- Timestamp

Query conflicts:
```javascript
const conflicts = await tournamentStorage.getActivityLogs();
const conflictEvents = conflicts.filter(log => log.type === 'CONFLICT_DETECTED');
```

## Best Practices

### DO:
✅ Always record timestamp when loading data for editing
✅ Validate before any save operation
✅ Provide clear messaging to users about conflicts
✅ Log conflicts for debugging and monitoring
✅ Offer both reload and overwrite options
✅ Update local state with new version after successful save

### DON'T:
❌ Skip validation for "quick" edits
❌ Force overwrites without user confirmation
❌ Ignore validation errors silently
❌ Forget to update `teamsVersion` after save
❌ Block saves permanently - always offer options

## Future Enhancements

### Phase 2: Granular Field-Level Validation
- Track timestamps per entity, not per collection
- Only conflict if same fields were modified
- Allow concurrent edits of different fields

### Phase 3: Auto-Merge
- Detect non-conflicting changes
- Automatically merge if different fields changed
- Only prompt user for actual conflicts

### Phase 4: Real-time Notifications
- Use Firestore listeners to detect when data changes
- Show banner: "This data has been updated by another user. Reload?"
- Prevent conflicts before they happen

### Phase 5: Lock Mechanism
- "Check out" entities for editing
- Prevent others from editing while someone has it locked
- Auto-release locks after timeout

## Troubleshooting

### "No timestamp provided" warning
- You forgot to call `recordLoad()` when loading data
- Or `teamsVersion` state is not set

### Validation passes when it shouldn't
- Check that `expectedVersion` and `currentVersion` are the same type (string)
- Verify `getDataVersion()` is returning the correct field

### Conflicts not being logged
- Check Firestore rules allow writes to `activity_logs`
- Verify `logConflict()` is being called with correct parameters

### Users always see conflicts
- Check that `teamsVersion` is being updated after saves
- Verify `reset()` is called after successful save

## Additional Resources

- `src/hooks/useTimestampValidation.js` - Hook implementation
- `src/services/storage.js` - Storage layer functions
- Firestore documentation on optimistic concurrency: https://firebase.google.com/docs/firestore/manage-data/transactions

## Questions?

For implementation help or to report issues with timestamp validation, check the activity logs or console for detailed debugging information.
