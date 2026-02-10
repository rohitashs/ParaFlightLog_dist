# Project Context & Ways of Working (Source of Truth)

## 🧠 Agent Memory & Context
**Status**: Active Development (v0.7.11)
**Last Session Focus**: Watch Folder reliability, Config Architecture, Data Logging.
**Next Focus**: Master Log Folder, SeeYou Cloud Integration, Enhanced Logging.

This file is the **long-term memory** for the project. Read this first to understand *how* we work and *where* we are.

---

## 📂 Project Organization & File Structure
The project follows a strict folder hierarchy. `Docs/Context.md` is the source of truth for this structure.

### 1. `Docs/` (Persistent Documentation)
*   **Status**: **Git Tracked**.
*   **Purpose**: Long-term, evolving documentation. Source of Truth.
*   **Files**:
    *   **`Context.md`**: Project Context, Ways of Working.
    *   **`Features.md`**: Functional capabilities (Admin, UI, System).
    *   **`Technical_Specification.md`**: detailed Tech Specs & Code Reference.
    *   **`Backlog.md`**: Requirements, CRs, Bugs.
    *   **`ChangeLog.md`**: Historical record.

### 2. `Plans/` (Transient Execution)
*   **Status**: **NOT Git Tracked** (Local only).
*   **Purpose**: Disposable planning documents and session artifacts.
*   **Files**: `implementation_plan.md`, `task.md`, `walkthrough.md`.
*   **Sub-folders**:
    *   **`Acrchive/`**: Old plans/tasks.
    *   **`SessionSummary/`**: Session Summary Reports (`YYYY-MM-DD_SessionSummary.md`).

### 3. `Code/` (Implementation)
*   **Status**: **Git Tracked**.
*   **Files**: All `.gs` files and `appsscript.json`.


---

## 🛠 Ways of Working (Standard Operating Procedures)

### 1. Document-First Development
*   **Features.md**: Define *what* we want.
*   **Technical_Specification.md**: Define *how* to build it.
*   **Backlog.md**: Track *status* of implementation.
*   **Code**: Implement only after documentation is aligned.

### 2. Backlog Management (`Docs/Backlog.md`)
The backlog has 5 strict sections:
1.  **Description**: Meta-info on usage.
2.  **ToDos**: Future tasks (Checkbox, Status, Importance, Description).
    *   *Status Flags*: `Open`, `WIP`, `Completed`, `Discarded`.
3.  **Requirements (`RQ`)**: Nested Hierarchy (Module -> Function).
    *   *Structure*: Checkbox | ID | Status | Phase | Description.
    *   *Status Flags*: `Open`, `Implemented`, `Partially Implemented`, `Future`, `Blocked`, `Discarded`.
    *   *Rule*: "Implemented" only if ALL children are implemented.
4.  **Change Requests (`CR`)**: Flat list linking to Implemented Requirements.
    *   *Status Flags*: `Open`, `Implemented`, `Blocked`, `Discarded`, `Future`.
5.  **Bugs (`Bug`)**: Flat list linking to Requirements or CRs.

### 3. Change Logging (`Docs/ChangeLog.md`)
*   Update at the end of every session.
*   Group by **Session** and **Date**.
*   List all `[Imp]` (Implemented) items from Backlog.

### 4. Session Summary Reports (`Plans/SessionSummary/`)
*   **Naming**: `YYYY-MM-DD_SessionSummary.md` (e.g. `2026-02-10_SessionSummary.md`).
*   **Purpose**: A snapshot of the session's achievements, discussions, and decisions.
*   **Structure**:
    1.  **Metadata**: Date, Time, Goal.
    2.  **Key Discussions**: Brief bullet points of what was discussed.
    3.  **Decisions Made**: Architectural or Product decisions.
    4.  **Work Completed**: Files changed, Features implemented, Bugs fixed.
    5.  **Open Issues / Next Steps**: What was left undone or added to backlog.
    6.  **References**: Links to relevant artifacts or docs.

### 4. Code Standards
*   **Naming**: `Service.gs` for modules. `privateFunction_` (trailing underscore) for non-exported helpers.
*   **Config**: Separation of Concerns. `Code.gs` = Logic, `Config.gs` = Constants, `Parameters Sheet` = Runtime Values.
*   **Validation**: Validate early. Fail gracefully with logs.

---

## 🚀 Current Project State (v0.7.11)
### Implemented Features
*   **Ingestion**: Watch Folder (Drive), Manual Upload, URL Import, Deduplication (MD5 + Temporal).
*   **Analysis**: Flight Mode Detection (Thermal/Soar/Glide), Basic Metrics.
*   **Scoring**: XContest Rules (Free/Flat/FAI).
*   **Geo**: Reverse Geocoding (BigDataCloud/Nominatim), Site Detection (Overpass).
*   **UI**: 2-Row Headers, Column Grouping, Status/Gear Dropdowns.

### Active Priorities (Next Session)
1.  **Public Log**: Auto-copy valid IGCs to a public "Master Log" folder (`CR-ING-004`).
2.  **SeeYou Integration**: Generate public links for flight visualization (`CR-UI-009`).
3.  **Logging**: Enhance visibility of process execution (`CR-LOG-003`).

### Important Notes for Agent
*   **Config**: The `Parameters` sheet is the runtime source of truth. `Config.gs` is just the schema/defaults.
*   **Validation**: Detailed errors should go to the `App_Log` tab or `Notes` column (pipes separated), not just fail silently.
