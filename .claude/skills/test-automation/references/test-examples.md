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
import { renderHook, act, waitFor } from '@testing-library/react-native';
import { useTrainData } from '../useTrainData';

describe('useTrainData', () => {
  it('fetches train data on mount', async () => {
    const { result } = renderHook(() => useTrainData('ST001'));
    expect(result.current.loading).toBe(true);

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    expect(result.current.arrivals).toBeDefined();
  });

  it('handles errors gracefully', async () => {
    const mockError = new Error('API Error');
    (getRealtimeArrivals as jest.Mock).mockRejectedValueOnce(mockError);

    const { result } = renderHook(() => useTrainData('invalid'));
    await waitFor(() => {
      expect(result.current.error).toBeTruthy();
      expect(result.current.arrivals).toEqual([]);
    });
  });
});
```

## Service Test 템플릿 (Multi-tier fallback)

```typescript
describe('dataManager', () => {
  beforeEach(() => jest.clearAllMocks());

  it('fetches from Seoul API first', async () => {
    const data = await dataManager.getTrainArrivals('ST001');
    expect(seoulApi.fetchArrivals).toHaveBeenCalledWith('ST001');
    expect(data).toBeDefined();
  });

  it('falls back to Firebase on API failure', async () => {
    (seoulApi.fetchArrivals as jest.Mock).mockRejectedValue(new Error('API Error'));
    const data = await dataManager.getTrainArrivals('ST001');
    expect(trainService.getTrainsByStation).toHaveBeenCalledWith('ST001');
  });

  it('uses cache when available and fresh', async () => {
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(
      JSON.stringify({ data: mockData, timestamp: Date.now() })
    );
    const data = await dataManager.getTrainArrivals('ST001');
    expect(seoulApi.fetchArrivals).not.toHaveBeenCalled();
    expect(data).toEqual(mockData);
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
  setupFilesAfterSetup: ['./jest.setup.js'],
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
  },
};
```
