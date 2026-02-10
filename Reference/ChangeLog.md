# Project Change Log

## [v0.7.11] - 2026-02-09
### Fixed
- **Notes Logic**: Updated `insertFlightRow_` to properly capture System Notes (Geo Errors, Validation Warnings) in the "Notes" column instead of leaving it blank.
- **Watch Folder UI**: Removed redundant "Scanning in background" toast. Updated Alert to show "Flights Created" count.

## [v0.7.10] - 2026-02-09
### Fixed
- **Config Logic**: Fixed a critical bug in `getParameters_` where Boolean `TRUE` was coerced to Number `1`, causing the "Enable Watch Folder" check to fail. Configuration now strictly respects Boolean types.

## [v0.7.9] - 2026-02-09
### Fixed
- **Parameter Migration**: Updated `Scaffold.gs` to map legacy "Friendly Names" (e.g. "Enable Watch Folder") to System Keys (`ENABLE_WATCH_FOLDER`) during sheet updates, preventing user settings from being wiped or ignored.

## [v0.7.8] - 2026-02-09
### Fixed
- **Watch Folder Crash**: Fixed a silent failure caused by a missing helper function (`isHashSeen_`) in the deduplication logic.

## [v0.7.6] - [v0.7.7] - 2026-02-09
### Added
- **Debug Logging**: Added verbose logging to Watch Folder scan.
- **Verbose Alerts**: Updated Scan Alert to show detailed file counts (Processed/Skipped/Errors).

## [v0.7.5] - 2026-02-09
### Fixed
- **Upload Reporting**: Upload dialog now accurately reports the number of flights created from ZIP files (e.g. "3 flights created" instead of "1 file processed").

## [v0.7.4] - 2026-02-09
### Fixed
- **Multi-File Upload**: Replaced flaky form submission with Client-Side `FileReader` strategy. Files are now read in the browser and sent as Base64, resolving the issue where only the first file was processed.

## [v0.7.3] - 2026-02-09
### Fixed
- **Geo Validation**: Switched default Reverse Geocoding provider to `big_data_cloud` (prioritizing it over `nominatim`) to resolve "Address unavailable" errors.
- **Upload Logic**: Improved robustness of server-side file loop (precursor to v0.7.4).

## [v0.7.2] - 2026-02-09
### Fixed
- **URL Import Hang**: Implemented missing `handleUrlImportAction` in `Ingestion.gs`, fixing the infinite loading state.
- **XC Scoring**: Fixed a regression where XC Distance, Score, and Points were not populating.

## [v0.7.1] - 2026-02-09
### Fixed (Regressions)
- **Column Grouping**: Restored functionality in `Scaffold.gs`. Configured `Flight Info` to be expanded (4 cols visible) and others collapsed (1 col visible) by default.
- **Parameters**: Centralized all parameter definitions in `Config.gs`. `Scaffold.gs` now dynamically populates the Parameters sheet, restoring missing rows.
- **Equipment**: Limited validation and formatting to top 50 rows (`dataEndRow`) to improve performance.

### Added (Admin Tools)
- **Backup**: New "Admin: Backup Data" menu to copy Flights/Equipment to backup tabs.
- **Reformat**: New "Admin: Reapply Formatting" menu to fix headers/colors without altering data.
- **Reset**: New "Admin: Delete System Sheets" menu for clean restarts.
- **Menu Update**: Renamed "Update Validation" to "Admin: Update Validation & Params" to reflect that it now syncs parameters too.

## [v0.7.0] - 2026-02-08
### Added
- **Workflows**: Added automated workflows for Code Check, Sync Project, and Session Summary.
- **Config.gs**: Dedicates file for Global Configuration (`CFG`) and Tab Definitions (`TABS`).
- **Scaffold.gs**: Dedicated file for all Sheet creation, layout, and validation logic.

### Changed
- **Refactoring**: Extracted Scaffolding and Validation logic from `Code.gs` to `Scaffold.gs`.
- **Refactoring**: Centralized configuration in `Config.gs` (replaced scattered `CFG` objects).
- **Renaming**: Standardized naming convention `Lookup` -> `Parameter` (e.g. `getParameters_`).
- **Optimization**: Validation logic (`applyFlightsValidation_`) now limits range to `dataStartRow` to `dataEndRow` (configurable) to improve performance.
- **Source of Truth**: `Backlog.md` is now the single source of truth for Requirements and Bugs.

