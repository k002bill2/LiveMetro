# Claude Design Hand-off — Tasks

## Last Updated: 2026-05-07 KST — **CLOSED**

> All phases complete. PR #6 + post-merge phases (49 → 56) + Phase B follow-up branch (`refactor/transfer-label-helper`) cover the entire scope. `lint:typography:audit` = 0. See bottom "Final Closeout (2026-05-07)" section for the deltas applied after the 2026-05-05 freeze below.

## (Original) Last Updated: 2026-05-05 KST (signup wizard + phone auth commits 반영)

## Branch Snapshot

| 항목 | 값 |
|------|-----|
| Branch | `refactor/wanted-design-system` |
| HEAD | `e6e9b47` |
| Commits ahead of main | 36 |
| Audit baseline | **118 violations** (203 → 191 → 118, **-85, 42% closed**) — typography 회귀 0 |
| 본 세션 typography commits | `07104ad` (Phase 22) + `0aedffd` (Phase 23/24/25 통합) |
| 본 세션 feature commits | `cf0b9cf` (signup wizard 1/3·3/3) + `ea5f978` (Firebase Phone Auth) + `4538ab0` (FaceID gap Phase 2) + `e6e9b47` (Gemini fix: await Alert + double-tap guard) |
| 세션 종료 시 working tree | 다른 세션 Phase 1.1 in-progress (biometricService + SettingsScreen 3 files) — 본 세션 commit 영역과 분리 |
| Verify-app 마지막 결과 | tsc ✅ 0 / lint ✅ 0 / typography ✅ 0 / jest ✅ 7 suites · 61 tests (auth 영역 타깃) |

## Phase 1 — Inventory & Gap Analysis (6/6 complete)
- [x] Phase 11~20 화면 (token-level 마이그레이션) — Settings/Alerts/Routes/DelayCertificate/Help/DelayFeed/LocationPermission/Welcome/Theme/Language commits 완료
- [x] `wanted-livemetro-template.html` 화면 카탈로그 인덱싱 — 4 screen 번들 + atoms + data + Android frame 구조 확인 (context 참조)
- [x] `wanted-bundle/65629bcd-….js` (Home/Favorites/StationDetail) — Phase 2/3/3B/7/9/10에서 모두 통합 완료
- [x] `wanted-bundle/9a7fe457-….js` (CommutePrediction hero) — `WeeklyPredictionScreen` Phase 7에서 재작성, 이후 Phase 21/21.1 보강
- [x] `wanted-bundle/83fe8f1a-….js` (LoginScreen) — `src/screens/auth/*` Phase 8 rewrite, audit 23 violations 잔존 → Phase 23 후보
- [x] `wanted-bundle/ee09cc40-….js` 7 screen 매핑 완료:
  - RoutesScreen → AlternativeRoutesScreen.tsx (Phase 13 ✓)
  - DelayFeedScreen → DelayFeedScreen.tsx (Phase 4/8/16 ✓)
  - **StatsScreen → StatisticsDashboardScreen.tsx (Phase 22 ✓)**
  - MapScreen → SubwayMapScreen.tsx (Phase 8 ✓, 9 violations 잔존)
  - AlertsScreen → AlertsScreen.tsx (Phase 4/11 ✓, 7 violations 잔존)
  - OnboardingScreen → onboarding/Commute*.tsx 4-step 분해 (navigation flow 차이)
  - SettingsScreen → settings/SettingsScreen.tsx (Phase 5/12 ✓, 31 violations 잔존)

## Phase 2 — docs/design/ Tracking Decision (0/2 complete)
- [ ] 추적 vs 로컬 정책 결정 (1.3MB 비용 vs 디자이너 인계 가치)
- [ ] 결정 반영: `.gitignore` 갱신 또는 `git add docs/design/` 인프라 commit

## Phase 21 — Typography Centralization (이번 세션 완료, 7/7)
- [x] `weightToFontFamily()` + `typeStyle()` 헬퍼 신규 (`modernTheme.ts`)
- [x] 13 컴포넌트 typography centralize (5 typeStyle spread + 8 weightToFontFamily direct)
- [x] Android faux-bold 회피 정책 적용 (typeStyle 반환에서 fontWeight 제거)
- [x] ArrivalCard hardcoded 'Pretendard-ExtraBold' → `weightToFontFamily('800')`
- [x] LoginHero `LINE_DATA` 타입 정렬 (`ReadonlyArray<T>` → `readonly T[]`)
- [x] output-styles/efficient.md 정리
- [x] commit `33fd7e7` (15 files, +95/-87)

