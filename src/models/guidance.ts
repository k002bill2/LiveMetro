/**
 * Guidance domain models — the step sequence a rider follows while the
 * live navigation (실시간 길안내) screen tracks an in-progress journey.
 *
 * A {@link Route} is a flat list of per-hop segments; guidance re-shapes it
 * into actionable steps: board → ride → (transfer → ride)* → alight.
 * Ride steps keep their per-hop breakdown so the NOW card can count down to
 * the next stop instead of only knowing the leg total.
 */
import type { Route } from '@/models/route';

/** One inter-station hop inside a ride step. */
export interface GuidanceHop {
  readonly toStationId: string;
  readonly toStationName: string;
  readonly minutes: number;
}

interface GuidanceStepBase {
  /** Stable per-journey id (`${kind}-${stepIndex}`) for list keys. */
  readonly id: string;
}

/** Waiting on the platform for the first train. Duration unknown (realtime). */
export interface BoardStep extends GuidanceStepBase {
  readonly kind: 'board';
  readonly stationId: string;
  readonly stationName: string;
  readonly lineId: string;
  readonly lineName: string;
  /** Endpoint station name in the direction of travel ("OO 방면"), or null. */
  readonly direction: string | null;
  readonly durationMinutes: 0;
}

/** Riding a train across one or more hops on the same line. */
export interface RideStep extends GuidanceStepBase {
  readonly kind: 'ride';
  readonly lineId: string;
  readonly lineName: string;
  readonly fromStationId: string;
  readonly fromStationName: string;
  readonly toStationId: string;
  readonly toStationName: string;
  /** Ordered hops; the last hop's toStation is where the rider gets off. */
  readonly hops: readonly GuidanceHop[];
  readonly direction: string | null;
  /** Sum of hop minutes. */
  readonly durationMinutes: number;
}

/** Walking between platforms at a transfer station, then boarding. */
export interface TransferStep extends GuidanceStepBase {
  readonly kind: 'transfer';
  readonly stationId: string;
  readonly stationName: string;
  readonly fromLineId: string;
  readonly toLineId: string;
  readonly toLineName: string;
  readonly direction: string | null;
  /** Transfer walk minutes (from the route's transfer segment). */
  readonly durationMinutes: number;
}

/** Arrived at the destination station. Terminal step. */
export interface AlightStep extends GuidanceStepBase {
  readonly kind: 'alight';
  readonly stationId: string;
  readonly stationName: string;
  readonly lineId: string;
  readonly durationMinutes: 0;
}

export type GuidanceStep = BoardStep | RideStep | TransferStep | AlightStep;

/**
 * Ephemeral handoff from the route-search CTA to the guidance screen.
 * Held in `guidanceSessionStore` (not navigation params) — see store docs.
 */
export interface GuidanceSession {
  readonly route: Route;
  readonly fromStationName: string;
  readonly toStationName: string;
  /** Epoch ms when the user tapped "이 경로로 길안내 시작". */
  readonly startedAt: number;
  /** Firestore commute log id created for this active guidance session. */
  readonly commuteLogId?: string;
  /** Epoch ms when the destination arrival was persisted to the commute log. */
  readonly commuteLogCompletedAt?: number;
  /**
   * Epoch ms when the rider reached the destination LOCALLY (isAtEnd), independent
   * of the remote commute-log write. Persisted so an offline/logged-out arrival
   * isn't reverted by a mid-TTL restart (which would otherwise restore the session
   * as active and restart background tracking). A locally-completed session is
   * treated as inactive for tracking/alerts/banner/wake-lock (W1).
   */
  readonly localCompletedAt?: number;
  /** 진행 anchor — 마지막 사용자 확인/보정 시점의 스텝 위치. 재마운트·앱 재시작 복원용. */
  readonly progressAnchor?: {
    readonly stepIndex: number;
    readonly atMs: number;
  };
  /** 대기 구간별 선호 종점행 세션 사본 — 키잉은 CommuteRoute.boardingPreferences와 동일.
   *  시트에서 변경 시 즉시 갱신되고, 출퇴근 세션이면 원본에도 write-back된다. */
  readonly destinationPreferences?: Readonly<Record<string, readonly string[]>>;
  /** 이 세션의 출처 출퇴근 leg. 부재 = 일반 경로 검색 세션 (선택은 세션 한정). */
  readonly sourceCommuteType?: 'morning' | 'evening';
  /**
   * 소유 귀속 — 이 세션을 시작한 계정의 uid. 세션은 AsyncStorage로 영속돼
   * 로그아웃·계정 전환을 넘겨 살아남으므로, 원본(CommuteRoute)으로의
   * write-back은 **생성 계정에만** 허용한다. 부재(구세션·비로그인)면 게이트
   * 불통과 = 선호가 세션 한정으로 안전 강등된다 (하위 호환).
   */
  readonly ownerUid?: string;
  /**
   * attach가 **로드된 commuteSettings leg 경로와 이 세션 경로의 지문 일치**를 확인했을
   * 때만 설정된다 (write-back 허용 조건). 출퇴근 OD는 두 저장소(profile store의
   * `preferences.commuteSchedule` / commuteSettings 문서)에서 올 수 있어 발산이
   * 실재하므로(PR #292 transferStations 이중 SSOT 전례), 확인 없이 토글을
   * `<leg>Route`에 쓰면 무관한 경로에 선호가 영속된다. 부재 = 미확인(불일치·로드
   * 실패·비출퇴근 세션) = 세션 한정 적용으로 안전 강등.
   */
  readonly sourceRouteVerified?: true;
  /**
   * 이 세션에서 사용자가 토글/해제한 구간 키 — attach 병합에서 원격 값을 제외할
   * 대상. 로컬 맵은 "해제(키 삭제)"와 "미접촉"을 구분하지 못해, in-flight 원격
   * 사본이 방금 지운 필터를 부활시킬 수 있다.
   */
  readonly touchedBoardingKeys?: readonly string[];
}
