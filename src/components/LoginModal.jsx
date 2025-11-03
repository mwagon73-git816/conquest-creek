import React from 'react';

const LoginModal = ({
  showLogin,
  loginName,
  setLoginName,
  loginPassword,
  setLoginPassword,
  loginRole,
  setLoginRole,
  handleLogin,
  setShowLogin,
  tournamentDirectors
}) => {
  if (!showLogin) return null;

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleLogin();
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
        <h2 className="text-2xl font-bold mb-2">Login</h2>
        <p className="text-sm text-gray-500 mb-4">
          Enter your credentials to access the system.
        </p>

        {/* Role Selection Tabs */}
        <div className="flex gap-2 mb-4 border-b">
          <button
            onClick={() => {
              setLoginRole('director');
              setLoginName('');
              setLoginPassword('');
            }}
            className={`flex-1 px-4 py-2 font-semibold transition ${
              loginRole === 'director'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            Director
          </button>
          <button
            onClick={() => {
              setLoginRole('captain');
              setLoginName('');
              setLoginPassword('');
            }}
            className={`flex-1 px-4 py-2 font-semibold transition ${
              loginRole === 'captain'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            Captain
          </button>
        </div>

        <p className="text-sm text-gray-600 mb-4">
          {loginRole === 'director'
            ? 'Tournament directors have access to all features.'
            : 'Captains can enter matches for their team.'}
        </p>

        <input
          type="text"
          placeholder="Username"
          value={loginName}
          onChange={(e) => setLoginName(e.target.value)}
          onKeyPress={handleKeyPress}
          className="w-full mb-3 px-3 py-2 border rounded"
          autoFocus
        />

        {/* Password field for BOTH directors and captains */}
        <input
          type="password"
          placeholder="Password"
          value={loginPassword}
          onChange={(e) => setLoginPassword(e.target.value)}
          onKeyPress={handleKeyPress}
          className="w-full mb-3 px-3 py-2 border rounded"
        />

        <div className="flex gap-2 mt-4">
          <button
            onClick={handleLogin}
            className="flex-1 bg-blue-600 text-white py-2 rounded hover:bg-blue-700"
          >
            Login
          </button>
          <button
            onClick={() => {
              setShowLogin(false);
              setLoginName('');
              setLoginPassword('');
            }}
            className="flex-1 bg-gray-300 text-gray-700 py-2 rounded hover:bg-gray-400"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

export default LoginModal;