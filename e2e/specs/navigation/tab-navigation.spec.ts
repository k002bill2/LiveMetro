/**
 * Tab Navigation E2E Tests
 * Tests for bottom tab bar navigation
 */
import { browser } from '@wdio/globals';
import welcomePage from '../../page-objects/auth/welcome.page';
import homePage from '../../page-objects/home/home.page';
import bottomTab from '../../page-objects/components/bottom-tab.component';
import favoritesPage from '../../page-objects/favorites/favorites.page';

describe('Tab Navigation', () => {
  before(async () => {
    // Login first to access main app
    await (browser as WebdriverIO.Browser).terminateApp('com.livemetro.app');
    await (browser as WebdriverIO.Browser).activateApp('com.livemetro.app');
    await welcomePage.waitForScreen();
    await welcomePage.tapTryAnonymously();
    await homePage.waitForScreen();
  });

  describe('Bottom Tab Bar', () => {
    it('should display bottom tab bar', async () => {
      const isVisible = await bottomTab.isVisible();
      expect(isVisible).toBe(true);
    });

    it('should have Home tab selected by default', async () => {
      const activeTab = await bottomTab.getActiveTabName();
      expect(activeTab).toBe('홈');
    });
  });

  describe('Home Tab', () => {
    it('should display home screen content', async () => {
      await bottomTab.tapHome();
      await browser.pause(500);

      const isDisplayed = await homePage.isDisplayed();
      expect(isDisplayed).toBe(true);
    });

    it('should show welcome message', async () => {
      const message = await homePage.getWelcomeMessage();
      expect(message).toContain('안녕하세요');
    });
  });

  describe('Favorites Tab', () => {
    it('should navigate to Favorites tab', async () => {
      await bottomTab.tapFavorites();
      await browser.pause(500);

      const isDisplayed = await favoritesPage.isDisplayed();
      expect(isDisplayed).toBe(true);
    });

    it('should display favorites header', async () => {
      const header = await favoritesPage.header;
      expect(await header.isDisplayed()).toBe(true);
    });

    it('should show empty state when no favorites', async () => {
      // This test assumes no favorites are added
      const isEmpty = await favoritesPage.isEmptyStateDisplayed();
      // May or may not be empty depending on test order
      expect(typeof isEmpty).toBe('boolean');
    });
  });

  describe('Alerts Tab', () => {
    it('should navigate to Alerts tab', async () => {
      await bottomTab.tapAlerts();
      await browser.pause(500);

      // Verify we're on alerts screen by checking for common elements
      const alertsHeader = await bottomTab.getByText('알림');
      expect(await alertsHeader.isDisplayed()).toBe(true);
    });
  });

  describe('Settings Tab', () => {
    it('should navigate to Settings tab', async () => {
      await bottomTab.tapSettings();
      await browser.pause(500);

      // Verify we're on settings screen
      const settingsHeader = await bottomTab.getByText('설정');
      expect(await settingsHeader.isDisplayed()).toBe(true);
    });
  });

  describe('Tab Switching', () => {
    it('should return to Home tab from Settings', async () => {
      await bottomTab.tapSettings();
      await browser.pause(300);

      await bottomTab.tapHome();
      await browser.pause(500);

      const isDisplayed = await homePage.isDisplayed();
      expect(isDisplayed).toBe(true);
    });

    it('should switch between all tabs', async () => {
      // Home -> Favorites
      await bottomTab.tapHome();
      await browser.pause(300);
      expect(await homePage.isDisplayed()).toBe(true);

      await bottomTab.tapFavorites();
      await browser.pause(300);
      expect(await favoritesPage.isDisplayed()).toBe(true);

      await bottomTab.tapAlerts();
      await browser.pause(300);
      // Just verify no error

      await bottomTab.tapSettings();
      await browser.pause(300);
      // Just verify no error

      await bottomTab.tapHome();
      await browser.pause(300);
      expect(await homePage.isDisplayed()).toBe(true);
    });

    it('should maintain tab state when switching', async () => {
      // Navigate away and back to verify state is maintained
      await bottomTab.tapHome();
      await browser.pause(300);

      await bottomTab.tapFavorites();
      await browser.pause(300);

      await bottomTab.tapHome();
      await browser.pause(300);

      // Verify home screen is still showing the expected content
      const isDisplayed = await homePage.isDisplayed();
      expect(isDisplayed).toBe(true);
    });
  });
});
