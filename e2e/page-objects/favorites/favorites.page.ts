/**
 * Favorites Page Object — src/screens/favorites/FavoritesScreen.tsx
 *
 * 실존 testID 기준으로 현행화 (2026-08-14). 이전 버전의 'search-input',
 * 'favorite-count' 등 가공 셀렉터는 제거했다. 빈 상태 뷰에는 testID가 없어
 * 화면 고유 텍스트로 확인한다.
 */
import { BasePage } from '../base.page';

class FavoritesPage extends BasePage {
  /** 즐겨찾기 추가(+) 버튼 — 헤더 상주, 화면 도착 마커 */
  get addButton(): Promise<WebdriverIO.Element> {
    return this.$('favorites-add-button');
  }

  /** 편집 버튼 */
  get editButton(): Promise<WebdriverIO.Element> {
    return this.$('favorites-edit-button');
  }

  /** 빈 상태 타이틀 (신규 사용자 기본 상태) */
  get emptyTitle(): Promise<WebdriverIO.Element> {
    return this.getByText('즐겨찾기가 없습니다');
  }

  async waitForScreen(timeout = 15000): Promise<void> {
    const addButton = await this.addButton;
    await addButton.waitForDisplayed({ timeout });
  }
}

export default new FavoritesPage();
