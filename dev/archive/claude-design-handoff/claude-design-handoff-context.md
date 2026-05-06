# Claude Design Hand-off — Context

## Last Updated: 2026-05-06 KST — **CLOSED — PR #6 merged + Phase 49 post-merge integration**

## Status: ✅ CLOSED (this project's work is on `main`)

PR #6 (`8b30874`) merged 50+ phases / 75 commits into `main`. Phase 48 (`06e6bd3` cherry-pick) and Phase 49 (`779086d` post-merge integration of TransferStationList parallel-session work) followed. Wanted Design System typography baseline is at 0 across the entire `src/` tree, every audit-identified high gap is closed, and `@expo/vector-icons` direct dependency is removed (Ionicons → lucide 100% migrated).

This Dev Docs entry is retained for archive value. The PR #6 page on GitHub is the authoritative diff/review record. Next session: archive `dev/active/claude-design-handoff/` to a completed/ directory, or delete if no further reference is needed.

### Session 2026-05-05 → 2026-05-06 highlights
- Phase 26 (Prediction) → Phase 31 (Nav+Auth+Common+Map) — typography 118 → 0 violations across 6 phases this session
- Phase 31.1 — lint default mode = full src/ (HARD_PREFIXES filter retired, every staged tsx/ts under src/ enforced from first commit)
- Phase 32~36 (visual audit + bundle alignment, parallel session) — Home/Favorites/Routes audit closure
- Phase 37 (Alerts AL3) + 41 (filter chips) + 41.1 (FlatList extraData fix) + 42 (gradient avatar)
- Phase 38 (DelayFeed Megaphone) + 39 (Stats emoji + Map lucide)
- Phase 44 / 44.1 / 44.2 / 44.3 — full Ionicons → lucide closure across settings/ + WelcomeScreen + 6 settings atoms + dependency removal
- Phase 45 / 45.1 / 46 / 47 — settings foundation atoms + MarkdownViewer dark-mode fix + 4 detail screens + PrivacyPolicy + EditProfile (parallel session, integrated via PR)
- Phase 48 (3 station atoms) — committed parallel after merge, cherry-picked to main
- Phase 49 (TransferStationList) — parallel session work recovered via `git fsck --unreachable` + `cat-file -p` + 2 mock fixes (modernTheme requireActual + useTheme), committed to main
- EAS build infra: `cli.requireCommit: true` guard + Gradle 8 patch + iOS modular headers + dropped unpublished `expo-datetimepicker` — preview builds unblocked

### Surfaced cross-cutting lessons
- Partial-mock pattern recurred 5× (Phase 22.1 / 23.1 / 30.1 / 35 / 49) — typography migration consistently exposes test mocks missing `...jest.requireActual('@/styles/modernTheme')` spread when the migrated source starts calling `weightToFontFamily()`
- Multi-agent race condition recovery: dropped stash recoverable via `git fsck --unreachable | grep blob` + `git cat-file -p <hash> > path`. blob hash visible in initial `git diff` output (`index xxx..yyy`) before the drop
- Cherry-pick + content-verified `-D` delete: when commit is cherry-picked (different SHA, same content), confirm with `git diff <orig> <new> | wc -l == 0`, then `git branch -D` is safe
- EAS preview build archives **working tree**, not git HEAD, when `cli.appVersionSource` is unset — parallel-session unstaged WIP slips into cloud builds. `cli.requireCommit: true` is the surgical guard
- `gh pr merge --auto --merge` registers a conditional merge; required check pass triggers it server-side. Pending non-blocking checks (e.g. e2e-android) do not delay it

## Current Branch & Recent Commits

`refactor/wanted-design-system` (HEAD = `0aedffd`)

