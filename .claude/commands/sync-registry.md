---
name: sync-registry
description: 스킬, 에이전트, 훅, 커맨드 레지스트리 자동 동기화
allowed-tools: Read, Write, Edit, Glob, Grep
---

# Registry Sync

새로 추가된 스킬, 에이전트, 훅, 커맨드를 자동으로 감지하고 레지스트리를 업데이트합니다.

## 실행 스크립트

```bash
node .claude/scripts/sync-registry.js --all
```

## 동작

1. **Skills 동기화**
   - `.claude/skills/*/SKILL.md` 스캔
   - frontmatter의 `triggers` 필드 추출
   - `skill-rules.json` 자동 업데이트

2. **Agents 동기화**
   - `.claude/agents/*.md` 스캔
   - frontmatter 메타데이터 추출
   - `agents-registry.json` 생성

3. **Hooks 동기화**
   - `.claude/hooks/*.js` 스캔
   - `@hook-config` 주석 파싱
   - `hooks.json` 자동 업데이트

4. **Commands 동기화**
   - `.claude/commands/*.md` 스캔
   - frontmatter의 `name`, `description`, `allowed-tools` 추출
   - `commands-registry.json` 생성

## 새 컴포넌트 추가 방법

### 커맨드 추가
```yaml
# .claude/commands/my-command.md
---
name: my-command
description: My command description
allowed-tools: read, bash
---
```

### 에이전트 추가
```yaml
# .claude/agents/my-agent.md
---
name: my-agent
description: My agent description
tools: read, edit, grep
model: sonnet
---
```

## 결과 확인

동기화 후 생성/업데이트되는 파일:
- `.claude/skill-rules.json`
- `.claude/agents-registry.json`
- `.claude/hooks.json`
- `.claude/commands-registry.json`
