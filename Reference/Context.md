# Paragliding Flight Log - Project Context

## Project Overview
This project is a Google Apps Script application for importing, analyzing, and logging Paragliding flights from `.igc` files into a Google Sheet.

**Key Goals**:
1.  Robust IGC Parsing (handling headers, fixes, validation).
2.  XC Scoring (Free Distance, Flat/FAI Triangles).
3.  Flight Analysis (Mode detection: Thermal, Soar, Glide).
4.  Automation (Watch folder scanning).

## Project Organization
*   **`Code/`**: Apps Script code (`.gs`) and manifest (`appsscript.json`). Pushed to server.
*   **`Docs/`**: Permanent documentation (Specifications, Features, Setup Guide).
*   **`Plans/`**: Transient artifacts (Task lists, Walkthroughs) and `Archive/` for completed plans.
*   **`Reference/`**: Project context (`Context.md`) and config backups.  
    *(Note: `.clasp.json` and `.gitignore` reside in Root for tool compatibility, but are conceptually "Reference" files)*.
*   **`Old Files/`**: Legacy reference material.

## File Structure (`Code/`)
*   **`Code.gs`**: Main entry point, menus, configuration (`Lookups` sheet), scaffolding.
*   **`Ingestion.gs`**: Handles file imports (Drive/URL), ZIP extraction, Deduplication (MD5), and row insertion.
*   **`Parser.gs`**: Raw IGC parsing logic.
*   **`Analysis.gs`**: Flight physics, mode detection, and validation checks.
*   **`Scoring.gs`**: XC optimization logic.
*   **`Geo.gs`**: Interface for Nominatim (Reverse Geo) and Overpass (Site detection).
*   **`Test.gs`**: Standalone test harness.

## Key Artifacts
*   `Docs/Features.md`: Feature roadmap.
*   `Docs/Technical_Specifications.md`: Detailed algorithm specs.
*   `Docs/Setup_Guide.md`: User installation guide.
*   `Docs/walkthrough.md`: Deployment instructions.

## State of Project (Phase 2 Complete)
*   **Core Systems**: All implemented and verified via `Test.gs`.
*   **Deployment**: Ready for Apps Script.
*   **Next Steps (Phase 3/Future)**: 
    *   Deployment to live sheet.
    *   Real-world testing with diverse IGC files.
    *   Enhancing "Site Detection" reliability.
    *   UI for Manual Entry (currently placeholder).

## Developer Notes
*   **Configuration**: All tunable params (Thresholds, Radius, etc.) are in the `Lookups` Google Sheet, read by `Code.gs`.
*   **Caching**: `Geo.gs` uses `CacheService` to respect API limits.
*   **Deduplication**: Uses `PropertiesService` to store MD5 hashes of processed files.

## Resume / Verification Guide
*   **Restore Context**: Read this file to understand the architecture.
*   **Verify Logic**: Run `Test.gs` -> `runAllTests()` in the Apps Script Editor.
*   **Verify Deploy**: Check `clasp status` or `clasp push` to sync.
*   **First Run**:
    1.  Open Sheet -> "Flight Log" Menu -> "Setup & Tools" -> "Scaffold".
    2.  Fill in "Lookups" with Folder ID and Email.
    3.  Run "Scan Watch Folder now" or manual import.

## Current Session Status
*   **Source Control**: Configured. Linked to `RSParaFlightLog` (Pacific Time). `appsscript.json` tracked in `Code/`.
*   **Codebase**: Fully implemented v2.0 MVP.
*   **Next Action**: execute `walkthrough.md` to verify end-to-end functionality.
