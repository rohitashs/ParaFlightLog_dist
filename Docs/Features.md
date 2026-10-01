# Features & Capabilities

## Overview
This document describes the *intent* and *capabilities* of the Paragliding Flight Log system.
*   **Technical Spec**: See `Technical_Specification.md` for *how* it works.
*   **Requirements**: See `Backlog.md` for the status of these features (`RQ-*`).

---

## 1. 📂 Intelligent File Ingestion
*Maps to `RQ-ING-001`*

The system automates the import of flight logs (IGC) to reduce manual entry.
*   **Watch Folder**: Automatically detects and processes new files dropped into one or more designated Google Drive folders (comma-separated list supported).
*   **Recursive Traversal**: Recursively scans all subfolders up to 10 levels deep for supported files (`.igc`, `.igx`, `.zip`, `.gz`).
*   **Smart Deduplication**: Uses MD5 hashing and time-overlap detection to prevent duplicate entries.
*   **Multi-Source**: Supports Drag-and-Drop Uploads, Drive Folder/File URL imports, Bulk ZIP extraction, and dedicated High-Speed Bulk Batch Ingestion.
*   **High-Speed Bulk Ingestion (`Flight Log > Admin > Bulk Flight Ingestion (Batch)...`)**: Purpose-built utility for large-scale initial onboarding (e.g. hundreds of flight logs across multiple devices). Implements 3 high-impact performance optimizations: (1) multi-file RPC batching (3, 5, or 10 files per call) to eliminate container spin-up overhead, (2) atomic batch appending to the bottom of the Flights sheet with a single final sort to eliminate grid-shifting formula recalculations, and (3) configurable enrichment checkboxes for non-critical web lookups (Site Detection, Reverse Geo, Open-Meteo Weather, XContest sync, XC Scoring, Analytics, and source deletion safety).
*   **Parsing**: Extracts pilot details, glider type, and high-fidelity G-Record data (GNSS/Pressure altitude).
*   **Master Log Mirror & Strict Folder Authority**: Automatically copies and standardizes flight logs to the configured public folder (`MASTER_LOG_FOLDER_ID`) for SeeYou Cloud and direct downloads. Folders are strictly driven by the `Parameters` sheet; missing folders abort ingestion with clear user alerts and folders are never created in Drive root.
*   **Context-Aware Cleanup**:
    *   *Watch Folder*: Moves processed source files and skipped duplicates to `TRASH_FOLDER_ID` per `MOVE_FROM_WATCH_FOLDER` setting; quarantines corrupt/unparseable files requiring investigation into `ERROR_FOLDER_ID`.
    *   *URL & Drive Import*: When "Delete from source" is unchecked, successful files copy to Master Log, skipped duplicates move to Trash, and failed files copy to Error Folder, leaving all Drive source files intact. When checked, source files are trashed after copying. Staged temporary files from web URLs or unzipped packages are always cleaned up from `UPLOAD_FOLDER_ID`.
    *   *File Upload*: Staged temporary uploads are mirrored to Master, skipped duplicates move to Trash, errors copy to Error folder, and temporary uploads are trashed from `UPLOAD_FOLDER_ID`.

## 2. ✈️ Automated Flight Logging & Smart Deduplication
*Maps to `RQ-ING-002`, `CR-ING-006`*

