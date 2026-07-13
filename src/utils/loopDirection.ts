/**
 * loopDirection — derive 내선(up)/외선(down) travel direction on Line 2's
 * circular trunk from an origin→destination station pair.
 *
 * Line 2 is the only Seoul line whose trunk is a closed loop, so the linear
 * `fromStationId < toStationId` ordering used by `deriveDirection`
 * (@/models/pattern) cannot express its direction. This walks the canonical
 * trunk order and picks whichever way around the ring is shorter.
 *
 * SoT: `LINE_STATIONS['2'][0]` — the same source `directionOptions.ts` uses.
 * That trunk array is sorted 내선순환(시계방향) with the two ends (시청 ↔
 * 충정로) wrapping. Subarrays 1/2 are the 성수/신정 지선 shuttles, which run
 * 상행/하행 — a station present only on a 지선 is not on the trunk and yields
 * `undefined` (no 내/외선 direction defined for it).
 */

import { LINE_STATIONS } from '@utils/subwayMapData';
import type { Direction } from '@/models/route';

const LOOP_LINE_ID = '2';

/**
 * @param lineId         Trunk line id (only `'2'` is a loop; anything else → undefined)
 * @param fromStationId  Boarding station slug (must be on the Line 2 trunk)
 * @param toStationId    Alighting station slug (must be on the Line 2 trunk)
 * @returns `'up'` (내선순환) when the forward/시계방향 arc is shorter,
 *          `'down'` (외선순환) when the backward arc is shorter,
 *          `undefined` when the line is not the loop, either station is off the
 *          trunk, or the two stations are the same / equidistant (no direction).
 */
export function deriveLoopDirection(
  lineId: string,
  fromStationId: string,
  toStationId: string,
): Direction | undefined {
  if (lineId !== LOOP_LINE_ID) return undefined;

  const trunk = LINE_STATIONS[LOOP_LINE_ID]?.[0];
  if (!trunk) return undefined;

  const fromIdx = trunk.indexOf(fromStationId);
  const toIdx = trunk.indexOf(toStationId);
  if (fromIdx === -1 || toIdx === -1) return undefined;

  const n = trunk.length;
  const forward = (toIdx - fromIdx + n) % n;
  const backward = (fromIdx - toIdx + n) % n;

  if (forward < backward) return 'up'; // 내선순환 — 배열 순방향(시계방향)이 최단
  if (backward < forward) return 'down'; // 외선순환 — 역방향(반시계방향)이 최단
  return undefined; // 동일역 또는 정반대(N/2) — 방면 판정 불가
}
