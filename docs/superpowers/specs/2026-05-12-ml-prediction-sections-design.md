# ML Prediction Page — Sections 6-9 Design Spec

| 항목 | 값 |
|---|---|
| 날짜 | 2026-05-12 |
| 작성자 | brainstorming session (Claude + user) |
| 상태 | Approved (pending user spec review) |
| 대상 화면 | `src/screens/prediction/WeeklyPredictionScreen.tsx` |
| 디자인 시안 | 사용자 제공 스크린샷 (2026-05-12) |
| 관련 파일 헤더 주석 | "Phase 7 — full hero redesign matching the design handoff" |

## 1. Overview

`WeeklyPredictionScreen.tsx`는 commute prediction 화면으로, 헤더 주석에 명시된 대로 Sections 1-5(상단바·헤더·예상시간 카드·라우트명·CTA)는 구현 완료, Sections 6-9는 "visual placeholders for now"로 남아있다. 이 spec은 남은 4개 섹션을 sub-component로 추출하고 실데이터로 wiring하는 작업을 정의한다.

### 1.1 Objectives

1. Sections 6-9를 `src/components/prediction/` 하위의 독립 컴포넌트로 추출
2. 기존 hook/service(`useCommutePattern`, `useCongestion`, `weatherService`, `routeService`)를 조합해 실데이터 wiring
3. 부족한 데이터(시간대별 혼잡도 슬롯)는 `congestionService.getHourlyForecast()` 메서드 신규 추가로 해결
4. WeeklyPredictionScreen을 879줄 → ~500줄로 축소 (800줄 한계 준수)
5. 각 phase 독립 PR + Quality Gate 통과 후 머지

### 1.2 Out of Scope

- 새 ML 모델 학습 / TensorFlow 활성화 (현재 disabled 상태 유지)
- 화면 라우트명 변경 (`WeeklyPrediction` 유지, navigation 호환성)
- Sections 1-5 재구현 또는 리디자인
- 다른 화면(StatisticsDashboard 등)의 변경
- 위치 기반 출발지 자동 감지 (별도 작업)

## 2. Context

### 2.1 기존 인프라

| 파일 | 역할 |
|---|---|
| `src/screens/prediction/WeeklyPredictionScreen.tsx` (879줄) | 현재 Sections 1-5 구현 + 6-9 placeholder |
| `src/hooks/useMLPrediction.ts` | ML 예측 (TensorFlow disabled, statistics fallback) |
| `src/hooks/useCommutePattern.ts` | `weekPredictions: PredictedCommute[]`, `todayPrediction`, 패턴 |
| `src/hooks/useCongestion.ts` | 실시간 + 평균 혼잡도, 4단계 enum |
| `src/services/weather/weatherService.ts` | Open-Meteo 기반 weather + WeatherImpact |
| `src/services/route/routeService.ts` | `RouteSegment[]` (stations, lineId, direction, stops) |
| `src/services/pattern/commuteLogService.ts` | 사용자 commute 로그 CRUD + 분석 |
| `src/models/congestion.ts` | `CongestionLevel` (여유/보통/혼잡/매우혼잡) |
| `src/styles/modernTheme.ts` | Wanted 디자인 토큰 (108개 파일에서 사용 중) |
| `src/components/prediction/` | 디렉토리 이미 존재 (sub-components 들어갈 자리) |

### 2.2 핵심 결정 (brainstorming 세션 결과)

1. **기존 파일에 Sections 6-9 추가** (새 페이지 생성 X, 코드 중복 회피)
2. **실데이터 wiring** (mock 아님, 기존 hook 조합)
3. **4 phase 분할** (각 1-3시간, 독립 PR)
4. **Weather row는 맑음일 때도 neutral 표시** (4행 고정, UI 일관성)
5. **Weekly trend 막대는 일괄 회색** (오늘만 강조, 시안 충실)

## 3. Architecture

### 3.1 파일 구조

```
src/screens/prediction/WeeklyPredictionScreen.tsx     (879→~500줄, 호스트)
src/components/prediction/
├── SegmentBreakdownSection.tsx                       (Section 6, ~120줄)
├── HourlyCongestionChart.tsx                         (Section 7, ~180줄)
├── PredictionFactorsSection.tsx                      (Section 8, ~100줄)
├── WeeklyTrendChart.tsx                              (Section 9, ~140줄)
└── __tests__/
    ├── SegmentBreakdownSection.test.tsx
    ├── HourlyCongestionChart.test.tsx
    ├── PredictionFactorsSection.test.tsx
    └── WeeklyTrendChart.test.tsx

src/services/congestion/congestionService.ts          (+ getHourlyForecast 메서드)
src/hooks/usePredictionFactors.ts                     (신규)
src/hooks/__tests__/usePredictionFactors.test.ts      (신규)
```

