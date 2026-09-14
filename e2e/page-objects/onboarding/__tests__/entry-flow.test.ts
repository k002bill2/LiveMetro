/**
 * enterMainAsAnonymous 회귀 테스트 — browse CTA 이후 lifecycle loop의 ANR 내성.
 *
 * 증명 대상 (E2E run 34776888207 회귀 방지):
 *   초기 auth 랜딩 대기만 ANR 내성을 갖고 있어, browse CTA 탭 뒤 120초 진입
 *   루프에서 Quickstep ANR 다이얼로그가 앱 마커 5종을 전부 덮으면 루프가
 *   해제를 시도하지 못한 채 데드라인까지 침묵한다 (artifact entry-stall-*.xml
 *   6건 전부 `Quickstep isn't responding` + `aerr_wait`/`aerr_close` 기록).
 *
 * `@wdio/globals`는 factory mock으로 가로챈다 — factory가 있으면 Jest가 실제
 * 모듈을 require 하지 않으므로 ESM 빌드가 실행될 일이 없다. 화면은 보이는
 * resource-id 집합 하나로 모사하고, id 분기 단일 구현으로 답한다
 * (mockResolvedValueOnce 큐는 루프가 회차당 5회 이상 조회해 누출된다).
 */
import { ANDROID_ANR_WAIT_ID } from '../../../helpers/android-anr-dialog';
import entryFlow from '../entry-flow';

/** 같은 다이얼로그의 "닫기" — 누르면 대상 앱이 죽으므로 절대 탭하면 안 된다. */
const ANR_CLOSE_ID = 'android:id/aerr_close';

interface FakeWdioState {
  visible: Set<string>;
  taps: string[];
  clock: number;
  isAndroid: boolean;
  onTap: (id: string) => void;
}

jest.mock('node:fs', () => ({
  ...jest.requireActual<typeof import('node:fs')>('node:fs'),
  mkdirSync: jest.fn(),
  writeFileSync: jest.fn(),
}));

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

describe('entryFlow.enterMainAsAnonymous', () => {
  beforeEach(() => {
    screen.visible = new Set<string>();
    screen.taps = [];
    screen.clock = 0;
    screen.isAndroid = true;
    screen.onTap = (): void => {};
    jest.spyOn(Date, 'now').mockImplementation(() => screen.clock);
    jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('ANR 없는 정상 경로: 랜딩 → browse CTA → 웰컴 → home-screen', async () => {
    showOnly('auth-hero', 'browse-cta');
    screen.onTap = (id: string): void => {
      if (id === 'browse-cta') showOnly('welcome-cta');
      if (id === 'welcome-cta') showOnly('home-screen');
    };

    await entryFlow.enterMainAsAnonymous(10000);

    expect(screen.taps).toEqual(['browse-cta', 'welcome-cta']);
  });

  it('browse CTA 이후 시스템 ANR이 마커를 덮으면 aerr_wait만 눌러 해제하고 진행한다', async () => {
    showOnly('auth-hero', 'browse-cta');
    screen.onTap = (id: string): void => {
      // CTA 직후 Quickstep ANR이 떠 앱 마커 5종이 전부 404가 된 상태
      // (artifact entry-stall-*.xml 이 기록한 바로 그 화면).
      if (id === 'browse-cta') showOnly(ANDROID_ANR_WAIT_ID, ANR_CLOSE_ID);
      // "대기"를 누르면 다이얼로그가 걷히고 그 아래 앱이 드러난다.
      if (id === ANDROID_ANR_WAIT_ID) showOnly('home-screen');
    };

    await entryFlow.enterMainAsAnonymous(10000);

    expect(screen.taps).toEqual(['browse-cta', ANDROID_ANR_WAIT_ID]);
  });

  it('정상 마커가 함께 보이면 ANR 버튼을 건드리지 않고 앱 CTA를 누른다', async () => {
    showOnly('auth-hero', 'browse-cta');
    screen.onTap = (id: string): void => {
      if (id === 'browse-cta') showOnly('welcome-cta', ANDROID_ANR_WAIT_ID);
      if (id === 'welcome-cta') showOnly('home-screen');
    };

    await entryFlow.enterMainAsAnonymous(10000);

    expect(screen.taps).toEqual(['browse-cta', 'welcome-cta']);
  });

  it('비-Android에서는 ANR 대기 버튼이 떠 있어도 탭하지 않는다', async () => {
    screen.isAndroid = false;
    showOnly('auth-hero', 'browse-cta');
    screen.onTap = (id: string): void => {
      if (id === 'browse-cta') showOnly(ANDROID_ANR_WAIT_ID, ANR_CLOSE_ID);
    };

    await expect(entryFlow.enterMainAsAnonymous(3000)).rejects.toThrow(
      'home-screen에 3000ms 내 도달하지 못했습니다'
    );
    expect(screen.taps).toEqual(['browse-cta']);
  });
});