## Phase 21.1 — Typography Pre-commit Guard (이번 세션 완료, 5/5)
- [x] `scripts/lint-typography.cjs` 신규 (regex + ±15-line window scan)
- [x] `package.json` lint:typography / lint:typography:audit 스크립트
- [x] `.husky/pre-commit` whitelist 위반 시 hard-fail
- [x] `.claude/rules/react-native-patterns.md` BANNED 행 추가
- [x] commit `7b5bae8` (4 files, +108)

## Phase 22 — Statistics Typography Enforcement (이번 세션 완료, 5/5)
- [x] `StatisticsDashboardScreen.tsx` 4 violations 마이그레이션 (emptyTitle/title/sectionTitle/weekSummaryValue)
- [x] `components/statistics/{StatsSummaryCard, DelayStatsChart, WeeklyStatsChart, LineUsagePieChart}.tsx` 8 violations 마이그레이션
- [x] `HARD_PREFIXES`에 `screens/statistics/` + `components/statistics/` 추가 (총 5 디렉토리)
- [x] Gemini wording 정정 — react-native-patterns.md + .husky/pre-commit + lint-typography.cjs 모두 "enforced paths"로 일관화
- [x] 검증: tsc 0 / eslint 0 / lint:typography 0 (statistics 영역) / audit 203 → 191

## Phase 22.1 — Statistics Test Mock Fix (이번 세션 완료, 3/3)
- [x] `@/services/theme` index alias path mock 추가 (`StatisticsDashboardScreen.test.tsx`)
- [x] `@/services/theme/themeContext` 직접 import path mock 추가 (dual-path)
- [x] 4 fail → 4 pass 회귀 확인. 인접 9 suites / 82 tests pass

## Phase 23 — Settings Typography (이번 세션 완료, 7/7)
- [x] `SettingsScreen.tsx` (4 violations)
- [x] `AccessibilitySettingsScreen.tsx` (8 violations)
- [x] `VoiceSettingsScreen.tsx` (7 violations)
- [x] `HelpScreen.tsx` (6 violations)
- [x] `LocationPermissionScreen.tsx` (4 violations)
- [x] `ThemeSettingsScreen.tsx` (1) + `LanguageSettingsScreen.tsx` (1)
- [x] HARD_PREFIXES + `screens/settings/`. audit 191 → 160

## Phase 23.1 — Settings Test Mock Fix (이번 세션 완료, 2/2)
- [x] `ThemeSettingsScreen.test.tsx` + `LanguageSettingsScreen.test.tsx`에 `...jest.requireActual('@/styles/modernTheme')` spread 추가
- [x] 15 fail → 0 fail. 전체 settings 20 suites / 351 tests pass. 메모리: `project_jest_partial_mock_requireactual.md`

## Phase 24 — Auth Typography (이번 세션 완료, 5/5)
- [x] `AuthScreen.tsx` (5) + `WelcomeScreen.tsx` (5) + `SignUpScreen.tsx` (5) + `EmailLoginScreen.tsx` (8)
- [x] HARD_PREFIXES + `screens/auth/`. audit 160 → 137
- [x] 검증: tsc 0 / eslint 0 / 10 suites / 120 tests pass

## Phase 25 — Delays Typography (이번 세션 완료, 3/3)
- [x] `DelayCertificateScreen.tsx` (10) + `DelayFeedScreen.tsx` (9)
- [x] HARD_PREFIXES + `screens/delays/`. audit 137 → 118
- [x] 검증: tsc 0 / eslint 0 / 5 suites / 103 tests pass

## Verify-App Cycle (이번 세션, /verify-app 실행 결과)

- [x] `npx tsc --noEmit` → 0 errors (signup wizard + phone auth commit 후 회귀 0)
- [x] `npm run lint` → 0 errors / 735 warnings (모두 pre-existing console + unused error vars)
- [x] `lint:typography:audit --all` → 118 violations (typography 회귀 0)
- [x] `lint:typography` (HARD_PREFIXES 기반) → 0 violations (signup wizard / phone auth 신규 코드 모두 typography 정책 사전 준수)
- [x] `npx jest --watchman=false src/screens/auth src/services/auth src/contexts src/utils` → 9 suites · 133 tests pass

## Signup Wizard + Firebase Phone Auth + FaceID (이번 세션 후반 완료, 16/16)

