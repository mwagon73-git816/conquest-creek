import React from 'react';
import { Award } from 'lucide-react';

const TournamentRules = () => {
  return (
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
  );
};

export default TournamentRules;