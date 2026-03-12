# Statistics Analytics API Reference

## StatisticsService

싱글턴 클래스. `@/services/statistics/statisticsService`에서 `statisticsService`로 export.

### calculateSummary(logs)

```typescript
async calculateSummary(logs: readonly CommuteLog[]): Promise<StatsSummary>
```

전체 로그에 대한 종합 통계를 산출한다. AsyncStorage에 30분 캐시를 저장한다.

**반환값 (StatsSummary):**

| 필드 | 타입 | 계산 방식 |
|------|------|-----------|
| `totalTrips` | `number` | `logs.length` |
| `totalDelayMinutes` | `number` | `sum(log.delayMinutes ?? 0)` |
| `avgDelayMinutes` | `number` | `totalDelayMinutes / totalTrips` (소수점 1자리) |
| `onTimeRate` | `number` | `(total - delayed) / total * 100` (소수점 1자리 %) |
| `mostUsedLine` | `string \| null` | lineIds 전체 집계 → 최다 노선명 |
| `mostUsedStation` | `string \| null` | departureStationId 집계 → 최다 역 |
| `mostDelayedLine` | `string \| null` | wasDelayed 로그의 lineIds[0] + delayMinutes 합산 → 최대 |
| `streakDays` | `number` | 오늘부터 역순으로 연속 기록일 수 |
| `lastTripDate` | `string \| null` | 최신 로그 날짜 |
| `memberSince` | `string` | 가장 오래된 로그 날짜 |

빈 로그 시 `getEmptySummary()` 반환: 모든 수치 0, `onTimeRate: 100`.

---

### getDailyStats(logs, date)

```typescript
getDailyStats(logs: readonly CommuteLog[], date: string): DailyStats
```

특정 날짜의 통계를 계산한다. 동기 메서드.

**파라미터:**
- `date`: `YYYY-MM-DD` 형식 문자열

**반환값 (DailyStats):**

| 필드 | 타입 | 설명 |
|------|------|------|
| `date` | `string` | 조회 날짜 |
| `totalTrips` | `number` | 해당일 총 이동 수 |
| `delayedTrips` | `number` | 지연된 이동 수 |
| `totalDelayMinutes` | `number` | 총 지연 시간 |
| `avgDelayMinutes` | `number` | 평균 지연 시간 |
| `onTimeRate` | `number` | 정시율 (0-100) |
| `mostUsedLine` | `string?` | 최다 이용 노선명 |
| `mostUsedStation` | `string?` | 최다 이용 역 |

해당일 로그 없으면 `totalTrips: 0`, `onTimeRate: 100`.

---

### getWeeklyStats(logs, weekStart)

```typescript
getWeeklyStats(logs: readonly CommuteLog[], weekStart: Date): WeeklyStats
```

주어진 주의 통계를 계산한다. weekStart부터 6일간(7일) 범위.

**반환값 (WeeklyStats):**

| 필드 | 타입 | 설명 |
|------|------|------|
| `weekStart` | `string` | 주 시작일 (YYYY-MM-DD) |
| `weekEnd` | `string` | 주 종료일 (YYYY-MM-DD) |
| `totalTrips` | `number` | 주간 총 이동 |
| `delayedTrips` | `number` | 주간 지연 이동 |
| `avgDelayMinutes` | `number` | 평균 지연 |
| `onTimeRate` | `number` | 정시율 (0-100) |
| `dailyBreakdown` | `readonly DailyStats[]` | 7일 일별 통계 |
| `byDayOfWeek` | `Record<DayOfWeek, number>` | 요일별 이동 수 |
| `mostDelayedDay` | `DayOfWeek \| null` | 지연이 가장 많은 요일 |

---

### getLineUsageData(logs)

```typescript
getLineUsageData(logs: readonly CommuteLog[]): readonly LineUsageData[]
```

노선별 사용량을 집계한다. `tripCount` 내림차순 정렬.

