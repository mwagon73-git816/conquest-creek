import React from 'react';
import { AlertTriangle, RefreshCw, Save } from 'lucide-react';

const ConflictResolutionModal = ({ conflict, onReload, onOverwrite, onCancel }) => {
  if (!conflict) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-lg w-full">
        {/* Header */}
        <div className="bg-red-50 border-b border-red-200 p-6 rounded-t-lg">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-6 h-6 text-red-600 flex-shrink-0 mt-1" />
            <div>
              <h3 className="text-lg font-bold text-red-800">Data Conflict Detected</h3>
              <p className="text-sm text-red-600 mt-1">
                {conflict.message || 'The data has been modified by another user since you loaded it.'}
              </p>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="p-6">
          <div className="bg-gray-50 rounded-lg p-4 mb-4">
            <h4 className="text-sm font-semibold text-gray-700 mb-2">Conflict Details:</h4>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Your version:</span>
                <span className="font-mono text-gray-800">
                  {new Date(conflict.expectedVersion).toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Current version:</span>
                <span className="font-mono text-gray-800">
                  {new Date(conflict.currentVersion).toLocaleString()}
                </span>
              </div>
            </div>
          </div>

          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <h4 className="text-sm font-semibold text-yellow-800 mb-2">What would you like to do?</h4>
            <ul className="text-sm text-yellow-700 space-y-1 list-disc list-inside">
              <li><strong>Reload (Recommended):</strong> Discard your changes and reload the latest data</li>
              <li><strong>Overwrite:</strong> Save your changes and overwrite the other user's changes</li>
            </ul>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-gray-50 px-6 py-4 rounded-b-lg flex justify-end gap-3 border-t">
          <button
            onClick={onCancel}
            className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-100 font-semibold transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onReload}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold flex items-center gap-2 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Reload (Recommended)
          </button>
          <button
            onClick={onOverwrite}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-semibold flex items-center gap-2 transition-colors"
          >
            <Save className="w-4 h-4" />
            Overwrite Anyway
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConflictResolutionModal;
