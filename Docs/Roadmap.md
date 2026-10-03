# ParaFlightLog Strategic Roadmap (Source of Truth)

---

## 1. Vision, Mission & Architectural Principles

### 1.1 Strategic Vision
**ParaFlightLog** is an intelligent, autonomous, and 100% sovereign paragliding flight operations and analytics platform. It unites flight logging, deep aeronautical physics, meteorological enrichment, FAI competition scoring, gear airworthiness management, and pilot progression into an expandable, zero-cost serverless ecosystem running inside Google Sheets and Google Drive.

Our ultimate vision is to provide the global free-flight community (paragliding, hang gliding, and paramotoring pilots, instructors, clubs, and schools) with a **permanent alternative to proprietary, subscription-gated flight clouds**—giving pilots absolute ownership over their flying data while leveraging modern cloud automation and AI intelligence.

### 1.2 Core Architectural Principles & Invariants
Every enhancement, feature, and architectural refactoring must adhere to four non-negotiable tenets:

1. **Absolute Data Sovereignty**:
   * All flight records, parsed tracks, telemetry metrics, and pilot credentials reside exclusively within the pilot's private Google account.
   * **Zero telemetry, zero analytics tracking, zero third-party database dependency, and zero vendor lock-in.**
2. **Zero-Cost Serverless Infrastructure**:
   * The system operates entirely on Google's free enterprise-grade consumer tiers (Google Sheets, Google Apps Script V8, Google Drive API).
   * No pilot should ever be forced to pay a monthly server fee, cloud database subscription, or maintenance retainer to operate their personal flight operations log.
3. **Non-Destructive Invariant Evolution**:
   * Platform updates, schema migrations, and batch maintenance operations must **never destructively overwrite** user data, manually entered flight notes, custom formula columns, or external sheet links.
   * Key-value configuration mappings and dynamic indirect formulas (`INDIRECT("Flights!..." & startRow & ":...")`) protect user sheets against formula corruption.
4. **Autonomous, Bounded & Observable Execution**:
   * All asynchronous and batch workloads must honor Google Apps Script's execution limits via strict wall-clock time budgeting (4.5-minute cutoff) and persistent state serialization.
   * The system features zero "black-box" state: all job queues, deduplication hashes, and audit trails live in transparent, user-inspectable spreadsheet tabs.

---

## 2. The 5 Strategic Horizons

```mermaid
timeline
    title ParaFlightLog Evolution Horizons
    section Horizon 1 : v1.0 - v1.9
      Core Engine Hardening : Tri-Mode Execution : Bulk Onboarding : Zero Black-Box Deduplication
    section Horizon 2 : v2.0
      Table-Driven Automation Engine : Persistent Queue : Universal Execution Sidebar : Interactive Wizards
    section Horizon 3 : v2.5
      Multi-Instance Distribution : Non-Destructive Updater : Pre-OSS Audit & PII Quarantine : Automated AI Testing
    section Horizon 4 : v3.0
      Public Open-Source Release : Golden Starter Template : Community Docs & Tutorials : Extensible Plugin Hooks
    section Horizon 5 : v3.5+
      Equipment Lifecycle & Airworthiness : Skills Progression Matrix : Flying Site Intelligence : Trip Planning
```

---

### 🗺️ Horizon 1: Core Single-Pilot Operations Engine (v1.0 – v1.9)
*Focus: Rock-solid foundational stability, zero-friction ingestion, deep aeronautical analytics, and data integrity.*