Converts raw data into a structured Pilot Logbook in Google Sheets.
*   **Auto-Summary**: Generates human-readable summaries (e.g. "2h 10m XC at Bir Billing 3100m").
*   **Row-Based Hashes (Zero Black Box)**: MD5 file hashes are stored directly on the flight row in Column 70 (`IGC Hash`). Deleting a flight row automatically removes its hash, allowing clean re-import without blanket cache wipes.
*   **Smart Deduplication & Device Overlap Triage**:
    *   *Hard Dedupe*: Identical file content (MD5 match) is recognized immediately. Re-links to existing Master IGC files if rows were deleted without generating `_copy.igc` duplicates, and moves source files to the Trash folder.
    *   *Heuristic Overlap*: When multiple instruments record the same flight (same date, $\pm 15$ min or interval overlap, launch distance $\le 1{,}000$ m), the system calculates a 0–100 quality score (XCTrack primary device = 40 pts, dedicated vario = 30 pts, baro sensor integrity = 30 pts, 1Hz resolution = 15 pts, duration, and metadata).
    *   *Candidate Tagging*: The superior track is marked `Dup-Primary` (gold) and the backup track is marked `Dup-Others` (orange), with cross-referencing pairing notes `[DupRef: DUP_YYYYMMDD_HHMM | Paired with <FlightID> (Score: X vs Y)]`.
*   **Status Taxonomy & Dashboard Protection**:
    *   Dropdown options: `Valid`, `Review?`, `Dup-Primary`, `Dup-Others`, `Invalid?`, `Remove`. Note that legacy `'Duplicate'` status has been completely eliminated in favor of soft dedupe quality scoring and self-healing Master Log drift.
    *   All Dashboard KPI cards, 6-month currency timeline, and leaderboards strictly filter for `Status = "Valid"`, preventing unreviewed or duplicate tracks from polluting pilot statistics.
*   **Self-Healing Maintenance Tools (`Flight Log > Flight maintenance`)**:
    *   *Flight Updates...*: Unified modal dialog to batch update weather, geo reverse lookup, XContest validation, physics/XC scoring, or sort flights.
    *   *Mark Duplicates for Removal...*: Staging dialog with `Dup - Others` and `Dup - Primary` checkboxes to stage triaged duplicate tracks to `Remove`.
    *   *Purge Flights Marked 'Remove'...*: Interactive modal dialog (`PurgeDialog.html`) with live candidate detection, client-side stepping, real-time progress bar, Google Drive trash folder transfer, row deletion, and primary Done button.
    *   *Re-sync Missing Flights from Master Folder...*: Interactive modal dialog (`ResyncDialog.html`) with live progress bar, activity log, and primary Done button that scans `MASTER_LOG_FOLDER_ID` for orphaned IGCs and restores them to the `Flights` tab as `Review?`.
*   **Gear Tracking**: Auto-fills Wing, Harness, and Reserve based on the last valid flight ("Sticky Defaults") or Equipment defaults.

## 3. 📊 Flight Analysis
*Maps to `RQ-ANA-001`, `RQ-ANA-002`*

Analyzes the track log to understand *how* you flew.
*   **Mode Detection**: Automatically classifies segments as **Thermal** (Circling), **Soaring** (Ridge), **Glide** (Transition), or **Sink**.
*   **Performance Metrics**: accurate calculation of Max Climb rates, Height Gains, Soar Efficiency (m/km), and in-flight Glide L/D.
*   **Safety Checks**: Flags abnormally high sink rates or ground proximity events.

## 4. 🏆 XC Scoring (League Rules)
*Maps to `RQ-SCR-001`*

Applies standard XContest/FAI scoring rules to every flight.
*   **Optimization**: Finds the optimal track geometry across Free Flight, Out-and-Return, and Triangle courses.
*   **Out-and-Return Detection**: Identifies single turnpoint out-and-back flights ($P_i \to P_j \to P_k$ where closing gap $\le 20\%$ of total course distance), awarding a 1.2x league multiplier.
*   **Triangle Detection**: Identifies **Flat Triangles** (3 distinct legs $\ge 5\%$, gap $\le 20\%$, 1.2x) and **FAI Triangles** (strict FAI geometry with shortest leg $\ge 28\%$, 1.4x).
*   **Harmonized Taxonomy**: Classifies best flight geometry into standard categories: `Free Flight`, `Flat Triangle`, `FAI Triangle`, or `Out-and-Return`.
*   **XContest Flight Verification & Link Integration (`RQ-SCR-003`, `Bug-SCR-002`)**: Directly probes XContest.org via UTC flight date and candidate launch times (+/- 2 minutes) to verify if the flight is claimed. If matched, extracts the permanent internal XContest flight ID (`fl=...`) from OpenGraph metadata and formats a clickable hyperlink (e.g. `=HYPERLINK(url, "XC#6952654")`). If unmatched, automatically evaluates against XContest Rule 3.1 (14-day competition claiming deadline), marking `'Claim soon!'` for flights within 14 days and `'Expired'` for flights older than 14 days.

