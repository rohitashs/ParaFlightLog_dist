# Technical Specifications (Source of Truth)

## 1. Overview
This document defines the **Code Organization**, **Algorithms**, and **Data Schema**.
*   **Feature Map**: See `Features.md` for the functional view.
*   **Requirements**: See `Backlog.md` (`RQ-*`).

---

## 2. System Architecture
**Stack**: Google Apps Script (GAS) bound to Google Sheets.
**Patterns**: Service-Oriented (Modules), MVC-lite (Sheet as View).

### Modules (`Code/`)
1.  **Orchestrator (`Code.gs`)**: Entry point. Maps Triggers/Menus to Controllers.
2.  **Config (`Config.gs`)**: Static Definitions (`TABS`, `CFG`).
    *   *Rule*: Never hardcode column indices. Use `Config` maps.
3.  **Scaffold (`Scaffold.gs`)**: View Controller. Creates Sheets/Validations.
    *   *Map*: `RQ-SYS-002`.
4.  **File Handling Service (`FileHandling.gs`)**: Drive I/O, Watch Folder scanning, Staged Uploads, ZIP extractions, File cleanup, and Master Log copying.
5.  **Ingestion Service (`Ingestion.gs`)**: Pipeline Controller. Parse/Score orchestration, deduplication, and row mapping.
    *   *Map*: `RQ-ING-001`.
6.  **Utilities (`Utils.gs`)**: Consolidated math (Haversine, Bearing, AngleDiff) and time formatting helpers.
7.  **Domain Logic**:
    *   **`Parser.gs`**: IGC extraction (B-Records, H-Records).
    *   **`Analysis.gs`**: Physics engine (Thermals, Glide).
    *   **`Scoring.gs`**: Optimization engine (Graph theory/RDP).
    *   **`Geo.gs`**: External API Gateway (Nominatim, Overpass).

---

## 3. Data Schema (`Flights` Tab)
Fixed Header Schema (Row 4=Category, Row 5=Name). Data starts Row 6.

### Primary Column Groups
| Group | Key Fields | Mapping |
| :--- | :--- | :--- |
| **Identity** | `Status`, `Flight No`, `Date`, `Type` | `RQ-ING-002` |
| **Link** | `FlightID` | `RQ-SYS-003` (SeeYou Link) |
| **Gear** | `Wing`, `Harness`, `Reserve` | `RQ-SYS-001` |
| **Scoring** | `XC Score`, `Triangle`, `Points` | `RQ-SCR-001` |
| **Geo** | `Launch Site`, `Land Town` | `RQ-SCR-002` |
| **Metrics** | `Duration`, `Max Alt`, `Gain` | `RQ-ANA-002` |
| **XContest** | `XC Status` | `RQ-SCR-003` |
| **System** | `Import ID`, `Hash`, `Notes` | Validation/Audit |

---

## 4. Algorithms & Logic

### A. Deduplication Strategy (`RQ-ING-002`)
1.  **Hard Dedupe**: MD5 Hash of file content.
2.  **Soft Dedupe (Overlap)**: `New.Start < Existing.End` AND `New.End > Existing.Start`.
3.  **Soft Dedupe (Proximity)**: `StartTime` within 15min AND `Dist` < 500m.

### B. Flight Mode Detection (`RQ-ANA-001`)
*   **Window**: 10s sliding window.
*   **Thermal**: `Vario > 0.3m/s` AND `TurnRate > 8deg/s`.
*   **Soaring**: `Vario > -0.2m/s` AND `HeadingChange > 90deg` (S-Turns).
*   **Glide**: `TurnRate < 5deg/s` AND `Vario < 0.2m/s`.

### C. XC Scoring (`RQ-SCR-001`)
1.  **Simplification**: Ramer-Douglas-Peucker (RDP) epsilon=0.001.
2.  **Optimization**: Brute-force 3 TP max distance.
3.  **Triangle Rules**:
    *   **Flat**: Gap < 20%.
    *   **FAI**: Shortest Leg >= 28%.

