# Project Change Log

## [Unreleased] - Work in Progress
### Fixed
- **Scaffolding Robustness**: Overhauled `scaffoldFlights_` to prevent "Service Spreadsheets failed" errors.
    - Implemented batch header writing.
    - Added comprehensive error handling (Try/Catch) for group creation.
    - Added `Utilities.sleep(800)` throttling between column groups to avoid API rate limits.
    - Deferred "Freeze Rows" to the end of the process.
- **Import Failures**: 
    - Fixed `row is not defined` ReferenceError in `Ingestion.gs` by restoring missing row initialization logic.
    - Fixed "Grouping" logic to ensure all multi-column categories (XC Scoring, Launch, etc.) are grouped, not just default-collapsed ones.
- **Drive Link Import**: Added regex logic to extract File IDs from `drive.google.com/file/d/` URLs to fix 401 Unauthorized errors.

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
