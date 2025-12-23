import React, { useState, useEffect } from 'react';
import { RefreshCw, AlertTriangle, Users, Lock } from 'lucide-react';

const DataSyncManager = ({
  isAuthenticated,
  userRole,
  loginName,
  activeSessions,
  importLock,
  lastDataLoad,
  onRefresh,
  onUpdateActivity
}) => {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showSessionWarning, setShowSessionWarning] = useState(false);

  // Update activity every 60 seconds for ALL authenticated users
  useEffect(() => {
    if (isAuthenticated && loginName) {
      const interval = setInterval(() => {
        onUpdateActivity();
      }, 60000); // Every 60 seconds

      return () => clearInterval(interval);
    }
  }, [isAuthenticated, loginName, onUpdateActivity]);

  // Check for other active directors
  useEffect(() => {
    if (isAuthenticated && userRole === 'director' && activeSessions) {
      const otherDirectors = activeSessions.filter(
        s => s.role === 'director' && s.username !== loginName
      );
      setShowSessionWarning(otherDirectors.length > 0);
    } else {
      setShowSessionWarning(false);
    }
  }, [activeSessions, isAuthenticated, userRole, loginName]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await onRefresh();
    } finally {
      setIsRefreshing(false);
    }
  };

  const formatTimestamp = (timestamp) => {
    if (!timestamp) return 'Never';
    const date = new Date(timestamp);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const getTimeSince = (timestamp) => {
    if (!timestamp) return '';
    const seconds = Math.floor((Date.now() - new Date(timestamp).getTime()) / 1000);
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    return `${hours}h ago`;
  };

  // Only show for directors
  if (!isAuthenticated || userRole !== 'director') {
    return null;
  }

  return (
    <div className="mb-4 space-y-3">
      {/* Import Lock Warning */}
      {importLock && (
        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded-r-lg shadow-sm">
          <div className="flex items-start">
            <Lock className="w-5 h-5 text-yellow-600 mt-0.5 mr-3 flex-shrink-0" />
            <div className="flex-1">
              <h3 className="text-sm font-semibold text-yellow-800 mb-1">
                Data Import In Progress
              </h3>
              <p className="text-sm text-yellow-700">
                {importLock.operation} by <span className="font-semibold">{importLock.username}</span>
                {' '}started {getTimeSince(importLock.startTime)}. Please wait before making changes.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Active Sessions Warning */}
      {showSessionWarning && !importLock && (
        <div className="bg-orange-50 border-l-4 border-orange-400 p-4 rounded-r-lg shadow-sm">
          <div className="flex items-start">
            <AlertTriangle className="w-5 h-5 text-orange-600 mt-0.5 mr-3 flex-shrink-0" />
            <div className="flex-1">
              <h3 className="text-sm font-semibold text-orange-800 mb-1">
                Multiple Directors Active
              </h3>
              <p className="text-sm text-orange-700 mb-2">
                Other directors are currently logged in. Making changes may cause data conflicts.
              </p>
              <div className="flex items-center gap-2 text-xs text-orange-600">
                <Users className="w-4 h-4" />
                <span className="font-semibold">Active Directors:</span>
                {activeSessions
                  .filter(s => s.role === 'director' && s.username !== loginName)
                  .map(s => (
                    <span key={s.username} className="bg-orange-100 px-2 py-0.5 rounded">
                      {s.username} ({getTimeSince(s.lastActivity)})
                    </span>
                  ))
                }
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Data Sync Status and Refresh Button */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="text-sm text-blue-700">
              <span className="font-semibold">Last data sync:</span>{' '}
              <span className="text-blue-600">{formatTimestamp(lastDataLoad)}</span>
              {lastDataLoad && (
                <span className="text-blue-500 ml-1">
                  ({getTimeSince(lastDataLoad)})
                </span>
              )}
            </div>
          </div>
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-lg font-semibold text-sm transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            {isRefreshing ? 'Refreshing...' : 'Reload Latest Data'}
          </button>
        </div>

        {/* Session Info */}
        {activeSessions && activeSessions.length > 0 && (
          <div className="mt-3 pt-3 border-t border-blue-200">
            <div className="text-xs text-blue-600 flex items-center gap-2">
              <Users className="w-3 h-3" />
              <span className="font-semibold">All Active Sessions:</span>
              {activeSessions.map(s => (
                <span
                  key={s.username}
                  className={`px-2 py-0.5 rounded ${
                    s.username === loginName
                      ? 'bg-blue-200 text-blue-800 font-semibold'
                      : 'bg-blue-100 text-blue-700'
                  }`}
                >
                  {s.username}
                  {s.username === loginName && ' (You)'}
                  {' · '}
                  {s.role}
                  {' · '}
                  {getTimeSince(s.lastActivity)}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default DataSyncManager;
