# REPORT — #419 쿼터 소진 중 useRealtimeTrains 오류 로그 반복

## 결과
쿼터 소진(ERROR-337, `dailyQuotaExhausted: true`) 상태에서 30초 틱마다 반복되던 `console.error`·"최대 재시도" 기록을 **경고 1회**로 줄였고, 훅이 `errorKind: 'quota'`와 전용 문구로 상태를 구분한다.

## 체크리스트
- [x] npm ci (1차 EXIT=255: 샌드박스가 `~/.npm` 캐시 쓰기 차단 → `--cache "$TMPDIR/npm-cache"`로 재실행 EXIT=0)
- [x] RED 테스트 추가·실패 확인
- [x] 구현 → GREEN
- [x] type-check / eslint / 부분 jest / 전체 jest
- [x] consumer 확인 (수정 불필요)
- [x] 로컬 커밋

## 변경 파일
1. `src/hooks/useRealtimeTrains.ts`
   - `handleDataReceived(data, error?)`: dataManager가 넘기는 error 인자를 받는다. `data`가 없고 error가 `dailyQuotaExhausted === true`이면 재시도 카운트를 건드리지 않고 `handleError(DAILY_QUOTA_ERROR_MESSAGE, 'quota')`.
   - 판정은 구조적 type guard(`dailyQuotaExhausted === true`). `instanceof SeoulApiError`는 전역 jest setup이 `seoulSubwayApi`를 mock해 클래스가 undefined → 훅을 쓰는 모든 테스트에서 TypeError가 나서 기각.
   - `reportedErrorKeyRef`(kind+문구): 같은 오류가 이어지면 state만 갱신하고 log·`onError`는 생략. 데이터 수신 시 초기화. 쿼터는 `console.warn` 1회, 일반은 `console.error` 1회.
   - 반환 state에 `errorKind: 'quota' | 'generic' | null` 추가(기존 필드 유지). export: `RealtimeTrainsErrorKind`, `DAILY_QUOTA_ERROR_MESSAGE`.
   - 문구: "오늘 실시간 조회 한도를 모두 사용했어요. 실시간 도착정보는 자정에 다시 제공됩니다." (ErrorFallback `DAILY_QUOTA_COPY` 톤과 일치)
2. `src/hooks/__tests__/useRealtimeTrains.test.ts` — `Daily quota exhausted (#419)` describe 4건 추가, `dataCallback` 타입에 `error?` 인자 추가. **기존 테스트 기대값 변경 없음.**

## 테스트 (RED → GREEN)
- RED (원본 훅 + 새 테스트): `npx jest src/hooks/__tests__/useRealtimeTrains.test.ts` → EXIT=1, `Tests: 4 failed, 29 passed, 33 total` (logs/red.log)
- GREEN: `npx jest src/hooks/__tests__/useRealtimeTrains` → EXIT=0, `Tests: 37 passed, 37 total` (logs/green.log)
- 추가 테스트: 쿼터 6틱 → warn 1·error 0·onError 1·errorKind 'quota'·isRetrying false / 일반 null 1/3→2/3→최대(3) 유지 / 최대 도달 후 6틱 → console.error 1·onError 1 / 쿼터→데이터→쿼터 시 dedupe 초기화(warn 2·onError 2)

## 검증 EXIT
| 명령 | EXIT | 비고 |
|---|---|---|
| `npm ci --no-audit --no-fund --cache "$TMPDIR/npm-cache"` | 0 | 브리프 원문 명령은 255(샌드박스 캐시 EPERM) |
| `npm run type-check` | 0 | |
| `npx eslint src/hooks` | 2 | 환경 문제: 중첩 worktree라 상위 `LiveMetro/.eslintrc.js`까지 로드돼 `eslint-plugin-expo` 중복 충돌. 코드 무관 |
| `npx eslint --no-eslintrc -c .eslintrc.js src/hooks` | 0 | worktree 자체 설정만 사용 |
| `npx jest src/hooks src/services/data src/screens --silent` | 0 | 98 suites, 1966 passed, 24 skipped |
| `npx jest --silent` (전체) | 0 | 376 suites passed(1 skipped), 6821 passed, 25 skipped |
(jest는 `--watchman=false --maxWorkers=2` 추가 — 샌드박스 watchman 차단 회피. 로그: `logs/`)

검증: 위 표 전부 직접 실행. 실기기(쿼터 실제 소진 상태)·Codex 리뷰는 미실행.
위험·영향 범위: `useRealtimeTrains` 소비 6곳(HomeFavoriteRow, DraggableFavoriteItem, StationDetail, TrainSelection, StationNavigator, RouteGuidance). 같은 오류가 이어질 때 `onError`가 1회만 호출되므로, 매 틱 onError를 기대하는 소비자가 있다면 동작이 바뀜(현재 소비자 6곳 모두 onError 미사용 — `rg "useRealtimeTrains\(" -A8 | rg onError` 결과 0건). 문구가 바뀌어 화면에 쿼터 문구가 그대로 표시됨.
되돌리는 법: `git revert <이 커밋 SHA>` (훅·테스트·REPORT 3파일 한 커밋).

## 후속 제안 (범위 밖)
1. 쿼터 소진 시 arrivalService 폴링을 자정(KST)까지 정지 — 현재도 네트워크 호출은 0이지만 30초 타이머·콜백은 계속 돈다.
2. StationDetailScreen·TrainSelectionScreen: `errorKind === 'quota'`이면 "다시 시도" 버튼 숨김(ErrorFallback `showRetry: false`와 일관). 현재는 버튼이 보이나 눌러도 차단된 호출만 반복.
3. HomeFavoriteRow·DraggableFavoriteItem은 `connectionLost`("연결 안 됨")로만 표시 — 쿼터 소진을 별도 표기할지 결정 필요.
4. 훅 refetch(AppState 복귀 포함)는 dedupe를 초기화하지 않음(의도: 포그라운드 복귀마다 재기록 방지). 원하면 refetch 시 초기화로 변경 가능.

사용 스킬: test-driven-development — 테스트 선작성 후 원본 훅으로 RED(4 failed) 재현을 기록. (구현을 먼저 써버려 원본 복원 방식으로 RED를 확인함)
기존 실패: 없음 (전체 jest EXIT=0). eslint EXIT=2는 중첩 worktree 환경 문제.
