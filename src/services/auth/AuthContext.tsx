/**
 * Authentication Context
 * Provides user authentication state and methods throughout the app
 */

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import {
  ApplicationVerifier,
  User as FirebaseUser,
  signInAnonymously,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile,
  sendPasswordResetEmail,
  updatePassword,
  reauthenticateWithCredential,
  EmailAuthProvider,
  PhoneAuthProvider,
  signInWithCredential,
  linkWithCredential,
  signInWithPhoneNumber,
} from 'firebase/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore';

import { auth, firestore } from '../firebase/config';
import { User, UserPreferences, SubscriptionStatus } from '../../models/user';

interface AuthContextType {
  user: User | null;
  firebaseUser: FirebaseUser | null;
  loading: boolean;
  signInAnonymously: () => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signUpWithEmail: (email: string, password: string, displayName?: string) => Promise<void>;
  signOut: () => Promise<void>;
  updateUserProfile: (updates: Partial<User>) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
  // Phone auth — request OTP via SMS, returns a verificationId.
  requestPhoneVerification: (
    e164PhoneNumber: string,
    recaptchaVerifier: ApplicationVerifier
  ) => Promise<string>;
  // Phone auth — confirm the OTP and sign the user in (creates phone-only user
  // if no current session, or signs into existing phone-credential user).
  confirmPhoneCode: (verificationId: string, code: string) => Promise<void>;
  // Link an email/password credential onto the currently signed-in user.
  // Used after a phone-only sign-in to attach email + displayName, yielding
  // a single Firebase user with both providers.
  linkEmailToCurrentUser: (
    email: string,
    password: string,
    displayName?: string
  ) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: React.ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [loading, setLoading] = useState(true);

  // Default user preferences
  const getDefaultPreferences = (): UserPreferences => ({
    favoriteStations: [],
    notificationSettings: {
      enabled: true,
      delayThresholdMinutes: 5,
      quietHours: {
        enabled: false,
        startTime: '22:00',
        endTime: '07:00',
      },
      weekdaysOnly: false,
      alertTypes: {
        delays: true,
        suspensions: true,
        congestion: false,
        alternativeRoutes: true,
        serviceUpdates: true,
      },
      pushNotifications: true,
      emailNotifications: false,
      soundSettings: {
        soundEnabled: true,
        soundId: 'default',
        volume: 80,
        vibrationEnabled: true,
        vibrationPattern: 'default',
      },
    },
    commuteSchedule: {
      weekdays: {
        morningCommute: null,
        eveningCommute: null,
      },
      weekends: null,
      autoDetect: false,
    },
    language: 'ko',
    theme: 'system',
    units: 'metric',
  });

  // Create or get user document
  const createOrGetUserDocument = async (firebaseUser: FirebaseUser): Promise<User> => {
    const userRef = doc(firestore, 'users', firebaseUser.uid);
    const userDoc = await getDoc(userRef);

    if (userDoc.exists()) {
      const userData = userDoc.data();
      return {
        id: firebaseUser.uid,
        email: firebaseUser.email || '',
        displayName: firebaseUser.displayName || '익명 사용자',
        isAnonymous: firebaseUser.isAnonymous,
        profilePicture: firebaseUser.photoURL,
        preferences: userData.preferences || getDefaultPreferences(),
        subscription: userData.subscription || SubscriptionStatus.FREE,
        createdAt: userData.createdAt?.toDate() || new Date(),
        lastLoginAt: new Date(),
      };
    } else {
      // Create new user document
      const newUser: User = {
        id: firebaseUser.uid,
        email: firebaseUser.email || '',
        displayName: firebaseUser.displayName || '익명 사용자',
        isAnonymous: firebaseUser.isAnonymous,
        profilePicture: firebaseUser.photoURL,
        preferences: getDefaultPreferences(),
        subscription: SubscriptionStatus.FREE,
        createdAt: new Date(),
        lastLoginAt: new Date(),
      };

      await setDoc(userRef, {
        ...newUser,
        createdAt: newUser.createdAt,
        lastLoginAt: newUser.lastLoginAt,
      });

      return newUser;
    }
  };

