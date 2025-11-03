import React from 'react';
import { Save } from 'lucide-react';
import { APP_VERSION } from '../version';
import tennisCourtImage from '../assets/tennis-court.jpg';

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
  saveStatus, 
  handleLogout, 
  setShowLogin,
  onManualSave 
}) => {
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
              
              {/* Manual Save Button - Only for Directors */}
              {userRole === 'director' && onManualSave && (
                <button
                  onClick={onManualSave}
                  className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 transition-colors font-medium shadow-md"
                  title="Manually save all data to Firebase"
                >
                  <Save className="w-4 h-4" />
                  Save Data
                </button>
              )}
              
              {/* Save Status */}
              {saveStatus && (
                <div className="text-xs text-blue-100 bg-blue-700 bg-opacity-50 px-2 py-1 rounded">
                  {saveStatus}
                </div>
              )}
              
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