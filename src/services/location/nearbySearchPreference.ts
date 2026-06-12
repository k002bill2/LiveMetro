/**
 * Nearby Auto-Search Preference
 * "자동 주변 역 검색" 설정 (위치 권한 화면 세부 설정 토글).
 *
 * Device-local AsyncStorage 저장 + in-memory 캐시 + 구독.
 * off면 useNearbyStations가 위치 기반 자동 검색을 중단한다
 * (수동 새로고침은 허용 — 명시적 사용자 액션).
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = '@livemetro:nearby_auto_search';
const DEFAULT_ENABLED = true;

type Listener = (enabled: boolean) => void;

let cached: boolean | null = null;
const listeners = new Set<Listener>();

/** 현재 설정값 (미저장 시 기본 true, 스토리지 오류 시 기본값 폴백) */
export const getNearbyAutoSearchEnabled = async (): Promise<boolean> => {
  if (cached !== null) {
    return cached;
  }
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    cached = raw === null ? DEFAULT_ENABLED : raw === 'true';
  } catch (error) {
    if (__DEV__) {
      // eslint-disable-next-line no-console
      console.error('[nearbySearchPreference] read failed:', error);
    }
    cached = DEFAULT_ENABLED;
  }
  return cached;
};

/** 설정 변경 — 구독자에게 즉시 통지 후 비동기 저장 */
export const setNearbyAutoSearchEnabled = async (enabled: boolean): Promise<void> => {
  cached = enabled;
  listeners.forEach((listener) => listener(enabled));
  try {
    await AsyncStorage.setItem(STORAGE_KEY, String(enabled));
  } catch (error) {
    if (__DEV__) {
      // eslint-disable-next-line no-console
      console.error('[nearbySearchPreference] write failed:', error);
    }
  }
};

/** 설정 변경 구독 — cleanup 함수 반환 (useEffect에서 해제 필수) */
export const subscribeNearbyAutoSearch = (listener: Listener): (() => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

/** 테스트 전용 — 모듈 캐시/구독자 초기화 */
export const __resetNearbySearchPreferenceForTests = (): void => {
  cached = null;
  listeners.clear();
};
