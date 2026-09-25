# Project Context & Ways of Working (Source of Truth)

## 🧠 Agent Memory & Context
**Status**: Active Development (v0.8.1)
**Last Session Focus**: XContest Verification, Bug Fixes (deployment, logging), Code Refactoring.
**Next Focus**: Master Log Folder (CR-ING-004), UI Enhancements, Sidebar Bug (Bug-UI-004).

This file is the **long-term memory** for the project. Read this first to understand *how* we work and *where* we are.

---

## 📂 Project Organization & File Structure
The project follows a strict folder hierarchy. `Docs/Context.md` is the source of truth for this structure.

### 1. `Docs/` (Persistent Documentation)
*   **Status**: **Git Tracked**.
*   **Purpose**: Long-term, evolving documentation. Source of Truth.
*   **Files**:
    *   **`Context.md`**: Project Context, Ways of Working.
    *   **`Features.md`**: Functional capabilities (Admin, UI, System).
    *   **`Technical_Specification.md`**: detailed Tech Specs & Code Reference.
    *   **`Backlog.md`**: Requirements, CRs, Bugs.
    *   **`ChangeLog.md`**: Historical record.

### 2. `Plans/` (Transient Execution)
*   **Status**: **NOT Git Tracked** (Local only).
*   **Purpose**: Disposable planning documents and session artifacts.
*   **Files**: `implementation_plan.md`, `task.md`, `walkthrough.md`.
*   **Sub-folders**:
    *   **`Acrchive/`**: Old plans/tasks.
    *   **`SessionSummary/`**: Session Summary Reports (`YYYY-MM-DD_SessionSummary.md`).

### 3. `Code/` (Implementation)
*   **Status**: **Git Tracked**.
*   **Files**: All `.gs` files and `appsscript.json`.


---

## 🛠 Ways of Working (Standard Operating Procedures)

### 1. Document-First Development
*   **Features.md**: Define *what* we want.
*   **Technical_Specification.md**: Define *how* to build it.
*   **Backlog.md**: Track *status* of implementation.
*   **Code**: Implement only after documentation is aligned.

### 2. Backlog Management (`Docs/Backlog.md`)
The backlog has 5 strict sections:
1.  **Description**: Meta-info on usage.
2.  **ToDos**: Future tasks (Checkbox, Status, Importance, Description).
    *   *Status Flags*: `Open`, `WIP`, `Completed`, `Discarded`.
3.  **Requirements (`RQ`)**: Nested Hierarchy (Module -> Function).
    *   *Structure*: Checkbox | ID | Status | Phase | Description.
    *   *Status Flags*: `Open`, `Implemented`, `Partially Implemented`, `Future`, `Blocked`, `Discarded`.
    *   *Rule*: "Implemented" only if ALL children are implemented.
4.  **Change Requests (`CR`)**: Flat list linking to Implemented Requirements.
    *   *Status Flags*: `Open`, `Implemented`, `Blocked`, `Discarded`, `Future`.
5.  **Bugs (`Bug`)**: Flat list linking to Requirements or CRs.

### 3. Change Logging (`Docs/ChangeLog.md`)
*   Update at the end of every session.
*   Group by **Session** and **Date**.
*   List all `[Imp]` (Implemented) items from Backlog.

### 4. Session Summary Reports (`Plans/SessionSummary/`)
*   **Naming**: `YYYY-MM-DD_SessionSummary.md` (e.g. `2026-02-10_SessionSummary.md`).
*   **Purpose**: A snapshot of the session's achievements, discussions, and decisions.
*   **Structure**:
    1.  **Metadata**: Date, Time, Goal.
    2.  **Key Discussions**: Brief bullet points of what was discussed.
    3.  **Decisions Made**: Architectural or Product decisions.
    4.  **Work Completed**: Files changed, Features implemented, Bugs fixed.
    5.  **Open Issues / Next Steps**: What was left undone or added to backlog.
    6.  **References**: Links to relevant artifacts or docs.

### 5. Code Check Reports (`Plans/CodeCheckReports/`)
*   **Naming**: `YYYY-MM-DD_CodeCheck.md`.
*   **Purpose**: Result of automated or manual code reviews.
*   **Structure**:
    1.  **Metadata**: Date, Scope (All files or specific module).
    2.  **Summary**: Pass/Fail/Warn status.
    3.  **Critical Issues**: Bugs, Logic Errors (Must Fix).
    4.  **Warnings**: Style, Optimization, Readability (Should Fix).
    5.  **Suggestions**: Refactoring ideas (Nice to have).

### 6. Code Standards
*   **Naming**: `Service.gs` for modules. `privateFunction_` (trailing underscore) for non-exported helpers.
*   **Config**: Separation of Concerns. `Code.gs` = Logic, `Config.gs` = Constants, `Parameters Sheet` = Runtime Values.
*   **Validation**: Validate early. Fail gracefully with logs.
*   **Timestamps**: Always update file header timestamps before pushing. Use `.\update_headers.ps1` to automate this.

### 7. Multi-Device Workflow (`Docs/Workflows/Multi_Device_Setup.md`)
*   **Critical**: Never work on two computers at once.
*   **Protocol**: Always wait for Google Drive sync **before** opening VS Code. Acknowledge the risk of Git inside Drive.
*   **Hand-off**: Commit & Push on A -> Wait for Sync -> Pull on B.

