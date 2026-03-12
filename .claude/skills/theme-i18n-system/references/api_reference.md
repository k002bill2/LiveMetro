# Theme & i18n API Reference

## Theme API

### Types

```typescript
type ThemeMode = 'light' | 'dark' | 'system';
type ResolvedTheme = 'light' | 'dark';

// themeContext.tsx의 색상 팔레트 타입
type ThemeColors = {
  background: string;
  backgroundSecondary: string;
  surface: string;
  surfaceElevated: string;
  textPrimary: string;
  textSecondary: string;
  textTertiary: string;
  textDisabled: string;
  textInverse: string;
  borderLight: string;
  borderMedium: string;
  borderDark: string;
  primary: string;
  primaryHover: string;
  primaryLight: string;
  blue: string;
  yellow: string;
  red: string;
  success: string;
  successLight: string;
  warning: string;
  warningLight: string;
  error: string;
  errorLight: string;
  info: string;
  infoLight: string;
  black: string;
  white: string;
  gray100: string;
  gray200: string;
  gray300: string;
  gray400: string;
  gray500: string;
  gray600: string;
  gray700: string;
  gray800: string;
  overlay: string;
  cardShadow: string;
};
```

### ThemeContextType

```typescript
interface ThemeContextType {
  themeMode: ThemeMode;
  resolvedTheme: ResolvedTheme;
  colors: ThemeColors;
  isDark: boolean;
  setThemeMode: (mode: ThemeMode) => Promise<void>;
  isLoading: boolean;
}
```

### Hooks

| Hook | Return | 설명 |
|------|--------|------|
| `useTheme()` | `ThemeContextType` | 전체 테마 컨텍스트 |
| `useColors()` | `ThemeColors` | 현재 색상 팔레트만 |

### AsyncStorage

| 키 | 값 | 기본값 |
|----|-----|--------|
| `@livemetro_theme` | `'light' \| 'dark' \| 'system'` | `'system'` |

---

## High Contrast Theme API

### Theme 인터페이스

```typescript
interface Theme {
  colors: HighContrastThemeColors;
  spacing: ThemeSpacing;
  typography: ThemeTypography;
  borderRadius: { sm: number; md: number; lg: number; full: number };
  shadows: { sm: ShadowStyle; md: ShadowStyle; lg: ShadowStyle };
}

interface HighContrastThemeColors {
  primary: string; primaryDark: string; primaryLight: string;
  background: string; surface: string; card: string;
  text: string; textSecondary: string; textDisabled: string;
  success: string; warning: string; error: string; info: string;
  border: string; divider: string; overlay: string;
  lines: Record<string, string>;  // 호선별 색상 ('1'~'9')
}

interface ThemeSpacing {
  xs: number; sm: number; md: number; lg: number; xl: number; xxl: number;
}

interface ThemeTypography {
  h1: TextStyle; h2: TextStyle; h3: TextStyle;
  body: TextStyle; bodyLarge: TextStyle;
  caption: TextStyle; button: TextStyle;
}
```

### 프리셋 테마

| Export | 설명 |
|--------|------|
| `standardLightTheme` | 기본 라이트 테마 |
| `standardDarkTheme` | 기본 다크 테마 |
| `highContrastLightTheme` | 고대비 라이트 (큰 폰트, 높은 대비) |
| `highContrastDarkTheme` | 고대비 다크 (순수 검정 배경) |

### 유틸리티 함수

```typescript
// 테마 선택 (isDarkMode x isHighContrast 조합)
function getTheme(isDarkMode: boolean, isHighContrast: boolean): Theme;

// WCAG 대비율 계산
function getContrastRatio(color1: string, color2: string): number;

// WCAG AA 충족 여부 (일반 텍스트 4.5:1, 큰 텍스트 3:1)
function meetsContrastAA(color1: string, color2: string, isLargeText?: boolean): boolean;

// WCAG AAA 충족 여부 (일반 텍스트 7:1, 큰 텍스트 4.5:1)
function meetsContrastAAA(color1: string, color2: string, isLargeText?: boolean): boolean;
```

