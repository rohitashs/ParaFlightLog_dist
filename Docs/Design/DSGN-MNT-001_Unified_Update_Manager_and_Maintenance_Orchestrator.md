# Design Specification: Unified System Update Manager & Atomic Maintenance Orchestrator

* **Design ID**: `DSGN-MNT-001`
* **Status**: `Implemented & Deployed`
* **Current Revision**: `Rev 2.1`
* **Date Created**: `2026-10-02`
* **Last Updated**: `2026-10-02`
* **Author / Contributors**: `Rohitashwa / Antigravity AI`
* **Parent Design**: `None` (Root Maintenance Architecture)
* **Child Designs**: `None`
* **Umbrella Module / Primary Code**: [`Code/Scaffold.gs`](file:///g:/My%20Drive/~RS2B/~Projects/ParaFlightLogProject/Code/Scaffold.gs), [`Code/SystemMaintenanceDialog.html`](file:///g:/My%20Drive/~RS2B/~Projects/ParaFlightLogProject/Code/SystemMaintenanceDialog.html), [`Code/SystemInfoDialog.html`](file:///g:/My%20Drive/~RS2B/~Projects/ParaFlightLogProject/Code/SystemInfoDialog.html), [`Code/Config.gs`](file:///g:/My%20Drive/~RS2B/~Projects/ParaFlightLogProject/Code/Config.gs)
* **Code Revision Stamp**: `Core v2.1.0 Implemented`
* **Related Requirements / CRs**: `[RQ-SYS-001]`, `[RQ-SYS-002]`, `[RQ-SYS-007]`, `[RQ-SYS-010]`, `[CR-SYS-006]`, `[CR-SCH-002]`

---

## 1. Executive Summary & Intent

### Problem Statement
Historically, system maintenance and structural sheet evolution have suffered from three major architectural flaws:

1. **Cryptic, Blackbox Menu Fragmentation**:
   Sheet maintenance was scattered across disjointed menu items under `Flight Log > Admin > Sheet Maintenance & Views`:
   * *Re-apply Formatting & Structural Groupings*
   * *Refresh User Guide & Metric Dictionary*
   * *Re-scaffold Lookups Dynamic Ranges*
   * *Ensure Dimensions & Buffers*
   * *First Time Setup / Scaffold All*
   Pilots and administrators suffered from decision fatigue, could not predict what each script touched, and risked breaking dependencies by running operations out of order.

2. **The "Dual-State Lag" & Script-to-Sheet Coupling Hazard**:
   Apps Script code and Google Sheets physical layout evolve **asynchronously**:
   * Code is pushed instantly in the background (via `clasp push` or git pull).
   * The active Google Sheet document elements (tabs, column positions, formulas, named ranges, validations, protections) remain on the previous schema until the user explicitly runs an update.
   * If newly pushed Apps Script code is **tightly coupled** to sheet elements (e.g., assuming a new column index exists, expecting a newly introduced Named Range, or relying on an updated formula syntax), the system crashes with fatal runtime errors (`Cannot find range`, `#REF!`, `TypeError`) before the user ever opens the maintenance menu.

3. **Cumulative Pipeline Drift Across Skipped Releases**:
   If multiple software updates are deployed consecutively before a pilot performs maintenance, the system must handle the cumulative delta cleanly rather than applying conflicting or redundant transformations.

### Proposed Solution
This design introduces the **Unified System Maintenance Cockpit & Decoupled Update Architecture**:
1. **Single Entry Point (`Flight Log > Admin > System Maintenance...`)**: Replaces all fragmented maintenance menu items with one smart, interactive modal dialog (`SystemMaintenanceDialog.html`).
2. **Visual 2D Matrix Model (Sheets $\times$ Element Types)**: The dialog renders an intuitive table where sheets form the columns and element types form the rows. Pilots and developers have granular, visual control over which elements on which sheets are updated.
3. **Strict Script-to-Sheet Decoupling & Graceful Degradation**: Core engine code is designed with loose coupling, runtime tolerance, and lazy self-healing so that newly deployed code functions gracefully even while the Google Sheet schema is one or more versions behind.
4. **Three-Tier Functional Hierarchy**: A clean code architecture separating **Atomic Element Updaters** (Tier 1), **Sheet Specialists** (Tier 2), and a **System Orchestrator** (Tier 3).
5. **Universal Dual-Mode Utility**: The same underlying 3-tier engine powers the **Manual User-Led Dialog** today and serves as the foundation for an **Automated Background Updater** in the future.
6. **Cumulative Change Manifest & 3-Tier Execution Invariants**: Tracks applied schema components in `DocumentProperties` against the declared `SYSTEM_MANIFEST` in code, automatically pre-checking pending updates, categorizing elements into Mandatory, Recommended, and Optional tiers, and enforcing mandatory structural invariants.
7. **System Info & Manifest Inspector (`SystemInfoDialog.html`)**: A dedicated inspector modal providing deep transparency into applied versus latest manifest states, sheet health accordions, environment parameters, and service attribution.

---

## 2. Requirements & Scope

### Functional Requirements
* **REQ-1 (Unified Menu & Dialog UI)**: Consolidate `Flight Log > Admin > Sheet Maintenance & Views` into a single `System Maintenance...` entry point that opens `SystemMaintenanceDialog.html`.
* **REQ-2 (2D Scope Matrix)**: Present a visual matrix where columns represent System Sheets and rows represent Element Types. Cells where an element type is not applicable to a sheet must be clearly blank/disabled (`───`).
* **REQ-3 (Pre-Flight Safety Backups)**: Provide pre-checked backup options at the top of the dialog:
  * In-Workbook System Sheets Clone (`_MNT_BAK_*`).
  * Config JSON Export (downloads current parameters and custom settings).
* **REQ-4 (Cumulative Change Detection & Tiering)**: Detect pending updates across multiple skipped releases by comparing `SYSTEM_MANIFEST` against `APPLIED_MANIFEST`. Categorize all components into Mandatory, Recommended, and Optional tiers.
* **REQ-5 (Mandatory Invariant Rule)**: Mandatory updates represent structural prerequisites for backend code and must execute regardless of sheet gating to prevent broken formulas or missing Named Ranges.
* **REQ-6 (Impact Preview & Non-Destructive Guarantee)**: Display an explicit impact counter (e.g., *"5 updates selected (2 Mandatory, 2 Recommended, 1 Optional)"*). Guarantee that Flight log rows (Rows 5:N on `Flights`), custom equipment inventory, and user parameter values are strictly preserved (Zero-Loss Contract).
* **REQ-7 (Script-to-Sheet Decoupling & Self-Healing)**: Ensure that all operational modules (Ingestion, Parser, Dashboard calculation, Scoring) feature runtime fallbacks and lazy auto-registration so that delayed sheet updates never break core logging.
* **REQ-8 (System Info Inspector)**: Expose `Flight Log > System Info...` to inspect active manifest vs. code manifest, sheet-by-sheet health, Apps Script environment quotas, and system attribution.

### Non-Goals (Out of Scope)
* **NON-GOAL-1**: Overwriting or resetting flight rows (Rows 5:N on `Flights`). Data rows are strictly read-only during system updates.
* **NON-GOAL-2**: Forcing unannounced destructive migrations. The pilot always retains full visibility and approval.
* **NON-GOAL-3**: Full UI custom layout extraction (tracked separately under `CR-SYS-008`).

---

## 3. Architecture & Detailed Design

### 3.1 The 2D Sheet $\times$ Element Matrix Model

The dialog interface and the underlying execution payload are structured around a sparse 2D matrix:

```
┌─────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ 🛠️ System Maintenance Cockpit                                                          [ Core v2.1.0 ] │
├─────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ 🛡️ Pre-Flight Safety Backups (Recommended):                                                             │
│   [x] Create In-Workbook Sheet Clones (_MNT_BAK_*)                                                      │
│   [x] Download Config JSON Snapshot (.json file)                                                        │
├─────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ Legend:  🔴 Mandatory (Core Invariant)   🟢 Recommended   🔵 Optional   ⚪ Up-to-Date   ─── N/A          │
├─────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ Update Scope & Target Elements:                                                                         │
│   [ 🎯 Select Recommended Only ]   [ 🗹 Select All ]   [ 🗵 Clear All ]                                   │
│                                                                                                         │
│  Element / System Tab     Flights     Dashboard   Equipment    Config    Pilot_Prof    Queue    Act_Logs│
│ ─────────────────────────────────────────────────────────────────────────────────────────────────────── │
│  [x] Gate Sheet Updates     [x]          [x]         [x]         [x]        [x]         [x]       [x]   │
│ ─────────────────────────────────────────────────────────────────────────────────────────────────────── │
│  Grid & Dimensions          [x]          [x]         [ ]         [ ]        [ ]         [ ]       [ ]   │
│  Headers & Groupings        [x]          [ ]         [x]         [x]        [x]         [ ]       [ ]   │
│  Labels, Notes & Tooltips   [x]          [ ]         [ ]         [x]        [ ]         [ ]       [ ]   │
│  Validations & Dropdowns    [x]          [ ]         [x]         [x]        ───         ───       ───   │
│  Formulas & Named Ranges    [🔒]         [🔒]        ───         [🔒]       ───         ───       ───   │
│  Parameters & Values        ───          ───         ───         [🔒]       [x]         ───       ───   │
│  Soft Guardrails            [x]          [x]         ───         [x]        ───         ───       ───   │
│ ─────────────────────────────────────────────────────────────────────────────────────────────────────── │
│ ℹ️ Non-Destructive Update Guarantee:                                                                   │
│   • 5 elements selected across 3 sheets (2 Mandatory 🔴, 2 Recommended 🟢, 1 Optional 🔵).             │
│   • Mandatory updates execute as invariants regardless of sheet gating to prevent broken formulas.      │
│   • Zero-Loss Contract: Flight rows 5:N and custom equipment inventory remain 100% UNTOUCHED.           │
├─────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ Ready to inspect and apply updates.          [ Cancel ]   [ ⚡ Apply All Updates ]   [ 🚀 Apply Selected ]│
└─────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

### 3.2 Three-Tier Component Classification & Invariant Rules

Every component declared in `SYSTEM_MANIFEST.components` is assigned an explicit operational tier:

| Tier | Visual Styling | User Controllability | Execution Invariant Rule |
| :--- | :--- | :--- | :--- |
| **Mandatory** (`🔴`) | Light Red `#FFEBEE`, checked & disabled | Locked (`checked disabled`). Cannot be unchecked. | **Universal System Invariant**: Always auto-enforced by the orchestrator during maintenance, even if the parent sheet master checkbox is unchecked! Prevents fatal runtime `#REF!` or missing Named Range errors. |
| **Recommended** (`🟢`) | Light Green `#E8F5E9`, checked & enabled | User-toggleable. Gated by parent sheet master checkbox. | Applied by default when the sheet is selected. User may uncheck individually. |
| **Optional** (`🔵`) | Light Blue `#E1F5FE`, checked & enabled | User-toggleable. Gated by parent sheet master checkbox. | Applied by default or via "Select All". User may uncheck individually. |

#### Component Tier Distribution (v2.1.0)
* **Mandatory (6 Components)**:
  * `Flights.formulas` (Dynamic row counting, formulas)
  * `Dashboard.formulas` (Formulas bound to `DASHBOARD_REVIEW_FILTER`)
  * `Config.lookups` (Native dynamic `=SORT(FILTER(...))` lookups)
  * `Config.namedRanges` (`LOOKUP_PILOTS`, `LOOKUP_ACTIVE_WINGS`, `LOOKUP_SITES`)
  * `Config.parameters` (Core parameter registry & defaults)
  * `Equipment.headers` (Equipment substrate columns for dynamic lookups)
* **Recommended (12 Components)**:
  * `Flights.grid`, `Flights.headers`, `Flights.notes`, `Flights.validations`, `Flights.guardrails`
  * `Dashboard.grid`, `Dashboard.guardrails`
  * `Config.guardrails`
  * `Equipment.validations`
  * `Pilot_Profile.keys`
  * `Automation_Queue.headers`
  * `Activity_Logs.headers`
* **Optional (4 Components)**:
  * `User_Guide.grid`, `User_Guide.headers`, `User_Guide.notes`, `User_Guide.guardrails`

---

### 3.3 Four-State Matrix Cell Behavior

The UI matrix renders cells in one of five distinct states:
1. **Non-Applicable (`.cell-na`)**: Element does not exist on that sheet (rendered as `───` on white background).
2. **Up-to-Date (`.cell-uptodate`)**: Applicable element, but already synchronized with code (rendered as a disabled, unchecked box with version tooltip).
3. **Mandatory Pending (`.cell-mandatory`)**: Structural update pending (light red background `#FFEBEE`, checked & disabled box).
4. **Recommended Pending (`.cell-recommended`)**: Functional update pending (light green background `#E8F5E9`, checked & enabled box).
5. **Optional Pending (`.cell-optional`)**: Non-critical update pending (light blue background `#E1F5FE`, checked & enabled box).

#### Authoritative Sheet Gatekeeper
* Each column in Row 1 has a master gating checkbox (`.sheet-master-check`), checked by default.
* **Unchecking a sheet master checkbox**:
  * Dims (`opacity: 0.35; filter: grayscale(80%)`), unchecks, and disables all **Recommended** and **Optional** components on that sheet.
  * **Mandatory components on that sheet remain CHECKED and ACTIVE!** Because mandatory components are structural prerequisites, they execute regardless of sheet gating status.

---

### 3.4 Dual Pre-Flight Safety Backup Architecture

Before any structural or formula modification is executed:
1. **In-Workbook Clones**:
   * If `chkBackupSheets` is checked, `backupSystemSheets_()` creates duplicate sheets prefixed with `_MNT_BAK_*` (e.g. `_MNT_BAK_Flights`, `_MNT_BAK_Config`).
2. **Client-Side Config JSON Snapshot**:
   * If `chkExportConfig` is checked, the orchestrator packages all active parameters via `getConfigExportPayload_()`.
   * Upon completion, the client browser automatically triggers a local download of `paraflightlog_config_backup_<timestamp>.json`.

---

### 3.5 Three-Tier Functional Execution Hierarchy

The codebase decomposes all maintenance and scaffolding logic into three cleanly bounded layers:

```
┌───────────────────────────────────────────────────────────────────────────────────┐
│                           TIER 3: SYSTEM ORCHESTRATOR                             │
│   SystemMaintenanceOrchestrator.execute(selectionMatrix, options)                 │
│   • Auto-enforces pending Mandatory components as non-negotiable invariants       │
│   • Executes Pre-Flight Safety Backups (In-Sheet Clone & Config JSON)             │
│   • Dispatches execution to Sheet Specialists in dependency order                 │
│   • Updates APPLIED_MANIFEST in DocumentProperties                                │
│   • Prepares Config Export Payload if requested                                   │
└─────────────────────────────────────────┬─────────────────────────────────────────┘
                                          │
                                          ▼
┌───────────────────────────────────────────────────────────────────────────────────┐
│                           TIER 2: SHEET SPECIALISTS                               │
│   SheetSpecialists.updateFlights, updateDashboard, updateConfig...                │
│   • Encapsulates sheet-specific layout rules (e.g. Flights frozen pane 4x4)       │
│   • Enforces Zero-Loss Contract (Rows 5+ read-only; Config parameter merging)     │
│   • Invokes relevant Tier 1 atomic functions for that specific tab                │
└─────────────────────────────────────────┬─────────────────────────────────────────┘
                                          │
                                          ▼
┌───────────────────────────────────────────────────────────────────────────────────┐
│                         TIER 1: ATOMIC ELEMENT UPDATERS                           │
│   • updateDimensions_(sh, rows, cols, frozenR, frozenC, tabColor)                 │
│   • updateHeadersAndGroupings_(sh, groups, flatHeaders)                           │
│   • updateColumnNotes_(sh, headerRow, colNotesMap)                                │
│   • updateValidations_(sh, map, validationRules, allowInvalid)                     │
│   • updateFormulasAndNamedRanges_(sh, namedRanges, formulaSpecs)                  │
│   • updateParametersPreservingValues_(sh, canonicalParams, defaultVals)           │
│   • updateGuardrails_(sh, protectedRanges, description, warningOnly)              │
└───────────────────────────────────────────────────────────────────────────────────┘
```

#### Topological Dependency Order
1. **Reference Data & Lookups Substrate**: Update `Equipment` inventory columns and `Config` parameters/lookups.
2. **Formulas & Named Ranges**: Register `LOOKUP_*` named ranges and write dynamic `=SORT(FILTER(...))` formulas.
3. **Headers & Groupings**: Synchronize Row 3 categories, Row 4 column titles, and cell tooltips on `Flights`.
4. **Data Validations**: Bind dropdowns on `Flights` to the newly verified Named Ranges.
5. **Dashboard Re-linking**: Re-point KPI cards and list queries to dynamic columns.
6. **Soft Guardrails**: Apply `setWarningOnly(true)` protections across headers and formula ranges.

---

### 3.6 System Info & Manifest Inspector (`SystemInfoDialog.html`)

Accessible via `Flight Log > System Info...`:
* **Live Status Banner**: Amber if updates are pending (displaying exact breakdown of Mandatory, Recommended, Optional), Green if 100% synchronized.
* **Sheet Accordion Cards**: Expandable card per sheet showing all 22 components, their operational tier badge, applied version in sheet, latest version in code, and status.
* **Environment & Quotas**: Displays active spreadsheet ID, document timezone, active user, runtime limits, and resilience primitives.
* **Attribution**: Credits native GAS IGC parser, Civl scoring, Open-Meteo, and Paragliding Earth.
* **Direct Hand-Off**: Contains a button to directly launch the System Maintenance Cockpit if updates are pending.

---

## 4. Data Safety & Non-Destructive Invariants

| Invariant | Scope | Enforcement Mechanism |
| :--- | :--- | :--- |
| **I-1: Read-Only Flight Rows** | `Flights!5:N` | Updaters operate strictly on `sh.getRange(1, 1, 4, maxCols)`. Data rows are never cleared, sliced, or overwritten. |
| **I-2: Parameter Preservation** | `Config!A3:B` | `existingMap` reads all user values into memory before rewriting rows; custom folder IDs, date formats, and thresholds are preserved. |
| **I-3: Equipment Preservation** | `Equipment!A3:M` | Inventory rows are never touched; only Row 2 headers and column dropdown rules are synchronized. |
| **I-4: Automated Pre-Flight Clones** | All System Tabs | Full sheet copies (`_MNT_BAK_*`) are created prior to Tier 2 execution. |
| **I-5: Mandatory Invariant Enforcement** | Systemwide | Any pending Mandatory update executes regardless of UI sheet gating to preserve backend integrity. |
| **I-6: Soft Guardrails Only** | All Ranges | Range protections strictly use `setWarningOnly(true)`. Multi-user permission exceptions and administrative lockouts are impossible. |

---

## 5. Revision History

| Revision | Date | Author | Description / Notes |
| :--- :---: | :---: | :--- | :--- |
| `Rev 1.0` | 2026-10-02 | Rohitashwa / Antigravity AI | Initial draft outlining 5-tier maintenance orchestrator. |
| `Rev 2.0` | 2026-10-02 | Rohitashwa / Antigravity AI | Major Architectural Expansion: Introduced 2D Sheet $\times$ Element Matrix model, Script-to-Sheet Decoupling / Dual-State Lag resilience, lazy self-healing, cumulative manifest pipeline, and unified dual-mode engine. |
| `Rev 2.1` | 2026-10-02 | Rohitashwa / Antigravity AI | **Implemented & Deployed**: Added 3-Tier Classification (`mandatory`, `recommended`, `optional`), Mandatory Auto-Enforcement as a system invariant, 4-state matrix UI, dual pre-flight safety backups with client-side JSON download, and System Info Inspector (`SystemInfoDialog.html`). |