## [v0.6.4] - 2026-02-08
### Fixed
- **Parameter Validation**: Fixed `Update Watch/Upload Folder` menu actions to correctly target the `Parameters` sheet instead of the legacy `Lookups` sheet.

## [v0.6.3] - 2026-02-08
### Fixed
- **Flight Type Validation**: Fixed a `TypeError` where `getSheetByName` was called on the Sheet object instead of the Spreadsheet object.

## [v0.6.2] - 2026-02-08
### Fixed
- **Flight Type Validation**: Switched dropdown to use a filtered List of values instead of a Range, preventing blank rows from cluttering the dropdown.
- **Equipment Category Dropdown**: Fixed range to `A3:A` to exclude the "Categories" header from the dropdown list.
- **Validation Helper**: Added `applyEquipmentValidation_` and linked it to `updateValidationOnly_` for easier maintenance.

## [v0.6.1] - 2026-02-05
### Fixed
- **Scaffolding Robustness**: Overhauled `scaffoldFlights_` to prevent "Service Spreadsheets failed" errors.
    - Implemented batch header writing.
    - Added comprehensive error handling (Try/Catch) for group creation.
    - Added `Utilities.sleep(800)` throttling between column groups to avoid API rate limits.
    - Deferred "Freeze Rows" to the end of the process.
- **Import Failures**: 
    - Fixed `row is not defined` ReferenceError in `Ingestion.gs` by restoring missing row initialization logic.
    - Fixed "Grouping" logic to ensure all multi-column categories (XC Scoring, Launch, etc.) are grouped, not just default-collapsed ones.
    - Fixed "Drive Link Import" regex for 401 Unauthorized errors.

## [v0.6.0] - 2026-02-02
### Added
- **Manual Flight Entry**: Menu item to create valid blank rows with System Time and Default Gear.
- **Auto-Summary**: Logic to generate "Duration, Dist, Site" string (e.g. "1.2 hrs Free Fly at Dunlap").
- **Time Zone**: Added Time Zone column (defaults to UTC).
- **Daily Flight IDs**: New format `FYYYYMMDD_nn` which auto-increments based on existing flights that day.

### Changed
- **Column Layout**: `FlightID` moved to Column 1. Added `Notes` column (Col 5). `Alt` moved to start of Launch/Land groups.
- **UI Styling**: Header Row 5 now matches Group Colors. Rows 4 & 5 are Bold.
- **Validation**: Fixed dropdown mappings for new column structure.

## [v0.5.0] - 2026-02-01
### Added
- **UI Enhancement**: Implemented 2-Row Header layout (Category + Column) with color coding.
- **Column Grouping**: Added "Flight Info", "Gear", "XC Scoring", "Launch", "Landing", "Weather", "Analytics", "Validation", "Meta" groups.
- **Equipment Defaults**: Added logic to look up default checkbox selections from Equipment sheets (Wings, Harnesses, Reserves).
- **Flight ID**: Implemented Short ID format `F_YY_XXXX` (e.g., `F_26_A9B3`).
- **Scaffolding**: Created `scaffoldFlights_` to generate the new sheet structure automatically.

### Changed
- **Project Structure**: Reorganized files into `Code/`, `Docs/`, `Plans/`, `Reference/`.
- **Source Control**: Moved `appsscript.json` to `Code/` key and updated `.clasp.json`.

## [v0.1.0] - Initial MVP
### Added
- **Core Modules**:
    - `Parser.gs`: IGC file parsing (Headers, B-records).
    - `Analysis.gs`: Flight mode detection (Thermal, Soar, Glide, Sink) and statistics.
    - `Scoring.gs`: XC Scoring (Free Distance, Triangle optimization).
    - `Geo.gs`: Reverse Geocoding and Site Detection (OSM/Nominatim) with caching.
    - `Ingestion.gs`: Watch Folder scanning, Deduplication (MD5), and Manual Import.
- **Testing**: Added `Test.gs` with unit tests for core modules.
