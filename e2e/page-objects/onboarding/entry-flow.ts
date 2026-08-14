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
   *
   * 기본 timeout 120s: cold AVD(캐시 미적중 2-core 러너)에서는 release 번들
   * 로드 + 익명 auth + 홈 데이터 로드가 60s를 초과한다 — main dispatch run
   * 31758646877에서 3개 spec이 전부 이 지점의 60s 데드라인에서 균일하게
   * 죽은 것으로 실증됨 (warm 런 5/5 그린과 동일 코드).
   */
  async enterMainAsAnonymous(timeout = 120000): Promise<void> {
    // 방어적 멱등성: 이미 Main에 있으면 곧장 반환한다. 현행 구성(spec 파일마다
    // 새 세션 + UiAutomator2 fast reset)에서는 항상 Auth 랜딩부터 시작하지만,
    // noReset 설정이 바뀌어 세션이 재사용되면 auth-hero 대기가 영원히 실패하는
    // 함정을 막는다 (Codex 리뷰 반영).
    if (await this.elementExists('home-screen')) {
      return;
    }
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
      // 익명 로그인 실패 Alert 감지 — AuthScreen.handleAnonymous가
      // signInAnonymously 거부 시 띄우는 다이얼로그가 모든 마커를 가려
      // "120초 침묵 후 타임아웃"이 된다 (run 31761026818: 마커 4종 전무).
      // CI 다연속 실행으로 인한 Firebase Auth 익명 가입 스로틀이 의심 원인.
      // 침묵 대신 즉시 진단 가능한 실패로 바꾼다.
      if (await this.textExists('둘러보기 모드 진입에 실패했습니다')) {
        throw new Error(
          'enterMainAsAnonymous: 익명 로그인 실패 Alert 감지 — ' +
            'signInAnonymously 거부 (Firebase Auth 익명 가입 스로틀/네트워크 오류 의심)'
        );
      }
      await browser.pause(500);
    }
    throw new Error(
      `enterMainAsAnonymous: home-screen에 ${timeout}ms 내 도달하지 못했습니다`
    );
  }
}

export default new EntryFlow();
