---
name: api-integration
description: Seoul Open Data API 호출(call) 레이어 — 외부 Seoul Metro 실시간 도착/시간표 API에 대한 fetch, rate-limit(최소 30초 폴링), timeout(AbortController 10초), retry/backoff, API 키 매니저, 다단계 fallback 트리거를 담당. 외부 HTTP 호출 코드를 작성할 때 사용. 원시 응답 정규화/변환, 역 조회·검색·소비, 경로/요금 계산 같은 인접 작업은 형제 스킬(subway-data-processor, station-info, route-fare-calculation) 소관.
---

# Seoul API Integration Guidelines

## When to Use
- Integrating Seoul Open Data APIs
- Fetching real-time train arrival data
- Working with subway timetables
- Implementing data fallback strategies

## 사용하지 말아야 할 때 (When NOT to use)

이 스킬은 외부 Seoul Open API "호출"(fetch/rate-limit/timeout/retry) 레이어에만 한정됩니다. 아래 인접 작업은 형제 스킬 소관이므로 해당 스킬을 사용하세요:

- 원시 API 응답을 앱 모델로 정규화/변환(`convertToAppTrain`, `barvlDt` 파싱, `updnLine` 방향 매핑 등): `subway-data-processor`
- 역 조회/검색/상세/주변역/실시간 도착정보 "소비"(UI에 표시할 역 데이터 가져오기, 역명 해석): `station-info`
- 경로 탐색(A*/K-shortest), 환승 처리, 요금 타입별 계산: `route-fare-calculation`

이 스킬은 위 작업을 직접 다루지 않습니다 — 외부 HTTP 호출의 경계(fetch 발신, rate-limit 가드, timeout, 키 매니저, fallback 트리거)까지만 책임집니다.

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
URL: http://openapi.seoul.go.kr:8088/{API_KEY}/json/SearchSTNTimeTableByIDService/{START}/{END}/{STATION_CODE}/{WEEK_TAG}/{INOUT_TAG}/

Parameters:
- WEEK_TAG: '1' (Weekday), '2' (Saturday), '3' (Sunday/Holiday)
- INOUT_TAG: '1' (Up/Inner), '2' (Down/Outer)
```

## 정확성 캐비엇 (Accuracy Caveats) — 호출 *전* 가드 필수

아래 3종은 코드(`seoulSubwayApi.ts`)가 흡수한 실측 교훈이다. 가드를 빠뜨리면 정상 동작처럼 보이는 거짓 빈 화면(false empty state)이 생기고, 그 원인이 INFO-200 한 줄에 묻혀 디버깅이 길어진다. 스킬만 보고 구현해도 재현되지 않도록 본문에 승격한다.

### (a) 시간표 커버리지 — 1~9호선 whitelist로 호출 전 차단

`SearchSTNTimeTableByID`(8088 포털)는 **서울교통공사 숫자 1~9호선만** 보유한다. Korail/사철이 운영하는 광역·경전철 노선(경의중앙선·수인분당선·공항철도·신분당선·경춘선·GTX·인천1/2호선·신림선·우이신설·용인/의정부경전철 등)은 **역코드를 어떻게 넣어도 INFO-200("해당 데이터 없음")**을 반환한다. 라이브 probe로 커버리지 경계가 운영사가 아니라 "노선 번호 브랜딩"과 일치함을 확인했다(예: Korail 운영 평택지제도 `01호선`으로 브랜딩돼 시간표를 반환).

```typescript
import { isSeoulMetroTimetableLine } from '@/utils/timetableCoverage';

