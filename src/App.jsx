import React, { useState, useEffect, useCallback } from 'react';
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { RefreshCw, Check } from 'lucide-react';
import { tournamentStorage } from './services/storage';
import { subscribeToMatches } from './services/matchService';
import { createLogEntry, ACTION_TYPES } from './services/activityLogger';
import { getPendingRedirect, clearRedirectIntent } from './utils/redirectManager';
import { MATCH_TYPES, getMatchType } from './utils/matchUtils';
import Header from './components/Header';
import TabNavigation from './components/TabNavigation';
import LoginModal from './components/LoginModal';
import Leaderboard from './components/Leaderboard';
import TeamsManagement from './components/TeamsManagement';
import PlayerManagement from './components/PlayerManagement';
import CaptainManagement from './components/CaptainManagement';
import ChallengeManagement from './components/ChallengeManagement';
import MatchEntry from './components/MatchEntry';
import MatchHistory from './components/MatchHistory';
import Matches from './components/Matches';
import MediaGallery from './components/MediaGallery';
import ActivityLog from './components/ActivityLog';
import MigrationButton from './components/MigrationButton';
import ChallengesMigrationTool from './components/ChallengesMigrationTool';
import MatchesMigrationTool from './components/MatchesMigrationTool';
import TeamsDataMigrationTool from './components/TeamsDataMigrationTool';
import TournamentRules from './components/TournamentRules';
import DataSyncManager from './components/DataSyncManager';
import ConflictResolutionModal from './components/ConflictResolutionModal';
import ChallengePage from './components/ChallengePage';
import BonusAudit from './components/BonusAudit';

