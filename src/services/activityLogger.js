// Activity logging utility for tracking all data changes

// Action types for logging
export const ACTION_TYPES = {
  // Player actions
  PLAYER_ADDED: 'player_added',
  PLAYER_EDITED: 'player_edited',
  PLAYER_DELETED: 'player_deleted',
  PLAYER_REASSIGNED: 'player_reassigned',
  PLAYERS_BULK_DELETE: 'players_bulk_delete',

  // Team actions
  TEAM_ADDED: 'team_added',
  TEAM_EDITED: 'team_edited',
  TEAM_DELETED: 'team_deleted',
  TEAM_PLAYER_ADDED: 'team_player_added',
  TEAM_PLAYER_REMOVED: 'team_player_removed',

  // Match actions
  MATCH_CREATED: 'match_created',
  MATCH_EDITED: 'match_edited',
  MATCH_DELETED: 'match_deleted',

  // Challenge actions
  CHALLENGE_CREATED: 'challenge_created',
  CHALLENGE_EDITED: 'challenge_edited',
  CHALLENGE_ACCEPTED: 'challenge_accepted',
  CHALLENGE_DELETED: 'challenge_deleted',
  PENDING_MATCH_EDITED: 'pending_match_edited',
  PENDING_MATCH_DELETED: 'pending_match_deleted',

  // Captain actions
  CAPTAIN_CREATED: 'captain_created',
  CAPTAIN_EDITED: 'captain_edited',
  CAPTAIN_DELETED: 'captain_deleted',

  // Bonus actions
  BONUS_ADDED: 'bonus_added',
  BONUS_EDITED: 'bonus_edited',
  BONUS_DELETED: 'bonus_deleted',

  // Photo actions
  PHOTO_UPLOADED: 'photo_uploaded',
  PHOTO_DELETED: 'photo_deleted',

  // Auth actions
  USER_LOGIN: 'user_login',
  USER_LOGOUT: 'user_logout',

  // System actions
  DATA_RESET: 'data_reset',
  TEAMS_UPDATED: 'teams_updated',
  MATCHES_UPDATED: 'matches_updated',
  BONUSES_UPDATED: 'bonuses_updated',
  CAPTAINS_UPDATED: 'captains_updated',
  PHOTOS_UPDATED: 'photos_updated'
};

/**
 * Creates an activity log entry
 * @param {string} action - The action type (from ACTION_TYPES)
 * @param {string} user - Username of who made the change
 * @param {object} details - Details about what changed
 * @param {string} entityId - ID of the entity changed (optional)
 * @param {object} before - Before snapshot (optional)
 * @param {object} after - After snapshot (optional)
 * @returns {object} Log entry object
 */
export const createLogEntry = (action, user, details, entityId = null, before = null, after = null) => {
  const logEntry = {
    timestamp: new Date().toISOString(),
    action,
    user,
    details,
    entityId,
    before,
    after
  };

  // Also log to console for debugging
  const entityInfo = entityId ? ` (ID: ${entityId})` : '';
  console.log(`[Activity] ${user} performed ${action}${entityInfo}`, details);

  return logEntry;
};

/**
 * Formats a log entry for display
 * @param {object} logEntry - The log entry to format
 * @returns {object} Formatted entry with readable timestamp and description
 */
export const formatLogEntry = (logEntry) => {
  const date = new Date(logEntry.timestamp);
  const formattedDate = date.toLocaleString('en-US', {
    month: '2-digit',
    day: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });

  return {
    ...logEntry,
    formattedTimestamp: formattedDate,
    description: generateDescription(logEntry)
  };
};

/**
 * Generates a human-readable description of the action
 * @param {object} logEntry - The log entry
 * @returns {string} Human-readable description
 */
