---
description: Comprehensive documentation audit and synchronization with active code, architecture, and backlog
---

# Documentation Audit & Synchronization Workflow (/doc_check)

This workflow defines the systematic audit protocol for synchronizing all documentation across the 5 Altitudes / Tiers with active code, subsystem designs, and backlog state.

---

## 1. Read & Discover (5-Tier Documentation Corpus)

1. **Discover All Persistent Documentation in `Docs/` Across the 5 Tiers**:
   - **Tier 1 (Strategic Vision)**: [`Docs/Roadmap.md`](file:///g:/My%20Drive/~RS2B/~Projects/ParaFlightLogProject/Docs/Roadmap.md) (Horizons H1–H5, open-source strategy, core invariants).
   - **Tier 2 (Public Manifesto)**: [`Docs/Brochure.md`](file:///g:/My%20Drive/~RS2B/~Projects/ParaFlightLogProject/Docs/Brochure.md) (Value proposition, whitepaper, Gemini AI advantages).
   - **Tier 3 (Product & Operations)**: [`Docs/Features.md`](file:///g:/My%20Drive/~RS2B/~Projects/ParaFlightLogProject/Docs/Features.md) and [`Docs/User_Guide.md`](file:///g:/My%20Drive/~RS2B/~Projects/ParaFlightLogProject/Docs/User_Guide.md).
   - **Tier 4 (Systems Architecture & Design)**:
     - [`Docs/Architecture.md`](file:///g:/My%20Drive/~RS2B/~Projects/ParaFlightLogProject/Docs/Architecture.md) (C4 topology, global schemas, ERD, data dictionary).
     - [`Docs/Technical_Specification.md`](file:///g:/My%20Drive/~RS2B/~Projects/ParaFlightLogProject/Docs/Technical_Specification.md) (Math models, algorithms, code reference).
     - [`Docs/Patterns_and_Practices.md`](file:///g:/My%20Drive/~RS2B/~Projects/ParaFlightLogProject/Docs/Patterns_and_Practices.md) (17 engineering patterns, native Google Sheets optimizations, anti-patterns).
     - [`Docs/Design/`](file:///g:/My%20Drive/~RS2B/~Projects/ParaFlightLogProject/Docs/Design/README.md) (All subsystem specifications `DSGN-*.md`, index, and template).
   - **Tier 5 (Execution & Memory)**:
     - [`Docs/Backlog.md`](file:///g:/My%20Drive/~RS2B/~Projects/ParaFlightLogProject/Docs/Backlog.md) (Source of truth for `RQ`, `CR`, `Bug`, `ToDo`).
     - [`Docs/ChangeLog.md`](file:///g:/My%20Drive/~RS2B/~Projects/ParaFlightLogProject/Docs/ChangeLog.md) (Historical session records).
     - [`Docs/Context.md`](file:///g:/My%20Drive/~RS2B/~Projects/ParaFlightLogProject/Docs/Context.md) (Long-term memory & Ways of Working).
2. **Discover Local Planning & Audit Artifacts in `Plans/`**:
   - [`Plans/AuditReports/`](file:///g:/My%20Drive/~RS2B/~Projects/ParaFlightLogProject/Plans/AuditReports/Audit_Template.md) (`AUD-*.md` architectural audit reports).
   - `Plans/CodeCheckReports/` (`YYYY-MM-DD_CodeCheck.md`).
   - `Plans/DocCheckReports/` (`YYYY-MM-DD_DocCheck.md`).
   - `Plans/SessionSummary/` (`YYYY-MM-DD_SessionSummary.md`).
3. **Discover Active Codebase**:
   - All script files (`Code/*.gs`), HTML dialogs (`Code/*.html`), `Code/Config.gs`, `Code/appsscript.json`, and tools (`tools/*.js`).

---

## 2. Audit Dimensions

1. **Code-to-Documentation Drift**:
   - Verify that modules, function names, namespaces, sheet schema (`TABS.FLIGHTS.columns`), lookups, and configuration parameters (`DEFAULT_PARAMETERS`) match 100% between `Code/Config.gs` and `Docs/Technical_Specification.md` / `Docs/Features.md`.
2. **Backlog Traceability**:
   - Ensure implemented code features and bug fixes have their corresponding items in `Docs/Backlog.md` (`RQ-*`, `CR-*`, `Bug-*`) accurately marked as `Implemented` or `Fixed` rather than `Open` or `WIP`.
3. **Design-to-Code Header Synchronization**:
   - Check `@design` and `@revision` JSDoc tags in `Code/*.gs` files against active design specifications in `Docs/Design/` to ensure code and RFC designs remain synchronized.
4. **Cross-Doc Consistency & Version Parity**:
   - Verify version numbers (`v2.1.0`), core invariants, and Ways of Working match across `Docs/Context.md`, `Docs/ChangeLog.md`, `Docs/Roadmap.md`, and `Docs/Technical_Specification.md`.
5. **Stale References & Legacy Nomenclature**:
   - Scan documentation for retired tab names (`App_Log`, `App Log`, standalone `Parameters`/`Lookups` tabs), obsolete cache actions (`Clear Dedupe Cache`), or old file names (`Setup_Guide.md`).
6. **Link & Anchor Integrity**:
   - Verify all file links (`file:///...`) point to existing files, valid headers, and correct markdown anchors.

---

## 3. Generate Report

- **Location**: `Plans/DocCheckReports/`
- **File Name**: `YYYY-MM-DD_DocCheck.md`
- **Structure**:
  1. **Metadata & Scope**: Date, scope of docs audited, reference commit.
  2. **Executive Summary**: Overall documentation health score/status (`PASS`, `PASS with Warnings`, or `FAIL`) and summary count of discrepancies found.
  3. **Code-to-Documentation Drift**: Differences between active code and `Technical_Specification.md` / `Features.md`.
  4. **Cross-Doc Inconsistencies & Duplication**: Conflicting statements, stale versions, redundant text blocks that should be cross-linked.
  5. **Backlog Traceability**: Status mismatches between actual code features and `Backlog.md` items.
  6. **Stale References & Dead Links**: Mentions of removed functions, old parameters, or broken markdown paths.
  7. **Proposed Remediation Plan**: Specific, file-by-file edits proposed to bring all documentation into 100% synchronization.

---

## 4. Review & Remediate (Upon Approval)

1. Output a concise executive summary in the chat highlighting key discrepancies and the proposed remediation plan.
2. Provide a clickable link to the full report in `Plans/DocCheckReports/`.
3. Wait for user approval before making any edits.
4. Apply approved edits, stage changes with `git add Docs/`, and commit with a descriptive message (`docs: sync documentation across 5 tiers per doc_check audit`).

---

## 5. Workflow Self-Evolution & Maintenance Triggers

Whenever documentation architecture or planning structures evolve, this workflow must be updated:

| Trigger Event | Required Workflow Updates |
| :--- | :--- |
| **New Document Added to `Docs/`** | Add file to the 5-Tier inventory in Section 1 and update Cross-Doc Consistency checks. |
| **New RFC Design Spec in `Docs/Design/`** | Ensure design-to-code `@design` header verification covers the new subsystem. |
| **New Audit Template or Subfolder in `Plans/`** | Update discovery paths in Section 1. |
| **Renamed or Consolidated Documentation** | Update Section 1 and add old file name to the stale reference scanner. |
