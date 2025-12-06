/**
 * Matches Migration Tool Component
 *
 * Provides a UI for directors to:
 * 1. Migrate completed matches from blob storage to individual documents
 * 2. Create pending matches from accepted challenges
 *
 * Only visible to directors.
 */

import React, { useState } from 'react';
import { Database, Check, AlertCircle, RefreshCw, Upload, Plus, Zap, RotateCw, Wand2, Wrench } from 'lucide-react';
import { migrateMatches, createPendingMatchesFromChallenges, forceRecreatePendingMatches, reMigrateAllMatchesFromBackup, fullMatchMigration, fixChallengeIdField, ensureCreatedAtField, verifyMatchesMigration } from '../utils/migrateMatches';

export default function MatchesMigrationTool({ userRole }) {
  const [isMigratingMatches, setIsMigratingMatches] = useState(false);
  const [isCreatingPending, setIsCreatingPending] = useState(false);
  const [isForcingRecreate, setIsForcingRecreate] = useState(false);
  const [isReMigrating, setIsReMigrating] = useState(false);
  const [isFullMigrating, setIsFullMigrating] = useState(false);
  const [isFixingChallengeId, setIsFixingChallengeId] = useState(false);
  const [isFixingCreatedAt, setIsFixingCreatedAt] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [matchesStatus, setMatchesStatus] = useState(null);
  const [pendingStatus, setPendingStatus] = useState(null);
  const [forceRecreateStatus, setForceRecreateStatus] = useState(null);
  const [reMigrateStatus, setReMigrateStatus] = useState(null);
  const [fullMigrationStatus, setFullMigrationStatus] = useState(null);
  const [fixChallengeIdStatus, setFixChallengeIdStatus] = useState(null);
  const [fixCreatedAtStatus, setFixCreatedAtStatus] = useState(null);
  const [verificationStatus, setVerificationStatus] = useState(null);

  // Only show to directors
  if (userRole !== 'director') {
    return null;
  }

  const handleMigrateMatches = async () => {
    if (!window.confirm(
      '⚠️ MATCHES MIGRATION TO INDIVIDUAL DOCUMENTS\n\n' +
      'This will:\n' +
      '1. Read all completed matches from blob storage (matches/data)\n' +
      '2. Create individual Firestore documents for each match\n' +
      '3. Create a backup of the original blob data\n' +
      '4. Enable real-time updates for matches\n\n' +
      '✅ This is SAFE - the original data will be backed up\n\n' +
      'Continue with migration?'
    )) {
      return;
    }

    setIsMigratingMatches(true);
    setMatchesStatus(null);

    try {
      console.log('🚀 Starting matches migration...');
      const result = await migrateMatches();

      if (result.success) {
        setMatchesStatus({
          success: true,
          message: `✅ Matches migration completed!\n\n` +
            `• Migrated: ${result.migrated} matches\n` +
            `• Errors: ${result.errors || 0}\n` +
            `• Invalid (skipped): ${result.invalidCount || 0}\n\n` +
            `${result.message}\n\n` +
            `Next: Click "Create Pending Matches" to add pending matches from accepted challenges.`
        });
      } else {
        setMatchesStatus({
          success: false,
          message: `❌ Matches migration failed:\n\n${result.message}`
        });
      }
    } catch (error) {
      console.error('❌ Matches migration error:', error);
      setMatchesStatus({
        success: false,
        message: `❌ Migration error:\n\n${error.message}`
      });
    } finally {
      setIsMigratingMatches(false);
    }
  };

  const handleCreatePendingMatches = async () => {
    if (!window.confirm(
      '⚠️ CREATE PENDING MATCHES FROM CHALLENGES\n\n' +
      'This will:\n' +
      '1. Find all accepted challenges\n' +
      '2. Create pending match documents for each accepted challenge\n' +
      '3. Skip challenges that already have matches\n\n' +
      'This enables the Matches page to show pending matches directly\n' +
      'from the matches collection (no more deriving from challenges).\n\n' +
      'Continue?'
    )) {
      return;
    }

    setIsCreatingPending(true);
    setPendingStatus(null);

    try {
      console.log('🚀 Creating pending matches...');
      const result = await createPendingMatchesFromChallenges();

      if (result.success) {
        setPendingStatus({
          success: true,
          message: `✅ Pending matches created!\n\n` +
            `• Created: ${result.created} pending matches\n` +
            `• Skipped (already pending): ${result.skippedPending || 0}\n` +
            `• Skipped (already completed): ${result.skippedCompleted || 0}\n` +
            `• Errors: ${result.errors || 0}\n\n` +
            `${result.message}\n\n` +
            `✅ Matches page will now show these pending matches!`
        });
      } else {
        setPendingStatus({
          success: false,
          message: `❌ Failed to create pending matches:\n\n${result.message}`
        });
      }
    } catch (error) {
      console.error('❌ Pending matches error:', error);
      setPendingStatus({
        success: false,
        message: `❌ Error:\n\n${error.message}`
      });
    } finally {
      setIsCreatingPending(false);
    }
  };

  const handleForceRecreatePendingMatches = async () => {
    if (!window.confirm(
      '⚠️ FORCE CREATE PENDING MATCHES\n\n' +
      'This will:\n' +
      '1. Find ALL accepted challenges\n' +
      '2. Create NEW pending matches for challenges that don\'t have ANY match yet\n' +
      '3. Skip challenges that already have a match (pending or completed)\n\n' +
      '✅ SAFE - Never overwrites existing matches!\n\n' +
      'Use this if some accepted challenges are missing their pending matches.\n\n' +
      'Continue?'
    )) {
      return;
    }

    setIsForcingRecreate(true);
    setForceRecreateStatus(null);

    try {
      console.log('🚀 Force creating pending matches...');
      const result = await forceRecreatePendingMatches();

      if (result.success) {
        setForceRecreateStatus({
          success: true,
          message: `✅ Force create complete!\n\n` +
            `• Created: ${result.created} new pending matches\n` +
            `• Skipped: ${result.skipped || 0} (already have a match)\n` +
            `• Errors: ${result.errors || 0}\n\n` +
            `${result.message}\n\n` +
            `✅ All accepted challenges without matches now have pending matches!`
        });
      } else {
        setForceRecreateStatus({
          success: false,
          message: `❌ Failed to force create:\n\n${result.message}`
        });
      }
    } catch (error) {
      console.error('❌ Force create error:', error);
      setForceRecreateStatus({
        success: false,
        message: `❌ Error:\n\n${error.message}`
      });
    } finally {
      setIsForcingRecreate(false);
    }
  };

  const handleReMigrateFromBackup = async () => {
    if (!window.confirm(
      '⚠️ RE-MIGRATE ALL MATCHES FROM BACKUP\n\n' +
      'This will:\n' +
      '1. Read the backup blob at matches/data_backup_blob\n' +
      '2. Migrate ALL matches from the backup\n' +
      '3. Include directly entered matches without challengeId\n' +
      '4. Skip matches that already exist\n\n' +
      '✅ This is SAFE - it only creates NEW matches, does not overwrite existing ones\n\n' +
      'Use this if you suspect some matches were not migrated during the original migration.\n\n' +
      'Continue?'
    )) {
      return;
    }

    setIsReMigrating(true);
    setReMigrateStatus(null);

    try {
      console.log('🚀 Re-migrating from backup...');
      const result = await reMigrateAllMatchesFromBackup();

      if (result.success) {
        setReMigrateStatus({
          success: true,
          message: `✅ Re-migration complete!\n\n` +
            `• Total in backup: ${result.total || 0}\n` +
            `• Created: ${result.created} new matches\n` +
            `• Skipped: ${result.skipped || 0} (already exist)\n` +
            `• Errors: ${result.errors || 0}\n\n` +
            `${result.message}\n\n` +
            `✅ All matches from backup are now migrated!`
        });
      } else {
        setReMigrateStatus({
          success: false,
          message: `❌ Failed to re-migrate:\n\n${result.message}`
        });
      }
    } catch (error) {
      console.error('❌ Re-migration error:', error);
      setReMigrateStatus({
        success: false,
        message: `❌ Error:\n\n${error.message}`
      });
    } finally {
      setIsReMigrating(false);
    }
  };

  const handleFullMigration = async () => {
    if (!window.confirm(
      '🔧 FULL MATCH MIGRATION (RECOMMENDED)\n\n' +
      'This comprehensive migration will:\n\n' +
      '1. Create PENDING matches from accepted challenges\n' +
      '2. Migrate COMPLETED matches from backup blob\n' +
      '3. Include directly entered matches (without challengeId)\n' +
      '4. Skip duplicates automatically\n\n' +
      '✅ This is the BEST way to ensure all matches are migrated correctly!\n\n' +
      'Continue?'
    )) {
      return;
    }

    setIsFullMigrating(true);
    setFullMigrationStatus(null);

    try {
      console.log('🚀 Starting full migration...');
      const result = await fullMatchMigration();

      if (result.success) {
        setFullMigrationStatus({
          success: true,
          message: `✅ Full migration complete!\n\n` +
            `📊 Results:\n` +
            `• Pending matches: ${result.createdPending}\n` +
            `• Completed matches: ${result.createdCompleted}\n` +
            `• Skipped (duplicates): ${result.skipped}\n\n` +
            `📋 Processed:\n` +
            `• Accepted challenges: ${result.acceptedChallenges}\n` +
            `• Backup matches: ${result.backupMatches}\n\n` +
            `${result.message}\n\n` +
            `✅ All matches have been migrated successfully!`
        });
      } else {
        setFullMigrationStatus({
          success: false,
          message: `❌ Full migration failed:\n\n${result.message}`
        });
      }
    } catch (error) {
      console.error('❌ Full migration error:', error);
      setFullMigrationStatus({
        success: false,
        message: `❌ Error:\n\n${error.message}`
      });
    } finally {
      setIsFullMigrating(false);
    }
  };

  const handleFixChallengeId = async () => {
    if (!window.confirm(
      '🔧 FIX CHALLENGEID FIELD\n\n' +
      'This will copy originChallengeId to challengeId for matches that are missing it.\n\n' +
      'This fixes the issue where pending matches are not displaying because ' +
      'they have originChallengeId but the app expects challengeId.\n\n' +
      '✅ Safe to run - only adds missing challengeId field\n\n' +
      'Continue?'
    )) {
      return;
    }

    setIsFixingChallengeId(true);
    setFixChallengeIdStatus(null);

    try {
      console.log('🚀 Fixing challengeId field...');
      const result = await fixChallengeIdField();

      if (result.success) {
        setFixChallengeIdStatus({
          success: true,
          message: `✅ Fix complete!\n\n` +
            `• Fixed: ${result.fixed} matches\n` +
            `• Already correct: ${result.alreadyCorrect}\n` +
            `• Skipped: ${result.skipped}\n\n` +
            `${result.message}\n\n` +
            `✅ Pending matches should now display correctly!`
        });
      } else {
        setFixChallengeIdStatus({
          success: false,
          message: `❌ Fix failed:\n\n${result.message}`
        });
      }
    } catch (error) {
      console.error('❌ Fix error:', error);
      setFixChallengeIdStatus({
        success: false,
        message: `❌ Error:\n\n${error.message}`
      });
    } finally {
      setIsFixingChallengeId(false);
    }
  };

  const handleEnsureCreatedAt = async () => {
    if (!window.confirm(
      '🔧 ENSURE CREATEDAT FIELD\n\n' +
      'This will add the createdAt field to matches that are missing it.\n\n' +
      'This fixes the issue where matches without createdAt are not showing up ' +
      'because Firestore queries with orderBy("createdAt") exclude documents missing that field.\n\n' +
      'The function will use fallback values in this order:\n' +
      '1. date field (if available)\n' +
      '2. completedAt field (if available)\n' +
      '3. scheduledDate field (if available)\n' +
      '4. timestamp field (if available)\n' +
      '5. Current timestamp (last resort)\n\n' +
      '✅ Safe to run - only adds missing createdAt field\n\n' +
      'Continue?'
    )) {
      return;
    }

    setIsFixingCreatedAt(true);
    setFixCreatedAtStatus(null);

    try {
      console.log('🚀 Ensuring createdAt field...');
      const result = await ensureCreatedAtField();

      if (result.success) {
        setFixCreatedAtStatus({
          success: true,
          message: `✅ Fix complete!\n\n` +
            `• Fixed: ${result.fixed} matches\n` +
            `• Already had createdAt: ${result.alreadyCorrect}\n` +
            `• Skipped (blob docs): ${result.skipped}\n\n` +
            `${result.message}\n\n` +
            `✅ All matches should now appear in Match History and Leaderboard!`
        });
      } else {
        setFixCreatedAtStatus({
          success: false,
          message: `❌ Fix failed:\n\n${result.message}`
        });
      }
    } catch (error) {
      console.error('❌ Fix error:', error);
      setFixCreatedAtStatus({
        success: false,
        message: `❌ Error:\n\n${error.message}`
      });
    } finally {
      setIsFixingCreatedAt(false);
    }
  };

  const handleVerify = async () => {
    setIsVerifying(true);
    setVerificationStatus(null);

    try {
      console.log('🔍 Verifying matches migration...');
      const result = await verifyMatchesMigration();

      if (result.success) {
        setVerificationStatus({
          success: true,
          message: `✅ Verification complete!\n\n` +
            `📊 Blob Storage:\n` +
            `• Original blob: ${result.blobCount}\n` +
            `• Backup blob: ${result.backupCount}\n\n` +
            `📊 Individual Documents:\n` +
            `• Total: ${result.documentCount}\n` +
            `• Pending: ${result.pendingCount}\n` +
            `• Completed: ${result.completedCount}\n\n` +
            `📊 By Source:\n` +
            `• With challengeId: ${result.withChallengeId}\n` +
            `• Without challengeId (direct): ${result.withoutChallengeId}\n\n` +
            `${result.documentCount === result.backupCount ? '✅ All backup matches are migrated!' : '⚠️ Some backup matches may not be migrated'}`
        });
      } else {
        setVerificationStatus({
          success: false,
          message: `⚠️ Verification failed:\n\n${result.message}`
        });
      }
    } catch (error) {
      console.error('❌ Verification error:', error);
      setVerificationStatus({
        success: false,
        message: `❌ Verification error:\n\n${error.message}`
      });
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <div className="bg-green-50 border border-green-200 rounded-lg p-6">
      <div className="flex items-start gap-4">
        <Database className="w-6 h-6 text-green-600 mt-1 flex-shrink-0" />
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-green-900 mb-2">
            Matches Architecture Migration
          </h3>
          <p className="text-sm text-green-700 mb-4">
            Migrate matches from blob storage to individual Firestore documents,
            and create pending matches from accepted challenges. This enables
            real-time updates and eliminates the dependency on challenges for
            showing pending matches.
          </p>

          {/* Full Migration Section (Recommended) */}
          <div className="mb-6 p-4 bg-yellow-50 border-2 border-yellow-400 rounded-lg">
            <div className="flex items-start gap-3 mb-3">
              <Wand2 className="w-6 h-6 text-yellow-600 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <h4 className="font-bold text-yellow-900 mb-1">🔧 Full Match Migration (Recommended)</h4>
                <p className="text-sm text-yellow-800 mb-2">
                  This does everything in one step:
                </p>
                <ul className="text-sm text-yellow-800 space-y-1 mb-3 ml-4">
                  <li>• Creates PENDING matches from accepted challenges</li>
                  <li>• Migrates COMPLETED matches from backup (including direct entries)</li>
                  <li>• Skips duplicates automatically</li>
                  <li>• Handles all scenarios correctly</li>
                </ul>
                <button
                  onClick={handleFullMigration}
                  disabled={isFullMigrating || isMigratingMatches || isCreatingPending || isForcingRecreate || isReMigrating || isVerifying}
                  className="flex items-center gap-2 bg-yellow-600 text-white px-5 py-2.5 rounded-lg hover:bg-yellow-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm font-bold shadow-md"
                >
                  <Wand2 className="w-5 h-5" />
                  {isFullMigrating ? 'Running Full Migration...' : 'Run Full Match Migration'}
                </button>
              </div>
            </div>
          </div>

          {/* Full Migration Status */}
          {fullMigrationStatus && (
            <div className={`mb-4 p-4 rounded-lg ${
              fullMigrationStatus.success
                ? 'bg-green-100 border border-green-300 text-green-900'
                : 'bg-red-100 border border-red-300 text-red-900'
            }`}>
              <div className="flex items-start gap-2">
                {fullMigrationStatus.success ? (
                  <Check className="w-5 h-5 flex-shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                )}
                <p className="text-sm whitespace-pre-line font-medium">{fullMigrationStatus.message}</p>
              </div>
            </div>
          )}

          {/* Fix challengeId Field Section */}
          <div className="mb-6 p-4 bg-blue-50 border border-blue-300 rounded-lg">
            <div className="flex items-start gap-3 mb-3">
              <Wrench className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <h4 className="font-semibold text-blue-900 mb-1">🔧 Fix challengeId Field</h4>
                <p className="text-sm text-blue-800 mb-2">
                  If pending matches are not displaying, this fixes the field name mismatch
                  by copying originChallengeId to challengeId for matches that are missing it.
                </p>
                <button
                  onClick={handleFixChallengeId}
                  disabled={isFixingChallengeId || isMigratingMatches || isCreatingPending || isForcingRecreate || isReMigrating || isFullMigrating || isVerifying}
                  className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium shadow-sm"
                >
                  <Wrench className="w-4 h-4" />
                  {isFixingChallengeId ? 'Fixing...' : 'Fix challengeId Field'}
                </button>
              </div>
            </div>
          </div>

          {/* Fix challengeId Status */}
          {fixChallengeIdStatus && (
            <div className={`mb-4 p-4 rounded-lg ${
              fixChallengeIdStatus.success
                ? 'bg-green-100 border border-green-300 text-green-900'
                : 'bg-red-100 border border-red-300 text-red-900'
            }`}>
              <div className="flex items-start gap-2">
                {fixChallengeIdStatus.success ? (
                  <Check className="w-5 h-5 flex-shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                )}
                <p className="text-sm whitespace-pre-line font-medium">{fixChallengeIdStatus.message}</p>
              </div>
            </div>
          )}

          {/* Ensure createdAt Field Section */}
          <div className="mb-6 p-4 bg-teal-50 border border-teal-300 rounded-lg">
            <div className="flex items-start gap-3 mb-3">
              <Wrench className="w-5 h-5 text-teal-600 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <h4 className="font-semibold text-teal-900 mb-1">🔧 Ensure createdAt Field</h4>
                <p className="text-sm text-teal-800 mb-2">
                  If manually-entered matches are not showing up in Match History or Leaderboard,
                  this adds the missing createdAt field. Firestore queries with orderBy("createdAt")
                  exclude documents without this field.
                </p>
                <button
                  onClick={handleEnsureCreatedAt}
                  disabled={isFixingCreatedAt || isMigratingMatches || isCreatingPending || isForcingRecreate || isReMigrating || isFullMigrating || isFixingChallengeId || isVerifying}
                  className="flex items-center gap-2 bg-teal-600 text-white px-4 py-2 rounded-lg hover:bg-teal-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium shadow-sm"
                >
                  <Wrench className="w-4 h-4" />
                  {isFixingCreatedAt ? 'Fixing...' : 'Ensure createdAt Field'}
                </button>
              </div>
            </div>
          </div>

          {/* Ensure createdAt Status */}
          {fixCreatedAtStatus && (
            <div className={`mb-4 p-4 rounded-lg ${
              fixCreatedAtStatus.success
                ? 'bg-green-100 border border-green-300 text-green-900'
                : 'bg-red-100 border border-red-300 text-red-900'
            }`}>
              <div className="flex items-start gap-2">
                {fixCreatedAtStatus.success ? (
                  <Check className="w-5 h-5 flex-shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                )}
                <p className="text-sm whitespace-pre-line font-medium">{fixCreatedAtStatus.message}</p>
              </div>
            </div>
          )}

          {/* Matches Migration Status */}
          {matchesStatus && (
            <div className={`mb-4 p-4 rounded-lg ${
              matchesStatus.success
                ? 'bg-green-100 border border-green-300 text-green-900'
                : 'bg-red-100 border border-red-300 text-red-900'
            }`}>
              <div className="flex items-start gap-2">
                {matchesStatus.success ? (
                  <Check className="w-5 h-5 flex-shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                )}
                <p className="text-sm whitespace-pre-line font-medium">{matchesStatus.message}</p>
              </div>
            </div>
          )}

          {/* Pending Matches Status */}
          {pendingStatus && (
            <div className={`mb-4 p-4 rounded-lg ${
              pendingStatus.success
                ? 'bg-green-100 border border-green-300 text-green-900'
                : 'bg-red-100 border border-red-300 text-red-900'
            }`}>
              <div className="flex items-start gap-2">
                {pendingStatus.success ? (
                  <Check className="w-5 h-5 flex-shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                )}
                <p className="text-sm whitespace-pre-line font-medium">{pendingStatus.message}</p>
              </div>
            </div>
          )}

          {/* Force Recreate Status */}
          {forceRecreateStatus && (
            <div className={`mb-4 p-4 rounded-lg ${
              forceRecreateStatus.success
                ? 'bg-green-100 border border-green-300 text-green-900'
                : 'bg-red-100 border border-red-300 text-red-900'
            }`}>
              <div className="flex items-start gap-2">
                {forceRecreateStatus.success ? (
                  <Check className="w-5 h-5 flex-shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                )}
                <p className="text-sm whitespace-pre-line font-medium">{forceRecreateStatus.message}</p>
              </div>
            </div>
          )}

          {/* Re-Migrate Status */}
          {reMigrateStatus && (
            <div className={`mb-4 p-4 rounded-lg ${
              reMigrateStatus.success
                ? 'bg-green-100 border border-green-300 text-green-900'
                : 'bg-red-100 border border-red-300 text-red-900'
            }`}>
              <div className="flex items-start gap-2">
                {reMigrateStatus.success ? (
                  <Check className="w-5 h-5 flex-shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                )}
                <p className="text-sm whitespace-pre-line font-medium">{reMigrateStatus.message}</p>
              </div>
            </div>
          )}

          {/* Verification Status */}
          {verificationStatus && (
            <div className={`mb-4 p-4 rounded-lg ${
              verificationStatus.success
                ? 'bg-green-100 border border-green-300 text-green-900'
                : 'bg-yellow-100 border border-yellow-300 text-yellow-900'
            }`}>
              <div className="flex items-start gap-2">
                {verificationStatus.success ? (
                  <Check className="w-5 h-5 flex-shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                )}
                <p className="text-sm whitespace-pre-line font-medium">{verificationStatus.message}</p>
              </div>
            </div>
          )}

          {/* Benefits List */}
          <div className="bg-white border border-green-200 rounded-lg p-4 mb-4">
            <h4 className="font-semibold text-green-900 text-sm mb-2">Benefits of Migration:</h4>
            <ul className="text-sm text-green-700 space-y-1">
              <li className="flex items-start gap-2">
                <Check className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                <span><strong>Real-time updates</strong> - Matches update instantly across all users</span>
              </li>
              <li className="flex items-start gap-2">
                <Check className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                <span><strong>No dependency on challenges</strong> - Matches page loads independently</span>
              </li>
              <li className="flex items-start gap-2">
                <Check className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                <span><strong>Pending matches</strong> - Direct documents for pending matches</span>
              </li>
              <li className="flex items-start gap-2">
                <Check className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                <span><strong>Auto-save</strong> - No more "Save Data" button needed</span>
              </li>
            </ul>
          </div>

          {/* Warning Box */}
          <div className="bg-yellow-50 border border-yellow-300 rounded-lg p-4 mb-4">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-5 h-5 text-yellow-700 mt-0.5 flex-shrink-0" />
              <div className="text-sm text-yellow-800">
                <p className="font-semibold mb-1">Migration Order:</p>
                <ul className="list-decimal list-inside space-y-1 ml-2">
                  <li>Migrate completed matches first (from blob storage)</li>
                  <li>Then create pending matches from accepted challenges</li>
                  <li>Verify to confirm all data migrated correctly</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Individual Migration Tools (Advanced) */}
          <div className="border-t border-green-300 pt-4 mt-4">
            <h4 className="font-semibold text-green-900 mb-2 text-sm">Advanced Migration Tools (Optional)</h4>
            <p className="text-xs text-green-700 mb-3">
              Use these only if you need to run specific migration steps individually.
              Most users should use "Full Match Migration" above.
            </p>

            <div className="flex flex-wrap gap-3">
              <button
                onClick={handleMigrateMatches}
                disabled={isMigratingMatches || isCreatingPending || isForcingRecreate || isReMigrating || isFullMigrating || isVerifying}
                className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-xs font-medium shadow-sm"
              >
                <Upload className="w-3 h-3" />
                {isMigratingMatches ? 'Migrating...' : 'Migrate Completed Matches'}
              </button>

              <button
                onClick={handleCreatePendingMatches}
                disabled={isCreatingPending || isMigratingMatches || isForcingRecreate || isReMigrating || isFullMigrating || isVerifying}
                className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-xs font-medium shadow-sm"
              >
                <Plus className="w-3 h-3" />
                {isCreatingPending ? 'Creating...' : 'Create Pending Matches'}
              </button>

              <button
                onClick={handleForceRecreatePendingMatches}
                disabled={isForcingRecreate || isMigratingMatches || isCreatingPending || isReMigrating || isFullMigrating || isVerifying}
                className="flex items-center gap-2 bg-orange-600 text-white px-4 py-2 rounded-lg hover:bg-orange-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-xs font-medium shadow-sm"
              >
                <Zap className="w-3 h-3" />
                {isForcingRecreate ? 'Force Creating...' : 'Force Create Pending'}
              </button>

              <button
                onClick={handleVerify}
                disabled={isVerifying || isMigratingMatches || isCreatingPending || isForcingRecreate || isReMigrating || isFullMigrating}
                className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-xs font-medium shadow-sm"
              >
                <Check className="w-3 h-3" />
                {isVerifying ? 'Verifying...' : 'Verify Migration'}
              </button>
            </div>
          </div>

          {/* Re-Migrate Section */}
          <div className="border-t border-green-300 pt-4 mt-6">
            <h4 className="font-semibold text-green-900 mb-2 text-sm">Re-Migrate All Matches from Backup (Advanced)</h4>
            <p className="text-xs text-green-700 mb-3">
              Re-reads the backup blob and migrates ALL matches, including directly entered matches without challengeId.
              Safe to run - only creates new matches, does not overwrite existing ones.
            </p>
            <button
              onClick={handleReMigrateFromBackup}
              disabled={isReMigrating || isMigratingMatches || isCreatingPending || isForcingRecreate || isFullMigrating || isVerifying}
              className="flex items-center gap-2 bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-xs font-medium shadow-sm"
            >
              <RotateCw className="w-3 h-3" />
              {isReMigrating ? 'Re-Migrating...' : 'Re-Migrate All from Backup'}
            </button>
          </div>

          {/* Help Text */}
          <div className="mt-4 text-xs text-green-600 space-y-1">
            <p className="font-bold text-yellow-700">⭐ RECOMMENDED: Use "Full Match Migration" button above for best results!</p>
            <p><strong>Full Migration:</strong> Does everything in one step - pending matches from challenges + completed matches from backup</p>
            <p className="text-gray-600"><strong>Advanced Tools:</strong> Use individual migration buttons only if you need granular control</p>
            <p className="text-orange-600"><strong>Force Create:</strong> Use "Force Create Pending" only if some accepted challenges are missing pending matches (safe - never overwrites existing matches)</p>
            <p className="text-purple-600"><strong>Re-Migrate:</strong> Use "Re-Migrate All from Backup" if verification shows missing matches (includes directly entered matches without challengeId)</p>
            <p><strong>Note:</strong> New challenges will automatically create pending matches when accepted!</p>
          </div>
        </div>
      </div>
    </div>
  );
}
