/**
 * Station Search Modal Component — src/components/commute/StationSearchModal.tsx
 *
 * 즐겨찾기 추가·출퇴근 경로 설정 등에서 재사용되는 전체 화면 역 검색 모달.
 * testID 계약 (2026-08-14 부여):
 *   - station-search-input        : 검색 TextInput (모달 도착 마커 겸용)
 *   - station-search-close        : 헤더 닫기(X) 버튼
 *   - station-line-filter-{line}  : 호선 필터 칩 (기존)
 *   - station-search-item-{역명}  : 역 결과 행 (역명은 한글 원문 — resource-id는
 *                                   임의 문자열이라 한글도 그대로 매칭된다)
 *
 * 검색어 입력은 쓰지 않는다: 한글 IME 입력은 이 CI 리그에서 미실증이라,
 * 호선 필터 탭 + 역명 testID 대기라는 실증된 resource-id 전략만 쓴다.
 */
import { BasePage } from '../base.page';

class StationSearchModalComponent extends BasePage {
  /** 검색 인풋 — 모달이 열렸는지 판단하는 도착 마커 */
  get searchInput(): Promise<WebdriverIO.Element> {
    return this.$('station-search-input');
  }

  /** 헤더 닫기(X) 버튼 */
  get closeButton(): Promise<WebdriverIO.Element> {
    return this.$('station-search-close');
  }

  /** 호선 필터 칩 (예: '2' → 2호선) */
  lineFilter(lineId: string): Promise<WebdriverIO.Element> {
    return this.$(`station-line-filter-${lineId}`);
  }

  /** 역 결과 행 (한글 역명 그대로, 예: '강남') */
  stationItem(stationName: string): Promise<WebdriverIO.Element> {
    return this.$(`station-search-item-${stationName}`);
  }

  async waitForOpen(timeout = 15000): Promise<void> {
    const input = await this.searchInput;
    await input.waitForDisplayed({ timeout });
  }

  async tapLineFilter(lineId: string): Promise<void> {
    await this.safeTap(await this.lineFilter(lineId));
  }

  /**
   * 역 결과 행을 탭한다. 호선 필터로 결과를 좁힌 뒤 호출할 것 —
   * 같은 역명이 여러 호선에 존재하면 (예: 강남 2호선/신분당선) 필터 없이는
   * 어느 행이 매칭될지 비결정적이다.
   */
  async tapStationItem(stationName: string, timeout = 15000): Promise<void> {
    const item = await this.stationItem(stationName);
    await item.waitForDisplayed({ timeout });
    await item.click();
  }
}

export default new StationSearchModalComponent();
