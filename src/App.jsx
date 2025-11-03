import React, { useState, useEffect } from 'react';
import { RefreshCw } from 'lucide-react';
import { tournamentStorage } from './services/storage';
import { createLogEntry, ACTION_TYPES } from './services/activityLogger';
import Header from './components/Header';
import TabNavigation from './components/TabNavigation';
import LoginModal from './components/LoginModal';
import Leaderboard from './components/Leaderboard';
import TeamsManagement from './components/TeamsManagement';
import PlayerManagement from './components/PlayerManagement';
import CaptainManagement from './components/CaptainManagement';
import MatchEntry from './components/MatchEntry';
import MatchHistory from './components/MatchHistory';
import MediaGallery from './components/MediaGallery';
import ActivityLog from './components/ActivityLog';
import TournamentRules from './components/TournamentRules';
import DataSyncManager from './components/DataSyncManager';
import ConflictResolutionModal from './components/ConflictResolutionModal';

const App = () => {
  const [teams, setTeams] = useState([]);
  const [matches, setMatches] = useState([]);
  const [bonusEntries, setBonusEntries] = useState([]);
  const [players, setPlayers] = useState([]);
  const [trades, setTrades] = useState([]);
  const [photos, setPhotos] = useState([]);
  const [captains, setCaptains] = useState([]);
  const [activityLogs, setActivityLogs] = useState([]);
  const [activeTab, setActiveTab] = useState('leaderboard');
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  const [loginName, setLoginName] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginRole, setLoginRole] = useState('director');
  const [userRole, setUserRole] = useState('');
  const [userTeamId, setUserTeamId] = useState(null);
  const [saveStatus, setSaveStatus] = useState('');
  const [editingMatch, setEditingMatch] = useState(null);

  const [dataVersions, setDataVersions] = useState({});
  const [activeSessions, setActiveSessions] = useState([]);
  const [importLock, setImportLock] = useState(null);
  const [lastDataLoad, setLastDataLoad] = useState(null);
  const [conflictData, setConflictData] = useState(null);

  const TOURNAMENT_DIRECTORS = [
    { username: 'cctdir', password: 'cct2025$', name: 'Tournament Director', role: 'director' }
  ];

  const addLog = async (action, details, entityId = null, before = null, after = null) => {
    try {
      const user = loginName || 'System';
      const logEntry = createLogEntry(action, user, details, entityId, before, after);
      await tournamentStorage.addActivityLog(logEntry);
    } catch (error) {
      console.error('Error adding activity log:', error);
    }
  };

  const checkImportLock = async () => {
    try {
      const lock = await tournamentStorage.getImportLock();
      setImportLock(lock);
      return lock;
    } catch (error) {
      console.error('Error checking import lock:', error);
      return null;
    }
  };

  const updateSessionActivity = async () => {
    if (isAuthenticated && loginName) {
      try {
        await tournamentStorage.updateSessionActivity(loginName);
      } catch (error) {
        console.error('Error updating session activity:', error);
      }
    }
  };

  const loadAllData = async () => {
    console.log('🔵 loadAllData() called');
    console.log('Current state before load:', { 
      playersCount: players.length, 
      teamsCount: teams.length,
      matchesCount: matches.length,
      captainsCount: captains.length,
      photosCount: photos.length
    });
    
    try {
      const versions = {};

      console.log('📥 Fetching teams data from Firebase...');
      const teamsData = await tournamentStorage.getTeams();
      console.log('Teams data received:', teamsData ? 'YES' : 'NO/NULL');
      
      if (teamsData) {
        versions.teams = teamsData.updatedAt;
        
        if (!teamsData.data || teamsData.data === 'undefined' || teamsData.data === 'null') {
          console.error('❌ Firebase returned invalid data:', teamsData.data);
          console.log('⚪ Initializing empty teams/players/trades due to corrupt data');
          setPlayers([]);
          setTeams([]);
          setTrades([]);
        } else {
          const parsed = JSON.parse(teamsData.data);
          console.log('Parsed teams data:', {
            players: parsed.players?.length || 0,
            teams: parsed.teams?.length || 0,
            trades: parsed.trades?.length || 0
          });

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
        }
      } else {
        if (players.length === 0 && teams.length === 0 && trades.length === 0) {
          console.log('⚪ First load - initializing empty teams/players/trades');
          setPlayers([]);
          setTeams([]);
          setTrades([]);
        } else {
          console.warn('⚠️ Firebase returned no teams data but we have existing state - keeping it to prevent data loss');
          console.warn('Existing state:', { players: players.length, teams: teams.length, trades: trades.length });
        }
      }

      console.log('📥 Fetching matches data from Firebase...');
      const matchesData = await tournamentStorage.getMatches();
      console.log('Matches data received:', matchesData ? 'YES' : 'NO/NULL');
      
      if (matchesData) {
        versions.matches = matchesData.updatedAt;
        const parsedMatches = JSON.parse(matchesData.data);
        console.log('Parsed matches:', parsedMatches.length);
        setMatches(parsedMatches);
      } else {
        if (matches.length === 0) {
          console.log('⚪ First load - initializing empty matches');
          setMatches([]);
        } else {
          console.warn('⚠️ Firebase returned no matches data but we have existing state - keeping it');
        }
      }

      console.log('📥 Fetching bonuses data from Firebase...');
      const bonusData = await tournamentStorage.getBonuses();
      console.log('Bonuses data received:', bonusData ? 'YES' : 'NO/NULL');
      
      if (bonusData) {
        versions.bonuses = bonusData.updatedAt;
        setBonusEntries(JSON.parse(bonusData.data));
      } else {
        if (bonusEntries.length === 0) {
          console.log('⚪ First load - initializing empty bonuses');
          setBonusEntries([]);
        } else {
          console.warn('⚠️ Firebase returned no bonus data but we have existing state - keeping it');
        }
      }

      console.log('📥 Fetching photos data from Firebase...');
      const photosData = await tournamentStorage.getPhotos();
      console.log('Photos data received:', photosData ? 'YES' : 'NO/NULL');
      
      if (photosData) {
        versions.photos = photosData.updatedAt;
        setPhotos(JSON.parse(photosData.data));
      } else {
        if (photos.length === 0) {
          console.log('⚪ First load - initializing empty photos');
          setPhotos([]);
        } else {
          console.warn('⚠️ Firebase returned no photos data but we have existing state - keeping it');
        }
      }

      console.log('📥 Fetching captains data from Firebase...');
      const captainsData = await tournamentStorage.getCaptains();
      console.log('Captains data received:', captainsData ? 'YES' : 'NO/NULL');
      
      if (captainsData) {
        versions.captains = captainsData.updatedAt;
        setCaptains(JSON.parse(captainsData.data));
      } else {
        if (captains.length === 0) {
          console.log('⚪ First load - initializing empty captains');
          setCaptains([]);
        } else {
          console.warn('⚠️ Firebase returned no captains data but we have existing state - keeping it');
        }
      }

      const logsData = await tournamentStorage.getActivityLogs(100);
      if (logsData) setActivityLogs(logsData);

      setDataVersions(versions);
      setLastDataLoad(new Date().toISOString());

      console.log('✅ loadAllData() completed successfully');
      setSaveStatus('Data loaded');
      return true;
    } catch (error) {
      console.error('❌ Error loading data:', error);
      console.warn('⚠️ Error loading data - keeping existing state to prevent data loss');
      return false;
    }
  };

  const handleRefreshData = async () => {
    setLoading(true);
    try {
      await loadAllData();
      await checkImportLock();

      const sessions = await tournamentStorage.getActiveSessions();
      setActiveSessions(sessions || []);

      alert('Data refreshed successfully!');
    } catch (error) {
      console.error('Error refreshing data:', error);
      alert('Error refreshing data. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const setImportLockHelper = async (operation) => {
    if (loginName) {
      const lock = await tournamentStorage.setImportLock(loginName, operation);
      setImportLock(lock);
      return lock;
    }
  };

  const releaseImportLockHelper = async () => {
    await tournamentStorage.releaseImportLock();
    setImportLock(null);
  };

  // AUTO-SAVE DISABLED TO PREVENT DATA LOSS
  // Manually save using handleManualSave() instead
  
  const handleManualSave = async () => {
    console.log('🟢 MANUAL SAVE called');
    console.log('Data being saved:', { 
      players: players.length, 
      teams: teams.length,
      trades: trades.length,
      matches: matches.length,
      bonusEntries: bonusEntries.length,
      photos: photos.length,
      captains: captains.length
    });
    
    if (loading) {
      alert('Please wait, data is still loading...');
      return;
    }

    try {
      setSaveStatus('Saving...');
      
      console.log('💾 Saving teams/players/trades to Firebase...');
      await tournamentStorage.setTeams(JSON.stringify({ players, teams, trades }));
      
      console.log('💾 Saving matches to Firebase...');
      await tournamentStorage.setMatches(JSON.stringify(matches));
      
      console.log('💾 Saving bonuses to Firebase...');
      await tournamentStorage.setBonuses(JSON.stringify(bonusEntries));
      
      console.log('💾 Saving photos to Firebase...');
      await tournamentStorage.setPhotos(JSON.stringify(photos));
      
      console.log('💾 Saving captains to Firebase...');
      await tournamentStorage.setCaptains(JSON.stringify(captains));
      
      console.log('✅ All data saved successfully!');
      setSaveStatus('✅ Saved ' + new Date().toLocaleTimeString());
      alert('All data saved successfully!');
    } catch (error) {
      console.error('❌ Error saving:', error);
      setSaveStatus('❌ Save failed');
      alert('Error saving data: ' + error.message);
    }
  };

  useEffect(() => {
    const loadData = async () => {
      try {
        await loadAllData();

        const authData = await tournamentStorage.getAuthSession();
        if (authData) {
          const session = JSON.parse(authData.data);
          const now = Date.now();
          const expiresAt = new Date(session.expiresAt).getTime();

          if (now < expiresAt) {
            setIsAuthenticated(true);
            setLoginName(session.name);
            setUserRole(session.role || 'director');
            setUserTeamId(session.teamId || null);

            if (session.role === 'director') {
              await tournamentStorage.setActiveSession(session.name, 'director');
            }
          } else {
            tournamentStorage.deleteAuthSession();
          }
        }

        const sessions = await tournamentStorage.getActiveSessions();
        setActiveSessions(sessions || []);

        await checkImportLock();

      } catch (error) {
        console.error('Error loading data:', error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  useEffect(() => {
    const checkSessionValidity = async () => {
      if (isAuthenticated) {
        const authData = await tournamentStorage.getAuthSession();
        if (authData) {
          const session = JSON.parse(authData.data);
          const now = Date.now();
          const expiresAt = new Date(session.expiresAt).getTime();

          if (now >= expiresAt) {
            setIsAuthenticated(false);
            setLoginName('');
            setUserRole('');
            setUserTeamId(null);
            tournamentStorage.deleteAuthSession();
            setActiveTab('leaderboard');
            alert('Your session has expired due to inactivity. Please log in again.');
          }
        } else {
          setIsAuthenticated(false);
          setLoginName('');
          setUserRole('');
          setUserTeamId(null);
          setActiveTab('leaderboard');
        }
      }
    };

    const intervalId = setInterval(checkSessionValidity, 60 * 1000);

    return () => clearInterval(intervalId);
  }, [isAuthenticated]);

  const handleLogin = () => {
    const normalizedUsername = loginName.trim();

    if (loginRole === 'director') {
      const director = TOURNAMENT_DIRECTORS.find(d => 
        d.username === normalizedUsername && 
        d.password === loginPassword
      );

      if (director) {
        setIsAuthenticated(true);
        setUserRole('director');
        setUserTeamId(null);
        const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();
        tournamentStorage.setAuthSession(JSON.stringify({
          username: director.username,
          name: director.name,
          role: 'director',
          teamId: null,
          timestamp: new Date().toISOString(),
          expiresAt: expiresAt
        }));
        setLoginName(director.name);

        tournamentStorage.setActiveSession(director.name, 'director').then(() => {
          alert('Welcome, ' + director.name + '!');
        });

        const logEntry = createLogEntry(
          ACTION_TYPES.USER_LOGIN,
          director.name,
          { role: 'director', username: director.username }
        );
        tournamentStorage.addActivityLog(logEntry);

        setShowLogin(false);
        setLoginPassword('');
      } else {
        alert('Invalid username or password.');
      }
    } else if (loginRole === 'captain') {
      const captain = captains.find(c =>
        c.username === normalizedUsername &&
        c.password === loginPassword &&
        c.status === 'active'
      );

      if (captain) {
        setIsAuthenticated(true);
        setUserRole('captain');
        setUserTeamId(captain.teamId);
        const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();
        tournamentStorage.setAuthSession(JSON.stringify({
          username: captain.username,
          name: captain.name,
          role: 'captain',
          teamId: captain.teamId,
          timestamp: new Date().toISOString(),
          expiresAt: expiresAt
        }));
        setLoginName(captain.name);

        const team = teams.find(t => t.id === captain.teamId);
        const logEntry = createLogEntry(
          ACTION_TYPES.USER_LOGIN,
          captain.name,
          { role: 'captain', username: captain.username, teamName: team?.name || 'Unassigned' }
        );
        tournamentStorage.addActivityLog(logEntry);

        setShowLogin(false);
        setLoginPassword('');
        setActiveTab('entry');

        if (!captain.teamId) {
          alert('Welcome, Captain ' + captain.name + '!\n\nYou are not currently assigned to a team. Please contact the tournament directors to be assigned to a team before you can enter matches.');
        } else {
          alert('Welcome, Captain ' + captain.name + '!');
        }
      } else {
        alert('Invalid username or password.');
      }
    }
  };

  const handleLogout = async () => {
    const logEntry = createLogEntry(
      ACTION_TYPES.USER_LOGOUT,
      loginName || 'Unknown',
      { role: userRole }
    );
    await tournamentStorage.addActivityLog(logEntry);

    if (loginName) {
      await tournamentStorage.removeActiveSession(loginName);
    }

    setIsAuthenticated(false);
    setLoginName('');
    setUserRole('');
    setUserTeamId(null);
    setLoginPassword('');
    tournamentStorage.deleteAuthSession();
    setActiveSessions([]);
    setActiveTab('leaderboard');
  };

  const handleDeletePhoto = (photoId) => {
    setPhotos(photos.filter(p => p.id !== photoId));
  };

  const handleAddPhoto = (photoData) => {
    let updatedPhotos = [...photos];
    if (updatedPhotos.length >= 50) {
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
    const totalPlayers = ratings.menCount + ratings.womenCount;

    if (totalPlayers >= 9) {
      return { allowed: false, reason: 'Team already has 9 players (maximum roster size)' };
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
      total += Math.min(count * 0.5, 2);
    });
    return total;
  };

  const calculateBonusPoints = (teamId) => {
    const team = teams.find(t => t.id === teamId);

    const teamMatches = matches.filter(m => m.team1Id === teamId || m.team2Id === teamId);
    const matchesByMonth = {};

    const tournamentMonths = ['2025-10', '2025-11', '2026-0'];

    teamMatches.forEach(match => {
      const date = new Date(match.date);
      const monthKey = date.getFullYear() + '-' + date.getMonth();

      if (tournamentMonths.includes(monthKey)) {
        if (!matchesByMonth[monthKey]) matchesByMonth[monthKey] = [];
        matchesByMonth[monthKey].push(match);
      }
    });

    let totalBonus = 0;

    tournamentMonths.forEach(monthKey => {
      const count = matchesByMonth[monthKey] ? matchesByMonth[monthKey].length : 0;
      if (count >= 5) totalBonus += 1;
      if (count >= 10) totalBonus += 2;
      if (count >= 15) totalBonus += 3;
      if (count >= 20) totalBonus += 4;
      if (count < 4) totalBonus -= 4;
    });

    tournamentMonths.forEach(monthKey => {
      const monthMatches = matchesByMonth[monthKey] || [];
      if (monthMatches.length > 0) {
        const uniquePlayers = new Set();
        monthMatches.forEach(match => {
          const teamPlayers = match.team1Id === teamId ? match.team1Players : match.team2Players;
          (teamPlayers || []).forEach(playerId => uniquePlayers.add(playerId));
        });

        const teamPlayers = players.filter(p => p.teamId === teamId && p.status === 'active');
        if (teamPlayers.length === 9 && uniquePlayers.size === 9) {
          totalBonus += 1;
        }
      }
    });

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

    bonusEntries.filter(b => b.teamId === teamId).forEach(bonus => {
      totalBonus += bonus.points;
    });

    if (team && team.bonuses) {
      const uniformBonus = getUniformBonus(team.bonuses.uniformType, team.bonuses.uniformPhotoSubmitted);
      totalBonus += uniformBonus;

      const practiceBonus = getPracticeBonus(team.bonuses.practices);
      totalBonus += practiceBonus;
    }

    return Math.max(0, totalBonus);
  };

  const calculateTeamPoints = (teamId) => {
    const teamMatches = matches.filter(m => m.team1Id === teamId || m.team2Id === teamId);

    let matchWinPoints = 0;
    let matchWins = 0;
    let matchLosses = 0;
    let setsWon = 0;
    let gamesWon = 0;

    teamMatches.forEach(match => {
      const isTeam1 = match.team1Id === teamId;
      const won = isTeam1 ? match.winner === 'team1' : match.winner === 'team2';

      if (won) {
        matchWins++;
        const matchDate = new Date(match.date);
        const month = matchDate.getMonth();

        if (month === 0) {
          matchWinPoints += 4;
        } else if (month === 10 || month === 11) {
          matchWinPoints += 2;
        } else {
          matchWinPoints += 2;
        }
      } else {
        matchLosses++;
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
      matchWins,
      matchLosses,
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
          onManualSave={handleManualSave}
        />

        <TabNavigation
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          userRole={userRole}
          isAuthenticated={isAuthenticated}
        />

        <DataSyncManager
          isAuthenticated={isAuthenticated}
          userRole={userRole}
          loginName={loginName}
          activeSessions={activeSessions}
          importLock={importLock}
          lastDataLoad={lastDataLoad}
          onRefresh={handleRefreshData}
          onUpdateActivity={updateSessionActivity}
        />

        <ConflictResolutionModal
          conflict={conflictData}
          onReload={handleRefreshData}
          onOverwrite={() => {
            setConflictData(null);
          }}
          onCancel={() => setConflictData(null)}
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
              captains={captains}
              setCaptains={setCaptains}
              isAuthenticated={isAuthenticated}
              calculateTeamRatings={calculateTeamRatings}
              getEffectiveRating={getEffectiveRating}
              addLog={addLog}
            />
          )}

          {activeTab === 'players' && (
            <PlayerManagement
              players={players}
              setPlayers={setPlayers}
              teams={teams}
              captains={captains}
              setCaptains={setCaptains}
              isAuthenticated={isAuthenticated}
              getEffectiveRating={getEffectiveRating}
              canAddPlayerToTeam={canAddPlayerToTeam}
              addLog={addLog}
              importLock={importLock}
              setImportLock={setImportLockHelper}
              releaseImportLock={releaseImportLockHelper}
            />
          )}

          {activeTab === 'captains' && (
            <CaptainManagement
              captains={captains}
              setCaptains={setCaptains}
              teams={teams}
              setTeams={setTeams}
              players={players}
              isAuthenticated={isAuthenticated}
              addLog={addLog}
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
              editingMatch={editingMatch}
              setEditingMatch={setEditingMatch}
              addLog={addLog}
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
              setEditingMatch={setEditingMatch}
              addLog={addLog}
            />
          )}

          {activeTab === 'media' && (
            <MediaGallery
              photos={photos}
              teams={teams}
              isAuthenticated={isAuthenticated}
              userRole={userRole}
              onAddPhoto={handleAddPhoto}
              onDeletePhoto={handleDeletePhoto}
              maxPhotos={50}
            />
          )}

          {activeTab === 'activity' && (
            <ActivityLog
              logs={activityLogs}
              onRefresh={(newLogs) => setActivityLogs(newLogs)}
            />
          )}
        </div>

        <TournamentRules />
      </div>
    </div>
  );
};

export default App;