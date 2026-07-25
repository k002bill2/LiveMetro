/**
 * Local Data Purge
 *
 * 계정 삭제 시 기기에 남는 개인 데이터를 파기한다. 서버 파기(deleteAccount
 * Cloud Function)가 성공한 뒤에만 호출한다.
 *
 * **키를 나열하지 않는다**: AsyncStorage는 `getAllKeys()`로 열거한 뒤
 * `@livemetro` 접두(대소문자 무시 — `@LiveMetro:` 형태의 키가 실제로
 * 존재한다)로 거르고 보존 예외만 제외한다. 새 기능이 새 키를 만들어도
 * 자동으로 파기 대상에 포함되므로, 키 추가를 잊어 개인정보가 남는
 * 클래스의 버그가 구조적으로 생기지 않는다.
 *
 * SecureStore는 열거 API가 없고 키에 공통 접두도 없어 명시 나열이
 * 불가피하다(아래 상수 주석에 정의 위치를 남긴다).
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { disableBiometricLogin } from '@/services/auth/biometricService';

/** 파기 대상 판별 접두. 소문자 비교로 `@LiveMetro:` 변형까지 포함한다. */
const PERSONAL_KEY_PREFIX = '@livemetro';

/**
 * 보존 예외 — 계정이 아니라 **기기**에 귀속되는 선호값.
 *
 * 지우면 계정 삭제 직후 앱이 시스템 기본 언어/테마로 튀어 "설정이 깨졌다"는
 * 인상을 준다. 개인 식별성이 없어 남겨도 개인정보 파기 약속과 상충하지 않는다.
 * (정의: i18n/theme 서비스)
 */
const PRESERVED_KEYS: readonly string[] = [
  '@livemetro_language',
  '@livemetro_theme',
  '@livemetro_theme_auto_switch',
  '@livemetro_accent_color',
];

/**
 * SecureStore 자격증명 키.
 *
 * 자동 로그인: AuthScreen.tsx / EmailLoginScreen.tsx / SettingsScreen.tsx에
 * 같은 문자열로 정의돼 있다(모듈 export 없음). 생체인증 자격증명은
 * biometricService가 소유하므로 `disableBiometricLogin()`에 위임한다.
 */
const SECURE_STORE_KEYS: readonly string[] = [
  'livemetro_auto_login_email',
  'livemetro_auto_login_password',
];

/** 자동 로그인 활성 플래그(AsyncStorage)는 접두 필터로 함께 지워진다. */

export interface LocalPurgeResult {
  /** 삭제한 AsyncStorage 키 개수. */
  readonly removedKeyCount: number;
  /** 하나라도 실패했는지 — 로컬 파기 실패는 계정 삭제를 되돌리지 않는다. */
  readonly hadFailure: boolean;
}

/**
 * 파기 대상 AsyncStorage 키를 고른다. 순수 함수로 분리해 테스트한다.
 *
 * @param allKeys `AsyncStorage.getAllKeys()` 결과
 */
export const selectPurgeableKeys = (allKeys: readonly string[]): readonly string[] =>
  allKeys.filter(
    (key) =>
      key.toLowerCase().startsWith(PERSONAL_KEY_PREFIX) &&
      !PRESERVED_KEYS.includes(key),
  );

/** 진단 로그는 개발 빌드에서만 — 프로덕션 콘솔에 파기 실패 흔적을 남기지 않는다. */
const logFailure = (message: string, error: unknown): void => {
  if (!__DEV__) return;
  // eslint-disable-next-line no-console
  console.error(message, error);
};

/**
 * 기기에 남은 개인 데이터를 파기한다.
 *
 * 각 단계는 독립적으로 실패를 흡수한다(throw 금지) — 서버 파기가 이미
 * 끝난 뒤라 SecureStore 한 건의 오류로 흐름을 중단하면 사용자가 삭제된
 * 계정의 자격증명을 기기에 남긴 채 멈춘다.
 */
export const purgeLocalUserData = async (): Promise<LocalPurgeResult> => {
  let hadFailure = false;
  let removedKeyCount = 0;

  try {
    const allKeys = await AsyncStorage.getAllKeys();
    const targets = selectPurgeableKeys(allKeys);
    if (targets.length > 0) {
      await AsyncStorage.multiRemove([...targets]);
    }
    removedKeyCount = targets.length;
  } catch (error) {
    hadFailure = true;
    logFailure('Local storage purge failed:', error);
  }

  for (const key of SECURE_STORE_KEYS) {
    try {
      await SecureStore.deleteItemAsync(key);
    } catch (error) {
      hadFailure = true;
      logFailure('SecureStore purge failed:', error);
    }
  }

  try {
    await disableBiometricLogin();
  } catch (error) {
    hadFailure = true;
    logFailure('Biometric credential purge failed:', error);
  }

  return { removedKeyCount, hadFailure };
};