## 5. 📍 Geo-Spatial Enrichment
*Maps to `RQ-SCR-002`*

Adds location context to raw GPS coordinates.
*   **Reverse Geocoding**: Converts Lat/Lon to "Nearest Town, Region, Country".
*   **Site Detection**: Identifies known Paragliding Takeoffs/Landings within search radius using Paragliding Earth (primary) with OpenStreetMap Overpass API fallback.
*   **SeeYou Cloud Integration**: Valid flights are automatically uploaded to a public folder and linked directly to SeeYou Cloud for 3D visualization.
*   **Automated Historical Weather Enrichment (`RQ-SCR-004`)**: Automatically fetches historical weather conditions at launch and landing coordinates for the flight date and time using Open-Meteo as primary (with 7-day forecast fallback for recent flights) and Visual Crossing Timeline API as backup (`WEATHER_PROVIDERS`, `VISUAL_CROSSING_API_KEY`). Prepopulates editable fields (`Wind@Launch`, `Wind@Landing`, `Cloud %`, `Cloudbase`, `Temp (C)`, `Observations`) featuring cardinal wind directions with gusts (e.g. `14 km/h WNW (gust 20)`) and convective cloudbase in MSL & AGL via the Lawrence spread formula (e.g. `2400m MSL (1200m AGL)`).

## 6. 🖥️ User Interface (UI)
*Maps to `RQ-SYS-002`*

The visual layer where users interact with the data.
*   **Flights Tab**: The main logbook view. Uses a **2-Row Header** design (Category + Field) for clarity, with Cell A2 providing a direct hyperlink to the Master Flight Log Drive folder. Columns are frozen through Column D (`Auto Summary`) for seamless horizontal scrolling across wide data groups.
*   **Column Grouping & Streamlined Schema**: Columns are physically grouped and colored by function (*Flight Info*, *Gear*, *XC Scoring*, *Launch*, *Landing*, *Weather*, *Analytics*, *Validation*, *Meta*). Redundant columns (`Launch-Landing Dist (km)` and gear snapshot baselines `GlideRatio_LD`, `Trim_kmh`, `FullBar_kmh`) have been eliminated to keep records lean.
*   **Dynamic Dropdowns & Validation Rules**: `Flight Type` and `XC Flight Class` dynamically bind to populated ranges in the `Config` tab (`Config!K3:K` and `Config!L3:L`), `Closed?` provides a clean `Yes` / `No` dropdown, and `Add manual flight` sets the default status to `Review?`.
*   **Download & Visualization Links**: `FlightID` links directly to SeeYou Cloud 3D visualization, while `Flight No` wraps sequential numbering with a direct download hyperlink to the master IGC file.
*   **Header Tooltips**: Header cells on Row 4 contain cell notes (e.g. "Click to view flight" and "Click to download igc") for intuitive guidance.
*   **Menus**: A custom "Flight Log" menu provides one-click access to common actions (Add Flight, Upload, Flight Maintenance, and Admin tools including dedicated Dashboard and User Guide tab refreshers).
*   **Dialogs**: Custom HTML interfaces for File Uploads, URL/Drive imports, interactive Purge stepping, duplicate removal staging, and configuration export/import.
*   **Flight Inspector**: A dedicated sidebar to view, edit, and audit flight details without horizontal scrolling. Includes collapsible sections and direct SeeYou Cloud links.
*   **Flight Maintenance & Bulk Operations (`RQ-SYS-007`)**: A unified modal dialog (`FlightMaintenanceDialog.html`) allowing pilots to select scope (Selected rows vs. All flights) and execute batch operations: backfill historical weather, backfill missing geo/site data, re-verify XContest flight claims, recompute physics and thermalling modes, recalculate XC score, and sort flights by date.

