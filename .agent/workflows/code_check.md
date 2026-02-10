---
description: Comprehensive code review and analysis
---
1.  **Read Code**:
    -   Read all code files (`Code/*.gs`).
2.  **Analyze**:
    -   Function naming consistency (e.g. `Parameter` vs `Lookup`).
    -   Duplicate code or logic.
    -   Unused variables/functions.
    -   Syntax errors or potential runtime issues.
    -   Variable scope issues.
    -   Adherence to project structure (`Code.gs` = Orchestration, `Config.gs` = Defs, `Scaffold.gs` = UI/Setup).
3.  **Create Report**:
    -   **Reference**: See `Docs/Context.md` -> "Code Check Reports" for naming and structure.
    -   **Location**: `Plans/CodeCheckReports/`.
    -   **Name**: `YYYY-MM-DD_CodeCheck.md`.
    -   **Content**:
        1.  Metadata.
        2.  Summary.
        3.  Critical Issues.
        4.  Warnings.
        5.  Suggestions.
4.  **Present & Review**:
    -   Present report to user.
    -   Wait for user approval to proceed with fixes.
