/**
 * Auth Landing Page Object — src/screens/auth/AuthScreen.tsx
 *
 * 앱 신규 설치(비로그인) 첫 화면. 이전의 welcome.page.ts는 앱에 존재하지 않는
 * 'welcome-screen'/'try-anonymous-button' 등 가공 testID를 전제해 전 spec이
 * 죽어 있었다 — 실제 AuthScreen의 testID로 재작성 (2026-08-14 현행화).
 */
import { browser } from '@wdio/globals';
import { BasePage } from '../base.page';
import {
  waitForElementDismissingAnr,
  type AnrTolerantWaitDeps,
} from '../../helpers/android-anr-dialog';

// 내성 대기가 실패한 뒤 한 번 더 짧게 기다려, 실패를 wdio 표준 타임아웃 에러
// 형태로 낸다 (기존 실패 메시지·스택 모양을 보존해 진단 습관을 깨지 않는다).
// EntryFlow.waitForAuthLanding과 같은 값 — 두 경로의 실패 모양을 일치시킨다.
const AUTH_LANDING_FINAL_TIMEOUT_MS = 1000;

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
   * Auth 랜딩 화면이 표시될 때까지 대기 — Android 시스템 ANR 다이얼로그에 내성.
   * 콜드 스타트 직후 호출되므로 JS 번들 로드 시간을 감안해 넉넉히 기다린다.
   *
   * run 34820586373에서 런처(Quickstep) ANR 다이얼로그가 **이미 렌더된** auth
   * 랜딩을 덮어 이 대기가 죽었다 — UiAutomator 트리는 최상위 윈도우만 반영하므로
   * 앱 testID가 전부 404가 된다. 아티팩트 세션 7a3d90dd가 `aerr_wait` 탭 성공을
   * 실증했으므로 셀렉터·앱 회귀가 아니라 호스티드 에뮬레이터 flake다. 해제는
   * resource-id(`android:id/aerr_wait`)로만 한다 — 텍스트는 로케일 의존이고,
   * 닫기/강제 종료 계열을 누르면 앱이 죽어 flake가 회귀로 오진된다.
   *
   * 예산(기본 30초)은 그대로다: 내성은 더 오래 기다리는 게 아니라 같은 예산
   * 안에서 화면을 덮은 시스템 다이얼로그를 걷어내는 것이다.
   */
  async waitForScreen(timeout = 30000): Promise<void> {
    const { reached, anrDismissals } = await waitForElementDismissingAnr(
      'auth-hero',
      this.anrDeps(),
      { timeout, probeSystemAnr: this.isAndroid }
    );
    if (anrDismissals > 0) {
      console.log(
        `[AUTH ANR] 시스템 ANR 대기 버튼 ${anrDismissals}회 해제 후 진행`
      );
    }
    if (!reached) {
      // 내성 대기로도 못 찾았다 — 평소와 같은 실패로 끝낸다.
      await (await this.hero).waitForDisplayed({
        timeout: AUTH_LANDING_FINAL_TIMEOUT_MS,
      });
    }
  }

  /** 둘러보기(익명) 진입 */
  async tapBrowse(): Promise<void> {
    await this.safeTap(await this.browseCta);
  }

  /**
   * ANR 헬퍼에 주입할 wdio 어댑터. "wait 버튼만 탭" 규칙 자체는
   * helpers/android-anr-dialog.ts에 단일 소스로 있고, 여기 있는 것은
   * 탐지·탭·대기·시계를 wdio에 잇는 배선뿐이다.
   */
  private anrDeps(): AnrTolerantWaitDeps {
    return {
      isDisplayed: (id: string): Promise<boolean> => this.elementExists(id),
      tap: async (id: string): Promise<void> => {
        try {
          await (await this.$(id)).click();
        } catch {
          // 탐지와 탭 사이에 다이얼로그가 스스로 닫힌 경우 — 다음 폴링이 재판정한다.
        }
      },
      pause: async (ms: number): Promise<void> => {
        // browser.pause 는 Promise<unknown> 으로 타입돼 있어 await 로 흘린다.
        await browser.pause(ms);
      },
      now: (): number => Date.now(),
    };
  }
}

export default new AuthLandingPage();
