# Design Specification: Dual-Tier Logging & Granular Telemetry Redesign

* **Design ID**: `DSGN-LOG-002`
* **Status**: `Approved for Implementation`
* **Current Revision**: `Rev 1.0`
* **Date Created**: `2026-10-04`
* **Last Updated**: `2026-10-04`
* **Author / Contributors**: `Rohitash / Antigravity AI`
* **Parent Design**: [`Docs/Design/DSGN-LOG-001_Activity_Logging_System.md`](./DSGN-LOG-001_Activity_Logging_System.md)
* **Child Designs**: `None`
* **Umbrella Module / Primary Code**: [`Code/Logger.gs`](../../Code/Logger.gs), [`Code/Config.gs`](../../Code/Config.gs), [`Code/AutomationConfig.gs`](../../Code/AutomationConfig.gs), [`Code/Automation.gs`](../../Code/Automation.gs)
* **Code Revision Stamp**: `Pending Implementation`
* **Related Requirements / CRs**: `RQ-ING-002`, `RQ-SYS-001`, `CR-LOG-005`

---

## 1. Executive Summary & Intent

### Problem Statement
The logging architecture introduced in `DSGN-LOG-001` centralized spreadsheet logs into a dedicated 4-column sheet tab (`Activity Logs`) with basic log levels (`Brief`, `Normal`, `Debug`). However, operational experience and autonomous background workflows have exposed critical architectural tensions:

1. **Coupling of Transient Feedback and Persistent Storage**:
   The existing system uses a single conceptual channel (`LOG.write`) for both live user feedback and spreadsheet record-keeping. When a multi-flight maintenance or ingestion job runs, emitting granular progress for every row or file step floods the `Activity Logs` sheet with hundreds of micro-step rows. This bloats the spreadsheet grid, degrades Apps Script I/O responsiveness, and consumes cell quotas. Conversely, suppressing row-level telemetry leaves pilots blind in the UI console while operations are actively executing.
2. **Autonomous Background Cron Noise vs. Blindness**:
   Autonomous background triggers (such as `masterHeartbeatDispatcher` or scheduled watch folder scans) running every 5–15 minutes present a dilemma. If they log each pulse, they write hundreds of empty *"0 files found"* records per day, burying meaningful events in noise. If they run completely silent, pilots have no visibility when files are actually processed or when errors occur.
3. **Lack of Functional Granularity**:
   A single global `LOG_LEVEL` parameter forces an all-or-nothing choice. A pilot cannot set high verbosity for complex flight maintenance while keeping routine watch folder scans minimal.
4. **Nomenclature Ambiguity**:
   Calling both the live modal/sidebar window consoles and the persistent spreadsheet tab *"Activity Logs"* creates mental confusion regarding what is ephemeral (window DOM) versus what is permanent (workbook audit grid).

### Proposed Solution
Architect a **Dual-Tier Decoupled Logging Pipeline**:
1. **Nomenclature Separation**:
   * **`Activity Log`**: The transient, real-time stepping stream displayed live in HTML modal consoles and the Universal Modeless Execution Sidebar ([`Code/ExecutionSidebar.html`](../../Code/ExecutionSidebar.html)). It is strictly in-memory and DOM-bound, providing rich visual transparency without writing to spreadsheet cells.
   * **`System Log`**: The persistent, structured audit tab in the Google Sheet (`System Log`, Dark Red `#D32F2F`). It records macro lifecycle boundaries, discovery metrics, batch checkpoints, and error diagnostics.
2. **6 Granular Log Levels**:
   * `Silent`: Zero sheet writes under any circumstance.
   * `Silent unless some activity`: Zero sheet writes if the run is a no-op (0 processed, 0 errors). Flushes at `Normal` level if items are processed or an error occurs. (Ideal for automated background cron jobs).
   * `Exceptions`: Only writes records tagged `[ERROR]`, `[WARN]`, or `[FATAL]`.
   * `Summary`: Writes only `[START]`, `[COMPLETE]`, and errors.
   * `Normal` *(Default)*: Writes lifecycle milestones, discovery metrics, batch checkpoints, completion summaries, and errors.
   * `Debug`: Full technical verbosity including fine-grained row-level steps and API response details.
