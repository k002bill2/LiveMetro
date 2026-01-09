# KiiPS SCSS Style Guide

> **Last Updated**: 2025-12-29
> **Purpose**: KiiPS 스타일 작업 시 빠른 참조를 위한 SCSS 가이드 (토큰 효율화)

---

## 📍 Quick Reference

**메인 파일**: `/KiiPS-UI/src/main/resources/static/css/sass/theme.scss`

**자주 사용하는 변수**:
```scss
// 색상
$theme-color: #007bff;           // 메인 테마 색상
$color-primary: #007bff;         // Primary 색상
$color-success: #47a447;         // Success 색상
$color-danger: #d2322d;          // Danger 색상
$color-warning: #FF9F43;         // Warning 색상

// 폰트
$font-primary: "NexonLv2Gothic", "Open Sans", ...;
$font-weight-normal: 500;
$font-weight-bold: 600;

// 간격
$spacement-xs: 5px;   // 5px
$spacement-sm: 10px;  // 10px
$spacement-md: 15px;  // 15px
$spacement-lg: 20px;  // 20px
$spacement-xl: 25px;  // 25px
```

**자주 사용하는 믹스인**:
```scss
@include flex(center, center);           // 중앙 정렬
@include font-size(14);                  // font-size: 1rem (14px 기준)
@include media-breakpoint-up(md) { ... } // 반응형
@include clearfix;                       // float 해제
```

---

## 🎨 Colors

### 주요 색상 변수

| 변수 | 값 | 용도 |
|------|-----|------|
| `$theme-color` | `#007bff` | 메인 테마 색상 |
| `$color-primary` | `#007bff` | Primary 버튼, 링크 |
| `$color-success` | `#47a447` | 성공 메시지, Success 버튼 |
| `$color-warning` | `#FF9F43` | 경고 메시지 |
| `$color-danger` | `#d2322d` | 에러 메시지, Danger 버튼 |
| `$color-info` | `#44b5bc` | 정보 메시지 |
| `$color-secondary` | `#a5a5a5` | 보조 버튼 |
| `$color-muted` | `#CCC` | 비활성 텍스트 |

### 색상 변형

```scss
// 자동 생성되는 lighten/darken 변형
$color-primary-lighten: lighten($color-primary, 15%);  // #4da3ff
$color-primary-darken: darken($color-primary, 35%);    // #003d80

$theme-color-light: lighten($theme-color, 5%);
$theme-color-dark: darken($theme-color, 5%);
```

### 사용 예제

```scss
.btn-custom {
    background-color: $color-primary;
    color: $color-primary-inverse; // #FFF
    border: 1px solid $color-primary-darken;

    &:hover {
        background-color: $color-primary-lighten;
    }
}

.alert-custom {
    background-color: $color-info-light; // #d0f2f3
    color: $color-info-inverse;          // #242424
}
```

---

## 🔤 Typography

### 폰트 변수

```scss
// 폰트 패밀리
$font-primary: "NexonLv2Gothic", "Open Sans", Tahoma, Verdana, Arial, Helvetica, sans-serif;
$font-secondary: "Shadows Into Light", cursive;

// 폰트 사이즈 (px 단위)
$body-font-size: 13;
$root-font-size: 14;      // rem 계산 기준
$menu-font-size: 14;
$body-line-height: 22;

// 폰트 굵기
$font-weight-light: 300;
$font-weight-normal: 500;
$font-weight-bold: 600;
$font-weight-semibold: 600;
$font-weight-extra-bold: 600;
$font-weight-black: 700;
```

### 사용 예제

```scss
.page-title {
    font-family: $font-primary;
    @include font-size(18);        // font-size: 1.286rem
    font-weight: $font-weight-bold;
    @include line-height(24);      // line-height: 1.714rem
}

.subtitle {
    @include font-size($menu-font-size);
    font-weight: $font-weight-normal;
}
```

---

## 📏 Spacing & Borders

### 간격 변수 (5px 단위 증가)

```scss
$spacement-increment: 5px;

$spacement-xs: 5px;    // 5px
$spacement-sm: 10px;   // 10px
$spacement-md: 15px;   // 15px
$spacement-lg: 20px;   // 20px
$spacement-xl: 25px;   // 25px
$spacement-xlg: 30px;  // 30px
```

### Border 변수

```scss
$border-thin: 1px;
$border-normal: 2px;
$border-thick: 3px;
```

### 사용 예제

```scss
.card {
    padding: $spacement-md;           // 15px
    margin-bottom: $spacement-lg;     // 20px
    border: $border-thin solid $color-muted;
}

.section-gap {
    margin-top: $spacement-xl;        // 25px
    padding: $spacement-sm $spacement-md; // 10px 15px
}
```

---

## 🛠️ Mixins

### 1. `@mixin flex()`

중앙 정렬, 플렉스박스 레이아웃 생성

