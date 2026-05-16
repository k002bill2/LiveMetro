/**
 * Phase: line-speed-weighting — canonical OD integration tests
 *
 * `data/lineSpeed.json` 의 노선별 minutes/hop 값과 `kShortestPath.buildGraph`
 * 의 per-line 가중 edge가 결합해 실제 OD에서 합리적 경로를 반환하는지 검증.
 *
 * 모델 한계 (line-level only):
 *  - 같은 노선의 도심 구간 dwell time과 외곽 구간 운행시간이 같은 가중치.
 *  - 9호선 급행/공항철도 직통 같은 운행 패턴 분리 불가.
 *  - 따라서 일부 OD(예: 강남↔홍대입구)는 L2 weight의 dwell-time 보정으로
 *    인해 detour 경로를 선호. 이는 [Two-layer bug partial GREEN 함정]
 *    메모리 패턴이 아닌 line-level 모델의 명시적 trade-off.
 */

import { getDiverseRoutes } from '../kShortestPath';
import {
  getEdgeMinutes,
  getLineHopMinutes,
  AVG_STATION_TRAVEL_TIME,
} from '@models/route';

describe('line-speed-weighting — canonical OD behavior', () => {
  it('산곡↔선릉: fastest는 강남구청 환승 (수인분당선) — 네이버 매칭', () => {
    const routes = getDiverseRoutes('s_ec82b0ea', 'seolleung');
    expect(routes.length).toBeGreaterThan(0);
    const fastest = routes[0]!;
    expect(fastest.category).toBe('fastest');
    expect(fastest.transferCount).toBe(1);
    // 강남구청 환승은 fromStationId='gangnam_gu_office'에서 발생.
    const transfers = fastest.segments.filter((s) => s.isTransfer);
    expect(transfers.some((t) => t.fromStationId === 'gangnam_gu_office')).toBe(true);
    expect(fastest.lineIds).toContain('bundang');
    expect(fastest.lineIds).toContain('7');
    // 시간 ±10% 가드 — 손계산 75.80min (16×2.26 + 4 + 2×2.0 = wrong, 30×2.26+4+2×2.0=75.80).
    expect(fastest.totalMinutes).toBeGreaterThan(68);
    expect(fastest.totalMinutes).toBeLessThan(84);
  });

  it('잠실↔강남: L2 직행 (0환승)', () => {
    const routes = getDiverseRoutes('jamsil_8', 'gangnam');
    expect(routes.length).toBeGreaterThan(0);
    const fastest = routes[0]!;
    expect(fastest.transferCount).toBe(0);
    expect(fastest.lineIds).toEqual(['2']);
    // 6 hops × 2.8 = 16.8min, 실제 ~12min — line-level dwell 보정으로 다소 비관적
    expect(fastest.totalMinutes).toBeGreaterThan(13);
    expect(fastest.totalMinutes).toBeLessThan(19);
  });

  it('인천공항1터미널↔서울역: 공항철도 직행', () => {
    const routes = getDiverseRoutes('s_4213', 'seoul');
    expect(routes.length).toBeGreaterThan(0);
    const fastest = routes[0]!;
    expect(fastest.transferCount).toBe(0);
    expect(fastest.lineIds).toEqual(['airport']);
    // 12 hops × 4.5 = 54min, 실제 일반 ~58min — 합리적
    expect(fastest.totalMinutes).toBeGreaterThan(48);
    expect(fastest.totalMinutes).toBeLessThan(60);
  });

  it('산곡↔강남: 1환승, 합리적 시간', () => {
    // 7호선 직행 불가 (강남은 L2/sinbundang/9호선만). 환승 필수.
    const routes = getDiverseRoutes('s_ec82b0ea', 'gangnam');
    expect(routes.length).toBeGreaterThan(0);
    const fastest = routes[0]!;
    expect(fastest.transferCount).toBeGreaterThanOrEqual(1);
    expect(fastest.lineIds).toContain('7');
    expect(fastest.totalMinutes).toBeGreaterThan(60);
    expect(fastest.totalMinutes).toBeLessThan(80);
  });

  it('산곡↔선릉 회귀 net: 모든 K 후보의 transferCount ≤ 4', () => {
    // K-shortest가 비합리적 다중 환승 경로를 fastest로 picks하면 알람.
    const routes = getDiverseRoutes('s_ec82b0ea', 'seolleung');
    routes.forEach((r) => {
      expect(r.transferCount).toBeLessThanOrEqual(4);
      // 시간 sanity: fastest의 200% 초과는 비합리적.
      expect(r.totalMinutes).toBeLessThan(routes[0]!.totalMinutes * 2);
    });
  });

  it('lineSpeed.json schema 완결성: lines.json의 모든 lineId 존재', () => {
    // 누락 lineId는 런타임에 AVG_STATION_TRAVEL_TIME fallback이지만,
    // 명시적 schema 완결성을 가드.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const lineSpeed = require('@/data/lineSpeed.json') as Record<string, number>;
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const lines = require('@/data/lines.json') as { stations: Record<string, unknown> };
    const lineIds = Object.keys(lines.stations);
    lineIds.forEach((lineId) => {
      expect(lineSpeed[lineId]).toBeDefined();
      expect(lineSpeed[lineId]).toBeGreaterThan(0);
    });
  });
});

