import React from 'react';
import { Instagram } from 'lucide-react';
import { APP_VERSION } from '../version';
import tennisCourtImage from '../assets/tennis-court.jpg';

const INSTAGRAM_URL = 'https://instagram.com/conquestofthecreek';

const Header = ({ isAuthenticated, loginName, userRole, saveStatus, handleLogout, setShowLogin }) => {
  const getRoleDisplay = () => {
    if (userRole === 'director') return 'Director';
    if (userRole === 'captain') return 'Captain';
    return '';
  };

  return (
    <div
      className="text-white rounded-lg shadow-lg p-6 mb-6 relative overflow-hidden"
      style={{
        backgroundImage: `linear-gradient(to right, rgba(37, 99, 235, 0.85), rgba(30, 64, 175, 0.85)), url(${tennisCourtImage})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundBlendMode: 'overlay'
      }}
    >
      <div className="flex justify-between items-start relative z-10">
        <div>
          <h1 className="text-3xl font-bold mb-2">Conquest of the Creek</h1>
          <p className="text-blue-100">Tournament Tracker • November 2025 - February 2026</p>
          <p className="text-sm text-blue-200 mt-2">Silver Creek Valley Country Club</p>
          {/* Instagram Link */}
          <a
            href={INSTAGRAM_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-white hover:text-blue-100 transition-all hover:scale-105 mt-2 w-fit"
          >
            <Instagram className="w-4 h-4" />
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
              <span className="text-xs bg-blue-700 bg-opacity-70 px-2 py-1 rounded">v{APP_VERSION}</span>
            </>
          ) : (
            <>
              <button
                onClick={() => setShowLogin(true)}
                className="bg-white text-blue-600 px-4 py-2 rounded hover:bg-blue-50"
              >
                Login
              </button>
              <span className="text-xs bg-blue-700 bg-opacity-70 px-2 py-1 rounded">v{APP_VERSION}</span>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default Header;