# Claude Design Hand-off Plan

## Last Updated: 2026-05-07 KST — **CLOSED** (Phase 26~31 + 50~56 + Phase B regression net landed)

> **Status**: ✅ archived. Plan retained for historical reference. Authoritative diff lives in PR #6 + Phase 50~56 commits on `main` + `refactor/transfer-label-helper` branch (Phase B follow-up). Below `Last Updated: 2026-05-04` content is preserved as-is.
>
> **Final closeout summary**:
> - `lint:typography:audit` = **0 violations** across entire `src/` (was 118 at this plan's writing). Phase 26~31 closed all remaining gaps; Phase 31.1 retired HARD_PREFIXES filter and made `--all` the default.
> - **Phase 50/52/54/56** (NotificationTime / OnboardingStationPicker / WeeklyPrediction / Signup wizard sync) merged to main as separate PR streams after PR #6.
> - **Phase B follow-up** (Transfer badge 한글 lineId): visual gap was already addressed by `96bfa74` (short label mapping). Regression net via `formatTransferBadgeLabel` extraction + 13-case unit test in `src/utils/transferLabel.ts` (branch `refactor/transfer-label-helper`).
> - **`docs/design/livemetro/`** offline mirror committed as single source of truth (PNG ground truth in `uploads/`).

---

## (Original) Last Updated: 2026-05-04 21:58 KST

## Executive Summary

이번 작업은 `docs/design/` (untracked, 1.3MB)에 있는 **Claude Code Design hand-off 번들**을 React Native 코드로 점진 통합한다. 번들은 `wanted-livemetro-template.html` (단일 HTML 카탈로그) + `wanted-bundle/` (9개 JSX 파일 — Auth/Hero/Home/Favorites/StationDetail/Routes/Delay/Stats/Map/Alerts/Onboarding/Settings 전 화면 + 디자인 atoms + mock data + Android device frame) 구성이다.

**Branch `refactor/wanted-design-system` 누적 34 commits**, Phase 1~25까지 진행. 토큰 인프라 + 화면 통합 + atomic 컴포넌트 + Pretendard 9-weight 번들 + 다크모드 + typography centralization + pre-commit invariant 강제 + **Statistics/Settings/Auth/Delays enforcement** + **docs/design/ 트래킹 결정** 적층.

**Phase 1 inventory 완료** — `lint:typography:audit`이 객관적 design contract gap 척도로 정착. baseline 203 → **118** (Phase 22~25로 -85, **41.9%** 닫음).

남은 작업: **Phase 26~31 점진 정리** (118 → 0) + **manual QA 5종**.

## Context Carry-over

### 직전 세션 (2026-05-03) 완료
- PR_BODY_TMP.md의 4 follow-up 모두 정리 (architecture-diagram / MLHeroCard 3-state / StationCard 통합 분석 / Pretendard 번들)
- husky pre-commit hook 자기-abort 버그 수정 (commit `a267151`)
- 검증: TypeScript 0, ESLint 0, Jest 964/964

### 이번 세션 (2026-05-04) 완료
- **Phase 11~20 commits** (직전 세션 후반 + 이번 세션 초반): AlertsScreen / SettingsScreen / AlternativeRoutesScreen / DelayCertificateScreen / HelpScreen / DelayFeedScreen / LocationPermissionScreen / WelcomeScreen / Theme + Language settings
- **Phase 21** (commit `33fd7e7`): typography helpers (`weightToFontFamily` + `typeStyle`) + 13 컴포넌트 centralize + Android faux-bold 회피 정책 + ArrivalCard hardcode 정리 + LoginHero touch-up + output-styles/efficient.md 삭제
- **Phase 21.1** (commit `7b5bae8`): typography pre-commit guard 인프라 (lint script + npm scripts + husky + BANNED 규칙)
- **PR_BODY_TMP.md 갱신**: 30 commits 모두 반영, 84 → 133 lines, 보류 4건 제거 + 3건 새로 추가
- 검증: TypeScript 0, ESLint 0, Jest 326/326 (24 suites)

### 이번 /resume 세션 (2026-05-04 후반) 완료
- **Phase 1 inventory 결과 영속화** — bundle ↔ RN 7-screen 매핑표 + audit 분포(203 violations breakdown by directory)를 context.md 결정사항으로 기록. `lint:typography:audit`이 객관적 gap 척도로 정착
- **Phase 22 (commit `07104ad`)**: Statistics typography enforcement — 5 파일 12 violations 마이그레이션. HARD_PREFIXES에 `screens/statistics/` + `components/statistics/` 추가 (총 5 디렉토리). audit 203 → 191
- **Phase 22.1**: `StatisticsDashboardScreen.test.tsx`에 `@/services/theme` + `@/services/theme/themeContext` dual-path mock 추가. 4 fail → 4 pass
- **Phase 23 (commit `0aedffd`)**: Settings + Auth + Delays typography 통합 — 13 파일 73 violations 마이그레이션 (settings 31 / auth 23 / delays 19). HARD_PREFIXES 8 디렉토리로 확장. audit 191 → 118
- **Phase 23.1**: `ThemeSettingsScreen.test.tsx` + `LanguageSettingsScreen.test.tsx`에 `...jest.requireActual('@/styles/modernTheme')` spread 추가. 15 fail → 0. 메모리: `project_jest_partial_mock_requireactual.md`
- **Phase 24/25**: 위 Phase 23 commit에 흡수 (자동 commit 프로세스가 묶음)
- **`docs/design/` 트래킹 결정 (commit `e9d0740`)**: hand-off bundle을 git에 추적, 단 react/react-dom 런타임은 제외. 디자이너 인계 + 회귀 비교 가능
- **Gemini wording 정정**: react-native-patterns.md + .husky/pre-commit + lint-typography.cjs 모두 "whitelist" → "enforcement set"/"enforced paths"로 일관화. 5개 enforcement 디렉토리 정확히 명시
- **Pre-existing test fail 식별**: `StatisticsDashboardScreen.test.tsx` 4 fail은 `useTheme must be used within ThemeProvider`. `git stash` 검증으로 회귀 아님 확정. Phase 22.1로 분리
- 검증: TypeScript 0, ESLint 0 errors / 4 warnings (의도된 console + pre-existing), Jest 25/29 (4 pre-existing fail), lint:typography 0 violations in enforcement

## Phase 1: Hand-off 자료 분류 + Gap 분석 (✓ 완료)

### Tasks
- [x] `docs/design/wanted-livemetro-template.html` 전체 화면 카탈로그 인덱싱 — 4 screen 번들 + atoms + data + Android frame 구조 확인
- [x] `docs/design/wanted-bundle/` 9개 JS 파일 역할 매핑 (context 문서 참조)
- [x] 직전 PR Phase 1~21.1 결과물과 design 사양 diff — `lint:typography:audit`을 객관적 척도로 사용 (위반 분포 = design contract gap)
- [x] Gap 우선순위 도출:
  - **Critical**: Statistics (handoff에 있으나 명시 phase 없었음 — Phase 22로 닫음)
  - **High**: settings 31, auth 23, delays 19, prediction 17, services/theme 15
  - **Medium**: map 9, components/{delays,alerts} 각 9
  - **Low**: 기타 화면/컴포넌트 각 <10

## Phase 2: docs/design/ 트래킹 결정

### Tasks
- [ ] `docs/design/`을 git 추적 vs 로컬 전용 결정
  - 추적: 다음 디자이너 인계, 회귀 비교 가능 / Repo 1.3MB 증가
  - 로컬: Repo 가벼움 / 자료 분실 위험
- [ ] 결정 후: `.gitignore` 갱신 또는 `git add docs/design/` 단일 인프라 commit

## Phase 3: 잔여 화면 통합 (Phase 22 완료, 22.1+23~31 진행)

`Phase 21.1` 시점 audit 203 → Phase 22 후 **191**. Phase 21이 정리한 design/station/styles + Phase 22가 정리한 statistics는 enforcement 적용.

### Phase 22 ✓ (Statistics — 12 violations 닫음, commit `07104ad`)
### Phase 22.1 ✓ (Statistics test mock — dual-path)
### Phase 23 ✓ (Settings + Auth + Delays — 73 violations 닫음, commit `0aedffd`)
### Phase 23.1 ✓ (Settings test mock — jest.requireActual spread)
### Phase 24 ✓ (Auth — Phase 23 commit에 흡수)
### Phase 25 ✓ (Delays — Phase 23 commit에 흡수)

- [x] `screens/statistics/StatisticsDashboardScreen.tsx` (4)
- [x] `components/statistics/{StatsSummaryCard, DelayStatsChart, WeeklyStatsChart, LineUsagePieChart}.tsx` (8)
- [x] `HARD_PREFIXES` 5 디렉토리로 확장
- [x] Gemini wording 정정 (whitelist → enforcement set)

### Phase 22.1 (예약 — pre-existing test fail)
- [ ] `StatisticsDashboardScreen.test.tsx` dual-path theme mock fix (`useTheme` 두 import path 모두 mock)
- 메모리 entry: `project_dual_path_theme_mock.md`

### Phase 23~31 Roadmap (audit 191 → 0 점진)
| Phase | 영역 | 위반 |
|-------|------|------|
| 23 | `src/screens/settings/` 잔존 형제 | 31 |
| 24 | `src/screens/auth/` 형제 | 23 |
| 25 | `src/screens/delays/` 형제 | 19 |
| 26 | `src/screens/prediction/` | 17 |
| 27 | `src/services/theme/` | 15 |
| 28 | `src/screens/map/` | 9 |
| 29 | `src/components/{delays,alerts}/` | 각 9 |
| 30 | `src/screens/{route,favorites,alerts,home,station}/` | 각 4~8 (batch) |
| 31 | navigation + 잔여 components | 각 <10 (final cleanup) |

각 화면별 surgical phase 작업: weightToFontFamily import 추가 → 해당 디렉토리 fontFamily 라인 추가 → HARD_PREFIXES 확장 → 검증 (tsc/eslint/jest/lint:typography).
Phase 단위 atomic commit. baseline 0 도달 시 `--all` 모드를 default로 전환.

## Phase 4: Manual QA (실기기 검증 — 코드만으로 불가)

### Tasks
- [ ] `npx expo start --clear` → iOS 시뮬레이터 Pretendard 적용 확인
- [ ] Android 시뮬레이터 동일 확인 (Map 탭 아이콘 정상 렌더 포함)
- [ ] **Android faux-bold 부재 확인** (Phase 21 핵심 검증 — fontWeight 제거 정책의 실효성)
- [ ] 다크모드 토글: 모든 redesign 화면 contrast
- [ ] AlertsScreen 영어 로케일 토글
- [ ] `useMLPrediction` 학습 완료 후 MLHeroCard 실제 데이터 표시

## Success Metrics

| 지표 | 목표 | 최종 (2026-05-07) |
|------|------|------|
| 잔여 design gap | 0건 (또는 follow-up 명시 분리) | ✅ Phase 26~31 + Phase B closed |
| TypeScript 에러 | 0 매 commit | ✅ |
| ESLint 에러 | 0 매 commit | ✅ |
| Jest pass | 전부 | ✅ Phase 22.1/23.1/30.1/35/49 mock fix 모두 안착 |
| `lint:typography` (enforced) | 0 violation | ✅ Phase 31.1: HARD_PREFIXES 제거 → `src/**` 전체 enforce |
| **`lint:typography:audit`** (전체 src) | 0 violation | ✅ **0** (203 → 118 → 0, 100% 닫음) |
| `docs/design/` 트래킹 정책 명문화 | 결정 + 반영 | ✅ commit `e9d0740` + `0347680` (livemetro mirror) |
| Manual QA 5종 | 전부 통과 | 미수행 (실기기 필요 — 별도 체크리스트로 분리) |
