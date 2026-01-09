---
name: KiiPS UI Component Builder
description: JSP 컴포넌트 템플릿 기반 생성 (RealGrid, ApexCharts, Bootstrap 폼)
version: 1.0.0
priority: high
enforcement: require
category: ui-development
tags:
  - ui
  - jsp
  - realgrid
  - apexcharts
  - bootstrap
  - component
author: KiiPS Development Team
lastUpdated: 2026-01-07
---

# KiiPS UI Component Builder

JSP 템플릿 기반의 UI 컴포넌트를 빠르게 생성하는 Skill입니다. RealGrid, ApexCharts, Bootstrap 폼 등 자주 사용하는 컴포넌트의 프리셋을 제공하여 개발 속도를 향상시킵니다.

## 📋 Purpose

### What This Skill Does
- **JSP 컴포넌트 생성**: JSTL/EL 기반 템플릿으로 재사용 가능한 컴포넌트 생성
- **RealGrid 프리셋**: 기본, 편집, 트리 그리드 템플릿 제공
- **ApexCharts 프리셋**: 선, 도넛, 바 차트 템플릿 제공
- **Bootstrap 폼**: 검색, 모달, 탭 레이아웃 템플릿 제공
- **XSS 방어**: Lucy XSS 필터 자동 적용
- **접근성**: ARIA 속성 자동 추가

### What This Skill Does NOT Do
- Java 백엔드 로직 작성
- 데이터베이스 쿼리 작성
- Maven 빌드 설정

## 🎯 When to Use

이 Skill은 다음 상황에서 자동 활성화됩니다:

### User Prompt Keywords
```
"UI 컴포넌트 생성", "JSP 페이지 만들기", "그리드 추가", "차트 추가",
"검색 폼", "모달 팝업", "탭 레이아웃", "펀드 목록 화면", "투자 대시보드"
```

### File Patterns
```
새 파일 생성: **/*.jsp, **/webapp/**/*.html
수정: **/*.jsp
```

### Intent Patterns
```regex
/생성|만들|추가|개발.*?(페이지|화면|컴포넌트|그리드|차트|폼|모달|탭)/
/UI.*?(만들|생성|추가|개발)/
```

## 🚀 Quick Reference

### 1. RealGrid 기본 그리드 (Read-Only)

**User Request**: "펀드 목록 조회 화면 만들어줘"

**Generated Files**:
- `fund-list.jsp` - JSP 템플릿
- Inline `<script>` - RealGrid 초기화 + logosAjax

**참조**: RealGrid 상세 설정은 [kiips-realgrid-generator](../kiips-realgrid-generator/SKILL.md) 참조

**Template**: KiiPS 표준 패턴 (`createMainGrid` + `logosAjax`)