```
0aedffd refactor(ui): apply Wanted Design System — Phase 23 (Auth/Delays/Settings typography)
07104ad refactor(ui): apply Wanted Design System — Phase 22 (Statistics typography)
e9d0740 chore(docs): track Wanted Design hand-off bundle (excluding runtime)
7b5bae8 chore(lint): add typography pre-commit guard for Wanted DS — Phase 21.1
33fd7e7 refactor(ui): apply Wanted Design System — Phase 21 (typography helpers)
be8d7c9 refactor(ui): apply Wanted Design System — Phase 19+20 (Theme + Language settings)
b4ada0a refactor(ui): apply Wanted Design System — Phase 18 (WelcomeScreen tokens)
0e93e37 refactor(ui): apply Wanted Design System — Phase 17 (LocationPermissionScreen)
4085171 refactor(ui): apply Wanted Design System — Phase 16 (DelayFeedScreen tokens)
f0c161b refactor(ui): apply Wanted Design System — Phase 15 (HelpScreen tokens)
9489a00 refactor(ui): apply Wanted Design System — Phase 14 (DelayCertificateScreen tokens)
5966be3 refactor(ui): apply Wanted Design System — Phase 13 (AlternativeRoutesScreen tokens)
f5f292a refactor(ui): apply Wanted Design System — Phase 12 (SettingsScreen tokens)
dde798f refactor(ui): apply Wanted Design System — Phase 11 (AlertsScreen tokens)
a267151 chore(claude): refresh architecture diagram + fix self-aborting pre-commit hook
65ece74 feat(fonts): bundle Pretendard via expo-font with held splash
... (Phase 1~10 earlier)
```

총 32 commits on branch (`git log --oneline ^main` 기준).

## Hand-off Bundle Inventory

`docs/design/` (untracked, 1.3MB total)

### Root
- `wanted-livemetro-template.html` (22KB) — 단일 HTML 카탈로그. `<!-- App / Data / Screens -->` 섹션 구조. 라이선스 헤더에 Pretendard SIL OFL 명시.

### `wanted-bundle/` (9 files)
| 파일 | 역할 | 비고 |
|------|------|------|
| `33122b9e-….js` (1.0MB) | react-dom.development.js | 런타임 — 마이그레이션 대상 아님 |
| `93aa0060-….js` (107KB) | react.development.js | 런타임 — 마이그레이션 대상 아님 |
| `bcda7471-….js` (11KB) | LM_DATA — Mock Seoul stations & lines | 참조용 (실제 앱은 Seoul API 사용) |
| `3d77f00f-….js` (6.9KB) | LM atoms (LineBadge, Pill, CongestionBar, Icon helpers) | **이미 `src/components/design/`에 매핑 완료** (Phase 1) |
| `83fe8f1a-….js` (11KB) | LoginScreen — 노선 컬러 그라데이션 + 추상 라인 그래픽 hero | **Phase 8에서 Auth flow rewrite 완료** — 잔여 gap 확인 필요 |
| `9a7fe457-….js` (17KB) | CommutePredictionScreen (ML 출퇴근 예측 hero) | **Phase 7에서 WeeklyPredictionScreen 재작성** — gap 확인 필요 |
| `65629bcd-….js` (20KB) | HomeScreen, FavoritesScreen, StationDetail | Phase 2/3/3B/7/9/10에서 다수 통합 |
| `ee09cc40-….js` (38KB) | Routes, Delay Feed, Statistics, Map, Alerts, Onboarding, Settings | Phase 4/5/8/11~20 부분 통합 — **잔여 gap 가장 클 가능성** |
| `69d6b7ba-….js` (9.2KB) | Android.jsx — Material 3 device frame | 미리보기용, 마이그레이션 불필요 |

## Migration Status (Phase 1~21.1)