### 3.2 데이터 흐름

```
WeeklyPredictionScreen
  ├─ useCommutePattern → todayPrediction, weekPredictions, patterns
  ├─ useMLPrediction → prediction, confidence (Sections 1-5 기존)
  ├─ useCongestion(lineId, direction) → lineCongestion
  ├─ congestionService.getHourlyForecast() → 시간대 슬롯 (P2)
  ├─ usePredictionFactors() → factors 4개 통합 hook (P3)
  └─ routeService.getRoute() → segments (P1)
       │
       └─ Props 주입 → 4개 sub-component
```

### 3.3 Phase 의존성

4 phase는 완전 독립. 각 phase가 WeeklyPredictionScreen의 placeholder slot 1개를 sub-component로 교체. 파일 set 비겹침(`src/components/prediction/`은 phase별 별도 파일), 머지 순서 무관.

## 4. Phase 1 — Segment Breakdown (Section 6)

### 4.1 컴포넌트

`src/components/prediction/SegmentBreakdownSection.tsx`

```typescript
interface SegmentBreakdownSectionProps {
  readonly route: PredictedRoute;
  readonly origin: { name: string; exit: string };
  readonly destination: { name: string; exit: string };
}

interface PredictedRoute {
  readonly walkToStation: { durationMin: number };
  readonly wait: { lineId: string; direction: string; durationMin: number };
  readonly ride: {
    fromStation: string;
    toStation: string;
    stopsCount: number;
    durationMin: number;
    congestionLevel?: CongestionLevel;
  };
  readonly walkToDestination: { durationMin: number };
}
```

### 4.2 데이터 소스

| 행 | 출처 |
|---|---|
| 도보 (집→역) | `useCommutePattern.todayPrediction.walkOriginMin` (없으면 user.commuteSetup) |
| 대기 | `routeService.getRoute().segments[0]` + 평균 배차 |
| 승차 | `routeService.getRoute().segments[0]` (lineId, stations.length, ride time) |
| 도보 (역→회사) | `useCommutePattern.todayPrediction.walkDestinationMin` |

### 4.3 렌더 사양

각 행: 아이콘 circle (32x32, 좌측) + 라벨/부제목/배지 (중앙) + duration (우측, big number + "분").

- 도보 아이콘: `Footprints` (lucide)
- 대기 아이콘: `Clock`
- 승차 아이콘: `Train` (또는 line 색상의 circle + 노선번호)
- LineBadge atom 재사용 (메모리: `label_registry_input_domain_mismatch` — short-code alias 등록 확인)
- CongestionDots atom 재사용 (승차 행)

### 4.4 테스트 시나리오

- Happy: 4행 모두 렌더 + 분 텍스트 정확
- Edge: `stopsCount=0` → "0개역" 또는 fallback
- Edge: `walkOriginMin=0` → "0분"
- Error: route=null → "경로 정보 없음" empty state
- testID: `segment-row-walk-origin`, `segment-row-wait`, `segment-row-ride`, `segment-row-walk-destination`

### 4.5 Quality Gate

- [ ] type-check 0 error
- [ ] lint 0 error
- [ ] 새 테스트 통과 (4+ 시나리오)
- [ ] 커버리지 stmt ≥75%, fn ≥70%, branch ≥60%
- [ ] WeeklyPredictionScreen Section 6 placeholder를 `<SegmentBreakdownSection />`로 교체
- [ ] 다크모드 가시성 확인
- [ ] LineBadge에 lineId="2" 같은 short-code 매핑 검증

### 4.6 예상 시간: 1-2시간

## 5. Phase 2 — Hourly Congestion Forecast (Section 7)

### 5.1 컴포넌트

`src/components/prediction/HourlyCongestionChart.tsx`

```typescript
interface HourlyCongestionChartProps {
  readonly lineId: string;
  readonly direction: '상행' | '하행' | '내선' | '외선';
  readonly currentTime: Date;
  readonly slots: readonly HourlySlot[];
}

interface HourlySlot {
  readonly slotTime: string;                   // "08:30"
  readonly congestionPercent: number;          // 0-100
  readonly level: CongestionLevel;
}
```

### 5.2 신규 서비스 메서드

```typescript
// src/services/congestion/congestionService.ts
async getHourlyForecast(
  lineId: string,
  direction: Direction,
  currentTime: Date,
  options?: { slotMinutes?: number; slotCount?: number }
): Promise<HourlySlot[]>
```

