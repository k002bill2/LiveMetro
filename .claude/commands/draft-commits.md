---
name: draft-commits
description: Git 변경사항 분석 및 Conventional Commits 형식 커밋 초안 생성
allowed-tools: Bash(git *)
argument-hint: [--staged | --all]
---

# Draft Commits - Git 변경사항 분석

Git 변경사항을 분석하여 Conventional Commits 형식으로 커밋 초안을 생성합니다.

## 실행 단계

### 1. 변경사항 수집

```bash
git status --porcelain
git diff --cached --stat
git diff --stat
git log --oneline -5
```

### 2. 파일 그룹화 규칙

변경된 파일을 아래 규칙에 따라 그룹화합니다:

| 경로 패턴 | 그룹명 | 기본 Type |
|----------|--------|-----------|
| `.claude/hooks/` | Claude Hooks | chore(hooks) |
| `.claude/skills/` | Claude Skills | docs(skills) |
| `.claude/commands/` | Claude Commands | docs(commands) |
| `.claude/agents/` | Claude Agents | docs(agents) |
| `.claude/*.json` | Claude Config | chore(config) |
| `src/backend/` | Backend | feat(api/services/models) |
| `src/dashboard/src/pages/` | Dashboard Pages | feat(pages) |
| `src/dashboard/src/components/` | Dashboard Components | feat(components) |
| `tests/` | Tests | test |
| `docs/` | Documentation | docs |
| `infra/` | Infrastructure | chore(infra) |

### 3. Commit Type 결정

- **feat**: 새 기능 추가
- **fix**: 버그 수정
- **refactor**: 리팩토링
- **docs**: 문서 변경
- **test**: 테스트 추가/수정
- **chore**: 설정, 빌드, 의존성 변경
- **style**: 코드 스타일 변경

### 4. 출력 형식

```
COMMIT DRAFT SUMMARY

Overview: Total N files | Staged N | Unstaged N | New N

[그룹명] (N files)
  Suggested Commit: type(scope): 간결한 변경 설명
  Files:
  - file1.ext [M] +N -M
  - file2.ext [A] +N

QUICK ACTIONS
  Single commit: type: 전체 변경사항 요약
  Group commits: /commit-push-pr 사용하여 그룹별 개별 커밋
```

## 커밋 메시지 가이드라인

- Subject 50자 이내, 첫 글자 소문자, 마침표 없음, 명령형 사용
- Scope: 영향받는 영역 (api, ui, hooks, config 등)

## 연계 명령어

- `/commit-push-pr` - 실제 커밋 및 PR 생성
- `/verify-app` - 커밋 전 검증

$ARGUMENTS
