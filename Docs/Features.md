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
*   **Multi-Source**: Supports Drag-and-Drop Uploads, Drive Folder/File URL imports, and Bulk ZIP extraction.
*   **Parsing**: Extracts pilot details, glider type, and high-fidelity G-Record data (GNSS/Pressure altitude).
*   **Master Log Mirror & Strict Folder Authority**: Automatically copies and standardizes flight logs to the configured public folder (`MASTER_LOG_FOLDER_ID`) for SeeYou Cloud and direct downloads. Folders are strictly driven by the `Parameters` sheet; missing folders abort ingestion with clear user alerts and folders are never created in Drive root.
*   **Context-Aware Cleanup**:
    *   *Watch Folder*: Moves/trashes files upon successful ingestion per `MOVE_FROM_WATCH_FOLDER` setting; moves corrupt/errored files into `ERROR_FOLDER_ID`.
    *   *URL & Drive Import*: When "Delete from source" is unchecked, successful files copy to Master Log and failed files copy to Error Folder, leaving all Drive source files intact. When checked, source files are trashed after copying. Staged temporary files from web URLs or unzipped packages are always cleaned up from `UPLOAD_FOLDER_ID`.
    *   *File Upload*: Staged temporary uploads are mirrored to Master or Error folder and trashed from `UPLOAD_FOLDER_ID`.

## 2. ✈️ Automated Flight Logging
*Maps to `RQ-ING-002`*

Converts raw data into a structured Pilot Logbook in Google Sheets.
*   **Auto-Summary**: Generates human-readable summaries (e.g. "2h 10m XC at Bir Billing").
*   **Data Validation**: Flags flights as `Needs Review`, `Valid`, or `Invalid` based on heuristic checks (e.g. Flight looks like a car drive).
*   **Gear Tracking**: Auto-fills Wing, Harness, and Reserve based on the last valid flight ("Sticky Defaults") or IGC headers.
*   **Snapshotting**: Records equipment performance metrics (e.g. Trim Speed, Glide) at the time of the flight.

## 3. 📊 Flight Analysis
*Maps to `RQ-ANA-001`, `RQ-ANA-002`*

Analyzes the track log to understand *how* you flew.
*   **Mode Detection**: Automatically classifies segments as **Thermal** (Circling), **Soaring** (Ridge), **Glide** (Transition), or **Sink**.
*   **Performance Metrics**: accurate calculation of Max Climb rates, Height Gains, Soar Efficiency (m/km), and in-flight Glide L/D.
*   **Safety Checks**: Flags abnormally high sink rates or ground proximity events.

## 4. 🏆 XC Scoring (League Rules)
*Maps to `RQ-SCR-001`*

Applies standard XContest/FAI scoring rules to every flight.
*   **Optimization**: Finds the optimal 3 Turnpoints to maximize distance.
*   **Triangle Detection**: Identifies **Flat Triangles** (<20% gap) and **FAI Triangles** (strict leg geometry).
*   **Scoring**: Calculates points with appropriate multipliers (e.g. 1.4x for FAI Triangle).
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
*   **Dynamic Dropdowns & Validation Rules**: `Flight Type` and `XC Flight Class` dynamically bind to populated ranges in the `Lookups` tab (`Lookups!G3:G` and `Lookups!H3:H`), `Closed?` provides a clean `Yes` / `No` dropdown, and `Add manual flight` sets the default status to `Review?`.
*   **Download & Visualization Links**: `FlightID` links directly to SeeYou Cloud 3D visualization, while `Flight No` wraps sequential numbering with a direct download hyperlink to the master IGC file.
*   **Header Tooltips**: Header cells on Row 4 contain cell notes (e.g. "Click to view flight" and "Click to download igc") for intuitive guidance.
*   **Menus**: A custom "Flight Log" menu provides one-click access to common actions (Add Flight, Upload, Flight Maintenance, and Admin tools including dedicated Dashboard and User Guide tab refreshers).
*   **Dialogs**: Custom HTML interfaces for File Uploads and "Add files from URL (folder, igc, zip)" supporting both manual URL/ID entry and native Google Drive folder exploration with optional "Delete from source" cleanup.
*   **Flight Inspector**: A dedicated sidebar to view, edit, and audit flight details without horizontal scrolling. Includes collapsible sections and direct SeeYou Cloud links.
*   **Flight Maintenance & Bulk Operations (`RQ-SYS-007`)**: A unified modal dialog (`FlightMaintenanceDialog.html`) allowing pilots to select scope (Selected rows vs. All flights) and execute batch operations: backfill historical weather, backfill missing geo/site data, re-verify XContest flight claims, recompute physics and thermalling modes, recalculate XC score, and sort flights by date.

## 7. 📊 Flight Dashboard
*Maps to `RQ-SYS-005`, `CR-SYS-001`*