// 호출 전에 차단 — INFO-200 빈 배열을 빈 화면으로 오인하지 않도록 정직한 '미제공' 안내
if (!isSeoulMetroTimetableLine(lineNumber)) {
  return; // UI는 "이 노선은 시간표 미제공" 안내, API 호출 자체를 하지 않음
}
const rows = await seoulSubwayApi.getStationTimetable(stationCode, weekTag, inoutTag);
```

- whitelist(`/^0?[1-9](호선)?$/`)다 — blacklist 금지. 미래에 새 광역 노선이 추가돼도 자동 false → 버그 오인 없음.
- 호출 *후* 빈 배열로 거르면 사용자는 "경의선 시간표 빈 화면"을 본다. 반드시 호출 *전* 게이트.

### (b) 두 응답 구조 트랩 — `extractSeoulApiErrorCode`로 정규화

Seoul API는 **성공도 실패도 HTTP 200**으로 오며, 같은 200 안에 **서로 다른 JSON 구조**가 섞여 온다. `errorMessage.code`만 보면 top-level 실패가 **silent `[]`로 삼켜진다**(만료된 키가 "도착 정보 없음"으로 둔갑 → 인증 에러를 영원히 못 본다).

| 구조 | 어디서 | 트리거 |
|------|--------|--------|
| Wrapped: `{ errorMessage: {code, message}, ...List }` | 실시간 API 성공 + 문서화된 에러 | 성공은 `errorMessage.code === 'INFO-000'` |
| Top-level: `{ status, code, message }` (wrapper 없음, payload 없음) | 실시간/역검색 게이트웨이 실패 | auth `INFO-100`, unmatched `INFO-200`, quota `ERROR-3xx` |
| Top-level RESULT: `{ RESULT: { CODE, MESSAGE } }` (service wrapper 없음) | **8088 시간표** 포털 게이트웨이 실패 | 위와 동일 카테고리, 다른 봉투 |

```typescript
// 세 구조를 단일 헬퍼로 정규화. null = 에러코드 없음(=성공 후보).
const apiError = extractSeoulApiErrorCode(data); // seoulSubwayApi.ts 내부 헬퍼(module-private) — 새 파일에선 seoulSubwayApi 메서드 경유. { code, message } | null
if (apiError && apiError.code !== 'INFO-000') {
  // INFO-200은 '운행 종료/조회 결과 없음'(no-data)으로 별도 분류, 그 외는 에러로 throw
  ...
}
```

- 성공 wrapped 응답도 `errorMessage.code === 'INFO-000'`을 갖는다 → 반환 코드를 반드시 `'INFO-000'`과 비교.
- 시간표는 세 번째 구조(`{RESULT:{CODE,MESSAGE}}`)까지 본다 — `data.RESULT?.CODE ?? data.code`로 폴백.

### (c) realtimePosition 노선명 도메인 — 미지원 노선은 호출 스킵

`realtimePosition` 엔드포인트는 앱의 `lineId`(예: `'경의선'`, `'인천2'`)가 아니라 **API 공식 노선명**을 받는다. 도메인을 안 맞추면 INFO-200을 받고, 더 나쁘게는 `'인천2'`가 `'2호선'`으로 숫자가 새어 **다른 노선 데이터**를 끌어온다.

```typescript
import { toSeoulApiLineName } from '@/utils/formatUtils';