3. **Category-Based Configuration with Defaults in `Config`**:
   Provide high-level pilot controls in the `Config` tab under `[ System Logging ]` for major service domains: `LOG_LEVEL_DEFAULT`, `LOG_LEVEL_HEARTBEAT`, `LOG_LEVEL_INGESTION`, `LOG_LEVEL_MAINTENANCE`, `LOG_LEVEL_ADMIN`, and `LOG_LEVEL_INTEGRATIONS`.
4. **Table-Driven Automation Integration**:
   Every automated action in [`Code/AutomationConfig.gs`](../../Code/AutomationConfig.gs) declares a `LogLevel` parameter with an action-specific default. Rules configured on the `Automation_Rules` tab can override this parameter or inherit the action's default, which the dispatcher passes to the worker.
5. **Orchestrator vs. Worker Telemetry Pattern**:
   Establish an authoritative contract: Orchestrators manage the logging session, macro boundaries, and commit gates; workers stream micro-steps to the UI console, report critical items to the session buffer, and return normalized outcome statistics without performing ad-hoc sheet writes in loops.

---

## 2. Requirements & Scope

### Functional Requirements
* **REQ-1 (Tab Rename & Migration)**: Rename the persistent spreadsheet tab from `Activity Logs` to **`System Log`** (Dark Red `#D32F2F`). Provide automated in-place migration in `Scaffold.gs` and maintain backward-compatibility aliases (`TABS.ACTIVITY = TABS.SYSTEM_LOG`).
* **REQ-2 (UI Activity Log Preservation)**: Preserve the label **`Activity Log`** on all modal dialog and sidebar consoles, maintaining real-time autoscrolling, colored line styling, and the `📋 Copy` button.
* **REQ-3 (6 Log Levels)**: Implement exact evaluation semantics for `Silent`, `Silent unless some activity`, `Exceptions`, `Summary`, `Normal`, and `Debug`.
* **REQ-4 (Category Configuration Registry in Config)**: Add structured parameters under `[ System Logging ]` in `Config.gs`:
  * `LOG_LEVEL_DEFAULT` (default: `Normal`)
  * `LOG_LEVEL_HEARTBEAT` (default: `Silent unless some activity`)
  * `LOG_LEVEL_INGESTION` (default: `Normal`)
  * `LOG_LEVEL_MAINTENANCE` (default: `Normal`)
  * `LOG_LEVEL_ADMIN` (default: `Summary`)
  * `LOG_LEVEL_INTEGRATIONS` (default: `Exceptions`)
* **REQ-5 (Automation Rules Parameter)**: Add `LogLevel` to all action schemas in `AUTOMATION_REGISTRY.actions` with tailored action defaults. Ensure `masterHeartbeatDispatcher` extracts `parsedParams.LogLevel` and passes it to action handlers.
* **REQ-6 (Buffered Session Engine)**: Implement `LOG.createSession(processKey, logLevel)` supporting deferred flushing and no-op suppression for `Silent unless some activity` and `Exceptions`.
* **REQ-7 (Orchestrator-Worker Contract)**: Standardize all workers to return normalized outcome statistics (`{ success, processed, updated, skipped, errors, message }`) and prohibit calling `LOG.write()` inside tight loops.

### Non-Goals (Out of Scope)
* **NON-GOAL-1**: External cloud logging providers (Cloud Logging, Datadog). All logging remains native to the pilot's Google Sheet and Apps Script runtime.
* **NON-GOAL-2**: Multi-user WebSocket streaming. UI updates continue to leverage existing Google Apps Script client-stepping RPCs.

---

## 3. Architecture & Detailed Design

### 3.1 Dual-Tier Pipeline Architecture

