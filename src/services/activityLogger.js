// Activity logging utility for tracking all data changes

// Action types for logging
export const ACTION_TYPES = {
  // Player actions
  PLAYER_ADDED: 'player_added',
  PLAYER_EDITED: 'player_edited',
  PLAYER_DELETED: 'player_deleted',
  PLAYER_REASSIGNED: 'player_reassigned',
  PLAYER_NTRP_UPDATED: 'player_ntrp_updated',
  PLAYERS_BULK_DELETE: 'players_bulk_delete',
  PLAYERS_IMPORTED: 'players_imported',

  // Team actions
  TEAM_ADDED: 'team_added',
  TEAM_EDITED: 'team_edited',
  TEAM_UPDATED: 'team_updated',
  TEAM_DELETED: 'team_deleted',
  TEAM_PLAYER_ADDED: 'team_player_added',
  TEAM_PLAYER_REMOVED: 'team_player_removed',
  TEAM_CAPTAIN_CHANGED: 'team_captain_changed',
  TEAM_ROSTER_UPDATED: 'team_roster_updated',

  // Match actions
  MATCH_CREATED: 'match_created',
  MATCH_EDITED: 'match_edited',
  MATCH_DELETED: 'match_deleted',
  MATCH_COMPLETED: 'match_completed',
  MATCH_RESULTS_ENTERED: 'match_results_entered',
  MATCH_SCHEDULED: 'match_scheduled',

  // Challenge actions
  CHALLENGE_CREATED: 'challenge_created',
  CHALLENGE_EDITED: 'challenge_edited',
  CHALLENGE_ACCEPTED: 'challenge_accepted',
  CHALLENGE_REJECTED: 'challenge_rejected',
  CHALLENGE_DELETED: 'challenge_deleted',
  PENDING_MATCH_CREATED: 'pending_match_created',
  PENDING_MATCH_EDITED: 'pending_match_edited',
  PENDING_MATCH_DELETED: 'pending_match_deleted',

  // Captain actions
  CAPTAIN_CREATED: 'captain_created',
  CAPTAIN_EDITED: 'captain_edited',
  CAPTAIN_DELETED: 'captain_deleted',
  CAPTAIN_PROMOTED: 'captain_promoted',
  CAPTAIN_DEMOTED: 'captain_demoted',

  // Bonus actions
  BONUS_ADDED: 'bonus_added',
  BONUS_EDITED: 'bonus_edited',
  BONUS_DELETED: 'bonus_deleted',

  // Photo actions
  PHOTO_UPLOADED: 'photo_uploaded',
  PHOTO_DELETED: 'photo_deleted',
  PHOTO_UPDATED: 'photo_updated',

  // Auth actions
  USER_LOGIN: 'user_login',
  USER_LOGOUT: 'user_logout',

  // Error/Conflict actions
  CONFLICT_DETECTED: 'conflict_detected',
  CONFLICT_RESOLVED: 'conflict_resolved',
  ERROR_OCCURRED: 'error_occurred',
  SAVE_FAILED: 'save_failed',

  // System actions
  DATA_RESET: 'data_reset',
  DATA_IMPORTED: 'data_imported',
  DATA_EXPORTED: 'data_exported',
  TEAMS_UPDATED: 'teams_updated',
  MATCHES_UPDATED: 'matches_updated',
  BONUSES_UPDATED: 'bonuses_updated',
  CAPTAINS_UPDATED: 'captains_updated',
  PHOTOS_UPDATED: 'photos_updated'
};

/**
 * Get browser information from user agent
 * @returns {string} Browser name
 */
const getBrowser = () => {
  if (typeof navigator === 'undefined') return 'Unknown';
  const ua = navigator.userAgent;
  if (ua.includes('Edg')) return 'Edge';
  if (ua.includes('Chrome')) return 'Chrome';
  if (ua.includes('Safari') && !ua.includes('Chrome')) return 'Safari';
  if (ua.includes('Firefox')) return 'Firefox';
  return 'Other';
};

/**
 * Get device type from user agent
 * @returns {string} Device type
 */
const getDevice = () => {
  if (typeof navigator === 'undefined') return 'Unknown';
  const ua = navigator.userAgent;
  if (/(tablet|ipad)/i.test(ua)) return 'Tablet';
  if (/Mobile|Android|iPhone/i.test(ua)) return 'Mobile';
  return 'Desktop';
};

/**
 * Get current page path
 * @returns {string} Current page path
 */
const getPage = () => {
  if (typeof window === 'undefined') return 'Unknown';
  return window.location.pathname;
};

/**
 * Determine entity type from action
 * @param {string} action - The action type
 * @returns {string} Entity type
 */
const getEntityType = (action) => {
  if (action.includes('player')) return 'player';
  if (action.includes('team')) return 'team';
  if (action.includes('match')) return 'match';
  if (action.includes('challenge') || action.includes('pending')) return 'challenge';
  if (action.includes('captain')) return 'captain';
  if (action.includes('bonus')) return 'bonus';
  if (action.includes('photo')) return 'photo';
  if (action.includes('conflict')) return 'conflict';
  if (action.includes('error')) return 'error';
  return 'system';
};

