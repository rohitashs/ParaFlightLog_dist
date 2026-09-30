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
- [x] **Status**: Completed | **Date**: 2026-09-29 | **Imp**: Medium | **Description**: Review and align `Technical_Specification.md` with active codebase per doc_check audit.
- [ ] **Status**: Open | **Date**: 2026-02-10 | **Imp**: Low | **Description**: Verify if `Reference` folder can be fully archived/deleted.
- [x] **Status**: Completed | **Date**: 2026-09-29 | **Imp**: Medium | **Description**: Refactor code based on `Plans/CodeCheckReports/2026-02-13_CodeCheck.md` & `2026-09-29_CodeCheck.md` (Ingestion modularized into `FileHandling.gs`, XContest rollover fixed, `Utils.gs` extraction).
- [ ] **Status**: Open | **Date**: 2026-02-13 | **Imp**: High | **Description**: **Ways of Working**: Discuss and refine artifact storage policy. Ensure all important files/artifacts are stored WITHIN the project directory for portability across multiple computers. Stop using local `brain` directory for permanent storage.

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

- [x] **RQ-ING-003** | **Status**: Implemented | **Phase**: 1 | **Description**: **Master Log Folder**: Add `MASTER_LOG_FOLDER_ID` param. Add Menu to set folder. Auto-copy valid IGCs, rename standardized, and set public permission ("Anyone with link").

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
    
- [x] **RQ-SCR-003** | **Status**: Implemented | **Phase**: 1 | **Description**: **XContest Verification**: Check if flight is already uploaded to XContest (via daily score scrape). Requires `XCONTEST_USERNAME` config. Refined: Match Date + Duration + Start Time rollover.

- [x] **RQ-SCR-004** | **Status**: Implemented | **Phase**: 2 | **Description**: **Historical Weather Enrichment**: Automatically prepopulate weather fields (`Wind@Launch`, `Wind@Landing`, `Cloud %`, `Cloudbase`, `Temp (C)`, `Observations`) based on flight date/time and coordinates from Open-Meteo (primary with 7-day forecast fallback) and Visual Crossing (backup), editable by the pilot.
    - [x] **RQ-SCR-004.1** | **Status**: Implemented | **Phase**: 2 | **Description**: Historical Weather API Integration (Open-Meteo archive & forecast fallback, Visual Crossing Timeline backup, `WEATHER_PROVIDERS`, `VISUAL_CROSSING_API_KEY`).
    - [x] **RQ-SCR-004.2** | **Status**: Implemented | **Phase**: 2 | **Description**: Ingestion & Bulk Maintenance Integration (automatic population on import and maintenance backfill).

### 🔧 Module: UI & System (SYS)
- [x] **RQ-SYS-001** | **Status**: Implemented | **Phase**: 1 | **Description**: Configuration & Architecture
    - [x] **RQ-SYS-001.1** | **Status**: Implemented | **Phase**: 1 | **Description**: Parameter Sheet.
    - [x] **RQ-SYS-001.2** | **Status**: Implemented | **Phase**: 1 | **Description**: Equipment Management.

- [x] **RQ-SYS-002** | **Status**: Implemented | **Phase**: 1 | **Description**: User Interface
    - [x] **RQ-SYS-002.1** | **Status**: Implemented | **Phase**: 1 | **Description**: 2-Row Headers & Grouping.
    - [x] **RQ-SYS-002.2** | **Status**: Implemented | **Phase**: 1 | **Description**: Menu Actions & Dialogs.