---

## i18n API

### Types

```typescript
type Language = 'ko' | 'en';

interface Translations {
  common: { cancel, confirm, save, delete, edit, done, back, next, loading, error, retry, ok: string };
  settings: { title, profile, anonymousUser, notificationSettings, commuteSettings, ... : string };
  languageSettings: { title, korean, english, changeConfirm, changeMessage: string };
  themeSettings: { title, system, systemDesc, light, lightDesc, dark, darkDesc: string };
  home: { title, nearbyStations, recentStations, searchPlaceholder, noStationsFound: string };
  favorites: { title, empty, addFavorite: string };
  alerts: { title, noAlerts, delay, suspension, serviceUpdate: string };
  station: { arrival, departure, transfer, platform, minutes, arriving, approaching: string };
  errors: { networkError, serverError, unknownError, authError: string };
}
```

### I18nContextType

```typescript
interface I18nContextType {
  language: Language;
  t: Translations;
  setLanguage: (lang: Language) => Promise<void>;
  isLoading: boolean;
}
```

### Hooks

| Hook | Return | 설명 |
|------|--------|------|
| `useI18n()` | `I18nContextType` | 전체 i18n 컨텍스트 |
| `useTranslation()` | `Translations` | 현재 번역 객체만 |

### AsyncStorage

| 키 | 값 | 기본값 |
|----|-----|--------|
| `@livemetro_language` | `'ko' \| 'en'` | `'ko'` |

---

## Design Tokens (themeUtils.ts)

### SPACING

| 토큰 | 값 |
|------|-----|
| `xs` | 4 |
| `sm` | 8 |
| `md` | 16 |
| `lg` | 20 |
| `xl` | 24 |
| `xxl` | 32 |
| `xxxl` | 40 |

### TYPOGRAPHY.sizes

| 토큰 | 값 |
|------|-----|
| `xs` | 12 |
| `sm` | 14 |
| `base` | 16 |
| `lg` | 18 |
| `xl` | 20 |
| `xxl` | 24 |
| `xxxl` | 32 |

### TYPOGRAPHY.weights

`normal('400')`, `medium('500')`, `semibold('600')`, `bold('700')`, `heavy('800')`

### BORDER_RADIUS

`xs(4)`, `sm(6)`, `md(8)`, `lg(12)`, `xl(16)`, `xxl(20)`, `full(9999)`

### SHADOWS

`sm`, `md`, `lg` -- 각각 `shadowColor`, `shadowOffset`, `shadowOpacity`, `shadowRadius`, `elevation` 포함.

### 유틸리티 함수

```typescript
// 화면 크기 기반 반응형 스페이싱
getResponsiveSpacing(base: keyof typeof SPACING): number;

// 화면 크기 기반 반응형 폰트 크기
getResponsiveFontSize(base: keyof typeof TYPOGRAPHY.sizes): number;

// 브레이크포인트별 스타일 선택
createResponsiveStyle<T>(small: T, medium?: T, large?: T): T;
```

### DEVICE 상수

```typescript
const DEVICE = {
  width: number;    // 화면 너비
  height: number;   // 화면 높이
  isSmall: boolean; // < 375
  isMedium: boolean; // 375~414
  isLarge: boolean;  // >= 414
  isIOS: boolean;
  isAndroid: boolean;
};
```

### 기타 상수

| 상수 | 설명 |
|------|------|
| `TOUCH_TARGET` | `min: 44`, `comfortable: 48` |
| `ANIMATION` | `fast: 150`, `normal: 250`, `slow: 350`, `slowest: 500` |
| `Z_INDEX` | `background: 0`, `content: 1`, `overlay: 10`, `modal: 100`, `toast: 1000` |
| `HAPTIC_TYPES` | `light`, `medium`, `heavy`, `success`, `warning`, `error` |
