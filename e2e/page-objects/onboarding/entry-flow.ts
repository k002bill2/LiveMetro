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

// 아티팩트 업로드에 포함되는 로그 디렉토리 (.github/workflows/e2e-tests.yml의
// upload path에 e2e/logs/가 있다). __dirname 기준 절대 경로라 wdio 워커의
// CWD와 무관하게 항상 같은 곳에 저장된다 — afterTest 스크린샷이 상대 경로로
// 저장돼 아티팩트에 잡히지 않던 문제의 재발 방지.
const EVIDENCE_DIR = join(__dirname, '..', '..', 'logs');

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
    const startedAt = Date.now();
    let nextObserveAt = startedAt;
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
        console.log(
          `[ENTRY ${elapsed}s] ${present.join(', ') || '(마커 전무)'}`
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
}

export default new EntryFlow();