- [x] **RQ-SYS-003** | **Status**: Implemented | **Phase**: 1 | **Description**: **SeeYou Cloud Link**: Integration with SeeYou Cloud for visualization. Add "View Flight" column with generated link (`https://seeyou.cloud/api/open?igc=<drive_link>`).
- [ ] **RQ-SYS-004** | **Status**: In Progress | **Phase**: 1 | **Description**: **Flight Inspector**: Sidebar to view and edit flight details. Sections color-coded to match current sheet. Replaces manual entry blank row macro.
- [x] **RQ-SYS-005** | **Status**: Implemented | **Phase**: 1 | **Description**: **Flight Dashboard**: High-level visual metrics (Flights, Hours, Distance), Top 5 Lists (Duration/Distance/Site), and Recent Activity with live sheet formulas in the `Dashboard` tab.
- [ ] **RQ-SYS-006** | **Status**: Partially Implemented | **Phase**: 2 | **Description**: **User Guide & Onboarding**: Add an in-app `User Guide` tab in the Google Sheet (Overview, Setup, Maintenance, Usage, Metric Explanations) and an external standalone document for pre-creation reading.
    - [x] **RQ-SYS-006.1** | **Status**: Implemented | **Phase**: 2 | **Description**: In-App `User Guide` Sheet Tab (Overview, Setup, Normal Usage, Maintenance, and Comprehensive Metric Dictionary grouped by Flight Info, XC Scoring, Analytics, Physics, Geo, and Weather).
    - [ ] **RQ-SYS-006.2** | **Status**: Open | **Phase**: 2 | **Description**: External User Guide document for pre-sheet setup onboarding.
- [x] **RQ-SYS-007** | **Status**: Implemented | **Phase**: 2 | **Description**: **Flight Maintenance & Bulk Operations**: Unified modal dialog to configure scope (All vs Selected) and multi-select batch operations (Recompute metrics/analysis, Re-score XC, Backfill missing Geo, Re-verify XContest, Backfill Historical Weather, Sort by Date).
    - [x] **RQ-SYS-007.1** | **Status**: Implemented | **Phase**: 2 | **Description**: Unified `FlightMaintenanceDialog.html` (Scope selector, checkboxes for operations including weather backfill, progress bar).
    - [x] **RQ-SYS-007.2** | **Status**: Implemented | **Phase**: 2 | **Description**: Batch Recompute & Backfill engine with client-side stepping, rate limiting, and row update logic.
- [ ] **RQ-SYS-008** | **Status**: Open | **Phase**: 2 | **Description**: **New Instance Setup Wizard & Sheet Templating**: Evaluate and implement simplified distribution/onboarding to replace the manual `Setup_Guide.md` process (e.g., Template copy + interactive setup wizard).
    - [ ] **RQ-SYS-008.1** | **Status**: Open | **Phase**: 2 | **Description**: Templating Architecture Evaluation (Template Copy with pre-bound script vs. Clasp deployment script vs. Workspace Add-on).
    - [ ] **RQ-SYS-008.2** | **Status**: Open | **Phase**: 2 | **Description**: Interactive First-Time Setup Wizard modal (step-by-step folder selection, pilot profile, equipment defaults, trigger install).
- [ ] **RQ-SYS-009** | **Status**: Partially Implemented | **Phase**: 2 | **Description**: **Pilot Profile Management**: Dedicated `Pilot_Profile` tab for personal/contact info, ratings, club/org memberships (USHPA, BHPA, FAI, clubs), emergency contacts, Garmin inReach & live tracking links, and medical evacuation insurance.
    - [x] **RQ-SYS-009.1** | **Status**: Implemented | **Phase**: 2 | **Description**: In-App `Pilot_Profile` Sheet Tab (Structured key-value fields and free-form notes).
    - [ ] **RQ-SYS-009.2** | **Status**: Open | **Phase**: 2 | **Description**: Dashboard & Inspector Integration (surface pilot name, rating/club, and inReach emergency links).

---

## 4. Change Requests (`CR`)
*Enhancements to Implemented Requirements.*

