---
name: ui-workflow-orchestration
description: UI/UX 개발 워크플로우 및 검증 파이프라인 조정
type: orchestration
manager: ui-manager
relatedSkills:
  - kiips-ui-component-builder
  - kiips-realgrid-builder
  - kiips-responsive-validator
  - kiips-a11y-checker
  - kiips-scss-theme-manager
priority: high
---

# UI Workflow Orchestration Skill

## Purpose

UI/UX 개발의 전체 워크플로우를 조정하고, 5단계 검증 파이프라인 (구현 → 반응형 → 접근성 → 크로스브라우저 → 성능)을 강제합니다. ui-manager가 JSP 컴포넌트 생성, RealGrid 설정, SCSS 테마, 반응형/접근성 검증을 오케스트레이션할 때 사용합니다.

## Core Orchestration Patterns

### Pattern 1: 5-Stage Validation Pipeline

**목적**: Production-ready UI 보장을 위한 단계별 검증

```
Stage 1: UI Component Implementation
    ↓ (JSP, RealGrid, ApexCharts, Bootstrap)
Stage 2: Responsive Validation
    ↓ (Bootstrap breakpoints: xs/sm/md/lg/xl)
Stage 3: Accessibility Validation
    ↓ (WCAG 2.1 AA: 색상 대비, ARIA, 키보드 네비게이션)
Stage 4: Cross-Browser Testing
    ↓ (Chrome, Edge, Safari)
Stage 5: Performance Optimization
    ↓ (RealGrid 렌더링, 이미지 최적화, CSS 번들 크기)
```

**Manager의 역할**:
- 각 Stage 순차 실행 (이전 Stage PASS 후 다음 진행)
- 실패 시 개발 단계로 피드백
- 최종 검증 완료 후 Primary에게 보고

### Pattern 2: Template-Based Component Generation

**목적**: 일관된 UI 패턴 유지 및 개발 속도 향상

**템플릿 카탈로그**:
```
1. RealGrid List Page (목록 조회)
   - 검색 폼 + RealGrid + 페이지네이션
   - 예: 펀드 목록, 투자 목록, LP 목록

2. Dashboard Layout (대시보드)
   - ApexCharts 차트 + 카드 위젯
   - 예: 투자 현황, 성과 대시보드

3. Form Modal (입력 폼)
   - Bootstrap Modal + 검증 로직
   - 예: 펀드 등록, 투자 수정

4. Tab Navigation (탭 레이아웃)
   - Bootstrap Tabs + 동적 컨텐츠
   - 예: 상세 정보 탭 (기본정보/투자내역/첨부파일)
```

**Manager의 조정**:
- 사용자 요청 분석하여 적합한 템플릿 선택
- 템플릿 커스터마이징 지시
- RealGrid 또는 ApexCharts 전문 설정 필요 시 별도 스킬 활성화

### Pattern 3: RealGrid Expert Configuration

**목적**: RealGrid 2.8.8의 복잡한 설정을 표준화하고 성능 최적화

**Manager가 감독하는 RealGrid 설정 영역**:
```
1. GridView + DataProvider 초기화
2. 컬럼 정의 (dataType, editor, format)
3. 셀 에디터 (DropDown, Date, Number, TextArea)
4. 필터/정렬/그룹핑
5. Excel export/import
6. 성능 최적화 (가상 스크롤, lazy loading)
```

**kiips-realgrid-builder 스킬 활성화 조건**:
- 10개 이상 컬럼 정의
- 복잡한 셀 에디터 (DropDown + 동적 options)
- Excel export 커스터마이징
- 대용량 데이터 (10,000+ rows) 처리

### Pattern 4: Accessibility Enforcement (WCAG 2.1 AA)

**목적**: 웹 접근성 법적 준수 및 모든 사용자 접근성 보장

**Manager가 강제하는 WCAG 2.1 AA 기준**:
```
1. Color Contrast (색상 대비)
   - 일반 텍스트: ≥ 4.5:1
   - 큰 텍스트 (18pt+): ≥ 3:1

2. Touch Target (터치 타겟)
   - 최소 크기: 44px × 44px

3. Keyboard Navigation (키보드 네비게이션)
   - Tab 순서 논리적
   - 포커스 표시 명확

4. ARIA Attributes (스크린 리더)
   - aria-label, aria-labelledby
   - role (button, dialog, navigation)
   - alt 텍스트 (이미지)
```

