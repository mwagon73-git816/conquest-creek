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
import { Database, Check, AlertCircle, RefreshCw, Upload, Plus } from 'lucide-react';
import { migrateMatches, createPendingMatchesFromChallenges, verifyMatchesMigration } from '../utils/migrateMatches';

export default function MatchesMigrationTool({ userRole }) {
  const [isMigratingMatches, setIsMigratingMatches] = useState(false);
  const [isCreatingPending, setIsCreatingPending] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [matchesStatus, setMatchesStatus] = useState(null);
  const [pendingStatus, setPendingStatus] = useState(null);
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
            `• Skipped: ${result.skipped || 0} (already exist)\n` +
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
            `• Blob count: ${result.blobCount}\n` +
            `• Individual documents: ${result.documentCount}\n` +
            `• Pending matches: ${result.pendingCount}\n` +
            `• Completed matches: ${result.completedCount}\n\n` +
            `${result.message}`
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

          {/* Action Buttons */}
          <div className="flex flex-wrap gap-3">
            <button
              onClick={handleMigrateMatches}
              disabled={isMigratingMatches || isCreatingPending || isVerifying}
              className="flex items-center gap-2 bg-green-600 text-white px-5 py-2.5 rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium shadow-sm"
            >
              <Upload className="w-4 h-4" />
              {isMigratingMatches ? 'Migrating...' : 'Migrate Completed Matches'}
            </button>

            <button
              onClick={handleCreatePendingMatches}
              disabled={isCreatingPending || isMigratingMatches || isVerifying}
              className="flex items-center gap-2 bg-blue-600 text-white px-5 py-2.5 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium shadow-sm"
            >
              <Plus className="w-4 h-4" />
              {isCreatingPending ? 'Creating...' : 'Create Pending Matches'}
            </button>

            <button
              onClick={handleVerify}
              disabled={isVerifying || isMigratingMatches || isCreatingPending}
              className="flex items-center gap-2 bg-indigo-600 text-white px-5 py-2.5 rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium shadow-sm"
            >
              <Check className="w-4 h-4" />
              {isVerifying ? 'Verifying...' : 'Verify Migration'}
            </button>
          </div>

          {/* Help Text */}
          <div className="mt-4 text-xs text-green-600 space-y-1">
            <p><strong>Step 1:</strong> Click "Migrate Completed Matches" to convert blob to individual documents</p>
            <p><strong>Step 2:</strong> Click "Create Pending Matches" to create pending matches from accepted challenges</p>
            <p><strong>Step 3:</strong> Click "Verify Migration" to confirm all data migrated correctly</p>
            <p><strong>Note:</strong> New challenges will automatically create pending matches when accepted!</p>
          </div>
        </div>
      </div>
    </div>
  );
}
