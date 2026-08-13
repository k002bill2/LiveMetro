/**
 * Entry Flow — 익명(둘러보기) 진입으로 Main 탭까지 도달하는 공용 흐름.
 *
 * 익명 로그인 직후의 첫 화면은 상태 플래그에 따라 셋 중 하나다
 * (src/navigation/RootNavigator.tsx의 initialRouteName 우선순위):
 *   - signup-step3  : 가입 축하 화면 (hasSeenSignupCelebration === false)
 *   - welcome-onboarding : 온보딩 웰컴 (축하를 이미 봤고 온보딩 미완료)
 *   - home-screen   : 온보딩까지 완료된 상태
 * 어떤 분기로 와도 CTA/건너뛰기를 눌러 home-screen까지 전진한다.
 * 대기 셀렉터는 전부 앱에 실존하는 testID (2026-08-14 현행화 기준).
 */
import { browser } from '@wdio/globals';
import { BasePage } from '../base.page';

class EntryFlow extends BasePage {
  /**
   * 신규(앱 데이터 초기화된) 세션에서 익명 진입 → Main 탭 home-screen 도달.
   * appium 세션은 noReset:false라 spec 파일마다 앱 데이터가 초기화되어
   * 항상 Auth 랜딩에서 시작한다.
   */
  async enterMainAsAnonymous(timeout = 60000): Promise<void> {
    const hero = await this.$('auth-hero');
    await hero.waitForDisplayed({ timeout: 30000 });
    await this.safeTap(await this.$('browse-cta'));

    const deadline = Date.now() + timeout;
    while (Date.now() < deadline) {
      if (await this.elementExists('home-screen')) {
        return;
      }
      // 가입 축하 화면 → 계속하기
      if (await this.elementExists('signup-step3-cta')) {
        await this.safeTap(await this.$('signup-step3-cta'));
        continue;
      }
      // 온보딩 웰컴 → 시작하기 (다음 스텝부터 건너뛰기 버튼이 생긴다)
      if (await this.elementExists('welcome-cta')) {
        await this.safeTap(await this.$('welcome-cta'));
        continue;
      }
      // 온보딩 위저드 스텝 → 건너뛰기 (OnbHeader 기본 testID)
      if (await this.elementExists('onb-header-skip')) {
        await this.safeTap(await this.$('onb-header-skip'));
        continue;
      }
      await browser.pause(500);
    }
    throw new Error(
      `enterMainAsAnonymous: home-screen에 ${timeout}ms 내 도달하지 못했습니다`
    );
  }
}

export default new EntryFlow();