```jsp
<%@ page language="java" contentType="text/html; charset=UTF-8" pageEncoding="UTF-8"%>
<%@ include file="../include/header.jsp"%>
<spring:eval expression="@environment.getProperty('KiiPS.FD.URL')" var="KiiPS_FD"/>

<!-- 검색 영역 -->
<div class="search-area card mb-3">
    <div class="card-body">
        <form id="searchForm" class="row g-3">
            <div class="col-md-3">
                <label for="fundName" class="form-label">펀드명</label>
                <input type="text" class="form-control" id="fundName" name="FUND_NM">
            </div>
            <div class="col-md-3">
                <label for="fundType" class="form-label">펀드유형</label>
                <select class="form-select" id="fundType" name="FUND_TYPE">
                    <option value="">전체</option>
                    <option value="EQUITY">주식형</option>
                    <option value="BOND">채권형</option>
                    <option value="MIXED">혼합형</option>
                </select>
            </div>
            <div class="col-12">
                <button type="button" class="btn btn-primary" onclick="searchFundList()">
                    <i class="bi bi-search"></i> 조회
                </button>
                <button type="button" class="btn btn-secondary" onclick="resetSearch()">
                    <i class="bi bi-arrow-clockwise"></i> 초기화
                </button>
            </div>
        </form>
    </div>
</div>

<!-- 그리드 영역 -->
<div class="grid-area card">
    <div class="card-header d-flex justify-content-between align-items-center">
        <h5 class="mb-0">펀드 목록</h5>
        <button type="button" class="btn btn-sm btn-success" onclick="exportToExcel()">
            <i class="bi bi-file-earmark-excel"></i> 엑셀 다운로드
        </button>
    </div>
    <div class="card-body">
        <div id="TB_FUND_LIST" style="width:100%; height:500px;"
             role="grid" aria-label="펀드 목록 그리드"></div>
    </div>
</div>

<script>
var gToken = "${gToken}";
var dataProvider, gridView;

$(document).ready(function() {
    initGrid();
    searchFundList();
});

function initGrid() {
    dataProvider = new RealGrid.LocalDataProvider(true);
    gridView = new RealGrid.GridView("TB_FUND_LIST");

    // 컬럼 정의 (KiiPS 표준 패턴)
    let columns = [
        {fieldName: "FUND_CD", width: "120", header: {text: "펀드코드"},
         editable: false, styleName: "center-column"},
        {fieldName: "FUND_NM", width: "250", header: {text: "펀드명"},
         editable: false, styleName: "left-column"},
        {fieldName: "FUND_TYPE", width: "100", header: {text: "펀드유형"},
         editable: false, styleName: "center-column"},
        {fieldName: "NAV_AMT", width: "120", header: {text: "NAV (원)"},
         editable: false, dataType: "number", numberFormat: "#,##0",
         styleName: "right-column"},
        {fieldName: "TOTAL_ASSET", width: "150", header: {text: "순자산 (백만원)"},
         editable: false, dataType: "number", numberFormat: "#,##0",
         styleName: "right-column"},
        {fieldName: "RETURN_RATE", width: "100", header: {text: "수익률 (%)"},
         editable: false, dataType: "number", numberFormat: "0.00",
         styleName: "right-column"},
        {fieldName: "REG_DT", width: "100", header: {text: "등록일"},
         editable: false,
         renderer: {
             type: "html",
             callback: function(grid, cell) {
                 return StringUtil.toDate(cell.value, "-");
             }
         }}
    ];

    // KiiPS 공통 초기화 함수 사용
    createMainGrid("TB_FUND_LIST", dataProvider, gridView, columns);

    // 행 선택 이벤트
    gridView.onCurrentRowChanged = function(grid, oldRow, newRow) {
        if (newRow >= 0) {
            const rowData = dataProvider.getJsonRow(newRow);
            console.log('Selected fund:', rowData);
        }
    };
}

function searchFundList() {
    var searchCond = {
        FUND_NM: $("#fundName").val(),
        FUND_TYPE: $("#fundType").val()
    };

    // KiiPS 표준 AJAX 패턴
    logosAjax.requestTokenGrid(gridView, gToken,
        "${KiiPS_FD}/FDAPI/FUND/LIST", "post", searchCond,
        function(data) {
            dataProvider.setRows(data.body.list);
            gridView.refresh();
        });
}

function resetSearch() {
    $('#searchForm')[0].reset();
    searchFundList();
}

function exportToExcel() {
    gridView.exportGrid({
        type: "excel",
        target: "local",
        fileName: "펀드목록_" + new Date().toISOString().split('T')[0] + ".xlsx",
        done: function() {
            console.log('Excel export completed');
        }
    });
}
</script>

<%@ include file="../include/footer.jsp"%>
```

---

### 2. RealGrid 편집 그리드 (Editable)

**User Request**: "투자 금액 입력 화면 만들어줘. 그리드에서 직접 수정 가능하게"

**참조**: [kiips-realgrid-generator](../kiips-realgrid-generator/SKILL.md) 참조

**Key Features**:
- 셀 편집 기능 (`editable: true`)
- 드롭다운 에디터
- 숫자 입력 검증
- 저장/취소 기능

