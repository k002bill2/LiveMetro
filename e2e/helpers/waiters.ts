/**
 * Custom wait utilities for E2E testing
 * Provides advanced waiting conditions for complex scenarios
 */
import { browser, $, $$ } from '@wdio/globals';

/**
 * Wait for a condition to be true
 * @param condition - Function that returns boolean or Promise<boolean>
 * @param timeout - Maximum wait time in ms
 * @param interval - Check interval in ms
 * @param timeoutMessage - Error message if timeout
 */
export async function waitUntil(
  condition: () => boolean | Promise<boolean>,
  timeout = 10000,
  interval = 500,
  timeoutMessage = 'Condition not met within timeout'
): Promise<void> {
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    const result = await condition();
    if (result) {
      return;
    }
    await browser.pause(interval);
  }

  throw new Error(timeoutMessage);
}

/**
 * Wait for element to have specific text
 * @param element - WebdriverIO element
 * @param expectedText - Text to wait for
 * @param timeout - Maximum wait time in ms
 */
export async function waitForText(
  element: WebdriverIO.Element,
  expectedText: string,
  timeout = 10000
): Promise<void> {
  await waitUntil(
    async () => {
      const text = await element.getText();
      return text === expectedText;
    },
    timeout,
    500,
    `Element did not have expected text "${expectedText}" within ${timeout}ms`
  );
}

/**
 * Wait for element to contain text
 * @param element - WebdriverIO element
 * @param partialText - Partial text to wait for
 * @param timeout - Maximum wait time in ms
 */
export async function waitForTextContains(
  element: WebdriverIO.Element,
  partialText: string,
  timeout = 10000
): Promise<void> {
  await waitUntil(
    async () => {
      const text = await element.getText();
      return text.includes(partialText);
    },
    timeout,
    500,
    `Element did not contain text "${partialText}" within ${timeout}ms`
  );
}

/**
 * Wait for element count
 * @param selector - Selector for elements
 * @param expectedCount - Expected number of elements
 * @param timeout - Maximum wait time in ms
 */
export async function waitForElementCount(
  selector: string,
  expectedCount: number,
  timeout = 10000
): Promise<void> {
  await waitUntil(
    async () => {
      const elements = await $$(selector);
      return elements.length === expectedCount;
    },
    timeout,
    500,
    `Expected ${expectedCount} elements for "${selector}" within ${timeout}ms`
  );
}

/**
 * Wait for minimum element count
 * @param selector - Selector for elements
 * @param minCount - Minimum number of elements
 * @param timeout - Maximum wait time in ms
 */
export async function waitForMinElementCount(
  selector: string,
  minCount: number,
  timeout = 10000
): Promise<void> {
  await waitUntil(
    async () => {
      const elements = await $$(selector);
      return elements.length >= minCount;
    },
    timeout,
    500,
    `Expected at least ${minCount} elements for "${selector}" within ${timeout}ms`
  );
}

/**
 * Wait for element attribute value
 * @param element - WebdriverIO element
 * @param attributeName - Attribute to check
 * @param expectedValue - Expected attribute value
 * @param timeout - Maximum wait time in ms
 */
export async function waitForAttribute(
  element: WebdriverIO.Element,
  attributeName: string,
  expectedValue: string,
  timeout = 10000
): Promise<void> {
  await waitUntil(
    async () => {
      const value = await element.getAttribute(attributeName);
      return value === expectedValue;
    },
    timeout,
    500,
    `Attribute "${attributeName}" did not equal "${expectedValue}" within ${timeout}ms`
  );
}

/**
 * Wait for element to be enabled
 * @param element - WebdriverIO element
 * @param timeout - Maximum wait time in ms
 */
export async function waitForEnabled(
  element: WebdriverIO.Element,
  timeout = 10000
): Promise<void> {
  await waitUntil(
    async () => element.isEnabled(),
    timeout,
    500,
    `Element was not enabled within ${timeout}ms`
  );
}

/**
 * Wait for element to be disabled
 * @param element - WebdriverIO element
 * @param timeout - Maximum wait time in ms
 */
export async function waitForDisabled(
  element: WebdriverIO.Element,
  timeout = 10000
): Promise<void> {
  await waitUntil(
    async () => !(await element.isEnabled()),
    timeout,
    500,
    `Element was not disabled within ${timeout}ms`
  );
}

/**
 * Wait for loading indicator to disappear
 * @param loadingSelector - Selector for loading indicator
 * @param timeout - Maximum wait time in ms
 */
export async function waitForLoadingComplete(
  loadingSelector = '~loading-indicator',
  timeout = 30000
): Promise<void> {
  // First wait for loading to appear (might already be there)
  await browser.pause(500);

  // Then wait for it to disappear
  await waitUntil(
    async () => {
      try {
        const loading = await $(loadingSelector);
        return !(await loading.isDisplayed());
      } catch {
        return true; // Element not found means loading is complete
      }
    },
    timeout,
    500,
    `Loading indicator did not disappear within ${timeout}ms`
  );
}

/**
 * Wait for network idle (no pending requests)
 * Note: This requires app instrumentation to expose network state
 * @param timeout - Maximum wait time in ms
 */
export async function waitForNetworkIdle(_timeout = 10000): Promise<void> {
  // This is a placeholder - actual implementation would depend on
  // how the app exposes network state
  await browser.pause(2000);
}

/**
 * Wait for animation to complete
 * @param timeout - Wait time for animations (default: 500ms)
 */
export async function waitForAnimation(timeout = 500): Promise<void> {
  await browser.pause(timeout);
}

/**
 * Wait for element to be stable (not moving)
 * @param element - WebdriverIO element
 * @param timeout - Maximum wait time in ms
 */
export async function waitForStable(
  element: WebdriverIO.Element,
  timeout = 5000
): Promise<void> {
  let lastLocation = { x: 0, y: 0 };
  let stableCount = 0;
  const requiredStableChecks = 3;
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    const location = await element.getLocation();

    if (location.x === lastLocation.x && location.y === lastLocation.y) {
      stableCount++;
      if (stableCount >= requiredStableChecks) {
        return;
      }
    } else {
      stableCount = 0;
    }

    lastLocation = location;
    await browser.pause(100);
  }

  throw new Error(`Element did not become stable within ${timeout}ms`);
}

/**
 * Retry action until success
 * @param action - Action to retry
 * @param maxRetries - Maximum retry attempts
 * @param retryDelay - Delay between retries in ms
 */
export async function retryAction<T>(
  action: () => Promise<T>,
  maxRetries = 3,
  retryDelay = 1000
): Promise<T> {
  let lastError: Error | undefined;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await action();
    } catch (error) {
      lastError = error as Error;
      if (attempt < maxRetries) {
        await browser.pause(retryDelay);
      }
    }
  }

  throw lastError;
}
