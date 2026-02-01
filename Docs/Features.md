# Paragliding Flight Log - Features Roadmap

## Phase 1: Core Implementation (Restoration & Cleanup)
*The baseline features present in the legacy v1.0 code, to be re-implemented with cleaner architecture.*

### 📂 File Ingestion & Automation
- **Watch Folder**: Automatically scans a specific Google Drive folder for new flight logs.
- **One-Time Process**: Ability to point to a specific file (IGC/ZIP) or folder for an immediate, one-off import.
- **Upload & Process**: "Upload" functionality to save a local file to the Watch Folder and trigger processing immediately.
- **Multi-Format Support**: 
    - Accepted: `.igc`, `.igx`
    - Compressed: `.zip`, `.gz` (single or multiple IGCs per archive)
- **Deduplication**: 
    - **Content Hash**: MD5 hash check to prevent exact duplicate imports.
    - **Time Overlap**: Flags potential duplicates if a new flight's time range overlaps with an existing flight (e.g., Start Time < Existing End Time).

### ✈️ Flight Logging & Management
- **Row Insertion**: New flights insert at the top (Row 6), preserving header definitions.
- **Flight ID**: Numeric, sequential identifier (Previous ID + 1). Static value that persists even if duplicate rows are deleted.
- **Manual Entry**: Menu option/Button to insert a blank row with auto-generated Flight ID and gear pre-filled from the previous valid flight.
- **Auto-Summary**: Generates a readable summary string (e.g., "3h 15m, 45km, Max Alt 2400m at Bir").
- **Status Workflow**: Automates status flagging (`OK`, `Needs Review`, `Possible Duplicate`, `Fetch Fail`).
- **Gear Autofill**: Inherits Glider/Harness/Reserve from the previous flight if missing in the IGC header.
- **Snapshotting**: Records wing performance specs (Glide Ratio, Trim Speed) at the time of flight.

### 📍 Location & Enrichment
- **Reverse Geocoding**: Converts Turnpoints to Country, Region, and Nearest Town (via Nominatim).
- **Site Detection**: Identifies known Paragliding Takeoffs/Landings within a 3km radius using OSM Overpass API.

### 📊 Flight Analysis
- **Flight Validation**: Heuritic analysis to flag non-flight tracks:
    - **Short Hop**: Flag if duration is too short (e.g., < 2 min).
    - **Ground Handling/Kiting**: Flag if vertical range is minimal (e.g., < 20m height variation).
    - **Driving/Impossible Speed**: Flag if ground speeds exceed paragliding limits (e.g., > 100km/h or high average speed).
- **Mode Detection**: auto-classifies flight segments into:
    - **Thermal**: Climbing in circles.
    - **Soar**: Ridge soaring (maintained altitude, S-turns).
    - **Glide**: Linear flight segments.
    - **Sink**: Excessive sink rate or degradation.
- **Calculated Metrics**: Max/Min Altitude, Max Climb/Sink, Track Length, Duration.

### 🏆 XC Scoring (XContest Standards)
- **Distance Calculations**:
    - **Free Distance**: Best distance via 3 turnpoints.
    - **Flat Triangle**: Standard triangle closure.
    - **FAI Triangle**: Triangle with strict leg proportion rules (shortest leg ≥ 28%).
- **Points System**:
    - World Points (Standard multipliers).
    - National Points (Bonus for closed circuits).

---

## Phase 2: Structural Enhancements & Reliability
*Improvements to be added during the refactor to address known limitations.*

### 🛡️ Robustness
- **Better Error Handling**: Dedicated "Import Log" with detailed error messages for malformed files or API timeouts.
- **Rate Limit Management**: Smarter backoff strategies for OpenStreetMap and Nominatim APIs to prevent failures during bulk processing.
- **Test Harness**: A standalone testing suite to verify parser and scorer accuracy without polluting the main log.

### 🔧 Usability
- **Column Grouping**: Scaffolding automatically groups columns by category (Stats, Gear, Weather, etc.), allowing users to collapse/expand sections for a cleaner view.
- **Settings Sheet**: Centralized `Lookups` tab for easy configuration of thresholds (e.g., thermal climb rate, search radius) without touching code.
- **Recompute Tool**: "Recalculate Selected Rows" button to update stats after changing settings or correcting a manual entry.

---

## Phase 3: Future Capabilities
*New features planned for subsequent updates.*

### 📈 Advanced Analytics
- **Pilot Dashboard**: Visual charts showing:
    - Hours flown per Wing/Harness.
    - Yearly progression (Distance/Hours).
    - Map of visited launch sites.
- **Polar Curve Estimation**: Estimate wing polar derived from glide segments in flight data.
- **Formation Flight**: Detect if multiple pilots (in the same log folder) flew together.

### 🌍 Advanced Mapping
- **Heatmaps**: Visualizing thermal hotspots.
- **Airspace Checking**: (Complex) Warning if a track enters restricted airspace during the flight.
