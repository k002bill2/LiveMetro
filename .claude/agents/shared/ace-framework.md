# ACE Framework - Parallel Execution Mode

This document defines the shared parallel execution protocol for all specialist agents in LiveMetro.

**Based on**: [Anthropic Multi-Agent Research System](https://www.anthropic.com/engineering/multi-agent-research-system)

## Workspace Isolation

Each agent has an isolated workspace:
- **Workspace**: `.temp/agent_workspaces/{agent-name}/`
- **Drafts**: `.temp/agent_workspaces/{agent-name}/drafts/` - Work in progress
- **Proposals**: `.temp/agent_workspaces/{agent-name}/proposals/` - Final deliverables
- **Never write directly to `src/`** - Only write to your workspace
- Primary Agent will integrate your proposals to `src/`

## Status Updates

Update `metadata.json` in your workspace every 30 seconds:

```json
{
  "agent_id": "{agent-name}",
  "status": "working",
  "current_task": "Current task description",
  "progress": 60,
  "estimated_completion": "2025-01-03T10:45:00Z",
  "workload": 0.6,
  "blocked": false,
  "blocker_reason": null
}
```

**Status values**: `waiting`, `working`, `profiling`, `blocked`, `completed`, `aborted`

## File Lock Protocol

1. Before modifying shared files, check `.temp/coordination/locks/`
2. If lock exists, notify Primary Agent and wait
3. Create lock file with your agent_id before starting work
4. Release lock after moving work to proposals/

## Self-Assessment (Layer 3)

Before accepting a task:
- **Accept** if capability match >0.70 (check your strengths in frontmatter)
- **Decline** if capability <0.70 (check your weaknesses)
- **Request clarification** if task description is ambiguous

## Quality Gates (All Agents)

1. TypeScript strict mode compliance (`npm run type-check`)
2. ESLint with zero errors (`npm run lint`)
3. No hardcoded sensitive data

## Task Completion

When task is complete:
1. Move all files from `drafts/` to `proposals/`
2. Update `metadata.json` with `"status": "completed"` and `"progress": 100`
3. Create brief summary in `proposals/TASK_SUMMARY.md`

## Communication

- **With Primary Agent**: Update metadata.json status
- **With other agents**: Read their proposals from their workspace, don't modify
- **Emergency abort**: Set `metadata.json` status to "aborted" with reason

## Agent Coordination

| Agent | Workspace | Dependencies |
|-------|-----------|--------------|
| lead-orchestrator | N/A (coordinates) | None |
| mobile-ui-specialist | `.temp/agent_workspaces/mobile-ui/` | Depends on backend types |
| backend-integration-specialist | `.temp/agent_workspaces/backend-integration/` | Provides types first |
| performance-optimizer | `.temp/agent_workspaces/performance-optimizer/` | Optimizes all code |
| test-automation-specialist | `.temp/agent_workspaces/test-automation/` | Tests all proposals |
| quality-validator | `.temp/agent_workspaces/quality-validator/` | Validates final output |

---

## Checkpoint & Recovery (Anthropic Pattern)

Enable resumable execution for long-running multi-agent workflows.

### Checkpoint Types

| Type | When | Location |
|------|------|----------|
| Phase Checkpoint | End of exploration/planning/implementation | `.temp/memory/checkpoints/` |
| Agent Checkpoint | Subagent completes significant work | `.temp/memory/findings/` |
| Context Snapshot | Approaching token limit (150K) | `.temp/memory/context_snapshots/` |
| Emergency Checkpoint | Before risky operation | `.temp/memory/checkpoints/` |

### Checkpoint Format

```json
{
  "checkpoint_id": "cp_{phase}_{timestamp}",
  "task_id": "unique_task_id",
  "phase": "exploration|planning|implementation|review",
  "timestamp": "ISO8601",

  "state": {
    "completed_subtasks": ["task_1", "task_2"],
    "pending_subtasks": ["task_3"],
    "active_agents": ["agent_id"],
    "blocked_agents": [],
    "findings_count": 3
  },

  "context_summary": "Brief description of current state",
  "next_action": "What to do next",
  "recovery_instructions": "How to resume from here"
}
```

### Recovery Protocol

**On Failure:**
1. Read latest checkpoint from `.temp/memory/checkpoints/`
2. Parse `state` to understand where we stopped
3. Load relevant findings from `.temp/memory/findings/`
4. Resume from `next_action`

**Retry Logic:**
- Max retries per subtask: 3
- Backoff: 1s, 5s, 15s
- After 3 failures: Mark subtask as `failed`, continue with others

**Graceful Degradation:**
- If agent fails, don't abort entire workflow
- Log failure, skip dependent tasks
- Deliver partial results with clear status

### When to Checkpoint

**Always checkpoint after:**
- [ ] Completing exploration phase
- [ ] Finishing planning phase
- [ ] Each batch of subagent completions
- [ ] Before spawning 3+ agents in parallel
- [ ] After integrating proposals to src/
- [ ] Before running quality validation

**Checkpoint triggers:**
```
if (tokens > 150000) checkpoint("token_limit")
if (phase_changed) checkpoint("phase_transition")
if (agents_completed >= 3) checkpoint("batch_complete")
```

### Recovery Commands

```bash
# Find latest checkpoint
ls -t .temp/memory/checkpoints/ | head -1

# Read checkpoint
cat .temp/memory/checkpoints/cp_implementation_*.json

# List available findings
ls .temp/memory/findings/

# Resume (manual)
# 1. Read checkpoint
# 2. Spawn fresh agents with context from checkpoint
# 3. Continue from next_action
```

---

## Deterministic Safeguards

### Retry with Backoff

```
For each subtask:
  attempt = 0
  while attempt < 3:
    try:
      execute_subtask()
      break
    except:
      attempt += 1
      wait(backoff[attempt])  # 1s, 5s, 15s
  else:
    mark_failed(subtask)
    log_error()
```

### Fallback Strategies

| Failure Type | Recovery Action |
|--------------|-----------------|
| Agent timeout | Retry with simpler task |
| Tool failure | Skip tool, use alternative |
| Integration conflict | Manual merge, ask user |
| Quality gate fail | Spawn fix-up agent |
| Token limit | Save context, fresh session |

### Error Escalation

```
Level 1: Retry (automatic)
Level 2: Alternative approach (automatic)
Level 3: Skip and continue (automatic, log warning)
Level 4: Pause and ask user (manual)
Level 5: Abort with recovery info (manual)
```

---

## Quick Reference

### Essential Paths
```
.temp/
├── agent_workspaces/     # Agent outputs
├── memory/
│   ├── checkpoints/      # Recovery points
│   ├── findings/         # Subagent results
│   └── context_snapshots/# Token limit saves
├── coordination/
│   └── locks/            # File locks
└── traces/               # Observability logs
```

### Key Skills
- `parallel-coordinator` - Orchestration guide
- `external-memory` - Context persistence
- `agent-observability` - Tracing & metrics
- `agent-improvement` - Self-improvement

---

**Version**: 2.0 | **Last Updated**: 2025-01-04
