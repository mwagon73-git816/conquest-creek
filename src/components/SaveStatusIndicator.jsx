import React from 'react';
import { Loader, Check, AlertCircle, Clock } from 'lucide-react';

/**
 * Visual indicator for auto-save status
 *
 * Shows different states:
 * - Saving: spinner + "Saving..."
 * - Saved: checkmark + "Saved Xs ago"
 * - Unsaved changes: clock + "Unsaved changes"
 * - Error: alert + error message
 *
 * @param {object} props
 * @param {boolean} props.isSaving - Whether save is in progress
 * @param {Date} props.lastSaved - When data was last saved
 * @param {boolean} props.hasUnsavedChanges - Whether there are unsaved changes
 * @param {Error} props.error - Error object if save failed
 * @param {string} props.className - Additional CSS classes
 * @param {boolean} props.compact - Use compact mode (smaller text, icons)
 *
 * @example
 * <SaveStatusIndicator
 *   isSaving={isSaving}
 *   lastSaved={lastSaved}
 *   hasUnsavedChanges={hasUnsavedChanges}
 *   error={error}
 * />
 */
const SaveStatusIndicator = ({
  isSaving = false,
  lastSaved = null,
  hasUnsavedChanges = false,
  error = null,
  className = '',
  compact = false
}) => {
  /**
   * Format the "saved X ago" text
   */
  const getTimeSinceLastSave = () => {
    if (!lastSaved) return null;

    const now = new Date();
    const diffMs = now - lastSaved;
    const diffSeconds = Math.floor(diffMs / 1000);
    const diffMinutes = Math.floor(diffSeconds / 60);
    const diffHours = Math.floor(diffMinutes / 60);

    if (diffSeconds < 10) return 'just now';
    if (diffSeconds < 60) return `${diffSeconds}s ago`;
    if (diffMinutes < 60) return `${diffMinutes}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return lastSaved.toLocaleDateString();
  };

  /**
   * Determine what to display based on current state
   */
  const getStatusDisplay = () => {
    // Priority order: Error > Saving > Unsaved > Saved

    if (error) {
      return {
        icon: AlertCircle,
        text: 'Save failed',
        iconColor: 'text-red-500',
        textColor: 'text-red-700',
        bgColor: 'bg-red-50',
        tooltip: error.message || 'An error occurred while saving'
      };
    }

    if (isSaving) {
      return {
        icon: Loader,
        text: 'Saving...',
        iconColor: 'text-blue-500',
        textColor: 'text-blue-700',
        bgColor: 'bg-blue-50',
        animate: true
      };
    }

    if (hasUnsavedChanges) {
      return {
        icon: Clock,
        text: 'Unsaved changes',
        iconColor: 'text-yellow-500',
        textColor: 'text-yellow-700',
        bgColor: 'bg-yellow-50'
      };
    }

    if (lastSaved) {
      return {
        icon: Check,
        text: `Saved ${getTimeSinceLastSave()}`,
        iconColor: 'text-green-500',
        textColor: 'text-green-700',
        bgColor: 'bg-green-50'
      };
    }

    // No status to show
    return null;
  };

  const status = getStatusDisplay();

  if (!status) return null;

  const Icon = status.icon;
  const iconSize = compact ? 'w-3 h-3' : 'w-4 h-4';
  const textSize = compact ? 'text-xs' : 'text-sm';
  const padding = compact ? 'px-2 py-1' : 'px-3 py-1.5';

  return (
    <div
      className={`inline-flex items-center gap-1.5 rounded ${padding} ${status.bgColor} ${className}`}
      title={status.tooltip}
    >
      <Icon
        className={`${iconSize} ${status.iconColor} ${status.animate ? 'animate-spin' : ''}`}
      />
      <span className={`${textSize} ${status.textColor} font-medium`}>
        {status.text}
      </span>
    </div>
  );
};

/**
 * Compact version of SaveStatusIndicator - just icon with tooltip
 *
 * @example
 * <SaveStatusIconOnly
 *   isSaving={isSaving}
 *   lastSaved={lastSaved}
 *   hasUnsavedChanges={hasUnsavedChanges}
 * />
 */
export const SaveStatusIconOnly = ({
  isSaving = false,
  lastSaved = null,
  hasUnsavedChanges = false,
  error = null,
  className = ''
}) => {
  const getStatusDisplay = () => {
    if (error) {
      return {
        icon: AlertCircle,
        color: 'text-red-500',
        tooltip: `Save failed: ${error.message || 'Unknown error'}`
      };
    }

    if (isSaving) {
      return {
        icon: Loader,
        color: 'text-blue-500',
        tooltip: 'Saving...',
        animate: true
      };
    }

    if (hasUnsavedChanges) {
      return {
        icon: Clock,
        color: 'text-yellow-500',
        tooltip: 'Unsaved changes'
      };
    }

    if (lastSaved) {
      const now = new Date();
      const diffMs = now - lastSaved;
      const diffSeconds = Math.floor(diffMs / 1000);
      const diffMinutes = Math.floor(diffSeconds / 60);

      let timeText = 'just now';
      if (diffSeconds >= 60) {
        timeText = `${diffMinutes} minute${diffMinutes !== 1 ? 's' : ''} ago`;
      } else if (diffSeconds >= 10) {
        timeText = `${diffSeconds} seconds ago`;
      }

      return {
        icon: Check,
        color: 'text-green-500',
        tooltip: `Saved ${timeText}`
      };
    }

    return null;
  };

  const status = getStatusDisplay();
  if (!status) return null;

  const Icon = status.icon;

  return (
    <div className={`inline-flex items-center ${className}`} title={status.tooltip}>
      <Icon
        className={`w-4 h-4 ${status.color} ${status.animate ? 'animate-spin' : ''}`}
      />
    </div>
  );
};

export default SaveStatusIndicator;
