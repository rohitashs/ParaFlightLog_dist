# Paragliding Flight Log - Verification Walkthrough

This guide will help you verify that the system is correctly installed and functional.

## 1. Verify Code Deployment
1.  Open your Google Sheet.
2.  Go to **Extensions** > **Apps Script**.
3.  Ensure you see the following files in the "Files" list:
    - `Code.gs`, `Ingestion.gs`, `Parser.gs`, `Analysis.gs`, `Scoring.gs`, `Geo.gs`, `Test.gs`, `appsscript.json`.
4.  If `appsscript.json` is missing, go to **Project Settings** (Gear icon) and check "Show 'appsscript.json' manifest file".

## 2. Run Automated Tests
We have a built-in test harness to check the logic.
1.  In the Apps Script Editor, select `Test.gs` from the file list.
2.  From the function dropdown (top bar), select `runAllTests`.
3.  Click **Run**.
4.  **Expected Output**:
    - The "Execution Log" at the bottom should show `[Info] ALL TESTS PASSED`.
    - You might see a toast notification in the Google Sheet saying "All Tests Passed!".

## 3. End-to-End Test (Simulation)

### Step A: Scaffold the Sheet
1.  Go to the **Google Sheet** tab.
2.  Refresh the page if the "Flight Log" menu is missing.
3.  Click **Flight Log** > **Setup & Tools** > **Scaffold: Create tabs & headers**.
4.  **Verify**: Tabs "Flights", "Lookups", "Equipment_Wings", etc., are created.

### Step B: Configure
1.  Go to the **Lookups** tab.
2.  Enter your email in the `CONTACT_EMAIL` row (used for Geo API User-Agent).
3.  (Optional) Enter a Drive Folder ID in `WATCH_FOLDER_ID` if you want automatic scanning.

### Step C: Import a Flight
1.  Click **Flight Log** > **Add flight from IGC (URL/Drive ID)...**.
2.  Paste this test URL (Sample IGC):
    ```
    https://raw.githubusercontent.com/mhaberler/sky-lines/master/test/data/igc/2014-07-06-00-00-00-000-000-000.igc
    ```
    *(Or use any Drive File ID of a real .igc file you have)*
3.  Click **OK**.
4.  **Verify**:
    - A toast message saying "Import finished."
    - A new row in the **Flights** sheet properly populated with:
        - Flight Date/Time
        - Duration, Distance
        - Launch/Landing info (Reverse Geo might take a second or be cached)
        - XC Score
