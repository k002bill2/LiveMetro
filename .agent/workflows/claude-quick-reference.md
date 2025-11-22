---
description: Claude Code quick reference and essential commands guide
---

# Claude Code Quick Reference

## 🚀 Quick Start

### Installation
```bash
# Install Claude Code CLI
npm install -g @anthropic/claude-code

# Check version (v2.0.28+)
claude --version

# Login
claude
/login
```

### Initial Project Setup
```bash
# Create essential directory structure
mkdir -p .claude/skills .claude/agents .claude/commands

# Create essential files
touch CLAUDE.md .claudecode.json .mcp.json
```

## 🎮 Main Commands

### Basic Commands
| Command | Description |
|---------|-------------|
| `double-esc` | Branch to previous prompt |
| **Planning Mode** | Start planning mode (essential!) |
| `/clear` | Clear context |
| `/agents` | Manage sub-agents |
| `/model` | Change model |
| `/help` | Help |

### Advanced Commands
| Command | Description |
|---------|-------------|
| `/statusline` | Configure status bar |
| `/hooks` | Configure hooks |
| `/permissions` | Manage permissions |
| `Ctrl+B` | Run in background |
| `Ctrl+R` | Transcript mode |

## 🔥 Essential Workflows

### 1. Planning Mode (Essential!)
```bash
"I need to implement [feature]. Let's start with planning mode."
```

### 2. Dev Docs System
```bash
mkdir -p dev/active/[task-name]/
# Create plan.md, context.md, tasks.md
```

### 3. PM2 Backend Management
```bash
pnpm pm2:start      # Start all services
pm2 logs [service]  # Claude checks logs directly
pm2 restart [service]  # Troubleshoot
```

## 💡 Practical Pro Tips

### Key Lessons
1. **Starting without planning = failure**
2. **Just creating Skills isn't enough → Hooks required**
3. **Dev Docs = Claude's memory**
4. **Re-prompt often** - retry with double-esc

## 📊 Model Selection Guide

| Model | Use Case | Speed | Cost |
|-------|----------|-------|------|
| **Haiku 4.5** | Simple tasks | 🚀🚀🚀 | 💰 |
| **Sonnet 4.5** | General development | 🚀🚀 | 💰💰 |
| **Opus 4.1** | Complex tasks | 🚀 | 💰💰💰 |
