---
name: subway-data-processor
description: Normalize and transform raw Seoul Open Data API responses into LiveMetro's internal subway shapes (parse arrival messages, map Korean direction/line fields to enums, classify service disruptions, shape timetable rows). Use when transforming or normalizing raw API payloads; this is the data normalization/transformation layer only — fetching the API belongs to api-integration, consuming/querying the normalized station data belongs to station-info, and route/fare computation belongs to route-fare-calculation.
---

# Subway Data Processor Skill

## Purpose

Handle Seoul subway data transformations, API response parsing, and data normalization for LiveMetro.

## When to Use
- Parsing Seoul Open Data API responses
- Normalizing subway data (Korean ↔ English)
- Handling service disruption detection
- Processing timetable data
- Implementing caching logic

## 사용하지 말아야 할 때 (When NOT to use)

이 스킬은 원시 응답을 내부 형태로 "정규화/변환"하는 레이어다. 다음 인접 작업은 형제 스킬 소관이므로 위임한다:

- **외부 Seoul Open API를 직접 호출**(fetch, rate-limit, timeout, 재시도, 캐시 폴백 트리거) → `api-integration`. 이 스킬은 이미 받아온 페이로드만 변환한다.
- **정규화된 역 데이터를 조회/검색/소비**(역 검색, 역 상세, 주변역, 실시간 도착정보 사용, 시간표 조회) → `station-info`.
- **경로 탐색·환승·요금 계산**(A*/K-shortest, 최단경로, 환승 시간, 요금 타입별 계산) → `route-fare-calculation`.
- **UI 컴포넌트/화면 렌더링**(도착 카드, 리스트, 네비게이션) → `react-native-development`.

## Data Types

### TrainArrival
실제 시그니처는 `src/services/arrival/arrivalService.ts:18` (이걸 import — 아래는 illustrative 아님, 정본 복제):
```typescript
export interface TrainArrival {
  readonly trainId: string;
  readonly lineId: string;
  readonly direction: 'up' | 'down';
  readonly destination: string;
  readonly arrivalSeconds: number | null;  // null = 운행정보 없음
  readonly arrivalMessage: string;
  readonly trainNumber: string;
  readonly trainType?: TrainType;
}
```

### Station
```typescript
interface Station {
  id: string;
  name: string;            // Korean name
  nameEn?: string;
  lineId: string;
  coordinates: { latitude: number; longitude: number };
  transfers?: string[];
}
```

## Seoul API Response Structure

### Real-Time Arrival
```json
{
  "realtimeArrivalList": [{
    "barvlDt": "120",              // 잔여 초 (Primary arrival-time source per seoul-api-limits)
    "arvlMsg2": "2분후[1번째전]",   // Arrival message (fallback text)
    "btrainNo": "T1001",           // Train number
    "bstatnNm": "신도림",           // Destination
    "updnLine": "상행",             // Direction
    "trainLineNm": "2호선",         // Line name
    "statnNm": "강남역",            // Station name
    "recptnDt": "2025-12-28 09:30:15"
  }]
}
```

## Key Parsing Rules

### Arrival Time
**Primary**: `barvlDt`(잔여 초) 우선 사용 — `parseInt(barvlDt, 10)`. `arvlMsg2` 텍스트만으로 도착 시간을 파싱하는 것은 BANNED(`.claude/rules/seoul-api-limits.md`). 아래 텍스트 파싱은 `barvlDt` 부재 시 **fallback**이며, `전역`(이전역) 메시지는 `arvlCd`로 판별해 건너뛴다.

| Message (fallback) | Seconds |
|---------|---------|
| `2분후[1번째전]` | 120 |
| `곧 도착` | 30 |
| `전역 도착` | 60 |
| `[0]분후[...]` | 0 |

### Direction Normalization
| Korean | English |
|--------|---------|
| `상행` | `up` |
| `하행` | `down` |
| `내선` | `up` (circular) |
| `외선` | `down` (circular) |

### Line ID Mapping
| Korean | ID |
|--------|-----|
| `1호선` - `9호선` | `'1'` - `'9'` |
| `신분당선` | `sinbundang` |
| `경의중앙선` | `gyeongui` |
| `공항철도` | `airport` |
| `수인분당선` | `bundang` |

## Service Disruption Keywords

