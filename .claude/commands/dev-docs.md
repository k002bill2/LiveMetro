---
description: Create comprehensive dev docs for approved plan
---

Based on the approved plan, create three development documents:

1. **Create `dev/active/[task-name]/[task-name]-plan.md`**
   - Copy the full approved plan with all phases
   - Add timeline estimates for each phase
   - Include success metrics and acceptance criteria
   - List dependencies and prerequisites
   - Document technical decisions made

2. **Create `dev/active/[task-name]/[task-name]-context.md`**
   - List all relevant files that will be modified
   - Document key architectural decisions
   - Note any constraints or dependencies
   - Add environment requirements
   - Include "Next Steps" section with immediate actions
   - Add "Last Updated" timestamp at the top

3. **Create `dev/active/[task-name]/[task-name]-tasks.md`**
   - Convert plan into detailed checklist with checkbox format
   - Group tasks by component/service/feature
   - Add completion counts (e.g., "Backend (0/12 complete)")
   - Include estimates for complex tasks
   - Order by dependency (prerequisites first)

**Formatting Guidelines:**
- Use `## Phase N: Title` for main sections
- Use `- [ ]` for pending tasks, `- [x]` for completed
- Add timestamps in format: `YYYY-MM-DD HH:mm`
- Include file references as `[filename.ts](path/to/filename.ts)`
- Group related tasks together

**Remember:**
- Keep each document under 300 lines
- Focus on actionable items
- Update timestamps when creating
- Link files with relative paths from project root

After creating the documents, confirm the structure and ask if any adjustments are needed.
