# Design Application — Path A (Pointer)

> Full plan: `~/.claude/plans/rollback-structured-kurzweil.md`

## Context (요약)

LiveMetro `docs/design/livemetro/project/` 핸드오프 번들을 화면 단위(Path A)로 적용. 11건 delta 식별 (audit 보고서 별도). 인프라-라이트(ThemeContext 확장) 선작업 완료 후 화면별 phase 진행.

## Phase 진행 현황

| Phase | 화면 | 상태 |
|-------|------|------|
| 57.0 | ThemeContext + density/congStyle/lineEmphasis | ✅ 완료 |
| 57.1 | AuthScreen LoginHero SVG (radial gradient + multi-ring pulse) | ✅ 완료 |
| 57.2 | WeeklyPredictionScreen 96px ease-out | ✅ no-op (이미 1:1 일치) |
| 57.3 | WelcomeOnboardingScreen 3-ring 펄스 | ✅ no-op (RN 패턴 충실) |
| 57.4 | Settings 화면군 DetailHeader sticky | ✅ 완료 (commit `d9d12a0`) |
| 57.5 | atoms/token closeout | ✅ no-op (#11/#8), #7는 별도 phase 후보 |
| 58 | SettingsThemeScreen 토글 UI | 🔄 진행 중 |

## Phase 57.1 범위 (현재)

**파일**: `src/components/auth/LoginHero.tsx` + 테스트
**변경**: SVG에 RadialGradient defs 추가, View 펄스 핀 → SVG 3-Circle 중첩으로 multi-ring 효과 재현
**테스트 mock 업데이트**: `react-native-svg` mock에 Defs/RadialGradient/Stop/Rect 추가

## 검증 명령

```bash
npm run type-check
npx jest src/components/auth/__tests__/LoginHero.test.tsx
```
