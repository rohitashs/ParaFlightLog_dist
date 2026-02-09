# Paragliding Flight Log - Function Reference

## Code.gs (Orchestration)
*   `onOpen(e)`: Creates the "Flight Log" menu.
*   `getParameters_()`: Reads configuration from the `Parameters` sheet.
*   `uiAddManualFlight_()`: Helper to trigger manual flight entry.
*   `showUrlDialog_()`: Shows the IGC URL import dialog.
*   `showUploadDialog_()`: Shows the File Upload picker.
*   `uiUpdateWatchFolder_()`: UI helper to update Watch Folder ID.
*   `uiEnableWatch_() / uiDisableWatch_()`: Toggles the watch folder feature.
*   `setupWatcherTrigger_()`: Installs the time-driven trigger for automation.

## Scaffold.gs (Setup & Validation)
*   `scaffoldAll_()`: Master function to create/repair all sheets (`Overview`, `Flights`, etc).
*   `updateValidationOnly_()`: Re-applies dropdowns and validation rules to `Flights` and `Equipment`.
*   `applyFlightsValidation_(sh)`: Applies validation to the top N rows of the Flights sheet.
*   `ensureSheet_(ss, name)`: Utility to create a sheet if missing.

## Ingestion.gs (Data Pipeline)
*   `scanWatchFolderNow_()`: Main automation entry point. Scans Drive folder for new IGCs.
*   `processDriveFile_(file, config)`: Processes a single Drive file.
*   `handleFileUpload(form)`: Handles file uploads from the HTML picker.
*   `processSingleIgcBlob_(blob, ...)`: Core logic to Parse -> Analyze -> Score -> Insert.
*   `insertFlightRow_(data, ...)`: Maps processed data to `Flights` sheet columns.
*   `logImport_(...)`: Appends specific errors or success messages to `App_Log`.

## Parser.gs
*   `parseIgc(text, fileName)`: Extracts fixes (B-records) and headers from IGC content.
*   `haversine_(lat1, lon1, lat2, lon2)`: Calculates distance between two coordinates.

## Analysis.gs
*   `analyzeFlight(fixes, config)`: Main analysis routine.
*   `validateFlight_(fixes, ...)`: Checks heuristics (Short flight, Kiting, Driving).

## Scoring.gs
*   `calculateXcScore(fixes)`: Computes XC distance (Free, Triangle) using RDP simplification.

## Geo.gs
*   `getReverseGeo(lat, lon, config)`: Returns Town/Region/Country (Nominatim/BigDataCloud).
*   `getNearestSite(lat, lon, ...)`: Finds nearest Takeoff/Landing site (Overpass API).
*   `getTimezone(lat, lon, ...)`: Returns TZ ID.

## Test.gs
*   `runAllTests()`: execution harness for unit tests.