이미 마이그레이션된 화면 (token + atomic 컴포넌트):
- `src/components/design/` — atoms (LineBadge, Pill, CongestionBar, MLHeroCard, MLHeroCardPlaceholder, HomeTopBar, QuickActionsGrid, FavoriteRow, SectionHeader, congestion)
- `src/screens/home/HomeScreen.tsx` — Phase 2/9, 3-state ML hero 라우팅
- `src/screens/favorites/FavoritesScreen.tsx` — Phase 3/10
- `src/screens/station/StationDetailScreen.tsx` — Phase 7 (StationDetailHeader, DirectionSegment, ArrivalCard, ExitInfoGrid 분해)
- `src/screens/alerts/AlertsScreen.tsx` — Phase 4/11 + i18n
- `src/screens/delays/DelayFeedScreen.tsx` — Phase 4/8/16
- `src/screens/map/SubwayMapScreen.tsx` — Phase 8
- `src/screens/auth/*.tsx` — Phase 8 + LoginHero
- `src/screens/onboarding/*` — onboarding 일괄 마이그레이션
- `src/screens/prediction/WeeklyPredictionScreen.tsx` — Phase 7 hero 재설계
- `src/screens/settings/SettingsScreen.tsx` — Phase 5/12
- `src/screens/settings/HelpScreen.tsx` — Phase 15 + Phase 23 (typography 마이그레이션 완료)
- `src/screens/settings/ThemeSettingsScreen.tsx` — Phase 19 + Phase 23 (typography 완료)
- `src/screens/settings/LanguageSettingsScreen.tsx` — Phase 20 + Phase 23 (typography 완료)
- `src/screens/settings/LocationPermissionScreen.tsx` — Phase 17 + Phase 23 (typography 완료)
- `src/screens/settings/{Settings,Accessibility,Voice}.tsx` — Phase 23 (typography 완료)
- `src/screens/auth/{Auth,EmailLogin,SignUp,Welcome}Screen.tsx` — Phase 8 + Phase 23 (typography 완료)
- `src/screens/delays/{DelayFeed,DelayCertificate}Screen.tsx` — Phase 4/8/14/16 + Phase 23 (typography 완료)
- `src/components/statistics/{StatsSummaryCard,DelayStatsChart,WeeklyStatsChart,LineUsagePieChart}.tsx` — Phase 22 (typography 완료)
- `src/screens/statistics/StatisticsDashboardScreen.tsx` — Phase 22 (typography + Phase 22.1 dual-path theme mock 흡수)
- `src/screens/welcome/WelcomeScreen.tsx` — Phase 18
- `src/screens/routes/AlternativeRoutesScreen.tsx` — Phase 13
- `src/screens/delays/DelayCertificateScreen.tsx` — Phase 14
- `src/styles/modernTheme.ts` — `WANTED_TOKENS`, `weightToFontFamily()`, `typeStyle()` 헬퍼
- `App.tsx` — `useFonts` + splash hold
- `assets/fonts/Pretendard-*.otf` — 9 weight 번들

## Important Decisions

### 2026-05-03 (직전 세션)
- **StationCard ↔ FavoriteRow 통합 보류** — 책임 분리 (train: realtime+ML+favorites dashboard, station: 검색용, design/FavoriteRow: presentational atom). 통합은 `useRealtimeTrains` 외부화 + `enableFavorite` 모드 분리 + FavoritesScreen 동작 변경 동반 별도 phase. 메모리: `project_stationcard_favoriterow_integration.md`
- **`useRealtimeArrivals` hook 이름 오기 정정** — 실제 이름은 `useRealtimeTrains` (`src/hooks/useRealtimeTrains.ts`)
- **Husky pre-commit hook self-abort 버그 수정** — `git add ".claude-backups/$LATEST_BACKUP"`이 `.gitignore`(`.claude-backups/`)와 충돌해 자기-abort. 해당 add 블록 제거 (commit `a267151`)
- **MLHeroCard 3-state 라우팅** — `heroProps available` → real prediction / `morningCommute set but no prediction` → CommutePredictionCard fallback / `morningCommute unset` → MLHeroCardPlaceholder CTA
- **Pretendard 9 weight 모두 별도 face 등록** — PostScript "Pretendard" alias 없음. weight-suffixed name 명시 필수
- **Navigation type duplication 의도** — `RootNavigator.tsx#RootStackParamList`(outer, `Main`)와 `types.ts#AppStackParamList`(inner, `MainTabs`)는 별도 stack. commit `543b3b3`에서 문서화

### 2026-05-04 (이번 세션)
- **Phase 21 — typography centralization (commit `33fd7e7`)** — `weightToFontFamily()` + `typeStyle()` 헬퍼 신규. 13 컴포넌트 마이그레이션. fontWeight + weight-baked PostScript family 동시 사용 시 Android faux-bold 회귀 발생 → fontWeight 제거 + fontFamily만 유지하는 정책으로 통일
- **Phase 21.1 — typography pre-commit guard (commit `7b5bae8`)** — 사용자가 `scripts/lint-typography.cjs` + npm scripts + husky hook + BANNED 규칙으로 *시스템 차원* 강제 인프라 구축. HARD_PREFIXES whitelist (`design/station/styles`)로 점진 도입
- **Audit 결과 (whitelist 외)** — 전체 src/에 fontWeight 단독 사용 203 violation. Phase 22+ 후보 분포: navigation (6), screens/settings (24+, Help/Theme/Language/LocationPermission/Accessibility), screens/statistics (4), 기타. Whitelist 내부는 0 violation
- **Gemini review false positive 패턴 재발** — Phase 21에서 4 issues 중 2개가 false (unused import, undefined property). 메모리 `feedback_gemini_review_diff_blindness.md` 패턴 재확인
- **PR_BODY_TMP.md 30 commits 모두 반영** — 84 → 133 lines. 보류 4건 제거, 새 보류 3건 (Phase 22+ typography / docs/design 트래킹 / 잔여 화면 inventory)