**자동 수정 vs 경고**:
- **자동 수정**: 누락된 alt 텍스트, aria-label 추가
- **경고**: 색상 대비 미달 (디자이너 확인 필요)

## Worker Assignment Strategy

### UI Component Implementation

```
User: "펀드 목록 조회 페이지 만들어줘"

ui-manager:
  1. 템플릿 선택: RealGrid List Page
  2. Worker 할당:
     - kiips-ui-designer: JSP + RealGrid 구현
     - kiips-realgrid-builder: 전문 그리드 설정 (10+ 컬럼)
```

### Validation Pipeline Coordination

```
Stage 1 완료 후:
  ├─ Worker-1 (kiips-responsive-validator): 반응형 검증
  ├─ Worker-2 (kiips-a11y-checker): 접근성 검증 (병렬)
  └─ Manager: 결과 집계 → PASS/FAIL 판단
```

## Quality Checkpoints

### Stage 1: UI Component Implementation

**검증 항목**:
- ✓ JSP 파일 생성 (`.jsp`)
- ✓ JavaScript 파일 생성 (`.js`)
- ✓ SCSS 파일 생성 (`.scss`)
- ✓ RealGrid 또는 ApexCharts 초기화 코드
- ✓ Bootstrap 클래스 적용 (`container`, `row`, `col-*`)
- ✓ Lucy XSS Filter 적용 (보안)

**통과 조건**: 파일 생성 + 기본 렌더링 성공

### Stage 2: Responsive Validation

**검증 항목**:
- ✓ Bootstrap Breakpoints 모두 지원
  - xs (< 576px): Mobile portrait
  - sm (≥ 576px): Mobile landscape
  - md (≥ 768px): Tablet
  - lg (≥ 992px): Desktop
  - xl (≥ 1200px): Large desktop
- ✓ 터치 타겟 크기 ≥ 44px × 44px
- ✓ 이미지 반응형 (`img-fluid` 또는 `object-fit`)
- ✓ RealGrid 모바일 호환 (터치 스크롤, 가로 스크롤)

**통과 조건**: 모든 breakpoint에서 레이아웃 정상 + 터치 타겟 기준 충족

### Stage 3: Accessibility Validation

**검증 항목**:
- ✓ 색상 대비 ≥ 4.5:1 (일반 텍스트)
- ✓ ARIA 속성 존재
  - `aria-label` (버튼, 아이콘)
  - `aria-labelledby` (폼 필드)
  - `role` (dialog, navigation)
- ✓ Alt 텍스트 존재 (이미지)
- ✓ 키보드 네비게이션 작동 (Tab, Enter, Esc)
- ✓ 포커스 표시 명확 (`outline` 또는 커스텀 스타일)

**통과 조건**: WCAG 2.1 AA 모든 항목 PASS

### Stage 4: Cross-Browser Testing

**검증 항목**:
- ✓ Chrome (최신 버전)
- ✓ Edge (최신 버전)
- ✓ Safari (Mac/iOS)
- ✓ RealGrid 호환성 (IE11 제외)
- ✓ Bootstrap CSS 호환성

**통과 조건**: 3개 브라우저 모두 정상 렌더링

### Stage 5: Performance Optimization

**검증 항목**:
- ✓ RealGrid 렌더링 시간 < 1초 (10,000 rows)
- ✓ 이미지 최적화 (WebP 또는 압축)
- ✓ CSS 번들 크기 < 200KB
- ✓ JavaScript 번들 크기 < 500KB
- ✓ 초기 로딩 시간 < 3초

**통과 조건**: 성능 기준 모두 충족

## Escalation Triggers

Manager가 Primary에게 에스컬레이션하는 조건:

1. **Design System Conflict**
   - 새 UI 패턴이 기존 디자인 시스템과 충돌
   - 디자인 토큰 변경 필요 (색상, 타이포그래피)

2. **WCAG Compliance Failure (Critical)**
   - 색상 대비 자동 수정 불가능 (디자이너 확인 필요)
   - 복잡한 위젯의 키보드 네비게이션 구현 어려움

