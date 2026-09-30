# Project Change Log

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
