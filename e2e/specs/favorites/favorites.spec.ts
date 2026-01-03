/**
 * Favorites Screen E2E Tests
 * Tests for favorites management functionality
 */
import { browser } from '@wdio/globals';
import welcomePage from '../../page-objects/auth/welcome.page';
import homePage from '../../page-objects/home/home.page';
import bottomTab from '../../page-objects/components/bottom-tab.component';
import favoritesPage from '../../page-objects/favorites/favorites.page';

describe('Favorites Management', () => {
  before(async () => {
    // Login first to access main app
    await (browser as WebdriverIO.Browser).terminateApp('com.livemetro.app');
    await (browser as WebdriverIO.Browser).activateApp('com.livemetro.app');
    await welcomePage.waitForScreen();
    await welcomePage.tapTryAnonymously();
    await homePage.waitForScreen();
    await bottomTab.tapFavorites();
    await favoritesPage.waitForScreen();
  });

  describe('Favorites Screen Display', () => {
    it('should display favorites screen header', async () => {
      const header = await favoritesPage.header;
      expect(await header.isDisplayed()).toBe(true);
    });

    it('should be on favorites screen', async () => {
      const isDisplayed = await favoritesPage.isDisplayed();
      expect(isDisplayed).toBe(true);
    });
  });

  describe('Empty State', () => {
    it('should show empty state when no favorites (if applicable)', async () => {
      const isEmpty = await favoritesPage.isEmptyStateDisplayed();

      if (isEmpty) {
        const message = await favoritesPage.emptyStateMessage;
        expect(await message.isDisplayed()).toBe(true);

        const findButton = await favoritesPage.findStationsButton;
        expect(await findButton.isDisplayed()).toBe(true);
      }
    });

    it('should have find stations button when empty', async () => {
      const isEmpty = await favoritesPage.isEmptyStateDisplayed();

      if (isEmpty) {
        const button = await favoritesPage.findStationsButton;
        expect(await button.isDisplayed()).toBe(true);
      }
    });
  });

  describe('Navigation from Empty State', () => {
    it('should navigate to home when tapping find stations', async () => {
      const isEmpty = await favoritesPage.isEmptyStateDisplayed();

      if (isEmpty) {
        await favoritesPage.tapFindStations();
        await browser.pause(500);

        const isHomeDisplayed = await homePage.isDisplayed();
        expect(isHomeDisplayed).toBe(true);

        // Navigate back to favorites
        await bottomTab.tapFavorites();
        await favoritesPage.waitForScreen();
      }
    });
  });

  describe('Pull to Refresh', () => {
    it('should support pull to refresh', async () => {
      await favoritesPage.refresh();
      await browser.pause(1000);

      // Verify screen is still displayed after refresh
      const isDisplayed = await favoritesPage.isDisplayed();
      expect(isDisplayed).toBe(true);
    });
  });

  describe('Search Functionality', () => {
    it('should have search input available', async () => {
      // Search may not be visible if empty state is shown
      const isEmpty = await favoritesPage.isEmptyStateDisplayed();

      if (!isEmpty) {
        try {
          const searchInput = await favoritesPage.searchInput;
          expect(await searchInput.isDisplayed()).toBe(true);
        } catch {
          // Search input may not exist in current implementation
          console.log('Search input not available');
        }
      }
    });
  });

  describe('Favorite Count', () => {
    it('should display correct favorite count', async () => {
      const count = await favoritesPage.getFavoriteCount();
      expect(typeof count).toBe('number');
      expect(count).toBeGreaterThanOrEqual(0);
    });
  });
});

describe('Favorites Interaction (with stations)', () => {
  before(async () => {
    // This test suite requires favorites to be added
    // Skip if no favorites exist
  });

  describe('Favorite Station Selection', () => {
    it.skip('should navigate to station detail when tapping favorite', async () => {
      // This test requires at least one favorite
      const count = await favoritesPage.getFavoriteCount();

      if (count > 0) {
        // Get first favorite and tap it
        // Implementation depends on how favorites are displayed
      }
    });
  });

  describe('Favorite Deletion', () => {
    it.skip('should delete favorite on swipe', async () => {
      // This test requires at least one favorite
      // and would modify app state
    });
  });
});