```javascript
// 편집 가능 컬럼 설정 (KiiPS 패턴)
let columns = [
    {fieldName: "INV_AMT", width: "150", header: {text: "투자금액 (원)"},
     editable: true, dataType: "number", numberFormat: "#,##0",
     styleName: "right-column editable-column",
     editor: {
         type: "number",
         editFormat: "#,##0",
         min: 0,
         max: 9999999999
     }},
    {fieldName: "INV_TYPE", width: "120", header: {text: "투자유형"},
     editable: true, styleName: "center-column",
     editor: {
         type: "dropdown",
         values: ["EQUITY", "BOND", "MIXED"],
         labels: ["주식형", "채권형", "혼합형"]
     }}
];

createMainGrid("TB_GRID_ID", dataProvider, gridView, columns);

// 편집 옵션
gridView.editOptions.editable = true;
gridView.editOptions.commitByCell = true;
```

---

### 3. ApexCharts - 선 차트 (투자 추이)

**User Request**: "월별 투자 추이 차트 추가해줘"

**Template**: [templates/apexcharts-line.jsp](./templates/apexcharts-line.jsp)

```html
<div class="chart-container card mb-3">
    <div class="card-header">
        <h5>월별 투자 추이</h5>
    </div>
    <div class="card-body">
        <div id="investmentTrendChart"></div>
    </div>
</div>

<script>
const chartOptions = {
    chart: {
        type: 'line',
        height: 350,
        toolbar: {
            show: true,
            tools: {
                download: true,
                selection: true,
                zoom: true,
                zoomin: true,
                zoomout: true,
                pan: true,
                reset: true
            }
        }
    },
    series: [{
        name: '투자금액',
        data: [] // AJAX로 데이터 로드
    }, {
        name: '수익금액',
        data: []
    }],
    xaxis: {
        categories: [], // ['2026-01', '2026-02', ...]
        title: { text: '월' }
    },
    yaxis: {
        title: { text: '금액 (백만원)' },
        labels: {
            formatter: function(value) {
                return value.toLocaleString();
            }
        }
    },
    stroke: {
        curve: 'smooth',
        width: 3
    },
    markers: {
        size: 5,
        hover: {
            size: 7
        }
    },
    tooltip: {
        shared: true,
        intersect: false,
        y: {
            formatter: function(value) {
                return value.toLocaleString() + ' 백만원';
            }
        }
    },
    responsive: [{
        breakpoint: 768,
        options: {
            chart: { height: 250 },
            legend: { position: 'bottom' }
        }
    }]
};

const chart = new ApexCharts(
    document.querySelector("#investmentTrendChart"),
    chartOptions
);
chart.render();

// 데이터 로드
loadChartData();
</script>
```

---

### 4. ApexCharts - 도넛 차트 (펀드 분류)

**User Request**: "펀드 유형별 비율 차트"

**Template**: [templates/apexcharts-donut.jsp](./templates/apexcharts-donut.jsp)

```javascript
{
    chart: {
        type: 'donut',
        height: 300
    },
    series: [35, 45, 20], // 데이터
    labels: ['주식형', '채권형', '혼합형'],
    colors: ['#008FFB', '#00E396', '#FEB019'],
    legend: {
        position: 'bottom'
    },
    plotOptions: {
        pie: {
            donut: {
                size: '70%',
                labels: {
                    show: true,
                    total: {
                        show: true,
                        label: '총 펀드 수',
                        formatter: function(w) {
                            return w.globals.seriesTotals.reduce((a, b) => a + b, 0);
                        }
                    }
                }
            }
        }
    }
}
```

---

### 5. Bootstrap 검색 폼

**Template**: [templates/bootstrap-search-form.jsp](./templates/bootstrap-search-form.jsp)

