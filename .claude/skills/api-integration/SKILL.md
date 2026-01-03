---
name: api-integration
description: Seoul Open Data API integration for real-time subway arrival data and timetables. Use when working with external Seoul Metro APIs.
---

# Seoul API Integration Guidelines

## When to Use
- Integrating Seoul Open Data APIs
- Fetching real-time train arrival data
- Working with subway timetables
- Implementing data fallback strategies

## API Endpoints

### Real-Time Arrival API
```
URL: http://swopenapi.seoul.go.kr/api/subway/{API_KEY}/json/realtimeStationArrival/{START}/{END}/{STATION_NAME}

Key Response Fields:
- arvlMsg2, arvlMsg3: Arrival messages ("2분후[1번째전]", "곧 도착")
- btrainNo: Train number
- updnLine: Direction ("상행" = up, "하행" = down)
- trainLineNm: Line name
- bstatnNm: Destination station
```

### Timetable API
```
URL: http://openAPI.seoul.go.kr:8088/{API_KEY}/json/SearchSTNTimeTableByIDService/{START}/{END}/{STATION_CODE}/{WEEK_TAG}/{INOUT_TAG}/

Parameters:
- WEEK_TAG: '1' (Weekday), '2' (Saturday), '3' (Sunday/Holiday)
- INOUT_TAG: '1' (Up/Inner), '2' (Down/Outer)
```

## Core Patterns

### Error Handling with Retry
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
      if (i < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, delay * (i + 1)));
      }
    }
  }
  throw lastError!;
}
```

### Service Disruption Detection
```typescript
const detectServiceDisruptions = (messages: string[]): boolean => {
  const keywords = ['운행중단', '전면중단', '장애', '고장', '사고', '탈선', '화재'];
  return messages.some(msg => keywords.some(kw => msg.includes(kw)));
};
```

### Multi-tier Fallback
```
Priority Order:
1. Seoul API (Primary) → 2. Firebase (Fallback) → 3. AsyncStorage (Cache)
```

## Rate Limiting

| Setting | Value | Notes |
|---------|-------|-------|
| Polling Interval | 30s minimum | No official rate limit, be conservative |
| Timeout | 5000ms | Per request |
| Max Retries | 3 | With exponential backoff |

## Best Practices

1. **Environment Variables**
   ```typescript
   const API_KEY = process.env.SEOUL_SUBWAY_API_KEY;
   if (!API_KEY) throw new Error('SEOUL_SUBWAY_API_KEY is not set');
   ```

2. **Response Validation**
   - Check `RESULT.CODE === 'INFO-000'` for success
   - Handle empty `realtimeArrivalList` gracefully

3. **Logging**
   - Log all API calls with timestamp
   - Log errors with full context for debugging

## Important Notes

- Always implement fallback to Firebase/cache
- Handle Korean encoding properly
- Monitor API health and switch sources if needed
- Export service as singleton: `export const seoulSubwayApi = new SeoulSubwayApi()`

## Reference Documentation

For complete code examples, see [references/api-examples.md](references/api-examples.md):
- Full SeoulSubwayApi class implementation
- DataManager with multi-tier fallback
- PollingManager pattern
- Jest mock examples
