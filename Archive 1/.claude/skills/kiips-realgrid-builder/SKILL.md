---
name: KiiPS RealGrid Builder
description: RealGrid 2.8.8 전문 설정 및 최적화 (컬럼, 에디터, Excel, 성능)
version: 1.0.0
priority: critical
enforcement: require
category: ui-development
tags:
  - realgrid
  - grid
  - datagrid
  - excel
  - performance
author: KiiPS Development Team
lastUpdated: 2026-01-04
---

# KiiPS RealGrid Builder

RealGrid 2.8.8 전문 설정 및 최적화 Skill입니다. 컬럼 타입, 셀 에디터, 필터, 그룹핑, Excel import/export, 성능 최적화 등 고급 기능을 제공합니다.

## 📋 Purpose

### What This Skill Does
- **RealGrid 2.8.8 전문 설정**: GridView + DataProvider 아키텍처
- **컬럼 타입 최적화**: text, number, date, datetime, boolean, dropdown
- **셀 에디터 설정**: 타입별 최적 에디터 자동 구성
- **Excel 기능**: Import, Export, 템플릿 다운로드
- **필터 & 정렬**: 다중 컬럼 필터, 커스텀 정렬
- **그룹핑**: 동적 그룹화 및 집계
- **성능 최적화**: 가상 스크롤, 지연 로딩, 대용량 데이터 처리

### What This Skill Does NOT Do
- 백엔드 API 개발
- 데이터 가공 로직
- 다른 그리드 라이브러리 (AG-Grid, SlickGrid 등)

## 🎯 When to Use

### User Prompt Keywords
```
"RealGrid", "그리드 설정", "셀 편집", "엑셀 내보내기", "엑셀 가져오기",
"그리드 필터", "그리드 정렬", "데이터 그리드", "그룹핑", "집계"
```

### File Patterns
```
새 파일: **/*grid*.js, **/*Grid*.js
수정: **/*grid*.js
```

### Content Patterns
```
파일 내용에 포함: "RealGridJS", "GridView", "DataProvider"
```

## 🚀 Quick Reference

### 1. RealGrid 초기화 (KiiPS 표준 패턴)

```javascript
let gridView;
let dataProvider;

function initGrid() {
    // 1. DataProvider 생성 (데이터 관리)
    dataProvider = new RealGrid.LocalDataProvider(true);

    // 2. GridView 생성 (화면 표시)
    gridView = new RealGrid.GridView('TB_GRID_ID');

    // 3. 필드 정의 (데이터 스키마)
    setupFields();

    // 4. 컬럼 정의 (표시 설정)
    const columns = setupColumns();

    // 5. KiiPS 공통 초기화 함수 호출 (핵심!)
    createMainGrid("TB_GRID_ID", dataProvider, gridView, columns);

    // 6. 추가 옵션 설정 (필요시)
    setupOptions();

    // 7. 이벤트 핸들러
    setupEvents();
}
```

**`createMainGrid` 함수**: KiiPS 공통 함수로 그리드 기본 설정(컬럼, 스타일, 옵션)을 자동 적용합니다.

---

### 2. 필드 정의 (setFields)

```javascript
function setupFields() {
    dataProvider.setFields([
        // 텍스트
        { fieldName: 'fundCode', dataType: 'text' },
        { fieldName: 'fundName', dataType: 'text' },

        // 숫자
        { fieldName: 'navAmount', dataType: 'number' },
        { fieldName: 'totalAsset', dataType: 'number' },

        // 날짜/시간
        { fieldName: 'regDate', dataType: 'datetime' },
        { fieldName: 'updateDate', dataType: 'date' },

        // 불린
        { fieldName: 'isActive', dataType: 'boolean' }
    ]);
}
```

**Data Types**:
- `text` - 문자열
- `number` - 숫자 (정수, 실수)
- `datetime` - 날짜 + 시간
- `date` - 날짜만
- `boolean` - true/false

