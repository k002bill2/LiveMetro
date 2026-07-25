/**
 * destinationPreferenceSync — CommuteRoute.boardingPreferences ↔ GuidanceSession
 * 사본 사이의 I/O 브리지. 세션 시작 직후 비동기로 선호를 붙인다(attach).
 *
 * 귀속 가드: expectedStartedAt 불일치 시 no-op — 화면이 세션 스왑을 넘겨 살아남아도
 * 옛 여정의 선호가 새 세션을 오염시키지 않는다 (updateGuidanceProgressAnchor의 H2
 * 원칙 그대로). 소유 귀속(ownerUid) 불일치도 같은 이유로 no-op — 영속 세션은
 * 로그아웃/계정 전환을 넘겨 살아남으므로 남의 세션에 이 계정의 선호를 붙이지
 * 않는다. 실패는 삼킨다 — 선호는 부가 기능이며 안내 시작을 막으면 안 된다.
 *
 * settled 마커: 세션의 `destinationPreferences`는 attach 완료 여부를 겸해 나른다 —
 * `undefined` = 미확정(원격 읽기 진행 중), `{}` = 확정·선호 없음. 그래서 이 함수는
 * 가드를 통과한 모든 종료 경로(선호 있음·빈 선호·로드 실패)에서 반드시 필드를
 * 확정한다. 소비자(탑승 알림 예약)가 미확정 창을 건너뛸 수 있어야 하기 때문이다:
 * 확정 전에 예약·발사된 알림은 사용자가 제외해 둔 종점행 열차의 것이어도 회수할
 * 수 없다(발사된 알림은 취소 불가). 실패를 확정으로 세는 건 의도된 절충 — 무기한
 * 미확정으로 알림을 영영 막는 쪽이 더 나쁘다.
 */
import { loadCommuteRoutes } from '@/services/commute/commuteService';
import {
  getGuidanceSession,
  setGuidanceSession,
} from '@/services/guidance/guidanceSessionStore';
import type { CommuteType } from '@/models/commute';

/**
 * 귀속·소유 가드를 통과한 경우에만 세션 선호를 확정(settle)한다.
 * `remote`가 undefined/빈 맵이면 로컬 사본만으로 확정된다(= `{}` 가능).
 */
const settleDestinationPreferences = (
  uid: string,
  expectedStartedAt: number,
  remote: Readonly<Record<string, readonly string[]>> | undefined
): void => {
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
    destinationPreferences: { ...remote, ...current.destinationPreferences },
  });
};

export const attachDestinationPreferences = async (
  uid: string,
  leg: CommuteType,
  expectedStartedAt: number
): Promise<void> => {
  try {
    // loadCommuteRoutes는 throw하지 않고 실패를 null로 반환한다 — 오프라인은
    // catch가 아니라 여기로 온다. 그래도 settle 경로는 동일하다(빈 확정).
    const settings = await loadCommuteRoutes(uid);
    const route = leg === 'morning' ? settings?.morningRoute : settings?.eveningRoute;
    settleDestinationPreferences(uid, expectedStartedAt, route?.boardingPreferences);
  } catch (error) {
    if (__DEV__) console.error('[destinationPreferenceSync] attach failed', error);
    settleDestinationPreferences(uid, expectedStartedAt, undefined);
  }
};