## 7. 📊 Flight Dashboard
*Maps to `RQ-SYS-005`, `CR-SYS-001`, `CR-SYS-002`*

A high-level visual dashboard structured into a compact 6-column layout (Columns A through F, ~930px width) powered by resilient, insertion-safe `INDIRECT` Google Sheets formulas with word wrapping enabled across all cells.
*   **Master Log Folder Link**: Row 2 features a prominent direct hyperlink to the Master Flight Log Google Drive folder.
*   **Banner 1: All-Time Summary (3 KPIs)**: Columns `A:B`, `C:D`, and `E:F` showcase Total Flights, Total Airtime Hours (formatted cleanly as `[h]:mm "hrs"` via `TIMEVALUE`), and Total Distance (`#,##0 "km"`).
*   **Banner 2: Year-to-Date Summary (3 KPIs)**: Columns `A:B`, `C:D`, and `E:F` dynamically compute Flights, Airtime Hours (`[h]:mm "hrs"`), and Distance flown in the current calendar year (`YEAR(TODAY())`).
*   **Section 3: 6-Month Rolling Activity Timeline & Pilot Currency Shading**: Columns A through F provide a horizontal monthly timeline of the last 6 months in ascending order (5 months ago to current month), dynamically displaying Month Name (`mmm-yyyy`), Total Flights, Total Airtime Hours, and Total Distance for each individual month.
    *   *Pure Numeric Underlying Values*: Flights are pure numbers (`0 "flts"`), Duration is pure numeric day fractions (`[h]:mm "hrs"`), and Distance is numeric (`#,##0 "km"`).
    *   *Currency Color Shading*: Dynamic conditional formatting shades the Flights and Hours rows to provide an instant visual reference of currency and recency:
        *   **Orange** (`#FFE0B2`): Below low threshold (`< TIMELINE_FLIGHTS_LOW`, `< TIMELINE_HOURS_LOW`).
        *   **Yellow** (`#FFF9C4`): Moderate activity (`LOW..MED`).
        *   **Green** (`#C8E6C9`): Current / high activity (`>= TIMELINE_FLIGHTS_MED`, `>= TIMELINE_HOURS_MED`).
        *   *Configurable Thresholds*: Managed in `Parameters` sheet (`TIMELINE_FLIGHTS_LOW: 2 flts`, `TIMELINE_FLIGHTS_MED: 6 flts`, `TIMELINE_HOURS_LOW: 1:00 hrs`, `TIMELINE_HOURS_MED: 4:00 hrs`).
*   **Section 4: 4 x 2 Leaderboard Grid (8 Cards)**: Symmetrical cards (3 cells wide each across Columns A:C and D:F):
    *   *Grid Row 1*: **Top 5 by Duration** (formatted as `Flight X - [h]:mm hrs (Summary)`) & **Top 5 by Distance** (Track Length in km).
    *   *Grid Row 2*: **Top 5 by Max Altitude** (Peak altitudes in meters from Col AB) & **Top 5 by Altitude Gain** (Total height gain in meters from Col AD).
    *   *Grid Row 3*: **Top 5 Thermal Flights** (calculated as `Thermal% x Duration`, formatted as `Flight X - [h]:mm hrs (Pct%, Summary)`) & **Top 5 Soaring Flights** (calculated as `Soar% x Duration`).
    *   *Grid Row 4*: **Top 5 by XC Score** (Official competition points from Col V) & **Top 5 by Max Groundspeed** (Max groundspeed in km/h from Col AG).
