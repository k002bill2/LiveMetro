/**
 * Branch-line transfer semantics — integration tests
 *
 * 본 파일은 분기 구조 노선(`lines.json`의 `string[][]` schema)에서 본선과
 * 지선이 그래프 빌더에서 단일 노드를 공유해 본선↔지선 환승이
 * `transferCount=0`으로 fall through하던 회귀를 잡는다.
 *
 * 해결 (Sub-PR #2, sub-line encoding):
 *   1. 노드 키 `${stationId}#${lineId}::${subIdx}` 인코딩 (trunk=`::0`).
 *   2. 같은 station이 한 노선 안에서 N개 subarray에 등장 시 sub-line 간
 *      양방향 transfer edge 추가 (weight: `AVG_BRANCH_SHUTTLE_WAIT`).
 *   결과: 본선↔지선 환승이 그래프에 edge로 존재해 transferCount에 반영.
 *
 * 별도 파일로 분리한 이유: `kShortestPath.integration.test.ts`는 데이터
 * 회귀(lines.json 순서)에 집중. 본 파일은 그래프 빌더 의미론에 집중.
 * 메모리 [[integration-test-separates-data-regression]] 패턴 따름.
 *
 * 관련:
 *   - 메모리 [[two-layer-bug-partial-green]] — PR #85 GREEN 후 알고리즘 RED
 *   - 메모리 [[line-stations-nested-array-schema]]
 *   - docs/planning/branch-line-transfer-semantics/ — phase 3-파일 계획
 */

import { getDiverseRoutes, findKShortestPaths } from '../kShortestPath';

