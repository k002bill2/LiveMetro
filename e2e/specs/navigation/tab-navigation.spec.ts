/**
 * Tab Navigation E2E Tests — 실제 활성 탭(홈/즐겨찾기/경로/제보/설정) 기준
 * (2026-08-14 현행화 — CI run 31727330570 스크린샷으로 탭 구성 실증)
 *
 * 익명 진입으로 Main에 도달한 뒤 탭을 순회하며 각 화면의 실존 testID
 * 마커로 도착을 확인한다. 탭 버튼의 selected 속성 단언은 판정이
 * 비결정적이라 제외했다.
 *
 * 미검증 잔여: 설정 탭 — SettingsScreen 상단에 안정 마커 testID가 없어
 * (최상단 요소들이 testID 미부여) src에 화면 마커를 추가한 뒤 후속으로
 * 검증한다. 이 브랜치는 src 무변경 원칙을 유지한다.
 */
import entryFlow from '../../page-objects/onboarding/entry-flow';
import homePage from '../../page-objects/home/home.page';
import favoritesPage from '../../page-objects/favorites/favorites.page';
import bottomTab from '../../page-objects/components/bottom-tab.component';
import { BasePage } from '../../page-objects/base.page';

// 경로/제보 화면 마커 조회용 (전용 page object를 둘 만큼 상호작용이 없다)
class TabScreenProbe extends BasePage {
  get routesScreen(): Promise<WebdriverIO.Element> {
    return this.$('routes-tab-screen');
  }

  get delayFeedHeaderTitle(): Promise<WebdriverIO.Element> {
    return this.$('delay-feed-header-title');
  }
}
const probe = new TabScreenProbe();

describe('Tab Navigation', () => {
  before(async () => {
    await entryFlow.enterMainAsAnonymous();
  });

  it('시작 시 홈 화면이 표시된다', async () => {
    await homePage.waitForScreen();
    expect(await homePage.isDisplayed()).toBe(true);
  });

  it('즐겨찾기 탭으로 이동하면 즐겨찾기 화면이 표시된다', async () => {
    await bottomTab.tapFavorites();
    await favoritesPage.waitForScreen();
    const addButton = await favoritesPage.addButton;
    expect(await addButton.isDisplayed()).toBe(true);
  });

  it('경로 탭으로 이동하면 경로 화면이 표시된다', async () => {
    await bottomTab.tapRoutes();
    const routes = await probe.routesScreen;
    await routes.waitForDisplayed({ timeout: 15000 });
    expect(await routes.isDisplayed()).toBe(true);
  });

  it('제보 탭으로 이동하면 제보 피드 화면이 표시된다', async () => {
    await bottomTab.tapReports();
    const header = await probe.delayFeedHeaderTitle;
    await header.waitForDisplayed({ timeout: 15000 });
    expect(await header.isDisplayed()).toBe(true);
  });

  it('홈 탭으로 복귀할 수 있다', async () => {
    await bottomTab.tapHome();
    await homePage.waitForScreen();
    expect(await homePage.isDisplayed()).toBe(true);
  });
});
