/**
 * Seasonal Theme Manager
 * Automatically selects the appropriate header image based on the current date
 */

import tennisCourtDefault from '../assets/tennis-court.jpg';
// Import seasonal images - these will be added as they're created
// import tennisCourtAutumn from '../assets/tennis-court-autumn.jpg';
// import tennisCourtWinter from '../assets/tennis-court-winter.jpg';
// import tennisCourtNewYear from '../assets/tennis-court-newyear.jpg';
// import tennisCourtLateWinter from '../assets/tennis-court-latewinter.jpg';

/**
 * Get the current seasonal theme based on the date
 * @param {Date} currentDate - The current date (defaults to today)
 * @returns {Object} Theme configuration with image and gradient
 */
export const getSeasonalTheme = (currentDate = new Date()) => {
  const month = currentDate.getMonth(); // 0-11
  const day = currentDate.getDate();

  // November (month 10) - Thanksgiving/Autumn Theme
  if (month === 10) {
    return {
      name: 'autumn',
      image: tennisCourtDefault, // Will be replaced with autumn image
      gradient: 'linear-gradient(to right, rgba(194, 65, 12, 0.85), rgba(120, 53, 15, 0.85))', // Warm autumn colors
      description: 'Autumn/Thanksgiving Theme'
    };
  }

  // December (month 11) - Winter/Christmas Theme
  if (month === 11) {
    return {
      name: 'winter',
      image: tennisCourtDefault, // Will be replaced with winter image
      gradient: 'linear-gradient(to right, rgba(30, 58, 138, 0.85), rgba(29, 78, 216, 0.85))', // Cool winter blues
      description: 'Winter/Christmas Theme'
    };
  }

  // January (month 0) - New Year Theme
  if (month === 0) {
    return {
      name: 'newyear',
      image: tennisCourtDefault, // Will be replaced with new year image
      gradient: 'linear-gradient(to right, rgba(55, 48, 163, 0.85), rgba(79, 70, 229, 0.85))', // Fresh indigo/purple
      description: 'New Year Theme'
    };
  }

  // February (month 1) - Late Winter Theme
  if (month === 1) {
    return {
      name: 'latewinter',
      image: tennisCourtDefault, // Will be replaced with late winter image
      gradient: 'linear-gradient(to right, rgba(37, 99, 235, 0.85), rgba(30, 64, 175, 0.85))', // Classic blue
      description: 'Late Winter Theme'
    };
  }

  // Default theme (for any other months)
  return {
    name: 'default',
    image: tennisCourtDefault,
    gradient: 'linear-gradient(to right, rgba(37, 99, 235, 0.85), rgba(30, 64, 175, 0.85))',
    description: 'Default Theme'
  };
};

/**
 * Get the text color class based on the seasonal theme
 * @param {string} themeName - The name of the current theme
 * @returns {string} Tailwind CSS color classes
 */
export const getThemeTextColors = (themeName) => {
  switch (themeName) {
    case 'autumn':
      return {
        subtitle: 'text-orange-100',
        secondary: 'text-orange-200',
        badge: 'bg-orange-700 bg-opacity-70'
      };
    case 'winter':
      return {
        subtitle: 'text-blue-100',
        secondary: 'text-blue-200',
        badge: 'bg-blue-700 bg-opacity-70'
      };
    case 'newyear':
      return {
        subtitle: 'text-indigo-100',
        secondary: 'text-indigo-200',
        badge: 'bg-indigo-700 bg-opacity-70'
      };
    case 'latewinter':
      return {
        subtitle: 'text-blue-100',
        secondary: 'text-blue-200',
        badge: 'bg-blue-700 bg-opacity-70'
      };
    default:
      return {
        subtitle: 'text-blue-100',
        secondary: 'text-blue-200',
        badge: 'bg-blue-700 bg-opacity-70'
      };
  }
};

/**
 * Get seasonal message or greeting
 * @param {string} themeName - The name of the current theme
 * @returns {string} Optional seasonal message
 */
export const getSeasonalMessage = (themeName) => {
  switch (themeName) {
    case 'autumn':
      return '🍂 Happy Thanksgiving Season!';
    case 'winter':
      return '❄️ Happy Holidays!';
    case 'newyear':
      return '🎉 Happy New Year 2026!';
    case 'latewinter':
      return ''; // No special message
    default:
      return '';
  }
};

/**
 * Get carousel styling based on the seasonal theme
 * @param {string} themeName - The name of the current theme
 * @returns {Object} Carousel-specific styling classes
 */
export const getCarouselColors = (themeName) => {
  switch (themeName) {
    case 'autumn':
      return {
        captionGradient: 'bg-gradient-to-r from-orange-700 to-orange-900',
        captionText: 'text-white',
        subtitleText: 'text-orange-100',
        secondaryText: 'text-orange-200',
        accentText: 'text-yellow-300', // For winning team highlights
        counterText: 'text-orange-200'
      };
    case 'winter':
      return {
        captionGradient: 'bg-gradient-to-r from-blue-600 to-blue-800',
        captionText: 'text-white',
        subtitleText: 'text-blue-100',
        secondaryText: 'text-blue-200',
        accentText: 'text-green-300', // For winning team highlights
        counterText: 'text-blue-200'
      };
    case 'newyear':
      return {
        captionGradient: 'bg-gradient-to-r from-indigo-600 to-purple-800',
        captionText: 'text-white',
        subtitleText: 'text-indigo-100',
        secondaryText: 'text-indigo-200',
        accentText: 'text-yellow-300', // For winning team highlights
        counterText: 'text-indigo-200'
      };
    case 'latewinter':
      return {
        captionGradient: 'bg-gradient-to-r from-blue-600 to-blue-800',
        captionText: 'text-white',
        subtitleText: 'text-blue-100',
        secondaryText: 'text-blue-200',
        accentText: 'text-green-300', // For winning team highlights
        counterText: 'text-blue-200'
      };
    default:
      return {
        captionGradient: 'bg-gradient-to-r from-blue-600 to-blue-800',
        captionText: 'text-white',
        subtitleText: 'text-blue-100',
        secondaryText: 'text-blue-200',
        accentText: 'text-green-300',
        counterText: 'text-blue-200'
      };
  }
};
