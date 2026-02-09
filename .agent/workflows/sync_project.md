---
description: Sync documentation and code with recent work
---
1.  **Update Timestamps**:
    -   Update the "Updated: YYYY-MM-DD HH:mm:ss" timestamp in the header comment of all `Code/*.gs` files to the current time.
2.  **Push to Apps Script**:
    -   Run `clasp push`.
3.  **Update Documentation**:
    -   Update `Docs/Functions.md` with current function signatures.
    -   Update `Docs/Technical_Specifications.md`.
    -   Update `task.md` (mark completed items, add active bugs).
    -   Update `Reference/ChangeLog.md`.
4.  **Source Control (Git)**:
    -   Run `git add .`
    -   Run `git commit -m "Sync project state"` (or prompt for message).
    -   Run `git push` (if remote exists).
5.  **Clean up**:
    -   Remove temporary files.
