# Paragliding Flight Log - Functionality Roadmap

## Phase 1: Existing Implementation
These features are present in the provided v1.0 code and meet your specified requirements.

### Core Automation
- [x] **Watch Folder**: Automatically scans a Configured Drive folder for new files.
- [x] **File Support**: Handles `.igc`, `.igx`, `.zip`, and `.gz`.
- [x] **De-duplication**: Uses MD5 content hash to prevent duplicate imports.
- [x] **ZIP Handling**: Extracts multiple IGCs from a single ZIP; ignores non-IGC files.

### Flight Logging
- [x] **Row Insertion**: Inserts new flights at Row 6 (preserving headers).
- [x] **Basic Metrics**: Date, Launch Time, Duration, Track Length, Max Altitude.
- [x] **Auto Summary**: Generates `"Duration, Track km, Max Alt at Place"`.
- [x] **Status Workflow**: Flags rows as `Needs review`, `Possible duplicate`, etc.

### Location & Enrichment
- [x] **Reverse Geocoding**: Uses Nominatim to find Country, Region, Town.
- [x] **Site Detection**: Uses OSM Overpass to find nearest `sport=paragliding` takeoff/landing.
- [x] **Gear Autofill**: Copies Wing/Harness/Reserve from the previous row if missing in IGC.
- [x] **Wing Snapshot**: Records Glide Ratio/Trim/Full speeds at the time of flight.

### Flight Analysis (Modes)
- [x] **Mode Classification**: Detects Thermal, Soar, Glide, Sink based on Vario/Turn Rate/LD.
- [x] **Thermal Stats**: Count, Avg Climb, Best Climb.
- [x] **Soaring Stats**: Time, Distance, Efficiency.
- [x] **Glide/Sink**: L/D stats and sink exposure (< -3m/s).

### XC Scoring
- [x] **Scoring Rules**: Calculates Free, Flat, and FAI Triangle distances.
- [x] **Points**: World points (multipliers) + National Bonus (closed circuits).
- [x] **Optimization**: Uses a heuristic (pruned search) for performance in Apps Script.

### User Interface
- [x] **Custom Menu**: `Flight Log` menu for manual actions.
- [x] **Manual Import**: "Add flight from IGC" via URL/ID.
- [x] **Scaffolding**: One-click setup of all necessary Sheets and Headers.
- [x] **Recompute**: Ability to re-run analysis on selected rows.

---

## Phase 2: Future Enhancements
These are features mentioned in your requirements or implied as future needs, which can be refined in the next iteration.

### Advanced Analytics
- [ ] **Heatmaps**: Visualizing thermal hotspots on a map (requires frontend/external tool).
- [ ] **Polar Curve Estimation**: Auto-calculating wing polar from flight data.
- [ ] **Formation Flight**: Detecting if you flew with buddies (requires comparing multiple active tracks).

### Improved Data Robustness
- [ ] **Airspace checking**: Warning if track enters restricted zones (complex to do in pure Apps Script).
- [ ] **Failed Import Recovery**: A UI to fix/retry specific files from the `Import_Log`.

### Dashboarding
- [ ] **Pilot Dashboard**: A visual tab showing:
    - Hours per Wing/Harness (using InService dates).
    - Yearly progression charts (Distance/Hours).
    - Map showing all launch sites visited.

### Refinements to Existing Logic
- [ ] **Heuristic Tuning**: exposing more threshold variables (e.g. `OSM_RADIUS`) to the settings sheet if they aren't already.
- [ ] **Provider Fallbacks**: Adding backup geocoders (e.g. OpenCage) if Nominatim rate limits are hit often.
