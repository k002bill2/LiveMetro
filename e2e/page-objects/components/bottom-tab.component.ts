/**
 * Bottom Tab Component
 * Handles navigation between main app tabs
 */
import { $ as $wdio } from '@wdio/globals';

import { BasePage } from '../base.page';

class BottomTabComponent extends BasePage {
  // ============ SELECTORS ============

  /**
   * Home tab button
   */
  get homeTab(): Promise<WebdriverIO.Element> {
    return this.getByText('홈');
  }

  /**
   * Favorites tab button
   */
  get favoritesTab(): Promise<WebdriverIO.Element> {
    return this.getByText('즐겨찾기');
  }

  /**
   * Alerts tab button
   */
  get alertsTab(): Promise<WebdriverIO.Element> {
    return this.getByText('알림');
  }

  /**
   * Settings tab button
   */
  get settingsTab(): Promise<WebdriverIO.Element> {
    return this.getByText('설정');
  }

  // ============ ACTIONS ============

  /**
   * Navigate to Home tab
   */
  async tapHome(): Promise<void> {
    const tab = await this.homeTab;
    await this.safeTap(tab);
  }

  /**
   * Navigate to Favorites tab
   */
  async tapFavorites(): Promise<void> {
    const tab = await this.favoritesTab;
    await this.safeTap(tab);
  }

  /**
   * Navigate to Alerts tab
   */
  async tapAlerts(): Promise<void> {
    const tab = await this.alertsTab;
    await this.safeTap(tab);
  }

  /**
   * Navigate to Settings tab
   */
  async tapSettings(): Promise<void> {
    const tab = await this.settingsTab;
    await this.safeTap(tab);
  }

  // ============ ASSERTIONS ============

  /**
   * Check if Home tab is selected
   */
  async isHomeTabSelected(): Promise<boolean> {
    return this.isTabSelected('홈');
  }

  /**
   * Check if Favorites tab is selected
   */
  async isFavoritesTabSelected(): Promise<boolean> {
    return this.isTabSelected('즐겨찾기');
  }

  /**
   * Check if Alerts tab is selected
   */
  async isAlertsTabSelected(): Promise<boolean> {
    return this.isTabSelected('알림');
  }

  /**
   * Check if Settings tab is selected
   */
  async isSettingsTabSelected(): Promise<boolean> {
    return this.isTabSelected('설정');
  }

  /**
   * Check if a specific tab is selected.
   *
   * selected 상태는 라벨 TextView가 아니라 클릭 가능한 탭 버튼(부모 노드)의
   * AccessibilityNodeInfo에 실린다 — 텍스트 노드의 selected는 항상 false다
   * (CI run 31724957819 실증: 탭 이동은 성공했는데 selected 판정만 전부 실패).
   */
  private async isTabSelected(tabName: string): Promise<boolean> {
    try {
      if (this.isAndroid) {
        const button = await $wdio(
          `android=new UiSelector().clickable(true).childSelector(new UiSelector().text("${tabName}"))`
        );
        return (await button.getAttribute('selected')) === 'true';
      }
      const tab = await this.getByText(tabName);
      return (await tab.getAttribute('selected')) === 'true';
    } catch {
      return false;
    }
  }

  /**
   * Check if bottom tab bar is visible
   */
  async isVisible(): Promise<boolean> {
    try {
      const homeTab = await this.homeTab;
      return await homeTab.isDisplayed();
    } catch {
      return false;
    }
  }

  /**
   * Get currently active tab name
   */
  async getActiveTabName(): Promise<string | null> {
    const tabs = ['홈', '즐겨찾기', '알림', '설정'];

    for (const tabName of tabs) {
      if (await this.isTabSelected(tabName)) {
        return tabName;
      }
    }

    return null;
  }
}

export default new BottomTabComponent();
