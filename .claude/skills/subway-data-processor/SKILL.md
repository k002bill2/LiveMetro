---
name: subway-data-processor
description: Process and transform Seoul subway data including station info, real-time arrivals, and timetables. Use when working with Seoul Open Data API responses or subway data normalization.
---

# Subway Data Processor Skill

## Purpose
Handle complex Seoul subway data transformations, API response parsing, and data normalization for LiveMetro. Ensures consistent data structures across the app.

## When to Use
- Parsing Seoul Open Data API responses
- Normalizing subway data (Korean ↔ English fields)
- Handling service disruption detection
- Processing timetable data
- Transforming data for UI consumption
- Implementing caching logic

## Data Types

### Station
```typescript
interface Station {
  id: string;              // Unique station ID
  name: string;            // Korean name (e.g., "강남역")
  nameEn?: string;         // English name
  lineId: string;          // Reference to subway line
  coordinates: {
    latitude: number;
    longitude: number;
  };
  transfers?: string[];    // Transfer station IDs
  exits?: Exit[];          // Station exits
}
```

### SubwayLine
```typescript
interface SubwayLine {
  id: string;              // e.g., "line2"
  name: string;            // "2호선"
  nameEn: string;          // "Line 2"
  color: string;           // Hex color code
  sequence: number;        // Display order
  stations: string[];      // Station IDs in order
}
```

### TrainArrival
```typescript
interface TrainArrival {
  trainNo: string;
  stationName: string;
  direction: 'up' | 'down';
  arrivalTime: number;     // Seconds until arrival
  destinationName: string;
  lineId: string;
  previousStation?: string;
  nextStation?: string;
  status: TrainStatus;
  congestion?: CongestionLevel;
  updatedAt: Date;
}

type TrainStatus = 'NORMAL' | 'DELAYED' | 'SUSPENDED' | 'EMERGENCY';
type CongestionLevel = 'RELAXED' | 'NORMAL' | 'CROWDED' | 'VERY_CROWDED';
```

### Timetable
```typescript
interface TimetableEntry {
  stationId: string;
  lineId: string;
  direction: 'up' | 'down' | 'inner' | 'outer';
  weekType: 'weekday' | 'saturday' | 'sunday';
  departureTime: string;   // "HH:mm:ss"
  trainNo: string;
  destinationName: string;
}
```

## Seoul Open Data API Quirks

### 1. Real-Time Arrival API

**Endpoint**: `http://swopenapi.seoul.go.kr/api/subway/{API_KEY}/json/realtimeStationArrival/{START}/{END}/{STATION_NAME}`

**Response Structure**:
```json
{
  "realtimeArrivalList": [
    {
      "arvlMsg2": "2분후[1번째전]",     // Arrival message
      "arvlMsg3": "강남 방면",          // Direction message
      "btrainNo": "T1001",             // Train number
      "bstatnNm": "신도림",             // Destination
      "updnLine": "상행",               // Direction: 상행(up), 하행(down)
      "trainLineNm": "2호선",           // Line name
      "statnNm": "강남역",              // Current station
      "recptnDt": "2025-12-28 09:30:15" // Update time
    }
  ]
}
```

**Key Parsing Challenges**:

1. **Arrival Time Parsing**:
   - Korean text: "2분후[1번째전]", "곧 도착", "전역 도착"
   - Must extract numeric minutes
   - Handle special cases ("곧 도착" = 30 seconds)

2. **Direction Normalization**:
   - "상행" → "up"
   - "하행" → "down"
   - "내선" → "inner" (circular lines)
   - "외선" → "outer" (circular lines)

3. **Station Name Variations**:
   - May include/exclude "역" suffix
   - Spaces may vary
   - Use fuzzy matching

### 2. Timetable API

**Endpoint**: `http://openAPI.seoul.go.kr:8088/{API_KEY}/json/SearchSTNTimeTableByIDService/{START}/{END}/{STATION_CODE}/{WEEK_TAG}/{INOUT_TAG}/`

**Parameters**:
- `WEEK_TAG`: '1' (Weekday), '2' (Saturday), '3' (Sunday/Holiday)
- `INOUT_TAG`: '1' (Up/Inner), '2' (Down/Outer)

**Response Structure**:
```json
{
  "SearchSTNTimeTableByIDService": {
    "row": [
      {
        "STATION_NM": "강남",
        "ARRIVETIME": "05:30:00",
        "LEFTTIME": "05:30:30",
        "TRAIN_NO": "K100",
        "EXPRESS_YN": "N",
        "LAST_YN": "N"
      }
    ]
  }
}
```

## Instructions

### 1. Parsing Real-Time Arrival Data

