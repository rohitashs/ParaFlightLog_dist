# Project Backlog

This file is the single source of truth for Requirements, Bugs, and Change Requests.

**Workflow Rules:**
1.  **Granularity**: Requirements are nested (Feature -> Granular Items).
2.  **States**: `[Imp]` (Implemented), `[WIP]` (Work In Progress), `[Fut]` (Future).
3.  **Dependencies**: A Requirement is NOT complete if it has Open Bugs/CRs.
4.  **Links**: Bugs and CRs must reference the parent Requirement ID (e.g., [REQ-ING-001]).

---

## 1. Requirements (Features)

### 📂 Module: Ingestion (ING)
*Handling file imports, parsing, file system interactions, and deduplication.*

    *   `[Imp]` **003.3**: **Soft Dedupe (Overlap)**: Flag if New Start Time < Existing End Time (Temporal Overlap).
    *   `[Imp]` **003.4**: **Soft Dedupe (Proximity)**: Flag if Start Time < 15min AND Distance < 500m from existing flight.
    *   `[Fut]` **003.5**: "Force Import" override option (Bypass dedupe).

*   **[REQ-ING-004]** **IGC Parsing** `[Imp]`
    *   `[Imp]` **004.1**: Parse B-Records (Time, Lat, Lon, Alt-Pressure, Alt-GNSS).
    *   `[Imp]` **004.2**: Extract Headers (H-Records): Date, Pilot, Glider, FlightID.
    *   `[Imp]` **004.3**: Fallback: Use current date if Header date is missing.
    *   `[Imp]` **004.4**: Validation: Require at least 2 track points to process.

---

### 📊 Module: Analysis & Physics (ANA)
*Flight logic, modes, heuristics, and statistics.*

*   **[REQ-ANA-001]** **Flight Mode Detection** `[Imp]`
    *   `[Imp]` **001.1**: Detect **Thermal** mode (Climb > `THERMAL_MIN_CLIMB` + Turn Rate).
    *   `[Imp]` **001.2**: Detect **Sink** mode (Sink > `SINK_VARIO` threshold).
    *   `[Imp]` **001.3**: Detect **Glide** (Straight flight, low vario).
    *   `[Imp]` **001.4**: Detect **Soaring** (Ridge lift detection, S-turns).

*   **[REQ-ANA-002]** **Heuristic Validation** `[Imp]`
    *   `[Imp]` **002.1**: Flag **Short Flights** (Duration < `VALIDATION_MIN_DURATION_SEC`).
    *   `[Imp]` **002.2**: Flag **Kiting/Ground Handling** (Height gain < `VALIDATION_MIN_HEIGHT_CHANGE_M`).
    *   `[Imp]` **002.3**: Flag **Driving/High Speed** (Max Speed > `VALIDATION_MAX_SPEED_KMH`).
    *   `[Imp]` **002.4**: Output Status: `OK`, `Needs Review`, `Invalid? [Reason]`.

*   **[REQ-ANA-003]** **Advanced Metrics** `[Imp]`
    *   `[Imp]` **003.1**: Standard Stats: Duration, Max Alt, Min Alt, Height Gain, Max Climb, Max Sink.
    *   `[Imp]` **003.2**: Thermal Stats: Count, Avg Climb, Best Climb, % of Time in Thermal.
    *   `[WIP]` **003.3**: Glide Efficiency (L/D) calculation.
    *   `[Imp]` **003.4**: **Snapshotting**: Record Wing specs (Glide/Trim) to the flight row at insertion time.

---

### 🏆 Module: Scouting & Scoring (SCR)
*XC optimization, Geocoding, and Site identification.*

*   **[REQ-SCR-001]** **XC Scoring (XContest Rules)** `[Imp]`
    *   `[Imp]` **001.1**: Track Simplification (Ramer-Douglas-Peucker) for performance.
    *   `[Imp]` **001.2**: Calculate **Free Distance** (Max Open Distance via 3 TPs).
    *   `[Imp]` **001.3**: Detect **Flat Triangle** (Closing gap < 20% of distance).
    *   `[Imp]` **001.4**: Detect **FAI Triangle** (Shortest leg >= 28% of perimeter).
    *   `[Imp]` **001.5**: Apply Multipliers (Free 1.0, Flat 1.2, FAI 1.4).
    *   `[Imp]` **001.6**: **National Points**: Apply bonus multiplier if closed triangle.