```
┌────────────────────────────────────────────────────────────────────────┐
│                        USER EXECUTION TRIGGER                          │
│     (Interactive Modal Dialog, Modeless Sidebar, or Time Trigger)      │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                       ORCHESTRATOR / DISPATCHER                        │
│   (masterHeartbeatDispatcher, QueueService, BulkIngest, Maintenance)   │
│                                                                        │
│  1. Resolve Effective LogLevel (Rule param > Category > Default)       │
│  2. Initialize Session: session = LOG.createSession(proc, logLevel)    │
│  3. Emit Macro Milestones: [START], [DISCOVERY]                        │
└──────────────────┬──────────────────────────────────┬──────────────────┘
                   │                                  │
                   ▼ (Dispatches Batch)               ▼ (Passes Session)
┌──────────────────────────────────────┐  ┌──────────────────────────────┐
│       TIER 1: EPHEMERAL UI           │  │     TIER 2: STORAGE TIER     │
│       CLIENT ACTIVITY STREAM         │  │     IN-MEMORY SESSION BUFFER │
│                                      │  │                              │
│  - Modal / Sidebar (#logConsole)     │  │  - Holds candidate logs      │
│  - High-frequency micro-steps        │  │  - Applies level filters     │
│  - DOM-only; 0 sheet I/O writes      │  │  - Zero sheet writes during  │
│  - Real-time pilot feedback          │  │    stepping loop             │
└──────────────────────────────────────┘  └──────────────┬───────────────┘
                                                         │
                                                         ▼
                                          ┌──────────────────────────────┐
                                          │      ORCHESTRATOR COMMIT     │
                                          │                              │
                                          │  Evaluate Commit Guard:      │
                                          │  - Silent? -> Drop buffer    │
                                          │  - Active Only? (items==0 && │
                                          │    errors==0) -> Drop buffer │
                                          │  - Exceptions? (errors==0)   │
                                          │    -> Drop buffer            │
                                          │  - Else: Append [COMPLETE] & │
                                          │    flush atomic batch to     │
                                          │    "System Log" sheet tab    │
                                          └──────────────┬───────────────┘
                                                         │
                                                         ▼
                                          ┌──────────────────────────────┐
                                          │     SPREADSHEET STORAGE      │
                                          │         "System Log"         │
                                          │   [Process | TS | Event |    │
                                          │    Additional Info]          │
                                          └──────────────────────────────┘
```

---

### 3.2 Granular Log Levels Specification

| Level | Rank | Persistent Sheet Record Policy | In-Memory / UI Handling |
| :--- | :---: | :--- | :--- |
| **`Silent`** | 0 | **0 rows written**. Absolute silence under all conditions (even errors). | UI Activity Log remains live if interactive. |
| **`Silent unless some activity`** | 1 | **0 rows written if no-op** (`processed === 0 && errors === 0`). Flushes at `Normal` level if `processed > 0` or `errors > 0`. | Buffer dropped on clean no-op; flushed atomically on real work or errors. |
| **`Exceptions`** | 2 | **Errors only**. Flushes only entries tagged `[ERROR]`, `[WARN]`, or `[FATAL]`. 0 rows written on successful runs. | Drops normal milestone lines from sheet commit. |
| **`Summary`** | 3 | **Macro boundaries only**: `[START]`, `[COMPLETE]`, and any `[ERROR]`. Omits discovery and batch step items. | Clean, minimal footprint for large batch runs. |
| **`Normal`** | 4 | **Standard operational telemetry**: `[START]`, `[DISCOVERY]`, batch checkpoints, `[COMPLETE]`, `[WARN]`, `[ERROR]`. | Default baseline for interactive operations. |
| **`Debug`** | 5 | **Complete technical verbosity**: all milestones, row decisions, timings, and API diagnostic details. | Deep developer and pilot troubleshooting. |

---

### 3.3 Configuration Tab Parameters (`[ System Logging ]`)

In [`Code/Config.gs`](../../Code/Config.gs), the logging parameters are structured into a dedicated section:

```javascript
// System Logging Parameters in CFG.parameters:
{ section: 'System Logging', key: 'LOG_LEVEL_DEFAULT', val: 'Normal', desc: 'Global fallback log verbosity for unconfigured services (Normal, Summary, Exceptions, Silent)' },
{ section: 'System Logging', key: 'LOG_LEVEL_HEARTBEAT', val: 'Silent unless some activity', desc: 'Master Heartbeat periodic dispatcher pulse log verbosity' },
{ section: 'System Logging', key: 'LOG_LEVEL_INGESTION', val: 'Normal', desc: 'Interactive flight import log verbosity (Upload, URL, Bulk Ingest)' },
{ section: 'System Logging', key: 'LOG_LEVEL_MAINTENANCE', val: 'Normal', desc: 'Flight updates, resync, status change, and duplicate scan verbosity' },
{ section: 'System Logging', key: 'LOG_LEVEL_ADMIN', val: 'Summary', desc: 'System maintenance cockpit, purge, and configuration management verbosity' },
{ section: 'System Logging', key: 'LOG_LEVEL_INTEGRATIONS', val: 'Exceptions', desc: 'External API service calls (Open-Meteo, XContest, Paragliding Earth)' },
{ section: 'System Logging', key: 'LOG_AUTO_CLEAN', val: 'Yes', desc: 'Automatically prune historical System Log entries (Yes/No)' },
{ section: 'System Logging', key: 'LOG_CLEAN_FREQUENCY_DAYS', val: 3, desc: 'Days between automated log cleanup checks' },
{ section: 'System Logging', key: 'LOG_ROWS_TO_KEEP', val: 2000, desc: 'Minimum log rows to retain before pruning' },
{ section: 'System Logging', key: 'LOG_TIME_TO_KEEP_DAYS', val: 90, desc: 'Minimum age (in days) of logs to retain before pruning' }
```

