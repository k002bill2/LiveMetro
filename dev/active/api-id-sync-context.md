# API 키 관리 및 역 ID 동기화

## Overview
서울 열린데이터 API 다중 키 관리 및 즐겨찾기-StationNavigator 간 역 ID 불일치 문제 해결

## Status: In Progress
- **Started**: 2025-01-11
- **Last Updated**: 2026-01-13 09:45 KST
- **Progress**: 95%

## Background
1. 사용자가 많을 때 API rate limit 대응 필요
2. 즐겨찾기 "출발" 클릭 시 잘못된 역으로 연결되는 문제

## Session History

### 2025-01-11 Session 1
**완료:**
1. **ApiKeyManager 클래스 생성** (`src/services/api/apiKeyManager.ts`)
   - Round-Robin + Failover + 사용량 추적 하이브리드 전략
   - 자동 키 복구 (1분 후)
   - rate limit 감지 시 즉시 키 전환

2. **seoulSubwayApi.ts 수정**
   - ApiKeyManager 통합
   - 모든 API 메서드에서 다중 키 사용

3. **.env 파일 업데이트**
   - `EXPO_PUBLIC_SEOUL_SUBWAY_API_KEY_2` 추가

4. **역 순서 정렬 수정** (`src/services/data/stationsDataService.ts`)
   - `parseFrCode()` 함수 추가
   - 노선별 fr_code 기준 정렬

5. **역 ID 매칭 개선** (`src/hooks/useStationNavigation.ts`)
   - `findStationIndex()` 다중 매칭 함수 추가
   - ID, stationCode, name, nameEn으로 검색

6. **searchStations 로컬 폴백** (`src/services/train/trainService.ts`)
   - Firebase 실패/데이터 없음 시 로컬 데이터 사용

**발견된 이슈:**
- 기존 즐겨찾기는 Firebase doc.id 형식으로 저장되어 있을 수 있음
- 새로 추가한 즐겨찾기만 정상 작동할 가능성

**다음 세션:**
- 기존 즐겨찾기 마이그레이션 검토
- 실제 앱 테스트로 ID 동기화 확인

### 2026-01-12 Session 2
**완료:**
1. **시간표 API 에러 수정**
   - `publicDataApi.ts`: CORS 문제 있는 엔드포인트에 웹 플랫폼 체크 추가
   - `seoulSubwayApi.ts`: Optional Chaining 수정 (`?.RESULT?.MESSAGE`)
   - `seoulSubwayApi.ts`: 응답 구조 검증 추가
   - `seoulSubwayApi.ts`: 웹 플랫폼에서 HTTP API 스킵 로직 추가

2. **useTrainSchedule 훅 개선**
   - `publicDataApi` → `seoulSubwayApi.getStationTimetable()` 사용하도록 변경
   - 역명+호선 → station_cd 변환 로직 추가

3. **시간표 "2시간 내" 필터 제거**
   - `useTrainSchedule.ts`: 시간 필터링 로직 제거
   - `StationDetailScreen.tsx`: `minutesAhead` 옵션 제거
   - 빈 상태 메시지 업데이트: "운행 시간표가 없습니다"

**이슈 해결:**
- "API Error: undefined" 에러 → Optional Chaining 및 응답 검증으로 수정
- CORS 문제 → 웹 플랫폼에서 graceful하게 빈 결과 반환

**다음 세션:**
- 네이티브 환경에서 시간표 API 실제 테스트
- 기존 즐겨찾기 마이그레이션 검토

### 2026-01-13 Session 3
**완료:**
1. **테스트 코드 수정**
   - `seoulSubwayApi.test.ts`: API 키 환경변수 설정으로 모킹 문제 해결
   - `useFavorites.test.ts`: `migrateFavoritesToNewFormat` 함수 모킹 추가
   - `trainService.test.ts`: `searchLocalStations` 함수 모킹 추가

2. **EAS Preview 빌드 제출**
   - Android: https://expo.dev/accounts/younghwankang/projects/livemetro-subway-app/builds/cfe43c2d-fce1-45d9-9a07-432f6fa3bc85
   - iOS: https://expo.dev/accounts/younghwankang/projects/livemetro-subway-app/builds/3e9e28ce-951f-4051-84e4-a36eb1467536

3. **테스트 결과**
   - Test Suites: 27 passed
   - Tests: 617 passed, 9 skipped
   - Coverage: 24.43% (임계값 통과)

**이슈 해결:**
- Jest 테스트에서 `seoulSubwayApi` 싱글톤의 API 키 문제
- `useFavorites` 훅의 마이그레이션 함수 모킹 누락
- `trainService`의 로컬 검색 함수 모킹 누락

**다음 세션:**
- EAS 빌드 결과 확인
- 네이티브 환경에서 시간표 API 테스트
- 기존 즐겨찾기 마이그레이션 검토

## Key Files
- `src/services/api/apiKeyManager.ts` - 신규 생성
- `src/services/api/seoulSubwayApi.ts` - 수정 (시간표 API, CORS 처리)
- `src/services/api/publicDataApi.ts` - 수정 (CORS 처리, deprecated)
- `src/services/data/stationsDataService.ts` - 수정
- `src/services/train/trainService.ts` - 수정
- `src/hooks/useStationNavigation.ts` - 수정
- `src/hooks/useTrainSchedule.ts` - 수정 (seoulSubwayApi 사용)
- `src/screens/station/StationDetailScreen.tsx` - 수정 (시간표 UI)
- `.env` - 키 추가

## Technical Notes
- 모든 역 ID는 seoulStations.json의 `station_cd` 형식으로 통일되어야 함
- Firebase와 로컬 데이터 간 폴백 시 ID 형식 일관성 중요