const App = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const [teams, setTeams] = useState([]);
  const [matches, setMatches] = useState([]);
  const [bonusEntries, setBonusEntries] = useState([]);
  const [players, setPlayers] = useState([]);
  const [trades, setTrades] = useState([]);
  const [photos, setPhotos] = useState([]);
  const [captains, setCaptains] = useState([]);
  const [challenges, setChallenges] = useState([]);
  const [activityLogs, setActivityLogs] = useState([]);
  const [activeTab, setActiveTab] = useState('leaderboard');
  const [unsavedChanges, setUnsavedChanges] = useState({ teams: false, players: false });
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  const [loginName, setLoginName] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginRole, setLoginRole] = useState('captain');
  const [userRole, setUserRole] = useState('');
  const [userTeamId, setUserTeamId] = useState(null);
  const [saveStatus, setSaveStatus] = useState('');
  const [editingMatch, setEditingMatch] = useState(null);
  const [autoAcceptChallengeId, setAutoAcceptChallengeId] = useState(null);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

  const [dataVersions, setDataVersions] = useState({});
  const [activeSessions, setActiveSessions] = useState([]);
  const [importLock, setImportLock] = useState(null);
  const [lastDataLoad, setLastDataLoad] = useState(null);
  const [conflictData, setConflictData] = useState(null);

  const TOURNAMENT_DIRECTORS = [
    { username: 'cctdir', password: 'cct2025$', name: 'Tournament Director', role: 'director' }
  ];

  // Navigation guard - check for unsaved changes before switching tabs
  const handleTabChange = async (newTab) => {
    const currentTab = activeTab;

    // Check if current tab has unsaved changes
    const hasUnsaved = unsavedChanges[currentTab];

    if (hasUnsaved) {
      const userChoice = window.confirm(
        'You have unsaved changes. Would you like to save before leaving?\n\n' +
        'Click OK to save and continue, or Cancel to stay on this page.'
      );

      if (userChoice) {
        // User wants to save
        try {
          setSaveStatus('Saving...');
          await handleManualSave();
          setSaveStatus('Saved!');
          setTimeout(() => setSaveStatus(''), 2000);

          // Clear unsaved flag for this tab
          setUnsavedChanges(prev => ({ ...prev, [currentTab]: false }));

          // Navigate to new tab
          setActiveTab(newTab);
        } catch (error) {
          console.error('Error saving:', error);
          setSaveStatus('Save failed');
          alert('Failed to save changes. Please try again.');
          return; // Don't navigate if save failed
        }
      }
      // If user clicks Cancel, stay on current page (do nothing)
    } else {
      // No unsaved changes, navigate freely
      setActiveTab(newTab);
    }
  };

  // Memoized callbacks to prevent infinite loops in child components
  const handleTeamsUnsavedChanges = useCallback((hasChanges) => {
    setUnsavedChanges(prev => ({ ...prev, teams: hasChanges }));
  }, []);

  const handlePlayersUnsavedChanges = useCallback((hasChanges) => {
    setUnsavedChanges(prev => ({ ...prev, players: hasChanges }));
  }, []);

  const addLog = async (action, details, entityId = null, before = null, after = null) => {
    try {
      const user = loginName || 'System';
      const role = userRole || 'unknown';
      const logEntry = createLogEntry(action, user, details, entityId, before, after, role);
      await tournamentStorage.addActivityLog(logEntry);
    } catch (error) {
      console.error('Error adding activity log:', error);
      // Don't throw error - logging should never break the main operation
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
          // Handle both old JSON string format and new object format
          let parsed;
          const dataContent = teamsData.data;

          if (typeof dataContent === 'string') {
            // Old format: JSON string
            console.log('📋 Loading teams data (OLD JSON STRING format)');
            try {
              parsed = JSON.parse(dataContent);
            } catch (error) {
              console.error('❌ Failed to parse teams JSON string:', error);
              parsed = { teams: [], players: [], trades: [] };
            }
          } else if (typeof dataContent === 'object' && dataContent !== null) {
            // New format: already an object/map
            console.log('📋 Loading teams data (NEW OBJECT format)');
            parsed = dataContent;
          } else {
            console.error('❌ Unexpected teams data format:', typeof dataContent);
            parsed = { teams: [], players: [], trades: [] };
          }

          console.log('📋 Loaded teams data:', {
            players: parsed.players?.length || 0,
            teams: parsed.teams?.length || 0,
            trades: parsed.trades?.length || 0
          });

          // Extract teams with bonuses
          if (parsed.teams && Array.isArray(parsed.teams)) {
            const teamsWithBonuses = parsed.teams.map(team => ({
              ...team,
              bonuses: team.bonuses || {
                uniformType: 'none',
                uniformPhotoSubmitted: false,
                practices: {}
              }
            }));
            setTeams(teamsWithBonuses);
            console.log('✅ Set teams:', teamsWithBonuses.length);
          } else {
            console.warn('⚠️ No teams array found in data');
            setTeams([]);
          }

          // Extract players
          if (parsed.players && Array.isArray(parsed.players)) {
            setPlayers(parsed.players);
            console.log('✅ Set players:', parsed.players.length);
          } else {
            console.warn('⚠️ No players array found in data');
            setPlayers([]);
          }

          // Extract trades
          if (parsed.trades && Array.isArray(parsed.trades)) {
            setTrades(parsed.trades);
            console.log('✅ Set trades:', parsed.trades.length);
          } else {
            console.log('⚪ No trades array found in data (initializing empty)');
            setTrades([]);
          }
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

      // REMOVED: Matches now loaded via real-time subscriptions in MatchHistory.jsx
      console.log('⏭️ Skipping matches blob loading - using real-time subscriptions');

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

      console.log('📥 ===== LOADING PHOTOS FROM FIREBASE =====');
      const photosData = await tournamentStorage.getPhotos();
      console.log('📥 Photos data received from Firestore:', photosData ? 'YES' : 'NO/NULL');

      if (photosData) {
        versions.photos = photosData.updatedAt;
        console.log('📥 Photos version:', photosData.updatedAt);
        console.log('📥 Raw photos data string (first 200 chars):', photosData.data.substring(0, 200));

        const parsedPhotos = JSON.parse(photosData.data);
        console.log('📥 Parsed photos count:', parsedPhotos.length);
        console.log('📥 Sample of loaded photos (first photo):');
        if (parsedPhotos.length > 0) {
          console.log(JSON.stringify(parsedPhotos[0], null, 2));
          console.log('📥 First photo metadata check:');
          console.log('  - Has caption?', parsedPhotos[0].caption);
          console.log('  - Has team1Id?', parsedPhotos[0].team1Id);
          console.log('  - Has team1Name?', parsedPhotos[0].team1Name);
          console.log('  - Has team2Id?', parsedPhotos[0].team2Id);
          console.log('  - Has team2Name?', parsedPhotos[0].team2Name);
          console.log('  - Has matchDate?', parsedPhotos[0].matchDate);
        }
        console.log('📥 =========================================');

        setPhotos(parsedPhotos);
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

      // REMOVED: Challenges now loaded via real-time subscriptions in ChallengeManagement component
      // No need to load from blob storage - challenges use individual document architecture
      console.log('⏭️ Skipping challenges blob loading - using real-time subscriptions');

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

      alert('✅ Data refreshed successfully!\n\nYou are now viewing the latest information.');
    } catch (error) {
      console.error('Error refreshing data:', error);
      alert('❌ Error refreshing data.\n\nPlease check your connection and try again.');
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
      captains: captains.length,
      challenges: challenges.length
    });
    console.log('Current data versions:', dataVersions);

    if (loading) {
      alert('⚠️ Please wait, data is still loading.\n\nTry again in a moment.');
      return;
    }

    try {
      setSaveStatus('Saving...');
      const newVersions = {};

      console.log('💾 Saving teams/players/trades to Firebase...');
      const teamsResult = await tournamentStorage.setTeams(
        JSON.stringify({ players, teams, trades }),
        dataVersions.teams
      );

      if (teamsResult && !teamsResult.success && teamsResult.conflict) {
        console.warn('⚠️ Conflict detected in teams data');
        setConflictData({
          ...teamsResult,
          dataType: 'teams',
          localData: { players, teams, trades }
        });
        setSaveStatus('❌ Conflict detected');
        alert('⚠️ Data Conflict Detected!\n\nAnother user has modified the teams data since you loaded it.\n\nPlease refresh the page to see the latest changes, then try your edit again.');
        return;
      }
      if (teamsResult?.success) newVersions.teams = teamsResult.version;

      // REMOVED: Matches now auto-save via matchService with individual documents
      console.log('⏭️ Skipping matches blob save - using auto-save with individual documents');

      console.log('💾 Saving bonuses to Firebase...');
      const bonusesResult = await tournamentStorage.setBonuses(
        JSON.stringify(bonusEntries),
        dataVersions.bonuses
      );

      if (bonusesResult && !bonusesResult.success && bonusesResult.conflict) {
        console.warn('⚠️ Conflict detected in bonuses data');
        setSaveStatus('❌ Conflict detected');
        alert('⚠️ Data Conflict Detected!\n\nAnother user has modified the bonuses data since you loaded it.\n\nPlease refresh the page to see the latest changes.');
        return;
      }
      if (bonusesResult?.success) newVersions.bonuses = bonusesResult.version;

      console.log('💾 ===== SAVING PHOTOS TO FIREBASE =====');
      console.log('💾 Photos count being saved:', photos.length);
      console.log('💾 Sample of photos being saved (first photo):');
      if (photos.length > 0) {
        console.log(JSON.stringify(photos[0], null, 2));
      }
      console.log('💾 Full photos array:', JSON.stringify(photos, null, 2));
      console.log('💾 ======================================');

      const photosResult = await tournamentStorage.setPhotos(
        JSON.stringify(photos),
        dataVersions.photos
      );

      if (photosResult && !photosResult.success && photosResult.conflict) {
        console.warn('⚠️ Conflict detected in photos data');
        setSaveStatus('❌ Conflict detected');
        alert('⚠️ Data Conflict Detected!\n\nAnother user has modified the photos data since you loaded it.\n\nPlease refresh the page to see the latest changes.');
        return;
      }
      if (photosResult?.success) {
        newVersions.photos = photosResult.version;
        console.log('✅ Photos saved successfully to Firestore. Version:', photosResult.version);
      }

      console.log('💾 Saving captains to Firebase...');
      const captainsResult = await tournamentStorage.setCaptains(
        JSON.stringify(captains),
        dataVersions.captains
      );

      if (captainsResult && !captainsResult.success && captainsResult.conflict) {
        console.warn('⚠️ Conflict detected in captains data');
        setSaveStatus('❌ Conflict detected');
        alert('⚠️ Data Conflict Detected!\n\nAnother user has modified the captains data since you loaded it.\n\nPlease refresh the page to see the latest changes.');
        return;
      }
      if (captainsResult?.success) newVersions.captains = captainsResult.version;

      // REMOVED: Challenges now auto-save via challengeService
      // No need to save to blob storage - challenges use individual document architecture
      console.log('⏭️ Skipping challenges blob save - using auto-save with individual documents');

      // Update versions after successful save
      setDataVersions(prev => ({ ...prev, ...newVersions }));
      console.log('✅ Updated data versions:', newVersions);

      console.log('✅ All data saved successfully!');
      setSaveStatus('✅ Saved ' + new Date().toLocaleTimeString());
      alert('✅ All data saved successfully!\n\nChanges have been saved to the database.\n\n' +
            `Saved:\n` +
            `  • ${matches.length} matches\n` +
            `  • ${teams.length} teams\n` +
            `  • ${players.length} players\n\n` +
            `Note: Challenges are now auto-saved and don't require manual saving.`);
    } catch (error) {
      console.error('❌ Error saving:', error);
      setSaveStatus('❌ Save failed');
      alert('❌ Error saving data.\n\n' + error.message + '\n\nPlease try again or contact support if the problem persists.');
    }
  };

  // Individual save functions with validation for components
  const saveTeamsWithValidation = async (updatedTeams, updatedPlayers, updatedTrades, expectedVersion) => {
    try {
      const result = await tournamentStorage.saveWithValidation(
        'teams',
        { players: updatedPlayers || players, teams: updatedTeams, trades: updatedTrades || trades },
        expectedVersion || dataVersions.teams,
        false
      );

      if (result.success) {
        setTeams(updatedTeams);
        if (updatedPlayers) setPlayers(updatedPlayers);
        if (updatedTrades) setTrades(updatedTrades);
        setDataVersions(prev => ({ ...prev, teams: result.version }));
        return { success: true, version: result.version };
      } else if (result.conflict) {
        return { success: false, conflict: true, message: result.message, currentVersion: result.version };
      } else {
        return { success: false, message: result.message };
      }
    } catch (error) {
      console.error('Error saving teams:', error);
      return { success: false, message: error.message };
    }
  };

  const savePlayersWithValidation = async (updatedPlayers, expectedVersion) => {
    return await saveTeamsWithValidation(teams, updatedPlayers, trades, expectedVersion);
  };

  const saveMatchesWithValidation = async (updatedMatches, expectedVersion) => {
    try {
      const result = await tournamentStorage.saveWithValidation(
        'matches',
        updatedMatches,
        expectedVersion || dataVersions.matches,
        false
      );

      if (result.success) {
        setMatches(updatedMatches);
        setDataVersions(prev => ({ ...prev, matches: result.version }));
        return { success: true, version: result.version };
      } else if (result.conflict) {
        return { success: false, conflict: true, message: result.message, currentVersion: result.version };
      } else {
        return { success: false, message: result.message };
      }
    } catch (error) {
      console.error('Error saving matches:', error);
      return { success: false, message: error.message };
    }
  };

  // REMOVED: saveChallengesWithValidation - challenges now auto-save via challengeService

  const saveCaptainsWithValidation = async (updatedCaptains, expectedVersion) => {
    try {
      const result = await tournamentStorage.saveWithValidation(
        'captains',
        updatedCaptains,
        expectedVersion || dataVersions.captains,
        false
      );

      if (result.success) {
        setCaptains(updatedCaptains);
        setDataVersions(prev => ({ ...prev, captains: result.version }));
        return { success: true, version: result.version };
      } else if (result.conflict) {
        return { success: false, conflict: true, message: result.message, currentVersion: result.version };
      } else {
        return { success: false, message: result.message };
      }
    } catch (error) {
      console.error('Error saving captains:', error);
      return { success: false, message: error.message };
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

  // Subscribe to matches from Firestore (replaces blob loading)
  useEffect(() => {
    console.log('🔄 App.jsx: Setting up matches subscription...');

    const unsubscribe = subscribeToMatches(
      (matchesData) => {
        console.log(`📋 App.jsx: Received ${matchesData.length} matches from Firestore`);
        const pending = matchesData.filter(m => m.status === 'pending');
        const completed = matchesData.filter(m => m.status === 'completed');
        console.log(`📋 App.jsx: Pending: ${pending.length}, Completed: ${completed.length}`);
        console.log('📋 App.jsx: Setting matches state for leaderboard calculations');
        setMatches(matchesData);
      },
      (error) => {
        console.error('❌ App.jsx: Failed to load matches:', error);
      }
    );

    return () => {
      console.log('📋 App.jsx: Unsubscribing from matches');
      unsubscribe();
    };
  }, []);

  // Post-login redirect handling - uses new redirectManager for all protected actions
  useEffect(() => {
    if (isAuthenticated) {
      // Check for new redirectManager redirect
      const intent = getPendingRedirect();
      if (intent) {
        console.log('🔄 Processing post-login redirect:', intent);

        // Navigate to saved location with context
        if (intent.context && Object.keys(intent.context).length > 0) {
          // Has context - navigate with state to restore user's action
          navigate(intent.returnTo, {
            state: {
              fromLogin: true,
              context: intent.context
            }
          });
        } else {
          // No context - simple redirect
          navigate(intent.returnTo);
        }
        return;
      }

      // Fallback: Check for old sessionStorage redirect (backward compatibility)
      const returnTo = sessionStorage.getItem('returnTo');
      const returnAction = sessionStorage.getItem('returnAction');

      if (returnTo && returnAction === 'accept-challenge') {
        console.log('🔄 Processing legacy redirect (migrating to new system)');
        sessionStorage.removeItem('returnTo');
        sessionStorage.removeItem('returnAction');
        navigate(returnTo);
      }
    }
  }, [isAuthenticated, navigate]);

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
            alert('Your session has expired due to inactivity.\n\nPlease log in again to continue.');
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
        setActiveTab('leaderboard'); // Navigate to Leaderboard after login
      } else {
        alert('Invalid username or password.\n\nPlease check your credentials and try again.');
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
        setActiveTab('leaderboard'); // Navigate to Leaderboard after login

        if (!captain.teamId) {
          alert('Welcome, Captain ' + captain.name + '!\n\n⚠️ You are not currently assigned to a team.\n\nPlease contact the tournament directors to be assigned to a team before you can enter matches.');
        } else {
          alert('Welcome, Captain ' + captain.name + '!');
        }
      } else {
        alert('Invalid username or password.\n\nPlease check your credentials and try again.');
      }
    }
  };

  const handleLogout = async () => {
    // Check if there are unsaved changes
    const hasUnsaved = Object.values(unsavedChanges).some(val => val === true);

    if (hasUnsaved) {
      const userChoice = window.confirm(
        'You have unsaved changes. If you log out now, these changes will be lost.\n\n' +
        'Click OK to log out anyway, or Cancel to stay logged in and save your changes.'
      );

      if (!userChoice) {
        return; // User cancelled logout
      }
    }

    const logEntry = createLogEntry(
      ACTION_TYPES.USER_LOGOUT,
      loginName || 'Unknown',
      { role: userRole }
    );
    await tournamentStorage.addActivityLog(logEntry);

    if (loginName) {
      await tournamentStorage.removeActiveSession(loginName);
    }

    // Clear any pending redirects on logout
    clearRedirectIntent();

    // Clear unsaved changes flags
    setUnsavedChanges({ teams: false, players: false });

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
    const photo = photos.find(p => p.id === photoId);

    // Log the deletion
    if (photo) {
      const photoInfo = photo.caption ||
                       (photo.team1Name && photo.team2Name ? `${photo.team1Name} vs ${photo.team2Name}` : null) ||
                       'Match photo';

      addLog(
        ACTION_TYPES.PHOTO_DELETED,
        {
          photoInfo,
          photoId,
          uploadDate: photo.uploadTimestamp || photo.matchDate,
          teams: photo.team1Name && photo.team2Name ? `${photo.team1Name} vs ${photo.team2Name}` : null
        },
        photoId,
        photo,
        null
      );
    }

    setPhotos(photos.filter(p => p.id !== photoId));
  };

  // ✅ PHOTO UPLOAD RESTORED - This is a manual user action, NOT auto-save
  // Photos are uploaded immediately when user clicks "Upload" button
  const handleAddPhoto = async (photoData) => {
    try {
      // Add photo to local state immediately
      const newPhotos = [...photos, photoData];
      setPhotos(newPhotos);

      // Save to Firestore immediately (this is NOT auto-save - it's a manual upload action)
      await tournamentStorage.setPhotos(JSON.stringify(newPhotos));

      // Log the upload
      const photoInfo = photoData.caption ||
                       (photoData.team1Name && photoData.team2Name ? `${photoData.team1Name} vs ${photoData.team2Name}` : null) ||
                       'Tournament photo';

      addLog(
        ACTION_TYPES.PHOTO_UPLOADED,
        {
          photoInfo,
          photoId: photoData.id,
          uploadDate: photoData.uploadTimestamp || photoData.matchDate,
          teams: photoData.team1Name && photoData.team2Name ? `${photoData.team1Name} vs ${photoData.team2Name}` : null
        },
        photoData.id,
        null,
        photoData
      );

      return { success: true };
    } catch (error) {
      console.error('Error adding photo:', error);
      // Rollback on error
      setPhotos(photos);
      return { success: false, error: error.message };
    }
  };

  // ⚠️⚠️⚠️ AUTO-SAVE REMOVED - CATASTROPHIC DATA LOSS RISK ⚠️⚠️⚠️
  // handleUpdatePhoto REMOVED - Auto-save caused database wipe 3 times
  // Dates: Nov 24, 2025
  // Reason: Blob storage architecture incompatible with auto-save
  // DO NOT re-implement auto-save unless migrated to granular storage
  // Manual saves with explicit user action are REQUIRED for data safety

  // ⚠️⚠️⚠️ AUTO-SAVE REMOVED - CATASTROPHIC DATA LOSS RISK ⚠️⚠️⚠️
  // handleUpdateTeam REMOVED - Auto-save caused database wipe 3 times
  // Dates: Nov 24, 2025
  // Reason: Blob storage architecture incompatible with auto-save
  // When saving teams, ENTIRE teams array is overwritten as JSON blob
  // If array is corrupted/empty when auto-save triggers → ALL teams deleted
  // DO NOT re-implement auto-save unless migrated to granular storage
  // Manual saves with explicit user action are REQUIRED for data safety

  // ⚠️⚠️⚠️ AUTO-SAVE REMOVED - CATASTROPHIC DATA LOSS RISK ⚠️⚠️⚠️
  // handleUpdatePlayer REMOVED - Auto-save caused database wipe 3 times
  // Dates: Nov 24, 2025
  // Reason: Blob storage architecture incompatible with auto-save
  // When saving players, ENTIRE players array is overwritten as JSON blob
  // If array is corrupted/empty when auto-save triggers → ALL players deleted
  // DO NOT re-implement auto-save unless migrated to granular storage
  // Manual saves with explicit user action are REQUIRED for data safety

  // ⚠️⚠️⚠️ AUTO-SAVE REMOVED - CATASTROPHIC DATA LOSS RISK ⚠️⚠️⚠️
  // handleAddPhoto REMOVED - Auto-save caused database wipe 3 times
  // Dates: Nov 24, 2025
  // Reason: Blob storage architecture incompatible with auto-save
  // DO NOT re-implement auto-save unless migrated to granular storage
  // Manual saves with explicit user action are REQUIRED for data safety

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

  const canAddPlayerToTeam = (player, teamId, isReassignment = false) => {
    // For reassignments, we allow moving from one team to another
    // For initial assignments, player must not have a team
    if (!isReassignment && player.teamId !== null) {
      return { allowed: false, reason: 'Player already on another team' };
    }

    const ratings = calculateTeamRatings(teamId);
    let totalPlayers = ratings.menCount + ratings.womenCount;

    // If player is already on this team, don't count them twice
    if (player.teamId === teamId) {
      totalPlayers -= 1;
    }

    if (totalPlayers >= 14) {
      return { allowed: false, reason: 'Team already has 14 players (maximum roster size)' };
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
      total += Math.min(count * 0.5, 2); // Cap per month at 2 points
    });
    // Global cap: Maximum 4 practice bonus points total
    return Math.min(total, 4);
  };

  const calculateBonusPoints = (teamId) => {
    const team = teams.find(t => t.id === teamId);

    // ONLY include completed matches for bonus calculations
    const teamMatches = matches.filter(m =>
      (m.team1Id === teamId || m.team2Id === teamId) &&
      m.status === 'completed'
    );
    const matchesByMonth = {};

    console.log(`🎁 Bonus calculation for Team ${teamId}: ${teamMatches.length} completed matches`);

    // Tournament months: November 2025, December 2025, January 2026
    const tournamentMonths = [
      { key: '2025-10', name: 'November 2025', endDate: new Date('2025-11-30T23:59:59') },
      { key: '2025-11', name: 'December 2025', endDate: new Date('2025-12-31T23:59:59') },
      { key: '2026-0', name: 'January 2026', endDate: new Date('2026-01-31T23:59:59') }
    ];

    teamMatches.forEach(match => {
      const date = new Date(match.date);
      const monthKey = date.getFullYear() + '-' + date.getMonth();

      if (tournamentMonths.some(m => m.key === monthKey)) {
        if (!matchesByMonth[monthKey]) matchesByMonth[monthKey] = [];
        matchesByMonth[monthKey].push(match);
      }
    });

    let totalBonus = 0;
    const today = new Date();

    console.log('=== BONUS CALCULATION DEBUG ===');
    console.log('Team ID:', teamId);
    console.log('Team Name:', team?.name);
    console.log('Today\'s Date:', today.toISOString());

    // Match count bonuses (fixed to use else-if to prevent cumulative addition)
    tournamentMonths.forEach(monthData => {
      const monthKey = monthData.key;
      const count = matchesByMonth[monthKey] ? matchesByMonth[monthKey].length : 0;

      console.log(`\n--- ${monthData.name} ---`);
      console.log(`Matches played: ${count}`);

      // Positive bonuses for match count
      if (count >= 20) {
        totalBonus += 4;
        console.log(`✅ 20+ matches bonus: +4 points`);
      } else if (count >= 15) {
        totalBonus += 3;
        console.log(`✅ 15+ matches bonus: +3 points`);
      } else if (count >= 10) {
        totalBonus += 2;
        console.log(`✅ 10+ matches bonus: +2 points`);
      } else if (count >= 5) {
        totalBonus += 1;
        console.log(`✅ 5+ matches bonus: +1 point`);
      }

      // Penalty for < 4 matches, but only if the month has ended
      if (count < 4 && today > monthData.endDate) {
        totalBonus -= 4;
        console.log(`❌ Less than 4 matches penalty: -4 points (month ended)`);
      } else if (count < 4) {
        console.log(`⏳ Less than 4 matches, but month not ended yet (no penalty)`);
      }
    });

    // All players bonus: +1 per month if all roster players played (up to 14 players)
    tournamentMonths.forEach(monthData => {
      const monthKey = monthData.key;
      const monthMatches = matchesByMonth[monthKey] || [];
      if (monthMatches.length > 0) {
        const uniquePlayers = new Set();
        monthMatches.forEach(match => {
          const teamPlayers = match.team1Id === teamId ? match.team1Players : match.team2Players;
          (teamPlayers || []).forEach(playerId => uniquePlayers.add(playerId));
        });

        const teamPlayers = players.filter(p => p.teamId === teamId && p.status === 'active');
        // Bonus applies if all roster players participated (works for any roster size up to 14)
        if (teamPlayers.length > 0 && teamPlayers.length <= 14 && uniquePlayers.size === teamPlayers.length) {
          totalBonus += 1;
          console.log(`✅ All ${teamPlayers.length} players played in ${monthData.name}: +1 point`);
        }
      }
    });

    // Multiple opponents bonus: +1 per month if played 3+ different teams
    tournamentMonths.forEach(monthData => {
      const monthKey = monthData.key;
      const monthMatches = matchesByMonth[monthKey] || [];
      const opponentTeams = new Set();
      monthMatches.forEach(match => {
        const opponentId = match.team1Id === teamId ? match.team2Id : match.team1Id;
        opponentTeams.add(opponentId);
      });
      if (opponentTeams.size >= 3) {
        totalBonus += 1;
        console.log(`✅ Played 3+ opponents in ${monthData.name}: +1 point (${opponentTeams.size} opponents)`);
      }
    });

    // Multiple levels bonus: +1 per month if played 3+ different levels
    tournamentMonths.forEach(monthData => {
      const monthKey = monthData.key;
      const monthMatches = matchesByMonth[monthKey] || [];
      const levels = new Set();
      monthMatches.forEach(match => {
        if (match.level) levels.add(match.level);
      });
      if (levels.size >= 3) {
        totalBonus += 1;
        console.log(`✅ Played 3+ levels in ${monthData.name}: +1 point (${Array.from(levels).join(', ')})`);
      }
    });

    // Mixed doubles bonus: +1 per month if played 2+ mixed doubles matches
    tournamentMonths.forEach(monthData => {
      const monthKey = monthData.key;
      const monthMatches = matchesByMonth[monthKey] || [];
      let mixedDoublesCount = 0;

      monthMatches.forEach(match => {
        // Check if match type is explicitly Mixed Doubles (new matches)
        const matchType = getMatchType(match);
        let isMixedDoubles = matchType === MATCH_TYPES.MIXED_DOUBLES;

        // For backward compatibility: if NOT explicitly marked as mixed_doubles,
        // infer from player genders (historical matches)
        if (!isMixedDoubles) {
          const teamPlayers = match.team1Id === teamId ? match.team1Players : match.team2Players;
          if (teamPlayers && teamPlayers.length > 0) {
            const playerGenders = teamPlayers.map(playerId => {
              const player = players.find(p => p.id === playerId);
              return player ? player.gender : null;
            }).filter(g => g !== null);

            const hasMale = playerGenders.includes('M');
            const hasFemale = playerGenders.includes('F');

            // Count as mixed doubles if team has both male and female players
            if (hasMale && hasFemale) {
              isMixedDoubles = true;
            }
          }
        }

        if (isMixedDoubles) {
          mixedDoublesCount++;
        }
      });

      if (mixedDoublesCount >= 2) {
        totalBonus += 1;
        console.log(`✅ Played 2+ mixed doubles in ${monthData.name}: +1 point (${mixedDoublesCount} matches)`);
      }
    });

    // Manual bonus entries
    const manualBonuses = bonusEntries.filter(b => b.teamId === teamId);
    if (manualBonuses.length > 0) {
      console.log('\n--- Manual Bonuses ---');
      manualBonuses.forEach(bonus => {
        totalBonus += bonus.points;
        console.log(`✅ Manual bonus: +${bonus.points} points (${bonus.description || 'No description'})`);
      });
    }

    // Uniform and practice bonuses
    if (team && team.bonuses) {
      console.log('\n--- Team Bonuses ---');

      const uniformBonus = getUniformBonus(team.bonuses.uniformType, team.bonuses.uniformPhotoSubmitted);
      if (uniformBonus > 0) {
        totalBonus += uniformBonus;
        console.log(`✅ Uniform bonus (${team.bonuses.uniformType}): +${uniformBonus} points`);
      }

      const practiceBonus = getPracticeBonus(team.bonuses.practices);
      if (practiceBonus > 0) {
        totalBonus += practiceBonus;
        console.log(`✅ Practice bonus (capped at 4): +${practiceBonus} points`);
      }
    }

    console.log('\n--- BONUS SUMMARY ---');
    console.log(`Total Uncapped Bonus: ${totalBonus} points`);
    console.log(`Minimum Bonus (after penalties): ${Math.max(0, totalBonus)} points`);
    console.log('=======================\n');

    return Math.max(0, totalBonus);
  };

  const calculateTeamPoints = (teamId) => {
    console.log(`🔍 calculateTeamPoints called with matches.length = ${matches.length}`);

    // Debug logging - verify pending matches are excluded
    const allTeamMatches = matches.filter(m => m.team1Id === teamId || m.team2Id === teamId);
    const completedTeamMatches = allTeamMatches.filter(m => m.status === 'completed');
    const pendingTeamMatches = allTeamMatches.filter(m => m.status === 'pending');

    // Find team name for logging
    const team = teams.find(t => t.id === teamId);
    const teamName = team?.name || `Team ${teamId}`;

    console.log(`Team ${teamName} (${teamId}): ${allTeamMatches.length} total, ${completedTeamMatches.length} completed, ${pendingTeamMatches.length} pending`);

    // ONLY include completed matches
    const teamMatches = completedTeamMatches;

    let matchWinPoints = 0;
    let matchWins = 0;
    let matchLosses = 0;
    let setsWon = 0;
    let gamesWon = 0;

    console.log(`\n🎾 CALCULATING SETS WON FOR: ${teamName} (ID: ${teamId})`);
    console.log(`Total matches found: ${teamMatches.length}`);

    teamMatches.forEach((match, matchIndex) => {
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

      // Calculate sets and games won directly from match scores
      // This ensures accuracy even if team1Sets/team2Sets fields are missing or wrong

      // Parse set scores
      const s1t1 = parseInt(match.set1Team1) || 0;
      const s1t2 = parseInt(match.set1Team2) || 0;
      const s2t1 = parseInt(match.set2Team1) || 0;
      const s2t2 = parseInt(match.set2Team2) || 0;
      const s3t1 = parseInt(match.set3Team1) || 0;
      const s3t2 = parseInt(match.set3Team2) || 0;

      // Count sets won by this team
      let matchSetsWon = 0;
      let matchGamesWon = 0;

      if (isTeam1) {
        // Team is Team1 in this match
        // Set 1
        if (s1t1 > 0 && s1t2 > 0) {
          if (s1t1 > s1t2) matchSetsWon++;
          matchGamesWon += s1t1;
        }
        // Set 2
        if (s2t1 > 0 && s2t2 > 0) {
          if (s2t1 > s2t2) matchSetsWon++;
          matchGamesWon += s2t1;
        }
        // Set 3 (if played)
        if (s3t1 > 0 && s3t2 > 0) {
          if (s3t1 > s3t2) matchSetsWon++;
          matchGamesWon += s3t1;
        }
      } else {
        // Team is Team2 in this match
        // Set 1
        if (s1t1 > 0 && s1t2 > 0) {
          if (s1t2 > s1t1) matchSetsWon++;
          matchGamesWon += s1t2;
        }
        // Set 2
        if (s2t1 > 0 && s2t2 > 0) {
          if (s2t2 > s2t1) matchSetsWon++;
          matchGamesWon += s2t2;
        }
        // Set 3 (if played)
        if (s3t1 > 0 && s3t2 > 0) {
          if (s3t2 > s3t1) matchSetsWon++;
          matchGamesWon += s3t2;
        }
      }

      setsWon += matchSetsWon;
      gamesWon += matchGamesWon;

      // Detailed logging for each match
      console.log(`  Match ${matchIndex + 1}: ${match.team1Name} vs ${match.team2Name}`);
      console.log(`    Date: ${match.date}`);
      console.log(`    Set 1: ${s1t1}-${s1t2}${s1t1 > 0 && s1t2 > 0 ? (isTeam1 ? (s1t1 > s1t2 ? ' ✓' : ' ✗') : (s1t2 > s1t1 ? ' ✓' : ' ✗')) : ''}`);
      console.log(`    Set 2: ${s2t1}-${s2t2}${s2t1 > 0 && s2t2 > 0 ? (isTeam1 ? (s2t1 > s2t2 ? ' ✓' : ' ✗') : (s2t2 > s2t1 ? ' ✓' : ' ✗')) : ''}`);
      if (s3t1 > 0 && s3t2 > 0) {
        console.log(`    Set 3: ${s3t1}-${s3t2}${isTeam1 ? (s3t1 > s3t2 ? ' ✓' : ' ✗') : (s3t2 > s3t1 ? ' ✓' : ' ✗')}`);
      }
      console.log(`    ${teamName} won ${matchSetsWon} sets, ${matchGamesWon} games in this match`);
    });

    console.log(`📊 TOTAL FOR ${teamName}: ${setsWon} sets won, ${gamesWon} games won`);
    console.log(`📊 MATCH RECORD FOR ${teamName}: ${matchWins} wins, ${matchLosses} losses (${teamMatches.length} completed matches)`);
    console.log(`─`.repeat(60));

    const bonusPoints = calculateBonusPoints(teamId);
    const cappedBonus = Math.min(bonusPoints, matchWinPoints * 0.25);

    console.log('=== TEAM POINTS CALCULATION ===');
    console.log('Team ID:', teamId);
    console.log('Match Win Points:', matchWinPoints);
    console.log('Uncapped Bonus Points:', bonusPoints);
    console.log('25% Cap Amount:', matchWinPoints * 0.25);
    console.log('Capped Bonus Points:', cappedBonus);
    console.log('Total Points:', matchWinPoints + cappedBonus);
    console.log('===============================\n');

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
    const leaderboard = teams.map(team => ({
      ...team,
      ...calculateTeamPoints(team.id)
    })).sort((a, b) => {
      // Primary sort: Total points (descending)
      if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints;
      // First tiebreaker: Sets won (descending)
      if (b.setsWon !== a.setsWon) return b.setsWon - a.setsWon;
      // Second tiebreaker: Games won (descending)
      return b.gamesWon - a.gamesWon;
    });

    // Debug logging for leaderboard verification
    console.log('🎾 ===== LEADERBOARD CALCULATION DEBUG =====');
    leaderboard.forEach((team, index) => {
      console.log(`${index + 1}. ${team.name}`);
      console.log(`   Points: ${team.totalPoints} (${team.matchWinPoints} win + ${team.cappedBonus.toFixed(1)} bonus)`);
      console.log(`   Match Record: ${team.matchWins}-${team.matchLosses}`);
      console.log(`   Sets Won: ${team.setsWon}`);
      console.log(`   Games Won: ${team.gamesWon}`);
      console.log(`   Matches Played: ${team.matchesPlayed}`);
    });
    console.log('==========================================\n');

    return leaderboard;
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

  // Challenge acceptance handler for ChallengePage
  const handleChallengePageAccept = async (challenge) => {
    // Open login modal (session storage will handle redirect after login)
    setAutoAcceptChallengeId(challenge.id);
    navigate('/challenges');
    // Scroll to top after navigation
    window.scrollTo(0, 0);
  };

  const showToastMessage = (message) => {
    setToastMessage(message);
    setShowToast(true);
    setTimeout(() => setShowToast(false), 3000);
  };

  return (
    <>
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

      {/* Toast Notification */}
      {showToast && (
        <div className="fixed bottom-4 right-4 bg-green-600 text-white px-6 py-3 rounded-lg shadow-lg z-50 flex items-center gap-2 animate-fade-in">
          <Check className="w-5 h-5" />
          {toastMessage}
        </div>
      )}

      <Routes>
        {/* Challenge Page Route */}
        <Route
          path="/challenge/:challengeId"
          element={
            <ChallengePage
              challenges={challenges}
              teams={teams}
              players={players}
              captains={captains}
              matches={matches}
              isAuthenticated={isAuthenticated}
              userRole={userRole}
              userTeamId={userTeamId}
              loginName={loginName}
              onLogin={() => setShowLogin(true)}
              onChallengesChange={setChallenges}
              onMatchesChange={setMatches}
            />
          }
        />

        {/* Main App Route */}
        <Route
          path="*"
          element={
            <div className="min-h-screen bg-gray-100 p-4">

      <div className="max-w-7xl mx-auto">
        <Header
          isAuthenticated={isAuthenticated}
          loginName={loginName}
          userRole={userRole}
          handleLogout={handleLogout}
          setShowLogin={setShowLogin}
        />

        <TabNavigation
          activeTab={activeTab}
          setActiveTab={handleTabChange}
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
              userRole={userRole}
              calculateTeamRatings={calculateTeamRatings}
              getEffectiveRating={getEffectiveRating}
              addLog={addLog}
              teamsVersion={dataVersions.teams}
              saveTeamsWithValidation={saveTeamsWithValidation}
              loginName={loginName}
              onSave={handleManualSave}
              onUnsavedChangesChange={handleTeamsUnsavedChanges}
              trades={trades}
              setTrades={setTrades}
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
              userRole={userRole}
              getEffectiveRating={getEffectiveRating}
              canAddPlayerToTeam={canAddPlayerToTeam}
              addLog={addLog}
              importLock={importLock}
              setImportLock={setImportLockHelper}
              playersVersion={dataVersions.teams}
              savePlayersWithValidation={savePlayersWithValidation}
              loginName={loginName}
              releaseImportLock={releaseImportLockHelper}
              onSave={handleManualSave}
              onUnsavedChangesChange={handlePlayersUnsavedChanges}
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

          {activeTab === 'challenges' && (
            <ChallengeManagement
              teams={teams}
              players={players}
              matches={matches}
              challenges={challenges}
              captains={captains}
              onChallengesChange={setChallenges}
              onMatchesChange={setMatches}
              isAuthenticated={isAuthenticated}
              userRole={userRole}
              userTeamId={userTeamId}
              loginName={loginName}
              addLog={addLog}
              showToast={showToastMessage}
              autoAcceptChallengeId={autoAcceptChallengeId}
              onAutoAcceptHandled={() => setAutoAcceptChallengeId(null)}
            />
          )}

          {activeTab === 'matches' && (
            <Matches
              teams={teams}
              players={players}
              isAuthenticated={isAuthenticated}
              userRole={userRole}
              userTeamId={userTeamId}
              loginName={loginName}
              addLog={addLog}
              captains={captains}
              onAddPhoto={handleAddPhoto}
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
            <div className="space-y-6">
              {/* Challenges Firestore Migration - Directors Only */}
              {userRole === 'director' && (
                <ChallengesMigrationTool
                  userRole={userRole}
                />
              )}

              {/* Matches Firestore Migration - Directors Only */}
              {userRole === 'director' && (
                <MatchesMigrationTool
                  userRole={userRole}
                />
              )}

              {/* Teams Data Format Migration - Directors Only */}
              {userRole === 'director' && (
                <TeamsDataMigrationTool
                  userRole={userRole}
                />
              )}

              {/* Migration Utility - Directors Only */}
              {userRole === 'director' && (
                <MigrationButton
                  challenges={challenges}
                  matches={matches}
                  onUpdate={(data) => {
                    setChallenges(data.challenges);
                    setMatches(data.matches);
                  }}
                  userRole={userRole}
                />
              )}

              {/* Activity Log */}
              <ActivityLog
                logs={activityLogs}
                onRefresh={(newLogs) => setActivityLogs(newLogs)}
              />
            </div>
          )}

          {activeTab === 'bonus-audit' && (
            <BonusAudit
              teams={teams}
              matches={matches}
              players={players}
              bonusEntries={bonusEntries}
            />
          )}
        </div>

        <TournamentRules />
      </div>
    </div>
          }
        />
      </Routes>
    </>
  );
};

export default App;