*   **Section 5: Complete Unique Lists**: Two side-by-side lists pre-scaffolded for up to 20 locations:
    *   *Columns A:C*: **List of Launch Sites** (ordered by flight count descending from Col AL).
    *   *Columns D:F*: **List of Countries** (ordered by flight count descending from Col AN).
*   **Immune to Row Operations**: All formulas reference `INDIRECT("Flights!..." & dataStartRow & ":...")`, ensuring that row insertions before row 5, deletions, or sorts never shift or break formula ranges. Dedicated menu item `Flight Log > Admin > Admin: Refresh Dashboard` allows instantaneous regeneration.

## 8. 🛡️ Administration & Setup
*Maps to `RQ-SYS-001`, `RQ-SYS-008`*

Tools for managing the system's lifecycle.
*   **In-App Folder Picker**: Built-in Drive folder browser dialog allowing users to navigate "My Drive", drill down into subfolders, verify URLs/IDs, and select folders with "Replace" or "Add to List" actions.
*   **Human-Readable Path Enrichment**: Folder parameter updates automatically write human-readable folder breadcrumb paths (`[Path: My Drive / ...]`) to the `Description` column in the `Parameters` sheet.
*   **First Time Setup & Scaffold**: A "Scaffold" feature automatically creates all necessary sheets, headers, and validation rules if they are missing or deleted. Generates 7 core tabs (`Dashboard`, `Flights`, `Pilot_Profile`, `Equipment`, `User Guide`, `Config`, `App_Log`).
*   **Interactive Setup Wizard & Templating (`RQ-SYS-008`)**: Streamlined onboarding workflow designed to replace manual script setup with a copyable sheet template and an interactive setup wizard guiding initial folder configuration, pilot credentials, equipment defaults, and trigger installation.
*   **Configuration Management (`Save Config` / `Load Config`)**: Built-in JSON export and import tools under `Flight Log > Admin > Configuration Management` to backup and restore system parameters, pilot profile, and lookup settings. Supports 5 granular parameter export/import groups (8 Ingestion, 16 Integrations & Geo/Time, 19 Scoring & Physics, 2 Format and Units, 4 UI & Dashboard Currency) alongside Pilot Profile (34 fields) and Lookups (6 manual lists). Pure key-value synchronization on Columns A/B protects sheet layout, section dividers, and formula integrity. Load Config features automated section detection, live count badges, and dynamic UI protection (unchecking, disabling, and dimming missing sections).
*   **Consolidated Config Tab**: A unified `Config` sheet combines system parameters (Columns A:C organized under sub-headers `[ Ingestion ]`, `[ Integrations ]`, `[ Geo & Time ]` with `CONTACT_EMAIL`, `[ Validation ]`, `[ Analysis Rules ]`, `[ Analysis - Adv ]`, `[ Scoring ]`, `[ Format and Units ]`, `[ Dashboard & Currency ]`), blank spacer Column D, and lookup tables (Columns E:N): manual controlled vocabularies on the left in Columns 5–10 (`Equipment Categories`, `Flight Status`, `Flight Type`, `XC Classes`, `Date Formats`, `Time Formats`) and dynamic equipment queries on the right in Columns 11–14 (`Wings (Auto)`, `Harnesses (Auto)`, `Reserves (Auto)`, `Other (Auto)`).
*   **Maintenance**: Admin tools to "Reset System", "Reformat Sheets", and "Backup Data" (creates safety copies of `Flights`, `Pilot_Profile`, `Equipment`, and `Config`).
*   **Equipment Manager**: dedicated tab for `Equipment`. Rows added here immediately appear in the Flights dropdowns via dynamic queries on the `Config` tab.

## 9. ⚙️ System Internals
*Maps to `RQ-ING-001`, `RQ-ANA-001`*