#### Category Resolution Cascade:
```
1. Explicit caller / rule parameter (e.g. parsedParams.LogLevel)
   ↳ 2. If 'Default' or undefined -> Look up Category in Config (e.g. LOG_LEVEL_MAINTENANCE)
      ↳ 3. If blank or '(Use Default)' -> Look up LOG_LEVEL_DEFAULT in Config
         ↳ 4. Hardcoded fallback: 'Normal'
```

---

### 3.4 Automation Subsystem Integration

#### 1. Action Metadata Schema (`Code/AutomationConfig.gs`)
Every registered action includes the standard `LogLevel` parameter in its `parametersSchema`:

```javascript
'LogLevel': {
  parameterId: 'LogLevel',
  parameterLabel: 'Logging Level',
  valueType: 'String',
  valueInput: 'Unique',
  valueSet: 'Default, Silent, Silent unless some activity, Exceptions, Summary, Normal, Debug',
  defaultValue: 'Silent unless some activity', // Tailored per action
  description: 'Log verbosity written to System Log for this automated rule.'
}
```

#### Action Default Mapping:
* `SCAN_WATCH_FOLDER`: Default `Silent unless some activity`
* `PROCESS_QUEUE`: Default `Silent unless some activity`
* `CLEAN_LOGS`: Default `Summary`
* Future `ENRICH_FLIGHT_GEO`: Default `Silent unless some activity`
* Future `ENRICH_FLIGHT_WEATHER`: Default `Silent unless some activity`

#### 2. Master Heartbeat Pulse Dispatcher (`Code/Automation.gs`)
```javascript
// In masterHeartbeatDispatcher():
var effectiveLogLevel = parsedParams.LogLevel;
if (!effectiveLogLevel || effectiveLogLevel === 'Default') {
  effectiveLogLevel = actionDef.defaultLogLevel || 'Silent unless some activity';
}
// Pass effectiveLogLevel into action handler options
```

---

### 3.5 Orchestrator vs. Worker Telemetry Contract

#### The Orchestrator Contract:
1. **Initialize Session**: `var session = LOG.createSession(processKey, effectiveLogLevel);`
2. **Emit Start & Discovery**:
   * `session.start('Starting operation: Scope=' + scope, 'Target: ' + count + ' items');`
   * `session.discovery('Scanned ' + scanned + ' files across ' + folders + ' folders');`
3. **Dispatch to Worker**: Invoke worker, passing `session` or UI stream handler.
4. **Evaluate & Complete**:
   ```javascript
   var stats = workerResult; // { processed: 20, updated: 2, errors: 0 }
   session.complete('Processed ' + stats.processed + ' flights', stats);
   session.flush(); // Automatically drops if Silent unless activity and stats.processed === 0
   ```

#### The Worker Contract:
1. **Never Call `LOG.write()` in a Loop**: Direct spreadsheet append in loops is strictly forbidden.
2. **Stream to UI Console**: Call `logLine(msg, type)` for immediate DOM rendering in `#logConsole`.
3. **Report to Session**: Call `session.info(...)` or `session.warn(...)` for significant milestones.
4. **Return Normalized Outcome Stats**:
   ```javascript
   return {
     success: true,
     processed: count,
     updated: updatedCount,
     skipped: skippedCount,
     errors: errCount,
     message: summaryString,
     details: [...]
   };
   ```

---

## 4. Migration & Backward Compatibility

