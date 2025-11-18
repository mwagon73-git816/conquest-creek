/**
 * Migration Button Component
 *
 * Provides a UI for directors to migrate existing challenges and matches
 * to the new ID system. This is a one-time operation.
 *
 * Usage: Add this component to the Settings page or Admin panel
 * Only visible to directors
 */

import React, { useState } from 'react';
import { Database, Check, AlertCircle } from 'lucide-react';
import { migrateAllIds, checkMigrationNeeded } from '../utils/migrateIds';

export default function MigrationButton({ challenges, matches, onUpdate, userRole }) {
  const [isChecking, setIsChecking] = useState(false);
  const [isMigrating, setIsMigrating] = useState(false);
  const [migrationStatus, setMigrationStatus] = useState(null);
  const [migrationNeeded, setMigrationNeeded] = useState(null);

  // Only show to directors
  if (userRole !== 'director') {
    return null;
  }

  const handleCheckMigration = () => {
    setIsChecking(true);
    try {
      const result = checkMigrationNeeded({ challenges, matches });
      setMigrationNeeded(result);
      setIsChecking(false);
    } catch (error) {
      console.error('Error checking migration:', error);
      setMigrationStatus({
        success: false,
        message: `Error checking migration: ${error.message}`
      });
      setIsChecking(false);
    }
  };

  const handleMigrate = () => {
    if (!window.confirm(
      'This will add unique IDs to all existing challenges and matches that don\'t have them.\n\n' +
      'This is a one-time operation and should only be run once.\n\n' +
      'After running this, you MUST click "Save Data" to persist the changes.\n\n' +
      'Continue?'
    )) {
      return;
    }

    setIsMigrating(true);
    try {
      const result = migrateAllIds({ challenges, matches });

      // Update the parent state with migrated data
      onUpdate({
        challenges: result.challenges,
        matches: result.matches
      });

      setMigrationStatus({
        success: true,
        message: `Migration completed successfully!\n\nChallenges migrated: ${result.challengesMigrated}\nMatches migrated: ${result.matchesMigrated}\n\n⚠️ IMPORTANT: Click "Save Data" to persist these changes to the database!`
      });

      // Reset migration needed status
      setMigrationNeeded(null);
      setIsMigrating(false);
    } catch (error) {
      console.error('Error during migration:', error);
      setMigrationStatus({
        success: false,
        message: `Error during migration: ${error.message}`
      });
      setIsMigrating(false);
    }
  };

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
      <div className="flex items-start gap-3">
        <Database className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
        <div className="flex-1">
          <h3 className="font-semibold text-blue-900 mb-1">ID System Migration</h3>
          <p className="text-sm text-blue-700 mb-3">
            Add unique IDs to existing challenges and matches for better tracking and reference.
          </p>

          {/* Migration Status */}
          {migrationStatus && (
            <div className={`mb-3 p-3 rounded ${
              migrationStatus.success
                ? 'bg-green-100 border border-green-300 text-green-800'
                : 'bg-red-100 border border-red-300 text-red-800'
            }`}>
              <div className="flex items-start gap-2">
                {migrationStatus.success ? (
                  <Check className="w-5 h-5 flex-shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                )}
                <p className="text-sm whitespace-pre-line">{migrationStatus.message}</p>
              </div>
            </div>
          )}

          {/* Migration Check Results */}
          {migrationNeeded && (
            <div className={`mb-3 p-3 rounded ${
              migrationNeeded.needsMigration
                ? 'bg-yellow-100 border border-yellow-300 text-yellow-800'
                : 'bg-green-100 border border-green-300 text-green-800'
            }`}>
              <div className="text-sm">
                {migrationNeeded.needsMigration ? (
                  <>
                    <p className="font-semibold mb-2">Migration Needed:</p>
                    <ul className="list-disc list-inside space-y-1">
                      <li>Challenges: {migrationNeeded.stats.challengesWithoutIds} of {migrationNeeded.stats.totalChallenges} need IDs</li>
                      <li>Matches: {migrationNeeded.stats.matchesWithoutIds} of {migrationNeeded.stats.totalMatches} need IDs</li>
                    </ul>
                  </>
                ) : (
                  <p className="flex items-center gap-2">
                    <Check className="w-4 h-4" />
                    All challenges and matches have IDs! No migration needed.
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-2">
            <button
              onClick={handleCheckMigration}
              disabled={isChecking || isMigrating}
              className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
            >
              <Database className="w-4 h-4" />
              {isChecking ? 'Checking...' : 'Check Migration Status'}
            </button>

            {migrationNeeded && migrationNeeded.needsMigration && (
              <button
                onClick={handleMigrate}
                disabled={isMigrating}
                className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
              >
                <Check className="w-4 h-4" />
                {isMigrating ? 'Migrating...' : 'Run Migration'}
              </button>
            )}
          </div>

          <p className="text-xs text-blue-600 mt-2">
            Note: This is a one-time operation. After migration, remember to click "Save Data" to persist changes.
          </p>
        </div>
      </div>
    </div>
  );
}
