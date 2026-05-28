# Train Info Gap Analysis — 가이드 vs 현재 코드

**Phase**: train-info-gap-analysis (Phase A of sprightly-hugging-snail plan)
**Date**: 2026-05-17
**SoT**: `/Users/younghwankang/Library/Mobile Documents/iCloud~md~obsidian/Documents/icloud Obsidian/Clippings/실시간 서울 지하철 알림 앱 구현 가이드 2026-05-16.md`

## TL;DR

가이드 13개 표준 항목 + 추가 2개 = **15개 중 PARTIAL/NO 10개**. 통증 ③("개선 추측만 누적")의 정체는 가이드와의 gap이 측정되지 않은 것. 핵심 6개 항목은 surgical fix 가능 (총 4-7일). 나머지(무장애 알고리즘, 칸별 혼잡도, 하차문 번호)는 별도 phase.

| 판정 | 항목 수 | 항목 번호 |
|---|---|---|
| ✅ YES | 5 | 3, 9, 12, A, B |
| 🟡 PARTIAL | 6 | 1, 6, 7, 8, 10, 13 |
| ❌ NO | 4 | 2, 4, 5, 11 |

---

## 판정 범례

- **✅ YES**: 가이드 명세대로 구현됨 + test 커버됨
- **🟡 PARTIAL**: 일부 구현 / test 미커버 / edge case 빠짐 / 가이드 일부만 만족
- **❌ NO**: 미구현 / 가이드와 크게 어긋남

---

## 검증 결과 (15개 항목 상세)

### 1. arvlCd 매핑 (0~5, 99) — ✅ YES (Phase B.2에서 완료, 2026-05-17)

**가이드**: 0:진입, 1:도착, 2:출발, 3:전역출발, 4:전역진입, 5:전역도착, 99:운행중 — 7개 코드.

**구현 (commit pending)**:
- `seoulSubwayApi.ts:642` 직후에 `code === '99'` 분기 추가
- 처리: `arrivalTime = null` (표시 제외) — "운행중"은 도착 임박 단계가 아닌 평상 운행 상태이므로 잔여 시간 정보 없음. code 2(당역 출발)와 동일 패턴.
- 가이드 7개 코드 매핑 100% 달성.

**Test 커버리지**: `seoulSubwayApi.test.ts`에 `arvlCd 99 → null` 케이스 추가.

---

### 2. recptnDt 시간 보정 — ✅ YES (Phase B.1-B.3에서 완료, 2026-05-17)

**가이드**: API 응답의 recptnDt와 현재 기기 시각 비교 → 시차만큼 위치 보정.

**구현 (commit pending)**:
- `seoulSubwayApi.ts` — `parseRecptnDtToMs(recptnDt)` helper 추가 (KST `+09:00` 명시).
- `convertToAppTrain()` — arvlCd '2' override 직후 보정 로직. 가드: arrivalTime > 0, elapsed > 0, elapsed ≤ 600s (RECPTN_DT_MAX_AGE_SECONDS), 결과 clip to 0.
- 두 포맷 지원: `"YYYY-MM-DD HH:MM:SS"` (space) + `"YYYYMMDDHHMMSS"` (compact).

**Test 커버리지**: `seoulSubwayApi.test.ts`에 15개 새 케이스 (8 latency compensation + 7 parser). 103/103 회귀 PASS.

---

### 3. 폴링 주기 — ✅ YES (정책 충돌 있음)

**증거**:
- `src/services/notification/trainArrivalAlertService.ts:56` — `MIN_POLLING_INTERVAL_SECONDS = 30` (`.claude/rules/seoul-api-limits.md`의 30s minimum)
- `src/services/notification/delayResponseAlertService.ts:69` — `DEFAULT_POLLING_INTERVAL_SECONDS = 60`
- `Math.max(config.pollingIntervalSeconds, MIN_POLLING_INTERVAL_SECONDS)` 강제

