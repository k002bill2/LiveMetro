/**
 * Page Source Diagnostic — CI 전용 계측 spec
 *
 * 목적: UiAutomator가 실제로 보는 접근성 트리를 로그로 남긴다.
 * 셀렉터가 못 잡히는 실패(NoSuchElement)가 "id 전략 오류"인지 "앱 미기동/
 * 크래시"인지 "요소 프루닝"인지 원격 CI에서 구분할 유일한 실증 수단이다.
 * assertion이 없어 항상 통과하며, 로그는 `[PAGESRC]` 태그로 grep한다.
 * 파일명 `_diag`는 알파벳 순으로 가장 먼저 실행되게 하기 위함(신규 세션
 * = 앱 데이터 초기화 직후의 첫 화면을 캡처).
 */
import { browser } from '@wdio/globals';

describe('Page Source Diagnostic', () => {
  it('앱 안정화 후 UiAutomator 페이지 소스를 로그로 남긴다', async () => {
    // 릴리스 번들 파싱 + Firebase 초기화 여유
    await browser.pause(20000);
    const source = await browser.getPageSource();
    for (const line of source.split('\n')) {
      // eslint-disable-next-line no-console -- CI 로그 계측이 목적인 spec
      console.log('[PAGESRC]', line.trim().slice(0, 400));
    }
  });
});
