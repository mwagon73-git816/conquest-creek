import React, { useState } from 'react';
import { Calendar, Plus, Check, X, Upload, Image as ImageIcon } from 'lucide-react';

const MatchEntry = ({ teams, matches, setMatches, isAuthenticated, setActiveTab, players, captains, onAddPhoto, loginName, userRole, userTeamId }) => {
  const [showMatchForm, setShowMatchForm] = useState(false);
  const [editingMatch, setEditingMatch] = useState(null);
  const [matchFormData, setMatchFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    level: '7.0',
    team1Id: '',
    team2Id: '',
    set1Team1: '',
    set1Team2: '',
    set2Team1: '',
    set2Team2: '',
    set3Team1: '',
    set3Team2: '',
    set3IsTiebreaker: false,
    team1Players: [],
    team2Players: [],
    notes: ''
  });
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);

  // Calculate match results from set scores
  const calculateMatchResults = () => {
    const { set1Team1, set1Team2, set2Team1, set2Team2, set3Team1, set3Team2, set3IsTiebreaker } = matchFormData;

    // Convert to numbers
    const s1t1 = parseInt(set1Team1) || 0;
    const s1t2 = parseInt(set1Team2) || 0;
    const s2t1 = parseInt(set2Team1) || 0;
    const s2t2 = parseInt(set2Team2) || 0;
    const s3t1 = parseInt(set3Team1) || 0;
    const s3t2 = parseInt(set3Team2) || 0;

    // Determine set winners
    const set1Winner = s1t1 > s1t2 ? 1 : (s1t2 > s1t1 ? 2 : 0);
    const set2Winner = s2t1 > s2t2 ? 1 : (s2t2 > s2t1 ? 2 : 0);
    const set3Winner = s3t1 > s3t2 ? 1 : (s3t2 > s3t1 ? 2 : 0);

    // Count sets won
    let team1Sets = 0;
    let team2Sets = 0;
    if (set1Winner === 1) team1Sets++;
    if (set1Winner === 2) team2Sets++;
    if (set2Winner === 1) team1Sets++;
    if (set2Winner === 2) team2Sets++;
    if (set3Winner === 1) team1Sets++;
    if (set3Winner === 2) team2Sets++;

    // Calculate games won
    let team1Games = s1t1 + s2t1;
    let team2Games = s1t2 + s2t2;

    // Add set 3 games
    if (set3Team1 !== '' && set3Team2 !== '') {
      if (set3IsTiebreaker) {
        // 10-point tiebreaker: winner gets 1 game, loser gets 0
        if (set3Winner === 1) {
          team1Games += 1;
        } else if (set3Winner === 2) {
          team2Games += 1;
        }
      } else {
        // Regular set: count actual games
        team1Games += s3t1;
        team2Games += s3t2;
      }
    }

    // Determine match winner
    let winner = '';
    if (team1Sets > team2Sets) {
      winner = 'team1';
    } else if (team2Sets > team1Sets) {
      winner = 'team2';
    }

    return {
      winner,
      team1Sets: team1Sets.toString(),
      team2Sets: team2Sets.toString(),
      team1Games: team1Games.toString(),
      team2Games: team2Games.toString(),
      isValid: set1Winner !== 0 && set2Winner !== 0 && winner !== ''
    };
  };

  const getMatchResultsDisplay = () => {
    const results = calculateMatchResults();
    if (!results.isValid) return null;

    const team1Name = teams.find(t => t.id === parseInt(matchFormData.team1Id))?.name || 'Team 1';
    const team2Name = teams.find(t => t.id === parseInt(matchFormData.team2Id))?.name || 'Team 2';
    const winnerName = results.winner === 'team1' ? team1Name : team2Name;

    const setScores = [];
    if (matchFormData.set1Team1 && matchFormData.set1Team2) {
      setScores.push(`${matchFormData.set1Team1}-${matchFormData.set1Team2}`);
    }
    if (matchFormData.set2Team1 && matchFormData.set2Team2) {
      setScores.push(`${matchFormData.set2Team1}-${matchFormData.set2Team2}`);
    }
    if (matchFormData.set3Team1 && matchFormData.set3Team2) {
      const set3Label = matchFormData.set3IsTiebreaker ? ' (TB)' : '';
      setScores.push(`${matchFormData.set3Team1}-${matchFormData.set3Team2}${set3Label}`);
    }

    return {
      winnerName,
      setScores: setScores.join(', '),
      team1Sets: results.team1Sets,
      team2Sets: results.team2Sets
    };
  };

  const sendMatchNotification = async (matchData) => {
    // Only send email if captain is entering a match (not editing)
    if (userRole !== 'captain' || editingMatch || !captains) {
      return;
    }

    try {
      // Find opponent team ID (the team that's not the captain's team)
      const opponentTeamId = matchData.team1Id === userTeamId ? matchData.team2Id : matchData.team1Id;

      // Find opponent captain
      const opponentCaptain = captains.find(c =>
        c.teamId === opponentTeamId &&
        c.status === 'active' &&
        c.email
      );

      if (!opponentCaptain) {
        console.log('No active captain with email found for opponent team');
        return;
      }

      // Get team names
      const senderTeam = teams.find(t => t.id === userTeamId)?.name || 'Unknown Team';
      const recipientTeam = teams.find(t => t.id === opponentTeamId)?.name || 'Unknown Team';

      // Format match scores
      const setScores = [];
      if (matchData.set1Team1 && matchData.set1Team2) {
        setScores.push(`${matchData.set1Team1}-${matchData.set1Team2}`);
      }
      if (matchData.set2Team1 && matchData.set2Team2) {
        setScores.push(`${matchData.set2Team1}-${matchData.set2Team2}`);
      }
      if (matchData.set3Team1 && matchData.set3Team2) {
        const tbLabel = matchData.set3IsTiebreaker ? ' (TB)' : '';
        setScores.push(`${matchData.set3Team1}-${matchData.set3Team2}${tbLabel}`);
      }
      const matchScores = setScores.join(', ');

      // Call Netlify function
      const response = await fetch('/.netlify/functions/send-match-notification', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          recipientEmail: opponentCaptain.email,
          recipientName: opponentCaptain.name,
          senderTeam: senderTeam,
          recipientTeam: recipientTeam,
          matchScores: matchScores,
          matchDate: matchData.date,
          matchLevel: matchData.level
        })
      });

      if (response.ok) {
        console.log('Email notification sent successfully');
      } else {
        console.error('Failed to send email notification:', await response.text());
      }
    } catch (error) {
      console.error('Error sending match notification:', error);
      // Don't throw error - match was already saved
    }
  };

  const handleSaveMatch = async () => {
    if (!matchFormData.team1Id || !matchFormData.team2Id) {
      alert('Please select both teams');
      return;
    }
    if (matchFormData.team1Id === matchFormData.team2Id) {
      alert('Teams must be different');
      return;
    }

    // Validate set scores
    const results = calculateMatchResults();
    if (!results.isValid) {
      alert('Please enter valid set scores for at least 2 sets with clear winners');
      return;
    }

    const matchId = editingMatch ? editingMatch.id : Date.now();
    const matchData = {
      date: matchFormData.date,
      level: matchFormData.level,
      team1Id: parseInt(matchFormData.team1Id),
      team2Id: parseInt(matchFormData.team2Id),
      winner: results.winner,
      team1Sets: results.team1Sets,
      team2Sets: results.team2Sets,
      team1Games: results.team1Games,
      team2Games: results.team2Games,
      set1Team1: matchFormData.set1Team1,
      set1Team2: matchFormData.set1Team2,
      set2Team1: matchFormData.set2Team1,
      set2Team2: matchFormData.set2Team2,
      set3Team1: matchFormData.set3Team1,
      set3Team2: matchFormData.set3Team2,
      set3IsTiebreaker: matchFormData.set3IsTiebreaker,
      team1Players: matchFormData.team1Players,
      team2Players: matchFormData.team2Players,
      notes: matchFormData.notes.trim(),
      timestamp: new Date().toISOString()
    };

    if (editingMatch) {
      setMatches(matches.map(m =>
        m.id === editingMatch.id
          ? {...m, ...matchData}
          : m
      ));
    } else {
      setMatches([...matches, {
        id: matchId,
        ...matchData
      }]);
    }

    // Handle photo upload if present
    if (photoFile && photoPreview && onAddPhoto) {
      // Get team names for display
      const team1 = teams.find(t => t.id === parseInt(matchFormData.team1Id));
      const team2 = teams.find(t => t.id === parseInt(matchFormData.team2Id));

      const photoData = {
        id: Date.now() + Math.random(), // Unique ID for photo
        matchId: matchId,
        imageData: photoPreview,
        team1Id: parseInt(matchFormData.team1Id),
        team2Id: parseInt(matchFormData.team2Id),
        team1Name: team1 ? team1.name : 'Team 1',
        team2Name: team2 ? team2.name : 'Team 2',
        matchDate: matchFormData.date,
        uploaderName: loginName,
        uploadTimestamp: new Date().toISOString(),
        // Store all match scoring details
        winner: results.winner,
        set1Team1: matchFormData.set1Team1,
        set1Team2: matchFormData.set1Team2,
        set2Team1: matchFormData.set2Team1,
        set2Team2: matchFormData.set2Team2,
        set3Team1: matchFormData.set3Team1,
        set3Team2: matchFormData.set3Team2,
        set3IsTiebreaker: matchFormData.set3IsTiebreaker
      };
      onAddPhoto(photoData);
    }

    // Send email notification if captain
    await sendMatchNotification(matchData);

    // Show success message
    if (userRole === 'captain' && !editingMatch) {
      alert('Match saved and opponent notified via email');
    }

    setShowMatchForm(false);
    setEditingMatch(null);
    setPhotoFile(null);
    setPhotoPreview(null);
  };

  const handleAddNewMatch = () => {
    setShowMatchForm(true);
    setEditingMatch(null);
    setMatchFormData({
      date: new Date().toISOString().split('T')[0],
      level: '7.0',
      team1Id: userRole === 'captain' ? userTeamId.toString() : '', // Auto-select captain's team
      team2Id: '',
      set1Team1: '',
      set1Team2: '',
      set2Team1: '',
      set2Team2: '',
      set3Team1: '',
      set3Team2: '',
      set3IsTiebreaker: false,
      team1Players: [],
      team2Players: [],
      notes: ''
    });
    setPhotoFile(null);
    setPhotoPreview(null);
  };

  const getTeamPlayers = (teamId) => {
    if (!teamId || !players) return [];
    return players.filter(p => p.teamId === parseInt(teamId) && p.status === 'active');
  };

  const handlePhotoUpload = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      alert('Please select an image file (jpg, png, webp)');
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      alert('Image size must be less than 5MB');
      return;
    }

    setPhotoFile(file);

    // Create preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setPhotoPreview(reader.result);
    };
    reader.readAsDataURL(file);
  };

  const handleRemovePhoto = () => {
    setPhotoFile(null);
    setPhotoPreview(null);
  };

  const handlePlayerToggle = (playerId, teamNumber) => {
    const field = teamNumber === 1 ? 'team1Players' : 'team2Players';
    const currentPlayers = matchFormData[field];

    if (currentPlayers.includes(playerId)) {
      setMatchFormData({
        ...matchFormData,
        [field]: currentPlayers.filter(id => id !== playerId)
      });
    } else {
      setMatchFormData({
        ...matchFormData,
        [field]: [...currentPlayers, playerId]
      });
    }
  };

  const team1Players = getTeamPlayers(matchFormData.team1Id);
  const team2Players = getTeamPlayers(matchFormData.team2Id);

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <Calendar className="w-6 h-6" />
          Record Match Result
        </h2>
        {isAuthenticated && !showMatchForm && (
          <button 
            onClick={handleAddNewMatch} 
            className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Add Match
          </button>
        )}
      </div>

      {!isAuthenticated && (
        <div className="bg-yellow-50 border border-yellow-200 rounded p-4">
          <p className="text-sm text-yellow-800">Directors must login to record matches.</p>
        </div>
      )}

      {isAuthenticated && showMatchForm && (
        <div className="bg-green-50 border-2 border-green-300 rounded-lg p-6 mb-6">
          <h3 className="text-xl font-bold mb-4">
            {editingMatch ? 'Edit Match' : 'Record New Match'}
          </h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold mb-1">Match Date *</label>
              <input
                type="date"
                value={matchFormData.date}
                onChange={(e) => setMatchFormData({...matchFormData, date: e.target.value})}
                className="w-full px-3 py-2 border rounded"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold mb-1">Match Level</label>
              <select
                value={matchFormData.level}
                onChange={(e) => setMatchFormData({...matchFormData, level: e.target.value})}
                className="w-full px-3 py-2 border rounded"
              >
                <option value="5.0">5.0</option>
                <option value="5.5">5.5</option>
                <option value="6.0">6.0</option>
                <option value="6.5">6.5</option>
                <option value="7.0">7.0</option>
                <option value="7.5">7.5</option>
                <option value="8.0">8.0</option>
                <option value="8.5">8.5</option>
                <option value="9.0">9.0</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold mb-1">
                Team 1 * {userRole === 'captain' && '(Your Team)'}
              </label>
              <select
                value={matchFormData.team1Id}
                onChange={(e) => setMatchFormData({
                  ...matchFormData,
                  team1Id: e.target.value,
                  team1Players: [] // Reset players when team changes
                })}
                className="w-full px-3 py-2 border rounded"
                disabled={userRole === 'captain'} // Captains cannot change their team
              >
                <option value="">Select Team 1...</option>
                {teams.map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
              {userRole === 'captain' && (
                <p className="text-xs text-gray-600 mt-1">
                  As captain, you can only enter matches for your team
                </p>
              )}
            </div>
            <div>
              <label className="block text-sm font-semibold mb-1">Team 2 *</label>
              <select
                value={matchFormData.team2Id}
                onChange={(e) => setMatchFormData({
                  ...matchFormData, 
                  team2Id: e.target.value,
                  team2Players: [] // Reset players when team changes
                })}
                className="w-full px-3 py-2 border rounded"
              >
                <option value="">Select Team 2...</option>
                {teams.map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>

            {/* Team 1 Players */}
            {matchFormData.team1Id && team1Players.length > 0 && (
              <div className="col-span-2 bg-blue-50 border border-blue-200 rounded p-3">
                <label className="block text-sm font-semibold mb-2">
                  Team 1 Players (Optional - Select who played)
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {team1Players.map(player => (
                    <label key={player.id} className="flex items-center gap-2 cursor-pointer hover:bg-blue-100 p-2 rounded">
                      <input
                        type="checkbox"
                        checked={matchFormData.team1Players.includes(player.id)}
                        onChange={() => handlePlayerToggle(player.id, 1)}
                        className="w-4 h-4"
                      />
                      <span className="text-sm">
                        {player.firstName} {player.lastName} ({player.gender} {player.dynamicRating || player.ntrpRating})
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* Team 2 Players */}
            {matchFormData.team2Id && team2Players.length > 0 && (
              <div className="col-span-2 bg-purple-50 border border-purple-200 rounded p-3">
                <label className="block text-sm font-semibold mb-2">
                  Team 2 Players (Optional - Select who played)
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {team2Players.map(player => (
                    <label key={player.id} className="flex items-center gap-2 cursor-pointer hover:bg-purple-100 p-2 rounded">
                      <input
                        type="checkbox"
                        checked={matchFormData.team2Players.includes(player.id)}
                        onChange={() => handlePlayerToggle(player.id, 2)}
                        className="w-4 h-4"
                      />
                      <span className="text-sm">
                        {player.firstName} {player.lastName} ({player.gender} {player.dynamicRating || player.ntrpRating})
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* Set Scores Section */}
            <div className="col-span-2 bg-green-100 border-2 border-green-400 rounded-lg p-4">
              <h4 className="font-semibold text-lg mb-3">Set Scores *</h4>

              {/* Set 1 */}
              <div className="mb-3">
                <label className="block text-sm font-semibold mb-2">Set 1:</label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="0"
                    max="7"
                    value={matchFormData.set1Team1}
                    onChange={(e) => setMatchFormData({...matchFormData, set1Team1: e.target.value})}
                    className="w-16 px-2 py-2 border rounded text-center"
                    placeholder="0"
                  />
                  <span className="font-bold">-</span>
                  <input
                    type="number"
                    min="0"
                    max="7"
                    value={matchFormData.set1Team2}
                    onChange={(e) => setMatchFormData({...matchFormData, set1Team2: e.target.value})}
                    className="w-16 px-2 py-2 border rounded text-center"
                    placeholder="0"
                  />
                </div>
              </div>

              {/* Set 2 */}
              <div className="mb-3">
                <label className="block text-sm font-semibold mb-2">Set 2:</label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="0"
                    max="7"
                    value={matchFormData.set2Team1}
                    onChange={(e) => setMatchFormData({...matchFormData, set2Team1: e.target.value})}
                    className="w-16 px-2 py-2 border rounded text-center"
                    placeholder="0"
                  />
                  <span className="font-bold">-</span>
                  <input
                    type="number"
                    min="0"
                    max="7"
                    value={matchFormData.set2Team2}
                    onChange={(e) => setMatchFormData({...matchFormData, set2Team2: e.target.value})}
                    className="w-16 px-2 py-2 border rounded text-center"
                    placeholder="0"
                  />
                </div>
              </div>

              {/* Set 3 */}
              <div className="mb-3">
                <label className="block text-sm font-semibold mb-2">Set 3 (if needed):</label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="0"
                    max={matchFormData.set3IsTiebreaker ? "10" : "7"}
                    value={matchFormData.set3Team1}
                    onChange={(e) => setMatchFormData({...matchFormData, set3Team1: e.target.value})}
                    className="w-16 px-2 py-2 border rounded text-center"
                    placeholder="0"
                  />
                  <span className="font-bold">-</span>
                  <input
                    type="number"
                    min="0"
                    max={matchFormData.set3IsTiebreaker ? "10" : "7"}
                    value={matchFormData.set3Team2}
                    onChange={(e) => setMatchFormData({...matchFormData, set3Team2: e.target.value})}
                    className="w-16 px-2 py-2 border rounded text-center"
                    placeholder="0"
                  />
                </div>
                {(matchFormData.set3Team1 || matchFormData.set3Team2) && (
                  <label className="flex items-center gap-2 mt-2 text-sm">
                    <input
                      type="checkbox"
                      checked={matchFormData.set3IsTiebreaker}
                      onChange={(e) => setMatchFormData({...matchFormData, set3IsTiebreaker: e.target.checked})}
                      className="w-4 h-4"
                    />
                    <span>Set 3 was a 10-point tiebreaker</span>
                  </label>
                )}
              </div>

              {/* Match Result Display */}
              {getMatchResultsDisplay() && (
                <div className="mt-4 p-3 bg-white rounded border-2 border-green-500">
                  <p className="text-sm font-semibold text-green-800 mb-1">Match Result:</p>
                  <p className="text-lg font-bold text-green-900">
                    Winner: {getMatchResultsDisplay().winnerName}
                  </p>
                  <p className="text-sm text-gray-700">
                    {getMatchResultsDisplay().setScores}
                  </p>
                </div>
              )}
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-semibold mb-1">Notes (Optional)</label>
              <textarea
                value={matchFormData.notes}
                onChange={(e) => setMatchFormData({...matchFormData, notes: e.target.value})}
                className="w-full px-3 py-2 border rounded"
                rows="2"
                placeholder="Match notes..."
              />
            </div>

            {/* Photo Upload Section */}
            <div className="col-span-2 bg-blue-50 border-2 border-blue-200 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-3">
                <ImageIcon className="w-5 h-5 text-blue-600" />
                <label className="block text-sm font-semibold">Upload Match Photo (Optional)</label>
              </div>

              {!photoPreview ? (
                <div>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={handlePhotoUpload}
                    className="w-full px-3 py-2 border rounded bg-white text-sm"
                  />
                  <p className="text-xs text-gray-600 mt-2">
                    Upload a photo from this match. Accepted formats: JPG, PNG, WEBP (max 5MB)
                  </p>
                </div>
              ) : (
                <div>
                  <div className="relative inline-block">
                    <img
                      src={photoPreview}
                      alt="Match photo preview"
                      className="max-w-full h-48 object-cover rounded border-2 border-blue-300"
                    />
                    <button
                      type="button"
                      onClick={handleRemovePhoto}
                      className="absolute top-2 right-2 bg-red-600 hover:bg-red-700 text-white p-2 rounded-full"
                      title="Remove photo"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <p className="text-sm text-green-600 mt-2 flex items-center gap-1">
                    <Check className="w-4 h-4" /> Photo ready to upload
                  </p>
                </div>
              )}
            </div>
          </div>
          <div className="flex gap-2 mt-6">
            <button
              onClick={handleSaveMatch}
              className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700 flex items-center gap-2"
            >
              <Check className="w-4 h-4" />
              {editingMatch ? 'Update Match' : 'Save Match'}
            </button>
            <button
              onClick={() => {
                setShowMatchForm(false);
                setEditingMatch(null);
              }}
              className="bg-gray-300 text-gray-700 px-6 py-2 rounded hover:bg-gray-400 flex items-center gap-2"
            >
              <X className="w-4 h-4" />
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default MatchEntry;