---
description: Comprehensive code review, static analysis, and architectural integrity audit
---

# Code Review & Architecture Audit Workflow (/code_check)

This workflow defines the systematic audit protocol for the Paragliding Flight Log codebase. Run this workflow whenever major modifications are made or before deploying updates to Google Apps Script.

---

## 1. Audit Dimensions & Inspection Checklist

Audit all files under `Code/*.gs` and `Code/*.html` across the following 10 critical dimensions:

### 1. Public vs. Private Function Naming & RPC / Menu Bindings
- **Client RPC (`google.script.run`)**:
  - Google Apps Script strictly forbids calling functions with trailing underscores (`_`) via `google.script.run`.
  - Every `google.script.run.functionName(...)` in all HTML dialogs (`*.html`) MUST correspond to an exported public function without a trailing underscore in `Code/*.gs`.
  - Verify that the target function does not accidentally have a trailing underscore.
- **Custom UI Menus (`onOpen`)**:
  - All callback function names passed to `ui.createMenu().addItem(label, functionName)` MUST bind to clean public wrapper functions without trailing underscores (e.g. `scaffoldAll`, `deleteSystemSheets`, `backupSystemSheets`, `uiRefreshDashboard`, etc.).
  - Ensure every public wrapper is explicitly defined and delegates cleanly to the internal implementation.

### 2. Taxonomy & Nomenclature Parity
- **Sheet Names & Tabs**:
  - Verify consistent use of `TABS.*.name` throughout the entire codebase. Never hardcode tab names that diverge from `CFG.tabs`.
- **Lookups & Controlled Vocabularies**:
  - Ensure lookup names (e.g., `Equipment Categories`, `Flight Status`, `Flight Type`, `XC Classes`, `Date Formats`, `Time Formats`) match 1:1 between `Config.gs`, `Scaffold.gs`, `Ingestion.gs`, and validation rules.
  - Verify column indices in `applyFlightsValidation_` and `applyEquipmentValidation_` match the exact columns defined in `scaffoldConfig_`.
- **System Parameters**:
  - Verify parameter keys in `CFG.parameters` and `CFG.defaults` match across `Scaffold.gs`, `Config.gs`, `Code.gs`, and UI dialogs.

### 3. Pure Key-Value Preservation & Non-Destructive Config Sync
- **Config & Profile Sheet Integrity**:
  - Save (`exportConfigJson_`) and Load (`importConfigJson_`) MUST treat `Pilot_Profile` and `Parameters` as pure key-value stores.
  - Matching must strictly occur by key (Col A Field or Col A Parameter Key) and write strictly into the Value column (Col B).
  - Under NO circumstances may export or import modify sheet structure, overwrite section divider headers (`[ ... ]`), shift column indices, or write data into structural header rows.
- **Lookups Scope**:
  - Export/Import must only include manually controlled vocabularies (Cols 5-10).
  - Auto-generated lookups (Cols 11-14: Wings, Harnesses, Reserves, Other formulas) must NEVER be included in JSON config backups.

### 4. HTML Dialog Responsiveness, Scrollability & Layout
- **Container Overflow**:
  - Every modal dialog must ensure `overflow-y: auto`, flexible content containers, and sticky headers/footers. No content or buttons should be clipped at default dialog dimensions.
- **Modal Sizing**:
  - Sizing parameters in `HtmlService.createTemplateFromFile().setWidth(w).setHeight(h)` must comfortably contain all controls without clipped buttons or hidden progress bars.

### 5. Accurate State Badges & Reactive Disabled States
- **Entity Counts**:
  - Checkboxes and badges in Save and Load dialogs must accurately reflect the exact entity count:
    - Pilot Profile: 29 fields
    - System Parameters: 49 keys across 5 groups (8 Ingestion, 16 Integrations, 19 Scoring, 2 Formats/Units, 4 UI)
    - Lookups: 6 manual lists
- **Missing Section Protection**:
  - In `LoadConfigDialog.html`, if a section or sub-section is missing or empty in an uploaded file, the UI must explicitly disable and grey out that control with an opacity transition, preventing user error.

### 6. Error Handling & Resilient Fallbacks
- **External Network Services**:
  - All external network calls (Open-Meteo, Open Elevation, Nominatim, XContest, AirGenz) must have timeouts, retries, and silent fallbacks. Ingestion must never crash because an external API is down or rate-limited.
- **Drive Operations**:
  - Validate folder and file accessibility with `cleanDriveId_()` and `try/catch` wrappers.

### 7. Sheet Mutation Performance & Batch Operations
- **Batch Processing**:
  - Avoid cell-by-cell `getValue()` / `setValue()` in loops. Always use batch operations: `getRange().getValues()` and `setValues()`.
- **Sheet Caching**:
  - Use memory caches for column maps (`getColumnMap_`) and existing flight hashes (`getExistingSheetHashes_`) during multi-row ingest.

### 8. Date, Time & Locale Robustness
- **Date Coercion**:
  - Google Sheets can return dates as JS `Date` objects, epoch numbers, or formatted strings. Parsers must handle all three formats gracefully.
- **Type Coercion**:
  - Guard against boolean coercion issues (e.g. `Number(true) === 1`) when reading parameters.

### 9. Script Execution Quota & Chunking
- **Batch Limits**:
  - Long-running processes (bulk ingestion, re-sync) must process in discrete batches (e.g. 5-10 files) with client-orchestrated progress and cancellation support to stay well under Apps Script's 6-minute execution quota.

### 10. Syntax, Linting & Offline Harness Parity
- **Static Verification**:
  - Verify syntax across all `.gs` files using Node.js static analysis.
  - Verify all RPC functions called by HTML files are defined in `.gs` files.
  - Run the offline test harness (`scratch/run_unit_tests.js`) before pushing to Google Apps Script.

---

## 2. Review Protocol & Report Generation

1. **Perform Static Analysis**:
   - Inspect all `.gs` files against the checklist above.
   - Inspect all `.html` files for `google.script.run` signatures and element IDs.
2. **Execute Offline Test Harness**:
   - Run `node scratch/run_unit_tests.js` to verify syntax and mock executions.
3. **Compile Code Check Report**:
   - **Location**: `Plans/CodeCheckReports/`
   - **File Name**: `YYYY-MM-DD_CodeCheck.md`
   - **Structure**:
     1. Metadata (Date, Auditor, Files Reviewed, Pass/Fail status)
     2. Executive Summary
     3. Critical Issues (Breaking bugs, trailing underscore RPC failures, schema mismatches)
     4. Warnings (Performance bottlenecks, potential race conditions, unhandled exceptions)
     5. Optimization & Cleanliness Suggestions
4. **Present Findings**:
   - Present a concise summary to the user with actionable next steps.