const generateDescription = (logEntry) => {
  const { action, details } = logEntry;

  switch (action) {
    case ACTION_TYPES.PLAYER_ADDED:
      return `Added player: ${details.playerName || 'Unknown'}`;
    case ACTION_TYPES.PLAYER_EDITED:
      return `Edited player: ${details.playerName || 'Unknown'}`;
    case ACTION_TYPES.PLAYER_DELETED:
      return `Deleted player: ${details.playerName || 'Unknown'}`;
    case ACTION_TYPES.PLAYER_REASSIGNED:
      return `Reassigned ${details.playerName} from ${details.fromTeam} to ${details.toTeam}`;
    case ACTION_TYPES.PLAYERS_BULK_DELETE:
      return `Deleted all players (${details.count || 0} players)`;

    case ACTION_TYPES.TEAM_ADDED:
      return `Added team: ${details.teamName || 'Unknown'}`;
    case ACTION_TYPES.TEAM_EDITED:
      return `Edited team: ${details.teamName || 'Unknown'}`;
    case ACTION_TYPES.TEAM_DELETED:
      return `Deleted team: ${details.teamName || 'Unknown'}`;
    case ACTION_TYPES.TEAM_PLAYER_ADDED:
      return `Added ${details.playerName} to ${details.teamName}`;
    case ACTION_TYPES.TEAM_PLAYER_REMOVED:
      return `Removed ${details.playerName} from ${details.teamName}`;

    case ACTION_TYPES.MATCH_CREATED:
      return `Created match: ${details.team1Name} vs ${details.team2Name}`;
    case ACTION_TYPES.MATCH_EDITED:
      return `Edited match: ${details.team1Name} vs ${details.team2Name}`;
    case ACTION_TYPES.MATCH_DELETED:
      return `Deleted match: ${details.team1Name} vs ${details.team2Name}`;

    case ACTION_TYPES.CHALLENGE_CREATED:
      return `Created challenge: ${details.challengerTeam} (Level ${details.level})`;
    case ACTION_TYPES.CHALLENGE_EDITED:
      return `Edited challenge: ${details.challengerTeam} (${details.changesSummary || 'Updated'})`;
    case ACTION_TYPES.CHALLENGE_ACCEPTED:
      return `Accepted challenge: ${details.challengerTeam} vs ${details.challengedTeam}`;
    case ACTION_TYPES.CHALLENGE_DELETED:
      return `Deleted challenge: ${details.challengerTeam}`;
    case ACTION_TYPES.PENDING_MATCH_EDITED:
      return `Edited pending match: ${details.team1Name} vs ${details.team2Name} (${details.changesSummary || 'Updated'})`;
    case ACTION_TYPES.PENDING_MATCH_DELETED:
      return `Deleted pending match: ${details.matchDescription || `${details.team1Name} vs ${details.team2Name}`}`;

    case ACTION_TYPES.CAPTAIN_CREATED:
      return `Created captain: ${details.captainName || 'Unknown'}`;
    case ACTION_TYPES.CAPTAIN_EDITED:
      return `Edited captain: ${details.captainName || 'Unknown'}`;
    case ACTION_TYPES.CAPTAIN_DELETED:
      return `Deleted captain: ${details.captainName || 'Unknown'}`;

    case ACTION_TYPES.BONUS_ADDED:
      return `Added bonus for ${details.teamName}: ${details.bonusType}`;
    case ACTION_TYPES.BONUS_EDITED:
      return `Edited bonus for ${details.teamName}`;
    case ACTION_TYPES.BONUS_DELETED:
      return `Deleted bonus for ${details.teamName}`;

    case ACTION_TYPES.PHOTO_UPLOADED:
      return `Uploaded photo for match: ${details.matchInfo || 'Unknown'}`;
    case ACTION_TYPES.PHOTO_DELETED:
      return `Deleted photo: ${details.photoInfo || 'Match photo'}`;

    case ACTION_TYPES.USER_LOGIN:
      return `${details.role || 'User'} logged in`;
    case ACTION_TYPES.USER_LOGOUT:
      return `${details.role || 'User'} logged out`;

    case ACTION_TYPES.DATA_RESET:
      return `Reset all tournament data`;
    case ACTION_TYPES.TEAMS_UPDATED:
      return `Updated teams data`;
    case ACTION_TYPES.MATCHES_UPDATED:
      return `Updated matches data`;
    case ACTION_TYPES.BONUSES_UPDATED:
      return `Updated bonuses data`;
    case ACTION_TYPES.CAPTAINS_UPDATED:
      return `Updated captains data`;
    case ACTION_TYPES.PHOTOS_UPDATED:
      return `Updated photos data`;

    default:
      return `Performed action: ${action}`;
  }
};

