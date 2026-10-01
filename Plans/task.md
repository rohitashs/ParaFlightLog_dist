# Project Tasks & Status
*This file tracks the active tasks for the Paragliding Flight Log Project.*

## Completed in Recent Sessions (2026-09-30 Part 2) - Smart Deduplication, Overlap Scoring & Trash Folder
- [x] **[DED-001]** Row-Based MD5 Hashes (`IGC Hash` Column 70 in Meta group) to eliminate black-box cache de-sync.
- [x] **[DED-002]** Dedicated `TRASH_FOLDER_ID` parameter, folder picker action, and clean routing of duplicates and purged flights.
- [x] **[DED-003]** Smart Master Log re-linking (reuse existing Master IGCs without `_copy.igc` duplicates).
- [x] **[DED-004]** Multi-criteria heuristic overlap detection ($\pm 15$ min, $\le 1000$ m) and 0–100 data quality scoring model (`scoreFlightQuality_`).
- [x] **[DED-005]** Candidate status tagging (`Dup-Primary` in gold, `Dup-Others` in orange) with paired `[DupRef: ...]` audit notes.
- [x] **[DED-006]** Dashboard protection: strictly filter all Dashboard KPI cards, currency timelines, and leaderboards for `Status = "Valid"`.
- [x] **[DED-007]** Admin actions: `Purge Flights Marked 'Remove'` and `Re-sync Missing Flights from Master Folder`.
- [x] **[DED-008]** Unit test suite in `Code/Test.gs` (`testDedupeAndQualityScoring_`) with 100% pass rate.
- [x] **[DOC-001]** Update In-App `User Guide` sheet tab in `Code/Scaffold.gs` (`scaffoldUserGuide_`).
- [x] **[DOC-002]** Update `Docs/Setup_Guide.md` with dedicated multi-device deduplication & triage section.
- [x] **[DOC-003]** Update `Docs/Features.md`, `Docs/Technical_Specification.md`, `Docs/Backlog.md`, `Docs/ChangeLog.md`, and `Docs/Context.md`.
- [x] **[DEP-001]** Deploy via `clasp push` and commit cleanly to git (`origin/master`).

## Completed Earlier (2026-09-30 Part 1) - Weather, Maintenance, User Guide, Profile & Dashboard
- [x] **[WEA-001]** Implement `Code/Weather.gs` with Open-Meteo (archive + 7-day forecast) and Visual Crossing backup.
- [x] **[CFG-001]** Add `WEATHER_PROVIDERS` and `VISUAL_CROSSING_API_KEY` to `Code/Config.gs`.
- [x] **[CFG-002]** Register `User Guide` and `Pilot_Profile` tabs in `CFG.sheets` and `TABS` in `Code/Config.gs`.
- [x] **[ING-001]** Integrate weather enrichment into `Code/Ingestion.gs` (`processSingleIgcBlob_` and `insertFlightRow_`).
- [x] **[MNT-001]** Create `Code/FlightMaintenanceDialog.html` (Scope selector, operations checkboxes, progress bar).
- [x] **[MNT-002]** Implement backend batch maintenance runner and date sorting in `Code/Code.gs` and update menu actions.
- [x] **[SCA-001]** Implement `scaffoldUserGuide_` in `Code/Scaffold.gs` with Metric Dictionary.
- [x] **[SCA-002]** Implement `scaffoldPilotProfile_` in `Code/Scaffold.gs`.
- [x] **[DSH-001]** Update `scaffoldDashboard_` with dynamic formulas for KPIs, Top 5, and Recent Activity (`CR-SYS-001`).
- [x] **[SCA-003]** Update `scaffoldAll_` in `Code/Scaffold.gs` for sheet creation, reordering, and tab colors.

## Future / Next Up
- [ ] **RQ-SYS-008**: Template Distribution Model & First-Time Setup Wizard.
- [ ] **RQ-SYS-009.2**: Dashboard & Inspector Pilot Profile Integration.
- [ ] **RQ-SYS-004**: Flight Inspector Enhancements.
- [ ] **RQ-ING-001.4**: Large Scale Batch Ingestion.
- [ ] **RQ-ANA-002.2**: Polar Curve Estimation.