**반환값 (LineUsageData[]):**

| 필드 | 타입 | 설명 |
|------|------|------|
| `lineId` | `string` | 노선 ID |
| `lineName` | `string` | 노선명 (LINE_NAMES 매핑) |
| `tripCount` | `number` | 이동 횟수 |
| `percentage` | `number` | 비율 (소수점 1자리 %) |
| `color` | `string` | 노선 색상 (LINE_COLORS 매핑) |

---

### getDelayDistribution(logs)

```typescript
getDelayDistribution(logs: readonly CommuteLog[]): readonly DelayDistribution[]
```

지연 시간 분포를 5개 범위로 집계한다.

**범위:**
| range | min | max |
|-------|-----|-----|
| 정시 | 0 | 0 |
| 1-5분 | 1 | 5 |
| 6-10분 | 6 | 10 |
| 11-20분 | 11 | 20 |
| 20분+ | 21 | Infinity |

---

### getWeeklyTrendData(logs, weeks?)

```typescript
getWeeklyTrendData(logs: readonly CommuteLog[], weeks?: number): readonly ChartDataPoint[]
```

최근 N주간의 정시율 추이. 기본 8주.

**반환값:** `ChartDataPoint[]` - `x: "W1"~"W8"`, `y: onTimeRate`, `label: "M/D"`

---

### getHourlyDistributionData(logs)

```typescript
getHourlyDistributionData(logs: readonly CommuteLog[]): readonly ChartDataPoint[]
```

0-23시 시간대별 이용 분포.

**반환값:** `ChartDataPoint[]` (24개) - `x: 0~23`, `y: count`, `label: "H:00"`

---

### getDelayByDayData(logs)

```typescript
getDelayByDayData(logs: readonly CommuteLog[]): readonly ChartDataPoint[]
```

요일별(월-일) 평균 지연 시간.

**반환값:** `ChartDataPoint[]` (7개) - `x: "월"~"일"`, `y: avgDelayMinutes`

---

## 유틸리티

### isCacheValid(timestamp)

```typescript
function isCacheValid(timestamp: number): boolean
```

캐시 타임스탬프가 30분 이내인지 확인.

---

## 차트 컴포넌트 Props

### StatsSummaryCard

```typescript
interface StatsSummaryCardProps {
  summary: StatsSummary;
}
```

### DelayStatsChart

```typescript
interface DelayStatsChartProps {
  data: readonly ChartDataPoint[];
}
```

### WeeklyStatsChart

```typescript
interface WeeklyStatsChartProps {
  data: readonly ChartDataPoint[];
}
```

### LineUsagePieChart

```typescript
interface LineUsagePieChartProps {
  data: readonly LineUsageData[];
}
```

---

## 종합 사용 예제

```typescript
import { statisticsService } from '@/services/statistics';
import {
  StatsSummaryCard,
  DelayStatsChart,
  WeeklyStatsChart,
  LineUsagePieChart,
} from '@/components/statistics';

// 화면에서 사용
const StatsDashboard: React.FC<{ logs: readonly CommuteLog[] }> = ({ logs }) => {
  const [summary, setSummary] = useState<StatsSummary | null>(null);

  useEffect(() => {
    statisticsService.calculateSummary(logs).then(setSummary);
  }, [logs]);

  const lineUsage = useMemo(() => statisticsService.getLineUsageData(logs), [logs]);
  const weeklyTrend = useMemo(() => statisticsService.getWeeklyTrendData(logs), [logs]);
  const delayByDay = useMemo(() => statisticsService.getDelayByDayData(logs), [logs]);

  if (!summary) return null;

  return (
    <ScrollView>
      <StatsSummaryCard summary={summary} />
      <WeeklyStatsChart data={weeklyTrend} />
      <DelayStatsChart data={delayByDay} />
      <LineUsagePieChart data={lineUsage} />
    </ScrollView>
  );
};
```
