---
description: Create, sync, or reverse-engineer formal design specifications in Docs/Design/
---

This workflow governs the creation, synchronization, and reverse-engineering of detailed architectural design specifications in `Docs/Design/`.

## 1. Scope & Mode Identification
Determine the user's intent and target scope from their request:
* **Target Scope**: A specific feature/subsystem (e.g. `Activity Logger`, `Deduplication`), or a broad subsystem family (e.g. `all file ingestion pathways`, `XC scoring`).
* **Operational Mode**:
  1. **New Design Mode**: Creating a new design for a feature currently in planning or discussion.
  2. **Sync / Delta Mode**: Updating an existing design document based on recent chat decisions, user feedback, or code adjustments.
  3. **Reverse-Engineering Mode**: Inspecting active code in `Code/` to document existing, undocumented subsystems into formal design specifications.

---

## 2. Directory & Template Setup
* Ensure `Docs/Design/` exists.
* Read [`Docs/Design/Design_template.md`](file:///g:/My%20Drive/~RS2B/~Projects/ParaFlightLogProject/Docs/Design/Design_template.md) as the structural standard.
* File Naming Convention:
  `Docs/Design/DSGN-[MODULE]-[NUMBER]_[Feature_Name].md`
  * Examples:
    * `DSGN-LOG-001_Activity_Logging_System.md`
    * `DSGN-ING-000_Ingestion_Subsystem.md` (Parent)
    * `DSGN-ING-001_Watch_Folder_Pipeline.md` (Child)
    * `DSGN-ING-002_Bulk_Batch_Ingestion.md` (Child)
    * `DSGN-SCR-001_XC_Scoring_and_Optimization.md`

---

## 3. Execution by Mode

### Mode A: New Design (Planning Phase)
1. **Assign Design ID**: Check existing designs in `Docs/Design/` and allocate the next sequential ID (e.g. `DSGN-LOG-001`).
2. **Scaffold from Template**: Copy `Design_template.md` structure.
3. **Populate Metadata Header**:
   * `Status`: `Under Review` or `In Development`.
   * `Current Revision`: `Rev 1.0`.
   * `Parent Design` / `Child Designs`: Establish hierarchical links.
   * `Code Revision Stamp`: `Pending Implementation`.
   * `Related Requirements / CRs`: Link to `Docs/Backlog.md` IDs.
4. **Draft Detailed Design**: Synthesize problem statement, requirements, data model/schema impact, component contracts, sequencing, platform constraints, and implementation plan from user discussions.
5. **Initial Revision Note**: Record `Rev 1.0 - Initial design draft` in the Revision History table.

### Mode B: Sync / Delta Update (Iterating on Existing Design)
1. **Locate Target Document**: Find the existing `DSGN-...` file in `Docs/Design/`.
2. **Analyze Deltas**: Compare the current design against recent chat decisions, user feedback, or Git commits.
3. **Determine Revision Bump**:
   * **Minor Bump** (`Rev 1.0` $\to$ `Rev 1.1`): Clarifications, parameter additions, UI adjustments, or non-breaking refinements.
   * **Major Bump** (`Rev 1.0` $\to$ `Rev 2.0`): Fundamental architectural rewrite, schema overhaul, or breaking workflow changes.
4. **Update Document Sections**: Apply modifications to Schema, Architecture, Implementation Plan, etc.
5. **Append Revision History**: Add a row to the Revision History table with the new revision number, today's date, author, and a concise **Revision Note** summarizing the delta.
6. **Code Stamp Synchronization**: Update the `@revision` tag in the umbrella code file's header (e.g. [`Code/Logger.gs`](file:///g:/My%20Drive/~RS2B/~Projects/ParaFlightLogProject/Code/Logger.gs)) to match the new revision number.

### Mode C: Reverse-Engineering (Documenting Existing Working Code)
1. **Analyze Code Architecture**:
   * Inspect all `.gs` scripts, HTML templates, and configuration objects associated with the subsystem.
   * Extract data flows, schemas, APIs, external service gateways, and error-handling mechanics.
2. **Scaffold & Populate Design**:
   * Fill out the full `Design_template.md` sections based on the actual implementation.
   * Set `Status`: `Implemented`.
   * Set `Current Revision`: `Rev 1.0`.
   * Set `Code Revision Stamp`: `Rev 1.0`.
   * Document real-world platform constraints and workarounds discovered in the code (e.g. 6-minute timeouts, Sheets grid-shifting mitigations, Apps Script API drawing limits).
3. **Stamp Umbrella Code File**: Add standard `@design` and `@revision` JSDoc tags to the primary `.gs` file header.
4. **Initial Revision Note**: Record `Rev 1.0 - Reverse-engineered from working codebase`.

---

## 4. Maintain the Design Index (`Docs/Design/README.md`)
Whenever a design is created or updated, synchronize [`Docs/Design/README.md`](file:///g:/My%20Drive/~RS2B/~Projects/ParaFlightLogProject/Docs/Design/README.md):
* Maintain a structured index table of all design documents:
  | Design ID | Title | Status | Revision | Parent | Umbrella Code | Description |
  | :--- | :--- | :---: | :---: | :--- | :--- | :--- |

---

## 5. Review & Approval Protocol
1. Present an executive summary of the created/updated design document(s) in chat.
2. Provide clickable links to the file(s) in `Docs/Design/`.
3. Highlight key architectural decisions, parent-child links, and the revision note.
4. Wait for user review and approval before proceeding with any corresponding code changes.