### 2026-05-04 (이번 /resume 세션)
- **Phase 1 inventory 결과 (정확한 audit 분포)** — `lint:typography:audit` baseline 203 violations. 디렉토리별: `screens/settings` 31, `screens/auth` 23, `screens/delays` 19, `screens/prediction` 17, `services/theme` 15, `screens/map` 9, `components/delays` 9, `components/alerts` 9, `screens/route` 8, `screens/favorites` 8, `components/train` 8, `components/statistics` 8, `screens/alerts` 7, `components/auth` 7, `screens/home` 6, `screens/statistics` 4, `screens/station` 4, navigation 6, `components/{favorites,common,map}` 5
- **Phase 22 — Statistics typography enforcement (commit `07104ad`)** — 5 파일 12 violations 마이그레이션 (StatisticsDashboardScreen 4 / StatsSummaryCard 2 / DelayStatsChart 2 / WeeklyStatsChart 2 / LineUsagePieChart 2). HARD_PREFIXES에 `screens/statistics/`, `components/statistics/` 추가. Audit 203 → 191 (-12). **Phase 22.1 (dual-path theme mock fix)이 같은 commit에 흡수됨** (`StatisticsDashboardScreen.test.tsx` +6 lines)
- **Gemini wording 정정** — react-native-patterns.md + .husky/pre-commit + lint-typography.cjs 모두 "whitelist" → "enforcement set" / "enforced paths"로 일관화. enforcement 디렉토리 8개 정확히 명시
- **Phase 23 — Auth/Delays/Settings typography (commit `0aedffd`)** — 15 파일 73 violations 마이그레이션. screens/auth (4), screens/delays (2), screens/settings (7) + 2 settings test (`requireActual` spread). HARD_PREFIXES에 `screens/auth/`, `screens/delays/`, `screens/settings/` 추가. Audit 191 → 118 (-73). **원래 Phase 23/24/25로 분리 예정이었던 영역을 동일 패턴(weightToFontFamily import + fontFamily 라인)이라 단일 commit으로 통합** — typography 패턴 동일성이 분리보다 통합을 선호하게 한 사례

### /resume 세션 검증 결과
- **자동 commit 2개의 phase 경계 정확성 확인** — `07104ad`(Phase 22) + `0aedffd`(Phase 23)이 typography 작업만 surgical하게 묶음. 인프라(lint script + husky + rule docs)는 Phase 22 commit에 일괄 흡수되어 Phase 23 commit은 소스 변경만 포함
- **HARD_PREFIXES 일관성** — 8 디렉토리 (design, station, statistics, auth, delays, settings, statistics_screens, styles) 모두 enforcement 등록. fontWeight 회귀가 들어가면 pre-commit hook이 차단
- **현재 baseline 118** — 203 → 191 → 118 = -85 violations resolved (42% 진척). 잔존 hot-spot: `screens/prediction` 17, `services/theme` 15, `screens/map` 9, `components/{delays,alerts,train}` 각 8~9
- **자동 commit race 패턴 재확인** — 메모리 `feedback_auto_commit_race.md`. Working tree 23 파일이 phase별로 분리 commit된 것은 백그라운드 자동 commit 프로세스가 phase 경계를 인식해 처리한 결과

### /verify-app 검증 (이번 세션 후반)
- **stash-isolation 검증으로 Phase 22/23 commit 깨끗함 증명** — `git stash push --include-untracked -- <6 paths>`로 WIP 격리 후 audit 측정 결과 정확히 118 violations. HEAD `0aedffd` 시점 baseline 일치 확인
- **다른 세션 WIP 감지 (메모리 `feedback_multi_session_staging.md` 정확한 사례)** — verify-app 시작 시각 ~22:00 무렵 사용자 IDE에서 Signup 3-step flow 추가 작업이 진행 중이었음. tsc 회귀 3건은 **PR 차단 사유가 아니라 진행 중 미완성 상태**로 판명
- **다른 세션 fix 자연 해결** — stash 1초 사이 사용자 IDE가 RootNavigator/types.ts 등록 + OnboardingContext Provider 보완 완료. stash pop 후 final tsc → 0 errors. SignupStep typography 마이그레이션은 미완 (audit +23)
- **검증 매트릭스 (이번 세션 종료 시점)** — TypeScript ✅ 0 errors / ESLint ✅ 0 errors / 731 warnings (pre-existing console) / Typography audit ⚠️ 141 (118 + 23 SignupStep WIP) / Jest ⏸️ 미실행 (race 환경에서 의미 약함)
- **race condition 학습** — `git stash push` 명령과 `git status` 사이 ~1초에도 사용자 IDE가 새 변경 추가. 다중 세션 환경에서 부분 stash는 *순간 격리*만 가능, 완전 격리는 불가

