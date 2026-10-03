# Design Specification: Google Sheets Database Substrate & Dynamic Formulas

* **Design ID**: `DSGN-CORE-004`
* **Status**: `Implemented`
* **Current Revision**: `Rev 2.1`
* **Date Created**: `2026-10-02`
* **Last Updated**: `2026-10-02`
* **Author / Contributors**: `Rohitashwa / Antigravity AI`
* **Parent Design**: `None` (Core Subsystem)
* **Child Designs**: `None`
* **Umbrella Module / Primary Code**: [`Code/Config.gs`](../../Code/Config.gs), [`Code/Scaffold.gs`](../../Code/Scaffold.gs)
* **Code Revision Stamp**: `Core v2.1.0 Implemented`
* **Related Requirements / CRs**: `[RQ-SYS-001]`, `[RQ-SYS-002]`, `[RQ-SYS-005]`, `[CR-SYS-005]`, `[CR-SYS-009]`, `[Bug-SYS-006]`, `[Bug-SYS-007]`

---

## 1. Executive Summary & Intent

### Problem Statement
In Google Sheets application development, scripts frequently assume static cell coordinates (e.g. `col 11 = Wing`, `Flights!B5:B`). When users rearrange columns, insert rows, or paste data:
1. Formulas referencing static string literals inside `INDIRECT()` break into `#REF!`.
2. Appended rows lack data validations and formatting.
3. Users accidentally wipe out complex summary formulas via clipboard paste.

### Proposed Solution
A resilient, decoupled spreadsheet substrate featuring:
* **Dynamic Column Letter Resolution**: All formulas construct references using dynamic header name lookups (`getColLetter_(map, 'Date')`), allowing pilots to reorder columns freely.
* **Workbook Named Ranges**: Dynamic dropdowns and Dashboard KPI formulas bind to Named Ranges (`LOOKUP_*`, `DASHBOARD_REVIEW_FILTER`) that automatically track cell movements.
* **Native Soft Guardrails (`setWarningOnly`)**: Header rows, formulas, and KPI summaries are protected with non-intrusive warnings.

---

## 2. Requirements & Scope

### Functional Requirements
* **REQ-1 (Dynamic Column Freedom)**: Eliminate all hardcoded column letter literals from formula generators in `Scaffold.gs`.
* **REQ-2 (Named Ranges Binding)**: Register workbook-scoped Named Ranges for all controlled dropdown vocabularies and review filters.
* **REQ-3 (Batch Formula Application)**: Apply formulas across flight rows using in-memory 2D arrays (`setFormulas()`) rather than synchronous row loops.
* **REQ-4 (Open-Ended Validation)**: Expand validations to `sh.getMaxRows()` with `.setAllowInvalid(true)` to gracefully handle custom gear.

---

## 3. Architecture & Detailed Design

### 3.1 Dynamic Column Map Pattern
```javascript
var map = getColumnMap_(sh, 4);
var dateColLetter = getColLetter_(map, 'Date');
var durationColLetter = getColLetter_(map, 'Duration');

// Constructs dynamic formula without hardcoded column letters:
var totalHoursFormula = '=SUM(' + durationColLetter + '5:' + durationColLetter + ')';
```

### 3.2 Registered Named Ranges
* `LOOKUP_EQUIPMENT_CATS` (`Config!$E$3:$E`)
* `LOOKUP_FLIGHT_STATUSES` (`Config!$F$3:$F`)
* `LOOKUP_FLIGHT_TYPES` (`Config!$G$3:$G`)
* `LOOKUP_XC_CLASSES` (`Config!$H$3:$H`)
* `LOOKUP_ACTIVE_WINGS` (`Config!$K$3:$K` via `=IFERROR(SORT(FILTER(...)))`)
* `LOOKUP_ACTIVE_HARNESSES` (`Config!$L$3:$L`)
* `LOOKUP_ACTIVE_RESERVES` (`Config!$M$3:$M`)
* `DASHBOARD_REVIEW_FILTER` (`Dashboard!$B$2`)

### 3.3 Soft Protection Architecture
```javascript
function applySoftGuardrail_(range, description) {
  var protection = range.protect().setDescription(description);
  protection.setWarningOnly(true); // Triggers native warning without locking users out
}
```

---

## 4. Implementation & Code Mapping

* **Configuration Maps**: [`Code/Config.gs`](../../Code/Config.gs)
* **Scaffolding & Guardrails Engine**: [`Code/Scaffold.gs`](../../Code/Scaffold.gs)
* **Automated Unit Tests**: [`tests/Test.gs`](../../tests/Test.gs) (`testDashboardAndSchema_`, `testDynamicFormulaResilience_`, `testNativeSheetsResilience_`)
