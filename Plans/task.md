# Project Tasks & Status
*This file tracks the active tasks for the Paragliding Flight Log Project.*

## Current Session
- [x] **[PM-002]** Plan UI & Upload Features
- [x] **[IMP-UI-001]** Implement Menu & Admin Changes
- [x] **[IMP-UPL-001]** Implement File Upload Feature
- [x] **[VER-001]** Verify & Deploy
- [x] **[BUG-ING-002]** Fix Column Shift in Ingestion
- [x] **[REF-ING-001]** Robust Row Insertion
- [x] **[BUG-ING-003]** Fix Data Population & Validation
- [x] **[BUG-ING-004]** Fix FlightID Scope & Logging
- [x] **[BUG-UPL-001]** Multi-file Upload Fails (Fixed Picker loop)
- [x] **[BUG-SCO-001]** XC Scoring Columns Not Populating (Fixed Mapping)
- [x] **[BUG-UI-004]** "Enter" Key in URL Dialog (Implemented Custom Dialog)
- [x] **[CR-UI-006]** Collapse all Group columns except 'Flight Info' by default.
- [x] **[CR-UI-007]** Tab Coloring (Consolidated Equipment Blue).
- [x] **[CR-SYS-001]** Rename `Import_Log` -> `App_Log`.
- [x] **[CR-UI-008]** Tab Ordering.
- [x] **[PLAN-REF-001]** Design Equipment Consolidation
- [x] **[IMP-REF-001]** Update Scaffolding (`Code.gs`)
- [x] **[IMP-REF-002]** Update Ingestion Logic (`Ingestion.gs`)
- [x] **[VER-REF-001]** Verify & Deploy
- [x] **[PLAN-STR-001]** Design Structural Changes
- [x] **[IMP-STR-001]** Update `Code.gs` Scaffolding (Structure)
- [x] **[IMP-STR-002]** Update Ingestion Logic (Lookups)

## New Request (Fix Scaffolding & Validation)
- [x] **[BUG-SCF-001]** Equipment Column Order
    - [x] Insert "Type" at Col 6 (`F`). Move Default/Retired to 7/8.
    - [x] Update `scaffoldEquipment_`.
    - [x] Update `Ingestion.js` Lookups (Col indices).
- [x] **[BUG-SCF-002]** Category Dropdown Missing
    - [x] Fix validation rule in `scaffoldEquipment_`.
- [x] **[BUG-SCF-003]** Lookups Query `#N/A`
    - [x] Wrap `QUERY` in `IFERROR`.
- [x] **[BUG-SCF-004]** App_Log Naming/Color
    - [x] Fix `scaffoldAppLog_` to ensure correct name and color.

## Backlog Highlights
### Bugs
- [ ] **[BUG-GEO-003]** Persistent Location Failure (Sites/Towns empty)

### Future
- [ ] Dashboards in 'Overview' tab.
