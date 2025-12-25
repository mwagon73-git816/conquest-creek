/**
 * Championship Weekend Countdown Utility
 * Calculates days until Championship Weekend and returns appropriate message
 */

const CHAMPIONSHIP_START_DATE = new Date('2026-02-07T00:00:00');
const CHAMPIONSHIP_END_DATE = new Date('2026-02-07T23:59:59'); // Hide after Feb 7

/**
 * Calculate days until Championship Weekend
 * @returns {Object} { daysUntil: number, message: string, shouldShow: boolean }
 */
export const getChampionshipCountdown = () => {
  const now = new Date();

  // Don't show after Championship Weekend ends
  if (now > CHAMPIONSHIP_END_DATE) {
    return { daysUntil: 0, message: '', shouldShow: false };
  }

  // Calculate days until championship
  const timeDiff = CHAMPIONSHIP_START_DATE - now;
  const daysUntil = Math.ceil(timeDiff / (1000 * 60 * 60 * 24));

  // If championship has started or is today
  if (daysUntil <= 0) {
    return {
      daysUntil: 0,
      message: '🏆 Championship Weekend is TODAY! Feb 7',
      shouldShow: true
    };
  }

  // Varying messages based on proximity
  let message = '';

  if (daysUntil >= 30) {
    // 30+ days out
    message = `🏆 Championship Weekend in ${daysUntil} days! Feb 7, 2026`;
  } else if (daysUntil >= 7) {
    // 7-29 days
    message = `🏆 Championship Weekend in ${daysUntil} days! Feb 7 - Get ready!`;
  } else {
    // 1-6 days - THIS WEEK
    message = `🏆 Championship Weekend in ${daysUntil} days! THIS WEEK: Feb 7!`;
  }

  return { daysUntil, message, shouldShow: true };
};

/**
 * React hook for Championship Weekend countdown
 * Updates daily
 */
export const useChampionshipCountdown = () => {
  const [countdown, setCountdown] = React.useState(getChampionshipCountdown());

  React.useEffect(() => {
    // Update countdown daily at midnight
    const updateCountdown = () => {
      setCountdown(getChampionshipCountdown());
    };

    // Update immediately
    updateCountdown();

    // Calculate time until next midnight
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    const msUntilMidnight = tomorrow - now;

    // Set timeout for midnight, then update daily
    const midnightTimeout = setTimeout(() => {
      updateCountdown();
      // After first midnight update, set daily interval
      const dailyInterval = setInterval(updateCountdown, 24 * 60 * 60 * 1000);
      return () => clearInterval(dailyInterval);
    }, msUntilMidnight);

    return () => clearTimeout(midnightTimeout);
  }, []);

  return countdown;
};

// For React 18+ compatibility, import React conditionally if used
import React from 'react';