Under-the-hood capabilities that drive reliability.
*   **Automated Triggers**: Time-based triggers checking for new files in the background every hour (if enabled).
*   **Robust Logging**: A dedicated `Import_Log` tab (or `App_Log`) captures detailed success/failure messages, including specific API errors or validation reasons.
*   **Rate Limiting**: Intelligent caching and throttling to prevent hitting Google or OpenStreetMap API quotas.
*   **Unit Tests**: A comprehensive suite of tests (`Test.gs`) ensures parsing and scoring logic remains accurate during updates.

## 10. 📖 User Guide & Onboarding
*Maps to `RQ-SYS-006`*

Comprehensive documentation designed to guide pilots from initial setup to day-to-day operation.
*   **In-App User Guide Tab (`RQ-SYS-006.1`)**: A dedicated sheet tab (`User Guide`) containing structured reference documentation: System Overview & Architecture, Initial Configuration & Folders (including `TRASH_FOLDER_ID`, `XCONTEST_USERNAME`, `WEATHER_PROVIDERS`, and folder paths), Daily Flight Logging Workflows (including duplicate detection, device quality scoring, and `Dup-Primary`/`Dup-Others` candidate triage), System Maintenance & Admin Operations (purging `Remove` flights, re-syncing from master folder, weather backfill, geo resolution, XContest verification, physics recompute, date sorting), and a **Comprehensive Metric Dictionary** defining all calculated fields (Status taxonomy, Flight Info, Gear Tracking, XC Scoring & XContest hyperlinking, Analytics & Thermal %, Launch/Landing Geo, Weather, Validation, and Column 70 `IGC Hash`). Includes a dedicated `Flight Log > Admin > Sheet Maintenance & Views > Refresh User Guide & Metric Dictionary` menu command to re-sync the guide at any time without disturbing flight records.
*   **External Onboarding Guide (`RQ-SYS-006.2`)**: A standalone document (`User_Guide.md`) containing the complete system overview, prerequisites, folder setup, duplicate review workflows, initial setup walkthrough, and full metric dictionary so new pilots can review and prepare before creating their Google Sheet.

## 11. 👤 Pilot Profile & Credentials
*Maps to `RQ-SYS-009`, `CR-SYS-004`*

A centralized profile tab (`Pilot_Profile`) structured into a clean 3-column layout (`Field`, `Value`, `Notes / Instructions`) with merged section divider headers and 34 standardized fields:
*   **`[ Identity ]`**: Legal Full Name, Callsign / Nickname, Email, Phone Number, Home Country & Town, and Other Identity Info.
*   **`[ Licensing ]`**: National Association, Pilot Rating, National Licence Info, FAI Sporting Licence Info, CIVL ID, and Other Licensing Info.
*   **`[ Affiliations ]`**: Primary Flying Club, Secondary Clubs, National Federation Member #, and Other Affiliations Info.
*   **`[ Emergency / SAR ]`**: Primary Emergency Contact Info, 2nd Emergency Contact Info, 3rd Emergency Contact Info, SAR / Evac Provider Info, Medical Insurance Info, Blood Type, Medical Conditions / Allergies, and Other Emergency Info.
*   **`[ Tracking / Gear ]`**: Garmin inReach IMEI, Garmin MapShare URL, Flymaster Live URL, XContest Live URL, Emergency Beacon Hex ID, and Other Tracking / Gear Info.
*   **`[ Progression ]`**: Current Season XC Goals, SIV / Maneuver Notes, General Flying Notes, and Other Progression Info.
*   **Non-Destructive Key-Value Sync**: Scaffolding, JSON config export, and JSON config restore treat the profile as a pure key-value store, matching by Field name and writing strictly into the Value column without disturbing section headers, formatting, or instructions.
*   **Dashboard & Inspector Integration**: Surfaces pilot name, rating, and quick-access emergency tracking links onto the `Dashboard` and `Flight Inspector` sidebar.


