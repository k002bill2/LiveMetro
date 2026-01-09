---
name: KiiPS RealGrid Generator
description: RealGrid 2.6.3 테이블 코드 자동 생성 (KiiPS 표준 패턴)
version: 1.0.0
priority: high
enforcement: require
category: ui-development
tags:
  - realgrid
  - realgrid-2.6.3
  - grid
  - table
  - generator
  - template
author: KiiPS Development Team
lastUpdated: 2026-01-06
---

# KiiPS RealGrid Generator

RealGrid 2.6.3 테이블 코드 자동 생성 Skill입니다. KiiPS 프로젝트의 표준 패턴(`createMainGrid`, `logosAjax`)을 따르는 그리드 코드를 생성합니다.

## 📋 Purpose

### What This Skill Does
- **RealGrid 2.6.3 코드 생성**: KiiPS 표준 패턴 적용
- **컬럼 정의 템플릿**: 텍스트, 숫자, 날짜, 드롭다운
- **멀티 레벨 헤더**: `setColumnLayout()` 자동 구성
- **커스텀 렌더러**: `common_grid.js` 렌더러 연동
- **데이터 로딩**: `logosAjax.requestTokenGrid` 패턴

### What This Skill Does NOT Do
- RealGrid 2.8.8 설정 (→ kiips-realgrid-builder 사용)
- 백엔드 API 개발
- 다른 그리드 라이브러리

## 🎯 When to Use

### User Prompt Keywords
```
"RealGrid 생성", "그리드 만들어", "테이블 생성", "리얼그리드",
"멀티 레벨 헤더", "컬럼 그룹", "columnLayout"
```

### File Patterns
```
새 파일: **/*grid*.js, **/*.jsp
```

---

## 🚀 Quick Reference

### 1. 기본 초기화 패턴

```javascript
// JSP Container
<div id="TB_GRID_ID"></div>

// JavaScript
let dataProvider = new RealGrid.LocalDataProvider(true);
let gridView = new RealGrid.GridView("TB_GRID_ID");

// KiiPS 공통 초기화
createMainGrid("TB_GRID_ID", dataProvider, gridView, columns);
```

### 2. 컬럼 정의

```javascript
let columns = [
    // 텍스트 (좌측 정렬)
    {fieldName: "CODE", width: "100", header: {text: "코드"},
     editable: false, styleName: "left-column"},

    // 숫자 (우측 정렬, 포맷)
    {fieldName: "AMOUNT", width: "150", header: {text: "금액"},
     editable: false, dataType: "number", numberFormat: "#,##0",
     styleName: "right-column",
     headerSummary: {expression: "sum", numberFormat: "#,##0"}},

    // 패턴 포맷 (등록번호)
    {fieldName: "REG_NO", width: "130", header: {text: "등록번호"},
     editable: false,
     textFormat: "([0-9]{3})([0-9]{2})([0-9]{5});$1-$2-$3"},

    // 날짜 (렌더러)
    {fieldName: "DATE", width: "120", header: {text: "날짜"},
     editable: false,
     renderer: {
         type: "html",
         callback: function(grid, cell) {
             return StringUtil.toDate(cell.value, "-");
         }
     }}
];
```

### 3. 멀티 레벨 헤더 (Column Groups)

#### 기본 2단 헤더

```javascript
// 컬럼 그룹 정의
gridView.setColumnLayout([
    "RANK",           // 일반 컬럼
    "COMPANY_NM",
    {
        name: "GROUP1",
        header: {text: "그룹 헤더 1"},
        columns: ["COL1", "COL2", "COL3"]
    },
    {
        name: "GROUP2",
        header: {text: "그룹 헤더 2"},
        columns: ["COL4", "COL5", "COL6"]
    },
    "TOTAL"
]);

// 2단 헤더용 높이 설정
gridView.header.height = 60;
```

#### 다단 헤더 (3단 이상) - MI0801.jsp 패턴

**핵심**: `header.heights` 배열 + 중첩 `items` 구조 사용

