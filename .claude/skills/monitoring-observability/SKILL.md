---
name: monitoring-observability
description: "앱 성능 모니터링, 헬스체크, 크래시 리포팅 시스템. 렌더링 시간, API 응답시간, 메모리 사용, 프레임 드롭 감지. Use when: (1) 성능 측정/최적화, (2) 헬스체크 구현, (3) 크래시 리포팅, (4) 메트릭 수집/분석. 트리거: 성능, performance, 모니터링, monitoring, 헬스체크, health check, 크래시, crash, 메트릭, metrics."
---

# Monitoring & Observability

## Overview

LiveMetro 앱의 3대 모니터링 서비스: **성능 모니터링**, **헬스체크**, **크래시 리포팅**.
`MonitoringManager`가 세 서비스를 통합 관리하며, 모두 싱글턴 패턴으로 동작한다.

## Architecture

```
MonitoringManager (통합 관리)
  ├── PerformanceMonitoringService  (메트릭 수집/알림)
  ├── HealthCheckService            (시스템 상태 진단)
  └── CrashReportingService         (에러 수집/전송)

performanceMonitor (utils)  ← 저수준 측정 유틸리티
ErrorBoundary (component)   ← React 에러 경계, performanceMonitor 사용
```

## 관련 파일

| 파일 | 역할 |
|------|------|
| `src/services/monitoring/index.ts` | MonitoringManager, 통합 초기화/종료 |
| `src/services/monitoring/performanceMonitoringService.ts` | 성능 메트릭 수집, 임계값 알림, 큐 관리 |
| `src/services/monitoring/healthCheckService.ts` | 시스템 헬스체크 (네트워크, API, 스토리지, 메모리) |
| `src/services/monitoring/crashReportingService.ts` | 크래시 리포트 생성, 큐잉, 전송 |
| `src/utils/performanceUtils.ts` | PerformanceMonitor 클래스, debounce, throttle, withPerformanceMonitoring HOC |
| `src/components/common/ErrorBoundary.tsx` | React ErrorBoundary, performanceMonitor 연동 |
| `src/services/monitoring/__tests__/` | 각 서비스 테스트 |

## 핵심 타입

### PerformanceMetrics

```typescript
interface PerformanceMetrics {
  timestamp: string;
  sessionId: string;
  metrics: {
    appStartTime?: number;      // 앱 시작 시간 (ms)
    firstRenderTime?: number;   // 첫 렌더 시간 (ms)
    jsHeapSize?: number;        // JS 힙 크기 (bytes)
    memoryUsage?: number;       // 메모리 사용량
    apiResponseTime?: number;   // API 응답 시간 (ms)
    networkFailureRate?: number; // 네트워크 실패율
    dataFreshness?: number;     // 데이터 신선도 (ms)
    frameDrops?: number;        // 프레임 드롭 수
    renderTime?: number;        // 렌더 시간 (ms)
    navigationTime?: number;    // 네비게이션 시간 (ms)
    realTimeDataAccuracy?: number;
    userEngagementTime?: number;
    errorRate?: number;
  };
  context: {
    platform: string;
    screenSize: { width: number; height: number };
    connectionType?: string;
    userId?: string;
    screen?: string;
  };
}
```

### HealthCheckResult

```typescript
interface HealthCheckResult {
  timestamp: string;
  overall: 'healthy' | 'degraded' | 'unhealthy';
  checks: {
    network: HealthStatus;     // 인터넷 연결
    seoulApi: HealthStatus;    // 서울 지하철 API
    dataManager: HealthStatus; // 데이터 매니저/캐시
    storage: HealthStatus;     // AsyncStorage
    memory: HealthStatus;      // 메모리 사용량
    battery?: HealthStatus;    // 배터리 (모바일)
  };
  metrics: {
    responseTime: number;
    errorRate: number;
    dataFreshness: number;
    memoryUsage?: number;
  };
}

interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  message: string;
  responseTime?: number;
  lastCheck: string;
  error?: string;
}
```