**알고리즘**:
1. `currentTime - 30분 ~ currentTime + 60분`에서 15분 단위 7개 슬롯 생성
2. 각 슬롯마다 Firestore `congestionData/` 컬렉션에서 과거 동일 요일·동일 시간대 데이터 평균 조회
3. 평균 % 계산, 4단계 매핑 (`<50%`=여유, `<70%`=보통, `<85%`=혼잡, `≥85%`=매우혼잡)
4. 캐시 키: `hourly:${lineId}:${direction}:${slotStart ISO}`. TTL은 슬롯이 오늘 날짜면 1시간(곧 최신화), 과거 날짜면 24시간.
5. 빈 케이스: 슬롯은 생성하되 percent=null + level='unknown' → UI에서 회색 막대

### 5.3 강조 로직

```typescript
const currentSlotIndex = slots.findIndex(s => isSlotCurrent(s.slotTime, currentTime));
// 강조: 막대 색상 진하게 + "지금" 말풍선 위 + 라벨 굵게
```

### 5.4 색상 매핑 (Wanted 토큰)

| Level | Token (잠정) | 색상 |
|---|---|---|
| 여유 | `colors.success.subtle` | 연두 |
| 보통 | `colors.warning.subtle` | 연주황 |
| 혼잡 | `colors.danger.subtle` | 연빨강 |
| 매우혼잡 | `colors.danger.strong` | 진빨강 |
| unknown | `colors.bg.tertiary` | 회색 |

> 구현 시 `src/styles/modernTheme.ts` 또는 `wantedTokens.ts`에서 정확한 키 확인.

### 5.5 테스트 시나리오

- Happy: 7개 슬롯 렌더 + 현재 슬롯 강조
- Edge: `slots=[]` → "예측 데이터 없음" empty state
- Edge: currentTime이 슬롯 범위 밖 → 강조 없이 정상 렌더
- Edge: currentTime이 슬롯 경계 → 가장 가까운 슬롯 강조
- Service 단위 테스트: mock Firestore + 4단계 매핑 검증 (4 케이스)
- Service edge: 과거 데이터 0건 → unknown level + 회색 막대
- testID: `hourly-bar-0` ~ `hourly-bar-6`, `hourly-current-marker`, `hourly-legend`

### 5.6 Quality Gate

- [ ] type-check / lint 0 error
- [ ] HourlyCongestionChart 테스트 통과
- [ ] congestionService.getHourlyForecast 단위 테스트 통과
- [ ] 커버리지 stmt ≥75%
- [ ] WeeklyPredictionScreen Section 7 placeholder 교체
- [ ] 다크모드 막대 가시성 확인

### 5.7 예상 시간: 2-3시간 (신규 서비스 메서드 포함)

## 6. Phase 3 — Prediction Factors (Section 8)

### 6.1 컴포넌트

`src/components/prediction/PredictionFactorsSection.tsx`

```typescript
interface PredictionFactorsSectionProps {
  readonly factors: readonly PredictionFactor[];
}

interface PredictionFactor {
  readonly id: 'weather' | 'congestion' | 'delay' | 'pattern';
  readonly icon: React.ComponentType<{ size: number; color: string }>;
  readonly label: string;
  readonly value: string;
  readonly impact: FactorImpact;
}

type FactorImpact = 'negative' | 'positive' | 'neutral';
```

### 6.2 신규 hook

`src/hooks/usePredictionFactors.ts`

```typescript
export function usePredictionFactors(params: {
  lineId: string;
  direction: Direction;
  dayOfWeek: DayOfWeek;
}): { factors: PredictionFactor[]; loading: boolean }
```

### 6.3 4 factor 매핑

| Factor | 출처 | 변환 |
|---|---|---|
| weather | `weatherService.getCurrentForecast()` + `WeatherImpact` | `clear` → "맑음"/neutral; `rain` → "비 예보"/`+${impact.delayProbabilityIncrease}분`/negative; `snow` → "눈 예보"/negative; `fog`/`other` → "흐림"/neutral |
| congestion | `congestionService.getDailyAverage(lineId, dayOfWeek)` + 오늘 lineCongestion 비교 | 오늘 vs 평소 평균의 차이를 퍼센트 포인트(%p)로 계산 → "평소보다 ±N% ↑/↓" 표시. `>+5%p`면 negative, `<-5%p`면 positive, `-5%p ≤ Δ ≤ +5%p`면 neutral |
| delay | `trainDelayService.getActiveDelays(lineId)` | 활성 지연 0건 → "지연 없음" / "정시 운행" / positive; 활성 지연 있음 → 지연 수 + "+${avgDelay}분" / negative |
| pattern | `useCommutePattern.patterns[dayOfWeek].averageMin` | "${dayLabel} 패턴" / "평소 ${avg}분" / neutral |

