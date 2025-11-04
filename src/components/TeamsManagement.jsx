import React, { useState } from 'react';
import { Users, Plus, Trash2, X, Award, Edit, Check, Upload, Image as ImageIcon } from 'lucide-react';
import { ACTION_TYPES } from '../services/activityLogger';
import { formatNTRP, formatDynamic } from '../utils/formatters';
import TeamLogo from './TeamLogo';
import LogoPreviewModal from './LogoPreviewModal';

const TeamsManagement = ({
  teams,
  setTeams,
  players,
  setPlayers,
  captains,
  setCaptains,
  isAuthenticated,
  calculateTeamRatings,
  getEffectiveRating,
  addLog
}) => {
  const [showTeamForm, setShowTeamForm] = useState(false);
  const [editingTeam, setEditingTeam] = useState(null);
  const [previewLogo, setPreviewLogo] = useState(null);
  const [teamFormData, setTeamFormData] = useState({
    name: '',
    captainId: null,
    color: '#3B82F6',
    logo: null,
    logoUploadedAt: null,
    uniformType: 'none',
    uniformPhotoSubmitted: false,
    practices: {
      '2025-11': 0,
      '2025-12': 0,
      '2026-01': 0
    }
  });
  const [logoPreview, setLogoPreview] = useState(null);

  const handleAddNewTeam = () => {
    setShowTeamForm(true);
    setEditingTeam(null);
    setTeamFormData({
      name: '',
      captainId: null,
      color: '#3B82F6',
      logo: null,
      logoUploadedAt: null,
      uniformType: 'none',
      uniformPhotoSubmitted: false,
      practices: {
        '2025-11': 0,
        '2025-12': 0,
        '2026-01': 0
      }
    });
    setLogoPreview(null);
  };

  const handleEditTeam = (team) => {
    setEditingTeam(team);
    setTeamFormData({
      name: team.name,
      captainId: team.captainId || null,
      color: team.color,
      logo: team.logo || null,
      logoUploadedAt: team.logoUploadedAt || null,
      uniformType: team.bonuses?.uniformType || 'none',
      uniformPhotoSubmitted: team.bonuses?.uniformPhotoSubmitted || false,
      practices: team.bonuses?.practices || {
        '2025-11': 0,
        '2025-12': 0,
        '2026-01': 0
      }
    });
    setLogoPreview(team.logo || null);
    setShowTeamForm(true);
  };

  const handleLogoUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validation
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/svg+xml'];
    if (!validTypes.includes(file.type)) {
      alert('Please upload a valid image file (PNG, JPG, JPEG, or SVG)');
      return;
    }

    const maxSize = 2 * 1024 * 1024; // 2MB
    if (file.size > maxSize) {
      alert('File size must be less than 2MB');
      return;
    }

    // Read file as base64
    const reader = new FileReader();
    reader.onload = async (e) => {
      const imageData = e.target.result;

      // For SVG, store as-is
      if (file.type === 'image/svg+xml') {
        setTeamFormData({
          ...teamFormData,
          logo: imageData,
          logoUploadedAt: new Date().toISOString()
        });
        setLogoPreview(imageData);
        return;
      }

      // For raster images, compress similar to MediaGallery
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        // Max dimensions for logo (smaller than match photos)
        const maxWidth = 800;
        const maxHeight = 800;

        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        canvas.width = width;
        canvas.height = height;
        ctx.drawImage(img, 0, 0, width, height);

        // Compress to target size (100-300 KB for logos)
        let quality = 0.9;
        let compressedData = canvas.toDataURL('image/jpeg', quality);

        while (compressedData.length > 300 * 1024 && quality > 0.5) {
          quality -= 0.1;
          compressedData = canvas.toDataURL('image/jpeg', quality);
        }

        setTeamFormData({
          ...teamFormData,
          logo: compressedData,
          logoUploadedAt: new Date().toISOString()
        });
        setLogoPreview(compressedData);
      };

      img.src = imageData;
    };

    reader.readAsDataURL(file);
  };

  const handleRemoveLogo = () => {
    if (confirm('Remove team logo? The team will revert to showing the color background.')) {
      setTeamFormData({
        ...teamFormData,
        logo: null,
        logoUploadedAt: null
      });
      setLogoPreview(null);
    }
  };

  const handleSaveTeam = () => {
    if (!teamFormData.name) {
      alert('Team name is required');
      return;
    }

    const selectedCaptainId = teamFormData.captainId ? parseInt(teamFormData.captainId) : null;

    // Validation: Check if selected captain is already assigned to another team
    if (selectedCaptainId) {
      const captainAlreadyAssigned = captains.find(c =>
        c.id === selectedCaptainId &&
        c.teamId !== null &&
        (!editingTeam || c.teamId !== editingTeam.id)
      );

      if (captainAlreadyAssigned) {
        const otherTeam = teams.find(t => t.id === captainAlreadyAssigned.teamId);
        if (!confirm(`Warning: Captain "${captains.find(c => c.id === selectedCaptainId)?.name}" is already assigned to team "${otherTeam?.name}". Assigning them to this team will remove them from "${otherTeam?.name}". Continue?`)) {
          return;
        }
      }
    }

    const teamData = {
      name: teamFormData.name.trim(),
      captainId: selectedCaptainId,
      color: teamFormData.color,
      logo: teamFormData.logo || null,
      logoUploadedAt: teamFormData.logoUploadedAt || null,
      bonuses: {
        uniformType: teamFormData.uniformType,
        uniformPhotoSubmitted: teamFormData.uniformPhotoSubmitted,
        practices: teamFormData.practices
      }
    };

    // Synchronization logic for captain assignments
    const oldCaptainId = editingTeam?.captainId || null;

    // If captain changed, update captain records
    if (oldCaptainId !== selectedCaptainId) {
      // Unassign old captain
      if (oldCaptainId) {
        setCaptains(captains.map(c =>
          c.id === oldCaptainId ? { ...c, teamId: null } : c
        ));
      }

      // Assign new captain
      if (selectedCaptainId) {
        setCaptains(captains.map(c => {
          if (c.id === selectedCaptainId) {
            return { ...c, teamId: editingTeam ? editingTeam.id : null }; // Will be updated below
          }
          return c;
        }));
      }
    }

    if (editingTeam) {
      const before = { ...editingTeam };
      const updatedTeam = { ...editingTeam, ...teamData };
      const after = updatedTeam;

      setTeams(teams.map(t =>
        t.id === editingTeam.id
          ? updatedTeam
          : t
      ));

      // Update new captain's teamId to this team
      if (selectedCaptainId) {
        setCaptains(captains.map(c =>
          c.id === selectedCaptainId ? { ...c, teamId: editingTeam.id } : c
        ));
      }

      // Log the edit
      addLog(
        ACTION_TYPES.TEAM_EDITED,
        { teamName: teamData.name, teamId: editingTeam.id },
        editingTeam.id,
        before,
        after
      );
    } else {
      const newTeam = {
        id: Date.now(),
        ...teamData
      };

      setTeams([...teams, newTeam]);

      // Update captain's teamId to new team
      if (selectedCaptainId) {
        setCaptains(captains.map(c =>
          c.id === selectedCaptainId ? { ...c, teamId: newTeam.id } : c
        ));
      }

      // Log the add
      addLog(
        ACTION_TYPES.TEAM_ADDED,
        { teamName: teamData.name, teamId: newTeam.id },
        newTeam.id,
        null,
        newTeam
      );
    }

    setShowTeamForm(false);
    setEditingTeam(null);
  };

  const handleDeleteTeam = (teamId) => {
    const team = teams.find(t => t.id === teamId);
    if (confirm('Delete this team?')) {
      // Unassign all players
      setPlayers(players.map(p => p.teamId === teamId ? {...p, teamId: null} : p));

      // Unassign captain (set their teamId to null, don't delete captain)
      setCaptains(captains.map(c => c.teamId === teamId ? {...c, teamId: null} : c));

      setTeams(teams.filter(t => t.id !== teamId));

      // Log the deletion
      if (team) {
        addLog(
          ACTION_TYPES.TEAM_DELETED,
          { teamName: team.name, teamId },
          teamId,
          team,
          null
        );
      }
    }
  };

  const handleRemovePlayer = (playerId) => {
    const player = players.find(p => p.id === playerId);
    const team = player ? teams.find(t => t.id === player.teamId) : null;

    if (confirm('Remove player from team?')) {
      setPlayers(players.map(p => p.id === playerId ? {...p, teamId: null} : p));

      // Log the removal
      if (player && team) {
        const playerName = `${player.firstName} ${player.lastName}`;
        addLog(
          ACTION_TYPES.TEAM_PLAYER_REMOVED,
          { playerName, teamName: team.name },
          playerId,
          { ...player },
          { ...player, teamId: null }
        );
      }
    }
  };

  const updatePracticeCount = (month, count) => {
    setTeamFormData({
      ...teamFormData,
      practices: {
        ...teamFormData.practices,
        [month]: parseInt(count) || 0
      }
    });
  };

  const getUniformBonus = (uniformType, photoSubmitted) => {
    if (!photoSubmitted) return 0;
    if (uniformType === 'colors') return 2;
    if (uniformType === 'tops-bottoms') return 4;
    if (uniformType === 'custom') return 6;
    return 0;
  };

  const getPracticeBonus = (practices) => {
    let total = 0;
    Object.values(practices || {}).forEach(count => {
      total += Math.min(count * 0.5, 2); // Max 2 points per month
    });
    return total;
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <Users className="w-6 h-6" />
          Teams Management
        </h2>
        {isAuthenticated && !showTeamForm && (
          <button 
            onClick={handleAddNewTeam} 
            className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Add Team
          </button>
        )}
      </div>

      {showTeamForm && (
        <div className="bg-blue-50 border-2 border-blue-300 rounded-lg p-6 mb-6">
          <h3 className="text-xl font-bold mb-4">
            {editingTeam ? 'Edit Team' : 'Add New Team'}
          </h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold mb-1">Team Name *</label>
              <input
                type="text"
                value={teamFormData.name}
                onChange={(e) => setTeamFormData({...teamFormData, name: e.target.value})}
                className="w-full px-3 py-2 border rounded"
                placeholder="Team Warriors"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold mb-1">Assign Captain (Optional)</label>
              <select
                value={teamFormData.captainId || ''}
                onChange={(e) => setTeamFormData({...teamFormData, captainId: e.target.value || null})}
                className="w-full px-3 py-2 border rounded"
              >
                <option value="">No Captain</option>
                {captains
                  .filter(c => c.status === 'active' && (c.teamId === null || c.teamId === editingTeam?.id))
                  .map(captain => {
                    const linkedPlayer = players.find(p => p.id === captain.playerId);
                    return (
                      <option key={captain.id} value={captain.id}>
                        {captain.name} ({captain.username}){linkedPlayer ? ' - Player' : ''}
                      </option>
                    );
                  })
                }
              </select>
              <p className="text-xs text-gray-600 mt-1">
                Available captains (not assigned to other teams)
              </p>
            </div>
            <div>
              <label className="block text-sm font-semibold mb-1">Team Color</label>
              <div className="flex gap-2 items-center">
                <input
                  type="color"
                  value={teamFormData.color}
                  onChange={(e) => setTeamFormData({...teamFormData, color: e.target.value})}
                  className="w-16 h-10 border rounded cursor-pointer"
                />
                <span className="text-sm text-gray-600">{teamFormData.color}</span>
              </div>
              <p className="text-xs text-gray-500 mt-1">Used when no logo is uploaded</p>
            </div>

            <div className="col-span-2">
              <label className="block text-sm font-semibold mb-2">Team Logo</label>
              <div className="flex gap-4 items-start">
                {logoPreview ? (
                  <div className="flex items-center gap-4">
                    <div className="w-24 h-24 border-2 border-gray-300 rounded flex items-center justify-center overflow-hidden bg-white">
                      <img
                        src={logoPreview}
                        alt="Team logo preview"
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="flex flex-col gap-2">
                      <label className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 cursor-pointer flex items-center gap-2 text-sm">
                        <Upload className="w-4 h-4" />
                        Replace Logo
                        <input
                          type="file"
                          accept="image/png,image/jpeg,image/jpg,image/svg+xml"
                          onChange={handleLogoUpload}
                          className="hidden"
                        />
                      </label>
                      <button
                        type="button"
                        onClick={handleRemoveLogo}
                        className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 flex items-center gap-2 text-sm"
                      >
                        <X className="w-4 h-4" />
                        Remove Logo
                      </button>
                    </div>
                  </div>
                ) : (
                  <label className="border-2 border-dashed border-gray-300 rounded-lg p-6 cursor-pointer hover:border-blue-500 hover:bg-blue-50 transition-colors flex flex-col items-center gap-2">
                    <ImageIcon className="w-8 h-8 text-gray-400" />
                    <span className="text-sm font-semibold text-gray-700">Upload Team Logo</span>
                    <span className="text-xs text-gray-500">PNG, JPG, JPEG, or SVG (max 2MB)</span>
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/jpg,image/svg+xml"
                      onChange={handleLogoUpload}
                      className="hidden"
                    />
                  </label>
                )}
              </div>
              <p className="text-xs text-gray-500 mt-2">
                Optional: Upload a custom logo for your team. If no logo is uploaded, the team color will be displayed.
              </p>
            </div>

            <div className="col-span-2 border-t pt-4 mt-2">
              <h4 className="font-semibold text-purple-900 mb-3 flex items-center gap-2">
                <Award className="w-5 h-5" />
                Team Spirit Bonuses
              </h4>
            </div>

            <div>
              <label className="block text-sm font-semibold mb-1">Uniform Type</label>
              <select
                value={teamFormData.uniformType}
                onChange={(e) => setTeamFormData({...teamFormData, uniformType: e.target.value})}
                className="w-full px-3 py-2 border rounded"
              >
                <option value="none">No Uniform</option>
                <option value="colors">Matching Colors (+2 pts)</option>
                <option value="tops-bottoms">Matching Tops & Bottoms (+4 pts)</option>
                <option value="custom">Custom w/ Logo (+6 pts)</option>
              </select>
            </div>

            <div className="flex items-center">
              <div className="flex items-center gap-2 mt-6">
                <input
                  type="checkbox"
                  id="uniform-photo"
                  checked={teamFormData.uniformPhotoSubmitted}
                  onChange={(e) => setTeamFormData({...teamFormData, uniformPhotoSubmitted: e.target.checked})}
                  className="w-4 h-4"
                />
                <label htmlFor="uniform-photo" className="text-sm">
                  Photo submitted by 11/16/25
                </label>
              </div>
            </div>

            <div className="col-span-2">
              <label className="block text-sm font-semibold mb-2">Team Practices (hours per month)</label>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs text-gray-600 mb-1">November 2025</label>
                  <input
                    type="number"
                    min="0"
                    max="4"
                    value={teamFormData.practices['2025-11'] || 0}
                    onChange={(e) => updatePracticeCount('2025-11', e.target.value)}
                    className="w-full px-3 py-2 border rounded"
                    placeholder="0"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">December 2025</label>
                  <input
                    type="number"
                    min="0"
                    max="4"
                    value={teamFormData.practices['2025-12'] || 0}
                    onChange={(e) => updatePracticeCount('2025-12', e.target.value)}
                    className="w-full px-3 py-2 border rounded"
                    placeholder="0"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">January 2026</label>
                  <input
                    type="number"
                    min="0"
                    max="4"
                    value={teamFormData.practices['2026-01'] || 0}
                    onChange={(e) => updatePracticeCount('2026-01', e.target.value)}
                    className="w-full px-3 py-2 border rounded"
                    placeholder="0"
                  />
                </div>
              </div>
              <p className="text-xs text-gray-500 mt-2">+0.5 pts per hour, max 2 pts per month</p>
            </div>
          </div>

          <div className="flex gap-2 mt-6">
            <button
              onClick={handleSaveTeam}
              className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700 flex items-center gap-2"
            >
              <Check className="w-4 h-4" />
              {editingTeam ? 'Update Team' : 'Save Team'}
            </button>
            <button
              onClick={() => {
                setShowTeamForm(false);
                setEditingTeam(null);
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
          <p className="text-sm text-yellow-800">View-only mode. Directors can login to manage teams.</p>
        </div>
      )}

      <div className="space-y-3">
        {teams.map(team => {
          const ratings = calculateTeamRatings(team.id);
          const teamPlayers = players.filter(p => p.teamId === team.id);
          const bonuses = team.bonuses || { uniformType: 'none', uniformPhotoSubmitted: false, practices: {} };
          const uniformBonus = getUniformBonus(bonuses.uniformType, bonuses.uniformPhotoSubmitted);
          const practiceBonus = getPracticeBonus(bonuses.practices);

          // Find captain assigned to this team (search by both team.captainId and captain.teamId)
          const assignedCaptain = captains.find(c => c.id === team.captainId || c.teamId === team.id);

          return (
            <div key={team.id} className="border rounded p-4">
              <div className="flex justify-between items-start mb-3">
                <div className="flex items-center gap-3">
                  <TeamLogo
                    team={team}
                    size="md"
                    showBorder={!!team.logo}
                    clickable={!!team.logo}
                    onClick={() => team.logo && setPreviewLogo({ url: team.logo, teamName: team.name })}
                  />
                  <div>
                    <div className="font-bold text-lg">{team.name}</div>
                    <div className="text-sm text-gray-600">
                      Captain: {assignedCaptain ? (
                        <span className="font-semibold text-purple-700">
                          {assignedCaptain.name}
                        </span>
                      ) : (
                        <span className="text-gray-400 italic">Not Assigned</span>
                      )}
                    </div>
                  </div>
                </div>
                {isAuthenticated && (
                  <div className="flex gap-2">
                    <button 
                      onClick={() => handleEditTeam(team)}
                      className="text-blue-600 hover:text-blue-800 p-2"
                      title="Edit team"
                    >
                      <Edit className="w-5 h-5" />
                    </button>
                    <button 
                      onClick={() => handleDeleteTeam(team.id)} 
                      className="text-red-600 hover:text-red-800 p-2"
                      title="Delete team"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                )}
              </div>
              
              <div className="grid grid-cols-4 gap-3 text-sm bg-gray-50 p-3 rounded mb-3">
                <div>
                  <div className="text-gray-600">Players</div>
                  <div className="font-bold">{teamPlayers.length}/9</div>
                </div>
                <div>
                  <div className="text-gray-600">Men</div>
                  <div className="font-bold">{ratings.menCount} ({formatNTRP(ratings.menRating)})</div>
                </div>
                <div>
                  <div className="text-gray-600">Women</div>
                  <div className="font-bold">{ratings.womenCount} ({formatNTRP(ratings.womenRating)})</div>
                </div>
                <div>
                  <div className="text-gray-600">Total Rating</div>
                  <div className="font-bold text-gray-700">
                    {formatNTRP(ratings.totalRating)}
                  </div>
                </div>
              </div>

              {/* Bonus Points Section */}
              <div className="bg-purple-50 border border-purple-200 rounded p-3 mb-3">
                <h4 className="font-semibold text-purple-900 flex items-center gap-2 mb-2">
                  <Award className="w-4 h-4" />
                  Team Spirit Bonuses
                </h4>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-gray-600">Uniform:</span>
                    <span className="ml-2 font-semibold text-purple-700">
                      {uniformBonus > 0 ? `+${uniformBonus} pts` : 'Not submitted'}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-600">Practice:</span>
                    <span className="ml-2 font-semibold text-purple-700">
                      +{formatNTRP(practiceBonus)} pts
                    </span>
                  </div>
                </div>
              </div>

              {teamPlayers.length > 0 && (
                <div className="mt-3">
                  <div className="text-xs font-semibold text-gray-600 mb-2">Roster:</div>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    {teamPlayers.map(player => {
                      const effectiveRating = getEffectiveRating(player);
                      const displayRating = player.dynamicRating ? formatDynamic(effectiveRating) : formatNTRP(effectiveRating);
                      return (
                        <div key={player.id} className="text-gray-700 flex items-center justify-between">
                          <span>{player.firstName} {player.lastName} ({player.gender} {displayRating})</span>
                        {isAuthenticated && (
                          <button 
                            onClick={() => handleRemovePlayer(player.id)}
                            className="text-red-600 hover:text-red-800 ml-2"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
      {teams.length === 0 && <p className="text-center text-gray-500 py-8">No teams created yet</p>}

      {/* Logo Preview Modal */}
      <LogoPreviewModal
        isOpen={!!previewLogo}
        onClose={() => setPreviewLogo(null)}
        logoUrl={previewLogo?.url}
        teamName={previewLogo?.teamName}
      />
    </div>
  );
};

export default TeamsManagement;