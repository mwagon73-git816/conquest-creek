# Timestamp Validation - Site-Wide Implementation Roadmap

## Current Status

✅ **Infrastructure Complete:**
- Hook created: `useTimestampValidation.js`
- Storage functions added to `storage.js`
- Documentation written
- Build verified

❌ **Not Yet Implemented:**
- No components currently use the validation
- No timestamp tracking in state
- No UI indicators showing last update times

## What Needs To Be Done

### Phase 1: Core Data Loading (App.jsx)

**File:** `src/App.jsx`

**Current State:** Data is loaded but timestamps are not tracked.

**Changes Needed:**

#### 1.1 Add State for Timestamps
```javascript
// Add these new state variables
const [teamsVersion, setTeamsVersion] = useState(null);
const [playersVersion, setPlayersVersion] = useState(null);
const [challengesVersion, setChallengesVersion] = useState(null);
const [matchesVersion, setMatchesVersion] = useState(null);
```

#### 1.2 Update Load Functions to Track Timestamps
```javascript
// BEFORE:
const loadTeams = async () => {
  const teamsData = await tournamentStorage.getTeams();
  if (teamsData) {
    setTeams(JSON.parse(teamsData.data));
  }
};

// AFTER:
const loadTeams = async () => {
  const teamsData = await tournamentStorage.getTeams();
  if (teamsData) {
    setTeams(JSON.parse(teamsData.data));
    setTeamsVersion(teamsData.updatedAt); // ✅ Track timestamp
    console.log('📋 Teams loaded at:', teamsData.updatedAt);
  }
};
```

Repeat for:
- `loadPlayers()`
- `loadChallenges()`
- `loadMatches()`
- `loadCaptains()`
- `loadBonuses()`

#### 1.3 Pass Versions as Props
```javascript
<TeamsManagement
  teams={teams}
  setTeams={setTeams}
  teamsVersion={teamsVersion}          // ✅ Add this
  setTeamsVersion={setTeamsVersion}    // ✅ Add this
  // ... other props
/>
```

**Estimated Time:** 1-2 hours

---

### Phase 2: Teams Management (HIGH PRIORITY)

**File:** `src/components/TeamsManagement.jsx`

**Why First:** High conflict risk - multiple captains manage rosters simultaneously.

#### 2.1 Add Hook and Props
```javascript
import { useTimestampValidation, TimestampDisplay } from '../hooks/useTimestampValidation';

const TeamsManagement = ({
  teams,
  setTeams,
  teamsVersion,        // ✅ New prop
  setTeamsVersion,     // ✅ New prop
  loginName,
  // ... other props
}) => {
  const teamValidation = useTimestampValidation('team');
```

#### 2.2 Record Load in useEffect
```javascript
useEffect(() => {
  if (teamsVersion) {
    teamValidation.recordLoad(teamsVersion);
  }
}, [teamsVersion]);
```

#### 2.3 Update handleSaveTeam
```javascript
const handleSaveTeam = async () => {
  // ... existing validation ...

  try {
    // 1. Get current version
    const currentVersion = await tournamentStorage.getDataVersion('teams');

    // 2. Validate with user prompt
    const shouldProceed = await teamValidation.validateBeforeSave(
      currentVersion,
      null,
      async () => {
        // Refresh callback
        const freshData = await tournamentStorage.getTeams();
        setTeams(JSON.parse(freshData.data));
        setTeamsVersion(freshData.updatedAt);
        teamValidation.recordLoad(freshData.updatedAt);

        await tournamentStorage.logConflict('team', editingTeam?.id, loginName, 'reloaded');
      }
    );

    if (!shouldProceed) return;

    // 3. Update teams array
    const updatedTeams = editingTeam
      ? teams.map(t => t.id === editingTeam.id ? { ...t, ...teamFormData } : t)
      : [...teams, newTeam];

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
      await tournamentStorage.logConflict('team', editingTeam?.id, loginName, 'conflict');
      return;
    }

    if (result.success) {
      setTeams(updatedTeams);
      setTeamsVersion(result.version);
      teamValidation.reset(result.version, loginName);
      setShowTeamForm(false);
      setEditingTeam(null);
      alert('✅ Team saved!');
    }
  } catch (error) {
    console.error('Error saving team:', error);
    alert('Failed to save team. Please try again.');
  }
};
```

