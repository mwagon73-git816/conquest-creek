/**
 * Redirect Manager - Handles post-login redirects to preserve user context
 *
 * When a user attempts a protected action while not logged in, we save their
 * intended destination and context, then redirect them to login. After successful
 * login, we restore their session and return them to exactly where they were.
 */

const REDIRECT_KEY = 'conquest_post_login_redirect';
const REDIRECT_EXPIRY = 30 * 60 * 1000; // 30 minutes

/**
 * Save user's intended destination before redirecting to login
 * @param {string} path - The path to return to (e.g., '/challenges' or '/match-entry')
 * @param {object} context - Additional context about what the user was trying to do
 * @example
 * saveRedirectIntent('/challenges', {
 *   action: 'accept challenge',
 *   challengeId: 'CHALL-2025-001'
 * })
 */
export const saveRedirectIntent = (path, context = {}) => {
  const intent = {
    returnTo: path,
    context: context,
    savedAt: Date.now()
  };

  try {
    localStorage.setItem(REDIRECT_KEY, JSON.stringify(intent));
    console.log('🔄 Redirect intent saved:', intent);
  } catch (error) {
    console.error('Failed to save redirect intent:', error);
  }
};

/**
 * Retrieve saved redirect intent
 * @returns {object|null} The saved intent or null if none/expired
 */
export const getRedirectIntent = () => {
  try {
    const saved = localStorage.getItem(REDIRECT_KEY);
    if (!saved) return null;

    const intent = JSON.parse(saved);

    // Check if expired (30 minutes)
    if (Date.now() - intent.savedAt > REDIRECT_EXPIRY) {
      console.log('⏰ Redirect intent expired, clearing');
      clearRedirectIntent();
      return null;
    }

    console.log('🔄 Retrieved redirect intent:', intent);
    return intent;
  } catch (error) {
    console.error('Failed to retrieve redirect intent:', error);
    clearRedirectIntent();
    return null;
  }
};

/**
 * Clear saved redirect intent
 */
export const clearRedirectIntent = () => {
  try {
    localStorage.removeItem(REDIRECT_KEY);
    console.log('🧹 Redirect intent cleared');
  } catch (error) {
    console.error('Failed to clear redirect intent:', error);
  }
};

/**
 * Check if current page/action requires authentication
 * @param {boolean} isAuthenticated - Whether the user is authenticated
 * @param {string} action - Description of what user is trying to do
 * @param {object} context - Additional context about the action
 * @returns {boolean} True if user is authenticated, false if redirect needed
 * @example
 * if (!requireAuth(isAuthenticated, 'accept challenge', { challengeId })) {
 *   return; // Will show login prompt
 * }
 * // Continue with the action
 */
export const requireAuth = (isAuthenticated, action = 'access this page', context = {}) => {
  if (!isAuthenticated) {
    console.log(`🔒 Authentication required for: ${action}`);
    saveRedirectIntent(window.location.pathname + window.location.search, {
      action: action,
      ...context
    });
    return false;
  }
  return true;
};

/**
 * Check if there's a pending redirect and return the intent
 * Used after successful login to determine where to send the user
 * @returns {object|null} The redirect intent or null
 */
export const getPendingRedirect = () => {
  const intent = getRedirectIntent();
  if (intent) {
    clearRedirectIntent(); // Clear it so it's not reused
    return intent;
  }
  return null;
};

/**
 * Check if the redirect intent is still valid (not expired)
 * @returns {boolean} True if valid, false if expired or doesn't exist
 */
export const hasValidRedirectIntent = () => {
  try {
    const saved = localStorage.getItem(REDIRECT_KEY);
    if (!saved) return false;

    const intent = JSON.parse(saved);
    return (Date.now() - intent.savedAt) <= REDIRECT_EXPIRY;
  } catch (error) {
    return false;
  }
};
