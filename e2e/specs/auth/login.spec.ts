/**
 * Auth Landing E2E Tests — 현행 AuthScreen 기준 (2026-08-14 현행화)
 *
 * 검증 범위: 비로그인 첫 화면 렌더 + 익명(둘러보기) 진입.
 * 이메일/소셜 로그인의 실제 인증은 CI에서 자격증명이 없어 검증하지 않는다
 * (버튼 노출까지만). 테스트 순서 주의: 익명 진입은 앱 데이터에 로그인
 * 상태를 남기므로 반드시 이 파일의 마지막 테스트여야 한다 — appium
 * 세션(noReset:false)은 spec "파일" 단위로만 데이터를 초기화한다.
 */
import { browser } from '@wdio/globals';
import authLanding from '../../page-objects/auth/auth-landing.page';
import entryFlow from '../../page-objects/onboarding/entry-flow';
import homePage from '../../page-objects/home/home.page';

describe('Auth Landing', () => {
  before(async () => {
    await authLanding.waitForScreen();
  });

  describe('첫 화면 렌더', () => {
    it('히어로와 주요 CTA(이메일·둘러보기)가 표시된다', async () => {
      const hero = await authLanding.hero;
      const emailCta = await authLanding.emailCta;
      const browseCta = await authLanding.browseCta;
      expect(await hero.isDisplayed()).toBe(true);
      expect(await emailCta.isDisplayed()).toBe(true);
      expect(await browseCta.isDisplayed()).toBe(true);
    });

    it('소셜 로그인 버튼(구글·카카오, iOS는 애플 포함)이 표시된다', async () => {
      const google = await authLanding.socialGoogle;
      const kakao = await authLanding.socialKakao;
      expect(await google.isDisplayed()).toBe(true);
      expect(await kakao.isDisplayed()).toBe(true);
      // Apple 로그인 버튼은 iOS에서만 렌더된다 (CI run 31720225752 페이지 소스
      // 실증 — Android 트리에 social-apple 부재). iOS에서도 가용성 훅 해석 후
      // 지연 마운트되므로 표시 대기를 선행한다 (Codex 리뷰 반영).
      if (browser.isIOS) {
        const apple = await authLanding.socialApple;
        await apple.waitForDisplayed({ timeout: 10000 });
        expect(await apple.isDisplayed()).toBe(true);
      }
    });
  });

  describe('익명(둘러보기) 진입 — 파일 내 마지막 테스트', () => {
    it('둘러보기로 Main 홈 화면까지 도달한다', async () => {
      await entryFlow.enterMainAsAnonymous();
      // enterMainAsAnonymous가 home-screen 도달을 보장하지만, 명시적으로 재확인
      expect(await homePage.isDisplayed()).toBe(true);
    });
  });
});
