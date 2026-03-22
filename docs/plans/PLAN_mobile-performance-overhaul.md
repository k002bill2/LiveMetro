# Implementation Plan: Mobile Performance Overhaul

**Status**: 🔄 In Progress
**Started**: 2026-03-22
**Last Updated**: 2026-03-22
**Estimated Completion**: 2026-03-22

---

**⚠️ CRITICAL INSTRUCTIONS**: After completing each phase:
1. ✅ Check off completed task checkboxes
2. 🧪 Run all quality gate validation commands
3. ⚠️ Verify ALL quality gate items pass
4. 📅 Update "Last Updated" date above
5. 📝 Document learnings in Notes section
6. ➡️ Only then proceed to next phase

⛔ **DO NOT skip quality gates or proceed with failing checks**

---

## 📋 Overview

### Feature Description
모바일에서 실시간정보, 실시간 도착, 운행중인열차, 시간표가 모두 느리거나 작동하지 않는 문제를 전면 개선.
근본 원인: Waterfall 폴백(최대 10s+ 블로킹), 5초 타임아웃(조기 포기), 이중 폴링(Firebase+Seoul API 동시), 시간표 500건 과다 fetch.

### Success Criteria
- [ ] 실시간 도착정보 초기 로딩 3초 이내 (캐시 있으면 즉시)
- [ ] Seoul API 실패 시에도 캐시 데이터 즉시 표시 (빈 화면 없음)
- [ ] 이중 폴링 제거로 API 호출 50% 감소
- [ ] 시간표 데이터 전송량 90%+ 감소 (500→30건)
- [ ] 기존 테스트 전체 통과 + 새 테스트 추가

### User Impact
- 서비스 불가 → 정상 사용 가능 수준으로 복구
- 모바일 네트워크 불안정 환경에서도 캐시 기반 즉시 응답
- 배터리/데이터 사용량 절감

---

## 🏗️ Architecture Decisions

| Decision | Rationale | Trade-offs |
|----------|-----------|------------|
| Stale-While-Revalidate 패턴 | 캐시 즉시 반환 + 백그라운드 갱신으로 체감 속도 극대화 | 최초 방문 시 캐시 없으면 기존과 동일한 대기 |
| Seoul API 단독 (Firebase 제거) | 이중 소스 = 이중 호출 + 상태 충돌. Seoul API가 이미 primary source | Firebase 실시간 push 기능 상실 (현재 미사용 상태) |
| Request Deduplication (in-flight cache) | 같은 역 동시 요청 시 중복 API 호출 방지 | Map 메모리 사용 (무시할 수준) |
| 시간표 fetch 30건 제한 | 500건 중 10건만 렌더링 = 94% 낭비 | 전체 시간표 보기 기능 추가 시 별도 fetch 필요 |

---

## 📦 Dependencies

### Required Before Starting
- [x] 현재 테스트 전체 통과 확인
- [x] 코드베이스 분석 완료

### External Dependencies
- Seoul Open Data API (기존과 동일, 변경 없음)
- AsyncStorage (기존과 동일)

---

## 🧪 Test Strategy

### Testing Approach
**TDD Principle**: 각 Phase에서 기존 테스트 유지 + 새 동작에 대한 테스트 추가

### Test Pyramid
| Test Type | Coverage Target | Purpose |
|-----------|-----------------|---------|
| **Unit Tests** | ≥75% | withRetry, RateLimiter, request dedup, cache logic |
| **Integration Tests** | Critical paths | DataManager fallback chain, TrainArrivalList lifecycle |

---

## 🚀 Implementation Phases

### Phase 1: API Layer 기본 강화
**Goal**: seoulSubwayApi.ts의 타임아웃/재시도/중복요청 문제 해결
**Estimated Time**: 1.5시간
**Status**: ⏳ Pending
**Files**: `src/services/api/seoulSubwayApi.ts`

#### Tasks

**🔴 RED: Write Failing Tests First**
- [ ] **Test 1.1**: `withRetry` 기본 동작 테스트 보강
  - File: `src/services/api/__tests__/seoulSubwayApi.test.ts`
  - 테스트 케이스:
    - `maxAttempts=3`일 때 3번까지 재시도 확인
    - 타임아웃 에러 시 재시도 실행 확인
    - Seoul API Error 시 재시도하지 않음 확인
  - Expected: maxAttempts 기본값이 2이므로 3번 재시도 테스트 FAIL

- [ ] **Test 1.2**: Request Deduplication 테스트
  - File: `src/services/api/__tests__/seoulSubwayApi.test.ts`
  - 테스트 케이스:
    - 같은 stationName으로 동시 2회 호출 시 실제 fetch 1회만 실행
    - 첫 요청 완료 후 다시 호출하면 새 fetch 실행
    - 요청 실패 시 in-flight cache에서 제거
  - Expected: dedup 로직 없으므로 FAIL

