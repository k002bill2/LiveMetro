---
name: statistics-analytics
description: "지하철 이용 통계 및 분석 시스템. 일일/주간 통계 계산, 차트 컴포넌트, 지연 분석, 노선 사용량. Use when: (1) 통계 데이터 집계/표시, (2) 차트 컴포넌트 구현, (3) 분석 대시보드 개발, (4) 통계 관련 서비스 작성. 트리거: 통계, statistics, 차트, chart, 분석, analytics, 집계, 대시보드."
---

# Statistics Analytics

## Overview

CommuteLog 데이터를 집계하여 일일/주간/월간 통계를 산출하고, 차트 컴포넌트로 시각화하는 시스템. StatisticsService(싱글턴)가 집계를 담당하고, 4개 차트 컴포넌트가 표시를 담당한다.

## 데이터 모델

### 입력: CommuteLog (`@/models/pattern`)

| 필드 | 타입 | 설명 |
|------|------|------|
| `id` | `string` | 고유 ID |
| `date` | `string` | YYYY-MM-DD |
| `dayOfWeek` | `DayOfWeek` (0-6) | 0=일, 1=월, ..., 6=토 |
| `departureTime` | `string` | HH:mm |
| `departureStationId` | `string` | 출발역 ID |
| `lineIds` | `readonly string[]` | 이용 노선 ID 배열 |
| `wasDelayed` | `boolean` | 지연 여부 |
| `delayMinutes` | `number?` | 지연 시간(분) |

### 출력 타입들 (`@/services/statistics/statisticsService`)

| 타입 | 용도 | 핵심 필드 |
|------|------|-----------|
| `DailyStats` | 일일 통계 | `date`, `totalTrips`, `delayedTrips`, `onTimeRate`, `mostUsedLine` |
| `WeeklyStats` | 주간 통계 | `weekStart/End`, `dailyBreakdown`, `byDayOfWeek`, `mostDelayedDay` |
| `MonthlyStats` | 월간 통계 | `month`, `weeklyBreakdown`, `byLine`, `trend` |
| `StatsSummary` | 종합 요약 | `totalTrips`, `onTimeRate`, `streakDays`, `mostUsedLine/Station` |
| `ChartDataPoint` | 차트 데이터 | `x: string\|number`, `y: number`, `label?: string` |
| `LineUsageData` | 노선 사용량 | `lineId`, `lineName`, `tripCount`, `percentage`, `color` |
| `DelayDistribution` | 지연 분포 | `range`, `count`, `percentage` |

모든 타입은 `readonly` 프로퍼티를 사용한다 (Immutability 원칙).

## StatisticsService API

싱글턴 인스턴스: `statisticsService` (`@/services/statistics`)

### 집계 메서드

```typescript
// 종합 요약 (캐시 저장됨, 30분 유효)
const summary = await statisticsService.calculateSummary(logs);

// 일일 통계
const daily = statisticsService.getDailyStats(logs, '2026-03-09');

// 주간 통계 (weekStart는 월요일 기준 Date)
const weekly = statisticsService.getWeeklyStats(logs, new Date('2026-03-03'));
```

### 차트 데이터 생성 메서드

```typescript
// 노선별 사용량 → LineUsagePieChart용
const lineUsage: readonly LineUsageData[] = statisticsService.getLineUsageData(logs);

// 지연 분포 (정시/1-5분/6-10분/11-20분/20분+)
const delayDist: readonly DelayDistribution[] = statisticsService.getDelayDistribution(logs);

// 주간 정시율 추이 (기본 8주) → WeeklyStatsChart용
const weeklyTrend: readonly ChartDataPoint[] = statisticsService.getWeeklyTrendData(logs, 8);

// 시간대별 이용 분포 (0-23시)
const hourly: readonly ChartDataPoint[] = statisticsService.getHourlyDistributionData(logs);

// 요일별 평균 지연 (월-일) → DelayStatsChart용
const delayByDay: readonly ChartDataPoint[] = statisticsService.getDelayByDayData(logs);
```

### 집계 알고리즘 패턴

**정시율 계산:**
```
onTimeRate = (totalTrips - delayedTrips) / totalTrips
// calculateSummary: * 1000 / 10 (소수점 1자리 %)
// getDailyStats/getWeeklyStats: * 100 (정수 %)
```

**최다 사용 항목 추출:**
```
countByField/countLineIds → Record<string, number> → getMaxKey
```

**연속 기록(streak) 계산:**
```
오늘부터 역순으로 날짜 확인, uniqueDates에 존재하면 streak++, 없으면 break
```

**지연 분포 범위:**
```
정시(0분) | 1-5분 | 6-10분 | 11-20분 | 20분+
```

## 차트 컴포넌트

### StatsSummaryCard

```tsx
import { StatsSummaryCard } from '@/components/statistics';

<StatsSummaryCard summary={summary} />
```

- 총 이동, 정시율(색상 코딩: 90%+ 녹색, 70%+ 주황, 미만 빨강), 연속 기록
- 총 지연/평균 지연, 주요 노선, 지연 잦은 노선
- 마지막 기록 날짜

### DelayStatsChart

