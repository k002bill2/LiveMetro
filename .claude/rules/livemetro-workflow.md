# LiveMetro Workflow Rules

## Skill Routing (필수)
구현 전 반드시 해당 스킬을 Skill 도구로 호출:

| 작업 유형 | 스킬 |
|-----------|------|
| RN 화면/컴포넌트 | `react-native-development` |
| Firebase 통합 (Auth/Firestore/Functions) | `firebase-integration` |
| 알림/푸시 | `notification-system` |
| 위치/지도 | `location-services` |
| 지하철 데이터 처리 | `subway-data-processor` |
| 외부 API 호출 | `api-integration` |
| 테스트/커버리지 | `test-automation` |
| 구현 완료 검증 | `verification-loop` |
| 에이전트 평가 | `run-eval` |

## 복잡도별 에이전트 수
| 복잡도 | 에이전트 수 | 기준 |
|--------|------------|------|
| Trivial | 0 | 단일 파일, 명확한 수정 |
| Simple | 1 | 2-3 파일, 한 영역 |
| Moderate | 2-3 | UI+Functions 또는 크로스 영역 (예: 알림 + Firestore + UI) |

## 배포 전 검증 체크리스트
1. `tsc --noEmit` (루트 RN 앱)
2. `cd functions && tsc --noEmit` (Functions 서브프로젝트)
3. `eslint . --max-warnings 0`
4. `jest --coverage` (커버리지 임계값 통과 — `.claude/rules/coverage-thresholds.md` 참조)
5. `expo-doctor` (Expo SDK 호환성)
6. Firestore rules 변경 시 `firebase emulators:exec --only firestore "npm test:rules"`
7. 에러 0 확인 후 커밋

## Dev Docs 3-파일 시스템 (대규모 작업)
```
dev/active/[task-name]/
├── [task-name]-plan.md        # Why + 단계별 계획
├── [task-name]-context.md     # 결정/근거/링크
└── [task-name]-tasks.md       # YAML frontmatter + 체크박스 본문
```

워크플로우: `/dev-docs` → 구현 → `/update-dev-docs` → `/save-and-compact`

`tasks.md` 자동 실행 시 `/execute-tasks-file dev/active/<phase>` 사용.
실행기는 `superpowers:dispatching-parallel-agents`로 디스패치하고 각 웨이브 완료 후
체크박스를 동기화하며, 모든 웨이브 종료 시 `verification-loop`를 호출한다.

## EAS Build & Firebase Deploy 정책
- `main` 브랜치: PR 머지 시 Firebase Functions 자동 배포
- 태그 (`v*.*.*`): EAS Build (Android+iOS) 트리거
- 핫픽스: `chore/hotfix-*` 브랜치에서 작업 → main 머지 후 즉시 태깅
- preview 채널: PR마다 `eas update --channel preview`로 OTA 업데이트

## e2e 테스트 잔여물 방지
- `afterAll`/`afterEach`에서 생성된 리소스(파일, 프로세스, Firestore 데이터) 정리 필수
- 임시 파일은 OS temp 디렉토리 또는 `.gitignore`된 경로에 생성
- Firebase emulator 데이터는 테스트 종료 시 reset
- 스크린샷/녹화는 CI 아티팩트로만 보관, 로컬에 남기지 않음
- 테스트 실행 후 `git status`에 untracked 파일이 생기면 안 됨

## 평가 시스템
에이전트 성능 평가:
- `/run-eval` 스킬로 실행 (`.claude/skills/run-eval/`)
- `eval-task-runner`: 태스크 실행 및 pass@k 계산
- `eval-grader`: 코드 검사 + LLM 루브릭 채점
- 태스크: `.claude/evals/tasks/`, 루브릭: `.claude/evals/rubrics/`
- 결과는 `.claude/evals/results-aos/`(AOS-import 평가) vs `.claude/evals/results/`(LM 자체 평가) 분리
