# Paragliding Flight Log - Setup Guide

This guide walks you through setting up the Paragliding Flight Log System from scratch in your own Google Drive.

> [!NOTE]
> **Planned Streamlining (`RQ-SYS-008`)**: We are evaluating a template-based distribution model (copying a pre-configured template sheet with pre-bound script attached) paired with an interactive First-Time Setup Wizard. This will replace the manual script pasting below with a 1-click template copy and guided setup wizard.

## Prerequisites
*   A Google Account.
*   A Google Spreadsheet (new or existing).
*   A folder in Google Drive to serve as the "Watch Folder" (where you will drop your `.igc` files).

---

## Step 1: Initialize the Spreadsheet
1.  Create a new Google Sheet.
2.  Name it (e.g., "My Flight Log").

## Step 2: Install the Script
1.  In the menu bar, go to **Extensions** > **Apps Script**.
2.  This will open a new tab with the script editor.
3.  **Delete** any default code (e.g., `function myFunction() {...}`).
4.  **Copy & Paste** the provided `Code.gs` (and any other `.gs` files provided) into the editor.
5.  Click the **Save** icon (floppy disk) or press `Ctrl+S`. Name the project "FlightLogScript".

## Step 3: Authorization (First Run)
1.  In the script editor toolbar, select `onOpen` from the function dropdown list.
2.  Click **Run**.
3.  Google will ask for permissions.
    *   Click **Review Permissions**.
    *   Choose your account.
    *   *Note*: You may see a "App isn't verified" warning (since you are the developer). Click **Advanced** -> **Go to FlightLogScript (unsafe)** -> **Allow**.
4.  Once execution finishes, switch back to your Spreadsheet tab.

## Step 4: Scaffolding (Automatic Setup)
1.  You should now see a custom menu called **Flight Log** in the toolbar (refresh the spreadsheet if you don't).
2.  Click **Flight Log** > **Admin** > **First Time Setup (Full Scaffold)**.
3.  The script will automatically generate the following core sheets:
    *   `Dashboard`: High-level flight statistics, live dynamic KPI cards, top lists, and Master Log link.
    *   `Flights`: Main flight log table with category groups, column headers, and weather telemetry.
    *   `Pilot_Profile`: Central profile for pilot credentials, ratings, emergency contacts, and live tracking links.
    *   `Equipment`: Unified inventory for wings, harnesses, reserves, and instruments.
    *   `User Guide`: Comprehensive in-app guide and complete Metric Dictionary.
    *   `Parameters`: Central configuration key/value pairs with human-readable descriptions.
    *   `Lookups`: Dynamic dropdown lists and category references.
    *   `App_Log`: Detailed ingestion and system execution logs.

## Step 5: Configuration
1.  Go to the **Parameters** sheet (or use the helper menu items under **Flight Log** > **Admin**).
2.  Fill in or verify the configuration settings:
    *   **WATCH_FOLDER_ID**: *[REQUIRED]* Google Drive folder ID(s) to scan for `.igc` files (comma-separated for multiple folders, or set via **Admin** > **Update Watch Folder...**).
    *   **MASTER_LOG_FOLDER_ID**: *[REQUIRED]* Drive folder ID for permanent flight log file mirrors.
    *   **UPLOAD_FOLDER_ID**: Drive folder ID for staging manual uploads.
    *   **ERROR_FOLDER_ID**: Drive folder ID for files that fail parsing or validation.
    *   **WEATHER_PROVIDERS**: `open_meteo, visual_crossing` (order of weather services. Open-Meteo works out of the box with zero API keys).
    *   **VISUAL_CROSSING_API_KEY**: Optional API key for Visual Crossing backup (free 1,000 requests/day at visualcrossing.com).
    *   **CONTACT_EMAIL**: *[REQUIRED]* Your contact email (required for User-Agent in OSM/Nominatim/Open-Meteo requests).
    *   **ENABLE_WATCH_FOLDER**: `TRUE` / `FALSE` to control automated watcher scanning.
    *   **MOVE_FROM_WATCH_FOLDER**: `TRUE` to move files from Watch Folder after successful ingestion.
    *   **GEO_REV_PROVIDERS**: `bigdatacloud,nominatim` (fallback chain for reverse geocoding).
    *   **GEO_SITE_PROVIDERS**: `paraglidingearth,overpass` (fallback chain for launch/landing site detection).
    *   **OSM_RADIUS_M**: `3000` (search radius in meters for nearby sites).
    *   **XCONTEST_USERNAME**: Pilot username on XContest for flight verification.
    *   **THERMAL_MIN_CLIMB**: `0.3` (m/s climb rate threshold).
    *   **THERMAL_MIN_TURN**: `8` (degrees/sec turning rate threshold).
    *   **VALIDATION_MIN_DURATION_SEC**: `120` (minimum flight duration in seconds).
    *(Note: Flight Types and XC Classes are customizable directly under the **Lookups** sheet tab).*

## Step 6: Define Your Gear & Pilot Profile
1.  Go to the **Pilot_Profile** sheet and fill in your ratings, emergency contacts, and live tracking links (e.g. Garmin inReach).
2.  Go to the **Equipment** sheet and edit or add rows for your gear:
    *   **Category**: `Wing`, `Harness`, `Reserve`, or `Other`.
    *   **EquipmentID**: A unique, concise identifier (e.g. `Photon`, `Zeno2`, `Genie Race 4`). This appears in the `Flights` sheet dropdowns.
    *   **Make**, **Model**, **Size**, **Type**: Descriptive gear details.
    *   **Default?**: Mark `TRUE` for your primary gear to auto-populate new flights.
    *   **Glide**, **Trim**, **Full**: Baseline glide ratio and speeds (km/h) for telemetry reference.

## Step 7: Automation Setup (Optional)
To have the sheet automatically check for new flights dropped into your Watch Folder:
1.  Click **Flight Log** > **Admin** > **Setup 5-min watcher trigger**.
2.  This schedules an automatic background job that checks your Watch Folder every 5 minutes.

---

## Usage
*   **Watch Folder**: Drop `.igc`, `.zip`, or `.gz` files into your Drive Watch Folder. Trigger an immediate scan via **Flight Log** > **Add Flight** > **Scan Watch Folder Now**, or let the 5-min trigger run automatically.
*   **Web / Drive URL**: Click **Flight Log** > **Add Flight** > **Add files from URL (folder, igc, zip)...** to import from web links or Drive shared folders.
*   **File Upload**: Click **Flight Log** > **Add Flight** > **Add flight from Upload (Local File)...** to upload directly from your computer.
*   **Manual Entry**: Click **Flight Log** > **Add Flight** > **Add manual flight (blank row)** to log a non-tracked flight.
*   **Inspect & Edit**: Highlight a flight and click **Flight Log** > **Flight Inspector** to view telemetry analysis, track log links, or edit notes.
*   **Flight Maintenance**: Click **Flight Log** > **Flight maintenance** > **Flight Maintenance...** to open the unified dialog for batch weather backfill, geo resolution, XContest reverification, physics/scoring recalculation, and date sorting.

