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
    
- [x] **RQ-SCR-003** | **Status**: Implemented | **Phase**: 1 | **Description**: **XContest Verification & Identifier Linking**: Check if flight is uploaded to XContest via Direct Flight Probing (UTC flight date + launch time candidates). Requires `XCONTEST_USERNAME`. If verified, links permanent flight ID (`XC#6952654`). If unverified, evaluates against Rule 3.1 14-day competition claiming deadline (`Claim soon!` vs `Expired`).

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
- [x] **CR-SYS-002** | **Status**: Implemented | **Date**: 2026-09-30 | **Req**: RQ-SYS-005 | **Description**: **Dashboard Layout & Insertion Resiliency**: Redesigned Dashboard to compact 8-column layout (`A` to `H`), with 2-cell wide KPI cards (`A3:B5`, `C3:D5`, `E3:F5`, `G3:H5`), and a 2-column card grid (2 + 2 + 1: Duration & Distance, Recent & Sites, Countries Flown). Replaced direct range formulas with string-literal `INDIRECT("Flights!..." & startRow & ":...")` formulas immune to row insertions (`insertRowBefore(5)`). Implemented airtime hour calculation via `SUMPRODUCT(TIMEVALUE(...) * 24)` and corrected shifted column letters (`AL` for Launch Site, `AN` for Launch Country). Added `Admin: Refresh Dashboard` (`uiRefreshDashboard_`) menu action.
- [x] **CR-UI-017** | **Status**: Implemented | **Date**: 2026-09-30 | **Req**: RQ-SYS-002 | **Description**: **Frozen Columns on Flights Sheet**: Configured frozen columns through Column D (`Auto Summary`, 4 columns frozen) in `Config.gs` (`TABS.FLIGHTS.frozenCols`), `scaffoldFlights_`, and `reapplyFormatting_` to keep Flight No, Flight ID, Date, and Summary visible during horizontal scrolling.
- [x] **CR-UI-018** | **Status**: Implemented | **Date**: 2026-09-30 | **Req**: RQ-SYS-006 | **Description**: **User Guide Refresh Menu Action**: Added interactive `Flight Log > Admin > Admin: Refresh User Guide Tab` (`uiRefreshUserGuide_`) menu action to safely re-scaffold the `User Guide` tab on demand.
- [x] **CR-SCH-001** | **Status**: Implemented | **Date**: 2026-09-30 | **Req**: RQ-SYS-001 | **Description**: **Streamline Schema & Dropdowns**: Eliminated redundant `Launch-Landing Dist (km)` from Landing group and unused gear snapshot baselines (`GlideRatio_LD (snap)`, `Trim_kmh (snap)`, `FullBar_kmh (snap)`) from Gear group. Eliminated `FLIGHT_TYPES` from `Parameters` (redundant with `Lookups` tab). Removed yellow input shading from XContest tolerance parameters.

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
- [x] **Bug-UI-003** | **Status**: Fixed | **Date**: 2026-09-30 | **Req**: RQ-SYS-001 | **Description**: **Parameter Date/Time Formats**: Eliminated trailing blank options in dropdowns by sizing validation ranges to exact list lengths in `Lookups` (`I3:I7` for `DATE_FORMAT`, `J3:J4` for `TIME_FORMAT`). Set explicit Plain Text (`@`) number format on format cells in `Parameters` and `Lookups`. Protected `getParameters_()` from coercing date/time format strings to numbers or Date objects.
- [x] **Bug-UI-004** | **Status**: Fixed | **Date**: 2026-02-13 | **Req**: RQ-SYS-004 | **Description**: **Sidebar Text Wrap**: Long values in Flight Inspector are not wrapping, making them unreadable. **Fix**: Used textarea for long fields, reduced font size, and implemented 6-col grid layout.
- [x] **Bug-SCR-002** | **Status**: Fixed | **Date**: 2026-09-30 | **Req**: RQ-SCR-003 | **Description**: **XContest Verification & Identifier Linking**: Resolved issue where valid flights on XContest were not matching due to XContest migrating pilot profile tables to client-side JS with Cloudflare Turnstile token verification, UTC vs local time discrepancies, and incorrect URL patterns. Implemented Direct Flight Probing in `Code/XContest.gs` using UTC flight date and UTC launch time candidates (+/- 2 min tolerance), with UTC midnight protection preventing Western hemisphere timezone date rollbacks. When found, extracts the permanent internal XContest flight ID (`fl=...`) to format the cell as a clickable hyperlink with label (e.g. `=HYPERLINK(url, "XC#6952654")`). For unmatched flights, automatically evaluates against XContest Rule 3.1 (14-day competition claim deadline), populating `'Claim soon!'` if within 14 days and `'Expired'` if older than 14 days. Added audit note logging in `Code/Ingestion.gs` when `XCONTEST_USERNAME` is blank in `Parameters`. Integrated across Ingestion and Maintenance routines.
- [x] **Bug-ING-004** | **Status**: Fixed | **Date**: 2026-09-30 | **Req**: RQ-ING-001 | **Description**: **Strict Pre-Flight Folder Validation & Source Deletion Behavior**: Resolved IGC master copying, download link generation, and error isolation without ever creating folders in Google Drive root. The `Parameters` sheet is the sole authority for folder configuration (`MASTER_LOG_FOLDER_ID`, `ERROR_FOLDER_ID`, `UPLOAD_FOLDER_ID`, and `WATCH_FOLDER_ID`); missing or inaccessible folders immediately abort ingestion with clear user-facing error dialogs (`validateRequiredFolders_`). Enforced exact `URL_CUSTOM` cleanup behavior: unchecked "Delete from source" preserves all Drive source files while copying successful files to Master Log and unsuccessful files to Error Folder; checked "Delete from source" trashes source files after copying. Sanitized Drive IDs/URLs (`cleanDriveId_`) and restored download links during maintenance.
- [x] **Bug-SYS-005** | **Status**: Fixed | **Date**: 2026-09-30 | **Req**: RQ-SYS-007 | **Description**: **Flight Maintenance Scope & Empty Row Detection**: Resolved issue where "All Flights" always reported 20 flights regardless of actual flight count (even when 0 or 9 flights existed) due to `sheet.getLastRow()` including scaffolded data validation rows (rows 5–24). Implemented `getActualFlightRows_(sh)` to inspect the `FlightID` column using `getDisplayValues()` and filter strictly for populated flight rows (`row >= 5` with non-empty `FlightID`). Updated `getMaintenanceScopeInfo()` and `getMaintenanceTargetRows(scope)` to use real flight rows, updated `sortFlightsByDate_()` to bound sort and formula ranges to actual flight rows, and updated `FlightMaintenanceDialog.html` to display a badge warning and disable the Run button when 0 flights exist or when an empty selection is made.
- [x] **Bug-UI-005** | **Status**: Fixed | **Date**: 2026-09-30 | **Req**: RQ-SYS-002 | **Description**: **Manual Flight Status Validation Mismatch**: In `uiAddManualFlight_()`, blank manual flight row insertion wrote Status as `"Needs Review"`, which violated data validation (allowed: `Review?`, `Valid`, `Invalid`). Changed to `'Review?'` to align with dropdown validation and ingestion default.
- [x] **Bug-UI-006** | **Status**: Fixed | **Date**: 2026-09-30 | **Req**: RQ-SYS-002 | **Description**: **Empty Dropdowns for Flight Type and XC Flight Class**: `Flight Type` and `XC Flight Class` validation rules were blank/empty. Bound validation to dynamic ranges on `Lookups` tab (`Lookups!G3:G` for Flight Type, `Lookups!H3:H` for XC Flight Class) and ensured `scaffoldLookups_` runs prior to `scaffoldFlights_` during setup.
- [x] **Bug-UI-007** | **Status**: Fixed | **Date**: 2026-09-30 | **Req**: RQ-SCR-001 | **Description**: **Closed? Column Validation Mismatch**: Ingestion and maintenance populated `'Yes'` / `'No'`, but initial scaffold and manual row creation inserted checkboxes, causing validation mismatches. Replaced checkbox validation on `Closed?` with list validation `['Yes', 'No']` and defaulted manual blank rows to `'No'`.
- [x] **Bug-SYS-006** | **Status**: Fixed | **Date**: 2026-09-30 | **Req**: RQ-SYS-005 | **Description**: **Dashboard Formula Breakage on Ingestion**: Adding new flights shifts `Flights!A5:A` to `Flights!A6:A` because Google Sheets expands/shifts formulas on `insertRowBefore(5)`. Total hours formula also failed due to duration text formatting and shifted column letters from Phase 2 weather additions. Fixed via `INDIRECT` formulas, `TIMEVALUE` math, and column realignments.

