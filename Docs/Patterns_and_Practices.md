# Engineering Patterns & Architectural Best Practices (Source of Truth)

## 1. Overview & Architectural Philosophy
The **ParaFlightLogProject** is built on a hybrid architecture: **Google Sheets** functions as a rich, reactive visual user interface and database, while **Google Apps Script (GAS)** functions as a serverless backend engine.

Developing on this hybrid stack presents unique constraints and capabilities:
* **The Spreadsheet is Mutable**: Unlike traditional relational databases where schemas are locked behind migration scripts, spreadsheet users can freely drag columns, insert rows, edit headers, paste values, and rename tabs directly in the UI.
* **Apps Script has Strict Execution Timeouts**: Google enforces a hard 6-minute execution cutoff on script triggers.
* **Network & Drive Calls are Expensive**: Google Workspace API calls (DriveApp, SpreadsheetApp) incur synchronous HTTP round-trip latency.
* **Google Sheets has Powerful Native Primitives**: Google Sheets provides built-in dependency graphs, Named Ranges, array formulas, soft range protections, and open-ended ranges that natively auto-track structural changes without script execution.

> [!IMPORTANT]
> **Core Engineering Rule**: Always prefer **Native Google Sheets Mechanisms** (Named Ranges, Open-Ended Validations, `LET/XMATCH` formulas, `sheetId`) over brute-force script overrides. Scripts should orchestrate and configure, but let Google Sheets natively maintain internal references and dependencies.

---

## 2. Schema & Grid Resilience Patterns

### Pattern 1: Dynamic Name-Based Column Resolution
* **Problem**: Hardcoding column indices (e.g. `row[1]`, `colIndex = 12`) or column letter strings (`"L"`, `"M"`) causes catastrophic data misalignment or formula `#REF!` when a user drags or inserts columns.
* **Pattern**: Never hardcode column positions in logic or formula generators.
  * In code: Read headers dynamically using `getColumnMap_(sh)` and access columns via `map['Header Name']`.
  * In formula generators: Resolve letters dynamically using `getColLetter_(map, colName)` and `columnToLetter_(colIdx)`.
* **Example**:
  ```javascript
  // Anti-Pattern:
  sh.getRange(r, 3).setFormula('=IFERROR(MAX(INDIRECT("C" & (ROW()+1) & ":C")), 0) + 1');

  // Best Practice Pattern:
  var fNoCol = map['Flight No'] || 3;
  var fNoLetter = columnToLetter_(fNoCol);
  sh.getRange(r, fNoCol).setFormula('=IFERROR(MAX(INDIRECT("' + fNoLetter + '" & (ROW()+1) & ":' + fNoLetter + '")), 0) + 1');
  ```

### Pattern 2: Google Sheets Native Named Ranges for Lookup Lists & Control Cells
* **Problem**: Referencing lookup ranges with raw cell coordinates (e.g. `shConfig.getRange('G3:G')` or Dashboard `$B$2`) breaks when columns or rows are inserted on the source sheet.
* **Pattern**: Register native Google Sheets **Named Ranges** (`Data > Named ranges`) for all lookup lists, parameter cells, and UI toggles.
  * `LOOKUP_FLIGHT_TYPES = Config!$G$3:$G`
  * `LOOKUP_ACTIVE_WINGS = Config!$K$3:$K`
  * `LOOKUP_ACTIVE_HARNESSES = Config!$L$3:$L`
  * `LOOKUP_ACTIVE_RESERVES = Config!$M$3:$M`
  * `LOOKUP_EQUIPMENT_CATS = Config!$E$3:$E`
  * `DASHBOARD_REVIEW_FILTER = Dashboard!$B$2`
* **Why this works**: When a user moves, cuts & pastes, or inserts columns in Google Sheets, **Sheets automatically updates the Named Range target under the hood**. Data validations and formulas referencing the Named Range never point to the wrong cell.

