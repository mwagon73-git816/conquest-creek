import React, { useState } from 'react';
import { CheckCircle2, XCircle, Download, FileSpreadsheet } from 'lucide-react';
import { getEffectiveMatchType, MATCH_TYPES } from '../utils/matchUtils';

const BonusAudit = ({ teams, matches, players, bonusEntries }) => {
  const [selectedTeamId, setSelectedTeamId] = useState(teams.length > 0 ? teams[0].id : null);

  // Tournament months with correct JavaScript month indices
  const tournamentMonths = [
    { key: '2025-10', name: 'November 2025', year: 2025, month: 10, endDate: new Date('2025-11-30T23:59:59') },
    { key: '2025-11', name: 'December 2025', year: 2025, month: 11, endDate: new Date('2025-12-31T23:59:59') },
    { key: '2026-0', name: 'January 2026', year: 2026, month: 0, endDate: new Date('2026-01-30T23:59:59') }
  ];

  // Calculate detailed bonus breakdown for a specific team
  const calculateDetailedBonus = (teamId) => {
    const team = teams.find(t => t.id === teamId);
    if (!team) return null;

    const teamMatches = matches.filter(m => m.team1Id === teamId || m.team2Id === teamId);
    const matchesByMonth = {};
    const today = new Date();

    // Group matches by month
    teamMatches.forEach(match => {
      const date = new Date(match.date);
      const monthKey = date.getFullYear() + '-' + date.getMonth();

      if (tournamentMonths.some(m => m.key === monthKey)) {
        if (!matchesByMonth[monthKey]) matchesByMonth[monthKey] = [];
        matchesByMonth[monthKey].push(match);
      }
    });

    const monthlyBreakdowns = {};
    let totalBonus = 0;

    // Calculate bonuses for each month
    tournamentMonths.forEach(monthData => {
      const monthKey = monthData.key;
      const monthMatches = matchesByMonth[monthKey] || [];
      const count = monthMatches.length;

      const breakdown = {
        matchCount: count,
        volumeBonus: 0,
        volumeDetails: '',
        uniquePlayers: new Set(),
        fullRosterBonus: 0,
        fullRosterDetails: '',
        opponentTeams: new Set(),
        varietyTeamsBonus: 0,
        varietyTeamsDetails: '',
        levels: new Set(),
        varietyLevelsBonus: 0,
        varietyLevelsDetails: '',
        mixedDoublesMatches: [],
        mixedDoublesBonus: 0,
        mixedDoublesDetails: '',
        monthEnded: today > monthData.endDate,
        penalty: 0
      };

      // Volume bonus
      if (count >= 20) {
        breakdown.volumeBonus = 4;
        breakdown.volumeDetails = '20+ matches';
      } else if (count >= 15) {
        breakdown.volumeBonus = 3;
        breakdown.volumeDetails = '15-19 matches';
      } else if (count >= 10) {
        breakdown.volumeBonus = 2;
        breakdown.volumeDetails = '10-14 matches';
      } else if (count >= 5) {
        breakdown.volumeBonus = 1;
        breakdown.volumeDetails = '5-9 matches';
      } else {
        breakdown.volumeDetails = `Only ${count} matches (need 5+)`;
      }

      // Penalty for < 4 matches (only if month ended)
      if (count < 4 && breakdown.monthEnded) {
        breakdown.penalty = -4;
      }

      // Full roster bonus - collect unique players
      monthMatches.forEach(match => {
        const teamPlayers = match.team1Id === teamId ? match.team1Players : match.team2Players;
        (teamPlayers || []).forEach(playerId => breakdown.uniquePlayers.add(playerId));
      });

      const teamPlayers = players.filter(p => p.teamId === teamId && p.status === 'active');
      const uniquePlayerCount = breakdown.uniquePlayers.size;

      if (monthMatches.length > 0 && teamPlayers.length > 0 && teamPlayers.length <= 14 && uniquePlayerCount === teamPlayers.length) {
        breakdown.fullRosterBonus = 1;
        breakdown.fullRosterDetails = `All ${teamPlayers.length} active players played`;
      } else {
        breakdown.fullRosterDetails = `${uniquePlayerCount}/${teamPlayers.length} active players played`;
      }

      // Variety - opponent teams
      monthMatches.forEach(match => {
        const opponentId = match.team1Id === teamId ? match.team2Id : match.team1Id;
        breakdown.opponentTeams.add(opponentId);
      });

      if (breakdown.opponentTeams.size >= 3) {
        breakdown.varietyTeamsBonus = 1;
        breakdown.varietyTeamsDetails = `Played ${breakdown.opponentTeams.size} different teams`;
      } else {
        breakdown.varietyTeamsDetails = `Only ${breakdown.opponentTeams.size} teams (need 3+)`;
      }

      // Variety - levels
      monthMatches.forEach(match => {
        if (match.level) breakdown.levels.add(match.level);
      });

      if (breakdown.levels.size >= 3) {
        breakdown.varietyLevelsBonus = 1;
        breakdown.varietyLevelsDetails = `Played ${breakdown.levels.size} different levels`;
      } else {
        breakdown.varietyLevelsDetails = `Only ${breakdown.levels.size} levels (need 3+)`;
      }

      // Mixed doubles
      monthMatches.forEach(match => {
        const matchType = getEffectiveMatchType(match, players, teamId);
        if (matchType === MATCH_TYPES.MIXED_DOUBLES) {
          const opponentTeam = teams.find(t => t.id === (match.team1Id === teamId ? match.team2Id : match.team1Id));
          breakdown.mixedDoublesMatches.push({
            date: match.date,
            opponent: opponentTeam?.name || 'Unknown',
            level: match.level
          });
        }
      });

      if (breakdown.mixedDoublesMatches.length >= 2) {
        breakdown.mixedDoublesBonus = 1;
        breakdown.mixedDoublesDetails = `${breakdown.mixedDoublesMatches.length} mixed doubles matches`;
      } else {
        breakdown.mixedDoublesDetails = `Only ${breakdown.mixedDoublesMatches.length} mixed doubles (need 2+)`;
      }

      monthlyBreakdowns[monthKey] = breakdown;
      totalBonus += breakdown.volumeBonus + breakdown.fullRosterBonus + breakdown.varietyTeamsBonus + breakdown.varietyLevelsBonus + breakdown.mixedDoublesBonus + breakdown.penalty;
    });

    // Manual bonus entries
    const manualBonuses = bonusEntries.filter(b => b.teamId === teamId);
    const manualBonusTotal = manualBonuses.reduce((sum, b) => sum + b.points, 0);
    totalBonus += manualBonusTotal;

    // Uniform and practice bonuses
    let uniformBonus = 0;
    let practiceBonus = 0;

    if (team.bonuses) {
      if (team.bonuses.uniformPhotoSubmitted) {
        if (team.bonuses.uniformType === 'colors') uniformBonus = 2;
        else if (team.bonuses.uniformType === 'tops-bottoms') uniformBonus = 4;
        else if (team.bonuses.uniformType === 'custom') uniformBonus = 6;
      }

      if (team.bonuses.practices) {
        let practiceTotal = 0;
        Object.values(team.bonuses.practices).forEach(count => {
          practiceTotal += Math.min(count * 0.5, 2);
        });
        practiceBonus = Math.min(practiceTotal, 4);
      }
    }

    totalBonus += uniformBonus + practiceBonus;

    // Calculate match win points for cap
    const teamMatchesAll = matches.filter(m => m.team1Id === teamId || m.team2Id === teamId);
    let matchWinPoints = 0;

    teamMatchesAll.forEach(match => {
      const isTeam1 = match.team1Id === teamId;
      const won = isTeam1 ? match.winner === 'team1' : match.winner === 'team2';

      if (won) {
        const matchDate = new Date(match.date);
        const month = matchDate.getMonth();

        if (month === 0) { // January (year 2026)
          matchWinPoints += 4;
        } else if (month === 10 || month === 11) { // November or December
          matchWinPoints += 2;
        } else {
          matchWinPoints += 2;
        }
      }
    });

    const capLimit = matchWinPoints * 0.25;
    const cappedBonus = Math.min(Math.max(0, totalBonus), capLimit);

    return {
      team,
      monthlyBreakdowns,
      manualBonuses,
      uniformBonus,
      practiceBonus,
      totalUncappedBonus: totalBonus,
      matchWinPoints,
      capLimit,
      cappedBonus
    };
  };

  // Export to CSV
  const exportToCSV = () => {
    if (!selectedTeamId) return;

    const audit = calculateDetailedBonus(selectedTeamId);
    if (!audit) return;

    let csv = `Bonus Points Audit - ${audit.team.name}\n\n`;

    // Monthly breakdown
    csv += 'Month,Matches Played,Volume Bonus,Unique Players,Full Roster Bonus,Different Teams,Variety Teams Bonus,Different Levels,Variety Levels Bonus,Mixed Doubles,Mixed Doubles Bonus,Penalty\n';

    tournamentMonths.forEach(monthData => {
      const breakdown = audit.monthlyBreakdowns[monthData.key];
      csv += `${monthData.name},`;
      csv += `${breakdown.matchCount},`;
      csv += `${breakdown.volumeBonus},`;
      csv += `${breakdown.uniquePlayers.size},`;
      csv += `${breakdown.fullRosterBonus},`;
      csv += `${breakdown.opponentTeams.size},`;
      csv += `${breakdown.varietyTeamsBonus},`;
      csv += `${breakdown.levels.size},`;
      csv += `${breakdown.varietyLevelsBonus},`;
      csv += `${breakdown.mixedDoublesMatches.length},`;
      csv += `${breakdown.mixedDoublesBonus},`;
      csv += `${breakdown.penalty}\n`;
    });

    csv += `\nSummary\n`;
    csv += `Raw Bonus Points Total,${audit.totalUncappedBonus}\n`;
    csv += `Match Win Points,${audit.matchWinPoints}\n`;
    csv += `25% Cap Limit,${audit.capLimit.toFixed(1)}\n`;
    csv += `Final Capped Bonus,${audit.cappedBonus.toFixed(1)}\n`;

    // Download
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bonus-audit-${audit.team.name.replace(/\s+/g, '-')}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  // Print function
  const handlePrint = () => {
    window.print();
  };

  if (teams.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-2xl font-bold mb-4">Bonus Points Audit</h2>
        <p className="text-gray-500">No teams available to audit.</p>
      </div>
    );
  }

  const audit = calculateDetailedBonus(selectedTeamId);
  if (!audit) return null;

  return (
    <div className="bg-white rounded-lg shadow-md p-6 print:shadow-none">
      <div className="flex justify-between items-center mb-6 print:mb-4">
        <h2 className="text-2xl font-bold">Bonus Points Audit</h2>
        <div className="flex gap-2 print:hidden">
          <button
            onClick={exportToCSV}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition"
          >
            <FileSpreadsheet className="w-4 h-4" />
            Export CSV
          </button>
          <button
            onClick={handlePrint}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition"
          >
            <Download className="w-4 h-4" />
            Print
          </button>
        </div>
      </div>

      {/* Team Selector */}
      <div className="mb-6 print:mb-4">
        <label className="block text-sm font-semibold mb-2">Select Team:</label>
        <select
          value={selectedTeamId || ''}
          onChange={(e) => setSelectedTeamId(parseInt(e.target.value))}
          className="w-full p-2 border rounded print:border-none print:font-bold"
        >
          {teams.map(team => (
            <option key={team.id} value={team.id}>
              {team.name}
            </option>
          ))}
        </select>
      </div>

      {/* Monthly Breakdown Table */}
      <div className="mb-8">
        <h3 className="text-xl font-bold mb-4">Monthly Breakdown</h3>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-gray-100">
                <th className="border p-2 text-left font-semibold">Bonus Category</th>
                {tournamentMonths.map(month => (
                  <th key={month.key} className="border p-2 text-center font-semibold">{month.name}</th>
                ))}
                <th className="border p-2 text-center font-semibold bg-blue-50">Total</th>
              </tr>
            </thead>
            <tbody>
              {/* Matches Played */}
              <tr>
                <td className="border p-2 font-medium">Matches Played</td>
                {tournamentMonths.map(month => {
                  const breakdown = audit.monthlyBreakdowns[month.key];
                  return (
                    <td key={month.key} className="border p-2 text-center">
                      {breakdown.matchCount}
                    </td>
                  );
                })}
                <td className="border p-2 text-center font-semibold bg-blue-50">
                  {tournamentMonths.reduce((sum, m) => sum + audit.monthlyBreakdowns[m.key].matchCount, 0)}
                </td>
              </tr>

              {/* Volume Bonus */}
              <tr className="bg-green-50">
                <td className="border p-2 font-medium">Volume Bonus</td>
                {tournamentMonths.map(month => {
                  const breakdown = audit.monthlyBreakdowns[month.key];
                  return (
                    <td key={month.key} className="border p-2 text-center">
                      <div className="flex items-center justify-center gap-1">
                        {breakdown.volumeBonus > 0 ? (
                          <>
                            <CheckCircle2 className="w-4 h-4 text-green-600" />
                            <span className="font-semibold text-green-700">+{breakdown.volumeBonus}</span>
                          </>
                        ) : (
                          <>
                            <XCircle className="w-4 h-4 text-gray-400" />
                            <span className="text-gray-500">0</span>
                          </>
                        )}
                      </div>
                      <div className="text-xs text-gray-600 mt-1">{breakdown.volumeDetails}</div>
                    </td>
                  );
                })}
                <td className="border p-2 text-center font-semibold bg-blue-50">
                  +{tournamentMonths.reduce((sum, m) => sum + audit.monthlyBreakdowns[m.key].volumeBonus, 0)}
                </td>
              </tr>

              {/* Unique Players */}
              <tr>
                <td className="border p-2 font-medium">Unique Players Who Played</td>
                {tournamentMonths.map(month => {
                  const breakdown = audit.monthlyBreakdowns[month.key];
                  const teamPlayerCount = players.filter(p => p.teamId === selectedTeamId && p.status === 'active').length;
                  return (
                    <td key={month.key} className="border p-2 text-center">
                      {breakdown.uniquePlayers.size}/{teamPlayerCount}
                    </td>
                  );
                })}
                <td className="border p-2 text-center bg-blue-50">-</td>
              </tr>

              {/* Full Roster Bonus */}
              <tr className="bg-green-50">
                <td className="border p-2 font-medium">Full Roster Bonus</td>
                {tournamentMonths.map(month => {
                  const breakdown = audit.monthlyBreakdowns[month.key];
                  return (
                    <td key={month.key} className="border p-2 text-center">
                      <div className="flex items-center justify-center gap-1">
                        {breakdown.fullRosterBonus > 0 ? (
                          <>
                            <CheckCircle2 className="w-4 h-4 text-green-600" />
                            <span className="font-semibold text-green-700">+{breakdown.fullRosterBonus}</span>
                          </>
                        ) : (
                          <>
                            <XCircle className="w-4 h-4 text-gray-400" />
                            <span className="text-gray-500">0</span>
                          </>
                        )}
                      </div>
                      <div className="text-xs text-gray-600 mt-1">{breakdown.fullRosterDetails}</div>
                    </td>
                  );
                })}
                <td className="border p-2 text-center font-semibold bg-blue-50">
                  +{tournamentMonths.reduce((sum, m) => sum + audit.monthlyBreakdowns[m.key].fullRosterBonus, 0)}
                </td>
              </tr>

              {/* Different Teams Played */}
              <tr>
                <td className="border p-2 font-medium">Different Teams Played</td>
                {tournamentMonths.map(month => {
                  const breakdown = audit.monthlyBreakdowns[month.key];
                  return (
                    <td key={month.key} className="border p-2 text-center">
                      {breakdown.opponentTeams.size}
                    </td>
                  );
                })}
                <td className="border p-2 text-center bg-blue-50">-</td>
              </tr>

              {/* Variety Bonus 1 (Teams) */}
              <tr className="bg-green-50">
                <td className="border p-2 font-medium">Variety Bonus 1 (Teams)</td>
                {tournamentMonths.map(month => {
                  const breakdown = audit.monthlyBreakdowns[month.key];
                  return (
                    <td key={month.key} className="border p-2 text-center">
                      <div className="flex items-center justify-center gap-1">
                        {breakdown.varietyTeamsBonus > 0 ? (
                          <>
                            <CheckCircle2 className="w-4 h-4 text-green-600" />
                            <span className="font-semibold text-green-700">+{breakdown.varietyTeamsBonus}</span>
                          </>
                        ) : (
                          <>
                            <XCircle className="w-4 h-4 text-gray-400" />
                            <span className="text-gray-500">0</span>
                          </>
                        )}
                      </div>
                      <div className="text-xs text-gray-600 mt-1">{breakdown.varietyTeamsDetails}</div>
                    </td>
                  );
                })}
                <td className="border p-2 text-center font-semibold bg-blue-50">
                  +{tournamentMonths.reduce((sum, m) => sum + audit.monthlyBreakdowns[m.key].varietyTeamsBonus, 0)}
                </td>
              </tr>

              {/* Different Levels Played */}
              <tr>
                <td className="border p-2 font-medium">Different Levels Played</td>
                {tournamentMonths.map(month => {
                  const breakdown = audit.monthlyBreakdowns[month.key];
                  return (
                    <td key={month.key} className="border p-2 text-center">
                      {breakdown.levels.size}
                      {breakdown.levels.size > 0 && (
                        <div className="text-xs text-gray-600 mt-1">
                          {Array.from(breakdown.levels).sort().join(', ')}
                        </div>
                      )}
                    </td>
                  );
                })}
                <td className="border p-2 text-center bg-blue-50">-</td>
              </tr>

              {/* Variety Bonus 2 (Levels) */}
              <tr className="bg-green-50">
                <td className="border p-2 font-medium">Variety Bonus 2 (Levels)</td>
                {tournamentMonths.map(month => {
                  const breakdown = audit.monthlyBreakdowns[month.key];
                  return (
                    <td key={month.key} className="border p-2 text-center">
                      <div className="flex items-center justify-center gap-1">
                        {breakdown.varietyLevelsBonus > 0 ? (
                          <>
                            <CheckCircle2 className="w-4 h-4 text-green-600" />
                            <span className="font-semibold text-green-700">+{breakdown.varietyLevelsBonus}</span>
                          </>
                        ) : (
                          <>
                            <XCircle className="w-4 h-4 text-gray-400" />
                            <span className="text-gray-500">0</span>
                          </>
                        )}
                      </div>
                      <div className="text-xs text-gray-600 mt-1">{breakdown.varietyLevelsDetails}</div>
                    </td>
                  );
                })}
                <td className="border p-2 text-center font-semibold bg-blue-50">
                  +{tournamentMonths.reduce((sum, m) => sum + audit.monthlyBreakdowns[m.key].varietyLevelsBonus, 0)}
                </td>
              </tr>

              {/* Mixed Doubles Matches */}
              <tr>
                <td className="border p-2 font-medium">Mixed Doubles Matches</td>
                {tournamentMonths.map(month => {
                  const breakdown = audit.monthlyBreakdowns[month.key];
                  return (
                    <td key={month.key} className="border p-2 text-center">
                      {breakdown.mixedDoublesMatches.length}
                    </td>
                  );
                })}
                <td className="border p-2 text-center bg-blue-50">
                  {tournamentMonths.reduce((sum, m) => sum + audit.monthlyBreakdowns[m.key].mixedDoublesMatches.length, 0)}
                </td>
              </tr>

              {/* Mixed Doubles Bonus */}
              <tr className="bg-green-50">
                <td className="border p-2 font-medium">Mixed Doubles Bonus</td>
                {tournamentMonths.map(month => {
                  const breakdown = audit.monthlyBreakdowns[month.key];
                  return (
                    <td key={month.key} className="border p-2 text-center">
                      <div className="flex items-center justify-center gap-1">
                        {breakdown.mixedDoublesBonus > 0 ? (
                          <>
                            <CheckCircle2 className="w-4 h-4 text-green-600" />
                            <span className="font-semibold text-green-700">+{breakdown.mixedDoublesBonus}</span>
                          </>
                        ) : (
                          <>
                            <XCircle className="w-4 h-4 text-gray-400" />
                            <span className="text-gray-500">0</span>
                          </>
                        )}
                      </div>
                      <div className="text-xs text-gray-600 mt-1">{breakdown.mixedDoublesDetails}</div>
                    </td>
                  );
                })}
                <td className="border p-2 text-center font-semibold bg-blue-50">
                  +{tournamentMonths.reduce((sum, m) => sum + audit.monthlyBreakdowns[m.key].mixedDoublesBonus, 0)}
                </td>
              </tr>

              {/* Penalty Row */}
              <tr className="bg-red-50">
                <td className="border p-2 font-medium">Less than 4 Matches Penalty</td>
                {tournamentMonths.map(month => {
                  const breakdown = audit.monthlyBreakdowns[month.key];
                  return (
                    <td key={month.key} className="border p-2 text-center">
                      {breakdown.penalty < 0 ? (
                        <div className="flex items-center justify-center gap-1">
                          <XCircle className="w-4 h-4 text-red-600" />
                          <span className="font-semibold text-red-700">{breakdown.penalty}</span>
                        </div>
                      ) : (
                        <span className="text-gray-500">-</span>
                      )}
                    </td>
                  );
                })}
                <td className="border p-2 text-center font-semibold bg-blue-50">
                  {tournamentMonths.reduce((sum, m) => sum + audit.monthlyBreakdowns[m.key].penalty, 0)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Additional Bonuses */}
      <div className="mb-8">
        <h3 className="text-xl font-bold mb-4">Additional Bonuses</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="border rounded p-4">
            <h4 className="font-semibold mb-2">Uniform Bonus</h4>
            <p className="text-sm text-gray-600">
              {audit.uniformBonus > 0 ? (
                <span className="text-green-700 font-semibold">
                  +{audit.uniformBonus} points ({audit.team.bonuses?.uniformType || 'none'})
                </span>
              ) : (
                <span className="text-gray-500">No uniform bonus</span>
              )}
            </p>
          </div>
          <div className="border rounded p-4">
            <h4 className="font-semibold mb-2">Practice Bonus</h4>
            <p className="text-sm text-gray-600">
              {audit.practiceBonus > 0 ? (
                <span className="text-green-700 font-semibold">
                  +{audit.practiceBonus} points (capped at 4)
                </span>
              ) : (
                <span className="text-gray-500">No practice bonus</span>
              )}
            </p>
          </div>
          {audit.manualBonuses.length > 0 && (
            <div className="border rounded p-4 md:col-span-2">
              <h4 className="font-semibold mb-2">Manual Bonus Entries</h4>
              <ul className="text-sm text-gray-600 space-y-1">
                {audit.manualBonuses.map((bonus, idx) => (
                  <li key={idx} className="flex justify-between">
                    <span>{bonus.description || 'Manual bonus'}</span>
                    <span className="font-semibold text-green-700">+{bonus.points}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      {/* Summary Section */}
      <div className="border-t-2 pt-6">
        <h3 className="text-xl font-bold mb-4">Summary</h3>
        <div className="bg-gray-50 rounded p-6 space-y-3">
          <div className="flex justify-between items-center">
            <span className="font-medium">Raw Bonus Points Total:</span>
            <span className="text-xl font-bold">{audit.totalUncappedBonus.toFixed(1)}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="font-medium">Match Win Points:</span>
            <span className="text-xl font-bold">{audit.matchWinPoints}</span>
          </div>
          <div className="flex justify-between items-center text-sm text-gray-600">
            <span>25% Cap Limit:</span>
            <span>{audit.matchWinPoints} × 0.25 = {audit.capLimit.toFixed(1)}</span>
          </div>
          <div className="flex justify-between items-center pt-3 border-t-2">
            <span className="font-bold text-lg">Final Capped Bonus:</span>
            <span className="text-2xl font-bold text-blue-600">
              {audit.cappedBonus.toFixed(1)}
            </span>
          </div>
          {audit.totalUncappedBonus > audit.capLimit && (
            <div className="text-sm text-amber-600 bg-amber-50 p-3 rounded">
              ⚠️ Bonus was capped at 25% of match win points ({audit.capLimit.toFixed(1)} vs {audit.totalUncappedBonus.toFixed(1)})
            </div>
          )}
        </div>
      </div>

      {/* Detailed Player List */}
      <div className="mt-8 print:break-before-page">
        <h3 className="text-xl font-bold mb-4">Player Participation Details</h3>
        {tournamentMonths.map(month => {
          const breakdown = audit.monthlyBreakdowns[month.key];

          // Active players only (counted for Full Roster bonus)
          const teamRoster = players.filter(p => p.teamId === selectedTeamId && p.status === 'active');

          // Injured players (excluded from Full Roster bonus)
          const injuredPlayers = players.filter(p => p.teamId === selectedTeamId && p.status === 'injured');

          // Get player objects who played (not just IDs)
          const playersWhoPlayed = teamRoster.filter(p => breakdown.uniquePlayers.has(p.id));
          const playersWhoDidNot = teamRoster.filter(p => !breakdown.uniquePlayers.has(p.id));

          // Create comma-separated name lists
          const playedNames = playersWhoPlayed.map(p => `${p.firstName} ${p.lastName}`).join(', ');
          const notPlayedNames = playersWhoDidNot.map(p => `${p.firstName} ${p.lastName}`).join(', ');
          const injuredNames = injuredPlayers.map(p => `${p.firstName} ${p.lastName}`).join(', ');

          return (
            <div key={month.key} className="mb-6 border rounded p-4">
              <h4 className="font-semibold mb-3">{month.name}</h4>
              <div className="space-y-4 text-sm">
                <div>
                  <p className="font-medium text-green-700 mb-2">
                    ✓ Played: {playedNames || 'None'} ({playersWhoPlayed.length} of {teamRoster.length} active)
                  </p>
                  {playersWhoPlayed.length > 0 && (
                    <ul className="ml-4 space-y-1 text-gray-700">
                      {playersWhoPlayed.map(player => (
                        <li key={player.id}>• {player.firstName} {player.lastName}</li>
                      ))}
                    </ul>
                  )}
                </div>
                <div>
                  <p className="font-medium text-red-700 mb-2">
                    ✗ Did Not Play: {notPlayedNames || 'None'} ({playersWhoDidNot.length} of {teamRoster.length} active)
                  </p>
                  {playersWhoDidNot.length > 0 && (
                    <ul className="ml-4 space-y-1 text-gray-500">
                      {playersWhoDidNot.map(player => (
                        <li key={player.id}>• {player.firstName} {player.lastName}</li>
                      ))}
                    </ul>
                  )}
                  {playersWhoDidNot.length === 0 && (
                    <p className="ml-4 text-gray-500 italic">All active players participated!</p>
                  )}
                </div>
                {injuredPlayers.length > 0 && (
                  <div className="border-t pt-3">
                    <p className="font-medium text-amber-600 mb-2">
                      ⚕️ Injured (Excluded from Full Roster bonus): {injuredNames} ({injuredPlayers.length})
                    </p>
                    <ul className="ml-4 space-y-1 text-amber-700">
                      {injuredPlayers.map(player => (
                        <li key={player.id}>• {player.firstName} {player.lastName}</li>
                      ))}
                    </ul>
                    <p className="ml-4 mt-2 text-xs text-amber-600 italic">
                      These players are excluded from the Full Roster Participation bonus calculation.
                    </p>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Mixed Doubles Details */}
      {tournamentMonths.some(m => audit.monthlyBreakdowns[m.key].mixedDoublesMatches.length > 0) && (
        <div className="mt-8">
          <h3 className="text-xl font-bold mb-4">Mixed Doubles Match Details</h3>
          {tournamentMonths.map(month => {
            const breakdown = audit.monthlyBreakdowns[month.key];
            if (breakdown.mixedDoublesMatches.length === 0) return null;

            return (
              <div key={month.key} className="mb-4 border rounded p-4">
                <h4 className="font-semibold mb-3">{month.name}</h4>
                <ul className="space-y-2 text-sm">
                  {breakdown.mixedDoublesMatches.map((match, idx) => (
                    <li key={idx} className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-green-600" />
                      <span className="text-gray-700">
                        {new Date(match.date).toLocaleDateString('en-US')} vs {match.opponent} ({match.level})
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default BonusAudit;
