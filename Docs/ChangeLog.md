# Project Change Log

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
*   `[Fixed]` **Bug-UI-001**: Dropdown column alignment.
*   `[Fixed]` **Bug-GEO-001**: Time Zone defaults.

## Session: MVP Implementation
**Date**: Pre-Feb 2026
**Versions**: v0.1.0
**Focus**: Initial Module Creation.

*   `[Imp]` **RQ-ING-001**: IGC Parsing (Headers, B-records).
*   `[Imp]` **RQ-SCR-001**: Basic XC Rules.
*   `[Imp]` **RQ-SCR-002**: Basic Geo integration.