#### 2.4 Add Timestamp Display to UI
```javascript
// In the teams list section
<div className="flex items-center justify-between mb-4">
  <h2>Teams</h2>
  <TimestampDisplay
    timestamp={teamsVersion}
    className="text-sm text-gray-500"
  />
</div>
```

#### 2.5 Update handleDeleteTeam
```javascript
const handleDeleteTeam = async (teamId) => {
  if (!confirm('Delete team?')) return;

  try {
    const currentVersion = await tournamentStorage.getDataVersion('teams');

    const shouldProceed = await teamValidation.validateBeforeSave(
      currentVersion,
      null,
      async () => {
        const freshData = await tournamentStorage.getTeams();
        setTeams(JSON.parse(freshData.data));
        setTeamsVersion(freshData.updatedAt);
        teamValidation.recordLoad(freshData.updatedAt);
      }
    );

    if (!shouldProceed) return;

    const updatedTeams = teams.filter(t => t.id !== teamId);
    const result = await tournamentStorage.saveWithValidation(
      'teams',
      updatedTeams,
      teamsVersion,
      false
    );

    if (result.success) {
      setTeams(updatedTeams);
      setTeamsVersion(result.version);
      teamValidation.reset(result.version);
    }
  } catch (error) {
    console.error('Error deleting team:', error);
  }
};
```

#### 2.6 Update handleRemovePlayer
Similar validation for player removals from teams.

**Estimated Time:** 2-3 hours

---

### Phase 3: Players Management (HIGH PRIORITY)

**File:** Need to find where players are edited (likely in a modal or form)

**Search for:** `setPlayers`, player edit functions

#### 3.1 Find Player Management Code
```bash
# Search for player management
grep -r "handleSavePlayer\|handleUpdatePlayer\|player.*save" src/
```

#### 3.2 Implement Same Pattern as Teams
- Add `useTimestampValidation('player')`
- Add `playersVersion` prop
- Validate before save
- Add timestamp display

**Estimated Time:** 2-3 hours

---

### Phase 4: Match Entry/Editing (HIGH PRIORITY)

**File:** `src/components/MatchEntry.jsx`

**Why Critical:** Match results are high-value data that shouldn't be overwritten.

#### 4.1 Find Edit Match Functions
Currently, match results use transactions, but if matches can be edited after submission, add validation.

#### 4.2 Check if Matches Can Be Edited
```javascript
// Look for:
- editingMatch state
- handleEditMatch function
- "Edit" buttons on match cards
```

#### 4.3 If Editable, Add Validation
```javascript
const matchValidation = useTimestampValidation('match');

const handleSaveMatchEdit = async () => {
  const currentVersion = await tournamentStorage.getDataVersion('matches');

  const shouldProceed = await matchValidation.validateBeforeSave(
    currentVersion,
    null,
    refreshMatchesCallback
  );

  if (!shouldProceed) return;

  const result = await tournamentStorage.saveWithValidation(
    'matches',
    updatedMatches,
    matchesVersion,
    false
  );

  // ... handle result
};
```

**Estimated Time:** 2-3 hours (if matches are editable)

---

### Phase 5: Challenge Management (MEDIUM PRIORITY)

**File:** `src/components/ChallengeManagement.jsx`

**Note:** Challenge acceptance already uses transactions (safe). But challenge creation/editing needs validation.

#### 5.1 Add Validation to Challenge Creation
```javascript
const challengeValidation = useTimestampValidation('challenge');

const handleCreateChallenge = async () => {
  const currentVersion = await tournamentStorage.getDataVersion('challenges');

  const shouldProceed = await challengeValidation.validateBeforeSave(
    currentVersion,
    null,
    refreshChallengesCallback
  );

  if (!shouldProceed) return;

  const result = await tournamentStorage.saveWithValidation(
    'challenges',
    updatedChallenges,
    challengesVersion,
    false
  );

  // ... handle result
};
```

#### 5.2 Add Validation to Challenge Deletion
If challenges can be deleted, validate before deleting.

