import React from 'react';
import { Trophy, Users, Calendar, TrendingUp, UserPlus, Shield, Activity, Image, Swords } from 'lucide-react';

const TabNavigation = ({ activeTab, setActiveTab, userRole, isAuthenticated }) => {
  const allTabs = [
    { id: 'leaderboard', icon: Trophy, label: 'Leaderboard', roles: ['director', 'captain', ''] },
    { id: 'teams', icon: Users, label: 'Teams', roles: ['director', 'captain', ''] },
    { id: 'players', icon: UserPlus, label: 'Players', roles: ['director', ''] },
    { id: 'captains', icon: Shield, label: 'Captains', roles: ['director'] },
    { id: 'challenges', icon: Swords, label: 'Challenges', roles: ['director', 'captain', ''] },
    { id: 'entry', icon: Calendar, label: 'Match Entry', roles: ['director', 'captain', ''] },
    { id: 'matches', icon: TrendingUp, label: 'Matches', roles: ['director', 'captain', ''] },
    { id: 'media', icon: Image, label: 'Media', roles: ['director', 'captain', ''] },
    { id: 'activity', icon: Activity, label: 'Activity Log', roles: ['director'] }
  ];

  // Filter tabs based on user role
  const tabs = allTabs.filter(tab => {
    const currentRole = isAuthenticated ? userRole : '';
    return tab.roles.includes(currentRole);
  });

  return (
    <div className="bg-white rounded-lg shadow-md mb-6 overflow-x-auto">
      <div className="flex border-b min-w-max">
        {tabs.map(tab => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 min-w-[120px] px-4 py-3 font-semibold transition flex items-center justify-center gap-2 ${
                activeTab === tab.id 
                  ? 'bg-blue-50 text-blue-600 border-b-2 border-blue-600' 
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span className="text-sm">{tab.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default TabNavigation;