# Test Examples — Component · Hook · Service

LiveMetro 도메인 기준 Jest 테스트 작성 템플릿. **반드시 Happy + Error + Edge 케이스 모두 작성**.

## Component Test 템플릿

```typescript
describe('StationCard', () => {
  const mockStation = {
    stationId: 'ST001',
    stationName: '강남',
    lineId: '2',
  };

  it('renders station name correctly', () => {
    render(<StationCard station={mockStation} />);
    expect(screen.getByText('강남')).toBeTruthy();
  });

  it('handles press event', () => {
    const onPress = jest.fn();
    render(<StationCard station={mockStation} onPress={onPress} />);
    fireEvent.press(screen.getByTestId('station-card'));
    expect(onPress).toHaveBeenCalledWith(mockStation);
  });

  it('shows loading state', () => {
    render(<StationCard station={mockStation} loading={true} />);
    expect(screen.getByTestId('loading-indicator')).toBeTruthy();
  });
});
```

## Hook Test 템플릿

```typescript
import { renderHook, act } from '@testing-library/react-native';
import { useRealtimeTrains } from '@/hooks/useRealtimeTrains';
import { dataManager, RealtimeTrainData } from '@/services/data/dataManager';

// useRealtimeTrains는 dataManager.subscribeToRealtimeUpdates(stationName, callback, interval)로
// 구독한다. 콜백이 RealtimeTrainData(성공) 또는 null(실패)을 받아 상태를 갱신하므로
// fetch 함수를 직접 모킹하지 말고 구독 콜백을 캡처해 데이터/에러를 주입한다.
jest.mock('@/services/data/dataManager', () => ({
  dataManager: { subscribeToRealtimeUpdates: jest.fn() },
}));

const mockDataManager = dataManager as jest.Mocked<typeof dataManager>;

describe('useRealtimeTrains', () => {
  let dataCallback: ((data: RealtimeTrainData | null) => void) | null = null;

  beforeEach(() => {
    jest.clearAllMocks();
    dataCallback = null;
    mockDataManager.subscribeToRealtimeUpdates.mockImplementation(
      (_station, callback) => {
        dataCallback = callback;
        return jest.fn(); // unsubscribe
      }
    );
  });

  it('subscribes on mount with stationName + interval', () => {
    const { result } = renderHook(() => useRealtimeTrains('강남역', { enabled: true }));
    expect(result.current.loading).toBe(true);
    expect(mockDataManager.subscribeToRealtimeUpdates).toHaveBeenCalledWith(
      '강남역', expect.any(Function), 30000
    );
  });

  it('updates trains when subscription delivers data', async () => {
    const { result } = renderHook(() => useRealtimeTrains('강남역'));

    await act(async () => {
      dataCallback?.({
        stationId: '강남역',
        trains: [{ id: 'train-1' }] as never,
        lastUpdated: new Date(),
      } as RealtimeTrainData);
    });

    expect(result.current.loading).toBe(false);
    expect(result.current.trains).toHaveLength(1);
  });

  it('surfaces error after exhausting retries (null payloads)', async () => {
    const { result } = renderHook(() => useRealtimeTrains('강남역', { retryAttempts: 1 }));

    // null = 실패 → retryAttempts 도달 시 error 설정, trains는 빈 배열 유지
    await act(async () => {
      dataCallback?.(null);
    });

    expect(result.current.error).toBeTruthy();
    expect(result.current.trains).toEqual([]);
  });
});
```

## Service Test 템플릿 (Multi-tier fallback)

```typescript
import { dataManager } from '@/services/data/dataManager';
import { seoulSubwayApi } from '@/services/api/seoulSubwayApi';

const mockSeoulApi = seoulSubwayApi as jest.Mocked<typeof seoulSubwayApi>;

describe('dataManager.getRealtimeTrains', () => {
  beforeEach(() => jest.clearAllMocks());

  it('fetches from Seoul API when cache is empty', async () => {
    mockSeoulApi.getRealtimeArrival.mockResolvedValue([{ statnNm: '강남역' }] as never);

    const result = await dataManager.getRealtimeTrains('강남역');

    expect(mockSeoulApi.getRealtimeArrival).toHaveBeenCalledWith('강남역');
    expect(result).not.toBeNull();
  });

  it('returns null when Seoul API fails (no fresh cache)', async () => {
    mockSeoulApi.getRealtimeArrival.mockRejectedValue(new Error('API Error'));

    const result = await dataManager.getRealtimeTrains('강남역');

    // 에러 시 빈 배열이 아닌 null 반환 → 호출부는 retry로 구분 (error-handling 규칙)
    expect(result).toBeNull();
    expect(mockSeoulApi.getRealtimeArrival).toHaveBeenCalled();
  });

  it('serves cached data immediately on a warm cache (stale-while-revalidate)', async () => {
    mockSeoulApi.getRealtimeArrival.mockResolvedValue([{ statnNm: '강남역' }] as never);
    await dataManager.getRealtimeTrains('강남역'); // 1차 호출로 캐시 워밍
    mockSeoulApi.getRealtimeArrival.mockClear();

    const result = await dataManager.getRealtimeTrains('강남역');

    // 캐시 히트는 즉시 반환하고 백그라운드에서만 갱신한다
    expect(result).not.toBeNull();
  });
});
```

## 자주 쓰는 비동기/네비게이션/cleanup 패턴

### Async waitFor

```typescript
it('fetches data asynchronously', async () => {
  render(<Component />);
  await waitFor(() => {
    expect(screen.getByText('Loaded Data')).toBeTruthy();
  });
});
```

### Navigation 호출 검증

```typescript
it('navigates to station detail', () => {
  render(<StationCard station={mockStation} />);
  fireEvent.press(screen.getByTestId('station-card'));
  expect(mockNavigate).toHaveBeenCalledWith('StationDetail', {
    stationId: 'ST001', stationName: '강남', lineId: '2',
  });
});
```

### Firebase 구독 cleanup

```typescript
it('subscribes to Firestore and cleans up on unmount', () => {
  const unsubscribe = jest.fn();
  (onSnapshot as jest.Mock).mockReturnValue(unsubscribe);

  const { unmount } = render(<RealtimeComponent stationId="ST001" />);
  expect(onSnapshot).toHaveBeenCalled();

  unmount();
  expect(unsubscribe).toHaveBeenCalled();
});
```

## jest.config.js 표준 형태

```javascript
module.exports = {
  preset: 'jest-expo',
  setupFilesAfterEnv: ['<rootDir>/src/__tests__/setup.ts'],
  coverageThreshold: {
    global: {
      statements: 75,
      lines: 75,
      functions: 70,
      branches: 60,
    },
  },
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@components/(.*)$': '<rootDir>/src/components/$1',
    '^@services/(.*)$': '<rootDir>/src/services/$1',
    '^@utils/(.*)$': '<rootDir>/src/utils/$1',
    '^@hooks/(.*)$': '<rootDir>/src/hooks/$1',
  },
};
```
