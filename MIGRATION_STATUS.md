# Firestore Architecture Migration - Implementation Status

## ✅ Completed Phase 1: Core Infrastructure

### What's Been Created

#### 1. Migration Script (`src/utils/migrateChallenges.js`)
A comprehensive migration utility that safely migrates challenges from blob storage to individual documents.

**Features:**
- Reads existing blob data from `challenges/data` document
- Validates all challenge data before migration
- Uses Firestore batch writes for atomic operations (batches of 400)
- Creates backup of original blob data at `challenges/data_backup_blob`
- Provides verification function to confirm migration integrity
- Includes rollback function in case of issues
- Detailed logging and error tracking

**Key Functions:**
```javascript
migrateChallenges()       // Main migration function
verifyMigration()         // Verify migration success
rollbackMigration()       // Rollback if needed
```

#### 2. Challenge Service (`src/services/challengeService.js`)
A complete CRUD service with real-time subscriptions for challenges.

**Features:**
- Individual document storage (no more blob!)
- Real-time subscriptions with `onSnapshot`
- Atomic operations for challenge acceptance (prevents race conditions)
- Comprehensive error handling
- Automatic ID generation (`CHAL-{timestamp}-{random}`)

**Key Functions:**
```javascript
// CREATE
createChallenge(challengeData, createdBy)

// READ
getChallenge(challengeId)
getAllChallenges()
getChallengesByStatus(status)
getChallengesByTeam(teamId)

// UPDATE
updateChallenge(challengeId, updates, updatedBy)
acceptChallenge(challengeId, acceptanceData)  // Uses transaction
completeChallenge(challengeId, completedBy, matchId)

// DELETE
deleteChallenge(challengeId)

// REAL-TIME SUBSCRIPTIONS
subscribeToChallenges(callback, errorCallback)
subscribeToChallengesByStatus(status, callback, errorCallback)
subscribeToChallengesByTeam(teamId, callback, errorCallback)
subscribeToChallenge(challengeId, callback, errorCallback)
```

---

## 📋 Next Steps: Phase 2

### Step 2.1: Update ChallengeManagement.jsx

**Current Issues:**
- Component uses blob storage via `tournamentStorage.getChallenges()` (line 243)
- Manual save flow with timestamp validation (lines 410-472)
- No real-time updates - requires manual refresh

**Required Changes:**

#### A. Update Imports (Add at top)
```javascript
import {
  createChallenge,
  updateChallenge,
  deleteChallenge,
  acceptChallenge,
  subscribeToChallenges
} from '../services/challengeService';
```

#### B. Replace State Loading with Real-Time Subscription
Replace the challenges loading logic with a subscription:

```javascript
// ADD this useEffect (around line 102)
useEffect(() => {
  // Real-time subscription to challenges
  const unsubscribe = subscribeToChallenges(
    (challenges) => {
      onChallengesChange(challenges);  // Update parent state
      console.log('📋 Challenges updated:', challenges.length);
    },
    (error) => {
      console.error('Failed to load challenges:', error);
      showError('Failed to load challenges. Please refresh the page.');
    }
  );

  // Cleanup subscription on unmount
  return () => unsubscribe();
}, []);  // Empty deps - subscribe once on mount
```

#### C. Update handleCreateChallenge (Line 356)
Replace the entire function with:

