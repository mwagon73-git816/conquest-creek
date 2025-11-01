import React, { useState } from 'react';
import { UserPlus, Plus, Edit, Trash2, Check, X, Upload, AlertTriangle } from 'lucide-react';
import Papa from 'papaparse';
import { ACTION_TYPES } from '../services/activityLogger';

const PlayerManagement = ({
  players,
  setPlayers,
  teams,
  isAuthenticated,
  getEffectiveRating,
  canAddPlayerToTeam,
  addLog
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
  const [showImportForm, setShowImportForm] = useState(false);
  const [csvFile, setCsvFile] = useState(null);
  const [parsedPlayers, setParsedPlayers] = useState([]);
  const [showDeleteAllModal, setShowDeleteAllModal] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [showFinalConfirm, setShowFinalConfirm] = useState(false);

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

    const playerName = `${playerData.firstName} ${playerData.lastName}`;

    if (editingPlayer) {
      const before = { ...editingPlayer };
      const after = { ...editingPlayer, ...playerData };

      setPlayers(players.map(p =>
        p.id === editingPlayer.id
          ? {...p, ...playerData}
          : p
      ));

      // Log the edit
      addLog(
        ACTION_TYPES.PLAYER_EDITED,
        { playerName, playerId: editingPlayer.id },
        editingPlayer.id,
        before,
        after
      );
    } else {
      const newPlayer = {
        id: Date.now(),
        teamId: null,
        ...playerData
      };

      setPlayers([...players, newPlayer]);

      // Log the add
      addLog(
        ACTION_TYPES.PLAYER_ADDED,
        { playerName, playerId: newPlayer.id },
        newPlayer.id,
        null,
        newPlayer
      );
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
    const player = players.find(p => p.id === playerId);
    if (confirm('Delete this player?')) {
      setPlayers(players.filter(p => p.id !== playerId));

      // Log the deletion
      if (player) {
        const playerName = `${player.firstName} ${player.lastName}`;
        addLog(
          ACTION_TYPES.PLAYER_DELETED,
          { playerName, playerId },
          playerId,
          player,
          null
        );
      }
    }
  };

  const handleAssignTeam = (player, teamId) => {
    const check = canAddPlayerToTeam(player, teamId);
    if (check.allowed) {
      const team = teams.find(t => t.id === teamId);
      const playerName = `${player.firstName} ${player.lastName}`;

      setPlayers(players.map(p => p.id === player.id ? {...p, teamId} : p));

      // Log the team assignment
      addLog(
        ACTION_TYPES.TEAM_PLAYER_ADDED,
        { playerName, teamName: team?.name || 'Unknown', teamId },
        player.id,
        { ...player },
        { ...player, teamId }
      );
    } else {
      alert(check.reason);
    }
  };

  const validatePlayer = (row, index) => {
    const errors = [];
    const validRatings = [2.5, 3.0, 3.5, 4.0, 4.5, 5.0, 5.5];

    // Normalize headers (case-insensitive)
    const normalizedRow = {};
    Object.keys(row).forEach(key => {
      normalizedRow[key.toLowerCase().trim()] = row[key];
    });

    // Required fields
    if (!normalizedRow.firstname?.trim()) {
      errors.push('Missing first name');
    }
    if (!normalizedRow.lastname?.trim()) {
      errors.push('Missing last name');
    }

    // Gender validation
    const gender = (normalizedRow.gender || 'M').toUpperCase().trim();
    if (gender !== 'M' && gender !== 'F') {
      errors.push('Gender must be M or F');
    }

    // NTRP validation
    const ntrp = parseFloat(normalizedRow.ntrp || '3.5');
    if (!validRatings.includes(ntrp)) {
      errors.push('NTRP must be 2.5-5.5');
    }

    // Status validation
    const status = (normalizedRow.status || 'active').toLowerCase().trim();
    if (!['active', 'injured', 'inactive'].includes(status)) {
      errors.push('Status must be active, injured, or inactive');
    }

    return {
      rowIndex: index,
      firstName: normalizedRow.firstname?.trim() || '',
      lastName: normalizedRow.lastname?.trim() || '',
      gender: gender,
      ntrpRating: ntrp,
      dynamicRating: normalizedRow.dynamicrating ? parseFloat(normalizedRow.dynamicrating) : null,
      email: normalizedRow.email?.trim() || '',
      phone: normalizedRow.phone?.trim() || '',
      status: status,
      errors: errors,
      isValid: errors.length === 0
    };
  };

  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    setCsvFile(file);

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      trimHeaders: true,
      complete: (results) => {
        const validated = results.data.map((row, index) => validatePlayer(row, index));
        setParsedPlayers(validated);
      },
      error: (error) => {
        alert('Error parsing CSV: ' + error.message);
        setCsvFile(null);
      }
    });
  };

  const handleImportPlayers = () => {
    const validPlayers = parsedPlayers.filter(p => p.isValid);

    if (validPlayers.length === 0) {
      alert('No valid players to import');
      return;
    }

    const newPlayers = validPlayers.map((p, index) => ({
      id: Date.now() + index,
      teamId: null,
      firstName: p.firstName,
      lastName: p.lastName,
      gender: p.gender,
      ntrpRating: p.ntrpRating,
      dynamicRating: p.dynamicRating,
      email: p.email,
      phone: p.phone,
      status: p.status
    }));

    setPlayers([...players, ...newPlayers]);

    alert(`Successfully imported ${validPlayers.length} player(s)`);

    // Reset import form
    setShowImportForm(false);
    setCsvFile(null);
    setParsedPlayers([]);
  };

  const handleCancelImport = () => {
    setShowImportForm(false);
    setCsvFile(null);
    setParsedPlayers([]);
  };

  const handleDeleteAllPlayers = () => {
    setShowDeleteAllModal(true);
    setDeleteConfirmText('');
    setShowFinalConfirm(false);
  };

  const handleCloseDeleteModal = () => {
    setShowDeleteAllModal(false);
    setDeleteConfirmText('');
    setShowFinalConfirm(false);
  };

  const handleProceedToFinalConfirm = () => {
    if (deleteConfirmText === 'DELETE ALL PLAYERS') {
      setShowFinalConfirm(true);
    }
  };

  const handleConfirmDeleteAll = () => {
    const playerCount = players.length;

    // Log the bulk deletion with WARNING flag
    addLog(
      ACTION_TYPES.PLAYERS_BULK_DELETE,
      { count: playerCount, warning: 'BULK_DELETE_ALL_PLAYERS' },
      null,
      { playerCount, playerIds: players.map(p => p.id) },
      null
    );

    // Clear all players
    setPlayers([]);

    // Close modal and reset
    handleCloseDeleteModal();

    alert('All players have been deleted');
  };

  const isDeleteTextValid = deleteConfirmText === 'DELETE ALL PLAYERS';

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <UserPlus className="w-6 h-6" />
          Player Management
        </h2>
        {isAuthenticated && !showPlayerForm && !showImportForm && (
          <div className="flex gap-2">
            <button
              onClick={handleAddNewPlayer}
              className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Add Player
            </button>
            <button
              onClick={() => setShowImportForm(true)}
              className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 flex items-center gap-2"
            >
              <Upload className="w-4 h-4" />
              Import from CSV
            </button>
          </div>
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

      {showImportForm && (
        <div className="bg-blue-50 border-2 border-blue-300 rounded-lg p-6 mb-6">
          <h3 className="text-xl font-bold mb-4">Import Players from CSV</h3>

          <div className="bg-white border border-blue-200 rounded p-4 mb-4">
            <p className="text-sm font-semibold mb-2">CSV Format Instructions:</p>
            <p className="text-xs text-gray-700 mb-2">
              Your CSV file should include the following headers (case-insensitive):
            </p>
            <ul className="text-xs text-gray-600 space-y-1 ml-4">
              <li>• <strong>FirstName</strong> (required)</li>
              <li>• <strong>LastName</strong> (required)</li>
              <li>• <strong>Gender</strong> (M/F, defaults to M)</li>
              <li>• <strong>NTRP</strong> (2.5-5.5, defaults to 3.5)</li>
              <li>• <strong>DynamicRating</strong> (optional)</li>
              <li>• <strong>Email</strong> (optional)</li>
              <li>• <strong>Phone</strong> (optional)</li>
              <li>• <strong>Status</strong> (active/injured/inactive, defaults to active)</li>
            </ul>
          </div>

          <div className="mb-4">
            <label className="block text-sm font-semibold mb-2">Select CSV File</label>
            <input
              type="file"
              accept=".csv"
              onChange={handleFileUpload}
              className="w-full px-3 py-2 border rounded bg-white"
            />
          </div>

          {parsedPlayers.length > 0 && (
            <div className="mb-4">
              <h4 className="font-semibold mb-2">Preview ({parsedPlayers.length} rows)</h4>
              <div className="overflow-x-auto max-h-96 border rounded">
                <table className="w-full text-sm">
                  <thead className="bg-blue-100 sticky top-0">
                    <tr>
                      <th className="p-2 text-left">Row</th>
                      <th className="p-2 text-left">First Name</th>
                      <th className="p-2 text-left">Last Name</th>
                      <th className="p-2 text-center">Gender</th>
                      <th className="p-2 text-center">NTRP</th>
                      <th className="p-2 text-center">Dynamic</th>
                      <th className="p-2 text-left">Email</th>
                      <th className="p-2 text-center">Status</th>
                      <th className="p-2 text-left">Validation</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parsedPlayers.map((player, idx) => (
                      <tr
                        key={idx}
                        className={`border-b ${player.isValid ? 'bg-white' : 'bg-red-50'}`}
                      >
                        <td className="p-2">{idx + 1}</td>
                        <td className="p-2">{player.firstName}</td>
                        <td className="p-2">{player.lastName}</td>
                        <td className="p-2 text-center">{player.gender}</td>
                        <td className="p-2 text-center">{player.ntrpRating}</td>
                        <td className="p-2 text-center">{player.dynamicRating || '-'}</td>
                        <td className="p-2">{player.email || '-'}</td>
                        <td className="p-2 text-center">
                          <span className={`px-2 py-1 rounded text-xs ${
                            player.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                          }`}>
                            {player.status}
                          </span>
                        </td>
                        <td className="p-2">
                          {player.isValid ? (
                            <span className="text-green-600 text-xs flex items-center gap-1">
                              <Check className="w-3 h-3" /> Valid
                            </span>
                          ) : (
                            <span className="text-red-600 text-xs">
                              {player.errors.join(', ')}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-sm text-gray-600 mt-2">
                Valid rows: {parsedPlayers.filter(p => p.isValid).length} / {parsedPlayers.length}
              </p>
            </div>
          )}

          <div className="flex gap-2">
            <button
              onClick={handleImportPlayers}
              disabled={parsedPlayers.filter(p => p.isValid).length === 0}
              className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700 flex items-center gap-2 disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              <Upload className="w-4 h-4" />
              Import Players
            </button>
            <button
              onClick={handleCancelImport}
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

      {isAuthenticated && players.length > 0 && (
        <div className="mt-8 border-2 border-red-300 bg-red-50 rounded-lg p-6">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="w-6 h-6 text-red-600" />
            <h3 className="text-xl font-bold text-red-900">Danger Zone</h3>
          </div>
          <p className="text-sm text-red-800 mb-4">
            Irreversible actions that will permanently delete data. Use with extreme caution.
          </p>
          <button
            onClick={handleDeleteAllPlayers}
            className="bg-red-600 text-white px-6 py-2 rounded hover:bg-red-700 flex items-center gap-2"
          >
            <Trash2 className="w-4 h-4" />
            Delete All Players
          </button>
        </div>
      )}

      {showDeleteAllModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-lg w-full mx-4 border-4 border-red-500">
            <div className="flex items-center gap-3 mb-4">
              <AlertTriangle className="w-8 h-8 text-red-600" />
              <h2 className="text-2xl font-bold text-red-900">
                {showFinalConfirm ? 'Final Confirmation' : 'Delete All Players?'}
              </h2>
            </div>

            {!showFinalConfirm ? (
              <>
                <div className="bg-red-50 border-2 border-red-300 rounded p-4 mb-4">
                  <p className="text-red-900 font-semibold mb-2">⚠️ WARNING ⚠️</p>
                  <p className="text-sm text-red-800 mb-2">
                    This will <strong>permanently delete ALL {players.length} players</strong> and remove them from all teams.
                  </p>
                  <p className="text-sm text-red-800 font-bold">
                    This action CANNOT be undone!
                  </p>
                </div>

                <div className="mb-4">
                  <label className="block text-sm font-semibold mb-2 text-gray-900">
                    To confirm, type <span className="text-red-600 font-mono">DELETE ALL PLAYERS</span> below:
                  </label>
                  <input
                    type="text"
                    value={deleteConfirmText}
                    onChange={(e) => setDeleteConfirmText(e.target.value)}
                    className="w-full px-3 py-2 border-2 border-red-300 rounded focus:outline-none focus:border-red-500"
                    placeholder="DELETE ALL PLAYERS"
                    autoFocus
                  />
                  <div className="mt-2 text-xs">
                    {isDeleteTextValid ? (
                      <span className="text-green-600 flex items-center gap-1">
                        <Check className="w-4 h-4" /> Text matches! You can proceed.
                      </span>
                    ) : (
                      <span className="text-gray-600">
                        {deleteConfirmText.length} / 18 characters (case-sensitive)
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={handleProceedToFinalConfirm}
                    disabled={!isDeleteTextValid}
                    className="flex-1 bg-red-600 text-white py-2 rounded hover:bg-red-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
                  >
                    Proceed to Final Confirmation
                  </button>
                  <button
                    onClick={handleCloseDeleteModal}
                    className="flex-1 bg-gray-300 text-gray-700 py-2 rounded hover:bg-gray-400"
                  >
                    Cancel
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="bg-red-100 border-2 border-red-400 rounded p-4 mb-4">
                  <p className="text-red-900 font-bold text-lg mb-3">Are you absolutely sure?</p>
                  <p className="text-sm text-red-800 mb-2">
                    You are about to permanently delete:
                  </p>
                  <ul className="text-sm text-red-800 list-disc ml-6 mb-3">
                    <li><strong>{players.length} total players</strong></li>
                    <li>All team assignments</li>
                    <li>All player data (names, ratings, contact info)</li>
                  </ul>
                  <p className="text-sm text-red-900 font-bold">
                    There is NO way to recover this data once deleted!
                  </p>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={handleConfirmDeleteAll}
                    className="flex-1 bg-red-700 text-white py-3 rounded hover:bg-red-800 font-bold flex items-center justify-center gap-2"
                  >
                    <Trash2 className="w-5 h-5" />
                    YES, DELETE ALL PLAYERS
                  </button>
                  <button
                    onClick={() => setShowFinalConfirm(false)}
                    className="flex-1 bg-gray-300 text-gray-700 py-3 rounded hover:bg-gray-400 font-semibold"
                  >
                    Go Back
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default PlayerManagement;