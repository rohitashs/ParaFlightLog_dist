# Technical Specifications (Source of Truth)

## 1. Overview
This document defines the low-level **Code Organization**, **Algorithms**, and **Function-Level Technical References**.
*   **Systems Architecture & Global Schemas**: See [`Architecture.md`](file:///g:/My%20Drive/~RS2B/~Projects/ParaFlightLogProject/Docs/Architecture.md) for overarching topology, C4 models, ERD, and unified data dictionary.
*   **Strategic Horizons**: See [`Roadmap.md`](file:///g:/My%20Drive/~RS2B/~Projects/ParaFlightLogProject/Docs/Roadmap.md) for macro evolution milestones.
*   **Feature Map**: See [`Features.md`](file:///g:/My%20Drive/~RS2B/~Projects/ParaFlightLogProject/Docs/Features.md) for the functional capability view.
*   **Requirements & Backlog**: See [`Backlog.md`](file:///g:/My%20Drive/~RS2B/~Projects/ParaFlightLogProject/Docs/Backlog.md) (`RQ-*`, `CR-*`, `Bug-*`).

---

## 2. System Architecture
**Stack**: Google Apps Script (GAS) bound to Google Sheets.
**Patterns**: Service-Oriented (Modules), MVC-lite (Sheet as View).

### Modules (`Code/`)
1.  **Orchestrator (`Code.gs`)**: Entry point. Maps Triggers/Menus to Controllers.
2.  **Config (`Config.gs`)**: Static Definitions (`TABS`, `CFG`).
    *   *Rule*: Never hardcode column indices. Use `Config` maps.
    *   Defines `TABS.CONFIG` (Amber `#FF9800`, index 6) combining Parameters and Lookups into a single sheet. Backwards compatibility aliases `TABS.PARAMETERS` and `TABS.LOOKUPS` map directly to `TABS.CONFIG`.
3.  **Scaffold (`Scaffold.gs`)**: View Controller. Creates Sheets/Validations.
    *   `scaffoldConfig_`: Unifies Parameters (Cols A:C) and Lookups (Cols E:N, spacer Col D) into 7 core tabs.
    *   *Map*: `RQ-SYS-002`.
4.  **File Handling Service (`FileHandling.gs`)**: Drive I/O, Watch Folder scanning, Staged Uploads, ZIP extractions, File cleanup, and Master Log copying.
5.  **Ingestion Service (`Ingestion.gs`)**: Pipeline Controller. Parse/Score orchestration, deduplication, and row mapping.
    *   *Map*: `RQ-ING-001`, `RQ-ING-001.4`, `CR-ING-008`.
6.  **Utilities (`Utils.gs`)**: Consolidated math (Haversine, Bearing, AngleDiff) and time formatting helpers.
7.  **Weather Service (`Weather.gs`)**: Automated historical & forecast weather enrichment (`RQ-SCR-004`). Open-Meteo archive with 7-day forecast API fallback (primary) and Visual Crossing Timeline API (backup), Lawrence cloudbase spread estimation, and cardinal wind formatting.
8.  **Domain Logic**:
    *   **`Parser.gs`**: IGC extraction (B-Records, H-Records).
    *   **`Analysis.gs`**: Physics engine (Thermals, Glide).
    *   **`Scoring.gs`**: Optimization engine (Graph theory/RDP).
    *   **`Geo.gs`**: External API Gateway (Nominatim, Overpass).
    *   **`XContest.gs`**: Verifies flights on XContest.org via Direct Flight Probing, extracts permanent flight IDs, and checks 14-day claim deadlines.

---

## 3. Data Schema (`Flights` Tab)
Fixed Header Schema (Row 3=Category, Row 4=Name). Data starts Row 5.

### Primary Column Groups
| Group | Key Fields | Mapping |
| :--- | :--- | :--- |
| **Identity** | `Status`, `Flight No`, `Date`, `Type` | `RQ-ING-002` |
| **Link** | `FlightID` | `RQ-SYS-003` (SeeYou Link) |
| **Gear** | `Wing`, `Harness`, `Reserve` | `RQ-SYS-001` |
| **Scoring** | `XC Score`, `Triangle`, `Points` | `RQ-SCR-001` |
| **Geo** | `Launch Site`, `Land Town` | `RQ-SCR-002` |
| **Metrics** | `Duration`, `Max Alt`, `Gain` | `RQ-ANA-002` |
| **Weather** | `Wind@Launch`, `Wind@Landing`, `Cloud %`, `Cloudbase`, `Temp (C)`, `Observations` | `RQ-SCR-004` |
| **XContest** | `XC Status` | `RQ-SCR-003` |
| **System** | `Import ID`, `Hash`, `Notes` | Validation/Audit |

### Pilot Profile Schema (`Pilot_Profile` Tab - `RQ-SYS-009`, `CR-SYS-004`)
* **Layout**: 3 columns (`['Field', 'Value', 'Notes / Instructions']`), frozen header rows = 0.
* **Row 1**: Title Banner merged A1:C1 (`Pilot Profile & Credentials`, `#00695C`, height 38px).
* **Row 2**: Subtitle Banner merged A2:C2 (height 22px).
* **Row 3**: Column Headers (`Field`, `Value`, `Notes / Instructions`, `#37474F`, height 26px).
* **Data Rows**: 34 fields organized under 6 section dividers merged A:C (`#CFD8DC`, font `#37474F`, height 26px):
  1. `[ Identity ]` (6 fields): `Full Name`, `Callsign / Nickname`, `Email`, `Phone Number`, `Home Country & Town`, `Other Identity Info`.
  2. `[ Licensing ]` (6 fields): `National Association`, `Pilot Rating`, `National Licence Info`, `FAI Sporting Licence Info`, `CIVL ID`, `Other Licensing Info`.
  3. `[ Affiliations ]` (4 fields): `Primary Flying Club`, `Secondary Clubs`, `National Federation Member #`, `Other Affiliations Info`.
  4. `[ Emergency / SAR ]` (8 fields): `Primary Emergency Contact Info`, `2nd Emergency Contact Info`, `3rd Emergency Contact Info`, `SAR / Evac Provider Info`, `Medical Insurance Info`, `Blood Type`, `Medical Conditions / Allergies`, `Other Emergency Info`.
  5. `[ Tracking / Gear ]` (6 fields): `Garmin inReach IMEI`, `Garmin MapShare URL`, `Flymaster Live URL`, `XContest Live URL`, `Emergency Beacon Hex ID`, `Other Tracking / Gear Info`.
  6. `[ Progression ]` (4 fields): `Current Season XC Goals`, `SIV / Maneuver Notes`, `General Flying Notes`, `Other Progression Info`.
* **Field Styling**: Col A bold labels, Col B soft yellow editable cells (`#FFFDE7`, solid border `#BDBDBD`), Col C 9pt muted guidance notes (`#616161`).
* **Non-Destructive Key-Value Contract**: Export, import, and scaffolding treat `Pilot_Profile` as a pure key-value store matching on Column A (`Field`) and writing exclusively to Column B (`Value`), leaving section header rows and Column C completely untouched.

---

## 4. Algorithms & Logic

### A. Deduplication & Device Overlap Strategy (`RQ-ING-002`, `CR-ING-006`)
1.  **Row-Based MD5 Hashes (Zero Black Box)**:
    *   MD5 digests are computed for all incoming flight files and stored directly on the flight row in Column 70 (`IGC Hash` in the `Meta` group).
    *   Row deletions automatically remove the corresponding hash from tracking without requiring full cache purges. An in-memory cache (`_cachedSheetHashes`) prevents redundant sheet reads during batch imports.
2.  **Dedicated Trash vs. Error Folder Separation**:
    *   `TRASH_FOLDER_ID`: Intentionally discarded/duplicate files (hard duplicates skipped during ingest, backup files from duplicate triage, purged flights, source archives). Can be emptied by the user anytime.
    *   `ERROR_FOLDER_ID`: Reserved strictly for corrupt files, unparseable IGCs, and fatal processing exceptions requiring pilot investigation.
3.  **Smart Master Log Re-linking**:
    *   If an incoming file matches an existing file in `MASTER_LOG_FOLDER_ID` by MD5 content but no corresponding flight row exists in `Flights` (e.g. from prior row deletions), the system re-links directly to the existing Master IGC without generating `_copy.igc` duplicates, restores the flight row, and moves the source file to Trash.
4.  **Multi-Criteria Heuristic Overlap Detection**:
    *   Triggered when an incoming flight and an existing flight match:
        *   **Date**: Same flight date (`YYYY-MM-DD`).
        *   **Launch Time**: Within $\pm 15$ minutes (or overlapping flight duration intervals with $\Delta t \le 35$ min).
        *   **Launch Location**: Proximity $\le 1{,}000$ meters (Haversine formula).
5.  **Data Quality Scoring (0–100 Points)**:
    *   **Device / Software Source (Max 40 pts)**: XCTrack (40 pts - pilot's primary BLE-connected instrument), Dedicated Flight Vario / Instrument (30 pts - UltraBliP, XC Tracer, Flymaster, Skytraxx, Oudie, Syride), Generic flight app (20 pts - XCSoar, SeeYou, FlyMe), Unknown/Generic (10 pts).
    *   **Barometric Pressure Integrity (Max 30 pts)**: Authentic pressure sensor altitude readings differing from GPS altitude (30 pts), baro present (20 pts), GPS altitude only (5 pts).
    *   **Temporal Resolution & Duration (Max 20 pts)**: High-frequency recording $\le 1.2$s / 1Hz (15 pts), 2.5s (10 pts), 5.5s (5 pts). Flight duration $> 30$ min (5 pts), $> 10$ min (3 pts), $> 2$ min (1 pt).
    *   **Metadata Richness (Max 10 pts)**: Populated glider type (+3), pilot name (+3), glider ID (+2), hardware/firmware headers (+2).
6.  **Duplicate Triage Statuses & Pairing Notes (Eliminated Legacy 'Duplicate')**:
    *   Higher-scoring candidate is assigned `Dup-Primary`; backup candidate is assigned `Dup-Others`.
    *   All duplicate cases (including filename collisions and pre-existing Master Folder tracks) adhere to soft dedupe quality scoring.
    *   **Master Folder Drift Self-Healing**: If an IGC file in Master Log has no corresponding sheet row, the system restores the flight row and executes soft dedupe scoring against other recordings.
    *   Injects standardized pairing note into `Notes`: `[DupRef: DUP_YYYYMMDD_HHMM | Paired with <FlightID> (Score: X vs Y)]`.
    *   **Dashboard Protection**: All KPI banners, timeline currency, and leaderboard cards strictly filter for `Status = "Valid"`, preventing unreviewed duplicates from polluting statistics.
7.  **Flight Maintenance Actions (`Flight Log > Flight maintenance`)**:
    *   `Flight Updates...`: Unified configurable modal dialog (`FlightMaintenanceDialog.html`) to batch process weather, geo lookup, XContest verification, or scoring.
    *   `Mark Duplicates for Removal...`: Modal dialog (`MarkDuplicatesDialog.html`) with `Dup - Others` and `Dup - Primary` checkboxes to batch stage duplicate rows to `Remove` without immediate deletion.
    *   `Purge Flights Marked 'Remove'...`: Interactive modal dialog (`PurgeDialog.html`) with real-time client-side stepping, progress bar, cancelability, moving master IGCs to `TRASH_FOLDER_ID`, deleting sheet rows bottom-up, refreshing hashes, and sorting.
    *   `Re-sync Missing Flights from Master Folder...`: Opens `ResyncDialog.html` (interactive modal with live progress bar, activity log, and primary Done button), scanning `MASTER_LOG_FOLDER_ID` for orphaned IGCs missing from the `Flights` tab and restoring them with status `Review?`.

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

### D. XContest Verification (`RQ-SCR-003`, `Bug-SCR-002`)
*   **Method**: `UrlFetchApp` (GET).
*   **Target**: `https://www.xcontest.org/world/en/flights/detail:{USERNAME}/{DD.MM.YYYY}/{HH:MM}`.
*   **Timezone & Probing Strategy**:
    *   Evaluates candidate launch times in UTC (+/- 2 minutes tolerance).
    *   Date safety: Safely parses `YYYY-MM-DD` strings or uses UTC Date getters (`getUTCFullYear`, `getUTCMonth`, `getUTCDate`) when UTC time is midnight, eliminating Western hemisphere timezone date rollbacks (e.g. UTC-6/7).
    *   Bypasses client-side JS rendering and Cloudflare Turnstile token verification protecting pilot profile tables.
*   **Permanent ID & Link Extraction**:
    *   Extracts XContest's permanent internal flight ID (`fl=...`) from `<meta property="og:image">` in the flight detail response.
    *   Populates cell as a hyperlink with label (e.g. `=HYPERLINK(url, "XC#6952654")`), falling back to `XC-YYYYMMDD-HHMM` if the internal ID is absent.
*   **Claim Deadline (Rule 3.1)**:
    *   Unmatched flights are compared to the 14-day competition claiming deadline: populates `'Claim soon!'` if within 14 days, and `'Expired'` if older than 14 days.
*   **Audit Logging**:
    *   If `XCONTEST_USERNAME` is blank in `Parameters`, logs `XC: Skipped (No XCONTEST_USERNAME in Parameters)` in import notes.

---
---

## 5. Configuration & Provisioning Strategy (`RQ-SYS-001`, `RQ-SYS-008`, `CR-CFG-006`, `CR-CFG-007`)
1.  **`Config.gs`**: Defines structural constants (Sheet names, Colors, `colNotes`, `TABS`, `CFG.parameters`).
2.  **`Config` Sheet Layout**: Consolidates User runtime values and reference lookups:
    *   *Columns A:C*: System Parameters growing downward (Row 2 headers: `Parameter`, `Value`, `Description`). 49 centralized keys organized across 9 visual section dividers:
        *   `[ Ingestion ]` (8 keys): `WATCH_FOLDER_ID`, `MASTER_LOG_FOLDER_ID`, `UPLOAD_FOLDER_ID`, `ERROR_FOLDER_ID`, `TRASH_FOLDER_ID`, `ENABLE_WATCH_FOLDER`, `MOVE_FROM_WATCH_FOLDER`, `WATCH_PERIOD_MIN`.
        *   `[ Integrations ]` (9 keys): `WEATHER_PROVIDERS`, `VISUAL_CROSSING_API_KEY`, `GDRIVE_DOWNLOAD_URL_PATTERN`, `SEEYOU_CLOUD_URL_PATTERN`, `XCONTEST_USERNAME`, `XCONTEST_PILOT_URL_PATTERN`, `XCONTEST_FLIGHT_URL_PATTERN`, `XCONTEST_MATCH_DURATION_TOLERANCE_MIN`, `XCONTEST_MATCH_START_TIME_TOLERANCE_MIN`.
        *   `[ Geo & Time ]` (7 keys): `GEO_REV_PROVIDERS`, `CONTACT_EMAIL`, `GEO_SITE_PROVIDERS`, `LAUNCH_SITE_KEYWORDS`, `LANDING_SITE_KEYWORDS`, `GEO_TZ_PROVIDERS`, `OSM_RADIUS_M`.
        *   `[ Validation ]` (4 keys): `VALIDATION_MIN_DURATION_SEC`, `VALIDATION_MIN_HEIGHT_CHANGE_M`, `VALIDATION_MAX_SPEED_KMH`, `VALIDATION_MAX_AVG_SPEED_KMH`.
        *   `[ Analysis Rules ]` (10 keys): `THERMAL_MIN_CLIMB`, `THERMAL_MIN_TURN`, `SOAR_VARIO_MIN`, `SOAR_VARIO_MAX`, `SOAR_TURN_MAX`, `GLIDE_VARIO_MAX`, `GLIDE_TURN_MAX`, `GLIDE_LD_TOL_PCT`, `SINK_VARIO`, `SINK_TURN_MAX`.
        *   `[ Analysis - Adv ]` (3 keys): `MODE_WINDOW_SEC`, `REVERSAL_WINDOW_SEC`, `MODE_HYSTERESIS_SEC`.
        *   `[ Scoring ]` (2 keys): `NATIONAL_BONUS_MULTIPLIER`, `NATIONAL_BONUS_WITHIN_PCT`.
        *   `[ Format and Units ]` (2 keys): `DATE_FORMAT`, `TIME_FORMAT` (enforced Plain Text `@`).
        *   `[ Dashboard & Currency ]` (4 keys): `TIMELINE_FLIGHTS_LOW`, `TIMELINE_FLIGHTS_MED`, `TIMELINE_HOURS_LOW`, `TIMELINE_HOURS_MED`.
    *   *Column D*: Blank visual separator column (25px width).
    *   *Columns E:N*: Controlled vocabularies and lookups growing horizontally:
        *   *Manual Controlled Vocabularies (Columns 5–10, E:J)*: `Equipment Categories` (E), `Flight Status` (F), `Flight Type` (G), `XC Classes` (H), `Date Formats` (I), `Time Formats` (J).
        *   *Dynamic Equipment Queries (Columns 11–14, K:N)*: `Wings (Auto)` (K), `Harnesses (Auto)` (L), `Reserves (Auto)` (M), `Other (Auto)` (N) auto-populated from `Equipment` tab.
    *   *Priority*: User Sheet Values > Default Config constants.
3.  **Configuration Management (`Save Config` / `Load Config` - `CR-CFG-007`)**:
    *   `exportConfigJson(selectedSections)`: Serializes selected settings into structured JSON (`version: "2.0"`):
        *   `pilotProfile`: 34 key-value fields.
        *   `parameters`: 5 granular sub-groups (`ingestion`, `integrations`, `scoring`, `formats`, `ui`).
        *   `lookups`: 6 manual lists. Dynamic equipment queries are strictly excluded.
    *   `importConfigJson(jsonStr, selectedSections)`: Parses uploaded JSON and applies updates via pure key-value matching on Column A, writing strictly into Column B. Never overwrites section headers, formula columns, or notes.
    *   `LoadConfigDialog.html`: Automatic section detection, live count badges, and dynamic UI disable (unchecking and dimming missing sections with CSS transitions).
4.  **Template-Based Provisioning (`RQ-SYS-008.1`)**: Evaluation of distribution models to replace manual script copying:
    *   *Option A (Recommended)*: Copyable master template sheet with pre-bound Apps Script project attached, paired with an interactive First Time Setup Wizard.
    *   *Option B*: Google Workspace Add-on or Clasp CLI provisioning script.
5.  **Interactive Setup Wizard (`RQ-SYS-008.2`)**: Modal dialog triggered upon copying or via `Admin > First Time Setup Wizard` that steps users through folder selection (Watch, Upload, Master, Error), pilot credentials, default glider/harness selection, and time-driven watcher trigger initialization.

## 6. API Integrations (`RQ-SCR-002`)
*   **Geocoding**: Chain of Responsibility (`BigDataCloud` -> `Nominatim` -> Fail).
*   **Site Detection**: Chain of Responsibility (`Paragliding Earth` -> `Overpass API` -> Fail).
*   **Caching**: `CacheService` (6 hour TTL) for all external calls.
*   **Visualization**: `SeeYou Cloud` via direct link generation using Master Log file ID.
*   **Historical Weather (`RQ-SCR-004`)**: Open-Meteo Historical Weather API (`https://archive-api.open-meteo.com/v1/archive`) fetching hourly wind speed, wind direction, temperature, cloud cover, and precipitation at launch/landing timestamps.

---

## 7. Detailed Code Reference
*Function-level breakdown of the codebase.*

### `Code.gs` (Orchestration)
*   **`onOpen(e)`**: Creates the "Flight Log" menu reorganized into 5 functional submenus: *Sheet Maintenance & Views*, *Folder Configuration*, *Data Backup*, *Automation & Services*, and *System Setup & Reset (Danger Zone)*.
*   **`showFlightMaintenanceDialog()` (`RQ-SYS-007`)**: Unified dialog launcher. Opens `FlightMaintenanceDialog.html` modal for batch maintenance operations.
*   **`getActualFlightRows_(sh)` (`Bug-SYS-005`)**: Inspects the `FlightID` column from row 5 down using `getDisplayValues()` to extract `{ row, id }` strictly for populated flights, safely ignoring trailing rows that only contain scaffolded validations.
*   **`getMaintenanceScopeInfo()`**: Detects active row selection on `Flights` tab and counts actual flights populated with a `FlightID`.
*   **`getMaintenanceTargetRows(scope)`**: Returns array of target row indices and flight IDs for batch processing filtered against actual flights.
*   **`executeFlightMaintenanceRow(rowNum, opConfig)`**: Executes selected operations for a single row (weather backfill, geo resolution, XContest verification, physics recompute, XC rescore).
*   **`sortFlightsByDate()`**: Public RPC endpoint callable from client-side dialogs (`FlightMaintenanceDialog`, `URLDialog`, `UploadDialog`, `BulkIngestDialog`) to trigger multi-level flight sorting and sequential re-indexing.
*   **`sortFlightsByDate_()`**: Chronologically sorts data rows descending multi-level by `Date` (primary) and `Launch Time` (secondary), and re-indexes sequential `Flight No` formulas, bounded strictly to actual flight rows.
*   **`getParameters_()`**: Reads configuration from the `Parameters` sheet.
*   **`uiAddManualFlight()` / `uiAddManualFlight_()`**: Public menu callback and helper to trigger manual flight entry with auto-capacity check.
*   **`showUrlDialog()` / `showUrlDialog_()`**: Public menu callback and helper to show the IGC URL import dialog.
*   **`showUploadDialog()` / `showUploadDialog_()`**: Public menu callback and helper to show the File Upload picker.
*   **`showScanDialog()`**: Shows watch folder scan status modal dialog.
*   **`showBulkIngestionDialog()` (`CR-ING-008`)**: Opens `BulkIngestDialog.html` for high-speed multi-file batch onboarding.
*   **`openFolderPicker_(paramKey, title)`**: Opens the in-app Google Drive folder picker dialog.
*   **`getDriveFolderContents(folderId)` / `getDriveFolderContents_(folderId)`**: Returns child folders and breadcrumb path for Drive folder navigation.
*   **`resolveFolderInput(input)` / `resolveFolderInput_(input)`**: Verifies and extracts folder metadata from an input URL or raw folder ID.
*   **`getFolderPath_(folder)` / `getMultiFolderPath_(folderIds)`**: Computes human-readable breadcrumb paths (e.g. `My Drive / Paragliding / Logs`).
*   **`saveFolderParam(paramKey, folderId, mode)` / `saveFolderParam_(paramKey, folderId, mode)`**: Saves folder IDs to the `Config` sheet and writes breadcrumbs to `Description`.
*   **`uiUpdateWatchFolder()`, `uiUpdateUploadFolder()`, `uiUpdateMasterLogFolder()`, `uiUpdateErrorFolder()`, `uiUpdateTrashFolder()`**: Public menu callbacks triggering the in-app folder picker.
*   **`showPurgeDialog()`**: Opens `PurgeDialog.html` for interactive client-stepping flight removal.
*   **`showMarkDuplicatesDialog()`**: Opens `MarkDuplicatesDialog.html` to batch-stage `Dup-Primary` and/or `Dup-Others` flights to `Remove`.
*   **`showSaveConfigDialog()` / `showLoadConfigDialog()`**: Opens Configuration Management export and import modal dialogs.
*   **`getPurgeCandidateFlightsStatus()` / `purgeSingleCandidateFlight(target)` / `finalizePurge()`**: Stepping backend handlers and public RPC completion gateway for interactive purge.
*   **`getMissingMasterLogsStatus()` / `restoreSingleMasterFlight(fileId)` / `finalizeResync()`**: Stepping backend handlers and public RPC completion gateway for master log re-sync.
*   **`getDuplicateCounts()` / `markDuplicatesForRemoval(markOthers, markPrimary)`**: Handlers and public RPC gateway for staging duplicates to `Remove`.
*   **`exportConfigJson(selectedSections)` / `importConfigJson(jsonStr, selectedSections)`**: Configuration export and import public RPC gateways.
*   **`uiRefreshDashboard()` / `uiRefreshUserGuide()` / `reapplyFormatting()` / `backupSystemSheets()`**: Public menu wrappers for view maintenance and backups.
*   **`scaffoldAll()` / `deleteSystemSheets()`**: Public menu wrappers for initial setup and system reset.
*   **`setupWatcherTrigger()` / `setupWatcherTrigger_()`**: Installs the time-driven trigger for automation.
*   **`scanWatchFolderTrigger()`**: Public trigger handler for scheduled background watch folder scans.

### `Scaffold.gs` (Setup & Validation)
*   **`scaffoldAll_()`**: Master function to create/repair all sheets (`Dashboard`, `Flights`, `Pilot_Profile`, `Equipment`, `User Guide`, `Config`, `Activity Logs`).
*   **`scaffoldDashboard_(ss)` (`RQ-SYS-005`, `CR-SYS-001`, `CR-SYS-002`)**: Builds the compact 6-column Dashboard (`A` to `F`), featuring two 3-KPI summary banners (All-Time and Year-to-Date with `[h]:mm "hrs"` duration), a dynamic 6-month activity timeline with pure numeric values (`0 "flts"`, `[h]:mm "hrs"`, `#,##0 "km"`) and pilot currency color shading (Orange / Yellow / Green based on `TIMELINE_FLIGHTS_LOW/MED` and `TIMELINE_HOURS_LOW/MED`), a 4 x 2 leaderboard grid with 8 cards (Top 5 Duration, Top 5 Distance, Top 5 Max Alt, Top 5 Alt Gain, Top 5 Thermal Flights, Top 5 Soaring Flights, Top 5 XC Score, Top 5 Max Speed), and a dedicated complete lists section (20-row pre-scaffolded Launch Sites and Countries Flown ordered by flight count). All cells have word wrapping enabled and use resilient `INDIRECT("Flights!..." & startRow & ":...")` formulas immune to row insertions and deletions.
*   **`scaffoldFlights_(ss)`**: Builds 2-row category headers, sets Master Flight Log folder hyperlink in Cell `A2`, freezes 4 columns (`A:D`), ensures minimum 2,000 rows and 69 columns capacity via `ensureDimensions_`, and applies column header notes/tooltips to Row 4 (`colNotes`).
*   **`scaffoldConfig_(ss)`**: Unifies parameter settings (Cols A:C) and lookup reference tables (Cols E:N, spacer Col D) into the `Config` tab. Populates parameters with human-readable path enrichment in Column C (`Description`), strict Plain Text (`@`) formatting for format keys, `[h]:mm "hrs"` formatting for `TIMELINE_HOURS_LOW/MED` day fractions, `0 "flts"` for `TIMELINE_FLIGHTS_LOW/MED`, dynamic queries for equipment (`F3:I3`), and exact validation ranges.
*   **`scaffoldUserGuide_(ss)` (`RQ-SYS-006.1`)**: Builds or refreshes the in-app `User Guide` sheet tab with structured sections: System Overview, Setup & Configuration (including `XCONTEST_USERNAME`), Normal Logging Usage, System Maintenance (weather, geo, XContest verification, physics, sort), and Comprehensive Metric Dictionary (defining all calculated fields including XContest hyperlinking).
*   **`uiRefreshUserGuide_()`**: Interactive menu action under `Flight Log > Admin > Admin: Refresh User Guide Tab` to safely re-scaffold the `User Guide` tab without touching flight data.
*   **`uiRefreshDashboard_()`**: Interactive menu action under `Flight Log > Admin > Admin: Refresh Dashboard` to re-scaffold the 6-column resilient Dashboard without touching flight data.
*   **`scaffoldPilotProfile_(ss)` (`RQ-SYS-009.1`)**: Builds the `Pilot_Profile` sheet tab with structured fields (Personal info, Certifications, Org/Club memberships, Emergency contacts, Garmin inReach links, Insurance) and free-form notes.
*   **`backupSystemSheets_()`**: Clones user data sheets (`Flights`, `Pilot_Profile`, `Equipment`, `Parameters`, `Lookups`) into dedicated backup tabs (`Backup Flights`, etc.), replacing any previous backup iterations.
*   **`updateValidationOnly_()`**: Re-applies dropdowns and validation rules to `Flights` and `Equipment`, refreshes `Parameters`, and updates `User Guide`.
*   **`applyFlightsValidation_(sh)`**: Applies dynamic validation from the `Lookups` tab (`Flight Type` from `Lookups!G3:G`, `XC Flight Class` from `Lookups!H3:H`), `Closed?` list validation (`['Yes', 'No']`), and dropdowns across dynamically scaled rows (`Math.max(sh.getLastRow() + 50, 100)`).
*   **`reapplyFormatting_()`**: Re-applies conditional formatting rules, alternating row colors, number formatting, and ensures minimum 2,000 row capacity across the `Flights` tab without modifying existing data.
*   **`ensureDimensions_(sh, minRows, minCols)`**: Utility to safely ensure a sheet meets minimum row and column capacities without deleting or truncating existing content.
*   **`ensureSheet_(ss, name)`**: Utility to create a sheet if missing.

### `FileHandling.gs` (Drive & File Pipeline)
*   **`validateRequiredFolders_(requiredKeys, config)`**: Pre-flight folder validator. Ensures all required folder keys for an ingestion mode (`MASTER_LOG_FOLDER_ID`, `ERROR_FOLDER_ID`, `UPLOAD_FOLDER_ID`, and optionally `WATCH_FOLDER_ID`) are configured in the `Parameters` sheet and accessible. Immediately halts and displays actionable error messages if folders are missing or invalid. Never creates folders in Google Drive root.
*   **`scanWatchFolderNow_()`**: Automation entry point. Iterates over configured `WATCH_FOLDER_ID`s, recursively scans subfolders (up to 10 levels), unpacks archives, invokes processing, and executes automated file cleanup.
*   **`getWatchFolderStatus()`**: Returns folder names and recursive flight counts across multiple watch folders for `ScanDialog.html`.
*   **`stageUpload(fileObj)`**: Unpacks zip/gz archives and stages files to `UPLOAD_FOLDER_ID` for `UploadDialog.html`.
*   **`processFileById(fileId, source, deleteSource, isDriveSource)`**: Processes a staged Drive file by ID with context-aware cleanup: for `URL_CUSTOM`, when "Delete from source" is unchecked, successful files copy to `MASTER_LOG_FOLDER_ID` and failed files copy to `ERROR_FOLDER_ID` while source files remain untouched; when checked, source files are deleted after copying. Staged temporary files (`isDriveSource === false`) are always trashed from `UPLOAD_FOLDER_ID`.
*   **`stageUrlOrDriveImport(input)`**: Discovers, fetches, and stages files from external URLs or Drive folder/file IDs for `URLDialog.html`.
*   **`trashSourceFiles(fileIds)`**: Trashes source archives after successful extraction/processing.
*   **`copyToMasterLog_(blob, name, config)`**: Handles public mirroring and duplicate renaming strictly in `MASTER_LOG_FOLDER_ID` configured in `Parameters` (never creates folders in Drive root).
*   **`copyToErrorFolder_(fileOrBlob, fileName, config)`**: Copies failed/invalid files with `ERROR_` prefix strictly to `ERROR_FOLDER_ID` configured in `Parameters` (never creates folders in Drive root).
*   **`moveToTrashFolder_(fileOrBlob, fileName, config)`**: Moves discarded, duplicate, or purged files strictly to `TRASH_FOLDER_ID` configured in `Parameters` (never creates folders in Drive root).
*   **`handleFileCleanup_(file, status, config)`**: Routes processed watch folder files: `SUCCESS` and `DUPLICATE` to `TRASH_FOLDER_ID`, and `ERROR` to `ERROR_FOLDER_ID`.
*   **`getFilesRecursive_(folder, maxDepth, currentDepth)`**: Traverses a Drive folder tree and collects matching flight files (`.igc`, `.igx`, `.zip`, `.gz`).
*   **`getDriveIdFromUrl_(url)`**: Extracts Google Drive file/folder ID from URLs or raw strings.

### `Ingestion.gs` (Flight Data Pipeline & Row Mapping)
*   **`processDriveFile_(file, config)`**: Reads file blob and delegates to `processBlob_`.
*   **`processBlob_(blob, fileName, fileId, config)`**: Handles archive extraction or direct single IGC processing.
*   **`processSingleIgcBlob_(blob, ...)`**: Core logic: Parse -> Analyze -> Score -> Geo -> XContest -> Insert.
*   **`ensureFlightCapacity_(sh, minBuffer)`**: Dynamically monitors remaining row capacity on the `Flights` sheet during flight insertion; automatically appends 200 rows if the remaining empty buffer drops below 50 rows.
*   **`insertFlightRow_(data, ...)`**: Standard ingestion pathway: maps processed data to `Flights` sheet columns via `buildFlightRowArray_` and inserts before Row 5 (top insertion preserved).
*   **`buildFlightRowArray_(data, ...)`**: Constructs the standard 60-column row array for a flight, shared by both standard top-insertion and bulk bottom-insertion pathways for 100% data consistency.
*   **`processBulkBatch(batchFiles, options)` (`CR-ING-008`)**: High-speed batch processor for bulk flight ingestion (`BulkIngestDialog.html`). Groups files into small batches (3, 5, or 10), pre-loads in-memory hashes and flight summaries, executes user-toggled enrichments, and appends entire batches to the bottom of the `Flights` tab in single atomic spreadsheet operations.
*   **`finalizeBulkImport()` (`CR-ING-008`)**: Finalizes bulk batch import by invoking `sortFlightsByDate_()` to chronologically order all flights by date and launch time and refresh dynamic formula references.
*   **`uiAddManualFlight_()`**: Adds a blank manual flight row at Row 5 with smart ID generation and defaults.
*   **`isHashSeen_(hashStr, sh)` / `markHashSeen_(hashStr, rowNum)`**: Row-based MD5 deduplication check against the `Flights` sheet's Column 70 (`IGC Hash`) via memory cache `getCachedSheetHashes_`.
*   **`getCachedSheetHashes_(sh, forceRefresh)` / `getExistingSheetHashes_(sh)`**: Loads or retrieves cached MD5 hashes mapped to row numbers from the sheet.
*   **`scoreFlightQuality_(parsed, rawText, fileName)`**: Computes 0–100 data quality score (XCTrack=40, Vario=30, Baro sensor integrity=30, 1Hz resolution=15, duration, metadata).
*   **`findHeuristicOverlap_(flightData, existingFlights)`**: Detects multi-device overlaps on the same day (+/- 15 min or interval overlap, launch distance <= 1000m).
*   **`findHeuristicOverlapInMemory_(parsed, ...)`**: In-memory overlap detection for bulk batches, preventing redundant sheet grid reads.
*   **`syncMasterLogsToSheet_()`**: Scans `MASTER_LOG_FOLDER_ID` for orphaned IGCs missing from `Flights` and restores them with status `Review?`.
*   **`Code/Logger.gs` (`DSGN-LOG-001`, `CR-LOG-004`)**: Centralized Activity Logging engine (`LOG.write`, `LOG.writeBatch`, `LOG.createSession`, `LOG.cleanLogs`, `logClientActivity`, `cleanActivityLogs`). Records all operations to the 4-column `Activity Logs` sheet (`Process`, `Timestamp`, `Activity / Event`, `Additional Info`) with tiered verbosity (`Brief`, `Normal`, `Debug`) and conservative dual-threshold pruning (`LOG_ROWS_TO_KEEP: 2000`, `LOG_TIME_TO_KEEP_DAYS: 90`).

### `Utils.gs` (Math & Formatting)
*   **`haversine_(lat1, lon1, lat2, lon2)`**: Consolidated great-circle distance in meters.
*   **`bearing_(lat1, lon1, lat2, lon2)`**: Consolidated initial compass bearing in degrees (0..360).
*   **`angleDiff_(b1, b2)`**: Shortest angular difference between two headings in degrees (0..180).
*   **`friendlyDuration_(sec)`**: Human-readable duration string (e.g. "45 min", "1.5 hrs").
*   **`formatTime_(sec)`**: Seconds from midnight to `HH:mm:ss`.

### `Config.gs` (Global Settings & Sheet Schemas)
*   **`CFG`**: Master configuration dictionary defining sheet names, system limits, and centralized parameter definitions.
*   **`TABS`**: Detailed column specifications, category grouping (Flight Info, Gear, XC Scoring, Launch, Landing, Weather, Analytics, Validation, Meta), editable field constraints, and styling definitions for all scaffolded tabs.

### `Parser.gs`
*   **`parseIgc(text, fileName)`**: Extracts fixes (B-records) and headers from IGC content.
*   **`PARSER.parseIgc`**: Core IGC extraction entry point delegating to `parseIgc`.

### `Analysis.gs`
*   **`analyzeFlight(fixes, config)`**: Main analysis routine.
*   **`validateFlight_(fixes, ...)`**: Checks heuristics (Short flight, Kiting, Driving).

### `Scoring.gs` (XC Optimization & League Scoring)
*   **`calculateXcScore(fixes)`**: Evaluates optimized track geometry across Free Flight (1.0x), Out-and-Return (1.2x), Flat Triangle (1.2x), and FAI Triangle (1.4x), selecting the highest-scoring classification.
*   **`optimizeFreeDistance_(points)`**: Baseline open/free distance heuristic across simplified track fixes.
*   **`optimizeOutAndReturn_(points)`**: Turnaround point optimization ($P_i \to P_j \to P_k$ where $i < j < k$). Verifies closure gap $\text{dist}(P_i, P_k) \le 20\%$ of total course distance ($2 \times \text{dist}(P_i, P_j)$) and scores $(2 \times D_{\text{tp}} - \text{Gap}) \times 1.2$.
*   **`optimizeTriangle_(points)`**: 3-legged circuit optimization ($P_i \to P_j \to P_k \to P_m$). Enforces closure gap $\text{dist}(P_i, P_m) \le 20\%$ of perimeter ($d_1 + d_2 + d_3$) and minimum leg threshold $\ge 5\%$ of perimeter to prevent degenerate out-and-return collapse. Classifies as `FAI Triangle` if shortest leg $\ge 28\%$ of perimeter (1.4x), or `Flat Triangle` (1.2x).
*   **`simplifyTrack_(points, tolerance)`**: Ramer-Douglas-Peucker track reduction to bounded fixes for sub-second Apps Script execution.

### `Geo.gs`
*   **`getReverseGeo(lat, lon, config)`**: Returns Town/Region/Country (Nominatim/BigDataCloud).
*   **`getNearestSite(lat, lon, ...)`**: Finds nearest Takeoff/Landing site (Overpass API) using consolidated `haversine_` from `Utils.gs`.
*   **`getTimezone(lat, lon, ...)`**: Returns TZ ID.

### `XContest.gs` (XContest Verification)
*   **`XContest.checkFlight(flightDateObj, flightDurationMin, flightStartTimeMin, config)`**: Probes direct flight URLs on XContest.org using UTC launch date and candidate start times (+/- 2 min tolerance). Extracts permanent database flight IDs (`fl=...`) to construct hyperlinked labels (`XC#...` or `XC-YYYYMMDD-HHMM`). If unmatched, evaluates against the 14-day competition deadline, returning `'Claim soon!'` (<= 14 days) or `'Expired'` (> 14 days).

### `Test.gs`
*   **`runAllTests()`**: Execution harness for unit tests.

### `Weather.gs` (Historical & Forecast Weather Gateway)
*   **`WEATHER.getEnrichment(launchFix, landFix, dateIso, startTimeSec, endTimeSec, config)`**: Main enrichment dispatcher using provider fallback chain (`WEATHER_PROVIDERS`).
*   **`fetchOpenMeteo_(lat, lon, dateIso, hour, launchAlt, config)`**: Primary weather fetcher. Queries forecast API with `past_days=7` if flight is <= 5 days old; otherwise queries historical archive API.
*   **`fetchVisualCrossing_(lat, lon, dateIso, hour, launchAlt, config)`**: Backup fetcher via Visual Crossing Timeline API using `VISUAL_CROSSING_API_KEY`.
*   **`calculateCloudbase_(tempC, dewPointC, launchAltM)`**: Convective condensation level via Lawrence spread formula $(T - T_d) \times 125\text{ m}$, formatted as `MSL (AGL)` (e.g. `2400m MSL (1200m AGL)`).
*   **`formatWind_(speedKmh, dirDeg, gustKmh)`**: Formats wind speed, 16-point cardinal direction, and significant gusts (e.g. `14 km/h WNW (gust 20)`).

### HTML Dialog Templates (User Interface)
*   **`FlightMaintenanceDialog.html`**: Unified batch maintenance modal interface supporting scope selection (Selected rows vs All flights), operation checkboxes, real-time client-side stepping, and live progress bar.
*   **`BulkIngestDialog.html` (`RQ-ING-001.4`, `CR-ING-008`)**: High-speed bulk flight ingestion modal interface featuring Drive folder discovery, batch size selection (3, 5, or 10 files per call), enrichment toggles, real-time activity console, and progress tracking.
*   **`PurgeDialog.html`**: Interactive stepping purge modal with live candidate detection, real-time progress bar, Google Drive trash transfer, row deletion, and primary Done button.
*   **`MarkDuplicatesDialog.html`**: Duplicate staging modal with `Dup - Others` and `Dup - Primary` checkboxes and live match counts.
*   **`SaveConfigDialog.html` (`CR-CFG-007`)**: Configuration export modal with 5 granular parameter group checkboxes, Pilot Profile, and Lookups, with client-side JSON download.
*   **`LoadConfigDialog.html` (`CR-CFG-007`)**: Configuration import modal with local JSON file selector, automated section detection, live count badges, dynamic UI disabled states, and sticky footer Apply button.
*   **`ResyncDialog.html`**: Interactive Master Log folder re-sync modal with progress bar, activity console, and primary Done button.
*   **`FolderPickerDialog.html`**: In-app Google Drive folder picker dialog featuring live search, folder tree navigation, breadcrumbs, and single/multi-folder assignment to `Config`.
*   **`URLDialog.html`**: Modal dialog for importing flights from external URLs or Drive folder links, featuring live progress bar, file staging, processing logs, and archive cleanup.
*   **`UploadDialog.html`**: Direct browser file upload modal supporting drag-and-drop of `.igc`, `.zip`, and `.gz` archives into Google Drive staging.
*   **`ScanDialog.html`**: Watch folder scanning modal displaying real-time batch detection, extraction progress, and completion reporting.
*   **`Inspector.html`**: Flight inspector sidebar/modal providing in-depth fix telemetry review, metric calculations, and manual metadata editing.
*   **`ExecutionSidebar.html` (`DSGN-UI-001`, `CR-UI-019`)**: Universal 300px modeless execution sidebar replacing duplicated progress bars, copy buttons, status lines, and log consoles across dialogs. Features Context Header, Metric Pills, Activity Log Console with `📋 Copy Log`, and dynamic Cancel/Done controls while keeping the spreadsheet grid fully interactive.
*   **`Style.html`**: Shared CSS tokens, typography, button states, and modal layout styling loaded across all HTML dialogs.

### Execution & Background Services (`DSGN-UI-001`, `DSGN-AUT-001`)
*   **`Code/QueueService.gs`**: Persistent job queue manager operating on the `Automation_Queue` tab. Handles job enqueuing, progress tracking, state checkpoints, and pilot cancellation without `PropertiesService` 9 KB storage limits. Provides foundational execution substrate for scheduled automation.
*   **`Code/TimeBudget.gs`**: Execution runtime budget service (`TimeBudgetService`) enforcing a 4.5-minute safety threshold. Prevents Google Apps Script 6-minute hard termination errors by committing sheet mutations, serializing checkpoint state to the queue, and spawning 30-second continuation triggers (`ScriptApp.newTrigger`).
