/**
 * Local Data Purge
 *
 * 계정 삭제 시 기기에 남는 개인 데이터를 파기한다. 서버 파기(deleteAccount
 * Cloud Function)가 성공한 뒤에만 호출한다.
 *
 * **파기 대상을 나열하지 않는다**: AsyncStorage는 `getAllKeys()`로 열거한 뒤
 * `@livemetro` 접두(대소문자 무시 — `@LiveMetro:` 형태의 키가 실제로
 * 존재한다)로 거르고 보존 쪽만 나열한다. 새 기능이 새 키를 만들어도
 * 자동으로 파기 대상에 포함되므로, 키 추가를 잊어 개인정보가 남는
 * 클래스의 버그가 구조적으로 생기지 않는다. 보존 쪽 목록(기기 선호, 다른
 * 계정의 계정별 키)은 빠뜨려도 **과삭제**로 끝날 뿐 잔존은 생기지 않는다.
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
  // 접근성·음성 설정도 같은 범주다(글자 크기, 모션 감소, 발화 속도 등).
  // 식별성이 없고, 지우면 계정 삭제가 사용자의 접근성 구성을 초기화해
  // 그 설정에 의존하는 사용자에게 실질적 불이익이 된다.
  '@livemetro:accessibility_settings', // AccessibilityContext.tsx:69, accessibilityService.ts:39
  '@livemetro:tts_settings', // ttsService.ts:98
];

/**
 * uid를 뒤에 붙여 만드는 계정별 키의 접두(정의: OnboardingContext.tsx,
 * commuteReminderService.ts).
 *
 * 같은 기기의 **다른 계정**은 탈퇴하지 않았으므로 그 계정의 키는 남긴다 —
 * 지우면 그 계정으로 재로그인할 때 온보딩이 다시 뜨고 출퇴근 리마인더가
 * 사라진다. 나머지 기기 공용 키는 어느 계정 것인지 알 수 없어 계속 파기한다.
 */
const ACCOUNT_SCOPED_KEY_PREFIXES: readonly string[] = [
  '@livemetro/onboarding_complete_',
  '@livemetro/signup_celebration_seen_',
  '@livemetro/signup_terms_agreed_',
  '@livemetro_commute_reminders:',
];

/**
 * 삭제한 계정이 아닌 **다른 계정**의 계정별 키인가.
 *
 * uid는 정확 일치로 비교한다 — `kakao:12`와 `kakao:123`처럼 접두가 겹치는
 * uid가 있고, `commute_reminders:` 키의 uid에는 콜론이 들어간다.
 */
const isOtherAccountScopedKey = (key: string, deletedUid: string): boolean =>
  ACCOUNT_SCOPED_KEY_PREFIXES.some((prefix) => {
    if (!key.startsWith(prefix)) return false;
    const ownerUid = key.slice(prefix.length);
    return ownerUid.length > 0 && ownerUid !== deletedUid;
  });

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
 * @param deletedUid 삭제한 계정의 uid. 모르면(null) 계정별 키도 전부 파기한다.
 */
export const selectPurgeableKeys = (
  allKeys: readonly string[],
  deletedUid: string | null = null,
): readonly string[] =>
  allKeys.filter(
    (key) =>
      key.toLowerCase().startsWith(PERSONAL_KEY_PREFIX) &&
      !PRESERVED_KEYS.includes(key) &&
      !(deletedUid !== null && isOtherAccountScopedKey(key, deletedUid)),
  );

/** 진단 로그는 개발 빌드에서만 — 프로덕션 콘솔에 파기 실패 흔적을 남기지 않는다. */
const logFailure = (message: string, error?: unknown): void => {
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
export const purgeLocalUserData = async (
  deletedUid: string | null = null,
): Promise<LocalPurgeResult> => {
  let hadFailure = false;
  let removedKeyCount = 0;

  // SecureStore 자격증명을 먼저 파기한다. `disableBiometricLogin()`이
  // `@livemetro_biometric_enabled`를 'false'로 **다시 쓰기** 때문에,
  // AsyncStorage 스윕보다 뒤에 두면 방금 지운 키가 되살아난다.
  for (const key of SECURE_STORE_KEYS) {
    try {
      await SecureStore.deleteItemAsync(key);
    } catch (error) {
      hadFailure = true;
      logFailure('SecureStore purge failed:', error);
    }
  }

  // 이 함수는 내부에서 예외를 흡수하고 boolean을 반환한다(throw 하지 않는다).
  // try/catch만 두면 실패가 조용히 성공으로 보고돼 삭제된 계정의 생체인증
  // 자격증명이 기기에 남는다 — 반환값을 반드시 확인한다.
  try {
    if (!(await disableBiometricLogin())) {
      hadFailure = true;
      logFailure('Biometric credential purge returned false');
    }
  } catch (error) {
    hadFailure = true;
    logFailure('Biometric credential purge failed:', error);
  }

  try {
    const allKeys = await AsyncStorage.getAllKeys();
    const targets = selectPurgeableKeys(allKeys, deletedUid);
    if (targets.length > 0) {
      await AsyncStorage.multiRemove([...targets]);
    }
    removedKeyCount = targets.length;
  } catch (error) {
    hadFailure = true;
    logFailure('Local storage purge failed:', error);
  }

  return { removedKeyCount, hadFailure };
};
