# Project Backlog (Source of Truth)

## 1. Description
This file is the single source of truth for **ToDos**, **Requirements**, **Change Requests (CRs)**, and **Bugs**.

### Numbering Schema
*   **Requirements**: `RQ-{Module}-{Number}` (Nested).
*   **Change Requests**: `CR-{Module}-{Number}`.
*   **Bugs**: `Bug-{Module}-{Number}`.

### Status Flags
*   **Requirements**: `Open`, `Implemented` (All children done), `Partially Implemented` (Some children done), `Future`, `Blocked`, `Discarded`.
*   **CRs/Bugs**: `Open`, `Implemented` / `Fixed`, `Blocked`, `Discarded`, `Future`.
*   **ToDos**: `Open`, `WIP`, `Completed`, `Discarded`.

---

## 2. ToDos
*Tasks for the future, mostly for the developer.*
- [ ] **Status**: Open | **Date**: 2026-02-10 | **Imp**: Medium | **Description**: Review `Technical_Specifications.md` to ensure full alignment with v0.7.11 code.
- [ ] **Status**: Open | **Date**: 2026-02-10 | **Imp**: Low | **Description**: Verify if `Reference` folder can be fully archived/deleted.

---

## 3. Requirements (`RQ`)
*Nested Features mapping to Modules.*

### 📂 Module: Ingestion (ING)
- [x] **RQ-ING-001** | **Status**: Implemented | **Phase**: 1 | **Description**: File Import & Parsing
    - [x] **RQ-ING-001.1** | **Status**: Implemented | **Phase**: 1 | **Description**: Manual File Upload (Multi-file support).
    - [x] **RQ-ING-001.2** | **Status**: Implemented | **Phase**: 1 | **Description**: Watch Folder Scanning (Drive).
    - [x] **RQ-ING-001.3** | **Status**: Implemented | **Phase**: 1 | **Description**: URL Import (Drive Links).
    - [ ] **RQ-ING-001.4** | **Status**: Future | **Phase**: 2 | **Description**: Large Scale Ingestion (>5 files queue).

- [x] **RQ-ING-002** | **Status**: Implemented | **Phase**: 1 | **Description**: Data Logging & Quality
    - [x] **RQ-ING-002.1** | **Status**: Implemented | **Phase**: 1 | **Description**: Row Insertion (Top of sheet).
    - [x] **RQ-ING-002.2** | **Status**: Implemented | **Phase**: 1 | **Description**: Duplicate Detection (MD5 + Overlap).
    - [x] **RQ-ING-002.3** | **Status**: Implemented | **Phase**: 1 | **Description**: Validation System (Status/Notes population).

### 📊 Module: Analysis (ANA)
- [x] **RQ-ANA-001** | **Status**: Implemented | **Phase**: 1 | **Description**: Flight Mode Detection
    - [x] **RQ-ANA-001.1** | **Status**: Implemented | **Phase**: 1 | **Description**: Thermal Detection.
    - [x] **RQ-ANA-001.2** | **Status**: Implemented | **Phase**: 1 | **Description**: Soaring Detection.
    - [x] **RQ-ANA-001.3** | **Status**: Implemented | **Phase**: 1 | **Description**: Glide/Sink Detection.

- [ ] **RQ-ANA-002** | **Status**: Partially Implemented | **Phase**: 1 | **Description**: Advanced Metrics
    - [x] **RQ-ANA-002.1** | **Status**: Implemented | **Phase**: 1 | **Description**: Basic Stats (Dur, Alt, Gain).
    - [ ] **RQ-ANA-002.2** | **Status**: Future | **Phase**: 3 | **Description**: Polar Curve Estimation.

### 🏆 Module: Scouting & Scoring (SCR)
- [x] **RQ-SCR-001** | **Status**: Implemented | **Phase**: 1 | **Description**: XC Scoring
    - [x] **RQ-SCR-001.1** | **Status**: Implemented | **Phase**: 1 | **Description**: XContest Rules (Free, Flat, FAI).
    - [x] **RQ-SCR-001.2** | **Status**: Implemented | **Phase**: 1 | **Description**: Multipliers.

- [x] **RQ-SCR-002** | **Status**: Implemented | **Phase**: 1 | **Description**: Geo-Spatial Enrichment
    - [x] **RQ-SCR-002.1** | **Status**: Implemented | **Phase**: 1 | **Description**: Reverse Geocoding (Town/Region).
    - [x] **RQ-SCR-002.2** | **Status**: Implemented | **Phase**: 1 | **Description**: Site Detection (Overpass).

