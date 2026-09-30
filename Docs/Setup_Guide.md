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
1.  You should now see a custom menu called **Flight Log** in the toolbar (refresh the page if you don't).
2.  Click **Flight Log** > **Scaffold: Create tabs & headers**.
3.  The script will automatically generate the following sheets:
    *   `Flights`: The main log.
    *   `Equipment_Wings`: Inventory for wings.
    *   `Equipment_Harnesses`: Inventory for harnesses.
    *   `Lookups`: Configuration settings.
    *   `Import_Log`: System logs.

## Step 5: Configuration
1.  Go to the **Lookups** sheet.
2.  Fill in the required values. The system uses these defaults if not specified, but you should verify them:
    *   **WATCH_FOLDER_ID**: *[REQUIRED]* The ID of your Drive folder.
    *   **CONTACT_EMAIL**: *[REQUIRED]* Your email address.
    *   **WATCH_PERIOD_MIN**: `15`
    *   **OSM_RADIUS_M**: `3000`
    *   **REVGEO_PROVIDER**: `nominatim`
    *   **FLIGHT_TYPES**: `Free Fly, XC, Soaring, Comp, SIV / Maneuvers, Training, Other`
    *   **NATIONAL_BONUS_WITHIN_PCT**: `5`
    *   **NATIONAL_BONUS_MULTIPLIER**: `1.2`
    *   **THERMAL_MIN_CLIMB**: `0.3`
    *   **THERMAL_MIN_TURN**: `8`
    *   **VALIDATION_MIN_DURATION_SEC**: `120` (2 minutes)
    *   *...and other thresholds as desired.*

## Step 6: Define Your Gear
1.  Go to **Equipment_Wings**.
2.  Edit the sample row to match your current wing.
    *   **WingID**: A short name (e.g., "Photon", "Zeno2"). This will appear in the dropdowns.
    *   **GlideRatio_LD**: Used for calculations (e.g., `10.5`).
3.  Repeat for Harnesses and Reserves if desired.

## Step 7: Automation Setup (Optional)
To have the sheet automatically check for new files:
1.  Click **Flight Log** > **Setup 5-min watcher trigger**.
2.  This creates a background job that looks for new files every 5 minutes.

---

## Usage
*   **Import**: Drop `.igc` or `.zip` files into your Watch Folder.
*   **Manual**: Use **Flight Log** > **Add flight from IGC...** to paste a link directly.
*   **Review**: New flights appear at the top of the `Flights` sheet. Check the status column.