**Syntax**: `@mixin flex($justify-content, $align-items)`

```scss
.centered-container {
    @include flex(center, center);
    // display: flex;
    // justify-content: center;
    // align-items: center;
}

.space-between {
    @include flex(space-between, center);
}

.flex-start {
    @include flex(flex-start, flex-start);
}
```

---

### 2. `@mixin flexbox()`

플렉스 아이템 크기 조정

**Syntax**: `@mixin flexbox($grow, $shrink, $basis)`

```scss
.flex-item {
    @include flexbox(1, 0, 50%);
    // flex: 1 0 50%;
    // max-width: 50%;
}
```

---

### 3. `@mixin font-size()`, `@mixin line-height()`

px를 rem으로 자동 변환 (기준: 14px = 1rem)

**Syntax**: `@mixin font-size($size)`, `@mixin line-height($size)`

```scss
.text {
    @include font-size(16);      // font-size: 1.143rem (16px)
    @include line-height(24);    // line-height: 1.714rem (24px)
}

h1 {
    @include font-size(32);      // font-size: 2.286rem (32px)
    @include line-height(40);    // line-height: 2.857rem (40px)
}
```

---

### 4. `@mixin media-breakpoint-up()`

반응형 디자인용 미디어 쿼리

**Syntax**: `@mixin media-breakpoint-up($name)`

```scss
.responsive-element {
    width: 100%;

    @include media-breakpoint-up(md) {
        width: 50%;  // 태블릿 이상
    }

    @include media-breakpoint-up(lg) {
        width: 33.333%;  // 데스크탑 이상
    }
}
```

**Breakpoint 이름**: xs, sm, md, lg, xl (Bootstrap 기준)

---

### 5. `@mixin clearfix`

float 해제 (구형 레이아웃)

```scss
.float-container {
    @include clearfix;
    // &::after { clear: both; content: ""; display: block; }
}
```

---

### 6. `@mixin placeholder-color()`

Input placeholder 색상 변경

```scss
.custom-input {
    @include placeholder-color($color-muted);
    // 모든 브라우저 대응 (-webkit-, -moz-, -ms-)
}
```

---

### 7. `@mixin cal-color()` (캘린더 전용)

캘린더 이벤트 색상 커스터마이징

**Syntax**: `@mixin cal-color($bgcolor, $fcolor)`

```scss
.calendar-event-urgent {
    @include cal-color(#ffe5e5, #d2322d);
    // background-color, color, border-left 일괄 설정
}

.calendar-event-done {
    @include cal-color(#e5f7e5, #47a447);
}
```

---

## 🧮 Functions

### 1. `rem()` - px → rem 변환

**Syntax**: `rem($px, $base: 14px)`

```scss
.element {
    padding: rem(20px);        // 1.429rem
    margin: rem(16px, 16px);   // 1rem (기준 변경)
}
```

---

### 2. `rem-calc()` - px → rem 계산

**Syntax**: `rem-calc($pixel)` (기준: $root-font-size = 14px)

```scss
.box {
    width: rem-calc(280);   // 20rem (280px / 14px)
    height: rem-calc(140);  // 10rem (140px / 14px)
}
```

---

### 3. `str-replace()` - 문자열 치환

**Syntax**: `str-replace($string, $search, $replace: '')`

```scss
$class-name: str-replace("btn-primary", "primary", "custom");
// "btn-custom"
```

---

## 📦 SCSS 파일 구조

```
css/sass/
├── theme.scss                    # 메인 엔트리 파일
│
├── config/                       # 설정 파일 (변수, 믹스인, 함수)
│   ├── _variables.scss           # ⭐ 모든 SCSS 변수 정의
│   ├── _mixins.scss              # ⭐ 재사용 가능한 믹스인
│   ├── _functions.scss           # ⭐ 유틸리티 함수
│   ├── _helpers.scss             # rem 변환 등 헬퍼
│   └── _directional.scss         # 방향성 설정
│
├── base/                         # 기본 레이아웃
│   ├── _skeleton.scss            # 기본 구조
│   ├── _layout-base.scss
│   ├── _sidebar-left.scss
│   ├── _header.scss
│   └── _menu.scss
│
├── gui/                          # UI 컴포넌트 (60+ 파일)
│   ├── _buttons.scss
│   ├── _cards.scss
│   ├── _forms.scss
│   ├── _tables.scss
│   ├── _modals.scss
│   ├── _alerts.scss
│   └── ... (60+ 컴포넌트)
│
├── themes/
│   └── _default.scss             # 기본 테마
│
├── layouts/
│   └── _dark.scss                # 다크 모드
│
└── custom.scss                   # ⭐ 커스텀 스타일 (프로젝트별)
```

---

## ✏️ 스타일 작업 가이드

### 새로운 컴포넌트 스타일 추가

