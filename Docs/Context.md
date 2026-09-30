# Project Context & Ways of Working (Source of Truth)

## 🧠 Agent Memory & Context
**Status**: Active Development (v0.8.7)
**Last Session Focus**: Automated Historical Weather Enrichment (`RQ-SCR-004`), Unified Flight Maintenance Dialog (`RQ-SYS-007`), In-App User Guide & Metric Dictionary (`RQ-SYS-006.1`), Pilot Profile Tab (`RQ-SYS-009.1`), Dynamic Dashboard Formulas (`CR-SYS-001`).
**Next Focus**: Setup Wizard & Instance Templating (`RQ-SYS-008`), Dashboard & Inspector Pilot Profile Integration (`RQ-SYS-009.2`), Flight Inspector Enhancements (`RQ-SYS-004`), XContest Matching Investigation (`Bug-SCR-002`).

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
    *   **`Archive/`**: Old plans/tasks.
    *   **`SessionSummary/`**: Session Summary Reports (`YYYY-MM-DD_SessionSummary.md`).
    *   **`CodeCheckReports/`**: Code Review Reports (`YYYY-MM-DD_CodeCheck.md`).
    *   **`DocCheckReports/`**: Documentation Audit Reports (`YYYY-MM-DD_DocCheck.md`).

### 3. `Code/` (Implementation)
*   **Status**: **Git Tracked**.
*   **Files**: All `.gs` files, `.html` dialog templates, `appsscript.json`, and deployment scripts (`update_headers.ps1`).


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
*   **Purpose**: Result of automated or manual code reviews (`/code_check`).
*   **Structure**:
    1.  **Metadata**: Date, Scope (All files or specific module).
    2.  **Summary**: Pass/Fail/Warn status.
    3.  **Critical Issues**: Bugs, Logic Errors (Must Fix).
    4.  **Warnings**: Style, Optimization, Readability (Should Fix).
    5.  **Suggestions**: Refactoring ideas (Nice to have).

### 6. Doc Check Reports (`Plans/DocCheckReports/`)
*   **Naming**: `YYYY-MM-DD_DocCheck.md`.
*   **Purpose**: Result of automated documentation synchronization audits (`/doc_check`).
*   **Structure**:
    1.  **Metadata & Scope**: Date, audit scope, reference commit.
    2.  **Executive Summary**: Pass/Warn/Fail status and discrepancy counts.
    3.  **Code-to-Doc Drift**: Modules, functions, and config parameters.
    4.  **Cross-Doc Consistency & Duplication**: Stale versions and conflicting guidelines.
    5.  **Backlog Traceability**: Status alignment with actual code features.
    6.  **Stale References & Dead Links**: Obsolete names or broken links.
    7.  **Proposed Remediation Plan**: File-by-file update plan.

### 7. Code Standards
*   **Naming**: `Service.gs` for modules. `privateFunction_` (trailing underscore) for non-exported helpers.
*   **Config**: Separation of Concerns. `Code.gs` = Logic, `Config.gs` = Constants, `Parameters Sheet` = Runtime Values.
*   **Validation**: Validate early. Fail gracefully with logs.
*   **Timestamps**: Always update file header timestamps before pushing. Use `.\update_headers.ps1` to automate this.

### 8. Multi-Device Workflow (`Docs/Workflows/Multi_Device_Setup.md`)
*   **Critical**: Never work on two computers at once.
*   **Protocol**: Always wait for Google Drive sync **before** opening VS Code. Acknowledge the risk of Git inside Drive.
*   **Hand-off**: Commit & Push on A -> Wait for Sync -> Pull on B.

---

## 💻 Development Infrastructure Setup (`DevInfraSetup`)
*Use this section whenever setting up the project on a new computer or verifying the dev environment.*

### 1. Required Infrastructure & Tooling
*   **Git**: Git for Windows installed. Git Credential Manager configured for GitHub access (`https://github.com/rohitashs/RSParaFlightLogProject.git`).
*   **Node.js & npm**: Node.js v20+ or v24+ LTS installed. (Provides runtime for Clasp CLI).
*   **Google Clasp CLI**: `@google/clasp` installed globally (`npm install -g @google/clasp`).
*   **PowerShell**: Standard shell for running deployment scripts (e.g. `.\update_headers.ps1`).
*   **Project Config**: `.clasp.json` in workspace root pointing to:
    *   `scriptId`: `10l-5rIDf0osLjy46qbLm2skoyXQRFGq5Dj7dl5hScjhGdy0IO_BiQqol`
    *   `rootDir`: `Code/`

### 2. Required Logins, Authentications & Permissions
To develop and deploy changes, three distinct permission layers must be authorized:

1.  **Google Account & Apps Script API (Developer Access)**:
    *   **Account Access**: Your Google account must have Editor permissions on the Google Sheet and its container-bound Apps Script project (`scriptId: 10l-5rIDf0osLjy46qbLm2skoyXQRFGq5Dj7dl5hScjhGdy0IO_BiQqol`).
    *   **Enable Google Apps Script API**: Must be toggled **ON** in Google Account user settings at: [https://script.google.com/home/usersettings](https://script.google.com/home/usersettings). Without this, Clasp API requests are rejected.
    *   **Clasp CLI Authorization**: Run `clasp login` once per machine in an interactive terminal. This opens the browser OAuth consent screen and saves credentials locally to `~/.clasprc.json`. (Required scopes include `script.deployments`, `script.projects`, `drive.file`, and `logging.read`).
2.  **GitHub & Git Credential Manager**:
    *   **Repository Access**: Write/Push access to `https://github.com/rohitashs/RSParaFlightLogProject.git`.
    *   **Interactive Terminal Login**: On Windows, Git Credential Manager (`GCM`) caches OAuth tokens in Windows Credential Manager (`git:https://github.com`). The first `git push` must be run from an **interactive terminal** (not a headless background tool) so GCM can display the "Sign in with your browser" prompt.
3.  **Google Sheets Runtime Authorization (User Scopes)**:
    *   When functions are run from the spreadsheet UI (e.g. `Flight Log` menu -> `Scaffold` or `Scan Watch Folder`), Google prompts for one-time runtime permission approval (`Review Permissions` -> `Advanced` -> `Go to FlightLogScript (unsafe)` -> `Allow`) to access Sheets, Drive folders, and external APIs (`UrlFetchApp`).

### 3. New Machine Setup Checklist
When configuring a fresh IDE/machine:
1.  **Install Node.js & Git**: Verify with `node -v` and `git --version`.
2.  **Install Clasp**:
    ```powershell
    npm install -g @google/clasp
    ```
    *Ensure `npm` global bin directory (e.g. `C:\Users\<user>\AppData\Roaming\npm`) is in system `PATH`.*
3.  **Enable Apps Script API**:
    Verify that the Apps Script API is enabled at [https://script.google.com/home/usersettings](https://script.google.com/home/usersettings).
4.  **Authorize Clasp**:
    ```powershell
    clasp login
    ```
    *Log in with the Google account owning the spreadsheet script.*
5.  **Verify Script Binding**:
    Confirm `.clasp.json` exists in project root with valid `scriptId` and `rootDir: "Code/"`.
6.  **Authenticate Git**:
    Run `git remote -v` and perform an initial `git fetch` or `git push` in an interactive terminal to allow Git Credential Manager to sign in.

### 4. End-to-End Verification Test (Actual Code Change)
To verify the entire toolchain (local file edit -> Google Apps Script deployment -> GitHub sync), follow this standard smoke test:

#### Step 1: Tooling Availability
```powershell
Get-Command git, node, npm, clasp -ErrorAction SilentlyContinue | Select-Object Name, Source
node -v
clasp -v
clasp show-authorized-user
```
*Expected*: All commands resolve, and `show-authorized-user` outputs your Google account email.

#### Step 2: Make a Test Code Change
Edit the header of [`Code/Code.gs`](file:///g:/My%20Drive/~RS2ndBrain/~Projects/ParaFlightLogProject/Code/Code.gs) to update the timestamp and test note:
```javascript
/**
 * Paragliding Flight Log v2.0
 * Updated: YYYY-MM-DD HH:MM:SS
 * Test access verification: Verified GAS write access on YYYY-MM-DD HH:MM:SS.
 * 
 * CORE MODULE: Orchestration Only.
...
```

#### Step 3: Deploy to Google Apps Script
```powershell
clasp status
clasp push
```
*Expected*: `Pushed 16 files.` with zero errors.

#### Step 4: Verify & Commit to Git
```powershell
git status
# Confirm Code/Code.gs is modified
git add Code/Code.gs
git commit -m "Test: Verify dev environment and GAS push on YYYY-MM-DD"
```
*Expected*: Commit created cleanly.

#### Step 5: Push to GitHub & Verify Clean State
```powershell
git push origin master
git status
```
*Expected*: `Your branch is up to date with 'origin/master'`, `working tree clean`.

### 5. Common Issues & Troubleshooting
*   **`invalid_grant` on `clasp push`**:
    *   *Cause*: The cached OAuth refresh token in `~/.clasprc.json` expired or was revoked.
    *   *Fix*: Run `clasp login` in an interactive terminal to re-authenticate via browser.
*   **`User has not enabled the Apps Script API`**:
    *   *Cause*: Google Apps Script API toggle is OFF for your account.
    *   *Fix*: Go to [https://script.google.com/home/usersettings](https://script.google.com/home/usersettings) and toggle it to **ON**.
*   **Git Credential Manager popup not showing (hanging background push)**:
    *   *Cause*: Background sub-shells on Windows run headless and cannot display the GCM interactive OAuth modal dialog.
    *   *Fix*: Run `git push` once directly in an interactive PowerShell or VS Code terminal. Complete the one-time browser OAuth login to store the GitHub credential in Windows Credential Manager.
*   **`clasp` command not found**:
    *   *Cause*: npm global directory not in environment `PATH`.
    *   *Fix*: Add `$env:APPDATA\npm` to User/System `PATH`.
*   **Drive Sync Conflicts**:
    *   *Cause*: Opening VS Code / editing on two synced machines simultaneously.
    *   *Fix*: Always adhere to the Hot-Potato Rule in `Docs/Workflows/Multi_Device_Setup.md`. Only work on one machine at a time and close VS Code after sync completes.

---

## 📌 Guiding Principles
*   **Config Authority**: The `Parameters` sheet is the runtime source of truth. `Config.gs` defines the default schema and constants.
*   **Graceful Validation**: Detailed errors and partial failures should be recorded in `App_Log` or `Notes` (pipe-separated) rather than failing silently.
*   **Document-First Integrity**: Always sync `Docs/` whenever features, parameters, or architecture change.