`cf0b9cf` (wizard) + `ea5f978` (phone auth) + `4538ab0` (FaceID Phase 2) + `e6e9b47` (Gemini fix) 네 commit으로 회원가입 + biometric 플로우 완성:

- [x] `SignupHeader.tsx` 신규 — 1/3·2/3·3/3 공유 진행 게이지
- [x] `SignupStep1Screen.tsx` 신규 — 본인 인증 (input phase: 통신사 6 그리드 + 정보 입력 / OTP phase: 6칸 + 카운트다운 + 펄싱 커서)
- [x] `SignupStep3Screen.tsx` 신규 — 가입 완료 celebration (3-stagger 동심원 펄스 + 계정 요약 + 체크리스트 + LinearGradient 보너스 배너)
- [x] `OnboardingContext` 확장 — `hasSeenSignupCelebration` flag + `markCelebrationSeen()` AsyncStorage 영속화
- [x] `RootNavigator` 3-way `initialRouteName` 분기 — EmailLink (phone-only) > SignupStep3 (celebration) > Onboarding. 익명 user 가드 포함
- [x] `EmailLoginScreen` "가입하기" → SignupStep1로 라우팅 (1줄 변경)
- [x] `SignUpScreen` dual-mode (`create` | `link`) — link mode에서는 `linkEmailToCurrentUser` 호출 + 백 버튼/로그인 링크 숨김
- [x] `phoneFormat.toE164KR()` 유틸리티 신규 + 4 케이스 테스트
- [x] `firebaseConfig` 객체 export (recaptcha modal 전달용)
- [x] `AuthContext` 확장 — `requestPhoneVerification` + `confirmPhoneCode` + `linkEmailToCurrentUser` 3 메서드, Korean 에러 메시지 매핑
- [x] `expo-firebase-recaptcha@^2.3.1` 설치 (Expo SDK 49 호환)
- [x] 회귀 0 — 기존 8 suites + 신규 1 suite (phoneFormat) + 신규 6 phone auth 테스트 추가
- [x] 사용자 비-코드 작업 4건 가이드 commit 메시지에 명시: Firebase Console Phone 활성화, iOS APNs key 등록, Android SHA-1 등록, EAS dev build 재발행
- [x] **FaceID Phase 2 (`4538ab0`)** — `pendingBiometricSetup.ts` in-memory creds handoff (set/consume 1회성) + SignUpScreen에서 set + SignupStep3 CTA에서 consume + `Alert.alert` Promise wrap → biometric prompt
- [x] **Gemini fix (`e6e9b47`)** — Cross-review에서 발견된 race 2건 수정: (1) "완료" 성공 Alert을 await 하지 않아 navigation이 alert 위에서 발화 → "확인" 버튼 + Promise wrap, (2) handleCta 더블탭 시 두 번째 호출이 null creds로 즉시 navigate → `submitting` flag로 re-entrancy 가드. 신규 테스트 1건 추가 (rapid double-tap → markCelebrationSeen 1회만 호출)

## Phase 26+ Roadmap (audit 118 → 0 점진 닫기)
각 phase는 surgical: weightToFontFamily import 추가 → 해당 디렉토리 fontFamily 라인 추가 → HARD_PREFIXES 확장 → 검증.

| Phase | 영역 | 위반 | 비고 |
|-------|------|------|------|
| **26** | `src/screens/prediction/` | 17 | Phase 7 rewrite 후 보강. WeeklyPredictionScreen 시각 회귀 주의 |
| **27** | `src/services/theme/` | 15 | **비-screen 영역**, ThemeProvider/highContrastTheme 등 SoT 정리. 다크모드+a11y 회귀 위험 ↑ |
| **28** | `src/screens/map/` + `components/delays/` + `components/alerts/` | 9+9+9=27 | 인접 batch, 낮은 위험 |
| **29** | `src/screens/route/` + `screens/favorites/` + `components/train/` | 8+8+8=24 | cleanup batch |
| **30** | `src/screens/alerts/` + `components/auth/` + `screens/home/` | 7+7+6=20 | cleanup batch |
| **31** | navigation 6 + `screens/station/` 4 + `components/{favorites,common,map}` ≤ 5 | ~15 | final cleanup |

각 Phase 완료 시 `HARD_PREFIXES`에 디렉토리 추가하여 pre-commit 차단 범위 확장. baseline 0 도달 시 `--all` 모드를 default로 전환.

