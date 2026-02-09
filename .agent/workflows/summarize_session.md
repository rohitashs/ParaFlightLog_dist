---
description: End session routine: Sync project, update context, and create session report
---
1.  **Execute Sync Project**:
    -   Perform all steps in `sync_project.md` (Update Functions, Specs, Task, Changelog).
2.  **Update Context**:
    -   Read `context.md` (if exists in root or Docs).
    -   Update high-level status and recent accomplishments.
3.  **Archive Old Plans**:
    -   Create directory `Plans/Archive` if it does not exist.
    -   Move any existing `Plans/Session_*.md` files to `Plans/Archive/`.
4.  **Create Session Report**:
    -   Generate a new file `Plans/Session_[YYYY-MM-DD_HHMM].md`.
    -   **Content**:
        -   **Date**: [Current Date]
        -   **Summary**: Concise summary of session achievements.
        -   **Key Changes**: List of modified files and features.
        -   **Open Issues**: List of active bugs/tasks from `task.md`.
        -   **Next Steps**: Action items for the next session.
5.  **Notify User**:
    -   Confirm session summary creation and readiness to end session.
