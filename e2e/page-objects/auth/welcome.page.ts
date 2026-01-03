/**
 * Welcome Page Object
 * Handles the welcome/onboarding screen interactions
 */
import { BasePage } from '../base.page';

class WelcomePage extends BasePage {
  // ============ SELECTORS ============

  /**
   * Welcome screen container
   */
  get welcomeScreen(): Promise<WebdriverIO.Element> {
    return this.$('welcome-screen');
  }

  /**
   * App logo
   */
  get appLogo(): Promise<WebdriverIO.Element> {
    return this.$('welcome-logo');
  }

  /**
   * App name text
   */
  get appName(): Promise<WebdriverIO.Element> {
    return this.getByText('LiveMetro');
  }

  /**
   * Tagline text
   */
  get tagline(): Promise<WebdriverIO.Element> {
    return this.getByText('실시간 전철 알림');
  }

  /**
   * Get Started button
   */
  get getStartedButton(): Promise<WebdriverIO.Element> {
    return this.$('get-started-button');
  }

  /**
   * Try Anonymous button
   */
  get tryAnonymousButton(): Promise<WebdriverIO.Element> {
    return this.$('try-anonymous-button');
  }

  /**
   * Feature: Real-time notifications
   */
  get featureNotifications(): Promise<WebdriverIO.Element> {
    return this.getByText('실시간 지연 알림');
  }

  /**
   * Feature: Location detection
   */
  get featureLocation(): Promise<WebdriverIO.Element> {
    return this.getByText('주변 역 자동 감지');
  }

  /**
   * Feature: Alternative routes
   */
  get featureRoutes(): Promise<WebdriverIO.Element> {
    return this.getByText('대체 경로 제안');
  }

  // ============ ACTIONS ============

  /**
   * Tap the "Get Started" button to navigate to Auth screen
   */
  async tapGetStarted(): Promise<void> {
    const button = await this.getStartedButton;
    await this.safeTap(button);
  }

  /**
   * Tap the "Try Anonymously" button for anonymous login
   */
  async tapTryAnonymously(): Promise<void> {
    const button = await this.tryAnonymousButton;
    await this.safeTap(button);
  }

  // ============ ASSERTIONS ============

  /**
   * Check if welcome screen is displayed
   */
  async isDisplayed(): Promise<boolean> {
    try {
      const screen = await this.welcomeScreen;
      return await screen.isDisplayed();
    } catch {
      return false;
    }
  }

  /**
   * Wait for welcome screen to be ready
   */
  async waitForScreen(timeout = 15000): Promise<void> {
    await this.waitForAppReady();
    const screen = await this.welcomeScreen;
    await this.waitForDisplayed(screen, timeout);
  }

  /**
   * Verify all main elements are displayed
   */
  async verifyAllElementsDisplayed(): Promise<boolean> {
    try {
      const elements = await Promise.all([
        this.appLogo,
        this.appName,
        this.getStartedButton,
        this.tryAnonymousButton,
      ]);

      for (const element of elements) {
        if (!(await element.isDisplayed())) {
          return false;
        }
      }
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Verify all features are displayed
   */
  async verifyFeaturesDisplayed(): Promise<boolean> {
    try {
      const features = await Promise.all([
        this.featureNotifications,
        this.featureLocation,
        this.featureRoutes,
      ]);

      for (const feature of features) {
        if (!(await feature.isDisplayed())) {
          return false;
        }
      }
      return true;
    } catch {
      return false;
    }
  }
}

export default new WelcomePage();