  // Update user's last active time
  const updateLastActive = async (userId: string): Promise<void> => {
    try {
      const userRef = doc(firestore, 'users', userId);
      await setDoc(userRef, { lastActiveAt: new Date() }, { merge: true });
    } catch (error) {
      console.error('Error updating last active:', error);
    }
  };

  // Auth state listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setLoading(true);
      
      if (firebaseUser) {
        try {
          const userData = await createOrGetUserDocument(firebaseUser);
          setUser(userData);
          setFirebaseUser(firebaseUser);
          
          // Update last active time
          await updateLastActive(firebaseUser.uid);
        } catch (error) {
          console.error('Error creating/getting user document:', error);
          setUser(null);
          setFirebaseUser(null);
        }
      } else {
        setUser(null);
        setFirebaseUser(null);
      }
      
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const handleSignInAnonymously = useCallback(async (): Promise<void> => {
    try {
      await signInAnonymously(auth);
    } catch (error) {
      console.error('Anonymous sign in error:', error);
      throw new Error('익명 로그인에 실패했습니다.');
    }
  }, []);

  const handleSignInWithEmail = useCallback(async (email: string, password: string): Promise<void> => {
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (error) {
      console.error('Email sign in error:', error);
      throw new Error('이메일 로그인에 실패했습니다.');
    }
  }, []);

