# Match ID Troubleshooting Guide

Quick guide for diagnosing and fixing Match ID display issues.

---

## Quick Diagnostic Steps

### Step 1: Check Browser Console

Open your browser's Developer Tools (F12) and check the Console tab when:

1. **Creating a Challenge:**
   ```
   Look for: 🆔 Generated Challenge ID: CHALL-2025-###
   ```
   - ✅ If you see this: Challenge ID system is working
   - ❌ If missing: Check imports in ChallengeManagement.jsx

2. **Creating a Pending Match (Schedule Match):**
   ```
   Look for: 🆔 Generated Challenge ID for pending match: CHALL-2025-###
   ```
   - ✅ If you see this: Pending match system is working
   - ❌ If missing: Check imports in MatchEntry.jsx

3. **Entering Match Results:**
   ```
   Look for:
   🆔 Match ID Generation: {
     isNewMatch: true,
     generatedMatchId: "MATCH-2025-###"
   }

   🆔 New Match Object: {
     matchId: "MATCH-2025-###",
     originChallengeId: "CHALL-2025-###",
     hasMatchId: true
   }
   ```
   - ✅ If you see both: Match ID system is working
   - ❌ If `hasMatchId: false`: Check generateMatchId() function
   - ❌ If `generatedMatchId: undefined`: Import issue or function error

### Step 2: Check Match Display

1. Navigate to Matches page
2. Look at a recently created match
3. **Should see:** Gray badge with "Match ID: MATCH-2025-###"
4. **If missing:** Check if match was created BEFORE ID system was added

### Step 3: Check Firestore Data

1. Open Firebase Console
2. Navigate to Firestore Database
3. Open `MATCHES` collection
4. Click on a match document
5. **Should see fields:**
   - `matchId`: "MATCH-2025-###"
   - `timestamp`: ISO date string
   - `originChallengeId`: "CHALL-2025-###" (if from challenge)

---

## Common Issues and Fixes

### Issue #1: No Match IDs on ANY matches

**Symptoms:**
- No Match ID badges visible
- Console shows correct ID generation
- New matches still don't show IDs

**Diagnosis:**
```javascript
// In browser console, check a match:
console.log(matches[0]);

// Look for:
{
  id: 1234567890,
  matchId: "MATCH-2025-###", // <-- Should be present
  // ...
}
```

**Solutions:**

1. **If `matchId` field exists in console but not displayed:**
   ```
   - Clear browser cache
   - Hard reload (Ctrl+Shift+R or Cmd+Shift+R)
   - Check for JavaScript errors in console
   ```

2. **If `matchId` field is missing from console:**
   ```
   - Verify "Save Data" button was clicked after creating match
   - Check if data is being loaded from Firestore correctly
   - Run migration utility for existing matches
   ```

### Issue #2: Some matches have IDs, others don't

**Symptoms:**
- Recent matches show Match IDs
- Older matches don't show Match IDs
- Console shows IDs being generated correctly

**Cause:** Matches created before ID system was implemented

**Solution:** Run data migration

1. Add MigrationButton component to your app
2. Click "Check Migration Status"
3. Click "Run Migration"
4. Click "Save Data"
5. Refresh page

### Issue #3: Console errors when creating match

**Common Errors:**

**Error:** `generateMatchId is not defined`
```javascript
// Fix: Check import in MatchEntry.jsx
import { generateMatchId, generateChallengeId } from '../utils/idGenerator';
```

**Error:** `Cannot read property 'matchId' of undefined`
```javascript
// Fix: Check matches array is being passed correctly
// In MatchEntry component, verify:
const MatchEntry = ({ matches, ... }) => {
  // matches should be an array
  console.log('Matches array:', matches);
}
```

**Error:** `Maximum call stack size exceeded`
```javascript
// Fix: Check for infinite loop in generateMatchId
// Verify existingIds filter is working correctly
```

### Issue #4: Match ID shows as "undefined"

**Symptoms:**
- Badge displays: "Match ID: undefined"
- Console shows: `generatedMatchId: undefined`

**Diagnosis:**
```javascript
// Check if generateMatchId is returning a value:
import { generateMatchId } from './utils/idGenerator';
const testId = generateMatchId([]);
console.log('Test ID:', testId); // Should be "MATCH-2025-001"
```

**Solutions:**

1. **Check idGenerator.js file exists:**
   ```
   Location: src/utils/idGenerator.js
   Should export: generateMatchId, generateChallengeId
   ```

2. **Verify import path:**
   ```javascript
   // MatchEntry.jsx
   import { generateMatchId, generateChallengeId } from '../utils/idGenerator';
   ```

3. **Check function logic:**
   ```javascript
   // In idGenerator.js, verify function returns a string:
   export const generateMatchId = (existingMatches = []) => {
     // ... logic
     return `${prefix}${paddedNumber}`; // Must return string
   };
   ```

### Issue #5: Duplicate Match IDs

**Symptoms:**
- Multiple matches show the same Match ID
- IDs not sequential

