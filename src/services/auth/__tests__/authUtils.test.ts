/**
 * Auth Utilities Tests
 * Tests for authentication validation and user management utilities
 */

import {
  isValidEmail,
  isValidPassword,
  isValidDisplayName,
  convertFirebaseUser,
  getUserInitials,
  formatAuthError,
  needsProfileCompletion,
  generateAnonymousDisplayName,
} from '../authUtils';
import { User, SubscriptionStatus } from '../../../models/user';
import { User as FirebaseUser } from 'firebase/auth';

describe('authUtils', () => {
  describe('isValidEmail', () => {
    it('should return true for valid email addresses', () => {
      expect(isValidEmail('test@example.com')).toBe(true);
      expect(isValidEmail('user.name@domain.co.kr')).toBe(true);
      expect(isValidEmail('user+tag@example.org')).toBe(true);
    });

    it('should return false for invalid email addresses', () => {
      expect(isValidEmail('')).toBe(false);
      expect(isValidEmail('invalid')).toBe(false);
      expect(isValidEmail('invalid@')).toBe(false);
      expect(isValidEmail('@domain.com')).toBe(false);
      expect(isValidEmail('user@')).toBe(false);
      expect(isValidEmail('user name@domain.com')).toBe(false);
    });
  });

  describe('isValidPassword', () => {
    it('should return valid for passwords with 6 or more characters', () => {
      expect(isValidPassword('123456')).toEqual({ valid: true });
      expect(isValidPassword('password')).toEqual({ valid: true });
      expect(isValidPassword('a'.repeat(128))).toEqual({ valid: true });
    });

    it('should return invalid for passwords shorter than 6 characters', () => {
      const result = isValidPassword('12345');
      expect(result.valid).toBe(false);
      expect(result.message).toBe('비밀번호는 최소 6자 이상이어야 합니다.');
    });

    it('should return invalid for passwords longer than 128 characters', () => {
      const result = isValidPassword('a'.repeat(129));
      expect(result.valid).toBe(false);
      expect(result.message).toBe('비밀번호가 너무 깁니다.');
    });
  });

  describe('isValidDisplayName', () => {
    it('should return valid for names with 2-50 characters', () => {
      expect(isValidDisplayName('AB')).toEqual({ valid: true });
      expect(isValidDisplayName('홍길동')).toEqual({ valid: true });
      expect(isValidDisplayName('John Doe')).toEqual({ valid: true });
      expect(isValidDisplayName('a'.repeat(50))).toEqual({ valid: true });
    });

    it('should return invalid for names shorter than 2 characters', () => {
      const result = isValidDisplayName('A');
      expect(result.valid).toBe(false);
      expect(result.message).toBe('이름은 최소 2자 이상이어야 합니다.');
    });

    it('should return invalid for names longer than 50 characters', () => {
      const result = isValidDisplayName('a'.repeat(51));
      expect(result.valid).toBe(false);
      expect(result.message).toBe('이름이 너무 깁니다.');
    });

    it('should trim whitespace before validation', () => {
      expect(isValidDisplayName('  AB  ')).toEqual({ valid: true });
      const result = isValidDisplayName('   A   ');
      expect(result.valid).toBe(false);
    });
  });

  describe('convertFirebaseUser', () => {
    it('should convert Firebase user to app user format', () => {
      const mockFirebaseUser = {
        uid: 'test-uid-123',
        email: 'test@example.com',
        displayName: 'Test User',
        isAnonymous: false,
        photoURL: null,
        metadata: {
          creationTime: '2024-01-01T00:00:00.000Z',
          lastSignInTime: '2024-01-02T00:00:00.000Z',
        },
      } as unknown as FirebaseUser;

      const result = convertFirebaseUser(mockFirebaseUser);

      expect(result.id).toBe('test-uid-123');
      expect(result.email).toBe('test@example.com');
      expect(result.displayName).toBe('Test User');
      expect(result.isAnonymous).toBe(false);
      expect(result.createdAt).toBeInstanceOf(Date);
      expect(result.lastLoginAt).toBeInstanceOf(Date);
    });

    it('should handle anonymous user without email', () => {
      const mockFirebaseUser = {
        uid: 'anon-uid-123',
        email: null,
        displayName: null,
        isAnonymous: true,
        photoURL: null,
        metadata: {
          creationTime: undefined,
          lastSignInTime: undefined,
        },
      } as unknown as FirebaseUser;

      const result = convertFirebaseUser(mockFirebaseUser);

      expect(result.id).toBe('anon-uid-123');
      expect(result.email).toBe('');
      expect(result.displayName).toBe('익명 사용자');
      expect(result.isAnonymous).toBe(true);
    });
  });

  describe('getUserInitials', () => {
    it('should return first letter for single-word names', () => {
      expect(getUserInitials('홍길동')).toBe('홍');
      expect(getUserInitials('John')).toBe('J');
    });

    it('should return first letters of first two words for multi-word names', () => {
      expect(getUserInitials('John Doe')).toBe('JD');
      expect(getUserInitials('Kim Min Su')).toBe('KM');
    });

    it('should return 익명 for undefined, empty, or 익명 사용자', () => {
      expect(getUserInitials(undefined)).toBe('익명');
      expect(getUserInitials('')).toBe('익명');
      expect(getUserInitials('익명 사용자')).toBe('익명');
    });
  });

  describe('formatAuthError', () => {
    it('should return Korean error messages for known error codes', () => {
      expect(formatAuthError({ code: 'auth/user-not-found' })).toBe(
        '해당 이메일로 등록된 계정을 찾을 수 없습니다.'
      );
      expect(formatAuthError({ code: 'auth/wrong-password' })).toBe(
        '비밀번호가 올바르지 않습니다.'
      );
      expect(formatAuthError({ code: 'auth/email-already-in-use' })).toBe(
        '이미 사용 중인 이메일입니다.'
      );
      expect(formatAuthError({ code: 'auth/weak-password' })).toBe(
        '비밀번호가 너무 약합니다. 최소 6자 이상 입력해주세요.'
      );
      expect(formatAuthError({ code: 'auth/invalid-email' })).toBe(
        '유효하지 않은 이메일 형식입니다.'
      );
      expect(formatAuthError({ code: 'auth/user-disabled' })).toBe(
        '비활성화된 계정입니다. 고객센터에 문의해주세요.'
      );
      expect(formatAuthError({ code: 'auth/too-many-requests' })).toBe(
        '너무 많은 요청이 발생했습니다. 잠시 후 다시 시도해주세요.'
      );
      expect(formatAuthError({ code: 'auth/network-request-failed' })).toBe(
        '네트워크 연결을 확인해주세요.'
      );
      expect(formatAuthError({ code: 'auth/requires-recent-login' })).toBe(
        '보안을 위해 다시 로그인해주세요.'
      );
    });

    it('should return default message for unknown error codes', () => {
      expect(formatAuthError({ code: 'auth/unknown-error', message: 'Custom error' })).toBe(
        'Custom error'
      );
      expect(formatAuthError({})).toBe('인증 중 오류가 발생했습니다.');
      expect(formatAuthError(null)).toBe('인증 중 오류가 발생했습니다.');
    });
  });

  describe('needsProfileCompletion', () => {
    const createMockUser = (overrides: Partial<User> = {}): User => ({
      id: 'test-id',
      email: 'test@example.com',
      displayName: 'Test User',
      isAnonymous: false,
      preferences: {} as User['preferences'],
      subscription: SubscriptionStatus.FREE,
      createdAt: new Date(),
      lastLoginAt: new Date(),
      ...overrides,
    });

    it('should return false for anonymous users', () => {
      const user = createMockUser({ isAnonymous: true });
      expect(needsProfileCompletion(user)).toBe(false);
    });

    it('should return true for users without displayName', () => {
      const user = createMockUser({ displayName: '' });
      expect(needsProfileCompletion(user)).toBe(true);
    });

    it('should return true for users with default displayName', () => {
      const user = createMockUser({ displayName: '익명 사용자' });
      expect(needsProfileCompletion(user)).toBe(true);
    });

    it('should return true for users without email', () => {
      const user = createMockUser({ email: '' });
      expect(needsProfileCompletion(user)).toBe(true);
    });

    it('should return false for users with complete profiles', () => {
      const user = createMockUser();
      expect(needsProfileCompletion(user)).toBe(false);
    });
  });

  describe('generateAnonymousDisplayName', () => {
    it('should generate a valid display name format', () => {
      const name = generateAnonymousDisplayName();

      // Check format: "형용사 명사숫자"
      expect(name).toMatch(/^.+\s.+\d+$/);
    });

    it('should generate different names on multiple calls (probabilistic)', () => {
      const names = new Set<string>();
      for (let i = 0; i < 100; i++) {
        names.add(generateAnonymousDisplayName());
      }
      // Should have generated at least 10 different names in 100 tries
      expect(names.size).toBeGreaterThan(10);
    });

    it('should use Korean adjectives and nouns', () => {
      const adjectives = ['빠른', '조용한', '활발한', '성실한', '친근한'];
      const nouns = ['승객', '통근자', '여행자', '탐험가', '모험가'];

      const name = generateAnonymousDisplayName();
      const parts = name.split(' ');

      expect(parts.length).toBe(2);
      expect(adjectives).toContain(parts[0]);
      expect(nouns.some((noun) => parts[1]?.startsWith(noun))).toBe(true);
    });
  });
});