### Pattern 3: Modern Native Formula Array Engineering (Eliminating `INDIRECT`)
* **Problem**: `INDIRECT("Flights!B5:B")` is a volatile formula that forces recalculation on every edit and breaks when columns are moved.
* **Pattern**: Use modern Google Sheets array formulas (`LET`, `XMATCH`, `INDEX`, `FILTER`) to seek columns by header name dynamically at runtime:
  ```excel
  =LET(
    headers, Flights!$4:$4,
    statusCol, INDEX(Flights!$A:$ZZ, 0, XMATCH("Status", headers)),
    validFlights, FILTER(statusCol, ROW(statusCol) >= 5, statusCol = "Valid"),
    COUNTA(validFlights)
  )
  ```
* **Benefits**:
  1. Immune to column reordering: `XMATCH("Status", Flights!$4:$4)` finds the column wherever it is.
  2. Immune to row insertion: `Flights!$A:$ZZ` and `Flights!$4:$4` are whole-sheet/whole-row references that never shift when rows are added.
  3. Non-volatile: Recalculates only when underlying data changes, vastly improving workbook performance.

### Pattern 4: Whole-Column Data Validation Scope (`$B$5:$B`)
* **Problem**: Applying validation rules to a fixed row slice (e.g. Rows 5 to 100) causes flights appended at the bottom (via bulk ingestion or manual entry) to lack dropdowns, text wrap, and conditional formatting.
* **Pattern**: Apply data validations to open-ended column ranges starting at the first data row:
  ```javascript
  // Best Practice Pattern:
  sh.getRange(5, colIdx, sh.getMaxRows() - 4, 1).setDataValidation(rule);
  ```
* **Why this works**: Google Sheets attaches open-ended validation rules to the column metadata. Any row appended at the bottom automatically inherits dropdowns, formatting, and validation rules without requiring script execution.

### Pattern 5: Warning-Only Range Protection as "Soft Guardrails"
* **Problem**: Users accidentally paste values over auto-calculated formulas (`Flight No`) or modify header names in Row 4. Strict cell locking causes permission headaches for multi-user or non-domain setups.
* **Pattern**: Apply native Google Sheets Range Protection with `setWarningOnly(true)`:
  ```javascript
  // Protect Row 1-4 Headers
  var headerProt = sh.getRange('A1:ZZ4').protect();
  headerProt.setDescription('Logbook Header & Column Schema');
  headerProt.setWarningOnly(true);

  // Protect Flight No Formula Column
  var fNoProt = sh.getRange(5, flightNoCol, sh.getMaxRows() - 4, 1).protect();
  fNoProt.setDescription('Sequential Flight Counter (Auto-calculated)');
  fNoProt.setWarningOnly(true);
  ```
* **User Experience**: The user is never locked out. If they accidentally edit a header or paste over `Flight No`, Sheets displays a gentle native warning: *"Heads up! You're trying to edit part of this sheet that shouldn't be changed accidentally. Do you want to edit anyway?"*

### Pattern 6: Permanent Tab Identification via Sheet ID (`sheetId` / `gid`)
* **Problem**: `ss.getSheetByName("Flights")` returns `null` and crashes with fatal errors if a pilot renames the tab to `"Flight Log"` or `"Logbook"`.
* **Pattern**: Track tabs by their permanent integer `sheetId` (the `#gid=...` in the URL), which never changes:
  ```javascript
  function getSheetByPurpose_(purpose, defaultName) {
    var ss = SpreadsheetApp.getActive();
    var storedId = PropertiesService.getDocumentProperties().getProperty('SHEET_ID_' + purpose);
    if (storedId) {
      var sheets = ss.getSheets();
      for (var i = 0; i < sheets.length; i++) {
        if (String(sheets[i].getSheetId()) === String(storedId)) return sheets[i];
      }
    }
    var sh = ss.getSheetByName(defaultName);
    if (sh) {
      PropertiesService.getDocumentProperties().setProperty('SHEET_ID_' + purpose, String(sh.getSheetId()));
    }
    return sh;
  }
  ```

### Pattern 7: Non-Destructive Scaffolding (Read Before Write)
* **Problem**: Maintenance scripts like `reapplyFormatting_` that blindly overwrite Row 4 with default `TABS.FLIGHTS.groups` will erase the pilot's custom column order.
* **Pattern**: Before modifying layout, inspect the active sheet's Row 4 headers. Preserve existing column positions, and only re-apply formatting, validation rules, notes, and Row 3 category merges to columns where they currently sit.

