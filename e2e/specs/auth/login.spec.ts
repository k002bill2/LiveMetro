/**
 * Authentication Flow E2E Tests
 * Tests for welcome screen, login, and signup functionality
 */
import { browser } from '@wdio/globals';
import welcomePage from '../../page-objects/auth/welcome.page';
import authPage from '../../page-objects/auth/auth.page';
import homePage from '../../page-objects/home/home.page';
import { testUsers, generateTestEmail, generateTestName } from '../../helpers/test-data';

describe('Authentication Flow', () => {
  beforeEach(async () => {
    // Reset app state before each test
    await (browser as WebdriverIO.Browser).terminateApp('com.livemetro.app');
    await (browser as WebdriverIO.Browser).activateApp('com.livemetro.app');
    await welcomePage.waitForScreen();
  });

  describe('Welcome Screen', () => {
    it('should display welcome screen on first launch', async () => {
      // Verify main elements are displayed
      const isDisplayed = await welcomePage.verifyAllElementsDisplayed();
      expect(isDisplayed).toBe(true);
    });

    it('should display app logo and name', async () => {
      const logo = await welcomePage.appLogo;
      const name = await welcomePage.appName;

      expect(await logo.isDisplayed()).toBe(true);
      expect(await name.isDisplayed()).toBe(true);
    });

    it('should display tagline', async () => {
      const tagline = await welcomePage.tagline;
      expect(await tagline.isDisplayed()).toBe(true);
    });

    it('should display all feature items', async () => {
      const featuresDisplayed = await welcomePage.verifyFeaturesDisplayed();
      expect(featuresDisplayed).toBe(true);
    });

    it('should display Get Started and Try Anonymous buttons', async () => {
      const getStarted = await welcomePage.getStartedButton;
      const tryAnonymous = await welcomePage.tryAnonymousButton;

      expect(await getStarted.isDisplayed()).toBe(true);
      expect(await tryAnonymous.isDisplayed()).toBe(true);
    });
  });

  describe('Navigation to Auth Screen', () => {
    it('should navigate to auth screen when tapping Get Started', async () => {
      await welcomePage.tapGetStarted();

      // Wait for auth screen
      await authPage.waitForScreen();
      expect(await authPage.isDisplayed()).toBe(true);
    });

    it('should show login form by default', async () => {
      await welcomePage.tapGetStarted();
      await authPage.waitForScreen();

      expect(await authPage.isLoginMode()).toBe(true);
    });
  });

  describe('Anonymous Login', () => {
    it('should login anonymously and navigate to home from welcome screen', async () => {
      await welcomePage.tapTryAnonymously();

      // Wait for home screen
      await homePage.waitForScreen();
      expect(await homePage.isDisplayed()).toBe(true);
    });

    it('should login anonymously from auth screen', async () => {
      await welcomePage.tapGetStarted();
      await authPage.waitForScreen();

      await authPage.loginAnonymously();

      // Wait for home screen
      await homePage.waitForScreen();
      expect(await homePage.isDisplayed()).toBe(true);
    });
  });

  describe('Email Login', () => {
    it('should login with valid credentials', async () => {
      await welcomePage.tapGetStarted();
      await authPage.waitForScreen();

      await authPage.login(
        testUsers.validUser.email,
        testUsers.validUser.password
      );

      // Wait for home screen
      await homePage.waitForScreen();
      expect(await homePage.isDisplayed()).toBe(true);
    });

    it('should show error with invalid credentials', async () => {
      await welcomePage.tapGetStarted();
      await authPage.waitForScreen();

      await authPage.login(
        testUsers.invalidUser.email,
        testUsers.invalidUser.password
      );

      // Wait for error alert
      await browser.pause(2000);
      const hasError = await authPage.isErrorAlertDisplayed();
      expect(hasError).toBe(true);

      await authPage.dismissAlert();
    });

    it('should validate email format', async () => {
      await welcomePage.tapGetStarted();
      await authPage.waitForScreen();

      await authPage.enterEmail('invalidemail');
      await authPage.enterPassword('password123');
      await authPage.hideKeyboard();
      await authPage.tapSubmit();

      // Wait for error
      await browser.pause(1000);
      const errorMessage = await authPage.getErrorMessage();
      expect(errorMessage).toContain('이메일');
    });

    it('should validate password length', async () => {
      await welcomePage.tapGetStarted();
      await authPage.waitForScreen();

      await authPage.enterEmail('test@example.com');
      await authPage.enterPassword('12345'); // Less than 6 characters
      await authPage.hideKeyboard();
      await authPage.tapSubmit();

      // Wait for error
      await browser.pause(1000);
      const errorMessage = await authPage.getErrorMessage();
      expect(errorMessage).toContain('6자');
    });

    it('should require email to be entered', async () => {
      await welcomePage.tapGetStarted();
      await authPage.waitForScreen();

      await authPage.enterPassword('password123');
      await authPage.hideKeyboard();
      await authPage.tapSubmit();

      // Wait for error
      await browser.pause(1000);
      const errorMessage = await authPage.getErrorMessage();
      expect(errorMessage).toContain('이메일');
    });

    it('should require password to be entered', async () => {
      await welcomePage.tapGetStarted();
      await authPage.waitForScreen();

      await authPage.enterEmail('test@example.com');
      await authPage.hideKeyboard();
      await authPage.tapSubmit();

      // Wait for error
      await browser.pause(1000);
      const errorMessage = await authPage.getErrorMessage();
      expect(errorMessage).toContain('비밀번호');
    });
  });

  describe('Sign Up', () => {
    it('should switch to signup mode', async () => {
      await welcomePage.tapGetStarted();
      await authPage.waitForScreen();

      await authPage.switchToSignUp();

      expect(await authPage.isSignUpMode()).toBe(true);
    });

    it('should show display name field in signup mode', async () => {
      await welcomePage.tapGetStarted();
      await authPage.waitForScreen();

      await authPage.switchToSignUp();

      const displayNameInput = await authPage.displayNameInput;
      expect(await displayNameInput.isDisplayed()).toBe(true);
    });

    it('should require display name for signup', async () => {
      await welcomePage.tapGetStarted();
      await authPage.waitForScreen();

      await authPage.switchToSignUp();
      await authPage.enterEmail(generateTestEmail());
      await authPage.enterPassword('TestPassword123!');
      await authPage.hideKeyboard();
      await authPage.tapSubmit();

      // Wait for error
      await browser.pause(1000);
      const errorMessage = await authPage.getErrorMessage();
      expect(errorMessage).toContain('이름');
    });

    it('should switch back to login mode', async () => {
      await welcomePage.tapGetStarted();
      await authPage.waitForScreen();

      await authPage.switchToSignUp();
      expect(await authPage.isSignUpMode()).toBe(true);

      await authPage.switchToLogin();
      expect(await authPage.isLoginMode()).toBe(true);
    });

    // Note: This test creates a real account - run with caution
    it.skip('should signup with valid credentials', async () => {
      await welcomePage.tapGetStarted();
      await authPage.waitForScreen();

      await authPage.signUp(
        generateTestName(),
        generateTestEmail(),
        'TestPassword123!'
      );

      // Wait for success or home screen
      await homePage.waitForScreen(20000);
      expect(await homePage.isDisplayed()).toBe(true);
    });
  });

  describe('Password Reset', () => {
    it('should show forgot password link in login mode', async () => {
      await welcomePage.tapGetStarted();
      await authPage.waitForScreen();

      const forgotLink = await authPage.forgotPasswordLink;
      expect(await forgotLink.isDisplayed()).toBe(true);
    });

    it('should require email before reset', async () => {
      await welcomePage.tapGetStarted();
      await authPage.waitForScreen();

      await authPage.tapForgotPassword();

      // Wait for error
      await browser.pause(1000);
      const hasError = await authPage.isErrorAlertDisplayed();
      expect(hasError).toBe(true);
    });
  });
});
