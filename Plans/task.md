# Project Tasks & Status
*This file tracks the active tasks for the Paragliding Flight Log Project.*

## Completed in Latest Session (2026-10-03 Part 2) - Flight Updates Redesign, Batch Flight ID Resync & Audit (v2.2.2)
- [x] **[MNT-006]** Flight Updates Modal Redesign (`CR-MNT-006`): Renamed "Update from Linked IGC" -> "Check and Sync flight data", added nested "Force update from IGC" sub-checkbox with reactive enable/disable, and decoupled standalone "Resync Flight IDs" top-level checkbox.
- [x] **[MNT-007]** Smart Master Folder Relinking & MD5 Hash Comparison: In `executeFlightMaintenanceRow`, unlinked IGC files are re-linked to `MASTER_LOG_FOLDER_ID`. MD5 digest calculation selectively fills only missing telemetry when hashes match, strictly preserving pilot edits. When forced or changed, full telemetry is updated.
- [x] **[MNT-008]** Standalone Batch Resync Flight IDs (`rpcResyncFlightIdsBatch` / `resyncFlightIdsBatch_`): Reads purely from active sheet (zero Drive calls); parses 12h/24h launch times (`parseTimeToMinutes_`); sorts chronologically per date (earliest first, missing launch times at tail end); re-indexes `_01`, `_02`, ...; preserves SeeYou Cloud 3D track hyperlinks; and synchronizes reciprocal duplicate notes.
- [x] **[MNT-009]** Tri-Mode Runner Integration: Wired `finalizeWorkerJob` case `'MAINTENANCE'` to automatically execute post-processing batch Flight ID resync and chronological sorting for Sidebar and Background Queue runs.
- [x] **[DEV-005]** Codebase Restructuring & Modularization Backlog (`CR-DEV-005`): Detailed architectural exploration plan to decompose monolithic source files (`Code.gs`, `Scaffold.gs`, `Ingestion.gs`, `Config.gs`) and establish `clasp`-compatible subfolder hierarchies (`UI/`, `Services/`, `Modules/`, `Config/`).
- [x] **[AUD-004]** Automated Static Analysis & Test Suite (`/code_check`): Verified 168 public / 155 private functions, 92 client RPCs, 30 menu callbacks, 27 manifest components, and 18 offline test suites (`Plans/CodeCheckReports/2026-10-03_CodeCheck.md` - Status: PASS).
- [x] **[AUD-005]** Comprehensive 5-Tier Documentation Audit (`/doc_check`): Synchronized `Docs/Context.md` (v2.2.2, 37 files), `Docs/Technical_Specification.md` (27 components, Module 13 Automation Engine), and `Docs/Features.md` (redesigned Flight Updates capabilities). All 5 tiers 100% in sync (`Plans/DocCheckReports/2026-10-03_DocCheck.md` - Status: PASS).

## Completed Earlier (2026-10-03 Part 1) - Operational Ergonomics, Timezone Parity & Leaderboard Decoupling (v2.2.1)
- [x] **[DSH-003]** Dashboard Leaderboards Decoupling (`CR-DSH-003`): Decoupled all 8 Top-5 leaderboard cards from Auto Summary into standardized `Flight nnn: <metric> (flight date, Site)` format with graceful fallback, conditional integer km, and dual duration/percentage for thermal/soaring flights.
- [x] **[ING-016]** Flight Local Timezone Parity & UTC Date Anchoring (`Bug-ING-011`, `CR-SYS-014`): Resolved -1 day discrepancy under negative UTC offsets and epoch 1970 DST distortion via `computeFlightUtcDates_` and strict launch site local timezone formatting (`geo.tz`). Added `repairFlightDatesAndIds_()`.
- [x] **[UI-022]** Dashboard Leaderboard Date 1899 Serial Epoch Coercion Fix (`Bug-UI-012`): Wrapped date references in `TEXT(colDate, dateFmt)`.
- [x] **[SYS-014]** Platform-Wide Unified Date & Time Architecture (`CR-SYS-014`): Defined two-domain timezone invariants and centralized helpers in `Code/Utils.gs`.

