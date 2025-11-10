# Database Query Guide

This guide explains how to query the Conquest of the Creek Firebase database.

---

## 🚀 Quick Start

### Option 1: Using npm scripts (Recommended)

```bash
# Check complete database status (all collections)
npm run db:status

# Query all data with details
npm run query:all

# Query only matches
npm run query:matches
```

### Option 2: Direct node commands

```bash
# Query all database collections
node query-all-data.js

# Query matches specifically
node query-matches.js
```

---

## 📋 Available Query Scripts

### 1. **query-all-data.js** - Complete Database Inspection
**What it shows:**
- All collections in the database
- Document counts
- Data structure and types
- Sample data from each collection
- Last update timestamps

**When to use:**
- Getting overall database health check
- Checking what data exists
- Debugging data structure issues
- Audit/reporting purposes

**Example output:**
```
📁 Collection: matches
─────────────────────
✅ Found 'data' document
   updatedAt: 2025-11-10T00:17:48.175Z
   data type: string
   ✅ Parsed array with 1 items

   📋 Sample Match Data (first item):
      ID: 1762650448694
      Date: 2025-11-08
      Level: 7.0
```

---

### 2. **query-matches.js** - Detailed Match Information
**What it shows:**
- Total number of completed matches
- Match statistics (by level, date range)
- First 10 matches with full details:
  - Teams
  - Scores
  - Winners
  - Points
  - Players

**When to use:**
- Getting tournament progress updates
- Checking match results
- Generating match reports
- Verifying data integrity

**Example output:**
```
═══════════════════════════════════════════════════
📊 TOTAL COMPLETED MATCHES: 1
═══════════════════════════════════════════════════

📈 MATCH STATISTICS:
─────────────────────
📅 Date Range: 11/7/2025 to 11/7/2025

🎾 Matches by Level:
   Level 7.0: 1 matches
```

---

## 🔧 Prerequisites

These scripts require:
1. **Node.js** installed (already have this)
2. **dotenv package** (already installed)
3. **Firebase configuration** in `.env.production`

All prerequisites are already set up in your project!

---

## 📝 Modifying the Queries

### Query Different Environments

By default, the scripts use **production** data. To query development:

1. Edit the script file (e.g., `query-all-data.js`)
2. Change the line:
   ```javascript
   dotenv.config({ path: '.env.production' });
   ```
   to:
   ```javascript
   dotenv.config({ path: '.env.development' });
   ```

### Add More Collections

To query additional collections, edit `query-all-data.js`:

```javascript
const collections = [
  'teams',
  'matches',
  'bonuses',
  'photos',
  'captains',
  'challenges',
  'YOUR_NEW_COLLECTION_HERE'  // Add your collection
];
```

### Filter/Search Specific Data

The scripts load all data. To filter specific matches:

Edit `query-matches.js` and add filters:
```javascript
// Example: Only show matches from a specific team
const filteredMatches = matches.filter(m =>
  m.team1Id === SPECIFIC_TEAM_ID || m.team2Id === SPECIFIC_TEAM_ID
);

// Example: Only show matches from last week
const oneWeekAgo = new Date();
oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
const recentMatches = matches.filter(m =>
  new Date(m.date) >= oneWeekAgo
);
```

---

## 🔒 Security Notes

- **Read-only access**: These scripts only READ data, they never modify it
- **Production database**: The scripts connect to your live production database
- **Credentials**: Your Firebase credentials are in `.env.production` (not committed to git)
- **Safe to run**: You can run these queries as often as needed without affecting users

---

## 📊 Output Files

After running queries, you'll have:
- **Terminal output**: Real-time query results
- **database-summary.md**: Markdown report of database status (if generated)

---

## 🆘 Troubleshooting

### Error: "Cannot find module 'dotenv'"
```bash
npm install dotenv
```

### Error: "Firebase configuration missing"
Check that `.env.production` exists and contains all required variables:
- VITE_FIREBASE_API_KEY
- VITE_FIREBASE_AUTH_DOMAIN
- VITE_FIREBASE_PROJECT_ID
- VITE_FIREBASE_STORAGE_BUCKET
- VITE_FIREBASE_MESSAGING_SENDER_ID
- VITE_FIREBASE_APP_ID

### Error: "Permission denied"
Verify your Firebase API key has read access to Firestore.

### No data showing
- Check that the database actually has data
- Verify you're querying the correct environment (production vs development)

---

## 📖 Examples

### Quick Status Check
```bash
npm run db:status
```

### Generate Weekly Report
```bash
npm run query:matches > weekly-report.txt
```

### Monitor Database Growth
```bash
# Run periodically and compare results
npm run query:all
```

---

## 💡 Tips

1. **Run before tournaments** to verify data is ready
2. **Run after tournaments** to check results were recorded
3. **Pipe to file** to save reports: `npm run query:all > report.txt`
4. **Schedule queries** if you want automated reporting
5. **Modify scripts** to add custom analytics or reports

---

## 🔄 Future Enhancements

You can extend these scripts to:
- Generate CSV exports
- Create visualizations
- Send email reports
- Calculate tournament standings
- Export to Excel/PDF
- Create automated backups

---

**Questions?** Check the script files for inline documentation or modify them to suit your needs!
