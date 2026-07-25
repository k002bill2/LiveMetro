/**
 * localDataPurge tests.
 *
 * 핵심 검증: 접두 필터가 (1) 대소문자 변형 키까지 잡고, (2) 기기 선호는
 * 보존하며, (3) 개별 저장소 실패를 흡수해 throw 하지 않는다는 것.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';

import {
  purgeLocalUserData,
  selectPurgeableKeys,
} from '@/services/account/localDataPurge';

const mockDisableBiometricLogin = jest.fn();

jest.mock('@/services/auth/biometricService', () => ({
  __esModule: true,
  disableBiometricLogin: (...args: unknown[]) => mockDisableBiometricLogin(...args),
}));

const ALL_KEYS: readonly string[] = [
  // 개인 데이터 — 파기 대상
  '@livemetro/pending_commute_completion',
  '@livemetro/guidance_session',
  '@livemetro/guidance_background_location',
  '@livemetro:nearby_auto_search',
  '@LiveMetro:currentStationAlertConfig',
  '@LiveMetro:stationNotificationHistory',
  '@livemetro:topic_subscriptions',
  '@livemetro:notifications',
  '@livemetro:user_trust_profiles',
  '@livemetro:advanced_patterns',
  '@livemetro:feedback_data',
  '@livemetro:fraud_profiles',
  '@livemetro:congestion_history',
  '@livemetro:statistics_cache',
  '@livemetro_last_location',
  '@livemetro_auto_login_enabled',
  '@livemetro_user_preferences',
  // 기기 선호 — 보존 대상
  '@livemetro_language',
  '@livemetro_theme',
  '@livemetro_theme_auto_switch',
  '@livemetro_accent_color',
  '@livemetro:accessibility_settings',
  '@livemetro:tts_settings',
  // 타 앱/무관 키 — 대상 아님
  'some_other_app_key',
  'firebase:authUser:xyz',
];

describe('selectPurgeableKeys', () => {
  it('기기 선호(언어·테마·강조색)는 보존한다', () => {
    const selected = selectPurgeableKeys(ALL_KEYS);

    expect(selected).not.toContain('@livemetro_language');
    expect(selected).not.toContain('@livemetro_theme');
    expect(selected).not.toContain('@livemetro_theme_auto_switch');
    expect(selected).not.toContain('@livemetro_accent_color');
  });

  // 접근성 구성은 식별성이 없고, 지우면 그 설정에 의존하는 사용자에게
  // 실질적 불이익이 된다(글자 크기·모션 감소·발화 속도).
  it('접근성·음성 설정도 보존한다', () => {
    const selected = selectPurgeableKeys(ALL_KEYS);

    expect(selected).not.toContain('@livemetro:accessibility_settings');
    expect(selected).not.toContain('@livemetro:tts_settings');
  });

  it('대문자 변형 접두(@LiveMetro:)도 파기 대상에 포함한다', () => {
    const selected = selectPurgeableKeys(ALL_KEYS);

    expect(selected).toContain('@LiveMetro:currentStationAlertConfig');
    expect(selected).toContain('@LiveMetro:stationNotificationHistory');
  });

  it('앱 접두가 아닌 키는 건드리지 않는다', () => {
    const selected = selectPurgeableKeys(ALL_KEYS);

    expect(selected).not.toContain('some_other_app_key');
    expect(selected).not.toContain('firebase:authUser:xyz');
  });

  it('길안내·위치·알림 등 개인 데이터 키를 전부 선택한다', () => {
    const selected = selectPurgeableKeys(ALL_KEYS);

    expect(selected).toEqual(
      expect.arrayContaining([
        '@livemetro/pending_commute_completion',
        '@livemetro/guidance_session',
        '@livemetro/guidance_background_location',
        '@livemetro:nearby_auto_search',
        '@livemetro:topic_subscriptions',
        '@livemetro:notifications',
        '@livemetro:user_trust_profiles',
        '@livemetro:advanced_patterns',
        '@livemetro:feedback_data',
        '@livemetro:fraud_profiles',
        '@livemetro:congestion_history',
        '@livemetro:statistics_cache',
        '@livemetro_last_location',
        '@livemetro_auto_login_enabled',
        '@livemetro_user_preferences',
      ]),
    );
    expect(selected).toHaveLength(ALL_KEYS.length - 8);
  });

  it('새로 추가된 접두 키는 나열 없이도 자동 포함된다', () => {
    const selected = selectPurgeableKeys(['@livemetro:brand_new_feature_state']);

    expect(selected).toEqual(['@livemetro:brand_new_feature_state']);
  });

  it('빈 목록은 빈 결과를 낸다', () => {
    expect(selectPurgeableKeys([])).toEqual([]);
  });
});

describe('purgeLocalUserData', () => {
  let getAllKeysSpy: jest.SpyInstance;
  let multiRemoveSpy: jest.SpyInstance;
  let deleteItemSpy: jest.SpyInstance;
  let errorSpy: jest.SpyInstance;

  beforeEach(() => {
    getAllKeysSpy = jest
      .spyOn(AsyncStorage, 'getAllKeys')
      .mockResolvedValue([...ALL_KEYS]);
    multiRemoveSpy = jest.spyOn(AsyncStorage, 'multiRemove').mockResolvedValue();
    deleteItemSpy = jest
      .spyOn(SecureStore, 'deleteItemAsync')
      .mockResolvedValue(undefined);
    errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    mockDisableBiometricLogin.mockResolvedValue(true);
  });

  afterEach(() => {
    // spy는 mockRestore 대신 자연 복귀 — AsyncStorage mock store가 초기화되면
    // 다른 스위트가 연쇄 실패한다(feedback_asyncstorage_spy_mockrestore).
    getAllKeysSpy.mockReset();
    multiRemoveSpy.mockReset();
    deleteItemSpy.mockReset();
    errorSpy.mockRestore();
    mockDisableBiometricLogin.mockReset();
  });

  it('보존 예외를 제외한 접두 키만 일괄 삭제한다', async () => {
    const result = await purgeLocalUserData();

    expect(multiRemoveSpy).toHaveBeenCalledTimes(1);
    const removed = multiRemoveSpy.mock.calls[0]![0] as string[];
    expect(removed).toContain('@LiveMetro:currentStationAlertConfig');
    expect(removed).not.toContain('@livemetro_language');
    expect(removed).not.toContain('some_other_app_key');
    expect(result.removedKeyCount).toBe(removed.length);
    expect(result.hadFailure).toBe(false);
  });

  it('자동 로그인 자격증명(SecureStore)을 이메일·비밀번호 모두 지운다', async () => {
    await purgeLocalUserData();

    expect(deleteItemSpy).toHaveBeenCalledWith('livemetro_auto_login_email');
    expect(deleteItemSpy).toHaveBeenCalledWith('livemetro_auto_login_password');
  });

  it('생체인증 자격증명 파기는 소유 서비스에 위임한다', async () => {
    await purgeLocalUserData();

    expect(mockDisableBiometricLogin).toHaveBeenCalledTimes(1);
  });

  it('지울 키가 없으면 multiRemove를 호출하지 않는다', async () => {
    getAllKeysSpy.mockResolvedValue(['some_other_app_key']);

    const result = await purgeLocalUserData();

    expect(multiRemoveSpy).not.toHaveBeenCalled();
    expect(result.removedKeyCount).toBe(0);
    expect(result.hadFailure).toBe(false);
  });

  it('AsyncStorage 실패를 흡수하고 SecureStore 정리는 계속한다', async () => {
    getAllKeysSpy.mockRejectedValue(new Error('storage unavailable'));

    const result = await purgeLocalUserData();

    expect(result.hadFailure).toBe(true);
    expect(deleteItemSpy).toHaveBeenCalledTimes(2);
    expect(mockDisableBiometricLogin).toHaveBeenCalledTimes(1);
  });

  it('SecureStore 실패도 흡수하고 throw 하지 않는다', async () => {
    deleteItemSpy.mockRejectedValue(new Error('keychain locked'));

    const result = await purgeLocalUserData();

    expect(result.hadFailure).toBe(true);
    expect(mockDisableBiometricLogin).toHaveBeenCalledTimes(1);
  });

  it('생체인증 해제 실패도 흡수한다', async () => {
    mockDisableBiometricLogin.mockRejectedValue(new Error('biometric error'));

    const result = await purgeLocalUserData();

    expect(result.hadFailure).toBe(true);
  });

  // disableBiometricLogin은 내부에서 예외를 흡수하고 false를 반환한다
  // (throw 하지 않는다) — 반환값을 무시하면 자격증명이 남은 채 성공으로
  // 보고된다. 실제 실패 모드는 reject가 아니라 이쪽이다.
  it('생체인증 해제가 false를 반환하면 실패로 기록한다', async () => {
    mockDisableBiometricLogin.mockResolvedValue(false);

    const result = await purgeLocalUserData();

    expect(result.hadFailure).toBe(true);
  });

  // disableBiometricLogin이 '@livemetro_biometric_enabled'를 다시 쓰므로
  // AsyncStorage 스윕보다 반드시 먼저 실행돼야 한다(안 그러면 부활한다).
  it('생체인증 해제를 AsyncStorage 스윕보다 먼저 수행한다', async () => {
    await purgeLocalUserData();

    const biometricOrder = mockDisableBiometricLogin.mock.invocationCallOrder[0]!;
    const sweepOrder = multiRemoveSpy.mock.invocationCallOrder[0]!;
    expect(biometricOrder).toBeLessThan(sweepOrder);
  });
});
