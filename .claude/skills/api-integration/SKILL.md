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

## API 엔드포인트/키 구분표

| API | 호스트 | 환경변수 키 | KeyManager |
|-----|--------|------------|------------|
| 실시간 도착 | `swopenapi.seoul.go.kr` | `EXPO_PUBLIC_SEOUL_SUBWAY_API_KEY` | `createSeoulApiKeyManager()` |
| 시간표 | `openapi.seoul.go.kr:8088` | `EXPO_PUBLIC_DATA_PORTAL_API_KEY` | `createPublicDataApiKeyManager()` |
| 역정보 | `swopenapi.seoul.go.kr` | `EXPO_PUBLIC_SEOUL_SUBWAY_API_KEY` | `createSeoulApiKeyManager()` |

**주의**: 실시간 API와 시간표 API는 **서로 다른 키**를 사용합니다. 혼용하면 인증 실패합니다.

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

## stationName Fallback 체인

stationId로부터 역명을 해석할 때 반드시 다단계 fallback을 사용:

```
stationNameProp → trainService.getStation() (Firebase) → getLocalStation() (로컬 JSON) → stationId
```

**절대 stationId(코드)를 그대로 Seoul API에 역명으로 전달하지 않을 것** - "0222" 같은 코드는 검색 결과 없음.

## 캐싱 전략

| 데이터 타입 | TTL | 저장소 | 비고 |
|------------|-----|--------|------|
| 실시간 도착 | 60초 | 메모리 | 폴링 주기와 동일 |
| 시간표 | 24시간 | AsyncStorage | 일 단위 변경, `timetable:{code}:{weekTag}:{dir}` |
| 역정보 | 영구 | 로컬 JSON | `stationsDataService` |

## 흔한 실수 체크리스트

- [ ] API 키 혼용: 실시간 키를 시간표에 사용 (인증 실패)
- [ ] stationId를 역명으로 사용 (검색 결과 없음)
- [ ] 에러와 빈 데이터 미구분 (사용자에게 동일하게 "데이터 없음" 표시)
- [ ] 시간표 API를 HTTPS 페이지에서 호출 (mixed content 차단)
- [ ] rate limit 없이 연속 API 호출 (키 비활성화)

## BANNED Patterns (Hard Failures)

Seoul API 연동 시 아래 패턴은 장애를 유발합니다. 예외 없음.

### API 호출 Patterns
| BANNED | USE INSTEAD | WHY |
|--------|-------------|-----|
| 30초 미만 폴링 | `RateLimiter(30000)` | API 키 차단 위험 |
| API 키 하드코딩 | `process.env.EXPO_PUBLIC_*` | 키 노출 → 보안 사고 |
| `fetch()` without timeout | `AbortController` + 10초 제한 | 무한 대기 |
| `fetch()` without retry | `withRetry(fn, { maxAttempts: 3 })` | 일시 장애 미복구 |
| 에러 시 throw → UI 크래시 | `return null` 또는 `return []` | 빈 화면 방지 |
| `barvlDt` 무시 → `arvlMsg2`만 파싱 | `barvlDt` 우선, 텍스트는 fallback | 초 단위 정확도 손실 |
| stationId("0222")를 역명으로 전달 | stationName("강남") 사용 | 검색 결과 없음 |
| 실시간 키로 시간표 API 호출 | 별도 `DATA_PORTAL_API_KEY` 사용 | 인증 실패 |

### 데이터 처리 Patterns
| BANNED | USE INSTEAD |
|--------|-------------|
| `updnLine === '상행'` 만 체크 | `'상행' \|\| '내선'` (2호선 순환선) |
| `arrivalTime ? ... : fallback` (0 = falsy) | `arrivalTime !== null ? ...` |
| 캐시 없이 매번 API 호출 | SWR 패턴 (캐시 반환 → 백그라운드 갱신) |
| API 에러와 빈 데이터 동일 처리 | 에러 = retry, 빈 데이터 = "운행 종료" |

### Response 검증 Patterns
| BANNED | REQUIRED |
|--------|----------|
| response.json() 직접 사용 | `errorMessage.code === 'INFO-000'` 확인 후 사용 |
| `realtimeArrivalList` 그대로 반환 | `convertToAppTrain()`으로 정규화 후 반환 |
| HTTP 상태코드만 확인 | API 자체 에러코드 (`ERROR-500`, `ERROR-501`) 분기 처리 |

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
