# Congestion System API Reference

## Type Definitions

### CongestionLevel (enum)

```typescript
// src/models/train.ts
enum CongestionLevel {
  LOW = 'low',           // < 30%
  MODERATE = 'moderate', // 30-70%
  HIGH = 'high',         // 70-90%
  CROWDED = 'crowded'    // > 90%
}
```

### CongestionReport

```typescript
interface CongestionReport {
  readonly id: string;
  readonly trainId: string;
  readonly lineId: string;
  readonly stationId: string;
  readonly direction: 'up' | 'down';
  readonly carNumber: number;              // 1-10
  readonly congestionLevel: CongestionLevel;
  readonly reporterId: string;
  readonly timestamp: Date;
  readonly expiresAt: Date;                // timestamp + 10분
}
```

### CongestionReportInput

```typescript
interface CongestionReportInput {
  readonly trainId: string;
  readonly lineId: string;
  readonly stationId: string;
  readonly direction: 'up' | 'down';
  readonly carNumber: number;
  readonly congestionLevel: CongestionLevel;
}
```

### CarCongestion

```typescript
interface CarCongestion {
  readonly carNumber: number;
  readonly congestionLevel: CongestionLevel;
  readonly reportCount: number;
  readonly lastUpdated: Date;
}
```

### TrainCongestionSummary

```typescript
interface TrainCongestionSummary {
  readonly id: string;
  readonly trainId: string;
  readonly lineId: string;
  readonly direction: 'up' | 'down';
  readonly cars: readonly CarCongestion[];
  readonly overallLevel: CongestionLevel;
  readonly reportCount: number;
  readonly lastUpdated: Date;
}
```

### CongestionPrediction

```typescript
interface CongestionPrediction {
  readonly stationId: string;
  readonly lineId: string;
  readonly direction: 'up' | 'down';
  readonly timeSlot: string;             // "HH:mm"
  readonly dayOfWeek: number;            // 0(일)-6(토)
  readonly predictedLevel: CongestionLevel;
  readonly confidence: number;           // 0-1
  readonly historicalAverage: number;    // 1-4
  readonly trend: 'increasing' | 'decreasing' | 'stable';
}
```

### HeatmapCell / HeatmapData

```typescript
interface HeatmapCell {
  readonly hour: number;
  readonly dayOfWeek: number;
  readonly value: number;                // 1-4
  readonly level: CongestionLevel;
  readonly sampleCount: number;
  readonly confidence: number;           // 0-1
}

interface HeatmapData {
  readonly stationId: string;
  readonly stationName: string;
  readonly lineId: string;
  readonly direction: 'up' | 'down';
  readonly cells: readonly HeatmapCell[];
  readonly maxValue: number;
  readonly minValue: number;
  readonly lastUpdated: Date;
}
```

### DataQualityReport

```typescript
interface DataQualityReport {
  readonly totalReports: number;
  readonly validReports: number;
  readonly invalidReports: number;
  readonly outlierReports: number;
  readonly qualityScore: number;         // 0-100
  readonly issues: readonly DataQualityIssue[];
  readonly recommendations: readonly string[];
}

interface DataQualityIssue {
  readonly type: 'outlier' | 'missing_data' | 'duplicate' | 'inconsistent' | 'stale' | 'spam';
  readonly severity: 'low' | 'medium' | 'high';
  readonly description: string;
  readonly affectedReports: number;
}
```

### ReporterReliability

```typescript
interface ReporterReliability {
  readonly reporterId: string;
  readonly totalReports: number;
  readonly consistentReports: number;
  readonly reliabilityScore: number;     // 0-100
  readonly flagCount: number;
}
```

### CongestionTrendAnalysis

```typescript
interface CongestionTrendAnalysis {
  readonly stationId: string;
  readonly lineId: string;
  readonly period: 'daily' | 'weekly' | 'monthly';
  readonly startDate: Date;
  readonly endDate: Date;
  readonly averageLevel: number;
  readonly peakLevel: CongestionLevel;
  readonly peakTime: string;
  readonly trend: 'improving' | 'worsening' | 'stable';
  readonly changePercent: number;
}
```

### CongestionAnomaly

