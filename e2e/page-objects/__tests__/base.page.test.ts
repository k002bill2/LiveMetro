/**
 * BasePage 셀렉터 strict 모드 계약 테스트.
 *
 * wdio 10은 `$`가 2개 이상 매칭되면 StrictSelectorError를 던진다. 다중 매칭이
 * 전제인 조회는 `{ strict: false }`로 v8의 "첫 매칭 + 지연 대기" 동작을 명시하고,
 * 유일성이 보장된 조회는 옵션 없이(=strict) 호출해야 한다. `$$(sel)[0]`은
 * 0개일 때 대기 없이 undefined라 v8과 다르므로 쓰지 않는다.
 */
import { BasePage } from '../base.page';

interface FakeWdioState {
  isAndroid: boolean;
  visible: Set<string>;
  calls: { locator: string; options: unknown }[];
}

jest.mock('@wdio/globals', () => {
  const state = {
    isAndroid: true,
    visible: new Set<string>(),
    calls: [] as { locator: string; options: unknown }[],
  };
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
    },
    $: async (locator: string, options?: unknown) => {
      state.calls.push({ locator, options });
      return {
        isDisplayed: async (): Promise<boolean> => state.visible.has(locator),
        waitForDisplayed: async (): Promise<void> => {},
        click: async (): Promise<void> => {},
      };
    },
    $$: async () => [],
  };
});

const fake = (
  jest.requireMock('@wdio/globals') as unknown as { __state: FakeWdioState }
).__state;

/** protected 헬퍼를 테스트에서 호출하기 위한 노출 서브클래스 */
class ProbePage extends BasePage {
  firstById(testId: string): Promise<WebdriverIO.Element> {
    return this.getFirstById(testId);
  }
  firstByPartialText(text: string): Promise<WebdriverIO.Element> {
    return this.getFirstByPartialText(text);
  }
  firstByClassName(className: string): Promise<WebdriverIO.Element> {
    return this.getFirstByClassName(className);
  }
  byId(testId: string): Promise<WebdriverIO.Element> {
    return this.$(testId);
  }
}
const page = new ProbePage();

const NON_STRICT = { strict: false };

describe('BasePage strict selector contract', () => {
  beforeEach(() => {
    fake.isAndroid = true;
    fake.visible = new Set<string>();
    fake.calls = [];
  });

  describe('strict(기본) 조회', () => {
    it('getByText는 strict 옵션 없이 정확 텍스트 셀렉터를 쓴다', async () => {
      await page.getByText('즐겨찾기가 없습니다');
      expect(fake.calls).toEqual([
        { locator: 'android=new UiSelector().text("즐겨찾기가 없습니다")', options: undefined },
      ]);
    });

    it('testID 조회($)는 strict 옵션 없이 resource-id 셀렉터를 쓴다', async () => {
      await page.byId('station-search-input');
      expect(fake.calls).toEqual([
        { locator: 'android=new UiSelector().resourceId("station-search-input")', options: undefined },
      ]);
    });
  });

  describe('첫 매칭(First) 조회', () => {
    it('getFirstByText는 Android에서 { strict: false }를 넘긴다', async () => {
      await page.getFirstByText('즐겨찾기');
      expect(fake.calls).toEqual([
        { locator: 'android=new UiSelector().text("즐겨찾기")', options: NON_STRICT },
      ]);
    });

    it('getFirstByText는 iOS에서 label == 술어와 { strict: false }를 쓴다', async () => {
      fake.isAndroid = false;
      await page.getFirstByText('즐겨찾기');
      expect(fake.calls).toEqual([
        { locator: '-ios predicate string:label == "즐겨찾기"', options: NON_STRICT },
      ]);
    });

    it('getFirstById는 플랫폼별 testID 셀렉터에 { strict: false }를 넘긴다', async () => {
      await page.firstById('favorite-row-강남');
      fake.isAndroid = false;
      await page.firstById('favorite-row-강남');
      expect(fake.calls).toEqual([
        { locator: 'android=new UiSelector().resourceId("favorite-row-강남")', options: NON_STRICT },
        { locator: '~favorite-row-강남', options: NON_STRICT },
      ]);
    });

    it('getFirstByPartialText / getFirstByClassName도 { strict: false }를 넘긴다', async () => {
      await page.firstByPartialText('오류');
      await page.firstByClassName('android.widget.TextView');
      expect(fake.calls).toEqual([
        { locator: 'android=new UiSelector().textContains("오류")', options: NON_STRICT },
        { locator: 'android=new UiSelector().className("android.widget.TextView")', options: NON_STRICT },
      ]);
    });
  });

  describe('존재 판정은 "1개 이상" 의미라 strict를 쓰지 않는다', () => {
    it('textExists는 { strict: false }로 조회하고 표시 여부를 돌려준다', async () => {
      fake.visible.add('android=new UiSelector().text("둘러보기 모드 진입에 실패했습니다")');
      await expect(page.textExists('둘러보기 모드 진입에 실패했습니다')).resolves.toBe(true);
      expect(fake.calls[0]?.options).toEqual(NON_STRICT);
    });

    it('elementExists는 { strict: false }로 조회하고, 미표시면 false', async () => {
      await expect(page.elementExists('favorite-row-강남')).resolves.toBe(false);
      expect(fake.calls).toEqual([
        { locator: 'android=new UiSelector().resourceId("favorite-row-강남")', options: NON_STRICT },
      ]);
    });

    it('tapAlertButton은 { strict: false }로 버튼을 찾는다 (행 스와이프 라벨 "삭제"와 중복 가능)', async () => {
      await page.tapAlertButton('삭제');
      expect(fake.calls).toEqual([
        { locator: 'android=new UiSelector().text("삭제")', options: NON_STRICT },
      ]);
    });
  });
});
