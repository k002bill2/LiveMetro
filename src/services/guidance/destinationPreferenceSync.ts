/**
 * destinationPreferenceSync — CommuteRoute.boardingPreferences ↔ GuidanceSession
 * 사본 사이의 I/O 브리지. 세션 시작 직후 비동기로 선호를 붙인다(attach).
 *
 * 귀속 가드: expectedStartedAt 불일치 시 no-op — 화면이 세션 스왑을 넘겨 살아남아도
 * 옛 여정의 선호가 새 세션을 오염시키지 않는다 (updateGuidanceProgressAnchor의 H2
 * 원칙 그대로). 소유 귀속(ownerUid) 불일치도 같은 이유로 no-op — 영속 세션은
 * 로그아웃/계정 전환을 넘겨 살아남으므로 남의 세션에 이 계정의 선호를 붙이지
 * 않는다. 실패는 삼킨다 — 선호는 부가 기능이며 안내 시작을 막으면 안 된다.
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
    // 소유 귀속 가드 — 다른 계정이 시작한 세션에 이 계정의 선호를 붙이지 않는다
    // (영속 세션은 로그아웃/계정 전환을 넘겨 살아남는다).
    if (current.ownerUid !== uid) return;
    // 로컬 우선 병합 — 늦게 도착한 원격 사본이 사용자가 이미 고른 키를 덮어쓰지
    // 않으면서(로컬 승), 원격에만 있는 형제 구간 키는 채운다. 전량 스킵(옛 TOCTOU
    // 가드)이면 attach 전에 한 구간만 토글해도 이후 환승 구간의 저장 선호가 이
    // 세션에서 통째로 유실됐다.
    setGuidanceSession({
      ...current,
      destinationPreferences: { ...prefs, ...current.destinationPreferences },
    });
  } catch (error) {
    if (__DEV__) console.error('[destinationPreferenceSync] attach failed', error);
  }
};
