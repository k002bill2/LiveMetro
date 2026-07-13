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
  /** 진행 anchor — 마지막 사용자 확인/보정 시점의 스텝 위치. 재마운트·앱 재시작 복원용. */
  readonly progressAnchor?: {
    readonly stepIndex: number;
    readonly atMs: number;
  };
}
