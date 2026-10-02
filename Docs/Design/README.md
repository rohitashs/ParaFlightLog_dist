# Architecture & Detailed Design Specifications

This directory contains the formal architectural and detailed design specifications for the Paragliding Flight Log system.

Every significant subsystem, engine, and feature follows the standardized template in [`Design_template.md`](file:///g:/My%20Drive/~RS2B/~Projects/ParaFlightLogProject/Docs/Design/Design_template.md) and maintains strict revision synchronization with the working codebase.

---

## Design Registry Index

| Design ID | Title | Status | Revision | Parent Design | Umbrella Code | Description |
| :--- | :--- | :--- | :---: | :--- | :--- | :--- |
| [`DSGN-LOG-001`](file:///g:/My%20Drive/~RS2B/~Projects/ParaFlightLogProject/Docs/Design/DSGN-LOG-001_Activity_Logging_System.md) | Activity Logging System | `Implemented` | `Rev 1.0` | None (Root) | [`Code/Logger.gs`](file:///g:/My%20Drive/~RS2B/~Projects/ParaFlightLogProject/Code/Logger.gs) | Extensible 4-column Activity Logs tab, tiered levels (Brief/Normal/Debug), conservative retention guardrails, and dialog clipboard sync. |
| [`DSGN-AUT-001`](file:///g:/My%20Drive/~RS2B/~Projects/ParaFlightLogProject/Docs/Design/DSGN-AUT-001_Table_Driven_Automation_Engine.md) | Table-Driven Automation Engine | `Under Review` | `Rev 1.1` | None (Root) | [`Code/Automation.gs`](file:///g:/My%20Drive/~RS2B/~Projects/ParaFlightLogProject/Code/Automation.gs) | Table-driven Automation tab rules engine, Single Heartbeat Dispatcher, Scope DSL, Predefined Templates, and Rule Validation Engine. |
| [`DSGN-UI-001`](file:///g:/My%20Drive/~RS2B/~Projects/ParaFlightLogProject/Docs/Design/DSGN-UI-001_Tri_Mode_Execution_and_Universal_Sidebar.md) | Tri-Mode Execution & Universal Sidebar | `Under Review` | `Rev 1.0` | None (Root) | [`Code/ExecutionSidebar.html`](file:///g:/My%20Drive/~RS2B/~Projects/ParaFlightLogProject/Code/ExecutionSidebar.html) | Tri-Mode Execution (Run Here / Sidebar / Background), Universal Execution Sidebar, 4.5m TimeBudget, and QueueService. |
| [`DSGN-SYS-002`](file:///g:/My%20Drive/~RS2B/~Projects/ParaFlightLogProject/Docs/Design/DSGN-SYS-002_Platform_Access_Control_and_Contributor_Framework.md) | Platform RBAC & Contributor Framework | `Draft` | `Rev 1.0` | None (Root) | [`Code/Access.gs`](file:///g:/My%20Drive/~RS2B/~Projects/ParaFlightLogProject/Code/Access.gs) | Role-Based Access Control (Admin/Developer/Designer/Pilot), dynamic menu curation, server-side gating, and No-GitHub contributor loop. |
| [`DSGN-SYS-003`](file:///g:/My%20Drive/~RS2B/~Projects/ParaFlightLogProject/Docs/Design/DSGN-SYS-003_Reverse_Schema_Extraction_and_Personalization.md) | Reverse Schema Extraction & Personalization | `Draft` | `Rev 1.0` | [`DSGN-SYS-002`](file:///g:/My%20Drive/~RS2B/~Projects/ParaFlightLogProject/Docs/Design/DSGN-SYS-002_Platform_Access_Control_and_Contributor_Framework.md) | [`Code/Config.gs`](file:///g:/My%20Drive/~RS2B/~Projects/ParaFlightLogProject/Code/Config.gs) | Sheet-as-Visual-Designer introspection, user layout manifest (`user_layout.json`), dynamic formula resilience, and non-destructive column movement. |
| [`DSGN-MNT-001`](file:///g:/My%20Drive/~RS2B/~Projects/ParaFlightLogProject/Docs/Design/DSGN-MNT-001_Unified_Update_Manager_and_Maintenance_Orchestrator.md) | Unified Update Manager & Maintenance Orchestrator | `Draft` | `Rev 1.0` | None (Root) | [`Code/Scaffold.gs`](file:///g:/My%20Drive/~RS2B/~Projects/ParaFlightLogProject/Code/Scaffold.gs) | Consolidated Update dialog, 5-tier hierarchical execution (Dimensions $\to$ Schema $\to$ Validations $\to$ Formulas $\to$ Docs), and pre-update safety snapshots. |

---

## Design Document Lifecycle & Statuses
* **`Draft`**: Initial scoping and ideation in progress.
* **`Under Review`**: Complete design draft submitted for pilot/team architectural review.
* **`Approved`**: Design approved and ready for implementation.
* **`In Development`**: Active code implementation underway.
* **`Implemented`**: Verified in code and deployed to Google Apps Script.
* **`Deprecated`**: Replaced or retired feature.
* **`Superseded`**: Replaced by a higher-numbered design specification.

---

## Ways of Working & Workflows
* **Creating / Updating Designs**: Use the `/update_design` workflow (`.agent/workflows/update_design.md`).
* **Code-to-Design Sync**: Umbrella code files in `Code/` maintain matching `@design` and `@revision` JSDoc header tags.
* **Auditing**: `/doc_check` verifies that design revisions, statuses, and code stamps remain in lockstep.
