# Challenge and Match ID System Migration Guide

This document explains the new ID system for challenges and matches, and how to migrate existing data.

## Overview

The Conquest of the Creek application now includes unique, readable IDs for all challenges and matches:

- **Challenge IDs**: Format `CHALL-YYYY-###` (e.g., `CHALL-2025-001`)
- **Match IDs**: Format `MATCH-YYYY-###` (e.g., `MATCH-2025-001`)

### Features

1. **Unique Identification**: Each challenge and match has a unique, readable ID
2. **Traceability**: Matches track their origin challenge ID when created from a challenge
3. **Sorting**: Challenges and matches can be sorted by date (newest/oldest first)
4. **Notifications**: IDs are included in email and SMS notifications
5. **UI Display**: IDs are prominently displayed in all relevant views

## For Developers

### New Fields

#### Challenges
```javascript
{
  id: 1234567890,              // Legacy timestamp ID (keep for compatibility)
  challengeId: "CHALL-2025-001", // NEW: Readable Challenge ID
  // ... other fields
}
```

#### Matches
```javascript
{
  id: 1234567890,              // Legacy timestamp ID (keep for compatibility)
  matchId: "MATCH-2025-001",   // NEW: Readable Match ID
  originChallengeId: "CHALL-2025-001", // NEW: If match came from a challenge
  // ... other fields
}
```

### Migration Process

#### Option 1: Using the UI (Recommended for Directors)

1. Log in as a director
2. Navigate to the Settings or Admin panel (wherever the MigrationButton is added)
3. Click "Check Migration Status" to see how many records need IDs
4. Click "Run Migration" to add IDs to all existing records
5. **IMPORTANT**: Click "Save Data" to persist the changes to Firebase

#### Option 2: Programmatic Migration

```javascript
import { migrateAllIds, checkMigrationNeeded } from './utils/migrateIds';

// Check if migration is needed
const migrationCheck = checkMigrationNeeded({ challenges, matches });
console.log(migrationCheck);

// Run migration
if (migrationCheck.needsMigration) {
  const result = migrateAllIds({ challenges, matches });
  console.log(`Migrated ${result.totalMigrated} records`);

  // Update your state with the migrated data
  setChallenges(result.challenges);
  setMatches(result.matches);

  // Save to Firebase
  // ... your save logic
}
```

### Adding the Migration Button to Your App

In your admin panel or settings page:

```jsx
import MigrationButton from './components/MigrationButton';

// In your component:
<MigrationButton
  challenges={challenges}
  matches={matches}
  onUpdate={(data) => {
    setChallenges(data.challenges);
    setMatches(data.matches);
  }}
  userRole={userRole}
/>
```

## For Directors/Admins

### Running the Migration

1. **Backup First**: Ensure you have a recent backup of your Firebase data
2. **Check Status**: Click "Check Migration Status" to see what needs migration
3. **Run Once**: Click "Run Migration" (only run this once!)
4. **Save**: Click "Save Data" to persist the changes to the database
5. **Verify**: Check a few challenges and matches to ensure IDs are displayed correctly

### What Gets Migrated

- All existing challenges without a `challengeId` will get one
- All existing matches without a `matchId` will get one
- IDs are assigned based on creation date (oldest records get lowest numbers)
- The migration preserves all existing data and only adds the ID fields

### Important Notes

- **Run Once**: The migration should only be run once. Running it multiple times won't break anything, but it's unnecessary.
- **Save Required**: After migration, you MUST click "Save Data" to persist changes to Firebase.
- **No Downtime**: The system works with or without IDs, so there's no urgency to migrate immediately.
- **Backwards Compatible**: Old records without IDs will simply not display an ID field in the UI.

## Sorting Functionality

### Challenges Page
- Default: Newest first
- Options: Newest First | Oldest First
- Sorted by `createdAt` timestamp

### Matches Page
- Default: Newest first
- Options: Newest First | Oldest First
- Sorted by `date`, with `timestamp` as a tiebreaker

## ID Display Locations

### Challenges
- Challenge list view (below team names)
- Challenge detail views
- Challenge notifications (email/SMS)
- Pending matches display (shows Challenge ID)

### Matches
- Match list view (above team names)
- Match detail/results views
- Match entry forms (after submission)
- Shows origin Challenge ID if match came from a challenge

## Technical Details

### ID Generation

IDs are generated using a sequential numbering system per year:
- Format: `TYPE-YYYY-###`
- Example: `CHALL-2025-001`, `MATCH-2025-042`
- Numbers are zero-padded to 3 digits
- Each year starts numbering from 001

### Uniqueness Guarantee

The ID generator checks existing IDs to ensure uniqueness:
1. Find all existing IDs for the current year
2. Get the highest sequence number
3. Generate next number in sequence

### Backwards Compatibility

The system handles records without IDs gracefully:
- UI checks for ID existence before displaying
- Notifications include IDs only if present
- Sorting works with or without IDs
- No errors if ID fields are missing

## Troubleshooting

### IDs Not Showing After Migration

1. Verify migration completed successfully (check browser console)
2. Ensure you clicked "Save Data" after migration
3. Refresh the page to reload data from Firebase
4. Check Firebase console to verify ID fields exist

### Duplicate IDs

This shouldn't happen, but if it does:
1. Check the browser console for errors
2. Note which records have duplicate IDs
3. Manually update the duplicate IDs in Firebase
4. Contact the development team if issues persist

### Migration Button Not Visible

- Only directors can see the migration button
- Verify you're logged in as a director
- Check that the MigrationButton component is imported and rendered

## Support

For technical issues or questions about the ID system:
1. Check this documentation first
2. Review the browser console for error messages
3. Contact the development team with specific details

---

**Last Updated**: 2025-01-18
