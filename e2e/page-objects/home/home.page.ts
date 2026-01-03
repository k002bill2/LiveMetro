/**
 * Home Page Object
 * Handles the main home screen interactions
 */
import { browser } from '@wdio/globals';
import { BasePage } from '../base.page';

class HomePage extends BasePage {
  // ============ SELECTORS ============

  /**
   * Home screen container
   */
  get homeScreen(): Promise<WebdriverIO.Element> {
    return this.$('home-screen');
  }

  /**
   * Welcome text with user name
   */
  get welcomeText(): Promise<WebdriverIO.Element> {
    return this.getByPartialText('안녕하세요');
  }

  /**
   * Subtitle text
   */
  get subtitleText(): Promise<WebdriverIO.Element> {
    return this.getByText('실시간 지하철 정보를 확인하세요');
  }

  /**
   * Nearby stations section title
   */
  get nearbyStationsTitle(): Promise<WebdriverIO.Element> {
    return this.getByText('주변 역');
  }

  /**
   * Favorites section title
   */
  get favoritesTitle(): Promise<WebdriverIO.Element> {
    return this.getByText('즐겨찾기');
  }

  /**
   * Refresh button
   */
  get refreshButton(): Promise<WebdriverIO.Element> {
    return this.$('refresh-button');
  }

  /**
   * Location permission banner
   */
  get locationPermissionBanner(): Promise<WebdriverIO.Element> {
    return this.getByText('위치 권한 허용');
  }

  /**
   * Empty station state message
   */
  get emptyStationMessage(): Promise<WebdriverIO.Element> {
    return this.getByText('주변에 지하철역이 없습니다');
  }

  /**
   * View details button
   */
  get detailsButton(): Promise<WebdriverIO.Element> {
    return this.getByText('상세보기');
  }

  // ============ ACTIONS ============

  /**
   * Tap refresh button
   */
  async tapRefresh(): Promise<void> {
    const button = await this.refreshButton;
    await this.safeTap(button);
  }

  /**
   * Tap on a station card by name
   */
  async tapStation(stationName: string): Promise<void> {
    const station = await this.getByText(stationName);
    await this.safeTap(station);
  }

  /**
   * Tap on a station card by ID
   */
  async tapStationById(stationId: string): Promise<void> {
    const station = await this.$(`station-card-${stationId}`);
    await this.safeTap(station);
  }

  /**
   * Tap the "상세보기" (View Details) button
   */
  async tapDetailsButton(): Promise<void> {
    const button = await this.detailsButton;
    await this.safeTap(button);
  }

  /**
   * Tap location permission banner to request permissions
   */
  async tapLocationPermissionBanner(): Promise<void> {
    const banner = await this.locationPermissionBanner;
    await this.safeTap(banner);
  }

  /**
   * Pull to refresh the screen
   */
  async refresh(): Promise<void> {
    await this.pullToRefresh();
  }

  /**
   * Scroll to find a station
   */
  async scrollToStation(stationName: string): Promise<WebdriverIO.Element> {
    // First try to find in visible area
    try {
      const station = await this.getByText(stationName);
      if (await station.isDisplayed()) {
        return station;
      }
    } catch {
      // Station not in visible area, need to scroll
    }

    // Scroll horizontally in station list to find station
    const maxScrolls = 5;
    for (let i = 0; i < maxScrolls; i++) {
      try {
        const station = await this.getByText(stationName);
        if (await station.isDisplayed()) {
          return station;
        }
      } catch {
        // Keep scrolling
      }

      // Swipe left to reveal more stations
      const { width, height } = await browser.getWindowSize();
      await browser.performActions([
        {
          type: 'pointer',
          id: 'finger1',
          parameters: { pointerType: 'touch' },
          actions: [
            { type: 'pointerMove', duration: 0, x: width * 0.8, y: height * 0.4 },
            { type: 'pointerDown', button: 0 },
            { type: 'pointerMove', duration: 300, x: width * 0.2, y: height * 0.4 },
            { type: 'pointerUp', button: 0 },
          ],
        },
      ]);
    }

    throw new Error(`Station "${stationName}" not found after scrolling`);
  }

  // ============ ASSERTIONS ============

  /**
   * Check if home screen is displayed
   */
  async isDisplayed(): Promise<boolean> {
    try {
      const welcome = await this.welcomeText;
      return await welcome.isDisplayed();
    } catch {
      return false;
    }
  }

  /**
   * Wait for home screen to be ready
   */
  async waitForScreen(timeout = 15000): Promise<void> {
    await this.waitForAppReady();
    const welcome = await this.welcomeText;
    await this.waitForDisplayed(welcome, timeout);
  }

  /**
   * Get list of displayed station names
   */
  async getDisplayedStations(): Promise<string[]> {
    const stationCards = await this.$$('station-card');
    const names: string[] = [];

    for (const card of stationCards) {
      try {
        const text = await this.getTextSafe(card);
        if (text) {
          names.push(text);
        }
      } catch {
        continue;
      }
    }

    return names;
  }

  /**
   * Check if location permission banner is displayed
   */
  async isLocationPermissionBannerDisplayed(): Promise<boolean> {
    try {
      const banner = await this.locationPermissionBanner;
      return await banner.isDisplayed();
    } catch {
      return false;
    }
  }

  /**
   * Check if stations are loaded
   */
  async hasStations(): Promise<boolean> {
    try {
      // Check if either nearby or favorites section has content
      const nearbyTitle = await this.nearbyStationsTitle;
      if (await nearbyTitle.isDisplayed()) {
        return true;
      }
    } catch {
      // Try favorites
    }

    try {
      const favoritesTitle = await this.favoritesTitle;
      if (await favoritesTitle.isDisplayed()) {
        return true;
      }
    } catch {
      // No stations
    }

    return false;
  }

  /**
   * Check if refresh button is enabled
   */
  async isRefreshButtonEnabled(): Promise<boolean> {
    try {
      const button = await this.refreshButton;
      return await button.isEnabled();
    } catch {
      return false;
    }
  }

  /**
   * Get the welcome message text
   */
  async getWelcomeMessage(): Promise<string> {
    const welcome = await this.welcomeText;
    return await this.getTextSafe(welcome);
  }
}

export default new HomePage();
