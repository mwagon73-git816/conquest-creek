import React, { useState } from 'react';
import { CheckCircle2, XCircle, AlertTriangle, Download, FileSpreadsheet } from 'lucide-react';

const PointsAudit = ({ teams, matches, players, calculateTeamPoints, calculateBonusPoints }) => {
  const [selectedTeamId, setSelectedTeamId] = useState(teams.length > 0 ? teams[0].id : null);
  const [expandedTeamId, setExpandedTeamId] = useState(null);

  // Calculate leaderboard using the existing function
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

  // Recalculate points from scratch for audit
  const recalculateTeamPoints = (teamId) => {
    // Filter ONLY completed matches
    const teamMatches = matches.filter(m =>
      (m.team1Id === teamId || m.team2Id === teamId) &&
      m.status === 'completed'
    );

    let matchWinPoints = 0;
    let matchWins = 0;
    let matchLosses = 0;
    let setsWon = 0;
    let gamesWon = 0;
    const matchBreakdown = [];

    teamMatches.forEach(match => {
      const isTeam1 = match.team1Id === teamId;
      const won = isTeam1 ? match.winner === 'team1' : match.winner === 'team2';

      const opponentTeam = teams.find(t => t.id === (isTeam1 ? match.team2Id : match.team1Id));
      const matchDate = new Date(match.date);
      const month = matchDate.getMonth();

      // Calculate points based on month
      let pointsForWin = 0;
      let monthName = '';
      if (month === 0) { // January
        pointsForWin = 4;
        monthName = 'January';
      } else if (month === 10) { // November
        pointsForWin = 2;
        monthName = 'November';
      } else if (month === 11) { // December
        pointsForWin = 2;
        monthName = 'December';
      } else {
        pointsForWin = 2;
        monthName = 'Month ' + (month + 1);
      }

      // Parse set scores
      const s1t1 = parseInt(match.set1Team1) || 0;
      const s1t2 = parseInt(match.set1Team2) || 0;
      const s2t1 = parseInt(match.set2Team1) || 0;
      const s2t2 = parseInt(match.set2Team2) || 0;
      const s3t1 = parseInt(match.set3Team1) || 0;
      const s3t2 = parseInt(match.set3Team2) || 0;

      // Count sets and games for this match
      let matchSetsWon = 0;
      let matchGamesWon = 0;

      if (isTeam1) {
        if (s1t1 > 0 && s1t2 > 0) {
          if (s1t1 > s1t2) matchSetsWon++;
          matchGamesWon += s1t1;
        }
        if (s2t1 > 0 && s2t2 > 0) {
          if (s2t1 > s2t2) matchSetsWon++;
          matchGamesWon += s2t1;
        }
        if (s3t1 > 0 && s3t2 > 0) {
          if (s3t1 > s3t2) matchSetsWon++;
          matchGamesWon += s3t1;
        }
      } else {
        if (s1t1 > 0 && s1t2 > 0) {
          if (s1t2 > s1t1) matchSetsWon++;
          matchGamesWon += s1t2;
        }
        if (s2t1 > 0 && s2t2 > 0) {
          if (s2t2 > s2t1) matchSetsWon++;
          matchGamesWon += s2t2;
        }
        if (s3t1 > 0 && s3t2 > 0) {
          if (s3t2 > s3t1) matchSetsWon++;
          matchGamesWon += s3t2;
        }
      }

      if (won) {
        matchWins++;
        matchWinPoints += pointsForWin;
      } else {
        matchLosses++;
      }

      setsWon += matchSetsWon;
      gamesWon += matchGamesWon;

      matchBreakdown.push({
        date: match.date,
        opponent: opponentTeam?.name || 'Unknown',
        won,
        pointsEarned: won ? pointsForWin : 0,
        monthName,
        score: `${s1t1}-${s1t2}, ${s2t1}-${s2t2}${s3t1 > 0 ? `, ${s3t1}-${s3t2}` : ''}`,
        setsWon: matchSetsWon,
        gamesWon: matchGamesWon,
        level: match.level || 'N/A'
      });
    });

    // Sort matches by date (oldest to newest)
    matchBreakdown.sort((a, b) => new Date(a.date) - new Date(b.date));

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
      matchesPlayed: teamMatches.length,
      matchBreakdown
    };
  };

  // Compare recalculated vs displayed
  const auditTeam = (teamId) => {
    const recalculated = recalculateTeamPoints(teamId);
    const displayed = calculateTeamPoints(teamId);

    const discrepancies = [];

    if (Math.abs(recalculated.matchWinPoints - displayed.matchWinPoints) > 0.001) {
      discrepancies.push({
        field: 'Match Win Points',
        expected: recalculated.matchWinPoints,
        actual: displayed.matchWinPoints,
        difference: displayed.matchWinPoints - recalculated.matchWinPoints
      });
    }

    if (Math.abs(recalculated.bonusPoints - displayed.bonusPoints) > 0.001) {
      discrepancies.push({
        field: 'Bonus Points (Uncapped)',
        expected: recalculated.bonusPoints,
        actual: displayed.bonusPoints,
        difference: displayed.bonusPoints - recalculated.bonusPoints
      });
    }

    if (Math.abs(recalculated.cappedBonus - displayed.cappedBonus) > 0.001) {
      discrepancies.push({
        field: 'Capped Bonus',
        expected: recalculated.cappedBonus,
        actual: displayed.cappedBonus,
        difference: displayed.cappedBonus - recalculated.cappedBonus
      });
    }

    if (Math.abs(recalculated.totalPoints - displayed.totalPoints) > 0.001) {
      discrepancies.push({
        field: 'Total Points',
        expected: recalculated.totalPoints,
        actual: displayed.totalPoints,
        difference: displayed.totalPoints - recalculated.totalPoints
      });
    }

    if (recalculated.matchWins !== displayed.matchWins) {
      discrepancies.push({
        field: 'Match Wins',
        expected: recalculated.matchWins,
        actual: displayed.matchWins,
        difference: displayed.matchWins - recalculated.matchWins
      });
    }

    if (recalculated.setsWon !== displayed.setsWon) {
      discrepancies.push({
        field: 'Sets Won',
        expected: recalculated.setsWon,
        actual: displayed.setsWon,
        difference: displayed.setsWon - recalculated.setsWon
      });
    }

    if (recalculated.gamesWon !== displayed.gamesWon) {
      discrepancies.push({
        field: 'Games Won',
        expected: recalculated.gamesWon,
        actual: displayed.gamesWon,
        difference: displayed.gamesWon - recalculated.gamesWon
      });
    }

    return {
      recalculated,
      displayed,
      discrepancies,
      hasDiscrepancies: discrepancies.length > 0
    };
  };

  // Full audit of all teams
  const fullAudit = () => {
    return teams.map(team => ({
      teamId: team.id,
      teamName: team.name,
      ...auditTeam(team.id)
    }));
  };

  // Export summary to CSV
  const exportToCSV = () => {
    const auditResults = fullAudit();

    let csv = 'Points Audit Report\n\n';
    csv += 'Team Name,Match Win Points (Expected),Match Win Points (Actual),Bonus Points (Expected),Bonus Points (Actual),Total Points (Expected),Total Points (Actual),Status\n';

    auditResults.forEach(result => {
      csv += `${result.teamName},`;
      csv += `${result.recalculated.matchWinPoints},`;
      csv += `${result.displayed.matchWinPoints},`;
      csv += `${result.recalculated.cappedBonus.toFixed(1)},`;
      csv += `${result.displayed.cappedBonus.toFixed(1)},`;
      csv += `${result.recalculated.totalPoints.toFixed(1)},`;
      csv += `${result.displayed.totalPoints.toFixed(1)},`;
      csv += `${result.hasDiscrepancies ? 'DISCREPANCY' : 'OK'}\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'points-audit-report.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  // Export match-by-match breakdown to CSV
  const exportMatchBreakdownCSV = (teamId) => {
    const result = auditTeam(teamId);
    const team = teams.find(t => t.id === teamId);

    let csv = `Match-by-Match Breakdown - ${team.name}\n\n`;
    csv += '#,Date,Opponent,Level,Score,Result,Month,Points Earned,Sets Won,Games Won\n';

    result.recalculated.matchBreakdown.forEach((match, idx) => {
      csv += `${idx + 1},`;
      csv += `${new Date(match.date).toLocaleDateString('en-US')},`;
      csv += `"${match.opponent}",`;
      csv += `${match.level},`;
      csv += `"${match.score}",`;
      csv += `${match.won ? 'W' : 'L'},`;
      csv += `${match.monthName},`;
      csv += `${match.pointsEarned},`;
      csv += `${match.setsWon},`;
      csv += `${match.gamesWon}\n`;
    });

    csv += `\nSummary\n`;
    csv += `Match Win Points,${result.recalculated.matchWinPoints}\n`;
    csv += `Match Record,${result.recalculated.matchWins}-${result.recalculated.matchLosses}\n`;
    csv += `Sets Won,${result.recalculated.setsWon}\n`;
    csv += `Games Won,${result.recalculated.gamesWon}\n`;
    csv += `Uncapped Bonus,${result.recalculated.bonusPoints.toFixed(1)}\n`;
    csv += `Capped Bonus,${result.recalculated.cappedBonus.toFixed(1)}\n`;
    csv += `Total Points,${result.recalculated.totalPoints.toFixed(1)}\n`;

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `match-breakdown-${team.name.replace(/\s+/g, '-')}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  // Print match-by-match breakdown
  const printMatchBreakdown = (teamId) => {
    const result = auditTeam(teamId);
    const team = teams.find(t => t.id === teamId);

    // Create a new window for printing
    const printWindow = window.open('', '_blank');

    let html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Match Breakdown - ${team.name}</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 20px; }
          h1 { color: #1e40af; }
          table { width: 100%; border-collapse: collapse; margin: 20px 0; }
          th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
          th { background-color: #f3f4f6; font-weight: bold; }
          .text-center { text-align: center; }
          .bg-green { background-color: #f0fdf4; }
          .summary { background-color: #f9fafb; padding: 15px; margin-top: 20px; border-radius: 5px; }
          .summary-item { display: flex; justify-content: space-between; margin: 5px 0; }
          @media print {
            button { display: none; }
          }
        </style>
      </head>
      <body>
        <h1>Match-by-Match Breakdown: ${team.name}</h1>
        <table>
          <thead>
            <tr>
              <th class="text-center">#</th>
              <th>Date</th>
              <th>Opponent</th>
              <th class="text-center">Level</th>
              <th class="text-center">Score</th>
              <th class="text-center">Result</th>
              <th class="text-center">Month</th>
              <th class="text-center">Points Earned</th>
              <th class="text-center">Sets Won</th>
              <th class="text-center">Games Won</th>
            </tr>
          </thead>
          <tbody>
    `;

    result.recalculated.matchBreakdown.forEach((match, idx) => {
      html += `
        <tr class="${match.won ? 'bg-green' : ''}">
          <td class="text-center"><strong>${idx + 1}</strong></td>
          <td>${new Date(match.date).toLocaleDateString('en-US')}</td>
          <td>${match.opponent}</td>
          <td class="text-center">${match.level}</td>
          <td class="text-center">${match.score}</td>
          <td class="text-center"><strong>${match.won ? 'W' : 'L'}</strong></td>
          <td class="text-center">${match.monthName}</td>
          <td class="text-center"><strong>${match.pointsEarned}</strong></td>
          <td class="text-center">${match.setsWon}</td>
          <td class="text-center">${match.gamesWon}</td>
        </tr>
      `;
    });

    html += `
          </tbody>
          <tfoot>
            <tr style="background-color: #f3f4f6; font-weight: bold;">
              <td colspan="7" style="text-align: right;">TOTALS:</td>
              <td class="text-center">${result.recalculated.matchWinPoints}</td>
              <td class="text-center">${result.recalculated.setsWon}</td>
              <td class="text-center">${result.recalculated.gamesWon}</td>
            </tr>
          </tfoot>
        </table>

        <div class="summary">
          <h3>Points Summary</h3>
          <div class="summary-item">
            <span>Match Win Points:</span>
            <strong>${result.recalculated.matchWinPoints}</strong>
          </div>
          <div class="summary-item">
            <span>Match Record:</span>
            <strong>${result.recalculated.matchWins}-${result.recalculated.matchLosses}</strong>
          </div>
          <div class="summary-item">
            <span>Uncapped Bonus:</span>
            <strong>${result.recalculated.bonusPoints.toFixed(1)}</strong>
          </div>
          <div class="summary-item">
            <span>25% Cap Limit:</span>
            <strong>${(result.recalculated.matchWinPoints * 0.25).toFixed(1)}</strong>
          </div>
          <div class="summary-item">
            <span>Capped Bonus:</span>
            <strong>${result.recalculated.cappedBonus.toFixed(1)}</strong>
          </div>
          <div class="summary-item" style="border-top: 2px solid #ddd; padding-top: 10px; margin-top: 10px;">
            <span style="font-size: 18px;">TOTAL POINTS:</span>
            <strong style="font-size: 18px; color: #1e40af;">${result.recalculated.totalPoints.toFixed(1)}</strong>
          </div>
        </div>

        <button onclick="window.print()" style="margin-top: 20px; padding: 10px 20px; background-color: #2563eb; color: white; border: none; border-radius: 5px; cursor: pointer;">Print</button>
      </body>
      </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();
  };

  if (teams.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-2xl font-bold mb-4">Points Audit</h2>
        <p className="text-gray-500">No teams available to audit.</p>
      </div>
    );
  }

  const auditResults = fullAudit();
  const hasAnyDiscrepancies = auditResults.some(r => r.hasDiscrepancies);

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">Points Audit</h2>
        <button
          onClick={exportToCSV}
          className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition"
        >
          <FileSpreadsheet className="w-4 h-4" />
          Export CSV
        </button>
      </div>

      {/* Summary Alert */}
      {hasAnyDiscrepancies ? (
        <div className="bg-red-50 border-l-4 border-red-600 p-4 mb-6">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-red-600" />
            <div>
              <h3 className="font-bold text-red-800">Discrepancies Found</h3>
              <p className="text-sm text-red-700">
                {auditResults.filter(r => r.hasDiscrepancies).length} team(s) have point calculation discrepancies.
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-green-50 border-l-4 border-green-600 p-4 mb-6">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-green-600" />
            <div>
              <h3 className="font-bold text-green-800">All Points Verified</h3>
              <p className="text-sm text-green-700">
                All team point calculations match expected values.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Audit Table */}
      <div className="overflow-x-auto mb-6">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-gray-100">
              <th className="border p-2 text-left font-semibold">Team</th>
              <th className="border p-2 text-center font-semibold">Match Win Points</th>
              <th className="border p-2 text-center font-semibold">Bonus Points</th>
              <th className="border p-2 text-center font-semibold">Total Points</th>
              <th className="border p-2 text-center font-semibold">Matches</th>
              <th className="border p-2 text-center font-semibold">Record</th>
              <th className="border p-2 text-center font-semibold">Sets Won</th>
              <th className="border p-2 text-center font-semibold">Games Won</th>
              <th className="border p-2 text-center font-semibold">Status</th>
            </tr>
          </thead>
          <tbody>
            {auditResults.map(result => {
              const matchWinMatch = Math.abs(result.recalculated.matchWinPoints - result.displayed.matchWinPoints) < 0.001;
              const bonusMatch = Math.abs(result.recalculated.cappedBonus - result.displayed.cappedBonus) < 0.001;
              const totalMatch = Math.abs(result.recalculated.totalPoints - result.displayed.totalPoints) < 0.001;
              const setsMatch = result.recalculated.setsWon === result.displayed.setsWon;
              const gamesMatch = result.recalculated.gamesWon === result.displayed.gamesWon;

              return (
                <tr
                  key={result.teamId}
                  className={`${result.hasDiscrepancies ? 'bg-red-50' : ''} hover:bg-gray-50 cursor-pointer`}
                  onClick={() => setExpandedTeamId(expandedTeamId === result.teamId ? null : result.teamId)}
                >
                  <td className="border p-2 font-medium">{result.teamName}</td>
                  <td className={`border p-2 text-center ${!matchWinMatch ? 'bg-red-100 font-bold' : ''}`}>
                    {result.displayed.matchWinPoints}
                    {!matchWinMatch && (
                      <div className="text-xs text-red-600">Expected: {result.recalculated.matchWinPoints}</div>
                    )}
                  </td>
                  <td className={`border p-2 text-center ${!bonusMatch ? 'bg-red-100 font-bold' : ''}`}>
                    {result.displayed.cappedBonus.toFixed(1)}
                    {!bonusMatch && (
                      <div className="text-xs text-red-600">Expected: {result.recalculated.cappedBonus.toFixed(1)}</div>
                    )}
                  </td>
                  <td className={`border p-2 text-center font-bold ${!totalMatch ? 'bg-red-100' : ''}`}>
                    {result.displayed.totalPoints.toFixed(1)}
                    {!totalMatch && (
                      <div className="text-xs text-red-600">Expected: {result.recalculated.totalPoints.toFixed(1)}</div>
                    )}
                  </td>
                  <td className="border p-2 text-center">{result.recalculated.matchesPlayed}</td>
                  <td className="border p-2 text-center">{result.recalculated.matchWins}-{result.recalculated.matchLosses}</td>
                  <td className={`border p-2 text-center ${!setsMatch ? 'bg-red-100 font-bold' : ''}`}>
                    {result.displayed.setsWon}
                    {!setsMatch && (
                      <div className="text-xs text-red-600">Expected: {result.recalculated.setsWon}</div>
                    )}
                  </td>
                  <td className={`border p-2 text-center ${!gamesMatch ? 'bg-red-100 font-bold' : ''}`}>
                    {result.displayed.gamesWon}
                    {!gamesMatch && (
                      <div className="text-xs text-red-600">Expected: {result.recalculated.gamesWon}</div>
                    )}
                  </td>
                  <td className="border p-2 text-center">
                    {result.hasDiscrepancies ? (
                      <XCircle className="w-5 h-5 text-red-600 mx-auto" />
                    ) : (
                      <CheckCircle2 className="w-5 h-5 text-green-600 mx-auto" />
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Detailed Match Breakdown for Selected Team */}
      {auditResults.map(result => (
        expandedTeamId === result.teamId && (
          <div key={result.teamId} className="border-t-2 pt-6 mt-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold">Match-by-Match Breakdown: {result.teamName}</h3>
              <div className="flex gap-2">
                <button
                  onClick={() => exportMatchBreakdownCSV(result.teamId)}
                  className="flex items-center gap-2 px-3 py-2 bg-green-600 text-white text-sm rounded hover:bg-green-700 transition"
                >
                  <FileSpreadsheet className="w-4 h-4" />
                  Export CSV
                </button>
                <button
                  onClick={() => printMatchBreakdown(result.teamId)}
                  className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 transition"
                >
                  <Download className="w-4 h-4" />
                  Print
                </button>
              </div>
            </div>

            {/* Discrepancies Section */}
            {result.discrepancies.length > 0 && (
              <div className="bg-red-50 border border-red-200 rounded p-4 mb-6">
                <h4 className="font-bold text-red-800 mb-3 flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5" />
                  Discrepancies Found
                </h4>
                <div className="space-y-2">
                  {result.discrepancies.map((disc, idx) => (
                    <div key={idx} className="flex justify-between items-center text-sm">
                      <span className="font-medium">{disc.field}:</span>
                      <span>
                        Expected: <span className="font-bold text-green-700">{disc.expected}</span>
                        {' '}&rarr;{' '}
                        Actual: <span className="font-bold text-red-700">{disc.actual}</span>
                        {' '}
                        (Diff: <span className="font-bold">{disc.difference > 0 ? '+' : ''}{disc.difference.toFixed(1)}</span>)
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Match Details Table */}
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="border p-2 text-center font-semibold">#</th>
                    <th className="border p-2 text-left font-semibold">Date</th>
                    <th className="border p-2 text-left font-semibold">Opponent</th>
                    <th className="border p-2 text-center font-semibold">Level</th>
                    <th className="border p-2 text-center font-semibold">Score</th>
                    <th className="border p-2 text-center font-semibold">Result</th>
                    <th className="border p-2 text-center font-semibold">Month</th>
                    <th className="border p-2 text-center font-semibold">Points Earned</th>
                    <th className="border p-2 text-center font-semibold">Sets Won</th>
                    <th className="border p-2 text-center font-semibold">Games Won</th>
                  </tr>
                </thead>
                <tbody>
                  {result.recalculated.matchBreakdown.map((match, idx) => (
                    <tr key={idx} className={match.won ? 'bg-green-50' : ''}>
                      <td className="border p-2 text-center font-semibold text-gray-600">{idx + 1}</td>
                      <td className="border p-2">{new Date(match.date).toLocaleDateString('en-US')}</td>
                      <td className="border p-2">{match.opponent}</td>
                      <td className="border p-2 text-center">{match.level}</td>
                      <td className="border p-2 text-center font-mono">{match.score}</td>
                      <td className="border p-2 text-center">
                        {match.won ? (
                          <span className="text-green-700 font-bold">W</span>
                        ) : (
                          <span className="text-red-700 font-bold">L</span>
                        )}
                      </td>
                      <td className="border p-2 text-center">{match.monthName}</td>
                      <td className="border p-2 text-center font-bold">{match.pointsEarned}</td>
                      <td className="border p-2 text-center">{match.setsWon}</td>
                      <td className="border p-2 text-center">{match.gamesWon}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-gray-100 font-bold">
                    <td colSpan="7" className="border p-2 text-right">TOTALS:</td>
                    <td className="border p-2 text-center">{result.recalculated.matchWinPoints}</td>
                    <td className="border p-2 text-center">{result.recalculated.setsWon}</td>
                    <td className="border p-2 text-center">{result.recalculated.gamesWon}</td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Points Summary */}
            <div className="mt-6 bg-gray-50 rounded p-4">
              <h4 className="font-bold mb-3">Points Summary</h4>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="font-medium">Match Win Points:</span>
                  <span className="ml-2 font-bold">{result.recalculated.matchWinPoints}</span>
                </div>
                <div>
                  <span className="font-medium">Match Record:</span>
                  <span className="ml-2 font-bold">{result.recalculated.matchWins}-{result.recalculated.matchLosses}</span>
                </div>
                <div>
                  <span className="font-medium">Uncapped Bonus:</span>
                  <span className="ml-2 font-bold">{result.recalculated.bonusPoints.toFixed(1)}</span>
                </div>
                <div>
                  <span className="font-medium">25% Cap Limit:</span>
                  <span className="ml-2 font-bold">{(result.recalculated.matchWinPoints * 0.25).toFixed(1)}</span>
                </div>
                <div>
                  <span className="font-medium">Capped Bonus:</span>
                  <span className="ml-2 font-bold">{result.recalculated.cappedBonus.toFixed(1)}</span>
                </div>
                <div className="col-span-2 border-t pt-2">
                  <span className="font-medium text-lg">TOTAL POINTS:</span>
                  <span className="ml-2 font-bold text-lg text-blue-600">{result.recalculated.totalPoints.toFixed(1)}</span>
                </div>
              </div>
            </div>
          </div>
        )
      ))}

      <div className="mt-6 text-sm text-gray-600 bg-gray-50 p-4 rounded">
        <p className="font-semibold mb-2">How to use this audit:</p>
        <ul className="list-disc ml-6 space-y-1">
          <li>Red highlighted cells indicate discrepancies between calculated and displayed values</li>
          <li>Click on any team row to see their match-by-match breakdown</li>
          <li>Points are calculated as: 2 points for wins in Nov/Dec, 4 points for wins in January</li>
          <li>Only completed matches are counted (pending matches are excluded)</li>
          <li>Export to CSV to analyze discrepancies in a spreadsheet</li>
        </ul>
      </div>
    </div>
  );
};

export default PointsAudit;