**Estimated Time:** 1-2 hours

---

### Phase 6: Settings & Configuration (LOW PRIORITY)

**Files:** Any settings management components

#### 6.1 Search for Settings
```bash
grep -r "settings\|config" src/components/
```

#### 6.2 Apply Same Pattern
If found, add timestamp validation.

**Estimated Time:** 1 hour per settings component

---

## Implementation Checklist

### ✅ Completed
- [x] Create `useTimestampValidation` hook
- [x] Add storage validation functions
- [x] Write documentation
- [x] Verify build succeeds

### 🚧 To Do

#### App.jsx (Core Infrastructure)
- [ ] Add version state variables (teams, players, matches, challenges)
- [ ] Update `loadTeams()` to track `teamsVersion`
- [ ] Update `loadPlayers()` to track `playersVersion`
- [ ] Update `loadMatches()` to track `matchesVersion`
- [ ] Update `loadChallenges()` to track `challengesVersion`
- [ ] Update `loadCaptains()` to track `captainsVersion`
- [ ] Update `loadBonuses()` to track `bonusesVersion`
- [ ] Pass version props to all management components

#### TeamsManagement.jsx (High Priority)
- [ ] Import `useTimestampValidation` hook
- [ ] Accept `teamsVersion` and `setTeamsVersion` props
- [ ] Initialize hook: `useTimestampValidation('team')`
- [ ] Record load in `useEffect`
- [ ] Update `handleSaveTeam` with validation
- [ ] Update `handleDeleteTeam` with validation
- [ ] Update `handleRemovePlayer` with validation
- [ ] Add `<TimestampDisplay>` to UI
- [ ] Test with 2 browser tabs

#### Players Management (High Priority)
- [ ] Find player edit component
- [ ] Add `useTimestampValidation('player')`
- [ ] Add version tracking
- [ ] Validate before saves
- [ ] Add timestamp display
- [ ] Test conflicts

#### MatchEntry.jsx (High Priority - if editable)
- [ ] Determine if matches can be edited after submission
- [ ] If yes: Add `useTimestampValidation('match')`
- [ ] Add version tracking
- [ ] Validate before edits
- [ ] Add timestamp display
- [ ] Test conflicts

#### ChallengeManagement.jsx (Medium Priority)
- [ ] Add `useTimestampValidation('challenge')`
- [ ] Add version tracking
- [ ] Validate before challenge creation
- [ ] Validate before challenge deletion (if allowed)
- [ ] Add timestamp display
- [ ] Test conflicts

#### Settings Components (Low Priority)
- [ ] Identify settings components
- [ ] Add validation as needed

---

## Testing Plan

### Test 1: Basic Conflict Detection
```
1. Open app in Chrome Tab 1
2. Open app in Chrome Tab 2 (or Incognito)
3. Log in as same user in both tabs
4. In Tab 1: Edit team "Eagles" name to "Eagles A"
5. In Tab 1: Click Save (should succeed)
6. In Tab 2: Edit team "Eagles" name to "Eagles B"
7. In Tab 2: Click Save
   Expected: ⚠️ Conflict dialog appears
8. Click "OK" (reload)
   Expected: Tab 2 shows "Eagles A"
9. Edit again to "Eagles C" and save
   Expected: Save succeeds
```

### Test 2: Overwrite Scenario
```
1-6. Same as Test 1
7. In Tab 2: Click Save
8. Click "Cancel" (overwrite)
9. Confirm overwrite
   Expected: "Eagles B" is saved
10. Refresh Tab 1
    Expected: Now shows "Eagles B"
11. Check Activity Log
    Expected: Conflict event logged
```

### Test 3: Rapid Concurrent Edits
```
1. Open 3 tabs
2. All edit same team simultaneously
3. Tab 1 saves first → succeeds
4. Tab 2 saves second → conflict detected
5. Tab 3 saves third → conflict detected
6. Verify only one version wins
7. Verify conflicts logged
```

### Test 4: Backwards Compatibility
```
1. Manually remove updatedAt from teams in Firestore
2. Edit team in app
3. Save
   Expected: Save succeeds
4. Check Firestore
   Expected: updatedAt field now exists
```