```javascript
// 3단 헤더 레이아웃 정의
var layout = [
    "COL1", "COL2", "COL3",  // 일반 컬럼 (1단만)
    {
        name: "Group",
        direction: "horizontal",
        items: [
            "COL4",
            "COL5",
            {
                name: "Group",          // 중첩 그룹 (3단 헤더)
                direction: "horizontal",
                items: ["COL6", "COL7", "COL8", "COL9"],
                header: {text: "내부 그룹 헤더"}  // 2단 헤더
            },
            "COL10"
        ],
        header: {text: "외부 그룹 헤더"}  // 1단 헤더
    }
];

gridView.setColumnLayout(layout);

// 각 헤더 행의 높이 배열로 지정 (필수!)
gridView.header.heights = [28, 28, 28];  // 3단 헤더
```

#### 헤더 높이 옵션

| 옵션 | 사용법 | 설명 |
|------|--------|------|
| `header.height` | `60` | 2단 헤더 (단일 높이) |
| `header.heights` | `[28, 28]` | 2단 헤더 (행별 높이) |
| `header.heights` | `[28, 28, 28]` | 3단 헤더 |
| `header.heights` | `[30, 25, 25, 25]` | 4단 헤더 |

### 4. 그리드 옵션

```javascript
// 편집 옵션
gridView.editOptions.editable = false;

// 표시 옵션
gridView.displayOptions.rowHeight = 36;
gridView.displayOptions.fitStyle = "even";
gridView.displayOptions.showEmptyMessage = true;
gridView.displayOptions.emptyMessage = "데이터가 없습니다.";

// 상태바/체크바/푸터
gridView.stateBar.visible = false;
gridView.checkBar.visible = false;
gridView.footer.visible = false;

// 헤더 합계
gridView.setHeaderSummaries({
    visible: true,
    items: [{height: 30}]
});
```

### 5. 데이터 로딩 (KiiPS 패턴)

```javascript
function getData(searchCond) {
    logosAjax.requestTokenGrid(
        gridView,
        gToken,
        "${KiiPS_FD}/FDAPI/FD0101/LIST",
        "post",
        searchCond,
        function(data) {
            dataProvider.setRows(data.body.list);
            gridView.refresh();
        }
    );
}
```

### 6. 커스텀 렌더러 (common_grid.js)

#### 렌더러 등록 방법

```javascript
// 1. 렌더러 등록
fn_grid_renderer(gridView, 'renderer_imgbtn');

// 2. 컬럼에 적용
{fieldName: "SEARCH", width: "50", header: {text: "조회"},
 renderer: "renderer_imgbtn"}
```

#### 전체 렌더러 목록 (24개)

| 렌더러명 | 용도 |
|----------|------|
| `renderer_invstcom` | 투자재원배분 기업 검색 |
| `renderer_imgbtn` | 주주명 검색 (일반 팝업) |
| `renderer_zipcode` | 우편번호 검색 |
| `renderer_custnm` | 회사주주관리 거래처 검색 |
| `renderer_exchange` | 환율정보 조회 |
| `renderer_zipcode_grid` | 그리드 내 우편번호 검색 |
| `renderer_remove_apprv` | 전자결재 결재선 취소 |
| `renderer_account` | 계정과목 검색 |
| `renderer_account_dr` | 차변 계정과목 검색 |
| `renderer_account_cr` | 대변 계정과목 검색 |
| `renderer_account_nm` | 계정과목명 검색 |
| `renderer_enterprise` | 기업 검색 |
| `renderer_code_brch` | 지점 코드 검색 |
| `renderer_save` | 저장 버튼 |
| `renderer_del` | 삭제 버튼 |
| `renderer_searchbtn` | 검색 버튼 |
| `renderer_searchacitcd` | 계정과목코드 검색 |
| `renderer_lpapprv` | LP 승인 상태 |
| `renderer_lpapprv_2` | LP 승인 상태 v2 |
| `renderer_shaped` | 도형 렌더러 |
| `renderer_searchEmployee` | 직원 검색 |
| `renderer_CUST_NO` | 고객번호 검색 |
| `renderer_Inquire` | 조회 버튼 |
| `renderer_stockholder_info` | 주주 정보 |
| `renderer_lpReTrn` | LP 재전송 |
| `renderer_tax_excp_tpcd` | 세금 예외 유형 |
| `renderer_edit_save` | 편집 저장 |