---

### 3. 컬럼 정의 (setColumns)

#### 3.1 텍스트 컬럼 (좌측 정렬)

```javascript
{
    name: 'fundCode',
    fieldName: 'fundCode',
    header: {
        text: '펀드코드',
        showTooltip: true
    },
    width: 120,
    editable: false,
    styleName: 'left-column',  // CSS 클래스
    renderer: {
        type: 'text',
        showTooltip: true
    }
}
```

#### 3.2 숫자 컬럼 (우측 정렬, 천단위 구분)

```javascript
{
    name: 'navAmount',
    fieldName: 'navAmount',
    header: { text: 'NAV (원)' },
    width: 150,
    editable: false,
    numberFormat: '#,##0',        // 천단위 구분
    styleName: 'right-column',
    renderer: {
        type: 'number',
        showTooltip: true
    }
}
```

**Number Formats**:
- `#,##0` - 정수, 천단위 구분
- `#,##0.00` - 소수점 2자리
- `#,##0.####` - 최대 4자리 (0 제거)

#### 3.3 날짜 컬럼

```javascript
{
    name: 'regDate',
    fieldName: 'regDate',
    header: { text: '등록일' },
    width: 120,
    datetimeFormat: 'yyyy-MM-dd',  // 표시 형식
    editable: false
}
```

**Datetime Formats**:
- `yyyy-MM-dd` - 2026-01-04
- `yyyy-MM-dd HH:mm` - 2026-01-04 14:30
- `yyyy-MM-dd HH:mm:ss` - 2026-01-04 14:30:45

#### 3.4 드롭다운 컬럼

```javascript
{
    name: 'fundType',
    fieldName: 'fundType',
    header: { text: '펀드유형' },
    width: 100,
    editable: false,
    lookupDisplay: true,  // 코드 대신 라벨 표시
    values: ['EQUITY', 'BOND', 'MIXED'],
    labels: ['주식형', '채권형', '혼합형']
}
```

#### 3.5 Boolean 컬럼 (체크박스)

```javascript
{
    name: 'isActive',
    fieldName: 'isActive',
    header: { text: '활성' },
    width: 60,
    editable: false,
    renderer: {
        type: 'check',
        trueValues: 'true',
        falseValues: 'false'
    },
    styleName: 'center-column'
}
```

---

### 4. 셀 에디터 (Editable Columns)

#### 4.1 텍스트 에디터

```javascript
{
    name: 'fundName',
    fieldName: 'fundName',
    header: { text: '펀드명' },
    width: 200,
    editable: true,  // 편집 가능
    editor: {
        type: 'text',
        maxLength: 100,  // 최대 길이
        textCase: 'upper',  // 'upper', 'lower', 'normal'
        IME: {
            mode: 'hangul'  // 한글 입력 모드
        }
    },
    styleName: 'editable-column'
}
```

#### 4.2 숫자 에디터 (검증 포함)

```javascript
{
    name: 'investAmount',
    fieldName: 'investAmount',
    header: { text: '투자금액 (원)' },
    width: 150,
    editable: true,
    editor: {
        type: 'number',
        editFormat: '#,##0',  // 편집 중 포맷
        min: 0,               // 최소값
        max: 9999999999,      // 최대값
        step: 1000,           // 증감 단위
        integerOnly: false    // true: 정수만
    },
    numberFormat: '#,##0',
    styleName: 'editable-column'
}
```

#### 4.3 드롭다운 에디터

```javascript
{
    name: 'fundType',
    fieldName: 'fundType',
    header: { text: '펀드유형' },
    width: 120,
    editable: true,
    editor: {
        type: 'dropdown',
        dropDownCount: 10,  // 최대 표시 항목
        domainOnly: true,   // values 외 값 입력 불가
        textReadOnly: true  // 직접 입력 불가, 선택만
    },
    values: ['EQUITY', 'BOND', 'MIXED', 'ALTERNATIVE'],
    labels: ['주식형', '채권형', '혼합형', '대체투자형'],
    lookupDisplay: true
}
```

