# LiveMetro QA Remediation Plan — 2026-08-30

## 목적
실기기 QA에서 확인된 실시간 열차 노선 혼입 APP_FAIL과 테스트 helper의 credential-like hardcoded fallback을 최소 범위로 수정한다.

## 대상
- 저장소: `/Users/younghwankang/Work/LiveMetro`
- 기준 commit: `7f22cf6`
- 구현 환경: Orca-managed Developer worktree

## 변경 범위
1. `src/services/guidance/destinationPreference.ts`
   - realtime Train payload의 canonical line id와 대기 step의 line id가 다를 때 다른 노선 열차가 `display`/`tracked`에 유입되지 않도록 수정한다.
   - 확장/비숫자 노선은 "모든 열차 통과"로 fail-open하지 않는다. 실제 API가 해당 노선을 구분할 수 없으면 정직한 no-data/empty 결과를 택한다.
   - 기존 숫자 노선의 방향 매칭 및 preferred destination 동작은 보존한다.
2. 해당 모듈의 회귀 테스트
   - `수인분당선·청량리` 대기 step에 `2호선·성수행` payload가 0건이어야 한다.
   - 정상적으로 canonical line/direction이 일치하는 열차는 유지되어야 한다.
   - preferred destination 필터의 기존 계약을 깨지 않는다.
3. `scripts/testRealtimeApi.ts`
   - 환경변수에서만 서울 API 키를 읽도록 hardcoded fallback을 제거한다.
   - 키가 없을 때 명확히 실패하거나 안전한 진단을 출력하되 credential 값을 출력하지 않는다.
   - Base URL과 요청 URL을 포함한 진단 로그는 key의 모든 occurrence를 마스킹한다.
4. downstream guidance consumers
   - `TrainSelectSheet` 후보, `collectDepartures`, `collectEstimates`, `detectDeparture`가 동일한 canonical line/fail-closed 계약을 사용하도록 정합성을 맞춘다.
   - 확장 노선·미지원/unknown line 및 mixed snapshot 회귀 테스트를 추가한다.

## TDD 수용 기준
- 회귀 테스트를 먼저 추가하고 현재 구현에서 RED를 실제 확인한다.
- 최소 구현 후 같은 테스트 GREEN을 확인한다.
- 수정 범위 외 리팩터링 금지.

## 검증 명령
- 영향 테스트 단독 실행
- `npm run type-check`
- `npm --prefix functions exec tsc -- --noEmit`
- `npm test -- --coverage --runInBand`
- `npx eslint . --ext .ts,.tsx` (기존 755 warning은 baseline으로 분리)
- `npm run --silent lint:plugins`
- `git diff --check`
- credential-like literal 재검색(값 출력 금지)

## 금지 범위
- Expo SDK 업그레이드 및 dependency migration
- 755개 lint warning 일괄 수정
- API 키/비밀값 출력·커밋·외부 전송
- iPhone 앱 데이터 초기화·재설치·권한 변경
- CI rerun, commit, push, merge, deploy

## 완료 조건
- 변경 파일·테스트·실행 결과를 보고한다.
- Developer는 커밋하지 않고 멈춘다.
- Jarvis가 worktree diff와 테스트를 독립적으로 재검증한다.
