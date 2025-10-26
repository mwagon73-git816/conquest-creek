import React, { useState, useEffect } from 'react';
import { RefreshCw } from 'lucide-react';
import { tournamentStorage } from './services/storage';
import Header from './components/Header';
import TabNavigation from './components/TabNavigation';
import LoginModal from './components/LoginModal';
import Leaderboard from './components/Leaderboard';
import TeamsManagement from './components/TeamsManagement';
import PlayerManagement from './components/PlayerManagement';
import MatchEntry from './components/MatchEntry';
import MatchHistory from './components/MatchHistory';
import TournamentRules from './components/TournamentRules';

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

  const TOURNAMENT_DIRECTORS = ['matt wagoner', 'john nguyen'];

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
        handleLogin={handleLogin}
        setShowLogin={setShowLogin}
        tournamentDirectors={TOURNAMENT_DIRECTORS}
      />
      
      <div className="max-w-7xl mx-auto">
        <Header
          isAuthenticated={isAuthenticated}
          loginName={loginName}
          saveStatus={saveStatus}
          handleLogout={handleLogout}
          setShowLogin={setShowLogin}
        />

        <TabNavigation activeTab={activeTab} setActiveTab={setActiveTab} />

        <div className="space-y-6">
          {activeTab === 'leaderboard' && (
            <Leaderboard teams={teams} getLeaderboard={getLeaderboard} />
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

          {activeTab === 'entry' && (
            <MatchEntry
              teams={teams}
              matches={matches}
              setMatches={setMatches}
              isAuthenticated={isAuthenticated}
              setActiveTab={setActiveTab}
              players={players}
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
            />
          )}
        </div>

        <TournamentRules />
      </div>
    </div>
  );
};

export default App;