- [x] **CR-CFG-004** | **Status**: Implemented | **Date**: 2026-09-29 | **Req**: RQ-ING-001 | **Description**: **Multiple Watch Folders**: Enhance `WATCH_FOLDER_ID` to support multiple comma-separated Folder IDs with options to replace or append to the list.
- [x] **CR-UI-014** | **Status**: Implemented | **Date**: 2026-09-29 | **Req**: RQ-SYS-002 | **Description**: **In-App Drive Folder Picker**: Native HTML modal dialog to browse and select Drive folders for parameters (`WATCH_FOLDER_ID`, `UPLOAD_FOLDER_ID`, `MASTER_LOG_FOLDER_ID`, `ERROR_FOLDER_ID`) with human-readable path enrichment `[Path: ...]` in Column C (`Description`).
- [x] **CR-ING-004** | **Status**: Implemented | **Date**: 2026-09-29 | **Req**: RQ-ING-001 | **Description**: **Recursive Folder Traversal & File Cleanup**: Process supported files (.igc, .zip, .gz) in root and nested subfolders (up to 10 levels). Automatically copy valid IGCs to Master Folder, move invalid/corrupt files to Error Folder, and clean up source folders.
- [x] **CR-UI-015** | **Status**: Implemented | **Date**: 2026-09-29 | **Req**: RQ-SYS-002 | **Description**: **Master Folder Links & Direct IGC Download**: Dynamic `=HYPERLINK(...)` to Master Log folder in `Flights` cell A2 and `Dashboard` row 2. Wrap `Flight No` formula with direct download hyperlink for the master IGC file, and add header tooltips via cell notes on Row 4.
- [x] **CR-UI-016** | **Status**: Implemented | **Date**: 2026-09-29 | **Req**: RQ-SYS-002 | **Description**: **Enhanced URL & Drive Import**: Renamed menu item to "Add files from URL (folder, igc, zip)...". Added Option A (paste URL/ID) and Option B (browse Drive folder), dynamic folder item highlighting, and optional "Delete files from source" checkbox (default unchecked).
- [x] **CR-UI-013** | **Status**: Implemented | **Date**: 2026-02-13 | **Req**: RQ-SYS-002 | **Description**: **Ingestion Progress Dialogs**: Update all ingestion dialogs (Scan, URL, Upload) to show real-time progress (Start, Processing X/Y, Summary) instead of just generic loading.
- [ ] **CR-UI-012** | **Status**: Open | **Date**: 2026-02-10 | **Req**: RQ-SYS-002 | **Description**: **Quick Action Buttons**: Add buttons (Drawings/Images) to `Flights` sheet header for common tasks (Upload, Scan, Add Manual).
- [ ] **CR-LOG-003** | **Status**: Open | **Date**: 2026-02-09 | **Req**: RQ-ING-002 | **Description**: **Enhance Logging**: General improvements to logging visibility (Files processed, specific errors, summary stats).

- [x] **CR-UI-004** | **Status**: Implemented | **Date**: 2026-02-13 | **Req**: RQ-SYS-002 | **Description**: **Menu Restructure**: Rename `Setup` to `Admin`, `Scaffold` to `First Time Setup`. Add Admin tools.
- [ ] **CR-CFG-002** | **Status**: Open | **Date**: 2026-02-08 | **Req**: RQ-SCR-001 | **Description**: **Configurable RDP Tolerance**: Make Ramer-Douglas-Peucker tolerance configurable (Move from `Scoring.gs` and make it a parameter).
- [x] **CR-GEO-001** | **Status**: Implemented | **Date**: 2026-02-08 | **Req**: RQ-SCR-002 | **Description**: **Multi-Provider Geo**: Support comma-separated providers for RevGeo and Sites (added `paragliding_earth` as primary with `overpass_api` fallback).
- [x] **CR-CODE-001** | **Status**: Implemented | **Date**: 2026-09-29 | **Req**: RQ-SYS-001 | **Description**: **Centralize Common Utilities**: Create `Utils.gs` for shared Math/Haversine functions.

