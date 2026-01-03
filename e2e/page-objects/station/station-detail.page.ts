/**
 * Station Detail Page Object
 * Handles station detail screen interactions
 */
import { browser } from '@wdio/globals';
import { BasePage } from '../base.page';

class StationDetailPage extends BasePage {
  // ============ SELECTORS ============

  /**
   * Station name header
   */
  get stationName(): Promise<WebdriverIO.Element> {
    return this.$('station-name');
  }

  /**
   * Line indicator
   */
  get lineIndicator(): Promise<WebdriverIO.Element> {
    return this.$('line-indicator');
  }

  /**
   * Previous station button
   */
  get prevStationButton(): Promise<WebdriverIO.Element> {
    return this.$('prev-station-button');
  }

  /**
   * Next station button
   */
  get nextStationButton(): Promise<WebdriverIO.Element> {
    return this.$('next-station-button');
  }

  /**
   * Arrival list
   */
  get arrivalList(): Promise<WebdriverIO.Element> {
    return this.$('arrival-list');
  }

  /**
   * Departure tab
   */
  get departureTab(): Promise<WebdriverIO.Element> {
    return this.getByText('출발');
  }

  /**
   * Arrival tab
   */
  get arrivalTab(): Promise<WebdriverIO.Element> {
    return this.getByText('도착');
  }

  /**
   * Timetable tab
   */
  get timetableTab(): Promise<WebdriverIO.Element> {
    return this.getByText('시간표');
  }

  /**
   * Favorite button/tab
   */
  get favoriteButton(): Promise<WebdriverIO.Element> {
    return this.getByText('즐겨찾기');
  }

  /**
   * Refresh button
   */
  get refreshButton(): Promise<WebdriverIO.Element> {
    return this.$('refresh-button');
  }

  /**
   * Loading indicator
   */
  get loadingIndicator(): Promise<WebdriverIO.Element> {
    return this.$('loading-indicator');
  }

  /**
   * Error message
   */
  get errorMessage(): Promise<WebdriverIO.Element> {
    return this.$('error-message');
  }

  /**
   * Arriving soon indicator
   */
  get arrivingSoonIndicator(): Promise<WebdriverIO.Element> {
    return this.getByText('곧 도착');
  }

  // ============ ACTIONS ============

  /**
   * Tap on departure tab
   */
  async tapDepartureTab(): Promise<void> {
    const tab = await this.departureTab;
    await this.safeTap(tab);
  }

  /**
   * Tap on arrival tab
   */
  async tapArrivalTab(): Promise<void> {
    const tab = await this.arrivalTab;
    await this.safeTap(tab);
  }

  /**
   * Tap on timetable tab
   */
  async tapTimetableTab(): Promise<void> {
    const tab = await this.timetableTab;
    await this.safeTap(tab);
  }

  /**
   * Tap on favorite button
   */
  async tapFavoriteButton(): Promise<void> {
    const button = await this.favoriteButton;
    await this.safeTap(button);
  }

  /**
   * Tap previous station button
   */
  async tapPrevStation(): Promise<void> {
    const button = await this.prevStationButton;
    await this.safeTap(button);
  }

  /**
   * Tap next station button
   */
  async tapNextStation(): Promise<void> {
    const button = await this.nextStationButton;
    await this.safeTap(button);
  }

  /**
   * Tap refresh button
   */
  async tapRefresh(): Promise<void> {
    const button = await this.refreshButton;
    await this.safeTap(button);
  }

  /**
   * Pull to refresh
   */
  async refresh(): Promise<void> {
    await this.pullToRefresh();
  }

  /**
   * Switch to specific tab
   */
  async switchToTab(
    tabName: '출발' | '도착' | '시간표' | '즐겨찾기'
  ): Promise<void> {
    const tab = await this.getByText(tabName);
    await this.safeTap(tab);
  }

  // ============ ASSERTIONS ============

  /**
   * Check if station detail screen is displayed
   */
  async isDisplayed(): Promise<boolean> {
    try {
      const name = await this.stationName;
      return await name.isDisplayed();
    } catch {
      // Try alternative check
      try {
        const departure = await this.departureTab;
        return await departure.isDisplayed();
      } catch {
        return false;
      }
    }
  }

  /**
   * Get current station name
   */
  async getStationName(): Promise<string> {
    const name = await this.stationName;
    return await this.getTextSafe(name);
  }

  /**
   * Check if loading is in progress
   */
  async isLoading(): Promise<boolean> {
    try {
      const loading = await this.loadingIndicator;
      return await loading.isDisplayed();
    } catch {
      return false;
    }
  }

  /**
   * Check if error is displayed
   */
  async isErrorDisplayed(): Promise<boolean> {
    try {
      const error = await this.errorMessage;
      return await error.isDisplayed();
    } catch {
      return false;
    }
  }

  /**
   * Check if arrivals are displayed
   */
  async hasArrivals(): Promise<boolean> {
    try {
      const list = await this.arrivalList;
      return await list.isDisplayed();
    } catch {
      return false;
    }
  }

  /**
   * Get arrival messages
   */
  async getArrivalMessages(): Promise<string[]> {
    const messages: string[] = [];

    try {
      // Look for arrival time elements
      const arrivals = await this.$$('train-arrival-card');
      for (const arrival of arrivals) {
        const text = await this.getTextSafe(arrival);
        if (text) {
          messages.push(text);
        }
      }
    } catch {
      // No arrivals found
    }

    return messages;
  }

  /**
   * Check if train is arriving soon
   */
  async isTrainArrivingSoon(): Promise<boolean> {
    try {
      const indicator = await this.arrivingSoonIndicator;
      return await indicator.isDisplayed();
    } catch {
      return false;
    }
  }

  /**
   * Wait for screen to be ready
   */
  async waitForScreen(timeout = 10000): Promise<void> {
    // Wait for either station name or departure tab
    const startTime = Date.now();
    while (Date.now() - startTime < timeout) {
      if (await this.isDisplayed()) {
        return;
      }
      await browser.pause(500);
    }
    throw new Error('Station detail screen did not load within timeout');
  }

  /**
   * Wait for arrivals to load
   */
  async waitForArrivals(timeout = 15000): Promise<void> {
    const startTime = Date.now();
    while (Date.now() - startTime < timeout) {
      // Wait for loading to complete
      const isLoading = await this.isLoading();
      if (!isLoading) {
        // Check if arrivals are displayed
        if (await this.hasArrivals()) {
          return;
        }
      }
      await browser.pause(500);
    }
    throw new Error('Arrivals did not load within timeout');
  }

  /**
   * Check if previous station button is enabled
   */
  async isPrevStationEnabled(): Promise<boolean> {
    try {
      const button = await this.prevStationButton;
      return await button.isEnabled();
    } catch {
      return false;
    }
  }

  /**
   * Check if next station button is enabled
   */
  async isNextStationEnabled(): Promise<boolean> {
    try {
      const button = await this.nextStationButton;
      return await button.isEnabled();
    } catch {
      return false;
    }
  }
}

export default new StationDetailPage();
