# Design Specification: Unified System Update Manager & Atomic Maintenance Orchestrator

* **Design ID**: `DSGN-MNT-001`
* **Status**: `Approved for Development`
* **Current Revision**: `Rev 2.0`
* **Date Created**: `2026-10-02`
* **Last Updated**: `2026-10-02`
* **Author / Contributors**: `Rohitashwa / Antigravity AI`
* **Parent Design**: `None` (Root Maintenance Architecture)
* **Child Designs**: `None`
* **Umbrella Module / Primary Code**: [`Code/Scaffold.gs`](file:///g:/My%20Drive/~RS2B/~Projects/ParaFlightLogProject/Code/Scaffold.gs), [`Code/SystemMaintenanceDialog.html`](file:///g:/My%20Drive/~RS2B/~Projects/ParaFlightLogProject/Code/SystemMaintenanceDialog.html), [`Code/Config.gs`](file:///g:/My%20Drive/~RS2B/~Projects/ParaFlightLogProject/Code/Config.gs)
* **Code Revision Stamp**: `Pending Implementation (Phase 1)`
* **Related Requirements / CRs**: `[RQ-SYS-001]`, `[RQ-SYS-002]`, `[RQ-SYS-007]`, `[RQ-SYS-010]`, `[CR-SYS-006]`, `[CR-SCH-002]`

---

## 1. Executive Summary & Intent

### Problem Statement
Historically, system maintenance and structural sheet evolution have suffered from three major architectural flaws:

1. **Cryptic, Blackbox Menu Fragmentation**:
   Sheet maintenance has been scattered across disjointed menu items under `Flight Log > Admin > Sheet Maintenance & Views`:
   * *Re-apply Formatting & Structural Groupings*
   * *Refresh User Guide & Metric Dictionary*
   * *Re-scaffold Lookups Dynamic Ranges*
   * *Ensure Dimensions & Buffers*
   * *First Time Setup / Scaffold All*
   Pilots and administrators suffer from decision fatigue, cannot predict what each script touches, and risk breaking dependencies by running operations out of order.

2. **The "Dual-State Lag" & Script-to-Sheet Coupling Hazard**:
   Apps Script code and Google Sheets physical layout evolve **asynchronously**:
   * Code is pushed instantly in the background (via `clasp push` or git pull).
   * The active Google Sheet document elements (tabs, column positions, formulas, named ranges, validations, protections) remain on the previous schema until the user explicitly runs an update.
   * If newly pushed Apps Script code is **tightly coupled** to sheet elements (e.g., assuming a new column index exists, expecting a newly introduced Named Range, or relying on an updated formula syntax), the system crashes with fatal runtime errors (`Cannot find range`, `#REF!`, `TypeError`) before the user ever opens the maintenance menu.

3. **Cumulative Pipeline Drift Across Skipped Releases**:
   If three software updates are deployed consecutively before a pilot performs maintenance, the system must handle the cumulative delta cleanly rather than applying conflicting or redundant transformations.

### Proposed Solution
This design introduces the **Unified System Maintenance Cockpit & Decoupled Update Architecture**:
1. **Single Entry Point (`Flight Log > Admin > System Maintenance...`)**: Replaces all fragmented maintenance menu items with one smart, interactive modal dialog (`SystemMaintenanceDialog.html`).
2. **Visual 2D Matrix Model (Sheets $\times$ Element Types)**: The dialog renders an intuitive table where sheets form the columns and element types form the rows. Pilots and developers have granular, visual control over which elements on which sheets are updated.
3. **Strict Script-to-Sheet Decoupling & Graceful Degradation**: Core engine code is designed with loose coupling, runtime tolerance, and lazy self-healing so that newly deployed code functions gracefully even while the Google Sheet schema is one or more versions behind.
4. **Three-Tier Functional Hierarchy**: A clean code architecture separating **Atomic Element Updaters** (Tier 1), **Sheet Specialists** (Tier 2), and a **System Orchestrator** (Tier 3).
5. **Universal Dual-Mode Utility**: The same underlying 3-tier engine powers the **Manual User-Led Dialog** today and serves as the foundation for an **Automated Background Updater** in the future.
6. **Cumulative Change Manifest**: Tracks applied schema components in `DocumentProperties` against the declared `SYSTEM_MANIFEST` in code, automatically pre-checking only those elements that have pending updates or have drifted.

---

## 2. Requirements & Scope

### Functional Requirements
* **REQ-1 (Unified Menu & Dialog UI)**: Consolidate `Flight Log > Admin > Sheet Maintenance & Views` into a single `System Maintenance...` entry point that opens `SystemMaintenanceDialog.html`.
* **REQ-2 (2D Scope Matrix)**: Present a visual matrix where columns represent System Sheets and rows represent Element Types. Cells where an element type is not applicable to a sheet must be clearly blank/disabled (`───`).
* **REQ-3 (Pre-Flight Safety Backups)**: Provide pre-checked backup options at the top of the dialog:
  * In-Workbook System Sheets Clone (`Backup Flights`, `Backup Config`, etc.).
  * Config JSON Export (downloads current parameters and custom settings).
* **REQ-4 (Cumulative Change Detection)**: Detect pending updates across multiple skipped releases by comparing `SYSTEM_MANIFEST` against `APPLIED_MANIFEST`. Only pending or drifted elements are checked and enabled by default.
* **REQ-5 (Impact Preview & Non-Destructive Guarantee)**: Display an explicit impact counter (e.g., *"8 Named Ranges to register, 4 lookups to upgrade"*). Guarantee that Flight log rows (Rows 5:N on `Flights`), custom equipment inventory, and user parameter values are strictly preserved (Zero-Loss Contract).
* **REQ-6 (Script-to-Sheet Decoupling & Self-Healing)**: Ensure that all operational modules (Ingestion, Parser, Dashboard calculation, Scoring) feature runtime fallbacks and lazy auto-registration so that delayed sheet updates never break core logging.
* **REQ-7 (Universal Orchestrator)**: Implement the 3-tier hierarchy so the same engine functions identically whether triggered manually via modal dialog or automatically via background queue.

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
│ 🛠️ System Maintenance & Update Cockpit                                                 [ v2.1.0 ]      │
├─────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ 🛡️ Pre-Flight Safety Backups:                                                                           │
│   [x] Create In-Workbook Backup Snapshot (Backup Flights, Backup Config)                                 │
│   [x] Export Config to JSON (Downloads current parameters & layout preferences)                         │
├─────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ 📋 Update Scope & Target Elements:                                                                       │
│   Quick Presets: [ 🎯 Select Recommended Updates ]   [ 🗹 Select All ]   [ 🗵 Clear All ]                 │
│                                                                                                         │
│  Element / Sheet          Flights     Dashboard   Equipment    Config    Pilot_Prof    Queue    App_Log │
│ ─────────────────────────────────────────────────────────────────────────────────────────────────────── │
│  [x] Select Sheet           [x]          [x]         [x]         [x]        [x]         [x]       [x]   │
│ ─────────────────────────────────────────────────────────────────────────────────────────────────────── │
│  Grid & Dimensions          [x]          [x]         [ ]         [ ]        [ ]         [ ]       [ ]   │
│  Headers & Groupings        [x]          [ ]         [x]         [x]        [x]         [ ]       [ ]   │
│  Labels, Notes & Tooltips   [x]          [ ]         [ ]         [x]        [ ]         [ ]       [ ]   │
│  Validations & Dropdowns    [x]          [ ]         [x]         [x]        ───         ───       ───   │
│  Formulas & Named Ranges    [x]          [x]         ───         [x]        ───         ───       ───   │
│  Parameters & Values        ───          ───         ───         [x]        [x]         ───       ───   │
│  Soft Guardrails            [x]          [x]         ───         [x]        ───         ───       ───   │
│ ─────────────────────────────────────────────────────────────────────────────────────────────────────── │
│ ℹ️ Impact Preview:                                                                                      │
│   • 8 Named Ranges will be registered.                                                                  │
│   • 4 Equipment lookup formulas will be upgraded to native SORT(FILTER()).                             │
│   • Flight rows 5:542 will remain 100% UNTOUCHED (read-only preservation).                              │
├─────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ [ Cancel ]                                                        [ 🚀 Apply Selected Maintenance ]     │
└─────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

#### Matrix Sparsity Rules
* **Blank / Disabled Cells (`───`)**: Indicate that an element type does not exist on that sheet (e.g. `Pilot_Profile` has no dropdown validations; `Equipment` has no calculated KPI formulas).
* **Column Master Checkbox (Row 1)**: Toggles all valid element checkboxes for that specific sheet.
* **Row Master Checkbox (Col 1)**: Toggles that specific element type across all sheets where it is applicable.

---

### 3.2 Script-to-Sheet Decoupling & Dual-State Lag Resilience

The most critical architectural risk during system updates is **Dual-State Lag**:

```
┌────────────────────────────────────────────────────────┐
│               APPS SCRIPT CODEBASE                     │
│   Pushed instantly via clasp / git                     │
│   Current Version: v2.1.0                              │
│   • Requires Named Range: LOOKUP_ACTIVE_WINGS          │
│   • Requires Dashboard selector: DASHBOARD_REVIEW_FILTER│
└───────────────────────────┬────────────────────────────┘
                            │ ASYNCHRONOUS LAG
                            ▼ (Pilot has not yet run System Maintenance)
┌────────────────────────────────────────────────────────┐
│               GOOGLE SHEET DOCUMENT                    │
│   Physical elements remain on previous schema           │
│   Current Version: v2.0.4                              │
│   • Named Range LOOKUP_ACTIVE_WINGS does NOT exist yet │
│   • Cell B2 on Dashboard is plain text                 │
└────────────────────────────────────────────────────────┘
```

To eliminate fatal runtime crashes during this lag, the system enforces **Three Decoupling Rules**:

#### Rule 1: Tolerant Name Resolution & Fallback Degradation
All operational code (Ingestion, Scoring, Maintenance) must never rely on absolute cell coordinates or crash if a Named Range is absent.
```javascript
// Example: Safe Named Range Resolution with Graceful Fallback
function getFilterRangeSafe_(ss, namedRangeName, fallbackSheetName, fallbackA1) {
  var range = ss.getRangeByName(namedRangeName);
  if (range) return range;
  
  // Graceful degradation: Fall back to canonical sheet and coordinate
  var sh = ss.getSheetByName(fallbackSheetName);
  if (sh) {
    return sh.getRange(fallbackA1);
  }
  return null;
}
```

#### Rule 2: Lazy Self-Healing / Auto-Repair on Demand
If a critical operational script detects that a prerequisite sheet element is missing, it must not throw an unhandled error. It should invoke the corresponding **Atomic Element Updater** to self-heal on the fly:
```javascript
function getActiveWingsList_(ss) {
  var range = ss.getRangeByName('LOOKUP_ACTIVE_WINGS');
  if (!range) {
    console.warn('[SELF-HEAL] LOOKUP_ACTIVE_WINGS missing. Lazily registering Named Ranges...');
    if (typeof SystemUpdateService !== 'undefined') {
      SystemUpdateService.atomicRegisterNamedRanges_(ss);
      range = ss.getRangeByName('LOOKUP_ACTIVE_WINGS');
    }
  }
  return range ? range.getValues().flat().filter(Boolean) : [];
}
```

#### Rule 3: Non-Intrusive Schema Lag Notification
On `onOpen()`, the script performs a zero-latency version check:
* If `APPLIED_MANIFEST.version < SYSTEM_MANIFEST.version`, display a subtle status indicator or non-blocking menu badge:
  `Flight Log > Admin > System Maintenance (Update Available ⚡)`
* This alerts the pilot to run the maintenance cockpit without interrupting their normal logging workflow.

---

### 3.3 Three-Tier Functional Execution Hierarchy

The codebase decomposes all maintenance and scaffolding logic into three cleanly bounded layers:

```
┌───────────────────────────────────────────────────────────────────────────────────┐
│                           TIER 3: SYSTEM ORCHESTRATOR                             │
│   SystemMaintenanceOrchestrator.execute(selectionMatrix, options)                 │
│   • Validates cross-sheet dependency graph (Topological Sort)                     │
│   • Executes Pre-Flight Safety Backups (In-Sheet Clone & Config JSON)             │
│   • Dispatches execution to Sheet Specialists in dependency order                 │
│   • Updates APPLIED_MANIFEST in DocumentProperties                                │
│   • Runs Post-Execution Health Check (validates zero #REF!, zero orphan ranges)   │
└─────────────────────────────────────────┬─────────────────────────────────────────┘
                                          │
                                          ▼
┌───────────────────────────────────────────────────────────────────────────────────┐
│                           TIER 2: SHEET SPECIALISTS                               │
│   sheetFlightsUpdater, sheetDashboardUpdater, sheetConfigUpdater...               │
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
When the user selects elements across multiple sheets, the orchestrator guarantees execution in strict topological dependency order:
1. **Dimensions & Tabs**: Ensure target sheets exist with proper row/column bounds and tab colors.
2. **Reference Data & Lookups Substrate**: Update `Equipment` inventory columns and `Config` parameters/lookups.
3. **Formulas & Named Ranges**: Register `LOOKUP_*` named ranges and write dynamic `=SORT(FILTER(...))` formulas.
4. **Headers & Groupings**: Synchronize Row 3 categories, Row 4 column titles, and cell tooltips on `Flights`.
5. **Data Validations**: Bind dropdowns on `Flights` to the newly verified Named Ranges.
6. **Dashboard Re-linking**: Re-point KPI cards and list queries to dynamic columns.
7. **Soft Guardrails**: Apply `setWarningOnly(true)` protections across headers and formula ranges.

---

### 3.4 Cumulative Manifest & Update Pipeline

To ensure updates apply cleanly regardless of how many versions a user skipped:

#### Declarative Manifest in Code (`Config.gs`)
```javascript
var SYSTEM_MANIFEST = {
  version: '2.1.0',
  components: {
    'Flights.grid': 'v2.0-dimensions',
    'Flights.headers': 'v2.1-col-schema',
    'Flights.notes': 'v2.1-col-tooltips',
    'Flights.validations': 'v2.1-soft-invalid',
    'Flights.formulas': 'v2.1-flight-no-dynamic',
    'Flights.guardrails': 'v2.1-header-soft-warn',
    'Dashboard.grid': 'v2.0-clean-bounds',
    'Dashboard.formulas': 'v2.1-named-range-filter',
    'Dashboard.guardrails': 'v2.1-card-soft-warn',
    'Config.lookups': 'v2.1-native-sort-filter',
    'Config.namedRanges': 'v2.1-lookup-ranges',
    'Config.parameters': 'v2.1-param-merge',
    'Config.guardrails': 'v2.1-lookup-soft-warn',
    'Equipment.headers': 'v2.0-eq-schema',
    'Equipment.validations': 'v2.0-eq-rules',
    'Pilot_Profile.keys': 'v2.0-profile-fields',
    'Automation_Queue.headers': 'v2.0-queue-schema',
    'App_Log.headers': 'v2.0-log-schema'
  }
};
```

#### Pipeline State Lifecycle
1. **Inspection**:
   * The dialog fetches `APPLIED_MANIFEST` from `PropertiesService.getDocumentProperties().getProperty('APPLIED_MANIFEST')`.
   * For each component, if `SYSTEM_MANIFEST[key] !== APPLIED_MANIFEST[key]`, the corresponding matrix cell is flagged as **Pending Update** (pre-checked and highlighted).
   * If a component matches, its checkbox is unchecked by default (available for optional manual repair).
2. **Execution**:
   * The orchestrator applies only the selected components.
3. **Commit**:
   * For every successfully executed component, the orchestrator updates `APPLIED_MANIFEST[key] = SYSTEM_MANIFEST[key]`.
   * The updated manifest is persisted to `DocumentProperties`.
   * Components are automatically cleared from the pending pipeline!

---

### 3.5 Universal Dual-Mode Execution

The 3-tier architecture deliberately decouples the **execution engine** from the **user interface**:

```
                       ┌────────────────────────────────────────┐
                       │       SystemMaintenanceOrchestrator    │
                       └───────────────────▲────────────────────┘
                                           │
                    ┌──────────────────────┴──────────────────────┐
                    │                                             │
      Mode A: Manual User-Led                       Mode B: Automated Background
┌─────────────────────────────────┐               ┌─────────────────────────────────┐
│   SystemMaintenanceDialog.html  │               │   Scheduled Trigger / Queue     │
│   • Pilot selects checkboxes    │               │   • Headless execution          │
│   • Visual impact preview       │               │   • Auto-applies safe tiers     │
│   • Real-time modal progress    │               │   • Logs to Activity Logs tab   │
└─────────────────────────────────┘               └─────────────────────────────────┘
```
This guarantees that any investment made into the manual maintenance dialog directly powers future automated background migrations without code duplication.

---

## 4. Data Safety & Non-Destructive Invariants

To guarantee production safety, the engine enforces five non-negotiable invariants:

| Invariant | Scope | Enforcement Mechanism |
| :--- | :--- | :--- |
| **I-1: Read-Only Flight Rows** | `Flights!5:N` | Updaters operate strictly on `sh.getRange(1, 1, 4, maxCols)`. Data rows are never cleared, sliced, or overwritten. |
| **I-2: Parameter Preservation** | `Config!A3:B` | `existingMap` reads all user values into memory before rewriting rows; custom folder IDs, date formats, and thresholds are preserved. |
| **I-3: Equipment Preservation** | `Equipment!A3:M` | Inventory rows are never touched; only Row 2 headers and column dropdown rules are synchronized. |
| **I-4: Automated Pre-Flight Clones** | All System Tabs | Full sheet copies (`Backup Flights`, `Backup Config`, etc.) are created prior to Tier 2/4 execution. |
| **I-5: Soft Guardrails Only** | All Ranges | Range protections strictly use `setWarningOnly(true)`. Multi-user permission exceptions and administrative lockouts are impossible. |

---

## 5. Implementation Plan & Phasing

### Phase 1: Engine Modularization & Menu Consolidation (`CR-SYS-006A`)
1. **Consolidate Menu Entry**: Replace `Admin > Sheet Maintenance & Views` with `Admin > System Maintenance...`.
2. **Decompose `Scaffold.gs` into Tier Hierarchy**:
   * Extract Tier 1 Atomic Element Updaters.
   * Extract Tier 2 Sheet Specialists with Zero-Loss Contracts.
   * Implement Tier 3 `SystemMaintenanceOrchestrator.execute(matrix, options)`.
3. **Verify Non-Destructive Safety**: Run automated test suite confirming flight rows and config parameters remain intact across repeated executions.

### Phase 2: Interactive 2D Matrix Dialog (`CR-SYS-006B`)
1. **Build `Code/SystemMaintenanceDialog.html`**:
   * Render dynamic 2D Matrix table with sparse cell rules (`───`).
   * Add Pre-Flight Safety Backup toggles (In-sheet clones + Config export).
   * Implement preset buttons (`Select Recommended`, `Select All`, `Clear All`).
   * Wire real-time impact preview and execution progress bar.

### Phase 3: Manifest Engine & Dual-State Lag Hardening (`CR-SYS-006C`)
1. **Implement `SYSTEM_MANIFEST` & `APPLIED_MANIFEST`**:
   * Add component hash mapping in `Config.gs` and persistence in `DocumentProperties`.
   * Enable automated pending-delta detection when the dialog opens.
2. **Implement Runtime Decoupling Guards**:
   * Verify all core operational functions (Ingestion, Scoring, Dashboard) have safe fallbacks and lazy self-healing.
   * Add non-intrusive schema lag status indicators.

---

## 6. Revision History

| Revision | Date | Author | Description / Notes |
| :--- :---: | :---: | :--- | :--- |
| `Rev 1.0` | 2026-10-02 | Rohitashwa / Antigravity AI | Initial draft outlining 5-tier maintenance orchestrator. |
| `Rev 2.0` | 2026-10-02 | Rohitashwa / Antigravity AI | **Major Architectural Expansion**: Introduced 2D Sheet $\times$ Element Matrix model, Script-to-Sheet Decoupling / Dual-State Lag resilience, lazy self-healing, cumulative manifest pipeline, and unified dual-mode engine for manual user-led and automated background upgrades. |
