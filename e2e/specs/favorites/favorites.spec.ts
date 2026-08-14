/**
 * Favorites E2E Tests — 현행 FavoritesScreen 기준 (2026-08-14 현행화)
 *
 * 신규 익명 사용자의 기본 상태(즐겨찾기 0건)를 검증한다. 추가/삭제/정렬
 * 상호작용은 검색 모달·데이터 시드가 필요해 후속 현행화 대상.
 */
import entryFlow from '../../page-objects/onboarding/entry-flow';
import favoritesPage from '../../page-objects/favorites/favorites.page';
import bottomTab from '../../page-objects/components/bottom-tab.component';

describe('Favorites Management', () => {
  before(async () => {
    await entryFlow.enterMainAsAnonymous();
    await bottomTab.tapFavorites();
    await favoritesPage.waitForScreen();
  });

  it('즐겨찾기 추가(+) 버튼이 헤더에 표시된다', async () => {
    const addButton = await favoritesPage.addButton;
    expect(await addButton.isDisplayed()).toBe(true);
  });

  it('신규 사용자는 빈 상태 안내가 표시된다', async () => {
    const emptyTitle = await favoritesPage.emptyTitle;
    await emptyTitle.waitForDisplayed({ timeout: 15000 });
    expect(await emptyTitle.isDisplayed()).toBe(true);
  });
});
