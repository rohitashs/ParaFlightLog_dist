# Design Specification: Activity Logging System

* **Design ID**: `DSGN-LOG-001`
* **Status**: `Under Review`
* **Current Revision**: `Rev 1.0`
* **Date Created**: `2026-10-01`
* **Last Updated**: `2026-10-01`
* **Author / Contributors**: `Rohitash / Antigravity AI`
* **Parent Design**: `None`
* **Child Designs**: `None`
* **Umbrella Module / Primary Code**: [`Code/Logger.gs`](file:///g:/My%20Drive/~RS2B/~Projects/ParaFlightLogProject/Code/Logger.gs)
* **Code Revision Stamp**: `Pending Implementation`
* **Related Requirements / CRs**: `RQ-ING-002`, `CR-LOG-004`

---

## 1. Executive Summary & Intent

### Problem Statement
The legacy logging tab (`App_Log`) was implemented early in Phase 1 as an ad-hoc, file-by-file debugging utility with a rigid 6-column schema: `['Timestamp', 'FileID', 'FileName', 'InnerName', 'Status', 'Info']`. This legacy approach suffers from critical limitations:
1. **Ingestion Blindspot**: Columns like `FileID`, `FileName`, and `InnerName` are meaningless for 90% of system operations (Configuration backups, Sheet scaffolding, Re-sync, Purging, Dashboard refreshes, Maintenance backfills). Non-file operations were forced to stuff dummy strings into `InnerName` and leave `FileID` blank.
2. **Disconnected Observability**: Modern modal dialogs ([`BulkIngestDialog.html`](file:///g:/My%20Drive/~RS2B/~Projects/ParaFlightLogProject/Code/BulkIngestDialog.html), [`ResyncDialog.html`](file:///g:/My%20Drive/~RS2B/~Projects/ParaFlightLogProject/Code/ResyncDialog.html), [`PurgeDialog.html`](file:///g:/My%20Drive/~RS2B/~Projects/ParaFlightLogProject/Code/PurgeDialog.html), [`URLDialog.html`](file:///g:/My%20Drive/~RS2B/~Projects/ParaFlightLogProject/Code/URLDialog.html)) display rich, human-readable real-time **Activity Log** consoles with clear lifecycle phases (Start, Discovery, Batch processing, Sorting, Completion). However, almost none of that high-level narrative is recorded in `App_Log`.
3. **Silent Background Execution**: Automated watch folder triggers (`processWatchFolder`) run headlessly. If a scan finds zero files or experiences a folder access issue, nothing is recorded in `App_Log`, leaving pilots blind to background trigger health.
4. **Scattered Architecture**: Logging functions (`logImport_` and `logImportBatch_`) are buried inside [`Code/Ingestion.gs`](file:///g:/My%20Drive/~RS2B/~Projects/ParaFlightLogProject/Code/Ingestion.gs) rather than being accessible as a first-class, centralized system service.

### Proposed Solution
Overhaul the logging architecture into a clean, unified **Activity Logging Engine**:
* Rename the sheet tab to **`Activity Logs`** with a standardized, readable 4-column schema: `['Process', 'Timestamp', 'Activity / Event', 'Additional Info']`.
* Establish an **extensible Process ID registry** (`CFG.LOG_PROCESSES`) and **extensible Message Prefix registry** (`CFG.LOG_PREFIXES`) in `Config.gs`.
* Implement **tiered logging levels** (`Brief`, `Normal`, `Debug`) allowing pilots to control spreadsheet log verbosity while transient dialog consoles always display full `Normal` stream visibility.
* Implement a **conservative dual-threshold log retention guardrail** (`LOG_ROWS_TO_KEEP: 2000`, `LOG_TIME_TO_KEEP_DAYS: 90`) ensuring historical logs are preserved unless they violate *both* size and age limits.
* Add a **📋 Copy Log** button to all dialog consoles so pilots can easily capture full diagnostic streams to their clipboard on demand.
* Centralize all logging into an isolated, defensive service: [`Code/Logger.gs`](file:///g:/My%20Drive/~RS2B/~Projects/ParaFlightLogProject/Code/Logger.gs).

---

## 2. Requirements & Scope

### Functional Requirements
* **REQ-1 (Schema & Renaming)**: Rename `App_Log` to `Activity Logs` with 4 columns: `Process` (Col A), `Timestamp` (Col B), `Activity / Event` (Col C), and `Additional Info` (Col D). Provide automated in-place migration for existing sheets.
* **REQ-2 (Extensible Process Taxonomy)**: Centralize Process ID keys and labels in `CFG.LOG_PROCESSES` in `Config.gs`. Allow processes to pass standard keys or custom strings.
* **REQ-3 (Extensible Message Prefixes)**: Standardize message prefixes (`[START]`, `[INFO]`, `[OK]`, `[DUPE]`, `[WARN]`, `[ERR]`, `[COMPLETE]`) in `CFG.LOG_PREFIXES`.
* **REQ-4 (Tiered Log Levels)**: Add parameter `LOG_LEVEL` (`Brief`, `Normal`, `Debug`). In `Brief` mode, record only lifecycle boundaries and errors to the sheet; in `Normal`, record transactions; in `Debug`, record rich technical metadata.
* **REQ-5 (Conservative Retention Guardrail)**: Add parameters `LOG_AUTO_CLEAN`, `LOG_CLEAN_FREQUENCY_DAYS`, `LOG_ROWS_TO_KEEP`, and `LOG_TIME_TO_KEEP_DAYS` under section `[ Logging & Admin ]`. Prune rows only when they exceed the row threshold *and* are older than the age threshold. Provide both automated background execution and an on-demand Admin menu item.
* **REQ-6 (UI Copy to Clipboard)**: Add a `Copy Log` button to all modal activity log headers with instant visual feedback ("Copied!").
* **REQ-7 (Defensive Isolation)**: Ensure logging operations are wrapped in `try/catch` guards so that logging exceptions never abort core flight ingestion, scoring, or user operations.

### Non-Goals (Out of Scope)
* **NON-GOAL-1**: Storing logs in external third-party observability platforms (e.g. CloudWatch, Datadog). All logging remains native, serverless, and private within the pilot's Google Sheet.
* **NON-GOAL-2**: Real-time multi-client WebSockets streaming. Dialogs poll or receive updates through existing Apps Script client-stepping RPCs.

---

## 3. Architecture & Detailed Design

### 3.1 Sheet Specification (`Activity Logs`)

* **Sheet Name**: `'Activity Logs'` *(registered in `CFG.sheets.appLog` and `TABS.APP_LOG.name`)*
* **Tab Color**: Dark Red (`#D32F2F`, matching system audit conventions)
* **Tab Position**: Index 7 (final tab in standard logbook ordering)
* **Frozen Rows**: 2 (Row 1: Title Banner, Row 2: Column Headers)
* **Default Dimensions**: 2,000 rows, 4 columns (auto-expanding as needed)

| Col | Field | Recommended Width | Alignment & Formatting | Content & Behavior |
| :---: | :--- | :---: | :--- | :--- |
| **A** | **Process** | `175 px` | Left, Bold, Plain Text | Subsystem identifier resolved via `CFG.LOG_PROCESSES` (e.g. `Bulk Ingestion`, `Watch Folder`, `Save Config`). |
| **B** | **Timestamp** | `165 px` | Center, `yyyy-mm-dd hh:mm:ss` | Execution date and time. |
| **C** | **Activity / Event** | `530 px` | Left, Text Wrap, Normal | Human-readable narrative identical to on-screen activity logs, with standard prefix tags (`[START]`, `[OK]`, `[DUPE]`, `[WARN]`, `[ERR]`, `[COMPLETE]`). |
| **D** | **Additional Info** | `380 px` | Left, Text Wrap, 9pt Font | Detailed technical metadata, Drive IDs, error stack traces, execution durations, or parameter snapshots. Populated for errors and debug levels; empty for clean routine events. |

### 3.2 Configuration Parameters (`Config` Sheet)
Added under a new sub-header `[ Logging & Admin ]` in `Code/Config.gs`:

```
[ Logging & Admin ]
LOG_LEVEL:                   Normal       (Dropdown: Brief, Normal, Debug)
LOG_AUTO_CLEAN:              Yes          (Dropdown: Yes, No)
LOG_CLEAN_FREQUENCY_DAYS:    3            (Integer days between automatic checks)
LOG_ROWS_TO_KEEP:            2000         (Minimum row retention threshold)
LOG_TIME_TO_KEEP_DAYS:       90           (Minimum age retention threshold)
```

### 3.3 Extensible Registries (`Code/Config.gs`)

```javascript
CFG.LOG_PROCESSES = {
  WATCH_FOLDER:   'Watch Folder',
  BULK_INGEST:    'Bulk Ingestion',
  URL_IMPORT:     'URL / Drive Import',
  FILE_UPLOAD:    'File Upload',
  MANUAL_ENTRY:   'Manual Flight Entry',
  MAINTENANCE:    'Flight Maintenance',
  DUPE_TRIAGE:    'Duplicate Triage',
  PURGE_FLIGHTS:  'Purge Flights',
  MASTER_RESYNC:  'Master Re-sync',
  SAVE_CONFIG:    'Save Config',
  LOAD_CONFIG:    'Load Config',
  SYSTEM_SETUP:   'System Setup',
  LOG_CLEAN:      'Log Maintenance'
};

CFG.LOG_PREFIXES = {
  START:    '[START]',
  INFO:     '[INFO]',
  OK:       '[OK]',
  DUPE:     '[DUPE]',
  WARN:     '[WARN]',
  ERR:      '[ERR]',
  COMPLETE: '[COMPLETE]'
};
```

### 3.4 Service Architecture (`Code/Logger.gs`)

```javascript
/**
 * Paragliding Flight Log - Activity Logging Engine
 * 
 * @design Docs/Design/DSGN-LOG-001_Activity_Logging_System.md
 * @revision Rev 1.0
 * @status In Development
 */
var LOG = {
  /**
   * Resolves a process key or string into a standardized display label.
   */
  resolveProcess: function(key) {
    if (!key) return 'System';
    if (typeof CFG !== 'undefined' && CFG.LOG_PROCESSES && CFG.LOG_PROCESSES[key]) {
      return CFG.LOG_PROCESSES[key];
    }
    return key;
  },

  /**
   * Appends a single log entry to Activity Logs respecting the current LOG_LEVEL.
   */
  write: function(processKey, message, additionalInfo, date) { ... },

  /**
   * Appends an array of log entries to Activity Logs in one atomic sheet call.
   */
  writeBatch: function(entries) { ... },

  /**
   * Creates an in-memory session logger for multi-step tasks.
   * Buffers lines in memory and writes them atomically via flush().
   */
  createSession: function(processKey) {
    var proc = this.resolveProcess(processKey);
    var buffer = [];
    return {
      start: function(msg, info) { buffer.push([proc, new Date(), '[START] ' + msg, info || '']); },
      info: function(msg, info) { buffer.push([proc, new Date(), '[INFO] ' + msg, info || '']); },
      ok: function(msg, info) { buffer.push([proc, new Date(), '[OK] ' + msg, info || '']); },
      dupe: function(msg, info) { buffer.push([proc, new Date(), '[DUPE] ' + msg, info || '']); },
      warn: function(msg, info) { buffer.push([proc, new Date(), '[WARN] ' + msg, info || '']); },
      err: function(msg, info) { buffer.push([proc, new Date(), '[ERR] ' + msg, info || '']); },
      complete: function(msg, info) { buffer.push([proc, new Date(), '[COMPLETE] ' + msg, info || '']); },
      flush: function() {
        if (buffer.length > 0) {
          LOG.writeBatch(buffer);
          buffer = [];
        }
      }
    };
  },

  /**
   * Executes conservative dual-threshold pruning.
   */
  cleanLogs: function(force) { ... }
};
```

### 3.5 Conservative Dual-Threshold Pruning Algorithm

The log pruning engine operates on a conservative dual-threshold rule: a row is **only deleted if it simultaneously exceeds the row threshold AND is older than the time threshold**.

```mermaid
flowchart TD
    Start([Execute Log Cleanup]) --> CheckEnabled{LOG_AUTO_CLEAN == Yes<br/>or Force Run?}
    CheckEnabled -- No --> End([Exit - No Action])
    CheckEnabled -- Yes --> ReadSheet[Inspect Activity Logs Sheet]
    ReadSheet --> CheckCount{Total Log Rows ><br/>LOG_ROWS_TO_KEEP?}
    CheckCount -- No --> EndKeepAll[Keep All Rows - Protected by Row Cap]
    CheckCount -- Yes --> CalcCutoff[Calculate Cutoff Date:<br/>Now - LOG_TIME_TO_KEEP_DAYS]
    CalcCutoff --> ScanRows[Scan Rows from Row 3 downward<br/>up to max Prunable Index]
    ScanRows --> CheckAge{Row Timestamp <<br/>Cutoff Date?}
    CheckAge -- No --> EndKeepAge[Stop Pruning - Remaining rows protected by Age Cap]
    CheckAge -- Yes --> BatchDelete[Batch Delete Rows 3 to Target<br/>sh.deleteRows(3, countToDelete)]
    BatchDelete --> StampRun[Update ScriptProperties.LOG_LAST_CLEAN_DATE]
    StampRun --> LogSummary[Append Log Entry:<br/>[COMPLETE] Cleaned X historical rows]
    LogSummary --> End
```

### 3.6 UI Dialog Integration: Copy Log Button

In all dialogs containing an activity console ([`BulkIngestDialog.html`](file:///g:/My%20Drive/~RS2B/~Projects/ParaFlightLogProject/Code/BulkIngestDialog.html), [`ResyncDialog.html`](file:///g:/My%20Drive/~RS2B/~Projects/ParaFlightLogProject/Code/ResyncDialog.html), [`PurgeDialog.html`](file:///g:/My%20Drive/~RS2B/~Projects/ParaFlightLogProject/Code/PurgeDialog.html), [`URLDialog.html`](file:///g:/My%20Drive/~RS2B/~Projects/ParaFlightLogProject/Code/URLDialog.html), [`ScanDialog.html`](file:///g:/My%20Drive/~RS2B/~Projects/ParaFlightLogProject/Code/ScanDialog.html)):
* Add a secondary action button in the console header: `<button id="btn-copy-log" class="btn btn-secondary" onclick="copyConsoleLog()">📋 Copy Log</button>`.
* JavaScript implementation:
  ```javascript
  function copyConsoleLog() {
    var consoleEl = document.getElementById("log-console");
    if (!consoleEl) return;
    var text = consoleEl.innerText || consoleEl.textContent;
    navigator.clipboard.writeText(text).then(function() {
      var btn = document.getElementById("btn-copy-log");
      var origText = btn.innerText;
      btn.innerText = "✓ Copied!";
      btn.classList.add("btn-success");
      setTimeout(function() {
        btn.innerText = origText;
        btn.classList.remove("btn-success");
      }, 2000);
    }).catch(function(err) {
      alert("Failed to copy log: " + err);
    });
  }
  ```

---

## 4. Platform Constraints & Edge Cases

* **Google Sheets API Latency & Recalculation Overhead**: Calling `sheet.appendRow()` in a loop causes individual remote RPCs and triggers full grid formula recalculations. The `LOG.writeBatch` and `session.flush()` implementations collect all rows and call `sh.getRange(lastRow + 1, 1, rows.length, 4).setValues(rows)` once, executing in $< 200$ ms even for large batches.
* **Defensive Fail-Safe Isolation**: All logger entry points are wrapped in `try/catch`. If the spreadsheet is temporarily locked or experiencing an Apps Script quota outage, a failure in logging will output a `console.warn()` and return gracefully without crashing the pilot's flight processing transaction.
* **Sheet Capacity & Truncation Safety**: Deletions in `cleanLogs` are executed as a single atomic `sh.deleteRows(3, count)` call rather than individual row deletions, preventing execution timeouts.
* **Formula & Formatting Preservation**: The `Activity Logs` tab contains zero cross-sheet formulas, preventing `#REF!` errors during row appends or prunes. Rows 1 and 2 are frozen to preserve the banner and headers during vertical scrolling.

---

## 5. Alternatives Considered & Trade-offs

| Design Decision | Approach Chosen | Alternative Considered | Rationale |
| :--- | :--- | :--- | :--- |
| **Column Order** | `[Process \| Timestamp \| What \| Info]` | `[Timestamp \| Process \| What \| Info]` | Placing Process in Col A enables pilots to immediately scan and filter by functionality, directly matching user preference. |
| **Log Filtering** | Level-based filtering (`Brief`, `Normal`, `Debug`) | Log Everything Always | Ingestion of hundreds of files can quickly generate thousands of rows. `Brief` keeps the sheet compact while transient dialogs preserve full visibility. |
| **Pruning Engine** | Conservative Dual-Threshold (Rows AND Age) | Hard Row Cap (Truncate at 2,000) | Hard truncation deletes recent flights if a pilot logs heavily in a single week. Dual-threshold guarantees that recent logs are never deleted, even under high volume. |
| **Service Design** | Centralized `Logger.gs` | Scattered `logImport_` in `Ingestion.gs` | Centralization provides clean separation of concerns, easy unit testing, and reusability across all 11 system workflows. |

---

## 6. Dependencies & Ripple Effects

* **Sheets Affected**:
  * `'App_Log'` $\to$ Migrated and renamed to `'Activity Logs'`.
  * `'Config'` $\to$ New section `[ Logging & Admin ]` with 5 parameters and dropdown validation.
* **Code Modules Affected**:
  * [`Code/Config.gs`](file:///g:/My%20Drive/~RS2B/~Projects/ParaFlightLogProject/Code/Config.gs): Tab constants, parameter definitions, `CFG.LOG_PROCESSES`, and `CFG.LOG_PREFIXES`.
  * [`Code/Scaffold.gs`](file:///g:/My%20Drive/~RS2B/~Projects/ParaFlightLogProject/Code/Scaffold.gs): `scaffoldAppLog_` updated for new schema, dimensions, and auto-migration of old tab name.
  * [`Code/Logger.gs`](file:///g:/My%20Drive/~RS2B/~Projects/ParaFlightLogProject/Code/Logger.gs): New central module.
  * [`Code/Ingestion.gs`](file:///g:/My%20Drive/~RS2B/~Projects/ParaFlightLogProject/Code/Ingestion.gs): Replace `logImport_` and `logImportBatch_` with `LOG.write` / `LOG.writeBatch`.
  * [`Code/FileHandling.gs`](file:///g:/My%20Drive/~RS2B/~Projects/ParaFlightLogProject/Code/FileHandling.gs): Background watcher scan lifecycle logging.
  * [`Code/Code.gs`](file:///g:/My%20Drive/~RS2B/~Projects/ParaFlightLogProject/Code/Code.gs): Wire logging into Purge, Re-sync, Config Save/Load, and register menu callback `cleanActivityLogs`.
  * Dialogs ([`BulkIngestDialog.html`](file:///g:/My%20Drive/~RS2B/~Projects/ParaFlightLogProject/Code/BulkIngestDialog.html), [`ResyncDialog.html`](file:///g:/My%20Drive/~RS2B/~Projects/ParaFlightLogProject/Code/ResyncDialog.html), [`PurgeDialog.html`](file:///g:/My%20Drive/~RS2B/~Projects/ParaFlightLogProject/Code/PurgeDialog.html), [`URLDialog.html`](file:///g:/My%20Drive/~RS2B/~Projects/ParaFlightLogProject/Code/URLDialog.html), [`ScanDialog.html`](file:///g:/My%20Drive/~RS2B/~Projects/ParaFlightLogProject/Code/ScanDialog.html)): Add `Copy Log` button.

---

## 7. Implementation Plan & Phasing

*Note: Code execution will only begin upon explicit user approval.*

- [ ] **Phase 1: Configuration & Schema Specifications (`Code/Config.gs`)**:
  - Update `CFG.sheets.appLog = 'Activity Logs'`.
  - Update `TABS.APP_LOG` (name, color `#D32F2F`, columns `['Process', 'Timestamp', 'Activity / Event', 'Additional Info']`).
  - Add `CFG.LOG_PROCESSES` and `CFG.LOG_PREFIXES`.
  - Add `[ Logging & Admin ]` parameters to `CFG.parameters`.
- [ ] **Phase 2: Scaffolding & Migration (`Code/Scaffold.gs`)**:
  - Update `scaffoldAppLog_`: auto-rename pre-existing `App_Log` tab if found; set 4-column headers, widths (`175, 165, 530, 380`), text wrapping on Cols C & D.
  - Add dropdown validation for `LOG_LEVEL` (`Brief, Normal, Debug`) and `LOG_AUTO_CLEAN` (`Yes, No`) in `scaffoldConfig_`.
- [ ] **Phase 3: Central Logger Module (`Code/Logger.gs`)**:
  - Implement `LOG.resolveProcess`, `LOG.write`, `LOG.writeBatch`, `LOG.createSession`, and `LOG.cleanLogs`.
  - Implement public RPC gateway `logClientActivity(process, msg, info)`.
  - Stamp header with `@design Docs/Design/DSGN-LOG-001_Activity_Logging_System.md` and `@revision Rev 1.0`.
- [ ] **Phase 4: Subsystem Integration**:
  - Update `Code/Ingestion.gs` (`processBulkBatch`, `insertFlightRow_`).
  - Update `Code/FileHandling.gs` (`processWatchFolder`).
  - Update `Code/Code.gs` (`purgeRemoveFlights`, `restoreSingleMasterFlight`, `importConfigJson_`, `exportConfigJson_`).
  - Add menu item and public wrapper `cleanActivityLogs` under `Flight Log > Admin > Sheet Maintenance & Views`.
- [ ] **Phase 5: UI Dialog Updates**:
  - Add `📋 Copy Log` button and clipboard feedback handler to all 5 dialog templates.
- [ ] **Phase 6: Testing & Verification**:
  - Add unit tests in `Code/Test.gs` verifying process resolution, log level filtering, and dual-threshold pruning calculations.
  - Execute offline test harness (`scratch/run_unit_tests.js`).
- [ ] **Phase 7: Documentation Synchronization**:
  - Log `CR-LOG-004` in [`Docs/Backlog.md`](file:///g:/My%20Drive/~RS2B/~Projects/ParaFlightLogProject/Docs/Backlog.md), update [`Docs/Technical_Specification.md`](file:///g:/My%20Drive/~RS2B/~Projects/ParaFlightLogProject/Docs/Technical_Specification.md), [`Docs/Features.md`](file:///g:/My%20Drive/~RS2B/~Projects/ParaFlightLogProject/Docs/Features.md), [`Docs/User_Guide.md`](file:///g:/My%20Drive/~RS2B/~Projects/ParaFlightLogProject/Docs/User_Guide.md), [`Docs/ChangeLog.md`](file:///g:/My%20Drive/~RS2B/~Projects/ParaFlightLogProject/Docs/ChangeLog.md), and update [`Docs/Design/README.md`](file:///g:/My%20Drive/~RS2B/~Projects/ParaFlightLogProject/Docs/Design/README.md).

---

## 8. Testing & Verification Strategy

* **Unit Tests (`Code/Test.gs`)**:
  * `testLogProcessResolution`: Verifies standard keys and ad-hoc fallback strings.
  * `testLogLevelFiltering`: Verifies that `Brief` filters out `[OK]` and `[DUPE]` while preserving `[START]`, `[WARN]`, `[ERR]`, and `[COMPLETE]`.
  * `testConservativePruningMath`: Validates that rows are protected if total rows $\le$ 2000 OR row age $\le$ 90 days.
* **Manual Smoke Test Checklist**:
  * Run First Time Setup / Reapply Formatting $\to$ confirm `Activity Logs` appears with correct 4 columns, red tab, and frozen rows.
  * Run Bulk Ingestion $\to$ verify `[START]`, `[OK]`, and `[COMPLETE]` lines appear in `Activity Logs`.
  * Click `📋 Copy Log` in Bulk Ingestion dialog $\to$ verify clipboard contains full text and button displays "✓ Copied!".
  * Run Clean Activity Logs Now $\to$ verify summary log entry is written without errors.

---

## 9. Documentation Impacts

* [`Docs/Technical_Specification.md`](file:///g:/My%20Drive/~RS2B/~Projects/ParaFlightLogProject/Docs/Technical_Specification.md): Update Section 2 (System Architecture: add `Logger.gs`), Section 3 (Data Schema: update `Activity Logs`), and Section 7 (Code Reference).
* [`Docs/Features.md`](file:///g:/My%20Drive/~RS2B/~Projects/ParaFlightLogProject/Docs/Features.md): Update Section 9 (Robust Logging) and Section 6 (UI dialog clipboard actions).
* [`Docs/User_Guide.md`](file:///g:/My%20Drive/~RS2B/~Projects/ParaFlightLogProject/Docs/User_Guide.md): Update Tab descriptions and Maintenance operations (`Clean Activity Logs Now`).
* [`Docs/Backlog.md`](file:///g:/My%20Drive/~RS2B/~Projects/ParaFlightLogProject/Docs/Backlog.md): Track `CR-LOG-004` (Activity Logging System Redesign).
* [`Docs/ChangeLog.md`](file:///g:/My%20Drive/~RS2B/~Projects/ParaFlightLogProject/Docs/ChangeLog.md): Document the overhaul upon implementation.

---

## 10. Revision History

| Revision | Date | Author | Revision Note |
| :---: | :---: | :--- | :--- |
| `Rev 1.0` | `2026-10-01` | `Rohitash / Antigravity AI` | Initial formal design draft: 4-column Activity Logs schema, extensible registries, tiered log levels, conservative dual-threshold pruning, and UI clipboard copy. |