* **Status**: **Active Development / Nearing Completion**
* **Primary Objective**: Perfect the day-to-day logging, parsing, scoring, and viewing experience for an individual pilot.
* **Key Milestones**:
  * **Unified Ingestion Engine**:
    * Support for direct drag-and-drop file upload, cloud URL / Google Drive import, and continuous watch folder scanning.
    * Multi-archive decompression (`.zip`, `.gz`) and universal hardware parser (`XCTrack`, `Flymaster`, `XC Tracer`, `Oudie`, `Syride`, `UltraBliP`, `Garmin`).
  * **Aerodynamic & Meteorological Intelligence**:
    * Sliding-window flight mode detection (Thermal, Soaring, Glide).
    * Historical weather backfill via Open-Meteo Archive & Forecast API (winds, gusts, temperatures, cloud cover, Lawrence cloudbase spread).
    * Automated geographic site resolution (Takeoff site and Landing town via OpenStreetMap / Overpass API).
  * **Competition & League Sync**:
    * Native XContest direct flight probing, UTC date alignment, and 14-day FAI claim deadline monitoring.
    * One-click 3D flight trajectory visualization via SeeYou Cloud.
  * **Cockpit Dashboard & Currency**:
    * Compact 6-column resilient Dashboard with KPI summary banners, rolling 6-month pilot currency grid, and 8-card dynamic leaderboard matrix.
  * **Data Integrity & Deduplication**:
    * Row-based MD5 hashing on `Flights` tab (Column 70) eliminating black-box hidden cache.
    * Multi-criteria heuristic deduplication and device quality scoring (0–100 pts) pairing duplicate tracks with `Dup-Primary` and `Dup-Others`.
    * Smart Master Log self-healing and interactive stepping purge dialogs.
  * **Configuration Management**:
    * Consolidated `Config` tab combining 49 parameters across 9 categories and 10 lookup tables.
    * 5-group granular configuration export/import with JSON serialization and dynamic UI validation protection.

---

### ⚡ Horizon 2: Advanced Automation & Power-User Operations (v2.0)
*Focus: Seamless asynchronous execution, autonomous scheduling, and friction-free user interaction.*

* **Target Milestone**: v2.0
* **Core Design Specs**: [DSGN-AUT-001](./Design/DSGN-AUT-001_Table_Driven_Automation_Engine.md) & [DSGN-UI-001](./Design/DSGN-UI-001_Tri_Mode_Execution_and_Universal_Sidebar.md)
* **Key Milestones**:
  * **Tri-Mode Execution Subsystem**:
    * Universal front-end standard offering `[ Run Here ]` (Modal), `[ Run in Sidebar ]` (Modeless), and `[ Run in Background ]` (Headless).
    * Unlocks multitasking: pilots can review flight dashboards or edit notes while large batch ingestion or maintenance operations run asynchronously.
  * **Universal Execution Sidebar (`ExecutionSidebar.html`)**:
    * Persistent, modeless sidebar featuring live progress bars, collapsible activity stream, pause/cancel controls, and batch summary export.
  * **Table-Driven Automation Engine (`DSGN-AUT-001 Rev 1.1`)**:
    * Centralized `Automations` configuration tab enabling pilots to configure automated cron triggers, watch folder scans, and post-flight pipelines without editing script code.
  * **Persistent Job Queue & Resumption Engine (`QueueService.gs`)**:
    * Backed by a dedicated `Automation_Queue` sheet tab.
    * Eliminates the 9KB `PropertiesService` quota barrier.
    * Transparent, observable job lifecycle: `PENDING` $\to$ `RUNNING` $\to$ `PAUSED` $\to$ `COMPLETED` / `FAILED`.
  * **Bounded Execution Time Budget (`TimeBudget.gs`)**:
    * 4.5-minute wall-clock execution limiter preventing Google Apps Script 6-minute timeout exceptions.
    * State serialization and automatic self-scheduling continuation triggers.
  * **Interactive First-Time Setup Wizard (`RQ-SYS-008.2`)**:
    * Step-by-step onboarding modal configuring Drive folders, pilot credentials, default gear, and automation triggers in under 3 minutes.

---

### 🛡️ Horizon 3: Multi-Pilot Distribution, Safety & Pre-OSS Readiness (v2.5)
*Focus: Multi-instance fleet distribution, non-destructive migration, automated testing, and PII quarantine.*

