---
name: feature-lifecycle-orchestration
description: 기능 개발 라이프사이클 조정 및 품질 체크포인트 강제
type: orchestration
manager: feature-manager
relatedSkills:
  - kiips-feature-planner
  - checklist-generator
priority: high
---

# Feature Lifecycle Orchestration Skill

## Purpose

신규 기능 개발의 전체 라이프사이클을 조정하고, 단계별 handoff (아키텍처 → 개발 → QA) 및 품질 체크포인트를 강제합니다. feature-manager가 feature-planner, architect, developer, ui-designer, QA 간의 협업을 오케스트레이션할 때 사용합니다.

## Core Orchestration Patterns

### Pattern 1: Sequential Handoff Workflow

**목적**: 단계별 품질 검증 후 다음 단계로 전환

```
Requirements (User 요청)
    ↓
★ Checkpoint 1: 요구사항 명확화
    ↓
Architecture Review (kiips-architect)
    ↓
★ Checkpoint 2: 설계 승인
    ↓
Implementation (kiips-developer + kiips-ui-designer)
    ↓
★ Checkpoint 3: 코드 리뷰 통과
    ↓
Testing & QA (checklist-generator)
    ↓
★ Checkpoint 4: 테스트 통과
    ↓
Integration (Primary Coordinator)
    ↓
★ Checkpoint 5: 통합 검증
```

**Manager의 역할**:
- 각 단계 완료 여부 확인
- 체크포인트 통과 조건 검증
- 실패 시 이전 단계로 피드백
- 최종 통합 전 Primary에게 승인 요청

### Pattern 2: Dev Docs 3-File System

**목적**: 기능 개발 과정의 모든 컨텍스트 추적

```
dev/active/{feature-name}/
├─ plan.md       (구현 계획, Phase별 작업)
├─ context.md    (기술적 배경, 의사결정 근거)
└─ tasks.md      (진행 상황, 블로커, 완료 체크)
```

**Manager의 책임**:
- Phase 전환 시 plan.md 업데이트
- 주요 의사결정 시 context.md 기록
- 매일 tasks.md 진행 상황 업데이트
- 완료 후 dev/completed/로 이동

### Pattern 3: Parallel Implementation Coordination

**목적**: Backend와 Frontend 동시 개발로 시간 단축

```
Architecture Review 완료
    ↓
Manager: 작업 분해 (Backend + Frontend)
    ↓
Worker-1: API 개발 (kiips-developer)     ┐
Worker-2: JSP 화면 개발 (kiips-ui-designer) ├─ 병렬 실행
    ↓
Manager: 통합 테스트 조정
    ↓
통합 완료 (API ↔ UI 연동 검증)
```

**조정 로직**:
- Backend API 스펙 먼저 확정 (계약 정의)
- Frontend는 Mock 데이터로 독립 개발
- 통합 시점에 실제 API 연결 및 검증

### Pattern 4: Quality Gate Enforcement

**목적**: 각 단계에서 최소 품질 기준 미달 시 진행 차단

```
Code Review Checkpoint:
  ├─ 코드 컨벤션 준수 (checkstyle)
  ├─ 단위 테스트 커버리지 ≥ 80%
  ├─ 통합 테스트 존재
  ├─ 문서화 완료 (JavaDoc, README)
  └─ FAIL → 개발 단계로 피드백 (재작업)
```

**Manager의 강제 규칙**:
- 체크포인트 통과 전까지 다음 단계 차단
- 실패 원인을 명확히 개발자에게 전달
- 재작업 후 재검증

## Worker Assignment Strategy

### Phase-based Assignment

```
Phase 1: Architecture Design
  → kiips-architect (시스템 설계, 기술 스택 선정)

Phase 2: Implementation
  → kiips-developer (Backend API)
  → kiips-ui-designer (Frontend JSP/RealGrid)

Phase 3: Code Review & Testing
  → kiips-developer (단위 테스트, 통합 테스트)
  → checklist-generator (QA 체크리스트)

Phase 4: Integration
  → Primary Coordinator (최종 통합 및 배포 승인)
```

