---
name: external-memory
description: Context persistence system for long-running multi-agent tasks. Saves research plans, findings, and checkpoints to prevent context loss at token limits.
---

# External Memory Skill

장기 실행 태스크에서 컨텍스트 유실을 방지하기 위한 외부 메모리 시스템.

## When to Use

- 대규모 리팩토링 등 여러 세션에 걸친 작업
- 컨텍스트 윈도우 제한에 도달하기 전 상태 보존
- `/save-and-compact` 실행 전 핵심 컨텍스트 저장

## Resources

- `.claude/coordination/checkpoint-manager.js` - 체크포인트 생성/복원/관리
- `.claude/coordination/feedback-loop.js` - 실행 메트릭 및 학습 이벤트 기록

## How to Use

### 체크포인트 저장
```javascript
const { checkpoint } = require('./.claude/coordination');
checkpoint.createCheckpoint({
  agentId: 'primary',
  trigger: 'context_limit',
  description: '리팩토링 Phase 2 완료 상태',
  context: { completedFiles: [...], remainingFiles: [...] }
});
```

### 체크포인트 복원
```javascript
const checkpoints = checkpoint.listCheckpoints(5);
const latest = checkpoint.restoreCheckpoint(checkpoints[0].checkpointId);
```

## Integration

- Dev Docs 시스템 (`/dev-docs`, `/save-and-compact`) - 세션 간 컨텍스트 전달