```javascript
const handleCreateChallenge = async () => {
  // Validation stays the same (lines 357-385)
  const challengerTeamId = userRole === 'captain' ? userTeamId : parseInt(createFormData.challengerTeamId);

  if (userRole === 'director' && !createFormData.challengerTeamId) {
    showError('Please select a challenging team.');
    return;
  }

  if (!validatePlayerSelection(createFormData.selectedPlayers, createFormData.matchType)) {
    showError(getPlayerSelectionError(createFormData.matchType));
    return;
  }

  if (createFormData.matchType === MATCH_TYPES.MIXED_DOUBLES) {
    if (!validateMixedDoublesGenders(createFormData.selectedPlayers, players)) {
      showError('Mixed Doubles requires one male and one female player per team');
      return;
    }
  }

  if (!validateCombinedNTRP(createFormData.selectedPlayers, createFormData.proposedLevel, createFormData.matchType)) {
    const combinedRating = calculateCombinedNTRP(createFormData.selectedPlayers, createFormData.matchType);
    showError(`Combined NTRP rating (${combinedRating.toFixed(1)}) exceeds match level (${createFormData.proposedLevel}). Please select different players or change the match level.`);
    return;
  }

  setIsCreating(true);

  try {
    const result = await createChallenge({
      challengerTeamId: challengerTeamId,
      challengerPlayers: createFormData.selectedPlayers,
      proposedLevel: createFormData.proposedLevel,
      matchType: createFormData.matchType,
      proposedDate: createFormData.proposedDate || null,
      notes: createFormData.notes,
      combinedNTRP: calculateCombinedNTRP(createFormData.selectedPlayers, createFormData.matchType)
    }, getUserInfo()?.name || 'Unknown');

    if (!result.success) {
      showError(`Failed to create challenge: ${result.message}`);
      setIsCreating(false);
      return;
    }

    // Success!
    const challengerTeam = teams.find(t => t.id === challengerTeamId);
    showSuccess(`Challenge created successfully! Sent to ${challengerTeam?.name || 'opponent'}.`);

    // Log activity
    if (addLog) {
      addLog(
        ACTION_TYPES.CHALLENGE_CREATED,
        {
          challengerTeam: challengerTeam?.name,
          level: createFormData.proposedLevel,
          matchType: createFormData.matchType
        },
        result.challenge.challengeId,
        null,
        result.challenge
      );
    }

    // Reset form
    setCreateFormData({
      challengerTeamId: '',
      matchType: MATCH_TYPES.DOUBLES,
      proposedDate: '',
      proposedLevel: '7.0',
      selectedPlayers: [],
      notes: ''
    });
    setShowCreateForm(false);
    setIsCreating(false);
  } catch (error) {
    console.error('❌ Error creating challenge:', error);
    showError('Failed to create challenge. Please try again.');
    setIsCreating(false);
  }
};
```

#### D. Update handleConfirmAccept (Line 498)
Replace with:

```javascript
const handleConfirmAccept = async () => {
  const challengeMatchType = getMatchType(selectedChallenge);

  if (!acceptFormData.acceptedDate) {
    showError('Please select a match date.');
    return;
  }

  if (!validatePlayerSelection(acceptFormData.selectedPlayers, challengeMatchType)) {
    showError(getPlayerSelectionError(challengeMatchType));
    return;
  }

  if (challengeMatchType === MATCH_TYPES.MIXED_DOUBLES) {
    if (!validateMixedDoublesGenders(acceptFormData.selectedPlayers, players)) {
      showError('Mixed Doubles requires one male and one female player per team');
      return;
    }
  }

  if (!validateCombinedNTRP(acceptFormData.selectedPlayers, acceptFormData.acceptedLevel, challengeMatchType)) {
    const combinedRating = calculateCombinedNTRP(acceptFormData.selectedPlayers, challengeMatchType);
    showError(`Combined NTRP rating (${combinedRating.toFixed(1)}) exceeds match level (${acceptFormData.acceptedLevel}). Please select different players or change the match level.`);
    return;
  }

  setIsAccepting(true);

  const challengedTeamId = userRole === 'captain' ? userTeamId : selectedChallenge.challengedTeamId;
  const generatedMatchId = generateMatchId(matches || []);

  try {
    const result = await acceptChallenge(selectedChallenge.challengeId, {
      challengedTeamId: challengedTeamId,
      challengedPlayers: acceptFormData.selectedPlayers,
      acceptedDate: acceptFormData.acceptedDate,
      acceptedLevel: acceptFormData.acceptedLevel,
      challengedCombinedNTRP: calculateCombinedNTRP(acceptFormData.selectedPlayers, challengeMatchType),
      acceptedBy: getUserInfo()?.name || 'Unknown',
      notes: acceptFormData.notes,
      matchId: generatedMatchId
    });

    if (!result.success) {
      if (result.alreadyAccepted) {
        showError(`Challenge already accepted! ${result.message}`, 6000);
      } else if (result.notFound) {
        showError(`Challenge not found! ${result.message}`, 6000);
      } else {
        showError(`Failed to accept challenge: ${result.message}`);
      }
      setIsAccepting(false);
      setShowAcceptForm(false);
      return;
    }

    console.log('✅ Challenge accepted successfully!');

    // Send SMS notification
    const challengerTeam = teams.find(t => t.id === selectedChallenge.challengerTeamId);
    const challengedTeam = teams.find(t => t.id === challengedTeamId);
    const challengerCaptain = captains.find(c =>
      c.teamId === selectedChallenge.challengerTeamId &&
      c.status === 'active'
    );

    if (challengerCaptain) {
      sendChallengeSMS(
        challengerCaptain,
        challengedTeam,
        challengerTeam,
        'challenge_accepted',
        acceptFormData.acceptedDate,
        acceptFormData.acceptedLevel
      ).then(smsResult => {
        if (smsResult.success) {
          console.log('Challenge accepted SMS sent successfully');
        }
      }).catch(error => {
        console.error('Error sending challenge accepted SMS:', error);
      });
    }

    // Reset form
    setShowAcceptForm(false);
    setSelectedChallenge(null);
    setAcceptFormData({
      acceptedDate: '',
      acceptedLevel: '7.0',
      selectedPlayers: [],
      notes: ''
    });

    showSuccess('Challenge accepted! Match created successfully.');
  } catch (error) {
    console.error('❌ Error accepting challenge:', error);
    showError('Unexpected error accepting challenge. Please try again.');
  } finally {
    setIsAccepting(false);
    setShowAcceptForm(false);
  }
};
```