- [x] **CR-CFG-003** | **Status**: Implemented | **Date**: 2026-02-09 | **Req**: RQ-SYS-001 | **Description**: **Watch Folder Toggle**: Add `ENABLE_WATCH_FOLDER` param and Menu toggles. Update trigger logic.
- [x] **CR-ING-002** | **Status**: Implemented | **Date**: 2026-02-09 | **Req**: RQ-ING-001 | **Description**: **File Upload UI**: New "Add Flight from Upload" menu with multi-file picker. Uploads to `UPLOAD_FOLDER_ID`.
- [x] **CR-UI-005** | **Status**: Implemented | **Date**: 2026-02-09 | **Req**: RQ-SYS-002 | **Description**: **Dialog Usability**: Support "Enter" key for OK in all input dialogs.
- [x] **CR-CFG-001** | **Status**: Implemented | **Date**: 2026-02-09 | **Req**: RQ-SYS-001 | **Description**: **Lookups Refactor**: Group parameters by section, add warnings/descriptions, split Geo providers.
- [x] **CR-LOG-002** | **Status**: Implemented | **Date**: 2026-02-09 | **Req**: RQ-ING-002 | **Description**: **Clean Notes**: Ingestion should leave `Flight Notes` blank; detailed errors go to `Import_Log` (or System Notes column).
- [x] **CR-ING-001** | **Status**: Implemented | **Date**: 2026-02-09 | **Req**: RQ-ANA-002 | **Description**: **Landing Time Fallback**: If IGC misses landing time, calculate `Launch + Duration`.
- [x] **CR-UI-002** | **Status**: Implemented | **Date**: 2026-02-09 | **Req**: RQ-SYS-002 | **Description**: **Data Formatting**: Round Speed/Dist/Alt/Score (1 dec), % (2 dec), Times (nearest min).
- [x] **CR-LOG-001** | **Status**: Implemented | **Date**: 2026-02-09 | **Req**: RQ-ING-002 | **Description**: **Enhanced Logging**: Append partial failures (e.g. Geo errors) to `Import_Log` Notes.

- [ ] **CR-UI-001** | **Status**: Blocked | **Date**: 2026-02-08 | **Req**: RQ-SYS-002 | **Description**: **Smart Chip Dropdowns**: Use new Oval/Chip style. *Blocked by Apps Script API limitations*.
- [x] **CR-ADM-001** | **Status**: Implemented | **Date**: 2026-02-13 | **Req**: RQ-SYS-001 | **Description**: **Backup Parameters**: Include `Parameters` sheet in `Admin: Backup Data` menu routine.
- [x] **CR-ADM-002** | **Status**: Implemented | **Date**: 2026-09-30 | **Req**: RQ-SYS-001 | **Description**: **Backup Data Enhancement**: Include `Lookups` tab in `Admin: Backup Data` so all 5 essential data tabs (`Flights`, `Pilot_Profile`, `Equipment`, `Parameters`, `Lookups`) are backed up.
- [x] **CR-SYS-001** | **Status**: Implemented | **Date**: 2026-09-30 | **Req**: RQ-SYS-005 | **Description**: **Dashboard Finalization**: Replaced placeholder KPI values with live formulas (Total Flights, Total Hours, Total Distance, Flights this year) and dynamic QUERY formulas for Top 5 Duration, Top 5 Distance, Recent Flights, and Countries Flown.

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
- [x] **Bug-GEO-002** | **Status**: Fixed | **Date**: 2026-02-08 | **Req**: RQ-SCR-002 | **Description**: **Missing Location Data**: Launch/Land Site, Town, Region empty due to Overpass rate limits. Fixed with Paragliding Earth integration.
- [ ] **Bug-UI-003** | **Status**: Open | **Date**: 2026-02-12 | **Req**: RQ-SYS-001 | **Description**: **Parameter Date/Time Formats**: Dropdowns for `DATE_FORMAT` and `TIME_FORMAT` in Parameters tab showing values incorrectly (e.g. number instead of string) or empty.
- [x] **Bug-UI-004** | **Status**: Fixed | **Date**: 2026-02-13 | **Req**: RQ-SYS-004 | **Description**: **Sidebar Text Wrap**: Long values in Flight Inspector are not wrapping, making them unreadable. **Fix**: Used textarea for long fields, reduced font size, and implemented 6-col grid layout.
- [ ] **Bug-SCR-002** | **Status**: Open | **Date**: 2026-02-13 | **Req**: RQ-SCR-003 | **Description**: **XContest No Match**: Valid flights (3 known) are not matching. Troubleshooting required (Duration/Time tolerance or date parsing issue?).
- [x] **Bug-ING-004** | **Status**: Fixed | **Date**: 2026-09-30 | **Req**: RQ-ING-001 | **Description**: **URL/Drive Import Master/Error Copy & Cleanup**: Resolved master log file copying and download link creation by auto-resolving/creating master and error folders (`getOrCreateFolder_`), sanitizing raw IDs and URLs (`cleanDriveId_`), and enforcing that unsuccessful files copy to error folder while keeping source intact when checkbox is unchecked.