/**
 * Determine action category
 * @param {string} action - The action type
 * @returns {string} Action category
 */
const getActionCategory = (action) => {
  if (action.includes('add') || action.includes('create') || action.includes('upload')) return 'create';
  if (action.includes('edit') || action.includes('update') || action.includes('change')) return 'update';
  if (action.includes('delete') || action.includes('reset')) return 'delete';
  if (action.includes('accept')) return 'accept';
  if (action.includes('reject')) return 'reject';
  if (action.includes('complete') || action.includes('enter')) return 'complete';
  if (action.includes('login')) return 'login';
  if (action.includes('logout')) return 'logout';
  if (action.includes('conflict')) return 'conflict';
  if (action.includes('error') || action.includes('fail')) return 'error';
  return 'other';
};

/**
 * Creates an activity log entry with comprehensive metadata
 * @param {string} action - The action type (from ACTION_TYPES)
 * @param {string} user - Username of who made the change
 * @param {object} details - Details about what changed
 * @param {string} entityId - ID of the entity changed (optional)
 * @param {object} before - Before snapshot (optional)
 * @param {object} after - After snapshot (optional)
 * @param {string} userRole - User role (director, captain, etc.) (optional)
 * @returns {object} Log entry object
 */
export const createLogEntry = (action, user, details, entityId = null, before = null, after = null, userRole = null) => {
  const logEntry = {
    timestamp: new Date().toISOString(),
    action,
    actionCategory: getActionCategory(action),
    entityType: getEntityType(action),
    user,
    userRole: userRole || 'unknown',
    details,
    entityId,
    before,
    after,
    metadata: {
      browser: getBrowser(),
      device: getDevice(),
      page: getPage(),
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'Unknown'
    }
  };

  // Also log to console for debugging
  const entityInfo = entityId ? ` (ID: ${entityId})` : '';
  console.log(`[Activity] ${user} (${userRole || 'unknown'}) performed ${action}${entityInfo}`, details);

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
    case ACTION_TYPES.PLAYER_NTRP_UPDATED:
      return `Updated NTRP for ${details.playerName}: ${details.oldNTRP} → ${details.newNTRP}`;
    case ACTION_TYPES.PLAYERS_IMPORTED:
      return `Imported ${details.count || 0} players from CSV`;

    case ACTION_TYPES.TEAM_ADDED:
      return `Added team: ${details.teamName || 'Unknown'}`;
    case ACTION_TYPES.TEAM_EDITED:
      return `Edited team: ${details.teamName || 'Unknown'}`;
    case ACTION_TYPES.TEAM_UPDATED:
      if (details.oldName && details.newName && details.oldName !== details.newName) {
        return `Renamed team: "${details.oldName}" → "${details.newName}"`;
      }
      return `Updated team: ${details.newName || details.oldName || 'Unknown'}`;
    case ACTION_TYPES.TEAM_DELETED:
      return `Deleted team: ${details.teamName || 'Unknown'}`;
    case ACTION_TYPES.TEAM_PLAYER_ADDED:
      return `Added ${details.playerName} to ${details.teamName}`;
    case ACTION_TYPES.TEAM_PLAYER_REMOVED:
      return `Removed ${details.playerName} from ${details.teamName}`;
    case ACTION_TYPES.TEAM_CAPTAIN_CHANGED:
      return `Changed captain for ${details.teamName}: ${details.oldCaptainName} → ${details.newCaptainName}`;
    case ACTION_TYPES.TEAM_ROSTER_UPDATED:
      return `Updated roster for ${details.teamName} (${details.changeType})`;

    case ACTION_TYPES.MATCH_CREATED:
      return `Created match: ${details.team1Name} vs ${details.team2Name}`;
    case ACTION_TYPES.MATCH_EDITED:
      return `Edited match: ${details.team1Name} vs ${details.team2Name}`;
    case ACTION_TYPES.MATCH_DELETED:
      return `Deleted match: ${details.team1Name} vs ${details.team2Name}`;
    case ACTION_TYPES.MATCH_COMPLETED:
      return `Match completed: ${details.winnerTeamName || details.team1Name} defeated ${details.team2Name || 'opponent'}`;
    case ACTION_TYPES.MATCH_RESULTS_ENTERED:
      return `Entered results for ${details.team1Name} vs ${details.team2Name}: ${details.scores || 'Scores entered'}`;
    case ACTION_TYPES.MATCH_SCHEDULED:
      return `Scheduled match: ${details.team1Name} vs ${details.team2Name} (Level ${details.level})`;

    case ACTION_TYPES.CHALLENGE_CREATED:
      return `Created challenge: ${details.challengerTeam} (Level ${details.level})`;
    case ACTION_TYPES.CHALLENGE_EDITED:
      return `Edited challenge: ${details.challengerTeam} (${details.changesSummary || 'Updated'})`;
    case ACTION_TYPES.CHALLENGE_ACCEPTED:
      return `Accepted challenge: ${details.challengerTeam} vs ${details.challengedTeam}`;
    case ACTION_TYPES.CHALLENGE_REJECTED:
      return `Rejected challenge from ${details.challengerTeam}: ${details.reason || 'No reason provided'}`;
    case ACTION_TYPES.CHALLENGE_DELETED:
      return `Deleted challenge: ${details.challengerTeam}`;
    case ACTION_TYPES.PENDING_MATCH_CREATED:
      return `Created pending match: ${details.team1Name} vs ${details.team2Name} (Level ${details.level})`;
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
    case ACTION_TYPES.CAPTAIN_PROMOTED:
      return `Promoted ${details.playerName} to captain`;
    case ACTION_TYPES.CAPTAIN_DEMOTED:
      return `Demoted ${details.captainName} from captain`;

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
    case ACTION_TYPES.PHOTO_UPDATED:
      return `Updated photo: ${details.photoInfo || 'Match photo'}`;

    case ACTION_TYPES.CONFLICT_DETECTED:
      return `Conflict detected when saving ${details.entityType}: ${details.conflictType || 'Data modified by another user'}`;
    case ACTION_TYPES.CONFLICT_RESOLVED:
      return `Resolved conflict for ${details.entityType}: ${details.resolution || 'User action taken'}`;
    case ACTION_TYPES.ERROR_OCCURRED:
      return `Error during ${details.operation}: ${details.errorMessage || 'Unknown error'}`;
    case ACTION_TYPES.SAVE_FAILED:
      return `Failed to save ${details.entityType}: ${details.reason || 'Unknown reason'}`;

    case ACTION_TYPES.USER_LOGIN:
      return `${details.role || 'User'} logged in`;
    case ACTION_TYPES.USER_LOGOUT:
      return `${details.role || 'User'} logged out`;

    case ACTION_TYPES.DATA_RESET:
      return `Reset all tournament data`;
    case ACTION_TYPES.DATA_IMPORTED:
      return `Imported tournament data: ${details.dataType || 'Unknown'}`;
    case ACTION_TYPES.DATA_EXPORTED:
      return `Exported tournament data: ${details.dataType || 'Unknown'}`;
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
    ACTION_TYPES.PLAYER_NTRP_UPDATED,
    ACTION_TYPES.PLAYERS_BULK_DELETE,
    ACTION_TYPES.PLAYERS_IMPORTED
  ];

  const teamActions = [
    ACTION_TYPES.TEAM_ADDED,
    ACTION_TYPES.TEAM_EDITED,
    ACTION_TYPES.TEAM_UPDATED,
    ACTION_TYPES.TEAM_DELETED,
    ACTION_TYPES.TEAM_PLAYER_ADDED,
    ACTION_TYPES.TEAM_PLAYER_REMOVED,
    ACTION_TYPES.TEAM_CAPTAIN_CHANGED,
    ACTION_TYPES.TEAM_ROSTER_UPDATED
  ];

  const matchActions = [
    ACTION_TYPES.MATCH_CREATED,
    ACTION_TYPES.MATCH_EDITED,
    ACTION_TYPES.MATCH_DELETED,
    ACTION_TYPES.MATCH_COMPLETED,
    ACTION_TYPES.MATCH_RESULTS_ENTERED,
    ACTION_TYPES.MATCH_SCHEDULED,
    ACTION_TYPES.CHALLENGE_CREATED,
    ACTION_TYPES.CHALLENGE_EDITED,
    ACTION_TYPES.CHALLENGE_ACCEPTED,
    ACTION_TYPES.CHALLENGE_REJECTED,
    ACTION_TYPES.CHALLENGE_DELETED,
    ACTION_TYPES.PENDING_MATCH_CREATED,
    ACTION_TYPES.PENDING_MATCH_EDITED,
    ACTION_TYPES.PENDING_MATCH_DELETED
  ];

  const captainActions = [
    ACTION_TYPES.CAPTAIN_CREATED,
    ACTION_TYPES.CAPTAIN_EDITED,
    ACTION_TYPES.CAPTAIN_DELETED,
    ACTION_TYPES.CAPTAIN_PROMOTED,
    ACTION_TYPES.CAPTAIN_DEMOTED
  ];

  const deletionActions = [
    ACTION_TYPES.PLAYER_DELETED,
    ACTION_TYPES.PLAYERS_BULK_DELETE,
    ACTION_TYPES.TEAM_DELETED,
    ACTION_TYPES.MATCH_DELETED,
    ACTION_TYPES.CHALLENGE_DELETED,
    ACTION_TYPES.PENDING_MATCH_DELETED,
    ACTION_TYPES.CAPTAIN_DELETED,
    ACTION_TYPES.CAPTAIN_DEMOTED,
    ACTION_TYPES.BONUS_DELETED,
    ACTION_TYPES.PHOTO_DELETED,
    ACTION_TYPES.DATA_RESET
  ];

  const errorActions = [
    ACTION_TYPES.CONFLICT_DETECTED,
    ACTION_TYPES.CONFLICT_RESOLVED,
    ACTION_TYPES.ERROR_OCCURRED,
    ACTION_TYPES.SAVE_FAILED
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
    case 'errors':
      return logs.filter(log => errorActions.includes(log.action));
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
