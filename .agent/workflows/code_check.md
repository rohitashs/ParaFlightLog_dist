---
description: Comprehensive code review, static analysis, and architectural integrity audit
---

# Code Review & Architecture Audit Workflow (/code_check)

This workflow defines the systematic audit protocol for the Paragliding Flight Log codebase. Run this workflow whenever major modifications are made or before deploying updates to Google Apps Script.

> [!IMPORTANT]
> **Zero False-Pass Mandate**: A code check report may **NEVER** claim `PASS` based on subjective review alone. Automated static analysis (`node tools/code_check_audit.js`) and offline test suites (`node tools/run_all_offline_tests.js`) must be executed as Step 1 and exit with code 0 (zero errors, zero unverified warnings).

---

## 1. Audit Dimensions & Inspection Checklist

Audit all files under `Code/*.gs` and `Code/*.html` across the following 12 critical dimensions:

### 1. Public vs. Private Function Naming & RPC / Menu Bindings
- **Client RPC (`google.script.run`)**:
  - Google Apps Script strictly forbids calling functions with trailing underscores (`_`) via `google.script.run`.
  - Every `google.script.run.functionName(...)` in all HTML dialogs (`*.html`) MUST correspond to an exported public function without a trailing underscore in `Code/*.gs`.
- **Custom UI Menus (`onOpen`)**:
  - All callback function names passed to `ui.createMenu().addItem(label, functionName)` in `Code/Code.gs` MUST bind to clean public wrapper functions without trailing underscores.

### 2. Taxonomy & Nomenclature Parity
- **Sheet Names & Tab Constants**:
  - Verify consistent use of `TABS.*.name` throughout the entire codebase. Never hardcode tab names that diverge from `CFG.tabs` or `CFG.sheets`.
  - Ensure canonical tab keys: `SYSTEM_LOG` (`'System Log'`, with backward-compatibility alias `TABS.ACTIVITY`), `CONFIG` (`'Config'`), `QUEUE` (`'Automation_Queue'`), `PILOT_PROFILE` (`'Pilot_Profile'`), `USER_GUIDE` (`'User Guide'`), `EQUIPMENT` (`'Equipment'`), `FLIGHTS` (`'Flights'`), `DASHBOARD` (`'Dashboard'`).
- **Lookups & Controlled Vocabularies**:
  - Ensure lookup names (e.g., `Equipment Categories`, `Flight Status`, `Flight Type`, `XC Classes`, `Date Formats`, `Time Formats`) match 1:1 between `Config.gs`, `Scaffold.gs`, `Ingestion.gs`, and validation rules.
- **System Parameters**:
  - Verify parameter keys match across `DEFAULT_PARAMETERS` (50 keys), `CFG.parameters`, `Scaffold.gs`, and UI dialogs.

### 3. Pure Key-Value Preservation & Non-Destructive Config Sync
- **Config & Profile Sheet Integrity**:
  - Save (`exportConfigJson_`) and Load (`importConfigJson_`) MUST treat `Pilot_Profile` and `Config` parameters as pure key-value stores.
  - Matching must strictly occur by key (Col A Field or Col A Parameter Key) and write strictly into the Value column (Col B).
  - Under NO circumstances may export or import modify sheet structure, overwrite section divider headers (`[ ... ]`), shift column indices, or write data into structural header rows.
- **Lookups Scope**:
  - Export/Import must only include manually controlled vocabularies (Cols 5-10). Formula-driven lookups (Cols 11-14: Wings, Harnesses, Reserves, Other formulas) must NEVER be included in JSON config backups.

### 4. HTML Dialog Responsiveness, Scrollability & Layout
- **Container Overflow & Modal Bounds**:
  - Every modal dialog must ensure `box-sizing: border-box`, flexible content containers, `overflow-y: auto`, and sticky headers/footers. No content or buttons should be clipped at default dialog dimensions.
- **Header Deduplication**:
  - Avoid redundant inner title bars (`<div class="header-large ...">`) that duplicate Google Sheets' native modal title bar.

### 5. Accurate State Badges & Reactive Disabled States
- **Entity Counts (Current Baseline)**:
  - Checkboxes and badges in Save and Load dialogs must accurately reflect active counts:
    - **Pilot Profile**: **34 fields** across 6 sections (`[ Identity ]`, `[ Licensing ]`, `[ Affiliations ]`, `[ Emergency / SAR ]`, `[ Tracking / Gear ]`, `[ Progression ]`).
    - **System Parameters**: **50 keys** across 5 groups (8 Ingestion, 16 Integrations & Geo/Time, 19 Scoring & Physics, 2 Formats/Units, 4 UI/Currency).
    - **Lookups**: **6 manual controlled vocabularies** (Cols 5–10).
- **Missing Section Protection**:
  - In `LoadConfigDialog.html`, if a section is missing in an uploaded file, the UI must explicitly disable and dim that control (`opacity: 0.45; pointer-events: none`).

### 6. Error Handling & Resilient Fallbacks
- **External Network Services**:
  - All external network calls (Open-Meteo, Open Elevation, Nominatim, XContest, AirGenz, Paragliding Earth) must have timeouts, retries, and silent fallbacks. Ingestion must never crash because an external API is down or rate-limited.
- **Drive Operations**:
  - Validate folder and file accessibility with `cleanDriveId_()` and `try/catch` wrappers. The `Config` sheet is the sole authority for folder configuration (`validateRequiredFolders_`).

### 7. Sheet Mutation Performance & Batch Operations
- **Batch Processing**:
  - Avoid cell-by-cell `getValue()` / `setValue()` in loops. Always use batch operations: `getRange().getValues()` and `setValues()`.