*   **[REQ-SCR-002]** **Geo-Spatial Enrichment** `[Imp]`
    *   `[Imp]` **002.1**: **Reverse Geocode**: Lat/Lon -> Town, Region, Country (Nominatim) for Launch & Land.
    *   `[Imp]` **002.2**: **Site Detection**: Find nearest Takeoff/Landing (Overpass API) within `OSM_RADIUS_M`.
    *   `[Imp]` **002.3**: Cache API responses (`CacheService`) to respect rate limits.

---

### 🔧 Module: UI & UX (UI)
*Sheet interaction, menus, and visual feedback.*

*   **[REQ-UI-001]** **Sheet Scaffolding** `[Imp]`
    *   `[Imp]` **001.1**: Create/Repair required tabs (`Flights`, `Lookups`, `Equipment_*`).
    *   `[Imp]` **001.2**: **Column Grouping**: Physically group and collapse columns (Gear, Analytics, etc.).
    *   `[Imp]` **001.3**: **2-Row Headers**: Category (Row 4) + Column Name (Row 5) with Color Coding.
    *   `[Imp]` **001.4**: Freeze top 5 rows.

*   **[REQ-UI-002]** **Manual Flight Entry** `[Imp]`
    *   `[Imp]` **002.1**: Menu "Add manual flight" inserts blank row at top (Row 6).
    *   `[Imp]` **002.2**: Auto-generate Flight ID (Daily increment `FYYYYMMDD_nn`).
    *   `[Imp]` **002.3**: Pre-fill Gear from previous valid flight ("Sticky" defaults).
    *   `[Imp]` **002.4**: Set default Status (`Needs Review`) and TimeZone (`UTC`).
    *   `[Imp]` **002.5**: **Weather Columns**: Dedicated columns for Wind, Cloud, Temp notes.

*   **[REQ-UI-003]** **Data Validation (Dropdowns)** `[Imp]`
    *   `[Imp]` **003.1**: Status Dropdown (`Needs Review`, `Valid`, `Invalid`, `Duplicate`).
    *   `[Imp]` **003.2**: Flight Type Dropdown (`Free Fly`, `XC`, `Comp`, etc.) from config.
    *   `[Imp]` **003.3**: Gear Dropdowns (Wing, Harness, Reserve) dynamically sourced from Equipment sheets.

*   **[REQ-UI-004]** **Configuration** `[Imp]`
    *   `[Imp]` **004.1**: `Lookups` sheet for global settings (Thresholds, Folders).
    *   `[Imp]` **004.2**: `Equipment` sheets for Gear management with "Default" checkbox support.

---

## 2. Bugs
*Defects linked to specific requirements.*

- [x] **[BUG-UI-001]** (Links: [REQ-UI-003]) **Dropdown Misalignment**: Status dropdown is in Col A (should be B). Gear dropdowns are shifted. *Status: Fixed / Verified*
- [x] **[BUG-GEO-001]** (Links: [REQ-UI-002]) **Timezone Failure**: Time Zone defaults to UTC. *Status: Fixed / Verified*
- [ ] **[BUG-GEO-002]** (Links: [REQ-SCR-002]) **Missing Location Data**: Launch/Land Site, Town, Region are empty. *Status: Re-opened (Logic fixed, but likely API rejection)*
- [x] **[BUG-ING-001]** (Links: [REQ-UI-002]) **Column Shift**: Start Date repeated in TimeZone column, shifting everything right. *Status: Fixed*
- [x] **[BUG-UPL-001]** (Links: [REQ-ING-003]) **Upload Fail**: Multi-file upload only processed 1 file. *Status: Fixed (v0.7.4 Client-Side Upload)*
- [x] **[IMP-UPL-002]** (Links: [REQ-ING-003]) **ZIP Reporting**: Accurately count flights from ZIPs. *Status: Implemented (v0.7.5)*
- [x] **[BUG-SCR-001]** (Links: [REQ-SCR-001]) **XC Scoring Missing**: Regression fixed in v0.7.2. *Status: Fixed*
- [x] **[BUG-ING-002]** (Links: [REQ-SYS-002]) **Watch Folder Silent Fail**: Missing Dedupe Helper + Missing Alert. *Status: Fixed (v0.7.8/v0.7.11)*
- [x] **[BUG-CFG-002]** (Links: [REQ-SYS-001]) **Parameter Mismatch**: Boolean `TRUE` coerced to Number `1` in `getParameters_`. *Status: Fixed (v0.7.10)*
- [x] **[BUG-ING-003]** (Links: [REQ-ING-002]) **Notes Overwrite**: System Notes (Geo/Validation) were not writing to Notes column. *Status: Fixed (v0.7.11)*

## 3. Change Requests (CRs)
*Enhancements or modifications.*