### CrashReport

```typescript
interface CrashReport {
  id: string;
  timestamp: string;
  platform: 'ios' | 'android' | 'web';
  appVersion: string;
  error: { message: string; stack?: string; name: string };
  context: {
    userId?: string;
    sessionId: string;
    screen?: string;
    action?: string;
    metadata?: Record<string, unknown>;
  };
  device: {
    model?: string;
    osVersion: string;
    appState: 'active' | 'background' | 'inactive';
  };
}
```

## 임계값 (SLA)

| 메트릭 | 임계값 | 초과 시 |
|--------|--------|---------|
| `appStartTime` | 3,000ms | 성능 경고 |
| `apiResponseTime` | 2,000ms | slow_api_response 알림 |
| `renderTime` | 100ms | slow_render 알림 |
| `memoryUsage` | 100MB | high_memory_usage 알림 |
| `errorRate` | 1% | 성능 비정상 판정 |
| `dataFreshness` | 30,000ms | stale_data 알림 |

### 헬스체크 메모리 임계값

| 수준 | 조건 | 상태 |
|------|------|------|
| 정상 | < 100MB | healthy |
| 주의 | 100-200MB | degraded |
| 위험 | > 200MB | unhealthy |

### 헬스체크 네트워크 임계값

| 조건 | 상태 |
|------|------|
| 응답 성공 + < 3s | healthy |
| 응답 성공 + > 3s | degraded |
| 연결 실패 | unhealthy |

### Seoul API 임계값

| 조건 | 상태 |
|------|------|
| 응답 성공 + < 5s | healthy |
| 응답 성공 + > 5s | degraded |
| API 호출 실패 | unhealthy |

## 사용 패턴

### 1. 통합 초기화 (앱 시작 시)

```typescript
import { monitoringManager } from '@/services/monitoring';

// 앱 시작 시 전체 모니터링 초기화
await monitoringManager.initialize({
  crashReporting: { enabled: true, userId: 'user-123' },
  performance: { enabled: true, userId: 'user-123' },
  healthCheck: { enabled: true },
});
```

> DEV 환경에서는 crashReporting과 performance가 기본 비활성. healthCheck는 항상 활성.

### 2. API 호출 성능 기록

```typescript
const startTime = Date.now();
try {
  const result = await seoulSubwayApi.getRealtimeArrival('강남역');
  monitoringManager.recordApiCall('getRealtimeArrival', Date.now() - startTime, true);
} catch (error) {
  monitoringManager.recordApiCall('getRealtimeArrival', Date.now() - startTime, false);
  await monitoringManager.reportError(error as Error, { action: 'fetch_arrival' });
}
```

### 3. 컴포넌트 렌더 시간 측정

```typescript
// HOC 방식
import { withPerformanceMonitoring } from '@/utils/performanceUtils';

const MonitoredList = withPerformanceMonitoring(TrainArrivalList, 'TrainArrivalList');

// 수동 방식
monitoringManager.recordRenderTime('TrainArrivalList', renderDuration);
```

### 4. 저수준 측정 (performanceMonitor)

```typescript
import { performanceMonitor } from '@/utils/performanceUtils';

performanceMonitor.startMeasure('some_operation');
// ... 작업 수행 ...
const duration = performanceMonitor.endMeasure('some_operation');
// duration > 100ms 이면 자동 콘솔 경고
```

### 5. 크래시 리포팅

```typescript
import { crashReportingService } from '@/services/monitoring';

// 수동 에러 보고
await crashReportingService.reportError(error, {
  screen: 'HomeScreen',
  action: 'loadTrainData',
  metadata: { stationId: '0222' },
});

// 처리된 예외 보고 (handled exception)
await crashReportingService.reportHandledException(error, { retry: true });

// 디버깅용 브레드크럼 추가
crashReportingService.addBreadcrumb('역 선택', 'navigation', { station: '강남역' });
```

### 6. 헬스체크 수행

