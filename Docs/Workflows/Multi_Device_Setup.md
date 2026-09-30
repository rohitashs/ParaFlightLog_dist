# Multi-Device Workflow Guide

**Context**: This project is hosted in a Google Drive folder (`~Projects/ParaFlightLogProject`) which is synced between multiple computers. It is also a Git repository hosted on GitHub.

**⚠️ CRITICAL WARNING**: Hosting a Git repository inside a cloud-synced folder (Google Drive, Dropbox, OneDrive) carries a **High Risk** of repository corruption. Cloud sync tools and Git both fight for control over file versions and locking mechanisms.

To work safely, you must strictly follow this protocol.

---

## ✅ The "Hot Potato" Rule
**Only one computer should be active at a time.**
Never leave VS Code open on Computer A while working on Computer B.

## 🛑 End of Session Protocol (Computer A)
1.  **Commit & Push Code**:
    *   Ensure all code changes are committed and pushed to GitHub.
    *   `git push origin master`
2.  **Update Plans**:
    *   Update `Plans/task.md` and `Docs/Backlog.md`.
    *   Create a **Session Summary** (`Plans/SessionSummary/YYYY-MM-DD_SessionSummary.md`).
    *   *Note: These files are ignored by `.gitignore` (except Docs), so they rely on Google Drive sync.*
3.  **Antigravity Cleanup**:
    *   If using Antigravity, finish the current task.
    *   Tell Antigravity: "I am switching computers. Please summarize this session."
4.  **Close VS Code**:
    *   **Crucial Step**: Identify and close VS Code and any terminal windows. This releases file locks on the `.appsscript.json`, `.git/` folder, and other system files.
5.  **Wait for Google Drive Sync**:
    *   Look at the Google Drive icon in your system tray.
    *   **Wait** until it says "Everything is up to date". **Do not shut down until this happens.**

---

## 🚀 Start of Session Protocol (Computer B)
1.  **Wait for Google Drive Sync**:
    *   Turn on the computer.
    *   Watch the Google Drive icon. **Wait** until it says "Everything is up to date".
    *   *Risk*: If you open the folder before sync finishes, you may create "Conflicted Copy" files.
2.  **Open VS Code**:
    *   Only after sync is complete.
3.  **Verify Git Status**:
    *   Open the terminal.
    *   Run `git status`.
    *   Run `git fetch` and `git pull`.
    *   *Why?* Even if Google Drive synced the files, `git pull` ensures your local repo metadata is perfectly aligned with GitHub, which is the ultimate source of truth for code.
4.  **Antigravity Context**:
    *   Antigravity does **not** sync its memory between computers.
    *   **Action**: Ask Antigravity to "Read the latest Session Summary" to get up to speed.
    *   Example: *"I am starting on this computer. Read Docs/Context.md and the latest Session Summary in Plans/ to update your context."*

---

## 📂 Data & Configuration
*   **Code (`Code/*.gs`)**: Synced via **GitHub** (primary) and Google Drive (secondary/risky).
*   **Docs (`Docs/*.md`)**: Synced via **GitHub** and Google Drive.
*   **Plans (`Plans/*.md`)**: Synced via **Google Drive ONLY** (Ignored by Git).
*   **Clasp (`.clasprc.json`)**:
    *   Authorization is stored in your user entry (`~/.clasprc.json`).
    *   You must run `clasp login` once on **each** computer.
    *   You do **not** need to login every time, just once per machine.

## 🚨 Troubleshooting
**If Git reports "Corrupt Index" or strange errors:**
1.  **Pause Google Drive Sync.**
2.  Delete the `.git/index` file (or the specific corrupt file mentioned).
3.  Run `git reset`.
4.  If FUBAR:
    *   Backup your `Plans/` folder.
    *   Delete the entire project folder.
    *   Wait for Google Drive to register the deletion.
    *   `git clone` the repo again from GitHub.
    *   Restore your `Plans/` folder.
