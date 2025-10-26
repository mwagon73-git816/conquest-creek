import React from 'react';

const LoginModal = ({ showLogin, loginName, setLoginName, handleLogin, setShowLogin, tournamentDirectors }) => {
  if (!showLogin) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
        <h2 className="text-2xl font-bold mb-4">Tournament Director Access</h2>
        <p className="text-sm text-gray-600 mb-4">Only tournament directors can edit.</p>
        <input
          type="text"
          placeholder="Enter your name"
          value={loginName}
          onChange={(e) => setLoginName(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && handleLogin()}
          className="w-full mb-4 px-3 py-2 border rounded"
          autoFocus
        />
        <div className="flex gap-2">
          <button 
            onClick={handleLogin} 
            className="flex-1 bg-blue-600 text-white py-2 rounded hover:bg-blue-700"
          >
            Login
          </button>
          <button 
            onClick={() => setShowLogin(false)} 
            className="flex-1 bg-gray-300 text-gray-700 py-2 rounded hover:bg-gray-400"
          >
            Cancel
          </button>
        </div>
        <p className="text-xs text-gray-500 mt-3">
          Authorized: {tournamentDirectors.map(d => d.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')).join(', ')}
        </p>
      </div>
    </div>
  );
};

export default LoginModal;