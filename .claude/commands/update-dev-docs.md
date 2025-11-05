---
description: Update dev docs before context compaction
---

Update all active dev docs with current progress:

**1. Update Context Document (`*-context.md`):**
   - Update "Last Updated" timestamp to current time
   - Add any new architectural decisions made in this session
   - Update "Current Issues" section:
     - Mark resolved issues with `- [x] ~~Issue description~~ (Fixed)`
     - Add new issues discovered with `- [ ] Issue description`
   - Revise "Next Steps" based on current progress
   - Add new file references if created/modified
   - Document any new dependencies added

**2. Update Tasks Document (`*-tasks.md`):**
   - Mark completed items with `[x]`
   - Update completion counts (e.g., "Backend (8/12 complete)")
   - Add any new tasks discovered during implementation
   - Reorder tasks by priority if dependencies changed
   - Remove tasks that are no longer needed

**3. Add Session Summary:**
   Create a brief session summary at the top of context.md:
   ```markdown
   ## Session: YYYY-MM-DD HH:mm

   ### Accomplished
   - What was completed this session
   - Key implementations

   ### Blockers
   - Issues encountered
   - Decisions pending

   ### Critical Next Actions
   1. Highest priority task
   2. Second priority task
   3. Third priority task
   ```

**Guidelines:**
- Keep updates concise but comprehensive
- Focus on what changed, not what stayed the same
- Highlight blockers clearly for easy identification
- Ensure next actions are specific and actionable
- Add file references for code mentioned

After updating, summarize the key changes made and confirm next steps.