### D. XContest Verification (`RQ-SCR-003`)
*   **Method**: `UrlFetchApp` (GET).
*   **Target**: `https://www.xcontest.org/world/en/flights/daily-score-pg/?filter[pilot]={USERNAME}&filter[date]={YYYY-MM-DD}` (or similar).
*   **Caching**: `CacheService` (TTL irrelevant if just check-once on import).

---
---

## 5. Configuration Strategy (`RQ-SYS-001`)
1.  **`Config.gs`**: Defines structural constants (Sheet names, Colors).
2.  **`Parameters` Sheet**: Defines User runtime values (Thresholds, API Keys).
    *   *Priority*: User Sheet Values > Default Config constants.

## 6. API Integrations (`RQ-SCR-002`)
*   **Geocoding**: Chain of Responsibility (`BigDataCloud` -> `Nominatim` -> Fail).
*   **Site Detection**: Chain of Responsibility (`Paragliding Earth` -> `Overpass API` -> Fail).
*   **Caching**: `CacheService` (6 hour TTL) for all external calls.
*   **Visualization**: `SeeYou Cloud` via direct link generation using Master Log file ID.

---

## 7. Detailed Code Reference
*Function-level breakdown of the codebase.*

### `Code.gs` (Orchestration)
*   **`onOpen(e)`**: Creates the "Flight Log" menu.
*   **`getParameters_()`**: Reads configuration from the `Parameters` sheet.
*   **`uiAddManualFlight_()`**: Helper to trigger manual flight entry.
*   **`showUrlDialog_()`**: Shows the IGC URL import dialog.
*   **`showUploadDialog_()`**: Shows the File Upload picker.
*   **`openFolderPicker_(paramKey, title)`**: Opens the in-app Google Drive folder picker dialog.
*   **`getDriveFolderContents_(folderId)`**: Returns child folders and breadcrumb path for Drive folder navigation.
*   **`resolveFolderInput_(input)`**: Verifies and extracts folder metadata from an input URL or raw folder ID.
*   **`getFolderPath_(folder)` / `getMultiFolderPath_(folderIds)`**: Computes human-readable breadcrumb paths (e.g. `My Drive / Paragliding / Logs`).
*   **`saveFolderParam_(paramKey, folderId, mode)`**: Saves folder IDs to the `Parameters` sheet (supports 'replace' or 'append' for multi-folders) and writes breadcrumbs to `Description`.
*   **`uiUpdateWatchFolder_() / uiUpdateUploadFolder_() / uiUpdateMasterLogFolder_() / uiUpdateErrorFolder_()`**: Menu actions triggering the in-app folder picker.
*   **`uiEnableWatch_() / uiDisableWatch_()`**: Toggles the watch folder feature.
*   **`setupWatcherTrigger_()`**: Installs the time-driven trigger for automation.

### `Scaffold.gs` (Setup & Validation)
*   **`scaffoldAll_()`**: Master function to create/repair all sheets (`Dashboard`, `Flights`, etc).
*   **`scaffoldDashboard_(ss)`**: Creates KPI cards and Master Flight Log folder hyperlink in Row 2 (`A2:Q2`).
*   **`scaffoldFlights_(ss)`**: Builds 2-row category headers, sets Master Flight Log folder hyperlink in Cell `A2`, and applies column header notes/tooltips to Row 4 (`colNotes`).
*   **`scaffoldParameters_(ss)`**: Populates parameters with human-readable path enrichment in Column C (`Description`).
*   **`updateValidationOnly_()`**: Re-applies dropdowns and validation rules to `Flights` and `Equipment`.
*   **`applyFlightsValidation_(sh)`**: Applies validation to the top N rows of the Flights sheet.
*   **`ensureSheet_(ss, name)`**: Utility to create a sheet if missing.

