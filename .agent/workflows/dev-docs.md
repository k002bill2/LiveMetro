---
description: Developer Documentation System
---

# Developer Documentation Workflow

This workflow outlines how to maintain and use the "Dev Docs" system, which serves as the memory for the AI agent.

## 1. Documentation Structure

Maintain a dedicated documentation directory (e.g., `.vooster-docs` or `docs`) with the following key files:

-   `architecture.md`: High-level system design, data flow, and tech stack.
-   `guideline.md`: Coding standards, naming conventions, and best practices.
-   `step-by-step.md`: Detailed implementation guides for common tasks.
-   `clean-code.md`: Specific refactoring and code quality rules.
-   `prd.md`: Product Requirements Document (current active requirements).

## 2. Updating Documentation

Whenever a significant architectural change or decision is made:

1.  **Identify**: Which document needs updating? (e.g., new API endpoint -> `architecture.md`).
2.  **Update**: Edit the markdown file with the new information.
3.  **Commit**: Ensure documentation changes are committed alongside code changes.

## 3. Using Documentation (Context Loading)

When starting a complex task, load the relevant documentation into the context:

```bash
# Example: Loading architecture and guidelines
view_file .vooster-docs/architecture.md
view_file .vooster-docs/guideline.md
```

## 4. Documentation as Memory

-   **Decisions**: Record *why* a decision was made in `architecture.md`.
-   **Patterns**: Record reusable patterns in `guideline.md`.
-   **Tutorials**: Record "how-to" steps in `step-by-step.md`.

## 5. AI Integration

-   **Read First**: Before asking the AI to implement a major feature, ask it to read the relevant docs.
-   **Update Request**: Explicitly ask the AI to update the docs if it changes the architecture. "Please update architecture.md to reflect this change."
