---
description: Claude Code Quick Reference and Essential Commands
---

# Claude Code Quick Reference

## Essential Commands

-   `/help`: Show available commands.
-   `/clear`: Clear the current conversation context (useful for starting fresh).
-   `/compact`: Compact the conversation history to save tokens.
-   `/cost`: Show current session cost.
-   `/doctor`: Check for connection or configuration issues.

## Workflow Tips

1.  **Start Fresh**: Use `/clear` between distinct tasks to avoid context pollution.
2.  **Be Specific**: Provide file paths and clear instructions.
3.  **Iterate**: If the output isn't right, give feedback rather than starting over immediately.
4.  **Context**: Use `view_file` or `ls` to give the AI context about the project structure.

## Model Selection

-   **Haiku**: Fast, cheap. Good for simple edits and logic.
-   **Sonnet**: Balanced. Good for most coding tasks.
-   **Opus**: Powerful. Use for complex architecture or difficult debugging.

## Troubleshooting

-   **Skill not working?**: Check if the relevant file exists and is readable.
-   **Context too long?**: Use `/compact` or `/clear`.
-   **Permission denied?**: Check `.claudecode.json` or tool permissions.
