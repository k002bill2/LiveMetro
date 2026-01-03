# Seoul API Integration - Code Examples

## Service Implementation

### seoulSubwayApi.ts Full Structure
```typescript
import axios, { AxiosInstance } from 'axios';

class SeoulSubwayApi {
  private client: AxiosInstance;
  private readonly API_KEY: string;
  private readonly BASE_URL: string;
  private readonly TIMEOUT = 5000; // 5 seconds

  constructor() {
    this.API_KEY = process.env.SEOUL_SUBWAY_API_KEY || '';
    this.BASE_URL = process.env.SEOUL_SUBWAY_API_BASE_URL || '';

    this.client = axios.create({
      baseURL: this.BASE_URL,
      timeout: this.TIMEOUT,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    this.setupInterceptors();
  }

  private setupInterceptors(): void {
    // Request interceptor
    this.client.interceptors.request.use(
      (config) => {
        console.log(`[API] Request: ${config.url}`);
        return config;
      },
      (error) => Promise.reject(error)
    );

    // Response interceptor
    this.client.interceptors.response.use(
      (response) => {
        console.log(`[API] Response: ${response.status}`);
        return response;
      },
      (error) => {
        console.error(`[API] Error: ${error.message}`);
        return Promise.reject(error);
      }
    );
  }

  async getRealtimeArrival(stationName: string): Promise<ArrivalData[]> {
    try {
      const url = `/${this.API_KEY}/json/realtimeStationArrival/1/10/${stationName}`;
      const response = await this.client.get(url);

      // Handle Seoul API error responses
      if (response.data.RESULT?.CODE !== 'INFO-000') {
        throw new Error(response.data.RESULT?.MESSAGE || 'API Error');
      }

      return this.parseArrivalData(response.data.realtimeArrivalList);
    } catch (error) {
      console.error('Failed to fetch arrival data:', error);
      throw error;
    }
  }

  private parseArrivalData(rawData: any[]): ArrivalData[] {
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

export const seoulSubwayApi = new SeoulSubwayApi();
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
jest.mock('axios');

const mockResponse = {
  data: {
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
  }
};

test('should fetch arrival data', async () => {
  (axios.get as jest.Mock).mockResolvedValue(mockResponse);

  const data = await seoulSubwayApi.getRealtimeArrival('강남');

  expect(data).toHaveLength(1);
  expect(data[0].trainNo).toBe('1234');
});

test('should handle API errors', async () => {
  const errorResponse = {
    data: {
      RESULT: { CODE: 'ERROR-500', MESSAGE: 'Server error' }
    }
  };
  (axios.get as jest.Mock).mockResolvedValue(errorResponse);

  await expect(seoulSubwayApi.getRealtimeArrival('강남'))
    .rejects.toThrow('Server error');
});
```
