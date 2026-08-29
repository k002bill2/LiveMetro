/**
 * [DIAG] 익명 진입 정체 프로브 — 무단언 진단 spec.
 *
 * 배경: run 31761026818·31763217242에서 browse-cta 탭 후 120초간
 * 마커 4종(home-screen/signup-step3-cta/welcome-cta/onb-header-skip)과
 * 오류 Alert가 모두 부재한 "무음 정체"가 관측됐다. 정체 중 화면이
 * Auth 랜딩(signInAnonymously 행)인지, 홈 LoadingScreen(위치 로딩)인지,
 * 제3의 화면인지 이 프로브가 1-run으로 확정한다.
 *
 * 동작: 진입 CTA 탭 후 15초 간격으로 광역 마커 세트의 존재를 로깅하고
 * ([ENTRYPROBE] 태그), 120초까지 home-screen 미도달이면 페이지 소스
 * 전체를 덤프한다 ([ENTRYPROBE PAGESRC]). 정상 도달 시 즉시 종료라
 * 그린 환경에서의 비용은 수 초다. 단언이 없어 결과에 영향을 주지 않는다.
 */
import { browser } from '@wdio/globals';
import { BasePage } from '../../page-objects/base.page';

class EntryProbe extends BasePage {
  async run(): Promise<void> {
    const hero = await this.$('auth-hero');
    await hero.waitForDisplayed({ timeout: 30000 });
    await this.safeTap(await this.$('browse-cta'));

    const markers: [string, () => Promise<boolean>][] = [
      ['auth-hero(랜딩)', () => this.elementExists('auth-hero')],
      ['auth-autologin', () => this.elementExists('auth-autologin')],
      ['home-screen', () => this.elementExists('home-screen')],
      ['signup-step3-cta', () => this.elementExists('signup-step3-cta')],
      ['welcome-cta', () => this.elementExists('welcome-cta')],
      ['onb-header-skip', () => this.elementExists('onb-header-skip')],
      [
        'alert:둘러보기실패',
        () => this.textExists('둘러보기 모드 진입에 실패했습니다'),
      ],
      [
        'loading:주변역',
        () => this.textExists('주변 역 정보를 가져오고 있습니다...'),
      ],
    ];

    for (let elapsed = 0; elapsed <= 120; elapsed += 15) {
      const present: string[] = [];
      for (const [name, check] of markers) {
        if (await check()) {
          present.push(name);
        }
      }
      console.log(`[ENTRYPROBE ${elapsed}s] ${present.join(', ') || '(none)'}`);
      if (present.includes('home-screen')) {
        return;
      }
      await browser.pause(15000);
    }

    console.log('[ENTRYPROBE PAGESRC]');
    console.log(await browser.getPageSource());
  }
}

const probe = new EntryProbe();

describe('[DIAG] 익명 진입 정체 프로브', () => {
  it('진입 CTA 탭 후 화면 상태를 주기 로깅한다 (무단언)', async () => {
    await probe.run();
  });
});
