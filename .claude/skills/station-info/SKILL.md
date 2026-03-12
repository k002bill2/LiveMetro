---
name: station-info
description: "서울 지하철 역정보 조회 및 활용 가이드. 역 검색, 역 상세정보, 주변역 조회, 노선별 역 목록, 실시간 도착정보, 시간표 조회 등 역(station) 관련 작업 시 사용. Use when: (1) 역 데이터를 가져오거나 조회하는 코드 작성, (2) 역 검색/필터링 기능 구현, (3) 주변역/가까운역 찾기, (4) 실시간 도착정보 연동, (5) 시간표 조회, (6) 역 관련 컴포넌트/화면 개발, (7) 역정보, station, 역 조회, 역 검색 키워드 언급 시. 트리거 키워드: 역정보, 역 조회, 역 검색, station info, getStation, 주변역, 도착정보, 시간표."
---

# Station Info Skill

서울 지하철 역정보 시스템의 아키텍처, API, 사용 패턴을 제공한다.

## 핵심 서비스 계층

```
Seoul Open API → seoulSubwayApi.ts (rate limit 30초)
                        ↓
Firebase Firestore → trainService.ts (통합 레이어)
                        ↓
로컬 JSON 캐시 → stationsDataService.ts (폴백)
                        ↓
AsyncStorage → stationCacheService.ts (TTL 7일)
```

## 역 조회 패턴

### 단일 역 조회
```typescript
import { trainService } from '@/services/train/trainService';

// Firebase → Local 폴백 자동 처리
const station = await trainService.getStation(stationId);
// stationId: "0222" (station_cd) 또는 "강남" (이름)
```

### 역 검색
```typescript
// 한글/영문 모두 지원
const results = await trainService.searchStations('강남');
// 또는 로컬 전용
import { searchLocalStations } from '@/services/data/stationsDataService';
const results = searchLocalStations('gangnam');
```

### 노선별 역 목록
```typescript
const stations = await trainService.getStationsByLine('2');
// Firebase → getLocalStationsByLine 폴백
```

### 주변역 조회
```typescript
import { useNearbyStations } from '@/hooks/useNearbyStations';

const { nearbyStations, closestStation, loading } = useNearbyStations({
  radius: 1000,        // 1km
  maxStations: 10,
  autoUpdate: true,
  minUpdateInterval: 30000  // 30초
});
```

### 실시간 도착정보
```typescript
import { seoulSubwayApi } from '@/services/api/seoulSubwayApi';

const arrivals = await seoulSubwayApi.getRealtimeArrival('강남');
// Rate limit: 30초 최소 간격 자동 적용
```

### 시간표 조회
```typescript
const timetable = await seoulSubwayApi.getStationTimetable(
  '0222',   // station_cd
  '1',      // weekTag: '1'평일 '2'토 '3'휴일
  '1'       // inoutTag: '1'상행 '2'하행
);
```

## Station 모델

```typescript
interface Station {
  readonly id: string;           // station_cd ("0222")
  readonly name: string;         // "강남"
  readonly nameEn: string;       // "Gangnam"
  readonly lineId: string;       // "2"
  readonly coordinates: { readonly latitude: number; readonly longitude: number };
  readonly transfers: readonly string[];
  readonly stationCode?: string; // fr_code
}
```

## ID 매칭 전략 (우선순위)

1. station_cd 정확 매칭 (`"0222"`)
2. 한글명 매칭 (`"강남"`)
3. 영문명 매칭 (`"Gangnam"`, 대소문자 무시)
4. 정규화 ID 매칭 (`"gangnam"`)
5. 부분 이름 매칭 (`"jongno3ga_5"` → `"종로3가"`)

## 필수 규칙

- **Rate Limit**: Seoul API 호출 시 30초 최소 간격 준수
- **Fallback**: Firebase 실패 시 반드시 로컬 데이터 폴백
- **Cleanup**: `trainService.subscribeToTrainUpdates()` 반환 함수로 구독 정리
- **에러 처리**: throw 대신 빈 배열/null 반환
- **캐싱**: `stationCacheService` TTL 7일, 불필요한 API 호출 방지

## 관련 파일

상세 API 및 데이터 구조는 [references/station-api.md](references/station-api.md) 참조.

| 파일 | 경로 | 역할 |
|------|------|------|
| stationsDataService | `src/services/data/stationsDataService.ts` | 로컬 역 데이터 |
| trainService | `src/services/train/trainService.ts` | 통합 조회 |
| seoulSubwayApi | `src/services/api/seoulSubwayApi.ts` | Seoul API |
| stationCacheService | `src/services/data/stationCacheService.ts` | 캐싱 |
| locationService | `src/services/location/locationService.ts` | 위치/거리 |
| useNearbyStations | `src/hooks/useNearbyStations.ts` | 주변역 훅 |
| useAdjacentStations | `src/hooks/useAdjacentStations.ts` | 이전/다음 역 |
| useStationNavigation | `src/hooks/useStationNavigation.ts` | 노선 내 네비 |
| train.ts | `src/models/train.ts` | 타입 정의 |

## 데이터 소스

| 파일 | 용도 |
|------|------|
| `src/data/seoulStations.json` | 공식 역 데이터 (station_cd, 다국어명, fr_code) |
| `src/data/stationCoordinates.json` | 위도/경도 좌표 |
| `src/data/lines.json` | 노선 색상 및 역 순서 |
| `src/data/stations.json` | 지도용 좌표 |
