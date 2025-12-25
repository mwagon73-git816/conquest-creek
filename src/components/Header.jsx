import React, { useState } from 'react';
import { APP_VERSION } from '../version';
import { getSeasonalTheme, getThemeTextColors, getSeasonalMessage } from '../utils/seasonalTheme';
import { useChampionshipCountdown } from '../utils/championshipCountdown';
import ChampionshipModal from './ChampionshipModal';

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
      className="text-white rounded-lg shadow-lg px-6 py-10 mb-6 relative overflow-hidden"
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

      {/* Championship Weekend Countdown - Centered at bottom */}
      {championshipCountdown.shouldShow && (
        <button
          onClick={() => setShowChampionshipModal(true)}
          className="absolute bottom-2 left-1/2 transform -translate-x-1/2 sm:bottom-3 z-20 cursor-pointer group transition-all hover:scale-105"
          aria-label="View Championship Weekend details"
        >
          <div
            className="text-[10px] sm:text-sm font-bold text-white bg-black/20 backdrop-blur-md px-2 py-1.5 sm:px-3 sm:py-2 rounded-md drop-shadow-lg group-hover:bg-black/30 transition-all text-center"
            style={{ textShadow: '0 2px 8px rgba(0, 0, 0, 0.8)', whiteSpace: 'nowrap' }}
          >
            {championshipCountdown.message}
            <span className="opacity-80 group-hover:opacity-100"> - Click for details</span>
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