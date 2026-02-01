# Paragliding Flight Log - Technical Specifications

## 1. System Architecture
The solution is built on **Google Apps Script (GAS)** bound to a Google Sheet. It follows a modular service-oriented architecture.

### Modules
1.  **Controller (Main)**: Triggers, Menu handlers, and UI orchestration.
2.  **Ingestion Service**: Handles File input (Drive/URL/Upload), ZIP extraction, and Parsing. Supports Watch Folder and Targeted File/Folder processing.
3.  **Flight Service**: Manages row creation, data mapping, and sheet updates.
4.  **Analysis Engine**: Computes geometry, statistics, and identifies flight modes.
5.  **Scoring Engine**: Implements XC rules (Free, Flat, FAI triangles).
6.  **Geo Service**: Interfaces with Nominatim and OSM Overpass interfaces with caching.
7.  **Configuration**: Centralized getter/setter for `Lookups` sheet.

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
Heuristic checks run after parsing to flag potential non-flights. These thresholds are defined in the `Lookups` sheet (Validation Thresholds section) and can be adjusted by the user.

1.  **Short Flight**: Duration < `VALIDATION_MIN_DURATION_SEC` (default 120s).
2.  **Kiting/Ground Handling**: (Max Alt - Min Alt) < `VALIDATION_MIN_HEIGHT_CHANGE_M` (default 20m).
3.  **Driving/Speed**:
    *   Max Ground Speed > `VALIDATION_MAX_SPEED_KMH` (default 120 km/h).
    *   Avg Ground Speed > `VALIDATION_MAX_AVG_SPEED_KMH` (default 60 km/h).
    *   *Action*: If any met, Status -> `Invalid? [Reason]`.

### E. XC Scoring Rules (XContest-style)
1.  **Optimization**: Find 3 Turnpoints (TPs) that maximize distance.
2.  **Free Distance**: Start -> TP1 -> TP2 -> TP3 -> Finish.
3.  **Triangle Check**:
    *   Distance between Start and Finish < 20% of total distance.
    *   **Flat**: No specific leg constraints.
    *   **FAI**: Shortest leg ≥ 28% of total triangle perimeter.
4.  **Multipliers**:
    *   Free: 1.0
    *   Flat Triangle: 1.2
    *   FAI Triangle: 1.4

### E. Deduplication Strategy
*   **Primary (Hard) Dedupe**: Content Hash (MD5) check.
*   **Secondary (Soft) Dedupe**:
    *   **Proximity**: Start Time < 15 mins AND Launch Dist < 500m of existing.
    *   **Overlap**: New Flight Start < Existing Flight End (temporal overlap).
    *   Action: Mark as `Likely Duplicate` or `Possible Duplicate`.

### F. Manual Entry & Scaffolding
*   **Manual Row**: Insert blank row at top.
    *   `Flight No` = Max(Existing IDs) + 1.
    *   `Gear` = Copied from most recent valid flight row.
*   **Column Grouping**:
    *   Columns are physically grouped in Sheets (CMD+Option+G equivalent).
    *   collapsed state shows only the first column of the group (e.g., 'Wing' for Gear group).

---

## 4. API Integration
### Geocoding (Reverse)
*   **Provider**: Nominatim (OSM).
*   **Query**: `lat`, `lon` -> Returns `address` object.
*   **Fields Mapping**:
    *   `Town` <- `town` || `village` || `city`
    *   `Region` <- `state` || `county`
    *   `Country` <- `country_code` (ISO)

### Site Detection (Overpass Turbo)
*   **Query**: Search for nodes/ways within `OSM_RADIUS` (default 3km).
*   **Filter**: `sport=paragliding` AND (`site=takeoff` OR `site=landing`).
*   **Selection**: Nearest result to the Launch/Landing coordinate.

---

## 5. Configuration (`Lookups` Sheet)
System behavior is controlled by key-value pairs in the `Lookups` sheet.

**Core Settings:**
*   `WATCH_FOLDER_ID`: Drive ID for automation.
*   `WATCH_PERIOD_MIN`: 15
*   `OSM_RADIUS_M`: 3000
*   `CONTACT_EMAIL`: Required for API User-Agent etiquette.
*   `REVGEO_PROVIDER`: nominatim
*   `FLIGHT_TYPES`: List of valid types (Free Fly, XC, etc.)

**Scoring & Bonuses:**
*   `NATIONAL_BONUS_WITHIN_PCT`: 5
*   `NATIONAL_BONUS_MULTIPLIER`: 1.2

**Flight Mode Thresholds:**
*   `THERMAL_MIN_CLIMB`: 0.3
*   `THERMAL_MIN_TURN`: 8
*   `SOAR_TURN_MAX`: 5
*   `SOAR_VARIO_MIN`: -0.2
*   `SOAR_VARIO_MAX`: 1.5
*   `GLIDE_TURN_MAX`: 5
*   `GLIDE_LD_TOL_PCT`: 30
*   `GLIDE_VARIO_MAX`: 0.2
*   `SINK_TURN_MAX`: 10
*   `SINK_VARIO`: -2.5

**Validation Thresholds:**
*   `VALIDATION_MIN_DURATION_SEC`: 120
*   `VALIDATION_MIN_HEIGHT_CHANGE_M`: 20
*   `VALIDATION_MAX_SPEED_KMH`: 120
*   `VALIDATION_MAX_AVG_SPEED_KMH`: 60

**Analysis Windows:**
*   `MODE_WINDOW_SEC`: 10
*   `REVERSAL_WINDOW_SEC`: 30
*   `MODE_HYSTERESIS_SEC`: 6
