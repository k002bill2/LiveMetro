# Station API 상세 레퍼런스

## Seoul Open API 응답 타입

### 실시간 도착정보 (SeoulRealtimeArrival)
```typescript
interface SeoulRealtimeArrival {
  subwayId: string;        // 호선 ID ("1002")
  trainLineNm: string;     // 호선명 ("2호선")
  updnLine: string;        // "상행" | "하행"
  statnNm: string;         // 역명 ("강남")
  arvlMsg2: string;        // "2분후[1번째전]"
  btrainNo: string;        // 열차 번호
  bstatnNm: string;        // 최종 목적지역
  arvlCd: string;          // 도착 코드
  recptnDt: string;        // 수신 시간
}
```

### 역 정보 (SeoulStationInfo)
```typescript
interface SeoulStationInfo {
  STATION_CD: string;   // "0150"
  STATION_NM: string;   // "서울역"
  LINE_NUM: string;     // "01호선"
  FR_CODE: string;      // "150"
  XPOS: string;         // X좌표 (경도)
  YPOS: string;         // Y좌표 (위도)
}
```

### 시간표 (SeoulTimetableRow)
```typescript
interface SeoulTimetableRow {
  STATION_CD: string;         // "0222"
  STATION_NM: string;         // "강남"
  TRAIN_NO: string;           // 열차 번호
  ARRIVETIME: string;         // "08:30:00"
  LEFTTIME: string;           // "08:31:00"
  ORIGIN_STATION_NM: string;  // 출발역
  DEST_STATION_NM: string;    // 도착역
  WEEK_TAG: string;           // '1'평일 '2'토 '3'휴일
  INOUT_TAG: string;          // '1'상행 '2'하행
}
```

## stationsDataService 함수 목록

| 함수 | 인자 | 반환 | 설명 |
|------|------|------|------|
| `getLocalStation` | `stationIdOrName: string` | `Station \| null` | 다중 매칭 전략 (ID, 한글, 영문, 정규화) |
| `getLocalStationByName` | `stationName: string` | `Station \| null` | 정확한 이름 매칭만 |
| `searchLocalStations` | `query: string` | `Station[]` | 부분 매칭 검색 |
| `getAllLocalStations` | - | `Station[]` | 전체 역 |
| `getLocalStationsByLine` | `lineId: string` | `Station[]` | 노선별 역 (fr_code 순) |
| `getStationsWithLineInfo` | - | `StationWithLine[]` | 노선 정보 포함 |
| `searchStationsWithLineInfo` | `query: string` | `StationWithLine[]` | 노선 포함 검색 |
| `findStationCdByNameAndLine` | `name, lineId` | `string \| null` | station_cd 역조회 |

## trainService 함수 목록

| 함수 | 인자 | 반환 | 설명 |
|------|------|------|------|
| `getStation` | `stationId: string` | `Station \| null` | Firebase → Local 폴백 |
| `searchStations` | `searchTerm: string` | `Station[]` | Firebase → Local 검색 |
| `getStationsByLine` | `lineId: string` | `Station[]` | 노선별 역 |
| `getSubwayLines` | - | `SubwayLine[]` | 모든 노선 |
| `subscribeToTrainUpdates` | `stationId, callback` | `() => void` | 실시간 구독 (cleanup 반환) |
| `getNearbyStations` | `lat, lon, radiusKm` | `NearbyStation[]` | 주변역 |
| `getStationSchedule` | `code, weekTag, dir` | `Timetable[]` | 시간표 |
| `getTrainCongestion` | `trainId: string` | `Congestion` | 혼잡도 |

## 거리 계산 유틸리티

```typescript
import { locationService } from '@/services/location/locationService';

// 거리 계산 (미터)
const meters = locationService.calculateDistance(lat1, lon1, lat2, lon2);

// 포맷팅
locationService.formatDistance(1234);  // "1.2km"
locationService.formatDistance(567);   // "567m"

// 카테고리
locationService.getDistanceCategory(50);   // 'very-close' (0-100m)
locationService.getDistanceCategory(200);  // 'close' (101-300m)
locationService.getDistanceCategory(500);  // 'nearby' (301-1000m)
locationService.getDistanceCategory(2000); // 'far' (1000m+)
```

## 로컬 데이터 JSON 스키마

### seoulStations.json
```json
{
  "DATA": [{
    "line_num": "01호선",
    "station_nm": "서울역",
    "station_nm_eng": "Seoul Station",
    "station_nm_chn": "首尔站",
    "station_nm_jpn": "ソウル駅",
    "station_cd": "0150",
    "fr_code": "150"
  }]
}
```

### stationCoordinates.json
```json
{
  "0150": { "latitude": 37.5547, "longitude": 126.9706 },
  "0222": { "latitude": 37.4979, "longitude": 127.0276 }
}
```

### lines.json
```json
{
  "colors": { "1": "#0052CC", "2": "#2DB400" },
  "stations": { "1": ["0150", "0151"], "2": ["0201", "0202"] }
}
```

## API 키 로테이션

```typescript
// ApiKeyManager가 자동 관리
// 연속 3회 에러 시 키 비활성화 (1분)
// Rate limit 감지 시 즉시 다음 키로 전환
```

## 재시도 정책

```typescript
// withRetry: 최대 3회, 지수 백오프 (1s → 2s → 4s)
// 특정 에러 코드는 재시도하지 않음
```
