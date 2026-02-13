# Project Change Log

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