describe('Branch-line transfer semantics', () => {
  describe('Line 2 — 신정지선 ↔ 본선', () => {
    /**
     * 까치산 → 선릉:
     *   까치산 (신정지선[2] 끝) → 신정네거리 → 양천구청 → 도림천 →
     *   신도림 (신정지선↔본선 분기점) → ... → 선릉 (본선)
     *
     * 운영체계 (위키피디아 2호선 신정지선 검증):
     *   신정지선 열차는 까치산↔신도림 셔틀. 본선 순환 열차는 별도 운행.
     *   승객은 신도림에서 본선 열차로 환승 필수.
     */
    it('까치산 → 선릉: 신정지선↔본선 환승 edge가 그래프에 존재', () => {
      // 까치산은 2호선/5호선 환승역이라 fastest는 5호선 우회일 수 있음 +
      // diverseRoutes K=5 한계로 신도림 1-hop이 카드에 안 들어올 수 있다.
      // 본 테스트의 핵심은 sub-line transfer edge가 K-shortest 탐색 후보에
      // 노출되는지. findKShortestPaths를 직접 K=15로 호출해 검증.
      const result = findKShortestPaths('kkachisan', 'seolleung', 15);
      expect(result.paths.length).toBeGreaterThan(0);
      const hasSindorimBranchTransfer = result.paths.some((route) =>
        route.segments.some(
          (seg) => seg.isTransfer && seg.fromStationName === '신도림',
        ),
      );
      expect(hasSindorimBranchTransfer).toBe(true);
    });
  });

  describe('Line 2 — 성수지선 ↔ 본선', () => {
    /**
     * 신답(s_0245, 성수지선[1]) → 강남(2호선 본선):
     *   신답 → 용답 → 성수 (성수지선↔본선 분기점) → 강변 → ... → 강남
     *
     * 성수지선은 성수↔신설동 셔틀. 성수에서 본선 환승 필수.
     */
    it('신답 → 강남: 성수 환승 1회', () => {
      const routes = getDiverseRoutes('s_0245', 'gangnam');
      expect(routes.length).toBeGreaterThan(0);
      const fastest = routes[0]!;
      expect(fastest.transferCount).toBe(1);
      expect(
        fastest.segments.some(
          (seg) => seg.isTransfer && seg.fromStationName === '성수',
        ),
      ).toBe(true);
    });
  });

  describe('Line 5 — 마천지선 ↔ 본선', () => {
    /**
     * 마천 → 하남검단산:
     *   마천 (마천지선[1] 끝) → 거여 → ... → 강동 (분기점) →
     *   천호 → ... → 하남검단산 (본선[0] 끝)
     *
     * 마천지선 열차는 강동↔마천 셔틀. 강동에서 본선 환승 필수.
     */
    it('마천 → 하남검단산: 강동 환승 1회', () => {
      const routes = getDiverseRoutes('macheon', 'hanam_geomdan');
      expect(routes.length).toBeGreaterThan(0);
      const fastest = routes[0]!;
      expect(fastest.transferCount).toBe(1);
      expect(
        fastest.segments.some(
          (seg) => seg.isTransfer && seg.fromStationName === '강동',
        ),
      ).toBe(true);
    });
  });

  describe('gyeongchun — 망우선 ↔ 본선', () => {
    /**
     * 광운대(gyeongchun 망우선[1]) → 청량리(본선[0]):
     *   망우선 경유 시 광운대 → 상봉 (망우선↔본선 분기점) → 회기 → 청량리
     *
     * 망우선은 광운대-상봉 셔틀(이문역 2004 폐역으로 사실상 2역만 운행).
     *
     * Note: gyeongchun[1] = [광운대, 상봉]은 양 끝이 모두 환승 허브다
     * (광운대=1호선/gyeongchun, 상봉=7호선/gyeongui/gyeongchun). 망우선
     * 전용 station이 없어 "fastest = 분기 셔틀" 시나리오는 구조적으로
     * 성립하지 않는다 — 광운대→청량리 fastest는 1호선 직통(0환승)이다.
     * 까치산 케이스와 동일하게, 핵심은 sub-line transfer edge가 K-shortest
     * 탐색 후보에 노출되는지. findKShortestPaths를 K=15로 호출해 검증.
     */
    it('광운대(gyeongchun) → 청량리: 망우선↔본선 환승 edge가 그래프에 존재', () => {
      const result = findKShortestPaths('s_eab491ec', 'cheongnyangni', 15);
      expect(result.paths.length).toBeGreaterThan(0);
      const hasSangbongBranchTransfer = result.paths.some((route) =>
        route.segments.some(
          (seg) => seg.isTransfer && seg.fromStationName === '상봉',
        ),
      );
      expect(hasSangbongBranchTransfer).toBe(true);
    });
  });

  describe('gtx_a — 분리 운행 (junction 없음, 회귀 net)', () => {
    /**
     * gtx_a 2026년 8월 직결 전 분리 운행 (Wikipedia 검증):
     *   운정중앙 → 킨텍스 → 대곡 → 연신내 → 서울 (운정-서울)
     *   수서 → 성남 → 구성 → 동탄 (수서-동탄)
     *
     * 두 subarray 사이 공유 station 없음. gtx_a 단독으로는 운정중앙↔동탄
     * 직통 불가. 다른 노선(서울↔수서 사이 3호선/분당선 경유) 환승 필수.
     *
     * Sub-PR #2 (sub-line encoding) 후에도 station 공유 없으니 결과 동일.
     * 본 테스트는 회귀 net — sub-line encoding이 의도치 않게 분리 운행
     * 노선을 합치지 않는지 확인.
     */
    it('운정중앙 → 동탄: 다른 노선 경유 (transferCount >= 2) — 회귀 net', () => {
      const routes = getDiverseRoutes('s_9000', 's_eb8f99ed');
      expect(routes.length).toBeGreaterThan(0);
      const fastest = routes[0]!;
      expect(fastest.transferCount).toBeGreaterThanOrEqual(2);
    });
  });

  /**
   * TODO Sub-PR #1 보강 / Sub-PR #2 추가 RED:
   *
   * 1. **6호선 응암 ring**: ring 양 끝이 응암(2번 등장)인 특수 구조.
   *    `lines.json[6][1]`: 응암→역촌→...→연신내→구산→응암. 운영체계는
   *    평시 ring → 본선 연속 운행이라 응암에서 환승 없을 가능성. 도메인
   *    결정 필요 후 케이스 추가.
   *
   * 2. **gyeongui 5-subarray**: 본선 + 가좌선(가좌-서울역) + 임진강행
   *    (문산-임진강) + 지평행(용문-지평) + 도라산행(임진강-도라산). 가좌선
   *    `행신 → 서울역` 같은 가좌 분기 OD 추가. 임진강↔도라산은 [2][4]
   *    chain이라 더 복잡 — Sub-PR #2 후 별도 phase로 옮길 수 있음.
   *
   * 3. **분기점 station을 출발/도착으로 하는 edge case**: 신도림→까치산
   *    (분기점 자체 출발), 성수→성수(자기 자신 — 무의미하지만 sub-line
   *    self-transfer 발생 여부 확인 가치).
   */
});