### Multi-Phase Coordination

```
Manager: Phase별 진행 상황 추적
  Phase 1: Architecture Design [✓ Completed]
  Phase 2: Implementation [⚡ In Progress - 65%]
    ├─ Backend API: 80% (kiips-developer)
    └─ Frontend UI: 50% (kiips-ui-designer)
  Phase 3: Testing [⏳ Pending]
  Phase 4: Integration [⏳ Pending]
```

## Quality Checkpoints

### Checkpoint 1: Requirements Clarity

**검증 항목**:
- ✓ 기능 목표가 명확한가? (What, Why, Who)
- ✓ 성공 기준이 측정 가능한가? (KPI, Metrics)
- ✓ 제약사항이 문서화되었는가? (기술적, 비즈니스적)
- ✓ 우선순위가 결정되었는가? (P0 ~ P3)

**통과 조건**: 모든 항목 ✓ + Primary 승인

### Checkpoint 2: Architecture Approval

**검증 항목**:
- ✓ 시스템 컴포넌트 다이어그램 존재
- ✓ API 스펙 정의 (엔드포인트, 요청/응답 구조)
- ✓ 데이터베이스 스키마 설계 (ERD)
- ✓ 기존 패턴 준수 (KiiPS 아키텍처 가이드라인)
- ✓ 보안 고려사항 (인증, 권한, XSS 방지)

**통과 조건**: kiips-architect 승인 + 설계 문서 완성

### Checkpoint 3: Code Review Pass

**검증 항목**:
- ✓ 코드 컨벤션 준수 (Java Code Style, JSP Best Practices)
- ✓ 단위 테스트 커버리지 ≥ 80%
- ✓ 통합 테스트 존재 (API 엔드포인트 테스트)
- ✓ GlobalExceptionHandler 활용 (에러 처리)
- ✓ Lucy XSS Filter 적용 (UI 보안)
- ✓ 문서화 (JavaDoc, 주석)

**통과 조건**: 자동화 테스트 통과 + 수동 코드 리뷰 승인

### Checkpoint 4: Testing Pass

**검증 항목**:
- ✓ 단위 테스트 모두 통과
- ✓ 통합 테스트 모두 통과
- ✓ API 테스트 (Postman/curl)
- ✓ UI 반응형 검증 (kiips-responsive-validator)
- ✓ 접근성 검증 (kiips-a11y-checker)
- ✓ 크로스브라우저 테스트 (Chrome, Edge, Safari)

**통과 조건**: 모든 테스트 PASS + QA 체크리스트 완료

### Checkpoint 5: Integration Validation

**검증 항목**:
- ✓ API Gateway 라우팅 설정 완료
- ✓ 서비스 간 통신 검증 (FD ↔ COMMON ↔ UTILS)
- ✓ 배포 스크립트 검증 (start.sh, stop.sh)
- ✓ 로그 정상 출력 (no ERROR/Exception)
- ✓ 성능 기준 충족 (응답 시간 < 3초)

**통과 조건**: Primary Coordinator 최종 승인

## Progress Tracking

Manager는 각 Phase의 진행 상황을 추적하고 Primary에게 보고합니다:

```javascript
phaseProgress = {
  'phase1-architecture': { status: 'completed', progress: 100, duration: '2 days' },
  'phase2-implementation': { status: 'in_progress', progress: 65, workersActive: 2 },
  'phase3-testing': { status: 'pending', progress: 0 },
  'phase4-integration': { status: 'pending', progress: 0 }
}

overallProgress = (100 + 65 + 0 + 0) / 4 = 41% // 전체 진행률
```

## Escalation Triggers

Manager가 Primary에게 에스컬레이션하는 조건:

1. **Architectural Conflicts**
   - 새 패턴이 기존 아키텍처와 충돌
   - 기술 스택 변경 필요 (예: 새 라이브러리 도입)

2. **Quality Gate Failures (3회 이상)**
   - 동일 체크포인트 3회 연속 실패
   - 근본 원인 분석 필요

