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
 *
 * 경로 지문(sourceRouteVerified): 세션의 출퇴근 OD는 profile store와 commuteSettings
 * 문서 두 곳에서 올 수 있는데 attach/write-back의 대상은 언제나 commuteSettings의
 * `<leg>Route`다. 두 사본이 발산하면 다른 경로의 선호가 이 세션에 붙고, 토글이 무관한
 * 경로에 영속된다. 그래서 로드 성공 시 **세션 경로의 OD와 로드된 경로의 OD를 대조**해
 * 일치할 때만 선호를 붙이고 `sourceRouteVerified`를 세운다(= write-back 허용). 불일치·
 * 로드 실패는 fail-closed: 빈 확정만 하고 미검증으로 남긴다 — 알림 게이트는 열리되
 * 원격 쓰기는 막힌다(선호는 세션 한정으로 강등).
 *
 * 접촉 키(touchedBoardingKeys): 병합은 로컬 우선이지만, 사용자가 attach 진행 중에
 * 어떤 구간을 **해제**하면 그 키는 로컬 맵에 없다 — 스프레드만으로는 "삭제"와
 * "미접촉"이 같은 모양이라 in-flight 원격 값이 방금 지운 필터를 되살린다. 그래서
 * 세션이 든 접촉 이력의 키는 원격 사본에서 먼저 걷어낸 뒤 병합한다.
 */
import { loadCommuteRoutes } from '@/services/commute/commuteService';
import { normalizeStationId } from '@/services/guidance/destinationPreference';
import {
  getGuidanceSession,
  setGuidanceSession,
} from '@/services/guidance/guidanceSessionStore';
import { routeToGuidanceSteps } from '@/services/guidance/guidanceSteps';
import type { CommuteRoute, CommuteType } from '@/models/commute';
import type { GuidanceSession } from '@/models/guidance';

/**
 * 빈 문자열·필드 부재(팬텀 route — commuteService의 leg 존재 게이트 주석 참조)를
 * null로 접는다. 두 ID 우주(내부 슬러그 / Seoul station_cd)는 비교차이므로 비교 전
 * 양쪽 모두 정규화한다.
 */
const normalizedOrNull = (id: string | undefined): string | null =>
  typeof id === 'string' && id.length > 0 ? normalizeStationId(id) : null;

/**
 * 경로 지문 대조 — 세션 경로의 OD(탑승역·하차역)가 로드된 leg 경로의 OD와 같은가.
 *
 * 환승역은 **의도적으로 대조하지 않는다**: 저장된 `transferStations`는 설계상
 * 불신 대상이라(CommuteSettingsScreen의 `resolveTransferNames` — 레거시·자동 저장
 * 문서는 이 필드를 비워 두는 일이 흔해 파생 스텝을 우선한다) 포함하면 같은 leg인데도
 * 상시 불일치로 판정돼 write-back이 통째로 죽는다. OD만으로도 P1(다른 경로에 바인딩)은
 * 잡히고, 경유만 다른 발산은 무해하다 — 선호 키·prune 모두 역 단위이기 때문.
 *
 * 스텝이 도출되지 않는 세션(빈/기형 경로)은 불일치로 친다 — 공집합 대조는 검증이 아니다.
 */
const matchesSourceRoute = (session: GuidanceSession, route: CommuteRoute): boolean => {
  const steps = routeToGuidanceSteps(session.route);
  const board = steps.find(step => step.kind === 'board');
  const alight = steps.find(step => step.kind === 'alight');
  if (board === undefined || alight === undefined) return false;
  const departure = normalizedOrNull(route.departureStationId);
  const arrival = normalizedOrNull(route.arrivalStationId);
  if (departure === null || arrival === null) return false;
  return (
    normalizedOrNull(board.stationId) === departure &&
    normalizedOrNull(alight.stationId) === arrival
  );
};

/**
 * 귀속·소유 가드를 통과한 경우에만 세션 선호를 확정(settle)한다.
 * `route`가 없거나 지문이 불일치하면 로컬 사본만으로 확정된다(= `{}` 가능).
 */
const settleDestinationPreferences = (
  uid: string,
  expectedStartedAt: number,
  route: CommuteRoute | null | undefined
): void => {
  const current = getGuidanceSession();
  if (current === null || current.startedAt !== expectedStartedAt) return;
  // 소유 귀속 가드 — 다른 계정이 시작한 세션에 이 계정의 선호를 붙이지 않는다
  // (영속 세션은 로그아웃/계정 전환을 넘겨 살아남는다).
  if (current.ownerUid !== uid) return;
  // 경로 지문 가드 — 다른 경로의 선호를 붙이지 않는다(불일치 시 remote 전량 제외).
  const verified = route != null && matchesSourceRoute(current, route) ? route : null;
  // 접촉 키 제외 — 사용자가 이 세션에서 **해제한** 구간은 로컬 맵에 키가 없어
  // 스프레드 병합만으로는 "삭제"와 "미접촉"이 구분되지 않는다. 그대로 두면
  // in-flight 원격 값이 방금 지운 필터를 부활시킨다(사용자 의도 역전).
  const touched = new Set(current.touchedBoardingKeys ?? []);
  const remoteFiltered = Object.fromEntries(
    Object.entries(verified?.boardingPreferences ?? {}).filter(([key]) => !touched.has(key))
  );
  // 로컬 우선 병합 — 늦게 도착한 원격 사본이 사용자가 이미 고른 키를 덮어쓰지
  // 않으면서(로컬 승), 원격에만 있는 형제 구간 키는 채운다. 전량 스킵(옛 TOCTOU
  // 가드)이면 attach 전에 한 구간만 토글해도 이후 환승 구간의 저장 선호가 이
  // 세션에서 통째로 유실됐다.
  setGuidanceSession({
    ...current,
    destinationPreferences: { ...remoteFiltered, ...current.destinationPreferences },
    ...(verified !== null && { sourceRouteVerified: true as const }),
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
    settleDestinationPreferences(uid, expectedStartedAt, route);
  } catch (error) {
    if (__DEV__) console.error('[destinationPreferenceSync] attach failed', error);
    settleDestinationPreferences(uid, expectedStartedAt, undefined);
  }
};