#### E. Update handleDeleteChallenge (Line 632)
Replace with:

```javascript
const handleDeleteChallenge = async (challenge) => {
  if (!window.confirm('Are you sure you want to delete this challenge?\n\nThis action cannot be undone.')) {
    return;
  }

  try {
    const result = await deleteChallenge(challenge.challengeId);

    if (!result.success) {
      showError(`Failed to delete challenge: ${result.message}`);
      return;
    }

    console.log('✅ Challenge deleted successfully');
    showSuccess('Challenge deleted successfully!');
  } catch (error) {
    console.error('❌ Error deleting challenge:', error);
    showError('Failed to delete challenge. Please try again.');
  }
};
```

#### F. Update handleConfirmEdit (Line 698)
Replace with:

```javascript
const handleConfirmEdit = async () => {
  // Validation (lines 700-709 stay the same)
  if (!validatePlayerSelection(editFormData.selectedPlayers, editFormData.matchType)) {
    alert(getPlayerSelectionError(editFormData.matchType));
    return;
  }

  if (!validateCombinedNTRP(editFormData.selectedPlayers, editFormData.proposedLevel, editFormData.matchType)) {
    const combinedRating = calculateCombinedNTRP(editFormData.selectedPlayers, editFormData.matchType);
    alert(`Combined NTRP rating (${combinedRating.toFixed(1)}) exceeds match level (${editFormData.proposedLevel}). Please select different players or change the match level.`);
    return;
  }

  // Track changes (lines 712-728 stay the same)
  const changes = [];
  if (editFormData.matchType !== getMatchType(editingChallenge)) {
    changes.push('match type');
  }
  if (editFormData.proposedDate !== (editingChallenge.proposedDate || '')) {
    changes.push('date');
  }
  if (editFormData.proposedLevel !== editingChallenge.proposedLevel) {
    changes.push('level');
  }
  if (JSON.stringify(editFormData.selectedPlayers.sort()) !== JSON.stringify(editingChallenge.challengerPlayers.sort())) {
    changes.push('players');
  }
  if (editFormData.notes !== (editingChallenge.notes || '')) {
    changes.push('notes');
  }

  try {
    const result = await updateChallenge(
      editingChallenge.challengeId,
      {
        matchType: editFormData.matchType,
        proposedDate: editFormData.proposedDate || null,
        proposedLevel: editFormData.proposedLevel,
        challengerPlayers: editFormData.selectedPlayers,
        combinedNTRP: calculateCombinedNTRP(editFormData.selectedPlayers, editFormData.matchType),
        notes: editFormData.notes,
        lastEditedBy: getUserInfo()?.name || 'Unknown',
        lastEditedAt: new Date().toISOString()
      },
      getUserInfo()?.name || 'Unknown'
    );

    if (!result.success) {
      alert(`❌ Update failed: ${result.message || 'Unknown error'}`);
      return;
    }

    console.log('✅ Challenge updated successfully');

    // Log the edit activity
    if (addLog && changes.length > 0) {
      addLog(
        ACTION_TYPES.CHALLENGE_EDITED,
        {
          challengerTeam: getTeamName(editingChallenge.challengerTeamId),
          level: editFormData.proposedLevel,
          changesSummary: `Updated ${changes.join(', ')}`
        },
        editingChallenge.challengeId,
        editingChallenge,
        { ...editingChallenge, ...result }
      );
    }

    alert('✅ Challenge updated successfully!');
  } catch (error) {
    console.error('❌ Error updating challenge:', error);
    alert('❌ Failed to update challenge. Please try again.');
    return;
  }

  // Reset form
  setShowEditForm(false);
  setEditingChallenge(null);
  setEditFormData({
    matchType: MATCH_TYPES.DOUBLES,
    proposedDate: '',
    proposedLevel: '7.0',
    selectedPlayers: [],
    notes: ''
  });
};
```

