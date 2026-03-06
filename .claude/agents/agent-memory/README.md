# Agent Memory - Self-Evolution System

에이전트가 태스크 수행 중 학습한 패턴, 실패, 성공 경험을 기록하고
미래 태스크에서 참조하는 자기 진화(Self-Evolution) 시스템입니다.

## 구조

```
agent-memory/
  README.md                 # 이 파일
  mobile-ui-specialist.jsonl    # UI 에이전트 학습 기록
  test-automation.jsonl         # 테스트 에이전트 학습 기록
  quality-validator.jsonl       # 품질 검증 에이전트 학습 기록
  shared-learnings.jsonl        # 에이전트 간 공유 학습
```

## 이벤트 스키마

```json
{
  "timestamp": "ISO8601",
  "agentId": "string",
  "eventType": "success | failure | pattern | insight",
  "taskContext": "string (무슨 작업이었는지)",
  "learning": "string (배운 것)",
  "confidence": 0.0-1.0,
  "tags": ["string"],
  "relatedFiles": ["string"]
}
```

## 사용 방법

### 기록 (에이전트가 태스크 완료 시)
에이전트는 태스크 완료 후 `recordLearning()` 함수를 호출하여 학습을 기록합니다.

### 조회 (에이전트가 태스크 시작 시)
에이전트는 태스크 시작 전 `queryLearnings()` 함수로 관련 학습을 조회합니다.

### 정리 (주기적)
confidence 0.3 이하인 오래된 항목은 자동 정리됩니다.

## 연동

- `agentTracer.js` 훅이 에이전트 활동을 추적하여 자동으로 학습 이벤트를 생성할 수 있습니다.
- Primary Agent(Opus)가 에이전트 위임 시 관련 학습을 프롬프트에 포함합니다.