### `FileHandling.gs` (Drive & File Pipeline)
*   **`scanWatchFolderNow_()`**: Automation entry point. Iterates over configured `WATCH_FOLDER_ID`s, recursively scans subfolders (up to 10 levels), unpacks archives, invokes processing, and executes automated file cleanup.
*   **`getWatchFolderStatus()`**: Returns folder names and recursive flight counts across multiple watch folders for `ScanDialog.html`.
*   **`stageUpload(fileObj)`**: Unpacks zip/gz archives and stages files to `UPLOAD_FOLDER_ID` for `UploadDialog.html`.
*   **`processFileById(fileId, source, deleteSource)`**: Processes a staged Drive file by ID with context-aware cleanup (Upload/URL/Watch).
*   **`stageUrlOrDriveImport(input)`**: Discovers, fetches, and stages files from external URLs or Drive folder/file IDs for `URLDialog.html`.
*   **`trashSourceFiles(fileIds)`**: Trashes source archives after successful extraction/processing.
*   **`copyToMasterLog_(blob, name, config)`**: Handles public mirroring and duplicate renaming in `MASTER_LOG_FOLDER_ID`.
*   **`getFilesRecursive_(folder, maxDepth, currentDepth)`**: Traverses a Drive folder tree and collects matching flight files (`.igc`, `.igx`, `.zip`, `.gz`).
*   **`getDriveIdFromUrl_(url)`**: Extracts Google Drive file/folder ID from URLs or raw strings.

### `Ingestion.gs` (Flight Data Pipeline & Row Mapping)
*   **`processDriveFile_(file, config)`**: Reads file blob and delegates to `processBlob_`.
*   **`processBlob_(blob, fileName, fileId, config)`**: Handles archive extraction or direct single IGC processing.
*   **`processSingleIgcBlob_(blob, ...)`**: Core logic: Parse -> Analyze -> Score -> Geo -> XContest -> Insert.
*   **`insertFlightRow_(data, ...)`**: Maps processed data to `Flights` sheet columns. Wraps `FlightID` with SeeYou link and `IGC File` with direct download link.
*   **`uiAddManualFlight_()`**: Adds a blank manual flight row at Row 5 with smart ID generation and defaults.
*   **`isHashSeen_(hashStr)` / `markHashSeen_(hashStr)`**: MD5 deduplication check via DocumentProperties.
*   **`logImport_(...)`**: Appends specific errors or success messages to `App_Log`.

### `Utils.gs` (Math & Formatting)
*   **`haversine_(lat1, lon1, lat2, lon2)`**: Consolidated great-circle distance in meters.
*   **`bearing_(lat1, lon1, lat2, lon2)`**: Consolidated initial compass bearing in degrees (0..360).
*   **`angleDiff_(b1, b2)`**: Shortest angular difference between two headings in degrees (0..180).
*   **`friendlyDuration_(sec)`**: Human-readable duration string (e.g. "45 min", "1.5 hrs").
*   **`formatTime_(sec)`**: Seconds from midnight to `HH:mm:ss`.

### `Parser.gs`
*   **`parseIgc(text, fileName)`**: Extracts fixes (B-records) and headers from IGC content.
*   **`PARSER.haversine_` / `PARSER.bearing_`**: Namespaced aliases delegating to `Utils.gs`.

### `Analysis.gs`
*   **`analyzeFlight(fixes, config)`**: Main analysis routine.
*   **`validateFlight_(fixes, ...)`**: Checks heuristics (Short flight, Kiting, Driving).

### `Scoring.gs`
*   **`calculateXcScore(fixes)`**: Computes XC distance (Free, Triangle) using RDP simplification.

### `Geo.gs`
*   **`getReverseGeo(lat, lon, config)`**: Returns Town/Region/Country (Nominatim/BigDataCloud).
*   **`getNearestSite(lat, lon, ...)`**: Finds nearest Takeoff/Landing site (Overpass API).
*   **`getTimezone(lat, lon, ...)`**: Returns TZ ID.

### `Test.gs`
*   **`runAllTests()`**: execution harness for unit tests.