#### 4.4 날짜 선택기

```javascript
{
    name: 'investDate',
    fieldName: 'investDate',
    header: { text: '투자일' },
    width: 120,
    editable: true,
    editor: {
        type: 'date',
        datetimeFormat: 'yyyy-MM-dd',
        minDate: '2020-01-01',  // 선택 가능 최소 날짜
        maxDate: '2030-12-31',  // 선택 가능 최대 날짜
        openOnClick: true       // 클릭 시 캘린더 오픈
    },
    datetimeFormat: 'yyyy-MM-dd'
}
```

#### 4.5 멀티라인 텍스트 (메모)

```javascript
{
    name: 'memo',
    fieldName: 'memo',
    header: { text: '메모' },
    width: 200,
    editable: true,
    editor: {
        type: 'multiline',
        maxLength: 500,
        rows: 5  // 행 수
    },
    renderer: {
        type: 'text',
        showTooltip: true
    }
}
```

---

### 5. Grid 옵션 설정

```javascript
function setupOptions() {
    // 표시 옵션
    gridView.setDisplayOptions({
        fitStyle: 'fill',           // 'even', 'fill', 'none'
        selectionStyle: 'rows',     // 'rows', 'columns', 'cells'
        columnResizable: true,      // 컬럼 리사이즈 가능
        showRowCheckColumn: false,  // 체크박스 컬럼
        rowHeight: 32,              // 행 높이
        headerHeight: 40,           // 헤더 높이
        footerHeight: 0             // 푸터 높이
    });

    // 편집 옵션
    gridView.setEditOptions({
        editable: true,             // 전체 편집 가능 여부
        insertable: false,          // 새 행 추가 가능
        appendable: false,          // 마지막에 추가 가능
        updatable: true,            // 수정 가능
        deletable: false,           // 삭제 가능
        validateOnEdited: true,     // 편집 시 검증
        commitWhenEnter: true,      // Enter 시 commit
        commitByCell: false,        // 셀 단위 commit
        checkable: false            // 체크박스 사용
    });

    // 복사/붙여넣기 옵션
    gridView.setCopyOptions({
        enabled: true,              // Ctrl+C/V 활성화
        singleMode: false,          // 단일 셀만 복사
        copyDisplayText: true,      // 표시 텍스트 복사
        copyHeaders: false          // 헤더 포함 복사
    });

    // 정렬 옵션
    gridView.setSortingOptions({
        enabled: true,              // 정렬 활성화
        style: 'exclusive'          // 'exclusive', 'inclusive'
    });

    // 필터링 옵션
    gridView.setFilteringOptions({
        enabled: true               // 필터 활성화
    });
}
```

---

### 6. Excel Export

#### 6.1 기본 Export

```javascript
function exportToExcel() {
    gridView.exportGrid({
        type: 'excel',
        target: 'local',  // 'local' 또는 'remote'
        fileName: '펀드목록_' + new Date().toISOString().split('T')[0] + '.xlsx',

        // 옵션
        documentTitle: {
            message: '펀드 목록',
            visible: true,
            spaceTop: 1,
            spaceBottom: 0,
            height: 60,
            styles: {
                fontSize: 20,
                fontBold: true
            }
        },

        // 헤더/푸터
        header: {
            visible: true,
            spaceTop: 0,
            spaceBottom: 0
        },
        footer: {
            visible: true,
            message: '출력일: ' + new Date().toLocaleDateString()
        },

        // 스타일
        showProgress: true,  // 진행바 표시
        progressMessage: '엑셀 파일 생성 중...',

        // 완료 콜백
        done: function() {
            console.log('Excel export completed');
        },

        // 실패 콜백
        failed: function(error) {
            console.error('Excel export failed:', error);
            alert('엑셀 다운로드 실패');
        }
    });
}
```