### 4.1 Sheet Tab Renaming & Aliasing
* The spreadsheet tab is renamed from `'Activity Logs'` to `'System Log'`.
* In `Code/Config.gs`:
  ```javascript
  CFG.sheets.systemLog = 'System Log';
  CFG.sheets.activityLogs = 'System Log'; // Legacy migration bridge
  CFG.sheets.appLog = 'System Log';       // Legacy migration bridge

  TABS.SYSTEM_LOG = {
    name: CFG.sheets.systemLog,
    color: '#D32F2F', // Dark Red
    index: 7,
    headerRow: 2,
    frozenRows: 2,
    columns: ['Process', 'Timestamp', 'Activity / Event', 'Additional Info']
  };
  TABS.ACTIVITY = TABS.SYSTEM_LOG; // Legacy migration bridge
  ```
* In `Code/Scaffold.gs`:
  * During scaffolding or maintenance updates, inspect the spreadsheet: if a tab named `'Activity Logs'` or `'App_Log'` exists, rename it to `'System Log'` in place.

### 4.2 System Maintenance Manifest
* Update `SYSTEM_MANIFEST`:
  * Rename component `ActivityLogs.sheet` $\to$ `SystemLog.sheet`.
  * Update `SystemMaintenanceDialog.html` matrix column header to `System Log`.

---

## 5. Implementation Map

| File | Change Description |
| :--- | :--- |
| [`Code/Config.gs`](../../Code/Config.gs) | Define `CFG.sheets.systemLog`, `TABS.SYSTEM_LOG`, `TABS.ACTIVITY` alias. Add `[ System Logging ]` parameters. |
| [`Code/Logger.gs`](../../Code/Logger.gs) | Implement 6-level filtering engine, `createSession` with deferred commit and no-op suppression. Target `System Log`. |
| [`Code/AutomationConfig.gs`](../../Code/AutomationConfig.gs) | Add `LogLevel` parameter schema to all actions with tailored defaults. Update rule templates. |
| [`Code/Automation.gs`](../../Code/Automation.gs) | Pass `LogLevel` from rule parameter to action handlers in `masterHeartbeatDispatcher`. |
| [`Code/Scaffold.gs`](../../Code/Scaffold.gs) | Update `scaffoldSystemLog_`, auto-rename existing `Activity Logs` tab, register `SHEET_ID_SYSTEM_LOG`. |
| [`Code/Code.gs`](../../Code/Code.gs) | Update Admin menu labels (*Clean System Log...*), update `finalizeWorkerJob` to follow orchestrator session contract. |
| [`Code/ExecutionSidebar.html`](../../Code/ExecutionSidebar.html) | Retain UI title `Activity Log`, ensure full-height layout, pass category log level to server. |
| [`Code/SystemMaintenanceDialog.html`](../../Code/SystemMaintenanceDialog.html) | Update 2D matrix header from `Activity_Logs` to `System Log`. |
| [`Docs/Patterns_and_Practices.md`](../Patterns_and_Practices.md) | Add Pattern 24 (Dual-Tier Logging & Orchestrator-Worker Contract) and update anti-patterns checklist. |
| [`tools/code_check_audit.js`](../../tools/code_check_audit.js) | Add static assertions: scan for `LOG.write` in loops and verify legacy migration bridges. |
| [`.agent/workflows/code_check.md`](../../.agent/workflows/code_check.md) | Update Dimension 2 and 7/10 audit protocols for `System Log` and Dual-Tier logging. |

---

## 6. Verification & Test Plan

1. **Static Analysis & Architectural Parity**:
   * Execute `node tools/code_check_audit.js` — assert 0 Critical Errors and 0 Warnings across all dimensions.
2. **Offline Unit Tests**:
   * Add unit tests in `tools/run_all_offline_tests.js` testing:
     * 6-level filtering logic in `LOG.shouldLog`.
     * `Silent unless some activity` session buffering: assert 0 logs written when `stats.processed === 0 && stats.errors === 0`, and logs written when `stats.processed > 0`.
     * Parameter resolution cascade in `LOG.getEffectiveLogLevel`.
3. **Interactive UI Verification**:
   * Open `Flight Updates...`, run in Sidebar: verify live streaming in UI console while `System Log` sheet only receives macro `[START]` and `[COMPLETE]`.
4. **Heartbeat & Automation Verification**:
   * Run `masterHeartbeatDispatcher` with 0 due rules: verify 0 rows written to `System Log`.
