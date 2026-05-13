# Page-by-Page Design Application — Implementation Plan

**Created**: 2026-05-09
**Status**: Active — 페이지 단위 진행
**Priority**: Medium (없으면 product 정상 동작, 있으면 visual fidelity 향상)

## Objective

`docs/design/livemetro/project/` (Claude Design 핸드오프 번들)을 LiveMetro 화면에 페이지 단위로 점진 적용. 각 페이지를 surgical commit unit으로 다루고, 시안과의 시각 차이를 단계적으로 해소.

## 진행 원칙

1. **bulk 시리즈 금지** — 한 번에 한 화면. 인프라 일괄 도입 금지.
2. **시안 직접 읽기 우선** — audit 보고서는 false positive 가능. phase 진입 시점에 시안 jsx + 현재 코드 직접 비교.
3. **시각 결과 일치, 구조 자유** — RN 패턴(StyleSheet/Animated/react-native-svg) 그대로 사용.
4. **단일 commit unit** — 페이지 1개 = commit 1개 = PR 1개 (작은 변경은 묶기 가능).
5. **검증 증거 필수** — 메모리 [Verification Rules](verification.md): type-check + 테스트 통과 후 commit.

## 페이지 단위 작업 흐름 (1 페이지 ~30분~2시간)

```
1. 시안 jsx 직접 읽기 (audit 보고서 의존 X)
   - docs/design/livemetro/project/src/screens/<file>.jsx 핵심 spec 추출

2. 현재 화면 직접 읽기 + 시각 차이 식별
   - src/screens/<domain>/<Screen>.tsx
   - 시안에 있고 현재에 없는 요소
   - 시안과 현재 spec이 다른 요소 (색/간격/타이포)

3. 변경 범위 결정
   - 시각 fidelity (SVG, 색상, 간격, 타이포)
   - 토큰 일관성 (inline 색 → WANTED_TOKENS)
   - 동작 보강 (애니메이션, 인터랙션)

4. surgical edit 진행
   - 메모리 [Surgical Changes](golden-principles.md): 요청된 줄만, 인접 코드 'cleanup' 금지
   - skillGateGuard: src/*.tsx 편집 전 react-native-development 스킬 호출
   - hardGateGuard: 3+ 파일 변경 시 plan 파일 (이 파일) 존재로 통과

5. 검증
   - npm run type-check (0 에러 필수)
   - npx jest <해당 영역> --watchman=false
   - 시안 mock 추가 시 react-native-svg primitive 누락 주의

6. PR 또는 main commit
   - feature 브랜치 권장: feat/page-<페이지명>-design
   - conventional commit: feat(<domain>): apply Wanted handoff to <ScreenName>
```

## 페이지별 우선순위 (추천 시작 순서)

### Tier 1 — 가장 가시성 큰 페이지 (사용자 첫 인상)

1. **AuthScreen** — 첫 진입 화면, LoginHero SVG가 시안의 시그니처
2. **HomeScreen** — 메인 진입 후 첫 화면, 가장 자주 보임
3. **WelcomeOnboardingScreen** — 첫 사용자가 보는 화면, 펄스 애니메이션 등

### Tier 2 — 핵심 사용 화면

4. **StationDetailScreen** — 도착 정보 핵심, ArrivalCard 포함
5. **WeeklyPredictionScreen** — ML 차별점 (commute-prediction.jsx 매핑)
6. **FavoritesScreen** — 자주 사용 + FavoriteRow atom

### Tier 3 — 부가 화면

7. **DelayFeedScreen / AlertsScreen** — 알림/제보
8. **MapScreen** — 노선도
9. **StatsScreen** — 통계 대시보드
10. **RoutesScreen** — 경로 비교

### Tier 4 — Settings 군 (빈도 낮으나 일관성 중요)

11. **SettingsScreen** + 12개 detail 화면

### Tier 5 — Onboarding 군 (1회성)

12. **OnboardingStep1/3/4** + StationPicker

## Verification (각 페이지 작업 종료 시)

```bash
# 1) TypeScript 0 에러
npm run type-check

# 2) 해당 페이지 영역 테스트
npx jest src/screens/<domain> src/components/<domain> --watchman=false

# 3) (선택) 전체 regression sweep — 큰 변경 시
npm test -- --watchAll=false --watchman=false 2>&1 | tail -20
```

## Critical Files (모든 페이지 작업의 공통 reference)

- `docs/design/livemetro/project/LiveMetro.html` — 시안 entry point
- `docs/design/livemetro/project/src/atoms.jsx` — 공통 컴포넌트 시그니처
- `docs/design/livemetro/project/lib/wanted-tokens.css` + `metro-tokens.css` — 토큰 reference
- `src/styles/modernTheme.ts` — 현재 TS 토큰 (`WANTED_TOKENS`)
- `src/services/theme/themeContext.tsx` — 테마/다크모드 컨텍스트

## Out of Scope (이 plan 전체)

- 토글 인프라 (density/congStyle/lineEmphasis) — PR #25에서 폐기 결정
- bulk horizontal application (한 번에 여러 화면) — 페이지 단위 원칙 위반
- 시안에 없는 새 기능 — 페이지 fidelity만, 신규 feature는 별개 결정

## 다음 작업 옵션

| 옵션 | 추천 시작 페이지 | 추정 시간 | 비고 |
|------|----------------|----------|------|
| A | AuthScreen + LoginHero | 1-2h | 첫 진입 화면, 시안 SVG 시그니처 |
| B | HomeScreen | 2-3h | 가장 자주 보이는 화면 |
| C | StationDetailScreen | 1-2h | ArrivalCard 포함 (이미 Phase 53b 적용) |
| D | 기타 — 사용자 우선순위 | — | 사용자 지정 |

각 옵션은 별도 세션에서 진행. 시작할 페이지가 정해지면 `page-by-page-design-tasks.md`에서 해당 페이지 항목 참고 → 작업 진입.