```typescript
import { healthCheckService } from '@/services/monitoring';

// 즉시 헬스체크
const result = await healthCheckService.performHealthCheck();
// result.overall: 'healthy' | 'degraded' | 'unhealthy'

// 현재 상태 확인
if (!healthCheckService.isHealthy()) {
  // 대체 동작 (캐시 데이터 사용 등)
}

// 이력 조회
const history = healthCheckService.getHealthHistory(); // 최근 100건
```

### 7. 화면 전환 추적

```typescript
// 네비게이션 리스너에서
monitoringManager.setCurrentScreen('HomeScreen');
// -> crashReportingService + performanceMonitoringService 양쪽에 컨텍스트 설정
```

## 헬스체크 동작 방식

1. `startMonitoring()` 호출 시 즉시 1회 체크 + 60초 간격 반복
2. 6가지 체크를 `Promise.allSettled`로 병렬 실행
3. 하나라도 `unhealthy` -> 전체 `unhealthy`
4. 하나라도 `degraded` (나머지 healthy) -> 전체 `degraded`
5. 결과를 `healthHistory`에 저장 (최대 100건, LIFO)
6. `errorRate`는 최근 10건 체크 중 unhealthy 비율

## 크래시 리포팅 흐름

```
에러 발생
  ├── Global Error Handler (ErrorUtils) → fatal 에러 자동 캡처
  ├── Unhandled Promise Rejection → 자동 캡처
  └── 수동 reportError() 호출
        ↓
  CrashReport 생성 (id, timestamp, error, context, device)
        ↓
  reportQueue에 추가 (최대 50건, LIFO)
        ↓
  AsyncStorage에 영속화 (@crash_reports_queue)
        ↓
  즉시 전송 시도
    ├── DEV: 콘솔 로그 후 큐 비움
    └── PROD: sendToService() → Sentry/Crashlytics/Custom API
```

## 메트릭 수집 흐름

```
30초 간격 수집 (startPeriodicCollection)
  ├── recordMemoryUsage() → JS 힙 체크
  └── createMetricsSnapshot() → 평균 메트릭 계산
        ↓
  metricsQueue에 추가 (최대 100건, LIFO)
        ↓
  AsyncStorage에 영속화 (@performance_metrics_queue)
        ↓
  processQueuedMetrics()
    ├── DEV: 콘솔 로그 후 큐 비움
    └── PROD: sendToAnalyticsService()
```

## 프레임 드롭 감지

`PerformanceMetrics.metrics.frameDrops` 필드로 기록.
`withPerformanceMonitoring` HOC는 `requestAnimationFrame` 기반으로 렌더 완료 시점을 측정하여 100ms 초과 시 경고를 발생시킨다.

## 리소스 정리

```typescript
// 앱 종료 시
await monitoringManager.shutdown();
// 1. flush() - 큐에 남은 메트릭/리포트 전송
// 2. healthCheckService.stopMonitoring() - 인터벌 정리

// 개별 서비스 파괴
performanceMonitoringService.destroy(); // 인터벌 + 데이터 전부 정리
healthCheckService.destroy();           // stopMonitoring + 이력 초기화
```

## 구현 시 주의사항

1. **Seoul API 30초 폴링 규칙**: dataFreshness 임계값이 30,000ms인 이유. 이보다 짧은 폴링 금지
2. **메모리 누수 방지**: `performanceMonitor.clearMetrics()`로 주기적 정리, 메트릭 배열은 각 키당 최대 100개
3. **큐 크기 제한**: 성능 메트릭 100건, 크래시 리포트 50건으로 제한하여 스토리지 압박 방지
4. **DEV vs PROD**: DEV에서는 콘솔 로그만, PROD에서만 외부 서비스 전송
5. **ErrorBoundary 연동**: `componentDidCatch`에서 `performanceMonitor.startMeasure/endMeasure` 사용

## 상세 API 레퍼런스

`references/api_reference.md` 참조 - 각 서비스의 전체 public 메서드 시그니처와 파라미터 설명.
