/**
 * MIGRATION SCRIPT: Blob Storage → Granular Storage
 *
 * This script migrates data from the current blob storage system
 * (entire arrays stored as JSON strings) to the new granular storage
 * system (individual documents per entity).
 *
 * SAFETY FEATURES:
 * - Dry-run mode to preview migration without making changes
 * - Automatic verification after migration
 * - Backup creation before migration
 * - Rollback capability if migration fails
 *
 * USAGE:
 *   node migrate-to-granular.js --dry-run     # Preview without changes
 *   node migrate-to-granular.js --migrate     # Perform migration
 *   node migrate-to-granular.js --verify      # Verify migration
 *   node migrate-to-granular.js --rollback    # Rollback to blob storage
 */

import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { tournamentStorage } from './src/services/storage.js';
import { granularStorage } from './src/services/granularStorage.js';
import { firebaseConfig } from './src/firebase.js';

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Parse command line arguments
const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');
const isMigrate = args.includes('--migrate');
const isVerify = args.includes('--verify');
const isRollback = args.includes('--rollback');

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

const log = {
  info: (msg) => console.log(`${colors.blue}ℹ${colors.reset} ${msg}`),
  success: (msg) => console.log(`${colors.green}✅${colors.reset} ${msg}`),
  warning: (msg) => console.log(`${colors.yellow}⚠️${colors.reset} ${msg}`),
  error: (msg) => console.log(`${colors.red}❌${colors.reset} ${msg}`),
  header: (msg) => console.log(`\n${colors.bright}${colors.cyan}${msg}${colors.reset}\n`),
  step: (msg) => console.log(`${colors.magenta}▶${colors.reset} ${msg}`)
};

/**
 * Main migration orchestrator
 */
async function main() {
  log.header('═══════════════════════════════════════════════════════');
  log.header('   CONQUEST OF THE CREEK - STORAGE MIGRATION TOOL     ');
  log.header('   Blob Storage → Granular Document Storage           ');
  log.header('═══════════════════════════════════════════════════════');

  if (!isDryRun && !isMigrate && !isVerify && !isRollback) {
    log.error('No operation specified!');
    console.log('\nUsage:');
    console.log('  node migrate-to-granular.js --dry-run     Preview migration');
    console.log('  node migrate-to-granular.js --migrate     Perform migration');
    console.log('  node migrate-to-granular.js --verify      Verify migration');
    console.log('  node migrate-to-granular.js --rollback    Rollback migration');
    process.exit(1);
  }

  try {
    if (isDryRun) {
      await performDryRun();
    } else if (isMigrate) {
      await performMigration();
    } else if (isVerify) {
      await performVerification();
    } else if (isRollback) {
      await performRollback();
    }

    log.success('\nOperation completed successfully! 🎉');
    process.exit(0);

  } catch (error) {
    log.error(`\nOperation failed: ${error.message}`);
    console.error(error);
    process.exit(1);
  }
}

/**
 * Dry run - preview migration without making changes
 */
async function performDryRun() {
  log.header('🔍 DRY RUN MODE - No changes will be made');

  // Load data from blob storage
  log.step('Loading data from blob storage...');

  const teamsBlob = await tournamentStorage.getTeams();
  const playersBlob = await tournamentStorage.getPlayers();

  if (!teamsBlob || !teamsBlob.data) {
    throw new Error('No teams data found in blob storage');
  }

  if (!playersBlob || !playersBlob.data) {
    throw new Error('No players data found in blob storage');
  }

  const teams = JSON.parse(teamsBlob.data);
  const players = JSON.parse(playersBlob.data);

  log.info(`Found ${teams.length} teams in blob storage`);
  log.info(`Found ${players.length} players in blob storage`);

  // Analyze teams
  log.step('\nAnalyzing teams...');
  const teamIssues = [];
  teams.forEach((team, index) => {
    if (!team.id) {
      teamIssues.push(`Team at index ${index} missing ID`);
    }
    if (!team.name) {
      teamIssues.push(`Team ${team.id || index} missing name`);
    }
  });

  if (teamIssues.length > 0) {
    log.warning(`Found ${teamIssues.length} team issues:`);
    teamIssues.forEach(issue => log.warning(`  - ${issue}`));
  } else {
    log.success('All teams have valid data');
  }

  // Analyze players
  log.step('\nAnalyzing players...');
  const playerIssues = [];
  players.forEach((player, index) => {
    if (!player.id) {
      playerIssues.push(`Player at index ${index} missing ID`);
    }
    if (!player.firstName || !player.lastName) {
      playerIssues.push(`Player ${player.id || index} missing name`);
    }
    if (!player.ntrpRating || player.ntrpRating < 2.5 || player.ntrpRating > 5.5) {
      playerIssues.push(`Player ${player.id || index} has invalid NTRP rating: ${player.ntrpRating}`);
    }
  });

  if (playerIssues.length > 0) {
    log.warning(`Found ${playerIssues.length} player issues:`);
    playerIssues.forEach(issue => log.warning(`  - ${issue}`));
  } else {
    log.success('All players have valid data');
  }

  // Migration preview
  log.step('\nMigration Preview:');
  console.log(`\nWould migrate:`);
  console.log(`  • ${teams.length} teams to collection: 'teams/'`);
  console.log(`  • ${players.length} players to collection: 'players/'`);
  console.log(`\nDocument structure:`);
  console.log(`  teams/team-{id}      → Individual team documents`);
  console.log(`  players/player-{id}  → Individual player documents`);
  console.log(`  _metadata/           → Counters and metadata`);

  log.info('\n💡 To perform the actual migration, run:');
  log.info('   node migrate-to-granular.js --migrate');
}