```scss
// custom.scss에 작성 권장

.my-dashboard-card {
    // 색상 변수 사용
    background-color: $theme-color-bg;
    border: $border-thin solid $color-primary;

    // 간격 변수 사용
    padding: $spacement-md;
    margin-bottom: $spacement-lg;

    // 믹스인 사용
    @include flex(space-between, center);

    .card-title {
        @include font-size(16);
        font-weight: $font-weight-bold;
        color: $color-primary;
    }

    .card-content {
        @include font-size($body-font-size);
        @include line-height($body-line-height);
        color: $color-font-default;
    }

    // 반응형
    @include media-breakpoint-up(md) {
        padding: $spacement-lg;
    }
}
```

### 기존 스타일 수정

1. **변수 수정**: `config/_variables.scss` 편집
2. **믹스인 추가**: `config/_mixins.scss` 편집
3. **커스텀 스타일**: `custom.scss` 사용
4. **컴파일**: SCSS → CSS 자동 변환 (빌드 시)

---

## 🚀 Best Practices

### ✅ 권장 사항

1. **변수 사용 우선**:
   ```scss
   /* ✅ Good */
   color: $color-primary;
   padding: $spacement-md;

   /* ❌ Bad */
   color: #007bff;
   padding: 15px;
   ```

2. **믹스인 활용**:
   ```scss
   /* ✅ Good */
   @include flex(center, center);
   @include font-size(16);

   /* ❌ Bad */
   display: flex;
   justify-content: center;
   align-items: center;
   font-size: 1.143rem;
   ```

3. **rem 단위 사용**:
   ```scss
   /* ✅ Good */
   @include font-size(14);     // 자동 rem 변환
   width: rem-calc(280);

   /* ❌ Bad */
   font-size: 14px;            // px 하드코딩
   width: 280px;
   ```

4. **커스텀 스타일 분리**:
   - 프로젝트별 스타일은 `custom.scss`에 작성
   - 공통 변수/믹스인은 `config/` 폴더 사용

### ⚠️ 주의 사항

- **직접 수정 금지**: `gui/`, `base/` 폴더의 파일은 수정하지 않음
- **빌드 필요**: SCSS 수정 후 반드시 빌드 (Maven)
- **브라우저 호환성**: 믹스인이 자동으로 vendor prefix 추가

---

## 📚 빠른 참조표

### 색상 팔레트

| 색상 | 변수 | Hex | 용도 |
|------|------|-----|------|
| 🔵 Primary | `$color-primary` | #007bff | 주요 액션 |
| 🟢 Success | `$color-success` | #47a447 | 성공 메시지 |
| 🟠 Warning | `$color-warning` | #FF9F43 | 경고 |
| 🔴 Danger | `$color-danger` | #d2322d | 에러 |
| 🔵 Info | `$color-info` | #44b5bc | 정보 |
| ⚪ Secondary | `$color-secondary` | #a5a5a5 | 보조 |

### 간격 스케일

| 변수 | 값 | 용도 |
|------|-----|------|
| `$spacement-xs` | 5px | 아주 작은 간격 |
| `$spacement-sm` | 10px | 작은 간격 |
| `$spacement-md` | 15px | 중간 간격 (기본) |
| `$spacement-lg` | 20px | 큰 간격 |
| `$spacement-xl` | 25px | 매우 큰 간격 |
| `$spacement-xlg` | 30px | 초대형 간격 |

### 폰트 굵기

| 변수 | 값 | 용도 |
|------|-----|------|
| `$font-weight-light` | 300 | 얇은 텍스트 |
| `$font-weight-normal` | 500 | 일반 텍스트 |
| `$font-weight-bold` | 600 | 굵은 텍스트 |
| `$font-weight-black` | 700 | 매우 굵은 텍스트 |

---

## 🔗 관련 문서

- **Frontend 리소스**: [RESOURCES.md](./RESOURCES.md)
- **프로젝트 구조**: [CLAUDE.md](../CLAUDE.md)
- **KiiPS-UI CLAUDE.md**: [KiiPS-UI/CLAUDE.md](../KiiPS-UI/CLAUDE.md)

---

## 💡 Insight

**이 가이드의 목적**:
1. 매번 `theme.scss`를 읽지 않고 빠르게 참조
2. 토큰 사용량 최소화 (137줄 theme.scss 대신 이 요약본 참조)
3. 일관된 스타일링 규칙 적용
4. 변수/믹스인 재사용으로 유지보수성 향상

**사용 방법**:
- 스타일 작업 전: "Quick Reference" 섹션 확인
- 변수 찾기: Ctrl+F로 검색 (예: "primary", "spacing", "flex")
- 새 컴포넌트: "스타일 작업 가이드" 섹션 참고

---

**Version**: 1.0
**Maintained By**: KiiPS Development Team
**Source**: `/KiiPS-UI/src/main/resources/static/css/sass/`
