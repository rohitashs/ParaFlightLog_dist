# Project Tasks & Status
*This file tracks the active tasks for the Paragliding Flight Log Project.*

## Current Session (2026-09-29) - Code & Doc Check / Architecture Sync
- [x] **[AUDIT-001]** Run comprehensive `/code_check` across all modules.
- [x] **[REF-001]** Extract `FileHandling.gs` from `Ingestion.gs` and `Code.gs`.
- [x] **[REF-002]** Consolidate geospatial and math utilities into `Utils.gs`.
- [x] **[FIX-001]** Fix formula referencing in `insertFlightRow_` for top-of-sheet insertions.
- [x] **[FIX-002]** Fix public trigger handler `scanWatchFolderTrigger` in `Code.gs`.
- [x] **[FIX-003]** Fix XContest season rollover and 24-hr start time matching.
- [x] **[WF-001]** Create `.agent/workflows/doc_check.md` workflow.
- [x] **[REQ-001]** Capture User Guide requirements (`RQ-SYS-006`).
- [x] **[REQ-002]** Capture Unified Flight Maintenance dialog (`RQ-SYS-007`).
- [x] **[REQ-003]** Capture Setup Wizard & Template Copy model (`RQ-SYS-008`).
- [x] **[REQ-004]** Capture Pilot Profile tab (`RQ-SYS-009`).
- [x] **[REQ-005]** Capture Historical Weather API backfill (`RQ-SCR-004`).
- [x] **[AUDIT-002]** Run comprehensive `/doc_check` audit and generate report `Plans/DocCheckReports/2026-09-29_DocCheck.md`.
- [x] **[DOCS-001]** Synchronize `Docs/Backlog.md` (`RQ-SCR-003` marked implemented, closed refactoring ToDos).
- [x] **[DOCS-002]** Synchronize `Docs/Context.md` (typos, `DocCheckReports/`, `Code/` scope, removed legacy `v0.7.11` footer).
- [x] **[DOCS-003]** Synchronize `Docs/Technical_Specification.md` (catalog `Config.gs`, `XContest.gs`, and 6 HTML templates).
- [x] **[DOCS-004]** Synchronize `Docs/Setup_Guide.md` (active tab names, menu paths, configuration keys).
- [x] **[DOCS-005]** Synchronize `Docs/Workflows/Multi_Device_Setup.md` (`git push origin master`).

## Active Backlog (Prioritized)
- [ ] **RQ-SYS-007**: Unified Flight Maintenance Dialog (batch recompute, sort, missing data, weather backfill, XContest verification).
- [ ] **RQ-SYS-006**: In-App User Guide Sheet Tab (`scaffoldUserGuide_`) and external setup guide.
- [ ] **RQ-SYS-009**: Pilot Profile Sheet Tab (`scaffoldPilotProfile_`).
- [ ] **RQ-SCR-004**: Historical Weather Backfill via Open-Meteo Archive API.
- [ ] **RQ-SYS-008**: Template Distribution Model & First-Time Setup Wizard.
- [ ] **CR-SYS-001**: Replace Dashboard dummy KPI values with live formulas and queries.

## Future / On Hold
- [ ] **RQ-ING-001.4**: Large Scale Batch Ingestion.
- [ ] **RQ-ANA-002.2**: Polar Curve Estimation.
- [ ] **CR-UI-001**: Smart Chip Dropdowns (Google Sheets limitation).
