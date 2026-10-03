# Architecture & Detailed Design Specifications

This directory contains the formal architectural and detailed design specifications for the Paragliding Flight Log system.

Every significant subsystem, engine, and feature follows the standardized template in [`Design_template.md`](./Design_template.md) and maintains strict revision synchronization with the working codebase.

---

## Design Registry Index

### Core Foundation Subsystems
| Design ID | Title | Status | Revision | Parent Design | Umbrella Code | Description |
| :--- | :--- | :--- | :---: | :--- | :--- | :--- |
| [`DSGN-CORE-001`](./DSGN-CORE-001_Flight_Ingestion_and_Deduplication_Engine.md) | Flight Ingestion & Intelligent Dedupe | `Implemented` | `Rev 2.1` | None (Core) | [`Code/Ingestion.gs`](../../Code/Ingestion.gs) | Multi-source ingestion pipeline, MD5 hard dedupe, in-memory quality scoring (0–100), and reciprocal candidate tagging. |
| [`DSGN-CORE-002`](./DSGN-CORE-002_Aeronautical_Physics_and_FAI_Scoring.md) | Aero Physics & FAI XC Scoring | `Implemented` | `Rev 2.1` | None (Core) | [`Code/Scoring.gs`](../../Code/Scoring.gs) | B/H record extraction, thermal/soaring/glide mode detection, RDP trajectory reduction, and FAI 5-point turnpoint optimization. |
| [`DSGN-CORE-003`](./DSGN-CORE-003_Meteorological_and_Geocoding_Gateways.md) | Weather, Geocoding & League Gateways | `Implemented` | `Rev 2.1` | None (Core) | [`Code/Weather.gs`](../../Code/Weather.gs) | Open-Meteo archive/forecast fallback chain, Lawrence cloudbase formula, OSM Nominatim geocoding, and XContest direct probing. |
| [`DSGN-CORE-004`](./DSGN-CORE-004_Google_Sheets_Database_Substrate_and_Formula_Engine.md) | Google Sheets DB Substrate & Formulas | `Implemented` | `Rev 2.1` | None (Core) | [`Code/Scaffold.gs`](../../Code/Scaffold.gs) | Dynamic column letter resolution, workbook Named Ranges, native `FILTER` lookups, batch formula application, and soft guardrails. |

### Feature & Evolution RFCs
| Design ID | Title | Status | Revision | Parent Design | Umbrella Code | Description |
| :--- | :--- | :--- | :---: | :--- | :--- | :--- |
| [`DSGN-LOG-001`](./DSGN-LOG-001_Activity_Logging_System.md) | Activity Logging System | `Implemented` | `Rev 1.0` | None (Root) | [`Code/Logger.gs`](../../Code/Logger.gs) | Extensible 4-column Activity Logs tab, tiered levels (Brief/Normal/Debug), conservative retention guardrails, and dialog clipboard sync. |
| [`DSGN-AUT-001`](./DSGN-AUT-001_Table_Driven_Automation_Engine.md) | Table-Driven Automation Engine | `Under Review` | `Rev 1.1` | None (Root) | [`Code/Automation.gs`](../../Code/Automation.gs) | Table-driven Automation tab rules engine, Single Heartbeat Dispatcher, Scope DSL, Predefined Templates, and Rule Validation Engine. |
| [`DSGN-UI-001`](./DSGN-UI-001_Tri_Mode_Execution_and_Universal_Sidebar.md) | Tri-Mode Execution & Universal Sidebar | `Under Review` | `Rev 1.0` | None (Root) | [`Code/ExecutionSidebar.html`](../../Code/ExecutionSidebar.html) | Tri-Mode Execution (Run Here / Sidebar / Background), Universal Execution Sidebar, 4.5m TimeBudget, and QueueService. |
| [`DSGN-SYS-002`](./DSGN-SYS-002_Platform_Access_Control_and_Contributor_Framework.md) | Platform RBAC & Contributor Framework | `Draft` | `Rev 1.0` | None (Root) | [`Code/Access.gs`](../../Code/Access.gs) | Role-Based Access Control (Admin/Developer/Designer/Pilot), dynamic menu curation, server-side gating, and No-GitHub contributor loop. |
| [`DSGN-SYS-003`](./DSGN-SYS-003_Reverse_Schema_Extraction_and_Personalization.md) | Reverse Schema Extraction & Personalization | `Draft` | `Rev 1.0` | [`DSGN-SYS-002`](./DSGN-SYS-002_Platform_Access_Control_and_Contributor_Framework.md) | [`Code/Config.gs`](../../Code/Config.gs) | Sheet-as-Visual-Designer introspection, user layout manifest (`user_layout.json`), dynamic formula resilience, and non-destructive column movement. |
| [`DSGN-MNT-001`](./DSGN-MNT-001_Unified_Update_Manager_and_Maintenance_Orchestrator.md) | Unified Update Manager & Maintenance Orchestrator | `Implemented` | `Rev 2.1` | None (Root) | [`Code/Scaffold.gs`](../../Code/Scaffold.gs) | Unified Update Manager & Atomic Maintenance Orchestrator with 2D matrix scope, 3-tier component invariants, and pre-update safety snapshots. |

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
