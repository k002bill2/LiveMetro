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

## How to Use

Dev Docs 시스템 (`/dev-docs`, `/save-and-compact`)을 통해 세션 간 컨텍스트를 전달합니다.

### 컨텍스트 저장 패턴
```
1. /dev-docs 로 3-파일 시스템 생성 (context, plan, tasks)
2. 작업 중 주요 결정/발견 사항을 dev/active/ 에 기록
3. /save-and-compact 로 컨텍스트 저장 후 compact
4. /resume 으로 이전 세션 컨텍스트 복원
```