## Cross-cutting Cleanups (2/3 complete)
- [x] PR_BODY_TMP.md 본문 갱신 — Phase 1~21.1 모두 반영, 보류 4건 제거 + 3건 추가, 84 → 133 lines
- [x] 직전 세션 자동 commit (`d458de4`, `cc31510`, `33fd7e7`, `7b5bae8`)이 만든 변경의 회귀 검증 — 모두 tsc/eslint/jest 통과 확인됨
- [ ] StationCard ↔ FavoriteRow 통합 별도 phase (메모리 `project_stationcard_favoriterow_integration.md` 참조 — 진행 시 `useRealtimeTrains` 외부화 prerequisite)

## Manual QA (0/5 complete — 실기기 필요)
- [ ] iOS 시뮬레이터: `npx expo start --clear` 후 Pretendard 적용 확인 (system font flash 없음)
- [ ] Android 시뮬레이터: 동일 + Map 탭 아이콘 정상 렌더 + **Pretendard faux-bold 부재 확인** (Phase 21 핵심 검증)
- [ ] 다크모드 토글: 모든 redesign 화면 contrast (특히 headerTintColor, tabBar)
- [ ] AlertsScreen 영어 로케일 토글: `t.alerts.*` 정상 전환
- [ ] `useMLPrediction` 학습 완료 후 MLHeroCard 실제 데이터 표시 (placeholder/fallback이 아닌 real prediction)

## Verification (자동, 매 phase commit 시)
Phase 21 (commit `33fd7e7`):
- [x] `npx tsc --noEmit` → 0 에러
- [x] `npx eslint <touched>` → 0 에러
- [x] `jest <touched>` → 326/326 passed (24 suites)

Phase 21.1 (commit `7b5bae8`):
- [x] `lint:typography` 빈 staged + 정리된 파일 → exit 0
- [x] `lint:typography` 위반 파일 → exit 1
- [x] husky pre-commit 시뮬 → exit 0

Phase 22 (commit `07104ad`):
- [x] `npx tsc --noEmit` → 0 에러
- [x] `npx eslint <touched 6 files>` → 0 errors / 4 warnings (의도된 console.error + pre-existing)
- [x] `lint:typography` Statistics → 0 violations
- [x] `lint:typography:audit` → 191 (203에서 -12)
- [x] Phase 22.1 dual-path mock 흡수 후 Statistics test → 0 fail

Phase 23/24/25 (commit `0aedffd`, 통합 commit "Phase 23 — Auth/Delays/Settings typography"):
- [x] `npx tsc --noEmit` → 0 에러
- [x] `npx eslint <touched 17 files>` → 0 errors
- [x] `lint:typography` Auth/Delays/Settings → 0 violations (HARD_PREFIXES 8 디렉토리 모두 enforced)
- [x] `lint:typography:audit` → 118 (191에서 -73)
- [x] Settings test mock requireActual spread → settings 20 suites / 351 tests pass
- [x] 회귀 없음 — 글로벌 jest 실행은 별도 phase commit에서 검증 (다음 phase 시작 전 `/verify-app` 권장)

## Session Wrap Tasks — 2026-05-07 verification (all covered in MEMORY.md)

7건 미체크 항목을 grep 검증 결과 모두 적립 완료. 매핑:

- [x] typography centralization 패턴 → `project_typography_helpers.md` (Pattern A 인라인 / Pattern B spread)
- [x] Android faux-bold 회피 정책 → 위 같은 파일에 통합 ("fontWeight 미반환으로 Android faux-bold 회피")
- [x] typography 4-layer lint enforcement → `project_typography_lint_enforcement.md`
- [x] sandbox watchman 우회 → `feedback_jest_watchman_sandbox.md`
- [x] Pretendard wiring 패턴 → `project_pretendard_wiring.md` (commit `65ece74`)
- [x] husky hook 자기-abort 버그 + fix → `feedback_husky_self_abort.md` (commit `a267151`)
- [x] 자동 commit staging 가로채기 → `feedback_auto_commit_race.md` + `feedback_husky_lint_staged_autostage.md`
- [x] 패턴 추출: 14-file phase fix 워크플로우 → `project_wanted_token_migration_pattern.md` (5단계 surgical 레시피 + 매핑표)
- [x] 패턴 추출: 점진적 lint enforcement → `project_audit_as_gap_metric.md` + `project_typography_lint_enforcement.md`
- [x] docs/design/ 트래킹 결정 (commit `e9d0740`)
- [x] Phase 22.1 + 23.1 test mock fix 완료
- [~] Follow-up todo: manual QA 5종 (별도 체크리스트), StationCard ↔ FavoriteRow 통합은 `project_stationcard_favoriterow_integration.md` 보유 (별도 phase)

