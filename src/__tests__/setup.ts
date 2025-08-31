/**
 * Test Setup Configuration
 * Global test environment setup and mocks
 */

import 'react-native-gesture-handler/jestSetup';

// Mock React Native modules
jest.mock('react-native-reanimated', () => {
  const Reanimated = require('react-native-reanimated/mock');
  Reanimated.default.call = () => {};
  return Reanimated;
});

// Mock React Native AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

// Mock Expo modules
jest.mock('expo-location', () => ({
  requestForegroundPermissionsAsync: jest.fn(() => 
    Promise.resolve({ status: 'granted' })
  ),
  getCurrentPositionAsync: jest.fn(() => 
    Promise.resolve({
      coords: {
        latitude: 37.5665,
        longitude: 126.9780,
        accuracy: 5,
      },
    })
  ),
  Accuracy: {
    Balanced: 3,
    High: 6,
    Low: 1,
  },
}));

jest.mock('expo-notifications', () => ({
  requestPermissionsAsync: jest.fn(() => 
    Promise.resolve({ status: 'granted' })
  ),
  scheduleNotificationAsync: jest.fn(),
  cancelNotificationAsync: jest.fn(),
  setNotificationHandler: jest.fn(),
}));

// Mock Firebase
jest.mock('firebase/firestore', () => ({
  getFirestore: jest.fn(),
  collection: jest.fn(),
  doc: jest.fn(),
  getDoc: jest.fn(),
  setDoc: jest.fn(),
  addDoc: jest.fn(),
  updateDoc: jest.fn(),
  deleteDoc: jest.fn(),
  onSnapshot: jest.fn(),
  query: jest.fn(),
  where: jest.fn(),
  orderBy: jest.fn(),
  limit: jest.fn(),
}));

jest.mock('firebase/auth', () => ({
  getAuth: jest.fn(),
  signInAnonymously: jest.fn(),
  signInWithEmailAndPassword: jest.fn(),
  createUserWithEmailAndPassword: jest.fn(),
  signOut: jest.fn(),
  onAuthStateChanged: jest.fn(),
}));

// Mock Seoul API
jest.mock('../services/api/seoulSubwayApi', () => ({
  seoulSubwayApi: {
    getRealtimeArrivals: jest.fn(() => 
      Promise.resolve([
        {
          stationName: '강남역',
          trainLineNm: '2호선',
          arvlMsg2: '2분 후 도착',
          arvlMsg3: '강남역 도착',
          btrainSttus: '일반',
        },
      ])
    ),
    getStationInfo: jest.fn(),
  },
}));

// Mock performance monitoring in tests
jest.mock('../utils/performanceUtils', () => ({
  performanceMonitor: {
    startMeasure: jest.fn(),
    endMeasure: jest.fn(),
    getMetrics: jest.fn(),
    clearMetrics: jest.fn(),
  },
  debounce: jest.fn((fn) => fn),
  throttle: jest.fn((fn) => fn),
  scheduleAfterInteractions: jest.fn((callback) => callback()),
}));

// Global test utilities
global.mockTrain = {
  id: 'test-train-1',
  stationId: 'test-station',
  direction: 'up',
  arrivalTime: new Date(),
  delayMinutes: 0,
  status: 'NORMAL',
  nextStationId: 'next-station',
};

global.mockStation = {
  id: 'test-station',
  name: '테스트역',
  nameEn: 'Test Station',
  lineId: '2',
  coordinates: {
    latitude: 37.5665,
    longitude: 126.9780,
  },
  transfers: ['1', '9'],
};

// Console suppression for tests
global.console = {
  ...console,
  // Suppress console.log in tests
  log: jest.fn(),
  // Keep error and warn for debugging
  error: console.error,
  warn: console.warn,
};

// Set test timeout
jest.setTimeout(10000);