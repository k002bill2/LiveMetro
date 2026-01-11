# Eval System v2.0 Enhancement - Context

**Last Updated**: 2026-01-11 20:15 KST
**Status**: Completed
**Priority**: High

## Overview

Anthropic 블로그 "Demystifying Evals for AI Agents" 기반으로 에이전트 평가 시스템을 v2.0으로 강화하고 전체 테스트 수행

## Final State

### Eval System Version
- **Before**: 1.0 (code + llm 그레이더)
- **After**: 2.0 (6종 그레이더, 양방향 테스트, 포화도 모니터링)

### Test Results
- **Total Tasks**: 5
- **Pass Rate**: 100% (5/5)
- **Average Score**: 0.92

## Session Summary

### 2026-01-11 20:15 (Eval 시스템 설명)

**완료 작업**:
1. Eval 시스템 전체 구조 설명
   - 실행 방식 (`/run-eval` 커맨드)
   - 흐름도 (task-runner → grader → 결과)
   - 6종 그레이더, 양방향 테스트, pairwise 비교

**블로커**: 없음

**다음**: Complex 태스크 실행 또는 service-implementation 재테스트

---

### 2026-01-11 19:30 (Rate Limiter 수정 완료)

**완료 작업**:
1. Eval 테스트 실행
   - Quick Test (3 simple tasks): 100% PASS
   - Moderate Test: service-implementation FAIL (0.72) - Rate limiting 누락 발견
   - task_res_001: READY (0.85) - 태스크 설계 검증 완료

2. seoulSubwayApi.ts Rate Limiter 추가
   - `RateLimiter` 클래스 추가 (30초 최소 간격)
   - `withRetry` 함수 추가 (지수 백오프, 최대 3회)
   - 모든 API 메서드에 rate limiting 적용
   - 테스트 25개 모두 통과

3. 핵심 발견:
   - Eval 시스템이 실제 코드 이슈 발견 (rate limiting 누락)
   - Moderate 난이도에서 의미 있는 차별화 확인

**블로커**: 없음

**Modified Files**:
- `src/services/api/seoulSubwayApi.ts` - RateLimiter, withRetry 추가
- `src/services/api/__tests__/seoulSubwayApi.test.ts` - 테스트 업데이트

---

### 2026-01-11 17:55 (State Check 테스트 완료)

**완료 작업**:
1. State Check 그레이더 테스트 태스크 생성
   - `task_state_001.yaml` - 파일 상태 검증 테스트
   - 검증 항목: exists, contains, not_contains, min_lines
   - 실제 파일 (LoadingScreen.tsx, ErrorBoundary.tsx) 사용

2. 테스트 특징:
   - 그레이더 전용 태스크 (에이전트 실행 없음)
   - 3개 파일 검증 (2개 존재, 1개 미존재)
   - 금지 패턴 검사 포함

**블로커**: 없음

---

### 2026-01-11 17:45 (Pairwise Comparison 설정)

**완료 작업**:
1. Pairwise 비교 설정 파일 생성
   - `config.yaml` - 기본 설정 (runs, metrics, thresholds)
   - `sonnet-vs-opus.yaml` - 모델 비교 시나리오

2. 설정 특징:
   - quick/standard/full 테스트 세트
   - 가설 검증 (Opus가 복잡한 태스크에서 우수한가?)
   - 비용 추정 포함
   - 실행 커맨드 가이드

**블로커**: 없음

---

### 2026-01-11 17:35 (Research Tasks 추가)

**완료 작업**:
1. Research 카테고리 태스크 2개 생성
   - `task_res_001.yaml` - Seoul Metro API 문서 조사 (moderate)
   - `task_res_002.yaml` - RN 성능 최적화 연구 (complex)

2. 태스크 특징:
   - research-agent 루브릭 적용 (근거성 30%, 완전성 25% 등)
   - WebSearch/WebFetch 필수 도구 지정
   - 출처 인용 요구사항 (min_sources, tier1_sources)
   - must_fail: unverified_claims, no_official_docs
   - forbidden_patterns: "출처 불명", "것 같습니다"

**블로커**: 없음

---

### 2026-01-11 17:25 (Complex Tasks 추가)

**완료 작업**:
1. Complex 난이도 태스크 3개 생성
   - `task_ref_001.yaml` - DataManager 모듈화 리팩토링
   - `task_ref_002.yaml` - 알림 서비스 중복 로직 통합
   - `task_perf_001.yaml` - useNotifications 훅 성능 최적화

2. 태스크 특징:
   - 다양한 그레이더 조합 (code + llm + static_analysis + transcript)
   - constraints 섹션 활용 (max_turns, max_tool_calls)
   - must_fail, forbidden_patterns 양방향 테스트 포함
   - 실제 프로젝트 파일 기반 (563줄 dataManager.ts 등)

