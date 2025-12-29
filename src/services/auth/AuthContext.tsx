/**
 * Authentication Context
 * Provides user authentication state and methods throughout the app
 */

import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  User as FirebaseUser,
  signInAnonymously,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile,
  sendPasswordResetEmail,
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

  const handleSignInAnonymously = async (): Promise<void> => {
    try {
      await signInAnonymously(auth);
    } catch (error) {
      console.error('Anonymous sign in error:', error);
      throw new Error('익명 로그인에 실패했습니다.');
    }
  };

  const handleSignInWithEmail = async (email: string, password: string): Promise<void> => {
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (error) {
      console.error('Email sign in error:', error);
      throw new Error('이메일 로그인에 실패했습니다.');
    }
  };

  const handleSignUpWithEmail = async (
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
  };

  const handleSignOut = async (): Promise<void> => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error('Sign out error:', error);
      throw new Error('로그아웃에 실패했습니다.');
    }
  };

  const handleUpdateUserProfile = async (updates: Partial<User>): Promise<void> => {
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
  };

  const handleResetPassword = async (email: string): Promise<void> => {
    try {
      await sendPasswordResetEmail(auth, email);
    } catch (error) {
      console.error('Password reset error:', error);
      throw new Error('비밀번호 재설정 이메일 전송에 실패했습니다.');
    }
  };

  const value: AuthContextType = {
    user,
    firebaseUser,
    loading,
    signInAnonymously: handleSignInAnonymously,
    signInWithEmail: handleSignInWithEmail,
    signUpWithEmail: handleSignUpWithEmail,
    signOut: handleSignOut,
    updateUserProfile: handleUpdateUserProfile,
    resetPassword: handleResetPassword,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};