**Cause:**
- Race condition in ID generation
- Migration ran multiple times
- Manual ID assignment

**Solution:**

1. **Check for race conditions:**
   ```javascript
   // Ensure only one match is being created at a time
   // Check that generateMatchId is not being called multiple times
   ```

2. **Re-run migration with fresh data:**
   ```javascript
   // Delete duplicates manually in Firestore
   // Run migration again
   ```

3. **Verify sequential logic:**
   ```javascript
   // In generateMatchId(), verify:
   const maxNumber = existingIds.length > 0 ? Math.max(...existingIds) : 0;
   const nextNumber = maxNumber + 1; // Should increment correctly
   ```

---

## Verification Tests

### Test 1: Create New Challenge
```
1. Log in as captain
2. Click "Create Challenge"
3. Fill form and submit
4. Open browser console
5. Verify: "🆔 Generated Challenge ID: CHALL-2025-###"
6. Check Challenges page
7. Verify: Challenge shows Challenge ID badge
```

### Test 2: Schedule Match
```
1. Log in as captain
2. Click "Schedule Match"
3. Fill form and submit
4. Open browser console
5. Verify: "🆔 Generated Challenge ID for pending match: CHALL-2025-###"
6. Check Matches page → Pending Matches
7. Verify: Pending match shows Challenge ID badge
```

### Test 3: Enter Match Results
```
1. Find a pending match
2. Click "Enter Results"
3. Fill scores and submit
4. Open browser console
5. Verify: "🆔 Match ID Generation: { generatedMatchId: 'MATCH-2025-###' }"
6. Verify: "�ID New Match Object: { hasMatchId: true }"
7. Click "Save Data"
8. Refresh page
9. Check Matches page
10. Verify: Match shows Match ID badge
```

### Test 4: Check Firestore
```
1. Open Firebase Console
2. Navigate to Firestore
3. Open MATCHES collection
4. Open latest match document
5. Verify fields present:
   - matchId: "MATCH-2025-###"
   - timestamp: "2025-11-18T..."
   - originChallengeId: "CHALL-2025-###" (if applicable)
```

---

## Emergency Fixes

### Nuclear Option: Clear and Restart

If all else fails:

1. **Backup your data first!**
   ```
   - Export from Firebase Console
   - Save locally
   ```

2. **Clear browser storage:**
   ```
   - Open DevTools (F12)
   - Go to Application tab
   - Clear all storage
   - Hard reload
   ```

3. **Check for code conflicts:**
   ```
   - Verify all files saved
   - Check for merge conflicts
   - Ensure imports are correct
   ```

4. **Redeploy if necessary:**
   ```
   - Commit changes
   - Push to repository
   - Deploy to production
   ```

---

## Getting Help

If you're still stuck after trying these steps:

1. **Gather information:**
   - Browser console logs (copy the 🆔 messages)
   - Screenshots of the issue
   - Steps to reproduce
   - Any error messages

2. **Check documentation:**
   - MATCH_ID_DIAGNOSTIC_REPORT.md
   - ID_DISPLAY_SUMMARY.md
   - ID_SYSTEM_MIGRATION.md

3. **Check existing issues:**
   - Review previous troubleshooting
   - Search for similar problems

4. **Contact support:**
   - Include all gathered information
   - Describe what you've already tried
   - Provide specific error messages

---

## Prevention Tips

To avoid ID issues in the future:

1. **Always click "Save Data"** after creating/editing matches
2. **Run migration utility** immediately after updating code
3. **Test in development** before deploying to production
4. **Monitor browser console** for warnings/errors
5. **Keep backups** of your Firestore data
6. **Document changes** when modifying ID generation code

---

## Quick Reference Commands

### Check Migration Status (Browser Console)
```javascript
// If you have direct access to data:
console.log('Matches without IDs:',
  matches.filter(m => !m.matchId).length
);
console.log('Challenges without IDs:',
  challenges.filter(c => !c.challengeId).length
);
```

### Verify ID Format
```javascript
// Check if IDs follow correct format:
const validMatchId = /^MATCH-\d{4}-\d{3}$/;
const validChallengeId = /^CHALL-\d{4}-\d{3}$/;

console.log('Valid Match ID:', validMatchId.test('MATCH-2025-001')); // true
console.log('Valid Challenge ID:', validChallengeId.test('CHALL-2025-001')); // true
```

### Test ID Generation
```javascript
import { generateMatchId, generateChallengeId } from './utils/idGenerator';

// Test with empty array (should return ###-001)
console.log('First Match ID:', generateMatchId([]));
console.log('First Challenge ID:', generateChallengeId([]));

// Test with existing IDs
const testMatches = [
  { matchId: 'MATCH-2025-001' },
  { matchId: 'MATCH-2025-002' }
];
console.log('Next Match ID:', generateMatchId(testMatches)); // Should be MATCH-2025-003
```

---

**Last Updated:** 2025-01-18
**Version:** 1.0