### 6.4 색상 매핑

| Impact | Token (잠정) |
|---|---|
| negative | `colors.danger.fg` (빨강) |
| positive | `colors.success.fg` (초록) |
| neutral | `colors.text.tertiary` (무채색) |

### 6.5 아이콘 (lucide-react-native)

- weather: `CloudRain` (조건별 dynamic: 맑음 `Sun`, 비 `CloudRain`, 눈 `CloudSnow`)
- congestion: `Users`
- delay: `Check` (positive) / `AlertTriangle` (negative)
- pattern: `Calendar`

### 6.6 테스트 시나리오

- Happy: 4행 모두 렌더 + impact별 색상 정확
- Edge: 모든 factor positive → 4행 모두 초록 (UI 일관성)
- Edge: weather=clear → "맑음"/neutral 표시 (hide 아님)
- Error: weatherService 실패 → weather row를 fallback "날씨 정보 없음"/neutral로 표시 (다른 row 영향 X)
- Hook 단위 테스트: 4개 데이터 출처 mock, factor 변환 검증
- testID: `factor-row-weather`, `factor-row-congestion`, `factor-row-delay`, `factor-row-pattern`

### 6.7 Quality Gate

- [ ] type-check / lint 0 error
- [ ] PredictionFactorsSection 컴포넌트 테스트 통과
- [ ] usePredictionFactors hook 테스트 통과 (mock 4 sources)
- [ ] 커버리지 stmt ≥75%
- [ ] WeeklyPredictionScreen Section 8 placeholder 교체
- [ ] 다크모드 가시성 확인

### 6.8 예상 시간: 1.5-2시간

## 7. Phase 4 — Weekly Trend (Section 9)

### 7.1 컴포넌트

`src/components/prediction/WeeklyTrendChart.tsx`

```typescript
interface WeeklyTrendChartProps {
  readonly days: readonly DayBarData[];
  readonly todayIndex: number;
  readonly averageMin: number;
}

interface DayBarData {
  readonly dayLabel: '월' | '화' | '수' | '목' | '금';
  readonly durationMin: number;
  readonly isToday: boolean;
}
```

### 7.2 데이터 소스

```typescript
const { weekPredictions } = useCommutePattern();
const weekdayPredictions = weekPredictions.filter(p =>
  p.dayOfWeek !== 'SAT' && p.dayOfWeek !== 'SUN'
);
const todayIndex = weekdayPredictions.findIndex(p => isSameDay(p.date, new Date()));
```

**Fallback 사다리**:
1. `useCommutePattern.weekPredictions` (1순위)
2. `commuteLogService.getCommuteLogs(this week)` 평균 (2순위, weekPredictions가 평일 5일 미달일 때)
3. Empty state "이번 주 데이터 부족" (3순위, 모두 비었을 때 — 5개 회색 막대 + 라벨만)

### 7.3 강조 로직

- 오늘 = `colors.primary` (파란 박스) + 굵은 라벨
- 나머지 = `colors.bg.secondary` (회색, 일괄)
- 과거/미래 구분 없음 (시안 충실, 결정 사항)

### 7.4 부제목 계산

```typescript
const todayDuration = days[todayIndex]?.durationMin;
const otherDays = days.filter((_, i) => i !== todayIndex);
const avgExcludingToday = otherDays.length > 0
  ? otherDays.reduce((sum, d) => sum + d.durationMin, 0) / otherDays.length
  : 0;
const diff = Math.round((todayDuration ?? 0) - avgExcludingToday);

// todayIndex=-1(주말 등)이거나 fallback 케이스
const subtitle = todayIndex === -1     ? '이번 주 평일 예측'
               : diff < 0              ? `평균 대비 오늘 ${diff}분`
               : diff > 0              ? `평균 대비 오늘 +${diff}분`
               :                         `평소와 같음`;
```

### 7.5 테스트 시나리오

- Happy: 5개 막대, 수요일=today=강조, 부제목 "평균 대비 오늘 -3분"
- Edge: today=월요일 → 첫 막대 강조
- Edge: today=금요일 → 마지막 막대 강조
- Edge: today=일요일 → todayIndex=-1, 강조 없이 5개 평일만 표시
- Edge: weekPredictions=[] → fallback로 commuteLogService 호출 검증
- Edge: 모든 데이터 부족 → empty state
- Edge: 모든 날짜 동일 분 → 부제목 "평소와 같음"
- Visual: 막대 높이가 분에 비례
- testID: `weekly-bar-0` ~ `weekly-bar-4`, `weekly-today-bar`, `weekly-trend-subtitle`