---

## 3. Data Typing & Ingestion Defensive Patterns

### Pattern 8: `getDisplayValues()` to Prevent Timezone/Epoch Drift
* **Problem**: `getValues()` converts date and time cells into JavaScript `Date` objects based on the Apps Script project's script timezone. For midnight flights or Western hemisphere timezones, this shifts flight dates by $\pm 1$ day and alters launch hours.
* **Pattern**: When reading date, time, or identifier cells for matching, deduplication, or display, use `getDisplayValues()` to read the exact text string as rendered in the spreadsheet cell:
  ```javascript
  // Best Practice Pattern for Date/Time Matching:
  var dateStr = sh.getRange(row, map['Date']).getDisplayValue(); // "2024-05-12"
  ```

### Pattern 9: In-Memory Row Quality Scoring vs. Drive Round-Trips
* **Problem**: Calling `DriveApp.getFileById()` inside a deduplication loop to check file sizes creates an $O(N \times M)$ HTTP round-trip bottleneck that exhausts execution time on batches $>15$ files.
* **Pattern**: Score flight quality in memory from sheet telemetry (duration, fix count, track length, XC score, weather enrichment) without making external Drive calls (`scoreFlightQualityFromRow_`).

### Pattern 10: Single Source of Truth for Folder Authority
* **Problem**: Creating folders on the fly in the user's Drive root when IDs are missing leads to folder clutter.
* **Pattern**: The `Config` sheet is the sole authority for folder configuration (`MASTER_LOG_FOLDER_ID`, `ERROR_FOLDER_ID`, `UPLOAD_FOLDER_ID`, `WATCH_FOLDER_ID`). Missing folders must trigger an immediate user-facing error dialog (`validateRequiredFolders_`), never silent creation in root.

---

## 4. Runtime Execution & Long-Running Job Patterns

### Pattern 11: The 4.5-Minute Safety Threshold & Continuation Daemon
* **Problem**: Apps Script triggers terminate unconditionally at 6 minutes, causing data corruption if a large batch is aborted mid-write.
* **Pattern**: Enforce a strict 4.5-minute safety threshold using `TimeBudgetService`:
  ```javascript
  var budget = TimeBudgetService.create(4.5 * 60 * 1000);
  while (hasItems && budget.hasTimeRemaining()) {
    processNextItem();
  }
  if (hasRemainingItems) {
    QueueService.checkpointJob(jobId, cursor);
    QueueService.ensureContinuationTrigger(); // Self-perpetuating daemon
  }
  ```

### Pattern 12: Persistent State in `Automation_Queue` Tab
* **Problem**: `PropertiesService` has a strict 9KB value limit, making it unsuitable for storing large queues of 200+ files.
* **Pattern**: Store persistent queue state as tabular rows on a dedicated, hidden `Automation_Queue` sheet (`QueueService.gs`).

### Pattern 13: Tri-Mode Execution Contract
* **Pattern**: All batch operations (Ingestion, Resync, Maintenance, Status Change, Duplicates) must implement the Tri-Mode execution contract:
  1. **Modal Dialog Mode**: Synchronous execution with embedded progress bar and log stream for small batches ($\le 15$ items).
  2. **Universal Sidebar Mode**: Docked `ExecutionSidebar.html` allowing the pilot to continue interacting with the spreadsheet while monitoring batch progress.
  3. **Headless Background Queue Mode**: Chunked execution via `QueueService` with automatic 4.5-minute time budget checkpointing and self-continuation triggers for massive datasets.

---

## 5. Client-Server Communication Patterns (GAS $\leftrightarrow$ HTML)

### Pattern 14: Public Gateway Functions for Client RPCs (No Trailing Underscores)
* **Problem**: Apps Script strictly forbids client-side JavaScript (`google.script.run`) from invoking any server function that ends with an underscore (`_`). Calling `google.script.run.myPrivateFunction_()` fails silently or throws an error.
* **Pattern**: All functions called from HTML dialogs must be public gateway functions without trailing underscores:
  ```javascript
  // Server-side (Code.gs):
  function runStatusChangeBatch(rows, newStatus) {
    return runStatusChangeBatch_(rows, newStatus); // Delegates to private engine
  }
  ```