## Completed in Earlier Session (2026-10-02) - Dedupe Engine Overhaul, In-Memory Scoring & Logbook Scanner (v0.8.21)
- [x] **[ING-009]** Dedupe Engine Overhaul & Heuristic Quality Scoring (`CR-ING-009`): in-memory row quality scoring (`scoreFlightQualityFromRow_`) eliminating compounding Drive fetch loop (`Bug-ING-007`).
- [x] **[ING-010]** Timezone-Immune String Extraction (`getDisplayValues()` in `findHeuristicOverlap_` and `getFlightSummariesForOverlap_`), eliminating timezone translation shift and midnight epoch drift (`Bug-ING-008`).
- [x] **[ING-011]** Concise Throwaway Tags & Reciprocal Notes (`D01`, `D02`, ...) with `Others: ...` on Primary and `Primary: ...` on Duplicates; full support for N-way clusters.
- [x] **[ING-012]** Intra-Batch Duplicate Pairing: resolved duplicate clusters within the same 5-file ingestion batch in memory prior to grid insertion (`Bug-ING-009`).
- [x] **[AUT-003]** Automation Queue Checkpoint Progress Preservation: fixed progress reset bug at 4.5m pause boundary by passing accumulated stats and cursor tracking correctly (`Bug-AUT-001`).
- [x] **[ING-013]** Folder Crawl Discovery Metrics: enhanced `getFilesRecursive_` and `stageUrlOrDriveImport` to track `totalScanned`, `subfolders`, `archives`, `unsupported`, writing immediate `[DISCOVERY]` events.
- [x] **[ING-014]** End-of-Run Summary Clarification: formatted comprehensive outcome summaries detailing total processed, added to logbook, duplicates discarded, and errors.
- [x] **[MNT-003]** Logbook Duplicate Scanner: added `Flight Log > Flight maintenance > Scan & Flag Duplicates in Logbook...` (`uiScanAndFlagLogbookDuplicates`, `scanAndFlagLogbookDuplicates_`) to audit and flag existing logbook duplicates without demoting user-validated flights.
- [x] **[CFG-002]** Configurable RDP Simplification Tolerance (`CR-CFG-002`): added `RDP_TOLERANCE` to `Code/Config.gs`, dynamic scoring resolution in `Code/Scoring.gs`, pipeline thread in `Code/Ingestion.gs` and `Code/Code.gs`, updated `SaveConfigDialog.html` badges (50 keys total, 20 scoring).
- [x] **[MNT-004]** Bulk Flight Status Change Utility (`CR-MNT-004`): added `ChangeFlightStatusDialog.html`, `getStatusChangeScopeInfo`, `getStatusChangeTargetRows` with intentional selection safety rule (all unselected = 0 matches) and `(Blank / Empty)` status filter to recover accidentally cleared statuses, Tri-Mode execution (Modal, Sidebar, Background), and batch worker routing in `executeWorkerBatch('STATUS_CHANGE')`.
- [x] **[ING-015]** Dropdown, Validation & Formatting Expansion on Bulk Appended Rows (`Bug-ING-010`): wired `applyFlightsValidation_(sh)` into `sortFlightsByDate_()` and `finalizeBulkImport()`, dynamically expanding validations, cell text wrapping, and top alignment to `sh.getLastRow() + 50`, and made conditional formatting updates idempotent.
- [x] **[DSH-002]** Dashboard Review Status Inclusion Selector (`CR-DSH-002`): added `Include "Review?": [ No ▾ / Yes ▾ ]` selector in Row 2 (cells `A2:B2`) on `Dashboard` tab with default of `No`, dynamically expanding all KPI banners, annual summaries, 6-month timelines, leaderboards, and query lists.
- [x] **[TEST-002]** Offline Unit Test Suite Expansion: added `testDedupeEngineEnhancements_()`, `testStatusChangeUtility_()` with blank status matching, updated scoring tolerance assertions and config grouping tests in `Code/Test.gs` (12/12 tests pass).