#### 6.2 선택 행만 Export

```javascript
function exportSelectedRows() {
    const selectedRows = gridView.getCheckedRows();  // 체크된 행

    if (selectedRows.length === 0) {
        alert('선택된 행이 없습니다.');
        return;
    }

    gridView.exportGrid({
        type: 'excel',
        target: 'local',
        fileName: '선택펀드_' + new Date().toISOString().split('T')[0] + '.xlsx',
        allItems: false,  // 전체가 아닌 선택된 행만
        done: function() {
            console.log('Selected rows exported');
        }
    });
}
```

---

### 7. Excel Import

```javascript
function importFromExcel(file) {
    gridView.importData({
        type: 'excel',
        file: file,  // File object from <input type="file">

        // 옵션
        append: false,     // false: 기존 데이터 대체, true: 추가
        fillMode: 'set',   // 'set', 'append', 'insert'
        fillPos: 0,        // 시작 위치

        // 매핑 (Excel 컬럼 → Grid 필드)
        mapping: [
            { excelColumn: 'A', fieldName: 'fundCode' },
            { excelColumn: 'B', fieldName: 'fundName' },
            { excelColumn: 'C', fieldName: 'fundType' },
            { excelColumn: 'D', fieldName: 'navAmount' }
        ],

        // 완료 콜백
        done: function() {
            console.log('Excel import completed');
            alert('엑셀 데이터를 가져왔습니다.');
        },

        // 실패 콜백
        failed: function(error) {
            console.error('Excel import failed:', error);
            alert('엑셀 가져오기 실패: ' + error.message);
        }
    });
}

// HTML
<input type="file" id="excelFile" accept=".xlsx, .xls"
       onchange="handleFileSelect(this.files[0])">

function handleFileSelect(file) {
    if (file) {
        importFromExcel(file);
    }
}
```

---

### 8. 필터링

#### 8.1 자동 필터 (컬럼 헤더 필터)

```javascript
// 자동 필터 활성화
gridView.setColumnFilters('fundType', [
    {
        name: 'EQUITY',
        criteria: "value = 'EQUITY'",
        text: '주식형'
    },
    {
        name: 'BOND',
        criteria: "value = 'BOND'",
        text: '채권형'
    },
    {
        name: 'MIXED',
        criteria: "value = 'MIXED'",
        text: '혼합형'
    }
]);
```

#### 8.2 프로그래매틱 필터

```javascript
function applyFilter(fundType, minAmount) {
    let filterStr = '';

    if (fundType) {
        filterStr += `fundType = '${fundType}'`;
    }

    if (minAmount > 0) {
        if (filterStr) filterStr += ' and ';
        filterStr += `navAmount >= ${minAmount}`;
    }

    // 필터 적용
    dataProvider.setFilters(filterStr);
}

// 필터 해제
function clearFilter() {
    dataProvider.clearFilters();
}
```

---

### 9. 그룹핑 & 집계

```javascript
// 그룹핑 활성화
gridView.setGroupPanel({
    visible: true  // 그룹 패널 표시
});

// 프로그래매틱 그룹핑
gridView.groupBy(['fundType', 'investYear'], {
    // 그룹 옵션
    sorting: [{
        field: 'fundType',
        ascending: true
    }],

    // 집계 함수
    summaryMode: 'aggregate',
    footer: {
        visible: true,
        expression: 'sum',  // sum, avg, count, min, max
        numberFormat: '#,##0'
    }
});

// 그룹 해제
function ungroupAll() {
    gridView.clearGrouping();
}
```

---

### 10. 이벤트 핸들러

