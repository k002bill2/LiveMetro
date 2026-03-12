# Monitoring & Observability API Reference

## MonitoringManager

통합 관리 싱글턴. `src/services/monitoring/index.ts`에서 `monitoringManager`로 export.

```typescript
interface MonitoringConfig {
  crashReporting: { enabled: boolean; userId?: string };
  performance: { enabled: boolean; userId?: string };
  healthCheck: { enabled: boolean };
}
```

| 메서드 | 시그니처 | 설명 |
|--------|----------|------|
| `initialize` | `(config?: Partial<MonitoringConfig>) => Promise<void>` | 전체 서비스 초기화. 이미 초기화된 경우 무시. 5초 후 초기 헬스체크 실행 |
| `setUser` | `(userId: string) => void` | crashReporting + performance 양쪽에 사용자 컨텍스트 설정 |
| `setCurrentScreen` | `(screenName: string) => void` | 현재 화면 컨텍스트 설정 |
| `recordAppStart` | `() => void` | 앱 시작 메트릭 기록 |
| `recordApiCall` | `(endpoint: string, duration: number, success: boolean) => void` | API 호출 성능 기록 |
| `recordRenderTime` | `(component: string, duration: number) => void` | 컴포넌트 렌더 시간 기록 |
| `reportError` | `(error: Error, context?: Record<string, any>) => Promise<void>` | 에러 리포트 |
| `addBreadcrumb` | `(message: string, category?: string, data?: Record<string, any>) => void` | 디버깅 브레드크럼 |
| `getCurrentHealth` | `() => HealthCheckResult \| null` | 마지막 헬스체크 결과 |
| `isSystemHealthy` | `() => boolean` | 시스템 건강 여부 (모니터링 비활성 시 true) |
| `getPerformanceSummary` | `() => Record<string, number>` | 성능 요약 (avg/max/min/count per metric) |
| `flush` | `() => Promise<void>` | 큐에 남은 데이터 즉시 전송 |
| `shutdown` | `() => Promise<void>` | flush 후 모든 서비스 중지 |

---

## PerformanceMonitoringService

`performanceMonitoringService` 싱글턴. `src/services/monitoring/performanceMonitoringService.ts`.

| 메서드 | 시그니처 | 설명 |
|--------|----------|------|
| `initialize` | `(userId?: string) => Promise<void>` | 스토리지에서 큐 로드, 주기적 수집 시작 (30초), AppState 모니터링 |
| `setUser` | `(userId: string) => void` | 사용자 ID 설정 |
| `setCurrentScreen` | `(screenName: string) => void` | 화면명 설정 + navigation_time 기록 |
| `recordAppStart` | `() => void` | 앱 시작/첫 렌더 시간 기록 (setTimeout 0) |
| `recordApiCall` | `(endpoint: string, duration: number, success: boolean) => void` | API 호출 기록. 임계값(2s) 초과 시 slow_api_response 알림 |
| `recordDataFreshness` | `(dataType: string, age: number) => void` | 데이터 신선도. 임계값(30s) 초과 시 stale_data 알림 |
| `recordRenderTime` | `(component: string, duration: number) => void` | 렌더 시간. 임계값(100ms) 초과 시 slow_render 알림 |
| `recordMemoryUsage` | `() => void` | JS 힙 크기 기록 (web only). 100MB 초과 시 알림 |
| `recordEngagementTime` | `(screen: string, duration: number) => void` | 화면별 사용자 체류 시간 |
| `getPerformanceSummary` | `() => Record<string, number>` | 모든 메트릭의 avg/max/min/count |
| `isPerformanceHealthy` | `() => boolean` | 모든 임계값 충족 여부 |
| `flush` | `() => Promise<void>` | 큐 즉시 처리 |
| `destroy` | `() => void` | 인터벌 정리, 데이터 초기화 |

### 내부 동작
- 메트릭별 최대 100개 값 유지 (FIFO 제거)
- 큐 최대 100건, AsyncStorage `@performance_metrics_queue`에 영속화
- 30초 간격으로 스냅샷 생성 후 큐잉

---

## HealthCheckService

`healthCheckService` 싱글턴. `src/services/monitoring/healthCheckService.ts`.

| 메서드 | 시그니처 | 설명 |
|--------|----------|------|
| `startMonitoring` | `() => Promise<void>` | 즉시 1회 체크 + 60초 간격 반복. 중복 호출 무시 |
| `stopMonitoring` | `() => void` | 인터벌 정리, isRunning=false |
| `destroy` | `() => void` | stopMonitoring + 이력 초기화 |
| `performHealthCheck` | `() => Promise<HealthCheckResult>` | 6가지 체크 병렬 실행, 결과 반환 |
| `getCurrentHealth` | `() => HealthCheckResult \| null` | 마지막 체크 결과 |
| `getHealthHistory` | `() => HealthCheckResult[]` | 전체 이력 (최대 100건) |
| `isHealthy` | `() => boolean` | `lastHealthCheck.overall === 'healthy'` |

### 체크 항목