### 🔧 Module: UI & System (SYS)
- [x] **RQ-SYS-001** | **Status**: Implemented | **Phase**: 1 | **Description**: Configuration & Architecture
    - [x] **RQ-SYS-001.1** | **Status**: Implemented | **Phase**: 1 | **Description**: Parameter Sheet.
    - [x] **RQ-SYS-001.2** | **Status**: Implemented | **Phase**: 1 | **Description**: Equipment Management.

- [x] **RQ-SYS-002** | **Status**: Implemented | **Phase**: 1 | **Description**: User Interface
    - [x] **RQ-SYS-002.1** | **Status**: Implemented | **Phase**: 1 | **Description**: 2-Row Headers & Grouping.
    - [x] **RQ-SYS-002.2** | **Status**: Implemented | **Phase**: 1 | **Description**: Menu Actions & Dialogs.

---

## 4. Change Requests (`CR`)
*Enhancements to Implemented Requirements.*

- [ ] **CR-ING-004** | **Status**: Open | **Date**: 2026-02-09 | **Req**: RQ-ING-002 | **Description**: **Master Log Folder**: Add `MASTER_LOG_FOLDER_ID` param. Add Menu to set folder. Auto-copy valid IGCs, rename standardized, and set public permission ("Anyone with link").
- [ ] **CR-UI-009** | **Status**: Open | **Date**: 2026-02-09 | **Req**: RQ-SYS-002 | **Description**: **SeeYou Cloud Link**: Integration with SeeYou Cloud for visualization. Add "View Flight" column with generated link (`https://seeyou.cloud/api/open?igc=<drive_link>`).
- [ ] **CR-UI-010** | **Status**: Open | **Date**: 2026-02-10 | **Req**: RQ-SYS-002 | **Description**: **Manual Flight Form**: HTML Sidebar/Dialog for manual entry (Date, Duration, Notes, Glider) replacing current "Blank Row" macro.
- [ ] **CR-UI-011** | **Status**: Open | **Date**: 2026-02-10 | **Req**: RQ-SYS-002 | **Description**: **Flight Detail View**: Sidebar to view full details of selected flight (Metadata, Stats, Map/Link) in a read-only format.
- [ ] **CR-UI-012** | **Status**: Open | **Date**: 2026-02-10 | **Req**: RQ-SYS-002 | **Description**: **Quick Action Buttons**: Add buttons (Drawings/Images) to `Flights` sheet header for common tasks (Upload, Scan, Add Manual).
- [ ] **CR-LOG-003** | **Status**: Open | **Date**: 2026-02-09 | **Req**: RQ-ING-002 | **Description**: **Enhance Logging**: General improvements to logging visibility (Files processed, specific errors, summary stats).
- [ ] **CR-SCR-003** | **Status**: Open | **Date**: 2026-02-09 | **Req**: RQ-SCR-001 | **Description**: **XContest Verification**: Check if flight is already uploaded to XContest (via API or profile scan).

- [ ] **CR-UI-004** | **Status**: Open | **Date**: 2026-02-08 | **Req**: RQ-SYS-002 | **Description**: **Menu Restructure**: Rename `Setup` to `Admin`, `Scaffold` to `First Time Setup`. Add Admin tools.
- [ ] **CR-CFG-002** | **Status**: Open | **Date**: 2026-02-08 | **Req**: RQ-SCR-001 | **Description**: **Configurable RDP Tolerance**: Make Ramer-Douglas-Peucker tolerance configurable (Move from `Scoring.gs` and make it a parameter).
- [ ] **CR-GEO-001** | **Status**: Open | **Date**: 2026-02-08 | **Req**: RQ-SCR-002 | **Description**: **Multi-Provider Geo**: Support comma-separated providers for RevGeo, Sites, and Timezone.
- [ ] **CR-CODE-001** | **Status**: Open | **Date**: 2026-02-08 | **Req**: RQ-SYS-001 | **Description**: **Centralize Common Utilities**: Create `Utils.gs` for shared Math/Haversine functions.