```typescript
interface CongestionAnomaly {
  readonly timestamp: Date;
  readonly stationId: string;
  readonly lineId: string;
  readonly expectedLevel: number;
  readonly actualLevel: number;
  readonly deviation: number;
  readonly severity: 'minor' | 'moderate' | 'severe';
}
```

---

## Firestore Schema

### Collection: `congestionReports`

| Field | Type | Description |
|---|---|---|
| trainId | string | 열차 ID |
| lineId | string | 노선 ID |
| stationId | string | 역 ID |
| direction | string | 'up' or 'down' |
| carNumber | number | 1-10 |
| congestionLevel | string | CongestionLevel enum value |
| reporterId | string | 사용자 ID |
| timestamp | Timestamp | 제보 시각 |
| expiresAt | Timestamp | 만료 시각 (timestamp + 10분) |

**Indexes required:**
- `stationId` + `expiresAt` (desc) + `timestamp` (desc)
- `trainId` + `lineId` + `direction` + `expiresAt` (desc) + `timestamp` (desc)
- `reporterId` + `trainId` + `carNumber` + `timestamp`
- `expiresAt` (for cleanup)

### Collection: `congestionSummary`

Doc ID format: `{lineId}_{direction}_{trainId}`

| Field | Type | Description |
|---|---|---|
| trainId | string | 열차 ID |
| lineId | string | 노선 ID |
| direction | string | 'up' or 'down' |
| cars | array | CarCongestionDoc[] |
| cars[].carNumber | number | 1-10 |
| cars[].congestionLevel | string | CongestionLevel enum value |
| cars[].reportCount | number | 해당 객차 제보 수 |
| cars[].lastUpdated | Timestamp | 마지막 갱신 |
| overallLevel | string | 전체 혼잡도 레벨 |
| reportCount | number | 전체 제보 수 |
| lastUpdated | Timestamp | 마지막 갱신 |

**Indexes required:**
- `lineId` + `lastUpdated` (desc)

---

## CongestionService API

```typescript
class CongestionService {
  // 제보 제출 → Firestore write + summary 비동기 갱신
  submitReport(input: CongestionReportInput, userId: string): Promise<CongestionReport>;

  // 단일 열차 조회
  getTrainCongestion(lineId: string, direction: 'up'|'down', trainId: string): Promise<TrainCongestionSummary | null>;

  // 노선 전체 조회 (최대 50건)
  getLineCongestion(lineId: string): Promise<TrainCongestionSummary[]>;

  // 실시간 구독 (반환값: unsubscribe 함수)
  subscribeToTrainCongestion(lineId: string, direction: 'up'|'down', trainId: string, callback: (summary: TrainCongestionSummary | null) => void): () => void;
  subscribeToLineCongestion(lineId: string, callback: (summaries: TrainCongestionSummary[]) => void): () => void;

  // 역 기반 최근 제보 조회
  getStationReports(stationId: string, maxResults?: number): Promise<CongestionReport[]>;

  // 쿨다운 확인 (3분)
  hasRecentReport(userId: string, trainId: string, carNumber: number): Promise<boolean>;

  // 객차별 집계 (유효 제보만)
  getCarCongestionFromReports(lineId: string, direction: 'up'|'down', trainId: string): Promise<CarCongestion[]>;

  // 만료 제보 정리 (배치 500건)
  cleanupExpiredReports(): Promise<number>;
}
```

## CongestionPredictionService API

```typescript
class CongestionPredictionService {
  initialize(): Promise<void>;
  recordObservation(stationId: string, lineId: string, direction: 'up'|'down', congestionLevel: CongestionLevel): Promise<void>;
  predictCongestion(stationId: string, lineId: string, direction: 'up'|'down', targetTime: Date): Promise<CongestionPrediction>;
  getHourlyPattern(stationId: string, lineId: string, direction: 'up'|'down', dayOfWeek: number): Promise<HourlyCongestionPattern>;
  getUpcomingPredictions(stationId: string, lineId: string, direction: 'up'|'down', hoursAhead?: number): Promise<CongestionPrediction[]>;
  getPeakHoursSummary(stationId: string, lineId: string, direction: 'up'|'down'): Promise<{ morningPeak: { avgLevel: number; peakHour: number }; eveningPeak: { avgLevel: number; peakHour: number } }>;
  clearHistory(): Promise<void>;
}
```

