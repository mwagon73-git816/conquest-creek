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