const lineName = toSeoulApiLineName(lineId); // 'string' | null
if (lineName === null) {
  return; // 약 5종(김포·용인·의정부·인천1/2)은 API 미제공 → 호출 스킵, UI는 'unsupported'
}
// rate-limit 키는 'position:{lineName}'으로 분리 — 도착('realtime:{station}')과 충돌 방지
```

- `toSeoulApiLineName`이 매핑하는 변환: `경의선 → 경의중앙선`, `우이신설경전철 → 우이신설선` 등. 그대로 넘기면 미매칭.
- INFO-200이 **'운행 중 0대'처럼 보이는 거짓 빈 화면**으로 나오면 노선명 도메인부터 의심하라(off-hours 실제 0대와 구분 안 됨).
- rate-limit 키를 도착과 같은 prefix로 쓰면 한쪽 호출이 다른 쪽을 굶긴다 → `position:` prefix로 분리 필수.

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
// SoT: 장애 severity 분류는 subway-data-processor(DelaySeverity, models/train.ts:86) 소관. 아래는 boolean 간이 체크.
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
| Timeout | 10000ms (10s) | AbortController per request |
| Max Retries | 3 | With exponential backoff |

## Best Practices

1. **Environment Variables**
   ```typescript
   const API_KEY = process.env.EXPO_PUBLIC_SEOUL_SUBWAY_API_KEY;
   if (!API_KEY) throw new Error('EXPO_PUBLIC_SEOUL_SUBWAY_API_KEY is not set');
   ```

2. **Response Validation**
   - 실시간/역검색 성공은 `errorMessage.code === 'INFO-000'`으로 판정 (캐비엇 b) — `RESULT.CODE`는 8088 시간표 게이트웨이 봉투 전용
   - Handle empty `realtimeArrivalList` gracefully (INFO-200 = no-data → `convertToAppTrain()` 정규화 후 빈 배열)

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
| 시간표 | 24시간 | AsyncStorage | 일 단위 변경, `timetable:{code}:{lineNumber}:{weekTag}:{dir}` |
| 역정보 | 영구 | 로컬 JSON | `stationsDataService` |

## 흔한 실수 체크리스트

- [ ] API 키 혼용: 실시간 키를 시간표에 사용 (인증 실패)
- [ ] stationId를 역명으로 사용 (검색 결과 없음)
- [ ] 에러와 빈 데이터 미구분 (사용자에게 동일하게 "데이터 없음" 표시)
- [ ] 시간표 API를 HTTPS 페이지에서 호출 (mixed content 차단)
- [ ] rate limit 없이 연속 API 호출 (키 비활성화)
- [ ] 광역·경전철에 시간표 호출 (1~9호선만 커버 — `isSeoulMetroTimetableLine` 미사용, 캐비엇 a)
- [ ] top-level/RESULT 응답 구조 미정규화 (`errorMessage`만 봐 silent `[]`, 캐비엇 b)
- [ ] realtimePosition에 `lineId` 직접 전달 (`toSeoulApiLineName` 미사용, 캐비엇 c)

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
| 광역·경전철에 시간표 API 호출 | `isSeoulMetroTimetableLine()`로 호출 *전* 차단 | 1~9호선만 커버, 그 외 INFO-200 빈 화면 (캐비엇 a) |
| `lineId`를 realtimePosition에 그대로 전달 | `toSeoulApiLineName(lineId)`, `null`이면 스킵 | 노선명 도메인 미스매치 → INFO-200/숫자 누출 (캐비엇 c) |
| position·도착 rate-limit 키 공유 | `position:{lineName}` vs `realtime:{station}` 분리 | 한쪽 호출이 다른 쪽 굶김 (캐비엇 c) |

### 데이터 처리 Patterns
| BANNED | USE INSTEAD |
|--------|-------------|
| `updnLine === '상행'` 만 체크 | `'상행' \|\| '내선'` (2호선 순환선) |
| `arrivalTime ? ... : fallback` (0 = falsy) | `arrivalTime !== null ? ...` |
| 캐시 없이 매번 API 호출 | SWR 패턴 (캐시 반환 → 백그라운드 갱신) |
| API 에러와 빈 데이터 동일 처리 | 에러 = retry, 빈 데이터 = "운행 종료" |

> `updnLine` 방향·`arrivalTime`·`convertToAppTrain` 등 페이로드 정규화 규칙의 SoT는 `subway-data-processor` 소관(L18) — 위 정규화 행은 호출 레이어 함정 환기용 요약이며, 정본은 거기 참조.

### Response 검증 Patterns
| BANNED | REQUIRED |
|--------|----------|
| response.json() 직접 사용 | `errorMessage.code === 'INFO-000'` 확인 후 사용 |
| `errorMessage.code`만 체크 | `seoulSubwayApi` 메서드 경유 호출 (내부 `extractSeoulApiErrorCode`가 wrapped/top-level/RESULT 3구조 정규화 — module-private, 직접 import 불가) |
| `realtimeArrivalList` 그대로 반환 | `convertToAppTrain()`으로 정규화 후 반환 |
| HTTP 상태코드만 확인 | API 자체 에러코드 (`ERROR-500`, `ERROR-501`) 분기 처리 |

## Important Notes

- Always implement fallback to Firebase/cache
- Handle Korean encoding properly
- Monitor API health and switch sources if needed
- Export service as singleton: `export const seoulSubwayApi = new SeoulSubwayApiService()`

## Reference Documentation

For complete code examples, see [references/api-examples.md](references/api-examples.md):
- Full SeoulSubwayApiService class implementation
- DataManager with multi-tier fallback
- PollingManager pattern
- Jest mock examples