```html
<div class="search-area card mb-3">
    <div class="card-body">
        <form id="searchForm" class="row g-3" role="search" aria-label="검색 폼">
            <div class="col-md-3">
                <label for="keyword" class="form-label">검색어</label>
                <input type="text" class="form-control" id="keyword" name="keyword"
                       placeholder="펀드명 또는 코드 입력" aria-describedby="keywordHelp">
                <small id="keywordHelp" class="form-text text-muted">
                    펀드명 또는 펀드코드를 입력하세요
                </small>
            </div>

            <div class="col-md-3">
                <label for="fundType" class="form-label">펀드유형</label>
                <select class="form-select" id="fundType" name="fundType">
                    <option value="">전체</option>
                    <option value="EQUITY">주식형</option>
                    <option value="BOND">채권형</option>
                    <option value="MIXED">혼합형</option>
                </select>
            </div>

            <div class="col-md-3">
                <label for="dateFrom" class="form-label">기간 (시작)</label>
                <input type="date" class="form-control" id="dateFrom" name="dateFrom">
            </div>

            <div class="col-md-3">
                <label for="dateTo" class="form-label">기간 (종료)</label>
                <input type="date" class="form-control" id="dateTo" name="dateTo">
            </div>

            <div class="col-12">
                <button type="button" class="btn btn-primary" onclick="search()">
                    <i class="bi bi-search"></i> 조회
                </button>
                <button type="button" class="btn btn-secondary" onclick="reset()">
                    <i class="bi bi-arrow-clockwise"></i> 초기화
                </button>
            </div>
        </form>
    </div>
</div>
```

---

## 📚 Component Templates

### Available Templates

| Template | Purpose | File |
|----------|---------|------|
| **realgrid-basic** | 읽기 전용 데이터 그리드 | [templates/realgrid-basic.jsp](./templates/realgrid-basic.jsp) |
| **realgrid-editable** | 편집 가능 데이터 그리드 | [templates/realgrid-editable.jsp](./templates/realgrid-editable.jsp) |
| **realgrid-tree** | 트리 그리드 (계층 구조) | [templates/realgrid-tree.jsp](./templates/realgrid-tree.jsp) |
| **apexcharts-line** | 선 차트 (추이 분석) | [templates/apexcharts-line.jsp](./templates/apexcharts-line.jsp) |
| **apexcharts-donut** | 도넛 차트 (비율 분석) | [templates/apexcharts-donut.jsp](./templates/apexcharts-donut.jsp) |
| **apexcharts-bar** | 바 차트 (비교 분석) | [templates/apexcharts-bar.jsp](./templates/apexcharts-bar.jsp) |
| **bootstrap-search-form** | 검색 폼 레이아웃 | [templates/bootstrap-search-form.jsp](./templates/bootstrap-search-form.jsp) |
| **bootstrap-modal** | 모달 팝업 | [templates/bootstrap-modal.jsp](./templates/bootstrap-modal.jsp) |
| **bootstrap-tabs** | 탭 레이아웃 | [templates/bootstrap-tabs.jsp](./templates/bootstrap-tabs.jsp) |

---

## 🛡️ Security & Accessibility

### XSS Prevention (Automatic)

모든 템플릿은 Lucy XSS 필터를 자동 적용합니다:

```jsp
<%@ taglib prefix="lucy" uri="http://www.navercorp.com/lucy/xss" %>

<!-- 사용자 입력 출력 시 -->
<td><lucy:out value="${fund.fundName}"/></td>

<!-- JavaScript 변수 할당 시 -->
<script>
const fundName = '<lucy:js value="${fund.fundName}"/>';
</script>
```

### Accessibility (WCAG 2.1 AA)

- **ARIA 레이블**: 모든 폼 요소에 `aria-label` 자동 추가
- **키보드 네비게이션**: Tab, Enter, Space 지원
- **스크린 리더**: 의미있는 레이블과 설명 제공
- **색상 대비**: 4.5:1 이상 보장

---

## 📖 Examples

### Example 1: 펀드 목록 페이지 (Complete)

**User Request**: "펀드 목록 조회 화면을 만들어줘. RealGrid로 표시하고 엑셀 다운로드 기능 추가"

**Files Generated**:
```
KiiPS-UI/src/main/webapp/WEB-INF/jsp/fund/
├── fund-list.jsp          (메인 JSP)
├── fund-list.js           (RealGrid + AJAX)
└── fund-list.scss         (커스텀 스타일)
```

**Full Example**: [examples/fund-list/](./examples/fund-list/)

---

### Example 2: 투자 대시보드

**User Request**: "투자 현황 대시보드 만들어줘. 요약 카드 4개랑 차트 3개"

