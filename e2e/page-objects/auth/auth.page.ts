/**
 * Auth Page Object
 * Handles login and signup form interactions
 */
import { BasePage } from '../base.page';

class AuthPage extends BasePage {
  // ============ SELECTORS ============

  /**
   * Login page title
   */
  get loginTitle(): Promise<WebdriverIO.Element> {
    return this.getByText('로그인');
  }

  /**
   * Signup page title
   */
  get signUpTitle(): Promise<WebdriverIO.Element> {
    return this.getByText('계정 만들기');
  }

  /**
   * Email input field
   */
  get emailInput(): Promise<WebdriverIO.Element> {
    return this.$('email-input');
  }

  /**
   * Password input field
   */
  get passwordInput(): Promise<WebdriverIO.Element> {
    return this.$('password-input');
  }

  /**
   * Display name input field (only visible in signup mode)
   */
  get displayNameInput(): Promise<WebdriverIO.Element> {
    return this.$('displayname-input');
  }

  /**
   * Submit button (Login or Sign Up)
   */
  get submitButton(): Promise<WebdriverIO.Element> {
    return this.$('submit-button');
  }

  /**
   * Anonymous login button
   */
  get anonymousLoginButton(): Promise<WebdriverIO.Element> {
    return this.$('anonymous-login-button');
  }

  /**
   * Switch to signup link
   */
  get switchToSignUpLink(): Promise<WebdriverIO.Element> {
    return this.getByText('계정이 없으신가요? 가입하기');
  }

  /**
   * Switch to login link
   */
  get switchToLoginLink(): Promise<WebdriverIO.Element> {
    return this.getByText('이미 계정이 있으신가요? 로그인');
  }

  /**
   * Forgot password link
   */
  get forgotPasswordLink(): Promise<WebdriverIO.Element> {
    return this.getByText('비밀번호를 잊으셨나요?');
  }

  // ============ ACTIONS ============

  /**
   * Enter email address
   */
  async enterEmail(email: string): Promise<void> {
    const field = await this.emailInput;
    await this.typeText(field, email);
  }

  /**
   * Enter password
   */
  async enterPassword(password: string): Promise<void> {
    const field = await this.passwordInput;
    await this.typeText(field, password);
  }

  /**
   * Enter display name (for signup)
   */
  async enterDisplayName(name: string): Promise<void> {
    const field = await this.displayNameInput;
    await this.typeText(field, name);
  }

  /**
   * Tap submit button
   */
  async tapSubmit(): Promise<void> {
    const button = await this.submitButton;
    await this.safeTap(button);
  }

  /**
   * Perform login with email and password
   */
  async login(email: string, password: string): Promise<void> {
    await this.enterEmail(email);
    await this.enterPassword(password);
    await this.hideKeyboard();
    await this.tapSubmit();
  }

  /**
   * Switch to signup mode
   */
  async switchToSignUp(): Promise<void> {
    const link = await this.switchToSignUpLink;
    await this.safeTap(link);
  }

  /**
   * Switch to login mode
   */
  async switchToLogin(): Promise<void> {
    const link = await this.switchToLoginLink;
    await this.safeTap(link);
  }

  /**
   * Perform signup with all fields
   */
  async signUp(
    displayName: string,
    email: string,
    password: string
  ): Promise<void> {
    // Make sure we're in signup mode
    const isLoginMode = await this.isLoginMode();
    if (isLoginMode) {
      await this.switchToSignUp();
    }

    await this.enterDisplayName(displayName);
    await this.enterEmail(email);
    await this.enterPassword(password);
    await this.hideKeyboard();
    await this.tapSubmit();
  }

  /**
   * Tap anonymous login button
   */
  async loginAnonymously(): Promise<void> {
    const button = await this.anonymousLoginButton;
    await this.safeTap(button);
  }

  /**
   * Tap forgot password link
   */
  async tapForgotPassword(): Promise<void> {
    const link = await this.forgotPasswordLink;
    await this.safeTap(link);
  }

  // ============ ASSERTIONS ============

  /**
   * Check if auth screen is displayed
   */
  async isDisplayed(): Promise<boolean> {
    try {
      const email = await this.emailInput;
      return await email.isDisplayed();
    } catch {
      return false;
    }
  }

  /**
   * Check if in login mode
   */
  async isLoginMode(): Promise<boolean> {
    try {
      const title = await this.loginTitle;
      return await title.isDisplayed();
    } catch {
      return false;
    }
  }

  /**
   * Check if in signup mode
   */
  async isSignUpMode(): Promise<boolean> {
    try {
      const title = await this.signUpTitle;
      return await title.isDisplayed();
    } catch {
      return false;
    }
  }

  /**
   * Wait for auth screen to be ready
   */
  async waitForScreen(timeout = 10000): Promise<void> {
    const email = await this.emailInput;
    await this.waitForDisplayed(email, timeout);
  }

  /**
   * Check if error alert is displayed
   */
  async isErrorAlertDisplayed(): Promise<boolean> {
    try {
      if (this.isAndroid) {
        const alert = await $(
          'android=new UiSelector().text("오류")'
        );
        return await alert.isDisplayed();
      } else {
        const alert = await $(
          '-ios predicate string:label CONTAINS "오류"'
        );
        return await alert.isDisplayed();
      }
    } catch {
      return false;
    }
  }

  /**
   * Get error message from alert
   */
  async getErrorMessage(): Promise<string> {
    try {
      // Look for common error messages
      const errorMessages = [
        '올바른 이메일 형식을 입력해주세요',
        '비밀번호는 최소 6자 이상이어야 합니다',
        '이메일을 입력해주세요',
        '비밀번호를 입력해주세요',
        '이름을 입력해주세요',
        '로그인 실패',
        '계정 생성 실패',
      ];

      for (const msg of errorMessages) {
        try {
          const element = await this.getByText(msg);
          if (await element.isDisplayed()) {
            return msg;
          }
        } catch {
          continue;
        }
      }
      return '';
    } catch {
      return '';
    }
  }

  /**
   * Dismiss alert if present
   */
  async dismissAlert(): Promise<void> {
    try {
      const okButton = await this.getByText('확인');
      if (await okButton.isDisplayed()) {
        await okButton.click();
      }
    } catch {
      // No alert to dismiss
    }
  }
}

export default new AuthPage();
