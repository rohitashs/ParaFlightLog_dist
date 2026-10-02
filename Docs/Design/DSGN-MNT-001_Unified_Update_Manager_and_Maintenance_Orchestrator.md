# Design Specification: Unified System Update Manager & Atomic Maintenance Orchestrator

* **Design ID**: `DSGN-MNT-001`
* **Status**: `Draft`
* **Current Revision**: `Rev 1.0`
* **Date Created**: `2026-10-02`
* **Last Updated**: `2026-10-02`
* **Author / Contributors**: `Rohitashwa / Antigravity AI`
* **Parent Design**: `None` (Root Maintenance Architecture)
* **Child Designs**: `None`
* **Umbrella Module / Primary Code**: [`Code/Scaffold.gs`](file:///g:/My%20Drive/~RS2B/~Projects/ParaFlightLogProject/Code/Scaffold.gs), [`Code/SystemUpdateDialog.html`](file:///g:/My%20Drive/~RS2B/~Projects/ParaFlightLogProject/Code/SystemUpdateDialog.html) *(Proposed)*
* **Code Revision Stamp**: `Pending Implementation`
* **Related Requirements / CRs**: `[RQ-SYS-007]`, `[RQ-SYS-010]`, `[CR-SYS-006]`, `[CR-SCH-002]`

---

## 1. Executive Summary & Intent

### Problem Statement
Currently, sheet maintenance and structural updates are dispersed across multiple fragmented menu items under `Flight Log > Admin > Sheet Maintenance & Views`:
* *Re-apply Formatting & Structural Groupings*
* *Refresh User Guide & Metric Dictionary*
* *Re-scaffold Lookups Dynamic Ranges*
* *Ensure Dimensions & Buffers*
* *First Time Setup / Scaffold All*

This scattered design presents serious operational challenges:
1. **Pilot Confusion & Decision Fatigue**: Pilots do not know which menu item to click when an issue arises or when an update is released.
2. **Missing Dependency Order**: Running a downstream maintenance operation (like re-applying validation) before an upstream operation (like refreshing lookups or expanding column dimensions) causes runtime errors or silent incomplete setups.
3. **No Safety Pre-Flight Snapshot**: Running existing formatting routines risk overriding pilot customizations without an automated pre-update backup.
4. **Lack of Controlled Granularity**: Pilots cannot select a partial, non-destructive refresh versus a full structural resync.

### Proposed Solution
This design introduces a **Unified System Update Manager & Atomic Maintenance Orchestrator**:
* **Single Entry Point (`Flight Log > Admin > System Update & Maintenance...`)**: Replaces the cluster of separate maintenance menu items with one unified, interactive modal dialog (`SystemUpdateDialog.html`).
* **Atomic, Tiered Update Architecture**: Modularizes maintenance into 5 distinct, hierarchical execution layers that execute in strictly validated dependency order.
* **Granular Checkbox Orchestration**: Pilots can choose to execute a Full System Update or select specific tiers (e.g. *Only refresh validations and dropdowns*, or *Only re-sync formula dependencies*).
* **Automated Safety Snapshot**: Automatically creates a rollback snapshot of user configurations and layout preferences in Google Drive before applying structural changes.
* **Tri-Mode Execution Integration**: Supports running updates in the modal, modeless Universal Sidebar, or headless Background Queue with real-time log streaming.

---

## 2. Requirements & Scope

### Functional Requirements
* **REQ-1 (Unified Dialog UI)**: Provide a clean, two-stage modal dialog displaying detected system version, active sheet state, and granular update checkboxes organized by functional tier.
* **REQ-2 (Hierarchical Execution Order)**: Guarantee that whenever multiple update operations are selected, the engine executes them in strict hierarchical order:
  * **Tier 1: Grid Dimensions & Tabs** (Structural substrate)
  * **Tier 2: Column Schema & Header Layout** (Columns, Notes, Categories, Collapse Groups)
  * **Tier 3: Data Validations & Dropdown Ranges** (List validations, Lookups queries)
  * **Tier 4: Formula & Dependency Resilience** (Dashboard formulas, Flight No sequence, dynamic column letter re-linking)
  * **Tier 5: Reference Data & Documentation** (Pilot Profile key-value sync, User Guide documentation)
* **REQ-3 (Pre-Update Safety Backup)**: Automatically snapshot the active `Config` tab and `user_layout.json` manifest prior to executing Tier 2 or Tier 4 operations.
* **REQ-4 (Atomic Idempotence)**: Ensure each tier function is strictly idempotent (safe to re-run multiple times without duplicating rules, deleting data, or creating orphaned ranges).
* **REQ-5 (Tri-Mode Execution)**: Support `[ Run Here ]`, `[ Run in Sidebar ]`, and `[ Run in Background ]` with continuous logging to `Activity Logs`.

### Non-Goals (Out of Scope)
* **NON-GOAL-1**: Overwriting or resetting flight rows (Rows 5:N on `Flights`). Data rows are strictly read-only during system updates; only structural formatting, headers, validations, and formula links are touched.
* **NON-GOAL-2**: Automatic silent background upgrades without user initiation. The user explicitly triggers and approves the update.

---

## 3. Architecture & Detailed Design

### 3.1 Five-Tier Hierarchical Update Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│              TIER 5: REFERENCE DATA & DOCUMENTATION             │
│   • Pilot Profile Field Sync   • User Guide & Metric Dictionary │
└────────────────────────────────┬────────────────────────────────┘
                                 ▲
┌────────────────────────────────┴────────────────────────────────┐
│             TIER 4: FORMULA & DEPENDENCY RESILIENCE             │
│   • Dynamic Column Resolution   • Dashboard Formulas Re-link    │
│   • Flight No Formula Re-index  • Status Selector Logic         │
└────────────────────────────────┬────────────────────────────────┘
                                 ▲
┌────────────────────────────────┴────────────────────────────────┐
│             TIER 3: DATA VALIDATIONS & DROPDOWNS                │
│   • Flights Status / Type Rules • Gear Dropdowns Bound to Lookups│
│   • Closed? Checkbox Correction • Conditional Formatting Idemp. │
└────────────────────────────────┬────────────────────────────────┘
                                 ▲
┌────────────────────────────────┴────────────────────────────────┐
│             TIER 2: COLUMN SCHEMA & HEADER LAYOUT               │
│   • Row 4 Header Names/Tooltips • Row 3 Merged Categories       │
│   • Native sheet.moveColumns()  • Column Groups (+/- Collapse)  │
└────────────────────────────────┬────────────────────────────────┘
                                 ▲
┌────────────────────────────────┴────────────────────────────────┐
│             TIER 1: GRID DIMENSIONS & STRUCTURAL INTEGRITY      │
│   • Tab Existence Verification  • ensureDimensions_ (2000 x 70) │
│   • Frozen Panes (Cols A:D)     • Tab Color Palette Alignment   │
└─────────────────────────────────────────────────────────────────┘
```

### 3.2 Service Architecture & Code Contracts (`Code/Scaffold.gs`)

```javascript
/**
 * Unified System Update Orchestrator
 */
var SystemUpdateService = {
  /**
   * Executes selected update tiers in strict hierarchical order.
   * @param {Object} options - Selected update flags
   * @param {boolean} options.tier1_dimensions - Grid dimensions & tabs
   * @param {boolean} options.tier2_schema - Headers, notes & groupings
   * @param {boolean} options.tier3_validations - Dropdowns & data rules
   * @param {boolean} options.tier4_formulas - Dynamic formulas & Dashboard
   * @param {boolean} options.tier5_docs - User guide & reference data
   * @param {boolean} options.createBackup - Create pre-update backup snapshot
   * @return {Object} Execution summary and log entries
   */
  executeUpdate: function(options) {
    var logs = [];
    var ss = SpreadsheetApp.getActive();

    // 0. Pre-Flight Safety Backup
    if (options.createBackup) {
      logs.push('[BACKUP] Creating pre-update configuration snapshot...');
      this.createSafetySnapshot_(ss);
    }

    // Tier 1: Dimensions & Substrate
    if (options.tier1_dimensions) {
      logs.push('[TIER 1] Verifying sheet tabs, grid dimensions, and frozen panes...');
      this.executeTier1_Dimensions_(ss);
    }

    // Tier 2: Schema, Headers & Layout
    if (options.tier2_schema) {
      logs.push('[TIER 2] Synchronizing column schema, notes, and groupings...');
      this.executeTier2_Schema_(ss);
    }

    // Tier 3: Validations & Dropdowns
    if (options.tier3_validations) {
      logs.push('[TIER 3] Rebuilding data validations and conditional formatting...');
      this.executeTier3_Validations_(ss);
    }

    // Tier 4: Formulas & Dependencies
    if (options.tier4_formulas) {
      logs.push('[TIER 4] Resolving dynamic column references and linking Dashboard...');
      this.executeTier4_Formulas_(ss);
    }

    // Tier 5: Documentation & Reference
    if (options.tier5_docs) {
      logs.push('[TIER 5] Synchronizing User Guide and Pilot Profile definitions...');
      this.executeTier5_Docs_(ss);
    }

    logs.push('[SUCCESS] System update completed successfully.');
    return { success: true, logs: logs };
  }
};
```

### 3.3 User Interface: `SystemUpdateDialog.html`

The dialog provides an intuitive, high-confidence update cockpit:
* **Header Banner**: Displays current spreadsheet version vs. core script version.
* **Safety Option**: Pre-checked `[x] Create safety configuration snapshot before update`.
* **Preset Profiles**:
  * 🔘 **Standard Recommended Update** (Tiers 2, 3, 4) — updates formatting, validations, and formulas without altering reference sheets.
  * 🔘 **Quick Fix: Validations & Dropdowns** (Tier 3 only) — fixes broken dropdowns or missing validation rules in seconds.
  * 🔘 **Full System Overhaul** (Tiers 1, 2, 3, 4, 5) — complete structural resync.
  * 🔘 **Custom Selection** — unlocks individual tier checkboxes for advanced control.
* **Activity Console & Tri-Mode Action Bar**:
  * `[ 🚀 Run Update Here ]`
  * `[ 📌 Run in Sidebar ]`
  * `[ ⚙️ Run in Background ]`
  * Real-time progress bar and log streaming.

---

## 4. Platform Constraints & Rollback Safety

* **Execution Timeouts**: When executing all 5 tiers on a large logbook, spreadsheet formula refreshes and validation applications can take 30–60 seconds.
  * *Mitigation*: Batch range operations (`setDataValidations` across full rectangular ranges rather than cell-by-cell). Full updates can be executed in the background queue if preferred.
* **Rollback Safety**: Before any structural change, the orchestrator writes a timestamped `system_update_backup_YYYYMMDD_HHMM.json` into the pilot's `MASTER_LOG_FOLDER_ID`, ensuring zero data loss if an unexpected error occurs.

---

## 5. Implementation Plan

1. **Phase 1: Modularize Tier Functions**: Refactor existing monolithic `scaffold...` and `reapplyFormatting_` logic in [`Code/Scaffold.gs`](file:///g:/My%20Drive/~RS2B/~Projects/ParaFlightLogProject/Code/Scaffold.gs) into explicit, callable Tier 1–5 functions.
2. **Phase 2: Build Orchestrator Service**: Implement `SystemUpdateService` in `Scaffold.gs` with pre-flight backup and hierarchical sequencing.
3. **Phase 3: Create UI Cockpit**: Develop [`Code/SystemUpdateDialog.html`](file:///g:/My%20Drive/~RS2B/~Projects/ParaFlightLogProject/Code/SystemUpdateDialog.html) with preset profiles, collapsible tier details, and Tri-Mode execution.
4. **Phase 4: Menu Harmonization**: Consolidate `Flight Log > Admin > Sheet Maintenance & Views` into a streamlined submenu featuring the new **System Update & Maintenance...** command.

---

## 6. Revision History

| Revision | Date | Author | Description / Notes |
| :---: | :---: | :--- | :--- |
| `Rev 1.0` | 2026-10-02 | Rohitashwa / Antigravity AI | Initial design specification drafted following architectural discussion. |
