---
name: api-integration
description: Seoul Open Data API integration for real-time subway arrival data and timetables. Use when working with external Seoul Metro APIs.
---

# Seoul API Integration Guidelines

## When to Use This Skill
- Integrating Seoul Open Data APIs
- Fetching real-time train arrival data
- Working with subway timetables
- Handling API errors and retries
- Implementing data fallback strategies

## API Endpoints

### 1. Real-Time Arrival API
```
Base URL: http://swopenapi.seoul.go.kr/api/subway/{API_KEY}/json/realtimeStationArrival/{START}/{END}/{STATION_NAME}

Response Fields:
- arvlMsg2, arvlMsg3: Arrival messages ("2분후[1번째전]", "곧 도착")
- btrainNo: Train number
- updnLine: Direction ("상행" = up, "하행" = down)
- trainLineNm: Line name
- bstatnNm: Destination station
```

### 2. Timetable API
```
Base URL: http://openAPI.seoul.go.kr:8088/{API_KEY}/json/SearchSTNTimeTableByIDService/{START}/{END}/{STATION_CODE}/{WEEK_TAG}/{INOUT_TAG}/

Parameters:
- WEEK_TAG: '1' (Weekday), '2' (Saturday), '3' (Sunday/Holiday)
- INOUT_TAG: '1' (Up/Inner), '2' (Down/Outer)
```

## Service Implementation Pattern

### seoulSubwayApi.ts Structure
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

## Error Handling Strategy

### 1. Retry Logic
```typescript
async function fetchWithRetry<T>(
  fetchFn: () => Promise<T>,
  maxRetries = 3,
  delay = 1000
): Promise<T> {
  let lastError: Error;

  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fetchFn();
    } catch (error) {
      lastError = error as Error;
      console.log(`Retry ${i + 1}/${maxRetries}`);

      if (i < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, delay * (i + 1)));
      }
    }
  }

  throw lastError!;
}

// Usage
const data = await fetchWithRetry(() =>
  seoulSubwayApi.getRealtimeArrival('강남')
);
```

### 2. Timeout Handling
```typescript
const fetchWithTimeout = async <T>(
  promise: Promise<T>,
  timeoutMs: number
): Promise<T> => {
  const timeout = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error('Request timeout')), timeoutMs);
  });

  return Promise.race([promise, timeout]);
};
```

### 3. Service Disruption Detection
```typescript
const detectServiceDisruptions = (messages: string[]): boolean => {
  const keywords = [
    '운행중단',
    '전면중단',
    '운행불가',
    '장애',
    '고장',
    '사고',
    '탈선',
    '화재'
  ];

  return messages.some(msg =>
    keywords.some(keyword => msg.includes(keyword))
  );
};
```

## Data Manager Integration

### Multi-tier Fallback Pattern
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

## Rate Limiting

### Polling Strategy
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

## Best Practices

### 1. Environment Variables
```typescript
// Always use env variables for API keys
const API_KEY = process.env.SEOUL_SUBWAY_API_KEY;

if (!API_KEY) {
  throw new Error('SEOUL_SUBWAY_API_KEY is not set');
}
```

### 2. Response Validation
```typescript
const validateResponse = (data: unknown): boolean => {
  if (!data || typeof data !== 'object') {
    return false;
  }

  // Add specific validation logic
  return true;
};
```

### 3. Logging
```typescript
const logApiCall = (endpoint: string, params: Record<string, any>) => {
  console.log('[API Call]', {
    endpoint,
    params,
    timestamp: new Date().toISOString(),
  });
};
```

## Testing

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
        // ...
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
```

## Important Notes
- Seoul API has no official rate limits but use conservative polling (30s+)
- Always implement fallback to Firebase/cache
- Handle Korean encoding properly
- Monitor API health and switch sources if needed
- Log all API errors for debugging