A high-level visual dashboard structured into a compact 8-column layout (Columns A through H) powered by resilient, insertion-safe `INDIRECT` Google Sheets formulas.
*   **Master Log Folder Link**: Row 2 features a prominent direct hyperlink to the Master Flight Log Google Drive folder.
*   **Live KPI Cards**: 4 compact cards (2 cells wide each across A3:H5) calculating Total Flights, Total Airtime Hours (summed in decimal hours via `TIMEVALUE`), Total Distance (km), and Flights Flown in the Current Year.
*   **2-Column Card Grid (2 + 2 + 1)**: Distinct cards (4 cells wide each across Major Columns A:D and E:H):
    *   *Row 7–12*: **Top 5 by Duration** (numerically sorted via `TIMEVALUE`) & **Top 5 by Distance** (Track Length).
    *   *Row 14–19*: **Recent Activity** (descending Date sort) & **Top Sites** (Launch Site frequency from Col AL).
    *   *Row 21–26*: **Countries Flown** (Country frequency from Col AN).
*   **Immune to Row Operations**: All formulas reference `INDIRECT("Flights!..." & dataStartRow & ":...")`, ensuring that row insertions before row 5, deletions, or sorts never shift or break formula ranges.

## 8. 🛡️ Administration & Setup
*Maps to `RQ-SYS-001`, `RQ-SYS-008`*

Tools for managing the system's lifecycle.
*   **In-App Folder Picker**: Built-in Drive folder browser dialog allowing users to navigate "My Drive", drill down into subfolders, verify URLs/IDs, and select folders with "Replace" or "Add to List" actions.
*   **Human-Readable Path Enrichment**: Folder parameter updates automatically write human-readable folder breadcrumb paths (`[Path: My Drive / ...]`) to the `Description` column in the `Parameters` sheet.
*   **First Time Setup & Scaffold**: A "Scaffold" feature automatically creates all necessary sheets, headers, and validation rules if they are missing or deleted.
*   **Interactive Setup Wizard & Templating (`RQ-SYS-008`)**: Streamlined onboarding workflow designed to replace manual script setup with a copyable sheet template and an interactive setup wizard guiding initial folder configuration, pilot credentials, equipment defaults, and trigger installation.
*   **Configuration**: A simpler `Parameters` sheet allows users to change system behavior (e.g. "Min Height Gain", "Watch Folder ID") without touching code.
*   **Maintenance**: Admin tools to "Reset System", "Reformat Sheets", and "Backup Data" (creates safety copies of `Flights`, `Pilot_Profile`, `Equipment`, `Parameters`, and `Lookups`).
*   **Equipment Manager**: dedicated tabs for `Wings`, `Harnesses`, and `Reserves`. Rows added here immediately appear in the Flights dropdowns.

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
*   **In-App User Guide Tab (`RQ-SYS-006.1`)**: A dedicated sheet tab (`User Guide`) containing structured reference documentation: System Overview & Architecture, Initial Configuration & Folders (including `XCONTEST_USERNAME`, `WEATHER_PROVIDERS`, and folder paths), Daily Flight Logging Workflows, System Maintenance & Bulk Operations (weather backfill, geo resolution, XContest verification, physics recompute, date sorting), and a **Comprehensive Metric Dictionary** defining all calculated fields (Flight Info, Gear Tracking, XC Scoring & XContest hyperlinking, Analytics & Thermal %, Launch/Landing Geo, Weather, and Validation). Includes a dedicated `Flight Log > Admin > Admin: Refresh User Guide Tab` menu command to re-sync the guide at any time without disturbing flight records.
*   **External Onboarding Guide (`RQ-SYS-006.2`)**: A standalone document (viewable in Markdown/web) containing the high-level system overview, prerequisites, and initial setup steps so new pilots can review and prepare before creating their Google Sheet.

## 11. 👤 Pilot Profile & Credentials
*Maps to `RQ-SYS-009`*

A centralized profile tab (`Pilot_Profile`) to record pilot certifications, emergency information, and tracking gear:
*   **Personal & Contact Details**: Pilot full name, email, phone, and home address.
*   **Certifications & Memberships**: National org ratings (e.g. USHPA, BHPA, FAI license number) and local flying club affiliations.
*   **Emergency & Medical Evacuation**: Emergency contacts, next of kin, emergency medical insurance policy numbers, and search-and-rescue coverage details.
*   **Live Tracking & Satellites**: Garmin inReach IMEI, MapShare public tracking URL, and live flight tracking links.
*   **Free-Form & Structured Notes**: Formatted prompt sections alongside free-form notes.
*   **Dashboard & Inspector Integration**: Surfaces pilot name, rating, and quick-access emergency tracking links onto the `Dashboard` and `Flight Inspector` sidebar.


