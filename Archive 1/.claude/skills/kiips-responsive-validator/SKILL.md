---
name: KiiPS Responsive Validator
description: 반응형 디자인 자동 검증 및 테스트 (Bootstrap breakpoints, 터치 타겟)
version: 1.0.0
priority: high
enforcement: require
category: ui-validation
tags:
  - responsive
  - mobile
  - bootstrap
  - breakpoint
  - validation
author: KiiPS Development Team
lastUpdated: 2026-01-04
---

# KiiPS Responsive Validator

반응형 레이아웃 자동 검증 Skill입니다. Bootstrap breakpoints, 레이아웃 오버플로우, 모바일 터치 타겟, 폰트 가독성을 자동으로 검증합니다.

## 📋 Purpose

### What This Skill Does
- **Bootstrap Breakpoints 검증**: xs, sm, md, lg, xl 모든 크기 테스트
- **레이아웃 오버플로우 감지**: 가로 스크롤, 넘침 요소 탐지
- **터치 타겟 검증**: 최소 44x44px 확인 (iOS/Android 권장)
- **폰트 가독성**: 최소 14px (모바일), 16px (데스크톱)
- **이미지 반응형**: `img-fluid`, `srcset` 검증

## 🎯 When to Use

### Keywords
```
"반응형 테스트", "모바일 확인", "브레이크포인트", "반응형 검증",
"모바일 레이아웃", "터치 타겟"
```

### File Patterns
```
수정 후: **/*.jsp, **/*.scss, **/*.css
```

## 🚀 Bootstrap Breakpoints

```scss
// KiiPS 표준 Breakpoints
$grid-breakpoints: (
  xs: 0,      // < 576px (모바일)
  sm: 576px,  // ≥ 576px (태블릿 세로)
  md: 768px,  // ≥ 768px (태블릿 가로)
  lg: 992px,  // ≥ 992px (데스크톱)
  xl: 1200px  // ≥ 1200px (큰 데스크톱)
);
```

### Validation Checklist

#### ✅ Layout Tests
- [ ] XS (< 576px): 단일 컬럼, 수직 스택
- [ ] SM (576-767px): 2컬럼 또는 수직 스택
- [ ] MD (768-991px): 2-3컬럼 grid
- [ ] LG (992-1199px): 3-4컬럼 grid
- [ ] XL (≥ 1200px): 4+ 컬럼 grid

#### ✅ Overflow Tests
- [ ] 가로 스크롤 없음 (body overflow-x: hidden)
- [ ] 고정 width 요소 없음 (max-width 사용)
- [ ] Table 반응형 처리 (.table-responsive)

#### ✅ Touch Target Tests
- [ ] 버튼 최소 44x44px
- [ ] 링크 최소 44x44px (클릭 영역)
- [ ] 폼 입력 최소 44px 높이
- [ ] 간격 최소 8px (인접 요소)

#### ✅ Typography Tests
- [ ] 본문 폰트: ≥ 14px (모바일), ≥ 16px (데스크톱)
- [ ] 제목 폰트: 상대 크기 사용 (rem, em)
- [ ] 행간: 1.5 이상

#### ✅ Image Tests
- [ ] `img-fluid` 클래스 (max-width: 100%)
- [ ] `srcset` for Retina displays
- [ ] Lazy loading (`loading="lazy"`)

---

## 📱 Responsive Patterns

### Pattern 1: Mobile-First Grid

```html
<div class="container">
    <div class="row">
        <!-- Mobile: 12 cols, Tablet: 6 cols, Desktop: 4 cols -->
        <div class="col-12 col-md-6 col-lg-4">
            <div class="card">...</div>
        </div>
        <div class="col-12 col-md-6 col-lg-4">
            <div class="card">...</div>
        </div>
        <div class="col-12 col-md-6 col-lg-4">
            <div class="card">...</div>
        </div>
    </div>
</div>
```

### Pattern 2: Responsive Table

```html
<div class="table-responsive">
    <table class="table">
        <!-- Mobile: horizontal scroll -->
        <!-- Tablet+: normal display -->
    </table>
</div>
```

### Pattern 3: Hide/Show by Breakpoint

```html
<!-- 모바일에서만 표시 -->
<div class="d-block d-md-none">Mobile Menu</div>

<!-- 태블릿 이상에서만 표시 -->
<div class="d-none d-md-block">Desktop Menu</div>
```

### Pattern 4: Responsive Image

```html
<img src="image.jpg"
     srcset="image@2x.jpg 2x, image@3x.jpg 3x"
     class="img-fluid"
     loading="lazy"
     alt="설명">
```

---

## 🧪 Testing Commands

### Manual Test (Chrome DevTools)
```
1. F12 → Device Toolbar (Ctrl+Shift+M)
2. Devices:
   - iPhone SE (375px)
   - iPad (768px)
   - Desktop (1920px)
3. Rotate (Landscape/Portrait)
4. Network: Fast 3G (모바일 시뮬레이션)
```

### Automated Test (Playwright)
```javascript
const { test, expect } = require('@playwright/test');

test.describe('Responsive Design', () => {
    test('Mobile viewport', async ({ page }) => {
        await page.setViewportSize({ width: 375, height: 667 });
        await page.goto('/fund/fund-list.jsp');

        // 가로 스크롤 없음
        const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
        expect(bodyWidth).toBeLessThanOrEqual(375);

        // 버튼 크기 검증
        const button = await page.locator('button.btn-primary');
        const box = await button.boundingBox();
        expect(box.height).toBeGreaterThanOrEqual(44);
    });

    test('Tablet viewport', async ({ page }) => {
        await page.setViewportSize({ width: 768, height: 1024 });
        await page.goto('/fund/fund-list.jsp');

        // Grid 2컬럼 확인
        const columns = await page.locator('.col-md-6').count();
        expect(columns).toBeGreaterThan(0);
    });

    test('Desktop viewport', async ({ page }) => {
        await page.setViewportSize({ width: 1920, height: 1080 });
        await page.goto('/fund/fund-list.jsp');

        // Grid 4컬럼 확인
        const columns = await page.locator('.col-lg-3').count();
        expect(columns).toBeGreaterThan(0);
    });
});
```

---

## 🛠️ Auto-Fix Recommendations

### Issue 1: 고정 너비
```scss
// ❌ Don't
.sidebar {
    width: 300px;  // 모바일에서 넘침
}

// ✅ Do
.sidebar {
    width: 100%;
    max-width: 300px;

    @media (min-width: 768px) {
        width: 300px;
    }
}
```

### Issue 2: 작은 터치 타겟
```scss
// ❌ Don't
.icon-button {
    width: 32px;
    height: 32px;
}

// ✅ Do
.icon-button {
    min-width: 44px;
    min-height: 44px;
    padding: 6px;
}
```

### Issue 3: 작은 폰트
```scss
// ❌ Don't
body {
    font-size: 12px;  // 가독성 저하
}

// ✅ Do
body {
    font-size: 14px;  // 모바일

    @media (min-width: 768px) {
        font-size: 16px;  // 데스크톱
    }
}
```

---

## 📊 Success Metrics
- ✅ Breakpoint 통과율: 100%
- ✅ 터치 타겟 준수율: > 95%
- ✅ 오버플로우 발생률: 0%
- ✅ 모바일 가독성: > 90%

---

**Version**: 1.0.0
**Last Updated**: 2026-01-04
**Bootstrap Version**: 4.x