### 7.6 Quality Gate

- [ ] type-check / lint 0 error
- [ ] WeeklyTrendChart 테스트 통과 (8+ 시나리오)
- [ ] 커버리지 stmt ≥75%
- [ ] WeeklyPredictionScreen Section 9 placeholder 교체
- [ ] 다크모드 파란 강조 + 회색 콘트라스트 확인

### 7.7 예상 시간: 1-1.5시간

## 8. Risk Assessment

| Risk | Probability | Impact | Mitigation |
|---|---|---|---|
| WeeklyPredictionScreen 879→500줄 추출 중 회귀 | Medium | High | 각 phase가 placeholder 1개씩만 교체 (surgical), Section 1-5 코드 미수정 |
| useCommutePattern.weekPredictions가 평일 미달 | Medium | Medium | commuteLogService fallback 사다리 (P4) |
| congestionService 과거 데이터 부족 | High | Medium | unknown level + 회색 막대 fallback (P2) |
| weatherService 메서드 시그니처 불일치 | Low | Low | 구현 시작 시 service 파일 정독, 메서드 추가 시 별도 PR로 분리 가능 |
| LineBadge short-code alias 부재 (메모리 사례) | Medium | Low | Phase 1에서 alias 등록 미리 확인 (`colorUtils.normalize` 또는 `LINE_LABELS`) |
| 다크모드 색상 일부 누락 (Wanted 토큰 미정의) | Low | Medium | 각 phase Quality Gate에 다크모드 토글 항목 포함 |
| 차트 컴포넌트 inline 구현이 재사용 불가 | Low | Low | YAGNI 원칙 준수. 3번째 차트 등장 시 atom 추출 검토 |

## 9. Rollback Strategy

각 phase가 독립 PR이므로 phase별 단순 revert로 롤백 가능.

| Phase | 롤백 | 영향 |
|---|---|---|
| P1 | `git revert <segment PR>` + WeeklyPredictionScreen Section 6 placeholder 복원 | Section 6만 placeholder로 복귀 |
| P2 | `git revert <hourly PR>` + congestionService.getHourlyForecast 메서드 제거 | Section 7만 복귀, 다른 phase 영향 0 |
| P3 | `git revert <factors PR>` + usePredictionFactors hook 제거 | Section 8만 복귀 |
| P4 | `git revert <weekly PR>` | Section 9만 복귀 |

데이터 마이그레이션 / Firestore 스키마 변경 없음 → DB 롤백 불필요.

## 10. Cross-Phase Dependencies

| 의존 항목 | 어디서 결정 | 누가 검증 |
|---|---|---|
| Wanted 토큰명 (`colors.success.subtle` 등) | 각 phase 구현 시 `modernTheme.ts`/`wantedTokens.ts` 정독 | 각 phase Quality Gate |
| LineBadge short-code alias | P1 시작 시 | P1 |
| `currentSlotIndex` / `todayIndex` 계산 유틸 | 각 phase가 inline (3번째 등장 시 추출) | reviewer 판단 |
| Firestore 인덱스 (congestionData 시간대 쿼리) | P2 시작 시 | P2 — `firestore.indexes.json` 갱신 |

## 11. Definition of Done (전체 PR 종료 기준)

- [ ] 4 phase 모두 머지 완료
- [ ] WeeklyPredictionScreen 줄 수 800 이하
- [ ] 4 sub-component 각각 테스트 커버리지 ≥75%
- [ ] 시안 8개 영역 모두 visual placeholder 제거
- [ ] type-check / lint 0 error
- [ ] `_aos-imports` 같은 고아 파일 없음 (브랜치별 별도 검증)
- [ ] PR 본문에 BEFORE/AFTER 스크린샷 첨부

## 12. Implementation Order Recommendation

독립 phase지만 권장 순서:
1. **Phase 1 (Segment)** — 가장 단순, 기존 컴포넌트(LineBadge/CongestionDots) 재활용, 디자인 시스템 패턴 정립
2. **Phase 4 (Weekly Trend)** — 데이터 소스가 가장 명확(weekPredictions), 차트 패턴 확립
3. **Phase 3 (Factors)** — hook 조합 패턴 확립
4. **Phase 2 (Hourly)** — 신규 서비스 메서드 + Firestore 쿼리 필요, 가장 무겁고 마지막

이 순서는 권장이며 강제 아님. 각 phase가 독립이라 어느 순서로도 가능.
