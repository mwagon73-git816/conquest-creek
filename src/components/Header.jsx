import React from 'react';
import { APP_VERSION } from '../version';
import tennisCourtImage from '../assets/tennis-court.jpg';

const Header = ({ isAuthenticated, loginName, saveStatus, handleLogout, setShowLogin }) => {
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
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-3xl font-bold">Conquest of the Creek</h1>
            <span className="text-xs bg-blue-700 px-2 py-1 rounded">v{APP_VERSION}</span>
          </div>
          <p className="text-blue-100">Tournament Tracker • November 2025 - February 2026</p>
          <p className="text-sm text-blue-200 mt-2">Silver Creek Valley Country Club</p>
          {saveStatus && <p className="text-xs text-blue-300 mt-2">{saveStatus}</p>}
        </div>
        {isAuthenticated ? (
          <div className="text-right">
            <div className="text-sm text-blue-200 mb-2">Logged in: {loginName}</div>
            <button 
              onClick={handleLogout} 
              className="bg-white text-blue-600 px-3 py-1 rounded text-sm hover:bg-blue-50"
            >
              Logout
            </button>
          </div>
        ) : (
          <button 
            onClick={() => setShowLogin(true)} 
            className="bg-white text-blue-600 px-4 py-2 rounded hover:bg-blue-50"
          >
            Director Login
          </button>
        )}
      </div>
    </div>
  );
};

export default Header;