/**
 * Filters log entries by action category
 * @param {array} logs - Array of log entries
 * @param {string} filter - Filter type ('all', 'players', 'teams', 'matches', 'captains', 'deletions')
 * @returns {array} Filtered log entries
 */
export const filterLogs = (logs, filter) => {
  if (filter === 'all') return logs;

  const playerActions = [
    ACTION_TYPES.PLAYER_ADDED,
    ACTION_TYPES.PLAYER_EDITED,
    ACTION_TYPES.PLAYER_DELETED,
    ACTION_TYPES.PLAYER_REASSIGNED,
    ACTION_TYPES.PLAYERS_BULK_DELETE
  ];

  const teamActions = [
    ACTION_TYPES.TEAM_ADDED,
    ACTION_TYPES.TEAM_EDITED,
    ACTION_TYPES.TEAM_DELETED,
    ACTION_TYPES.TEAM_PLAYER_ADDED,
    ACTION_TYPES.TEAM_PLAYER_REMOVED
  ];

  const matchActions = [
    ACTION_TYPES.MATCH_CREATED,
    ACTION_TYPES.MATCH_EDITED,
    ACTION_TYPES.MATCH_DELETED,
    ACTION_TYPES.CHALLENGE_CREATED,
    ACTION_TYPES.CHALLENGE_EDITED,
    ACTION_TYPES.CHALLENGE_ACCEPTED,
    ACTION_TYPES.CHALLENGE_DELETED,
    ACTION_TYPES.PENDING_MATCH_EDITED,
    ACTION_TYPES.PENDING_MATCH_DELETED
  ];

  const captainActions = [
    ACTION_TYPES.CAPTAIN_CREATED,
    ACTION_TYPES.CAPTAIN_EDITED,
    ACTION_TYPES.CAPTAIN_DELETED
  ];

  const deletionActions = [
    ACTION_TYPES.PLAYER_DELETED,
    ACTION_TYPES.PLAYERS_BULK_DELETE,
    ACTION_TYPES.TEAM_DELETED,
    ACTION_TYPES.MATCH_DELETED,
    ACTION_TYPES.CHALLENGE_DELETED,
    ACTION_TYPES.PENDING_MATCH_DELETED,
    ACTION_TYPES.CAPTAIN_DELETED,
    ACTION_TYPES.BONUS_DELETED,
    ACTION_TYPES.PHOTO_DELETED,
    ACTION_TYPES.DATA_RESET
  ];

  switch (filter) {
    case 'players':
      return logs.filter(log => playerActions.includes(log.action));
    case 'teams':
      return logs.filter(log => teamActions.includes(log.action));
    case 'matches':
      return logs.filter(log => matchActions.includes(log.action));
    case 'captains':
      return logs.filter(log => captainActions.includes(log.action));
    case 'deletions':
      return logs.filter(log => deletionActions.includes(log.action));
    default:
      return logs;
  }
};

/**
 * Cleans up old log entries (older than specified days)
 * @param {array} logs - Array of log entries
 * @param {number} daysToKeep - Number of days to keep (default 90)
 * @returns {array} Filtered log entries
 */
export const cleanupOldLogs = (logs, daysToKeep = 90) => {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

  return logs.filter(log => {
    const logDate = new Date(log.timestamp);
    return logDate >= cutoffDate;
  });
};
