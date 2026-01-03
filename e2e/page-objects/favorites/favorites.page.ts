/**
 * Favorites Page Object
 * Handles favorites screen interactions
 */
import { browser } from '@wdio/globals';
import { BasePage } from '../base.page';

class FavoritesPage extends BasePage {
  // ============ SELECTORS ============

  /**
   * Favorites header
   */
  get header(): Promise<WebdriverIO.Element> {
    return this.getByText('즐겨찾기');
  }

  /**
   * Search input
   */
  get searchInput(): Promise<WebdriverIO.Element> {
    return this.$('search-input');
  }

  /**
   * Empty state message
   */
  get emptyStateMessage(): Promise<WebdriverIO.Element> {
    return this.getByText('즐겨찾기가 없습니다');
  }

  /**
   * Find stations button (in empty state)
   */
  get findStationsButton(): Promise<WebdriverIO.Element> {
    return this.getByText('역 찾아보기');
  }

  /**
   * Edit button
   */
  get editButton(): Promise<WebdriverIO.Element> {
    return this.getByText('편집');
  }

  /**
   * Count badge showing number of favorites
   */
  get favoriteCountBadge(): Promise<WebdriverIO.Element> {
    return this.$('favorite-count');
  }

  // ============ ACTIONS ============

  /**
   * Search for a station
   */
  async search(query: string): Promise<void> {
    const input = await this.searchInput;
    await this.typeText(input, query);
  }

  /**
   * Clear search input
   */
  async clearSearch(): Promise<void> {
    const input = await this.searchInput;
    await input.clearValue();
  }

  /**
   * Tap on a favorite station
   */
  async tapFavorite(stationName: string): Promise<void> {
    const station = await this.getByText(stationName);
    await this.safeTap(station);
  }

  /**
   * Tap find stations button
   */
  async tapFindStations(): Promise<void> {
    const button = await this.findStationsButton;
    await this.safeTap(button);
  }

  /**
   * Tap edit button
   */
  async tapEdit(): Promise<void> {
    const button = await this.editButton;
    await this.safeTap(button);
  }

  /**
   * Delete a favorite station by name
   */
  async deleteFavorite(stationName: string): Promise<void> {
    // First, swipe left on the item to reveal delete button
    const station = await this.getByText(stationName);
    const location = await station.getLocation();
    const size = await station.getSize();

    await browser.performActions([
      {
        type: 'pointer',
        id: 'finger1',
        parameters: { pointerType: 'touch' },
        actions: [
          {
            type: 'pointerMove',
            duration: 0,
            x: location.x + size.width * 0.8,
            y: location.y + size.height / 2,
          },
          { type: 'pointerDown', button: 0 },
          {
            type: 'pointerMove',
            duration: 300,
            x: location.x + size.width * 0.2,
            y: location.y + size.height / 2,
          },
          { type: 'pointerUp', button: 0 },
        ],
      },
    ]);

    // Tap delete button
    await browser.pause(500);
    const deleteButton = await this.getByText('삭제');
    await this.safeTap(deleteButton);
  }

  /**
   * Pull to refresh
   */
  async refresh(): Promise<void> {
    await this.pullToRefresh();
  }

  // ============ ASSERTIONS ============

  /**
   * Check if favorites screen is displayed
   */
  async isDisplayed(): Promise<boolean> {
    try {
      const header = await this.header;
      return await header.isDisplayed();
    } catch {
      return false;
    }
  }

  /**
   * Check if empty state is displayed
   */
  async isEmptyStateDisplayed(): Promise<boolean> {
    try {
      const message = await this.emptyStateMessage;
      return await message.isDisplayed();
    } catch {
      return false;
    }
  }

  /**
   * Check if a station is in favorites
   */
  async hasFavorite(stationName: string): Promise<boolean> {
    try {
      const station = await this.getByText(stationName);
      return await station.isDisplayed();
    } catch {
      return false;
    }
  }

  /**
   * Get count of visible favorites
   */
  async getFavoriteCount(): Promise<number> {
    try {
      const items = await this.$$('favorite-item');
      return items.length;
    } catch {
      return 0;
    }
  }

  /**
   * Wait for favorites screen to be ready
   */
  async waitForScreen(timeout = 10000): Promise<void> {
    const header = await this.header;
    await this.waitForDisplayed(header, timeout);
  }
}

export default new FavoritesPage();
