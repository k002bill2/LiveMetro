/**
 * AuthContext Tests
 */

import React from 'react';
import { renderHook, act, waitFor } from '@testing-library/react-native';
import { AuthProvider, useAuth } from '../AuthContext';

// Mock Firebase Auth
const mockSignInAnonymously = jest.fn();
const mockSignInWithEmailAndPassword = jest.fn();
const mockCreateUserWithEmailAndPassword = jest.fn();
const mockSignOut = jest.fn();
const mockOnAuthStateChanged = jest.fn();
const mockUpdateProfile = jest.fn();
const mockSendPasswordResetEmail = jest.fn();
const mockUpdatePassword = jest.fn();
const mockReauthenticateWithCredential = jest.fn();
const mockSignInWithPhoneNumber = jest.fn();
const mockSignInWithCredential = jest.fn();
const mockLinkWithCredential = jest.fn();
const mockPhoneAuthProviderCredential = jest.fn(
  (..._args: unknown[]) => 'mockPhoneCredential' as unknown,
);
const mockCurrentUser: { value: { uid?: string } | null } = { value: null };

jest.mock('firebase/auth', () => ({
  signInAnonymously: (...args: unknown[]) => mockSignInAnonymously(...args),
  signInWithEmailAndPassword: (...args: unknown[]) => mockSignInWithEmailAndPassword(...args),
  createUserWithEmailAndPassword: (...args: unknown[]) => mockCreateUserWithEmailAndPassword(...args),
  signOut: (...args: unknown[]) => mockSignOut(...args),
  onAuthStateChanged: (...args: unknown[]) => mockOnAuthStateChanged(...args),
  updateProfile: (...args: unknown[]) => mockUpdateProfile(...args),
  sendPasswordResetEmail: (...args: unknown[]) => mockSendPasswordResetEmail(...args),
  updatePassword: (...args: unknown[]) => mockUpdatePassword(...args),
  reauthenticateWithCredential: (...args: unknown[]) => mockReauthenticateWithCredential(...args),
  signInWithPhoneNumber: (...args: unknown[]) => mockSignInWithPhoneNumber(...args),
  signInWithCredential: (...args: unknown[]) => mockSignInWithCredential(...args),
  linkWithCredential: (...args: unknown[]) => mockLinkWithCredential(...args),
  EmailAuthProvider: {
    credential: jest.fn(() => 'mockCredential'),
  },
  PhoneAuthProvider: {
    credential: (...args: unknown[]) => mockPhoneAuthProviderCredential(...args),
  },
}));

// Mock Firebase Firestore
const mockGetDoc = jest.fn();
const mockSetDoc = jest.fn();

jest.mock('firebase/firestore', () => ({
  doc: jest.fn(() => 'mockDocRef'),
  getDoc: (...args: unknown[]) => mockGetDoc(...args),
  setDoc: (...args: unknown[]) => mockSetDoc(...args),
}));

// Mock Firebase config — `auth` is referenced via `auth.currentUser` inside
// linkEmailToCurrentUser, so use a getter to expose the mutable mock value.
jest.mock('../../firebase/config', () => ({
  auth: {
    get currentUser() {
      return mockCurrentUser.value;
    },
  },
  firestore: {},
  firebaseConfig: {
    apiKey: 'mock',
    authDomain: 'mock',
    projectId: 'mock',
    storageBucket: 'mock',
    messagingSenderId: 'mock',
    appId: 'mock',
  },
}));