```typescript
function parseArrivalTime(arvlMsg: string): number {
  // "2분후[1번째전]" → 120 seconds
  // "곧 도착" → 30 seconds
  // "전역 도착" → 60 seconds
  // "[0]분후[1번째전]" → 0 seconds

  if (arvlMsg.includes('곧 도착')) {
    return 30;
  }

  if (arvlMsg.includes('전역 도착')) {
    return 60;
  }

  const match = arvlMsg.match(/(\d+)분/);
  if (match) {
    return parseInt(match[1]) * 60;
  }

  return 0;
}

function normalizeDirection(updnLine: string): 'up' | 'down' {
  const direction = updnLine.trim();

  if (direction.includes('상행') || direction.includes('내선')) {
    return 'up';
  }

  if (direction.includes('하행') || direction.includes('외선')) {
    return 'down';
  }

  return 'up'; // Default
}

function normalizeSeoulApiResponse(apiResponse: any): TrainArrival[] {
  const arrivals = apiResponse.realtimeArrivalList || [];

  return arrivals.map((item: any) => ({
    trainNo: item.btrainNo,
    stationName: item.statnNm.replace('역', '').trim(),
    direction: normalizeDirection(item.updnLine),
    arrivalTime: parseArrivalTime(item.arvlMsg2),
    destinationName: item.bstatnNm.replace('역', '').trim(),
    lineId: extractLineId(item.trainLineNm),
    previousStation: item.bstatnNm,
    status: 'NORMAL',
    updatedAt: new Date(item.recptnDt)
  }));
}
```

### 2. Service Disruption Detection

```typescript
function detectServiceDisruptions(arvlMsg: string): {
  isDisrupted: boolean;
  severity: 'MINOR' | 'MODERATE' | 'MAJOR' | 'SEVERE';
  reason?: string;
} {
  const suspensionKeywords = [
    '운행중단', '전면중단', '운행불가', '서비스중단'
  ];

  const incidentKeywords = [
    '장애', '고장', '사고', '탈선', '화재', '신호장애'
  ];

  const delayKeywords = [
    '지연', '혼잡', '서행'
  ];

  const msg = arvlMsg.toLowerCase();

  // Check for service suspension (SEVERE)
  if (suspensionKeywords.some(keyword => msg.includes(keyword))) {
    return {
      isDisrupted: true,
      severity: 'SEVERE',
      reason: 'SERVICE_SUSPENDED'
    };
  }

  // Check for incidents (MAJOR)
  if (incidentKeywords.some(keyword => msg.includes(keyword))) {
    return {
      isDisrupted: true,
      severity: 'MAJOR',
      reason: 'INCIDENT'
    };
  }

  // Check for delays (MODERATE)
  if (delayKeywords.some(keyword => msg.includes(keyword))) {
    return {
      isDisrupted: true,
      severity: 'MODERATE',
      reason: 'DELAYED'
    };
  }

  return { isDisrupted: false, severity: 'MINOR' };
}
```

### 3. Station Name Normalization

```typescript
function normalizeStationName(name: string): string {
  // Remove "역" suffix
  let normalized = name.replace(/역$/, '').trim();

  // Remove extra spaces
  normalized = normalized.replace(/\s+/g, '');

  // Handle special cases
  const specialCases: Record<string, string> = {
    '서울역': '서울',
    '신도림역': '신도림',
    '강남역': '강남',
    // Add more as needed
  };

  return specialCases[name] || normalized;
}

function fuzzyMatchStation(
  inputName: string,
  stations: Station[]
): Station | null {
  const normalized = normalizeStationName(inputName);

  // Exact match
  let match = stations.find(s =>
    normalizeStationName(s.name) === normalized
  );

  if (match) return match;

  // Partial match
  match = stations.find(s =>
    normalizeStationName(s.name).includes(normalized) ||
    normalized.includes(normalizeStationName(s.name))
  );

  return match || null;
}
```

### 4. Line ID Extraction

```typescript
function extractLineId(trainLineNm: string): string {
  const lineMap: Record<string, string> = {
    '1호선': 'line1',
    '2호선': 'line2',
    '3호선': 'line3',
    '4호선': 'line4',
    '5호선': 'line5',
    '6호선': 'line6',
    '7호선': 'line7',
    '8호선': 'line8',
    '9호선': 'line9',
    '신분당선': 'shinbundang',
    '경의중앙선': 'gyeongui',
    '공항철도': 'airport',
    '수인분당선': 'suin'
  };

  // Extract number from string
  const match = trainLineNm.match(/(\d+)호선/);
  if (match) {
    return `line${match[1]}`;
  }

  // Check for special lines
  for (const [korean, id] of Object.entries(lineMap)) {
    if (trainLineNm.includes(korean)) {
      return id;
    }
  }

  return 'unknown';
}
```

### 5. Data Caching with TTL

```typescript
import AsyncStorage from '@react-native-async-storage/async-storage';

interface CachedData<T> {
  data: T;
  timestamp: number;
  ttl: number; // Time to live in milliseconds
}

async function getCachedData<T>(
  key: string,
  ttl: number = 30000 // 30 seconds default
): Promise<T | null> {
  try {
    const cached = await AsyncStorage.getItem(key);
    if (!cached) return null;

    const { data, timestamp, ttl: cacheTtl }: CachedData<T> = JSON.parse(cached);

    const age = Date.now() - timestamp;
    const effectiveTtl = cacheTtl || ttl;

    if (age > effectiveTtl) {
      // Cache expired
      await AsyncStorage.removeItem(key);
      return null;
    }

    return data;
  } catch (error) {
    console.error('Cache read error:', error);
    return null;
  }
}

async function setCachedData<T>(
  key: string,
  data: T,
  ttl: number = 30000
): Promise<void> {
  try {
    const cacheData: CachedData<T> = {
      data,
      timestamp: Date.now(),
      ttl
    };

    await AsyncStorage.setItem(key, JSON.stringify(cacheData));
  } catch (error) {
    console.error('Cache write error:', error);
  }
}
```

