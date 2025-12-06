/**
 * Challenges Migration Tool Component
 *
 * Provides a UI for directors to migrate challenges from blob storage
 * to individual Firestore documents. This enables real-time updates
 * and eliminates race conditions.
 *
 * Only visible to directors.
 */

import React, { useState } from 'react';
import { Database, Check, AlertCircle, RefreshCw, Upload } from 'lucide-react';
import { migrateChallenges, verifyMigration, rollbackMigration } from '../utils/migrateChallenges';

export default function ChallengesMigrationTool({ userRole }) {
  const [isChecking, setIsChecking] = useState(false);
  const [isMigrating, setIsMigrating] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isRollingBack, setIsRollingBack] = useState(false);
  const [migrationStatus, setMigrationStatus] = useState(null);
  const [verificationStatus, setVerificationStatus] = useState(null);

  // Only show to directors
  if (userRole !== 'director') {
    return null;
  }

  const handleMigrate = async () => {
    if (!window.confirm(
      '⚠️ CHALLENGES MIGRATION TO INDIVIDUAL DOCUMENTS\n\n' +
      'This will:\n' +
      '1. Read all challenges from blob storage (challenges/data)\n' +
      '2. Create individual Firestore documents for each challenge\n' +
      '3. Create a backup of the original blob data\n' +
      '4. Enable real-time updates and eliminate race conditions\n\n' +
      '✅ This is SAFE - the original data will be backed up\n' +
      '✅ You can rollback if needed\n\n' +
      'Continue with migration?'
    )) {
      return;
    }

    setIsMigrating(true);
    setMigrationStatus(null);

    try {
      console.log('🚀 Starting challenges migration...');
      const result = await migrateChallenges();

      if (result.success) {
        setMigrationStatus({
          success: true,
          message: `✅ Migration completed successfully!\n\n` +
            `• Migrated: ${result.migrated} challenges\n` +
            `• Errors: ${result.errors || 0}\n` +
            `• Invalid (skipped): ${result.invalidCount || 0}\n\n` +
            `${result.message}\n\n` +
            `Next steps:\n` +
            `1. Click "Verify Migration" to confirm\n` +
            `2. Test challenge operations\n` +
            `3. Monitor for 24 hours\n` +
            `4. Old blob data backed up at challenges/data_backup_blob`
        });
      } else {
        setMigrationStatus({
          success: false,
          message: `❌ Migration failed:\n\n${result.message}\n\n` +
            `No changes have been made to your data.`
        });
      }
    } catch (error) {
      console.error('❌ Migration error:', error);
      setMigrationStatus({
        success: false,
        message: `❌ Migration error:\n\n${error.message}`
      });
    } finally {
      setIsMigrating(false);
    }
  };

  const handleVerify = async () => {
    setIsVerifying(true);
    setVerificationStatus(null);

    try {
      console.log('🔍 Verifying migration...');
      const result = await verifyMigration();

      if (result.success && result.match) {
        setVerificationStatus({
          success: true,
          message: `✅ Migration verified successfully!\n\n` +
            `• Blob count: ${result.blobCount}\n` +
            `• Individual documents: ${result.documentCount}\n` +
            `• Status: Counts match perfectly! ✓\n\n` +
            `Your migration is complete and working correctly.`
        });
      } else {
        setVerificationStatus({
          success: false,
          message: `⚠️ Count mismatch detected:\n\n` +
            `• Expected (blob): ${result.blobCount}\n` +
            `• Found (documents): ${result.documentCount}\n\n` +
            `${result.message}\n\n` +
            `Please check the console for details.`
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

  const handleRollback = async () => {
    if (!window.confirm(
      '⚠️ ROLLBACK MIGRATION\n\n' +
      'This will:\n' +
      '1. Restore the original blob data from backup\n' +
      '2. Delete all individual challenge documents\n' +
      '3. Return to the old blob storage architecture\n\n' +
      '⚠️ WARNING: This will undo the migration!\n\n' +
      'Only use this if there are serious issues.\n\n' +
      'Continue with rollback?'
    )) {
      return;
    }

    setIsRollingBack(true);
    setMigrationStatus(null);
    setVerificationStatus(null);

    try {
      console.log('🔄 Starting rollback...');
      const result = await rollbackMigration();

      if (result.success) {
        setMigrationStatus({
          success: true,
          message: `✅ Rollback completed successfully!\n\n` +
            `• Blob data restored from backup\n` +
            `• Individual documents deleted: ${result.deleted}\n\n` +
            `You are back to the old blob storage system.\n` +
            `Refresh the page to see the restored data.`
        });
      } else {
        setMigrationStatus({
          success: false,
          message: `❌ Rollback failed:\n\n${result.message}`
        });
      }
    } catch (error) {
      console.error('❌ Rollback error:', error);
      setMigrationStatus({
        success: false,
        message: `❌ Rollback error:\n\n${error.message}`
      });
    } finally {
      setIsRollingBack(false);
    }
  };

  return (
    <div className="bg-purple-50 border border-purple-200 rounded-lg p-6">
      <div className="flex items-start gap-4">
        <Database className="w-6 h-6 text-purple-600 mt-1 flex-shrink-0" />
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-purple-900 mb-2">
            Challenges Architecture Migration
          </h3>
          <p className="text-sm text-purple-700 mb-4">
            Migrate challenges from blob storage to individual Firestore documents.
            This enables real-time updates, eliminates race conditions, and removes
            the need for the manual "Save Data" button.
          </p>

          {/* Migration Status */}
          {migrationStatus && (
            <div className={`mb-4 p-4 rounded-lg ${
              migrationStatus.success
                ? 'bg-green-100 border border-green-300 text-green-900'
                : 'bg-red-100 border border-red-300 text-red-900'
            }`}>
              <div className="flex items-start gap-2">
                {migrationStatus.success ? (
                  <Check className="w-5 h-5 flex-shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                )}
                <p className="text-sm whitespace-pre-line font-medium">{migrationStatus.message}</p>
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
          <div className="bg-white border border-purple-200 rounded-lg p-4 mb-4">
            <h4 className="font-semibold text-purple-900 text-sm mb-2">Benefits of Migration:</h4>
            <ul className="text-sm text-purple-700 space-y-1">
              <li className="flex items-start gap-2">
                <Check className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                <span><strong>Real-time updates</strong> - Changes appear instantly across all users</span>
              </li>
              <li className="flex items-start gap-2">
                <Check className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                <span><strong>No race conditions</strong> - Eliminates data loss from concurrent edits</span>
              </li>
              <li className="flex items-start gap-2">
                <Check className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                <span><strong>Auto-save</strong> - No more "Save Data" button needed</span>
              </li>
              <li className="flex items-start gap-2">
                <Check className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                <span><strong>Concurrent access</strong> - Multiple captains can work simultaneously</span>
              </li>
            </ul>
          </div>

          {/* Warning Box */}
          <div className="bg-yellow-50 border border-yellow-300 rounded-lg p-4 mb-4">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-5 h-5 text-yellow-700 mt-0.5 flex-shrink-0" />
              <div className="text-sm text-yellow-800">
                <p className="font-semibold mb-1">Before you migrate:</p>
                <ul className="list-disc list-inside space-y-1 ml-2">
                  <li>Backup will be created automatically</li>
                  <li>Migration is reversible (rollback available)</li>
                  <li>Test all operations after migration</li>
                  <li>Monitor for 24 hours before deleting old data</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap gap-3">
            <button
              onClick={handleMigrate}
              disabled={isMigrating || isVerifying || isRollingBack}
              className="flex items-center gap-2 bg-purple-600 text-white px-5 py-2.5 rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium shadow-sm"
            >
              <Upload className="w-4 h-4" />
              {isMigrating ? 'Migrating...' : 'Migrate Challenges'}
            </button>

            <button
              onClick={handleVerify}
              disabled={isVerifying || isMigrating || isRollingBack}
              className="flex items-center gap-2 bg-blue-600 text-white px-5 py-2.5 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium shadow-sm"
            >
              <Check className="w-4 h-4" />
              {isVerifying ? 'Verifying...' : 'Verify Migration'}
            </button>

            <button
              onClick={handleRollback}
              disabled={isRollingBack || isMigrating || isVerifying}
              className="flex items-center gap-2 bg-red-600 text-white px-5 py-2.5 rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium shadow-sm"
            >
              <RefreshCw className="w-4 h-4" />
              {isRollingBack ? 'Rolling Back...' : 'Rollback Migration'}
            </button>
          </div>

          {/* Help Text */}
          <div className="mt-4 text-xs text-purple-600 space-y-1">
            <p><strong>Step 1:</strong> Click "Migrate Challenges" to convert blob to individual documents</p>
            <p><strong>Step 2:</strong> Click "Verify Migration" to confirm all data migrated correctly</p>
            <p><strong>Step 3:</strong> Test creating, accepting, editing, and deleting challenges</p>
            <p><strong>Step 4:</strong> If issues occur, click "Rollback Migration" to restore</p>
          </div>
        </div>
      </div>
    </div>
  );
}
