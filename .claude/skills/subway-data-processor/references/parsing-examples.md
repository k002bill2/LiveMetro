# Subway Data Processor - Code Examples

## Real-Time Arrival Parsing

```typescript
function parseArrivalTime(arvlMsg: string): number {
  // "2분후[1번째전]" → 120 seconds
  // "곧 도착" → 30 seconds
  // "전역 도착" → 60 seconds

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

---

## Service Disruption Detection

```typescript
function detectServiceDisruptions(arvlMsg: string): {
  isDisrupted: boolean;
  severity: 'MINOR' | 'MODERATE' | 'MAJOR' | 'SEVERE';
  reason?: string;
} {
  const suspensionKeywords = ['운행중단', '전면중단', '운행불가', '서비스중단'];
  const incidentKeywords = ['장애', '고장', '사고', '탈선', '화재', '신호장애'];
  const delayKeywords = ['지연', '혼잡', '서행'];

  const msg = arvlMsg.toLowerCase();

  if (suspensionKeywords.some(keyword => msg.includes(keyword))) {
    return { isDisrupted: true, severity: 'SEVERE', reason: 'SERVICE_SUSPENDED' };
  }

  if (incidentKeywords.some(keyword => msg.includes(keyword))) {
    return { isDisrupted: true, severity: 'MAJOR', reason: 'INCIDENT' };
  }

  if (delayKeywords.some(keyword => msg.includes(keyword))) {
    return { isDisrupted: true, severity: 'MODERATE', reason: 'DELAYED' };
  }

  return { isDisrupted: false, severity: 'MINOR' };
}
```

---

## Station Name Normalization

```typescript
function normalizeStationName(name: string): string {
  let normalized = name.replace(/역$/, '').trim();
  normalized = normalized.replace(/\s+/g, '');

  const specialCases: Record<string, string> = {
    '서울역': '서울',
    '신도림역': '신도림',
    '강남역': '강남',
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

---

## Line ID Extraction

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

  const match = trainLineNm.match(/(\d+)호선/);
  if (match) {
    return `line${match[1]}`;
  }

  for (const [korean, id] of Object.entries(lineMap)) {
    if (trainLineNm.includes(korean)) {
      return id;
    }
  }

  return 'unknown';
}
```

---

## Data Caching with TTL

```typescript
import AsyncStorage from '@react-native-async-storage/async-storage';

interface CachedData<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

async function getCachedData<T>(
  key: string,
  ttl: number = 30000
): Promise<T | null> {
  try {
    const cached = await AsyncStorage.getItem(key);
    if (!cached) return null;

    const { data, timestamp, ttl: cacheTtl }: CachedData<T> = JSON.parse(cached);

    const age = Date.now() - timestamp;
    const effectiveTtl = cacheTtl || ttl;

    if (age > effectiveTtl) {
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

---

## Multi-Tier Data Fetching

```typescript
async function getTrainArrivals(stationId: string): Promise<TrainArrival[]> {
  const cacheKey = `arrivals_${stationId}`;
  const ttl = 30000;

  // Tier 1: Check cache
  const cached = await getCachedData<TrainArrival[]>(cacheKey, ttl);
  if (cached) {
    console.log('Using cached data');
    return cached;
  }

  try {
    // Tier 2: Seoul API (primary)
    const seoulData = await seoulSubwayApi.getRealtimeArrival(stationId);
    const arrivals = normalizeSeoulApiResponse(seoulData);

    await setCachedData(cacheKey, arrivals, ttl);
    console.log('Fetched from Seoul API');
    return arrivals;
  } catch (seoulError) {
    console.warn('Seoul API failed, trying Firebase:', seoulError);

    try {
      // Tier 3: Firebase (fallback)
      const firebaseData = await trainService.getTrainArrivals(stationId);
      await setCachedData(cacheKey, firebaseData, ttl);

      console.log('Fetched from Firebase');
      return firebaseData;
    } catch (firebaseError) {
      console.error('All data sources failed:', firebaseError);
      return [];
    }
  }
}
```

---

## Timetable Processing

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

---

## API Error Handling

```typescript
function isValidApiResponse(response: any): boolean {
  if (response.RESULT?.CODE === 'ERROR') {
    return false;
  }

  if (response.realtimeArrivalList === undefined) {
    return false;
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