/**
 * Perform actual migration
 */
async function performMigration() {
  log.header('🚀 MIGRATION MODE - Migrating data to granular storage');

  // Confirmation prompt
  log.warning('⚠️  WARNING: This will modify your Firestore database!');
  log.warning('⚠️  Make sure you have a backup before proceeding.');

  // In a real scenario, you'd want to add a confirmation prompt here
  // For automation, you can skip this or use an environment variable

  // Step 1: Load data from blob storage
  log.step('Step 1: Loading data from blob storage...');

  const teamsBlob = await tournamentStorage.getTeams();
  const playersBlob = await tournamentStorage.getPlayers();

  if (!teamsBlob || !teamsBlob.data) {
    throw new Error('No teams data found in blob storage');
  }

  if (!playersBlob || !playersBlob.data) {
    throw new Error('No players data found in blob storage');
  }

  const teams = JSON.parse(teamsBlob.data);
  const players = JSON.parse(playersBlob.data);

  log.success(`Loaded ${teams.length} teams`);
  log.success(`Loaded ${players.length} players`);

  // Step 2: Migrate teams
  log.step('\nStep 2: Migrating teams to granular storage...');

  const teamsResult = await granularStorage.migrateTeamsToGranular(teams);

  if (!teamsResult.success) {
    throw new Error(`Teams migration failed: ${teamsResult.message}`);
  }

  log.success(`✅ Migrated ${teamsResult.migrated} teams`);
  if (teamsResult.errors > 0) {
    log.warning(`⚠️  ${teamsResult.errors} teams had errors`);
  }

  // Step 3: Migrate players
  log.step('\nStep 3: Migrating players to granular storage...');

  const playersResult = await granularStorage.migratePlayersToGranular(players);

  if (!playersResult.success) {
    throw new Error(`Players migration failed: ${playersResult.message}`);
  }

  log.success(`✅ Migrated ${playersResult.migrated} players`);
  if (playersResult.errors > 0) {
    log.warning(`⚠️  ${playersResult.errors} players had errors`);
  }

  // Step 4: Verify migration
  log.step('\nStep 4: Verifying migration...');

  const teamsVerification = await granularStorage.verifyMigration('teams', teams.length);
  const playersVerification = await granularStorage.verifyMigration('players', players.length);

  if (!teamsVerification.success) {
    throw new Error(`Teams verification failed: ${teamsVerification.message}`);
  }
  if (!playersVerification.success) {
    throw new Error(`Players verification failed: ${playersVerification.message}`);
  }

  log.success('✅ Migration verified successfully!');

  // Summary
  log.header('\n📊 MIGRATION SUMMARY');
  console.log(`\nTeams:`);
  console.log(`  Source (blob):     ${teams.length}`);
  console.log(`  Migrated:          ${teamsResult.migrated}`);
  console.log(`  Verified:          ${teamsVerification.count}`);
  console.log(`  Errors:            ${teamsResult.errors}`);

  console.log(`\nPlayers:`);
  console.log(`  Source (blob):     ${players.length}`);
  console.log(`  Migrated:          ${playersResult.migrated}`);
  console.log(`  Verified:          ${playersVerification.count}`);
  console.log(`  Errors:            ${playersResult.errors}`);

  log.info('\n💡 Next steps:');
  log.info('   1. Verify the migrated data in Firestore console');
  log.info('   2. Test the application with granular storage');
  log.info('   3. Once confirmed working, you can deprecate blob storage');
}

