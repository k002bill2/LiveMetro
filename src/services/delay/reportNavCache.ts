/**
 * Report Nav Cache
 *
 * 화면 전환 시 DelayReport 객체를 navigation params 대신 module-scope 캐시로
 * 전달한다. nav params에 `timestamp: Date` 같은 비직렬화 필드를 싣지 않기 위함.
 *
 * 사용 흐름:
 *   const reportId = stashReport(report);
 *   navigation.navigate('ReportDetail', { reportId });
 *   // 수신 측:
 *   const report = takeReport(reportId);  // 또는 peekReport(reportId)
 *
 * Phase E+에서 Firestore 단일 read로 대체 가능. 지금은 카드 → 상세 즉시 전환
 * 케이스만 다루므로 cache가 충분하다.
 */

import { DelayReport } from '@/models/delayReport';

const CACHE = new Map<string, DelayReport>();

/**
 * Store the report and return its id for use in nav params.
 */
export const stashReport = (report: DelayReport): string => {
  CACHE.set(report.id, report);
  return report.id;
};

/**
 * Read without removing — typical case where two screens want the same report.
 */
export const peekReport = (id: string): DelayReport | undefined => {
  return CACHE.get(id);
};

/**
 * Read and remove — for screens that should not reuse stale data.
 */
export const takeReport = (id: string): DelayReport | undefined => {
  const r = CACHE.get(id);
  CACHE.delete(id);
  return r;
};

/**
 * Test/dev-only helper to clear the cache between renders.
 */
export const clearReportCache = (): void => {
  CACHE.clear();
};