- **In-Memory Row Scoring**:
  - Deduplication must score flight quality in memory (`scoreFlightQualityFromRow_`), never invoking `DriveApp.getFileById()` in tight loops.

### 8. Date, Time & Locale Robustness
- **Display Values for Date/Time Matching (Pattern 8)**:
  - Deduplication and overlap checks must read date/time cells via `getDisplayValues()` to prevent JavaScript `Date` script timezone rollover and 1899 epoch drift.

### 9. Long-Running Workloads & Tri-Mode Contract
- **4.5-Minute Safety Threshold (Pattern 11)**:
  - Batch workloads must use `TimeBudgetService` to checkpoint state and install self-continuation triggers before hitting the 6-minute Google Apps Script execution timeout.
- **Tri-Mode Execution Contract (Pattern 13)**:
  - All batch operations must support: (1) Modal Stepping, (2) Universal Sidebar (`ExecutionSidebar.html`), and (3) Headless Background Queue (`QueueService`).

### 10. Native Sheets Optimization & Anti-Patterns (Patterns & Practices)
- **Dynamic Name-Based Columns (Pattern 1)**: Formula generators must NEVER hardcode column letter strings (`"B"`, `"C"`, `"L"`); resolve dynamically via `getColLetter_(map, name)`.
- **Native Named Ranges (Pattern 2)**: Lookups and control cells must bind to workbook Named Ranges (`LOOKUP_*`, `DASHBOARD_REVIEW_FILTER`).
- **Open-Ended Validations (Pattern 4)**: Data validations must span to `sh.getMaxRows()` with `.setAllowInvalid(true)` to gracefully handle unlisted gear.
- **Soft Guardrails (Pattern 5)**: Critical ranges (Headers, `Flight No`, Dashboard summaries) must use native range protection with `setWarningOnly(true)`.
- **Dual-Tier Logging & Orchestrator-Worker Contract (Pattern 24 & DSGN-LOG-002)**: Workers must NEVER call `LOG.write()` inside tight loops; stream micro-steps to live UI Activity Log (`#logConsole`) and report milestones to `LOG.createSession()`; orchestrators enforce category/rule log level filtering and commit gates before flushing to `System Log`.

### 11. Deprecated & Legacy Identifiers Blacklist Scan
- **Zero Legacy Pollution**:
  - Scan for retired tab names (`App_Log`, `App Log`, standalone `Parameters` or `Lookups` tabs), obsolete cache actions (`Clear Dedupe Cache`), or deprecated parameters.
  - Any reference to legacy identifiers outside of intentional, tagged migration bridges (`// Legacy migration bridge`) is a critical audit failure.

### 12. System Manifest & Maintenance Orchestrator Integrity (Pattern 16)
- **Three-Way Manifest Parity**:
  - Every component declared in `SYSTEM_MANIFEST.components` in `Code/Config.gs` must have:
    1. An entry in `CFG.MANIFEST_SHEET_METADATA`.
    2. A corresponding atomic scaffold handler in `Code/Scaffold.gs`.
    3. A corresponding matrix cell mapping in `Code/SystemMaintenanceDialog.html`.
- **Zero Display-Name to Key Equality Comparisons**:
  - Never compare sheet tab display names (which contain spaces) directly to internal keys (which contain underscores), e.g., `sheetName === sName`. Use dictionary lookups indexed by canonical component key.
- **Mandatory Invariant Auto-Enforcement**:
  - Verify that mandatory components represent non-negotiable structural invariants auto-enforced by the orchestrator regardless of sheet-level gating.

---

## 2. Review Protocol & Report Generation

1. **Step 1: Execute Automated Static Integrity Audit**:
   ```bash
   node tools/code_check_audit.js
   ```
   *Must exit with code 0 (0 critical errors).*

2. **Step 2: Execute Offline Test Harness**:
   ```bash
   node tools/run_all_offline_tests.js
   ```
   *Must pass all 13 automated test suites with 0 failures.*

3. **Step 3: Compile Code Check Report**:
   - **Location**: `Plans/CodeCheckReports/`
   - **File Name**: `YYYY-MM-DD_CodeCheck.md`
   - **Structure**:
     1. Metadata (Date, Auditor, Files Reviewed, Pass/Fail status, Reference Commit)
     2. Executive Summary (Highlighting automated script results)
     3. 12-Dimension Audit Results
     4. Critical Issues (Breaking bugs, trailing underscore RPC failures, schema mismatches, legacy tokens)
     5. Warnings (Performance bottlenecks, potential race conditions, unhandled exceptions)
     6. Optimization & Cleanliness Suggestions

4. **Step 4: Present Findings**:
   - Present a concise executive summary to the user with actionable next steps and a clickable link to the generated report.

---

## 3. Workflow Self-Evolution & Maintenance Triggers

Whenever the project's architecture, patterns, or schemas evolve, this workflow and its automated tools must be immediately re-evaluated and synchronized:

| Trigger Event | Required Workflow / Tool Updates |
| :--- | :--- |
| **New Pattern in `Patterns_and_Practices.md`** | Add pattern assertion to `tools/code_check_audit.js` and add audit rule to Dimension 10. |
| **New/Renamed Tab or Identifier** | Add retired identifier to `legacyBlacklist` in `tools/code_check_audit.js`; update Dimension 2 & 11. |
| **Manifest Component Added or Modified** | Update `SYSTEM_MANIFEST` checks in Dimension 12 and parity assertions in `code_check_audit.js`. |
| **Parameter or Entity Count Change** | Update baseline entity counts in Dimension 5 and assertions in `code_check_audit.js`. |
| **New Batch Dialog Created** | Verify Tri-Mode contract in Dimension 9; ensure RPCs are scanned in `code_check_audit.js`. |
