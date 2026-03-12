---
name: theme-i18n-system
description: "테마(다크/라이트/고대비) 및 다국어(한/영) 시스템. React Context 기반 전역 상태, AsyncStorage 영속화, 시스템 설정 자동 감지. Use when: (1) 테마/다크모드 구현, (2) 다국어 번역 추가, (3) 접근성 고대비 모드, (4) 색상/스타일 시스템 작업. 트리거: 테마, theme, 다크모드, dark mode, 국제화, i18n, 번역, translation, 고대비, high contrast."
---

# Theme & i18n System

## Overview

LiveMetro의 테마(라이트/다크/시스템/고대비)와 다국어(한국어/영어) 시스템.
React Context + AsyncStorage 기반으로 전역 상태를 관리하며, 시스템 설정 자동 감지를 지원한다.

## Architecture

```
App.tsx
  └─ ThemeProvider (시스템 컬러스킴 감지 + AsyncStorage 영속화)
       └─ I18nProvider (언어 설정 + AsyncStorage 영속화)
            └─ NavigationContainer
                 └─ Screens (useTheme, useI18n 훅으로 소비)
```

**두 시스템 모두 동일한 패턴**: Context 생성 → Provider에서 AsyncStorage 로드/저장 → 커스텀 훅으로 소비.

## 관련 파일

| 파일 | 역할 |
|------|------|
| `src/services/theme/themeContext.tsx` | ThemeProvider, useTheme, useColors, 라이트/다크 색상 팔레트 |
| `src/services/theme/highContrastTheme.ts` | 고대비 테마, Theme 타입, getTheme(), WCAG 유틸리티 |
| `src/services/theme/index.ts` | 테마 서비스 re-export |
| `src/services/i18n/i18nContext.tsx` | I18nProvider, useI18n, useTranslation |
| `src/services/i18n/translations.ts` | 번역 데이터 (ko/en), Language/Translations 타입 |
| `src/services/i18n/index.ts` | i18n 서비스 re-export |
| `src/utils/themeUtils.ts` | 디자인 토큰 (SPACING, TYPOGRAPHY, BORDER_RADIUS, SHADOWS 등) |

## Theme System

### ThemeContext 구조

```typescript
type ThemeMode = 'light' | 'dark' | 'system';
type ResolvedTheme = 'light' | 'dark';

interface ThemeContextType {
  themeMode: ThemeMode;         // 사용자 선택값
  resolvedTheme: ResolvedTheme; // system일 때 실제 적용값
  colors: ThemeColors;          // 현재 색상 팔레트
  isDark: boolean;              // 다크모드 여부
  setThemeMode: (mode: ThemeMode) => Promise<void>;
  isLoading: boolean;           // AsyncStorage 로드 중
}
```

- AsyncStorage 키: `@livemetro_theme`
- `system` 모드: `useColorScheme()`으로 OS 설정 자동 감지

### 색상 팔레트 (ThemeColors)

| 카테고리 | 키 | Light | Dark |
|----------|-----|-------|------|
| 배경 | `background` | `#FFFFFF` | `#121212` |
| 배경(보조) | `backgroundSecondary` | `#F8F9FA` | `#1E1E1E` |
| 텍스트 | `textPrimary` | `#1A1A1A` | `#FFFFFF` |
| 텍스트(보조) | `textSecondary` | `#757575` | `#B0B0B0` |
| Primary | `primary` | `#546FFF` | `#7B8CFF` |
| 성공 | `success` | `#27AE60` | `#4ADE80` |
| 경고 | `warning` | `#F2C94C` | `#FFD966` |
| 오류 | `error` | `#EB5757` | `#FF6B6B` |
| 오버레이 | `overlay` | `rgba(26,26,26,0.5)` | `rgba(0,0,0,0.7)` |

전체 팔레트: `themeContext.tsx`의 `lightColors` / `darkColors` 참조.

### 고대비 테마 (High Contrast)

`highContrastTheme.ts`에 4가지 Theme 프리셋 정의:

| 프리셋 | 설명 |
|--------|------|
| `standardLightTheme` | 기본 라이트 |
| `standardDarkTheme` | 기본 다크 |
| `highContrastLightTheme` | 고대비 라이트 (텍스트 `#000000`, 테두리 `#000000`) |
| `highContrastDarkTheme` | 고대비 다크 (배경 `#000000`, 테두리 `#FFFFFF`) |

고대비 모드는 WCAG AA/AAA 기준을 충족하도록 설계됨. 폰트 크기/스페이싱도 더 크게 설정.

```typescript
// 테마 선택
const theme = getTheme(isDarkMode, isHighContrast);

// WCAG 대비율 검증
meetsContrastAA('#000000', '#FFFFFF');  // true (21:1)
meetsContrastAAA('#333333', '#FFFFFF'); // true (12.6:1)
```