### Pattern 15: Sanitized JSON Serialization across the RPC Boundary
* **Problem**: Passing complex objects with circular references, DOM nodes, or functions across `google.script.run` causes silent serialization failures.
* **Pattern**: Return plain, sanitized JSON-serializable objects (`{ success: true, count: 5, items: [...] }`).

---

## 6. System Distribution & Update Patterns

### Pattern 16: Script-to-Sheet Decoupling, Manifest Pipeline & 3-Tier Execution Invariants
* **Problem**: Apps Script code and Google Sheets physical layout evolve **asynchronously**. Code is pushed instantly (via `clasp` or git), while the active spreadsheet remains on the previous schema until the user explicitly runs an update. If newly pushed code assumes that a new sheet element exists (a new column, a new Named Range, or an updated formula), the script crashes with fatal runtime errors (`Cannot find range`, `TypeError`, `#REF!`).
* **Pattern**: Enforce loose coupling, declarative manifests, and strict execution invariants:
  1. **Tolerant Element Lookup**: Operational code (Ingestion, Scoring, Maintenance) must never crash if a newly introduced Named Range or column is absent; it must fall back gracefully to canonical coordinates or null.
  2. **Lazy Self-Healing on Demand**: If an operational function requires a critical prerequisite (such as a missing Named Range), it should lazily auto-register or repair the element on-the-fly rather than throwing an exception.
  3. **Declarative Cumulative Manifest (`SYSTEM_MANIFEST`)**: Track every schema element with an explicit version string and tier (`mandatory`, `recommended`, `optional`). Persist applied state in `DocumentProperties.APPLIED_MANIFEST` to detect exact pending deltas across multiple skipped releases.
  4. **Mandatory Invariant Rule**: Mandatory components (e.g. core formulas, Named Ranges, dynamic lookups) represent non-negotiable structural prerequisites for backend Apps Script execution. If a mandatory component is pending, the orchestrator **always auto-enforces it**, even if the user unchecked that sheet in the maintenance cockpit!
  5. **4-State Visual Matrix UI**: In the System Maintenance Cockpit, render cells in 5 unambiguous states: `───` (non-applicable), disabled unchecked box (already up-to-date), light red `#FFEBEE` locked box (mandatory invariant), light green `#E8F5E9` (recommended), and light blue `#E1F5FE` (optional). Sheet master checkboxes gate recommended and optional updates while keeping mandatory invariants active.
  6. **Dual Pre-Flight Safety Backups**: Always create in-workbook sheet clones (`_MNT_BAK_*`) and offer an automatic client-side Config JSON snapshot download before applying structural mutations.
  7. **Strict Zero-Loss Invariant**: All maintenance routines treat user data (Rows 5:N on `Flights`, custom equipment inventory, and user parameter values) as strictly read-only.

### Pattern 17: Transparent Manifest Inspection & Schema Auditing
* **Problem**: Users and developers lack visibility into which components are currently running on their spreadsheet versus what code has been deployed, making bug reproduction and upgrade planning difficult.
* **Pattern**: Expose a non-destructive System Info Inspector (`SystemInfoDialog.html`) showing:
  1. Real-time diff between `APPLIED_MANIFEST` and `SYSTEM_MANIFEST`.
  2. Sheet-by-sheet accordion health cards with operational tier badges (`[Mandatory]`, `[Recommended]`, `[Optional]`).
  3. Spreadsheet environment metadata (document ID, active timezone, user, GAS execution limits).
  4. Third-party engine attribution and direct hand-off to the maintenance cockpit when updates are pending.

