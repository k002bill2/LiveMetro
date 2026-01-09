---
name: kiips-detail-page-planner
description: KiiPS 모듈 상세페이지 개발 계획서 자동 생성. 상세페이지 생성 요청 시 Plan 문서를 자동으로 생성하고 Phase별 진행을 추적합니다.
---

# KiiPS Detail Page Planner Skill

## Purpose
KiiPS 모듈 내 상세페이지(예: IL0501.jsp, FD0301.jsp) 개발 시 체계적인 개발 계획서를 자동 생성하고 Phase별 진행을 추적합니다.

## When to Use

### 자동 트리거 조건
- **키워드**: "상세페이지", "detail page", "상세화면", "투자기업상세", "펀드상세"
- **파일 패턴**: `**/jsp/kiips/**/*0[0-9]0[0-9].jsp` (예: IL0501.jsp, FD0301.jsp)
- **Intent 패턴**:
  - "(생성|create|만들).*?(상세|detail).*?(페이지|page|화면)"
  - "(new|새).*?(detail|상세).*?(screen|화면|page)"

### 사용 예시
```
사용자: "IL0502 투자기업 상세페이지 만들어줘"
사용자: "FD0301 펀드 상세화면 생성해줘"
사용자: "새로운 상세페이지 개발할게"
```

## Plan Generation Workflow

### Step 1: 요구사항 분석
```bash
# 확인할 정보
- 모듈: IL, FD, PG, AC 등
- 화면 ID: XX0X0X 형식
- 표시할 데이터 항목
- API 엔드포인트
- 참조할 기존 상세페이지
```

### Step 2: Plan 문서 생성
```bash
# Plan 파일 위치
docs/plans/PLAN_[MODULE][SCREEN_ID]-detail-page.md

# 예시
docs/plans/PLAN_IL0502-detail-page.md
docs/plans/PLAN_FD0301-detail-page.md
```

### Step 3: Phase별 구현
| Phase | 내용 | 예상 시간 |
|-------|------|----------|
| Phase 1 | 레이아웃 설계 (HTML 구조) | 30분 |
| Phase 2 | 컴포넌트 구현 (CSS, JS) | 1시간 |
| Phase 3 | API 연동 (AJAX) | 1시간 |
| Phase 4 | 반응형 + 접근성 검증 | 30분 |

**총 예상 시간**: 2-4시간

## Plan Template Structure

### 헤더 정보
```markdown
# Detail Page Plan: IL0502 - 투자기업 상세

**Status**: 🔄 진행 중
**Module**: KiiPS-IL
**Page ID**: IL0502
**Estimated Time**: 3시간
```

### Phase 구성
각 Phase는 다음을 포함:
- **Tasks**: 구체적인 작업 항목 (체크박스)
- **Quality Gate**: Phase 완료 전 검증 항목
- **Files**: 생성/수정할 파일 목록

### Quality Gate 기준
- [ ] 브라우저 렌더링 확인
- [ ] 반응형 레이아웃 테스트 (768px, 480px)
- [ ] API 연동 테스트
- [ ] 콘솔 에러 없음

## CSS Design System

### CSS Variables (`:root`)
```css
--cd-primary: #155dfc;
--cd-text-primary: #101828;
--cd-text-secondary: #909090;
--cd-bg-card: #ffffff;
--cd-border: rgba(0,0,0,0.1);
--cd-radius: 14px;
```

### 핵심 클래스
| 클래스 | 용도 |
|--------|------|
| `.cd-container` | 페이지 컨테이너 (max-width: 1400px) |
| `.cd-header` | 상단 헤더 영역 |
| `.cd-grid` | 2컬럼 그리드 (메인 + 사이드바) |
| `.cd-card` | 정보 카드 컴포넌트 |
| `.cd-info-list` | 라벨-값 목록 |

## Related Skills Integration

### 자동 연계 Skills
1. **kiips-ui-component-builder**
   - Phase 2에서 컴포넌트 생성 시 호출
   - RealGrid, ApexCharts 템플릿 제공

2. **kiips-responsive-validator**
   - Phase 4에서 자동 호출
   - Bootstrap breakpoints 검증

3. **kiips-a11y-checker**
   - Phase 4에서 자동 호출
   - WCAG 2.1 AA 검증

### 연계 흐름
```
상세페이지 요청
    ↓
kiips-detail-page-planner (Plan 생성)
    ↓
Phase 1-2: kiips-ui-component-builder
    ↓
Phase 3: API 연동 (직접 구현)
    ↓
Phase 4: kiips-responsive-validator + kiips-a11y-checker
    ↓
완료 검증
```

## File Structure

### 생성되는 파일
```
KiiPS-UI/
├── src/main/webapp/WEB-INF/jsp/kiips/
│   └── [MODULE]/
│       └── [SCREEN_ID].jsp    # 상세페이지 JSP
│
docs/plans/
└── PLAN_[MODULE][SCREEN_ID]-detail-page.md  # 개발 계획서
```

## Examples

### Example 1: 투자기업 상세페이지
```
입력: "IL0502 투자기업 상세페이지 만들어줘"

생성되는 파일:
1. docs/plans/PLAN_IL0502-detail-page.md
2. KiiPS-UI/.../jsp/kiips/IL/IL0502.jsp

Plan 내용:
- Phase 1: 헤더 + 기본정보 카드 레이아웃
- Phase 2: 투자 이력 그리드 (RealGrid)
- Phase 3: /ILAPI/COMPANY/DETAIL API 연동
- Phase 4: 반응형 + 접근성 검증
```

### Example 2: 펀드 상세페이지
```
입력: "FD0301 펀드 상세화면 생성해줘"

생성되는 파일:
1. docs/plans/PLAN_FD0301-detail-page.md
2. KiiPS-UI/.../jsp/kiips/FD/FD0301.jsp

Plan 내용:
- Phase 1: 펀드 정보 카드 레이아웃
- Phase 2: 투자현황 차트 (ApexCharts)
- Phase 3: /FDAPI/FUND/DETAIL API 연동
- Phase 4: 반응형 + 접근성 검증
```

## Troubleshooting

### Plan이 생성되지 않을 때
1. 키워드 확인: "상세페이지", "상세화면", "detail page"
2. 화면 ID 형식 확인: XX0X0X (예: IL0501)
3. 모듈명 확인: IL, FD, PG, AC 등

### Phase 진행이 막힐 때
1. Quality Gate 항목 하나씩 확인
2. 브라우저 개발자 도구로 에러 확인
3. API 응답 데이터 구조 확인

### 반응형이 동작하지 않을 때
1. `@media` 쿼리 브레이크포인트 확인
2. `flex-wrap`, `grid-template-columns` 확인
3. `white-space: nowrap` 적용 여부 확인

## Supporting Files
- [plan-template-detail-page.md](plan-template-detail-page.md) - Plan 템플릿

## Related Skills
- **kiips-feature-planner** - 대규모 기능 개발 계획 (12+ 시간)
- **kiips-ui-component-builder** - JSP 컴포넌트 템플릿 생성
- **kiips-responsive-validator** - 반응형 디자인 검증
- **kiips-a11y-checker** - 웹 접근성 검증
- **checklist-generator** - 체크리스트 생성
