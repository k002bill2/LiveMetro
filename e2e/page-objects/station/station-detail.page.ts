/**
 * Station Detail Page Object — src/screens/station/StationDetailScreen.tsx
 *
 * 실존 testID 기준으로 전면 현행화 (2026-08-14). 이전 버전의 'station-name',
 * 'loading-indicator', 'arrival-list' 등은 화면에 존재한 적 없는 가공
 * 셀렉터였다. 실제 계약:
 *   - station-detail-header(-back/-share/-favorite) : 상단 헤더와 버튼들
 *   - station-detail-loading / -error / -empty      : 도착정보 상태 패널 3종
 *   - station-detail-arrival-{idx}                  : 도착 카드 (0부터)
 *   - station-detail-train-select / -train-position : 도착 카드 존재 시 CTA
 */
import { browser } from '@wdio/globals';
import { BasePage } from '../base.page';

/** 도착정보 영역이 로딩을 끝내고 도달하는 최종 상태 */
export type ArrivalState = 'arrivals' | 'empty' | 'error';

class StationDetailPage extends BasePage {
  // ============ SELECTORS ============

  /** 화면 헤더 컨테이너 — 화면 도착 마커 */
  get header(): Promise<WebdriverIO.Element> {
    return this.$('station-detail-header');
  }

  /** 헤더 뒤로 가기 버튼 */
  get backButton(): Promise<WebdriverIO.Element> {
    return this.$('station-detail-header-back');
  }

  /** 도착정보 로딩 패널 */
  get loadingPanel(): Promise<WebdriverIO.Element> {
    return this.$('station-detail-loading');
  }

  /** 도착정보 에러 패널 */
  get errorPanel(): Promise<WebdriverIO.Element> {
    return this.$('station-detail-error');
  }

  /** 도착정보 빈 패널 (심야 운행 종료 시간대 포함) */
  get emptyPanel(): Promise<WebdriverIO.Element> {
    return this.$('station-detail-empty');
  }

  /** 첫 번째 도착 카드 */
  get firstArrivalCard(): Promise<WebdriverIO.Element> {
    return this.$('station-detail-arrival-0');
  }

  // ============ ACTIONS ============

  /** 헤더 뒤로 가기 버튼으로 이전 화면 복귀 */
  async tapBack(): Promise<void> {
    await this.safeTap(await this.backButton);
  }

  // ============ ASSERTIONS ============

  async isDisplayed(): Promise<boolean> {
    try {
      const header = await this.header;
      return await header.isDisplayed();
    } catch {
      return false;
    }
  }

  async waitForScreen(timeout = 15000): Promise<void> {
    const header = await this.header;
    await header.waitForDisplayed({ timeout });
  }

  /**
   * 도착정보 영역이 로딩을 벗어나 최종 상태(도착 카드 / 빈 / 에러) 중
   * 하나에 도달할 때까지 폴링한다.
   *
   * 어느 상태로 끝날지는 실행 시각과 Seoul API 응답에 달려 있어 단정할 수
   * 없다 — nightly(KST 02시)는 운행 종료 시간대라 보통 empty다. spec은
   * "세 상태 중 하나에 결정적으로 도달한다"는 계약만 단언한다.
   */
  async waitForArrivalState(timeout = 30000): Promise<ArrivalState> {
    const deadline = Date.now() + timeout;
    while (Date.now() < deadline) {
      if (await this.elementExists('station-detail-arrival-0')) {
        return 'arrivals';
      }
      if (await this.elementExists('station-detail-empty')) {
        return 'empty';
      }
      if (await this.elementExists('station-detail-error')) {
        return 'error';
      }
      await browser.pause(500);
    }
    throw new Error(
      `waitForArrivalState: ${timeout}ms 내에 도착/빈/에러 상태에 도달하지 못했습니다`
    );
  }
}

export default new StationDetailPage();