### Pattern 18: Living Meta-Processes & Continuous Workflow Verification
* **Problem**: Architectural rules, naming conventions, and anti-pattern checklists documented only in prose inevitably suffer from "verification drift." Over time, code and doc audits degrade into rubber-stamp "PASS" approvals because checks are performed manually, allowing legacy tokens and anti-patterns to silently re-enter the codebase.
* **Pattern**: An architectural rule without an automated assertion is merely a suggestion that will decay over time.
  1. **Automate the Check**: Whenever an architectural invariant or anti-pattern is added, immediately add a corresponding programmatic rule or regex scanner to [`tools/code_check_audit.js`](../tools/code_check_audit.js).
  2. **Synchronize the Workflows**: Update [`.agent/workflows/code_check.md`](../.agent/workflows/code_check.md) and [`.agent/workflows/doc_check.md`](../.agent/workflows/doc_check.md).
  3. **Zero False-Pass Gate**: Require that `node tools/code_check_audit.js` exit with code 0 as a mandatory prerequisite for certifying `/code_check`.

### Pattern 19: Strict Separation of Production Runtime and Developer Tooling
* **Problem**: Co-locating unit test suites, mock fixtures, static analyzers, and simulation scripts directly inside the production `Code/` directory causes them to be uploaded to Google Apps Script via `clasp push`. In Apps Script, all `.gs` files share a single, flat global scope without module encapsulation. Bloating the project with 50+ KB of synthetic fixtures and test runners wastes V8 container compilation time, slows down trigger cold starts, pollutes global namespaces, and exposes test endpoints to client-side RPC.
* **Pattern**: Maintain a strict physical boundary between **Production Runtime Code** and **Developer Tooling**:
  1. **Production Runtime (`Code/`)**: Strictly code required by the active Google Sheet, user dialogs, and automated triggers (`15 .gs`, `17 .html`, `1 appsscript.json`). Pushed via `clasp push`.
  2. **Developer Testing & Simulation (`tests/`)**: Local and CI-only unit tests (`tests/Test.gs`), test fixtures, and mock assertions. Tracked in Git, never deployed to Google Apps Script.
  3. **Audit & Build Scripts (`tools/`)**: Standalone Node.js analyzers (`tools/code_check_audit.js`), offline test runners (`tools/run_all_offline_tests.js`), and header updaters. Tracked in Git, never deployed to Google Apps Script.
  4. **Defense-in-Depth Shield (`.claspignore`)**: Explicitly ignore test patterns (`**/*.test.*`, `**/Test.gs`, `tests/**`, `tools/**`, `Docs/**`, `Plans/**`), ensuring developer tooling can never be accidentally pushed.

### Pattern 20: Dual-Track Architectural Documentation & Two-Way Code Linking
* **Problem**: In open-source and AI-collaborative ("vibe coding") projects, documentation easily drifts from code. Developers and AI agents cannot easily determine which architectural specifications govern a code file, what invariants protect it, or which files implement a design. In-code comments often either devolve into trivial syntax echoes (`// loop through rows`) that rot, or disappear entirely into blackbox code that human and AI contributors break during refactoring.
* **Pattern**: Maintain a strict **Two-Way Linking Contract** and **Three-Tier In-Code Commenting Standard**:
  1. **Top-Down Code Header Contract**: Every production `.gs` file must begin with a standardized JSDoc metadata header declaring `@design`, `@architecture`, `@tenet`, `@pattern`, and `@revision`.
  2. **Bottom-Up Implementation Map Contract**: Every architecture view and subsystem RFC must conclude with an explicit machine-readable Implementation Map listing primary services, key interfaces, dependent dialogs, and automated tests.
  3. **High-Signal "Why & Invariants" In-Code Commenting**:
     * Never comment obvious JavaScript syntax.
     * Document non-negotiable invariants (`// INVARIANT: ...`), design patterns (`// PATTERN X: ...`), and platform traps (`// GAS QUOTA LIMIT: ...`).
     * Use comprehensive JSDoc (`@param`, `@returns`) on all public interface functions so AI agents infer correct types and boundaries zero-shot.
### Pattern 21: Subsystem Domain Decoupling (Domain Configuration vs. Domain Engine)
* **Problem**: In Google Apps Script, putting large declarative schemas, metadata registries, parameter definitions, and UI templates into procedural engine files causes monolithic code bloat (e.g. 1000+ line files), intertwines data declarations with procedural execution, and makes it difficult to maintain and test schema boundaries.
* **Pattern**: Distinct subsystems (such as `Automation`, `Maintenance`, `Ingestion`) must strictly isolate declarative metadata in `<Domain>Config.gs` (e.g. `Code/AutomationConfig.gs`) and operational execution logic in `<Domain>.gs` (e.g. `Code/Automation.gs`):
  1. `<Domain>Config.gs`: Contains static registries, triggers, actions, parameter schemas, and predefined rule templates. Zero side effects, zero sheet/Drive calls.
  2. `<Domain>.gs`: Contains procedural dispatchers, parsers, execution loops, condition evaluators, and RPC gateways.