| 체크 | 대상 | 방법 | healthy 조건 |
|------|------|------|-------------|
| `network` | 인터넷 연결 | `fetch('google.com/favicon.ico', HEAD)` | 응답 OK + < 3s |
| `seoulApi` | 서울 지하철 API | `seoulSubwayApi.getRealtimeArrival('강남역')` | 성공 + < 5s |
| `dataManager` | 데이터 매니저 | `dataManager.getRealtimeTrains('강남역')` | 성공 |
| `storage` | AsyncStorage | set/get/remove 라운드트립 | 값 일치 |
| `memory` | JS 힙 메모리 | `performance.memory` (web) | < 100MB |
| `battery` | 배터리 | 플레이스홀더 | 항상 healthy |

### 전체 상태 결정
- 하나라도 `unhealthy` -> 전체 `unhealthy`
- 하나라도 `degraded` (나머지 healthy) -> 전체 `degraded`
- 모두 `healthy` -> 전체 `healthy`

---

## CrashReportingService

`crashReportingService` 싱글턴. `src/services/monitoring/crashReportingService.ts`.

| 메서드 | 시그니처 | 설명 |
|--------|----------|------|
| `initialize` | `(userId?: string) => Promise<void>` | 스토리지에서 큐 로드, 글로벌 에러 핸들러 설정, 큐 처리 |
| `setEnabled` | `(enabled: boolean) => void` | 크래시 리포팅 활성화/비활성화 |
| `setUser` | `(userId: string) => void` | 사용자 ID 설정 |
| `setCurrentScreen` | `(screenName: string) => void` | 현재 화면 설정 |
| `reportError` | `(error: Error, context?: { screen?, action?, metadata? }) => Promise<void>` | 에러 리포트 생성 및 큐잉 |
| `reportHandledException` | `(error: Error, context?: Record<string, any>) => Promise<void>` | 처리된 예외 보고 (metadata에 handledException:true 추가) |
| `addBreadcrumb` | `(message: string, category?: string, data?: Record<string, any>) => void` | 디버깅 브레드크럼 |
| `flush` | `() => Promise<void>` | 큐 즉시 처리 |

### 글로벌 에러 핸들러
- `ErrorUtils.setGlobalHandler`: fatal 에러 캡처 (기존 핸들러 체이닝)
- `process.on('unhandledRejection')`: 미처리 Promise 거부 캡처

### 내부 동작
- 큐 최대 50건, AsyncStorage `@crash_reports_queue`에 영속화
- PROD에서 Sentry/Crashlytics/Custom API로 전송 (현재 플레이스홀더)

---

## PerformanceMonitor (유틸리티)

`performanceMonitor` 싱글턴. `src/utils/performanceUtils.ts`.

| 메서드 | 시그니처 | 설명 |
|--------|----------|------|
| `startMeasure` | `(key: string) => void` | 측정 시작. PROD에서는 no-op |
| `endMeasure` | `(key: string) => number` | 측정 종료, duration 반환. > 100ms 시 콘솔 경고 |
| `getMetrics` | `(key: string) => PerformanceMetrics \| undefined` | 특정 측정 결과 조회 |
| `clearMetrics` | `() => void` | 모든 메트릭 삭제 |
| `getMemoryUsage` | `() => number` | JS 힙 사용량 (MB, iOS only) |
| `setTimeFunction` | `(fn: () => number) => void` | 테스트용 시간 함수 오버라이드 |
| `resetTimeFunction` | `() => void` | 기본 `Date.now` 복원 |

---

## 유틸리티 함수 (performanceUtils.ts)

| 함수 | 시그니처 | 설명 |
|------|----------|------|
| `debounce` | `<T>(func: T, delay: number) => (...args) => void` | 디바운스. API 호출 제한용 |
| `throttle` | `<T>(func: T, limit: number) => ThrottledFunction<T>` | 스로틀. `.cancel()` 메서드 포함 (cleanup용) |
| `scheduleAfterInteractions` | `(callback: () => void) => void` | `InteractionManager.runAfterInteractions` 래퍼 |
| `withPerformanceMonitoring` | `<P>(Component, name) => Component` | HOC. requestAnimationFrame 기반 렌더 시간 측정 |
| `optimizeImageProps` | `(source) => object` | 이미지 최적화 props 생성 |
| `batchProcess` | `<T,R>(items, processor, batchSize?) => R[]` | 배치 처리 (기본 50개) |
| `shallowEqual` | `<T>(obj1, obj2) => boolean` | React.memo용 얕은 비교 |
| `performanceLog` | `{ info, warn, error }` | DEV 전용 성능 로깅 (error만 PROD에서도 동작) |

---

## AsyncStorage 키

| 키 | 서비스 | 용도 |
|----|--------|------|
| `@performance_metrics_queue` | PerformanceMonitoringService | 미전송 성능 메트릭 큐 |
| `@crash_reports_queue` | CrashReportingService | 미전송 크래시 리포트 큐 |
| `@health_check_test` | HealthCheckService | 스토리지 헬스체크용 임시 키 (체크 후 삭제) |
