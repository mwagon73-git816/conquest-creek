/**
 * Teams Data Format Migration Tool Component
 *
 * Converts teams/players data from JSON string format to Firestore object format.
 * This enables better data structure, easier querying, and compatibility with
 * real-time subscriptions.
 *
 * Migration:
 * FROM: teams/data -> { data: "{"players":[...],"teams":[...]}" }
 * TO:   teams/data -> { data: { players: [...], teams: [...] } }
 *
 * Only visible to directors.
 */

import React, { useState } from 'react';
import { Users, Check, AlertCircle, RefreshCw } from 'lucide-react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';

export default function TeamsDataMigrationTool({ userRole }) {
  const [isMigrating, setIsMigrating] = useState(false);
  const [migrationStatus, setMigrationStatus] = useState(null);

  // Only show to directors
  if (userRole !== 'director') {
    return null;
  }

  const handleMigrate = async () => {
    if (!window.confirm(
      '⚠️ TEAMS DATA FORMAT MIGRATION\n\n' +
      'This will:\n' +
      '1. Read current teams/players data\n' +
      '2. Convert from JSON string to Firestore object format\n' +
      '3. Update the teams/data document\n' +
      '4. Add migration metadata\n\n' +
      '✅ This is SAFE - but a backup is recommended first\n' +
      '✅ The app will work better with the new format\n\n' +
      'Continue with migration?'
    )) {
      return;
    }

    setIsMigrating(true);
    setMigrationStatus(null);

    try {
      console.log('🚀 Starting teams data format migration...');

      // 1. Read current data
      const docRef = doc(db, 'teams', 'data');
      const docSnap = await getDoc(docRef);

      if (!docSnap.exists()) {
        setMigrationStatus({
          success: false,
          message: '❌ No teams data found at teams/data'
        });
        setIsMigrating(false);
        return;
      }

      const currentData = docSnap.data();

      // 2. Check if already in new format
      if (typeof currentData.data === 'object' && currentData.data !== null && !Array.isArray(currentData.data)) {
        setMigrationStatus({
          success: true,
          message: '✅ Teams data is already in the new format!\n\n' +
            `Structure verified:\n` +
            `• Players: ${currentData.data.players?.length || 0}\n` +
            `• Teams: ${currentData.data.teams?.length || 0}\n` +
            `• Trades: ${currentData.data.trades?.length || 0}\n\n` +
            `No migration needed.`
        });
        setIsMigrating(false);
        return;
      }

      // 3. Parse JSON string to object
      if (typeof currentData.data !== 'string') {
        setMigrationStatus({
          success: false,
          message: '❌ Unexpected data format\n\n' +
            `Expected: JSON string or object\n` +
            `Got: ${typeof currentData.data}\n\n` +
            `Please check the data structure manually.`
        });
        setIsMigrating(false);
        return;
      }

      let parsedData;
      try {
        parsedData = JSON.parse(currentData.data);
      } catch (e) {
        setMigrationStatus({
          success: false,
          message: '❌ Failed to parse JSON string\n\n' +
            `Error: ${e.message}\n\n` +
            `The data may be corrupted. Please check Firestore console.`
        });
        setIsMigrating(false);
        return;
      }

      // 4. Ensure proper structure
      const newData = {
        data: {
          players: parsedData.players || parsedData || [],
          teams: parsedData.teams || [],
          trades: parsedData.trades || []
        },
        updatedAt: new Date().toISOString(),
        migratedAt: new Date().toISOString(),
        migratedFrom: 'json_string',
        migrationNote: 'Converted from JSON string to Firestore object format'
      };

      console.log(`📊 Migration preview:`, {
        players: newData.data.players.length,
        teams: newData.data.teams.length,
        trades: newData.data.trades.length
      });

      // 5. Write new format
      await setDoc(docRef, newData);

      console.log('✅ Migration complete!');

      setMigrationStatus({
        success: true,
        message: `✅ Migration completed successfully!\n\n` +
          `Converted to Firestore object format:\n` +
          `• Players: ${newData.data.players.length}\n` +
          `• Teams: ${newData.data.teams.length}\n` +
          `• Trades: ${newData.data.trades.length}\n\n` +
          `Next steps:\n` +
          `1. Test team and player operations\n` +
          `2. Verify data displays correctly\n` +
          `3. Check that edits save properly\n\n` +
          `The app should now work more reliably!`
      });

    } catch (error) {
      console.error('❌ Migration error:', error);
      setMigrationStatus({
        success: false,
        message: `❌ Migration error:\n\n${error.message}\n\n` +
          `Stack trace:\n${error.stack}`
      });
    } finally {
      setIsMigrating(false);
    }
  };

  return (
    <div className="bg-white rounded-lg border-2 border-purple-300 p-6 shadow-md">
      <div className="flex items-center gap-3 mb-4">
        <Users className="w-6 h-6 text-purple-600" />
        <h3 className="text-xl font-bold text-gray-900">Teams Data Format Migration</h3>
      </div>

      <div className="space-y-4">
        <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
          <h4 className="font-semibold text-purple-900 mb-2">What does this do?</h4>
          <p className="text-sm text-purple-800 mb-2">
            Converts teams/players data from JSON string format to Firestore object format.
          </p>
          <div className="text-xs text-purple-700 space-y-1">
            <p><strong>FROM:</strong> teams/data → &#123; data: "&apos;&#123;"players":[...]&#125;" &#125;</p>
            <p><strong>TO:</strong> teams/data → &#123; data: &#123; players: [...], teams: [...] &#125; &#125;</p>
          </div>
        </div>

        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex items-start gap-2">
            <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-yellow-800">
              <p className="font-semibold mb-1">When to run this:</p>
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li>On production after deploying new code</li>
                <li>If teams/players aren't loading properly</li>
                <li>To enable better data structure</li>
              </ul>
            </div>
          </div>
        </div>

        <div className="flex gap-3">
          <button
            onClick={handleMigrate}
            disabled={isMigrating}
            className="flex items-center gap-2 bg-purple-600 text-white px-6 py-3 rounded-lg hover:bg-purple-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors font-medium"
          >
            {isMigrating ? (
              <>
                <RefreshCw className="w-5 h-5 animate-spin" />
                Migrating...
              </>
            ) : (
              <>
                <Users className="w-5 h-5" />
                Migrate Teams Data Format
              </>
            )}
          </button>
        </div>

        {migrationStatus && (
          <div className={`rounded-lg p-4 ${
            migrationStatus.success
              ? 'bg-green-50 border border-green-200'
              : 'bg-red-50 border border-red-200'
          }`}>
            <div className="flex items-start gap-3">
              {migrationStatus.success ? (
                <Check className="w-6 h-6 text-green-600 flex-shrink-0 mt-1" />
              ) : (
                <AlertCircle className="w-6 h-6 text-red-600 flex-shrink-0 mt-1" />
              )}
              <div className={`flex-1 ${
                migrationStatus.success ? 'text-green-800' : 'text-red-800'
              }`}>
                <pre className="whitespace-pre-wrap text-sm font-mono">
                  {migrationStatus.message}
                </pre>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
