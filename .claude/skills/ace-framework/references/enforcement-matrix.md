# ACE Enforcement Matrix

ACE Framework 4-Pillar 기반 훅 시행 매트릭스.
`aceMatrixSync.js`가 settings.json 훅 수와 P2 행 수를 비교하여 drift를 감지합니다.

## P2: Hard Constraints (Hooks)

| ID | 훅 | 이벤트 | 매처 | 설명 |
|----|-----|--------|------|------|
| P2-001 | ethicalValidator.js | PreToolUse | Bash | 위험 명령 차단 (rm -rf, force push, 하드코딩 키) |
| P2-002 | parallelCoordinator.js (pre) | PreToolUse | Task | 병렬 에이전트 파일 락, HITL 분류 |
| P2-003 | geminiAutoTrigger.js | PostToolUse | Edit\|Write | 코드 변경 시 30초 debounce 후 Gemini 리뷰 큐잉 |
| P2-004 | aceMatrixSync.js | PostToolUse | Edit\|Write | 이 매트릭스와 settings.json 동기화 검사 |
| P2-005 | outputSecretFilter.sh | PostToolUse | Bash | Bash 출력에서 API키/토큰 자동 마스킹 |
| P2-006 | agentTracer.js | PostToolUse | Task | 에이전트 활동 추적 (JSONL 이벤트 로그) |
| P2-007 | parallelCoordinator.js (post) | PostToolUse | Task | 에이전트 완료 후 정리, 락 해제 |
| P2-008 | userPromptSubmit.js | UserPromptSubmit | * | 스킬/에이전트 자동 활성화, Gemini 리뷰 결과 주입 |
| P2-009 | Path protection (inline) | PreToolUse | Edit\|Write | .env, secrets, google-services.json 등 보호 |
| P2-010 | Notification (inline) | Notification | * | macOS 알림 표시 |
| P2-011 | SessionEnd cleanup (inline) | SessionEnd | * | active-locks.json + parallel-state.json 초기화 |

## P1: Soft Constraints (Prompts)

| ID | 제약 | 출처 |
|----|------|------|
| P1-001 | TypeScript strict, no `any` | CLAUDE.md |
| P1-002 | Seoul API 30초 최소 폴링 | CLAUDE.md |
| P1-003 | useEffect cleanup 필수 | CLAUDE.md |
| P1-004 | 에러 시 빈 배열/null 반환 | CLAUDE.md |
| P1-005 | 경로 별칭 사용 | CLAUDE.md |

## P3: Boundaries (Workspace Isolation)

| ID | 경계 | 구현 |
|----|------|------|
| P3-001 | 파일 레벨 충돌 방지 | file-lock-manager.js |
| P3-002 | 에이전트 워크트리 격리 | Agent tool `isolation: "worktree"` |
| P3-003 | sandbox 파일시스템 제한 | settings.local.json sandbox 설정 |

## P4: Optimization (Analytics)

| ID | 최적화 | 구현 |
|----|--------|------|
| P4-001 | 에이전트 실행 메트릭 | feedback-loop.js |
| P4-002 | 태스크 추천 | task-allocator.js |
| P4-003 | 체크포인트 관리 | checkpoint-manager.js |
| P4-004 | Gemini 크로스 리뷰 | gemini-bridge.js |
| P4-005 | 매트릭스 drift 감지 | aceMatrixSync.js |
