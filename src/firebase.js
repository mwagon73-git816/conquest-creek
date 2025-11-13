import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

if (!firebaseConfig.apiKey || !firebaseConfig.projectId) {
  console.error('Firebase configuration is missing. Please check your .env.local file.');
}

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const storage = getStorage(app);

export const COLLECTIONS = {
  TEAMS: 'teams',
  MATCHES: 'matches',
  BONUSES: 'bonuses',
  AUTH: 'auth',
  PHOTOS: 'photos',
  CAPTAINS: 'captains',
  ACTIVITY_LOGS: 'activity_logs',
  CHALLENGES: 'challenges'
};

/**
 * SMS Feature Flag
 *
 * SMS feature implemented but disabled pending regulatory approval.
 * Set VITE_SMS_ENABLED=true in environment variables to activate when approved.
 *
 * When enabled:
 * - SMS notifications will be sent via Twilio for matches and challenges
 * - Phone number fields will appear in captain settings
 * - SMS preference toggles will be visible in the UI
 *
 * @returns {boolean} True if SMS features should be enabled
 */
export const isSmsEnabled = () => {
  const enabled = import.meta.env.VITE_SMS_ENABLED === 'true';
  return enabled;
};

console.log(`🔥 Firebase: ${import.meta.env.MODE} mode`);
console.log(`📊 Project: ${firebaseConfig.projectId}`);
console.log(`📱 SMS Features: ${isSmsEnabled() ? 'ENABLED' : 'DISABLED'}`);
