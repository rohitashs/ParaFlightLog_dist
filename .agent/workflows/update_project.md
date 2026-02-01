---
description: Update Project Documentation, Source Control, and verification.
---

# Update Project Routine

This workflow automates the "Update Project" request to ensure documentation is fresh and code is safe.

1. **Update Documentation**
   - Check `Docs/Features.md` and `Docs/Technical_Specifications.md` and update them with recent code changes.
   - Update `Reference/ChangeLog.md` with a summary of the session's work.
   - Update `Reference/Context.md` with:
     - Current Project Status.
     - Any new recurring tasks or known issues.
     - Updated file structure if changed.
  
2. **Verify Source Control**
   - Run `git status` to check for uncommitted changes.
   // turbo
   - Run `git add .` if there are changes.
   - Prompt user for commit message if needed, or use a descriptive default based on `task.md`.
   // turbo
   - Run `clasp push` to sync to Google Apps Script.

3. **Report**
   - Provide a concise summary of what was updated and the current health of the project.