* **Target Milestone**: v2.5
* **Key Milestones**:
  * **Comprehensive System Updater & Distribution Engine (`RQ-SYS-010`)**:
    * Seamless mechanism to distribute platform updates to hundreds of pilot instances without overwriting their flight data or personal configurations.
    * Non-destructive schema migration engine: dynamically detects and adds new columns, updates system formulas, and refreshes script code while preserving pilot rows.
  * **Complex Task Wizards (`RQ-SYS-011`)**:
    * Guided wizard interfaces for system health checks, year-end flight log archiving, gear transitions, and bulk metadata repairs.
  * **Pre-Open-Source Architecture & Security Audit (`CR-DEV-003`)**:
    * Complete code and documentation refactoring against Google Apps Script and enterprise JavaScript best practices.
    * Memory optimization, dead code elimination, and modularization of service layers.
  * **Automated AI-Driven Backend & UI Testing Harness (`CR-DEV-004`)**:
    * Headless Node.js regression test suite simulating Google Apps Script APIs (`SpreadsheetApp`, `DriveApp`, `UrlFetchApp`, `CacheService`).
    * Automated end-to-end verification of IGC parsing, mathematical physics, FAI scoring, deduplication heuristics, and queue state machines.
  * **PII Protection & Sanitization Framework (`CR-SEC-001`)**:
    * Automated quarantine guaranteeing zero personal identifiable information (pilot names, GPS home launch coordinates, email addresses, license IDs) leaks into public repositories, error logs, or community templates.

---

### 🌐 Horizon 4: Public Open-Source Launch (v3.0)
*Focus: Community governance, public release, golden template distribution, and ecosystem adoption.*

* **Target Milestone**: v3.0
* **Key Milestones**:
  * **Public Open-Source Release**:
    * Public GitHub repository release under a permissive open-source license (MIT / Apache 2.0).
    * Comprehensive `CONTRIBUTING.md`, Code of Conduct, and RFC (Request for Comments) design process for community contributions.
  * **Golden Starter Template**:
    * One-click "Make a Copy" Google Sheet pre-configured with embedded Google Apps Script code and automated First-Time Setup Wizard.
    * Zero-developer onboarding: non-technical pilots can deploy and configure their own instance in under 3 minutes.
  * **Public Documentation Portal & Video Tutorials**:
    * GitHub Pages documentation hub hosting the [Product Brochure](./Brochure.md), [Systems Architecture](./Architecture.md), and [User Guide](./User_Guide.md).
    * Step-by-step video walkthroughs covering initial setup, flight import, dashboard customization, and troubleshooting.
  * **Community Flight Parser Plugin System**:
    * Extensible adapter pattern allowing community developers to easily add new hardware parsers (e.g. Naviter Oudie N, Volirium, Fly-Master BLE live streams, proprietary CSV formats).

---

### 🚀 Horizon 5: Global Free-Flight Ecosystem & Intelligence (v3.x+)
*Focus: Advanced airworthiness management, pilot education, flying site intelligence, and expedition operations.*

* **Target Milestone**: v3.5+
* **Key Milestones**:
  * **Intelligent Equipment Lifecycle & Airworthiness Management**:
    * Complete equipment registry tracking wings, harnesses, reserves, and instruments.
    * Automated airtime and launch counters calculated dynamically per flight row.
    * Proactive safety alerts: Line trim check intervals, fabric porosity reminders, reserve repack deadlines (180/360-day cycles), and manufacturer service notices.
  * **Pilot Progression & Education Matrix**:
    * Structured tracker for national pilot certifications (P1–P5, APPI, IPPI, FAI Sporting Licences).
    * SIV maneuver logs, cross-country training clinics, instructor sign-offs, and emergency procedure currency.
  * **Flying Site Intelligence & Predictive Weather Matrix**:
    * Centralized launch and landing site registry with wind-rose compatibility, hazards, and airspace boundaries.
    * Predictive site matching: Cross-references live forecasts with your personal flight history to recommend the optimal flying site for the weekend.
  * **Expedition & Group Trip Planning**:
    * Multi-pilot expedition coordination, waypoint databases, retrieve vehicle tracking links, and emergency SAR coordinates.
  * **Native Gemini AI Flight Analysis**:
    * Deep integration with Gemini in Google Sheets for natural language flight queries ("Compare my glide ratios on my Ozone Rush 6 vs Nova Mentor 7 in rough air", "What wind direction gave me the highest climb rate at Point of the Mountain?").

---

## 3. Strategic Initiatives & Backlog Traceability

The following matrix connects our strategic horizons directly to tracked work units in [`Docs/Backlog.md`](./Backlog.md) and formal design specifications in [`Docs/Design/`](./Design):