| Severity | Keywords |
|----------|----------|
| **SEVERE** | 운행중단, 전면중단, 운행불가 |
| **MAJOR** | 장애, 고장, 사고, 탈선, 화재 |
| **MODERATE** | 지연, 혼잡, 서행 |

> 탈선·화재는 위 표에서 **MAJOR**(사고/장애 계열)다 — SEVERE(전면 운행 중단)로 올려 적지 마라. SEVERE는 "노선이 멈췄다", MAJOR는 "사고는 났지만 운행은 한다"로 구분한다.

### 장애 분류는 단일 SoT로 import — enum 재정의 금지

이 키워드 표는 **severity 산출의 SoT**이고, 그 결과 severity 값의 **canonical enum은 `DelaySeverity`(`src/models/train.ts:86` = `minor`/`moderate`/`major`/`severe`)**다. 새 장애 처리 코드는 이 enum을 import해 쓰라. 자체 severity 스킴을 새로 정의하면 아래처럼 드리프트가 누적돼, 같은 "사고"가 화면마다 다른 등급으로 표시된다(실측 드리프트):

| 위치 | 현재 스킴 | 문제 |
|------|----------|------|
| `models/train.ts:86` `DelaySeverity` | `minor`/`moderate`/`major`/`severe` | **canonical (이걸 import)** |
| `dataManager.detectServiceDisruptions` | `DelaySeverity` 사용 | OK (정렬됨) |
| `services/delay/officialDelayService.ts:52` | `info`/`warning`/`critical` | 3-tier 자체 정의 → enum과 매핑 불명 |
| `api-integration` SKILL `detectServiceDisruptions` | flat 키워드 → `boolean` | severity 없이 "장애 있음/없음"만 |

매핑 주의:
- 키워드 표는 3행(SEVERE/MAJOR/MODERATE)뿐 — `DelaySeverity.MINOR`는 키워드로 안 잡히는 **경미한 지연(1~5분)** 전용이다. 키워드 매칭은 MODERATE 이상만 산출한다.
- **혼잡도(congestion)는 severity가 아니다.** `CongestionLevel`(`src/models/publicData.ts:96` = `low`/`moderate`/`high`/`crowded`)은 "얼마나 붐비나"라는 **별개 축**이다. 장애 severity 표(`minor`/`moderate`/`major`/`severe`)와 값이 겹쳐 보여도 절대 같은 enum으로 합치지 마라.

## BANNED (예외 없음)