  const handleSignUpWithEmail = useCallback(async (
    email: string,
    password: string,
    displayName?: string
  ): Promise<void> => {
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);

      if (displayName && userCredential.user) {
        await updateProfile(userCredential.user, { displayName });
      }
    } catch (error) {
      console.error('Email sign up error:', error);
      throw new Error('계정 생성에 실패했습니다.');
    }
  }, []);

  const handleSignOut = useCallback(async (): Promise<void> => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error('Sign out error:', error);
      throw new Error('로그아웃에 실패했습니다.');
    }
  }, []);

  const handleUpdateUserProfile = useCallback(async (updates: Partial<User>): Promise<void> => {
    if (!firebaseUser || !user) {
      throw new Error('사용자가 로그인되어 있지 않습니다.');
    }

    try {
      const userRef = doc(firestore, 'users', firebaseUser.uid);
      await setDoc(userRef, { ...updates, lastActiveAt: new Date() }, { merge: true });

      // Update local user state
      setUser(prev => prev ? { ...prev, ...updates } : null);

      // Update Firebase Auth profile if needed
      if (updates.displayName !== undefined) {
        await updateProfile(firebaseUser, { displayName: updates.displayName });
      }
    } catch (error) {
      console.error('Error updating user profile:', error);
      throw new Error('프로필 업데이트에 실패했습니다.');
    }
  }, [firebaseUser, user]);

  const handleResetPassword = useCallback(async (email: string): Promise<void> => {
    try {
      await sendPasswordResetEmail(auth, email);
    } catch (error) {
      console.error('Password reset error:', error);
      throw new Error('비밀번호 재설정 이메일 전송에 실패했습니다.');
    }
  }, []);

  const handleRequestPhoneVerification = useCallback(async (
    e164PhoneNumber: string,
    recaptchaVerifier: ApplicationVerifier
  ): Promise<string> => {
    try {
      const confirmation = await signInWithPhoneNumber(
        auth,
        e164PhoneNumber,
        recaptchaVerifier
      );
      return confirmation.verificationId;
    } catch (error: unknown) {
      console.error('Phone verification request error:', error);
      const firebaseError = error as { code?: string };
      if (firebaseError.code === 'auth/invalid-phone-number') {
        throw new Error('휴대폰 번호 형식이 올바르지 않습니다.');
      }
      if (firebaseError.code === 'auth/too-many-requests') {
        throw new Error('요청이 너무 많습니다. 잠시 후 다시 시도해주세요.');
      }
      if (firebaseError.code === 'auth/quota-exceeded') {
        throw new Error('SMS 인증 한도를 초과했습니다. 잠시 후 다시 시도해주세요.');
      }
      throw new Error('인증번호 요청에 실패했습니다.');
    }
  }, []);

  const handleConfirmPhoneCode = useCallback(async (
    verificationId: string,
    code: string
  ): Promise<void> => {
    try {
      const credential = PhoneAuthProvider.credential(verificationId, code);
      await signInWithCredential(auth, credential);
    } catch (error: unknown) {
      console.error('Phone code confirmation error:', error);
      const firebaseError = error as { code?: string };
      if (firebaseError.code === 'auth/invalid-verification-code') {
        throw new Error('인증번호가 올바르지 않습니다.');
      }
      if (firebaseError.code === 'auth/code-expired') {
        throw new Error('인증번호가 만료되었습니다. 다시 요청해주세요.');
      }
      throw new Error('인증에 실패했습니다.');
    }
  }, []);

  const handleLinkEmailToCurrentUser = useCallback(async (
    email: string,
    password: string,
    displayName?: string
  ): Promise<void> => {
    const current = auth.currentUser;
    if (!current) {
      throw new Error('로그인된 사용자가 없습니다. 본인 인증을 먼저 완료해주세요.');
    }
    try {
      const credential = EmailAuthProvider.credential(email, password);
      await linkWithCredential(current, credential);
      if (displayName) {
        await updateProfile(current, { displayName });
      }
    } catch (error: unknown) {
      console.error('Link email credential error:', error);
      const firebaseError = error as { code?: string };
      if (firebaseError.code === 'auth/email-already-in-use') {
        throw new Error('이미 사용 중인 이메일입니다.');
      }
      if (firebaseError.code === 'auth/credential-already-in-use') {
        throw new Error('이미 다른 계정에 연결된 이메일입니다.');
      }
      if (firebaseError.code === 'auth/weak-password') {
        throw new Error('비밀번호가 너무 약합니다. 6자 이상 입력해주세요.');
      }
      throw new Error('계정 생성에 실패했습니다.');
    }
  }, []);

  const handleChangePassword = useCallback(async (
    currentPassword: string,
    newPassword: string
  ): Promise<void> => {
    if (!firebaseUser || !firebaseUser.email) {
      throw new Error('로그인된 사용자가 없습니다.');
    }

    try {
      // Re-authenticate user with current password
      const credential = EmailAuthProvider.credential(
        firebaseUser.email,
        currentPassword
      );
      await reauthenticateWithCredential(firebaseUser, credential);

      // Update password
      await updatePassword(firebaseUser, newPassword);
    } catch (error: unknown) {
      console.error('Password change error:', error);
      const firebaseError = error as { code?: string };
      if (firebaseError.code === 'auth/wrong-password') {
        throw new Error('현재 비밀번호가 올바르지 않습니다.');
      } else if (firebaseError.code === 'auth/weak-password') {
        throw new Error('새 비밀번호가 너무 약합니다. 6자 이상 입력해주세요.');
      } else if (firebaseError.code === 'auth/requires-recent-login') {
        throw new Error('보안을 위해 다시 로그인 후 시도해주세요.');
      }
      throw new Error('비밀번호 변경에 실패했습니다.');
    }
  }, [firebaseUser]);

  const value = useMemo<AuthContextType>(() => ({
    user,
    firebaseUser,
    loading,
    signInAnonymously: handleSignInAnonymously,
    signInWithEmail: handleSignInWithEmail,
    signUpWithEmail: handleSignUpWithEmail,
    signOut: handleSignOut,
    updateUserProfile: handleUpdateUserProfile,
    resetPassword: handleResetPassword,
    changePassword: handleChangePassword,
    requestPhoneVerification: handleRequestPhoneVerification,
    confirmPhoneCode: handleConfirmPhoneCode,
    linkEmailToCurrentUser: handleLinkEmailToCurrentUser,
  }), [
    user,
    firebaseUser,
    loading,
    handleSignInAnonymously,
    handleSignInWithEmail,
    handleSignUpWithEmail,
    handleSignOut,
    handleUpdateUserProfile,
    handleResetPassword,
    handleChangePassword,
    handleRequestPhoneVerification,
    handleConfirmPhoneCode,
    handleLinkEmailToCurrentUser,
  ]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};