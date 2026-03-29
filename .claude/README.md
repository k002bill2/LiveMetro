# Claude Code Configuration

Claude Code configuration for LiveMetro React Native subway app.

## Directory Structure

```
.claude/
├── mcp.json           # MCP server configurations
├── skills/            # Agent skills (19 total)
├── agents/            # Sub-agents (5 total)
│   └── shared/        # Common agent guidelines
├── commands/          # Custom commands (21 total)
└── hooks/             # Automation hooks (5 total)
```

## Skills

### Core Skills (Project-Specific)
| Skill | Purpose |
|-------|---------|
| `react-native-development` | Components, navigation, TypeScript |
| `firebase-integration` | Auth, Firestore, real-time subscriptions |
| `api-integration` | Seoul Open Data API integration |
| `location-services` | GPS tracking, nearby stations |
| `notification-system` | Push notifications, arrival alerts |
| `test-automation` | Jest tests, coverage analysis |
| `subway-data-processor` | Seoul subway data parsing |

### Meta-Skills (Claude Code Development)
| Skill | Purpose |
|-------|---------|
| `hook-creator` | Create automation hooks |
| `slash-command-creator` | Create custom commands |
| `skill-creator` | Build new skills |
| `subagent-creator` | Create sub-agents |
| `cc-feature-implementer-main` | Phase-based planning |

## Sub-agents

| Agent | Model | Expertise |
|-------|-------|-----------|
| `mobile-ui-specialist` | Sonnet | React Native UI/UX + Firebase + Seoul API |
| `test-automation-specialist` | Haiku | Jest, RNTL, coverage |
| `quality-validator` | Haiku | Final quality validation |
| `eval-grader` | Inherit | Agent evaluation grading |
| `eval-task-runner` | Inherit | Evaluation task execution |

## Commands (21 total)

| Command | Purpose |
|---------|---------|
| `/verify-app` | Type check + lint + test + build |
| `/check-health` | Full project health check |
| `/commit-push-pr` | Commit, push, PR automation |
| `/deploy-with-tests` | Test-verified deployment |
| `/review` | Code review (security, perf, types) |
| `/test-coverage` | Coverage analysis |
| `/simplify-code` | Complexity analysis |
| `/draft-commits` | Conventional Commits draft |
| `/start-dev` | Expo dev server |
| `/dev-docs` | Dev Docs 3-file system |
| `/update-dev-docs` | Update Dev Docs |
| `/resume` | Restore task context |
| `/save-and-compact` | Save + compact |
| `/session-wrap` | Session end cleanup |
| `/gemini-review` | Gemini cross-review |
| `/gemini-scan` | Gemini codebase scan |
| `/run-eval` | Agent evaluation |
| `/eval-dashboard` | Evaluation dashboard |
| `/config-backup` | Settings backup/restore |
| `/sync-registry` | Registry sync |
| `/run-workflow` | Workflow execution |

## MCP Servers

| Server | Status | Purpose |
|--------|--------|---------|
| `context7` | Enabled | Semantic search |
| `magic` | Enabled | UI components (API key required) |
| `tavily` | Enabled | Web search (API key required) |

## Quick Start

### Using Skills (Auto-Activation)
```bash
# Skills activate automatically based on context
"Create a StationCard component"  # → react-native-development
"Add Firestore subscription"      # → firebase-integration
"Generate tests for this hook"    # → test-automation
```

### Using Agents
```bash
@mobile-ui-specialist "Design the station detail screen"
@test-automation-specialist "Write tests for StationCard"
@quality-validator "Validate final implementation"
```

## Adding New Skills

```bash
mkdir -p .claude/skills/new-skill
# Create SKILL.md with frontmatter
```

## Backup System

```bash
npm run backup:claude           # Create backup
npm run restore:claude:latest   # Restore latest
npm run restore:claude:list     # List backups
```

Backups stored in `.claude-backups/` with 30-day retention.

---

**Skills**: 19 | **Agents**: 5 (mobile-ui, test-automation, quality-validator, eval-grader, eval-task-runner) | **Commands**: 21 | **Hooks**: 5
