import React, { useState } from 'react';
import { UserPlus, Plus, Edit, Trash2, Check, X, Upload, AlertTriangle, ChevronUp, ChevronDown } from 'lucide-react';
import Papa from 'papaparse';
import { ACTION_TYPES } from '../services/activityLogger';
import { formatNTRP, formatDynamic } from '../utils/formatters';

const PlayerManagement = ({
  players,
  setPlayers,
  teams,
  captains,
  setCaptains,
  isAuthenticated,
  userRole,
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
    status: 'active',
    teamId: null,
    isCaptain: false,
    captainUsername: '',
    captainPassword: '',
    captainEmail: '',
    captainPhone: ''
  });
  const [showImportForm, setShowImportForm] = useState(false);
  const [csvFile, setCsvFile] = useState(null);
  const [parsedPlayers, setParsedPlayers] = useState([]);
  const [showDeleteAllModal, setShowDeleteAllModal] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [showFinalConfirm, setShowFinalConfirm] = useState(false);
  const [sortColumn, setSortColumn] = useState('firstName');
  const [sortDirection, setSortDirection] = useState('asc');

  const validateEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const handleSort = (column) => {
    if (sortColumn === column) {
      // Cycle through: asc -> desc -> null (unsorted)
      if (sortDirection === 'asc') {
        setSortDirection('desc');
      } else if (sortDirection === 'desc') {
        setSortColumn(null);
        setSortDirection('asc');
      }
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  const getSortedPlayers = () => {
    if (!sortColumn) {
      return players; // Return unsorted
    }

    const sorted = [...players].sort((a, b) => {
      let aVal, bVal;

      switch (sortColumn) {
        case 'firstName':
          aVal = a.firstName.toLowerCase();
          bVal = b.firstName.toLowerCase();
          break;
        case 'lastName':
          aVal = a.lastName.toLowerCase();
          bVal = b.lastName.toLowerCase();
          break;
        case 'gender':
          aVal = a.gender;
          bVal = b.gender;
          break;
        case 'ntrp':
          aVal = a.ntrpRating;
          bVal = b.ntrpRating;
          break;
        case 'dynamic':
          // Handle null dynamic ratings - sort to end
          if (!a.dynamicRating && !b.dynamicRating) return 0;
          if (!a.dynamicRating) return 1;
          if (!b.dynamicRating) return -1;
          aVal = a.dynamicRating;
          bVal = b.dynamicRating;
          break;
        default:
          return 0;
      }

      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

    return sorted;
  };

  const SortableHeader = ({ column, children, align = 'left' }) => {
    const isActive = sortColumn === column;
    const alignClass = align === 'center' ? 'text-center' : 'text-left';

    return (
      <th
        className={`p-2 ${alignClass} cursor-pointer hover:bg-gray-100 select-none ${isActive ? 'bg-blue-50' : ''}`}
        onClick={() => handleSort(column)}
        title={`Click to sort by ${children}`}
      >
        <div className={`flex items-center gap-1 ${align === 'center' ? 'justify-center' : 'justify-start'}`}>
          <span className={isActive ? 'font-bold' : ''}>{children}</span>
          {isActive && (
            sortDirection === 'asc' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />
          )}
        </div>
      </th>
    );
  };

  const handleSavePlayer = () => {
    if (!playerFormData.firstName || !playerFormData.lastName) {
      alert('⚠️ First name and last name are required.');
      return;
    }

    // Captain validation
    if (playerFormData.isCaptain) {
      if (!playerFormData.captainUsername.trim()) {
        alert('⚠️ Captain username is required.');
        return;
      }
      if (!playerFormData.captainPassword.trim()) {
        alert('⚠️ Captain password is required.');
        return;
      }
      if (!playerFormData.captainEmail.trim()) {
        alert('⚠️ Captain email is required.');
        return;
      }
      if (!validateEmail(playerFormData.captainEmail)) {
        alert('⚠️ Please enter a valid email address.');
        return;
      }

      // Check for duplicate username (except when editing same captain)
      const existingCaptain = captains.find(c =>
        c.username === playerFormData.captainUsername &&
        (!editingPlayer || c.playerId !== editingPlayer.id)
      );
      if (existingCaptain) {
        alert('⚠️ Captain username already exists.\n\nPlease choose a different username.');
        return;
      }

      // Check for duplicate email
      const duplicateEmail = captains.find(c =>
        c.email === playerFormData.captainEmail &&
        (!editingPlayer || c.playerId !== editingPlayer.id)
      );
      if (duplicateEmail) {
        alert('⚠️ Captain email already exists.\n\nPlease use a different email.');
        return;
      }
    }

    const playerData = {
      firstName: playerFormData.firstName.trim(),
      lastName: playerFormData.lastName.trim(),
      gender: playerFormData.gender,
      ntrpRating: parseFloat(playerFormData.ntrpRating),
      dynamicRating: playerFormData.dynamicRating ? parseFloat(playerFormData.dynamicRating) : null,
      email: playerFormData.email.trim(),
      phone: playerFormData.phone.trim(),
      status: playerFormData.status,
      isCaptain: playerFormData.isCaptain || false,
      captainUsername: playerFormData.captainUsername.trim(),
      captainPassword: playerFormData.captainPassword.trim(),
      captainEmail: playerFormData.captainEmail.trim(),
      captainPhone: playerFormData.captainPhone.trim()
    };

    const playerName = `${playerData.firstName} ${playerData.lastName}`;

    if (editingPlayer) {
      const before = { ...editingPlayer };
      const wasCaptain = editingPlayer.isCaptain;
      const isCaptainNow = playerFormData.isCaptain;

      // Handle team reassignment (directors only)
      let newTeamId = editingPlayer.teamId;
      if (userRole === 'director' && playerFormData.teamId !== editingPlayer.teamId) {
        const targetTeamId = playerFormData.teamId;

        // Validate team reassignment
        if (targetTeamId !== null) {
          const check = canAddPlayerToTeam(editingPlayer, targetTeamId, true);
          if (!check.allowed) {
            alert(`⚠️ Cannot reassign player to team:\n\n${check.reason}`);
            return;
          }
        }

        newTeamId = targetTeamId;

        // Log the team reassignment
        const fromTeam = teams.find(t => t.id === editingPlayer.teamId);
        const toTeam = teams.find(t => t.id === targetTeamId);
        addLog(
          ACTION_TYPES.PLAYER_REASSIGNED,
          {
            playerName,
            playerId: editingPlayer.id,
            fromTeam: fromTeam?.name || 'Unassigned',
            toTeam: toTeam?.name || 'Unassigned',
            fromTeamId: editingPlayer.teamId,
            toTeamId: targetTeamId
          },
          editingPlayer.id,
          { ...editingPlayer },
          { ...editingPlayer, teamId: targetTeamId }
        );
      }

      const updatedPlayer = {...editingPlayer, ...playerData, teamId: newTeamId};
      const after = updatedPlayer;

      setPlayers(players.map(p =>
        p.id === editingPlayer.id ? updatedPlayer : p
      ));

      // Handle captain synchronization
      if (isCaptainNow && !wasCaptain) {
        // Player is being promoted to captain
        const teamId = editingPlayer.teamId;

        // Check if team already has a captain
        if (teamId) {
          const existingTeamCaptain = captains.find(c => c.teamId === teamId && c.status === 'active');
          if (existingTeamCaptain) {
            const team = teams.find(t => t.id === teamId);
            if (!confirm(`Team "${team?.name}" already has a captain.\n\nAssigning this captain will unassign the current captain.\n\nContinue?`)) {
              return;
            }
            // Unassign existing captain
            setCaptains(captains.map(c =>
              c.id === existingTeamCaptain.id ? {...c, teamId: null} : c
            ));
          }
        }

        const newCaptain = {
          id: Date.now(),
          username: playerData.captainUsername,
          password: playerData.captainPassword,
          name: playerName,
          email: playerData.captainEmail,
          phone: playerData.captainPhone,
          teamId: teamId,
          status: 'active',
          playerId: editingPlayer.id
        };
        setCaptains([...captains, newCaptain]);

        alert(`✅ Player promoted to captain!\n\nUsername: ${playerData.captainUsername}\nPassword: ${playerData.captainPassword}\n\n⚠️ IMPORTANT: Click the "Save Data" button to save this to the database.`);
      } else if (!isCaptainNow && wasCaptain) {
        // Player captain status is being removed
        const linkedCaptain = captains.find(c => c.playerId === editingPlayer.id);
        if (linkedCaptain) {
          setCaptains(captains.filter(c => c.id !== linkedCaptain.id));
        }
      } else if (isCaptainNow && wasCaptain) {
        // Update existing captain
        const linkedCaptain = captains.find(c => c.playerId === editingPlayer.id);
        if (linkedCaptain) {
          setCaptains(captains.map(c =>
            c.id === linkedCaptain.id
              ? {
                  ...c,
                  username: playerData.captainUsername,
                  password: playerData.captainPassword,
                  name: playerName,
                  email: playerData.captainEmail,
                  phone: playerData.captainPhone,
                  teamId: updatedPlayer.teamId
                }
              : c
          ));
        }
      }

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

      // If player is a captain, create captain record
      if (playerFormData.isCaptain) {
        const newCaptain = {
          id: Date.now() + 1,
          username: playerData.captainUsername,
          password: playerData.captainPassword,
          name: playerName,
          email: playerData.captainEmail,
          phone: playerData.captainPhone,
          teamId: null,
          status: 'active',
          playerId: newPlayer.id
        };
        setCaptains([...captains, newCaptain]);

        alert(`✅ Player added and promoted to captain!\n\nUsername: ${playerData.captainUsername}\nPassword: ${playerData.captainPassword}\n\n⚠️ IMPORTANT: Click the "Save Data" button to save this to the database.`);
      }

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

  const generateSuggestedUsername = (firstName, lastName) => {
    if (!firstName || !lastName) return '';
    return (firstName[0] + lastName).toLowerCase();
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
      status: 'active',
      teamId: null,
      isCaptain: false,
      captainUsername: '',
      captainPassword: '',
      captainEmail: '',
      captainPhone: ''
    });
  };

  const handleEditPlayer = (player) => {
    setEditingPlayer(player);

    // Load captain data if player is a captain
    const linkedCaptain = captains.find(c => c.playerId === player.id);

    // Fix NTRP data type mismatch - convert to string with 1 decimal place
    const ntrpValue = player.ntrpRating.toFixed(1);

    // Debug logging to verify NTRP conversion
    console.log('Edit Player NTRP Debug:', {
      stored: player.ntrpRating,
      storedType: typeof player.ntrpRating,
      converted: ntrpValue,
      convertedType: typeof ntrpValue,
      player: `${player.firstName} ${player.lastName}`
    });

    setPlayerFormData({
      firstName: player.firstName,
      lastName: player.lastName,
      gender: player.gender,
      ntrpRating: ntrpValue,
      dynamicRating: player.dynamicRating || '',
      email: player.email || '',
      phone: player.phone || '',
      status: player.status,
      teamId: player.teamId,
      isCaptain: player.isCaptain || false,
      captainUsername: player.captainUsername || linkedCaptain?.username || '',
      captainPassword: player.captainPassword || linkedCaptain?.password || '',
      captainEmail: player.captainEmail || linkedCaptain?.email || '',
      captainPhone: player.captainPhone || linkedCaptain?.phone || ''
    });
    setShowPlayerForm(true);
  };

  const handleDeletePlayer = (playerId) => {
    const player = players.find(p => p.id === playerId);
    const linkedCaptain = captains.find(c => c.playerId === playerId);

    let confirmMessage = 'Are you sure you want to delete this player?\n\nThis action cannot be undone.';
    if (linkedCaptain) {
      confirmMessage = 'This player is also a captain.\n\nDeleting will remove their captain login access.\n\nThis action cannot be undone.\n\nContinue?';
    }

    if (confirm(confirmMessage)) {
      setPlayers(players.filter(p => p.id !== playerId));

      // Delete linked captain if exists
      if (linkedCaptain) {
        setCaptains(captains.filter(c => c.id !== linkedCaptain.id));
      }

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

      // If player is a captain, sync their captain record
      const linkedCaptain = captains.find(c => c.playerId === player.id);
      if (linkedCaptain) {
        setCaptains(captains.map(c =>
          c.id === linkedCaptain.id ? {...c, teamId} : c
        ));
      }

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

    // Note: Headers are already normalized by Papa.parse transformHeader
    // row keys are already lowercase and trimmed
    const normalizedRow = row;

    const firstName = normalizedRow.firstname?.toString().trim() || '';
    const lastName = normalizedRow.lastname?.toString().trim() || '';

    // Required fields
    if (!firstName) {
      errors.push('Missing first name');
    }
    if (!lastName) {
      errors.push('Missing last name');
    }

    // Check if player already exists (match by first + last name, case-insensitive)
    const existingPlayer = players.find(p =>
      p.firstName.toLowerCase().trim() === firstName.toLowerCase() &&
      p.lastName.toLowerCase().trim() === lastName.toLowerCase()
    );

    // Gender validation
    let gender = 'M'; // Default for new players only
    if (normalizedRow.gender !== undefined && normalizedRow.gender !== null && normalizedRow.gender !== '') {
      gender = normalizedRow.gender.toString().toUpperCase().trim();
    } else if (existingPlayer) {
      gender = existingPlayer.gender; // Keep existing for updates
    }
    if (gender !== 'M' && gender !== 'F') {
      errors.push('Gender must be M or F');
    }

    // NTRP validation - try multiple column name variations
    let ntrp = null;
    if (normalizedRow.ntrp !== undefined && normalizedRow.ntrp !== null && normalizedRow.ntrp !== '') {
      ntrp = typeof normalizedRow.ntrp === 'number' ? normalizedRow.ntrp : parseFloat(normalizedRow.ntrp);
    } else if (normalizedRow.ntrprating !== undefined && normalizedRow.ntrprating !== null && normalizedRow.ntrprating !== '') {
      ntrp = typeof normalizedRow.ntrprating === 'number' ? normalizedRow.ntrprating : parseFloat(normalizedRow.ntrprating);
    } else if (normalizedRow['ntrp rating'] !== undefined && normalizedRow['ntrp rating'] !== null && normalizedRow['ntrp rating'] !== '') {
      ntrp = typeof normalizedRow['ntrp rating'] === 'number' ? normalizedRow['ntrp rating'] : parseFloat(normalizedRow['ntrp rating']);
    }

    // If no NTRP in CSV, use existing player's value or default to 3.5
    if (ntrp === null || isNaN(ntrp)) {
      if (existingPlayer) {
        ntrp = existingPlayer.ntrpRating; // Keep existing for updates
      } else {
        ntrp = 3.5; // Default only for new players
      }
    }

    console.log(`Row ${index + 1}: ${firstName} ${lastName} - NTRP from CSV = ${ntrp}`);

    if (!validRatings.includes(ntrp)) {
      errors.push(`NTRP must be 2.5-5.5 (got ${ntrp})`);
    }

    // Dynamic rating - try multiple column name variations
    let dynamicRating = null;
    if (normalizedRow.dynamic !== undefined && normalizedRow.dynamic !== null && normalizedRow.dynamic !== '') {
      dynamicRating = typeof normalizedRow.dynamic === 'number' ? normalizedRow.dynamic : parseFloat(normalizedRow.dynamic);
    } else if (normalizedRow.dynamicrating !== undefined && normalizedRow.dynamicrating !== null && normalizedRow.dynamicrating !== '') {
      dynamicRating = typeof normalizedRow.dynamicrating === 'number' ? normalizedRow.dynamicrating : parseFloat(normalizedRow.dynamicrating);
    } else if (normalizedRow['dynamic rating'] !== undefined && normalizedRow['dynamic rating'] !== null && normalizedRow['dynamic rating'] !== '') {
      dynamicRating = typeof normalizedRow['dynamic rating'] === 'number' ? normalizedRow['dynamic rating'] : parseFloat(normalizedRow['dynamic rating']);
    }

    if (isNaN(dynamicRating)) {
      dynamicRating = null;
    }

    // Status validation
    let status = 'active'; // Default for new players
    if (normalizedRow.status !== undefined && normalizedRow.status !== null && normalizedRow.status !== '') {
      status = normalizedRow.status.toString().toLowerCase().trim();
    } else if (existingPlayer) {
      status = existingPlayer.status; // Keep existing for updates
    }
    if (!['active', 'injured', 'inactive'].includes(status)) {
      errors.push('Status must be active, injured, or inactive');
    }

    const action = existingPlayer ? 'update' : 'add';
    const changes = [];

    // Track what will change for existing players
    if (existingPlayer) {
      if (existingPlayer.ntrpRating !== ntrp) {
        changes.push(`NTRP: ${formatNTRP(existingPlayer.ntrpRating)} → ${formatNTRP(ntrp)}`);
      }
      if (existingPlayer.dynamicRating !== dynamicRating) {
        changes.push(`Dynamic: ${formatDynamic(existingPlayer.dynamicRating)} → ${formatDynamic(dynamicRating)}`);
      }
      if (existingPlayer.gender !== gender) {
        changes.push(`Gender: ${existingPlayer.gender} → ${gender}`);
      }
      const newEmail = normalizedRow.email?.toString().trim() || '';
      if (newEmail && existingPlayer.email !== newEmail) {
        changes.push(`Email updated`);
      }
      const newPhone = normalizedRow.phone?.toString().trim() || '';
      if (newPhone && existingPlayer.phone !== newPhone) {
        changes.push(`Phone updated`);
      }
      if (existingPlayer.status !== status) {
        changes.push(`Status: ${existingPlayer.status} → ${status}`);
      }
    }

    return {
      rowIndex: index,
      firstName: firstName,
      lastName: lastName,
      gender: gender,
      ntrpRating: ntrp,
      dynamicRating: dynamicRating,
      email: normalizedRow.email?.toString().trim() || '',
      phone: normalizedRow.phone?.toString().trim() || '',
      status: status,
      errors: errors,
      isValid: errors.length === 0,
      action: action,
      existingPlayerId: existingPlayer?.id || null,
      changes: changes
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
      dynamicTyping: true, // Automatically convert numeric strings to numbers
      transformHeader: (header) => {
        // Normalize headers: trim whitespace and lowercase
        return header.trim().toLowerCase();
      },
      complete: (results) => {
        console.log('CSV Parsed:', results.data);
        const validated = results.data.map((row, index) => validatePlayer(row, index));
        setParsedPlayers(validated);
      },
      error: (error) => {
        alert('❌ Invalid CSV format.\n\n' + error.message + '\n\nPlease check your file format and try again.');
        setCsvFile(null);
      }
    });
  };

  const handleImportPlayers = () => {
    const validPlayers = parsedPlayers.filter(p => p.isValid);

    if (validPlayers.length === 0) {
      alert('⚠️ No valid players to import.\n\nPlease check your CSV file for errors.');
      return;
    }

    const playersToUpdate = validPlayers.filter(p => p.action === 'update');
    const playersToAdd = validPlayers.filter(p => p.action === 'add');

    console.log('=== Import Summary ===');
    console.log(`Players to update: ${playersToUpdate.length}`);
    console.log(`Players to add: ${playersToAdd.length}`);

    // Confirmation message
    const confirmMsg = `Import Summary:\n\n` +
      `${playersToUpdate.length} player(s) will be UPDATED\n` +
      `${playersToAdd.length} player(s) will be ADDED\n\n` +
      `Continue with import?`;

    if (!confirm(confirmMsg)) {
      return;
    }

    // Update existing players
    const updatedPlayers = players.map(existingPlayer => {
      const importData = playersToUpdate.find(p => p.existingPlayerId === existingPlayer.id);
      if (importData) {
        console.log(`Updating ${importData.firstName} ${importData.lastName}: NTRP ${existingPlayer.ntrpRating} → ${importData.ntrpRating}`);
        return {
          ...existingPlayer,
          gender: importData.gender,
          ntrpRating: importData.ntrpRating,
          dynamicRating: importData.dynamicRating,
          email: importData.email || existingPlayer.email,
          phone: importData.phone || existingPlayer.phone,
          status: importData.status
        };
      }
      return existingPlayer;
    });

    // Add new players
    const newPlayers = playersToAdd.map((p, index) => {
      console.log(`Adding ${p.firstName} ${p.lastName}: NTRP ${p.ntrpRating}`);
      return {
        id: Date.now() + index,
        teamId: null,
        firstName: p.firstName,
        lastName: p.lastName,
        gender: p.gender,
        ntrpRating: p.ntrpRating,
        dynamicRating: p.dynamicRating,
        email: p.email,
        phone: p.phone,
        status: p.status,
        isCaptain: false,
        captainUsername: '',
        captainPassword: '',
        captainEmail: '',
        captainPhone: ''
      };
    });

    setPlayers([...updatedPlayers, ...newPlayers]);

    console.log('=== Import Complete ===');
    alert(`✅ Import successful!\n\n${playersToUpdate.length} player(s) updated\n${playersToAdd.length} player(s) added\n\n⚠️ IMPORTANT: Click the "Save Data" button to save this to the database.`);

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

    alert('✅ All players have been deleted.\n\n⚠️ IMPORTANT: Click the "Save Data" button to save this to the database.');
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

            {/* Team Assignment Section (Directors Only) */}
            {editingPlayer && (
              <div className="col-span-2 border-t pt-4 mt-2">
                <label className="block text-sm font-semibold mb-1">
                  Team Assignment
                  {userRole !== 'director' && <span className="text-xs text-gray-500 ml-1">(Read-only)</span>}
                </label>
                {userRole === 'director' ? (
                  <select
                    value={playerFormData.teamId || ''}
                    onChange={(e) => {
                      const teamId = e.target.value ? parseInt(e.target.value) : null;
                      setPlayerFormData({...playerFormData, teamId});
                    }}
                    className="w-full px-3 py-2 border rounded"
                  >
                    <option value="">Unassigned</option>
                    {teams.map(t => {
                      const teamPlayers = players.filter(p => p.teamId === t.id);
                      const currentCount = teamPlayers.length;
                      // Adjust count if editing player is already on this team
                      const adjustedCount = editingPlayer && editingPlayer.teamId === t.id ? currentCount - 1 : currentCount;
                      return (
                        <option key={t.id} value={t.id}>
                          {t.name} ({adjustedCount}/14 players)
                        </option>
                      );
                    })}
                  </select>
                ) : (
                  <div className="w-full px-3 py-2 border rounded bg-gray-100 text-gray-700">
                    {playerFormData.teamId
                      ? teams.find(t => t.id === playerFormData.teamId)?.name || 'Unknown Team'
                      : 'Unassigned'
                    }
                  </div>
                )}
                {userRole === 'director' && (
                  <p className="text-xs text-gray-600 mt-1">
                    Directors can reassign players to different teams. Team capacity is 14 players maximum.
                  </p>
                )}
              </div>
            )}

            {/* Captain Promotion Section */}
            <div className="col-span-2 border-t pt-4 mt-2">
              <div className="flex items-center gap-2 mb-3">
                <input
                  type="checkbox"
                  id="isCaptain"
                  checked={playerFormData.isCaptain}
                  onChange={(e) => {
                    const isCaptain = e.target.checked;
                    const suggestedUsername = isCaptain && !playerFormData.captainUsername
                      ? generateSuggestedUsername(playerFormData.firstName, playerFormData.lastName)
                      : playerFormData.captainUsername;
                    setPlayerFormData({
                      ...playerFormData,
                      isCaptain,
                      captainUsername: suggestedUsername
                    });
                  }}
                  className="w-4 h-4"
                />
                <label htmlFor="isCaptain" className="text-sm font-bold text-purple-900">
                  ⭐ Make this player a team captain
                </label>
              </div>

              {playerFormData.isCaptain && (
                <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                  <p className="text-xs text-purple-800 mb-3">
                    This player will receive captain login credentials and can enter matches for their team.
                  </p>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-semibold mb-1">
                        Captain Username *
                      </label>
                      <input
                        type="text"
                        value={playerFormData.captainUsername}
                        onChange={(e) => setPlayerFormData({...playerFormData, captainUsername: e.target.value})}
                        className="w-full px-3 py-2 border rounded"
                        placeholder="e.g., jsmith"
                      />
                      <p className="text-xs text-gray-600 mt-1">
                        Used for captain login
                      </p>
                    </div>
                    <div>
                      <label className="block text-sm font-semibold mb-1">
                        Captain Password *
                      </label>
                      <input
                        type="password"
                        value={playerFormData.captainPassword}
                        onChange={(e) => setPlayerFormData({...playerFormData, captainPassword: e.target.value})}
                        className="w-full px-3 py-2 border rounded"
                        placeholder="Create password"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold mb-1">
                        Captain Email *
                      </label>
                      <input
                        type="email"
                        value={playerFormData.captainEmail}
                        onChange={(e) => setPlayerFormData({...playerFormData, captainEmail: e.target.value})}
                        className="w-full px-3 py-2 border rounded"
                        placeholder="captain@example.com"
                      />
                      <p className="text-xs text-gray-600 mt-1">
                        For match notifications
                      </p>
                    </div>
                    <div>
                      <label className="block text-sm font-semibold mb-1">
                        Captain Phone (Optional)
                      </label>
                      <input
                        type="tel"
                        value={playerFormData.captainPhone}
                        onChange={(e) => setPlayerFormData({...playerFormData, captainPhone: e.target.value})}
                        className="w-full px-3 py-2 border rounded"
                        placeholder="555-123-4567"
                      />
                    </div>
                  </div>
                </div>
              )}
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
              <div className="mb-3 flex gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-blue-100 border border-blue-300 rounded"></div>
                  <span>Will Update: {parsedPlayers.filter(p => p.action === 'update' && p.isValid).length}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-green-100 border border-green-300 rounded"></div>
                  <span>Will Add: {parsedPlayers.filter(p => p.action === 'add' && p.isValid).length}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-red-100 border border-red-300 rounded"></div>
                  <span>Invalid: {parsedPlayers.filter(p => !p.isValid).length}</span>
                </div>
              </div>
              <div className="overflow-x-auto max-h-96 border rounded">
                <table className="w-full text-sm">
                  <thead className="bg-gray-100 sticky top-0">
                    <tr>
                      <th className="p-2 text-left">Row</th>
                      <th className="p-2 text-left">Action</th>
                      <th className="p-2 text-left">First Name</th>
                      <th className="p-2 text-left">Last Name</th>
                      <th className="p-2 text-center">Gender</th>
                      <th className="p-2 text-center">NTRP</th>
                      <th className="p-2 text-center">Dynamic</th>
                      <th className="p-2 text-left">Changes</th>
                      <th className="p-2 text-left">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parsedPlayers.map((player, idx) => {
                      let rowColor = 'bg-white';
                      if (!player.isValid) {
                        rowColor = 'bg-red-50';
                      } else if (player.action === 'update') {
                        rowColor = 'bg-blue-50';
                      } else if (player.action === 'add') {
                        rowColor = 'bg-green-50';
                      }

                      return (
                        <tr key={idx} className={`border-b ${rowColor}`}>
                          <td className="p-2">{idx + 1}</td>
                          <td className="p-2">
                            <span className={`px-2 py-1 rounded text-xs font-semibold ${
                              player.action === 'update' ? 'bg-blue-200 text-blue-800' :
                              player.action === 'add' ? 'bg-green-200 text-green-800' : ''
                            }`}>
                              {player.action === 'update' ? 'UPDATE' : 'ADD'}
                            </span>
                          </td>
                          <td className="p-2">{player.firstName}</td>
                          <td className="p-2">{player.lastName}</td>
                          <td className="p-2 text-center">{player.gender}</td>
                          <td className="p-2 text-center">{formatNTRP(player.ntrpRating)}</td>
                          <td className="p-2 text-center">{formatDynamic(player.dynamicRating)}</td>
                          <td className="p-2">
                            {player.isValid ? (
                              player.action === 'update' && player.changes.length > 0 ? (
                                <div className="text-xs text-gray-700">
                                  {player.changes.slice(0, 2).map((change, i) => (
                                    <div key={i}>{change}</div>
                                  ))}
                                  {player.changes.length > 2 && (
                                    <div className="text-gray-500">+{player.changes.length - 2} more</div>
                                  )}
                                </div>
                              ) : player.action === 'update' ? (
                                <span className="text-xs text-gray-500 italic">No changes</span>
                              ) : (
                                <span className="text-xs text-green-700">New player</span>
                              )
                            ) : (
                              <span className="text-red-600 text-xs">
                                {player.errors.join(', ')}
                              </span>
                            )}
                          </td>
                          <td className="p-2">
                            <span className={`px-2 py-1 rounded text-xs ${
                              player.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                            }`}>
                              {player.status}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
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
              <SortableHeader column="firstName" align="left">Name</SortableHeader>
              <SortableHeader column="gender" align="center">Gender</SortableHeader>
              <SortableHeader column="ntrp" align="center">NTRP</SortableHeader>
              <SortableHeader column="dynamic" align="center">Dynamic</SortableHeader>
              <th className="text-center p-2">Captain</th>
              <th className="text-center p-2">Team</th>
              <th className="text-center p-2">Status</th>
              {isAuthenticated && <th className="text-center p-2">Actions</th>}
            </tr>
          </thead>
          <tbody>
            {getSortedPlayers().map(player => {
              const team = teams.find(t => t.id === player.teamId);
              const isCaptain = player.isCaptain || captains.some(c => c.playerId === player.id);
              return (
                <tr key={player.id} className="border-b hover:bg-gray-50">
                  <td className="p-2">{player.firstName} {player.lastName}</td>
                  <td className="text-center p-2">{player.gender}</td>
                  <td className="text-center p-2">{formatNTRP(player.ntrpRating)}</td>
                  <td className="text-center p-2">
                    {player.dynamicRating ? (
                      <span className="font-semibold text-blue-600">{formatDynamic(player.dynamicRating)}</span>
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </td>
                  <td className="text-center p-2">
                    {isCaptain ? (
                      <span className="text-purple-600 font-semibold" title="Team Captain">⭐</span>
                    ) : (
                      <span className="text-gray-300">-</span>
                    )}
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