- [x] **CR-CFG-003** | **Status**: Implemented | **Date**: 2026-02-09 | **Req**: RQ-SYS-001 | **Description**: **Watch Folder Toggle**: Add `ENABLE_WATCH_FOLDER` param and Menu toggles. Update trigger logic.
- [x] **CR-ING-002** | **Status**: Implemented | **Date**: 2026-02-09 | **Req**: RQ-ING-001 | **Description**: **File Upload UI**: New "Add Flight from Upload" menu with multi-file picker. Uploads to `UPLOAD_FOLDER_ID`.
- [x] **CR-UI-005** | **Status**: Implemented | **Date**: 2026-02-09 | **Req**: RQ-SYS-002 | **Description**: **Dialog Usability**: Support "Enter" key for OK in all input dialogs.
- [x] **CR-CFG-001** | **Status**: Implemented | **Date**: 2026-02-09 | **Req**: RQ-SYS-001 | **Description**: **Lookups Refactor**: Group parameters by section, add warnings/descriptions, split Geo providers.
- [x] **CR-LOG-002** | **Status**: Implemented | **Date**: 2026-02-09 | **Req**: RQ-ING-002 | **Description**: **Clean Notes**: Ingestion should leave `Flight Notes` blank; detailed errors go to `Import_Log` (or System Notes column).
- [x] **CR-ING-001** | **Status**: Implemented | **Date**: 2026-02-09 | **Req**: RQ-ANA-002 | **Description**: **Landing Time Fallback**: If IGC misses landing time, calculate `Launch + Duration`.
- [x] **CR-UI-002** | **Status**: Implemented | **Date**: 2026-02-09 | **Req**: RQ-SYS-002 | **Description**: **Data Formatting**: Round Speed/Dist/Alt/Score (1 dec), % (2 dec), Times (nearest min).
- [x] **CR-LOG-001** | **Status**: Implemented | **Date**: 2026-02-09 | **Req**: RQ-ING-002 | **Description**: **Enhanced Logging**: Append partial failures (e.g. Geo errors) to `Import_Log` Notes.

- [ ] **CR-UI-001** | **Status**: Blocked | **Date**: 2026-02-08 | **Req**: RQ-SYS-002 | **Description**: **Smart Chip Dropdowns**: Use new Oval/Chip style. *Blocked by Apps Script API limitations*.

---

## 5. Bugs (`Bug`)
*Defects linked to Requirements or CRs.*

- [x] **Bug-ING-003** | **Status**: Fixed | **Date**: 2026-02-09 | **Req**: RQ-ING-002 | **Description**: **Notes Overwrite**: System Notes (Geo/Validation) were not writing to Notes column.
- [x] **Bug-CFG-002** | **Status**: Fixed | **Date**: 2026-02-09 | **Req**: RQ-SYS-001 | **Description**: **Parameter Mismatch**: Boolean `TRUE` coerced to Number `1` in `getParameters_`.
- [x] **Bug-ING-002** | **Status**: Fixed | **Date**: 2026-02-09 | **Req**: RQ-ING-001 | **Description**: **Watch Folder Silent Fail**: Missing Dedupe Helper + Missing Alert.
- [x] **Bug-SCR-001** | **Status**: Fixed | **Date**: 2026-02-09 | **Req**: RQ-SCR-001 | **Description**: **XC Scoring Missing**: Regression fixed in v0.7.2.
- [x] **Bug-UPL-001** | **Status**: Fixed | **Date**: 2026-02-09 | **Req**: RQ-ING-001 | **Description**: **Upload Fail**: Multi-file upload only processed 1 file.
- [x] **Bug-ING-001** | **Status**: Fixed | **Date**: 2026-02-09 | **Req**: RQ-SYS-002 | **Description**: **Column Shift**: Start Date repeated in TimeZone column.
- [x] **Bug-UI-002** | **Status**: Fixed | **Date**: 2026-02-09 | **Req**: RQ-SYS-002 | **Description**: **Flight No Formula**: `#Ref!` error on row deletion.
- [x] **Bug-GEO-001** | **Status**: Fixed | **Date**: 2026-02-08 | **Req**: RQ-SYS-002 | **Description**: **Timezone Failure**: Time Zone defaults to UTC.
- [x] **Bug-UI-001** | **Status**: Fixed | **Date**: 2026-02-08 | **Req**: RQ-SYS-002 | **Description**: **Dropdown Misalignment**: Status/Gear dropdowns shifted.

- [ ] **Bug-GEO-002** | **Status**: Open | **Date**: 2026-02-08 | **Req**: RQ-SCR-002 | **Description**: **Missing Location Data**: Launch/Land Site, Town, Region are empty (API Rejection?).
