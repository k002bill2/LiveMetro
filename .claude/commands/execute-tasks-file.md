---
description: dev/active phase의 tasks.md를 frontmatter 기반으로 자동 실행합니다.
---

# Execute Tasks File

`dev/active/<phase>/*-tasks.md` 의 YAML frontmatter와 본문 체크박스를 **네이티브로** 읽어
태스크를 서브에이전트에게 디스패치합니다. (외부 러너/스크립트 의존 없음 — 전부 Claude 네이티브 절차)

## 사용법

```
/execute-tasks-file <phase-dir>
```

예: `/execute-tasks-file dev/active/react-19-migration`

## 전제

1. `<phase-dir>` 에 `*-tasks.md` 또는 `tasks.md` 파일이 있어야 함
2. 파일 앞부분에 YAML frontmatter가 있어야 함. 형식은 `dev/templates/tasks-template.md` 참조.
   주요 필드(실제 LiveMetro tasks.md 스키마):
   - `phase` — phase 식별자
   - `status` — `in-progress` / `completed`
   - `parallelizable` — `true`면 태스크 병렬 디스패치, `false`면 순차
   - `dependencies` — 선행 phase 목록 (비었으면 즉시 실행 가능)
   - `verification` — 완료 후 실행할 검증 명령 리스트 (예: `npx tsc --noEmit`, `npx jest <path>`)
3. 본문의 `- [ ]` / `- [x]` 체크박스가 개별 태스크. 각 태스크 설명은 해당 체크박스 항목(및 하위 들여쓰기)에서 읽는다.

## 동작 절차

1. **Validate** — `<phase-dir>`에서 `*-tasks.md`를 찾고 YAML frontmatter 존재를 확인.
   - 파일/frontmatter 부재 시 즉시 중단하고, `dev/templates/tasks-template.md` 형식으로 작성하도록 안내.
2. **Parse (네이티브)** — frontmatter를 Read해 `parallelizable` / `dependencies` / `verification`을 로드.
   본문에서 미완료(`- [ ]`) 체크박스 항목을 태스크 목록으로 수집.
   - `dependencies`에 미완료 선행 phase가 있으면 경고 후 사용자 확인.
3. **Dispatch** — 미완료 태스크를 `superpowers:dispatching-parallel-agents` 스킬로 디스패치.
   - `parallelizable: true` → 동시 디스패치 (기본 최대 3개).
   - `parallelizable: false` → 순차 디스패치.
   - 각 태스크는 체크박스 항목 텍스트 + 하위 세부를 서브에이전트 설명으로 전달.
   - 편집 파일이 겹치면 순차, 안 겹치면 `isolation: "worktree"` 병렬 (CLAUDE.md File Lock 정책).
4. **Checkbox Sync** — 각 배치 완료 후 Edit 툴로 해당 항목을 `- [ ]` → `- [x]`로 갱신하고 저장.
5. **Verification** — 모든 태스크 완료 후:
   - frontmatter `verification` 리스트의 명령을 순서대로 실행.
   - 이어서 `verification-loop` 스킬 호출 (`npx tsc --noEmit` → `npx eslint` → `npx jest` → build). 어느 단계든 실패 시 보고 + 제어권 반환.
6. **재시도** — 실패한 태스크는 같은 배치 내에서 최대 3회 재디스패치. 3회 실패 시 해당 항목은 `- [x]`로 마킹하지 않고, 의존 태스크는 건너뛴다.
7. **완료 제안** — 모든 검증 통과 시 `/commit-push-pr` 제안. phase 디렉토리의 `dev/archive/` 이동은 사용자 확인 후.

## 실패 처리

- frontmatter 부재/파싱 실패 → 무엇이 빠졌는지 보고 + 중단.
- 태스크 3회 실패 → 해당 태스크 `- [x]` 미마킹, 의존 태스크 건너뜀.
- verification 실패 → 어느 단계(tsc/eslint/jest/build)에서 실패했는지 보고 + 사용자에게 제어권 반환.

## 주의

- `gsd:execute-phase`는 건드리지 않음 — 둘은 병행 운영. 장기/복잡 phase는 GSD, 3-파일 시스템의 일상 phase는 이 커맨드.
- 디스패치·재시도·체크박스 동기화는 전부 네이티브 절차 — 외부 러너/스크립트 없음.
- `dev/active/`는 `.gitignore` 대상이라 직접 commit 되지 않음. phase archive 시에만 diff 생성됨.
