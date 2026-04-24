# AI Agent Evaluation System

AI 에이전트의 성능을 체계적으로 평가하고 pass@k 지표를 계산하는 시스템입니다.

## 디렉토리 구조

```
.claude/evals/
├── README.md           # 이 파일
├── tasks/              # 태스크 정의
│   ├── schema.yaml     # 태스크 스키마
│   ├── task_ui_001.yaml
│   ├── task_ui_002.yaml
│   ├── task_service_001.yaml
│   ├── task_bug_001.yaml
│   └── task_refactor_001.yaml
├── rubrics/            # 평가 루브릭
│   ├── ui_component.yaml
│   ├── service.yaml
│   └── bug_fix.yaml
└── results/            # 평가 결과 (날짜별)
    └── {YYYY-MM-DD}/
        ├── task_*.json
        └── summary.json
```

## 사용법

```bash
# 단일 태스크 평가
/run-eval task_ui_001

# 카테고리별 평가
/run-eval --category ui_component
/run-eval --category service
/run-eval --category bug_fix
/run-eval --category refactor

# 전체 평가
/run-eval --all

# pass@k 계산 (k번 반복)
/run-eval task_ui_001 --k=3
/run-eval --all --k=3

# 특정 에이전트로 실행
/run-eval task_ui_001 --agent=mobile-ui-specialist
```

## 태스크 카테고리

| 카테고리 | 설명 | 예시 |
|----------|------|------|
| `ui_component` | React UI 컴포넌트 생성 | AgentCard, Pagination |
| `service` | Backend API/서비스 구현 | CRUD 엔드포인트 |
| `bug_fix` | 버그 수정 | 무한 리렌더링 수정 |
| `refactor` | 코드 리팩토링 | Store 분리 |
| `api` | API 통합 | 외부 API 연동 |
| `test` | 테스트 작성 | 테스트 커버리지 향상 |

## 평가 지표

### pass@k
k번의 시도 중 최소 1회 이상 성공할 확률

```
pass@k = 1 - C(n-c, k) / C(n, k)

n: 총 시도 횟수
c: 성공 횟수
k: 샘플 수
```

### 점수 구성
- **코드 검사 (Code Checks)**: 40%
  - 파일 존재 여부
  - 테스트 파일 존재
  - 타입스크립트 품질
  - 접근성 준수

- **LLM 평가 (LLM Grading)**: 60%
  - 가독성
  - 아키텍처
  - 유지보수성
  - 성능
  - 보안

## 루브릭

### ui_component.yaml
React/TypeScript UI 컴포넌트 평가 기준

### service.yaml
Backend 서비스 및 API 평가 기준

### bug_fix.yaml
버그 수정 태스크 평가 기준

## 태스크 정의 예시

```yaml
id: task_ui_001
name: "AgentCard 컴포넌트 생성"
category: ui_component
difficulty: medium

description: |
  에이전트 정보를 표시하는 AgentCard 컴포넌트를 생성합니다.

acceptance_criteria:
  - TypeScript로 작성
  - Tailwind CSS 스타일링
  - 테스트 파일 포함

input:
  prompt: "에이전트 정보를 표시하는 AgentCard 컴포넌트를 생성해주세요."
  context_files:
    - src/dashboard/src/types/index.ts

expected_output:
  files:
    - src/dashboard/src/components/agents/AgentCard.tsx
    - src/dashboard/src/components/agents/AgentCard.test.tsx
  patterns:
    - "interface.*Props"
    - "export.*AgentCard"
  forbidden_patterns:
    - ": any"

evaluation:
  timeout_minutes: 15
  rubric: ui_component.yaml
  weights:
    code_checks: 40
    llm_grading: 60
  passing_score: 0.7

metadata:
  created_at: 2025-01-28
  author: system
  tags: [react, component, ui]
  recommended_agent: mobile-ui-specialist
```

## 결과 형식

### 단일 실행 결과

```json
{
  "task_id": "task_ui_001",
  "run_id": "run_001",
  "timestamp": "2025-01-28T10:30:00Z",
  "agent": "mobile-ui-specialist",
  "duration_seconds": 492,
  "result": "PASS",
  "score": 0.85,
  "code_checks": {
    "score": 0.9,
    "details": [...]
  },
  "llm_grading": {
    "score": 0.82,
    "dimensions": {...}
  },
  "feedback": "..."
}
```

### 배치 실행 요약

```json
{
  "batch_id": "batch_20250128",
  "total_tasks": 5,
  "total_runs": 15,
  "pass_at_1": 0.8,
  "pass_at_3": 1.0,
  "average_score": 0.78,
  "by_category": {...},
  "low_performers": [...]
}
```

## 관련 에이전트

- **eval-task-runner**: 평가 태스크 실행 오케스트레이터
- **eval-grader**: 코드 검사 및 LLM 평가 수행

## 새 태스크 추가

1. `tasks/schema.yaml` 참조
2. `tasks/task_{category}_{number}.yaml` 파일 생성
3. 적절한 루브릭 선택 또는 새로 생성
4. `/run-eval {task_id}` 로 테스트

## 정기 실행 (Recommended)

평가 결과는 `results/{YYYY-MM-DD}/`에 누적되며 회귀 추적에 사용됩니다.
**80일 이상 미실행 시** 결과 신뢰도가 떨어지므로 정기 실행을 권장합니다.

### 옵션 A: 수동 트리거 (현재 디폴트)
```bash
# 주요 카테고리 1회씩
/run-eval --category ui_component --k=3
/run-eval --category service --k=3
/run-eval --category bug_fix --k=3
```

### 옵션 B: cron 스케줄 등록 (외부 자원 소모 주의)
`schedule` 스킬로 주간 routine 등록:
```
"매주 금요일 오전 9시에 /run-eval --all --k=3 실행" → schedule 스킬 호출
```
**주의**:
- LLM 채점(60% 비중)이 실제 API 호출 동반 → 비용 발생
- 매주 전체 평가 실행 시 약 30~60분 소요
- 결과는 `/eval-dashboard`로 추세 확인

### 옵션 C: PR 게이트 (추천)
신규 기능 PR 머지 전에 관련 카테고리만 실행:
- UI 컴포넌트 변경 → `/run-eval --category ui_component --k=1`
- API 서비스 변경 → `/run-eval --category service --k=1`
- 비용 ↓, 회귀 탐지 ↑

## 헬스체크

평가 시스템 자체의 정상성 확인:
```bash
# 1. 태스크 정의 파싱 가능 여부
ls .claude/evals/tasks/*.yaml

# 2. 루브릭 존재 확인
ls .claude/evals/rubrics/

# 3. 최근 결과 디렉토리 확인 (가장 최근 날짜)
ls -t .claude/evals/results/ | head -1

# 4. 결과 통계
/eval-dashboard
```