**🟢 GREEN: Implement to Make Tests Pass**
- [ ] **Task 1.3**: `withRetry` 기본값 변경
  - `maxAttempts`: 2 → 3
  - `initialDelayMs`: 500 → 1000
  - `maxDelayMs`: 3000 → 5000
  - 타임아웃 에러 메시지 변경 없이 retry 대상 유지

- [ ] **Task 1.4**: 타임아웃 5초 → 10초
  - `seoulSubwayApi.ts:201` - `this.timeout` 5000 → 10000

- [ ] **Task 1.5**: Request Deduplication 구현
  - `SeoulSubwayApiService` 클래스에 `inflightRequests: Map<string, Promise<T>>` 추가
  - `getRealtimeArrival()` 진입 시 in-flight 체크 → 있으면 기존 Promise 반환
  - 요청 완료(성공/실패) 시 Map에서 제거

**🔵 REFACTOR**
- [ ] **Task 1.6**: 코드 정리
  - 불필요한 주석 정리
  - console.log → 제거 (console.warn/error 유지)

#### Quality Gate ✋

**⚠️ STOP: Phase 2 진행 전 모든 체크 통과 필수**

**Validation Commands**:
```bash
npx tsc --noEmit
npm run lint
npm test -- --testPathPattern="seoulSubwayApi" --coverage
```

**Checklist**:
- [ ] TypeScript 에러 0개
- [ ] ESLint 에러 0개
- [ ] 관련 테스트 전체 통과
- [ ] 기존 테스트 회귀 없음

---

### Phase 2: DataManager Stale-While-Revalidate 전환
**Goal**: Waterfall 폴백을 Cache-first + 백그라운드 갱신으로 전환하여 즉시 응답
**Estimated Time**: 2시간
**Status**: ⏳ Pending
**Files**: `src/services/data/dataManager.ts`

#### Tasks

**🔴 RED: Write Failing Tests First**
- [ ] **Test 2.1**: Stale-While-Revalidate 패턴 테스트
  - File: `src/services/data/__tests__/dataManager.test.ts`
  - 테스트 케이스:
    - 캐시 있으면 Seoul API 응답 전에 캐시 데이터 즉시 반환
    - 캐시 없으면 Seoul API 직접 호출하여 결과 반환
    - Seoul API 실패 시 캐시 데이터 반환 (빈 결과 아님)
    - Seoul API 성공 시 캐시 갱신
  - Expected: 현재 waterfall이므로 캐시-우선 테스트 FAIL

- [ ] **Test 2.2**: Firebase 폴백 제거 확인
  - File: `src/services/data/__tests__/dataManager.test.ts`
  - 테스트 케이스:
    - `getRealtimeTrains()`에서 Firebase (`trainService`) 호출하지 않음
    - Seoul API 실패해도 Firebase 시도 없이 캐시 반환
  - Expected: 현재 Firebase 폴백 존재하므로 FAIL

**🟢 GREEN: Implement to Make Tests Pass**
- [ ] **Task 2.3**: `getRealtimeTrains()` 리팩토링
  - Firebase 폴백 제거 (lines 84-118 삭제)
  - Stale-While-Revalidate 구현:
    ```
    1. 캐시 즉시 확인 → 있으면 반환 (stale 허용)
    2. 백그라운드에서 Seoul API fetch → 성공 시 캐시 갱신
    3. 캐시 없으면 Seoul API 직접 await
    4. 모두 실패 시 null 반환
    ```
  - `trainService` import는 유지 (다른 메서드에서 사용 가능)

- [ ] **Task 2.4**: `subscribeToRealtimeUpdates()` 갱신
  - 기존 interval 콜백에서 `getRealtimeTrains()` 호출 유지
  - 변경된 Stale-While-Revalidate 자동 적용

**🔵 REFACTOR**
- [ ] **Task 2.5**: 코드 정리
  - 사용하지 않는 Firebase 관련 변수 정리
  - `queueFirebaseSync` 호출 제거 (Seoul API→Firebase 동기화 불필요)
  - 주석 업데이트 ("Multi-tier fallback" → "Cache-first with background refresh")

#### Quality Gate ✋

**⚠️ STOP: Phase 3 진행 전 모든 체크 통과 필수**

**Validation Commands**:
```bash
npx tsc --noEmit
npm run lint
npm test -- --testPathPattern="dataManager" --coverage
npm test  # 전체 테스트 회귀 확인
```

**Checklist**:
- [ ] TypeScript 에러 0개
- [ ] DataManager 관련 테스트 전체 통과
- [ ] 전체 테스트 회귀 없음
- [ ] Seoul API 실패 시 캐시 반환 동작 확인

