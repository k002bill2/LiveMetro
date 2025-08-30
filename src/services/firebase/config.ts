/**
 * Firebase configuration and initialization
 * Handles Firebase Web SDK setup with environment variables
 */

import { initializeApp, FirebaseApp } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';
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

// Environment variables with fallbacks for development
const firebaseConfig: FirebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY || 'development-key',
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN || 'livemetro-dev.firebaseapp.com',
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID || 'livemetro-dev',
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET || 'livemetro-dev.appspot.com',
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || '123456789',
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID || 'development-app-id'
};

// Initialize Firebase
const app: FirebaseApp = initializeApp(firebaseConfig);

// Initialize Firebase services
export const auth: Auth = getAuth(app);
export const firestore: Firestore = getFirestore(app);
export const functions: Functions = getFunctions(app);

// Set region for Cloud Functions (Seoul region)
// connectFunctionsEmulator(functions, 'localhost', 5001); // Uncomment for local development

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