/**
 * useRealtimeTrains → dataManager → arrivalService → real seoulSubwayApi
 * (only `fetch` and AppState listeners are faked).
 *
 * The hook and arrivalService each listen to AppState; these tests pin what the
 * two together send to the network on a foreground return, and what the screen
 * keeps when a poll fails.
 */
import { renderHook, act } from '@testing-library/react-native';
import { AppState, type AppStateStatus } from 'react-native';

// Env must be set before the service modules load (key manager reads it at
// construction) — hence require() below. Fake keys.
['', '_2'].forEach((suffix, i) => {
  process.env[`EXPO_PUBLIC_SEOUL_SUBWAY_API_KEY${suffix}`] = `hook-it-key-${i + 1}`;
});
process.env[`EXPO_PUBLIC_DATA_PORTAL_API_KEY`] = 'hook-it-data-portal';

jest.unmock('@/services/api/seoulSubwayApi');

const mockFetch = jest.fn();
global.fetch = mockFetch;

/* eslint-disable @typescript-eslint/no-var-requires */
const AsyncStorage = require('@react-native-async-storage/async-storage');
const { seoulSubwayApi } = require('@/services/api/seoulSubwayApi');
const { arrivalService } = require('@/services/arrival/arrivalService');
const { useRealtimeTrains } = require('@/hooks/useRealtimeTrains');
/* eslint-enable @typescript-eslint/no-var-requires */

const okResponse = (): Record<string, unknown> => ({
  ok: true,
  json: () =>
    Promise.resolve({
      errorMessage: { status: 200, code: 'INFO-000', message: '정상 처리되었습니다.' },
      realtimeArrivalList: [
        {
          subwayId: '1002',
          updnLine: '상행',
          trainLineNm: '성수행 - 역삼방면',
          statnId: '1002000222',
          statnNm: '강남',
          btrainSttus: '일반',
          barvlDt: '120',
          btrainNo: '2345',
          bstatnNm: '성수',
          recptnDt: '',
          arvlMsg2: '2분 후',
          arvlMsg3: '역삼',
          arvlCd: '99',
          ordkey: '01000강남0',
        },
      ],
    }),
});

describe('useRealtimeTrains + arrivalService + seoulSubwayApi — AppState and error paths', () => {
  let handlers: ((next: AppStateStatus) => void)[];
  // Saved and reassigned (not spyOn+mockRestore) — see useRealtimeTrains.test.ts.
  const originalAddListener = AppState.addEventListener;
  let warnSpy: jest.SpyInstance;
  let errorSpy: jest.SpyInstance;
  const appStateRef = AppState as unknown as { currentState: string };
  let originalState: string;

  /** Mirrors RN: currentState is updated before listeners fire. */
  const dispatch = async (next: AppStateStatus): Promise<void> => {
    appStateRef.currentState = next;
    await act(async () => {
      handlers.slice().forEach((h) => h(next));
    });
  };
  const advance = async (ms: number): Promise<void> => {
    await act(async () => {
      await jest.advanceTimersByTimeAsync(ms);
    });
  };
  const fetches = (): number => mockFetch.mock.calls.length;

  beforeEach(async () => {
    jest.useFakeTimers();
    mockFetch.mockReset();
    mockFetch.mockImplementation(() => Promise.resolve(okResponse()));
    arrivalService.destroy();
    seoulSubwayApi.getRateLimiter().clear();
    seoulSubwayApi.clearInflightRequests();
    seoulSubwayApi.resetKeyStates();
    await AsyncStorage.clear();
    handlers = [];
    originalState = appStateRef.currentState;
    appStateRef.currentState = 'active';
    AppState.addEventListener = ((_type: string, handler: (next: AppStateStatus) => void) => {
      handlers.push(handler);
      return { remove: () => { handlers = handlers.filter((h) => h !== handler); } };
    }) as unknown as typeof AppState.addEventListener;
    warnSpy = jest.spyOn(console, 'warn').mockImplementation();
    errorSpy = jest.spyOn(console, 'error').mockImplementation();
  });

  afterEach(() => {
    arrivalService.destroy();
    AppState.addEventListener = originalAddListener;
    appStateRef.currentState = originalState;
    jest.useRealTimers();
    warnSpy.mockRestore();
    errorSpy.mockRestore();
  });

  it('sends exactly one request on background → active, none on a repeated active', async () => {
    const { unmount } = renderHook(() => useRealtimeTrains('강남'));
    await advance(0);
    expect(fetches()).toBe(1);

    await dispatch('background');
    await advance(120_000);
    expect(fetches()).toBe(1); // paused while backgrounded

    await dispatch('inactive');
    await dispatch('active');
    await advance(100);
    expect(fetches()).toBe(2);

    await dispatch('active');
    await advance(100);
    expect(fetches()).toBe(2);
    unmount();
  });

  it('sends no request on an inactive-only blip', async () => {
    const { unmount } = renderHook(() => useRealtimeTrains('강남'));
    await advance(10_000);
    const before = fetches();

    await dispatch('inactive');
    await dispatch('active');
    await advance(100);

    expect(fetches()).toBe(before);
    unmount();
  });

  it('keeps polling in the background for a guidance (pollInBackground) subscription', async () => {
    const { unmount } = renderHook(() => useRealtimeTrains('강남', { pollInBackground: true }));
    await advance(0);
    const before = fetches();

    await dispatch('background');
    await advance(30_000);

    expect(fetches()).toBe(before + 1);
    unmount();
  });

  it('keeps the last trains and shows an error state when a later poll fails', async () => {
    const { result, unmount } = renderHook(() => useRealtimeTrains('강남'));
    await advance(0);
    expect(result.current.trains).toHaveLength(1);
    expect(result.current.error).toBeNull();

    mockFetch.mockImplementation(() => Promise.reject(new TypeError('Network request failed')));
    await advance(30_000 + 5_000); // next poll + its whole retry chain

    expect(result.current.trains).toHaveLength(1);
    expect(result.current.error).toEqual(expect.stringContaining('데이터 로드 실패'));
    unmount();
  });
});