3. **RealGrid Licensing Issue**
   - 라이선스 제한 도달 (동시 사용자 수)
   - 버전 업그레이드 필요

4. **Performance Bottleneck**
   - RealGrid 렌더링 최적화로도 기준 미달 (데이터 구조 재설계 필요)

## Example Workflows

### Workflow 1: RealGrid List Page 생성 (펀드 목록)

```
User: "펀드 목록 조회 페이지를 만들어줘. RealGrid로 표시하고 엑셀 다운로드 기능 추가해줘."

ui-manager:
  ★ Stage 1: UI Component Implementation
    1. 템플릿 선택: RealGrid List Page
    2. Worker 할당:
       - kiips-ui-designer: 기본 JSP 레이아웃 생성
       - kiips-realgrid-builder: 전문 그리드 설정

    3. 생성 파일:
       - fund-list.jsp (검색 폼 + Grid 컨테이너)
       - fund-list.js (GridView 초기화, Excel export)
       - fund-list.scss (커스텀 스타일)

    4. RealGrid 설정:
       - 10개 컬럼 (펀드명, 펀드코드, 설정일, 만기일, ...)
       - 셀 에디터 (Date picker, Dropdown)
       - Excel export (전체 데이터 다운로드)

    5. 검증: ✓ JSP 렌더링 성공, RealGrid 표시됨

  ★ Stage 2: Responsive Validation (kiips-responsive-validator)
    - Bootstrap breakpoints: xs/sm/md/lg/xl 모두 테스트
    - 모바일: RealGrid 가로 스크롤 정상
    - 터치 타겟: 버튼 48px × 48px ✓
    - 결과: PASS

  ★ Stage 3: Accessibility Validation (kiips-a11y-checker)
    - 색상 대비: 5.2:1 (기준 4.5:1 충족) ✓
    - ARIA: aria-label="펀드 목록" 추가 ✓
    - Alt 텍스트: 검색 아이콘에 alt 추가 ✓
    - 키보드: Tab 순서 논리적 ✓
    - 결과: PASS

  ★ Stage 4: Cross-Browser Testing
    - Chrome: 정상 ✓
    - Edge: 정상 ✓
    - Safari: 정상 ✓
    - 결과: PASS

  ★ Stage 5: Performance Optimization
    - RealGrid 렌더링: 0.8초 (10,000 rows) ✓
    - CSS 번들: 180KB ✓
    - JS 번들: 420KB ✓
    - 초기 로딩: 2.3초 ✓
    - 결과: PASS

  최종 결과: Production-ready ✓
  Primary 보고: "펀드 목록 페이지 완료 (5단계 검증 모두 통과)"
```

### Workflow 2: 접근성 검증 실패 (색상 대비 미달)

```
ui-manager:
  Stage 3: Accessibility Validation 진입

  kiips-a11y-checker 검증:
    ✓ ARIA 속성
    ✓ Alt 텍스트
    ✗ 색상 대비: 3.8:1 (기준 4.5:1 미달)
      - 배경: #F0F0F0
      - 텍스트: #999999
      - 대비: 3.8:1 (미달)

  Manager 판단:
    - 자동 수정 불가능 (디자인 변경 필요)
    - Primary에게 에스컬레이션

  Primary 액션:
    - 디자이너와 협의
    - 텍스트 색상 변경: #999999 → #666666
    - 대비: 5.2:1 (충족) ✓

  Manager 재검증:
    - Stage 3 재실행 → PASS
    - Stage 4, 5 계속 진행
```

### Workflow 3: Dashboard 생성 (ApexCharts)

