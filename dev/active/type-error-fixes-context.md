# TypeScript & ESLint Error Fixes - Context

**Last Updated**: 2026-01-10 05:30 KST
**Status**: In Progress
**Priority**: High

## Overview

프로젝트의 TypeScript 및 ESLint 에러 수정 작업

## Current State

### Progress
- **시작 에러 수**: TypeScript 125개, ESLint 2개
- **현재 에러 수**: TypeScript 96개, ESLint 0개
- **완료율**: ~25%

### Completed Tasks

1. **ESLint 에러 수정**
   - `src/services/route/index.ts` - 중복 export 제거

2. **미사용 변수 수정**
   - `TrainArrivalCard.test.tsx` - `_lineId`, `_color` 접두사 추가
   - `TrainArrivalList.test.tsx` - `fireEvent` 제거, `_stationId` 접두사
   - `useAlerts.test.ts` - `refreshingDuringCall` 제거

3. **globalThis 타입 선언**
   - `src/__tests__/setup.ts` - global 변수 타입 선언 추가

4. **Example/Demo 파일 수정**
   - `TrainArrivalCard.example.tsx` - 잘못된 props 제거
   - `TrainCardDemo.tsx` - 잘못된 props 제거

5. **Mock 데이터 타입 수정**
   - `TrainArrivalCard.test.tsx` - `finalDestination` 필드 추가
   - `useAlerts.test.ts` - `StoredNotification` 타입에 맞게 수정

## Remaining Issues

### Hook Test Types
- `useAdjacentStations.test.ts` - `lineName` 타입 없음, `unknown` 타입 이슈
- `useCommuteSetup.test.ts` - possibly undefined 처리

### E2E Tests
- `e2e/specs/auth/login.spec.ts` - BasePage 생성자 인자
- `e2e/specs/favorites/favorites.spec.ts` - 동일
- `e2e/specs/navigation/tab-navigation.spec.ts` - protected 접근
- `e2e/specs/station/station-detail.spec.ts` - 동일

### ML Services
- `tensorflowSetup.ts` - TensorFlow 타입
- `trainingService.ts` - 타입 불일치
- `trainArrivalAlertService.ts` - alertId 참조

### trainService Tests
- `trainService.test.ts` - SeoulTimetableRow mock 타입 불일치

## Session History

### 2026-01-10 05:00 (TypeScript/ESLint 에러 수정)
- **세션 유형**: 버그 수정
- **완료 작업**:
  - ESLint 중복 export 에러 수정
  - 미사용 변수 수정 (3개 테스트 파일)
  - globalThis 타입 선언 추가
  - Example/Demo 파일 props 수정
  - Mock 데이터 타입 수정
- **블로커**: 없음
- **다음 우선 조치**:
  - Hook 테스트 타입 수정
  - E2E 테스트 수정
  - ML 서비스 타입 수정

### 2026-01-10 04:00 (메모리 누수 수정)
- **세션 유형**: 버그 수정
- **완료 작업**:
  - 6개 서비스 메모리 누수 수정
  - `destroy()` 메서드 추가
  - setInterval 클린업 로직 구현
- **블로커**: 없음

### 2026-01-10 03:30 (Metro 번들러 에러)
- **세션 유형**: 버그 수정
- **완료 작업**:
  - Metro 캐시 클리어
  - `react-native-fs` 제거 (Expo 비호환)
- **블로커**: 없음

## Next Steps

1. [ ] Hook 테스트 타입 수정
2. [ ] E2E 테스트 에러 수정
3. [ ] ML 서비스 타입 수정
4. [ ] trainService 테스트 mock 수정
5. [ ] 최종 검증 (`npm run type-check`, `npm run lint`)
