# Paragliding Flight Log - Implementation Walkthrough

I have completed the "Fresh Start" implementation (Phase 2). All code is modular, robust, and follows the specifications we defined.

## 📂 Code Files Created
You can find these in the `Code/` folder:

| File | Purpose |
| :--- | :--- |
| **`Code.gs`** | **Entry Point**. Menus, sheet scaffolding, and configuration loading. |
| **`Ingestion.gs`** | **Import Logic**. Handles Drive files, ZIPs, deduplication, and row insertion. |
| **`Parser.gs`** | **Parsing**. Robust IGC parsing logic (Headers, B-records, Stats). |
| **`Analysis.gs`** | **Physics**. Flight Mode detection (Thermal/Soar) and Validation logic. |
| **`Scoring.gs`** | **Optimization**. XC Scoring (Free Dist, Flat/FAI Triangles). |
| **`Geo.gs`** | **Enrichment**. Integrates Nominatim and Overpass for location data. |
| **`Test.gs`** | **Verification**. A standalone test suite to check logic safely. |

## 🚀 Deployment Instructions

### 1. Update Apps Script
1.  Open your Google Sheet.
2.  Go to **Extensions** > **Apps Script**.
3.  **Delete** the old `Code.gs` file (or rename it to `Old_Code.gs` and comment it out).
4.  Create **7 new script files** matching the names above (`Code.gs`, `Ingestion.gs`, etc.).
5.  **Copy & Paste** the content from the corresponding files in your Drive `Code/` folder into the Apps Script editor.
    *   *Tip: Ensure you copy the exact content provided in the `Code/` folder.*

### 2. Verify (Run Tests)
1.  In the Apps Script editor, select the **`runAllTests`** function from the toolbar.
2.  Click **Run**.
3.  Open the **Execution Log** (View > Execution log) to see the results.
    *   ✅ Expect: `ALL TESTS PASSED`.
    *   ❌ If failed: The log will tell you which module (Parser/Analysis/etc) failed.

### 3. Initialize Scaffolding
1.  Refresh your Google Sheet.
2.  You should see the **Flight Log** menu.
3.  Click **Flight Log** > **Setup & Tools** > **Scaffold: Create tabs & headers**.
4.  This will create/update the `Flights`, `Lookups`, `Equipment_*` sheets with the new columns and grouping.

### 4. Configure
1.  Go to the **Lookups** sheet.
2.  Verify the default values (e.g., `VALIDATION_MIN_DURATION_SEC` = 120).
3.  Set your `WATCH_FOLDER_ID` and `CONTACT_EMAIL`.

### 5. Start Using
*   **Import**: Drop files into your Watch Folder and run **Flight Log** > **Scan Watch Folder now** (or set up the trigger).
*   **Manual**: Use manual entry if needed (placeholder).

## 🛡️ New Features Overview
-   **Validation**: Flags flights as `Invalid?` if they look like driving (Speed > 120km/h) or kiting.
-   **XC Scoring**: Automatically calculates Free Distance and Triangles for every flight.
-   **Full Stats**: Captures Thermal %, Glide L/D, and more in the `Analytics` group (collapsed by default).

## 🛠️ Troubleshooting & Fixes (v0.6.2)
If your dropdowns (Flight Type, Equipment) are not showing correctly:
1.  Go to **Flight Log** > **Admin** > **Update Dropdowns & Validation (Safe)**.
2.  This will re-apply the latest validation rules to both `Flights` and `Equipment` sheets without affecting your data.
