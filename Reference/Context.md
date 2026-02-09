# Paragliding Flight Log - Project Context

## Project Overview
This project is a Google Apps Script application for importing, analyzing, and logging Paragliding flights from `.igc` files into a Google Sheet.

**Key Goals**:
1.  Robust IGC Parsing.
2.  XC Scoring (XContest rules).
3.  Flight Analysis (Thermal/Soar/Glide).
4.  Automation (Watch folder scanning).

## Project Organization
*   **`Code/`**: Apps Script code (`.gs`) and manifest.
*   **`Docs/`**: Documentation (`Specifications.md`, `Functions.md`).
*   **`Plans/`**: Project Management (`task.md` is Source of Truth).
*   **`Reference/`**: `Backlog.md` (Reqs/Bugs), `ChangeLog.md`, `Context.md`.

## File Structure (`Code/`)
*   **`Code.gs`**: Orchestration (Menus, Triggers).
*   **`Config.gs`**: Configuration Definitions (`TABS`, `CFG`).
*   **`Scaffold.gs`**: Scaffolding, Sheet Creation, Validation Logic.
*   **`Ingestion.gs`**: IGC Pipeline (Input -> Parse -> Sheet).
*   **`Parser.gs`, `Analysis.gs`, `Scoring.gs`, `Geo.gs`**: Domain Logic.
*   **`Test.gs`**: Unit Tests.

## State of Project (v0.7.0)
*   **Refactoring**: Completed. Separation of concerns (`Scaffold`, `Config`) achieved.
*   **Automation**: Workflows added for `Code Check`, `Sync`, `Summarize`.
*   **Status**: Documentation synced. Ready for live usage.
*   **Next Steps**: 
    *   Address Change Requests (RDP Config, Large Ingestion).
    *   Deploy to live environment.

## Ways of Working (Standard Operating Procedures)
1.  **Start/End Session**: Read `Context.md`. Run `/summarize_session` at end.
2.  **Task Tracking**: `Plans/task.md` for active tasks. `Reference/Backlog.md` for Reqs/Bugs.
3.  **Documentation**: Keep `Specs`, `Functions`, `ChangeLog` updated via workflows.

## Current Session Status
*   **Codebase**: v0.7.0 - Refactored & Workflows added.
*   **Backlog**: Updated. `Backlog.md` is Source of Truth.
*   **Pending**: CRs for Utils, RDP, Large Ingestion.
