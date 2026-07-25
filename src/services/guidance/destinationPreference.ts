/**
 * destinationPreference — 대기 구간 종점행 표시·선택의 순수 계층.
 *
 * "종점행 선호"는 역의 속성이 아니라 여정의 속성이다(분기 이전 하차 = 복수 종점 유효).
 * 그래서 목적지가 고정된 CommuteRoute에 `boardingPreferences`로 귀속되고, 세션은
 * 사본(`destinationPreferences`)만 든다. 이 모듈은 그 도메인의 키잉·필터·옵션 도출·
 * prune만 담당한다 — I/O 없음, RN 없음 (departureDetection.ts와 같은 급).
 */
import type { CommuteRoute } from '@/models/commute';
import type { Train } from '@/models/train';
import { resolveInternalStationId } from '@/utils/stationIdResolver';

/** 탑승 구간 식별 키. board = stationId|lineId, transfer = stationId|toLineId. */
export const buildBoardingKey = (stationId: string, lineId: string): string =>
  `${stationId}|${lineId}`;

export interface WaitingTrainPools {
  /** 진행 방향 전체 — 보조 나열·시트 옵션 베이스 (선호 필터와 무관). */
  readonly display: readonly Train[];
  /** 추적 대상 — 칩 카운트다운·알림·출발 감지 베이스. 선호 선택 시 0대 가능. */
  readonly tracked: readonly Train[];
}

const isNumberedLine = (lineId: string): boolean => /^[1-9]$/.test(lineId);

/**
 * RouteGuidanceScreen의 기존 방면 필터(matched-else-onLine 폴백)를 보존하면서
 * display/tracked 2-풀로 확장한다. `preferredDestinations`가 비어 있으면 tracked는
 * 기존 filteredTrains와 동일해야 한다 (회귀 0 계약 — 테스트로 고정).
 */
export const partitionWaitingTrains = (input: {
  readonly trains: readonly Train[];
  readonly lineId: string;
  readonly directionName: string | null;
  readonly preferredDestinations: readonly string[];
}): WaitingTrainPools => {
  const { trains, lineId, directionName, preferredDestinations } = input;
  const onLine = isNumberedLine(lineId) ? trains.filter(t => t.lineId === lineId) : trains;
  const matched =
    directionName === null ? [] : onLine.filter(t => t.finalDestination === directionName);
  // 기존 동작: 방면 매칭 우선, 전무하면 노선 필터 결과 폴백 (단축 운행 종착역 케이스).
  const legacy = matched.length > 0 ? matched : onLine;
  // 물리 방향 anchor — 방면 매칭 열차의 up/down으로 같은 방향 전체를 얻는다.
  // 매칭이 없으면 anchor 불능 → display도 legacy로 강등 (보수적).
  const anchorDirection = matched[0]?.direction;
  const display =
    anchorDirection !== undefined ? onLine.filter(t => t.direction === anchorDirection) : legacy;
  const tracked =
    preferredDestinations.length > 0
      ? display.filter(t => preferredDestinations.includes(t.finalDestination))
      : legacy;
  return { display, tracked };
};

export interface DestinationOption {
  readonly name: string;
  /** 가장 이른 도착 ETA ("N분" | "곧 도착"), 현재 도착 창에 없으면 null. */
  readonly etaText: string | null;
}

const etaTextOf = (train: Train, nowMs: number): string | null => {
  if (train.arrivalTime === null) return null;
  const sec = Math.floor((train.arrivalTime.getTime() - nowMs) / 1000);
  if (sec < 0) return null;
  return sec < 60 ? '곧 도착' : `${Math.floor(sec / 60)}분`;
};

/**
 * 시트 옵션 목록 — display의 distinct 종착역(미래 최초 도착 순) ∪ 저장돼 있으나 현재
 * 도착 창에 없는 선호(etaText null, 뒤에 배치 — 체크 해제 가능해야 하므로 노출 유지).
 */
export const destinationOptions = (
  display: readonly Train[],
  preferred: readonly string[],
  nowMs: number
): readonly DestinationOption[] => {
  const byName = new Map<string, { readonly ms: number; readonly etaText: string | null }>();
  for (const t of display) {
    const arrivalMs = t.arrivalTime?.getTime() ?? null;
    // 대표 열차 선택은 "미래 도착"만 값으로 친다. arrivalTime은 fetch 시점 barvlDt 파생값이라
    // 폴링 30초 · 표시 1Hz 사이에 ETA만 과거로 흘러간 스테일 열차가 스냅샷에 남는다. 그 열차가
    // 최솟값을 이기면 2분 뒤 같은 종착역 열차가 있는데도 "ETA 없음"으로 맨 앞에 뜬다.
    const effectiveMs =
      arrivalMs === null || arrivalMs < nowMs ? Number.MAX_SAFE_INTEGER : arrivalMs;
    const existing = byName.get(t.finalDestination);
    if (existing === undefined || effectiveMs < existing.ms) {
      byName.set(t.finalDestination, { ms: effectiveMs, etaText: etaTextOf(t, nowMs) });
    }
  }
  const present = [...byName.entries()]
    .sort((a, b) => a[1].ms - b[1].ms)
    .map(([name, v]): DestinationOption => ({ name, etaText: v.etaText }));
  const absent = preferred
    .filter(name => !byName.has(name))
    .map((name): DestinationOption => ({ name, etaText: null }));
  return [...present, ...absent];
};

/**
 * 두 ID 우주를 공통 도메인(내부 슬러그)으로 모은다. 키 생산자(길안내)는
 * `selectCommuteRoute`의 슬러그('gangnam')를, CommuteRoute의 stationId는 온보딩이
 * 저장한 Seoul station_cd('0222')를 쓴다 — 비교차 도메인이라(onboarding
 * CommuteRouteScreen 참조) 정규화 없이 비교하면 prune이 전량 드롭으로 퇴화한다.
 * 슬러그는 pass-through, station_cd는 슬러그로, 미상 ID는 원문 유지(보수적).
 */
export const normalizeStationId = (id: string): string => resolveInternalStationId(id) ?? id;

/**
 * 저장 직전 prune — 경로에 존재하는 역(출발+환승)의 키만 유지한다. lineId 부분은
 * 검사하지 않는다(역 단위 prune): 노선만 바뀐 스테일 키는 조회에서 자연 미적용되고,
 * 역이 경로에 있는 한 크기가 유계라 단순함을 택했다. 빈 배열 값도 제거.
 *
 * 비교만 정규화하고 키는 원문 그대로 남긴다 — 조회 경로가 정확 키 매칭
 * (`destinationPreferences[boardingKey]`)이라 키를 바꾸면 선호가 유실된다.
 */
export const pruneBoardingPreferences = (
  prefs: Readonly<Record<string, readonly string[]>>,
  route: CommuteRoute
): Readonly<Record<string, readonly string[]>> => {
  const validStations = new Set<string>(
    [route.departureStationId, ...route.transferStations.map(t => t.stationId)].map(
      normalizeStationId
    )
  );
  return Object.fromEntries(
    Object.entries(prefs).filter(
      ([key, value]) =>
        value.length > 0 && validStations.has(normalizeStationId(key.split('|')[0] ?? ''))
    )
  );
};
