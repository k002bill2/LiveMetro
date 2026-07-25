/**
 * destinationPreferenceSync — CommuteRoute.boardingPreferences ↔ GuidanceSession
 * 사본 사이의 I/O 브리지. 세션 시작 직후 비동기로 선호를 붙인다(attach).
 *
 * 귀속 가드: expectedStartedAt 불일치 시 no-op — 화면이 세션 스왑을 넘겨 살아남아도
 * 옛 여정의 선호가 새 세션을 오염시키지 않는다 (updateGuidanceProgressAnchor의 H2
 * 원칙 그대로). 실패는 삼킨다 — 선호는 부가 기능이며 안내 시작을 막으면 안 된다.
 */
import { loadCommuteRoutes } from '@/services/commute/commuteService';
import {
  getGuidanceSession,
  setGuidanceSession,
} from '@/services/guidance/guidanceSessionStore';
import type { CommuteType } from '@/models/commute';

export const attachDestinationPreferences = async (
  uid: string,
  leg: CommuteType,
  expectedStartedAt: number
): Promise<void> => {
  try {
    const settings = await loadCommuteRoutes(uid);
    const route = leg === 'morning' ? settings?.morningRoute : settings?.eveningRoute;
    const prefs = route?.boardingPreferences;
    if (!prefs || Object.keys(prefs).length === 0) return;
    const current = getGuidanceSession();
    if (current === null || current.startedAt !== expectedStartedAt) return;
    // 세션에 이미 선호가 있으면(사용자 시트 선택 등) 늦게 도착한 원격 사본이 덮어쓰지 않는다 (TOCTOU 가드).
    if (current.destinationPreferences !== undefined) return;
    setGuidanceSession({ ...current, destinationPreferences: prefs });
  } catch (error) {
    if (__DEV__) console.error('[destinationPreferenceSync] attach failed', error);
  }
};
