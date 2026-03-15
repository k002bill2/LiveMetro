---
name: run-eval
description: AI 에이전트 평가 태스크 실행 및 pass@k 지표 계산
allowed-tools: Read, Write, Bash, Glob, Grep
argument-hint: [task-name]
---

# AI Agent Evaluation Runner

AI 에이전트의 성능을 체계적으로 평가하고 pass@k 지표를 계산합니다.

## 사용법

```bash
/run-eval task_ui_001
/run-eval --category ui_component
/run-eval --all
/run-eval task_ui_001 --k=3
/run-eval task_ui_001 --agent=mobile-ui-specialist
```

## 실행 단계

### 1. 태스크 로드

`$ARGUMENTS`에서 태스크 ID 또는 옵션을 파싱합니다:
- task_id: 특정 태스크 ID (예: task_ui_001)
- --category: 카테고리 필터
- --all: 모든 태스크 실행
- --k: 반복 횟수 (기본값: 1)
- --agent: 특정 에이전트 지정 (선택)

### 2. 태스크 정의 로드

`.claude/evals/tasks/` 디렉토리에서 YAML 파일을 읽습니다:

```bash
cat .claude/evals/tasks/task_ui_001.yaml
grep -l "category: ui_component" .claude/evals/tasks/*.yaml
ls .claude/evals/tasks/*.yaml | grep -v schema | grep -v _templates
```

### 3. 평가 실행

eval-task-runner 에이전트를 호출하여 평가를 실행합니다.

### 4. 결과 저장

`.claude/evals/results/{date}/` 디렉토리에 결과를 저장합니다.

### 5. 요약 출력

```
# 평가 결과: task_ui_001

## 실행 요약
| 실행 | 점수 | 결과 | 소요시간 |
|------|------|------|----------|
| Run 1 | 0.85 | PASS | 8m 12s |

## 지표
- **pass@1**: 1.00
- **pass@3**: 1.00
- **평균 점수**: 0.74
- **성공률**: 66.7%
```

## 에러 처리

- **태스크 없음**: "지정된 태스크를 찾을 수 없습니다: {task_id}"
- **타임아웃**: 실행을 FAIL로 기록하고 다음 실행으로 진행
- **에이전트 오류**: 오류를 기록하고 결과에 포함

## 관련 리소스

- [eval-task-runner 에이전트](../agents/eval-task-runner.md)
- [eval-grader 에이전트](../agents/eval-grader.md)
- [태스크 스키마](../evals/tasks/schema.yaml)
