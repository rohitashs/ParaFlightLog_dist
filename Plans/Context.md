# Project Context & Ways of Working (Source of Truth)

## 🧠 Agent Memory & Context
**Status**: Active Development (v0.7.11)
**Last Session Focus**: Watch Folder reliability, Config Architecture, Data Logging.
**Next Focus**: Master Log Folder, SeeYou Cloud Integration, Enhanced Logging.

This file is the **long-term memory** for the project. Read this first to understand *how* we work and *where* we are.

---

## 📂 Project Organization & File Structure
The project follows a strict folder hierarchy. `Plans/Context.md` is the source of truth for this structure.

### 1. `Plans/` (Project Management)
*   **`Context.md`**: **(Source of Truth)**. Project organization, Ways of Working, Agent Memory.
*   **`task.md`**: *Session-specific* task tracking (ephemeral).

### 2. `Docs/` (Documentation)
*   **`Features.md`**: **(Human View)**. Describes Modules, Features, and Functionality. API for the "What". Maps to Tech Spec & Backlog.
*   **`Technical_Specification.md`**: **(Technical View)**. Source of truth for Code Organization, Algorithms, Naming Standards. Maps to Features.
*   **`Backlog.md`**: **(Requirements & ToDos)**. Source of truth for Requirements (`RQ`), Change Requests (`CR`), Bug Reports (`Bug`), and ToDos.
*   **`ChangeLog.md`**: **(History)**. Log of Features/CRs/Bugs implemented, organized by Session/Date.

### 3. `Code/` (Implementation)
*   **`Code.gs`**: Orchestrator (Menu, Triggers).
*   **`Config.gs`**: Configuration Definitions (Tabs, Defaults).
*   **`Scaffold.gs`**: UI Construction & Validation.
*   **`Ingestion.gs`**: File Processing Pipeline.
*   **`Geo.gs`, `Parser.gs`, `Analysis.gs`, `Scoring.gs`**: Domain Logic.

### 4. `Reference/` (Archive)
*   *Deprecated*. Old documentation is moved to `Docs/` or archived here.

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
