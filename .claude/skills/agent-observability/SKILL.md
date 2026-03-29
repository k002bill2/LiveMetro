---
name: agent-observability
description: Production tracing and metrics for multi-agent workflows. Track agent decisions, tool calls, and performance without monitoring conversation content.
---

# Agent Observability Skill

멀티 에이전트 워크플로우의 모니터링 및 성능 분석 가이드.

## When to Use

- 에이전트 실행 성능 분석 필요 시
- 병렬 에이전트 작업의 모니터링/디버깅
- 에이전트 추천 정확도 개선

## How to Use

### 에이전트 성능 추적

Agent tool 실행 결과와 소요 시간을 기반으로 성능을 분석합니다.

### 모니터링 포인트

- 에이전트 스폰 → 완료 시간
- 도구 호출 횟수 및 성공률
- 병렬 실행 시 워크트리 격리 상태

### 통합

- `/eval-dashboard` → 평가 결과 시각화
- `/run-eval` → 에이전트 평가 태스크 실행
