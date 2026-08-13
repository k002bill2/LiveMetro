/**
 * Auth Landing Page Object — src/screens/auth/AuthScreen.tsx
 *
 * 앱 신규 설치(비로그인) 첫 화면. 이전의 welcome.page.ts는 앱에 존재하지 않는
 * 'welcome-screen'/'try-anonymous-button' 등 가공 testID를 전제해 전 spec이
 * 죽어 있었다 — 실제 AuthScreen의 testID로 재작성 (2026-08-14 현행화).
 */
import { BasePage } from '../base.page';

class AuthLandingPage extends BasePage {
  // ============ SELECTORS (AuthScreen 실측 testID) ============

  /** 상단 히어로 영역 — 화면 도착 마커 */
  get hero(): Promise<WebdriverIO.Element> {
    return this.$('auth-hero');
  }

  /** 이메일로 시작하기 CTA */
  get emailCta(): Promise<WebdriverIO.Element> {
    return this.$('email-cta');
  }

  /** 둘러보기(익명 로그인) CTA */
  get browseCta(): Promise<WebdriverIO.Element> {
    return this.$('browse-cta');
  }

  get socialGoogle(): Promise<WebdriverIO.Element> {
    return this.$('social-google');
  }

  get socialKakao(): Promise<WebdriverIO.Element> {
    return this.$('social-kakao');
  }

  get socialApple(): Promise<WebdriverIO.Element> {
    return this.$('social-apple');
  }

  // ============ ACTIONS ============

  /**
   * Auth 랜딩 화면이 표시될 때까지 대기.
   * 콜드 스타트 직후 호출되므로 JS 번들 로드 시간을 감안해 넉넉히 기다린다.
   */
  async waitForScreen(timeout = 30000): Promise<void> {
    const hero = await this.hero;
    await hero.waitForDisplayed({ timeout });
  }

  /** 둘러보기(익명) 진입 */
  async tapBrowse(): Promise<void> {
    await this.safeTap(await this.browseCta);
  }
}

export default new AuthLandingPage();