```
User: "투자 현황 대시보드를 만들어줘. 차트로 시각화해줘."

ui-manager:
  ★ Stage 1: UI Component Implementation
    1. 템플릿 선택: Dashboard Layout
    2. Worker 할당: kiips-ui-designer

    3. 생성 파일:
       - dashboard.jsp (Grid 레이아웃 + 차트 컨테이너)
       - dashboard.js (ApexCharts 초기화)
       - dashboard.scss (카드 스타일)

    4. ApexCharts 설정:
       - Donut Chart (펀드 타입별 투자 비율)
       - Line Chart (월별 투자 추이)
       - Bar Chart (Top 10 펀드)

    5. 검증: ✓ 차트 렌더링 성공

  ★ Stage 2: Responsive Validation
    - 모바일: 차트 세로 배치 ✓
    - 태블릿: 차트 2열 그리드 ✓
    - 데스크톱: 차트 3열 그리드 ✓
    - 결과: PASS

  ★ Stage 3: Accessibility Validation
    - 차트 대체 텍스트 추가 (aria-label) ✓
    - 색상 대비 (차트 범례) ✓
    - 결과: PASS

  ★ Stage 4-5: 생략 (간단한 대시보드)

  최종 결과: Production-ready ✓
```

## RealGrid Expert Patterns

### Pattern 1: Dynamic Dropdown Editor

**목적**: 셀 에디터의 옵션을 동적으로 로드

```javascript
// Manager 감독: kiips-realgrid-builder 스킬 활성화
gridView.setColumnProperty('fundType', 'editor', {
  type: 'dropdown',
  domainOnly: true,
  values: [], // 동적 로드
  labels: []
});

// AJAX로 옵션 로드
$.ajax({
  url: '/api/codes/fund-types',
  success: function(data) {
    const values = data.map(d => d.code);
    const labels = data.map(d => d.name);
    gridView.setColumnProperty('fundType', 'editor', {
      type: 'dropdown',
      values: values,
      labels: labels
    });
  }
});
```

### Pattern 2: Excel Export Customization

**목적**: Excel 파일명, 시트명, 헤더 커스터마이징

```javascript
// Manager 감독: Excel export 전략 검토
gridView.exportGrid({
  type: 'excel',
  target: 'local',
  fileName: '펀드목록_' + new Date().toISOString().slice(0, 10) + '.xlsx',
  sheetName: '펀드목록',
  exportGridColumnsOnly: true, // 표시된 컬럼만
  lookupDisplay: true, // Dropdown label 표시
  datetimeFormat: 'yyyy-MM-dd', // 날짜 포맷
  done: function() {
    alert('엑셀 다운로드 완료');
  }
});
```

### Pattern 3: Virtual Scrolling (대용량 데이터)

**목적**: 10,000+ rows 성능 최적화

```javascript
// Manager 감독: 성능 최적화 권장사항
dataProvider.setOptions({
  restoreMode: 'auto', // 자동 복원
  softDeleting: true // soft delete
});

gridView.setOptions({
  display: {
    rowHeight: 30,
    fitStyle: 'even' // 균등 분배
  },
  checkBar: {
    visible: true,
    syncHeadCheck: true // 헤더 체크박스 동기화
  },
  stateBar: {
    visible: true // 상태 표시
  }
});

// Virtual scrolling (기본 활성화)
// RealGrid가 자동으로 보이는 영역만 렌더링
```

## Related Skills

- **kiips-ui-component-builder**: Manager가 이 스킬을 활용하여 JSP 컴포넌트 생성
- **kiips-realgrid-builder**: RealGrid 전문 설정 (10+ 컬럼, Excel, 성능 최적화)
- **kiips-responsive-validator**: Stage 2 반응형 검증
- **kiips-a11y-checker**: Stage 3 접근성 검증
- **kiips-scss-theme-manager**: SCSS 테마 및 디자인 토큰 관리

## Best Practices

1. **5단계 검증 파이프라인 필수**: Production 배포 전 모든 Stage 통과
2. **템플릿 우선 사용**: 일관된 UI 패턴 유지 및 개발 속도 향상
3. **RealGrid 전문가 개입**: 복잡한 그리드 설정 시 kiips-realgrid-builder 활성화
4. **WCAG 2.1 AA 강제**: 모든 UI는 접근성 기준 충족 필수
5. **성능 모니터링**: RealGrid 렌더링 시간, 번들 크기 지속 추적

---

**Manager**: ui-manager
**Managed Skills**: kiips-ui-component-builder, kiips-realgrid-builder, kiips-responsive-validator, kiips-a11y-checker, kiips-scss-theme-manager
**Delegates To**: kiips-ui-designer, kiips-developer, checklist-generator
**Key Value**: Production-ready UI with automated validation pipelines