3. **Scope Creep**
   - 요구사항이 개발 중 크게 변경됨
   - 일정 또는 리소스 재조정 필요

4. **Cross-Module Changes**
   - KiiPS-COMMON, KiiPS-UTILS 수정 필요
   - Primary 전용 권한 필요

## Dev Docs Management

### plan.md Structure

```markdown
# Feature Name: 펀드 목록 조회 페이지

## Overview
- 목표: 펀드 정보를 RealGrid로 표시
- 우선순위: P1 (High)
- 담당: kiips-developer, kiips-ui-designer

## Phases
### Phase 1: Architecture Design [✓ Completed]
- API 스펙: GET /api/funds/list
- UI 스펙: JSP + RealGrid 2.8.8

### Phase 2: Implementation [⚡ In Progress - 65%]
- Backend: FundController, FundService, FundDAO (80%)
- Frontend: fund-list.jsp, fund-list.js (50%)

### Phase 3: Testing [⏳ Pending]
### Phase 4: Integration [⏳ Pending]
```

### context.md Structure

```markdown
# Technical Context: 펀드 목록 조회

## Key Decisions
1. RealGrid 사용 결정
   - 이유: Excel export, 대용량 데이터 처리
   - 대안: DataTables (기각 - 성능 이슈)

2. 페이지네이션 전략
   - 방식: Server-side pagination (성능)
   - 이유: 펀드 데이터 10만+ rows 예상

## Technical Background
- KiiPS-FD 모듈에 포함
- KiiPS-UTILS의 FundDAO 재사용
- COMMON의 Common_API_Service로 다른 서비스 호출
```

### tasks.md Structure

```markdown
# Tasks: 펀드 목록 조회

## In Progress
- [⚡ 65%] Backend API 개발 (kiips-developer)
  - [✓] FundController 작성
  - [✓] FundService 로직 구현
  - [⏳] FundDAO 쿼리 최적화 (진행 중)

- [⚡ 50%] Frontend UI 개발 (kiips-ui-designer)
  - [✓] fund-list.jsp 레이아웃
  - [⏳] RealGrid 초기화 (진행 중)
  - [ ] Excel export 기능

## Blockers
- ❌ FundDAO 쿼리 성능 이슈 (5초 → 1초로 개선 필요)

## Completed
- [✓] API 스펙 정의
- [✓] UI 설계 (Wireframe)
```

## Example Workflows

### Workflow 1: 신규 기능 개발 (펀드 목록 조회)

```
User: "펀드 목록 조회 페이지를 만들어줘. RealGrid로 표시하고 엑셀 다운로드 기능 추가해줘."

feature-manager:
  1. Requirements Clarity (Checkpoint 1)
     - 기능 목표: 펀드 정보 조회 + Excel export
     - 성공 기준: 응답 시간 < 3초, 10만 rows 처리
     - 제약사항: RealGrid 2.8.8 사용 필수
     - ✓ PASS

  2. Architecture Design (Phase 1)
     - kiips-architect 할당
     - 설계 결과:
       - Backend: FundController (GET /api/funds/list)
       - Frontend: fund-list.jsp + RealGrid
       - Database: FundDAO (KiiPS-UTILS 재사용)
     - ★ Checkpoint 2: 설계 승인 ✓

  3. Implementation (Phase 2)
     - Worker-1 (kiips-developer): Backend API 개발 (80%)
     - Worker-2 (kiips-ui-designer): JSP + RealGrid (50%)
     - Dev Docs 업데이트 (plan.md, tasks.md)

  4. Parallel Progress Monitoring
     - 진행률: Backend 80%, Frontend 50% → Overall 65%
     - Blocker 발견: FundDAO 쿼리 성능 이슈 (5초)
     - 해결: 인덱스 추가, 쿼리 최적화 (1.2초로 개선)

  5. Code Review (Phase 3)
     - ★ Checkpoint 3: 코드 리뷰
       - 단위 테스트 커버리지: 85% ✓
       - GlobalExceptionHandler 활용 ✓
       - Lucy XSS Filter 적용 ✓
     - PASS

  6. Testing & QA (Phase 3)
     - API 테스트: curl GET /api/funds/list → 200 OK ✓
     - UI 반응형 검증 (kiips-responsive-validator) ✓
     - 접근성 검증 (kiips-a11y-checker) ✓
     - Excel export 테스트 ✓
     - ★ Checkpoint 4: 테스트 통과 ✓

  7. Integration (Phase 4)
     - Primary에게 통합 요청
     - API Gateway 라우팅 설정
     - 배포 스크립트 검증
     - ★ Checkpoint 5: 통합 검증 ✓

  8. Dev Docs Archiving
     - dev/active/fund-list/ → dev/completed/fund-list/
     - 완료 시각: 2026-01-05 14:30
```

