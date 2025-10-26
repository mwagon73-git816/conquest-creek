import React, { useState, useEffect } from 'react';
import { Trophy, Users, Calendar, TrendingUp, Award, RefreshCw, Plus, Edit, Trash2, Gift, BarChart3, UserPlus, ArrowLeftRight, Activity, X, Check } from 'lucide-react';
import { tournamentStorage } from './services/storage';

const App = () => {
  const [teams, setTeams] = useState([]);
  const [matches, setMatches] = useState([]);
  const [bonusEntries, setBonusEntries] = useState([]);
  const [players, setPlayers] = useState([]);
  const [trades, setTrades] = useState([]);
  const [activeTab, setActiveTab] = useState('leaderboard');
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  const [loginName, setLoginName] = useState('');
  const [saveStatus, setSaveStatus] = useState('');
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
    notes: ''
  });

  const TOURNAMENT_DIRECTORS = ['matt wagoner', 'john nguyen'];

  useEffect(() => {
    const loadData = async () => {
      try {
        const teamsData = await tournamentStorage.getTeams();
        if (teamsData) {
          const parsed = JSON.parse(teamsData);
          if (parsed.players) setPlayers(parsed.players);
          if (parsed.teams) setTeams(parsed.teams);
          if (parsed.trades) setTrades(parsed.trades);
        } else {
          setPlayers([]);
          setTeams([]);
          setTrades([]);
        }
        
        const matchesData = await tournamentStorage.getMatches();
        if (matchesData) setMatches(JSON.parse(matchesData));
        
        const bonusData = await tournamentStorage.getBonuses();
        if (bonusData) setBonusEntries(JSON.parse(bonusData));
        
        const authData = await tournamentStorage.getAuthSession();
        if (authData) {
          const session = JSON.parse(authData);
          const sessionAge = Date.now() - new Date(session.timestamp).getTime();
          if (sessionAge < 24 * 60 * 60 * 1000) {
            setIsAuthenticated(true);
            setLoginName(session.name);
          }
        }
        
        setSaveStatus('Data loaded');
      } catch (error) {
        console.error('Error loading data:', error);
      } finally {
        setLoading(false);
      }
    };
    
    loadData();
  }, []);

  useEffect(() => {
    const saveData = async () => {
      if (!loading) {
        try {
          await tournamentStorage.setTeams(JSON.stringify({ players, teams, trades }));
          setSaveStatus('Saved ' + new Date().toLocaleTimeString());
        } catch (error) {
          console.error('Error saving:', error);
        }
      }
    };
    saveData();
  }, [players, teams, trades, loading]);

  useEffect(() => {
    if (!loading) tournamentStorage.setMatches(JSON.stringify(matches));
  }, [matches, loading]);

  useEffect(() => {
    if (!loading) tournamentStorage.setBonuses(JSON.stringify(bonusEntries));
  }, [bonusEntries, loading]);

  const handleLogin = () => {
    const normalizedName = loginName.trim().toLowerCase();
    if (TOURNAMENT_DIRECTORS.includes(normalizedName)) {
      setIsAuthenticated(true);
      tournamentStorage.setAuthSession(JSON.stringify({ name: loginName.trim(), timestamp: new Date().toISOString() }));
      setShowLogin(false);
      alert('Welcome, ' + loginName.trim() + '!');
    } else {
      alert('Only tournament directors can make changes.');
    }
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    setLoginName('');
    tournamentStorage.deleteAuthSession();
    setActiveTab('leaderboard');
  };

  const getEffectiveRating = (player) => {
    return player.dynamicRating || player.ntrpRating || 0;
  };

  const calculateTeamRatings = (teamId) => {
    const teamPlayers = players.filter(p => p.teamId === teamId && p.status === 'active');
    const men = teamPlayers.filter(p => p.gender === 'M');
    const women = teamPlayers.filter(p => p.gender === 'F');
    
    const menRating = men.reduce((sum, p) => sum + getEffectiveRating(p), 0);
    const womenRating = women.reduce((sum, p) => sum + getEffectiveRating(p), 0);
    
    return {
      menRating: Math.round(menRating * 10) / 10,
      womenRating: Math.round(womenRating * 10) / 10,
      totalRating: Math.round((menRating + womenRating) * 10) / 10,
      menCount: men.length,
      womenCount: women.length
    };
  };

  const canAddPlayerToTeam = (player, teamId) => {
    if (player.teamId !== null) {
      return { allowed: false, reason: 'Player already on another team' };
    }
    
    const ratings = calculateTeamRatings(teamId);
    const playerRating = getEffectiveRating(player);
    
    if (player.gender === 'M') {
      if (ratings.menCount >= 6) {
        return { allowed: false, reason: 'Team already has 6 men' };
      }
      const newRating = ratings.menRating + playerRating;
      if (newRating > 21.0) {
        return { allowed: false, reason: 'Would exceed men limit (' + newRating.toFixed(1) + '/21.0)' };
      }
    } else {
      if (ratings.womenCount >= 2) {
        return { allowed: false, reason: 'Team already has 2 women' };
      }
      const newRating = ratings.womenRating + playerRating;
      if (newRating > 7.0) {
        return { allowed: false, reason: 'Would exceed women limit (' + newRating.toFixed(1) + '/7.0)' };
      }
    }
    
    return { allowed: true };
  };

  const calculateTeamPoints = (teamId) => {
    const teamMatches = matches.filter(m => m.team1Id === teamId || m.team2Id === teamId);
    
    let matchWinPoints = 0;
    let setsWon = 0;
    let gamesWon = 0;
    
    teamMatches.forEach(match => {
      const isTeam1 = match.team1Id === teamId;
      const won = isTeam1 ? match.winner === 'team1' : match.winner === 'team2';
      
      if (won) {
        const matchDate = new Date(match.date);
        const month = matchDate.getMonth(); // 0=Jan, 10=Nov, 11=Dec
        
        // January (month 0) = 4 points, November (10) and December (11) = 2 points
        if (month === 0) {
          matchWinPoints += 4;
        } else if (month === 10 || month === 11) {
          matchWinPoints += 2;
        } else {
          // Fallback for any other months (shouldn't happen per tournament rules)
          matchWinPoints += 2;
        }
      }
      
      if (isTeam1) {
        setsWon += parseInt(match.team1Sets || 0);
        gamesWon += parseInt(match.team1Games || 0);
      } else {
        setsWon += parseInt(match.team2Sets || 0);
        gamesWon += parseInt(match.team2Games || 0);
      }
    });

    const bonusPoints = calculateBonusPoints(teamId);
    const cappedBonus = Math.min(bonusPoints, matchWinPoints * 0.25);
    
    return {
      matchWinPoints,
      bonusPoints,
      cappedBonus,
      totalPoints: matchWinPoints + cappedBonus,
      setsWon,
      gamesWon,
      matchesPlayed: teamMatches.length
    };
  };

  const calculateBonusPoints = (teamId) => {
    const teamMatches = matches.filter(m => m.team1Id === teamId || m.team2Id === teamId);
    const matchesByMonth = {};
    
    teamMatches.forEach(match => {
      const date = new Date(match.date);
      const monthKey = date.getFullYear() + '-' + date.getMonth();
      if (!matchesByMonth[monthKey]) matchesByMonth[monthKey] = [];
      matchesByMonth[monthKey].push(match);
    });

    let totalBonus = 0;
    Object.keys(matchesByMonth).forEach(monthKey => {
      const count = matchesByMonth[monthKey].length;
      if (count >= 5) totalBonus += 1;
      if (count >= 10) totalBonus += 2;
      if (count >= 15) totalBonus += 3;
      if (count >= 20) totalBonus += 4;
      if (count < 4) totalBonus -= 4;
    });

    bonusEntries.filter(b => b.teamId === teamId).forEach(bonus => {
      totalBonus += bonus.points;
    });

    return Math.max(0, totalBonus);
  };

  const getLeaderboard = () => {
    return teams.map(team => ({
      ...team,
      ...calculateTeamPoints(team.id)
    })).sort((a, b) => {
      if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints;
      if (b.setsWon !== a.setsWon) return b.setsWon - a.setsWon;
      return b.gamesWon - a.gamesWon;
    });
  };

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

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="w-12 h-12 animate-spin mx-auto mb-4 text-blue-600" />
          <p>Loading tournament data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 p-4">
      {showLogin && (
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
              <button onClick={handleLogin} className="flex-1 bg-blue-600 text-white py-2 rounded hover:bg-blue-700">Login</button>
              <button onClick={() => setShowLogin(false)} className="flex-1 bg-gray-300 text-gray-700 py-2 rounded hover:bg-gray-400">Cancel</button>
            </div>
            <p className="text-xs text-gray-500 mt-3">Authorized: Matt Wagoner, John Nguyen</p>
          </div>
        </div>
      )}
      
      <div className="max-w-7xl mx-auto">
        <div className="bg-gradient-to-r from-blue-600 to-blue-800 text-white rounded-lg shadow-lg p-6 mb-6">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-3xl font-bold mb-2">Conquest of the Creek</h1>
              <p className="text-blue-100">Tournament Tracker • November 2025 - February 2026</p>
              <p className="text-sm text-blue-200 mt-2">Silver Creek Valley Country Club</p>
              {saveStatus && <p className="text-xs text-blue-300 mt-2">{saveStatus}</p>}
            </div>
            {isAuthenticated ? (
              <div className="text-right">
                <div className="text-sm text-blue-200 mb-2">Logged in: {loginName}</div>
                <button onClick={handleLogout} className="bg-white text-blue-600 px-3 py-1 rounded text-sm hover:bg-blue-50">Logout</button>
              </div>
            ) : (
              <button onClick={() => setShowLogin(true)} className="bg-white text-blue-600 px-4 py-2 rounded hover:bg-blue-50">Director Login</button>
            )}
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md mb-6 overflow-x-auto">
          <div className="flex border-b min-w-max">
            {[
              { id: 'leaderboard', icon: Trophy, label: 'Leaderboard' },
              { id: 'teams', icon: Users, label: 'Teams' },
              { id: 'players', icon: UserPlus, label: 'Players' },
              { id: 'entry', icon: Calendar, label: 'Match Entry' },
              { id: 'matches', icon: TrendingUp, label: 'Matches' }
            ].map(tab => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={'flex-1 min-w-[120px] px-4 py-3 font-semibold transition flex items-center justify-center gap-2 ' + (
                    activeTab === tab.id ? 'bg-blue-50 text-blue-600 border-b-2 border-blue-600' : 'text-gray-600 hover:bg-gray-50'
                  )}
                >
                  <Icon className="w-4 h-4" />
                  <span className="text-sm">{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="space-y-6">
          {activeTab === 'leaderboard' && (
            <div className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
                <Trophy className="w-6 h-6 text-yellow-500" />
                Tournament Leaderboard
              </h2>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b-2">
                      <th className="text-left p-2">Rank</th>
                      <th className="text-left p-2">Team</th>
                      <th className="text-center p-2">Matches</th>
                      <th className="text-center p-2">Win Pts</th>
                      <th className="text-center p-2">Bonus</th>
                      <th className="text-center p-2">Total Pts</th>
                      <th className="text-center p-2">Sets</th>
                      <th className="text-center p-2">Games</th>
                    </tr>
                  </thead>
                  <tbody>
                    {getLeaderboard().map((team, index) => (
                      <tr key={team.id} className={index < 2 ? 'border-b bg-yellow-50' : 'border-b'}>
                        <td className="p-2 font-bold">
                          {index + 1}
                          {index < 2 && <Trophy className="inline w-4 h-4 ml-1 text-yellow-500" />}
                        </td>
                        <td className="p-2">
                          <div className="flex items-center gap-2">
                            <div className="w-4 h-4 rounded" style={{ backgroundColor: team.color }} />
                            <span className="font-semibold">{team.name}</span>
                          </div>
                        </td>
                        <td className="text-center p-2">{team.matchesPlayed}</td>
                        <td className="text-center p-2 font-semibold">{team.matchWinPoints}</td>
                        <td className="text-center p-2 text-sm">
                          {team.cappedBonus.toFixed(1)}
                          {team.bonusPoints > team.cappedBonus && (
                            <span className="text-red-500 text-xs ml-1">(capped)</span>
                          )}
                        </td>
                        <td className="text-center p-2 font-bold text-lg text-blue-600">{team.totalPoints.toFixed(1)}</td>
                        <td className="text-center p-2 text-sm text-gray-600">{team.setsWon}</td>
                        <td className="text-center p-2 text-sm text-gray-600">{team.gamesWon}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {teams.length === 0 && (
                <p className="text-center text-gray-500 py-8">No teams created yet. Directors can add teams in the Teams tab.</p>
              )}
            </div>
          )}

          {activeTab === 'teams' && (
            <div className="bg-white rounded-lg shadow-md p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-2xl font-bold flex items-center gap-2">
                  <Users className="w-6 h-6" />
                  Teams Management
                </h2>
                {isAuthenticated && (
                  <button 
                    onClick={() => {
                      const name = prompt('Team name:');
                      const captain = prompt('Captain name:');
                      if (name && captain) {
                        setTeams([...teams, { id: Date.now(), name, captain, color: '#3B82F6' }]);
                      }
                    }} 
                    className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 flex items-center gap-2"
                  >
                    <Plus className="w-4 h-4" />
                    Add Team
                  </button>
                )}
              </div>

              {!isAuthenticated && (
                <div className="bg-yellow-50 border border-yellow-200 rounded p-4 mb-4">
                  <p className="text-sm text-yellow-800">View-only mode. Directors can login to manage teams.</p>
                </div>
              )}

              <div className="space-y-3">
                {teams.map(team => {
                  const ratings = calculateTeamRatings(team.id);
                  const teamPlayers = players.filter(p => p.teamId === team.id);
                  
                  return (
                    <div key={team.id} className="border rounded p-4">
                      <div className="flex justify-between items-start mb-3">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded" style={{ backgroundColor: team.color }} />
                          <div>
                            <div className="font-bold text-lg">{team.name}</div>
                            <div className="text-sm text-gray-600">Captain: {team.captain}</div>
                          </div>
                        </div>
                        {isAuthenticated && (
                          <button 
                            onClick={() => {
                              if (confirm('Delete this team?')) {
                                setPlayers(players.map(p => p.teamId === team.id ? {...p, teamId: null} : p));
                                setTeams(teams.filter(t => t.id !== team.id));
                              }
                            }} 
                            className="text-red-600 hover:text-red-800 p-2"
                          >
                            <Trash2 className="w-5 h-5" />
                          </button>
                        )}
                      </div>
                      
                      <div className="grid grid-cols-4 gap-3 text-sm bg-gray-50 p-3 rounded">
                        <div>
                          <div className="text-gray-600">Players</div>
                          <div className="font-bold">{teamPlayers.length}/8</div>
                        </div>
                        <div>
                          <div className="text-gray-600">Men</div>
                          <div className="font-bold">{ratings.menCount}/6 ({ratings.menRating.toFixed(1)})</div>
                        </div>
                        <div>
                          <div className="text-gray-600">Women</div>
                          <div className="font-bold">{ratings.womenCount}/2 ({ratings.womenRating.toFixed(1)})</div>
                        </div>
                        <div>
                          <div className="text-gray-600">Total Rating</div>
                          <div className={`font-bold ${ratings.totalRating > 28.0 ? 'text-red-600' : 'text-green-600'}`}>
                            {ratings.totalRating.toFixed(1)}/28.0
                          </div>
                        </div>
                      </div>

                      {teamPlayers.length > 0 && (
                        <div className="mt-3">
                          <div className="text-xs font-semibold text-gray-600 mb-2">Roster:</div>
                          <div className="grid grid-cols-2 gap-2 text-sm">
                            {teamPlayers.map(player => (
                              <div key={player.id} className="text-gray-700 flex items-center justify-between">
                                <span>{player.firstName} {player.lastName} ({player.gender} {getEffectiveRating(player)})</span>
                                {isAuthenticated && (
                                  <button 
                                    onClick={() => {
                                      if (confirm('Remove player from team?')) {
                                        setPlayers(players.map(p => p.id === player.id ? {...p, teamId: null} : p));
                                      }
                                    }}
                                    className="text-red-600 hover:text-red-800 ml-2"
                                  >
                                    <X className="w-3 h-3" />
                                  </button>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              {teams.length === 0 && <p className="text-center text-gray-500 py-8">No teams created yet</p>}
            </div>
          )}

          {activeTab === 'players' && (
            <div className="bg-white rounded-lg shadow-md p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-2xl font-bold flex items-center gap-2">
                  <UserPlus className="w-6 h-6" />
                  Player Management
                </h2>
                {isAuthenticated && !showPlayerForm && (
                  <button 
                    onClick={() => {
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
                    }} 
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
                                  if (teamId) {
                                    const check = canAddPlayerToTeam(player, teamId);
                                    if (check.allowed) {
                                      setPlayers(players.map(p => p.id === player.id ? {...p, teamId} : p));
                                    } else {
                                      alert(check.reason);
                                    }
                                  }
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
                                  onClick={() => {
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
                                  }}
                                  className="text-blue-600 hover:text-blue-800 p-1"
                                  title="Edit player"
                                >
                                  <Edit className="w-4 h-4" />
                                </button>
                                <button 
                                  onClick={() => {
                                    if (confirm('Delete this player?')) {
                                      setPlayers(players.filter(p => p.id !== player.id));
                                    }
                                  }} 
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
          )}

          {activeTab === 'entry' && (
            <div className="bg-white rounded-lg shadow-md p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-2xl font-bold flex items-center gap-2">
                  <Calendar className="w-6 h-6" />
                  Record Match Result
                </h2>
                {isAuthenticated && !showMatchForm && (
                  <button 
                    onClick={() => {
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
                        notes: ''
                      });
                    }} 
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
                        onChange={(e) => setMatchFormData({...matchFormData, team1Id: e.target.value})}
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
                        onChange={(e) => setMatchFormData({...matchFormData, team2Id: e.target.value})}
                        className="w-full px-3 py-2 border rounded"
                      >
                        <option value="">Select Team 2...</option>
                        {teams.map(t => (
                          <option key={t.id} value={t.id}>{t.name}</option>
                        ))}
                      </select>
                    </div>
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
                  <div className="flex gap-2 mt-4">
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
          )}

          {activeTab === 'matches' && (
            <div className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
                <TrendingUp className="w-6 h-6" />
                Recent Matches
              </h2>
              <div className="space-y-3">
                {matches.length === 0 ? (
                  <p className="text-gray-500 text-center py-8">No matches recorded yet</p>
                ) : (
                  [...matches].reverse().slice(0, 20).map(match => {
                    const team1 = teams.find(t => t.id == match.team1Id);
                    const team2 = teams.find(t => t.id == match.team2Id);
                    
                    return (
                      <div key={match.id} className="border rounded p-3 hover:bg-gray-50">
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className={match.winner === 'team1' ? 'font-semibold text-green-600' : 'font-semibold'}>
                                {team1 ? team1.name : 'Team ' + match.team1Id}
                              </span>
                              <span className="text-sm">vs</span>
                              <span className={match.winner === 'team2' ? 'font-semibold text-green-600' : 'font-semibold'}>
                                {team2 ? team2.name : 'Team ' + match.team2Id}
                              </span>
                            </div>
                            <div className="text-sm text-gray-600">
                              {match.team1Sets}-{match.team2Sets} sets • {match.team1Games}-{match.team2Games} games • {new Date(match.date).toLocaleDateString()}
                              {match.notes && <span className="ml-2 italic">• {match.notes}</span>}
                            </div>
                          </div>
                          {isAuthenticated && (
                            <div className="flex gap-2">
                              <button
                                onClick={() => {
                                  setEditingMatch(match);
                                  setMatchFormData({
                                    date: match.date,
                                    level: match.level || '7.0',
                                    team1Id: String(match.team1Id),
                                    team2Id: String(match.team2Id),
                                    winner: match.winner,
                                    team1Sets: String(match.team1Sets || '0'),
                                    team2Sets: String(match.team2Sets || '0'),
                                    team1Games: String(match.team1Games || '0'),
                                    team2Games: String(match.team2Games || '0'),
                                    notes: match.notes || ''
                                  });
                                  setShowMatchForm(true);
                                  setActiveTab('entry');
                                }}
                                className="text-blue-600 hover:text-blue-800 p-1"
                                title="Edit match"
                              >
                                <Edit className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => {
                                  if (confirm('Delete this match?')) {
                                    setMatches(matches.filter(m => m.id !== match.id));
                                  }
                                }}
                                className="text-red-600 hover:text-red-800 p-1"
                                title="Delete match"
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
          )}
        </div>

        <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="font-semibold text-blue-900 mb-2 flex items-center gap-2">
            <Award className="w-5 h-5" />
            Tournament Rules
          </h3>
          <ul className="text-sm text-blue-800 space-y-1">
            <li>• Team Limit: 6 men (21.0 max rating), 2 women (7.0 max rating) = 28.0 total</li>
            <li>• Dynamic rating takes priority over NTRP rating when available</li>
            <li>• Nov/Dec Match Wins: 2 points • January Match Wins: 4 points</li>
            <li>• Volume Bonuses: 5+ matches (+1), 10+ (+2), 15+ (+3), 20+ (+4)</li>
            <li>• Penalty: -4 points for months with fewer than 4 matches</li>
            <li>• Bonus Points Cap: Maximum 25% of match win points</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default App;