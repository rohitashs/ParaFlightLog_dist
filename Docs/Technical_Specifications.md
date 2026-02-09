# Paragliding Flight Log - Technical Specifications

## 1. System Architecture
The solution is built on **Google Apps Script (GAS)** bound to a Google Sheet. It follows a modular service-oriented architecture.

### Modules
1.  **Code (Controller)**: Orchestration, Menu handlers, and Triggers.
2.  **Config**: Centralized Definitions (`TABS`, `CFG`).
3.  **Scaffold**: UI Setup, Sheet Creation, and Validation logic.
4.  **Ingestion Service**: Handles File input (Drive/URL/Upload), ZIP extraction, and Parsing.
5.  **Flight Service**: Manages row creation, data mapping, and sheet updates.
6.  **Analysis Engine**: Computes geometry, statistics, and identifies flight modes.
7.  **Scoring Engine**: Implements XC rules (Free, Flat, FAI triangles).
8.  **Geo Service**: Interfaces with Nominatim and OSM Overpass interfaces with caching.

---

## 2. Data Schema (`Flights` Sheet)
The `Flights` sheet uses a fixed schema starting at **Row 6**. Headers are in **Row 5** (Column Name) and **Row 4** (Category).

### Key Column Groups
| Group | Fields | Notes |
| :--- | :--- | :--- |
| **Flight Info** | `Status`, `Flight No`, `Summary`, `FlightID`, `Type`, `Date`, `Times`, `Dur`, `Dist` | Primary identity columns. `Status` is color-coded. |
| **Gear** | `Wing`, `Harness`, `Reserve 1/2`, `Other` | Dropdowns validated against Equipment sheets. Default selected via checkbox lookup. |
| **XC Scoring** | `XC Score`, `XC Dist`, `Class`, `Triangle`, `Points` | Computed by Scoring Engine. |
| **Launch/Land** | `Lat/Lon`, `Site`, `Town`, `Region`, `Alt` | Enriched via Geo Service. Separate groups for Launch and Landing. |
| **Weather** | `Wind`, `Cloud`, `Temp`, `Notes` | Manual entry fields. |
| **Analytics** | `Thermal %`, `Glide %`, `Efficiency`, `Sink %` | Output of flight analysis. |
| **Validation** | `Status`, `Reason` | Output of heuristic checks. |
| **Meta** | `Import File`, `ID`, `Timestamp` | Audit trail. |

---

## 3. Algorithms & Logic

### A. IGC Parsing
*   **Fix extraction**: Parse B-records for Time, Lat, Lon, Alt (Pressure/GNSS).
*   **Validation**: Discard fixes with invalid validity flags if strict mode is on (currently lenient).
*   **Fallback**: If GNSS altitude is missing, use Pressure altitude.

### B. Track Metrics
*   **Distance**: Sum of Haversine distances between sequential fixes (resampled to ~1-2s).
*   **Speed**: Ground speed calculated between segments.
*   **Bearing**: Initial bearing between points.

### C. Flight Mode Classification
The track is analyzed in a sliding window (default 10s) to classify state:
*   **Thermal**: Sustained positive vario (>0.3m/s) + high turn rate (>8°/s).
*   **Soaring**: Moderate non-circular lift (-0.2 to +1.5m/s) with heading reversals.
*   **Glide**: Straight flight (turn rate <5°/s) with vario < +0.2m/s.
*   **Sink**: Sink rate > 2.5m/s (or poor L/D).

### D. Flight Validation Logic
Heuristic checks run after parsing to flag potential non-flights. These thresholds are defined in the `Parameters` sheet.

1.  **Short Flight**: Duration < `VALIDATION_MIN_DURATION_SEC` (default 120s).
2.  **Kiting/Ground Handling**: (Max Alt - Min Alt) < `VALIDATION_MIN_HEIGHT_CHANGE_M` (default 20m).
3.  **Driving/Speed**:
    *   Max Ground Speed > `VALIDATION_MAX_SPEED_KMH` (default 120 km/h).
    *   Avg Ground Speed > `VALIDATION_MAX_AVG_SPEED_KMH` (default 60 km/h).
    *   *Action*: If any met, Status -> `Invalid? [Reason]`.

### 3.4 Data Processing Rules
*   **Time Zone**: Resolved via `timeapi.io`.
*   **Landing Time**: Calculated from Start + Duration if missing.
*   **Rounding**: 1 Decimal for most metrics.
*   **Deduplication**: Hard MD5 Hash + Soft Temporal Overlap.

### E. XC Scoring Rules (XContest-style)
1.  **Optimization**: Find 3 Turnpoints (TPs) that maximize distance.
2.  **Free Distance**: Start -> TP1 -> TP2 -> TP3 -> Finish.
3.  **Triangle Check**:
    *   Distance between Start and Finish < 20% of total distance.
    *   **Flat**: No specific leg constraints.
    *   **FAI**: Shortest leg ≥ 28% of total triangle perimeter.
4.  **Multipliers**: Free 1.0, Flat 1.2, FAI 1.4.

---

## 4. API Integration
### Geocoding (Reverse)
*   **Providers**: `nominatim_osm`, `big_data_cloud`.
*   **Logic**: Chain of Responsibility.

### Site Detection (Overpass Turbo)
*   **Provider**: `overpass_api`.
*   **Query**: Search for `sport=paragliding` AND (`site=takeoff` OR `site=landing`) within `OSM_RADIUS`.

### Time Zone
*   **Provider**: `timeapi_io`.

---

## 5. Configuration (`Parameters` Sheet)
System behavior is controlled by key-value pairs in the `Parameters` sheet.
*   **Ingestion**: `WATCH_FOLDER_ID`, `UPLOAD_FOLDER_ID`, `ENABLE_WATCH_FOLDER`.
*   **Geo**: Providers and Radius.
*   **Validation**: Thresholds for duration, speed, height.
*   **Analysis**: Vario/Turn thresholds for modes.
*   **Scoring**: Multipliers.

---

## 6. Data Validation (`Lookups` Sheet)
*   **Wings/Harnesses/Reserves**: Dynamic queries from `Equipment` sheet.
*   **Status/Types**: Static lists.

---

## 7. Code Organization

The solution is split into distinct Google Apps Script files (`.gs`).

### `Code.gs` (Orchestration)
*   **Purpose**: Entry point for UI, Menus, Triggers.
*   **Key Functions**: `onOpen()`, `scanWatchFolderNow_()`.

### `Config.gs` (Definitions)
*   **Purpose**: Centralized `CFG` and `TABS` objects.
*   **Key Objects**: `TABS` (Sheet properties, columns), `CFG` (Defaults).

### `Scaffold.gs` (UI & Setup)
*   **Purpose**: Sheet creation, layout, formatting, and validation application.
*   **Key Functions**: `scaffoldAll_()`, `applyFlightsValidation_()`, `updateValidationOnly_()`.

### `Ingestion.gs` (Data Pipeline)
*   **Purpose**: IGC File -> Parsed Data -> Sheet Row.
*   **Key Functions**: `processDriveFile_()`, `handleFileUpload()`, `insertFlightRow_()`.

### `Geo.gs`, `Parser.gs`, `Analysis.gs`, `Scoring.gs`
*   **Purpose**: Logic modules for specific domains.
