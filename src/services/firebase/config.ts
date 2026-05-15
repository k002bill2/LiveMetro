/**
 * Firebase configuration and initialization
 * Handles Firebase Web SDK setup with environment variables
 */

import { Platform } from 'react-native';
import { initializeApp, FirebaseApp } from 'firebase/app';
import {
  initializeAuth,
  getAuth,
  getReactNativePersistence,
  browserLocalPersistence,
  Auth,
} from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getFirestore, Firestore } from 'firebase/firestore';
import { getFunctions, Functions } from 'firebase/functions';

// Firebase configuration interface
interface FirebaseConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
}

// Environment variables with fallbacks for development.
// Exported so that components needing the raw config (e.g. the
// FirebaseRecaptchaVerifierModal in expo-firebase-recaptcha) can pass it
// in directly. Do not mutate.
export const firebaseConfig: FirebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY || 'development-key',
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN || 'livemetro-dev.firebaseapp.com',
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID || 'livemetro-dev',
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET || 'livemetro-dev.appspot.com',
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || '123456789',
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID || 'development-app-id'
};

// Initialize Firebase
const app: FirebaseApp = initializeApp(firebaseConfig);

/**
 * Initialize Auth with platform-appropriate persistence so the session
 * survives app restarts.
 *
 * Without explicit persistence the user is silently dropped on every
 * relaunch and a fresh anonymous UID is created, orphaning all per-uid
 * Firestore data (commute settings, favorites, ML history, profile).
 *
 * Persistence differs by platform:
 *   - native: `getReactNativePersistence(AsyncStorage)` — this function
 *     exists only in firebase's native bundle.
 *   - web (Expo web): `firebase/auth` resolves to the browser bundle
 *     where `getReactNativePersistence` is undefined, so calling it
 *     throws. Use Firebase's own `browserLocalPersistence` (localStorage).
 * The ternary short-circuits, so the native-only function is never
 * evaluated on web.
 *
 * `initializeAuth` may only run once per app; it throws if Auth was
 * already initialized (Fast Refresh / test module re-evaluation). In
 * that case `getAuth` returns the existing instance — already wired
 * with persistence — so the fallback is equivalent, not degraded.
 */
let authInstance: Auth;
try {
  authInstance = initializeAuth(app, {
    persistence:
      Platform.OS === 'web'
        ? browserLocalPersistence
        : getReactNativePersistence(AsyncStorage),
  });
} catch (e) {
  // Auth was already initialized for this app (Fast Refresh / test module
  // re-evaluation) — reuse the existing instance, which keeps its
  // persistence. Any other failure also degrades to a working (if
  // in-memory) auth rather than crashing app startup.
  console.warn('[firebase] initializeAuth failed, falling back to getAuth:', e);
  authInstance = getAuth(app);
}

// Initialize Firebase services
export const auth: Auth = authInstance;
export const firestore: Firestore = getFirestore(app);
export const functions: Functions = getFunctions(app, 'asia-northeast3'); // Seoul region

// Uncomment for local development with emulator
// import { connectFunctionsEmulator } from 'firebase/functions';
// connectFunctionsEmulator(functions, 'localhost', 5001);

export default app;

// Firebase configuration validation
export const validateFirebaseConfig = (): boolean => {
  const requiredKeys: (keyof FirebaseConfig)[] = [
    'apiKey',
    'authDomain', 
    'projectId',
    'storageBucket',
    'messagingSenderId',
    'appId'
  ];

  const missingKeys = requiredKeys.filter(key => 
    !firebaseConfig[key] || firebaseConfig[key] === `development-${key.toLowerCase().replace(/([A-Z])/g, '-$1')}`
  );

  if (missingKeys.length > 0) {
    console.warn('Firebase configuration missing keys:', missingKeys);
    return false;
  }

  return true;
};

// Development helper
if (__DEV__) {
  console.log('Firebase initialized with project:', firebaseConfig.projectId);
  validateFirebaseConfig();
}