### Test 5: Network Delay Simulation
```
1. Open DevTools → Network tab
2. Throttle to "Slow 3G"
3. Tab 1: Edit and save (takes time)
4. Tab 2: Edit and save immediately
5. Verify conflict detected despite delays
```

---

## Estimated Total Time

| Phase | Task | Time |
|-------|------|------|
| 1 | App.jsx infrastructure | 1-2 hours |
| 2 | TeamsManagement | 2-3 hours |
| 3 | Players Management | 2-3 hours |
| 4 | MatchEntry (if editable) | 2-3 hours |
| 5 | ChallengeManagement | 1-2 hours |
| 6 | Settings (if any) | 1 hour |
| 7 | Testing all scenarios | 2-3 hours |
| 8 | Bug fixes & polish | 2-3 hours |

**Total:** 13-20 hours

**Recommended Approach:**
- Week 1: Phases 1-2 (App.jsx + Teams) - 4-5 hours
- Week 2: Phase 3 (Players) - 2-3 hours
- Week 3: Phases 4-5 (Matches + Challenges) - 3-5 hours
- Week 4: Testing & polish - 2-3 hours

---

## Quick Start: Implement Teams First

To get started immediately with Teams (highest priority):

### Step 1: Update App.jsx
```javascript
// Add state
const [teamsVersion, setTeamsVersion] = useState(null);

// Update load function
const loadTeams = async () => {
  const teamsData = await tournamentStorage.getTeams();
  if (teamsData) {
    setTeams(JSON.parse(teamsData.data));
    setTeamsVersion(teamsData.updatedAt);
  }
};

// Pass to component
<TeamsManagement
  teams={teams}
  setTeams={setTeams}
  teamsVersion={teamsVersion}
  setTeamsVersion={setTeamsVersion}
  loginName={loginName}
  // ... other props
/>
```

### Step 2: Update TeamsManagement.jsx
```javascript
import { useTimestampValidation, TimestampDisplay } from '../hooks/useTimestampValidation';

const TeamsManagement = ({ teams, setTeams, teamsVersion, setTeamsVersion, loginName }) => {
  const teamValidation = useTimestampValidation('team');

  useEffect(() => {
    if (teamsVersion) {
      teamValidation.recordLoad(teamsVersion);
    }
  }, [teamsVersion]);

  const handleSaveTeam = async () => {
    // Add validation before save (see Phase 2 above)
  };

  return (
    <div>
      <TimestampDisplay timestamp={teamsVersion} />
      {/* Rest of UI */}
    </div>
  );
};
```

### Step 3: Test
Open 2 tabs, edit same team, save in both → Should detect conflict!

---

## Common Issues & Solutions

### Issue: "No timestamp provided" warning
**Cause:** Forgot to pass version prop or call recordLoad()
**Solution:** Verify version is being tracked and passed down from App.jsx

### Issue: Conflicts not detected
**Cause:** Version not being updated after save
**Solution:** Call `setTeamsVersion(result.version)` and `reset()` after successful save

### Issue: Users always see conflicts
**Cause:** Version state not being updated
**Solution:** Make sure `setTeamsVersion()` is called after saves

### Issue: Can't overwrite even when needed
**Cause:** Not implementing the overwrite option properly
**Solution:** Ensure `validateBeforeSave` returns true when user confirms overwrite

---

## Success Metrics

After full implementation, you should see:

✅ Zero data overwrites without user knowledge
✅ Conflict events in activity log
✅ Users report seeing conflict warnings
✅ "Last updated X minutes ago" displays throughout app
✅ No unintended data loss from concurrent editing

---

## Rollback Plan

If issues arise:

1. The changes are non-breaking and backwards compatible
2. Components can be reverted individually
3. Remove validation calls to revert to old behavior
4. Existing data continues to work without timestamps

---

## Support & Questions

- Documentation: `docs/TIMESTAMP_VALIDATION_GUIDE.md`
- Hook source: `src/hooks/useTimestampValidation.js`
- Storage functions: `src/services/storage.js` (lines 658-793)
- Test in multiple tabs before deploying to production