**블로커**: 없음

---

### 2026-01-11 16:00 (Eval System v2.0)

**완료 작업**:
1. schema.yaml v2.0 확장
   - 새 그레이더 타입: state_check, transcript, static_analysis
   - 양방향 테스트: must_fail, forbidden_patterns
   - constraints 섹션 추가

2. 새 그레이더 파일 생성
   - `graders/state-check.md` - 백엔드/파일 상태 검증
   - `graders/transcript-analysis.md` - 행동 패턴 분석
   - `graders/static-analysis.md` - ruff, mypy, eslint 통합

3. 에이전트별 루브릭 추가
   - `rubrics/coding-agent.md` - 코딩 에이전트용
   - `rubrics/research-agent.md` - 연구 에이전트용 (근거성 검사)

4. 에이전트 파일 업데이트
   - `eval-grader.md` v2.0 - 6종 그레이더, 양방향 테스트
   - `eval-task-runner.md` v2.0 - 포화도 모니터링, pairwise, 회귀 탐지

5. 네거티브 테스트 태스크
   - `task_neg_001.yaml` - API 키 하드코딩 거부
   - `task_neg_002.yaml` - any 타입 사용 거부

6. 전체 테스트 실행 (5개 태스크)
   - 네거티브 테스트 2개: PASS
   - UI 컴포넌트: PASS
   - 서비스 구현: PASS
   - 버그 수정: PASS (already_fixed)

**블로커**: 없음

## Modified Files

### Schema & Graders
- `.claude/evals/tasks/schema.yaml` - v2.0
- `.claude/evals/graders/state-check.md` - NEW
- `.claude/evals/graders/transcript-analysis.md` - NEW
- `.claude/evals/graders/static-analysis.md` - NEW

### Rubrics
- `.claude/evals/rubrics/coding-agent.md` - NEW
- `.claude/evals/rubrics/research-agent.md` - NEW

### Agents
- `.claude/agents/eval-grader.md` - v2.0
- `.claude/agents/eval-task-runner.md` - v2.0

### Tasks
- `.claude/evals/tasks/_templates/negative-test.yaml` - NEW
- `.claude/evals/tasks/negative/task_neg_001.yaml` - NEW
- `.claude/evals/tasks/negative/task_neg_002.yaml` - NEW
- `.claude/evals/tasks/advanced/task_ref_001.yaml` - NEW (complex)
- `.claude/evals/tasks/advanced/task_ref_002.yaml` - NEW (complex)
- `.claude/evals/tasks/advanced/task_perf_001.yaml` - NEW (complex)
- `.claude/evals/tasks/research/task_res_001.yaml` - NEW (research)
- `.claude/evals/tasks/research/task_res_002.yaml` - NEW (research)

### Pairwise
- `.claude/evals/pairwise/config.yaml` - NEW
- `.claude/evals/pairwise/sonnet-vs-opus.yaml` - NEW

### Test
- `.claude/evals/tasks/test/task_state_001.yaml` - NEW (state_check)

### Results
- `.claude/evals/results/2026-01-11/summary.json` - NEW

## Key Insights

1. **양방향 테스트 작동 확인**: 에이전트가 잘못된 요청을 적절히 거부
2. **CLAUDE.md 규칙 인식**: 에이전트가 프로젝트 규칙을 인용하며 거부
3. **포화도 경고**: 모든 태스크 100% → 더 어려운 태스크 필요

## Next Steps

1. [x] 더 어려운 평가 태스크 추가 (복잡한 리팩토링, 성능 최적화) ✅
2. [x] research 카테고리 태스크 추가 (근거성 검사 루브릭 검증) ✅
3. [x] pairwise comparison 테스트 설정 (sonnet vs opus) ✅
4. [x] state_check 그레이더 실제 테스트 (파일 상태 검증) ✅
5. [x] Moderate 테스트로 포화도 확인 (0.72 점수로 차별화 확인) ✅
6. [x] Rate Limiter 이슈 수정 (seoulSubwayApi.ts) ✅
7. [ ] service-implementation 태스크 재실행 (rate limiter 수정 후)
8. [ ] Complex 태스크 실행 테스트

## Final Summary

모든 확장 작업 완료:
- **태스크 총 12개**: 기존 5개 + complex 3개 + research 2개 + negative 2개
- **그레이더 6종**: code, llm, human, state_check, transcript, static_analysis
- **pairwise 설정**: sonnet vs opus 비교 준비 완료
- **테스트 카테고리**: negative, research, test 추가

## Reference

- Anthropic Blog: https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents
- Results: `.claude/evals/results/2026-01-11/summary.json`
