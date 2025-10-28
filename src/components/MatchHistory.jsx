import React from 'react';
import { TrendingUp, Edit, Trash2 } from 'lucide-react';

const MatchHistory = ({ matches, setMatches, teams, isAuthenticated, setActiveTab, players }) => {
  const handleEditMatch = (match) => {
    // Note: In the full app, this would pass the match data back to MatchEntry
    // For now, we'll navigate to the entry tab
    setActiveTab('entry');
  };

  const handleDeleteMatch = (matchId) => {
    if (confirm('Delete this match?')) {
      setMatches(matches.filter(m => m.id !== matchId));
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      month: '2-digit', 
      day: '2-digit', 
      year: 'numeric' 
    });
  };

  const getPlayerName = (playerId) => {
    const player = players.find(p => p.id === playerId);
    if (!player) return 'Unknown Player';
    return `${player.firstName} ${player.lastName}`;
  };

  const formatSetScores = (match) => {
    const setScores = [];

    // Add Set 1
    if (match.set1Team1 !== undefined && match.set1Team2 !== undefined) {
      setScores.push(`${match.set1Team1}-${match.set1Team2}`);
    }

    // Add Set 2
    if (match.set2Team1 !== undefined && match.set2Team2 !== undefined) {
      setScores.push(`${match.set2Team1}-${match.set2Team2}`);
    }

    // Add Set 3 with tiebreaker notation if applicable
    if (match.set3Team1 !== undefined && match.set3Team2 !== undefined &&
        (match.set3Team1 !== '' || match.set3Team2 !== '')) {
      const set3Score = `${match.set3Team1}-${match.set3Team2}`;
      const tbNotation = match.set3IsTiebreaker ? ' TB' : '';
      setScores.push(set3Score + tbNotation);
    }

    // If no individual set scores available, fall back to old format
    if (setScores.length === 0) {
      return `${match.team1Sets}-${match.team2Sets} sets • ${match.team1Games}-${match.team2Games} games`;
    }

    return `(${setScores.join(', ')})`;
  };

  // Sort matches by date (newest first), then by timestamp if available
  const sortedMatches = [...matches].sort((a, b) => {
    const dateA = new Date(a.date);
    const dateB = new Date(b.date);
    
    // If dates are different, sort by date
    if (dateA.getTime() !== dateB.getTime()) {
      return dateB.getTime() - dateA.getTime(); // Newest first
    }
    
    // If dates are the same, sort by timestamp if available
    if (a.timestamp && b.timestamp) {
      return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
    }
    
    return 0;
  });

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
        <TrendingUp className="w-6 h-6" />
        Recent Matches
      </h2>
      <div className="space-y-3">
        {matches.length === 0 ? (
          <p className="text-gray-500 text-center py-8">No matches recorded yet</p>
        ) : (
          sortedMatches.slice(0, 20).map(match => {
            const team1 = teams.find(t => t.id == match.team1Id);
            const team2 = teams.find(t => t.id == match.team2Id);
            
            return (
              <div key={match.id} className="border rounded p-3 hover:bg-gray-50">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      {match.winner === 'team1' ? (
                        <>
                          <span className="font-bold text-green-600">
                            {team1 ? team1.name : 'Team ' + match.team1Id}
                          </span>
                          <span className="text-sm">def.</span>
                          <span className="font-semibold">
                            {team2 ? team2.name : 'Team ' + match.team2Id}
                          </span>
                        </>
                      ) : (
                        <>
                          <span className="font-bold text-green-600">
                            {team2 ? team2.name : 'Team ' + match.team2Id}
                          </span>
                          <span className="text-sm">def.</span>
                          <span className="font-semibold">
                            {team1 ? team1.name : 'Team ' + match.team1Id}
                          </span>
                        </>
                      )}
                      <span className="font-semibold text-blue-600">
                        {formatSetScores(match)}
                      </span>
                    </div>
                    <div className="text-sm text-gray-600">
                      {formatDate(match.date)}
                      {match.notes && <span className="ml-2 italic">• {match.notes}</span>}
                    </div>

                    {/* Display Players */}
                    {((match.team1Players && match.team1Players.length > 0) || 
                      (match.team2Players && match.team2Players.length > 0)) && (
                      <div className="mt-2 text-xs">
                        {match.team1Players && match.team1Players.length > 0 && (
                          <div className="text-gray-500">
                            <span className="font-semibold">{team1 ? team1.name : 'Team 1'} Players:</span>{' '}
                            {match.team1Players.map((playerId, index) => (
                              <span key={playerId}>
                                {getPlayerName(playerId)}
                                {index < match.team1Players.length - 1 ? ', ' : ''}
                              </span>
                            ))}
                          </div>
                        )}
                        {match.team2Players && match.team2Players.length > 0 && (
                          <div className="text-gray-500">
                            <span className="font-semibold">{team2 ? team2.name : 'Team 2'} Players:</span>{' '}
                            {match.team2Players.map((playerId, index) => (
                              <span key={playerId}>
                                {getPlayerName(playerId)}
                                {index < match.team2Players.length - 1 ? ', ' : ''}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  {isAuthenticated && (
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleEditMatch(match)}
                        className="text-blue-600 hover:text-blue-800 p-1"
                        title="Edit match"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteMatch(match.id)}
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
  );
};

export default MatchHistory;