#### G. Remove Old Blob-Related Code
Delete or comment out:
- Lines 102-107: Old timestamp validation effect
- Line 50: `challengeValidation` hook usage (no longer needed)
- Lines 412-449: Old Firestore blob save logic in `handleCreateChallenge`
- Lines 536-628: Old transaction code in `handleConfirmAccept` (blob-based)
- Lines 639-682: Old blob save in `handleDeleteChallenge`
- Lines 746-806: Old blob save in `handleConfirmEdit`

---

### Step 2.2: Update App.jsx

**Current Issues:**
- Loads challenges from blob on mount (line 243-270)
- Includes challenges in global manual save (line 436-460)
- Passes `saveChallengesWithValidation` prop (line 536-558)

**Required Changes:**

#### A. Remove Challenges from loadAllData()
Comment out or remove lines 243-270:

```javascript
// REMOVED: Challenges now loaded via real-time subscriptions in ChallengeManagement component
// console.log('📥 Fetching challenges data from Firebase...');
// const challengesData = await tournamentStorage.getChallenges();
// ... (delete all challenges loading code)
```

#### B. Remove Challenges from handleManualSave()
Comment out or remove lines 436-460:

```javascript
// REMOVED: Challenges now auto-save via challengeService
// console.log('💾 Saving challenges to Firebase...');
// const challengesResult = await tournamentStorage.setChallenges(...);
// ... (delete all challenges saving code)
```

#### C. Remove saveChallengesWithValidation Function
Delete lines 536-558:

```javascript
// REMOVED: Function no longer needed - challenges use challengeService
// const saveChallengesWithValidation = async (updatedChallenges, expectedVersion) => { ... }
```

#### D. Update ChallengeManagement Component Props
Update line 1486:

```javascript
<ChallengeManagement
  teams={teams}
  players={players}
  matches={matches}
  challenges={challenges}  // Still pass for initial state
  captains={captains}
  onChallengesChange={setChallenges}  // Still needed for local state
  onMatchesChange={setMatches}
  isAuthenticated={isAuthenticated}
  userRole={userRole}
  userTeamId={userTeamId}
  loginName={loginName}
  addLog={addLog}
  showToast={showToastMessage}
  autoAcceptChallengeId={autoAcceptChallengeId}
  onAutoAcceptHandled={() => setAutoAcceptChallengeId(null)}
  // REMOVED: challengesVersion prop
  // REMOVED: saveChallengesWithValidation prop
/>
```

---

### Step 2.3: Update Other Files

Search for any other references to blob challenge storage:

```bash
# Search for blob challenge operations
grep -r "tournamentStorage.getChallenges" src/
grep -r "tournamentStorage.setChallenges" src/
grep -r "saveChallengesWithValidation" src/
```

Update any findings to use the new `challengeService`.

---

## 🔧 Step 3: Update Firestore Security Rules

Update your `firestore.rules` file:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Challenges - Individual Documents
    match /challenges/{challengeId} {
      // Anyone can read challenges
      allow read: if true;

      // Only authenticated users can write
      allow create, update: if request.auth != null;

      // Only directors can delete
      allow delete: if request.auth != null && request.auth.token.role == 'director';
    }

    // Keep existing rules for other collections
    match /teams/{document=**} {
      allow read: if true;
      allow write: if request.auth != null;
    }

    match /matches/{document=**} {
      allow read: if true;
      allow write: if request.auth != null;
    }

    // ... other rules ...
  }
}
```

---

## 🧪 Step 4: Testing Procedure

### 4.1 Backup Current Data
**CRITICAL: Do this first!**

1. Go to Firebase Console → Firestore Database
2. Export current database
3. Download and save locally
4. Keep the blob `challenges/data` document until migration is verified

### 4.2 Test on DEV Environment First

1. Switch to dev Firebase config
2. Run migration:
   ```javascript
   import { migrateChallenges } from './utils/migrateChallenges';
   await migrateChallenges();
   ```
3. Verify migration:
   ```javascript
   import { verifyMigration } from './utils/migrateChallenges';
   await verifyMigration();
   ```
4. Test all challenge operations:
   - ✅ Create challenge
   - ✅ View all challenges
   - ✅ Accept challenge
   - ✅ Edit challenge
   - ✅ Delete challenge
   - ✅ Real-time updates (open in 2 browser windows)

### 4.3 Migration Steps for Production

1. **Pre-Migration:**
   - Announce maintenance window to users
   - Export Firestore database
   - Backup blob data

2. **Execute Migration:**
   ```javascript
   import { migrateChallenges, verifyMigration } from './utils/migrateChallenges';

   // Run migration
   const result = await migrateChallenges();
   console.log(result);

   // Verify
   const verification = await verifyMigration();
   console.log(verification);
   ```

3. **Post-Migration:**
   - Test all challenge operations
   - Monitor for errors
   - Keep blob backup for 1 week
   - Delete blob backup after confirming stability

### 4.4 Rollback Plan (If Needed)

If migration fails:
```javascript
import { rollbackMigration } from './utils/migrateChallenges';
await rollbackMigration();
```

This will:
- Restore blob data from backup
- Delete individual challenge documents
- Revert to old architecture

---

## 📊 Benefits of New Architecture

### Before (Blob Storage):
- ❌ Race conditions causing data loss
- ❌ Manual "Save Data" button required
- ❌ No real-time updates
- ❌ Timestamp conflicts
- ❌ Entire array overwritten on each save
- ❌ No concurrent editing support

### After (Individual Documents):
- ✅ No race conditions (document-level atomicity)
- ✅ Automatic saves
- ✅ Real-time updates with subscriptions
- ✅ Conflict-free concurrent access
- ✅ Only affected challenge updated
- ✅ Multiple users can work simultaneously

---

## 🚀 Next Migration Phases

After challenges are stable, repeat this process for:

1. **Phase 2:** Matches Collection
2. **Phase 3:** Players Collection
3. **Phase 4:** Teams Collection

Each will follow the same pattern:
- Create migration script
- Create service with real-time subscriptions
- Update components
- Remove from global save flow
- Test thoroughly

---

## 📞 Support

If you encounter issues:
1. Check browser console for error messages
2. Verify Firestore rules are deployed
3. Confirm migration completed successfully
4. Use rollback if needed
5. Keep backup data until stable

---

## ✅ Current Status

- ✅ Migration script created
- ✅ Challenge service created
- ⏳ Component updates needed
- ⏳ Testing required
- ⏳ Production deployment pending

**Next Action:** Update `ChallengeManagement.jsx` following Step 2.1 above.