### Pattern 22: Dual-Context Execution Invariant (Foreground Interactive vs. Headless Background)
* **Problem**: Automation actions can be invoked in two fundamentally different contexts: foreground (user clicked a menu or modal button) and background (autonomous time-driven trigger or queue daemon). In background execution, calling `SpreadsheetApp.getUi()` throws a fatal runtime exception (`Cannot call SpreadsheetApp.getUi() from this context`), interactive alerts crash the trigger, and execution must respect strict time budgets.
* **Pattern**: All action handlers registered in subsystem engines must adhere to 5 strict dual-context rules:
  1. **UI Safety**: Never invoke `SpreadsheetApp.getUi()` unconditionally. Use `try/catch` or context detection guards (`isForeground_()`).
  2. **Zero Interactive Prompts**: All operational decisions must be passed via the `params` object, never blocking background execution with prompts.
  3. **Decoupled Telemetry**: Always log to `Activity Logs` (`LOG.write()`) and stamp `Last Run` & `Last Result` on the sheet, rather than relying on toasts or DOM updates.
  4. **Time Budget Ceilings**: Handlers must accept a `timeBudget` tracker (`TimeBudgetService`) and yield or checkpoint before the 4.5-minute safety threshold.
  5. **Script Locking**: Headless dispatchers must acquire `LockService.getScriptLock().tryLock(10000)` to prevent concurrent collision with foreground user sessions.

### Pattern 23: Progressive Feature Flagging in Component Registries (`actionAvailable`)
* **Problem**: Defining a comprehensive catalog of planned system actions without having fully vetted their edge cases, non-destructive safety parameters (e.g. `OverwriteObservations=Y/N`), or validation rules risks exposing unstable or premature capabilities to end users in the UI.
* **Pattern**: Every action registered in a subsystem metadata registry must declare an explicit `actionAvailable: boolean` flag:
  1. Fully vetted, tested, and safe actions set `actionAvailable: true` (e.g. `SCAN_WATCH_FOLDER`, `CLEAN_LOGS`, `PROCESS_QUEUE`).
  2. Actions whose parameters or non-destructive safeguards are still under design set `actionAvailable: false` (e.g. `ENRICH_FLIGHT_GEO`, `ENRICH_FLIGHT_WEATHER`).
  3. User-facing interfaces (Rule Builder modal dialogs and in-sheet data validation dropdowns) strictly filter their options to display only actions where `actionAvailable === true`. This allows the architecture to maintain an exhaustive future capability catalog without exposing unvetted actions to pilots.

### Pattern 24: Dual-Tier Logging & Orchestrator-Worker Telemetry Contract (DSGN-LOG-002)
* **Problem**: Emitting row-level stepping telemetry directly to the spreadsheet (`LOG.write`) inside batch loops floods the persistent log tab with hundreds of micro-step rows, degrades Apps Script I/O responsiveness, and consumes quota. Conversely, suppressing telemetry leaves pilots blind in the UI console while operations run, while background cron triggers either spam the sheet with empty runs or run completely dark.
* **Pattern**: Strictly separate the **Ephemeral UI Activity Stream** from the **Persistent System Log Storage**, and enforce a two-tier contract between Orchestrators and Workers:
  1. **Dual-Tier Decoupling**:
     * **`Activity Log` (Client Stream)**: High-frequency stepping updates rendered live in HTML modal consoles and `ExecutionSidebar.html`. Strictly DOM-bound; 0 sheet I/O writes.
     * **`System Log` (Spreadsheet Tab)**: Permanent audit log tab (Dark Red `#D32F2F`) recording macro lifecycle boundaries (`[START]`, `[DISCOVERY]`, batch checkpoints, `[COMPLETE]`, errors).
  2. **Orchestrator Contract ("Boundary, Context & Commit")**:
     * Resolves effective `logLevel` (Rule parameter $\to$ Category in `Config` $\to$ Global Default $\to$ `'Normal'`).
     * Initializes session logger: `var session = LOG.createSession(processKey, effectiveLogLevel)`.
     * Emits macro milestones (`[START]`, `[DISCOVERY]`).
     * Enforces the commit gate: on `session.complete(stats)`, if `logLevel === 'Silent unless some activity'` and `stats.processed === 0 && stats.errors === 0`, it drops the buffer (0 sheet writes). Otherwise, flushes atomically via `LOG.writeBatch()`.
  3. **Worker Contract ("Execute, Stream to UI, Return Normalized Stats")**:
     * **Zero Direct Sheet Appends**: Workers must NEVER call `LOG.write()` inside row/file loops.
     * Streams micro-steps to live UI console (`logLine`).
     * Reports critical milestones/warnings to parent session (`session.info`, `session.warn`).
     * Returns normalized outcome stats: `{ success, processed, updated, skipped, errors, message }`.

