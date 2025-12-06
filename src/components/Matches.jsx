/**
 * Unified Matches Component
 *
 * Consolidates all match functionality into a single interface:
 * - Today's Matches: Matches scheduled for today
 * - Pending Matches: Awaiting results
 * - Completed Matches: All finished matches
 *
 * Actions:
 * - Schedule Match (Directors & Captains): Create pending match
 * - Record Match Results (Directors only): Create completed match directly
 * - Enter Results (Directors & match Captains): Update pending to completed
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  Calendar,
  Clock,
  Check,
  Plus,
  Edit,
  Trash2,
  Trophy,
  Users,
  Filter,
  X,
  ChevronDown,
  ChevronUp,
  Save,
  TrendingUp
} from 'lucide-react';
import { subscribeToMatches, createMatch, updateMatch, deleteMatch } from '../services/matchService';
import { generateMatchId } from '../utils/idGenerator';
import MatchResultsModal from './MatchResultsModal';
import ScheduleMatchModal from './ScheduleMatchModal';
import RecordMatchModal from './RecordMatchModal';
import EditPendingMatchModal from './EditPendingMatchModal';
import { formatDate, formatNTRP } from '../utils/formatters';
import { ACTION_TYPES, createLogEntry } from '../services/activityLogger';
import { MATCH_TYPES, getRequiredPlayerCount, calculateCombinedNTRP, validateCombinedNTRP, validateMixedDoublesGenders, getDisplayMatchType } from '../utils/matchUtils';
import TeamLogo from './TeamLogo';

export default function Matches({
  teams,
  players,
  isAuthenticated,
  userRole,
  userTeamId,
  loginName,
  addLog,
  captains,
  onAddPhoto
}) {
  // ========================================
  // STATE MANAGEMENT
  // ========================================

  // Real-time data from Firestore
  const [allMatches, setAllMatches] = useState([]);
  const [matchesLoading, setMatchesLoading] = useState(true);

  // Modal state
  const [activeModal, setActiveModal] = useState(null); // 'schedule' | 'record' | 'results' | 'edit' | null
  const [modalMatch, setModalMatch] = useState(null);

  // Filter state
  const [selectedTeams, setSelectedTeams] = useState([]);
  const [selectedPlayers, setSelectedPlayers] = useState([]);
  const [matchTypeFilter, setMatchTypeFilter] = useState('all');
  const [sortOrder, setSortOrder] = useState('newest');
  const [showTeamPlayerFilters, setShowTeamPlayerFilters] = useState(false);

  // Section expand/collapse state
  const [pendingExpanded, setPendingExpanded] = useState(false);
  const [completedExpanded, setCompletedExpanded] = useState(false);

  // Pagination for completed matches
  const [completedMatchesLimit, setCompletedMatchesLimit] = useState(20);

  // ========================================
  // REAL-TIME SUBSCRIPTION
  // ========================================

  useEffect(() => {
    console.log('🔌 Setting up matches real-time subscription');
    setMatchesLoading(true);

    const unsubscribe = subscribeToMatches(
      (matches) => {
        console.log(`📥 Received ${matches.length} matches from Firestore`);
        setAllMatches(matches);
        setMatchesLoading(false);
      },
      (error) => {
        console.error('❌ Matches subscription error:', error);
        setMatchesLoading(false);
      }
    );

    return () => {
      console.log('🔌 Cleaning up matches subscription');
      unsubscribe();
    };
  }, []);

  // ========================================
  // PERMISSION CHECKS
  // ========================================

  const canScheduleMatch = userRole === 'director' || userRole === 'captain';
  const canRecordDirectly = userRole === 'director';

  const canEnterResults = (match) => {
    if (userRole === 'director') return true;
    if (userRole === 'captain' && userTeamId) {
      return match.team1Id === userTeamId || match.team2Id === userTeamId;
    }
    return false;
  };

  const canEditMatch = (match) => {
    if (userRole === 'director') return true;
    if (userRole === 'captain' && userTeamId) {
      return match.team1Id === userTeamId || match.team2Id === userTeamId;
    }
    return false;
  };

  const canDeleteMatch = (match) => userRole === 'director';

  // Toggle functions for filters
  const toggleTeamFilter = (teamId) => {
    setSelectedTeams(prev =>
      prev.includes(teamId.toString())
        ? prev.filter(id => id !== teamId.toString())
        : [...prev, teamId.toString()]
    );
  };

  const togglePlayerFilter = (playerId) => {
    setSelectedPlayers(prev =>
      prev.includes(playerId)
        ? prev.filter(id => id !== playerId)
        : [...prev, playerId]
    );
  };

  // ========================================
  // DERIVED STATE - FILTERED MATCHES
  // ========================================

  // Get today's date in YYYY-MM-DD format (local timezone)
  const today = useMemo(() => {
    const now = new Date();
    return now.toLocaleDateString('en-CA'); // YYYY-MM-DD format
  }, []);

  // Apply captain restrictions first
  const visibleMatches = useMemo(() => {
    if (userRole === 'captain' && userTeamId) {
      return allMatches.filter(
        m => m.team1Id === userTeamId || m.team2Id === userTeamId
      );
    }
    return allMatches;
  }, [allMatches, userRole, userTeamId]);

  // Apply filters (Team, Player, Match Type)
  const filteredMatches = useMemo(() => {
    let filtered = [...visibleMatches];

    // Team filter
    if (selectedTeams.length > 0) {
      filtered = filtered.filter(m =>
        selectedTeams.includes(m.team1Id.toString()) || selectedTeams.includes(m.team2Id.toString())
      );
    }

    // Player filter
    if (selectedPlayers.length > 0) {
      filtered = filtered.filter(m => {
        const allPlayers = [...(m.team1Players || []), ...(m.team2Players || [])];
        return selectedPlayers.some(playerId => allPlayers.includes(playerId));
      });
    }

    // Match type filter
    if (matchTypeFilter !== 'all') {
      filtered = filtered.filter(m => m.matchType === matchTypeFilter);
    }

    return filtered;
  }, [visibleMatches, selectedTeams, selectedPlayers, matchTypeFilter]);

  // Today's matches (pending or completed today)
  const todaysMatches = useMemo(() => {
    return filteredMatches.filter(m => {
      const matchDate = m.scheduledDate || m.date || '';
      return matchDate === today;
    }).sort((a, b) => {
      // Sort by status (pending first) then by creation time
      if (a.status !== b.status) {
        return a.status === 'pending' ? -1 : 1;
      }
      return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
    });
  }, [filteredMatches, today]);

  // Pending matches (excluding today's)
  const pendingMatches = useMemo(() => {
    return filteredMatches.filter(m => {
      const matchDate = m.scheduledDate || m.date || '';
      return m.status === 'pending' && matchDate !== today;
    }).sort((a, b) => {
      // Sort by scheduled date
      const dateA = new Date(a.scheduledDate || a.createdAt);
      const dateB = new Date(b.scheduledDate || b.createdAt);
      return sortOrder === 'newest'
        ? dateB - dateA
        : dateA - dateB;
    });
  }, [filteredMatches, today, sortOrder]);

  // Completed matches (excluding today's)
  const completedMatches = useMemo(() => {
    return filteredMatches.filter(m => {
      const matchDate = m.date || m.scheduledDate || '';
      return m.status === 'completed' && matchDate !== today;
    }).sort((a, b) => {
      // Sort by completion date
      const dateA = new Date(a.completedAt || a.date || a.createdAt || 0);
      const dateB = new Date(b.completedAt || b.date || b.createdAt || 0);
      return sortOrder === 'newest'
        ? dateB - dateA
        : dateA - dateB;
    });
  }, [filteredMatches, today, sortOrder]);

  // Paginated completed matches
  const displayedCompletedMatches = useMemo(() => {
    return completedMatches.slice(0, completedMatchesLimit);
  }, [completedMatches, completedMatchesLimit]);

  const hasMoreCompleted = completedMatches.length > completedMatchesLimit;

  // Check if match is overdue
  const isMatchOverdue = (match) => {
    if (match.status !== 'pending') return false;
    const scheduledDate = new Date(match.scheduledDate || match.createdAt);
    const now = new Date();
    const daysDiff = Math.floor((now - scheduledDate) / (1000 * 60 * 60 * 24));
    return daysDiff >= 1;
  };

  // ========================================
  // MODAL HANDLERS
  // ========================================

  const openScheduleModal = () => {
    setModalMatch(null);
    setActiveModal('schedule');
  };

  const openRecordModal = () => {
    setModalMatch(null);
    setActiveModal('record');
  };

  const openResultsModal = (match) => {
    setModalMatch(match);
    setActiveModal('results');
  };

  const openEditModal = (match) => {
    console.log('🔧 Opening edit modal for match:', match);
    console.log('Match data:', {
      matchId: match.matchId,
      team1Id: match.team1Id,
      team2Id: match.team2Id,
      status: match.status,
      team1Players: match.team1Players,
      team2Players: match.team2Players
    });
    setModalMatch(match);
    setActiveModal('edit');
    console.log('Modal state updated - activeModal: edit, modalMatch:', match.matchId);
  };

  const closeModals = () => {
    setActiveModal(null);
    setModalMatch(null);
  };

  // ========================================
  // ACTION HANDLERS
  // ========================================

  const handleSubmitResults = async (matchResult) => {
    try {
      if (!modalMatch) return;

      // Calculate sets and games from scores
      let team1Sets = matchResult.team1Sets || 0;
      let team2Sets = matchResult.team2Sets || 0;
      let team1Games = matchResult.team1Games || 0;
      let team2Games = matchResult.team2Games || 0;

      const updateData = {
        status: 'completed',
        date: matchResult.date,
        winner: matchResult.winner,
        set1Team1: matchResult.set1Team1,
        set1Team2: matchResult.set1Team2,
        set2Team1: matchResult.set2Team1,
        set2Team2: matchResult.set2Team2,
        set3Team1: matchResult.set3Team1 || '',
        set3Team2: matchResult.set3Team2 || '',
        set3IsTiebreaker: matchResult.set3IsTiebreaker || false,
        team1Sets,
        team2Sets,
        team1Games,
        team2Games,
        notes: matchResult.notes || '',
        completedAt: new Date().toISOString(),
        completedBy: userRole === 'director' ? 'Tournament Director' : 'Captain'
      };

      await updateMatch(modalMatch.matchId, updateData, updateData.completedBy);

      // Log activity
      if (addLog) {
        const team1 = teams.find(t => t.id === modalMatch.team1Id);
        const team2 = teams.find(t => t.id === modalMatch.team2Id);
        const winnerTeam = matchResult.winner === 'team1' ? team1 : team2;

        addLog(
          ACTION_TYPES.MATCH_COMPLETED,
          {
            matchId: modalMatch.matchId,
            winnerName: winnerTeam?.name || 'Unknown',
            team1Name: team1?.name || 'Team 1',
            team2Name: team2?.name || 'Team 2',
            scores: `${matchResult.set1Team1 || 0}-${matchResult.set1Team2 || 0}, ${matchResult.set2Team1 || 0}-${matchResult.set2Team2 || 0}${matchResult.set3Team1 ? `, ${matchResult.set3Team1}-${matchResult.set3Team2}` : ''}`,
            level: modalMatch.level
          },
          modalMatch.matchId,
          null,
          updateData
        );
      }

      closeModals();
      alert('✅ Match results recorded successfully!');
    } catch (error) {
      console.error('❌ Failed to record match results:', error);
      alert('❌ Failed to record match results. Please try again.');
    }
  };

  const handleScheduleMatch = async (matchData) => {
    try {
      const matchId = generateMatchId(allMatches);
      const newMatch = {
        ...matchData,
        matchId,
        createdBy: loginName || (userRole === 'director' ? 'Tournament Director' : 'Captain')
      };

      const result = await createMatch(newMatch, newMatch.createdBy);

      if (result.success) {
        // Log activity
        if (addLog) {
          const team1 = teams.find(t => t.id === matchData.team1Id);
          const team2 = teams.find(t => t.id === matchData.team2Id);

          addLog(
            ACTION_TYPES.MATCH_SCHEDULED,
            {
              matchId,
              team1Name: team1?.name || 'Team 1',
              team2Name: team2?.name || 'Team 2',
              level: matchData.level,
              scheduledDate: matchData.scheduledDate
            },
            matchId,
            null,
            newMatch
          );
        }

        alert('✅ Match scheduled successfully!');
      } else {
        throw new Error(result.message || 'Failed to schedule match');
      }
    } catch (error) {
      console.error('❌ Failed to schedule match:', error);
      alert('❌ Failed to schedule match. Please try again.');
      throw error;
    }
  };

  const handleRecordMatch = async (matchData) => {
    try {
      const matchId = generateMatchId(allMatches);
      const newMatch = {
        ...matchData,
        matchId,
        createdBy: loginName || 'Tournament Director',
        completedBy: loginName || 'Tournament Director'
      };

      const result = await createMatch(newMatch, newMatch.createdBy);

      if (result.success) {
        // Log activity
        if (addLog) {
          const team1 = teams.find(t => t.id === matchData.team1Id);
          const team2 = teams.find(t => t.id === matchData.team2Id);
          const winnerTeam = matchData.winner === 'team1' ? team1 : team2;

          addLog(
            ACTION_TYPES.MATCH_CREATED,
            {
              matchId,
              winnerName: winnerTeam?.name || 'Unknown',
              team1Name: team1?.name || 'Team 1',
              team2Name: team2?.name || 'Team 2',
              scores: `${matchData.set1Team1 || 0}-${matchData.set1Team2 || 0}, ${matchData.set2Team1 || 0}-${matchData.set2Team2 || 0}${matchData.set3Team1 ? `, ${matchData.set3Team1}-${matchData.set3Team2}` : ''}`,
              level: matchData.level,
              date: matchData.date
            },
            matchId,
            null,
            newMatch
          );
        }

        alert('✅ Match recorded successfully!');
      } else {
        throw new Error(result.message || 'Failed to record match');
      }
    } catch (error) {
      console.error('❌ Failed to record match:', error);
      alert('❌ Failed to record match. Please try again.');
      throw error;
    }
  };

  const handleEditPendingMatch = async (matchId, updates) => {
    try {
      const updatedBy = loginName || (userRole === 'director' ? 'Tournament Director' : 'Captain');
      const result = await updateMatch(matchId, updates, updatedBy);

      if (result.success) {
        // Log activity
        if (addLog) {
          const match = allMatches.find(m => m.matchId === matchId);
          const team1 = teams.find(t => t.id === match?.team1Id);
          const team2 = teams.find(t => t.id === match?.team2Id);

          addLog(
            ACTION_TYPES.PENDING_MATCH_EDITED,
            {
              matchId,
              team1Name: team1?.name || 'Team 1',
              team2Name: team2?.name || 'Team 2',
              level: updates.level,
              scheduledDate: updates.scheduledDate
            },
            matchId,
            null,
            updates
          );
        }

        alert('✅ Match updated successfully!');
      } else {
        throw new Error(result.message || 'Failed to update match');
      }
    } catch (error) {
      console.error('❌ Failed to update match:', error);
      alert('❌ Failed to update match. Please try again.');
      throw error;
    }
  };

  const handleDeleteMatch = async (match) => {
    if (!window.confirm(`Are you sure you want to delete this match?\n\nMatch: ${match.matchId}\n\nThis action cannot be undone.`)) {
      return;
    }

    try {
      await deleteMatch(match.matchId);

      // Log activity
      if (addLog) {
        const team1 = teams.find(t => t.id === match.team1Id);
        const team2 = teams.find(t => t.id === match.team2Id);

        addLog(
          ACTION_TYPES.MATCH_DELETED,
          {
            matchId: match.matchId,
            team1Name: team1?.name || 'Team 1',
            team2Name: team2?.name || 'Team 2',
            level: match.level,
            status: match.status
          },
          match.matchId,
          null,
          match
        );
      }

      alert('✅ Match deleted successfully');
    } catch (error) {
      console.error('❌ Failed to delete match:', error);
      alert('❌ Failed to delete match. Please try again.');
    }
  };

  // ========================================
  // RENDER: LOADING STATE
  // ========================================

  if (matchesLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        <span className="ml-3 text-gray-600">Loading matches...</span>
      </div>
    );
  }

  // ========================================
  // RENDER: MAIN COMPONENT
  // ========================================

  return (
    <div className="space-y-6">
      {/* Header with Action Buttons */}
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900">Matches</h1>
        <div className="flex gap-3">
          {canScheduleMatch && (
            <button
              onClick={openScheduleModal}
              className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Schedule Match
            </button>
          )}
          {canRecordDirectly && (
            <button
              onClick={openRecordModal}
              className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors"
            >
              <Check className="w-4 h-4" />
              Record Match Results
            </button>
          )}
        </div>
      </div>

      {/* Main Filters - 2 Column Layout */}
      <div className="grid grid-cols-2 gap-4">
        {/* Filter by Match Type */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Filter by Match Type:
          </label>
          <select
            value={matchTypeFilter}
            onChange={(e) => setMatchTypeFilter(e.target.value)}
            className="w-full border border-gray-300 rounded-md p-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Types</option>
            <option value="singles">Singles</option>
            <option value="doubles">Doubles</option>
            <option value="mixed_doubles">Mixed Doubles</option>
          </select>
        </div>

        {/* Sort Order */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Sort Order:
          </label>
          <select
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value)}
            className="w-full border border-gray-300 rounded-md p-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="newest">Newest First</option>
            <option value="oldest">Oldest First</option>
          </select>
        </div>
      </div>

      {/* Collapsible Team/Player Filters */}
      <div>
        <button
          onClick={() => setShowTeamPlayerFilters(!showTeamPlayerFilters)}
          className="bg-blue-600 text-white px-4 py-2 rounded-md flex items-center gap-2 hover:bg-blue-700 transition-colors"
        >
          <Filter className="w-4 h-4" />
          {showTeamPlayerFilters ? 'Hide Team/Player Filters' : 'Show Team/Player Filters'}
          {showTeamPlayerFilters ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>

        {showTeamPlayerFilters && (
          <div className="mt-4 bg-white border border-gray-300 rounded-lg p-4 grid grid-cols-2 gap-4">
            {/* Team Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Filter by Team:
              </label>
              <div className="border border-gray-300 rounded-lg p-3 bg-blue-50 max-h-60 overflow-y-auto">
                {teams.map(team => (
                  <label
                    key={team.id}
                    className="flex items-center gap-2 py-1 cursor-pointer hover:bg-blue-100 px-2 rounded transition-colors"
                  >
                    <input
                      type="checkbox"
                      checked={selectedTeams.includes(team.id.toString())}
                      onChange={() => toggleTeamFilter(team.id)}
                      className="rounded"
                    />
                    <TeamLogo team={team} size="small" />
                    <span className="text-sm">{team.name}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Player Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Filter by Player:
              </label>
              <div className="border border-gray-300 rounded-lg p-3 bg-blue-50 max-h-60 overflow-y-auto">
                {players
                  .sort((a, b) => {
                    // Sort by last name, then first name
                    const lastNameCompare = a.lastName.localeCompare(b.lastName);
                    if (lastNameCompare !== 0) return lastNameCompare;
                    return a.firstName.localeCompare(b.firstName);
                  })
                  .map(player => (
                    <label
                      key={player.id}
                      className="flex items-center gap-2 py-1 cursor-pointer hover:bg-blue-100 px-2 rounded transition-colors"
                    >
                      <input
                        type="checkbox"
                        checked={selectedPlayers.includes(player.id)}
                        onChange={() => togglePlayerFilter(player.id)}
                        className="rounded"
                      />
                      <span className="text-sm">
                        {player.lastName}, {player.firstName} ({player.gender} {player.ntrpRating})
                      </span>
                    </label>
                  ))}
              </div>
            </div>

            {/* Clear Filters */}
            {(selectedTeams.length > 0 || selectedPlayers.length > 0) && (
              <div className="col-span-2 text-center">
                <button
                  onClick={() => {
                    setSelectedTeams([]);
                    setSelectedPlayers([]);
                  }}
                  className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                >
                  Clear Team/Player Filters
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ===== TODAY'S MATCHES SECTION (Always Visible) ===== */}
      <section className="mb-8 mt-6">
        <div className="bg-gradient-to-r from-blue-500 to-blue-600 rounded-lg shadow-lg p-6 mb-6">
          <h2 className="text-3xl font-bold text-white flex items-center gap-3 mb-4">
            <Calendar className="w-8 h-8" />
            📅 TODAY'S MATCHES ({todaysMatches.length})
          </h2>

          {todaysMatches.length === 0 ? (
            <div className="bg-white/10 backdrop-blur-sm border-2 border-white/30 rounded-lg p-8 text-center">
              <p className="text-white text-lg font-semibold">No matches scheduled for today</p>
              <p className="text-blue-100 text-sm mt-2">Check the pending matches below for upcoming games</p>
            </div>
          ) : (
            <div className="space-y-3">
              {todaysMatches.map(match => (
                <MatchCard
                  key={match.matchId || match.id}
                  match={match}
                  teams={teams}
                  players={players}
                  showStatusBadge={true}
                  isOverdue={isMatchOverdue(match)}
                  canEnterResults={canEnterResults(match)}
                  canEdit={canEditMatch(match)}
                  canDelete={canDeleteMatch(match)}
                  onEnterResults={() => openResultsModal(match)}
                  onEdit={() => openEditModal(match)}
                  onDelete={() => handleDeleteMatch(match)}
                />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ===== PENDING MATCHES SECTION (Collapsible) ===== */}
      <section className="mb-8">
        <div
          className="flex items-center gap-3 mb-4 cursor-pointer hover:bg-gray-100 p-3 rounded-lg transition-colors"
          onClick={() => setPendingExpanded(!pendingExpanded)}
          role="button"
          tabIndex={0}
          aria-expanded={pendingExpanded}
        >
          <span className="text-2xl">
            {pendingExpanded ? '▼' : '▶'}
          </span>
          <Clock className="w-5 h-5 text-orange-700" />
          <h3 className="text-xl font-bold text-orange-700">
            PENDING MATCHES ({pendingMatches.length})
          </h3>
          <span className="text-sm text-gray-500 italic">
            (Click to {pendingExpanded ? 'collapse' : 'expand'})
          </span>
        </div>

        {pendingExpanded && (
          <>
            {pendingMatches.length === 0 ? (
              <p className="text-gray-500 text-center py-6 bg-gray-50 rounded border border-gray-200">
                No pending matches found
              </p>
            ) : (
              <div className="space-y-3">
                {pendingMatches.map(match => (
                  <MatchCard
                    key={match.matchId || match.id}
                    match={match}
                    teams={teams}
                    players={players}
                    showStatusBadge={false}
                    isOverdue={isMatchOverdue(match)}
                    canEnterResults={canEnterResults(match)}
                    canEdit={canEditMatch(match)}
                    canDelete={canDeleteMatch(match)}
                    onEnterResults={() => openResultsModal(match)}
                    onEdit={() => openEditModal(match)}
                    onDelete={() => handleDeleteMatch(match)}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </section>

      {/* ===== COMPLETED MATCHES SECTION (Collapsible) ===== */}
      <section>
        <div
          className="flex items-center gap-3 mb-4 cursor-pointer hover:bg-gray-100 p-3 rounded-lg transition-colors"
          onClick={() => setCompletedExpanded(!completedExpanded)}
          role="button"
          tabIndex={0}
          aria-expanded={completedExpanded}
        >
          <span className="text-2xl">
            {completedExpanded ? '▼' : '▶'}
          </span>
          <TrendingUp className="w-5 h-5 text-green-700" />
          <h3 className="text-xl font-bold text-green-700">
            COMPLETED MATCHES ({completedMatches.length})
          </h3>
          <span className="text-sm text-gray-500 italic">
            (Click to {completedExpanded ? 'collapse' : 'expand'})
          </span>
        </div>

        {completedExpanded && (
          <>
            {completedMatches.length === 0 ? (
              <p className="text-gray-500 text-center py-6 bg-gray-50 rounded border border-gray-200">
                No completed matches found
              </p>
            ) : (
              <div className="space-y-3">
                {displayedCompletedMatches.map(match => (
                  <MatchCard
                    key={match.matchId || match.id}
                    match={match}
                    teams={teams}
                    players={players}
                    showStatusBadge={false}
                    isOverdue={false}
                    canEnterResults={false}
                    canEdit={canEditMatch(match)}
                    canDelete={canDeleteMatch(match)}
                    onEnterResults={() => {}}
                    onEdit={() => openEditModal(match)}
                    onDelete={() => handleDeleteMatch(match)}
                  />
                ))}

                {/* Load More Button */}
                {hasMoreCompleted && (
                  <div className="text-center py-4">
                    <button
                      onClick={() => setCompletedMatchesLimit(prev => prev + 20)}
                      className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      Load More ({completedMatches.length - displayedCompletedMatches.length} remaining)
                    </button>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </section>

      {/* Modals */}
      {activeModal === 'results' && modalMatch && (
        <MatchResultsModal
          isOpen={true}
          match={modalMatch}
          teams={teams}
          players={players}
          matches={allMatches}
          onSubmit={handleSubmitResults}
          onClose={closeModals}
          addLog={addLog}
          ACTION_TYPES={ACTION_TYPES}
        />
      )}

      {activeModal === 'schedule' && (
        <ScheduleMatchModal
          isOpen={true}
          onClose={closeModals}
          onSubmit={handleScheduleMatch}
          teams={teams}
          players={players}
          userRole={userRole}
          userTeamId={userTeamId}
        />
      )}

      {activeModal === 'record' && (
        <RecordMatchModal
          isOpen={true}
          onClose={closeModals}
          onSubmit={handleRecordMatch}
          teams={teams}
          players={players}
          onAddPhoto={onAddPhoto}
        />
      )}

      {(() => {
        console.log('🎬 Render check - activeModal:', activeModal, 'modalMatch:', modalMatch);
        console.log('Should render EditPendingMatchModal?', activeModal === 'edit' && modalMatch);
        return null;
      })()}
      {activeModal === 'edit' && modalMatch && (
        <EditPendingMatchModal
          isOpen={true}
          onClose={closeModals}
          onSubmit={handleEditPendingMatch}
          match={modalMatch}
          teams={teams}
          players={players}
        />
      )}
    </div>
  );
}

// ========================================
// TAB CONTENT COMPONENTS
// ========================================

function TodaysMatchesTab({
  matches,
  teams,
  players,
  today,
  canEnterResults,
  canEditMatch,
  canDeleteMatch,
  isMatchOverdue,
  onEnterResults,
  onEdit,
  onDelete
}) {
  if (matches.length === 0) {
    return (
      <div className="text-center py-12 bg-gray-50 rounded-lg">
        <Calendar className="w-16 h-16 text-gray-400 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">No Matches Today</h3>
        <p className="text-gray-600">There are no matches scheduled for today.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {matches.map(match => (
        <MatchCard
          key={match.matchId || match.id}
          match={match}
          teams={teams}
          players={players}
          showStatusBadge={true}
          isOverdue={isMatchOverdue(match)}
          canEnterResults={canEnterResults(match)}
          canEdit={canEditMatch(match)}
          canDelete={canDeleteMatch(match)}
          onEnterResults={() => onEnterResults(match)}
          onEdit={() => onEdit(match)}
          onDelete={() => onDelete(match)}
        />
      ))}
    </div>
  );
}

function PendingMatchesTab({
  matches,
  teams,
  players,
  canEnterResults,
  canEditMatch,
  canDeleteMatch,
  isMatchOverdue,
  onEnterResults,
  onEdit,
  onDelete
}) {
  if (matches.length === 0) {
    return (
      <div className="text-center py-12 bg-gray-50 rounded-lg">
        <Clock className="w-16 h-16 text-gray-400 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">No Pending Matches</h3>
        <p className="text-gray-600">All matches have been completed or there are no scheduled matches.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {matches.map(match => (
        <MatchCard
          key={match.matchId || match.id}
          match={match}
          teams={teams}
          players={players}
          showStatusBadge={true}
          isOverdue={isMatchOverdue(match)}
          canEnterResults={canEnterResults(match)}
          canEdit={canEditMatch(match)}
          canDelete={canDeleteMatch(match)}
          onEnterResults={() => onEnterResults(match)}
          onEdit={() => onEdit(match)}
          onDelete={() => onDelete(match)}
        />
      ))}
    </div>
  );
}

function CompletedMatchesTab({
  matches,
  teams,
  players,
  canEditMatch,
  canDeleteMatch,
  hasMore,
  totalCount,
  onLoadMore,
  onEdit,
  onDelete
}) {
  if (matches.length === 0) {
    return (
      <div className="text-center py-12 bg-gray-50 rounded-lg">
        <Trophy className="w-16 h-16 text-gray-400 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">No Completed Matches</h3>
        <p className="text-gray-600">No matches have been completed yet.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {matches.map(match => (
        <MatchCard
          key={match.matchId || match.id}
          match={match}
          teams={teams}
          players={players}
          showStatusBadge={false}
          isOverdue={false}
          canEnterResults={false}
          canEdit={canEditMatch(match)}
          canDelete={canDeleteMatch(match)}
          onEnterResults={() => {}}
          onEdit={() => onEdit(match)}
          onDelete={() => onDelete(match)}
        />
      ))}

      {hasMore && (
        <div className="text-center py-4">
          <button
            onClick={onLoadMore}
            className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            Load More ({totalCount - matches.length} remaining)
          </button>
        </div>
      )}
    </div>
  );
}

// ========================================
// HELPER FUNCTIONS FOR MATCH DISPLAY
// ========================================

const formatRating = (rating) => {
  if (!rating) return 'N/A';
  return typeof rating === 'number' ? rating.toFixed(1) : rating;
};

const getPlayerDisplay = (playerIds, players) => {
  if (!playerIds || playerIds.length === 0) return 'No players assigned';

  return playerIds.map(playerId => {
    const player = players.find(p => p.id === playerId);
    if (!player) return 'Unknown Player';

    const name = `${player.firstName} ${player.lastName}`;
    const rating = player.ntrpRating || 'N/A';  // Use ntrpRating, NOT dynamicRating
    return `${name} (${formatRating(rating)})`;
  }).join(', ');
};

const formatSetScores = (match) => {
  const setScores = [];

  // Determine if team1 or team2 won
  const isTeam1Winner = match.winner === 'team1';

  // Add Set 1 - show winner's score first
  if (match.set1Team1 !== undefined && match.set1Team2 !== undefined) {
    const set1Score = isTeam1Winner
      ? `${match.set1Team1}-${match.set1Team2}`
      : `${match.set1Team2}-${match.set1Team1}`;
    setScores.push(set1Score);
  }

  // Add Set 2 - show winner's score first
  if (match.set2Team1 !== undefined && match.set2Team2 !== undefined) {
    const set2Score = isTeam1Winner
      ? `${match.set2Team1}-${match.set2Team2}`
      : `${match.set2Team2}-${match.set2Team1}`;
    setScores.push(set2Score);
  }

  // Add Set 3 - show winner's score first, with tiebreaker notation if applicable
  if (match.set3Team1 !== undefined && match.set3Team2 !== undefined &&
      (match.set3Team1 !== '' || match.set3Team2 !== '')) {
    const set3Score = isTeam1Winner
      ? `${match.set3Team1}-${match.set3Team2}`
      : `${match.set3Team2}-${match.set3Team1}`;
    const tbNotation = match.set3IsTiebreaker ? ' TB' : '';
    setScores.push(set3Score + tbNotation);
  }

  // If no individual set scores available, fall back to old format
  if (setScores.length === 0) {
    return `${match.team1Sets}-${match.team2Sets} sets • ${match.team1Games}-${match.team2Games} games`;
  }

  return `(${setScores.join(', ')})`;
};

const getTeamName = (teamId, teams) => {
  const team = teams.find(t => t.id === teamId);
  return team ? team.name : 'Unknown Team';
};

// ========================================
// MATCH CARD COMPONENT
// ========================================

function MatchCard({
  match,
  teams,
  players,
  showStatusBadge,
  isOverdue,
  canEnterResults,
  canEdit,
  canDelete,
  onEnterResults,
  onEdit,
  onDelete
}) {
  const team1 = teams.find(t => t.id === match.team1Id);
  const team2 = teams.find(t => t.id === match.team2Id);

  const isPending = match.status === 'pending';
  const isCompleted = match.status === 'completed';

  // Get player names with ratings for pending matches
  const getPlayerNames = (playerIds) => {
    if (!playerIds || playerIds.length === 0) return [];
    return playerIds.map(playerId => {
      const player = players.find(p => p.id === playerId);
      if (!player) return null;
      return {
        name: `${player.firstName} ${player.lastName}`,
        gender: player.gender || 'U',
        rating: player.ntrpRating || 'N/A'
      };
    }).filter(p => p !== null);
  };

  // Get simple player names for completed matches (no ratings)
  const getSimplePlayerNames = (playerIds) => {
    if (!playerIds || playerIds.length === 0) return 'No players listed';
    const names = playerIds.map(playerId => {
      const player = players.find(p => p.id === playerId);
      if (!player) return null;
      return `${player.firstName} ${player.lastName}`;
    }).filter(n => n !== null);
    return names.length > 0 ? names.join(', ') : 'No players listed';
  };

  // PENDING MATCH LAYOUT
  if (isPending) {
    const team1Players = getPlayerNames(match.team1Players);
    const team2Players = getPlayerNames(match.team2Players);

    return (
      <div className="bg-white/95 backdrop-blur-sm border-2 border-blue-300 rounded-lg p-4">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            {/* Match Title */}
            <div className="flex items-center gap-3 mb-2 flex-wrap">
              <TeamLogo team={team1} size="sm" showBorder={!!team1?.logo} />
              <h4 className="font-bold text-gray-900">
                {team1?.name || 'Team 1'}
              </h4>
              <span className="text-blue-600 font-semibold">vs</span>
              <TeamLogo team={team2} size="sm" showBorder={!!team2?.logo} />
              <h4 className="font-bold text-gray-900">
                {team2?.name || 'Team 2'}
              </h4>
              <span className="px-2 py-1 bg-blue-200 text-blue-900 text-xs font-medium rounded">
                Level {match.level || match.acceptedLevel || match.proposedLevel}
              </span>
              <span className="px-2 py-1 bg-purple-200 text-purple-900 text-xs font-medium rounded">
                {getDisplayMatchType(match, players)}
              </span>
              {showStatusBadge && (
                <span className={`px-2 py-1 text-xs font-bold rounded flex items-center gap-1 ${
                  isOverdue
                    ? 'bg-red-200 text-red-900'
                    : 'bg-yellow-200 text-yellow-900'
                }`}>
                  <Clock className="w-3 h-3" />
                  {isOverdue ? 'Results Past Due' : 'Awaiting Results'}
                </span>
              )}
            </div>

            {/* Players - Two Column Layout */}
            <div className="grid grid-cols-2 gap-4 text-sm mb-2">
              <div>
                <div className="font-semibold text-gray-700 mb-1">
                  {team1?.name || 'Team 1'} Players:
                </div>
                {team1Players.length > 0 ? (
                  team1Players.map((player, idx) => (
                    <div key={idx} className="text-gray-600">
                      • {player.name} ({player.gender}) {formatNTRP(player.rating)}
                    </div>
                  ))
                ) : (
                  <div className="text-gray-500 italic">No players listed</div>
                )}
              </div>

              <div>
                <div className="font-semibold text-gray-700 mb-1">
                  {team2?.name || 'Team 2'} Players:
                </div>
                {team2Players.length > 0 ? (
                  team2Players.map((player, idx) => (
                    <div key={idx} className="text-gray-600">
                      • {player.name} ({player.gender}) {formatNTRP(player.rating)}
                    </div>
                  ))
                ) : (
                  <div className="text-gray-500 italic">No players listed</div>
                )}
              </div>
            </div>

            {/* Scheduled Date */}
            <div className="text-sm text-gray-600 mb-2">
              📅 Scheduled: {formatDate(match.scheduledDate || match.date)}
            </div>

            {/* Notes */}
            {match.notes && (
              <div className="text-sm text-gray-600 italic mb-2">
                Notes: {match.notes}
              </div>
            )}

            {/* Metadata */}
            <div className="text-xs text-gray-500 italic mt-3 pt-2 border-t border-gray-300">
              {match.matchId && (
                <span className="font-mono font-semibold">Match ID: {match.matchId}</span>
              )}
              {match.createdAt && (
                <span className="ml-3">Created: {formatDate(match.createdAt)}</span>
              )}
              {match.acceptedDate && (
                <span className="ml-3">Accepted: {formatDate(match.acceptedDate)}</span>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="ml-4 flex flex-col gap-2">
            {canEdit && (
              <button
                onClick={onEdit}
                className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition-colors font-medium whitespace-nowrap"
              >
                <Edit className="w-4 h-4" />
                Edit
              </button>
            )}
            {canEnterResults && (
              <button
                onClick={onEnterResults}
                className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 transition-colors font-medium whitespace-nowrap"
              >
                <Check className="w-4 h-4" />
                Enter Results
              </button>
            )}
            {canDelete && (
              <button
                onClick={onDelete}
                className="flex items-center gap-2 bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 transition-colors font-medium whitespace-nowrap"
              >
                <Trash2 className="w-4 h-4" />
                Delete
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // COMPLETED MATCH LAYOUT
  if (isCompleted) {
    const winnerTeam = match.winner === 'team1' ? team1 : team2;
    const loserTeam = match.winner === 'team1' ? team2 : team1;

    return (
      <div className="bg-white/95 backdrop-blur-sm border-2 border-green-300 rounded-lg p-4">
        <div className="flex justify-between items-start">
          <div className="flex-1">
            {/* Winner vs Loser with Scores */}
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <TeamLogo team={winnerTeam} size="sm" showBorder={!!winnerTeam?.logo} />
              <span className="font-bold text-green-600">
                {winnerTeam?.name || 'Winner'}
              </span>
              <span className="text-sm">def.</span>
              <TeamLogo team={loserTeam} size="sm" showBorder={!!loserTeam?.logo} />
              <span className="font-semibold">
                {loserTeam?.name || 'Loser'}
              </span>
              <span className="font-semibold text-blue-600">
                {formatSetScores(match)}
              </span>
              <span className="px-2 py-1 bg-gray-200 text-gray-700 text-xs font-medium rounded">
                Level {match.level}
              </span>
              <span className="px-2 py-1 bg-purple-200 text-purple-900 text-xs font-medium rounded">
                {getDisplayMatchType(match, players)}
              </span>
            </div>

            {/* Date */}
            <div className="text-sm text-gray-600 mb-2">
              {formatDate(match.date || match.completedAt)}
              {match.notes && <span className="ml-2 italic">• {match.notes}</span>}
            </div>

            {/* Players - Single Line */}
            <div className="text-sm text-gray-600 mb-2">
              <div>
                <span className="font-semibold">{winnerTeam?.name || 'Winner'} Players:</span> {getSimplePlayerNames(match.winner === 'team1' ? match.team1Players : match.team2Players)}
              </div>
              <div>
                <span className="font-semibold">{loserTeam?.name || 'Loser'} Players:</span> {getSimplePlayerNames(match.winner === 'team1' ? match.team2Players : match.team1Players)}
              </div>
            </div>

            {/* Metadata */}
            <div className="text-xs text-gray-500 italic mt-2 pt-2 border-t border-gray-200">
              {match.matchId && (
                <span className="font-mono font-semibold">Match ID: {match.matchId}</span>
              )}
              {match.completedAt && (
                <span className="ml-3">Entered: {formatDate(match.completedAt)}</span>
              )}
            </div>
          </div>

          {/* Action Buttons (if any) */}
          {(canEdit || canDelete) && (
            <div className="flex gap-2 ml-4">
              {canEdit && (
                <button
                  onClick={onEdit}
                  className="text-blue-600 hover:text-blue-800 p-1"
                >
                  <Edit className="w-4 h-4" />
                </button>
              )}
              {canDelete && (
                <button
                  onClick={onDelete}
                  className="text-red-600 hover:text-red-800 p-1"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  // Fallback for unknown status
  return null;
}
