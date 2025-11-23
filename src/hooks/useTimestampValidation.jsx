import { useState, useCallback } from 'react';

/**
 * Custom hook for timestamp-based optimistic concurrency control
 * Prevents users from overwriting data modified by others
 *
 * @param {string} entityType - Type of entity (e.g., 'challenge', 'match', 'team', 'player')
 * @returns {object} Hook API with validation methods
 */
export const useTimestampValidation = (entityType) => {
  const [loadedTimestamp, setLoadedTimestamp] = useState(null);
  const [lastModifiedBy, setLastModifiedBy] = useState(null);

  /**
   * Record when data was loaded
   * @param {string} timestamp - ISO timestamp from the loaded data
   * @param {string} modifiedBy - Username who last modified the data
   */
  const recordLoad = useCallback((timestamp, modifiedBy = null) => {
    setLoadedTimestamp(timestamp);
    setLastModifiedBy(modifiedBy);
    console.log(`📋 Loaded ${entityType} at:`, timestamp, 'by:', modifiedBy);
  }, [entityType]);

  /**
   * Check if data has been modified since it was loaded
   * @param {string} currentTimestamp - Current timestamp from Firestore
   * @param {string} currentModifiedBy - Current user who modified it
   * @returns {boolean} True if data has changed
   */
  const hasDataChanged = useCallback((currentTimestamp, currentModifiedBy = null) => {
    if (!loadedTimestamp || !currentTimestamp) {
      // If we don't have timestamps, can't detect changes
      return false;
    }

    const changed = currentTimestamp !== loadedTimestamp;

    if (changed) {
      console.warn(`⚠️ ${entityType} has been modified!`, {
        loadedAt: loadedTimestamp,
        currentAt: currentTimestamp,
        loadedBy: lastModifiedBy,
        currentBy: currentModifiedBy
      });
    }

    return changed;
  }, [loadedTimestamp, lastModifiedBy, entityType]);

  /**
   * Validate before saving and prompt user if there's a conflict
   * @param {string} currentTimestamp - Current timestamp from Firestore
   * @param {string} currentModifiedBy - Current user who modified it
   * @param {Function} onRefresh - Callback to refresh data
   * @returns {boolean} True if save should proceed, false if canceled
   */
  const validateBeforeSave = useCallback(async (currentTimestamp, currentModifiedBy = null, onRefresh = null) => {
    if (!hasDataChanged(currentTimestamp, currentModifiedBy)) {
      // No conflict, proceed with save
      return true;
    }

    // Data has been modified - show conflict warning
    const modifiedByText = currentModifiedBy ? ` by ${currentModifiedBy}` : '';
    const userChoice = window.confirm(
      `⚠️ Conflict Detected!\n\n` +
      `This ${entityType} has been modified${modifiedByText} since you opened it.\n\n` +
      `If you continue, you will OVERWRITE their changes.\n\n` +
      `• Click OK to RELOAD and see their changes (recommended)\n` +
      `• Click Cancel to OVERWRITE their changes with yours\n\n` +
      `What would you like to do?`
    );

    if (userChoice) {
      // User chose to reload
      if (onRefresh) {
        await onRefresh();
        alert(`✅ Data refreshed!\n\nThe ${entityType} has been reloaded with the latest changes.\n\nPlease review and make your changes again if needed.`);
      }
      return false; // Don't proceed with save
    } else {
      // User chose to overwrite
      const confirmOverwrite = window.confirm(
        `⚠️ Are you absolutely sure?\n\n` +
        `You are about to OVERWRITE changes made by someone else.\n\n` +
        `This action cannot be undone.\n\n` +
        `Click OK to overwrite, or Cancel to go back.`
      );

      if (confirmOverwrite) {
        console.warn(`⚠️ User chose to overwrite ${entityType} changes`);
        return true; // Proceed with save, overwriting
      } else {
        return false; // User changed their mind
      }
    }
  }, [hasDataChanged, entityType]);

  /**
   * Reset the validation state (call this after successful save)
   * @param {string} newTimestamp - New timestamp after save
   * @param {string} modifiedBy - Username who made the save
   */
  const reset = useCallback((newTimestamp, modifiedBy = null) => {
    setLoadedTimestamp(newTimestamp);
    setLastModifiedBy(modifiedBy);
    console.log(`✅ ${entityType} saved. New timestamp:`, newTimestamp);
  }, [entityType]);

  /**
   * Clear the validation state
   */
  const clear = useCallback(() => {
    setLoadedTimestamp(null);
    setLastModifiedBy(null);
  }, []);

  return {
    loadedTimestamp,
    lastModifiedBy,
    recordLoad,
    hasDataChanged,
    validateBeforeSave,
    reset,
    clear
  };
};

/**
 * Format timestamp for display
 * @param {string} timestamp - ISO timestamp string
 * @returns {string} Formatted date/time
 */
export const formatTimestamp = (timestamp) => {
  if (!timestamp) return 'Unknown';

  try {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    // Less than 1 minute ago
    if (diffMins < 1) {
      return 'Just now';
    }
    // Less than 1 hour ago
    if (diffMins < 60) {
      return `${diffMins} minute${diffMins === 1 ? '' : 's'} ago`;
    }
    // Less than 24 hours ago
    if (diffHours < 24) {
      return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`;
    }
    // Less than 7 days ago
    if (diffDays < 7) {
      return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`;
    }
    // Show full date
    return date.toLocaleDateString() + ' at ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch (error) {
    console.error('Error formatting timestamp:', error);
    return timestamp;
  }
};

/**
 * Component to display last updated info
 * @param {object} props - Component props
 * @param {string} props.timestamp - ISO timestamp
 * @param {string} props.updatedBy - Username who made the update
 * @param {string} props.className - Additional CSS classes
 */
export const TimestampDisplay = ({ timestamp, updatedBy, className = '' }) => {
  if (!timestamp) return null;

  return (
    <div className={`text-sm text-gray-500 ${className}`}>
      Last updated: {formatTimestamp(timestamp)}
      {updatedBy && ` by ${updatedBy}`}
    </div>
  );
};

export default useTimestampValidation;
