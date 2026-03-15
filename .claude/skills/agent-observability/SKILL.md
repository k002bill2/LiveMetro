---
name: agent-observability
description: Production tracing and metrics for multi-agent workflows. Track agent decisions, tool calls, and performance without monitoring conversation content.
---

# Agent Observability Skill

멀티 에이전트 워크플로우의 트레이싱, 메트릭, 성능 분석 시스템.

## When to Use

- 에이전트 실행 성능 분석 필요 시
- 병렬 에이전트 작업의 모니터링/디버깅
- 에이전트 추천 정확도 개선

## Resources

- `.claude/hooks/agentTracer.js` - PostToolUse:Task 이벤트 트레이싱 (JSONL)
- `.claude/coordination/feedback-loop.js` - 실행 메트릭 기록/조회
- `.claude/coordination/task-allocator.js` - 에이전트 추천 및 성능 기반 보정

## Tracing Architecture

```
Agent Spawned → agentTracer.js → events.jsonl (세션별)
                                ↓
Agent Completed → agentTracer.js → feedback-loop.js (메트릭 이중 기록)
                                   ↓
                            task-allocator.js (성능 데이터 → 추천 점수 보정)
```

## How to Use

### 메트릭 조회
```javascript
const { feedback } = require('./.claude/coordination');
const summary = feedback.generateMetricsSummary();
// { totalTasks, successRate, avgDuration, recentErrors }

const byAgent = feedback.analyzeAgentPerformance();
// { 'mobile-ui-specialist': { totalTasks, successRate, avgDuration } }
```

### 트레이스 파일 위치
- `.temp/traces/sessions/<sessionId>/events.jsonl` - 이벤트 로그
- `.temp/traces/sessions/<sessionId>/metadata.json` - 세션 메타데이터

## Integration

- `parallelCoordinator.js` → 에이전트 등록/해제 시 parallel-state.json 업데이트
- `agentTracer.js` → 자동 트레이싱 (PostToolUse:Task 훅)
- `task-allocator.js` → 과거 성능 데이터로 에이전트 추천 점수 보정
- `/eval-dashboard` → 평가 결과 시각화
