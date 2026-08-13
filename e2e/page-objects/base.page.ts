/**
 * Base Page Object
 * Common methods for all page objects in LiveMetro E2E tests
 */
import { browser, $ as $wdio, $$ as $$wdio } from '@wdio/globals';

export class BasePage {
  /**
   * Check if running on Android platform
   */
  protected get isAndroid(): boolean {
    return browser.isAndroid;
  }

  /**
   * Check if running on iOS platform
   */
  protected get isIOS(): boolean {
    return browser.isIOS;
  }

  /**
   * Build the platform-correct locator for a React Native `testID`.
   *
   * Android에서 RN(0.71+)의 testID는 resource-id로 노출되고, `~`(accessibility id)는
   * content-desc(accessibilityLabel)만 매칭한다 — 기존 `~` 단일 전략은 testID를 단 하나도
   * 찾지 못해 전 spec이 대기 타임아웃으로 죽었다 (2026-08-13 nightly 재진단).
   * iOS는 testID가 accessibility identifier로 노출되므로 `~`가 맞다.
   */
  private testIdLocator(testId: string): string {
    return this.isAndroid ? `id=${testId}` : `~${testId}`;
  }

  /**
   * Get element by React Native testID (Android: resource-id, iOS: accessibility id)
   * @param testId - The testID attribute value
   */
  protected $(testId: string): Promise<WebdriverIO.Element> {
    return $wdio(this.testIdLocator(testId));
  }

  /**
   * Get elements by React Native testID
   * @param testId - The testID attribute value
   */
  protected $$(testId: string): Promise<WebdriverIO.ElementArray> {
    return $$wdio(this.testIdLocator(testId));
  }

  /**
   * Get element by text content (cross-platform)
   * @param text - The exact text to search for
   */
  async getByText(text: string): Promise<WebdriverIO.Element> {
    if (this.isAndroid) {
      return $wdio(`android=new UiSelector().text("${text}")`);
    }
    return $wdio(`-ios predicate string:label == "${text}"`);
  }

  /**
   * Get element by partial text
   * @param text - Partial text to search for
   */
  protected async getByPartialText(text: string): Promise<WebdriverIO.Element> {
    if (this.isAndroid) {
      return $wdio(`android=new UiSelector().textContains("${text}")`);
    }
    return $wdio(`-ios predicate string:label CONTAINS "${text}"`);
  }

  /**
   * Get element by class name
   * @param className - The class name to search for
   */
  protected async getByClassName(className: string): Promise<WebdriverIO.Element> {
    if (this.isAndroid) {
      return $wdio(`android=new UiSelector().className("${className}")`);
    }
    return $wdio(`-ios class chain:**/${className}`);
  }

  /**
   * Wait for element to be displayed
   * @param element - WebdriverIO element
   * @param timeout - Maximum wait time in ms (default: 10000)
   */
  async waitForDisplayed(
    element: WebdriverIO.Element,
    timeout = 10000
  ): Promise<void> {
    await element.waitForDisplayed({ timeout });
  }

  /**
   * Wait for element to be clickable
   * @param element - WebdriverIO element
   * @param timeout - Maximum wait time in ms (default: 10000)
   */
  async waitForClickable(
    element: WebdriverIO.Element,
    timeout = 10000
  ): Promise<void> {
    await element.waitForClickable({ timeout });
  }

  /**
   * Wait for element to not be displayed
   * @param element - WebdriverIO element
   * @param timeout - Maximum wait time in ms (default: 10000)
   */
  async waitForNotDisplayed(
    element: WebdriverIO.Element,
    timeout = 10000
  ): Promise<void> {
    await element.waitForDisplayed({ timeout, reverse: true });
  }

  /**
   * Safe tap with wait for clickable
   * @param element - WebdriverIO element to tap
   */
  async safeTap(element: WebdriverIO.Element): Promise<void> {
    await this.waitForClickable(element);
    await element.click();
  }

  /**
   * Type text into input field
   * @param element - WebdriverIO element (input)
   * @param text - Text to type
   * @param clearFirst - Whether to clear existing text first (default: true)
   */
  async typeText(
    element: WebdriverIO.Element,
    text: string,
    clearFirst = true
  ): Promise<void> {
    await this.waitForDisplayed(element);
    if (clearFirst) {
      await element.clearValue();
    }
    await element.setValue(text);
  }

  /**
   * Scroll to element using accessibility ID
   * @param accessibilityId - The testID to scroll to
   */
  async scrollToElement(accessibilityId: string): Promise<WebdriverIO.Element> {
    if (this.isAndroid) {
      // testID는 content-desc가 아니라 resource-id로 노출되므로 resourceId 매처를 쓴다
      return $wdio(
        `android=new UiScrollable(new UiSelector().scrollable(true)).scrollIntoView(new UiSelector().resourceId("${accessibilityId}"))`
      );
    }
    // iOS scroll implementation
    const element = await this.$(accessibilityId);
    await browser.execute('mobile: scroll', {
      direction: 'down',
      element: await element.elementId,
    });
    return element;
  }