---

## 💻 Development Infrastructure Setup (`DevInfraSetup`)
*Use this section whenever setting up the project on a new computer or verifying the dev environment.*

### 1. Required Infrastructure & Prerequisites
*   **Git**: Git for Windows installed. Git Credential Manager configured for GitHub access (`https://github.com/rohitashs/RSParaFlightLogProject.git`).
*   **Node.js & npm**: Node.js v20+ or v24+ LTS installed. (Provides runtime for clasp).
*   **Google Clasp CLI**: `@google/clasp` installed globally (`npm install -g @google/clasp`).
*   **Google Apps Script Authorization**: One-time OAuth login per machine via `clasp login`. Tokens stored in `~/.clasprc.json`.
*   **Script Configuration**: `.clasp.json` in the workspace root pointing to:
    *   `scriptId`: `10l-5rIDf0osLjy46qbLm2skoyXQRFGq5Dj7dl5hScjhGdy0IO_BiQqol`
    *   `rootDir`: `Code/`
*   **PowerShell**: For running utility scripts (e.g. `.\update_headers.ps1`).

### 2. New Machine Setup Checklist
When configuring a fresh IDE/machine:
1.  **Install Node.js & Git**: Verify with `node -v` and `git --version`.
2.  **Install Clasp**:
    ```powershell
    npm install -g @google/clasp
    ```
    *Ensure `npm` global bin directory (e.g. `C:\Users\<user>\AppData\Roaming\npm`) is in system `PATH`.*
3.  **Authorize Clasp (Google Account)**:
    ```powershell
    clasp login
    ```
    *Complete the browser authorization with the Google account that has edit access to the Google Sheet and Apps Script project.*
4.  **Confirm `.clasp.json`**:
    Verify that `.clasp.json` exists in project root with valid `scriptId` and `rootDir: "Code/"`.
5.  **Configure Git**:
    ```powershell
    git remote -v
    # Verify origin points to https://github.com/rohitashs/RSParaFlightLogProject.git
    ```

### 3. How to Test & Verify Environment
Run the following commands in PowerShell from the project root to verify all layers:

#### A. Tooling Availability & Versions
```powershell
Get-Command git, node, npm, clasp -ErrorAction SilentlyContinue | Select-Object Name, Source
node -v
clasp -v
```
*Expected*: All commands resolve with full executable paths, Node >= v20, Clasp >= v3.x.

#### B. Apps Script (GAS) Connectivity & Push Access
```powershell
clasp show-authorized-user
clasp status
```
*Expected*:
*   `clasp show-authorized-user`: Displays your logged-in Google account email.
*   `clasp status`: Shows 16 tracked files under `Code\`.

To test **write/deploy access** to Google Apps Script:
```powershell
clasp push
```
*Expected*: `Pushed 16 files.` without errors.

#### C. Git & GitHub Connectivity
```powershell
git status
git remote -v
git log -n 3 --oneline
```
*Expected*: Clean branch status (or expected unstaged changes), remote tracking `origin/master`.

#### D. Automation Scripts
```powershell
powershell -ExecutionPolicy Bypass -File .\update_headers.ps1
```
*Expected*: Updates file header timestamps across all `.gs` and `.html` files in `Code/`.

### 4. Common Issues & Troubleshooting
*   **`invalid_grant` on `clasp push`**:
    *   *Cause*: The cached OAuth refresh token in `~/.clasprc.json` expired or was revoked.
    *   *Fix*: Run `clasp login` in the terminal to re-authenticate via browser.
*   **`clasp` command not found**:
    *   *Cause*: npm global directory not in environment `PATH`.
    *   *Fix*: Add `$env:APPDATA\npm` to User/System `PATH`.
*   **Drive Sync Conflicts**:
    *   *Cause*: Opening VS Code / editing on two synced machines simultaneously.
    *   *Fix*: Always adhere to the Hot-Potato Rule in `Docs/Workflows/Multi_Device_Setup.md`. Only work on one machine at a time and close VS Code after sync completes.

---

## 🚀 Current Project State (v0.7.11)
### Implemented Features
*   **Ingestion**: Watch Folder (Drive), Manual Upload, URL Import, Deduplication (MD5 + Temporal).
*   **Analysis**: Flight Mode Detection (Thermal/Soar/Glide), Basic Metrics.
*   **Scoring**: XContest Rules (Free/Flat/FAI).
*   **Geo**: Reverse Geocoding (BigDataCloud/Nominatim), Site Detection (Overpass).
*   **UI**: 2-Row Headers, Column Grouping, Status/Gear Dropdowns.

### Active Priorities (Next Session)
1.  **Public Log**: Auto-copy valid IGCs to a public "Master Log" folder (`CR-ING-004`).
2.  **SeeYou Integration**: Generate public links for flight visualization (`CR-UI-009`).
3.  **Logging**: Enhance visibility of process execution (`CR-LOG-003`).
4.  **Multiple Watch Folder**: Enhance `ENABLE_WATCH_FOLDER` (`CR-CFG-004`).

### Important Notes for Agent
*   **Config**: The `Parameters` sheet is the runtime source of truth. `Config.gs` is just the schema/defaults.
*   **Validation**: Detailed errors should go to the `App_Log` tab or `Notes` column (pipes separated), not just fail silently.
