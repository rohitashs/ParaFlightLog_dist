# Project Context & Ways of Working (Source of Truth)

## 🧠 Agent Memory & Context
**Status**: Active Development (v0.8.20)
**Last Session Focus**: Tri-Mode Execution Subsystem ([`CR-UI-019`](file:///g:/My%20Drive/~RS2B/~Projects/ParaFlightLogProject/Docs/Backlog.md) / [`DSGN-UI-001`](file:///g:/My%20Drive/~RS2B/~Projects/ParaFlightLogProject/Docs/Design/DSGN-UI-001_Tri_Mode_Execution_and_Universal_Sidebar.md)), Activity Logging System Overhaul ([`CR-LOG-004`](file:///g:/My%20Drive/~RS2B/~Projects/ParaFlightLogProject/Docs/Backlog.md) / [`DSGN-LOG-001`](file:///g:/My%20Drive/~RS2B/~Projects/ParaFlightLogProject/Docs/Design/DSGN-LOG-001_Activity_Logging_System_Overhaul.md)), Universal Dialog UI Standardization across 10 modal dialogs (header deduplication, standardized button bar docking, and copy-log consoles), and Platform Brochure publication (`External/ParaFlightLog_Brochure_v2.pdf`, `Docs/Brochure.md`).
**Next Focus**: Guided Task Wizards ([`CR-UI-020`](file:///g:/My%20Drive/~RS2B/~Projects/ParaFlightLogProject/Docs/Backlog.md)), Distributed Multi-Instance Update & Lifecycle Manager ([`RQ-SYS-010`](file:///g:/My%20Drive/~RS2B/~Projects/ParaFlightLogProject/Docs/Backlog.md)), and Configurable RDP Tolerance ([`CR-CFG-002`](file:///g:/My%20Drive/~RS2B/~Projects/ParaFlightLogProject/Docs/Backlog.md)).

This file is the **long-term memory** for the project. Read this first to understand *how* we work and *where* we are.

---

## 📂 Project Organization & File Structure
The project follows a strict folder hierarchy. `Docs/Context.md` is the source of truth for this structure.

### 1. `Docs/` (Persistent Documentation)
*   **Status**: **Git Tracked**.
*   **Purpose**: Long-term, evolving documentation. Source of Truth.
*   **Hierarchy Model**: Organized across **5 Altitudes / Tiers** to cater to distinct audiences (prospective pilots, active users, architects, and AI agents):

| Tier / Altitude | Focus & Target Audience | Core Files |
| :--- | :--- | :--- |
| **Tier 1: Strategic Vision** | Long-term intent, 5 Evolution Horizons, Open-Source roadmap & non-negotiable architectural tenets. *(Stakeholders, Community, AI)* | [`Roadmap.md`](file:///g:/My%20Drive/~RS2B/~Projects/ParaFlightLogProject/Docs/Roadmap.md) |
| **Tier 2: Public Manifesto** | High-level platform whitepaper, value proposition, Gemini AI advantage & "Why Sheets + Apps Script". *(World, Pilots, Clubs)* | [`Brochure.md`](file:///g:/My%20Drive/~RS2B/~Projects/ParaFlightLogProject/Docs/Brochure.md) |
| **Tier 3: Product & Operations** | Comprehensive functional capabilities catalog and complete pilot operational handbook. *(End-User Pilots, Flight Instructors)* | [`Features.md`](file:///g:/My%20Drive/~RS2B/~Projects/ParaFlightLogProject/Docs/Features.md)<br>[`User_Guide.md`](file:///g:/My%20Drive/~RS2B/~Projects/ParaFlightLogProject/Docs/User_Guide.md) |
| **Tier 4: Systems Architecture** | C4 serverless topology, global ERD model, 8-sheet unified data dictionary, math algorithms, and RFC design specs. *(Architects, Devs, AI)* | [`Architecture.md`](file:///g:/My%20Drive/~RS2B/~Projects/ParaFlightLogProject/Docs/Architecture.md)<br>[`Technical_Specification.md`](file:///g:/My%20Drive/~RS2B/~Projects/ParaFlightLogProject/Docs/Technical_Specification.md)<br>[`Design/`](file:///g:/My%20Drive/~RS2B/~Projects/ParaFlightLogProject/Docs/Design/README.md) (`DSGN-*.md`) |
| **Tier 5: Execution & Memory** | Tracked work units (`RQ`, `CR`, `Bug`), release history, and engineering memory / ways of working. *(Developers, AI Pair Programmers)* | [`Backlog.md`](file:///g:/My%20Drive/~RS2B/~Projects/ParaFlightLogProject/Docs/Backlog.md)<br>[`ChangeLog.md`](file:///g:/My%20Drive/~RS2B/~Projects/ParaFlightLogProject/Docs/ChangeLog.md)<br>[`Context.md`](file:///g:/My%20Drive/~RS2B/~Projects/ParaFlightLogProject/Docs/Context.md) |

*   **File Inventory**:
    *   **`Roadmap.md`**: Strategic Vision, 5 Evolution Horizons & Open-Source Roadmap.
    *   **`Brochure.md`**: Public Manifesto, Product Brochure & Platform Whitepaper.
    *   **`Architecture.md`**: Systems Architecture, Global Schemas, ERD & Unified Data Dictionary.
    *   **`Context.md`**: Project Context, Ways of Working & Agent Long-Term Memory.
    *   **`User_Guide.md`**: Complete Pilot Handbook, Setup Walkthrough & Metric Dictionary.
    *   **`Features.md`**: Functional capabilities (Admin, UI, System).
    *   **`Technical_Specification.md`**: Detailed Tech Specs, Math Algorithms & Code Reference.
    *   **`Design/`**: Formal Architectural & Detailed Design Specifications (`DSGN-*.md`), Template (`Design_template.md`), and Index (`README.md`).
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

### 1. Plan-First & Intent Alignment (Strict Pre-Execution Gate)
*   **Trigger**: Anytime the user requests an action involving modifying or adding code, configuration, or documentation.
*   **Mandatory Pre-Execution Protocol**:
    1.  **Analyze Intent**: Deeply analyze the user's intent, core motivation, edge cases, and functional ripple effects across the system.
    2.  **Surface Objections & Decisions**: Proactively surface any architectural trade-offs, potential pitfalls, design decisions, alternative approaches, or suggestions.
    3.  **Present an Unambiguous Plan**: Clearly lay out the proposed implementation plan, affected modules, schema impacts, and testing strategy.
    4.  **Iterate Collaboratively**: If the user has feedback or questions, iterate and refine the design until total alignment is reached.
    5.  **Wait for Explicit Approval**: **NEVER edit code or persistent documentation prematurely**. Only when an unambiguous plan has been presented and the user explicitly gives the command to **"execute"** (or unambiguous go-ahead) should execution begin.

### 2. Document-First Development
*   **`Roadmap.md`**: Define the *strategic vision, non-negotiable tenets, and evolution horizons*.
*   **`Brochure.md`**: Define the *public value proposition, pilot benefits, and platform overview*.
*   **`Features.md`**: Define the *functional capabilities and product features*.
*   **`Architecture.md` & `Technical_Specification.md`**: Define *how* the system is topologically structured, global schemas, and algorithmic implementation details.
*   **`Design/` (`DSGN-*.md`)**: Define *subsystem RFC specifications* prior to non-trivial code execution.
*   **`Backlog.md`**: Track *status* of implementation units (`RQ`, `CR`, `Bug`, `ToDo`).
*   **`Code/`**: Implement only after documentation and design specifications are fully aligned.

### 3. Backlog Management (`Docs/Backlog.md`)
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

### 4. Change Logging (`Docs/ChangeLog.md`)
*   Update at the end of every session.
*   Group by **Session** and **Date**.
*   List all `[Imp]` (Implemented) items from Backlog.

### 5. Session Summary Reports (`Plans/SessionSummary/`)
*   **Naming**: `YYYY-MM-DD_SessionSummary.md` (e.g. `2026-02-10_SessionSummary.md`).
*   **Purpose**: A snapshot of the session's achievements, discussions, and decisions.
*   **Structure**:
    1.  **Metadata**: Date, Time, Goal.
    2.  **Key Discussions**: Brief bullet points of what was discussed.
    3.  **Decisions Made**: Architectural or Product decisions.
    4.  **Work Completed**: Files changed, Features implemented, Bugs fixed.
    5.  **Open Issues / Next Steps**: What was left undone or added to backlog.
    6.  **References**: Links to relevant artifacts or docs.

### 6. Code Check Reports (`Plans/CodeCheckReports/`)
*   **Naming**: `YYYY-MM-DD_CodeCheck.md`.
*   **Purpose**: Result of automated or manual code reviews (`/code_check`).
*   **Structure**:
    1.  **Metadata**: Date, Scope (All files or specific module).
    2.  **Summary**: Pass/Fail/Warn status.
    3.  **Critical Issues**: Bugs, Logic Errors (Must Fix).
    4.  **Warnings**: Style, Optimization, Readability (Should Fix).
    5.  **Suggestions**: Refactoring ideas (Nice to have).

### 7. Doc Check Reports (`Plans/DocCheckReports/`)
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

### 8. Architectural Design Specifications (`Docs/Design/` & `/update_design`)
*   **Standards**: All significant subsystems, engines, and features maintain formal design specifications following [`Docs/Design/Design_template.md`](file:///g:/My%20Drive/~RS2B/~Projects/ParaFlightLogProject/Docs/Design/Design_template.md).
*   **Hierarchical Linking**: Header metadata explicitly establishes `Parent Design` and `Child Designs` links for bidirectional architectural navigation.
*   **Revision Synchronization**: Every umbrella code file in `Code/` maintains matching `@design` and `@revision` JSDoc header tags. When a design's revision increments, the corresponding code header is stamped to prevent design-code drift.
*   **Workflow (`/update_design`)**: Supports three operational modes: (1) New Design from template, (2) Sync / Delta Update from recent decisions or code edits, and (3) Reverse-Engineering designs from active working code.

### 9. Code Standards
*   **Naming**: `Service.gs` for modules. `privateFunction_` (trailing underscore) for non-exported helpers.
*   **Config**: Separation of Concerns. `Code.gs` = Logic, `Config.gs` = Constants, `Parameters Sheet` = Runtime Values.
*   **Validation**: Validate early. Fail gracefully with logs.
*   **Timestamps**: Always update file header timestamps before pushing. Use `.\update_headers.ps1` to automate this.

### 10. Multi-Device Workflow (`Docs/Workflows/Multi_Device_Setup.md`)
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
Edit the header of [`Code/Code.gs`](file:///g:/My%20Drive/~RS2B/~Projects/ParaFlightLogProject/Code/Code.gs) to update the timestamp and test note:
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
*Expected*: `Pushed 31 files.` with zero errors.

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
*   **Graceful Validation**: Detailed errors and partial failures should be recorded in `Activity Logs` (via centralized `LOG.write`) or `Notes` (pipe-separated) rather than failing silently.
*   **Document-First Integrity**: Always sync `Docs/` whenever features, parameters, or architecture change.