  /**
   * Scroll down in the current view
   * @param scrollAmount - Percentage of screen to scroll (0-1)
   */
  async scrollDown(scrollAmount = 0.5): Promise<void> {
    const { height, width } = await browser.getWindowSize();
    const startY = height * 0.7;
    const endY = height * (0.7 - scrollAmount);
    const centerX = width / 2;

    await browser.performActions([
      {
        type: 'pointer',
        id: 'finger1',
        parameters: { pointerType: 'touch' },
        actions: [
          { type: 'pointerMove', duration: 0, x: centerX, y: startY },
          { type: 'pointerDown', button: 0 },
          { type: 'pointerMove', duration: 500, x: centerX, y: endY },
          { type: 'pointerUp', button: 0 },
        ],
      },
    ]);
  }

  /**
   * Scroll up in the current view
   * @param scrollAmount - Percentage of screen to scroll (0-1)
   */
  async scrollUp(scrollAmount = 0.5): Promise<void> {
    const { height, width } = await browser.getWindowSize();
    const startY = height * 0.3;
    const endY = height * (0.3 + scrollAmount);
    const centerX = width / 2;

    await browser.performActions([
      {
        type: 'pointer',
        id: 'finger1',
        parameters: { pointerType: 'touch' },
        actions: [
          { type: 'pointerMove', duration: 0, x: centerX, y: startY },
          { type: 'pointerDown', button: 0 },
          { type: 'pointerMove', duration: 500, x: centerX, y: endY },
          { type: 'pointerUp', button: 0 },
        ],
      },
    ]);
  }

  /**
   * Pull to refresh gesture
   */
  async pullToRefresh(): Promise<void> {
    const { height, width } = await browser.getWindowSize();
    const startY = height * 0.2;
    const endY = height * 0.8;
    const centerX = width / 2;

    await browser.performActions([
      {
        type: 'pointer',
        id: 'finger1',
        parameters: { pointerType: 'touch' },
        actions: [
          { type: 'pointerMove', duration: 0, x: centerX, y: startY },
          { type: 'pointerDown', button: 0 },
          { type: 'pointerMove', duration: 800, x: centerX, y: endY },
          { type: 'pointerUp', button: 0 },
        ],
      },
    ]);
  }

  /**
   * Take screenshot and save to file
   * @param name - Name for the screenshot file
   */
  async takeScreenshot(name: string): Promise<void> {
    await browser.saveScreenshot(`./e2e/screenshots/${name}-${Date.now()}.png`);
  }

  /**
   * Wait for app to be ready (Expo bundle loading)
   * @param timeout - Maximum wait time in ms (default: 15000)
   */
  async waitForAppReady(timeout = 15000): Promise<void> {
    // Initial wait for Expo bundle
    await browser.pause(2000);

    // Try to find a common element that indicates app is ready
    const startTime = Date.now();
    while (Date.now() - startTime < timeout) {
      try {
        // Check for common app elements
        const appContent = await this.$('app-container');
        if (await appContent.isDisplayed()) {
          return;
        }
      } catch {
        // Continue waiting
      }
      await browser.pause(500);
    }
  }

  /**
   * Check if element exists without throwing error
   * @param accessibilityId - The testID to check
   */
  async elementExists(accessibilityId: string): Promise<boolean> {
    try {
      const element = await this.$(accessibilityId);
      return await element.isDisplayed();
    } catch {
      return false;
    }
  }

  /**
   * Get text from element safely
   * @param element - WebdriverIO element
   */
  async getTextSafe(element: WebdriverIO.Element): Promise<string> {
    try {
      return await element.getText();
    } catch {
      return '';
    }
  }

  /**
   * Hide keyboard if visible
   */
  async hideKeyboard(): Promise<void> {
    try {
      if (this.isAndroid) {
        await browser.hideKeyboard();
      } else {
        // iOS: tap outside or press Done
        await browser.execute('mobile: hideKeyboard', {
          key: 'Done',
        });
      }
    } catch {
      // Keyboard might not be visible
    }
  }

  /**
   * Go back (platform-specific)
   */
  async goBack(): Promise<void> {
    if (this.isAndroid) {
      await browser.back();
    } else {
      // iOS: swipe from left edge or tap back button
      const backButton = await this.getByText('Back');
      if (await backButton.isDisplayed()) {
        await backButton.click();
      }
    }
  }
}
