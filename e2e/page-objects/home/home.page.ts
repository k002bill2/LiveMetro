/**
 * Home Page Object — src/screens/home/HomeScreen.tsx
 *
 * 실존 testID 기준으로 현행화 (2026-08-14). 이전 버전의 'refresh-button' 등
 * 가공 셀렉터는 제거했다.
 */
import { BasePage } from '../base.page';

class HomePage extends BasePage {
  /** 홈 화면 루트 컨테이너 — 화면 도착 마커 */
  get screen(): Promise<WebdriverIO.Element> {
    return this.$('home-screen');
  }

  /** 주변 역 섹션 */
  get stationsSection(): Promise<WebdriverIO.Element> {
    return this.$('home-stations-section');
  }

  async waitForScreen(timeout = 20000): Promise<void> {
    const screen = await this.screen;
    await screen.waitForDisplayed({ timeout });
  }

  async isDisplayed(): Promise<boolean> {
    return this.elementExists('home-screen');
  }
}

export default new HomePage();