**Layout**:
```
┌─────────────────────────────────────────────┐
│ Summary Cards (4개)                          │
├──────────────┬──────────────┬──────────────┤
│ 총 투자액     │ 수익률       │ 펀드 수       │
│ 최근 투자일   │              │              │
└──────────────┴──────────────┴──────────────┘
┌──────────────────┬──────────────────────────┐
│ Line Chart       │ Donut Chart              │
│ (투자 추이)       │ (펀드 분류)               │
└──────────────────┴──────────────────────────┘
┌─────────────────────────────────────────────┐
│ Bar Chart (Top 10 펀드 수익률)               │
└─────────────────────────────────────────────┘
```

**Full Example**: [examples/dashboard/](./examples/dashboard/)

---

## 🔗 Related Skills

이 Skill은 다른 Skills와 함께 사용됩니다:

| Skill | Usage |
|-------|-------|
| **kiips-realgrid-generator** | RealGrid 2.6.3 코드 생성 (`createMainGrid` 패턴) - **필수 참조** |
| **kiips-realgrid-builder** | RealGrid 2.8.8 고급 설정 (필터, 그룹핑, Excel) |
| **kiips-responsive-validator** | 생성된 컴포넌트의 반응형 검증 |
| **kiips-a11y-checker** | 접근성 자동 검증 및 수정 |
| **kiips-scss-theme-manager** | SCSS 스타일 커스터마이징 |

### RealGrid 생성 시 참조 순서
1. **kiips-realgrid-generator** → 기본 그리드 패턴 (`createMainGrid`, `logosAjax`)
2. **kiips-realgrid-builder** → 고급 설정 (멀티 레벨 헤더, 커스텀 렌더러)

---

## 🎓 Best Practices

### 1. File Organization

```
KiiPS-UI/src/main/webapp/
├── WEB-INF/jsp/
│   ├── fund/
│   │   ├── fund-list.jsp
│   │   ├── fund-detail.jsp
│   │   └── fund-register.jsp
│   └── investment/
│       ├── investment-list.jsp
│       └── investment-dashboard.jsp
├── resources/
│   ├── css/
│   │   ├── common.css
│   │   └── fund-list.scss → fund-list.css
│   ├── js/
│   │   ├── fund-list.js
│   │   └── common.js
│   └── lib/
│       ├── realgrid/
│       └── apexcharts/
```

### 2. Naming Conventions

- **JSP**: `{domain}-{action}.jsp` (예: `fund-list.jsp`)
- **JS**: `{domain}-{action}.js` (JSP와 동일)
- **SCSS**: `{domain}-{action}.scss`
- **API**: `/api/{domain}/{action}`

### 3. Code Comments

```javascript
/**
 * 펀드 목록 조회
 *
 * @description 검색 조건에 따라 펀드 목록을 조회하고 RealGrid에 표시
 * @param {Object} searchParams - 검색 조건 (fundName, fundType, dateFrom, dateTo)
 * @returns {Promise<void>}
 */
function searchFundList(searchParams = {}) {
    // ...
}
```

---

## 🚨 Common Pitfalls

### ❌ Don't
```javascript
// XSS 취약점
document.innerHTML = userInput;

// 하드코딩된 URL
fetch('http://localhost:8000/api/funds');

// 접근성 누락
<button onclick="save()">저장</button>
```

### ✅ Do
```javascript
// XSS 방어
document.textContent = userInput;

// 상대 URL
fetch('/api/funds');

// 접근성 준수
<button onclick="save()" aria-label="펀드 정보 저장">
    <i class="bi bi-save" aria-hidden="true"></i> 저장
</button>
```

---

## 📊 Success Metrics

- ✅ 컴포넌트 생성 시간: < 5분
- ✅ XSS 방어 자동 적용: 100%
- ✅ ARIA 레이블 적용률: 100%
- ✅ 코드 재사용률: > 80%
- ✅ 사용자 만족도: > 90%

---

**Version**: 1.0.0
**Last Updated**: 2026-01-04
**Author**: KiiPS Development Team
