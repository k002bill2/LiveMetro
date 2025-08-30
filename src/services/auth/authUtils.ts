/**
 * Authentication Utilities
 * Helper functions for authentication validation and user management
 */

import { User as FirebaseUser } from 'firebase/auth';
import { User } from '../../models/user';

/**
 * Validate email format
 */
export const isValidEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

/**
 * Validate password strength
 */
export const isValidPassword = (password: string): { valid: boolean; message?: string } => {
  if (password.length < 6) {
    return { valid: false, message: '비밀번호는 최소 6자 이상이어야 합니다.' };
  }
  
  if (password.length > 128) {
    return { valid: false, message: '비밀번호가 너무 깁니다.' };
  }

  return { valid: true };
};

/**
 * Validate display name
 */
export const isValidDisplayName = (displayName: string): { valid: boolean; message?: string } => {
  const trimmed = displayName.trim();
  
  if (trimmed.length < 2) {
    return { valid: false, message: '이름은 최소 2자 이상이어야 합니다.' };
  }
  
  if (trimmed.length > 50) {
    return { valid: false, message: '이름이 너무 깁니다.' };
  }

  return { valid: true };
};

/**
 * Convert Firebase user to app user
 */
export const convertFirebaseUser = (firebaseUser: FirebaseUser): Omit<User, 'preferences'> => {
  return {
    id: firebaseUser.uid,
    email: firebaseUser.email || '',
    displayName: firebaseUser.displayName || '익명 사용자',
    isAnonymous: firebaseUser.isAnonymous,
    createdAt: firebaseUser.metadata.creationTime 
      ? new Date(firebaseUser.metadata.creationTime) 
      : new Date(),
    lastLoginAt: firebaseUser.metadata.lastSignInTime
      ? new Date(firebaseUser.metadata.lastSignInTime)
      : new Date()
  };
};

/**
 * Get user initials for avatar display
 */
export const getUserInitials = (displayName?: string): string => {
  if (!displayName || displayName === '익명 사용자') {
    return '익명';
  }
  
  const names = displayName.split(' ');
  if (names.length === 1) {
    return names[0]?.charAt(0).toUpperCase() || '익명';
  }
  
  return names
    .slice(0, 2)
    .map(name => name?.charAt(0).toUpperCase() || '')
    .filter(initial => initial)
    .join('') || '익명';
};

/**
 * Format authentication error messages
 */
export const formatAuthError = (error: any): string => {
  const errorCode = error?.code || '';
  
  switch (errorCode) {
    case 'auth/user-not-found':
      return '해당 이메일로 등록된 계정을 찾을 수 없습니다.';
    case 'auth/wrong-password':
      return '비밀번호가 올바르지 않습니다.';
    case 'auth/email-already-in-use':
      return '이미 사용 중인 이메일입니다.';
    case 'auth/weak-password':
      return '비밀번호가 너무 약합니다. 최소 6자 이상 입력해주세요.';
    case 'auth/invalid-email':
      return '유효하지 않은 이메일 형식입니다.';
    case 'auth/user-disabled':
      return '비활성화된 계정입니다. 고객센터에 문의해주세요.';
    case 'auth/too-many-requests':
      return '너무 많은 요청이 발생했습니다. 잠시 후 다시 시도해주세요.';
    case 'auth/network-request-failed':
      return '네트워크 연결을 확인해주세요.';
    case 'auth/requires-recent-login':
      return '보안을 위해 다시 로그인해주세요.';
    default:
      return error?.message || '인증 중 오류가 발생했습니다.';
  }
};

/**
 * Check if user needs to complete profile
 */
export const needsProfileCompletion = (user: User): boolean => {
  if (user.isAnonymous) {
    return false; // Anonymous users don't need profile completion
  }
  
  return !user.displayName || 
         user.displayName === '익명 사용자' || 
         !user.email;
};

/**
 * Generate anonymous display name
 */
export const generateAnonymousDisplayName = (): string => {
  const adjectives = ['빠른', '조용한', '활발한', '성실한', '친근한'];
  const nouns = ['승객', '통근자', '여행자', '탐험가', '모험가'];
  
  const adjective = adjectives[Math.floor(Math.random() * adjectives.length)];
  const noun = nouns[Math.floor(Math.random() * nouns.length)];
  const number = Math.floor(Math.random() * 999) + 1;
  
  return `${adjective} ${noun}${number}`;
};