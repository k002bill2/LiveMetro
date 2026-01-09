---
description: Create comprehensive dev docs for planning and tracking development tasks
---

# Dev Docs 생성

대규모 작업을 위한 3-파일 시스템 Dev Docs를 생성합니다.

## Instructions

승인된 계획을 기반으로 다음 3개 문서를 생성하세요:

### 1. Plan 문서 생성
`dev/active/[task-name]/[task-name]-plan.md` 생성:
- 승인된 전체 계획 복사
- 타임라인 및 단계 추가
- 성공 지표 포함

### 2. Context 문서 생성
`dev/active/[task-name]/[task-name]-context.md` 생성:
- 관련 파일 목록
- 주요 아키텍처 결정 사항 문서화
- 제약 조건 또는 의존성 기록
- "다음 단계" 섹션 추가
- 마지막 업데이트 타임스탬프

### 3. Tasks 문서 생성
`dev/active/[task-name]/[task-name]-tasks.md` 생성:
- 계획을 상세 체크리스트로 변환
- 컴포넌트/서비스별 그룹화
- 체크박스 형식 사용: `- [ ]`, `- [x]`
- 가능하면 예상 시간 추가

## Output Format

```
dev/active/[task-name]/
├── [task-name]-plan.md     # 승인된 계획
├── [task-name]-context.md  # 핵심 결정사항 및 파일 목록
└── [task-name]-tasks.md    # 상세 체크리스트
```

## Example Usage

```
/dev-docs user-dashboard
```

결과:
```
dev/active/user-dashboard/
├── user-dashboard-plan.md
├── user-dashboard-context.md
└── user-dashboard-tasks.md
```