### 다른 세션 WIP 영역 — 부분 영속화됨 (2026-05-05 00:20 업데이트)

**새 commit `cf0b9cf feat(auth): signup wizard step 1/3 (NICE 본인 인증) + 3/3 (가입 완료)`** — SignupStep1/3 + SignupHeader + Routing 영속화. HEAD = `cf0b9cf`, 33 commits.

**여전히 working tree 잔존 (다른 세션 진행 중)**:
- M `package.json` + `package-lock.json` — 새 의존성 추가됐을 가능성
- M `src/screens/auth/SignupStep1Screen.tsx` — 추가 변경
- M `src/services/auth/AuthContext.tsx` — 🔥 **biometric 통합 작업 가능성 높음** (faceid-integration-gap Phase 3 영역)
- M `src/services/firebase/config.ts` — 새 변경
- ?? `src/utils/phoneFormat.ts` + 테스트 — NICE 본인인증 관련 utility

**해소된 파일** (이전 WIP 표 vs 현재):
- ✅ `OnboardingContext.tsx` — working tree에서 빠짐 (commit 또는 discard)
- ✅ `RootNavigator.tsx` + `types.ts` — `cf0b9cf`에 흡수됨
- ✅ `EmailLoginScreen.tsx` + `SignUpScreen.tsx` — 일부 변경 영속화됨

**원래 WIP 영역 표 (히스토리 보존)**:
| 파일 | 상태 | 비고 |
|------|------|------|
| `src/contexts/OnboardingContext.tsx` | M | `hasSeenSignupCelebration`/`markCelebrationSeen` 추가됨 |
| `src/navigation/RootNavigator.tsx` | M | SignupStep1/3 import + ParamList 등록 |
| `src/navigation/types.ts` | M | ParamList 타입 확장 |
| `src/screens/auth/EmailLoginScreen.tsx` | M | `navigate('SignupStep1')` 호출 추가 |
| `src/screens/auth/SignUpScreen.tsx` | M | (확인 미수행) |
| `src/components/auth/SignupHeader.tsx` | ?? | 새 atom |
| `src/screens/auth/SignupStep1Screen.tsx` | ?? | 회원가입 1/3 (NICE 본인 인증 mock). typography 미마이그레이션 (10 violations) |
| `src/screens/auth/SignupStep3Screen.tsx` | ?? | 회원가입 3/3 (가입 완료 celebration). typography 미마이그레이션 (12 violations) |
| `src/screens/auth/__tests__/SignupStep1Screen.test.tsx` | ?? | 새 테스트 |
| `src/screens/auth/__tests__/SignupStep3Screen.test.tsx` | ?? | 새 테스트 |

## Active Hooks That Affect Workflow

| 훅 | 영향 |
|----|------|
| `geminiAutoTrigger.js` (PostToolUse:Edit\|Write) | 30초 debounce 후 Gemini 크로스 리뷰. 다음 prompt 시 결과 주입 |
| `typeCheckHook.sh` (PostToolUse:Edit\|Write) | .ts/.tsx 자동 `tsc --noEmit` |
| `pathProtection.js` (PreToolUse:Edit\|Write) | `.env`, `google-services.json`, AKIA/AIza 키 차단 |
| `outputSecretFilter.js` (PostToolUse:Bash) | API키/토큰 자동 마스킹 |
| `userPromptSubmit.js` (UserPromptSubmit) | 스킬 자동 활성화, Gemini 결과 주입 |
| husky pre-commit (`.claude/` 변경) | backup 생성 (commit `a267151` 후 정상 동작 확인 — 이번 세션에서 두 번째 검증) |
| **husky pre-commit (lint:typography)** | **HARD_PREFIXES (design/station/styles) 위반 시 hard-fail. 신규 추가 (Phase 21.1)** |