### Workflow 2: Quality Gate 실패 (코드 리뷰 미통과)

```
feature-manager:
  Phase 2 완료 후 Checkpoint 3 (Code Review) 진입

  체크리스트 검증:
    ✓ 코드 컨벤션 준수
    ✗ 단위 테스트 커버리지: 65% (기준 80% 미달)
    ✓ 통합 테스트 존재
    ✗ GlobalExceptionHandler 미사용 (비즈니스 예외 직접 throw)
    ✓ 문서화

  결과: FAIL (2개 항목 미달)

  Manager 액션:
    1. 개발자에게 피드백
       - "단위 테스트 15% 추가 작성 필요"
       - "GlobalExceptionHandler로 예외 처리 통합 필요"

    2. Phase 2로 롤백 (재작업)

    3. 재작업 완료 후 Checkpoint 3 재검증
       ✓ 단위 테스트 커버리지: 82%
       ✓ GlobalExceptionHandler 적용

    4. PASS → Phase 3 진행
```

### Workflow 3: 병렬 개발 조정 (Backend + Frontend)

```
feature-manager:
  Architecture Design 완료 후 작업 분해:

  Backend 작업:
    - FundController (GET /api/funds/list)
    - FundService (비즈니스 로직)
    - FundDAO (쿼리 최적화)

  Frontend 작업:
    - fund-list.jsp (JSP 레이아웃)
    - fund-list.js (RealGrid 초기화)
    - fund-list.scss (스타일)

  병렬 실행:
    Worker-1 (kiips-developer): Backend
    Worker-2 (kiips-ui-designer): Frontend (Mock 데이터 사용)

  Manager 조정:
    - API 스펙 계약 먼저 확정 (JSON 구조)
    - Frontend는 Mock 데이터로 독립 개발
    - Backend 완료 후 실제 API 연결
    - 통합 테스트 실행 (API ↔ UI)

  결과:
    - Backend: 3일 소요
    - Frontend: 2.5일 소요 (동시 진행)
    - 총 소요: 3일 (순차 진행 시 5.5일 대비 45% 단축)
```

## Related Skills

- **kiips-feature-planner**: Manager가 이 스킬을 활용하여 Feature 계획 수립
- **checklist-generator**: 각 체크포인트에서 QA 체크리스트 생성
- **kiips-maven-builder**: Phase 2 완료 후 빌드 검증
- **kiips-ui-component-builder**: Frontend 개발 시 UI 컴포넌트 생성

## Best Practices

1. **체크포인트 엄격 준수**: 통과 전까지 다음 단계 차단
2. **Dev Docs 실시간 업데이트**: 진행 상황, 블로커, 의사결정 기록
3. **병렬 개발 활용**: Backend와 Frontend 동시 진행으로 시간 단축
4. **피드백 루프 빠르게**: 실패 시 즉시 이전 단계로 피드백
5. **Primary 승인 필수**: 최종 통합 전 반드시 Primary에게 승인 요청

---

**Manager**: feature-manager
**Managed Skills**: kiips-feature-planner, checklist-generator
**Delegates To**: kiips-architect, kiips-developer, kiips-ui-designer, checklist-generator
**Key Value**: 구조화된 라이프사이클, 품질 체크포인트 강제, dev docs 자동화
