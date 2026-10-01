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
    *   **ERROR_FOLDER_ID**: Drive folder ID for files that fail parsing or have fatal errors (requires investigation).
    *   **TRASH_FOLDER_ID**: Drive folder ID for discarded, duplicate, and purged flight files (safe to empty anytime).
    *   **WEATHER_PROVIDERS**: `open_meteo, visual_crossing` (order of weather services. Open-Meteo works out of the box with zero API keys).
    *   **VISUAL_CROSSING_API_KEY**: Optional API key for Visual Crossing backup (free 1,000 requests/day at visualcrossing.com).
    *   **CONTACT_EMAIL**: *[REQUIRED]* Your contact email (required for User-Agent in OSM/Nominatim/Open-Meteo requests).
    *   **ENABLE_WATCH_FOLDER**: `TRUE` / `FALSE` to control automated watcher scanning.
    *   **MOVE_FROM_WATCH_FOLDER**: `TRUE` to move files from Watch Folder after successful ingestion.
    *   **GEO_REV_PROVIDERS**: `google, big_data_cloud, nominatim_osm` (fallback chain for reverse geocoding).
    *   **GEO_SITE_PROVIDERS**: `paragliding_earth, overpass_api` (fallback chain for launch/landing site detection).
    *   **OSM_RADIUS_M**: `3000` (search radius in meters for nearby sites).
    *   **XCONTEST_USERNAME**: Pilot username on XContest for flight verification.
    *   **TIMELINE_FLIGHTS_LOW**: `2` (Monthly flight count threshold for moderate activity / yellow shading on dashboard timeline).
    *   **TIMELINE_FLIGHTS_MED**: `5` (Monthly flight count threshold for high activity / green shading on dashboard timeline).
    *   **TIMELINE_HOURS_LOW**: `0.04166666667` (1.0 hr/month day fraction threshold for moderate currency / yellow shading, formatted as `[h]:mm "hrs"`).
    *   **TIMELINE_HOURS_MED**: `0.1666666667` (4.0 hrs/month day fraction threshold for high currency / green shading, formatted as `[h]:mm "hrs"`).
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
1.  Click **Flight Log** > **Admin** > **Automation & Services** > **Setup 5-min watcher trigger**.
2.  This schedules an automatic background job that checks your Watch Folder every 5 minutes.

---

## Usage
*   **Watch Folder**: Drop `.igc`, `.zip`, or `.gz` files into your Drive Watch Folder. Trigger an immediate scan via **Flight Log** > **Add Flight** > **Scan Watch Folder Now**, or let the 5-min trigger run automatically.
*   **Web / Drive URL**: Click **Flight Log** > **Add Flight** > **Add files from URL (folder, igc, zip)...** to import from web links or Drive shared folders.
*   **File Upload**: Click **Flight Log** > **Add Flight** > **Add flight from Upload (Local File)...** to upload directly from your computer.
*   **Manual Entry**: Click **Flight Log** > **Add Flight** > **Add manual flight (blank row)** to log a non-tracked flight.
*   **Inspect & Edit**: Highlight a flight and click **Flight Log** > **Flight Inspector** to view telemetry analysis, track log links, or edit notes.
## Multi-Device Logging & Smart Deduplication
Many pilots record flights simultaneously on multiple devices (for example, a flight phone running XCTrack paired via Bluetooth to a Stodeus UltraBliP, alongside a backup GPS/audio vario). The system handles this gracefully:

1.  **Exact File Duplicates (Hard Match)**:
    *   Identical files (MD5 content match) are automatically skipped upon re-import and routed to your Drive `TRASH_FOLDER_ID`.
    *   If you previously deleted a flight row from the sheet but the IGC still exists in your `MASTER_LOG_FOLDER_ID`, the system intelligently re-links to that existing Master file rather than creating duplicate `_copy.igc` files.
2.  **Heuristic Overlap Detection (Multi-Device Match)**:
    *   When multiple tracks occur on the same day within $\pm 15$ minutes of launch (or overlapping duration intervals) and launch within $1{,}000$ meters of each other, the system recognizes them as candidate recordings of the same flight.
3.  **Automatic Quality Scoring (0–100 Points)**:
    *   **Device Preference (Max 40 pts)**: XCTrack (40 pts — preferred primary BLE instrument), Dedicated flight vario (30 pts — UltraBliP, XC Tracer, Flymaster, etc.), Generic apps (20 pts), Unknown (10 pts).
    *   **Barometric Pressure Sensor (Max 30 pts)**: Authentic barometric sensor readings differing from GPS altitude.
    *   **Sampling Resolution & Duration (Max 20 pts)**: High-frequency $\le 1$s/1Hz recording (15 pts) + duration $> 30$ min (5 pts).
    *   **Metadata Richness (Max 10 pts)**: Glider type, pilot name, and hardware headers.
4.  **Candidate Status Tagging & Pairing Notes**:
    *   The highest-scoring track is assigned **`Dup-Primary`** (highlighted in gold).
    *   The backup track(s) are assigned **`Dup-Others`** (highlighted in orange).
    *   Both rows receive cross-referencing audit notes (e.g. `[DupRef: DUP_20260930_1420 | Paired with F20260930_02 (Score: 85 vs 60)]`).
5.  **Dashboard Protection**:
    *   All Dashboard KPIs, flight counts, currency timelines, and leaderboards strictly filter for **`Status = "Valid"`**. Incoming `Review?`, `Dup-Primary`, or `Dup-Others` flights will never pollute your pilot statistics until you confirm them.
6.  **Review & Cleanup Workflow**:
    *   Review the paired flights in the `Flights` tab or via **Flight Log** > **Flight Inspector**.
    *   Change your preferred track's Status to **`Valid`**.
    *   If you wish to discard the backup track, change its Status to **`Remove`**, then run **Flight Log** > **Flight maintenance** > **Purge Flights Marked 'Remove'**. This cleanly moves the backup file to your Drive Trash folder, deletes the row, and updates deduplication tracking.

## Maintenance & Bulk Operations
*   **Purge Discarded Flights**: Mark unwanted backup or test rows as `Remove` in the Status column, then select **Flight Log** > **Flight maintenance** > **Purge Flights Marked 'Remove'** to automatically delete the rows, move their Master IGC files to the Trash folder, and refresh deduplication hashes.
*   **Re-sync from Master Folder**: If rows were accidentally deleted, run **Flight Log** > **Flight maintenance** > **Re-sync Missing Flights from Master Folder** to open an interactive progress dialog that scans your Master Log folder and restores missing flights with `Review?` status.
*   **Unified Flight Updates**: Click **Flight Log** > **Flight maintenance** > **Flight Updates...** to open the unified dialog for batch weather backfill, geo resolution, XContest reverification, physics/scoring recalculation, and date sorting.

