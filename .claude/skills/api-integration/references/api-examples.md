# Seoul API Integration - Code Examples

## Service Implementation

### seoulSubwayApi.ts Full Structure
```typescript
// 실제 서비스는 axios가 아니라 native fetch + AbortController를 사용한다.
// (앱 전역에 axios 의존성 없음 — grep axios src/ → EMPTY)
class SeoulSubwayApiService {
  private readonly API_KEY: string;
  private readonly BASE_URL: string;
  private readonly TIMEOUT = 10000; // 10 seconds (AbortController)

  constructor() {
    this.API_KEY = process.env.SEOUL_SUBWAY_API_KEY || '';
    this.BASE_URL = process.env.SEOUL_SUBWAY_API_BASE_URL || '';
  }

  /** Fetch with 10s timeout via AbortController */
  private async fetchWithTimeout(url: string): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.TIMEOUT);

    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: { Accept: 'application/json' },
      });

      if (!response.ok) {
        throw new Error(`HTTP Error: ${response.status} ${response.statusText}`);
      }

      return response;
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('API 요청 시간이 초과되었습니다.');
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  async getRealtimeArrival(stationName: string): Promise<ArrivalData[]> {
    try {
      const url = `${this.BASE_URL}/${this.API_KEY}/json/realtimeStationArrival/1/10/${stationName}`;
      const response = await this.fetchWithTimeout(url);
      const data = await response.json();

      // Handle Seoul API error responses
      if (data.RESULT?.CODE !== 'INFO-000') {
        throw new Error(data.RESULT?.MESSAGE || 'API Error');
      }

      return this.parseArrivalData(data.realtimeArrivalList);
    } catch (error) {
      console.error('Failed to fetch arrival data:', error);
      throw error;
    }
  }

  private parseArrivalData(rawData: unknown[]): ArrivalData[] {
    if (!Array.isArray(rawData)) {
      return [];
    }

    return rawData.map(item => ({
      trainNo: item.btrainNo,
      direction: item.updnLine,
      arrivalMessage: item.arvlMsg2 || item.arvlMsg3,
      destination: item.bstatnNm,
      lineName: item.trainLineNm,
      updatedAt: new Date(item.recptnDt),
    }));
  }
}

export const seoulSubwayApi = new SeoulSubwayApiService();
```

---

## Data Manager Pattern

### Multi-tier Fallback Implementation
```typescript
class DataManager {
  private subscribers = new Map<string, Set<Function>>();

  async fetchTrainData(stationId: string): Promise<Train[]> {
    // Priority: Seoul API → Firebase → Cache
    try {
      // 1. Primary: Seoul API
      const apiData = await seoulSubwayApi.getRealtimeArrival(stationId);
      if (apiData.length > 0) {
        await this.updateCache(stationId, apiData);
        this.notifySubscribers(stationId, apiData);
        return apiData;
      }
    } catch (error) {
      console.log('Seoul API failed, trying Firebase');
    }

    try {
      // 2. Fallback: Firebase
      const fbData = await trainService.getTrainsByStation(stationId);
      if (fbData.length > 0) {
        return fbData;
      }
    } catch (error) {
      console.log('Firebase failed, using cache');
    }

    // 3. Last resort: Cache
    return await this.getCachedData(stationId);
  }

  subscribe(
    stationId: string,
    callback: (data: Train[]) => void
  ): () => void {
    if (!this.subscribers.has(stationId)) {
      this.subscribers.set(stationId, new Set());
    }

    this.subscribers.get(stationId)!.add(callback);

    // Return unsubscribe function
    return () => {
      this.subscribers.get(stationId)?.delete(callback);
    };
  }

  private notifySubscribers(stationId: string, data: Train[]): void {
    this.subscribers.get(stationId)?.forEach(callback => {
      callback(data);
    });
  }
}

export const dataManager = new DataManager();
```

---

## Polling Manager

```typescript
class PollingManager {
  private intervals = new Map<string, NodeJS.Timeout>();
  private readonly POLL_INTERVAL = 30000; // 30 seconds

  startPolling(
    stationId: string,
    callback: (data: Train[]) => void
  ): void {
    // Clear existing interval
    this.stopPolling(stationId);

    // Initial fetch
    this.fetchAndNotify(stationId, callback);

    // Set up interval
    const interval = setInterval(() => {
      this.fetchAndNotify(stationId, callback);
    }, this.POLL_INTERVAL);

    this.intervals.set(stationId, interval);
  }

  stopPolling(stationId: string): void {
    const interval = this.intervals.get(stationId);
    if (interval) {
      clearInterval(interval);
      this.intervals.delete(stationId);
    }
  }

  private async fetchAndNotify(
    stationId: string,
    callback: (data: Train[]) => void
  ): Promise<void> {
    try {
      const data = await dataManager.fetchTrainData(stationId);
      callback(data);
    } catch (error) {
      console.error('Polling error:', error);
    }
  }
}
```

---

## Testing Examples

### Mock API Responses
```typescript
// __tests__/seoulSubwayApi.test.ts
// 서비스가 native fetch를 쓰므로 global.fetch를 모킹한다 (axios 아님).
const okPayload = {
  RESULT: { CODE: 'INFO-000' },
  realtimeArrivalList: [
    {
      btrainNo: '1234',
      updnLine: '상행',
      arvlMsg2: '2분후[1번째전]',
      bstatnNm: '당고개',
      trainLineNm: '4호선',
      recptnDt: '2025-01-03 14:30:00'
    }
  ]
};

const mockFetch = (payload: unknown): void => {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => payload,
  } as Response);
};

test('should fetch arrival data', async () => {
  mockFetch(okPayload);

  const data = await seoulSubwayApi.getRealtimeArrival('강남');

  expect(data).toHaveLength(1);
  expect(data[0].trainNo).toBe('1234');
});

test('should handle API errors', async () => {
  mockFetch({ RESULT: { CODE: 'ERROR-500', MESSAGE: 'Server error' } });

  await expect(seoulSubwayApi.getRealtimeArrival('강남'))
    .rejects.toThrow('Server error');
});
```