### 디자인 토큰 (themeUtils.ts)

컴포넌트에서 일관된 스타일링을 위한 상수:

```typescript
import { SPACING, TYPOGRAPHY, BORDER_RADIUS, SHADOWS } from '@/utils/themeUtils';

// 사용 예시
const styles = StyleSheet.create({
  container: { padding: SPACING.md },         // 16
  title: { fontSize: TYPOGRAPHY.sizes.xl },    // 20
  card: { borderRadius: BORDER_RADIUS.lg, ...SHADOWS.md },
});
```

### useTheme 훅 사용법

```typescript
import { useTheme, useColors } from '@/services/theme';

const MyComponent: React.FC = () => {
  const { colors, isDark, setThemeMode } = useTheme();
  // 또는 색상만 필요할 때:
  const colors = useColors();

  return (
    <View style={{ backgroundColor: colors.background }}>
      <Text style={{ color: colors.textPrimary }}>Hello</Text>
      <Button onPress={() => setThemeMode('dark')} title="다크 모드" />
    </View>
  );
};
```

## i18n System

### I18nContext 구조

```typescript
type Language = 'ko' | 'en';

interface I18nContextType {
  language: Language;
  t: Translations;                              // 현재 언어의 번역 객체
  setLanguage: (lang: Language) => Promise<void>;
  isLoading: boolean;
}
```

- AsyncStorage 키: `@livemetro_language`
- 기본 언어: `ko` (한국어)

### 번역 키 구조

`Translations` 인터페이스는 카테고리별로 분류:

| 카테고리 | 키 예시 | 설명 |
|----------|---------|------|
| `common` | `cancel`, `confirm`, `save`, `loading` | 공통 UI 텍스트 |
| `settings` | `title`, `theme`, `language`, `signOut` | 설정 화면 |
| `languageSettings` | `title`, `korean`, `english` | 언어 설정 |
| `themeSettings` | `title`, `system`, `light`, `dark` | 테마 설정 |
| `home` | `title`, `nearbyStations`, `searchPlaceholder` | 홈 화면 |
| `favorites` | `title`, `empty`, `addFavorite` | 즐겨찾기 |
| `alerts` | `title`, `delay`, `suspension` | 알림 |
| `station` | `arrival`, `minutes`, `arriving` | 역 정보 |
| `errors` | `networkError`, `serverError`, `authError` | 오류 메시지 |

### 번역 키 추가 방법

1. `translations.ts`의 `Translations` 인터페이스에 타입 추가
2. `translations.ko`에 한국어 번역 추가
3. `translations.en`에 영어 번역 추가

```typescript
// 1. 인터페이스에 새 카테고리 또는 키 추가
export interface Translations {
  // 기존 카테고리...
  myNewSection: {
    greeting: string;
    farewell: string;
  };
}

// 2. ko 번역 추가
ko: {
  myNewSection: {
    greeting: '안녕하세요',
    farewell: '안녕히 가세요',
  },
}

// 3. en 번역 추가
en: {
  myNewSection: {
    greeting: 'Hello',
    farewell: 'Goodbye',
  },
}
```

TypeScript가 누락된 번역 키를 컴파일 타임에 잡아줌 -- 한쪽 언어만 추가하면 타입 에러 발생.

### useI18n 훅 사용법

```typescript
import { useI18n, useTranslation } from '@/services/i18n';

const MyComponent: React.FC = () => {
  const { t, language, setLanguage } = useI18n();
  // 또는 번역만 필요할 때:
  const t = useTranslation();

  return (
    <View>
      <Text>{t.common.loading}</Text>
      <Text>{t.settings.title}</Text>
      <Button onPress={() => setLanguage('en')} title="English" />
    </View>
  );
};
```

## 새 컴포넌트 작성 시 체크리스트

1. 하드코딩 색상 금지 -- `useColors()` 또는 `useTheme().colors` 사용
2. 하드코딩 문자열 금지 -- `useTranslation()` 또는 `useI18n().t` 사용
3. 스페이싱/폰트 크기 -- `SPACING`, `TYPOGRAPHY` 토큰 사용
4. 고대비 모드 고려 -- 텍스트 대비율 WCAG AA(4.5:1) 이상 확보
5. Provider 래핑 확인 -- `ThemeProvider` > `I18nProvider` 순서

## 테스트 작성 가이드

테마/i18n 사용 컴포넌트 테스트 시 Provider 래핑 필수:

```typescript
import { ThemeProvider } from '@/services/theme';
import { I18nProvider } from '@/services/i18n';

const renderWithProviders = (ui: React.ReactElement) =>
  render(
    <ThemeProvider>
      <I18nProvider>{ui}</I18nProvider>
    </ThemeProvider>
  );
```

AsyncStorage mock:
```typescript
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn().mockResolvedValue(null),
  setItem: jest.fn().mockResolvedValue(undefined),
}));
```
