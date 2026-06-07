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
```typescript
interface TrainArrival {
  trainNo: string;
  stationName: string;
  direction: 'up' | 'down';
  arrivalTime: number;     // Seconds until arrival
  destinationName: string;
  lineId: string;
  status: 'NORMAL' | 'DELAYED' | 'SUSPENDED' | 'EMERGENCY';
  congestion?: 'RELAXED' | 'NORMAL' | 'CROWDED' | 'VERY_CROWDED';
  updatedAt: Date;
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
| `수인분당선` | `suin` |

## Service Disruption Keywords

| Severity | Keywords |
|----------|----------|
| **SEVERE** | 운행중단, 전면중단, 운행불가 |
| **MAJOR** | 장애, 고장, 사고, 탈선, 화재 |
| **MODERATE** | 지연, 혼잡, 서행 |

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