---

### Phase 3: TrainArrivalList 이중 폴링 제거
**Goal**: Firebase 구독 제거, Seoul API 단독 폴링으로 단순화
**Estimated Time**: 1.5시간
**Status**: ⏳ Pending
**Files**: `src/components/train/TrainArrivalList.tsx`

#### Tasks

**🔴 RED: Write Failing Tests First**
- [ ] **Test 3.1**: Seoul API 단독 폴링 테스트
  - File: `src/components/train/__tests__/TrainArrivalList.test.tsx`
  - 테스트 케이스:
    - 컴포넌트 마운트 시 `trainService.subscribeToTrainUpdates` 호출하지 않음
    - `seoulSubwayApi.getRealtimeArrival` 호출됨
    - 35초 interval로 재호출됨
    - unmount 시 interval 정리됨
  - Expected: 현재 Firebase 구독 존재하므로 FAIL

- [ ] **Test 3.2**: AbortController 통한 요청 취소 테스트
  - File: `src/components/train/__tests__/TrainArrivalList.test.tsx`
  - 테스트 케이스:
    - unmount 시 진행 중인 fetch 취소
    - stationId 변경 시 이전 요청 취소
  - Expected: AbortController 미사용이므로 FAIL

**🟢 GREEN: Implement to Make Tests Pass**
- [ ] **Task 3.3**: Firebase 구독 제거
  - `trainService.subscribeToTrainUpdates()` 호출 제거 (lines 387-392)
  - `trainService` import 중 `subscribeToTrainUpdates` 관련만 제거
  - `unsubscribe` 변수 → AbortController로 대체
  - `fetchRealtimeArrivals()` + `setInterval` 유지

- [ ] **Task 3.4**: AbortController 추가
  - useEffect 내에 `AbortController` 생성
  - `fetchRealtimeArrivals`에 signal 전달하여 취소 가능하게
  - cleanup 함수에서 `controller.abort()` 호출
  - stationId 변경 시 자동으로 이전 요청 취소됨 (useEffect 재실행)

- [ ] **Task 3.5**: `trainService` import 정리
  - `getStation()` (역명 조회용)만 유지
  - `subscribeToTrainUpdates` 제거

**🔵 REFACTOR**
- [ ] **Task 3.6**: 코드 정리
  - `unsubscribe` 변수명 → 의미 명확하게 변경
  - 불필요한 `performanceMonitor.startMeasure/endMeasure` 호출 정리
  - 주석 업데이트

#### Quality Gate ✋

**⚠️ STOP: Phase 4 진행 전 모든 체크 통과 필수**

**Validation Commands**:
```bash
npx tsc --noEmit
npm run lint
npm test -- --testPathPattern="TrainArrivalList" --coverage
npm test  # 전체 테스트 회귀 확인
```

**Checklist**:
- [ ] TypeScript 에러 0개
- [ ] TrainArrivalList 관련 테스트 전체 통과
- [ ] 전체 테스트 회귀 없음
- [ ] Firebase 구독 호출 0건 확인

---

### Phase 4: 시간표 최적화
**Goal**: 시간표 과다 fetch 해결 (500→30건) + upcomingTrains 필터링 구현
**Estimated Time**: 1시간
**Status**: ⏳ Pending
**Files**: `src/services/api/seoulSubwayApi.ts`, `src/hooks/useTrainSchedule.ts`

#### Tasks

**🔴 RED: Write Failing Tests First**
- [ ] **Test 4.1**: 시간표 fetch 건수 제한 테스트
  - File: `src/services/api/__tests__/seoulSubwayApi.test.ts`
  - 테스트 케이스:
    - `getStationTimetable` URL에 `/1/30/` 포함 (500이 아닌 30)
  - Expected: 현재 500이므로 FAIL

- [ ] **Test 4.2**: upcomingTrains 필터링 테스트
  - File: `src/hooks/__tests__/useTrainSchedule.test.ts`
  - 테스트 케이스:
    - `upcomingTrains`에 현재 시각 이후 열차만 포함
    - 과거 시간표는 `schedules`에만 포함
    - `minutesAhead` 옵션 적용 시 해당 시간 내 열차만 반환
  - Expected: 현재 전체 할당이므로 FAIL

**🟢 GREEN: Implement to Make Tests Pass**
- [ ] **Task 4.3**: 시간표 fetch 건수 변경
  - `seoulSubwayApi.ts:426` - URL에서 `1/500/` → `1/30/`
  - 또는 configurable하게 파라미터 추가

