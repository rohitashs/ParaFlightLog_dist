# Project Change Log

## Session: Dedupe Engine Overhaul, In-Memory Row Scoring, Logbook Duplicate Scanner (CR-ING-009), Configurable RDP Tolerance (CR-CFG-002) & Bulk Flight Status Change (CR-MNT-004)
**Date**: 2026-10-02
**Versions**: v0.8.21
**Focus**: Dedupe Engine Overhaul (`CR-ING-009`), In-Memory Row Quality Scoring (`scoreFlightQualityFromRow_`), Elimination of Compounding Drive Round-Trips (`Bug-ING-007`), Automation Queue Checkpoint Progress Preservation (`Bug-AUT-001`), Timezone-Immune String Extraction (`Bug-ING-008`), Short Throwaway Tags (`D01`, `D02`, ...) & Reciprocal Notes, Intra-Batch Duplicate Pairing (`Bug-ING-009`), Folder Crawl Discovery Metrics, End-of-Run Summary Formatting, Logbook Duplicate Scanner (`Flight maintenance > Scan & Flag Duplicates in Logbook...`), Configurable RDP Simplification Tolerance (`CR-CFG-002`), and Bulk Flight Status Change Utility (`CR-MNT-004`).

*   `[Imp]` **CR-MNT-004 (Bulk Flight Status Change Utility & Intentional Selection Safety Guardrail)**:
    *   **Unified Status Conversion Dialog (`Code/ChangeFlightStatusDialog.html`)**: Created modal interface under `Flight Log > Flight maintenance > Change Flight Status in Bulk...` (`showChangeFlightStatusDialog`) supporting both `Selected Rows` and `All Flights` scopes.
    *   **Intentional Selection Safety Rule with Empty/Blank Status Support**: Implemented 7 multi-select source status filter checkboxes (`Valid`, `Review?`, `Dup-Primary`, `Dup-Others`, `Invalid?`, `Remove`, and `(Blank / Empty)`) with live count badges. By default, all checkboxes are unselected matching strictly **0 flights**; execution buttons remain disabled until at least one filter and target status are intentionally selected, preventing accidental bulk updates. The `(Blank / Empty)` filter enables pilots to easily target and recover flight rows where status was accidentally cleared.
    *   **Tri-Mode Execution**: Full support for in-modal stepped batch execution (`[ 🚀 Run Here ]`), modeless sidebar execution (`[ 📌 Run in Sidebar ]` via `launchExecutionSidebar`), and headless cloud queue execution (`[ ⚙️ Run in Background ]` via `launchBackgroundJob` / `processBackgroundQueue`).
    *   **Batch Worker Routing**: Added `case 'STATUS_CHANGE':` to `executeWorkerBatch()` in `Code/Code.gs` to update Column B (`Status`) on `TABS.FLIGHTS` in batches of 25 with automatic post-execution Dashboard KPI refresh in `finalizeWorkerJob()`.
    *   **Activity Logging Registry**: Added `STATUS_CHANGE: 'Status Change'` to `CFG.LOG_PROCESSES` in `Code/Config.gs`.
    *   **User Guide Scaffolding & Documentation**: Added operation description to Section 4 of `Code/Scaffold.gs` and Section 6 of `Docs/User_Guide.md`.
*   `[Imp]` **CR-DSH-002 (Dashboard "Include Review?" Status Filter Selector)**:
    *   **Interactive Row 2 Selector (`Dashboard!B2`)**: Added `Include "Review?": [ No ▾ / Yes ▾ ]` selector in cells `A2:B2` on the `Dashboard` tab with a default of `No`.
    *   **Dynamic Formula Expansion**: Rebuilt all Dashboard formulas (`scaffoldDashboard_` in `Code/Scaffold.gs`) to dynamically include `Review?` flights alongside confirmed `Valid` flights when cell `B2` is set to `Yes`:
        *   All-Time Summary KPI Cards (Total Flights, Total Hours, Total Distance).
        *   Year-To-Date Summary KPI Cards (Flights, Hours, Distance).
        *   6-Month Activity Timeline (Monthly Flights, Hours, Distance).
        *   8 Top-5 Leaderboard Cards (Duration, Distance, Max Altitude, Altitude Gain, Thermal Flights, Soaring Flights, XC Score, Max Groundspeed).
        *   Top Launch Sites and Countries Flown query lists.
    *   **Instant Spreadsheet Evaluation**: Uses dynamic formula evaluation so toggling the dropdown immediately updates all statistics in real time with zero Apps Script execution delay.
*   `[Fix]` **Bug-ING-010 (Dropdown, Validation & Formatting Expansion on Bulk Appended Rows)**:
    *   **Root Cause**: Single flight ingestion (`insertFlightRow_`) inserts rows at row 5, inheriting cell validations and conditional formatting from adjacent rows. In contrast, bulk ingestion (`processBulkBatch`) appends raw values in batch directly to the bottom (`sh.getRange(curLastRow + 1, ...).setValues(batchRows)`). When new flights exceed the initial ~60 template rows, new rows lacked dropdowns, validations, cell text wrapping, top vertical alignment, and conditional formatting.
    *   **Automatic Validation & Format Expansion**: Wired `applyFlightsValidation_(sh)` directly into `sortFlightsByDate_()` and `finalizeBulkImport()`, guaranteeing that any bulk ingestion or logbook sort dynamically extends all dropdowns and validations to `sh.getLastRow() + 50`.
    *   **Idempotent Conditional Formatting**: Updated `applyFlightsValidation_()` in `Code/Scaffold.gs` to filter out existing Column B conditional formatting rules before appending new rules, preventing rule stacking across repeated sorts. Running `Sort All Flights by Date` or `Update Dropdowns, Parameters & Notes` instantly repairs all existing flight rows.
*   `[Imp]` **CR-CFG-002 (Configurable RDP Simplification Tolerance)**:
    *   **Dynamic RDP Tolerance (`RDP_TOLERANCE`)**: Exposed Ramer-Douglas-Peucker simplification tolerance as a user-configurable parameter in `Code/Config.gs` under `[ Flight Scoring, Physics and Analysis ]` with a default of `0.0005` (degrees, approx 50m).
    *   **Scoring Engine Integration**: Updated `SCORING.calculateXcScore(fixes, configOrTol)` in `Code/Scoring.gs` to dynamically resolve tolerance from the passed configuration object or numeric value, falling back gracefully to `CFG.defaults.RDP_TOLERANCE` or `0.0005`.
    *   **Pipeline & Maintenance Integration**: Threaded active sheet configuration through `processSingleIgcBlob_` and `processBulkBatch` in `Code/Ingestion.gs` and `executeFlightMaintenanceRow_` in `Code/Code.gs`.
    *   **UI & Scaffold Synchronization**: Updated parameter badges in `Code/SaveConfigDialog.html` (50 total keys, 20 scoring keys) and updated validation and unit test assertions in `Code/Test.gs`.
*   `[Imp]` **CR-ING-009 (Dedupe Engine Enhancement, Row Quality Scoring, Discovery Metrics & Logbook Duplicate Scanner)**:
    *   **In-Memory Row-Based Quality Scoring (`scoreFlightQualityFromRow_`)**: Eliminated severe bulk ingestion bottleneck where every candidate comparison previously called `DriveApp.getFileById()` to parse raw IGCs from Google Drive (`Bug-ING-007`). Evaluates device/source (XCTrack = 35, dedicated vario = 25, generic app = 15), barometric altitude integrity (maxAlt !== minAlt = 30), duration (>30m = 15, >10m = 10), and equipment (+10) directly from row data in memory.
    *   **Timezone-Immune Precision & Wider Overlap Window**: Switched from `getValues()` to `getDisplayValues()` across flight summaries and dedupe matching (`Bug-ING-008`), preventing script timezone date translation (midnight rollbacks) and 1899 epoch time offsets. Expanded time tolerance to +/- 20 minutes (or 45 minutes with interval overlap) and spatial proximity to <= 1000m.
    *   **Concise Throwaway Tags & Reciprocal Notes**: Replaced long timestamp tags (`DUP_YYYYMMDD_HHMM`) with clean cluster tags (`D01`, `D02`, ...) and reciprocal notes (`[DupRef: D01 | Others: F20260510-02, F20260510-03]` on Primary, `[DupRef: D01 | Primary: F20260510-01]` on Duplicates). Supports multi-file clusters (N-way pairing).
    *   **Intra-Batch Duplicate Pairing**: Handled duplicates appearing within the same 5-file ingestion batch (`Bug-ING-009`) by updating `batchRows` in memory prior to grid insertion.
    *   **Queue Checkpoint Progress Preservation**: Fixed progress reset bug where `Automation_Queue` reset from `20/273 (7%)` to `0/273 (0%)` at the 4.5-minute pause boundary by passing accumulated stats and cursor tracking correctly (`Bug-AUT-001`).
    *   **Folder Crawl Discovery Metrics**: Enhanced folder crawler (`getFilesRecursive_` and `stageUrlOrDriveImport`) to count and log total scanned files, subfolders, archives, and unsupported files, writing immediate `[DISCOVERY]` events to `Activity Logs`.
    *   **End-of-Run Aggregate Summary**: Formatted detailed summary reporting total files processed, added to logbook, duplicates discarded, and errors in `finalizeBulkImport` and background queue logging.
    *   **Logbook Duplicate Scanner Utility**: Added `Flight Log > Flight maintenance > Scan & Flag Duplicates in Logbook...` (`uiScanAndFlagLogbookDuplicates`, `scanAndFlagLogbookDuplicates_`) allowing pilots to audit and flag existing logbook duplicates into `Dup-Primary` and `Dup-Others` with reciprocal notes without demoting user-validated flights (`Valid`).
