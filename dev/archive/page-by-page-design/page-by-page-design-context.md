# Page-by-Page Design Application — Context & Decisions

**Last Updated**: 2026-05-09 KST — 신규 세션 entry point

## Status: 🔄 ACTIVE — 페이지 단위 진행

## 배경

LiveMetro는 `docs/design/livemetro/project/` (Claude Design 핸드오프 번들)을 적용 중. 시안 vs 현재 구현 audit 결과 11건 delta 식별됐으나, **bulk 시리즈(Phase 57+58, PR #25) 접근은 폐기**되고 페이지 단위 점진 적용으로 전환.

## Key Architectural Decisions

### Decision 1: 페이지 단위 진행 (page-by-page) — 2026-05-09

- **Context**: PR #25 (Phase 57+58)에서 토글 인프라(density/congStyle/lineEmphasis) + LoginHero SVG + Settings header 통일을 일괄 묶었으나, 토글 3종이 실제 시각 변화로 이어지지 않은 채 인프라만 늘어나 가치 불균형.
- **Decision**: bulk 시리즈 폐기, **한 화면씩 시안 ↔ 현재 비교 후 surgical edit**으로 전환.
- **Rationale**: 페이지 단위는 (1) 즉시 시각 검증 가능, (2) PR/commit unit이 작아 리뷰 부담 적음, (3) 시안 false positive를 phase 진입 시점에 즉시 발견. Phase 57.2/57.3 no-op 종결 패턴이 증명.
- **Alternatives Considered**: bulk 토글 + horizontal application (PR #25 접근). 폐기.
- **Implications**: 인프라 차원의 일관 토글(예: 다크모드 같은 전역 옵션)은 별개 결정 시점에 별도 도입. 현재 ThemeContext는 `themeMode`만 관리 (light/dark/system).

### Decision 2: 시안 README 정신 — "Match visual output, don't copy structure" — 2026-05-09

- **Context**: 시안은 HTML/CSS prototype, RN은 native. 1:1 코드 베끼기는 불가능/비효율.
- **Decision**: 시각 결과만 일치시키고 RN 패턴(StyleSheet, Animated, react-native-svg)은 그대로 사용.
- **Rationale**: README 명시 + Phase 57.3에서 검증 (3-ring Animated.loop이 시안의 box-shadow toggle보다 RN-native).
- **Implications**: 시안의 CSS-only 패턴(box-shadow multi-ring 등)은 SVG/Animated로 변환. 1:1 prop 베끼기 금지.

## 시안 자산 (참고용)

| 자산 | 경로 | 용도 |
|------|------|------|
| 메인 HTML (entry) | `docs/design/livemetro/project/LiveMetro.html` | 전체 화면 등록 + 섹션 구성 |
| 화면별 jsx | `docs/design/livemetro/project/src/screens/` | 8 jsx에 11+ 화면 spec |
| 공통 atoms | `docs/design/livemetro/project/src/atoms.jsx` | LineBadge/Pill/Congestion*/Icon/SectionHeader 시그니처 |
| 디자인 토큰 (CSS) | `docs/design/livemetro/project/lib/wanted-tokens.css` + `metro-tokens.css` | 색/간격/타이포 reference |
| 현재 디자인 시스템 | `src/styles/modernTheme.ts` (`WANTED_TOKENS`) | TS 토큰 매핑 (사용처 8/14 design 컴포넌트) |
| 시안 첨부 status | `docs/design/livemetro/project/uploads/implementation-status.md` | 디자이너 작성 5월초 구현 현황 (참고만) |

## 페이지별 매핑 (시안 ↔ 현재)

| 시안 컴포넌트 | 시안 파일 | 현재 화면 |
|--------------|----------|-----------|
| LoginScreen | `auth.jsx` | `src/screens/auth/AuthScreen.tsx` (+ `src/components/auth/LoginHero.tsx`) |
| SignupStep1/2/3 | `auth-signup-steps.jsx` | `src/screens/auth/SignupStep{1,2,3}Screen.tsx` |
| HomeScreen | `main.jsx` | `src/screens/home/HomeScreen.tsx` |
| FavoritesScreen | `main.jsx` | `src/screens/favorites/FavoritesScreen.tsx` |
| StationDetailScreen | `main.jsx` | `src/screens/station/StationDetailScreen.tsx` |
| RoutesScreen | `main.jsx` | `src/screens/route/*` |
| CommutePredictionScreen | `commute-prediction.jsx` | `src/screens/prediction/WeeklyPredictionScreen.tsx` |
| DelayFeedScreen | `rest.jsx` | `src/screens/delays/DelayFeedScreen.tsx` |
| StatsScreen | `rest.jsx` | `src/screens/statistics/*` |
| MapScreen | `rest.jsx` | `src/screens/map/SubwayMapScreen.tsx` |
| AlertsScreen | `rest.jsx` | `src/screens/alerts/AlertsScreen.tsx` |
| OnboardingStep1/3/4 | `onboarding-steps.jsx` | `src/screens/onboarding/*` |
| OnboardingStationPicker | `onboarding-station-picker.jsx` | `src/screens/onboarding/OnboardingStationPickerScreen.tsx` |
| SettingsScreen | `rest.jsx` | `src/screens/settings/SettingsScreen.tsx` |
| SettingsCommute/Alerts/AlertTime/Sound | `settings-detail.jsx` | `src/screens/settings/*` |

## Audit 결과 요약 (PR #25 시점, 참고만 — page 진입 시 직접 재검증 권장)

| # | 항목 | 상태 (PR #25 시점) | 페이지 단위 처리 |
|---|------|------------------|-----------------|
| #1-#4 | 토글 인프라 (density/congStyle/lineEmphasis) | 인프라 + UI 노출 완료 후 폐기 | **무시** — 토글 자체 불필요 결정 |
| #5 | LoginHero SVG fidelity (radial gradient + multi-ring pulse) | 적용 후 폐기 | LoginScreen 페이지 작업 시 재검토 |
| #6 | 96px ease-out cubic 애니메이션 | 이미 1:1 일치 | 검증 완료, 변경 불필요 |
| #7 | Pill tone palette inline 색 → WANTED_TOKENS | 미해소 | Pill 사용 페이지 작업 시 closeout |
| #8 | lucide 케이싱 일관성 | 0건 발견 | 변경 불필요 |
| #9 | Welcome 펄스 패턴 | 시안과 다른 RN 패턴이 충실 | 변경 불필요 |
| #10 | Settings header alignment | **재적용 완료 (2026-05-09, commit `a13d816`, PR #34)** — 13 settings screens cascade via theme-aware screenOptions | closeout |
| #11 | atoms 시그니처 1:1 검증 | 100% 일치 | 변경 불필요 |

## Configuration / Hooks 영향

| 위치 | 메모 |
|------|------|
| `.claude/hooks/skillGateGuard.js` | `src/*.tsx` 편집 전 `react-native-development` 스킬 호출 필요 |
| `.claude/hooks/skillGateGuard.js` | `*.test.tsx` 편집 전 `test-automation` 스킬 호출 필요 |
| `.claude/hooks/skillGateGuard.js` | `functions/src/*.ts` 편집 전 `firebase-integration` 스킬 호출 필요 |
| `.claude/hooks/hardGateGuard.js` | 3+ 파일 편집 시 `dev/active/<task>/<task>-plan.md` 또는 `<projectDir>/.claude/plans/*.md` 필요 |
| pre-commit hook | husky가 `lint:typography` 등 자동 실행 — 화면 작업 후 commit 시 통과 확인 |

## 관련 메모리 패턴

- **[Wanted token migration 5단계](feedback)** — surgical 페이지 적용 레시피 (import/destructure/inline icon/createStyles/deps)
- **[Phase B closeout 패턴](feedback)** — 페이지 작업 마무리 형태
- **[Verify component usage before phase](feedback)** — 페이지 진입 시 시안/구현 직접 비교 우선
- **[Surgical Changes](golden-principles.md)** — 요청된 줄만 변경
- **[Atom barrel jest cascade](feedback)** — react-native-svg mock에 사용 primitive 누락 주의
- **[useTheme 두 경로 mock](feedback)** — atomic이 themeContext 직접 import 시 두 path 다 mock 필요

## 새 세션에서 시작하는 법

1. **이 파일 read** (현재 파일)
2. **plan 파일 read** (`page-by-page-design-plan.md`) — 워크플로우 + 추천 시작점
3. **tasks 파일 read** (`page-by-page-design-tasks.md`) — 페이지별 체크리스트, 다음 작업 선택
4. **선택한 페이지 작업 진입** — 시안 jsx + 현재 화면 직접 비교부터 시작