describe('AuthContext', () => {
  let authStateCallback: ((user: unknown) => void) | null = null;

  beforeEach(() => {
    jest.clearAllMocks();
    authStateCallback = null;

    // Setup onAuthStateChanged to capture the callback
    mockOnAuthStateChanged.mockImplementation((_auth, callback) => {
      authStateCallback = callback;
      // Initial call with no user
      setTimeout(() => callback(null), 0);
      // Return unsubscribe function
      return jest.fn();
    });
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <AuthProvider>{children}</AuthProvider>
  );

  describe('useAuth hook', () => {
    it('should throw error when used outside AuthProvider', () => {
      // Suppress console.error for this test
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      expect(() => {
        renderHook(() => useAuth());
      }).toThrow('useAuth must be used within an AuthProvider');

      consoleSpy.mockRestore();
    });

    it('should provide auth context when used within AuthProvider', async () => {
      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current).toBeDefined();
        expect(result.current.user).toBeNull();
        expect(result.current.loading).toBe(false);
      });
    });
  });

  describe('signInAnonymously', () => {
    it('should call Firebase signInAnonymously', async () => {
      mockSignInAnonymously.mockResolvedValue({ user: { uid: 'anon-123' } });

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => expect(result.current.loading).toBe(false));

      await act(async () => {
        await result.current.signInAnonymously();
      });

      expect(mockSignInAnonymously).toHaveBeenCalled();
    });

    it('should throw error on failure', async () => {
      mockSignInAnonymously.mockRejectedValue(new Error('Network error'));

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => expect(result.current.loading).toBe(false));

      await expect(
        act(async () => {
          await result.current.signInAnonymously();
        })
      ).rejects.toThrow('익명 로그인에 실패했습니다.');
    });
  });

  describe('signInWithEmail', () => {
    it('should call Firebase signInWithEmailAndPassword', async () => {
      mockSignInWithEmailAndPassword.mockResolvedValue({ user: { uid: 'user-123' } });

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => expect(result.current.loading).toBe(false));

      await act(async () => {
        await result.current.signInWithEmail('test@example.com', 'password123');
      });

      expect(mockSignInWithEmailAndPassword).toHaveBeenCalledWith(
        expect.anything(),
        'test@example.com',
        'password123'
      );
    });

    it('should throw error on invalid credentials', async () => {
      mockSignInWithEmailAndPassword.mockRejectedValue(new Error('Invalid credentials'));

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => expect(result.current.loading).toBe(false));

      await expect(
        act(async () => {
          await result.current.signInWithEmail('test@example.com', 'wrongpassword');
        })
      ).rejects.toThrow('이메일 로그인에 실패했습니다.');
    });
  });

  describe('signUpWithEmail', () => {
    it('should create user with email and password', async () => {
      const mockUser = { uid: 'new-user-123' };
      mockCreateUserWithEmailAndPassword.mockResolvedValue({ user: mockUser });
      mockUpdateProfile.mockResolvedValue(undefined);

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => expect(result.current.loading).toBe(false));

      await act(async () => {
        await result.current.signUpWithEmail('new@example.com', 'password123', 'New User');
      });

      expect(mockCreateUserWithEmailAndPassword).toHaveBeenCalledWith(
        expect.anything(),
        'new@example.com',
        'password123'
      );
      expect(mockUpdateProfile).toHaveBeenCalledWith(mockUser, { displayName: 'New User' });
    });

    it('should not update profile if no displayName provided', async () => {
      mockCreateUserWithEmailAndPassword.mockResolvedValue({ user: { uid: 'new-user-123' } });

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => expect(result.current.loading).toBe(false));

      await act(async () => {
        await result.current.signUpWithEmail('new@example.com', 'password123');
      });

      expect(mockCreateUserWithEmailAndPassword).toHaveBeenCalled();
      expect(mockUpdateProfile).not.toHaveBeenCalled();
    });

    it('should throw error on failure', async () => {
      mockCreateUserWithEmailAndPassword.mockRejectedValue(new Error('Email already exists'));

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => expect(result.current.loading).toBe(false));

      await expect(
        act(async () => {
          await result.current.signUpWithEmail('existing@example.com', 'password123');
        })
      ).rejects.toThrow('계정 생성에 실패했습니다.');
    });
  });

  describe('signOut', () => {
    it('should call Firebase signOut', async () => {
      mockSignOut.mockResolvedValue(undefined);

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => expect(result.current.loading).toBe(false));

      await act(async () => {
        await result.current.signOut();
      });

      expect(mockSignOut).toHaveBeenCalled();
    });

    it('should throw error on failure', async () => {
      mockSignOut.mockRejectedValue(new Error('Sign out failed'));

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => expect(result.current.loading).toBe(false));

      await expect(
        act(async () => {
          await result.current.signOut();
        })
      ).rejects.toThrow('로그아웃에 실패했습니다.');
    });
  });

  describe('resetPassword', () => {
    it('should send password reset email', async () => {
      mockSendPasswordResetEmail.mockResolvedValue(undefined);

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => expect(result.current.loading).toBe(false));

      await act(async () => {
        await result.current.resetPassword('test@example.com');
      });

      expect(mockSendPasswordResetEmail).toHaveBeenCalledWith(
        expect.anything(),
        'test@example.com'
      );
    });

    it('should throw error on failure', async () => {
      mockSendPasswordResetEmail.mockRejectedValue(new Error('Email not found'));

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => expect(result.current.loading).toBe(false));

      await expect(
        act(async () => {
          await result.current.resetPassword('nonexistent@example.com');
        })
      ).rejects.toThrow('비밀번호 재설정 이메일 전송에 실패했습니다.');
    });
  });

  describe('auth state changes', () => {
    it('should update user when auth state changes to logged in', async () => {
      const mockFirebaseUser = {
        uid: 'user-123',
        email: 'test@example.com',
        displayName: 'Test User',
        isAnonymous: false,
        photoURL: null,
      };

      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => ({
          preferences: {},
          subscription: 'free',
          createdAt: { toDate: () => new Date() },
        }),
      });
      mockSetDoc.mockResolvedValue(undefined);

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => expect(result.current.loading).toBe(false));

      // Simulate auth state change
      await act(async () => {
        if (authStateCallback) {
          authStateCallback(mockFirebaseUser);
        }
      });

      await waitFor(() => {
        expect(result.current.user).not.toBeNull();
        expect(result.current.user?.email).toBe('test@example.com');
      });
    });

    it('should create new user document if not exists', async () => {
      const mockFirebaseUser = {
        uid: 'new-user-456',
        email: 'newuser@example.com',
        displayName: null,
        isAnonymous: false,
        photoURL: null,
      };

      mockGetDoc.mockResolvedValue({
        exists: () => false,
      });
      mockSetDoc.mockResolvedValue(undefined);

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => expect(result.current.loading).toBe(false));

      // Simulate auth state change
      await act(async () => {
        if (authStateCallback) {
          authStateCallback(mockFirebaseUser);
        }
      });

      await waitFor(() => {
        expect(mockSetDoc).toHaveBeenCalled();
        expect(result.current.user?.displayName).toBe('익명 사용자');
      });
    });
  });

  describe('updateUserProfile', () => {
    it('should throw error when not logged in', async () => {
      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => expect(result.current.loading).toBe(false));

      await expect(
        act(async () => {
          await result.current.updateUserProfile({ displayName: 'New Name' });
        })
      ).rejects.toThrow('사용자가 로그인되어 있지 않습니다.');
    });
  });

  describe('changePassword', () => {
    it('should throw error when not logged in', async () => {
      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => expect(result.current.loading).toBe(false));

      await expect(
        act(async () => {
          await result.current.changePassword('oldpass', 'newpass');
        })
      ).rejects.toThrow('로그인된 사용자가 없습니다.');
    });
  });

  describe('requestPhoneVerification', () => {
    it('returns the verificationId from signInWithPhoneNumber', async () => {
      mockSignInWithPhoneNumber.mockResolvedValue({ verificationId: 'vid-123' });
      const { result } = renderHook(() => useAuth(), { wrapper });
      await waitFor(() => expect(result.current.loading).toBe(false));

      let verificationId = '';
      await act(async () => {
        verificationId = await result.current.requestPhoneVerification(
          '+821012345678',
          {} as never,
        );
      });

      expect(verificationId).toBe('vid-123');
      expect(mockSignInWithPhoneNumber).toHaveBeenCalledWith(
        expect.anything(),
        '+821012345678',
        expect.anything(),
      );
    });

    it('maps auth/invalid-phone-number to a Korean message', async () => {
      mockSignInWithPhoneNumber.mockRejectedValue({ code: 'auth/invalid-phone-number' });
      const { result } = renderHook(() => useAuth(), { wrapper });
      await waitFor(() => expect(result.current.loading).toBe(false));

      await expect(
        act(async () => {
          await result.current.requestPhoneVerification('+82bad', {} as never);
        }),
      ).rejects.toThrow(/휴대폰 번호 형식/);
    });
  });

  describe('confirmPhoneCode', () => {
    it('signs in with PhoneAuthProvider credential on success', async () => {
      mockSignInWithCredential.mockResolvedValue({ user: { uid: 'phone-uid' } });
      const { result } = renderHook(() => useAuth(), { wrapper });
      await waitFor(() => expect(result.current.loading).toBe(false));

      await act(async () => {
        await result.current.confirmPhoneCode('vid-123', '654321');
      });

      expect(mockPhoneAuthProviderCredential).toHaveBeenCalledWith('vid-123', '654321');
      expect(mockSignInWithCredential).toHaveBeenCalledWith(
        expect.anything(),
        'mockPhoneCredential',
      );
    });

    it('maps auth/invalid-verification-code to a Korean message', async () => {
      mockSignInWithCredential.mockRejectedValue({ code: 'auth/invalid-verification-code' });
      const { result } = renderHook(() => useAuth(), { wrapper });
      await waitFor(() => expect(result.current.loading).toBe(false));

      await expect(
        act(async () => {
          await result.current.confirmPhoneCode('vid-123', '000000');
        }),
      ).rejects.toThrow(/인증번호가 올바르지 않습니다/);
    });
  });

  describe('linkEmailToCurrentUser', () => {
    it('throws when there is no current user', async () => {
      mockCurrentUser.value = null;
      const { result } = renderHook(() => useAuth(), { wrapper });
      await waitFor(() => expect(result.current.loading).toBe(false));

      await expect(
        act(async () => {
          await result.current.linkEmailToCurrentUser('a@test.com', 'pw123456');
        }),
      ).rejects.toThrow(/로그인된 사용자가 없습니다/);
    });

    it('calls linkWithCredential and updateProfile when displayName is provided', async () => {
      const fakeUser = { uid: 'phone-uid' };
      mockCurrentUser.value = fakeUser;
      mockLinkWithCredential.mockResolvedValue({ user: fakeUser });
      mockUpdateProfile.mockResolvedValue(undefined);

      const { result } = renderHook(() => useAuth(), { wrapper });
      await waitFor(() => expect(result.current.loading).toBe(false));

      await act(async () => {
        await result.current.linkEmailToCurrentUser('a@test.com', 'pw123456', '홍길동');
      });

      expect(mockLinkWithCredential).toHaveBeenCalledWith(fakeUser, 'mockCredential');
      expect(mockUpdateProfile).toHaveBeenCalledWith(fakeUser, { displayName: '홍길동' });

      mockCurrentUser.value = null; // reset for other tests
    });
  });
});