*   `[Test]` **Unit Test Suite Expansion (`Code/Test.gs`)**:
    *   Added `testStatusChangeUtility_()` to automated test suite: verifies public dialog and discovery RPC availability, empty source filter safety invariant (`[]` on unselected), and `CFG.LOG_PROCESSES.STATUS_CHANGE` registration (12/12 test suites pass).
    *   Added `testDedupeEngineEnhancements_()` to automated test suite: verifies in-memory row quality scoring invariants, short `DupRef` tags and reciprocal notes formatting, tag replacement idempotency, and public RPC/menu function availability.
    *   Updated `testConfigStructureAndGrouping_()` and `testScoring_()` in `Code/Test.gs` to validate 20 scoring parameters and dynamic `RDP_TOLERANCE` simplification handling.

## Session: Tri-Mode Execution Subsystem, Dialog Harmonization & Brochure Publication (DSGN-UI-001)
**Date**: 2026-10-02
**Versions**: v0.8.20
**Focus**: Tri-Mode Execution Subsystem ([`CR-UI-019`](file:///g:/My%20Drive/~RS2B/~Projects/ParaFlightLogProject/Docs/Backlog.md) / [`DSGN-UI-001`](file:///g:/My%20Drive/~RS2B/~Projects/ParaFlightLogProject/Docs/Design/DSGN-UI-001_Tri_Mode_Execution_and_Universal_Sidebar.md)), Universal Modeless Execution Sidebar ([`ExecutionSidebar.html`](file:///g:/My%20Drive/~RS2B/~Projects/ParaFlightLogProject/Code/ExecutionSidebar.html)), Persistent Cloud Task Queue ([`QueueService.gs`](file:///g:/My%20Drive/~RS2B/~Projects/ParaFlightLogProject/Code/QueueService.gs), `Automation_Queue` tab), Bounded 4.5-Minute Time Budget Engine ([`TimeBudget.gs`](file:///g:/My%20Drive/~RS2B/~Projects/ParaFlightLogProject/Code/TimeBudget.gs)), Universal Dialog Visual Harmonization across 10 modal dialogs (header deduplication, standardized button bar docking, and copy-log consoles), Platform Brochure Publication (`External/ParaFlightMgmt_brochure v1.html`, `External/ParaFlightLog_Brochure_v2.pdf`, [`Docs/Brochure.md`](file:///g:/My%20Drive/~RS2B/~Projects/ParaFlightLogProject/Docs/Brochure.md)), and comprehensive offline test suite expansion.

*   `[Imp]` **CR-UI-019 / DSGN-UI-001 (Tri-Mode Execution Model, Universal Execution Sidebar & Modal Dialog Normalization)**:
    *   Implemented 3-choice operational execution architecture: (1) `[ Run Here ]` (in-modal synchronous stepping for quick jobs), (2) `[ Run in Sidebar ]` (closes modal, opens modeless 300px `ExecutionSidebar.html`, keeping spreadsheet grid 100% interactive), and (3) `[ Run in Background ]` (closes modal, enqueues to `QueueService`, executes headlessly on Google Cloud servers, streaming logs to `Activity Logs`).
    *   Created `Code/ExecutionSidebar.html`: Universal 300px modeless sidebar featuring Context Header, Metric Pills, Activity Log Console with `📋 Copy Log`, and dynamic Cancel/Done controls.
    *   Created `Code/QueueService.gs`: Persistent job queue manager operating on the `Automation_Queue` tab (`['Job ID', 'Type', 'Status', 'Progress', 'Started At', 'Updated At', 'Payload & State', 'Last Error']`). Eliminates `PropertiesService` 9 KB limits and provides foundational execution substrate for scheduled automation.
    *   Created `Code/TimeBudget.gs`: Execution runtime budget service enforcing a 4.5-minute safety threshold. Prevents Google Apps Script 6-minute hard termination timeouts by committing data, serializing checkpoint state, and spawning 30-second continuation triggers (`ScriptApp.newTrigger`).
    *   Extended Tri-Mode action button bars across `BulkIngestDialog.html`, `FlightMaintenanceDialog.html`, `PurgeDialog.html`, `ScanDialog.html`, `ResyncDialog.html`, `URLDialog.html`, and `UploadDialog.html`.
    *   Standardized UI layout across all 10 modal dialogs: eliminated redundant inner `header-large` title bars duplicating native Google Sheets modal frames, standardized action button docking above footer progress bars (with `PurgeDialog.html` docked directly above the activity console for pre-destructive review), and integrated `📋 Copy Log` buttons project-wide.
    *   Added `Automation_Queue` sheet tab definition to `TABS.QUEUE` in `Code/Config.gs` (Dark Slate Gray `#455A64`, index 8, frozen rows = 1).
    *   Implemented background queue runner (`processBackgroundQueue`, `executeQueuedJobContinuation`, `setupQueueDaemonTrigger`) and added `Setup 5-Min Queue Daemon Trigger` to `Flight Log > Admin > Automation & Services`.
*   `[Doc]` **Platform Brochure Publication & Professional PDF Generation**:
    *   Created standalone external brochure HTML (`External/ParaFlightMgmt_brochure v1.html`) and updated platform manifesto in [`Docs/Brochure.md`](file:///g:/My%20Drive/~RS2B/~Projects/ParaFlightLogProject/Docs/Brochure.md).
    *   Generated print-optimized, 5-page publication PDF (`External/ParaFlightLog_Brochure_v2.pdf`) with cohesive page breaks, tuned typography, and structured system diagrams using headless Chrome automation.
*   `[Test]` **Offline Unit & Static RPC Test Suite Expansion**:
    *   Expanded offline test harness in `scratch/run_all_offline_tests.js` to 10 automated test suites covering Parser, Analysis, Scoring, Drive ID extraction, Log Process resolution, Log Level filtering, Dual-Threshold pruning math, Time Budget engine, Queue Service constants, and Universal Worker batch routing (10/10 passed).
    *   Executed comprehensive static analysis (`scratch/code_check_audit.js`) verifying 72/72 RPC endpoints and 26/26 public menu wrappers with 0 trailing underscore violations.

## Session: Activity Logging System Overhaul (DSGN-LOG-001)
**Date**: 2026-10-01
**Versions**: v0.8.19
**Focus**: Activity Logging System redesign and implementation (`CR-LOG-004` / `DSGN-LOG-001`), sheet tab rename `App_Log` -> `Activity Logs` with 4-column schema, centralized `Logger.gs` engine with tiered log levels (`Brief`, `Normal`, `Debug`), conservative dual-threshold pruning (`LOG_ROWS_TO_KEEP: 2000`, `LOG_TIME_TO_KEEP_DAYS: 90`), automated in-place migration, manual Admin menu cleanup, and 📋 Copy Log buttons across all 5 modal consoles.

*   `[Imp]` **CR-LOG-004 / DSGN-LOG-001 (Activity Logging System Overhaul)**:
    *   Renamed sheet tab `App_Log` to `Activity Logs` (Dark Red `#D32F2F`, frozen rows = 2) with automatic in-place migration for existing sheets.
    *   Overhauled schema to 4 columns: `Process` (Col A, 175px), `Timestamp` (Col B, 165px, `yyyy-mm-dd hh:mm:ss`), `Activity / Event` (Col C, 530px, text wrap), and `Additional Info` (Col D, 380px, text wrap, 9pt).
    *   Added `CFG.LOG_PROCESSES` (13 standardized process keys) and `CFG.LOG_PREFIXES` (`[START]`, `[INFO]`, `[OK]`, `[DUPE]`, `[WARN]`, `[ERR]`, `[COMPLETE]`) in `Code/Config.gs`.
    *   Added 5 configuration parameters under `[ Logging & Admin ]` in `Code/Config.gs` with data validation dropdowns in `Code/Scaffold.gs`: `LOG_LEVEL` (`Brief`, `Normal`, `Debug`), `LOG_AUTO_CLEAN` (`Yes`, `No`), `LOG_CLEAN_FREQUENCY_DAYS` (3), `LOG_ROWS_TO_KEEP` (2000), `LOG_TIME_TO_KEEP_DAYS` (90).
    *   Created centralized logging engine in `Code/Logger.gs` (`LOG.resolveProcess`, `LOG.getLogLevel`, `LOG.shouldLog`, `LOG.write`, `LOG.writeBatch`, `LOG.createSession`, `LOG.cleanLogs`, `autoCleanLogsIfDue_`, and legacy backward-compatibility bridges).
    *   Implemented conservative dual-threshold pruning: rows are only pruned if total rows exceed `LOG_ROWS_TO_KEEP` AND are older than `LOG_TIME_TO_KEEP_DAYS`.
    *   Added `📋 Copy Log` button and `copyConsoleLog()` clipboard handler across all 5 modal dialog consoles (`BulkIngestDialog.html`, `ResyncDialog.html`, `PurgeDialog.html`, `URLDialog.html`, `ScanDialog.html`).
    *   Integrated centralized logging calls across `Code/Ingestion.gs`, `Code/FileHandling.gs`, and `Code/Code.gs`, and added `Clean Activity Logs Now...` to `Flight Log > Admin > Sheet Maintenance & Views`.
    *   Added unit test suite covering process resolution, log level filtering, and dual-threshold pruning math in `Code/Test.gs`.

## Session: Bulk Flight Ingestion, Pilot Profile Subheaders, Config Reorganization, & Config Backup Granularity
**Date**: 2026-10-01
**Versions**: v0.8.18
**Focus**: High-speed Bulk Flight Ingestion utility (`CR-ING-008`), Pilot Profile 3-column layout with section dividers and 34-field taxonomy (`CR-SYS-004`), Config tab parameters and lookups reorganization (`CR-CFG-006`), Granular 5-group configuration export/import with dynamic UI protection (`CR-CFG-007`), standardized 24 public menu callback wrappers in `Code.gs` (`CR-DEV-002`), batch audit logging undefined tab reference fix (`Bug-ING-005`), bulk batch default status Review? enforcement (`Bug-ING-006`), and Load Config dialog sticky Apply button & file chooser fix (`Bug-UI-009`).

*   `[Imp]` **CR-ING-008 / RQ-ING-001.4 (High-Speed Bulk Ingestion Utility & Large Scale Ingestion)**:
    *   Verified pilot sign-off and closed out requirement `RQ-ING-001.4` as fully implemented via `CR-ING-008`.
    *   Created `Code/BulkIngestDialog.html` providing a dedicated onboarding utility for large-scale flight ingestion (>5 files queue / batch processing).
    *   Implemented multi-file RPC batching (`processBulkBatch`) with selectable batch sizing (3, 5, or 10 files per call) to eliminate container spin-up overhead.
    *   Implemented atomic batch row insertion appending entire batches to the bottom of the `Flights` tab in single calls, followed by a single final chronological sort (`finalizeBulkImport`).
    *   Added configurable enrichment checkboxes for non-critical web lookups (Site Detection, Reverse Geo, Open-Meteo Weather, XContest sync, XC Scoring, Analytics, and source deletion safety).
*   `[Imp]` **CR-SYS-004 (Pilot Profile 3-Column Layout with Section Dividers & 34 Field Taxonomy)**:
    *   Overhauled `Pilot_Profile` tab to a clean 3-column layout (`Field`, `Value`, `Notes / Instructions`) with merged section divider headers across 6 functional blocks (`[ Identity ]`, `[ Licensing ]`, `[ Affiliations ]`, `[ Emergency / SAR ]`, `[ Tracking / Gear ]`, `[ Progression ]`).
    *   Added "Other Info" fallback fields to all 6 sections, consolidated 3 emergency contacts, renamed license fields to Info format, added CIVL ID, and implemented migration field aliases.
    *   Guaranteed pure key-value non-destructive synchronization matching on Col A and writing Col B.
*   `[Imp]` **CR-CFG-006 (Config Tab Lookups & Parameters Structural Reorganization)**:
    *   Renamed `[ Lists ]` parameter subheader to `[ Format and Units ]`, removed `[ Admin ]` subheader, and relocated `CONTACT_EMAIL` into `[ Geo & Time ]`.
    *   Reorganized lookups with manual controlled vocabularies on the left in Columns 5–10 (`Equipment Categories`, `Flight Status`, `Flight Type`, `XC Classes`, `Date Formats`, `Time Formats`) and dynamic equipment queries on the right in Columns 11–14 (`Wings (Auto)`, `Harnesses (Auto)`, `Reserves (Auto)`, `Other (Auto)`).
*   `[Imp]` **CR-CFG-007 (Granular 5-Group Configuration Export/Import with Dynamic UI Protection)**:
    *   Upgraded `SaveConfigDialog.html` and `LoadConfigDialog.html` to support 5 granular parameter sub-groups (8 Ingestion, 16 Integrations & Geo/Time, 19 Scoring & Physics, 2 Format and Units, 4 UI & Dashboard Currency) alongside Pilot Profile (34 fields) and Lookups (6 manual lists).
    *   Implemented live entity count badges and dynamic UI protection in `LoadConfigDialog.html` (automatically unchecking, disabling, and dimming missing sections with visual opacity transitions).
*   `[Imp]` **CR-DEV-002 (Standardized 24 Public Menu Callback Wrappers in Code.gs)**:
    *   Defined explicit public wrapper functions for all 24 custom spreadsheet menu items in `Code/Code.gs`, eliminating trailing underscores and ensuring strict compatibility with Google Apps Script onOpen execution rules.
*   `[Fix]` **Bug-ING-005 (Batch Audit Logging Undefined Tab Reference)**:
    *   Fixed fatal error during bulk flight ingestion caused by `logImportBatch_` in `Code/Ingestion.gs` referencing non-existent `TABS.ACTIVITY.name` instead of `TABS.APP_LOG.name`. Added defensive `try/catch` guard.
*   `[Fix]` **Bug-ING-006 (Bulk Batch Default Status Review? Enforcement)**:
    *   Resolved data validation violation where bulk flight ingestion inserted `'OK'` into the `Status` column. Aligned default status to `'Review?'` in `Code/Ingestion.gs` and `Code/BulkIngestDialog.html` to match standard ingestion and controlled dropdown vocabulary.
*   `[Fix]` **Bug-UI-009 (Load Config Dialog Sticky Apply Button & Left-Aligned File Chooser)**:
    *   Fixed issue where Load Config dialog parsed file at 50% but hid the Apply button due to container overflow, and the file chooser input obfuscated the file name. Added sticky footer button bar and left-aligned file chooser.

## Session: Out-and-Return XC Scoring, Taxonomy Harmonization, RPC Gateways & Modal Layout Fixes
**Date**: 2026-10-01
**Versions**: v0.8.16
**Focus**: Out-and-Return geometric optimization and scoring (`CR-SCORE-002`), 4-class XC Flight Class taxonomy harmonization across Scoring, Scaffold, Ingestion, and UI, automated static RPC verification guardrail (`CR-DEV-001`), elimination of trailing underscore execution failures across dialogs (`Bug-RPC-001`), modal dialog scrollbar containment (`Bug-UI-008`), and purge dialog messaging update (`Bug-PURGE-002`).

*   `[Imp]` **CR-SCORE-002 (Out-and-Return XC Scoring & 4-Class Taxonomy Harmonization)**:
    *   Implemented `optimizeOutAndReturn_` in `Code/Scoring.gs` evaluating single-turnpoint out-and-back flights ($P_i \to P_j \to P_k$ where $i < j < k$).
    *   Enforces CIVL / XContest closure rule: distance between finish and start must be $\le 20\%$ of total course distance ($2 \times D_{\text{tp}}$).
    *   Scores $(2 \times D_{\text{tp}} - \text{Gap}) \times 1.2$ points ($1.2\times$ league multiplier).
    *   Harmonized standard 4-class taxonomy across the system: `['Free Flight', 'Flat Triangle', 'FAI Triangle', 'Out-and-Return']`.
    *   Refactored `optimizeTriangle_` in `Code/Scoring.gs` to require 3 distinct legs ($P_i \to P_j \to P_k \to P_m$) with closure gap $\le 20\%$ and minimum leg threshold $\ge 5\%$ of perimeter, preventing degenerate collapse into out-and-return flights.
    *   Added `normalizeXcClass_` in `Code/Utils.gs` and mapped `XC Flight Class` across `Code/Ingestion.gs`, `Code/Code.gs`, and `Code/Scaffold.gs` (`Config!L3:L`).
*   `[Imp]` **CR-DEV-001 (Automated Static RPC Verification Guardrail in Test Suite)**:
    *   Added automated static analysis in `scratch/run_unit_tests.js` scanning all HTML templates in `Code/` for `google.script.run` invocations.
    *   Enforces that: 1) no client-called function ends with a trailing underscore `_`, and 2) every called function exists in `Code/*.gs`.
    *   Causes the test suite to fail immediately with exit code 1 if any private RPC call is detected.
*   `[Fix]` **Bug-RPC-001 (Private RPC Functions Freezing Client Dialogs)**:
    *   Fixed trailing underscore execution errors in Google Apps Script by introducing public RPC gateway functions in `Code/Code.gs`:
        *   `finalizeResync()` -> wraps `finalizeResync_()`
        *   `finalizePurge()` -> wraps `finalizePurge_()`
        *   `exportConfigJson(options)` -> wraps `exportConfigJson_(options)`
        *   `importConfigJson(payload, opts)` -> wraps `importConfigJson_(payload, opts)`
        *   `markDuplicatesForRemoval(chkOthers, chkPrimary)` -> wraps `markDuplicatesForRemoval_(chkOthers, chkPrimary)`
    *   Updated client-side calls in `ResyncDialog.html`, `PurgeDialog.html`, `SaveConfigDialog.html`, `LoadConfigDialog.html`, and `MarkDuplicatesDialog.html`.
*   `[Fix]` **Bug-UI-008 (Modal Dialog Layout & Contained Log Scrolling)**:
    *   Updated `Code/Style.html` with universal `box-sizing: border-box`, configured `.main-content` as `display: flex; flex-direction: column; overflow: hidden; min-height: 0; flex: 1 1 auto;`, eliminating outer dialog scrollbars.
    *   Constrained `#log-console` with `max-height: 180px; flex: 1 1 auto; overflow-y: auto`, ensuring all scrolling is strictly contained within the activity console.
    *   Increased modal dialog sizes in `Code/Code.gs`: `showResyncDialog` (540x500), `showPurgeDialog` (540x500), `showSaveConfigDialog` (540x520), `showLoadConfigDialog` (550x540), `showScanDialog` (540x480), and `showMarkDuplicatesDialog` (520x460).
*   `[Fix]` **Bug-PURGE-002 (Purge Dialog Message Alignment)**:
    *   Updated finalization log message in `Code/PurgeDialog.html` from `"Sorting logbook and refreshing deduplication cache..."` to `"Sorting logbook chronologically and re-indexing flights..."`.

## Session: Config Consolidation, Interactive Purge Stepping, Mark Duplicates for Removal & Dedupe Cleanup
**Date**: 2026-09-30
**Versions**: v0.8.15
**Focus**: Config tab consolidation (`CR-CFG-005`), JSON Configuration Management (`Save Config` / `Load Config`), interactive stepping Purge dialog (`PurgeDialog.html`), Mark Duplicates for Removal dialog (`MarkDuplicatesDialog.html`), Done button on `ResyncDialog.html`, elimination of obsolete `'Duplicate'` status, and drift self-healing.

*   `[Imp]` **CR-CFG-005 (Consolidated Config Tab & 7-Sheet Architecture)**:
    *   Combined `Parameters` and `Lookups` into a single consolidated `Config` tab (`TABS.CONFIG` with Amber theme `#FF9800`, index 6).
    *   Layout: System Parameters in Columns A:C (Key, Value, Description) growing downward; Column D blank spacer (width 25px); Reference Lookups in Columns E:N (Equipment categories, dynamic queries for Wing/Harness/Reserve/Other, Flight Status, Types, XC Classes, Date/Time Formats) growing horizontally.
    *   Preserved backward compatibility by mapping aliases `TABS.PARAMETERS` and `TABS.LOOKUPS` directly to `TABS.CONFIG`.
    *   Updated `scaffoldConfig_` in `Code/Scaffold.gs`, `applyFlightsValidation_`, `applyEquipmentValidation_`, and all dashboard `VLOOKUP` formulas (`VLOOKUP("...", Config!A:B, 2, FALSE)`).
    *   Reduced total spreadsheet tabs from 8 to 7: `Dashboard`, `Flights`, `Pilot_Profile`, `Equipment`, `User Guide`, `Config`, `App_Log`.
*   `[Imp]` **CR-CFG-005 (Configuration Management: Save & Load Config JSON)**:
    *   Added `Flight Log > Admin > Configuration Management` submenu with `Save Config...` and `Load Config...`.
    *   Created `SaveConfigDialog.html`: interactive modal with section checkboxes (Pilot Profile, Ingestion parameters, Integrations, Scoring parameters, UI/Display parameters, Lookups) and direct client-side JSON download (`exportConfigJson_`).
    *   Created `LoadConfigDialog.html`: interactive modal with local `.json` file selector, automatic section detection, selectable restore options, and live execution (`importConfigJson_`).
*   `[Imp]` **CR-CFG-005 (Interactive Purge Dialog with Client Stepping & Trashing)**:
    *   Created `PurgeDialog.html`: client-stepping modal dialog for purging flights marked `Remove`.
    *   Detects candidate rows live (`getPurgeCandidateFlightsStatus`), displays real-time progress bar and step-by-step console, moves master IGC files from `Master Log Folder` to `Trash Folder` (`purgeSingleCandidateFlight`), deletes sheet rows from bottom to top, refreshes in-memory dedupe hashes, auto-sorts flights descending, and displays a primary `Done` button (`finalizePurge_`).
*   `[Imp]` **CR-CFG-005 (Mark Duplicates for Removal Dialog)**:
    *   Added `Flight Log > Flight maintenance > Mark Duplicates for Removal...` menu item.
    *   Created `MarkDuplicatesDialog.html`: displays real-time counts of `Dup - Others` (backup tracks) and `Dup - Primary` (primary tracks).
    *   Allows pilots to selectively stage duplicate categories to `Remove` (`markDuplicatesForRemoval_`) without immediate row deletion.
*   `[Imp]` **CR-CFG-005 (Eliminated Legacy 'Duplicate' Status & Master Log Drift Self-Healing)**:
    *   Eliminated obsolete `'Duplicate'` status from status dropdown, data validation, conditional formatting, and ingestion logic.
    *   All duplicate occurrences adhere strictly to soft dedupe quality scoring (`Dup-Primary` / `Dup-Others`).
    *   Added drift self-healing: if an incoming IGC matches an existing file in `Master Log Folder` by filename or content but has no corresponding flight row, the system automatically restores the flight row and performs soft dedupe quality scoring against other recordings.
*   `[Imp]` **CR-ING-007 (Done Button on Resync Dialog & Flight Updates Alignment)**:
    *   Transformed `btn-close` on `ResyncDialog.html` into a primary `Done` button upon completion.
    *   Aligned dialog header, button text, and completion log in `FlightMaintenanceDialog.html` to `Flight Updates`.
*   `[Test]` **Automated Testing**:
    *   Added `testConfigAndDedupeEnhancements_` in `Code/Test.gs` verifying `TABS.CONFIG` definition, `CFG.sheets.config = 'Config'`, exclusion of `'Duplicate'` from status lookups and validations, and presence of all new dialog launchers and backend handlers.

## Session: Smart Deduplication, Device Overlap Scoring, Row Hashes & Master Log Sync
**Date**: 2026-09-30
**Versions**: v0.8.13
**Focus**: Smart Deduplication architecture (`CR-ING-006`), Row-based MD5 hashes (`IGC Hash` column), Heuristic Quality Scoring (`scoreFlightQuality_`), Overlap Detection (`findHeuristicOverlap_`), Dedicated `TRASH_FOLDER_ID` vs. `ERROR_FOLDER_ID`, Dashboard Protection (`Status = "Valid"` filter), Master Log Re-linking, Purge Discarded Flights (`purgeRemoveFlights`), and Master Folder Re-sync (`syncMasterLogsToSheet_`).

*   `[Imp]` **CR-ING-006 (Row-Based Hashes & Zero Black Box Deduplication)**:
    *   Added `IGC Hash` as Column 70 in `TABS.FLIGHTS.groups.Meta` (`Code/Config.gs`).
    *   Row-based storage ensures that deleting a flight row automatically removes its hash, allowing re-import without blanket cache flushes.
    *   Implemented `getExistingSheetHashes_` and in-memory cache `_cachedSheetHashes` in `Code/Ingestion.gs` to prevent repeated sheet reads during bulk imports.
*   `[Imp]` **CR-ING-006 (Dedicated Trash Folder & Folder Purpose Partitioning)**:
    *   Added `TRASH_FOLDER_ID` parameter in `Code/Config.gs` and implemented `moveToTrashFolder_` in `Code/FileHandling.gs`.
    *   Strictly partitioned folder roles:
        *   `TRASH_FOLDER_ID`: Intentionally discarded/duplicate files (hard duplicates skipped during ingest, backup files from duplicate triage, purged flights, source archives). Can be safely emptied anytime.
        *   `ERROR_FOLDER_ID`: Reserved strictly for corrupt files, unparseable IGCs, and fatal processing exceptions requiring investigation.
    *   Updated `handleFileCleanup_` and `trashSourceFiles` to route duplicates and discarded sources directly to `TRASH_FOLDER_ID`.
    *   Added `uiUpdateTrashFolder_` and folder picker integration in `Code/Code.gs`.
*   `[Imp]` **CR-ING-006 (Smart Master Log Re-linking)**:
    *   Updated `copyToMasterLog_` in `Code/FileHandling.gs` to check existing file content using MD5 digest.
    *   If an incoming file matches an existing file in `MASTER_LOG_FOLDER_ID` by MD5 content but no flight row exists in the `Flights` tab, re-links to the existing Master IGC without creating duplicate `_copy.igc` files, inserts the flight row with status `'Review?'`, and trashes the source file.
*   `[Imp]` **CR-ING-006 (Heuristic Overlap Detection & Flight Quality Scoring)**:
    *   Implemented `findHeuristicOverlap_` in `Code/Ingestion.gs` to detect duplicate flights across different instruments based on Date match, Launch Time match ($\pm 15$ min or interval overlap with $\Delta t \le 35$ min), and Launch Location proximity ($\le 1{,}000$ meters via Haversine).
    *   Implemented `scoreFlightQuality_` (0–100 pts) favoring XCTrack primary instruments over backup varios, authentic baro pressure sensor integrity, 1Hz recording resolution, longer recorded duration, and metadata richness.
    *   Assigns winner status `Dup-Primary` (gold #FFE082) and backup status `Dup-Others` (orange #FFCC80).
    *   Appends cross-referencing note `[DupRef: DUP_YYYYMMDD_HHMM | Paired with <FlightID> (Score: X vs Y)]` to both flights, and dynamically updates the existing paired row using `updatePairedFlightRow_`.
*   `[Imp]` **CR-ING-006 (Dashboard Metric Protection)**:
    *   Updated all Dashboard KPI formulas in `Code/Scaffold.gs` (All-Time Banners, Year-to-Date Banners, 6-Month Activity Timeline, all 8 Leaderboard Cards, and Complete Lists) to strictly filter for `Status = "Valid"`.
    *   Prevents unreviewed incoming flights (`Review?`) and duplicate flights (`Dup-Primary`, `Dup-Others`) from polluting pilot statistics until explicitly reviewed.
*   `[Imp]` **CR-ING-006 (Admin Purge & Master Log Self-Healing Actions)**:
    *   Added `purgeRemoveFlights()` in `Code/Code.gs` under *Sheet Maintenance & Views*: prompts for confirmation, moves Master IGC files to `TRASH_FOLDER_ID`, deletes rows bottom-up, clears cached hashes, and re-sorts flights chronologically.
    *   Added `syncMasterLogsToSheet_()` in `Code/Code.gs` under *Sheet Maintenance & Views*: scans `MASTER_LOG_FOLDER_ID` for orphaned IGCs missing from the `Flights` tab and restores them with status `'Review?'` and `[Restored from Master Log Folder]` note.
    *   Wired `sortFlightsByDate` into `ScanDialog.html` upon batch completion.
*   `[Test]` **Automated Testing**:
    *   Added `testDedupeAndQualityScoring_` in `Code/Test.gs` verifying `TRASH_FOLDER_ID` configuration, `IGC Hash` column schema, quality scoring logic, and existence of purge, sync, and trash functions.

## Session: Dashboard Resiliency, Frozen Columns, Dynamic Lookups & Schema Streamlining
**Date**: 2026-09-30
**Versions**: v0.8.12
**Focus**: Dashboard formula resiliency & 8-column layout (`CR-SYS-002`, `Bug-SYS-006`), frozen columns (`CR-UI-017`), dynamic Lookups validation (`Bug-UI-006`), Closed? validation (`Bug-UI-007`), manual flight status default (`Bug-UI-005`), and schema streamlining (`CR-SCH-001`).

*   `[Fix]` **Bug-SYS-006 & CR-SYS-002 (Dashboard Restructuring, Currency Shading, 8 Leaderboard Cards & Full Lists)**:
    *   Rebuilt `scaffoldDashboard_` in `Code/Scaffold.gs` into a 6-column layout (`A` to `F`, ~930px width) with word wrapping enabled across all cells.
    *   Added **Banner 1: All-Time Summary**: 3 KPI cards across Columns `A:B` (Total Flights), `C:D` (Total Hours formatted cleanly as `[h]:mm "hrs"`), and `E:F` (Total Distance `#,##0 "km"`).
    *   Added **Banner 2: Year-to-Date Summary**: 3 KPI cards across Columns `A:B` (Flights this year), `C:D` (Hours this year formatted cleanly as `[h]:mm "hrs"`), and `E:F` (Distance this year), dynamically adjusting as the calendar year changes via `YEAR(TODAY())`.
    *   Added **Section 3: 6-Month Rolling Activity Timeline & Pilot Currency Shading**:
        *   Horizontal timeline spanning Columns A through F displaying the last 6 months in ascending order (5 months ago to current month), displaying Month Name (`mmm-yyyy`), Total Flights, Total Airtime Hours, and Total Distance for each month.
        *   Underlying values are pure numbers: Flights (`0 "flts"`), Duration day fractions (`[h]:mm "hrs"`), and Distance (`#,##0 "km"`).
        *   Added dynamic pilot currency conditional formatting: Orange (low), Yellow (moderate), Green (active/current) driven by configurable thresholds in `Parameters` (`TIMELINE_FLIGHTS_LOW: 2 flts`, `TIMELINE_FLIGHTS_MED: 6 flts`, `TIMELINE_HOURS_LOW: 1:00 hrs`, `TIMELINE_HOURS_MED: 4:00 hrs`), where duration thresholds are also pure numeric day fractions formatted as `[h]:mm "hrs"`.
    *   Added **Section 4: 4 x 2 Leaderboard Grid (8 Cards)**: Symmetrical cards across Columns A:C and D:F:
        *   Row 1: Top 5 by Duration (`[h]:mm hrs`) & Top 5 by Distance (`0.0 km`)
        *   Row 2: Top 5 by Max Altitude (`#,##0 m`) & Top 5 by Altitude Gain (`#,##0 m`)
        *   Row 3: Top 5 Thermal Flights (`Thermal% * Duration`, formatted as `Flight X - [h]:mm hrs (Pct%, Summary)`) & Top 5 Soaring Flights (`Soar% * Duration`)
        *   Row 4: Top 5 by XC Score (`0.0 pts`) & Top 5 by Max Groundspeed (`0.0 km/h`).
    *   Added **Section 5: Complete Unique Lists**: Pre-scaffolded 20 rows each for Launch Sites (Cols `A:C`, Col AL) and Countries Flown (Cols `D:F`, Col AN) ordered by flight count descending, eliminating array expansion `#REF!` errors across merged cells.
    *   Resolved raw decimal duration numbers by formatting durations cleanly as `[h]:mm hrs`.
    *   Replaced vulnerable direct range formula references with string-literal `INDIRECT("Flights!..." & startRow & ":...")` formulas.
*   `[Imp]` **CR-UI-017 (Frozen Columns on Flights Sheet & Category Unmerge)**:
    *   Configured `frozenCols: 4` in `Code/Config.gs` (`TABS.FLIGHTS.frozenCols`), `scaffoldFlights_`, and `reapplyFormatting_`, locking Columns A through D (`FlightID`, `Status`, `Flight No`, `Auto Summary`) during horizontal scrolling.
    *   Resolved Google Sheets freeze boundary conflict ("You can't freeze cells across a merged cell") by unmerging Row 3 for the first 4 columns (`A3:D3` unmerged individual cells inside the frozen pane) and re-merging Columns E to N (`E3:N3`, length 10) as the `'Flight Info'` category header. Executed `breakApart()` on Row 3 prior to re-scaffolding to cleanly disband legacy merges.
*   `[Fix]` **Bug-UI-006 (Dynamic Dropdown Validation for Flight Type and XC Flight Class)**:
    *   Bound `Flight Type` data validation dynamically to `Lookups!G3:G` and `XC Flight Class` to `Lookups!H3:H` in `applyFlightsValidation_` (`Code/Scaffold.gs`).
    *   Reordered `scaffoldAll_` in `Code/Scaffold.gs` so `scaffoldLookups_` runs prior to `scaffoldFlights_`, ensuring lookup lists exist before validation rules are constructed.
    *   Directly seeded default flight types in `scaffoldLookups_`.
*   `[Fix]` **Bug-UI-007 (Closed? Column Validation Mismatch)**:
    *   Replaced checkbox data validation on the `Closed?` column with list validation `['Yes', 'No']` in `applyFlightsValidation_` (`Code/Scaffold.gs`).
    *   Updated `uiAddManualFlight_()` in `Code/Ingestion.gs` to default `Closed?: 'No'` instead of inserting a checkbox.
*   `[Fix]` **Bug-UI-005 (Manual Flight Status Validation Mismatch)**:
    *   Fixed `uiAddManualFlight_()` in `Code/Ingestion.gs` to set initial Status to `'Review?'` instead of `"Needs Review"`, aligning with dropdown validation rules and ingestion defaults.
*   `[Imp]` **CR-SCH-001 (Schema & Parameter Streamlining)**:
    *   Eliminated redundant `Launch-Landing Dist (km)` from the Landing group in `Code/Config.gs` and `Code/Ingestion.gs` (duplicate of `Straight Dist (km)`).
    *   Eliminated unused gear baseline snapshot columns `GlideRatio_LD (snap)`, `Trim_kmh (snap)`, and `FullBar_kmh (snap)` from the Gear group in `Code/Config.gs`, `Code/Ingestion.gs`, and `Code/Scaffold.gs`.
    *   Eliminated redundant `FLIGHT_TYPES` from `CFG.parameters` in `Code/Config.gs` and `Code/Code.gs` (flight types are configured directly on the `Lookups` tab).
    *   Removed yellow input shading from internal XContest match tolerances `XCONTEST_MATCH_DURATION_TOLERANCE_MIN` and `XCONTEST_MATCH_START_TIME_TOLERANCE_MIN` in `Code/Config.gs`.
*   `[Imp]` **CR-SYS-003 (Admin Menu Functional Grouping & Flights Sheet 2,000-Row Capacity Auto-Buffer)**:
    *   Reorganized the flat 13-item Admin menu into 5 structured functional submenus: *Sheet Maintenance & Views*, *Folder Configuration*, *Data Backup*, *Automation & Services*, and *System Setup & Reset (Danger Zone)* with clear, descriptive action names.
    *   Pre-scaffolds the `Flights` sheet to 2,000 rows with 69 columns using `ensureDimensions_(sh, 2000, flatHeaders.length)` during setup and formatting reapplying.
    *   Added `ensureFlightCapacity_(sh, 50)` to automatically append 200 rows whenever remaining sheet capacity drops below 50 rows, supporting indefinite flight expansion (1,500+ flights).
    *   Updated `applyFlightsValidation_` to dynamically compute `endRow = Math.max(sh.getLastRow() + 50, 100)` so all existing flights and upcoming buffer rows receive dropdown validations and conditional formatting.
*   `[Imp]` **CR-ING-005 (Automated Multi-Level Chronological Sorting Post-Ingestion)**:
    *   Enhanced `sortFlightsByDate_()` to execute multi-level sorting: primary by `Date` descending, secondary by `Launch Time` descending, ensuring multiple flights on the same day are correctly sequenced from latest to earliest.
    *   Provided public wrapper `sortFlightsByDate()` in `Code/Code.gs` callable via client-side `google.script.run`.
    *   Wired automated post-ingestion sorting upon completion in `URLDialog.html`, `UploadDialog.html`, and `FileHandling.gs` (`scanWatchFolderNow_`), guaranteeing the logbook is immediately restored to reverse-chronological order with sequential flight numbers.
*   `[Fix]` **Bug-SYS-007 (Out-of-Bounds Range Dimensions Exception During Scaffolding)**:
    *   Resolved runtime error (`Exception: The coordinates of the range are outside the dimensions of the sheet.`) when scaffolding or reapplying formatting on sheets with fewer rows or columns than target ranges.
    *   Implemented defensive helper `ensureDimensions_(sh, minRows, minCols)` in `Code/Scaffold.gs` and integrated across all 8 sheets (`Dashboard`, `Parameters`, `Lookups`, `Pilot_Profile`, `User Guide`, `Equipment`, `Flights`, `App_Log`).
*   `[Fix]` **Code Cleanup & Namespace Consistency (Code Check Remediation)**:
    *   Fixed client-side private function call in `FlightMaintenanceDialog.html` by routing to public wrapper `sortFlightsByDate()`.
    *   Eliminated dead legacy function `haversineScore_` in `Code/Scoring.gs` and redundant wrapper `haversineGeo_` in `Code/Geo.gs`.
    *   Removed orphaned namespace assignments `PARSER.haversine_` and `PARSER.bearing_` from `Code/Parser.gs`.
    *   Standardized `Ingestion.gs` to invoke `PARSER.parseIgc(...)`.
*   `[Test]` **Automated Testing**:
    *   Added `testDashboardAndSchema_()` in `Code/Test.gs` verifying frozen column settings, eliminated column removals, Lookups range validations, and live Dashboard `INDIRECT` formula evaluation.

---

## Session: XContest Verification, Identifier Linking & Claim Deadline
**Date**: 2026-09-30
**Versions**: v0.8.11
**Focus**: XContest Verification & Identifier Linking (`Bug-SCR-002`).

*   `[Fix]` **Bug-SCR-002 (XContest Direct Flight Probing, ID Linking & Claim Status)**:
    *   Replaced deprecated pilot profile table scraping with **Direct Flight Probing** in `Code/XContest.gs` (`XContest.checkFlight`), bypassing XContest's client-side JavaScript rendering and Cloudflare Turnstile token protection.
    *   Accurately evaluates candidate launch times in UTC (+/- 2 minutes tolerance), fixing the 7-hour timezone offset previously passed from local launch time.
    *   Extracts XContest's permanent internal database flight ID (`fl=...`) from `<meta property="og:image">` to create a visual and functional hyperlink in the `XContest` column (e.g. `=HYPERLINK(url, "XC#6952654")`), falling back to date/time `XC-YYYYMMDD-HHMM` if the internal ID is absent.
    *   Evaluates unmatched flights against XContest Rule 3.1 (14-day competition claiming deadline), marking `'Claim soon!'` for flights within 14 days and `'Expired'` for flights older than 14 days.
    *   Integrated into `Code/Ingestion.gs` and `Code/Code.gs` (`executeFlightMaintenanceRow`).
    *   Added `XCONTEST_FLIGHT_URL_PATTERN` and `'XContest'` column tooltip to `Code/Config.gs`.
    *   Added UTC midnight protection in `Code/XContest.gs` and `Code/Code.gs` to prevent Western hemisphere timezones (UTC-6/7) from rolling back `YYYY-MM-DD` dates to the previous day when converting from `Date` objects.
    *   Added explicit audit logging in `Code/Ingestion.gs` (`XC: Skipped (No XCONTEST_USERNAME in Parameters)`) to notify pilots when XContest verification is skipped due to a blank username in `Parameters`.
    *   Updated unit tests in `Code/Test.gs` with live matching (both string and Date inputs) and 14-day status validation.
*   `[Imp]` **RQ-SYS-006.1 (In-App User Guide Tab Alignment & Refresh Action)**:
    *   Updated `scaffoldUserGuide_` in `Code/Scaffold.gs` to ensure automatic creation of the `User Guide` tab if deleted, added `XCONTEST_USERNAME` configuration to Section 2, updated maintenance descriptions for XContest Direct Flight Probing in Section 4, and documented the `XContest` column and claim windows in the Comprehensive Metric Dictionary in Section 5.
    *   Added `Admin: Refresh User Guide Tab` (`uiRefreshUserGuide_`) to the `Flight Log > Admin` menu in `Code/Code.gs` and hooked automatic guide updates into `updateValidationOnly_()`.

---

## Session: Flight Maintenance Scope & Empty Row Detection
**Date**: 2026-09-30
**Versions**: v0.8.10
**Focus**: Flight Maintenance Scope & Empty Row Detection (`Bug-SYS-005`).

*   `[Fix]` **Bug-SYS-005 (Flight Maintenance Scope & Empty Row Detection)**:
    *   Implemented `getActualFlightRows_(sh)` in `Code/Code.gs`: inspects `FlightID` column from row 5 down using `getDisplayValues()`, returning an array of `{ row, id }` strictly for populated flights.
    *   Replaced `lastRow - 4` calculations in `getMaintenanceScopeInfo()` and `getMaintenanceTargetRows()` with `getActualFlightRows_()`, eliminating phantom flights caused by Google Sheets' `getLastRow()` returning row 24 due to scaffolded dropdown validations.
    *   Bounded sorting in `sortFlightsByDate_()` to actual flight rows (`minRow` to `maxRow`), preventing blank formatted rows from being sorted or assigned sequential flight numbers.
    *   Updated `FlightMaintenanceDialog.html`: displays `0 flights` with warning badge when the log is empty, dynamically disables the "Run Maintenance" button when no valid flights exist in the chosen scope, and updates status labels on selection change.
    *   Added automated test `testMaintenanceFlightFilter_()` in `Code/Test.gs`.

---

## Session: Parameter Date/Time Format Dropdowns & Plain Text Preservation
**Date**: 2026-09-30
**Versions**: v0.8.9
**Focus**: Parameter Date/Time Format Validation (`Bug-UI-003`).

*   `[Fix]` **Bug-UI-003 (Parameter Date/Time Format Dropdowns)**:
    *   Sized validation ranges dynamically to exact populated entries in `Lookups`: `I3:I7` for `DATE_FORMAT` and `J3:J4` for `TIME_FORMAT`, completely removing trailing empty dropdown options.
    *   Set explicit Plain Text number format (`@`) on format cells in `Parameters` and `Lookups` (`scaffoldParameters_` and `scaffoldLookups_`).
    *   Protected `getParameters_()` in `Code/Code.gs` from coercing `DATE_FORMAT` or `TIME_FORMAT` into `Date` objects or numbers.
    *   Sanitized existing values during parameter re-scaffolding against corrupted date/number inputs.
    *   Added automated test `testDateTimeFormats_` in `Code/Test.gs`.

---

## Session: Pre-Flight Folder Validation, Parameter Authority & Ingestion Cleanup
**Date**: 2026-09-30
**Versions**: v0.8.8
**Focus**: Pre-flight Folder Validation & Source Deletion Behavior (`Bug-ING-004`).

*   `[Fix]` **Bug-ING-004 (Strict Folder Validation & Parameter Authority)**:
    *   Implemented `validateRequiredFolders_(requiredKeys, config)` in `Code/FileHandling.gs`: enforces that required Drive folders (`MASTER_LOG_FOLDER_ID`, `ERROR_FOLDER_ID`, `UPLOAD_FOLDER_ID`, and optionally `WATCH_FOLDER_ID`) exist and are accessible before ingestion starts.
    *   Completely eliminated `getOrCreateFolder_` and any auto-creation of folders in Google Drive root (`DriveApp.createFolder()`). Missing folders immediately halt ingestion with descriptive user alerts prompting configuration in `Parameters` / `Flight Log > Admin > Update [Folder]...`.
    *   Integrated pre-flight checks into `stageUrlOrDriveImport`, `stageUpload`, `scanWatchFolderNow_`, and `getWatchFolderStatus`.
    *   Enforced exact `URL_CUSTOM` cleanup behavior:
        *   When "Delete from source" is unchecked: copies successful files to `MASTER_LOG_FOLDER_ID` and failed files to `ERROR_FOLDER_ID`; leaves Google Drive source files completely intact.
        *   When "Delete from source" is checked: copies files to master/error folders and trashes source files (`file.setTrashed(true)`).
        *   Staged temporary files from web URLs or unzipped packages (`isDriveSource === false`) are always cleaned up from `UPLOAD_FOLDER_ID`.
    *   Sanitized Google Drive folder IDs and URLs across all parameters via `cleanDriveId_` in `Code/Utils.gs`.
    *   Added automated test `testValidateRequiredFolders_` in `Code/Test.gs`.

---

## Session: Admin Backup Data Enhancement
**Date**: 2026-09-30
**Versions**: v0.8.7
**Focus**: Admin Backup Data tab coverage (`CR-ADM-002`).

*   `[Imp]` **CR-ADM-002 (Admin Backup Data Coverage)**:
    *   Enhanced `backupSystemSheets_` in `Code/Scaffold.gs` to back up all 5 core user data sheets: `Flights`, `Pilot_Profile`, `Equipment`, `Parameters`, and `Lookups` (previously omitted `Lookups`).
    *   Updated backup routine to dynamically iterate over target sheets and report all backed-up sheets in the UI toast notification.

---

## Session: Historical Weather, Unified Maintenance, In-App User Guide, Pilot Profile & Dynamic Dashboard
**Date**: 2026-09-30
**Versions**: v0.8.6
**Focus**: Automated Weather Enrichment (`RQ-SCR-004`), Unified Flight Maintenance Dialog (`RQ-SYS-007`), In-App User Guide & Metric Dictionary (`RQ-SYS-006.1`), Pilot Profile Tab (`RQ-SYS-009.1`), Dynamic Dashboard Formulas (`CR-SYS-001`).

*   `[Imp]` **RQ-SCR-004 (Historical Weather Enrichment)**:
    *   Created `Code/Weather.gs` implementing `WEATHER.getEnrichment(...)` with Open-Meteo as primary (using recent 7-day forecast API fallback for flights <= 5 days old, and archive API for older flights) and Visual Crossing Timeline API as backup.
    *   Added parameters `WEATHER_PROVIDERS` (`'open_meteo, visual_crossing'`) and `VISUAL_CROSSING_API_KEY` (optional) to `Config.gs`.
    *   Prepopulates editable weather columns: `Wind@Launch`, `Wind@Landing`, `Cloud %`, `Cloudbase`, `Temp (C)`, `Observations`.
    *   Formatted wind with 16-point cardinal compass directions and significant gusts (Option A: e.g. `14 km/h WNW (gust 20)`).
    *   Calculated convective cloudbase using the Lawrence spread formula $(T - T_d) \times 125\text{ m}$ formatted as MSL & AGL (Option A: e.g. `2400m MSL (1200m AGL)`).
    *   Integrated into `Code/Ingestion.gs` for automatic population on import and unit tests in `Code/Test.gs`.
*   `[Imp]` **RQ-SYS-007 (Unified Flight Maintenance Dialog)**:
    *   Built `Code/FlightMaintenanceDialog.html` allowing pilots to select scope (Selected rows vs. All flights) and toggle batch operations: Weather Backfill, Geo/Site Backfill, XContest Re-verification, Physics & Flight Mode Recompute, XC Score Recalculation, and Date Sorting.
    *   Implemented backend batch runner in `Code/Code.gs` (`getMaintenanceScopeInfo`, `getMaintenanceTargetRows`, `executeFlightMaintenanceRow`) with client-side stepping to prevent Apps Script timeouts and provide real-time progress.
    *   Implemented full date sorting in `Code/Code.gs:sortFlightsByDate_` which sorts rows descending by Date and re-indexes sequential `Flight No` formulas.
    *   Restructured `Flight maintenance` menu in `Code/Code.gs` with direct dialog launcher and quick sort shortcut.
*   `[Imp]` **RQ-SYS-006.1 (In-App User Guide & Metric Dictionary)**:
    *   Implemented `scaffoldUserGuide_` in `Code/Scaffold.gs` registering `TABS.USER_GUIDE` (Sheet: `User Guide`, color: `#455A64`).
    *   Structured reference sections: System Architecture, Initial Configuration & Folders, Day-to-Day Flight Logging Workflows, Flight Maintenance & Troubleshooting.
    *   Built Comprehensive Metric Dictionary detailing every column across Flight Info, Gear, XC Scoring, Analytics, Launch/Landing, Weather, and Validation.
*   `[Imp]` **RQ-SYS-009.1 (Pilot Profile Tab)**:
    *   Implemented `scaffoldPilotProfile_` in `Code/Scaffold.gs` registering `TABS.PILOT_PROFILE` (Sheet: `Pilot_Profile`, color: `#00695C`).
    *   Structured sections for Personal Identity, Licensing & Certifications, Flying Clubs & Federations, Emergency Contacts & SAR Evacuation Insurance, Live Satellite Tracking (Garmin inReach IMEI, MapShare URL, Flymaster Live), and Season Progression Notes.
*   `[Imp]` **CR-SYS-001 (Dynamic Dashboard Formulas)**:
    *   Updated `scaffoldDashboard_` in `Code/Scaffold.gs` to replace static dummy values with live Google Sheets formulas.
    *   KPI cards calculate Total Flights, Total Airtime Hours (`h:mm` sum), Total Distance (km), and Flights This Year.
    *   Dynamic QUERY formulas generate Top 5 Flights by Duration, Top 5 Flights by Distance, Recent Activity, and Countries Flown.
*   `[Imp]` **Sheet Ordering & Backup (`scaffoldAll_`)**:
    *   Configured 8-tab clean ordering: `Dashboard`, `Flights`, `Pilot_Profile`, `Equipment`, `User Guide`, `Parameters`, `Lookups`, `App_Log`.
    *   Updated `backupSystemSheets_` and `deleteSystemSheets_` to handle `Pilot_Profile` and `User Guide`.
*   `[Docs]`: Aligned `Setup_Guide.md`, `Features.md`, `Technical_Specification.md`, and `Backlog.md`.

## Session: Documentation Check, Backlog Architecture & Doc Synchronization
**Date**: 2026-09-29
**Versions**: v0.8.5
**Focus**: Doc Check Workflow Creation, Systematic Documentation Audit, Backlog Expansion (User Guide, Flight Maintenance, Setup Wizard, Pilot Profile, Historical Weather), Repository Alignment.

*   `[Workflow]` **Doc Check Workflow**: Created `.agent/workflows/doc_check.md` defining a repeatable 4-dimensional audit protocol (Code-to-Doc Drift, Cross-Doc Consistency, Backlog Traceability, Stale References/Dead Links).
*   `[Requirements]` **New Requirements Captured**:
    *   `RQ-SYS-006`: In-App User Guide tab (`scaffoldUserGuide_`) and external distribution documentation covering Overview, Setup, Maintenance, Normal Usage, and Metric Dictionary.
    *   `RQ-SYS-007`: Unified Flight Maintenance dialog supporting batch operations across user-selected flights (Recompute metrics, sort by date, backfill missing data, weather backfill, XContest verification, Geo backfill).
    *   `RQ-SYS-008`: Pre-bound Google Sheet template copy model and interactive First-Time Setup Wizard.
    *   `RQ-SYS-009`: Pilot Profile tab (`scaffoldPilotProfile_`) capturing credentials, club memberships, emergency info, Garmin inReach links, and insurance.
    *   `RQ-SCR-004`: Historical weather backfill via Open-Meteo Archive API based on flight date, time, and coordinates.
*   `[Docs]` **Repository-Wide Remediation & Alignment**:
    *   `Docs/Backlog.md`: Marked `RQ-SCR-003` (XContest Verification) as `[x] Implemented | Phase: 1` and closed completed refactoring ToDos.
    *   `Docs/Context.md`: Fixed directory typos, cataloged `DocCheckReports/` in structure and Ways of Working, broadened `Code/` file scope, and removed obsolete legacy `v0.7.11` footer.
    *   `Docs/Technical_Specification.md`: Added function and schema reference for `Config.gs`, `XContest.gs`, and all 6 HTML dialog templates (`FolderPickerDialog.html`, `URLDialog.html`, `UploadDialog.html`, `ScanDialog.html`, `Inspector.html`, `Style.html`) to Section 7.
    *   `Docs/Setup_Guide.md`: Replaced deprecated tab names (`Equipment_Wings`/`Lookups`) with active sheets (`Dashboard`, `Flights`, `Parameters`, `Equipment`, `Lookups`, `App_Log`), updated menu paths, and refreshed parameter settings.
    *   `Docs/Workflows/Multi_Device_Setup.md`: Corrected Git push branch reference from `main` to `master`.

## Session: Code Check & Architectural Modularization
**Date**: 2026-09-29
**Versions**: v0.8.4
**Focus**: Code Check Audit, Architectural Refactoring, Module Separation, Math Consolidation.

*   `[Refactor]` **FileHandling.gs Extraction**: Separated all Google Drive I/O, watch folder scanning (`scanWatchFolderNow_`, `getWatchFolderStatus`), staged uploads (`stageUpload`), file processing (`processFileById`), URL/Drive staging (`stageUrlOrDriveImport`), source trashing (`trashSourceFiles`), and Master Log copying (`copyToMasterLog_`) from `Ingestion.gs` into dedicated `FileHandling.gs`. Reduced `Ingestion.gs` to ~540 lines focused purely on flight parsing, deduplication, scoring orchestration, and row mapping.
*   `[Refactor]` **Utils.gs Math Consolidation**: Created `Utils.gs` providing shared geospatial math (`haversine_`, `bearing_`, `angleDiff_`) and time/duration formatting (`friendlyDuration_`, `formatTime_`) exported to `UTILS` namespace and backward-compatible global helpers.
*   `[Refactor]` **Parser / Geo / Scoring / Analysis Alignment**: Converted `Parser.gs`, `Geo.gs`, and `Scoring.gs` duplicate haversine/bearing implementations into delegations to `Utils.gs`. Replaced manual bearing modulo math in `Analysis.gs` with `angleDiff_`.
*   `[Fixed]` **Trigger Execution**: Created public wrapper `scanWatchFolderTrigger` in `Code.gs` for time-driven triggers to prevent private function dispatch failure.
*   `[Fixed]` **XContest Time Rollover**: Improved fallback start-time calculation in `XContest.gs` to account for 24-hour UTC/local boundary differences (`diffMins = 1440 - diffMins`).
*   `[Clean]` **Dead Code & Duplicates**: Removed duplicate `isHashSeen_` / `markHashSeen_` definitions and ~200 lines of deprecated legacy helpers from `Ingestion.gs`.
*   `[Docs]`: Updated `Technical_Specification.md` with new `FileHandling.gs` and `Utils.gs` code organization and component reference.

## Session: In-App Folder Picker, Recursive Scanning & Master Log Hyperlinks
**Date**: 2026-09-29
**Versions**: v0.8.3
**Focus**: In-App Folder Picker, Multi-Folder Watch, Recursive Traversal, Master Log Link (Cell A2), Flight No Download Hyperlink.

*   `[Imp]` **CR-UI-014**: Built native In-App Google Drive Folder Picker (`FolderPickerDialog.html` - Option B) supporting My Drive navigation, breadcrumb exploration, ID/URL verification, and Replace vs. Append ("Add to List") actions for watch folders.
*   `[Imp]` **CR-CFG-004**: Multi-Folder Watch scanning supporting comma-separated `WATCH_FOLDER_ID`s in configuration and UI.
*   `[Imp]` **CR-ING-004**: Recursive file scanning (`getFilesRecursive_` up to 10 levels deep) and automated cleanup across watch and manual import folders. Valid IGCs copied to Master Folder; errored files moved to `ERROR_FOLDER_ID`; source files trashed after successful mirror.
*   `[Imp]` **CR-UI-015**: 
    *   Placed dynamic `=HYPERLINK(...)` to Master Flight Log folder directly in **Cell A2** of the `Flights` tab, and Row 2 of the `Dashboard` tab.
    *   Wrapped `Flight No` numbering formula with direct download `=HYPERLINK(dlUrl, IFERROR(MAX(...), 0) + 1)` using `masterFileId`.
    *   Added column header tooltips/notes on Row 4 for `FlightID` and `Flight No` configured via `colNotes` in `Config.gs`.
*   `[Imp]` **CR-UI-014 (Highlighting)**: Enhanced folder picker lists (`FolderPickerDialog.html` & `URLDialog.html`) with bold blue selection highlight styling and a `✓ Selected` badge indicator upon click or verification.
*   `[Imp]` **CR-UI-016**: Enhanced "Add files from URL (folder, igc, zip)" dialog (`URLDialog.html`) to support Option A (paste URL, Drive File ID, or Drive Folder ID) and Option B (browse Google Drive subfolders), with optional "Delete from source" checkbox (default unchecked) and sequential progress logging.
*   `[Fixed]` **Folder Picker RPC**: Removed trailing underscores from backend functions (`getDriveFolderContents`, `resolveFolderInput`, `saveFolderParam`) which caused Google Apps Script to block calls from `google.script.run`. Made URL regex extraction resilient to query params and improved parent path traversal.
*   `[Docs]`: Aligned `Features.md`, `Technical_Specification.md`, and `Backlog.md`.

## Session: Paragliding Earth Site Integration
**Date**: 2026-09-29
**Versions**: v0.8.2
**Focus**: Paragliding Earth API Integration, Fallback Chain, Site Detection.

*   `[Imp]` **CR-GEO-001**: Added `paragliding_earth` as primary site lookup provider with `overpass_api` as fallback.
*   `[Fixed]` **Bug-GEO-002**: Resolved missing site names caused by Overpass rate limits and timeouts.
*   `[New]` **Config**: Updated default `GEO_SITE_PROVIDERS` to `'paragliding_earth, overpass_api'`.
*   `[Docs]`: Aligned `Features.md`, `Technical_Specification.md`, and `Backlog.md`.

## Session: XContest & Code Stability
**Date**: 2026-02-13
**Versions**: v0.8.0 - v0.8.1
**Focus**: XContest Integration, Clasp Deployment Fixes, Code Quality.

*   `[Imp]` **RQ-SCR-003**: XContest Verification (Match Date + Duration w/ Tolerance).
*   `[New]` **Config**: Added `[Integrations]` section for XContest/SeeYou parameters.
*   `[Fixed]` **Deployment**: Resolved `clasp push` issues (PATH environment).
*   `[Fixed]` **Bug-UI-004**: Fixed Flight Inspector Sidebar `TypeError`.
*   `[Fixed]` **Logging**: Renamed `App_Log` column "Notes" -> "Info" and implemented append-only logging for duplicate detections (e.g. "XC: No Match").
*   `[Refactor]`: Removed duplicate Admin menu items.
*   `[Docs]`: Added `Code Check` workflow and aligned `Backlog.md`.
*   `[ToDo]`: Added high-priority ToDo for "Ways of Working" (Artifact Storage).

## Session: Flight Inspector & Refinements
**Date**: 2026-02-12
**Versions**: v0.7.12 - v0.8.0
**Focus**: Flight Inspector (Sidebar), Config Refinements, SeeYou Cloud.

*   `[Imp]` **RQ-SYS-004**: Flight Inspector Sidebar (View/Edit flight details, Collapsible sections).
*   `[Imp]` **RQ-SYS-003**: SeeYou Cloud Link Integration (Auto-generated links).
*   `[Imp]` **RQ-ING-003**: Master Log Folder (Auto-copy valid IGCs).
*   `[Imp]` **Config**: Config-driven Sidebar sections and editable fields.
*   `[Imp]` **Docs**: Timestamp rule added to Context.md.
*   `[Refactor]`: Removed duplicate headers/JSDoc in `Code.gs` and `Ingestion.gs`.
*   `[Imp]` **Menu**: Moved "Flight Inspector" to top.
*   `[Imp]` **UI**: Left-aligned Sidebar headers; "Duplicate" status is now Orange.
*   `[Fixed]` **Formatting**: Time Format (`h:mm a`) now correctly applied to Ingestion.
*   `[Imp]` **Unified Dialogs**: Consistent UI with progress bars for Watch Folder, Uploads, and URL imports.
    *   **Scan Watch Folder**: New dialog shows file count before processing and updates progress in real-time.
    *   **Uploads**: Client-side loop ensures granular progress updates for multiple files.
*   `[New]` **Ingestion Logic**:
    *   **Distinct Counters**: UI now separates "Files Processed" from "Flights Created" (e.g. 1 ZIP = 3 Flights).
    *   **Cleanup**: Configurable "Move from Watch" option; automatic cleanup of Uploads; robust Error Folder handling.
    *   **Config**: Added `ERROR_FOLDER_ID` and `MOVE_FROM_WATCH_FOLDER`.
*   `[Imp]` **Granular Progress**:
    *   **Uploads**: Implemented "Stage & Explode" strategy. ZIPs are now unzipped first, then flights are processed individually for smooth progress bars.
    *   **Watch Folder**: Scan now peeks inside ZIPs to estimate total flight count.
*   `[New]` **UI Overhaul**:
    *   **Consistent Layout**: All dialogs feature a small "Flight Import" title, large color-coded Header (Blue/Green/Amber), Scrollable Log, and Fixed Footer.
    *   **Footer Stats**: Status line shows "Files | Flights | % | Current File" with a full-width progress bar.
*   `[Fixed]` **ZIP Handling**:
    *   **No Duplicate ZIPs**: Fixed a bug where ZIP files were incorrectly copied to the Master Log. Now only the *extracted* IGC files are saved.
    *   **Granular Errors**: If a ZIP contains mixed results (e.g., 2 valid, 1 invalid), valid IGCs go to Master, and the invalid IGC (and only that one) is saved to the Error Folder.
*   `[New]` **Strict UI Consistency**:
    *   **Standardization**: Renamed `Picker` to `UploadDialog` and `UrlEntry` to `URLDialog`.
    *   **Visuals**: "Flight Import" window title for all. Text-based color headers (Blue/Green/Amber). Uniform Blue buttons and progress bars.
    *   **Workflows**:
        *   **Scan**: Auto-Start on open.
        *   **URL**: 1-Click Import.
        *   **Upload**: 2-Step (Select -> Process).
    *   **Status Format**: Standardized to `X/Y Files | A/B Flights | % | File Name`.
*   `[Fixed]` **Menu Functions**: Resolved "ReferenceError" by connecting menu items to the renamed public dialog functions.
*   `[Fixed]` **Template Rendering**: Switched to `createTemplateFromFile().evaluate()` to correct the issue where raw scriplets (`<?!= ... ?>`) were displayed in dialogs.
*   `[Refined]` **UI Consistency**:
    *   **Layout**: Removed dynamic "Loading" overlay from Scan Dialog for a static, consistent look.
    *   **Buttons**: Unified logic where the Action button becomes the "Done" button on completion.
    *   **Instructions**: Standardized instruction text styling across all dialogs.
*   `[Refactored]` **Strict Status Line**:
    *   **Format**: Enforced `X/Y Files | A/B Flights | % | Filename` across all dialogs.
    *   **URL Import**: Converted to a 2-stage process (Stage -> Process) to enable accurate "Total Flights" counting before processing begins.
    *   **Alignment**: All dialog buttons are now Left-Aligned.
*   `[Refactored]` **UI Polish**:
    *   **Scan Dialog**: Added Watch Folder "Friendly Name" to the log output.
    *   **Activity Logs**: Prefix all log entries with the filename (e.g., `flight.igc: Imported`).
    *   **Button Flow**: Implemented "Cancel -> Done" flow. During processing, inputs and start buttons are hidden; only a "Cancel" button is visible.
    *   **URL Fix**: Resolved issue where URL import button appeared to hang by improving response handling.
    *   **Cleanup**: Enforced strict cleanup for Upload/URL imports (temp files always deleted).
    *   **Styling**: Fixed "Done" button color (restored Blue `.action` style).
    *   **URL Logs**: Refined URL import logs to be more concise ("URL: ..." -> "Found ...").

## Session: Structure & Planning
**Date**: 2026-02-10
**Versions**: v0.7.11 - v0.7.12
**Focus**: Project Reorg (`Docs/` vs `Plans/`), Workflows, Backlog.

*   `[Refactor]` **Structure**: Separated Persistent Docs from Transient Plans.
*   `[Imp]` **Workflows**: Standardized `sync_project`, `summarize_session`, `code_check`.
*   `[Fixed]` **Bug-SCF-004**: Fixed `App_Log` scaffolding color/name.
*   `[Added]` **Backlog**: Master Log, SeeYou Cloud, Manual Form, Quick Actions.
*   `[Docs]` **Refactor**: Split `Features.md` into modules; Merged `Functions.md` to `Technical_Specification.md`.

## Session: Watch Folder & Logging Reliability
**Date**: 2026-02-09
**Versions**: v0.7.8 - v0.7.11
**Focus**: Critical Bug Fixes (Watch Folder, Config) and Data Quality.

*   `[Fixed]` **Bug-ING-003**: Updated `insertFlightRow_` to capture System Notes (Geo Errors, Validation) in `Notes` column.
*   `[Fixed]` **Bug-CFG-002**: Fixed boolean coercion bug in `getParameters_` that broke "Enable Watch Folder".
*   `[Fixed]` **Bug-ING-002**: Fixed silent crash in Watch Folder (missing `isHashSeen_`).
*   `[Imp]` **CR-LOG-002**: Cleaned up notes logic.
*   `[Imp]` **UI**: Removed redundant "Scanning..." toast; added "Flights Created" count to alert.
*   `[Imp]` **Config**: Parameter migration map added to `Scaffold.gs` for legacy friendly names.

## Session: Upload & Validation Hardening
**Date**: 2026-02-09
**Versions**: v0.7.3 - v0.7.5
**Focus**: File Uploads, URL Import, and Geo Validation.

*   `[Fixed]` **Bug-UPL-001**: Replaced form submission with Client-Side `FileReader` (Base64) for robust Multi-File upload.
*   `[Imp]` **CR-ING-002**: "Add Flight from Upload" menu.
*   `[Imp]` **CR-ING-001**: Landing Time Fallback calculation.
*   `[Fixed]` **URL Import**: Fixed infinite loop in URL dialog.
*   `[Fixed]` **Geo**: Switched default provider to `big_data_cloud` to fix "Address Unavailable".

## Session: Admin Tools & Refactoring
**Date**: 2026-02-08 - 2026-02-09
**Versions**: v0.7.0 - v0.7.2
**Focus**: Admin Menu, SCoring Regression, and Automation.

*   `[Fixed]` **Bug-SCR-001**: Fixed XC Scoring regression (missing points).
*   `[Imp]` **Workflows**: Added automated workflows for Code Check, Sync.
*   `[Added]` **Admin Menu**: Backup, Reformat, Reset System Sheets.
*   `[Refactor]`: Centralized `Config.gs` and `Scaffold.gs`.

## Session: Core UI & Scaffolding
**Date**: 2026-02-01 - 2026-02-08
**Versions**: v0.5.0 - v0.6.4
**Focus**: Sheet Structure, Headers, Grouping.

*   `[Imp]` **RQ-SYS-002**: 2-Row Headers, Column Grouping (Flight Info, Gear, Scoring).
*   `[Imp]` **RQ-SYS-001**: `Equipment` sheet lookup integration.
*   `[Fixed]` **Bug-UI-001**:    - Added `XContest` column to Flights sheet.
- **Refactor**: **User Interface & Config** (Feb 13)
    - **Config**: Moved `GDRIVE` pattern to [Integrations]. Added XContest Duration/Time tolerances.
    - **Flights Sheet**: Moved `XContest` column to start of `XC Scoring` group.
    - **UI**: Wider Flight Inspector sidebar (500px) + Text Wrapping.
    - **UI**: Wider URL Import input box.
    - **Menu**: Renamed "Add Flight from IGC" to "Add Flight from URL (IGC / Zip)". Removed explicit Watch Folder menus (now controlled via Parameters dropdown).
    - **Logic**: Implemented configurable tolerances for XContest matching (Duration & Start Time Fallback).
*   `[Fixed]` **Bug-GEO-001**: Time Zone defaults.

## Session: MVP Implementation
**Date**: Pre-Feb 2026
**Versions**: v0.1.0
**Focus**: Initial Module Creation.

*   `[Imp]` **RQ-ING-001**: IGC Parsing (Headers, B-records).
*   `[Imp]` **RQ-SCR-001**: Basic XC Rules.
*   `[Imp]` **RQ-SCR-002**: Basic Geo integration.
