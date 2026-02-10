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

## Active Backlog
### Change Requests (Prioritized)
- [ ] **CR-ING-004**: Master Log Folder (Menu, Logic, Permissions).
- [ ] **CR-UI-009**: SeeYou Cloud Integration (View Link).
- [ ] **CR-UI-010**: Manual Flight Form (Sidebar/Dialog).
- [ ] **CR-UI-011**: Flight Detail View (Sidebar).
- [ ] **CR-UI-012**: Quick Action Buttons (Header).
- [ ] **CR-LOG-003**: Enhanced Logging.
- [ ] **CR-SCR-003**: XContest Verification.
- [ ] **CR-UI-004**: Menu Restructure (Admin Tools).
- [ ] **CR-CFG-002**: Configurable RDP Tolerance.
- [ ] **CR-GEO-001**: Multi-Provider Geo Support.
- [ ] **CR-CODE-001**: Centralize Utils (`Utils.gs`).

### Bugs
- [ ] **Bug-GEO-002**: Missing Location Data (Launch/Land Site empty).

### Future / Blocked
- [ ] **RQ-ING-001.4**: Large Scale Ingestion.
- [ ] **RQ-ANA-002.2**: Polar Curve Estimation.
- [ ] **CR-UI-001**: Smart Chip Dropdowns (Blocked).
