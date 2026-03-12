---
name: crowdsourced-congestion
description: "혼잡도 크라우드소싱 시스템. Firebase 기반 혼잡도 리포팅, 히트맵 생성, 예측 모델, 데이터 품질 검증. Use when: (1) 혼잡도 데이터 수집/표시, (2) 히트맵/차트 구현, (3) congestion 관련 코드 작성, (4) 데이터 품질 검증 로직. 트리거: 혼잡도, congestion, 히트맵, heatmap, 밀집도."
---

# Crowdsourced Congestion System

## Architecture Overview

```
User Report → CongestionService (Firebase)
                ├── → congestionSummary (aggregated per train)
                ├── → CongestionPredictionService (AsyncStorage, local ML)
                ├── → HistoricalAnalysisService (trend/anomaly)
                └── → DataQualityService (validation/filtering)

Display: useCongestion hooks → Components (Badge, Modal, TrainView)
Visualization: HeatmapService ← CongestionPredictionService
```

**데이터 흐름**: 사용자 제보 → Firestore 저장 + Summary 배치 갱신 → onSnapshot 실시간 구독 → UI 반영. 예측/분석은 AsyncStorage 기반 로컬 처리.

## Core Types (src/models/congestion.ts)

```typescript
// CongestionLevel (from src/models/train.ts)
enum CongestionLevel {
  LOW = 'low',           // < 30%
  MODERATE = 'moderate', // 30-70%
  HIGH = 'high',         // 70-90%
  CROWDED = 'crowded'    // > 90%
}

// 개별 제보
interface CongestionReport {
  readonly id: string;
  readonly trainId: string;
  readonly lineId: string;
  readonly stationId: string;
  readonly direction: 'up' | 'down';
  readonly carNumber: number;        // 1-10
  readonly congestionLevel: CongestionLevel;
  readonly reporterId: string;
  readonly timestamp: Date;
  readonly expiresAt: Date;          // timestamp + 10분
}

// 열차 요약 (집계)
interface TrainCongestionSummary {
  readonly id: string;               // `${lineId}_${direction}_${trainId}`
  readonly trainId: string;
  readonly lineId: string;
  readonly direction: 'up' | 'down';
  readonly cars: readonly CarCongestion[];
  readonly overallLevel: CongestionLevel;
  readonly reportCount: number;
  readonly lastUpdated: Date;
}

// 객차별 혼잡도
interface CarCongestion {
  readonly carNumber: number;
  readonly congestionLevel: CongestionLevel;
  readonly reportCount: number;
  readonly lastUpdated: Date;
}
```

## Firestore Collections

| Collection | Doc ID | 용도 |
|---|---|---|
| `congestionReports` | auto-generated | 개별 사용자 제보 |
| `congestionSummary` | `{lineId}_{direction}_{trainId}` | 열차별 집계 요약 |

## Service Layer

### 1. CongestionService (핵심)

리포트 제출/조회/구독/만료 처리.

```typescript
import { congestionService } from '@/services/congestion';

// 제보 제출
const report = await congestionService.submitReport(input, userId);

// 열차 혼잡도 조회
const summary = await congestionService.getTrainCongestion(lineId, direction, trainId);

// 실시간 구독 (cleanup 필수!)
const unsubscribe = congestionService.subscribeToTrainCongestion(
  lineId, direction, trainId,
  (summary) => { /* update UI */ }
);
return () => unsubscribe(); // useEffect cleanup

// 중복 제보 방지 (3분 쿨다운)
const canReport = !(await congestionService.hasRecentReport(userId, trainId, carNumber));
```

### 2. CongestionPredictionService (예측)

AsyncStorage 기반 로컬 히스토리로 예측.

```typescript
import { congestionPredictionService } from '@/services/congestion';

// 관측 기록
await congestionPredictionService.recordObservation(stationId, lineId, direction, level);

// 특정 시간 예측
const prediction = await congestionPredictionService.predictCongestion(
  stationId, lineId, direction, targetTime
);
// prediction.predictedLevel, prediction.confidence, prediction.trend

// 시간대별 패턴 (히트맵 소스)
const pattern = await congestionPredictionService.getHourlyPattern(
  stationId, lineId, direction, dayOfWeek
);
```

### 3. HeatmapService (시각화 데이터)

PredictionService에서 패턴을 가져와 히트맵 셀 생성.

```typescript
import { heatmapService } from '@/services/congestion';

// 히트맵 생성
const heatmap = await heatmapService.generateHeatmap(
  stationId, stationName, lineId, direction
);

// 셀 컬러 (단계별/보간)
const color = heatmapService.getColor(value);           // 단계별
const smooth = heatmapService.getInterpolatedColor(2.5); // 그라디언트

// 피크/여유 시간 분석
const peaks = heatmapService.findPeakTimes(heatmap, 5);
const recommended = heatmapService.getRecommendedTimes(heatmap);
```

### 4. DataQualityService (품질 검증)

```typescript
import { dataQualityService } from '@/services/congestion';

// 전체 품질 평가
const report = dataQualityService.assessQuality(reports);
// report.qualityScore (0-100), report.issues[], report.recommendations[]

// 이상치 탐지 (Z-score > 2.5)
const outlier = dataQualityService.detectOutlier(report, allReports);

// 리포터 신뢰도
const reliability = dataQualityService.calculateReporterReliability(reporterId, reports);

// 고품질 데이터만 필터링
const filtered = dataQualityService.filterHighQualityReports(reports);
```

