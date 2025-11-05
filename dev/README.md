# Dev Docs System

> Claude's external memory for complex, multi-phase development tasks

## Purpose

The Dev Docs system prevents Claude from "forgetting" the plan during long development sessions. It provides structured documentation that survives context compaction and serves as a source of truth for project status.

## Structure

```
dev/
├── active/           # Currently in-progress tasks
│   └── [task-name]/
│       ├── [task-name]-plan.md      # Approved implementation plan
│       ├── [task-name]-context.md   # Key decisions and current state
│       └── [task-name]-tasks.md     # Detailed checklist
└── completed/        # Archived finished tasks (for reference)
    └── 2025-01/
        └── [task-name]/
```

## When to Use

Use Dev Docs for any task that:
- Takes more than 30 minutes
- Spans multiple files or components
- Has multiple phases or dependencies
- Requires tracking detailed progress
- May hit context limits

## Quick Commands

```bash
# Create new dev docs from approved plan
/dev-docs

# Update docs with current progress
/update-dev-docs

# Start new feature with planning
/new-feature
```

## The Three Documents

### 1. Plan Document (`*-plan.md`)
**Purpose**: Approved implementation strategy

**Contains**:
- Executive summary
- Phased breakdown (Phase 1, Phase 2, etc.)
- Technical decisions
- Success metrics
- Dependencies

**When to update**: Only when the overall plan changes

### 2. Context Document (`*-context.md`)
**Purpose**: Living record of what's happening

**Contains**:
- Last updated timestamp
- Key files being modified
- Important decisions made
- Current issues/blockers
- Next steps

**When to update**:
- Before context compaction
- After major decisions
- When blockers are encountered
- When switching sessions

### 3. Tasks Document (`*-tasks.md`)
**Purpose**: Detailed implementation checklist

**Contains**:
- Grouped tasks by component/service
- Checkbox format (`- [ ]` or `- [x]`)
- Completion counts
- Priority ordering

**When to update**:
- After completing each task
- When discovering new tasks
- When tasks become obsolete

## Workflow Example

### Session 1: Planning
```bash
User: "I need to implement real-time train tracking with push notifications"

Claude: [Creates plan in planning mode]

User: "Looks good, let's proceed"

Claude: /dev-docs
# Creates:
# - dev/active/train-tracking/train-tracking-plan.md
# - dev/active/train-tracking/train-tracking-context.md
# - dev/active/train-tracking/train-tracking-tasks.md
```

### Session 2: Implementation (Phase 1)
```bash
Claude: [Reads dev docs, implements Phase 1 tasks]

# Before context compaction:
Claude: /update-dev-docs
# Updates:
# - Context with session summary
# - Tasks with completed checkboxes
```

### Session 3: Continue (Phase 2)
```bash
User: "Continue with the train tracking feature"

Claude: [Reads dev docs, sees Phase 1 is done, starts Phase 2]
```

## Best Practices

### ✅ Do

- Create dev docs for any multi-phase task
- Update context before hitting 20% context remaining
- Mark tasks as completed immediately when done
- Add session summaries with accomplishments and blockers
- Keep documents under 300 lines (break into phases if needed)
- Use file references with clickable paths
- Timestamp all updates

### ❌ Don't

- Create dev docs for simple single-file changes
- Let documents get stale (update regularly)
- Batch multiple task completions (mark immediately)
- Include code in dev docs (reference files instead)
- Create overly detailed task breakdowns
- Skip session summaries

## Template Structure

### Plan Template
```markdown
# [Feature Name] Plan

## Executive Summary
Brief description of what we're building

## Phase 1: [Phase Name]
### Tasks
- [ ] Task 1
- [ ] Task 2

### Technical Decisions
- Decision 1
- Decision 2

## Success Metrics
- Metric 1
- Metric 2
```

### Context Template
```markdown
# [Feature Name] - Context

## Last Updated: YYYY-MM-DD HH:mm

## Key Files
- [filename.ts](path/to/filename.ts) - Description

## Important Decisions
- **YYYY-MM-DD**: Decision made

## Current Issues
- [ ] Issue 1
- [x] ~~Issue 2~~ (Fixed)

## Next Steps
1. Next action
2. Following action
```

### Tasks Template
```markdown
# [Feature Name] - Tasks

## Backend (0/10 complete)
- [ ] Task 1
- [ ] Task 2

## Frontend (0/8 complete)
- [ ] Task 1
- [ ] Task 2

## Testing (0/5 complete)
- [ ] Task 1
- [ ] Task 2
```

## Archiving Completed Tasks

When a task is 100% complete:

```bash
mv dev/active/task-name dev/completed/2025-01/
```

Keep completed tasks for reference when implementing similar features.

## Integration with Claude Code

Dev docs are automatically recognized by Claude when:
- You mention the task name
- You use `/dev-docs` or `/update-dev-docs` commands
- You ask Claude to "continue" work
- Context gets low and Claude needs to refresh

## Troubleshooting

**Problem**: Claude isn't loading dev docs
**Solution**: Explicitly mention them: "Check the dev docs for train-tracking"

**Problem**: Documents getting too long
**Solution**: Break into phases, move completed phases to separate files

**Problem**: Too many active tasks
**Solution**: Archive completed ones, focus on 1-3 active tasks max

---

*Dev Docs = Claude's memory. Memory = Successful long-term development.*
