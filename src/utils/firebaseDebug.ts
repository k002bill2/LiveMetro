/**
 * Firebase Debug Utilities
 * Helps diagnose Firebase authentication issues
 */

import { validateFirebaseConfig } from '../services/firebase/config';

export interface FirebaseDebugInfo {
  configValid: boolean;
  missingEnvVars: string[];
  recommendations: string[];
  errorType?: string;
}

/**
 * Check if a Firebase environment variable value is valid
 */
const isValidEnvValue = (value: string | undefined): boolean => {
  return !!value && value !== '' && !value.startsWith('your_') && value !== 'development-key';
};

/**
 * Check if all required Firebase environment variables are set
 * Note: Expo requires static access to process.env variables
 */
export const checkFirebaseEnvVars = (): { valid: boolean; missing: string[] } => {
  const missing: string[] = [];

  // Static access to each environment variable (required by Expo)
  if (!isValidEnvValue(process.env.EXPO_PUBLIC_FIREBASE_API_KEY)) {
    missing.push('EXPO_PUBLIC_FIREBASE_API_KEY');
  }
  if (!isValidEnvValue(process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN)) {
    missing.push('EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN');
  }
  if (!isValidEnvValue(process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID)) {
    missing.push('EXPO_PUBLIC_FIREBASE_PROJECT_ID');
  }
  if (!isValidEnvValue(process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET)) {
    missing.push('EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET');
  }
  if (!isValidEnvValue(process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID)) {
    missing.push('EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID');
  }
  if (!isValidEnvValue(process.env.EXPO_PUBLIC_FIREBASE_APP_ID)) {
    missing.push('EXPO_PUBLIC_FIREBASE_APP_ID');
  }

  return {
    valid: missing.length === 0,
    missing,
  };
};

/**
 * Analyze Firebase authentication error
 */
export const analyzeAuthError = (error: unknown): FirebaseDebugInfo => {
  const result: FirebaseDebugInfo = {
    configValid: validateFirebaseConfig(),
    missingEnvVars: [],
    recommendations: [],
  };

  // Check environment variables
  const envCheck = checkFirebaseEnvVars();
  result.missingEnvVars = envCheck.missing;

  if (!envCheck.valid) {
    result.recommendations.push(
      '⚠️ Firebase 환경 변수가 설정되지 않았습니다.',
      '1. .env 파일을 생성하고 Firebase 설정을 추가하세요.',
      '2. 앱을 재시작하여 환경 변수를 다시 로드하세요.'
    );
  }

  // Analyze specific error
  if (error instanceof Error) {
    const errorMessage = error.message.toLowerCase();

    if (errorMessage.includes('auth/email-already-in-use')) {
      result.errorType = 'EMAIL_IN_USE';
      result.recommendations.push(
        '❌ 이미 사용 중인 이메일입니다.',
        '→ 다른 이메일을 사용하거나 로그인하세요.'
      );
    } else if (errorMessage.includes('auth/invalid-email')) {
      result.errorType = 'INVALID_EMAIL';
      result.recommendations.push(
        '❌ 올바르지 않은 이메일 형식입니다.',
        '→ 유효한 이메일 주소를 입력하세요.'
      );
    } else if (errorMessage.includes('auth/weak-password')) {
      result.errorType = 'WEAK_PASSWORD';
      result.recommendations.push(
        '❌ 비밀번호가 너무 약합니다.',
        '→ 최소 6자 이상의 비밀번호를 사용하세요.'
      );
    } else if (errorMessage.includes('auth/operation-not-allowed')) {
      result.errorType = 'AUTH_DISABLED';
      result.recommendations.push(
        '⚠️ Firebase 콘솔에서 이메일/비밀번호 인증이 활성화되지 않았습니다.',
        '',
        '해결 방법:',
        '1. Firebase Console (https://console.firebase.google.com) 접속',
        '2. 프로젝트 선택 (livemetro-cc092)',
        '3. Authentication > Sign-in method 메뉴 선택',
        '4. Email/Password 인증 방법을 "사용 설정"으로 변경',
        '5. 저장 후 앱 재시작'
      );
    } else if (errorMessage.includes('auth/network-request-failed')) {
      result.errorType = 'NETWORK_ERROR';
      result.recommendations.push(
        '❌ 네트워크 연결 오류',
        '→ 인터넷 연결을 확인하세요.'
      );
    } else if (errorMessage.includes('permission-denied') || errorMessage.includes('firestore')) {
      result.errorType = 'FIRESTORE_PERMISSION';
      result.recommendations.push(
        '⚠️ Firestore 권한 오류',
        '',
        '해결 방법:',
        '1. Firebase Console > Firestore Database > Rules 선택',
        '2. 다음 규칙으로 변경:',
        '',
        'rules_version = \'2\';',
        'service cloud.firestore {',
        '  match /databases/{database}/documents {',
        '    match /users/{userId} {',
        '      allow read, write: if request.auth != null && request.auth.uid == userId;',
        '    }',
        '    match /{document=**} {',
        '      allow read: if request.auth != null;',
        '    }',
        '  }',
        '}',
        '',
        '3. "게시" 버튼 클릭'
      );
    } else if (errorMessage.includes('api key')) {
      result.errorType = 'INVALID_API_KEY';
      result.recommendations.push(
        '❌ 잘못된 Firebase API 키',
        '→ .env 파일의 EXPO_PUBLIC_FIREBASE_API_KEY를 확인하세요.'
      );
    } else {
      result.errorType = 'UNKNOWN';
      result.recommendations.push(
        `⚠️ 알 수 없는 오류: ${error.message}`,
        '',
        '일반적인 해결 방법:',
        '1. 앱을 재시작하세요',
        '2. 인터넷 연결을 확인하세요',
        '3. Firebase 콘솔에서 프로젝트 설정을 확인하세요',
        '4. 콘솔 로그에서 자세한 에러 메시지를 확인하세요'
      );
    }
  }

  return result;
};

/**
 * Print debug information to console
 */
export const printFirebaseDebugInfo = (debugInfo: FirebaseDebugInfo): void => {
  console.log('\n========================================');
  console.log('🔍 Firebase 진단 결과');
  console.log('========================================\n');

  console.log('설정 상태:', debugInfo.configValid ? '✅ 정상' : '❌ 문제 있음');

  if (debugInfo.missingEnvVars.length > 0) {
    console.log('\n누락된 환경 변수:');
    debugInfo.missingEnvVars.forEach(varName => {
      console.log(`  - ${varName}`);
    });
  }

  if (debugInfo.errorType) {
    console.log('\n에러 유형:', debugInfo.errorType);
  }

  if (debugInfo.recommendations.length > 0) {
    console.log('\n권장 사항:');
    debugInfo.recommendations.forEach(rec => {
      console.log(rec);
    });
  }

  console.log('\n========================================\n');
};

/**
 * Test Firebase connection
 */
export const testFirebaseConnection = (): boolean => {
  try {
    // Simple test - try to get auth instance
    const { auth } = require('../services/firebase/config');

    if (!auth) {
      console.error('Firebase Auth 초기화 실패');
      return false;
    }

    console.log('✅ Firebase 연결 성공');
    return true;
  } catch (error) {
    console.error('❌ Firebase 연결 실패:', error);
    return false;
  }
};