---

## 7. Forbidden Code Smells & Anti-Patterns Checklist

| Anti-Pattern | Why It Is Dangerous | Prescribed Replacement |
| :--- | :--- | :--- |
| **Hardcoding Column Letters (`"B"`, `"L"`)** | Breaks on user column move or insertion. | Use `getColLetter_(map, name)` or Named Ranges. |
| **Hardcoding Column Indices (`row[11]`)** | Data written to wrong column on schema shift. | Use `map['Header Name'] - 1`. |
| **Volatile `INDIRECT()` Formulas** | Slows sheet to a crawl; breaks on column move. | Use `LET + XMATCH` or Named Ranges. |
| **Fixed Row Bounds in Validation (`A5:A100`)** | Appended rows lack dropdowns and formatting. | Use open-ended column ranges (`$B$5:$B`). |
| **Blind Scaffolding Overwrite** | Destroys custom pilot column arrangements. | Read active headers before writing Row 3/4. |
| **Trailing Underscore on RPC Handlers** | Breaks `google.script.run` from HTML dialogs. | Provide public wrapper without underscore. |
| **`DriveApp` calls inside tight row loops** | Hits Apps Script rate limits and timeout. | Score quality from sheet telemetry in memory. |
| **`getValues()` for Date/Time comparison** | Causes timezone rollover and date drift. | Use `getDisplayValues()` for text fidelity. |
| **Tightly Coupled Script-to-Sheet Assumptions** | Crashes production logbooks during dual-state lag. | Use tolerant fallbacks, lazy self-healing, and mandatory invariants. |
| **Allowing Users to Disable Mandatory Invariants** | Leaves sheet with missing Named Ranges or broken formulas. | Enforce mandatory components automatically regardless of sheet gating. |
| **Unverified Manual Audits (Rubber-Stamp PASS)** | Subjective review misses legacy names and manifest drift. | Enforce automated scanner (`tools/code_check_audit.js`) gate. |
| **Co-locating Test/Audit Code in Production Runtime** | Pollutes global GAS scope, slows cold starts, bloats container. | Move test suites to `tests/` and tools to `tools/`; protect with `.claspignore`. |
| **Calling `SpreadsheetApp.getUi()` in Headless Background** | Throws fatal runtime exception on time triggers. | Guard with `isForeground_()` or parameterize completely. |
| **Exposing Unvetted Actions in UI Registries** | Leads to accidental pilot execution of incomplete features. | Gate candidate actions with `actionAvailable: false`. |
| **Calling `LOG.write()` inside tight loops** | Causes compounding sheet write latency and grid locks. | Stream to UI console; buffer in `LOG.createSession()`. |
| **Hardcoding `'Activity Logs'` tab name** | Breaks tab name resolution after `System Log` migration. | Use `TABS.SYSTEM_LOG.name` or `TABS.ACTIVITY.name`. |
| **Discarding worker stats without commit evaluation** | Bypasses "Silent unless activity" no-op suppression. | Pass stats to `session.complete(stats)` before flushing. |