### 6. Multi-Tier Data Fetching

```typescript
async function getTrainArrivals(stationId: string): Promise<TrainArrival[]> {
  const cacheKey = `arrivals_${stationId}`;
  const ttl = 30000; // 30 seconds

  // Tier 1: Check cache
  const cached = await getCachedData<TrainArrival[]>(cacheKey, ttl);
  if (cached) {
    console.log('✅ Using cached data');
    return cached;
  }

  try {
    // Tier 2: Seoul API (primary)
    const seoulData = await seoulSubwayApi.getRealtimeArrival(stationId);
    const arrivals = normalizeSeoulApiResponse(seoulData);

    // Cache the result
    await setCachedData(cacheKey, arrivals, ttl);

    console.log('✅ Fetched from Seoul API');
    return arrivals;
  } catch (seoulError) {
    console.warn('Seoul API failed, trying Firebase:', seoulError);

    try {
      // Tier 3: Firebase (fallback)
      const firebaseData = await trainService.getTrainArrivals(stationId);

      // Cache the result
      await setCachedData(cacheKey, firebaseData, ttl);

      console.log('✅ Fetched from Firebase');
      return firebaseData;
    } catch (firebaseError) {
      console.error('All data sources failed:', firebaseError);

      // Return empty array instead of throwing
      return [];
    }
  }
}
```

## Timetable Processing

### Parse Timetable Response

```typescript
function parseTimetableResponse(
  apiResponse: any,
  stationId: string,
  lineId: string
): TimetableEntry[] {
  const rows = apiResponse.SearchSTNTimeTableByIDService?.row || [];

  return rows.map((row: any) => ({
    stationId,
    lineId,
    direction: row.INOUT_TAG === '1' ? 'up' : 'down',
    weekType: getWeekType(row.WEEK_TAG),
    departureTime: row.LEFTTIME || row.ARRIVETIME,
    trainNo: row.TRAIN_NO,
    destinationName: row.STATION_NM,
    isExpress: row.EXPRESS_YN === 'Y',
    isLastTrain: row.LAST_YN === 'Y'
  }));
}

function getWeekType(weekTag: string): 'weekday' | 'saturday' | 'sunday' {
  switch (weekTag) {
    case '1': return 'weekday';
    case '2': return 'saturday';
    case '3': return 'sunday';
    default: return 'weekday';
  }
}
```

## Error Handling

### API Error Handling

```typescript
function isValidApiResponse(response: any): boolean {
  // Seoul API returns different structures for errors
  if (response.RESULT?.CODE === 'ERROR') {
    return false;
  }

  if (response.realtimeArrivalList === undefined) {
    return false;
  }

  if (Array.isArray(response.realtimeArrivalList) &&
      response.realtimeArrivalList.length === 0) {
    // Empty array is valid (no trains currently)
    return true;
  }

  return true;
}

async function safeApiCall<T>(
  apiCall: () => Promise<T>,
  fallback: T
): Promise<T> {
  try {
    const response = await apiCall();

    if (!isValidApiResponse(response)) {
      console.warn('Invalid API response, using fallback');
      return fallback;
    }

    return response;
  } catch (error) {
    console.error('API call failed:', error);
    return fallback;
  }
}
```

## Best Practices

1. **Always Normalize Data**: Convert Korean to English enums
2. **Handle Missing Data**: Use optional chaining and defaults
3. **Cache Aggressively**: Seoul API has rate limits
4. **Validate Responses**: Seoul API error handling is inconsistent
5. **Log Data Issues**: Track parsing failures for debugging
6. **Use Fuzzy Matching**: Station names vary across APIs
7. **Implement Fallbacks**: Multi-tier data fetching (API → Firebase → Cache)

## Common Issues

### Issue 1: Station Name Mismatch
**Problem**: "강남역" vs "강남"
**Solution**: Always normalize by removing "역" suffix

### Issue 2: Circular Line Directions
**Problem**: Line 2 has "inner/outer" not "up/down"
**Solution**: Map "내선" → "up", "외선" → "down" for consistency

### Issue 3: Arrival Time "0분후"
**Problem**: "[0]분후[1번째전]" should be "곧 도착"
**Solution**: Treat 0 minutes as 30 seconds

### Issue 4: Multiple Stations Same Name
**Problem**: Some station names appear on multiple lines
**Solution**: Always include lineId in queries and responses

## Resources
- `src/services/api/seoulSubwayApi.ts`: Seoul API integration
- `src/services/data/dataManager.ts`: Multi-tier data fetching
- `src/models/train.ts`: TypeScript interfaces
- `src/utils/subwayMapData.ts`: Station and line metadata

---

*Use this skill to ensure consistent and reliable subway data processing throughout LiveMetro.*
