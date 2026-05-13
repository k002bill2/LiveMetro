/**
 * realtimeWeightOverride — Phase C: 출발역 실시간 도착 정보로 대기시간 계산
 *
 * Seoul Open Data API의 실시간 도착 응답을 정규화한 형태(`RealtimeArrival`)를 받아
 * 특정 lineId의 다음 열차 대기 분 수를 반환합니다.
 *
 * 호출자(routeService 또는 useRouteSearch)가 이 결과를 첫 segment 가중치/표시 시간에 반영.
 *
 * Invariants:
 *  - 데이터 없음 → null (caller falls back to static schedule)
 *  - 도착 임박 또는 방금 떠남 → 0 (음수 초는 0으로 clamp)
 *  - 그 외 → ceil(seconds / 60) (분 단위 올림)
 *  - 같은 lineId 다중 엔트리 → 가장 빠른(min seconds) 것 선택
 */

export interface RealtimeArrival {
  readonly lineId: string;
  readonly secondsUntilArrival: number;
}

export function getNextTrainWaitMinutes(
  arrivals: readonly RealtimeArrival[],
  lineId: string,
): number | null {
  let minSeconds = Number.POSITIVE_INFINITY;
  for (const a of arrivals) {
    if (a.lineId === lineId && a.secondsUntilArrival < minSeconds) {
      minSeconds = a.secondsUntilArrival;
    }
  }
  if (minSeconds === Number.POSITIVE_INFINITY) return null;
  return Math.ceil(Math.max(0, minSeconds) / 60);
}
