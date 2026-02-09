---
description: Update Project Documentation, Source Control, and verification.
---

# Update Project Routine

This workflow automates the "Update Project" request to ensure documentation is fresh and code is safe.

1. **Update Documentation**
   - Prompt user for commit message if needed, or use a descriptive default based on `task.md`.
   // turbo
   - Run `clasp push` to sync to Google Apps Script.

3. **Report**
   - Provide a concise summary of what was updated and the current health of the project.
