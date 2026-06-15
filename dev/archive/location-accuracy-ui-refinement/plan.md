# 위치 정확도 후속 — A4(저신뢰 UI) + A2(점진 정밀화)

> 핸드오프 문서. 별도 세션에서 이 파일만 읽고 바로 집어 실행 가능하도록 자급자족 작성.
> 작성일 2026-06-15. 선행 작업: PR #239(accuracy 게이팅, merged), PR #241(좌표 손상 교정, merged).
> 위치: `dev/archive/`에 커밋 보존(`dev/active/`는 gitignore). 착수 시 `dev/active/`로 복사해 작업.

## 0. 배경 / 이미 끝난 것

홈 "주변 역"이 서울역 0m 등 부정확하게 뜨던 문제를 2갈래로 해결 완료:
- **#239 (merged)**: `locationService.tryGetPosition`에서 `accuracy > 500m` 거친 fix 거부, `getLastKnownPositionAsync({requiredAccuracy:100})`, `coords.accuracy ?? undefined`(정밀값 0 보존). → `LocationCoordinates.accuracy`(meters 오차반경)가 이제 신뢰 가능하게 보존됨.
- **#241 (merged)**: `stationCoordinates.json` 354역 좌표 교정 + 생성기 BLDN_ID 직접 매핑 재작성.

남은 폴리시 2건(이 문서). 둘 다 **정확도의 "표현/정밀화" 레이어** — 데이터/게이팅(완료)과 별개.

관련 메모리:
- `project_nearby_location_accuracy_gating_absent` (진단 4약점 SoT)
- `feedback_one_shot_effect_loading_toggle_retry_loop` (A2 회귀 함정)
- `project_inactive_screen_polling_gating` (A2 useIsFocused 게이트)
- `project_design_copy_honesty_over_fidelity` (A4 정직 카피 정책)

## 1. 선행 검증 (작업 시작 전)
```bash
git checkout main && git pull          # #239·#241 머지 반영
grep -n "MAX_ACCEPTABLE_ACCURACY\|?? undefined" src/services/location/locationService.ts  # #239 존재 확인
```
구현 전 Skill 호출: `react-native-development` (UI), TDD는 `superpowers:test-driven-development`.

---

## 2. A4 — 저신뢰 fix UI 헷지 (먼저, 저위험)

**목표**: GPS fix 오차가 크거나(>100m) 알 수 없으면(null) "인근" 배지를 단정적 초록으로 표시하지 않고 "인근(추정)" + 중립톤 + 거리에 "약" 접두.

**왜 지금 가능**: HomeScreen.tsx가 ML PR #240 머지로 깨끗해짐(이전엔 충돌지대였음).

