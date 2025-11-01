import React, { useState } from 'react';
import { Activity, Filter, RefreshCw } from 'lucide-react';
import { formatLogEntry, filterLogs } from '../services/activityLogger';
import { tournamentStorage } from '../services/storage';

const ActivityLog = ({ logs, onRefresh }) => {
  const [filterType, setFilterType] = useState('all');
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      const logsData = await tournamentStorage.getActivityLogs(100);
      if (logsData && onRefresh) {
        onRefresh(logsData);
      }
    } catch (error) {
      console.error('Error refreshing logs:', error);
    } finally {
      setIsRefreshing(false);
    }
  };

  // Format and filter logs
  const formattedLogs = logs.map(log => formatLogEntry(log));
  const filteredLogs = filterLogs(formattedLogs, filterType);

  // Get action badge color based on action type
  const getActionBadgeColor = (action) => {
    if (action.includes('delete')) return 'bg-red-100 text-red-800';
    if (action.includes('add') || action.includes('create')) return 'bg-green-100 text-green-800';
    if (action.includes('edit')) return 'bg-blue-100 text-blue-800';
    if (action.includes('login') || action.includes('logout')) return 'bg-purple-100 text-purple-800';
    return 'bg-gray-100 text-gray-800';
  };

  // Format action name for display
  const formatActionName = (action) => {
    return action
      .replace(/_/g, ' ')
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <Activity className="w-6 h-6" />
          Activity Log
        </h2>
        <div className="flex items-center gap-3">
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400 flex items-center gap-2 text-sm"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-600" />
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="px-3 py-2 border rounded text-sm"
            >
              <option value="all">All Activities</option>
              <option value="players">Players</option>
              <option value="teams">Teams</option>
              <option value="matches">Matches</option>
              <option value="captains">Captains</option>
              <option value="deletions">Deletions</option>
            </select>
          </div>
        </div>
      </div>

      <div className="text-sm text-gray-600 mb-4">
        Showing {filteredLogs.length} of {formattedLogs.length} activities (most recent 100)
      </div>

      {filteredLogs.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <Activity className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>No activity logs found</p>
          {filterType !== 'all' && (
            <p className="text-sm mt-2">Try changing the filter to see more activities</p>
          )}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b">
                <th className="text-left py-3 px-4 font-semibold">Timestamp</th>
                <th className="text-left py-3 px-4 font-semibold">User</th>
                <th className="text-left py-3 px-4 font-semibold">Action</th>
                <th className="text-left py-3 px-4 font-semibold">Details</th>
              </tr>
            </thead>
            <tbody>
              {filteredLogs.map((log, index) => (
                <tr
                  key={log.id || index}
                  className="border-b hover:bg-gray-50 transition"
                >
                  <td className="py-3 px-4 text-gray-600 whitespace-nowrap">
                    {log.formattedTimestamp}
                  </td>
                  <td className="py-3 px-4">
                    <span className="font-medium text-gray-900">
                      {log.user || 'System'}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${getActionBadgeColor(log.action)}`}>
                      {formatActionName(log.action)}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-gray-700">
                    {log.description}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {filteredLogs.length > 0 && (
        <div className="mt-4 text-xs text-gray-500">
          <p>Activity logs are stored in Firebase and automatically synced across all devices.</p>
        </div>
      )}
    </div>
  );
};

export default ActivityLog;