### 이번 /resume 세션 신규 추가 — 2026-05-07 verification

- [x] Phase 1 inventory 결과 → `project_audit_as_gap_metric.md` (audit 디렉토리 분포 = 객관적 척도)
- [x] lint:typography enforcement 점진 확장 → 위 같은 파일에 통합
- [~] Gemini wording false-flag → `feedback_gemini_review_severity_triage.md`에 부분 커버 (whitelist↔enforcement set 용어 충돌 자체는 fix와 함께 commit 메시지에 영속화. 별도 메모리 가치 낮음)
- [x] `git stash --include-untracked -- <paths>` 부분 stash → `project_partial_stash_baseline_verify.md`
- [~] bundle inventory ↔ RN screen 매핑표 → `project_wanted_token_migration_pattern.md`에 매핑표 포함됨. 별도 분리 가치 낮음
- [x] phase별 surgical workflow → 위 같은 파일

---

## Final Closeout (2026-05-07)

이 섹션은 2026-05-05 freeze 시점 이후 main에 안착한 후속 phase + 별도 follow-up를 한눈에 모은 closeout 인덱스입니다. 상세 diff는 git log 참조 (모두 `refactor(ui): apply Wanted Design System — Phase NN ...` 형식).

### Audit 0 도달 (PR #6)
- Phase 26 (Prediction) → Phase 31 (Nav+Auth+Common+Map): typography 118 → 0 violations across 6 phases
- Phase 31.1: lint default mode = full src/ (HARD_PREFIXES filter retired)
- Phase 32~36 (visual audit + bundle alignment): Home/Favorites/Routes audit closure
- Phase 37 (Alerts AL3) + 41 (filter chips) + 41.1 (FlatList extraData fix) + 42 (gradient avatar)
- Phase 38 (DelayFeed Megaphone) + 39 (Stats emoji + Map lucide)
- Phase 44 / 44.1 / 44.2 / 44.3: Ionicons → lucide closure across settings/ + WelcomeScreen + 6 settings atoms + dependency removal
- Phase 45 / 45.1 / 46 / 47: settings foundation atoms + MarkdownViewer dark-mode fix + 4 detail screens + PrivacyPolicy + EditProfile
- Phase 48 (3 station atoms) — committed parallel after merge, cherry-picked to main
- Phase 49 (TransferStationList) — parallel session work recovered via `git fsck --unreachable` + `cat-file -p`

### Post-PR-#6 시안 sync stream (별도 PR)
- **Phase 50** (`356a80f`): NotificationTime 24h timeline
- **Phase 52** (`c6b0e0c`): OnboardingStationPicker
- **Phase 54** (`a8ab59a` PR #15): WeeklyPrediction hourly congestion forecast chart
- **Phase 56** (`65563fb` → PR #18 머지 `8449840`): signup wizard 시안 sync + 약관 동의 게이트 + dev tools
- `dbe7b25` / `9a4b99d`: delays verified badge + station name 정렬 (cherry-pick recovery 사례 → memory `feedback_check_branch_before_commit.md`)
- `3d59fa5`: 즐겨찾기 및 경로 카드 UI 개선
- `0347680`: docs/design/livemetro/ offline handoff bundle mirror

### Phase B follow-up (Transfer badge 한글 lineId)
- v5 delta 문서 §4가 명시한 Phase B 후보 — **이미 closed**: visual gap은 `96bfa74`에서 short label 매핑으로 정렬, RN flex 레이아웃(`flexWrap: 'wrap'` + content-aware width)이 잘림 위험 자체를 차단
- **회귀 net** (branch `refactor/transfer-label-helper`, commit `ceeee32`): `LINE_NAMES` + `formatTransferBadgeLabel`을 `src/utils/transferLabel.ts`로 추출 → 13-case unit test (numeric/한글/fallback/coverage invariant). mock-free 테스트 가능

### 추적 가능한 follow-up (이번 세션 산출 아님)
- Manual QA 5종은 별도 체크리스트로 분리 (실기기 필요)
- StationCard ↔ FavoriteRow 통합 — 메모리 `project_stationcard_favoriterow_integration.md` 보유, 진행 시 `useRealtimeTrains` 외부화 prerequisite
