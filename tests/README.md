# Developer Testing & Simulation Suites

This directory contains offline unit tests, regression suites, and integration test harnesses for the **Paragliding Flight Log** project.

## Architectural Tenet: Runtime vs. Tooling Separation

Per **Pattern 19** in [`Docs/Patterns_and_Practices.md`](file:///g:/My%20Drive/~RS2B/~Projects/ParaFlightLogProject/Docs/Patterns_and_Practices.md), test code, fixtures, and audit tools are **strictly decoupled** from production runtime code:
* **Production Runtime (`Code/`)**: Strictly code required by the active Google Sheet, user dialogs, and cloud triggers. Deployed to Google Apps Script via `clasp push`.
* **Developer Tooling (`tests/`, `tools/`)**: Standalone Node.js test runners, static analysis scripts, and simulation suites. Tracked in Git, but excluded from Google Apps Script deployment via `.claspignore`.

## Directory Contents

* **`Test.gs`**: Comprehensive unit and regression test suite covering:
  * IGC Parser & Fix Extraction (`testParser_`)
  * Flight Physics & Thermalling (`testAnalysis_`)
  * Turnpoint Scoring & Graph Theory (`testScoring_`)
  * Date/Time Formats & Lookups (`testDateTimeFormats_`)
  * Deduplication & Quality Scoring (`testDedupeAndQualityScoring_`)
  * Dynamic Formula Resilience (`testDynamicFormulaResilience_`)
  * Native Google Sheets Resilience (`testNativeSheetsResilience_`)
  * System Manifest & Maintenance Orchestrator (`testSystemMaintenanceAndManifest_`)

## Running Offline Tests

Execute all offline test suites locally using the Node.js runner:

```bash
node tools/run_all_offline_tests.js
```

Runs all 13 suites in under 1 second without network overhead or Google Apps Script quota consumption.
