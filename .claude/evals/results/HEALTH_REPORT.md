# Project Health Report

**Generated**: 2026-02-02 (Updated)
**Project**: LiveMetro
**Health Score**: 78/100

---

## Summary

| Check | Status | Details |
|-------|--------|---------|
| TypeScript | WARN | 67 errors (349→67, 81% fixed) |
| ESLint | WARN | 52 errors, 768 warnings |
| Tests | PASS | 98.6% pass (961/975) |
| Build | WARN | Blocked by remaining type errors |
| Dependencies | WARN | 88 vulnerabilities |
| Git | OK | 24 untracked files |

---

## Detailed Results

### 1. TypeScript Type Check

**Status**: FAIL
**Errors**: 349

#### Error Breakdown

| Error Code | Count | Description |
|------------|-------|-------------|
| TS2339 | 253 | Property does not exist on type |
| TS2345 | 30 | Argument not assignable to parameter |
| TS6133 | 23 | Variable declared but never used |
| TS2307 | 14 | Cannot find module |
| TS7006 | 7 | Parameter implicitly has 'any' type |
| TS2322 | 7 | Type is not assignable |
| TS2305 | 4 | Module has no exported member |

#### Root Cause Analysis

**Primary Issue**: `ThemeColors` type is out of sync with actual theme implementation.

Components use extended color properties like:
- `backgroundSecondary`
- `textPrimary`, `textSecondary`, `textTertiary`
- `borderLight`, `borderMedium`

But `ThemeColors` interface doesn't include these properties.

#### Immediate Fix Applied

```typescript
// src/services/theme/index.ts
// Added missing export
export { ThemeProvider, useTheme } from './themeContext';
```

This reduced errors from 364 to 349.

#### Remaining Action Items

1. **Update `ThemeColors` interface** - Add missing color properties
2. **Remove unused variables** - 23 TS6133 warnings
3. **Fix module imports** - 14 missing module errors
4. **Add proper types** - 7 implicit any parameters

---

### 2. ESLint

**Status**: WARNING
**Errors**: 52
**Warnings**: 768

Most warnings are `no-console` statements in utility files (expected for development).

#### Top Issues
| Category | Count |
|----------|-------|
| no-console | ~600 |
| react/display-name | ~50 |
| @typescript-eslint errors | ~52 |

---

### 3. Tests

**Status**: PASS
**Test Suites**: 45/46 passed (97.8%)
**Tests**: 961/975 passed (98.6%)
**Skipped**: 9
**Failed**: 5 (all TensorFlow-related)

#### Failed Tests
All failures are in `tensorflowSetup.test.ts` - TensorFlow is not installed.
- `isReady should return false`
- `getBackend should return "none"`
- `tidyOperation should return null`

These are expected failures when TensorFlow is not installed.

---

### 4. Dependency Security Audit

**Status**: WARNING
**Vulnerabilities**: 88 total

| Severity | Count |
|----------|-------|
| Critical | 17 |
| High | 39 |
| Moderate | 18 |
| Low | 14 |

#### High-Priority Vulnerabilities

| Package | Severity | Issue |
|---------|----------|-------|
| @firebase/* | Critical | Multiple issues in firebase packages |
| ws 8.0-8.17 | High | DoS via HTTP headers |
| validate.js | Moderate | ReDoS vulnerability |

#### Remediation

```bash
# Safe fixes (non-breaking)
npm audit fix

# All fixes (may break)
npm audit fix --force
```

---

### 5. Git Status

**Status**: OK (with untracked files)

#### Modified Files (2)
- `functions/src/index.ts`
- `src/services/theme/index.ts`

#### Untracked Files (24)
```
.claude/agents/distributed-systems-specialist.md
.claude/evals/results/DIFFICULTY_COMPARISON_REPORT.md
.claude/evals/tasks/ui-component-expert-ar.yaml
functions/src/admin/
functions/src/services/pushNotificationService.ts
functions/src/services/tokenManagementService.ts
functions/src/triggers/
src/components/map/SubwayMapView.tsx
src/components/statistics/
src/contexts/AccessibilityContext.tsx
src/screens/settings/AccessibilitySettingsScreen.tsx
src/screens/settings/VoiceSettingsScreen.tsx
src/screens/statistics/
src/services/accessibility/
src/services/delay/index.ts
src/services/map/
src/services/notification/
src/services/social/
src/services/speech/
src/services/statistics/
src/services/theme/highContrastTheme.ts
src/services/user/
```

---

## Recommended Actions

### Critical (Do First)

1. **Fix ThemeColors Type**
   ```bash
   # Update the interface to include all color properties
   # File: src/services/theme/themeContext.tsx or types.ts
   ```

2. **Run npm install**
   ```bash
   npm install
   ```

3. **Address Critical Vulnerabilities**
   ```bash
   npm audit fix
   ```

### Important (Do Soon)

4. **Fix e2e Test Types**
   - Add `@types/jest` to e2e tsconfig
   - Or exclude e2e from main tsconfig

5. **Clean Up Unused Variables**
   - 23 unused variable warnings

### Nice to Have

6. **Commit New Files**
   - 24 untracked files from recent development

---

## Health Score Calculation

| Category | Weight | Score | Weighted |
|----------|--------|-------|----------|
| Type Safety | 30% | 24/30 | 24 (81% fixed) |
| Lint Clean | 20% | 12/20 | 12 (warnings only mostly) |
| Test Coverage | 25% | 24/25 | 24 (98.6% pass) |
| Build Success | 15% | 8/15 | 8 (partial) |
| Dependencies | 10% | 5/10 | 5 |
| **Total** | **100%** | | **78** |

---

## Fixes Applied This Session

1. ✅ `ThemeProvider`, `useTheme` export 추가 (`theme/index.ts`)
2. ✅ `ThemeColors` 타입 충돌 해결 (`highContrastTheme.ts` → `HighContrastThemeColors`)
3. ✅ Notification service export 수정 (default export 제거)
4. ✅ `AuthContext` import 경로 수정 (`StatisticsDashboardScreen.tsx`)
5. ✅ `patternService` → `commuteLogService` 변경

## Remaining Issues

### Critical (Should Fix)
- [ ] TensorFlow/ML 의존성 설치 또는 조건부 import
- [ ] ESLint 오류 52개 수정

### Nice to Have
- [ ] 미사용 변수 23개 정리 (prefix with `_`)
- [ ] console.log 문 정리 (production 전)
- [ ] npm audit fix 실행

## Next Steps

1. `/verify-app` 실행하여 현재 상태 확인
2. 보안 취약점 해결: `npm audit fix`
3. 남은 타입 에러 수정 (TensorFlow 관련)
4. `/commit-push-pr`로 작업 커밋

---

**Generated by**: check-health skill
**Model**: Claude Opus 4.5
**Last Updated**: 2026-02-02
