# Commands & Skills Inventory

LiveMetro의 Skills 2.0 three-tier 인벤토리 전체 목록.
CLAUDE.md에서 분리 — 자주 쓰는 커맨드/스킬 라우팅 SSOT는 `.claude/rules/livemetro-workflow.md` 참조.

## Commands (`.claude/commands/`) — 21개, 사용자 `/` 호출

| 커맨드 | 용도 |
|--------|------|
| `/verify-app` | 타입체크 + 린트 + 테스트 + 빌드 검증 |
| `/check-health` | 프로젝트 전체 상태 점검 |
| `/commit-push-pr` | 커밋 → 푸시 → PR 자동화 |
| `/deploy-with-tests` | 검증 후 배포 |
| `/review` | 코드 리뷰 (보안/성능/타입 체크리스트) |
| `/test-coverage` | 커버리지 분석 |
| `/simplify-code` | 복잡도 분석 및 단순화 |
| `/draft-commits` | Conventional Commits 초안 |
| `/start-dev` | Expo dev 서버 시작 |
| `/gemini-review` | Gemini 크로스 리뷰 |
| `/gemini-scan` | Gemini 대규모 분석 |
| `/run-eval` | 평가 태스크 실행 |
| `/eval-dashboard` | 평가 결과 대시보드 |
| `/config-backup` | 설정 백업/복원 |
| `/save-and-compact` | 컨텍스트 저장 + compact |
| `/session-wrap` | 세션 종료 정리 |
| `/resume` | 이전 세션 재개 |
| `/dev-docs` | Dev Docs 시스템 생성 |
| `/update-dev-docs` | Dev Docs 업데이트 |
| `/sync-registry` | 레지스트리 동기화 |
| `/run-workflow` | 워크플로우 실행 |

## Skills (`.claude/skills/`) — 22개, 컨텍스트 기반 on-demand 로드

구현 전 반드시 해당 스킬을 Skill 도구로 호출할 것. 모든 스킬은 Skills 2.0 progressive disclosure 구조(`SKILL.md` ≤500줄 + `references/<topic>.md`)를 따른다.

| 작업 유형 | 스킬 |
|-----------|------|
| React Native/UI/컴포넌트/화면 | `react-native-development` |
| Firebase/Auth/Firestore | `firebase-integration` |
| 테스트/커버리지/TDD | `test-automation` |
| 서울 지하철 API 통합 | `api-integration` |
| 지하철 데이터 정규화/파싱 | `subway-data-processor` |
| 위치 권한/주변역 검색 | `location-services` |
| 푸시 알림/도착 알림 | `notification-system` |
| 구현 완료 검증 | `verification-loop` |
| 기능 계획/페이즈 설계 | `cc-feature-implementer-main` |
| 역정보 조회/역 검색/주변역 | `station-info` |
| 혼잡도/크라우드소싱/히트맵 | `crowdsourced-congestion` |
| 경로 탐색/요금 계산/환승 | `route-fare-calculation` |
| 통계/분석/차트/대시보드 | `statistics-analytics` |
| 테마/다크모드/다국어/i18n | `theme-i18n-system` |
| TTS/사운드/진동/접근성 | `audio-accessibility` |
| 신뢰도/평판/뱃지/사기탐지 | `user-trust-reputation` |
| 성능 모니터링/헬스체크/크래시 | `monitoring-observability` |
| 에이전트 실패 진단/개선 | `agent-improvement` |
| 에이전트 트레이싱/메트릭 | `agent-observability` |
| AOS Dashboard (React 웹) 구현 | `react-web-development-aos` |
| Git worktree 머지 자동화 | `merge-worktree` |
| 에이전트 평가 실행 (pass@k) | `run-eval` |

## Rules (`.claude/rules/`) — 항상 로드

CLAUDE.md "Project Rules" 섹션 참조.
