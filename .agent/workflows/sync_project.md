---
description: Sync documentation and code with recent work
---
1.  **Update Timestamps**:
    -   Update the "Updated: YYYY-MM-DD HH:mm:ss" timestamp in the header comment of all `Code/*.gs` files to the current time.
2.  **Push to Apps Script**:
    -   Run `clasp push`.
3.  **Update Documentation** (Persistent Docs Only):
    -   Update `Docs/Features.md` (Functional changes).
    -   Update `Docs/Technical_Specification.md` (Code/Arch changes).
    -   Update `Docs/Backlog.md` (Update Status of Reqs/CRs/Bugs).
    -   Update `Docs/ChangeLog.md` (Log implemented items).
    -   Update `Docs/Context.md` (if Ways of Working changed).
4.  **Source Control (Git)**:
    -   Run `git add .`
    -   Run `git commit -m "Sync project state"` (or prompt for message).
    -   Run `git push` (if remote exists).
5.  **Clean up**:
    -   Remove temporary files.
