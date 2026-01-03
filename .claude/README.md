# Claude Code Configuration

Claude Code configuration for LiveMetro React Native subway app.

## Directory Structure

```
.claude/
├── mcp.json           # MCP server configurations
├── skills/            # Agent skills (13 total)
├── agents/            # Sub-agents (4 total)
│   └── shared/        # Common ACE framework
└── commands/          # Custom commands (2 total)
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
| `parallel-coordinator` | ACE Framework coordination |
| `cc-feature-implementer-main` | Phase-based planning |

## Sub-agents

| Agent | Model | Expertise |
|-------|-------|-----------|
| `mobile-ui-specialist` | Sonnet | React Native UI/UX |
| `backend-integration-specialist` | Sonnet | Firebase, API design |
| `performance-optimizer` | Sonnet | Memory leaks, optimization |
| `test-automation-specialist` | Sonnet | Jest, coverage |
| `brand-logo-finder` | Haiku | Brand asset discovery |

## Commands

```bash
/test-coverage    # Analyze test coverage gaps
/check-health     # Project health check (types, lint, tests)
```

## MCP Servers

| Server | Status | Purpose |
|--------|--------|---------|
| `codex-cli` | Enabled | Code snippets |
| `context7` | Enabled | Semantic search |
| `magic` | Enabled | UI components (API key required) |
| `tavily` | Enabled | Web search (API key required) |
| `playwright` | Enabled | Browser automation |

See [docs/claude/mcp-setup.md](../docs/claude/mcp-setup.md) for detailed setup.

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
@performance-optimizer "Analyze re-render issues"
@backend-integration-specialist "Implement data fallback"
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

**Skills**: 13 | **Agents**: 5 | **Commands**: 2 | **MCP Servers**: 5 enabled