- [ ] **[CR-UI-004]** (Links: [REQ-UI-004]) **Menu Restructure**: Rename `Setup` to `Admin`, `Scaffold` to `First Time Setup`. Add Admin tools. *Status: Open*
- [x] **[CR-CFG-003]** (Links: [REQ-SYS-002]) **Watch Folder Toggle**: Add `ENABLE_WATCH_FOLDER` param and Menu toggles. Update trigger logic. *Status: Implemented*
- [x] **[CR-ING-002]** (Links: [REQ-ING-003]) **File Upload UI**: New "Add Flight from Upload" menu with multi-file picker. Uploads to `UPLOAD_FOLDER_ID`. *Status: Implemented (v0.7.4)*
- [x] **[CR-UI-005]** (Links: [REQ-UI-005]) **Dialog Usability**: Support "Enter" key for OK in all input dialogs. *Status: Implemented*

- [x] **[CR-CFG-001]** (Links: [REQ-SYS-001]) **Lookups Refactor**: Group parameters by section, add warnings/descriptions, split Geo providers. *Status: Implemented*
- [ ] **[CR-GEO-001]** (Links: [REQ-SCR-002]) **Multi-Provider Geo**: Support comma-separated providers for RevGeo, Sites, and Timezone. *Status: Open*
- [x] **[BUG-UI-002]** (Links: [REQ-UI-001]) **Flight No Formula**: `#Ref!` error on row deletion. Needs robust `MAX` formula. *Status: Fixed*
- [x] **[CR-LOG-002]** (Links: [REQ-ING-002]) **Clean Notes**: Ingestion should leave `Flight Notes` blank; detailed errors go to `Import_Log`. *Status: Implemented (v0.7.11 - System Notes now go to Notes column)*

- [x] **[CR-ING-001]** (Links: [REQ-ANA-003]) **Landing Time Fallback**: If IGC misses landing time, calculate `Launch + Duration`. *Status: Implemented*
- [x] **[CR-UI-002]** (Links: [REQ-UI-003]) **Data Formatting**: Round Speed/Dist/Alt/Score (1 dec), % (2 dec), Times (nearest min). *Status: Implemented*
- [x] **[CR-LOG-001]** (Links: [REQ-ING-002]) **Enhanced Logging**: Append partial failures (e.g. Geo errors) to `Import_Log` Notes. *Status: Implemented*

- [ ] **[CR-UI-001]** (Links: [REQ-UI-003]) **Smart Chip Dropdowns**: Use new Oval/Chip style for dropdowns. *Status: Blocked by Google Apps Script API limitations (cannot set Chip style programmatically).*

### New Requests (Backlog)
- [ ] **[CR-CFG-002]** (Links: [REQ-SCR-001]) **Configurable RDP Tolerance**: Make Ramer-Douglas-Peucker tolerance configurable (Move from `Scoring.gs` hardcoded value). *Status: Open*
- [ ] **[CR-ING-003]** (Links: [REQ-ING-001]) **Large Scale Ingestion**: Support >5 files/ZIPs via background processing queue/trigger. *Status: Open*
- [ ] **[CR-CODE-001]** (Links: [REQ-SYS-001]) **Centralize Common Utilities**: Create `Utils.gs` for shared Math/Haversine functions. *Status: Open*
- [ ] **[CR-ING-004]** (Links: [REQ-SYS-002]) **Master Log Folder**: Auto-copy successful IGCs to `MASTER_LOG_FOLDER_ID`, set public permission ("Anyone with link"), and centralize files. *Status: Open*
- [ ] **[CR-UI-009]** (Links: [REQ-UI-001]) **SeeYou Cloud Link**: Add "View Flight" column. Generate `https://seeyou.cloud/api/open?igc=<drive_link>` for public IGCs. *Status: Open*
- [ ] **[CR-LOG-003]** (Links: [REQ-ING-002]) **Enhance Logging**: General improvements to logging visibility (Files processed, specific errors, summary stats). *Status: Open*
- [ ] **[CR-SCR-003]** (Links: [REQ-SCR-001]) **XContest Verification**: Check if flight is already uploaded to XContest (via API or profile scan). *Status: Open*

## 4. Future / Deferred
*Items explicitly moved to future phases.*

- [Fut] **[REQ-ANA-004]** **Polar Curve Estimation**: Derive wing polar from glide segments.
- [Fut] **[REQ-VIS-001]** **Pilot Dashboard**: Charts and Map visualizations.
- [Fut] **[REQ-SCR-003]** **Airspace Checking**: Alert on restricted zones.