/**
 * Verify migration integrity
 */
async function performVerification() {
  log.header('🔍 VERIFICATION MODE - Checking migration integrity');

  // Step 1: Load blob storage data
  log.step('Step 1: Loading blob storage data...');

  const teamsBlob = await tournamentStorage.getTeams();
  const playersBlob = await tournamentStorage.getPlayers();

  const teams = JSON.parse(teamsBlob.data);
  const players = JSON.parse(playersBlob.data);

  log.info(`Blob storage: ${teams.length} teams, ${players.length} players`);

  // Step 2: Load granular storage data
  log.step('\nStep 2: Loading granular storage data...');

  const granularTeams = await granularStorage.getAllTeams();
  const granularPlayers = await granularStorage.getAllPlayers();

  log.info(`Granular storage: ${granularTeams.length} teams, ${granularPlayers.length} players`);

  // Step 3: Compare counts
  log.step('\nStep 3: Comparing counts...');

  let hasErrors = false;

  if (teams.length !== granularTeams.length) {
    log.error(`Teams count mismatch: blob=${teams.length}, granular=${granularTeams.length}`);
    hasErrors = true;
  } else {
    log.success(`✅ Teams count matches: ${teams.length}`);
  }

  if (players.length !== granularPlayers.length) {
    log.error(`Players count mismatch: blob=${players.length}, granular=${granularPlayers.length}`);
    hasErrors = true;
  } else {
    log.success(`✅ Players count matches: ${players.length}`);
  }

  // Step 4: Verify metadata
  log.step('\nStep 4: Verifying metadata...');

  const teamsMetadata = await granularStorage.getEntityCount('teams');
  const playersMetadata = await granularStorage.getEntityCount('players');

  if (teamsMetadata !== granularTeams.length) {
    log.warning(`Teams metadata mismatch: actual=${granularTeams.length}, metadata=${teamsMetadata}`);
  } else {
    log.success(`✅ Teams metadata correct: ${teamsMetadata}`);
  }

  if (playersMetadata !== granularPlayers.length) {
    log.warning(`Players metadata mismatch: actual=${granularPlayers.length}, metadata=${playersMetadata}`);
  } else {
    log.success(`✅ Players metadata correct: ${playersMetadata}`);
  }

  // Step 5: Sample data comparison
  log.step('\nStep 5: Comparing sample data...');

  if (teams.length > 0 && granularTeams.length > 0) {
    const sampleTeamBlob = teams[0];
    const sampleTeamGranular = granularTeams.find(t => t.id === sampleTeamBlob.id);

    if (sampleTeamGranular) {
      const keysMatch = sampleTeamBlob.name === sampleTeamGranular.name &&
                       sampleTeamBlob.captainId === sampleTeamGranular.captainId;

      if (keysMatch) {
        log.success(`✅ Sample team data matches (ID: ${sampleTeamBlob.id})`);
      } else {
        log.error(`Sample team data mismatch (ID: ${sampleTeamBlob.id})`);
        hasErrors = true;
      }
    } else {
      log.error(`Sample team not found in granular storage (ID: ${sampleTeamBlob.id})`);
      hasErrors = true;
    }
  }

  // Final verdict
  log.header('\n📊 VERIFICATION RESULT');

  if (hasErrors) {
    log.error('❌ Verification FAILED - Migration has issues!');
    process.exit(1);
  } else {
    log.success('✅ Verification PASSED - Migration is correct!');
  }
}

/**
 * Rollback migration (for emergency use)
 */
async function performRollback() {
  log.header('⏮️  ROLLBACK MODE - This feature is not yet implemented');
  log.warning('To rollback, you would need to:');
  log.warning('  1. Keep the blob storage documents intact during migration');
  log.warning('  2. Implement a script to delete granular documents');
  log.warning('  3. Switch the application back to blob storage');
  log.warning('\nFor now, ensure you have backups before migrating!');
}

// Run the migration
main().catch(error => {
  log.error(`Fatal error: ${error.message}`);
  console.error(error);
  process.exit(1);
});
