import React, { useState } from 'react';
import { APP_VERSION } from '../version';
import { getSeasonalTheme, getThemeTextColors, getSeasonalMessage } from '../utils/seasonalTheme';
import { useChampionshipCountdown } from '../utils/championshipCountdown';
import ChampionshipModal from './ChampionshipModal';

const INSTAGRAM_URL = 'https://instagram.com/conquestofthecreek';

// Instagram Logo with Official Brand Gradient
const InstagramLogo = ({ className = "w-5 h-5" }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    <defs>
      <linearGradient id="instagramGradient" x1="0%" y1="100%" x2="100%" y2="0%">
        <stop offset="0%" style={{ stopColor: '#f09433', stopOpacity: 1 }} />
        <stop offset="25%" style={{ stopColor: '#e6683c', stopOpacity: 1 }} />
        <stop offset="50%" style={{ stopColor: '#dc2743', stopOpacity: 1 }} />
        <stop offset="75%" style={{ stopColor: '#cc2366', stopOpacity: 1 }} />
        <stop offset="100%" style={{ stopColor: '#bc1888', stopOpacity: 1 }} />
      </linearGradient>
    </defs>
    <rect
      x="2"
      y="2"
      width="20"
      height="20"
      rx="5"
      stroke="url(#instagramGradient)"
      strokeWidth="2"
      fill="none"
    />
    <circle
      cx="12"
      cy="12"
      r="4"
      stroke="url(#instagramGradient)"
      strokeWidth="2"
      fill="none"
    />
    <circle
      cx="18"
      cy="6"
      r="1.5"
      fill="url(#instagramGradient)"
    />
  </svg>
);

const Header = ({
  isAuthenticated,
  loginName,
  userRole,
  handleLogout,
  setShowLogin
}) => {
  const getRoleDisplay = () => {
    if (userRole === 'director') return 'Director';
    if (userRole === 'captain') return 'Captain';
    return '';
  };

  // Get current seasonal theme
  const theme = getSeasonalTheme();
  const textColors = getThemeTextColors(theme.name);
  const seasonalMessage = getSeasonalMessage(theme.name);

  // Get Championship Weekend countdown
  const championshipCountdown = useChampionshipCountdown();

  // Championship modal state
  const [showChampionshipModal, setShowChampionshipModal] = useState(false);

  return (
    <div
      className="text-white rounded-lg shadow-lg p-6 mb-6 relative overflow-hidden"
      style={{
        backgroundImage: `${theme.gradient}, url(${theme.image})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundBlendMode: 'overlay'
      }}
    >
      <div className="flex justify-between items-start relative z-10">
        <div>
          <h1 className="text-3xl font-bold mb-2">Conquest of the Creek</h1>
          <p className={textColors.subtitle}>Tournament Tracker • November 2025 - February 2026</p>
          {seasonalMessage && (
            <p className="text-sm font-semibold text-white mt-1">{seasonalMessage}</p>
          )}
          <p className={`text-sm ${textColors.secondary} mt-2`}>Silver Creek Valley Country Club</p>
          {/* Instagram Link */}
          <a
            href={INSTAGRAM_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-white hover:text-blue-50 transition-all hover:scale-105 mt-3 w-fit"
          >
            <InstagramLogo className="w-5 h-5" />
            <span className="text-sm">Follow us on Instagram</span>
          </a>
        </div>
        <div className="flex flex-col items-end gap-2">
          {/* Authentication Section */}
          {isAuthenticated ? (
            <>
              <div className="text-sm text-blue-200">
                {userRole === 'director' && `Director: ${loginName}`}
                {userRole === 'captain' && `Captain: ${loginName}`}
              </div>

              <button
                onClick={handleLogout}
                className="bg-white text-blue-600 px-3 py-1 rounded text-sm hover:bg-blue-50"
              >
                Logout
              </button>
              <span className={`text-xs ${textColors.badge} px-2 py-1 rounded`}>v{APP_VERSION}</span>
            </>
          ) : (
            <>
              <button
                onClick={() => setShowLogin(true)}
                className="bg-white text-blue-600 px-4 py-2 rounded hover:bg-blue-50"
              >
                Login
              </button>
              <span className={`text-xs ${textColors.badge} px-2 py-1 rounded`}>v{APP_VERSION}</span>
            </>
          )}
        </div>
      </div>

      {/* Championship Weekend Countdown - Positioned in lower right corner */}
      {championshipCountdown.shouldShow && (
        <button
          onClick={() => setShowChampionshipModal(true)}
          className="absolute bottom-2 right-2 sm:bottom-4 sm:right-4 z-20 text-right max-w-[calc(100%-1rem)] sm:max-w-md cursor-pointer group transition-all hover:scale-105"
          aria-label="View Championship Weekend details"
        >
          <div className="text-xs sm:text-base font-bold text-white bg-black/20 backdrop-blur-md px-2 py-1 sm:px-3 sm:py-2 rounded-md drop-shadow-lg break-words group-hover:bg-black/30 transition-all" style={{ textShadow: '0 2px 8px rgba(0, 0, 0, 0.8)' }}>
            {championshipCountdown.message}
            <span className="block text-[10px] sm:text-xs mt-0.5 opacity-80 group-hover:opacity-100">
              Click for details
            </span>
          </div>
        </button>
      )}

      {/* Championship Modal */}
      <ChampionshipModal
        isOpen={showChampionshipModal}
        onClose={() => setShowChampionshipModal(false)}
      />
    </div>
  );
};

export default Header;