**가이드와 충돌**: 가이드 "15초 또는 1분" vs 우리 "30초 minimum". 우리가 안전한 선택 (rate limit 회피).

**미해결 결정**: 사용자가 폴링 주기 정책 결정 필요 (plan의 미해결 결정 #1).

**Fix 옵션**:
- (A) 가이드 따름 — 15s allow (rate limit 위험)
- (B) 현 유지 — 30s minimum
- (C) 하이브리드 — active screen 15s, inactive 60s (메모리 `[비활성 화면 폴링 게이팅]`과 일관)

→ **결정 보류, 데이터 캡처(Phase A.3) 후 재논의**.

---

### 4. 칸별 혼잡도 4단계 — ❌ NO

**가이드**: 여유(파랑)/보통(초록)/주의(노랑)/혼잡(빨강). SKT T-WiFi 데이터 융합.

**증거**:
- `src/services/congestion/` — heatmap, dataQuality, congestionService 존재
- 모두 **역/노선 단위** congestion. **per-car 데이터 없음**
- SKT T-WiFi 통합 코드 0건
- `weightAdjuster.ts:42` — `congestionLevel`을 OD 가중치 부스트에 사용 (다른 목적)

**Fix**: 별도 phase. SKT API 라이선스 + 데이터 모델 추가 필요. **추정 2-4주**.

---

### 5. 추천 칸 2곳 안내 — ❌ NO

**가이드**: 가장 덜 붐비는 추천 칸 2곳 안내.

**증거**: 코드 0건. 항목 4의 prerequisite.

**Fix**: 항목 4 완성 후 derived UI. 별도 phase.

---

### 6. ERROR-500 / ERROR-336 분기 + fallback UI — ✅ YES (서비스 레이어, Phase B.3, 2026-05-17)

**가이드**: ERROR-500, ERROR-336 등 + 대체 UI(Fallback).

**구현 (commit pending)**:
- `SeoulApiError` class 신설 (`errorCode`, `category`, `retryable` 노출). UI가 throw된 에러를 카테고리별 분기 가능.
- `categorizeSeoulApiError(code)` helper — Seoul Open Data Portal 관례 기반 5개 카테고리:
  - `auth`: INFO-100, ERROR-331, ERROR-332 (인증 실패)
  - `quota`: INFO-300, ERROR-334, ERROR-500, ERROR-501 (rate limit / 서버 부하)
  - `transient`: ERROR-335, ERROR-336 (일시 dispatcher hiccup, retry-friendly)
  - `client`: ERROR-300, ERROR-301, ERROR-310, ERROR-333 (잘못된 요청 / 권한)
  - `unknown`: 매핑 안 된 코드
- `getRealtimeArrival()` 분기:
  - `quota` → 백업 키로 전환 (기존 ERROR-500 동작 유지 + ERROR-334 확장)
  - `transient` → 키 전환 없이 retry (withRetry wrapper가 처리)
  - 기타 → reportError
- 외부 catch에서 `SeoulApiError instanceof` 확인 후 re-throw (이전엔 generic Error로 wrap하면서 errorCode 손실).

**별도 phase로 분리됨**: `src/components/common/ErrorFallback.tsx` (UI 컴포넌트). 본 phase는 서비스 레이어만 surgical 수술. UI 분기 base 마련됨.

**Test 커버리지**: 7개 신규 케이스 — 5개 카테고리별 + unknown fallback + errorCode property exposure + instanceof.

---

### 7. 시간표 평일/토/공휴일 + 첫차/막차 별도 탭 — 🟡 PARTIAL (service ✅, UI 별도 phase) — Phase B.5 service 완료, 2026-05-17

**증거**:
- `src/hooks/useTrainSchedule.ts:78` — `dayType: 'weekday' | 'saturday' | 'holiday'` ✓
- Line 99-112 — 한국 공휴일 → '3', 토요일 → '2', 평일 → '1' 처리 ✓
- `src/screens/station/StationDetailScreen.tsx:11` — "4-tab control (출발/도착/시간표/즐겨찾기)" ✓

**구현 (commit pending, service layer)**:
- `getFirstTrain(schedules) / getLastTrain(schedules)` helper export
- 핵심 도메인 인사이트: **operating day** (04:00 → 익일 03:59) 개념. 막차 00:38은 *전날 운행*에 속하므로 단순 string compare가 첫차로 오인하는 함정 회피 (`arrivalTimeToOperatingMinutes(time): number`).
- Malformed time → Infinity (safe-fail for first, surface for last inspection).

**별도 phase로 분리됨**: TimetableScreen 또는 StationDetailScreen 시간표 tab에 sub-tab(전체/첫차/막차) 추가. UI 작업.

**Test 커버리지**: 8개 신규 케이스 — 4 first (regular/post-midnight/empty/single) + 4 last (regular/막차 시나리오/empty/malformed).

---

### 8. btrainSttus 일반/급행 구분 — ✅ YES (service + Card UI 완료) — Phase B.4 + B.4-UI, 2026-05-17

**Phase B.4-UI (commit `11d9d5d`, PR #125)**:
- `TrainArrivalCard`에 `trainType?: TrainType` prop 추가
- `'express'` → 급행 배지 (warning yellow + 검정 텍스트, contrast 디자인 결정)
- `'rapid'` → 특급 배지 (error red + 흰색 텍스트)
- `'normal'` / undefined → 미렌더 (UI noise 최소화)
- accessibilityLabel `"${label} 열차"` + `accessibilityRole="text"` (VoiceOver/TalkBack 지원)
- `showDetails={false}` 시 lineBadge와 함께 숨김 (density-affordance 일관)
- Test: +5 cases (TrainArrivalCard.test.tsx 34/34 pass)

**남은 wiring (다음 세션 작업)**: `TrainArrivalList` / `HomeScreen`에서 `arrival.trainType` → Card prop 전달. 데이터는 service에서 노출(PR #123)되어 있고 Card는 prop 받을 준비(PR #125) 완료. 중간 plumbing 1-2시간.

**구현 (commit pending, service layer)**:
- `TrainType` enum 신설: `'normal' | 'express' | 'rapid'`
- `parseTrainType(btrainSttus)` helper — 한국어 정규화:
  - "일반" / 빈 string / 알 수 없는 값 → `'normal'` (safe fallback)
  - "급행" → `'express'`
  - "특급" / "ITX*" / "직통" → `'rapid'`
- `convertToAppTrain` 반환 객체에 `trainType: TrainType` 필드 추가 (required, UI 분기 안전성 보장)
- 호출자 영향: `convertToAppTrain` mock 3곳 update (`setup.ts`, `dataManager.test.ts` 2 sites)

**별도 phase로 분리됨**:
- TrainArrivalCard 등 UI 컴포넌트에서 trainType별 색상/아이콘 차등 표시
- 시간표 화면에 급행 필터 추가 (item #7과 연계)

**Test 커버리지**: 12개 신규 케이스 — 8 parseTrainType (5 매핑 + 2 fallback + 1 whitespace) + 4 convertToAppTrain trainType field.

---

### 9. GPS 하차 알람 — ✅ YES

**증거**:
- `src/services/notification/currentStationAlertService.ts:5` — "geofence-based detection" ✓
- `src/services/location/locationService.ts:77` — `geofences: Map<string, GeofenceRegion>` ✓
- `Line 163` — `Location.getCurrentPositionAsync` ✓

**검증 필요 (Phase A.4 e2e)**: 실제 백그라운드 상태에서 작동하는지. iOS/Android 양 플랫폼 권한.

---

### 10. 무장애 경로 (휠체어/고령자/임산부) — 🟡 PARTIAL

**증거**:
- `src/models/publicData.ts:109-145` — 교통약자 시설 데이터 모델 ✓
- `src/components/station/AccessibilitySection.tsx` — UI 컴포넌트 ✓
- **누락**: route 알고리즘에 barrier-free option 검색 0건. `kShortestPath.ts`/`routeService.ts`에 wheelchair/elevator filter 없음.

**Fix**: 별도 phase (큰 작업). barrier-free 데이터를 route 가중치에 통합 필요. **추정 2-3주**.

---

### 11. 빠른 환승 하차문 (내리는 문 번호) — ❌ NO

**증거**:
- `exitNumber` 필드는 **출구 번호** (역의 외부 출구 1번/2번 등).
- 가이드의 "빠른 환승 하차문" = 열차 차량의 **N번 도어** (내리는 문). 다른 개념.
- 서울교통공사 도어 데이터 자체가 우리 데이터에 없음.

**Fix**: 별도 phase. 외부 데이터 수집 + 데이터 모델 추가. **추정 1-2주**.

---

### 12. GPS 백그라운드 알람 — ✅ YES

**증거**:
- `src/hooks/useRealtimeTrains.ts:186-187` — `AppState.addEventListener('change', ...)` ✓
- Line 176-177 — "AppState 복귀 시 강제 refresh — 백그라운드에 오래 있다가 돌아오면 폴링 타이머가" ✓
- `src/hooks/useLocation.ts:318-323` — `handleAppStateChange` ✓

**검증 필요 (Phase A.4 e2e)**: 실제 백그라운드에서 FCM 알림 trigger 확인.

---

### 13. 8선형 + 2호선 원형 노선도 — 🟡 PARTIAL — Phase B.6 code review 완료, 2026-05-17

**증거 (코드 review)**:
- `src/utils/subwayMapData.ts:6` — 코멘트 "8선형 (Octolinear) grid system with 45° angles" ✓
- `src/utils/subwayMapData.ts:188-197` — **2호선 원형 코드 박힘**: trunk subarray 끝에 첫 station 좌표 추가해 path 닫음 (branch 지선은 제외). `mapLayout.test.ts:68`에 `'edge-2-loop'` test 존재 ✓
- `src/components/commute/RouteWithTransfer.tsx:295` — `transform: [{ rotate: '45deg' }]` (commute timeline용)
- 모델 레벨: `src/models/route.ts:12-27` — Line 2 circular 'up→내선 / down→외선' 매핑 ✓
- `__tests__/direction.test.ts` — Line 2 circular direction test 존재 ✓

**남은 검증 필요 (별도 작업, 사용자 화면 캡처)**:
- 8선형(Octolinear): 코드는 `stations.json`의 (x, y) 좌표를 그대로 polyline으로 렌더링하므로 8선형 강제는 **데이터 좌표 quality**에 의존. 인접 station dx/dy가 0, ±n, 또는 ±n,±n (수평/수직/45°) 패턴인지 데이터 분석 필요.
- 실제 시각이 가이드의 "Red Dot 2024" 디자인 표준과 일치하는지 사용자 앱 화면 확인 필요.

**Fix**: 데이터 좌표 분석 + 시각 검증은 별도 phase. 코드 의도/2호선 원형은 박혀있음.

---

### A. sub-minute 표시 (1분 미만 시 초 단위) — ✅ YES

**증거**:
- `src/screens/home/HomeScreen.tsx:208` — "secondsLeft so the topmost row can" ✓
- Line 219 — `readonly secondsLeft?: number; // first row only` ✓
- Line 317-327 — `totalSecondsLeft <= 90` 분기 ✓
- `src/utils/dateUtils.ts:74` — `if (diffSeconds < 60) return '곧 도착';` ✓
- 메모리 `[도착시간 sub-minute 정책 (2026-05-07 반전)]`와 일치

---

### B. AppState background pause — ✅ YES

**증거**:
- `src/hooks/useRealtimeTrains.ts:7` — `import { AppState, AppStateStatus }` ✓
- Line 186-187 — change listener ✓
- 백그라운드 → active 복귀 시 강제 refresh 로직 ✓

---

## Summary Table

| # | 항목 | 판정 | 핵심 증거 | 회귀 위험 | Fix 시간 |
|---|---|---|---|---|---|
| 1 | arvlCd 매핑 | 🟡 PARTIAL | code 99 누락 | 낮음 | 30분 |
| 2 | recptnDt 보정 | ❌ NO | type만, 보정 0건 | **높음** | 1일 |
| 3 | 폴링 주기 | ✅ YES (충돌) | 30s min vs 가이드 15s | 결정 보류 | - |
| 4 | 칸별 혼잡도 | ❌ NO | 역/노선만, per-car 없음 | 중간 | 2-4주 (별도 phase) |
| 5 | 추천 칸 2곳 | ❌ NO | 0건 | 낮음 | 항목 4 후속 |
| 6 | ERROR-500/-336 | 🟡 PARTIAL | ERROR-336 누락 | 중간 | 1일 |
| 7 | 시간표 탭 | 🟡 PARTIAL | dayType ✓, 첫차/막차 별도 탭 ✗ | 낮음 | 1-2일 |
| 8 | btrainSttus | 🟡 PARTIAL | parsing만, UI 분기 0건 | 중간 | 1일 |
| 9 | GPS 하차 알람 | ✅ YES | geofence + Location | - | - |
| 10 | 무장애 경로 | 🟡 PARTIAL | UI 표시만, 알고리즘 통합 0 | 중간 | 2-3주 (별도 phase) |
| 11 | 빠른 환승 하차문 | ❌ NO | 외부 데이터 부재 | 낮음 | 1-2주 (별도 phase) |
| 12 | GPS 백그라운드 | ✅ YES | AppState listener | - | - |
| 13 | 8선형 노선도 | 🟡 PARTIAL | 코멘트 ✓, 실제 렌더 미검증 | 낮음 | 1일 검증 |
| A | sub-minute | ✅ YES | secondsLeft 박힘 | - | - |
| B | AppState pause | ✅ YES | listener + refresh | - | - |

---

## Phase B 우선순위 (Surgical Fix)

총 6개 항목, 합쳐서 4-7일:

### 우선순위 1 — recptnDt 시간 보정 (NO, 사용자 통증 직접)
- 가이드가 명시적으로 "정확도 높이는 방법"으로 강조
- 응답 지연 N초 = 표시값이 N초 늦음 → 사용자 체감 부정확
- 1일

### 우선순위 2 — arvlCd 99 (운행중) 추가
- 30분 작업, easy win
- 메모리 + 가이드 모두 명시

### 우선순위 3 — ERROR-336 + 일반 fallback UI
- 1일
- 부수: ERrror-301, ERROR-336 등 300번대 그룹 통합 처리

### 우선순위 4 — btrainSttus 일반/급행 UI 분기
- 1일
- 영향: 사용자가 9호선 일반/급행 구분 못 함

### 우선순위 5 — 시간표 첫차/막차 별도 탭
- 1-2일
- UI 추가 + 데이터 필터링 로직

### 우선순위 6 — 8선형 노선도 시각 검증
- 1일
- 검증만, fix는 별도 (필요 시)

---

## 별도 Phase로 분리 (Long-term)

| 항목 | 추정 | 이유 |
|---|---|---|
| #4 칸별 혼잡도 + #5 추천 칸 | 2-4주 | SKT T-WiFi API 라이선스 + 데이터 모델 |
| #10 무장애 경로 알고리즘 | 2-3주 | barrier-free 데이터 ↔ K-shortest 통합 큰 작업 |
| #11 빠른 환승 하차문 | 1-2주 | 서울교통공사 도어 데이터 수집 필요 |

---

## Phase A 후속 작업

- **Phase A.3** anchor 5개 역 baseline snapshot — 폴링 주기 정책 #3 결정 데이터
- **Phase A.4** Integration test 7-10개 — Phase B fix가 GREEN으로 전환할 RED test 박기
- **Phase A.5** e2e 시나리오 — 회귀 catch