| Horizon | Strategic Theme | Backlog Requirements / CRs | Design Specification | Status |
| :--- | :--- | :--- | :--- | :--- |
| **H1** | Core Ingestion & Dedupe | `RQ-ING-001`, `RQ-ING-002`, `CR-ING-006`, `CR-ING-008` | Existing Codebase | **Completed** |
| **H1** | Aeronautical Physics & FAI | `RQ-ANA-001`, `RQ-ANA-002`, `RQ-SCR-001` | Existing Codebase | **Completed** |
| **H1** | Weather & Geo Enrichment | `RQ-SCR-002`, `RQ-SCR-004` | Existing Codebase | **Completed** |
| **H1** | Resilient Dashboard & Views | `RQ-SYS-005`, `CR-SYS-001`, `CR-SYS-002` | Existing Codebase | **Completed** |
| **H1** | Granular Config Export/Import | `CR-CFG-006`, `CR-CFG-007` | Existing Codebase | **Completed** |
| **H2** | Tri-Mode Execution Subsystem | `CR-UI-019`, `CR-UI-020` | [`DSGN-UI-001`](./Design/DSGN-UI-001_Tri_Mode_Execution_and_Universal_Sidebar.md) | **Designed / Ready** |
| **H2** | Table-Driven Automation Engine | `RQ-AUT-001` – `RQ-AUT-005` | [`DSGN-AUT-001`](./Design/DSGN-AUT-001_Table_Driven_Automation_Engine.md) | **Designed / Ready** |
| **H2** | First-Time Setup Wizard | `RQ-SYS-008.2` | Planned RFC | **Backlogged** |
| **H3** | Multi-Instance Distribution & Updater | `RQ-SYS-010`, `CR-SCH-002` | Planned RFC | **Backlogged** |
| **H3** | Complex Task Wizards | `RQ-SYS-011` | Planned RFC | **Backlogged** |
| **H3** | Pre-OSS Quality & Security Audit | `CR-DEV-003`, `CR-SEC-001` | Audit Plan | **Backlogged** |
| **H3** | Automated AI Test Harness | `CR-DEV-004` | Testing Plan | **Backlogged** |
| **H4** | Public Open-Source Launch | `CR-OSS-001` | Community Charter | **Planned** |
| **H5** | Gear Lifecycle & Airworthiness | `RQ-GEAR-001` (Future) | Planned RFC | **Planned** |
| **H5** | Site Intelligence & Weather Matrix | `RQ-SITE-001` (Future) | Planned RFC | **Planned** |
| **H5** | Pilot Education & Progression | `RQ-EDU-001` (Future) | Planned RFC | **Planned** |

---

## 4. Open-Source Governance, Community & Licensing

### 4.1 Licensing Strategy
ParaFlightLog will be released under the **MIT License** (or Apache 2.0). This permissive license guarantees:
* Complete commercial and private freedom for pilots, flight instructors, and schools.
* Frictionless community contributions and custom plugin development.
* Permanent protection against proprietary lock-in.

### 4.2 Community Contribution Model
To maintain our rigorous architectural standards, community development will follow a structured Request for Comments (RFC) process:
1. **Idea / Proposal**: Discussed in GitHub Discussions or Issue tracker.
2. **Design RFC**: Subsystem enhancements must follow [`Docs/Design/Design_template.md`](./Design/Design_template.md).
3. **Automated Verification**: All pull requests must pass the offline Node.js test harness (`CR-DEV-004`) and static linting before merge.
4. **Documentation Invariant**: Code changes must be accompanied by synchronized updates to [`Docs/Features.md`](./Features.md) and [`Docs/User_Guide.md`](./User_Guide.md).

### 4.3 Golden Starter Sheet & Distribution Model
To eliminate the barrier of manual Google Apps Script deployment:
* A public, read-only **Golden Starter Sheet** will be maintained with every tagged release.
* Pilots deploy by clicking **"File > Make a copy"** in Google Sheets.
* The embedded `First-Time Setup Wizard` automatically initializes folder structures, requests scoped OAuth permissions, and scaffolds all tabs upon first launch.

---

## 5. Document Revision History

| Version | Date | Author | Description of Changes |
| :--- | :--- | :--- | :--- |
| **1.0** | 2026-10-02 | Core Architecture Team / AGY | Initial formal release establishing the 5 Strategic Horizons, Non-Negotiable Tenets, Traceability Matrix, and Open-Source Roadmap. |