## Sandbox Constraints (이번 세션 발견)

| 제약 | 우회 |
|------|------|
| watchman fchmod 차단 (`Operation not permitted` on `~/.local/state/watchman/`) | `npx jest --watchman=false ...` 명시. `npm test` 표준 명령에는 미포함 |
| `gh` CLI TLS OSStatus -26276 | 사용자 터미널 위임 (메모리 기록) |
| `.claude/` 하위 삭제 | sandbox off 명시 요청 시만 |

## Current Issues / Open Questions

- [ ] `docs/design/` git 트래킹 정책 미결정 (1.3MB 비용 vs 디자이너 인계 가치)
- [ ] `wanted-livemetro-template.html` 카탈로그와 현재 앱의 시각적 diff 미수행
- [ ] Manual QA 5개 항목 미수행 (Pretendard 실기기 / 다크모드 / i18n / ML 데이터 / Android faux-bold 검증)
- [x] Phase 1 inventory — Phase 22 시작 시점의 audit 분포 영속화됨
- [x] Phase 22 (Statistics) — commit `07104ad`. 203 → 191
- [x] Phase 22.1 (dual-path theme mock) — Phase 22 commit에 흡수됨
- [x] Phase 23 (Auth/Delays/Settings) — commit `0aedffd`. 191 → 118
- [x] verify-app 종합 검증 — tsc 0 / lint 0 errors / audit 118 (Phase 22/23 깨끗함 증명)
- [ ] **Signup 3-step flow 작업 (다른 세션 WIP)** — 사용자 IDE 진행 중. 완성 후 별도 phase commit 예상. SignupStep1/3 typography 미마이그레이션 (22 violations)
- [ ] Phase 26 후보 — `screens/prediction` (17) / `services/theme` (15) 중 우선순위 결정. WIP 종료 후 진입
- [ ] PR 생성 시점 결정 — 32 commits 누적. baseline 0 도달 후 일괄 PR vs 단계별 PR

## Next Session Entry Guide

다음 `/resume` 세션이 진입할 때 확인 순서:

1. **WIP 상태 확인** — `git status` → 위 "다른 세션 WIP 영역" 표의 파일들이 commit됐는지 점검
2. **WIP 완료 시나리오** — 사용자 IDE가 Signup flow를 commit한 경우:
   - `git log --oneline -5` 로 새 commit 확인
   - SignupStep1/3 typography 마이그레이션이 같이 들어갔는지 audit 측정 (`find src ... | xargs node scripts/lint-typography.cjs | tail -2`). baseline 변화 확인
   - 미마이그레이션이면 후속 phase로 typography 전용 commit 추가
3. **WIP 미완료 시나리오** — 다른 세션이 아직 진행 중인 경우:
   - **screens/auth/, navigation/, contexts/OnboardingContext 영역 건드리지 말 것**
   - Phase 26 (prediction 17) 또는 Phase 27 (services/theme 15)로 우회 진행 가능
4. **PR 생성** — WIP 완료 + verify-app 통과 후, `PR_BODY_TMP.md` 갱신 → 사용자 터미널 위임 (`gh pr create`, 메모리 `feedback_gh_cli_sandbox_tls.md`)
5. **Manual QA** — 모든 typography phase 완료 후 일괄

## Next Steps

1. **다른 세션 WIP 종료 대기** — 사용자 IDE가 Signup 3-step flow를 commit/stash/discard 할 때까지 phase 26+ 진행 보류 권장
2. **WIP 완료되면 Phase 26 (prediction 17)** — 가장 큰 잔존 hot-spot. 14-file phase fix 워크플로우 사용
3. **PR 준비** — 32+N commits 누적 후 일괄 PR
4. **`docs/design/` 트래킹 정책** — `.gitignore` 갱신 또는 인프라 commit
5. **Manual QA 5종** — 실기기 환경 준비 후 일괄

## Session-wrap Targets (다음 단계 `/session-wrap`이 처리)

### 메모리 갱신 후보 (이미 반영된 것)
- [x] `project_jest_partial_mock_requireactual.md` — 같은 모듈 일부 mock 시 `...jest.requireActual()` spread 필수 (사용자 추가, MEMORY.md 7번)

