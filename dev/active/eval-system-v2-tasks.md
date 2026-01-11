# Eval System v2.0 Enhancement - Tasks

**Last Updated**: 2026-01-11 19:30 KST
**Progress**: 12/14 completed (86%)

## Completed Tasks

- [x] schema.yaml v2.0 확장
  - 새 그레이더 타입 (state_check, transcript, static_analysis)
  - 양방향 테스트 (must_fail, forbidden_patterns)
  - constraints 섹션

- [x] 새 그레이더 파일 생성
  - state-check.md (백엔드/파일 상태 검증)
  - transcript-analysis.md (행동 패턴 분석)
  - static-analysis.md (ruff, mypy, eslint)

- [x] 에이전트별 루브릭 추가
  - coding-agent.md
  - research-agent.md

- [x] 에이전트 파일 업데이트
  - eval-grader.md v2.0
  - eval-task-runner.md v2.0

- [x] 네거티브 테스트 태스크 생성
  - task_neg_001.yaml (API 키 거부)
  - task_neg_002.yaml (any 타입 거부)

- [x] 전체 테스트 실행 및 결과 저장
  - 5개 태스크 모두 PASS
  - summary.json 생성

## Pending Tasks

- [x] 더 어려운 평가 태스크 추가
  - task_ref_001.yaml (DataManager 모듈화)
  - task_ref_002.yaml (알림 서비스 통합)
  - task_perf_001.yaml (성능 최적화)
- [x] research 카테고리 태스크 추가
  - task_res_001.yaml (Seoul Metro API 조사)
  - task_res_002.yaml (RN 성능 최적화 연구)
- [x] pairwise comparison 테스트 설정
  - config.yaml (기본 설정)
  - sonnet-vs-opus.yaml (모델 비교 시나리오)
- [x] state_check 그레이더 실제 테스트
  - task_state_001.yaml (파일 상태 검증)
- [x] Eval 테스트 실행 (Quick + Moderate)
  - Quick Test: 3/3 PASS (100%)
  - Moderate Test: 차별화 확인 (0.72 점수)
- [x] seoulSubwayApi Rate Limiter 수정
  - RateLimiter 클래스 (30초 최소 간격)
  - withRetry 함수 (지수 백오프)
  - 25개 테스트 통과

## Remaining Tasks

- [ ] service-implementation 태스크 재실행
- [ ] Complex 태스크 실행 테스트

## Verification

- [x] schema.yaml v2.0 확인
- [x] graders/ 디렉토리 3개 파일 확인
- [x] rubrics/ 디렉토리 2개 파일 추가 확인
- [x] eval-grader.md v2.0 확인
- [x] eval-task-runner.md v2.0 확인
- [x] negative/ 디렉토리 2개 태스크 확인
- [x] 테스트 결과 summary.json 확인
- [x] advanced/ 디렉토리 3개 complex 태스크 확인
- [x] research/ 디렉토리 2개 research 태스크 확인
- [x] pairwise/ 디렉토리 설정 파일 확인
- [x] test/ 디렉토리 state_check 태스크 확인