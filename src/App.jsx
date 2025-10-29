import React, { useState, useEffect } from 'react';
import { RefreshCw } from 'lucide-react';
import { tournamentStorage } from './services/storage';
import Header from './components/Header';
import TabNavigation from './components/TabNavigation';
import LoginModal from './components/LoginModal';
import Leaderboard from './components/Leaderboard';
import TeamsManagement from './components/TeamsManagement';
import PlayerManagement from './components/PlayerManagement';
import CaptainManagement from './components/CaptainManagement';
import MatchEntry from './components/MatchEntry';
import MatchHistory from './components/MatchHistory';
import TournamentRules from './components/TournamentRules';

const App = () => {
  const [teams, setTeams] = useState([]);
  const [matches, setMatches] = useState([]);
  const [bonusEntries, setBonusEntries] = useState([]);
  const [players, setPlayers] = useState([]);
  const [trades, setTrades] = useState([]);
  const [photos, setPhotos] = useState([]);
  const [captains, setCaptains] = useState([]);
  const [activeTab, setActiveTab] = useState('leaderboard');
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  const [loginName, setLoginName] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginRole, setLoginRole] = useState('director'); // 'director' or 'captain'
  const [userRole, setUserRole] = useState(''); // Current user's role
  const [userTeamId, setUserTeamId] = useState(null); // For captain role
  const [saveStatus, setSaveStatus] = useState('');

  const TOURNAMENT_DIRECTORS = [
    { username: 'MW#', name: 'Matt Wagoner', role: 'director' },
    { username: 'JN$', name: 'John Nguyen', role: 'director' }
  ];

  useEffect(() => {
    const loadData = async () => {
      try {
        const teamsData = await tournamentStorage.getTeams();
        if (teamsData) {
          const parsed = JSON.parse(teamsData);
          
          // Ensure all teams have bonuses structure
          if (parsed.teams) {
            const teamsWithBonuses = parsed.teams.map(team => ({
              ...team,
              bonuses: team.bonuses || {
                uniformType: 'none',
                uniformPhotoSubmitted: false,
                practices: {}
              }
            }));
            setTeams(teamsWithBonuses);
          }
          
          if (parsed.players) setPlayers(parsed.players);
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

        const photosData = await tournamentStorage.getPhotos();
        if (photosData) setPhotos(JSON.parse(photosData));

        const captainsData = await tournamentStorage.getCaptains();
        if (captainsData) setCaptains(JSON.parse(captainsData));

        const authData = await tournamentStorage.getAuthSession();
        if (authData) {
          const session = JSON.parse(authData);
          const now = Date.now();
          const expiresAt = new Date(session.expiresAt).getTime();

          if (now < expiresAt) {
            setIsAuthenticated(true);
            setLoginName(session.name);
            setUserRole(session.role || 'director');
            setUserTeamId(session.teamId || null);
          } else {
            // Session expired
            tournamentStorage.deleteAuthSession();
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

  useEffect(() => {
    if (!loading) tournamentStorage.setPhotos(JSON.stringify(photos));
  }, [photos, loading]);

  useEffect(() => {
    if (!loading) tournamentStorage.setCaptains(JSON.stringify(captains));
  }, [captains, loading]);

  // Session validity checker - runs every 60 seconds
  useEffect(() => {
    const checkSessionValidity = async () => {
      if (isAuthenticated) {
        const authData = await tournamentStorage.getAuthSession();
        if (authData) {
          const session = JSON.parse(authData);
          const now = Date.now();
          const expiresAt = new Date(session.expiresAt).getTime();

          if (now >= expiresAt) {
            // Session expired
            setIsAuthenticated(false);
            setLoginName('');
            setUserRole('');
            setUserTeamId(null);
            tournamentStorage.deleteAuthSession();
            setActiveTab('leaderboard');
            alert('Your session has expired due to inactivity. Please log in again.');
          }
        } else {
          // Session data missing
          setIsAuthenticated(false);
          setLoginName('');
          setUserRole('');
          setUserTeamId(null);
          setActiveTab('leaderboard');
        }
      }
    };

    const intervalId = setInterval(checkSessionValidity, 60 * 1000); // Check every 60 seconds

    return () => clearInterval(intervalId); // Clean up on unmount
  }, [isAuthenticated]);

  const handleLogin = () => {
    const normalizedUsername = loginName.trim();

    if (loginRole === 'director') {
      // Director login - no password required
      const director = TOURNAMENT_DIRECTORS.find(d => d.username === normalizedUsername);

      if (director) {
        setIsAuthenticated(true);
        setUserRole('director');
        setUserTeamId(null);
        const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString(); // 30 minutes
        tournamentStorage.setAuthSession(JSON.stringify({
          username: director.username,
          name: director.name,
          role: 'director',
          teamId: null,
          timestamp: new Date().toISOString(),
          expiresAt: expiresAt
        }));
        setLoginName(director.name);
        setShowLogin(false);
        setLoginPassword('');
        alert('Welcome, ' + director.name + '!');
      } else {
        alert('Invalid username.');
      }
    } else if (loginRole === 'captain') {
      // Captain login - requires password
      const captain = captains.find(c =>
        c.username === normalizedUsername &&
        c.password === loginPassword &&
        c.status === 'active'
      );

      if (captain) {
        setIsAuthenticated(true);
        setUserRole('captain');
        setUserTeamId(captain.teamId);
        const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString(); // 30 minutes
        tournamentStorage.setAuthSession(JSON.stringify({
          username: captain.username,
          name: captain.name,
          role: 'captain',
          teamId: captain.teamId,
          timestamp: new Date().toISOString(),
          expiresAt: expiresAt
        }));
        setLoginName(captain.name);
        setShowLogin(false);
        setLoginPassword('');
        setActiveTab('entry'); // Captains start on match entry
        alert('Welcome, Captain ' + captain.name + '!');
      } else {
        alert('Invalid username or password.');
      }
    }
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    setLoginName('');
    setUserRole('');
    setUserTeamId(null);
    setLoginPassword('');
    tournamentStorage.deleteAuthSession();
    setActiveTab('leaderboard');
  };

  const handleDeletePhoto = (photoId) => {
    setPhotos(photos.filter(p => p.id !== photoId));
  };

  const handleAddPhoto = (photoData) => {
    // Enforce max 20 photos limit
    let updatedPhotos = [...photos];
    if (updatedPhotos.length >= 20) {
      // Remove oldest photo
      updatedPhotos.sort((a, b) => new Date(a.uploadTimestamp) - new Date(b.uploadTimestamp));
      updatedPhotos = updatedPhotos.slice(1);
    }
    updatedPhotos.push(photoData);
    setPhotos(updatedPhotos);
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

  const calculateBonusPoints = (teamId) => {
    const team = teams.find(t => t.id === teamId);

    const teamMatches = matches.filter(m => m.team1Id === teamId || m.team2Id === teamId);
    const matchesByMonth = {};

    // Only count matches in tournament months: Nov 2025, Dec 2025, Jan 2026
    const tournamentMonths = ['2025-10', '2025-11', '2026-0']; // Nov=10, Dec=11, Jan=0

    teamMatches.forEach(match => {
      const date = new Date(match.date);
      const monthKey = date.getFullYear() + '-' + date.getMonth();

      // Only count if it's a tournament month
      if (tournamentMonths.includes(monthKey)) {
        if (!matchesByMonth[monthKey]) matchesByMonth[monthKey] = [];
        matchesByMonth[monthKey].push(match);
      }
    });

    let totalBonus = 0;

    // Match volume bonuses - only apply to tournament months
    tournamentMonths.forEach(monthKey => {
      const count = matchesByMonth[monthKey] ? matchesByMonth[monthKey].length : 0;
      if (count >= 5) totalBonus += 1;
      if (count >= 10) totalBonus += 2;
      if (count >= 15) totalBonus += 3;
      if (count >= 20) totalBonus += 4;
      if (count < 4) totalBonus -= 4;
    });

    // Full Roster Participation Bonus: +1 per month if all 8 team members play
    tournamentMonths.forEach(monthKey => {
      const monthMatches = matchesByMonth[monthKey] || [];
      if (monthMatches.length > 0) {
        const uniquePlayers = new Set();
        monthMatches.forEach(match => {
          const teamPlayers = match.team1Id === teamId ? match.team1Players : match.team2Players;
          (teamPlayers || []).forEach(playerId => uniquePlayers.add(playerId));
        });

        const teamPlayers = players.filter(p => p.teamId === teamId && p.status === 'active');
        if (teamPlayers.length === 8 && uniquePlayers.size === 8) {
          totalBonus += 1;
        }
      }
    });

    // Variety Bonus Type 1: +1 per month for playing 3+ different teams
    tournamentMonths.forEach(monthKey => {
      const monthMatches = matchesByMonth[monthKey] || [];
      const opponentTeams = new Set();
      monthMatches.forEach(match => {
        const opponentId = match.team1Id === teamId ? match.team2Id : match.team1Id;
        opponentTeams.add(opponentId);
      });
      if (opponentTeams.size >= 3) {
        totalBonus += 1;
      }
    });

    // Variety Bonus Type 2: +1 per month for playing at 3+ different NTRP levels
    tournamentMonths.forEach(monthKey => {
      const monthMatches = matchesByMonth[monthKey] || [];
      const levels = new Set();
      monthMatches.forEach(match => {
        if (match.level) levels.add(match.level);
      });
      if (levels.size >= 3) {
        totalBonus += 1;
      }
    });

    // Mixed Doubles Bonus: +1 per month for at least 2 mixed doubles matches
    tournamentMonths.forEach(monthKey => {
      const monthMatches = matchesByMonth[monthKey] || [];
      let mixedDoublesCount = 0;

      monthMatches.forEach(match => {
        const teamPlayers = match.team1Id === teamId ? match.team1Players : match.team2Players;
        if (teamPlayers && teamPlayers.length > 0) {
          const playerGenders = teamPlayers.map(playerId => {
            const player = players.find(p => p.id === playerId);
            return player ? player.gender : null;
          }).filter(g => g !== null);

          const hasMale = playerGenders.includes('M');
          const hasFemale = playerGenders.includes('F');

          if (hasMale && hasFemale) {
            mixedDoublesCount++;
          }
        }
      });

      if (mixedDoublesCount >= 2) {
        totalBonus += 1;
      }
    });

    // Manual bonus entries (if still used)
    bonusEntries.filter(b => b.teamId === teamId).forEach(bonus => {
      totalBonus += bonus.points;
    });

    // Team Spirit Bonuses
    if (team && team.bonuses) {
      // Uniform bonus (season-long)
      const uniformBonus = getUniformBonus(team.bonuses.uniformType, team.bonuses.uniformPhotoSubmitted);
      totalBonus += uniformBonus;

      // Practice bonus (monthly)
      const practiceBonus = getPracticeBonus(team.bonuses.practices);
      totalBonus += practiceBonus;
    }

    return Math.max(0, totalBonus);
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
        const month = matchDate.getMonth();
        
        if (month === 0) {
          matchWinPoints += 4;
        } else if (month === 10 || month === 11) {
          matchWinPoints += 2;
        } else {
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
      <LoginModal
        showLogin={showLogin}
        loginName={loginName}
        setLoginName={setLoginName}
        loginPassword={loginPassword}
        setLoginPassword={setLoginPassword}
        loginRole={loginRole}
        setLoginRole={setLoginRole}
        handleLogin={handleLogin}
        setShowLogin={setShowLogin}
        tournamentDirectors={TOURNAMENT_DIRECTORS}
      />

      <div className="max-w-7xl mx-auto">
        <Header
          isAuthenticated={isAuthenticated}
          loginName={loginName}
          userRole={userRole}
          saveStatus={saveStatus}
          handleLogout={handleLogout}
          setShowLogin={setShowLogin}
        />

        <TabNavigation
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          userRole={userRole}
          isAuthenticated={isAuthenticated}
        />

        <div className="space-y-6">
          {activeTab === 'leaderboard' && (
            <Leaderboard
              teams={teams}
              getLeaderboard={getLeaderboard}
              photos={photos}
              isAuthenticated={isAuthenticated}
              onDeletePhoto={handleDeletePhoto}
            />
          )}

          {activeTab === 'teams' && (
            <TeamsManagement
              teams={teams}
              setTeams={setTeams}
              players={players}
              setPlayers={setPlayers}
              isAuthenticated={isAuthenticated}
              calculateTeamRatings={calculateTeamRatings}
              getEffectiveRating={getEffectiveRating}
            />
          )}

          {activeTab === 'players' && (
            <PlayerManagement
              players={players}
              setPlayers={setPlayers}
              teams={teams}
              isAuthenticated={isAuthenticated}
              getEffectiveRating={getEffectiveRating}
              canAddPlayerToTeam={canAddPlayerToTeam}
            />
          )}

          {activeTab === 'captains' && (
            <CaptainManagement
              captains={captains}
              setCaptains={setCaptains}
              teams={teams}
              isAuthenticated={isAuthenticated}
            />
          )}

          {activeTab === 'entry' && (
            <MatchEntry
              teams={teams}
              matches={matches}
              setMatches={setMatches}
              isAuthenticated={isAuthenticated}
              setActiveTab={setActiveTab}
              players={players}
              captains={captains}
              onAddPhoto={handleAddPhoto}
              loginName={loginName}
              userRole={userRole}
              userTeamId={userTeamId}
            />
          )}

          {activeTab === 'matches' && (
            <MatchHistory
              matches={matches}
              setMatches={setMatches}
              teams={teams}
              isAuthenticated={isAuthenticated}
              setActiveTab={setActiveTab}
              players={players}
              userRole={userRole}
              userTeamId={userTeamId}
            />
          )}
        </div>

        <TournamentRules />
      </div>
    </div>
  );
};

export default App;