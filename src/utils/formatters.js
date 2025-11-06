/**
 * Format NTRP rating with 1 decimal place
 * @param {number|null|undefined} value - The NTRP rating value
 * @returns {string} Formatted NTRP rating (e.g., "4.0", "3.5") or "-" if null
 */
export const formatNTRP = (value) => {
  if (value === null || value === undefined || value === '') {
    return '-';
  }
  const numValue = typeof value === 'number' ? value : parseFloat(value);
  if (isNaN(numValue)) {
    return '-';
  }
  return numValue.toFixed(1);
};

/**
 * Format Dynamic rating with 4 decimal places
 * @param {number|null|undefined} value - The Dynamic rating value
 * @returns {string} Formatted Dynamic rating (e.g., "3.1345", "4.0000") or "-" if null
 */
export const formatDynamic = (value) => {
  if (value === null || value === undefined || value === '') {
    return '-';
  }
  const numValue = typeof value === 'number' ? value : parseFloat(value);
  if (isNaN(numValue)) {
    return '-';
  }
  return numValue.toFixed(4);
};

/**
 * Format date for display in PST timezone without timezone conversion issues
 * Handles both ISO date strings (YYYY-MM-DD) and ISO datetime strings
 * @param {string} dateString - The date string to format (e.g., "2025-11-15" or ISO datetime)
 * @returns {string} Formatted date (e.g., "Nov 15, 2025")
 */
export const formatDate = (dateString) => {
  if (!dateString) return '';

  // Handle ISO date strings (YYYY-MM-DD) by parsing components directly
  // This avoids timezone conversion issues
  if (typeof dateString === 'string' && dateString.match(/^\d{4}-\d{2}-\d{2}$/)) {
    const [year, month, day] = dateString.split('-').map(Number);
    // Create date in local timezone (months are 0-indexed in JavaScript)
    const date = new Date(year, month - 1, day);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      timeZone: 'America/Los_Angeles' // PST/PDT
    });
  }

  // Handle ISO datetime strings or timestamps
  const date = new Date(dateString);
  if (isNaN(date.getTime())) {
    return dateString; // Return original if invalid
  }

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'America/Los_Angeles' // PST/PDT
  });
};

/**
 * Format datetime for display in PST timezone with time
 * @param {string} dateString - The datetime string to format
 * @returns {string} Formatted datetime (e.g., "Nov 15, 2025, 3:30 PM")
 */
export const formatDateTime = (dateString) => {
  if (!dateString) return '';

  const date = new Date(dateString);
  if (isNaN(date.getTime())) {
    return dateString; // Return original if invalid
  }

  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: 'America/Los_Angeles' // PST/PDT
  });
};