```javascript
function setupEvents() {
    // 행 선택 변경
    gridView.onCurrentRowChanged = function(grid, oldRow, newRow) {
        if (newRow >= 0) {
            const rowData = dataProvider.getJsonRow(newRow);
            console.log('Selected:', rowData);
        }
    };

    // 셀 클릭
    gridView.onCellClicked = function(grid, clickData) {
        console.log('Cell clicked:', clickData);
    };

    // 셀 더블클릭
    gridView.onCellDblClicked = function(grid, clickData) {
        const rowData = dataProvider.getJsonRow(clickData.dataRow);
        openDetailModal(rowData);
    };

    // 편집 시작 전
    gridView.onEditRowChanged = function(grid, itemIndex, dataRow, field, oldValue, newValue) {
        console.log('Edit started:', field, oldValue, newValue);
        return true;  // false 반환 시 편집 취소
    };

    // 편집 완료 후
    gridView.onEditCommit = function(grid, index, oldValue, newValue) {
        console.log('Edit committed:', oldValue, newValue);

        // 서버에 저장
        saveChangesToServer(index, newValue);
    };

    // 체크박스 변경
    gridView.onItemChecked = function(grid, itemIndex, checked) {
        console.log('Item checked:', itemIndex, checked);
    };
}
```

---

### 11. 성능 최적화

#### 11.1 가상 스크롤 (대용량 데이터)

```javascript
// 가상 스크롤링 자동 활성화 (기본값)
gridView.setDisplayOptions({
    fitStyle: 'fill',
    rowHeight: 32  // 고정 높이 필수!
});

// 페이징 모드 (서버 사이드)
dataProvider.setOptions({
    softDeleting: false,
    deleteCreated: false
});
```

#### 11.2 지연 로딩 (Lazy Loading)

```javascript
let currentPage = 1;
const pageSize = 100;

function loadData(page = 1) {
    $.ajax({
        url: '/api/funds/list',
        data: {
            page: page,
            size: pageSize
        },
        success: function(response) {
            if (page === 1) {
                dataProvider.setRows(response.data.list);
            } else {
                dataProvider.addRows(response.data.list);
            }
        }
    });
}

// 스크롤 이벤트
gridView.onScrollToBottom = function(grid) {
    if (hasMoreData) {
        loadData(++currentPage);
    }
};
```

#### 11.3 데이터 압축 (Soft Delete)

```javascript
// 삭제된 행을 실제로 제거하지 않고 숨김
dataProvider.setOptions({
    softDeleting: true,  // 소프트 삭제 활성화
    deleteCreated: true  // 새 행은 실제 삭제
});

// 실제 삭제 (Commit)
function commitChanges() {
    const deletedRows = dataProvider.getAllStateRows().deleted;
    const updatedRows = dataProvider.getAllStateRows().updated;
    const createdRows = dataProvider.getAllStateRows().created;

    // 서버에 전송
    saveToServer({
        deleted: deletedRows,
        updated: updatedRows,
        created: createdRows
    });

    // 완료 후 커밋
    dataProvider.commit();
}
```

---

### 12. AJAX 통합

