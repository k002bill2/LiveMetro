/**
 * AuthLandingPage.waitForScreen 회귀 테스트 — 초기 auth 랜딩 대기의 ANR 내성.
 *
 * 증명 대상 (E2E run 34820586373 회귀 방지):
 *   ANR 내성은 EntryFlow에만 있었고, 초기 랜딩 대기를 직접 하는 경로
 *   (`AuthLandingPage.waitForScreen`)는 `hero.waitForDisplayed()`를 그대로
 *   불렀다. Quickstep ANR 다이얼로그가 **이미 렌더된** auth 랜딩을 덮으면
 *   UiAutomator 트리는 최상위 윈도우만 반영하므로 `auth-hero`가 404가 되어
 *   대기가 예산 내내 실패한다 (아티팩트 세션 7a3d90dd: `android:id/aerr_wait`가
 *   보이고 탭도 성공함이 이미 실증됨 — 셀렉터·앱 문제가 아니다).
 *
 * 누를 대상은 언제나 `aerr_wait` 하나여야 한다: 텍스트는 로케일 의존이고,
 * `aerr_close`를 누르면 테스트 대상 앱이 죽어 flake가 회귀로 오진된다.
 *
 * `@wdio/globals`는 factory mock으로 가로챈다 — factory가 있으면 Jest가 실제
 * 모듈을 require 하지 않으므로 ESM 빌드가 실행될 일이 없다. 화면은 보이는
 * resource-id 집합 하나로 모사하고, id 분기 단일 구현으로 답한다
 * (mockResolvedValueOnce 큐는 폴링 루프가 회차당 여러 번 조회해 누출된다).
 */
import { ANDROID_ANR_WAIT_ID } from '../../../helpers/android-anr-dialog';
import authLanding from '../auth-landing.page';

/** 같은 다이얼로그의 "닫기" — 누르면 대상 앱이 죽으므로 절대 탭하면 안 된다. */
const ANR_CLOSE_ID = 'android:id/aerr_close';

interface FakeWdioState {
  visible: Set<string>;
  taps: string[];
  clock: number;
  isAndroid: boolean;
  onTap: (id: string) => void;
}

jest.mock('@wdio/globals', () => {
  const state = {
    visible: new Set<string>(),
    taps: [] as string[],
    clock: 0,
    isAndroid: true,
    onTap: (_id: string): void => {},
  };
  // BasePage.testIdLocator / getByText 가 만든 셀렉터에서 대상 id를 되꺼낸다.
  const idFromLocator = (locator: string): string => {
    const byResourceId = /resourceId\("([^"]+)"\)/.exec(locator);
    if (byResourceId?.[1] !== undefined) {
      return byResourceId[1];
    }
    const byText = /text\("([^"]+)"\)/.exec(locator);
    if (byText?.[1] !== undefined) {
      return byText[1];
    }
    return locator.replace(/^~/, '');
  };
  const makeElement = (
    id: string
  ): {
    isDisplayed: () => Promise<boolean>;
    click: () => Promise<void>;
    waitForDisplayed: () => Promise<void>;
  } => ({
    isDisplayed: async (): Promise<boolean> => state.visible.has(id),
    click: async (): Promise<void> => {
      state.taps.push(id);
      state.onTap(id);
    },
    waitForDisplayed: async (): Promise<void> => {
      if (!state.visible.has(id)) {
        throw new Error(`element not displayed: ${id}`);
      }
    },
  });
  return {
    __state: state,
    browser: {
      get isAndroid(): boolean {
        return state.isAndroid;
      },
      get isIOS(): boolean {
        return !state.isAndroid;
      },
      capabilities: {},
      pause: async (ms: number): Promise<void> => {
        state.clock += ms;
      },
      getPageSource: async (): Promise<string> => '<hierarchy />',
      saveScreenshot: async (): Promise<void> => {},
    },
    $: async (locator: string) => makeElement(idFromLocator(locator)),
    $$: async () => [],
  };
});

const screen = (
  jest.requireMock('@wdio/globals') as unknown as { __state: FakeWdioState }
).__state;

/** 화면을 통째로 교체한다 — 실기기에서 한 화면이 다음 화면으로 바뀌는 것과 동형. */
function showOnly(...ids: readonly string[]): void {
  screen.visible = new Set(ids);
}

describe('authLanding.waitForScreen', () => {
  beforeEach(() => {
    screen.visible = new Set<string>();
    screen.taps = [];
    screen.clock = 0;
    screen.isAndroid = true;
    screen.onTap = (): void => {};
    // 가짜 시계: browser.pause가 clock을 전진시키므로 Date.now를 묶어야
    // 30초 예산 루프가 wall-clock이 아니라 목 시계로 흐른다.
    jest.spyOn(Date, 'now').mockImplementation(() => screen.clock);
    jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('초기 랜딩을 덮은 시스템 ANR을 aerr_wait로만 해제하고 auth-hero에 도달한다', async () => {
    // 콜드 스타트 직후 Quickstep ANR이 이미 렌더된 랜딩을 덮은 상태 —
    // 앱 testID는 전부 404이고 AOSP 다이얼로그 버튼만 보인다.
    showOnly(ANDROID_ANR_WAIT_ID, ANR_CLOSE_ID);
    screen.onTap = (id: string): void => {
      // "대기"를 누르면 다이얼로그가 걷히고 그 아래 랜딩이 드러난다.
      if (id === ANDROID_ANR_WAIT_ID) {
        showOnly('auth-hero', 'browse-cta');
      }
    };

    await authLanding.waitForScreen();

    expect(screen.taps).toEqual([ANDROID_ANR_WAIT_ID]);
  });
});
