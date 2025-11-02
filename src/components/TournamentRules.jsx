import React from 'react';
import { Award } from 'lucide-react';

const TournamentRules = () => {
  return (
    <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
      <h3 className="font-semibold text-blue-900 mb-2 flex items-center gap-2">
        <Award className="w-5 h-5" />
        Tournament Rules
      </h3>
      <div className="text-sm text-blue-800 space-y-3">
        {/* Team Composition */}
        <div>
          <p className="font-semibold mb-1">Team Composition</p>
          <ul className="space-y-1">
            <li>• Team Roster: Maximum 9 players per team (any gender distribution allowed)</li>
            <li>• Dynamic rating takes priority over NTRP rating when available</li>
          </ul>
        </div>

        {/* Match Play */}
        <div>
          <p className="font-semibold mb-1">Match Play</p>
          <ul className="space-y-1">
            <li>• Matches are best 2 of 3 sets with 10-point tiebreaker option for third set</li>
            <li>• Singles matches are optional and may be played in addition to doubles matches</li>
            <li>• Nov/Dec Match Wins: 2 points each</li>
            <li>• January Match Wins: 4 points each</li>
          </ul>
        </div>

        {/* Bonus Points */}
        <div>
          <p className="font-semibold mb-1">Bonus Points</p>
          <ul className="space-y-1">
            <li>• Volume Bonuses (per month): 5+ matches (+1), 10+ (+2), 15+ (+3), 20+ (+4)</li>
            <li>• Full Roster Participation: +1 per month if all 9 team members play</li>
            <li>• Variety Bonus 1: +1 per month for playing 3+ different teams</li>
            <li>• Variety Bonus 2: +1 per month for playing at 3+ different NTRP levels</li>
            <li>• Mixed Doubles Bonus: +1 per month for at least 2 mixed doubles matches</li>
            <li>• Bonus Points Cap: Maximum 25% of match win points</li>
          </ul>
        </div>

        {/* Penalties */}
        <div>
          <p className="font-semibold mb-1">Penalties</p>
          <ul className="space-y-1">
            <li>• -4 points for months with fewer than 4 matches</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default TournamentRules;