// Phase C.1: segment-level weighting foundation.
//
// Schema and helper plumbing are introduced now; the actual `segmentSpeed.json`
// data is empty (only `_schema_doc`). Until segment data is populated, every
// `getEdgeMinutes` call falls through to `getLineHopMinutes` → identical to
// the pre-C baseline. These tests pin that fallback so the data-population
// phase can add overrides without fearing accidental regressions on
// untouched edges.
describe('segment-level weighting foundation (Phase C.1)', () => {
  describe('getEdgeMinutes fallback chain', () => {
    it('falls back to line-level when no segment override exists', () => {
      // No '0222'<->'0223' (강남↔역삼) override in segmentSpeed.json today.
      const edge = getEdgeMinutes('0222', '0223', '2');
      const line = getLineHopMinutes('2');
      expect(edge).toBe(line);
    });

    it('normalizes `::N` sub-line suffix before line lookup', () => {
      const edge = getEdgeMinutes('a', 'b', '2::0');
      expect(edge).toBe(getLineHopMinutes('2'));
    });

    it('falls back to AVG_STATION_TRAVEL_TIME for unknown lineId', () => {
      // No 'unknown-line' in either segmentSpeed.json or lineSpeed.json.
      const edge = getEdgeMinutes('a', 'b', 'unknown-line');
      expect(edge).toBe(AVG_STATION_TRAVEL_TIME);
    });

    it('is direction-agnostic: getEdgeMinutes(A,B,L) === getEdgeMinutes(B,A,L)', () => {
      // Without overrides, fallback returns line value regardless of order.
      // Once overrides are added, the helper's ordered-key logic must keep
      // this symmetric — this test pins the contract for the data phase.
      const ab = getEdgeMinutes('s_alpha', 's_beta', '7');
      const ba = getEdgeMinutes('s_beta', 's_alpha', '7');
      expect(ab).toBe(ba);
    });
  });

  it('산곡↔선릉 회귀 net: Phase C.1 후에도 강남구청 환승 fastest 유지', () => {
    // Phase C foundation은 빈 segment 데이터로 시작하므로 line-level 결과와
    // 동일해야 한다. PR #120의 산곡↔선릉 강남구청 환승 flip이 보존되는지
    // 가드 — 후속 데이터 PR에서 깨뜨리면 즉시 catch.
    const routes = getDiverseRoutes('s_ec82b0ea', 'seolleung');
    expect(routes.length).toBeGreaterThan(0);
    const fastest = routes[0]!;
    expect(fastest.category).toBe('fastest');
    expect(fastest.transferCount).toBe(1);
    const transfers = fastest.segments.filter((s) => s.isTransfer);
    expect(transfers.some((t) => t.fromStationId === 'gangnam_gu_office')).toBe(true);
    expect(fastest.lineIds).toContain('bundang');
  });

  it('segmentSpeed.json schema 가드: 모든 entry는 from/to/minutes를 가진다', () => {
    // 빈 객체일 때는 통과. 데이터가 채워지면 entry shape 위반을 빌드 타임이 아닌
    // 런타임 가드로 catch (TS는 JSON 내용을 검증 안 함).
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const segmentSpeed = require('@/data/segmentSpeed.json') as Record<string, unknown>;
    for (const [key, value] of Object.entries(segmentSpeed)) {
      if (key.startsWith('_')) continue; // schema doc keys
      expect(Array.isArray(value)).toBe(true);
      (value as unknown[]).forEach((entry) => {
        expect(entry).toMatchObject({
          from: expect.any(String),
          to: expect.any(String),
          minutes: expect.any(Number),
        });
      });
    }
  });
});
