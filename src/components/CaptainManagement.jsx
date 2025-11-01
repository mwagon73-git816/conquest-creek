import React, { useState } from 'react';
import { Users, Plus, Edit, Trash2, Check, X, Eye, EyeOff } from 'lucide-react';

const CaptainManagement = ({ captains, setCaptains, teams, setTeams, isAuthenticated }) => {
  const [showForm, setShowForm] = useState(false);
  const [editingCaptain, setEditingCaptain] = useState(null);
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    name: '',
    email: '',
    phone: '',
    teamId: '',
    status: 'active'
  });
  const [showPassword, setShowPassword] = useState(false);
  const [newCaptainCredentials, setNewCaptainCredentials] = useState(null);

  const handleAddNew = () => {
    setShowForm(true);
    setEditingCaptain(null);
    setFormData({
      username: '',
      password: '',
      name: '',
      email: '',
      phone: '',
      teamId: '',
      status: 'active'
    });
    setNewCaptainCredentials(null);
  };

  const handleEdit = (captain) => {
    setShowForm(true);
    setEditingCaptain(captain);
    setFormData({
      username: captain.username,
      password: captain.password,
      name: captain.name,
      email: captain.email || '',
      phone: captain.phone || '',
      teamId: captain.teamId,
      status: captain.status
    });
    setNewCaptainCredentials(null);
  };

  const validateEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const formatPhoneNumber = (value) => {
    // Remove all non-digits
    const cleaned = value.replace(/\D/g, '');

    // Format as (XXX) XXX-XXXX
    if (cleaned.length <= 3) {
      return cleaned;
    } else if (cleaned.length <= 6) {
      return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3)}`;
    } else {
      return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6, 10)}`;
    }
  };

  const handlePhoneChange = (value) => {
    const formatted = formatPhoneNumber(value);
    setFormData({ ...formData, phone: formatted });
  };

  const handleSave = () => {
    // Validation
    if (!formData.username.trim()) {
      alert('Username is required');
      return;
    }
    if (!formData.password.trim()) {
      alert('Password is required');
      return;
    }
    if (!formData.name.trim()) {
      alert('Full name is required');
      return;
    }
    if (!formData.email.trim()) {
      alert('Email address is required');
      return;
    }
    if (!validateEmail(formData.email)) {
      alert('Please enter a valid email address');
      return;
    }

    // Check for duplicate username (except when editing same captain)
    const duplicateUsername = captains.find(c =>
      c.username === formData.username &&
      (!editingCaptain || c.id !== editingCaptain.id)
    );
    if (duplicateUsername) {
      alert('Username already exists. Please choose a different username.');
      return;
    }

    const selectedTeamId = formData.teamId ? parseInt(formData.teamId) : null;

    // Check if team already has a captain (except when editing same captain)
    if (selectedTeamId) {
      const teamHasCaptain = captains.find(c =>
        c.teamId === selectedTeamId &&
        c.status === 'active' &&
        (!editingCaptain || c.id !== editingCaptain.id)
      );
      if (teamHasCaptain) {
        const team = teams.find(t => t.id === selectedTeamId);
        if (!confirm(`Warning: Team "${team?.name}" already has an active captain: ${teamHasCaptain.name}. Assigning this captain to the team will unassign "${teamHasCaptain.name}". Continue?`)) {
          return;
        }
      }

      // Check if team already has a captain assigned via team's captainId
      const team = teams.find(t => t.id === selectedTeamId);
      if (team && team.captainId && team.captainId !== editingCaptain?.id) {
        const existingCaptain = captains.find(c => c.id === team.captainId);
        if (existingCaptain && !confirm(`Warning: Team "${team.name}" already has captain "${existingCaptain.name}" assigned. Assigning this captain will replace them. Continue?`)) {
          return;
        }
      }
    }

    // Synchronization logic
    const oldTeamId = editingCaptain?.teamId || null;

    if (editingCaptain) {
      // Update existing captain
      const updatedCaptain = { ...editingCaptain, ...formData, teamId: selectedTeamId };
      setCaptains(captains.map(c =>
        c.id === editingCaptain.id ? updatedCaptain : c
      ));

      // Synchronize team assignments
      if (oldTeamId !== selectedTeamId) {
        // Unassign from old team
        if (oldTeamId) {
          setTeams(teams.map(t =>
            t.id === oldTeamId ? { ...t, captainId: null } : t
          ));
        }

        // Assign to new team
        if (selectedTeamId) {
          setTeams(teams.map(t => {
            if (t.id === selectedTeamId) {
              // If team had another captain, unassign them first
              if (t.captainId && t.captainId !== editingCaptain.id) {
                setCaptains(captains.map(c =>
                  c.id === t.captainId ? { ...c, teamId: null } : c
                ));
              }
              return { ...t, captainId: editingCaptain.id };
            }
            return t;
          }));
        }
      }

      setShowForm(false);
      setEditingCaptain(null);
    } else {
      // Add new captain
      const newCaptain = {
        id: Date.now(),
        username: formData.username,
        password: formData.password,
        name: formData.name,
        email: formData.email,
        phone: formData.phone,
        teamId: selectedTeamId,
        status: formData.status
      };
      setCaptains([...captains, newCaptain]);

      // Assign to team if selected
      if (selectedTeamId) {
        setTeams(teams.map(t => {
          if (t.id === selectedTeamId) {
            // If team had another captain, unassign them first
            if (t.captainId) {
              setCaptains(captains.map(c =>
                c.id === t.captainId ? { ...c, teamId: null } : c
              ));
            }
            return { ...t, captainId: newCaptain.id };
          }
          return t;
        }));
      }

      // Show credentials after creation
      setNewCaptainCredentials({
        username: formData.username,
        password: formData.password,
        name: formData.name,
        email: formData.email
      });

      // Clear form but keep it open to show credentials
      setFormData({
        username: '',
        password: '',
        name: '',
        email: '',
        phone: '',
        teamId: '',
        status: 'active'
      });
    }
  };

  const handleDelete = (captainId) => {
    const captain = captains.find(c => c.id === captainId);
    if (confirm(`Delete captain "${captain?.name}"? This will remove their login access.`)) {
      // Remove captain assignment from their team
      if (captain?.teamId) {
        setTeams(teams.map(t =>
          t.id === captain.teamId ? { ...t, captainId: null } : t
        ));
      }
      setCaptains(captains.filter(c => c.id !== captainId));
    }
  };

  const handleCancel = () => {
    setShowForm(false);
    setEditingCaptain(null);
    setNewCaptainCredentials(null);
  };

  const getTeamName = (teamId) => {
    const team = teams.find(t => t.id === teamId);
    return team ? team.name : 'Unknown Team';
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <Users className="w-6 h-6" />
          Captain Management
        </h2>
        {isAuthenticated && !showForm && (
          <button
            onClick={handleAddNew}
            className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Add Captain
          </button>
        )}
      </div>

      {!isAuthenticated && (
        <div className="bg-yellow-50 border border-yellow-200 rounded p-4">
          <p className="text-sm text-yellow-800">Directors must login to manage captains.</p>
        </div>
      )}

      {isAuthenticated && showForm && (
        <div className="bg-blue-50 border-2 border-blue-300 rounded-lg p-6 mb-6">
          <h3 className="text-xl font-bold mb-4">
            {editingCaptain ? 'Edit Captain' : 'Add New Captain'}
          </h3>

          {/* Show new captain credentials */}
          {newCaptainCredentials && (
            <div className="mb-6 p-4 bg-green-100 border-2 border-green-400 rounded-lg">
              <h4 className="font-bold text-green-800 mb-2 flex items-center gap-2">
                <Check className="w-5 h-5" />
                Captain Created Successfully!
              </h4>
              <div className="text-sm text-green-900 space-y-1">
                <p><strong>Name:</strong> {newCaptainCredentials.name}</p>
                <p><strong>Email:</strong> {newCaptainCredentials.email}</p>
                <p><strong>Username:</strong> {newCaptainCredentials.username}</p>
                <p><strong>Password:</strong> {newCaptainCredentials.password}</p>
                <p className="text-xs text-green-700 mt-2 italic">
                  Please save these credentials and email address. The captain will need them to log in.
                </p>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold mb-1">Username *</label>
              <input
                type="text"
                value={formData.username}
                onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                className="w-full px-3 py-2 border rounded"
                placeholder="e.g., CAPT1, CAPT2"
                disabled={!!editingCaptain}
              />
              <p className="text-xs text-gray-600 mt-1">
                {editingCaptain ? 'Username cannot be changed' : 'Used for captain login'}
              </p>
            </div>

            <div>
              <label className="block text-sm font-semibold mb-1">Password *</label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="w-full px-3 py-2 border rounded pr-10"
                  placeholder="Enter password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2 top-2 text-gray-600 hover:text-gray-800"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold mb-1">Full Name *</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3 py-2 border rounded"
                placeholder="Captain's full name"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold mb-1">Email Address *</label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full px-3 py-2 border rounded"
                placeholder="captain@example.com"
              />
              <p className="text-xs text-gray-600 mt-1">
                Used for match notifications
              </p>
            </div>

            <div>
              <label className="block text-sm font-semibold mb-1">Cell Phone (Optional)</label>
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => handlePhoneChange(e.target.value)}
                className="w-full px-3 py-2 border rounded"
                placeholder="(XXX) XXX-XXXX"
                maxLength="14"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold mb-1">Assigned Team (Optional)</label>
              <select
                value={formData.teamId || ''}
                onChange={(e) => setFormData({ ...formData, teamId: e.target.value || null })}
                className="w-full px-3 py-2 border rounded"
              >
                <option value="">No Team</option>
                {teams.map(team => (
                  <option key={team.id} value={team.id}>{team.name}</option>
                ))}
              </select>
              <p className="text-xs text-gray-600 mt-1">
                Captain can be assigned to a team later
              </p>
            </div>

            <div>
              <label className="block text-sm font-semibold mb-1">Status</label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                className="w-full px-3 py-2 border rounded"
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
          </div>

          <div className="flex gap-2 mt-6">
            <button
              onClick={handleSave}
              className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700 flex items-center gap-2"
            >
              <Check className="w-4 h-4" />
              {editingCaptain ? 'Update Captain' : 'Save Captain'}
            </button>
            <button
              onClick={handleCancel}
              className="bg-gray-300 text-gray-700 px-6 py-2 rounded hover:bg-gray-400 flex items-center gap-2"
            >
              <X className="w-4 h-4" />
              {newCaptainCredentials ? 'Close' : 'Cancel'}
            </button>
          </div>
        </div>
      )}

      {/* Captains List */}
      <div className="space-y-3">
        {captains.length === 0 ? (
          <p className="text-gray-500 text-center py-8">No captains created yet</p>
        ) : (
          captains.map(captain => {
            const team = teams.find(t => t.id === captain.teamId);
            return (
              <div
                key={captain.id}
                className={`border rounded p-4 ${captain.status === 'inactive' ? 'bg-gray-100' : 'hover:bg-gray-50'}`}
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="font-bold text-lg">{captain.name}</h3>
                      {captain.status === 'inactive' && (
                        <span className="px-2 py-1 bg-gray-300 text-gray-700 text-xs rounded">
                          Inactive
                        </span>
                      )}
                      {captain.status === 'active' && (
                        <span className="px-2 py-1 bg-green-100 text-green-700 text-xs rounded">
                          Active
                        </span>
                      )}
                    </div>
                    <div className="text-sm text-gray-600 space-y-1">
                      <p><strong>Username:</strong> {captain.username}</p>
                      <p><strong>Team:</strong> <span className={!captain.teamId ? 'text-gray-400 italic' : ''}>{team ? team.name : 'Unassigned'}</span></p>
                      {captain.email && (
                        <p><strong>Email:</strong> {captain.email}</p>
                      )}
                      {captain.phone && (
                        <p><strong>Phone:</strong> {captain.phone}</p>
                      )}
                    </div>
                  </div>
                  {isAuthenticated && (
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleEdit(captain)}
                        className="text-blue-600 hover:text-blue-800 p-2"
                        title="Edit captain"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(captain.id)}
                        className="text-red-600 hover:text-red-800 p-2"
                        title="Delete captain"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default CaptainManagement;