### 5. HistoricalAnalysisService (트렌드)

```typescript
import { historicalAnalysisService } from '@/services/congestion';

const trend = await historicalAnalysisService.analyzeTrend(stationId, lineId, 'weekly');
const anomalies = await historicalAnalysisService.detectAnomalies(stationId, lineId, 24);
const patterns = await historicalAnalysisService.getTimePatterns(stationId, lineId);
```

## Hooks

### useCongestion (통합)

```typescript
const {
  trainCongestion,  // TrainCongestionSummary | null
  lineCongestion,   // TrainCongestionSummary[]
  loading, error,
  submitReport,     // (input) => Promise<CongestionReport | null>
  canSubmitReport,  // (carNumber) => Promise<boolean>
  submitting,
  refresh,
} = useCongestion({ lineId, trainId, direction, autoSubscribe: true });
```

### useTrainCongestion / useLineCongestion (단일 목적)

```typescript
const { congestion, loading, error, refresh } = useTrainCongestion(lineId, direction, trainId);
const { congestion, loading, error, refresh } = useLineCongestion(lineId);
```

### useCongestionReport (제보 전용)

```typescript
const { submitReport, canSubmitReport, submitting, lastReport, error } = useCongestionReport();
```

## Components

| 컴포넌트 | Props | 용도 |
|---|---|---|
| `TrainCongestionView` | congestion, onCarPress, showLegend, compact | 10량 객차별 혼잡도 시각화 |
| `CongestionReportModal` | visible, onClose, onSubmit, trainInfo, submitting | 혼잡도 제보 모달 |
| `CongestionBadge` | level, size, showIcon, outlined, onPress | 혼잡도 레벨 배지 |
| `CongestionDot` | level, size | 간단한 색상 점 |
| `CongestionInline` | level | 인라인 텍스트+점 |

## Data Quality Rules

| 규칙 | 임계값 | 설명 |
|---|---|---|
| Outlier Z-score | > 2.5 | 같은 열차/객차 리포트 대비 이상치 |
| Stale data | > 30분 | 오래된 데이터 무효 처리 |
| Duplicate | < 2분 | 같은 사용자/열차/객차 중복 감지 |
| Spam | >= 3회/분 | 사용자별 분당 제보 횟수 제한 |
| Reporter reliability | 0-100 | consistency * 80 + volume(max 10) - flags * 10 |

## Constants & Rules

| 상수 | 값 | 설명 |
|---|---|---|
| `TRAIN_CAR_COUNT` | 10 | 서울 지하철 객차 수 |
| `REPORT_EXPIRATION_MINUTES` | 10 | 제보 만료 시간 |
| `MIN_REPORTS_FOR_RELIABILITY` | 3 | 신뢰 가능 최소 제보 수 |
| Cooldown | 3분 | 같은 열차/객차 재제보 대기 |
| History retention | 30일 | 예측 서비스 로컬 히스토리 |
| Max cleanup batch | 500 | 만료 리포트 일괄 삭제 단위 |
| Peak hours | 07-09, 18-20 | 출퇴근 피크 시간대 |

## Aggregation Logic

혼잡도 수치 변환: LOW=1, MODERATE=2, HIGH=3, CROWDED=4

- **객차별 집계**: 시간 가중 평균 (최근 리포트일수록 높은 가중치, `1 - age/10분`)
- **전체 집계**: 리포트 수 가중 평균으로 overallLevel 결정
- **레벨 구간**: <=1.5 LOW, <=2.5 MODERATE, <=3.5 HIGH, >3.5 CROWDED

## Implementation Checklist

- [ ] Firebase 구독 시 반드시 useEffect cleanup에서 unsubscribe 호출
- [ ] 제보 전 `hasRecentReport`로 쿨다운 확인
- [ ] Summary 업데이트는 `submitReport` 내부에서 비동기 처리 (에러 무시)
- [ ] 색상은 `getCongestionLevelColor()` 사용 (Green/Amber/Orange/Red)
- [ ] 모든 타입은 `@/models/congestion`에서 import
- [ ] 서비스는 singleton 패턴 (`export const xxxService = new XxxService()`)

## File Reference

| 파일 | 역할 |
|---|---|
| `src/models/congestion.ts` | 타입, 상수, 유틸리티 함수 |
| `src/models/train.ts` | CongestionLevel enum 원본 |
| `src/services/congestion/congestionService.ts` | Firebase CRUD, 구독, 집계 |
| `src/services/congestion/congestionPredictionService.ts` | 로컬 예측, 패턴 분석 |
| `src/services/congestion/heatmapService.ts` | 히트맵 데이터 생성, 색상 보간 |
| `src/services/congestion/dataQualityService.ts` | 이상치/스팸/중복 감지 |
| `src/services/congestion/historicalAnalysis.ts` | 트렌드, 이상 감지, 역 비교 |
| `src/services/congestion/index.ts` | 모듈 re-export |
| `src/hooks/useCongestion.ts` | React hooks (4개) |
| `src/components/congestion/TrainCongestionView.tsx` | 객차별 시각화 |
| `src/components/congestion/CongestionReportModal.tsx` | 제보 모달 |
| `src/components/congestion/CongestionBadge.tsx` | Badge/Dot/Inline 컴포넌트 |
| `src/components/congestion/index.ts` | 컴포넌트 re-export |
