import React from 'react';

/**
 * TeamLogo component - displays team logo or falls back to color background
 *
 * @param {Object} props
 * @param {Object} props.team - Team object with optional logo and color
 * @param {string} [props.size='md'] - Size: 'sm' (4x4), 'md' (8x8), 'lg' (12x12), 'xl' (16x16)
 * @param {string} [props.className] - Additional CSS classes
 * @param {boolean} [props.showBorder=false] - Whether to show border
 * @param {boolean} [props.clickable=false] - Whether logo is clickable (adds hover effects)
 * @param {Function} [props.onClick] - Click handler for logo
 */
const TeamLogo = ({ team, size = 'md', className = '', showBorder = false, clickable = false, onClick }) => {
  // Size mappings
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-8 h-8',
    lg: 'w-12 h-12',
    xl: 'w-16 h-16'
  };

  const borderClass = showBorder ? 'border-2 border-gray-300 shadow-sm' : '';
  const sizeClass = sizeClasses[size] || sizeClasses.md;
  const hoverClass = clickable && team?.logo ? 'cursor-pointer hover:shadow-lg hover:scale-105 transition-all duration-200' : '';

  // If team has a logo, display it
  if (team?.logo) {
    return (
      <div
        className={`${sizeClass} rounded overflow-hidden flex items-center justify-center ${borderClass} ${hoverClass} ${className}`}
        title={team.name}
        onClick={onClick}
      >
        <img
          src={team.logo}
          alt={`${team.name} logo`}
          className="w-full h-full object-cover"
        />
      </div>
    );
  }

  // Fall back to color background
  return (
    <div
      className={`${sizeClass} rounded ${borderClass} ${className}`}
      style={{ backgroundColor: team?.color || '#3B82F6' }}
      title={team?.name || 'Team'}
    />
  );
};

export default TeamLogo;