#### 자주 사용하는 렌더러

```javascript
fn_grid_renderer(gridView, 'renderer_imgbtn');    // 검색 버튼
fn_grid_renderer(gridView, 'renderer_account');   // 계정 조회
fn_grid_renderer(gridView, 'renderer_lpapprv');   // LP 승인 상태
fn_grid_renderer(gridView, 'renderer_save');      // 저장 버튼
fn_grid_renderer(gridView, 'renderer_del');       // 삭제 버튼
```

### 7. 엑셀 내보내기

```javascript
gridView.exportGrid({
    type: "excel",
    target: "local",
    fileName: "export_" + new Date().toISOString().slice(0,10) + ".xlsx",
    showProgress: true,
    done: function() {
        alert("Excel 다운로드 완료");
    }
});
```

---

## 🎨 Style System (realgrid-style.scss)

### 파일 경로

| 파일 | 경로 | 용도 |
|------|------|------|
| 스타일 정의 | `/vendor/realgrid.2.6.3/realgrid-style.scss` | RealGrid 전체 스타일 |
| SCSS 변수 | `/css/sass/config/_variables.scss` | 테마 변수 정의 |

### CSS 변수 (테마 지원)

```scss
var(--color)                       // 기본 텍스트 색상
var(--rgTable-background-color)    // 그리드 배경색
var(--rgTable-border-color)        // 테두리 색상
var(--rgTable-header-background)   // 헤더 배경색
```

### 핵심 CSS 클래스

| 클래스 | 용도 |
|--------|------|
| `.rg-root` | 그리드 루트 컨테이너 |
| `.rg-header` | 헤더 영역 스타일 |
| `.rg-grid` | 그리드 본체 |
| `.rg-empty-grid` | 데이터 없음 메시지 |

### Style Classes (컬럼 정렬)

| Class | 설명 | 사용 |
|-------|------|------|
| `left-column` | 좌측 정렬 | 텍스트 |
| `center-column` | 중앙 정렬 | 코드, 상태 |
| `right-column` | 우측 정렬 | 숫자 |
| `unicorn-blue-text` | 파란색 | 강조 숫자 |
| `unicorn-bold-text` | 굵은 글씨 | 합계 |

---

## 📁 템플릿

### JSP 컨테이너

```jsp
<%@ page contentType="text/html;charset=UTF-8" language="java" %>
<%@ taglib prefix="spring" uri="http://www.springframework.org/tags" %>
<spring:eval expression="@environment.getProperty('KiiPS.FD.URL')" var="KiiPS_FD"/>
<spring:eval expression="@environment.getProperty('KiiPS.GW.URL')" var="KiiPS_GATE"/>

<div class="card">
    <div class="card-header">
        <h5 class="mb-0">그리드 제목</h5>
    </div>
    <div class="card-body">
        <div id="TB_GRID_ID"></div>
    </div>
</div>

<script>
var gToken = "${gToken}";
var dataProvider, gridView;

$(document).ready(function() {
    initGrid();
    loadData();
});

function initGrid() {
    dataProvider = new RealGrid.LocalDataProvider(true);
    gridView = new RealGrid.GridView("TB_GRID_ID");

    let columns = [
        // 컬럼 정의
    ];

    createMainGrid("TB_GRID_ID", dataProvider, gridView, columns);
}

function loadData() {
    logosAjax.requestTokenGrid(gridView, gToken,
        "${KiiPS_FD}/FDAPI/SERVICE/LIST", "post", {},
        function(data) {
            dataProvider.setRows(data.body.list);
            gridView.refresh();
        });
}
</script>
```

