---
name: feature-planner
description: Creates phase-based feature plans with quality gates and incremental delivery structure. Use when planning features, organizing work, breaking down tasks, creating roadmaps, or structuring development strategy. Keywords: plan, planning, phases, breakdown, strategy, roadmap, organize, structure, outline.
---

# Feature Planner

## Purpose

Phase-based 기능 계획 생성. 각 phase가:
- 완전 동작하는 runnable functionality 제공
- Quality gate로 다음 phase 진입 검증
- 사용자 승인 후 작업 시작
- 마크다운 체크박스로 진척 추적
- 1-4시간 분량 (그 이상이면 더 분할)

## Planning Workflow

### Step 1 — Requirements Analysis
1. 관련 파일 읽어 아키텍처 파악
2. 의존성·통합 지점 식별
3. 복잡도·리스크 평가
4. 범위 결정 (small / medium / large)

### Step 2 — Phase Breakdown (TDD 통합)
기능을 3-7 phase로. 각 phase는:
- **Test-First**: 구현 전 테스트 작성
- 1-4시간 이내
- Red-Green-Refactor 사이클
- 측정 가능한 커버리지 목표
- 독립 롤백 가능
- 명확한 성공 기준

Phase 구조:
- Phase Name (deliverable 명시)
- Goal
- **Test Strategy**: 종류·커버리지·시나리오
- Tasks: ① RED ② GREEN ③ REFACTOR
- Quality Gate
- Dependencies
- Coverage Target

TDD 절차 디테일: [references/tdd-and-testing.md](references/tdd-and-testing.md)

### Step 3 — Plan Document
`plan-template.md` 기반으로 `docs/plans/PLAN_<feature-name>.md` 생성:
- Overview & objectives
- Architecture decisions + rationale
- Phase breakdown (checkbox 포함)
- Quality gate checklists
- Risk assessment table
- Rollback strategy per phase
- Progress tracking section
- Notes & learnings

### Step 4 — User Approval (CRITICAL)
`AskUserQuestion`으로 명시적 승인. 미승인 시 plan document 생성 금지.

질문:
- "이 phase breakdown이 프로젝트에 적합한가?"
- "제안된 접근에 우려가 있는가?"
- "plan document를 생성해도 좋은가?"

### Step 5 — Document Generation
1. `docs/plans/` 디렉토리 없으면 생성
2. 모든 체크박스 미체크 상태로 plan 생성
3. 헤더에 quality gate 안내 명시
4. 사용자에게 plan 위치·다음 스텝 안내

## Quality Gate Standards

각 phase 통과 전 검증 항목:

**Build & Compilation**
- [ ] 빌드/컴파일 에러 0
- [ ] 문법 에러 0

**TDD**
- [ ] 테스트가 production 코드보다 먼저 작성됨
- [ ] Red-Green-Refactor 사이클 준수
- [ ] Unit test: 비즈니스 로직 ≥80%
- [ ] Integration test: 핵심 user flow 검증
- [ ] 테스트 suite <5분 실행

**Testing**
- [ ] 기존 테스트 전부 통과
- [ ] 새 기능에 테스트 추가
- [ ] 커버리지 유지/향상

**Code Quality**
- [ ] 린트 에러 0
- [ ] 타입체크 통과
- [ ] 포매팅 일관

**Functionality**
- [ ] 수동 테스트로 기능 동작 확인
- [ ] 기존 기능 회귀 없음
- [ ] 엣지 케이스 테스트됨

**Security & Performance**
- [ ] 새 보안 취약점 없음
- [ ] 성능 저하 없음
- [ ] 자원 사용량 허용 범위

**Documentation**
- [ ] 코드 주석 업데이트
- [ ] 문서 변경 반영

## Progress Tracking Protocol

Plan document 헤더에 삽입:

```markdown
**CRITICAL INSTRUCTIONS**: Phase 완료마다:
1. 완료 체크박스 표시
2. Quality gate 검증 명령 실행
3. 모든 gate 항목 통과 확인
4. "Last Updated" 갱신
5. Notes 섹션에 학습 기록
6. 그 후에만 다음 phase 진행

DO NOT skip quality gates or proceed with failing checks
```

## Phase Sizing

| 규모 | Phase 수 | 시간 | 예 |
|------|---------|------|-----|
| Small | 2-3 | 3-6h | 다크모드 토글, 폼 컴포넌트 |
| Medium | 4-5 | 8-15h | 인증 시스템, 검색 기능 |
| Large | 6-7 | 15-25h | AI 검색+embedding, 실시간 협업 |

## Risk Assessment

리스크 종류:
- **Technical**: API 변경, 성능 이슈, 데이터 마이그레이션
- **Dependency**: 외부 라이브러리 업데이트, 서드파티 가용성
- **Timeline**: 복잡도 unknown, 블로킹 의존성
- **Quality**: 테스트 커버리지 갭, 회귀 가능성

각 리스크별:
- Probability: Low / Medium / High
- Impact: Low / Medium / High
- Mitigation: 구체적 행동 단계

## Rollback Strategy

Phase별 롤백 절차 명시:
- 어떤 코드 변경을 되돌릴지
- 마이그레이션을 어떻게 reverse 할지
- 설정 변경을 어떻게 복원할지
- 어떤 의존성을 제거할지

## 추가 참고

- TDD 워크플로우·테스트 유형·커버리지 명령: [references/tdd-and-testing.md](references/tdd-and-testing.md)
- Plan 템플릿: [plan-template.md](plan-template.md)
