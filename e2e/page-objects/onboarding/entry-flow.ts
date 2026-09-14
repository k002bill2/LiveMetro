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
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { browser } from '@wdio/globals';
import { BasePage } from '../base.page';
import {
  dismissSystemAnrIfPresent,
  waitForElementDismissingAnr,
  type AnrTolerantWaitDeps,
} from '../../helpers/android-anr-dialog';

// 아티팩트 업로드에 포함되는 로그 디렉토리 (.github/workflows/e2e-tests.yml의
// upload path에 e2e/logs/가 있다). __dirname 기준 절대 경로라 wdio 워커의
// CWD와 무관하게 항상 같은 곳에 저장된다 — afterTest 스크린샷이 상대 경로로
// 저장돼 아티팩트에 잡히지 않던 문제의 재발 방지.
const EVIDENCE_DIR = join(__dirname, '..', '..', 'logs');

// Auth 랜딩 대기 예산. 기존 값(30s)을 유지한다 — ANR 내성은 예산을 늘리는 게
// 아니라 같은 예산 안에서 화면을 덮은 시스템 다이얼로그를 걷어내는 것이다.
const AUTH_LANDING_TIMEOUT_MS = 30000;
// 내성 대기가 실패한 뒤 한 번 더 짧게 기다려, 실패를 wdio 표준 타임아웃 에러
// 형태로 낸다 (기존 실패 메시지·스택 모양을 보존해 진단 습관을 깨지 않는다).
const AUTH_LANDING_FINAL_TIMEOUT_MS = 1000;

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
    await this.waitForAuthLanding();
    await this.safeTap(await this.$('browse-cta'));

    const deadline = Date.now() + timeout;
    const startedAt = Date.now();
    let nextObserveAt = startedAt;
    let anrDismissals = 0;
    while (Date.now() < deadline) {
      // 자가 진단 관측 (run 31765235108 실증 후 추가): 같은 run에서 첫
      // 세션은 15초 만에 celebration 도달, 이후 세션은 120초간 아래 4개
      // 마커가 전부 404였다 — 루프가 관측하지 않는 화면(랜딩 스피너·ANR
      // 다이얼로그 등)에 갇혔다는 뜻이다. 15초마다 랜딩 마커 포함 관측
      // 로그를 남겨 모든 실패 spec이 정체 화면을 스스로 보고하게 한다.
      if (Date.now() >= nextObserveAt) {
        const elapsed = Math.round((Date.now() - startedAt) / 1000);
        const present: string[] = [];
        if (await this.elementExists('auth-hero')) present.push('auth-hero');
        if (await this.elementExists('home-screen')) present.push('home-screen');
        if (await this.elementExists('signup-step3-cta')) {
          present.push('signup-step3-cta');
        }
        if (await this.elementExists('welcome-cta')) present.push('welcome-cta');
        if (await this.elementExists('onb-header-skip')) {
          present.push('onb-header-skip');
        }
        const anrNote = anrDismissals > 0 ? ` / ANR해제 ${anrDismissals}회` : '';
        console.log(
          `[ENTRY ${elapsed}s] ${present.join(', ') || '(마커 전무)'}${anrNote}`
        );
        nextObserveAt = Date.now() + 15000;
      }
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
      // 시스템 ANR 다이얼로그 해제. 앱 마커 5종도, 익명 로그인 실패 Alert도
      // 못 찾은 뒤에만 시도한다(대상 우선) — 정상 화면에서 랜딩 CTA를 잘못
      // 누르는 일을 구조적으로 막는다. run 34776888207에서 Quickstep ANR이
      // CTA 탭 직후에도 화면을 덮어, 초기 랜딩 대기의 1회 해제만으로는
      // 부족함이 entry-stall-*.xml 6건으로 실증됐다.
      if (await dismissSystemAnrIfPresent(this.anrDeps(), this.isAndroid)) {
        anrDismissals += 1;
        if (anrDismissals === 1) {
          console.log('[ENTRY ANR] 진입 루프에서 시스템 ANR 대기 버튼 해제');
        }
      }
      // 해제 여부와 무관하게 항상 쉰다 — 탭이 먹지 않는 다이얼로그에서
      // 무지연 클릭 폭주가 되는 것을 막고, 다음 회차가 마커를 재평가한다.
      await browser.pause(500);
    }
    // 데드라인 도달 — 정체 화면의 실체를 파일로 남긴다 (XML + 스크린샷).
    // 콘솔 로그는 wdio 로거의 절단 의심이 있어(run 31767590757의 트리가
    // 도착역 행 없이 117줄에서 닫힘) 증거는 파일 저장이 정본이다. UiAutomator
    // 트리는 최상위 윈도우(예: 시스템 ANR 다이얼로그)를 반영하므로 앱 마커
    // 404의 원인을 이 덤프가 확정한다.
    try {
      mkdirSync(EVIDENCE_DIR, { recursive: true });
      const stamp = Date.now();
      writeFileSync(
        join(EVIDENCE_DIR, `entry-stall-${stamp}.xml`),
        await browser.getPageSource()
      );
      await browser.saveScreenshot(
        join(EVIDENCE_DIR, `entry-stall-${stamp}.png`)
      );
      console.log(`[ENTRY PAGESRC] e2e/logs/entry-stall-${stamp}.{xml,png} 저장됨`);
    } catch (evidenceError) {
      console.log(`[ENTRY PAGESRC] 증거 저장 실패: ${String(evidenceError)}`);
    }
    throw new Error(
      `enterMainAsAnonymous: home-screen에 ${timeout}ms 내 도달하지 못했습니다`
    );
  }

  /**
   * Auth 랜딩(auth-hero) 표시 대기 — Android 시스템 ANR 다이얼로그에 내성.
   *
   * run 34159050379에서 런처(Quickstep) ANR 다이얼로그가 **이미 렌더된** auth
   * 랜딩을 덮어 3개 spec 전부가 이 대기에서 죽었다. 같은 SHA가 이어진 두
   * 스케줄 런에서 그린이었으므로 앱 회귀가 아니라 호스티드 에뮬레이터 flake다.
   * 해제는 resource-id(`android:id/aerr_wait`)로만 한다 — 텍스트는 로케일
   * 의존이고, 닫기/강제 종료 계열을 누르면 앱이 죽어 flake가 회귀로 오진된다.
   */
  /**
   * ANR 헬퍼에 주입할 wdio 어댑터. 초기 랜딩 대기와 진입 lifecycle 루프가
   * 같은 어댑터를 공유해 "wait 버튼만 탭" 규칙이 한 곳에만 존재하게 한다.
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

  private async waitForAuthLanding(): Promise<void> {
    const { reached, anrDismissals } = await waitForElementDismissingAnr(
      'auth-hero',
      this.anrDeps(),
      {
        timeout: AUTH_LANDING_TIMEOUT_MS,
        probeSystemAnr: this.isAndroid,
      }
    );
    if (anrDismissals > 0) {
      console.log(
        `[ENTRY ANR] 시스템 ANR 대기 버튼 ${anrDismissals}회 해제 후 진행`
      );
    }
    if (!reached) {
      // 내성 대기로도 못 찾았다 — 평소와 같은 실패로 끝낸다.
      await (await this.$('auth-hero')).waitForDisplayed({
        timeout: AUTH_LANDING_FINAL_TIMEOUT_MS,
      });
    }
  }
}

export default new EntryFlow();