```tsx
import { DelayStatsChart } from '@/components/statistics';

const data = statisticsService.getDelayByDayData(logs);
<DelayStatsChart data={data} />
```

- 요일별 막대 차트 (월-일)
- 색상: 0-3분 녹색, 4-7분 주황, 7분+ 빨강
- 평균/최대 요약, 범례 포함

### WeeklyStatsChart

```tsx
import { WeeklyStatsChart } from '@/components/statistics';

const data = statisticsService.getWeeklyTrendData(logs);
<WeeklyStatsChart data={data} />
```

- 주간 정시율 막대 차트 (Y축: 0-100%)
- 색상: 90%+ 녹색, 70-89% 주황, 70% 미만 빨강
- Y축 라벨, 그리드 라인, X축 날짜 포함

### LineUsagePieChart

```tsx
import { LineUsagePieChart } from '@/components/statistics';

const data = statisticsService.getLineUsageData(logs);
<LineUsagePieChart data={data} />
```

- 수평 바 차트 + 도넛 차트 (총 이동 횟수 중앙 표시)
- 상위 5개 노선 표시, 서울 지하철 공식 색상 사용
- 범례: 노선명 + 이동 횟수

## 노선 색상 매핑

| 노선 | 색상 | 이름 |
|------|------|------|
| 1 | `#0052A4` | 1호선 |
| 2 | `#00A84D` | 2호선 |
| 3 | `#EF7C1C` | 3호선 |
| 4 | `#00A5DE` | 4호선 |
| 5 | `#996CAC` | 5호선 |
| 6 | `#CD7C2F` | 6호선 |
| 7 | `#747F00` | 7호선 |
| 8 | `#E6186C` | 8호선 |
| 9 | `#BDB092` | 9호선 |

미등록 노선은 `#888888` 기본값, 이름은 `${lineId}호선` 패턴.

## AsyncStorage 캐싱

```
키: @livemetro:statistics_cache
구조: { data: StatsSummary | null, timestamp: number }
유효기간: 30분 (CACHE_DURATION_MS = 30 * 60 * 1000)
검증: isCacheValid(timestamp) → boolean
```

- `calculateSummary()` 호출 시 자동 캐시 저장
- 저장 실패는 무시 (catch 블록 비어있음)
- 캐시는 StatsSummary만 대상 (차트 데이터는 캐시하지 않음)

## 테스트 작성 패턴

```typescript
import { statisticsService } from '@/services/statistics/statisticsService';
import { CommuteLog, DayOfWeek } from '@/models/pattern';

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn().mockResolvedValue(null),
  setItem: jest.fn().mockResolvedValue(undefined),
}));

const createMockLog = (overrides: Partial<CommuteLog> = {}): CommuteLog => ({
  id: `log_${Math.random()}`,
  userId: 'user1',
  date: new Date().toISOString().split('T')[0]!,
  dayOfWeek: 1 as DayOfWeek,
  departureTime: '08:30',
  arrivalTime: '09:00',
  departureStationId: 'station1',
  departureStationName: '강남역',
  arrivalStationId: 'station2',
  arrivalStationName: '서울역',
  lineIds: ['2'],
  wasDelayed: false,
  delayMinutes: 0,
  isManual: false,
  createdAt: new Date(),
  ...overrides,
});
```

차트 컴포넌트 테스트는 `@testing-library/react-native` 사용, `react-native`의 `Dimensions` mock 필요 (WeeklyStatsChart).

## 관련 파일

| 파일 | 역할 |
|------|------|
| `src/services/statistics/statisticsService.ts` | 핵심 서비스 (타입 + 집계 로직) |
| `src/services/statistics/index.ts` | 서비스 re-export |
| `src/components/statistics/StatsSummaryCard.tsx` | 요약 카드 컴포넌트 |
| `src/components/statistics/DelayStatsChart.tsx` | 요일별 지연 막대 차트 |
| `src/components/statistics/WeeklyStatsChart.tsx` | 주간 정시율 추이 차트 |
| `src/components/statistics/LineUsagePieChart.tsx` | 노선 사용량 파이/바 차트 |
| `src/components/statistics/index.ts` | 컴포넌트 re-export |
| `src/models/pattern.ts` | CommuteLog, DayOfWeek 등 입력 모델 |
| `src/services/statistics/__tests__/statisticsService.test.ts` | 서비스 테스트 |
| `src/components/statistics/__tests__/*.test.tsx` | 컴포넌트 테스트 (4개) |

## 주의사항

1. **Immutability**: 모든 인터페이스 필드는 `readonly`, 배열은 `readonly T[]`
2. **빈 데이터 처리**: 로그 0건일 때 `onTimeRate: 100`, 빈 배열/null 반환 (throw 금지)
3. **소수점 반올림**: `Math.round(value * 10) / 10` 패턴으로 소수점 1자리
4. **노선 ID는 문자열**: `lineIds: ['2']` 형태, LINE_COLORS/LINE_NAMES 키도 문자열
5. **차트 컴포넌트는 순수 RN**: 외부 차트 라이브러리 없이 View/Text/StyleSheet만 사용

## Reference Documentation

상세 API 레퍼런스: [references/api_reference.md](references/api_reference.md)