**Storage**: `@livemetro:congestion_history` (AsyncStorage, 30일 보관)

## HeatmapService API

```typescript
class HeatmapService {
  generateHeatmap(stationId: string, stationName: string, lineId: string, direction: 'up'|'down', timeRange?: TimeRange): Promise<HeatmapData>;
  getColor(value: number, colors?: HeatmapColors): string;
  getInterpolatedColor(value: number): string;     // RGB 보간
  getOpacity(confidence: number): number;           // 0.3-1.0
  formatHour(hour: number): string;                 // "05시"
  formatDay(dayOfWeek: number): string;             // "월"
  getCellSummary(cell: HeatmapCell): string;
  exportToCsv(heatmap: HeatmapData): string;
  findPeakTimes(heatmap: HeatmapData, topN?: number): HeatmapCell[];
  findLowCongestionTimes(heatmap: HeatmapData, topN?: number): HeatmapCell[];
  getRecommendedTimes(heatmap: HeatmapData): { weekday: { morning: number; evening: number }; weekend: { morning: number; evening: number } };
}
```

## DataQualityService API

```typescript
class DataQualityService {
  assessQuality(reports: readonly CongestionReport[]): DataQualityReport;
  validateReport(report: CongestionReport, allReports: readonly CongestionReport[]): { isValid: boolean; isOutlier: boolean; reason?: string };
  detectOutlier(report: CongestionReport, allReports: readonly CongestionReport[]): OutlierResult;
  calculateReporterReliability(reporterId: string, reports: readonly CongestionReport[]): ReporterReliability;
  filterHighQualityReports(reports: readonly CongestionReport[]): CongestionReport[];
  getWeightedCongestion(reports: readonly CongestionReport[]): CongestionLevel;
}
```

## HistoricalAnalysisService API

```typescript
class HistoricalAnalysisService {
  initialize(): Promise<void>;
  addRecord(stationId: string, lineId: string, direction: 'up'|'down', level: CongestionLevel): Promise<void>;
  analyzeTrend(stationId: string, lineId: string, period: 'daily'|'weekly'|'monthly'): Promise<CongestionTrendAnalysis>;
  compareStations(lineId: string, stationIds: readonly string[], stationNames: readonly string[]): Promise<StationComparison[]>;
  getTimePatterns(stationId: string, lineId: string): Promise<TimePattern[]>;
  detectAnomalies(stationId: string, lineId: string, hours?: number): Promise<CongestionAnomaly[]>;
  getSummaryStats(stationId: string, lineId: string): Promise<{ totalRecords: number; avgLevel: number; mostCommonLevel: CongestionLevel; peakHours: number[]; lowHours: number[] }>;
  clearRecords(): Promise<void>;
}
```

**Storage**: `@livemetro:congestion_analysis_history` (AsyncStorage, max 10000 records)

---

## Utility Functions (src/models/congestion.ts)

| Function | Signature | Description |
|---|---|---|
| `getCongestionLevelName` | `(level) => string` | 한국어 이름 (여유/보통/혼잡/매우 혼잡) |
| `getCongestionLevelColor` | `(level) => string` | 색상 hex (#22C55E/#F59E0B/#F97316/#EF4444) |
| `getCongestionLevelIcon` | `(level) => string` | lucide 아이콘 이름 |
| `calculateOverallCongestion` | `(cars) => CongestionLevel` | 리포트 수 가중 평균 |
| `isReportExpired` | `(report) => boolean` | 만료 여부 |
| `createExpirationDate` | `(timestamp) => Date` | +10분 만료일 생성 |
| `generateSummaryId` | `(lineId, direction, trainId) => string` | Summary doc ID |
| `createEmptyCarCongestions` | `() => CarCongestion[]` | 10량 빈 배열 |
| `fromCongestionReportDoc` | `(id, doc) => CongestionReport` | Firestore → 도메인 |
| `fromCongestionSummaryDoc` | `(id, doc) => TrainCongestionSummary` | Firestore → 도메인 |
