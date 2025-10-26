import React, { useState } from 'react';
import { UserPlus, Plus, Edit, Trash2, Check, X } from 'lucide-react';

const PlayerManagement = ({ 
  players, 
  setPlayers, 
  teams, 
  isAuthenticated, 
  getEffectiveRating,
  canAddPlayerToTeam 
}) => {
  const [showPlayerForm, setShowPlayerForm] = useState(false);
  const [editingPlayer, setEditingPlayer] = useState(null);
  const [playerFormData, setPlayerFormData] = useState({
    firstName: '',
    lastName: '',
    gender: 'M',
    ntrpRating: '3.5',
    dynamicRating: '',
    email: '',
    phone: '',
    status: 'active'
  });

  const handleSavePlayer = () => {
    if (!playerFormData.firstName || !playerFormData.lastName) {
      alert('First name and last name are required');
      return;
    }
    
    const playerData = {
      firstName: playerFormData.firstName.trim(),
      lastName: playerFormData.lastName.trim(),
      gender: playerFormData.gender,
      ntrpRating: parseFloat(playerFormData.ntrpRating),
      dynamicRating: playerFormData.dynamicRating ? parseFloat(playerFormData.dynamicRating) : null,
      email: playerFormData.email.trim(),
      phone: playerFormData.phone.trim(),
      status: playerFormData.status
    };

    if (editingPlayer) {
      setPlayers(players.map(p => 
        p.id === editingPlayer.id 
          ? {...p, ...playerData}
          : p
      ));
    } else {
      setPlayers([...players, {
        id: Date.now(),
        teamId: null,
        ...playerData
      }]);
    }
    
    setShowPlayerForm(false);
    setEditingPlayer(null);
  };

  const handleAddNewPlayer = () => {
    setShowPlayerForm(true);
    setEditingPlayer(null);
    setPlayerFormData({
      firstName: '',
      lastName: '',
      gender: 'M',
      ntrpRating: '3.5',
      dynamicRating: '',
      email: '',
      phone: '',
      status: 'active'
    });
  };

  const handleEditPlayer = (player) => {
    setEditingPlayer(player);
    setPlayerFormData({
      firstName: player.firstName,
      lastName: player.lastName,
      gender: player.gender,
      ntrpRating: String(player.ntrpRating),
      dynamicRating: player.dynamicRating || '',
      email: player.email || '',
      phone: player.phone || '',
      status: player.status
    });
    setShowPlayerForm(true);
  };

  const handleDeletePlayer = (playerId) => {
    if (confirm('Delete this player?')) {
      setPlayers(players.filter(p => p.id !== playerId));
    }
  };

  const handleAssignTeam = (player, teamId) => {
    const check = canAddPlayerToTeam(player, teamId);
    if (check.allowed) {
      setPlayers(players.map(p => p.id === player.id ? {...p, teamId} : p));
    } else {
      alert(check.reason);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <UserPlus className="w-6 h-6" />
          Player Management
        </h2>
        {isAuthenticated && !showPlayerForm && (
          <button 
            onClick={handleAddNewPlayer} 
            className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Add Player
          </button>
        )}
      </div>

      {showPlayerForm && (
        <div className="bg-blue-50 border-2 border-blue-300 rounded-lg p-6 mb-6">
          <h3 className="text-xl font-bold mb-4">
            {editingPlayer ? 'Edit Player' : 'Add New Player'}
          </h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold mb-1">First Name *</label>
              <input
                type="text"
                value={playerFormData.firstName}
                onChange={(e) => setPlayerFormData({...playerFormData, firstName: e.target.value})}
                className="w-full px-3 py-2 border rounded"
                placeholder="John"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold mb-1">Last Name *</label>
              <input
                type="text"
                value={playerFormData.lastName}
                onChange={(e) => setPlayerFormData({...playerFormData, lastName: e.target.value})}
                className="w-full px-3 py-2 border rounded"
                placeholder="Doe"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold mb-1">Gender *</label>
              <select
                value={playerFormData.gender}
                onChange={(e) => setPlayerFormData({...playerFormData, gender: e.target.value})}
                className="w-full px-3 py-2 border rounded"
              >
                <option value="M">Male</option>
                <option value="F">Female</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold mb-1">NTRP Rating *</label>
              <select
                value={playerFormData.ntrpRating}
                onChange={(e) => setPlayerFormData({...playerFormData, ntrpRating: e.target.value})}
                className="w-full px-3 py-2 border rounded"
              >
                <option value="2.5">2.5</option>
                <option value="3.0">3.0</option>
                <option value="3.5">3.5</option>
                <option value="4.0">4.0</option>
                <option value="4.5">4.5</option>
                <option value="5.0">5.0</option>
                <option value="5.5">5.5</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold mb-1">
                Dynamic Rating (Optional)
                <span className="text-xs text-gray-500 ml-1">- Takes priority over NTRP</span>
              </label>
              <input
                type="number"
                step="0.01"
                value={playerFormData.dynamicRating}
                onChange={(e) => setPlayerFormData({...playerFormData, dynamicRating: e.target.value})}
                className="w-full px-3 py-2 border rounded"
                placeholder="3.75"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold mb-1">Status</label>
              <select
                value={playerFormData.status}
                onChange={(e) => setPlayerFormData({...playerFormData, status: e.target.value})}
                className="w-full px-3 py-2 border rounded"
              >
                <option value="active">Active</option>
                <option value="injured">Injured</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold mb-1">Email</label>
              <input
                type="email"
                value={playerFormData.email}
                onChange={(e) => setPlayerFormData({...playerFormData, email: e.target.value})}
                className="w-full px-3 py-2 border rounded"
                placeholder="john@example.com"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold mb-1">Phone</label>
              <input
                type="tel"
                value={playerFormData.phone}
                onChange={(e) => setPlayerFormData({...playerFormData, phone: e.target.value})}
                className="w-full px-3 py-2 border rounded"
                placeholder="555-123-4567"
              />
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <button
              onClick={handleSavePlayer}
              className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700 flex items-center gap-2"
            >
              <Check className="w-4 h-4" />
              {editingPlayer ? 'Update Player' : 'Save Player'}
            </button>
            <button
              onClick={() => {
                setShowPlayerForm(false);
                setEditingPlayer(null);
              }}
              className="bg-gray-300 text-gray-700 px-6 py-2 rounded hover:bg-gray-400 flex items-center gap-2"
            >
              <X className="w-4 h-4" />
              Cancel
            </button>
          </div>
        </div>
      )}

      {!isAuthenticated && (
        <div className="bg-yellow-50 border border-yellow-200 rounded p-4 mb-4">
          <p className="text-sm text-yellow-800">View-only mode. Directors can login to manage players.</p>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b-2">
              <th className="text-left p-2">Name</th>
              <th className="text-center p-2">Gender</th>
              <th className="text-center p-2">NTRP</th>
              <th className="text-center p-2">Dynamic</th>
              <th className="text-center p-2">Effective</th>
              <th className="text-center p-2">Team</th>
              <th className="text-center p-2">Status</th>
              {isAuthenticated && <th className="text-center p-2">Actions</th>}
            </tr>
          </thead>
          <tbody>
            {players.map(player => {
              const team = teams.find(t => t.id === player.teamId);
              const effectiveRating = getEffectiveRating(player);
              return (
                <tr key={player.id} className="border-b hover:bg-gray-50">
                  <td className="p-2">{player.firstName} {player.lastName}</td>
                  <td className="text-center p-2">{player.gender}</td>
                  <td className="text-center p-2">{player.ntrpRating}</td>
                  <td className="text-center p-2">
                    {player.dynamicRating ? (
                      <span className="font-semibold text-blue-600">{player.dynamicRating}</span>
                    ) : '-'}
                  </td>
                  <td className="text-center p-2">
                    <span className="font-bold">{effectiveRating}</span>
                  </td>
                  <td className="text-center p-2">
                    {isAuthenticated && !team ? (
                      <select
                        value={player.teamId || ''}
                        onChange={(e) => {
                          const teamId = e.target.value ? parseInt(e.target.value) : null;
                          if (teamId) handleAssignTeam(player, teamId);
                        }}
                        className="text-sm px-2 py-1 border rounded"
                      >
                        <option value="">Assign...</option>
                        {teams.map(t => (
                          <option key={t.id} value={t.id}>{t.name}</option>
                        ))}
                      </select>
                    ) : (
                      <span>{team ? team.name : 'Unassigned'}</span>
                    )}
                  </td>
                  <td className="text-center p-2">
                    <span className={`px-2 py-1 rounded text-xs ${player.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                      {player.status}
                    </span>
                  </td>
                  {isAuthenticated && (
                    <td className="text-center p-2">
                      <div className="flex justify-center gap-2">
                        <button 
                          onClick={() => handleEditPlayer(player)}
                          className="text-blue-600 hover:text-blue-800 p-1"
                          title="Edit player"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => handleDeletePlayer(player.id)} 
                          className="text-red-600 hover:text-red-800 p-1"
                          title="Delete player"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
        {players.length === 0 && <p className="text-center text-gray-500 py-8">No players added yet</p>}
      </div>
    </div>
  );
};

export default PlayerManagement;