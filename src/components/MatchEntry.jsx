import React, { useState } from 'react';
import { Calendar, Plus, Check, X } from 'lucide-react';

const MatchEntry = ({ teams, matches, setMatches, isAuthenticated, setActiveTab, players }) => {
  const [showMatchForm, setShowMatchForm] = useState(false);
  const [editingMatch, setEditingMatch] = useState(null);
  const [matchFormData, setMatchFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    level: '7.0',
    team1Id: '',
    team2Id: '',
    winner: '',
    team1Sets: '',
    team2Sets: '',
    team1Games: '',
    team2Games: '',
    team1Players: [],
    team2Players: [],
    notes: ''
  });

  const handleSaveMatch = () => {
    if (!matchFormData.team1Id || !matchFormData.team2Id) {
      alert('Please select both teams');
      return;
    }
    if (!matchFormData.winner) {
      alert('Please select the winner');
      return;
    }
    if (matchFormData.team1Id === matchFormData.team2Id) {
      alert('Teams must be different');
      return;
    }
    
    const matchData = {
      date: matchFormData.date,
      level: matchFormData.level,
      team1Id: parseInt(matchFormData.team1Id),
      team2Id: parseInt(matchFormData.team2Id),
      winner: matchFormData.winner,
      team1Sets: matchFormData.team1Sets || '0',
      team2Sets: matchFormData.team2Sets || '0',
      team1Games: matchFormData.team1Games || '0',
      team2Games: matchFormData.team2Games || '0',
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
        id: Date.now(),
        ...matchData
      }]);
    }
    
    setShowMatchForm(false);
    setEditingMatch(null);
  };

  const handleAddNewMatch = () => {
    setShowMatchForm(true);
    setEditingMatch(null);
    setMatchFormData({
      date: new Date().toISOString().split('T')[0],
      level: '7.0',
      team1Id: '',
      team2Id: '',
      winner: '',
      team1Sets: '',
      team2Sets: '',
      team1Games: '',
      team2Games: '',
      team1Players: [],
      team2Players: [],
      notes: ''
    });
  };

  const getTeamPlayers = (teamId) => {
    if (!teamId || !players) return [];
    return players.filter(p => p.teamId === parseInt(teamId) && p.status === 'active');
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
              <label className="block text-sm font-semibold mb-1">Team 1 *</label>
              <select
                value={matchFormData.team1Id}
                onChange={(e) => setMatchFormData({
                  ...matchFormData, 
                  team1Id: e.target.value,
                  team1Players: [] // Reset players when team changes
                })}
                className="w-full px-3 py-2 border rounded"
              >
                <option value="">Select Team 1...</option>
                {teams.map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
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

            <div>
              <label className="block text-sm font-semibold mb-1">Winner *</label>
              <select
                value={matchFormData.winner}
                onChange={(e) => setMatchFormData({...matchFormData, winner: e.target.value})}
                className="w-full px-3 py-2 border rounded"
              >
                <option value="">Select Winner...</option>
                <option value="team1">Team 1</option>
                <option value="team2">Team 2</option>
              </select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-sm font-semibold mb-1">Team 1 Sets</label>
                <input
                  type="number"
                  min="0"
                  value={matchFormData.team1Sets}
                  onChange={(e) => setMatchFormData({...matchFormData, team1Sets: e.target.value})}
                  className="w-full px-3 py-2 border rounded"
                  placeholder="0"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1">Team 2 Sets</label>
                <input
                  type="number"
                  min="0"
                  value={matchFormData.team2Sets}
                  onChange={(e) => setMatchFormData({...matchFormData, team2Sets: e.target.value})}
                  className="w-full px-3 py-2 border rounded"
                  placeholder="0"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-sm font-semibold mb-1">Team 1 Games</label>
                <input
                  type="number"
                  min="0"
                  value={matchFormData.team1Games}
                  onChange={(e) => setMatchFormData({...matchFormData, team1Games: e.target.value})}
                  className="w-full px-3 py-2 border rounded"
                  placeholder="0"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1">Team 2 Games</label>
                <input
                  type="number"
                  min="0"
                  value={matchFormData.team2Games}
                  onChange={(e) => setMatchFormData({...matchFormData, team2Games: e.target.value})}
                  className="w-full px-3 py-2 border rounded"
                  placeholder="0"
                />
              </div>
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