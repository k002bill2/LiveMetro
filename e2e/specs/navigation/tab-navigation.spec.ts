/**
 * Tab Navigation E2E Tests — 현행 MainTabs(홈/즐겨찾기/알림/설정) 기준 (2026-08-14 현행화)
 *
 * 익명 진입으로 Main에 도달한 뒤 하단 탭 4개를 순회한다. 탭 자체는
 * react-navigation 라벨 텍스트로 찾고(bottom-tab.component), 각 탭 도착은
 * 해당 화면의 실존 testID 마커로 확인한다.
 */
import entryFlow from '../../page-objects/onboarding/entry-flow';
import homePage from '../../page-objects/home/home.page';
import favoritesPage from '../../page-objects/favorites/favorites.page';
import bottomTab from '../../page-objects/components/bottom-tab.component';
import { BasePage } from '../../page-objects/base.page';

// 알림 화면 마커 조회용 (전용 page object를 둘 만큼 상호작용이 없다)
class AlertsProbe extends BasePage {
  get headerTitle(): Promise<WebdriverIO.Element> {
    return this.$('alerts-header-title');
  }
}
const alertsProbe = new AlertsProbe();

describe('Tab Navigation', () => {
  before(async () => {
    await entryFlow.enterMainAsAnonymous();
  });

  it('시작 시 홈 탭이 활성 상태다', async () => {
    await homePage.waitForScreen();
    expect(await bottomTab.isHomeTabSelected()).toBe(true);
  });

  it('즐겨찾기 탭으로 이동하면 즐겨찾기 화면이 표시된다', async () => {
    await bottomTab.tapFavorites();
    await favoritesPage.waitForScreen();
    expect(await bottomTab.isFavoritesTabSelected()).toBe(true);
  });

  it('알림 탭으로 이동하면 알림 화면이 표시된다', async () => {
    await bottomTab.tapAlerts();
    const header = await alertsProbe.headerTitle;
    await header.waitForDisplayed({ timeout: 15000 });
    expect(await bottomTab.isAlertsTabSelected()).toBe(true);
  });

  it('설정 탭으로 이동하면 설정 탭이 활성화된다', async () => {
    await bottomTab.tapSettings();
    expect(await bottomTab.isSettingsTabSelected()).toBe(true);
  });

  it('홈 탭으로 복귀할 수 있다', async () => {
    await bottomTab.tapHome();
    await homePage.waitForScreen();
    expect(await bottomTab.isHomeTabSelected()).toBe(true);
  });
});