### 전체 JavaScript 템플릿

```javascript
/**
 * Grid Name: TB_GRID_ID
 * Description: 그리드 설명
 */
(function() {
    'use strict';

    let dataProvider, gridView;

    // 초기화
    function init() {
        dataProvider = new RealGrid.LocalDataProvider(true);
        gridView = new RealGrid.GridView("TB_GRID_ID");

        setupColumns();
        setupOptions();
        loadData();
    }

    // 컬럼 설정
    function setupColumns() {
        let columns = [
            {fieldName: "COL1", width: "100", header: {text: "컬럼1"},
             editable: false, styleName: "center-column"},
            {fieldName: "COL2", width: "150", header: {text: "컬럼2"},
             editable: false, styleName: "left-column"},
            {fieldName: "AMOUNT", width: "120", header: {text: "금액"},
             editable: false, dataType: "number", numberFormat: "#,##0",
             styleName: "right-column"}
        ];

        createMainGrid("TB_GRID_ID", dataProvider, gridView, columns);
    }

    // 옵션 설정
    function setupOptions() {
        gridView.editOptions.editable = false;
        gridView.displayOptions.rowHeight = 36;
        gridView.displayOptions.fitStyle = "even";
        gridView.stateBar.visible = false;
        gridView.checkBar.visible = false;
        gridView.footer.visible = false;
    }

    // 데이터 로딩
    function loadData(searchCond) {
        searchCond = searchCond || {};
        logosAjax.requestTokenGrid(gridView, gToken,
            apiUrl, "post", searchCond,
            function(data) {
                dataProvider.setRows(data.body.list);
                gridView.refresh();
            });
    }

    // Public API
    window.GridModule = {
        init: init,
        loadData: loadData
    };

    // DOM Ready
    $(document).ready(init);
})();
```

---

## 📖 Examples

### Example 1: 기본 테이블

```javascript
let columns = [
    {fieldName: "FUND_CD", width: "120", header: {text: "펀드코드"},
     editable: false, styleName: "center-column"},
    {fieldName: "FUND_NM", width: "250", header: {text: "펀드명"},
     editable: false, styleName: "left-column"},
    {fieldName: "NAV_AMT", width: "150", header: {text: "순자산"},
     editable: false, dataType: "number", numberFormat: "#,##0",
     styleName: "right-column"}
];

createMainGrid("TB_FUND_LIST", dataProvider, gridView, columns);
```

### Example 2: 멀티 레벨 헤더 테이블

```javascript
// 컬럼 정의
let columns = [
    {name: 'RANK', fieldName: 'RANK', width: 80,
     header: {text: 'Rank'}, styleName: 'center-column'},
    {name: 'COMPANY', fieldName: 'COMPANY', width: 150,
     header: {text: '회사명'}, styleName: 'left-column'},
    {name: 'Q1_SALES', fieldName: 'Q1_SALES', width: 100,
     header: {text: '1분기'}, styleName: 'right-column', numberFormat: '#,##0'},
    {name: 'Q2_SALES', fieldName: 'Q2_SALES', width: 100,
     header: {text: '2분기'}, styleName: 'right-column', numberFormat: '#,##0'},
    {name: 'Q3_SALES', fieldName: 'Q3_SALES', width: 100,
     header: {text: '3분기'}, styleName: 'right-column', numberFormat: '#,##0'},
    {name: 'Q4_SALES', fieldName: 'Q4_SALES', width: 100,
     header: {text: '4분기'}, styleName: 'right-column', numberFormat: '#,##0'},
    {name: 'TOTAL', fieldName: 'TOTAL', width: 120,
     header: {text: '합계'}, styleName: 'right-column bold-text', numberFormat: '#,##0'}
];

gridView.setColumns(columns);

// 멀티 레벨 헤더
gridView.setColumnLayout([
    'RANK',
    'COMPANY',
    {
        name: 'SALES_GROUP',
        header: {text: '분기별 매출'},
        columns: ['Q1_SALES', 'Q2_SALES', 'Q3_SALES', 'Q4_SALES']
    },
    'TOTAL'
]);

// 헤더 높이 조정
gridView.header.height = 60;
```

