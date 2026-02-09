# Master Implementation Plan
*Paragliding Flight Log Project*

This document serves as the high-level roadmap and architectural vision for the project. Detailed implementation steps for specific features are created as separate plans in `Plans/` and moved to `Plans/Archive/` upon completion.

## 1. Core Architecture (Phase 1) - **Completed**
*   **Goal**: Establish a robust, automated ingestion pipeline from Google Drive to Google Sheets.
*   **Components**:
    *   **Parser**: Robust IGC parsing (headers, fixes, security).
    *   **Ingestion**: Watch folder logic, ZIP handling, Deduplication.
    *   **Data Model**: Fixed schema for `Flights` tab with Column Groups.

## 2. Analysis & Scoring (Phase 2) - **Completed**
*   **Goal**: Enrich flight data with physics-based analysis and competition scoring.
*   **Features**:
    *   **Mode Detection**: Thermal, Soar, Glide, Sink (Heuristic sliding window).
    *   **Scoring**: Free Distance, Flat Triangle, FAI Triangle (XContest rules).
    *   **Geo**: Reverse Geocoding (Nominatim/BDC) and Site Detection (Overpass).

## 3. UI & Usability (Phase 3) - **In Progress**
*   **Goal**: User-friendly tools for manual entry and data correction.
*   **Features**:
    *   [x] Lookups Refactor (Sections, Descriptions).
    *   [x] Manual Entry Menu (Blank Row + Defaults).
    *   [ ] Smart Chip Dropdowns (Blocked by API).
    *   [ ] "Recompute Selected" Menu Action.

## 4. Maintenance & Operations (Ongoing)
*   **Goal**: Ensure long-term stability and ease of troubleshooting.
*   **Features**:
    *   [x] Robust Flight No Formula.
    *   [x] Clean Logging (Import_Log vs Notes).
    *   [ ] Unit Tests expansion.

## 5. Future Roadmap
*   **Dashboard**: Visualization tab with Charts/Graphs.
*   **Export**: Export flights to KML/GPX.
*   **Multi-User**: Support for multiple pilots (Config migration).