| 금지 | 대체 | 이유 |
|------|------|------|
| `seoulSubwayApi.getRealtimeArrival` 직접 호출(실시간 지연/도착 데이터) | `arrivalService.getArrivals` 경유 | 직접 호출은 공유 캐시·rate-limit을 우회 → rate-limit 키 오염으로 StationDetail이 30s 굶주린다 (PR #170, `useDelayDetection`이 같은 이유로 `arrivalService` 경유로 전환됨) |
| 위치 API `updnLine` CODE('0'/'1')를 도착 API 한글('상행'/'하행')과 같은 분기로 처리 | 두 인코딩 분리 (아래 Real-Time Position 참조) | 한 분기가 다른 인코딩을 만나면 방향이 전부 뒤집힌다 |
| 자체 disruption `severity` enum 신규 정의 | `DelaySeverity`(`models/train.ts`) import | severity 스킴이 3+곳으로 드리프트 (위 표) |

## Real-Time Position Normalization (`realtimePosition`)

위치 API(`realtimePosition`, 실시간 열차 위치)는 도착 API와 **인코딩 규약이 다르다**. 정규화는 `seoulSubwayApi.convertToTrainPosition`(`SeoulRealtimePosition` → `TrainPosition`)이 SoT다. 도착 API용 정규화기(한글 방향/메시지 파싱)를 위치 row에 재사용하지 마라.

### `updnLine` — 위치 API는 CODE, 도착 API는 한글 (혼용 금지)

| API | `updnLine` 값 | up | down |
|-----|--------------|-----|------|
| 도착(`getRealtimeArrival`) | 한글 | `상행`·`내선` | `하행`·`외선` |
| **위치(`getRealtimePosition`)** | **CODE** | `'0'` (상행/내선) | `'1'` (하행/외선) |

`convertToTrainPosition`은 `row.updnLine === '0' ? 'up' : 'down'`로 코드를 푼다. 같은 필드명이지만 값 도메인이 달라, 한글 분기(`=== '상행'`)를 위치 row에 쓰면 전부 `down`으로 떨어진다 — 그래서 두 변환기를 의도적으로 분리해 둔다.

### `trainSttus` — 열차 상태 코드표

`convertToTrainPosition`의 `statusMap`이 SoT (`TrainPositionStatus`로 정규화):

| 코드 | 의미 | `TrainPositionStatus` |
|------|------|----------------------|
| `'0'` | 진입 | `entering` |
| `'1'` | 도착 | `arrived` |
| `'2'` | 출발 | `departed` |
| `'3'` | 전역 출발 | `departed_prev` |
| (그 외) | — | `unknown` (`?? 'unknown'` fallback) |

부수 코드 플래그도 CODE다: `directAt === '1'` → 급행(`isExpress`), `lstcarAt === '1'` → 막차(`isLastTrain`).

### 노선명 도메인 — 호출 입력은 정규화 책임 밖이지만 주의

`getRealtimePosition`은 앱 `lineId`(`'경의선'`, `'인천2'`)가 아니라 **API 공식 노선명**을 받는다. 호출 전 `toSeoulApiLineName(lineId)`(`src/utils/formatUtils.ts:84`)로 변환하고 `null`이면 스킵하라(**API 입력 노선명 변환 SoT는 `api-integration` 참조** — 변환 규칙·미지원 노선 목록·함정은 거기서 관리). `'인천2'`를 그대로 넣으면 숫자가 새어 `'2호선'` 데이터를 끌어온다.

### schedule-vs-actual 지연 계산

Seoul API는 **schedule deviation(지연 분)을 직접 주지 않는다.** 그래서 `dataManager.detectDelays`는 `@deprecated`로 빈 배열(`[]`)만 반환한다 — 과거 구현이 "도착까지 남은 시간"을 지연으로 오인해 거짓 알림을 냈기 때문(신뢰 훼손). 올바른 지연은 **두 소스 비교로만** 산출하라:

1. **기준선** = `getStationTimetable`(published timetable, 예정 출발/도착)
2. **실측** = `getRealtimeArrival`(`barvlDt` 잔여 초)
3. `deviation = 실측 도착 시각 − 예정 시각` → `DelaySeverity`에 매핑

기준선 없이 실측만으로 지연을 판단하는 코드는 작성 금지(`detectDelays`가 막힌 이유 그대로).

## Common Issues & Solutions

### Issue 1: Station Name Mismatch
**Problem**: "강남역" vs "강남"
**Solution**: Remove "역" suffix: `name.replace(/역$/, '').trim()`

### Issue 2: Circular Line Directions
**Problem**: Line 2 has "inner/outer" not "up/down"
**Solution**: Map "내선" → "up", "외선" → "down"

### Issue 3: Arrival Time "0분후"
**Problem**: `[0]분후` should be "곧 도착"
**Solution**: Treat 0 minutes as 30 seconds

### Issue 4: Multiple Stations Same Name
**Problem**: Same name on multiple lines
**Solution**: Always include `lineId` in queries

## Data Fetching Priority

> fetch 우선순위·캐시 TTL의 SoT는 api-integration — 아래는 정규화 레이어 입력 맥락 참고용.

```
1. AsyncStorage Cache (TTL: 30s)
   ↓ (cache miss or expired)
2. Seoul API (Primary)
   ↓ (API error)
3. Firebase (Fallback)
   ↓ (all failed)
4. Return empty array []
```

## Best Practices

1. **Always Normalize Data** - Convert Korean to English enums
2. **Handle Missing Data** - Use optional chaining and defaults
3. **Cache Aggressively** - Seoul API has implicit rate limits
4. **Validate Responses** - Check `RESULT.CODE === 'INFO-000'`
5. **Log Data Issues** - Track parsing failures for debugging
6. **Use Fuzzy Matching** - Station names vary across APIs

## Resources

- `src/services/api/seoulSubwayApi.ts` - Seoul API integration
- `src/services/data/dataManager.ts` - Multi-tier data fetching
- `src/models/train.ts` - TypeScript interfaces
- `src/utils/subwayMapData.ts` - Station metadata

## Reference Documentation

For complete implementations, see [references/parsing-examples.md](references/parsing-examples.md):
- Arrival time parsing functions
- Direction normalization
- Station name fuzzy matching
- Line ID extraction
- Data caching with TTL
- Multi-tier data fetching
- Timetable processing
- API error handling