## Completed in Recent Sessions (2026-10-02) - Tri-Mode Execution, Dialog Harmonization, Brochure & Audits (v0.8.20)
- [x] **[UI-019]** Tri-Mode Execution Subsystem extension across all batch dialogs (`BulkIngestDialog`, `FlightMaintenanceDialog`, `PurgeDialog`, `ScanDialog`, `ResyncDialog`, `URLDialog`, `UploadDialog`) with `[ Run Here ]`, `[ Run in Sidebar ]`, `[ Run in Background ]`.
- [x] **[UI-020]** Universal Modeless Execution Sidebar (`ExecutionSidebar.html`: 300px width, live progress pills, scrollable activity console, `📋 Copy Log`, grid remains 100% interactive).
- [x] **[AUT-001]** Persistent Cloud Task Queue (`QueueService.gs` operating on `Automation_Queue` tab, zero black-box state, eliminates 9 KB `PropertiesService` limit).
- [x] **[AUT-002]** Bounded 4.5-minute Time Budget Engine (`TimeBudget.gs` enforcing 270s safety threshold, state checkpointing, automatic self-continuation triggers).
- [x] **[UI-021]** Universal Dialog Visual Harmonization (removed duplicate `header-large` title bars, standardized button bar docking above progress footers, PurgeDialog button placement above activity console, standardized `📋 Copy Log` buttons).
- [x] **[PUB-001]** Platform Brochure Overhaul & Professional 5-Page PDF Publication (`External/ParaFlightLog_Brochure_v2.pdf`, `External/ParaFlightMgmt_brochure v1.html`, `Docs/Brochure.md`).
- [x] **[AUD-002]** Comprehensive code review (`/code_check`): verified 114 public / 133 private functions, 72 client RPC endpoints, 26 menu wrappers, and 10 offline unit test suites (`Plans/CodeCheckReports/2026-10-02_CodeCheck.md` - Status: PASS).
- [x] **[AUD-003]** Comprehensive documentation audit and synchronization (`/doc_check`): synchronized 6 core documentation files with active codebase (`Plans/DocCheckReports/2026-10-02_DocCheck.md` - Status: PASS, git commit `9979190`).

## Completed in Recent Sessions (2026-10-01) - Activity Logging System Overhaul (v0.8.19)
- [x] **[LOG-004]** Activity Logging System redesign (`CR-LOG-004` / `DSGN-LOG-001`): renamed `App_Log` -> `Activity Logs` (Dark Red `#D32F2F`) with 4-column schema (`Process`, `Timestamp`, `Activity / Event`, `Additional Info`).
- [x] **[LOG-005]** Centralized logging engine in `Code/Logger.gs` (`LOG.write`, `LOG.writeBatch`, `LOG.createSession`, `LOG.cleanLogs`, `autoCleanLogsIfDue_`).
- [x] **[LOG-006]** Tiered logging verbosity (`Brief`, `Normal`, `Debug`) and conservative dual-threshold pruning (`LOG_ROWS_TO_KEEP: 2000`, `LOG_TIME_TO_KEEP_DAYS: 90`).
- [x] **[LOG-007]** Added `📋 Copy Log` button across modal dialog consoles with clipboard copy handler.

## Completed Earlier (2026-10-01) - Bulk Ingestion, Profile Schema, Config Reorg & Granular Backup (v0.8.18)
- [x] **[ING-008]** High-Speed Bulk Flight Ingestion & Large Scale Ingestion (`CR-ING-008`, `RQ-ING-001.4`, `BulkIngestDialog.html`, `processBulkBatch`, `finalizeBulkImport`).
- [x] **[PRF-001]** Pilot Profile 3-column sub-header overhaul (`CR-SYS-004`: 34 fields, section dividers, 6 "Other Info" fields, 3 emergency contacts, pure key-value sync).
- [x] **[CFG-006]** Config tab parameters and lookups structural reorganization (`[ Format and Units ]`, `CONTACT_EMAIL` in `[ Geo & Time ]`, manual lookups in Cols 5-10, auto queries in Cols 11-14).
- [x] **[CFG-007]** Granular 5-group configuration backup/restore (`SaveConfigDialog.html`, `LoadConfigDialog.html`, pure key-value sync, live count badges, dynamic UI disable).
- [x] **[DEV-002]** Standardized 24 public menu callback wrappers in `Code.gs` eliminating trailing underscores in custom spreadsheet menus.
- [x] **[BUG-005]** Fixed fatal error in batch audit logging (`Bug-ING-005`, `TABS.ACTIVITY` fixed to `TABS.APP_LOG.name` with `try/catch`).
- [x] **[BUG-006]** Enforced `Review?` status dropdown validation in bulk flight ingestion (`Bug-ING-006`).
- [x] **[BUG-009]** Fixed missing Apply button and file chooser overlap in Load Config dialog (`Bug-UI-009`).

## Future / Next Up
- [ ] **CR-UI-020 / RQ-SYS-008**: Guided Multi-Step Task Wizards (Initial Onboarding, Season Rollover, Equipment Migration, API Setup).
- [ ] **RQ-SYS-010**: Distributed Multi-Instance Update & Lifecycle Manager (Push/pull checks, non-destructive schema migrations).
- [ ] **CR-DEV-004**: AI-Driven & Automated End-to-End Testing Harness (Playwright / subagents, synthetic flight suite).
- [ ] **RQ-SYS-011**: Open Source Release Packaging, Governance & Community Strategy.
- [ ] **CR-SEC-001**: Pilot PII Privacy, Sensitive Data Scrubbing & Secrets Guardrail.
