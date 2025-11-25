# Database Migration Guide

## Overview

This guide explains how to migrate data between Firebase databases for the Conquest of the Creek application.

## Purpose

The migration tool copies **ALL** data from the production Firebase database to the development database, restoring the dev environment to match production exactly.

## When to Use

- **Development database is empty or corrupted**
- **Need to test with production data**
- **Restoring dev environment after data loss**
- **Setting up a new development environment**

## Quick Start

### Run Migration

```bash
npm run db:migrate
```

This will:
1. Connect to both production and dev databases
2. Clear all existing data from dev
3. Copy all collections from production to dev
4. Verify the migration succeeded
5. Show detailed progress and results

### Verify Migration

```bash
npm run db:verify
```

This will compare document counts between production and dev databases to ensure they match.

## What Gets Migrated

The migration copies these collections:

| Collection | Description |
|------------|-------------|
| `teams` | All team data |
| `players` | All player data |
| `matches` | All completed match records |
| `challenges` | All challenge records (open, accepted, completed) |
| `captains` | Team captain credentials |
| `bonuses` | Team bonus points data |
| `photos` | Match photo URLs and metadata |
| `activityLog` | Activity log entries |
| `tournamentData` | Global tournament settings |

## Data Preservation

✅ **Preserved:**
- All document IDs (exact match)
- All timestamps (no modification)
- All field values (exact copy)
- All nested objects and arrays
- Document structure

❌ **Not Copied:**
- Firebase Storage files (photos stored in Storage)
- Firestore security rules
- Firebase indexes
- Authentication users

## Safety Features

### Read-Only Production
- Migration script **only reads** from production
- **No writes or modifications** to production
- Production database remains untouched

### Verification
- Counts documents before migration
- Verifies counts after migration
- Reports any discrepancies
- Shows detailed progress

### Error Handling
- Processes each collection independently
- Continues even if one collection fails
- Reports all errors at the end
- Safe to re-run if interrupted

## Database Configuration

### Production
- Project ID: `conquest-of-the-creek`
- Database: Production data (live tournament)

### Development
- Project ID: `conquest-of-the-creek-dev`
- Database: Development/testing data

## Files

```
migrate-prod-to-dev.js    # Main migration script
verify-migration.js       # Verification script
.env.production          # Production Firebase config
.env.development         # Development Firebase config
```

## Manual Migration

If you need more control, you can run the scripts directly:

```bash
# Run migration
node migrate-prod-to-dev.js

# Verify results
node verify-migration.js
```

## Troubleshooting

### Migration Fails

**Problem**: Script exits with errors

**Solutions**:
1. Check internet connection
2. Verify Firebase credentials in `.env.production` and `.env.development`
3. Check Firebase console for database accessibility
4. Re-run the migration (it's safe to retry)

### Count Mismatch

**Problem**: Verification shows different counts

**Solutions**:
1. Re-run migration: `npm run db:migrate`
2. Check for concurrent database writes during migration
3. Check Firebase console manually

### Empty Collections

**Problem**: Some collections show 0 documents

**Possible Causes**:
- Production database actually has no data in those collections
- Collection doesn't exist yet in production
- This is normal for new/unused features

## Expected Results

After running the migration, you should see:

```
✅ MIGRATION COMPLETED SUCCESSFULLY!

✅ Development database has been fully restored from production
✅ All document IDs and timestamps preserved
✅ Ready for development/testing
```

## Migration Output Example

```
📦 Migrating collection: teams
────────────────────────────────────────────────────────────
  📖 Reading from production...
     ✅ Found 1 documents in production
  🧹 Clearing existing teams in dev...
     ✅ Cleared 1 documents from teams
  💾 Writing to development...
     ✅ Migrated 1 documents
     ✅ Verification passed: 1 documents in dev
```

## Data Storage Format

**Important**: This application stores data differently than typical Firestore apps:

- Each collection contains **ONE document** with ID `data`
- The `data` document contains a **JSON string** of all records
- Example: `teams/data` contains `'[{team1}, {team2}, {team3}]'`

This is why you'll see "1 document" for collections that contain multiple teams, players, etc.

## Security Notes

### Firebase Credentials

- Credentials are stored in `.env.production` and `.env.development`
- These are **client-side credentials** (not admin credentials)
- Safe to use for read/write operations
- Do not commit `.env` files to version control

### Permissions

- Script uses standard Firebase client SDK
- Respects Firestore security rules
- Requires appropriate read/write permissions

## Performance

- **Small datasets** (< 100 docs per collection): ~5 seconds
- **Medium datasets** (100-1000 docs): ~30 seconds
- **Large datasets** (1000+ docs): 1-5 minutes
- Progress shown for large collections

## Batch Processing

The migration uses Firestore batches:
- Batch size: 500 documents per batch
- Automatic batching for collections > 500 docs
- Prevents memory issues with large datasets

## Future Enhancements

Potential improvements for the migration tool:

- [ ] Selective collection migration (choose which collections)
- [ ] Bidirectional migration (dev → prod, with warnings)
- [ ] Incremental migration (only copy changes)
- [ ] Backup before migration
- [ ] Dry-run mode (preview without changes)
- [ ] Storage migration (copy Firebase Storage files)

## Support

For issues or questions:
1. Check this guide first
2. Review error messages from the script
3. Check Firebase console for database status
4. Re-run migration if safe to do so

---

**Last Updated**: 2025-01-23
**Script Version**: 1.0
**Maintainer**: Development Team
