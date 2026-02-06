/**
 * Firebase Debug Utilities Tests
 */

import {
  checkFirebaseEnvVars,
  analyzeAuthError,
  printFirebaseDebugInfo,
  testFirebaseConnection,
} from '../firebaseDebug';

jest.mock('../../services/firebase/config', () => ({
  validateFirebaseConfig: jest.fn().mockReturnValue(true),
}));

describe('firebaseDebug', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe('checkFirebaseEnvVars', () => {
    it('should detect missing env vars', () => {
      // Clear env vars
      delete process.env.EXPO_PUBLIC_FIREBASE_API_KEY;
      delete process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN;
      delete process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID;

      const result = checkFirebaseEnvVars();
      expect(result).toBeDefined();
      expect(typeof result.valid).toBe('boolean');
      expect(Array.isArray(result.missing)).toBe(true);
    });

    it('should return valid when all vars are set', () => {
      process.env.EXPO_PUBLIC_FIREBASE_API_KEY = 'test-key';
      process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN = 'test.firebaseapp.com';
      process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID = 'test-project';
      process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET = 'test.appspot.com';
      process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID = '123456';
      process.env.EXPO_PUBLIC_FIREBASE_APP_ID = '1:123:web:abc';

      const result = checkFirebaseEnvVars();
      expect(result.valid).toBe(true);
      expect(result.missing).toHaveLength(0);
    });

    it('should reject placeholder values', () => {
      process.env.EXPO_PUBLIC_FIREBASE_API_KEY = 'your_api_key';

      const result = checkFirebaseEnvVars();
      expect(result.missing).toContain('EXPO_PUBLIC_FIREBASE_API_KEY');
    });
  });

  describe('analyzeAuthError', () => {
    it('should analyze auth error', () => {
      const error = { code: 'auth/invalid-credential', message: 'Invalid credential' };
      const result = analyzeAuthError(error);
      expect(result).toBeDefined();
      expect(typeof result.configValid).toBe('boolean');
      expect(Array.isArray(result.recommendations)).toBe(true);
    });

    it('should handle unknown error', () => {
      const result = analyzeAuthError(new Error('Unknown error'));
      expect(result).toBeDefined();
      expect(Array.isArray(result.recommendations)).toBe(true);
    });

    it('should handle null error', () => {
      const result = analyzeAuthError(null);
      expect(result).toBeDefined();
    });
  });

  describe('printFirebaseDebugInfo', () => {
    it('should print debug info without error', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      const debugInfo = {
        configValid: true,
        missingEnvVars: [],
        recommendations: ['Test recommendation'],
      };

      expect(() => printFirebaseDebugInfo(debugInfo)).not.toThrow();
      consoleSpy.mockRestore();
    });
  });

  describe('testFirebaseConnection', () => {
    it('should return boolean', () => {
      const result = testFirebaseConnection();
      expect(typeof result).toBe('boolean');
    });
  });
});