**표시할 accuracy의 정체 (중요)**: 역별 값이 아니라 **사용자 GPS fix의 오차반경**(`LocationCoordinates.accuracy`, #239가 보존). 즉 closest station "인근" 신뢰도 = 그 fix 하나의 품질. → `useNearbyStations`가 이 값을 노출해야 함.

**변경 파일·지점**:
1. `src/hooks/useNearbyStations.ts`
   - `findNearbyStations`가 쓰는 `location`(LocationCoordinates)의 `.accuracy`를 상태/리턴에 노출: 리턴에 `locationAccuracy: number | null` 추가 (state에 저장하거나 `location?.accuracy ?? null` 파생).
2. `src/screens/home/HomeScreen.tsx`
   - L489 배지: `useNearbyStations()`에서 `locationAccuracy` 구조분해.
   - `const lowConfidence = locationAccuracy == null || locationAccuracy > 100;`
   - `<Pill tone={lowConfidence ? 'warn'(또는 neutral) : 'pos'}>{`${name} 인근${lowConfidence ? '(추정)' : ''}`}</Pill>` (Pill tone 토큰 실제 값은 components/design 확인).
   - NearbyStationCard에 `accuracyM={locationAccuracy ?? undefined}` 전달.
3. `src/components/design/NearbyStationCard.tsx`
   - optional prop `accuracyM?: number` 추가.
   - `lowConfidence` 시 거리 표기 `formatDistance` 앞에 "약 " 접두 + MapPin 색을 `semantic.labelAlt`로 디밍.

**임계값**: `accuracy ≤ 100m` → 확신(초록 "인근", 정확 거리). `> 100m || null` → "인근(추정)" + 중립톤 + "약 Nm". (100m = Accuracy.Balanced 기준, #239의 flag 임계값과 일치.)

**테스트 (TDD)**:
- NearbyStationCard.test: `accuracyM` 100 이하 → 거리 "180m" + 일반톤; 120(>100) → "약 180m" + 디밍; undefined → "약" 표기. (RNTL getByTestId, Pill mock은 `<Text>` wrap 필수 — `feedback_pill_atom_mock_text_wrap`.)
- HomeScreen.test: locationAccuracy>100 → 배지 "(추정)" 포함; ≤100 → 미포함. (mockLocation으로 accuracy 주입.)
- useNearbyStations.test: 리턴에 locationAccuracy가 location.accuracy를 반영.

**범위**: ~3파일 → HARD-GATE(`/plan`)는 이 문서로 충족. 격리 worktree 권장(평행 세션 대비).

---

## 3. A2 — watchPositionAsync 점진 정밀화 (나중, 고위험)

**목표**: 홈 주변역의 단발 one-shot fix가 거칠게 잡히면(100~500m, #239에서 통과한 fix) focused watch로 더 정밀한 fix(≤50m)로 수렴시켜 갱신.

**⚠️ 고위험 — 정지조건이 load-bearing**. 빠지면 프로젝트가 이미 고친 회귀 재현:
- 비활성 화면 polling-drain (`project_inactive_screen_polling_gating`)
- iOS kCLErrorLocationUnknown 무한 재시도 루프 (`feedback_one_shot_effect_loading_toggle_retry_loop`)

**API**: `Location.watchPositionAsync({accuracy: Location.Accuracy.High, distanceInterval: 10}, cb, errCb)` → `subscription.remove()`. 기존 머신어리 재사용: `locationService.startLocationTracking`/`watchPositionAsync`(L294-310), highAccuracy 모드(High, distanceInterval 10, timeInterval 5000).

**구현**:
1. `src/services/location/locationService.ts`
   - `getRefinedLocation(onUpdate, opts)` 추가: focused High watch 시작, 본 fix 중 **min-accuracy 좌표만 유지**, 자가 종료.
   - **필수 정지조건 (전부)**: (a) 수렴 — `accuracy ≤ 50m` 도달 시 stop, (b) 타임아웃 — 15s 캡 후 stop, (c) `remove()` 반환(호출자가 cleanup). 종료 시 best fix를 onUpdate.
2. `src/hooks/useNearbyStations.ts`
   - one-shot fallback(L312-325) 성공 후, fix가 거칠면(accuracy>50m) `getRefinedLocation` 1회 기동.
   - **게이트**: `useIsFocused()` 참(비활성 화면 금지) + `autoSearchEnabled` 참.
   - cleanup: blur/unmount 시 `subscription.remove()` (useEffect return). ref 가드로 중복 watch 방지.

**테스트 (TDD, RNTL renderHook)**:
- watch가 더 정밀한 fix 도착 시 nearbyStations 갱신.
- 수렴(≤50m) 시 remove() 호출.
- 15s 타임아웃 시 remove() 호출 (jest fake timers + afterEach useRealTimers).
- blur/unmount 시 remove() 호출.
- `useIsFocused()=false`면 watch 미기동.
- mock: `watchPositionAsync.mockImplementation`으로 콜백 수동 트리거.

**잔존 리스크**: jest로는 실제 GPS 정밀화 device 동작을 완전 검증 불가 → **시뮬레이터 스크린샷이 ground truth** (`project_app_verification_tooling_ios_sim_and_browser_limits`). 머지 전 실기기/시뮬 1회 확인 권장.

---

## 4. 검증 게이트 (각 PR)
```bash
npx tsc --noEmit
npx eslint <변경파일> --ext .ts,.tsx
npx jest <테스트> --watchman=false        # RED→GREEN 확인
```
소비자 회귀: `useLocation`/`useNearbyStations`/`useMLPrediction`/`useCommuteHeroEstimate` 테스트 (A2가 useLocation 건드리면 필수 — useMLPrediction·useCommuteHeroEstimate가 useLocation 소비).

> CI 주의: PR base가 오래되면 무관 flaky(예: congestion NaN)로 quality-gate가 깨질 수 있음 → `git rebase origin/main` 후 재푸시 (`feedback_pr_ci_failure_fix_already_on_main_rebase`).

## 5. 순서·PR 전략
1. **A4 먼저** (저위험, HomeScreen 깨끗) → PR.
2. **A2 나중** (고위험) → 별도 PR. A4 머지 후 진행.
- 평행 세션 충돌 회피: 격리 worktree(`$TMPDIR/<repo>-<domain>` + node_modules symlink) + 명시 파일만 stage.
- A2가 useLocation.ts 건드릴 때 ML 계열(useMLPrediction/useCommuteHeroEstimate) 활성 PR 있으면 파일 겹침 재확인.

## 6. 위치 / 완료 시
이 플랜은 `dev/archive/`에 커밋 보존됨(`dev/active/`는 gitignore). 착수 시 `dev/active/location-accuracy-ui-refinement/`로 복사해 작업. 완료 후 메모리 `project_nearby_location_accuracy_gating_absent`의 약점 #3(A2)·#4(A4) 해결 표시.
