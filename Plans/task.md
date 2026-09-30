# Project Tasks & Status
*This file tracks the active tasks for the Paragliding Flight Log Project.*

## Current Session (2026-09-30) - Weather, Maintenance, User Guide, Profile & Dashboard
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
- [x] **[DOC-001]** Update `Docs/Setup_Guide.md`, `Docs/Features.md`, `Docs/Technical_Specification.md`, and `Docs/Backlog.md`.
- [x] **[DEP-001]** Run `update_headers.ps1`, deploy via `clasp push`, and commit cleanly to git.

## Future / On Hold
- [ ] **RQ-SYS-008**: Template Distribution Model & First-Time Setup Wizard.
- [ ] **RQ-ING-001.4**: Large Scale Batch Ingestion.
- [ ] **RQ-ANA-002.2**: Polar Curve Estimation.
- [ ] **CR-UI-001**: Smart Chip Dropdowns (Google Sheets limitation).