- [ ] **Task 4.4**: upcomingTrains 필터링 구현
  - `useTrainSchedule.ts:192-193` - 현재 시각 이후 열차만 필터링
  - `minutesAhead` 옵션 활용하여 시간 범위 필터 적용
  - `schedules`는 전체 데이터, `upcomingTrains`는 필터링된 데이터

- [ ] **Task 4.5**: 캐시 키에 lineNumber 추가
  - `useTrainSchedule.ts:21-22` - 캐시 키: `timetable:${stationCode}:${lineNumber}:${weekTag}:${direction}`
  - 같은 역 다른 노선 캐시 충돌 방지

**🔵 REFACTOR**
- [ ] **Task 4.6**: 코드 정리
  - 사용하지 않는 `minutesAhead` 관련 TODO 주석 제거
  - 시간 비교 유틸 함수 추출

#### Quality Gate ✋

**⚠️ STOP: 최종 검증 전 모든 체크 통과 필수**

**Validation Commands**:
```bash
npx tsc --noEmit
npm run lint
npm test -- --testPathPattern="(seoulSubwayApi|useTrainSchedule)" --coverage
npm test  # 전체 테스트 회귀 확인
```

**Checklist**:
- [ ] TypeScript 에러 0개
- [ ] 시간표 관련 테스트 전체 통과
- [ ] 전체 테스트 회귀 없음
- [ ] fetch URL에 `/1/30/` 확인

---

## ⚠️ Risk Assessment

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Seoul API 응답 구조 변경 | Low | High | 타입 체크 + 에러 핸들링으로 방어 |
| 캐시 데이터 stale로 사용자 혼란 | Medium | Medium | lastUpdated 타임스탬프 UI 표시 |
| Firebase 제거 후 실시간성 저하 | Low | Low | Seoul API 35초 폴링이 이미 primary source |
| 시간표 30건으로 부족한 경우 | Low | Low | 추후 "더보기" 기능으로 추가 fetch 가능 |
| 기존 테스트 회귀 | Medium | High | Phase별 전체 테스트 실행 |

---

## 🔄 Rollback Strategy

### 모든 Phase 공통
- Git 기반 rollback: 각 Phase 완료 시 커밋 → 문제 시 `git revert` 가능
- Phase 간 독립적: Phase N 실패 시 Phase N-1까지의 개선은 유지

### Phase별 영향 범위
| Phase | 변경 파일 | Rollback 범위 |
|-------|-----------|--------------|
| Phase 1 | `seoulSubwayApi.ts` | 단일 파일 revert |
| Phase 2 | `dataManager.ts` | 단일 파일 revert |
| Phase 3 | `TrainArrivalList.tsx` | 단일 파일 revert |
| Phase 4 | `seoulSubwayApi.ts`, `useTrainSchedule.ts` | 2 파일 revert |

---

## 📊 Progress Tracking

### Completion Status
- **Phase 1**: ⏳ 0%
- **Phase 2**: ⏳ 0%
- **Phase 3**: ⏳ 0%
- **Phase 4**: ⏳ 0%

**Overall Progress**: 0% complete

### Time Tracking
| Phase | Estimated | Actual | Variance |
|-------|-----------|--------|----------|
| Phase 1 | 1.5h | - | - |
| Phase 2 | 2h | - | - |
| Phase 3 | 1.5h | - | - |
| Phase 4 | 1h | - | - |
| **Total** | 6h | - | - |

---

## 📝 Notes & Learnings

### Implementation Notes
- (Phase 진행 시 기록)

---

## 📚 References

### 파일 위치
- `src/services/api/seoulSubwayApi.ts` - Seoul API 클라이언트
- `src/services/data/dataManager.ts` - 데이터 관리 (캐시/폴백)
- `src/components/train/TrainArrivalList.tsx` - 실시간 도착 컴포넌트
- `src/hooks/useTrainSchedule.ts` - 시간표 훅
- `src/hooks/useRealtimeTrains.ts` - 실시간 열차 훅

### 진단 보고서
- 이전 대화에서 4개 Explore 에이전트로 병렬 분석 완료
- 핵심 병목: Waterfall(C1), 이중폴링(C2), 타임아웃(C3), Dedup없음(C4), Retry부족(C5)

---

## ✅ Final Checklist

**Before marking plan as COMPLETE**:
- [ ] 모든 Phase 완료 + Quality Gate 통과
- [ ] 전체 테스트 통과 (`npm test`)
- [ ] TypeScript 에러 0개 (`npx tsc --noEmit`)
- [ ] ESLint 에러 0개 (`npm run lint`)
- [ ] 모바일 수동 테스트: 실시간 도착, 시간표 동작 확인

---

**Plan Status**: 🔄 In Progress
**Next Action**: Phase 1 시작 - API Layer 기본 강화
**Blocked By**: None