### Example 3: 유니콘 기업 테이블 (실제 예제)

```javascript
// 필드 정의
dataProvider.setFields([
    {fieldName: 'RANK', dataType: 'number'},
    {fieldName: 'COMPANY_NM', dataType: 'text'},
    {fieldName: 'REAL_TOTAL', dataType: 'number'},
    {fieldName: 'REAL_BABY', dataType: 'number'},
    {fieldName: 'REAL_PRE', dataType: 'number'},
    {fieldName: 'HOLD_TOTAL', dataType: 'number'},
    {fieldName: 'HOLD_BABY', dataType: 'number'},
    {fieldName: 'HOLD_PRE', dataType: 'number'},
    {fieldName: 'NURTURE_CNT', dataType: 'number'}
]);

// 컬럼 정의
gridView.setColumns([
    {name: 'RANK', fieldName: 'RANK', width: 80,
     header: {text: 'Rank'}, styleName: 'center-column'},
    {name: 'COMPANY_NM', fieldName: 'COMPANY_NM', width: 150,
     header: {text: '구분'}, styleName: 'left-column'},
    {name: 'REAL_TOTAL', fieldName: 'REAL_TOTAL', width: 80,
     header: {text: '총합'}, styleName: 'center-column unicorn-blue-text'},
    {name: 'REAL_BABY', fieldName: 'REAL_BABY', width: 120,
     header: {text: 'K-아기유니콘'}, styleName: 'center-column'},
    {name: 'REAL_PRE', fieldName: 'REAL_PRE', width: 120,
     header: {text: 'K-예비유니콘'}, styleName: 'center-column'},
    {name: 'HOLD_TOTAL', fieldName: 'HOLD_TOTAL', width: 80,
     header: {text: '총합'}, styleName: 'center-column unicorn-blue-text'},
    {name: 'HOLD_BABY', fieldName: 'HOLD_BABY', width: 120,
     header: {text: 'K-아기유니콘'}, styleName: 'center-column'},
    {name: 'HOLD_PRE', fieldName: 'HOLD_PRE', width: 120,
     header: {text: 'K-예비유니콘'}, styleName: 'center-column'},
    {name: 'NURTURE_CNT', fieldName: 'NURTURE_CNT', width: 120,
     header: {text: '육성기업수'}, styleName: 'center-column unicorn-bold-text'}
]);

// 컬럼 그룹 (멀티 레벨 헤더)
gridView.setColumnLayout([
    'RANK',
    'COMPANY_NM',
    {
        name: 'REAL_GROUP',
        header: {text: '실배출수 (선발인후 선정)'},
        columns: ['REAL_TOTAL', 'REAL_BABY', 'REAL_PRE']
    },
    {
        name: 'HOLD_GROUP',
        header: {text: '보유수 (선발기간 무관)'},
        columns: ['HOLD_TOTAL', 'HOLD_BABY', 'HOLD_PRE']
    },
    'NURTURE_CNT'
]);

// 2단 헤더 높이
gridView.header.height = 60;
```

---

## 🔗 Related Skills

| Skill | Usage |
|-------|-------|
| **kiips-realgrid-builder** | RealGrid 2.8.8 고급 설정 |
| **kiips-ui-component-builder** | JSP 페이지 전체 생성 |
| **kiips-responsive-validator** | 그리드 반응형 검증 |

---

## 📊 Success Metrics

- ✅ 그리드 초기화: < 500ms
- ✅ 1만 행 렌더링: < 1초
- ✅ 멀티 레벨 헤더 정상 표시
- ✅ KiiPS 표준 패턴 준수

---

**Version**: 1.0.0
**Last Updated**: 2026-01-06
**RealGrid Version**: 2.6.3
**Author**: KiiPS Development Team