```javascript
function loadGridData(searchParams = {}) {
    $.ajax({
        url: '/api/funds/list',
        method: 'GET',
        data: searchParams,
        headers: {
            'X-AUTH-TOKEN': localStorage.getItem('token')
        },
        beforeSend: function() {
            // 로딩 표시
            gridView.showProgress();
        },
        success: function(response) {
            if (response.success) {
                dataProvider.setRows(response.data.list);
            } else {
                alert('조회 실패: ' + response.message);
            }
        },
        error: function(xhr, status, error) {
            console.error('API Error:', error);
            alert('서버 오류가 발생했습니다.');
        },
        complete: function() {
            // 로딩 숨김
            gridView.closeProgress();
        }
    });
}

function saveGridData() {
    const updatedRows = dataProvider.getAllStateRows().updated;
    const createdRows = dataProvider.getAllStateRows().created;
    const deletedRows = dataProvider.getAllStateRows().deleted;

    if (updatedRows.length === 0 && createdRows.length === 0 && deletedRows.length === 0) {
        alert('변경된 데이터가 없습니다.');
        return;
    }

    $.ajax({
        url: '/api/funds/save',
        method: 'POST',
        contentType: 'application/json',
        data: JSON.stringify({
            updated: updatedRows.map(row => dataProvider.getJsonRow(row.dataRow)),
            created: createdRows.map(row => dataProvider.getJsonRow(row.dataRow)),
            deleted: deletedRows.map(row => dataProvider.getJsonRow(row.dataRow))
        }),
        success: function(response) {
            if (response.success) {
                dataProvider.commit();  // 변경사항 확정
                alert('저장되었습니다.');
                loadGridData();  // 재조회
            } else {
                dataProvider.rollback();  // 변경사항 취소
                alert('저장 실패: ' + response.message);
            }
        },
        error: function(xhr, status, error) {
            dataProvider.rollback();
            console.error('Save Error:', error);
            alert('저장 중 오류가 발생했습니다.');
        }
    });
}
```

---

## 🔗 Related Skills

| Skill | Usage |
|-------|-------|
| **kiips-ui-component-builder** | RealGrid를 포함한 페이지 전체 생성 |
| **kiips-responsive-validator** | 그리드 반응형 검증 |
| **kiips-a11y-checker** | 그리드 접근성 검증 |

---

## 📚 Best Practices

### 1. Field vs Column 분리

```javascript
// ❌ Don't - 필드와 컬럼 혼동
dataProvider.setFields([
    { fieldName: 'fundCode', width: 120 }  // ✗ width는 컬럼 속성
]);

// ✅ Do - 명확한 분리
dataProvider.setFields([
    { fieldName: 'fundCode', dataType: 'text' }
]);

gridView.setColumns([
    { name: 'fundCode', fieldName: 'fundCode', width: 120 }
]);
```

### 2. 메모리 관리

```javascript
// 컴포넌트 정리 (페이지 이동 시)
function destroyGrid() {
    if (gridView) {
        gridView.destroy();
        gridView = null;
    }
    if (dataProvider) {
        dataProvider.destroy();
        dataProvider = null;
    }
}

// Vue/React에서
onBeforeUnmount(() => {
    destroyGrid();
});
```

### 3. 에러 처리

```javascript
try {
    gridView.commit();
} catch (error) {
    console.error('Grid error:', error);
    gridView.cancel();  // 편집 취소
    alert('저장 실패: ' + error.message);
}
```

---

## 🚨 Common Pitfalls

### ❌ Don't
```javascript
// 순환 참조
gridView.onEditCommit = function(grid, index) {
    grid.commit();  // ✗ 무한 루프!
};

// 잘못된 필드명
{ name: 'amount', fieldName: 'navAmount' }  // ✗ 불일치

// 타입 불일치
{ fieldName: 'amount', dataType: 'number' }  // ✗ 필드 타입
{ name: 'amount', editor: { type: 'text' } }  // ✗ 에디터 타입
```

### ✅ Do
```javascript
// 올바른 이벤트 핸들링
gridView.onEditCommit = function(grid, index) {
    saveToServer(index);  // 외부 함수 호출
};

// 일관된 이름
{ name: 'navAmount', fieldName: 'navAmount' }

// 타입 일치
{ fieldName: 'navAmount', dataType: 'number' }
{ name: 'navAmount', editor: { type: 'number' } }
```

---

## 📊 Success Metrics

- ✅ RealGrid 초기화 시간: < 500ms
- ✅ 1만 행 렌더링: < 1초
- ✅ Excel Export (1만 행): < 3초
- ✅ 셀 편집 응답 시간: < 100ms
- ✅ 메모리 사용량: < 50MB (1만 행 기준)

---

**Version**: 1.0.0
**Last Updated**: 2026-01-04
**RealGrid Version**: 2.8.8
**Author**: KiiPS Development Team
