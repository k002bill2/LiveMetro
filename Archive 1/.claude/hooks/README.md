# KiiPS Hooks Directory

This directory contains Claude Code hooks for automating KiiPS workflows.

## Available Hooks

### update-reminder.sh
**Purpose**: Automatically checks for Skills Guide updates every 15 days

**Trigger**: SessionStart hook (runs when Claude Code session starts)

**How it works**:
1. Checks `.claude/.last-update-check` timestamp
2. If 15+ days passed, displays update reminder
3. Shows items to check:
   - Claude Code CLI version
   - New model releases
   - KiiPS documentation changes
   - Skills Guide updates

**Configuration**:
```json
// In .claudecode.json
"hooks": {
  "SessionStart": [
    {
      "type": "command",
      "command": "bash .claude/hooks/update-reminder.sh"
    }
  ]
}
```

**Manual Testing**:
```bash
bash .claude/hooks/update-reminder.sh
```

**Manual Update**:
To force update check (simulate 15 days passed):
```bash
# Set timestamp to 16 days ago
echo $(( $(date +%s) - 1382400 )) > .claude/.last-update-check

# Run check
bash .claude/hooks/update-reminder.sh
```

**Reset**:
```bash
rm .claude/.last-update-check
```

## Hook System Architecture

```
SessionStart (Claude Code starts)
    ↓
update-reminder.sh
    ↓
Check .last-update-check
    ↓
If 15+ days → Display reminder
    ↓
Update timestamp
```

## Adding New Hooks

1. Create script in `.claude/hooks/`
2. Make executable: `chmod +x script.sh`
3. Register in `.claudecode.json`
4. Test manually first

---

**Last Updated**: 2025-12-28
**Maintainer**: KiiPS Development Team