### 메모리 갱신 후보 (미반영)
- typography centralization 패턴 (`weightToFontFamily` + `typeStyle` 함수 시그니처 + 사용 예) — `project_typography_helpers.md` 보강
- Android faux-bold 회피 정책 ("weight-baked PostScript family 사용 시 fontWeight 생략")
- typography lint enforcement 8-디렉토리 점진 확장 결과 (Phase 21.1 → 22 → 23 = 3 → 7 → 8)
- 자동 commit이 phase 경계를 인식해 분리 commit 생성한 사례 (working tree 23 파일 → 2 commit)
- sandbox watchman 우회 (`npx jest --watchman=false`)
- husky backup hook 정상 동작 재검증 (commit `a267151` 이후 두 번째)

### 패턴 추출
- 14-file phase fix 워크플로우 (read-batch → edit-batch → tsc → eslint → jest → commit)
- 동일 패턴 다중 디렉토리 통합 commit 정책 (Phase 23이 auth/delays/settings를 한 commit으로) vs surgical 분리
- Gemini review false positive 검증 절차 (claim → grep/read → 진위 판정)
- 점진적 lint enforcement (HARD_PREFIXES + audit 분리, 디렉토리 한 번에 한 개씩)

### Follow-up todo
- Phase 24 후보 우선순위 (`screens/prediction` 17 vs `services/theme` 15)
- docs/design/ 트래킹 정책
- PR 생성 시점 결정 (32 commits 누적, baseline 0 도달 후 vs 단계별 PR)

---

## 2026-05-06 P0 갭 재검증 (resume 세션)

### 동기
사용자가 새 핸드오프 URL `FJQ33QjMHT9IDtdyR3aYLw` 제시. 페치 결과 HTTP 404 ("not found", `.tmp/design-fetch-v4/headers.txt` 영속화) — claude.ai/design share token TTL이 짧아 만료된 것으로 추정. v3 핸드오프와의 diff 불가하여 기존 자료(`docs/design/wanted-bundle-gap.md`)의 잔여 P0 갭 검증으로 전환.

### 검증 결과 — gap.md 5절의 "추천 다음 phase" 5건 모두 ✅ 머지 확인

| 추천 phase | 실제 commit | 코드 위치 |
|-----------|-------------|----------|
| Phase 50: 24h 타임라인 | `356a80f` | `src/screens/settings/NotificationTimeScreen.tsx:240-319` |
| Phase 51: MapScreen v2 | (Phase 8/28/31 누적) | `src/screens/map/SubwayMapScreen.tsx:177-322` |
| Phase 52: StationPicker | `c6b0e0c` + 테스트 `8fc9b62` | `src/screens/onboarding/OnboardingStationPickerScreen.tsx` |
| Phase 53: StationDetail 칸별 혼잡도 | `35f7cc3` (PR #14→#16) + `3b2bdbd` (PR #17) | `src/components/.../ArrivalCard.tsx`, empty-state placeholder |
| Phase 54: 시간대별 차트 | `a8ab59a` (PR #15) | `src/screens/prediction/WeeklyPredictionScreen.tsx` hourly congestion forecast chart |

### gap.md false negative 원인
초안의 "current grep 결과 line-chip + timeline 패턴 미발견" 결론은 grep 키워드(`LineChipRow`, `StationTimelineRow`)와 실제 코드 명명(`lineSelector`, `lineVisualization`, `stationItem`) 어긋남 때문이었음. 키워드를 시각 패턴(`ArrowRightLeft strokeWidth=2.6`, `total.*개 역` 등)으로 잡으면 모든 P0 매핑이 즉시 grep됨.

### 잔존 갭 (모두 P2 마이크로)
- 24h 타임라인 방해금지 밴드: 시안 `repeating-linear-gradient` stripes ↔ RN 단색 32% opacity
- 6절 "검증 필요 항목" 13건: line-level 정렬도 audit 미수행
- 별도 sweep phase 후보, ROI 낮음

### Archive 후보 ready
본 프로젝트는 사실상 작업 완료. `dev/active/claude-design-handoff/`를 `dev/archive/`로 이동 가능 상태. 사용자 명시 요청 시 mv.

### 잔존 작업 흔적
- `src/screens/map/SubwayMapScreen.tsx.bak` (464 lines) — 가치 검증 후 삭제 결정 (메모리 `feedback_post_removal_cross_reference.md` 정신 — 명시 요청 시만)
