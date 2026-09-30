---
description: Comprehensive documentation audit and synchronization with active code and backlog
---

1. **Read & Discover**:
    - Read all persistent documentation files in `Docs/`:
        - `Docs/Context.md`
        - `Docs/Features.md`
        - `Docs/Technical_Specification.md`
        - `Docs/Backlog.md`
        - `Docs/ChangeLog.md`
        - `Docs/Setup_Guide.md`
        - `Docs/Workflows/*.md`
    - Read current code inventory and configuration in `Code/`:
        - All script files (`Code/*.gs`)
        - All HTML templates (`Code/*.html`)
        - Configuration constants (`Code/Config.gs`)
        - Project manifest (`Code/appsscript.json`)

2. **Audit Dimensions**:
    - **Code-to-Doc Drift**: Verify modules, function names, namespaces, sheet schema (`TABS.FLIGHTS.columns`, `colNotes`), and configuration parameters (`DEFAULT_PARAMETERS`) match between `Code/` and `Docs/Technical_Specification.md` / `Docs/Features.md`.
    - **Backlog Traceability**: Ensure implemented code features and bug fixes have their corresponding items in `Docs/Backlog.md` (`RQ-*`, `CR-*`, `Bug-*`) accurately marked as `Implemented` rather than `Open` or `WIP`.
    - **Cross-Doc Consistency**: Verify version numbers, current status, and "Ways of Working" match across `Docs/Context.md`, `Docs/ChangeLog.md`, and `Docs/Technical_Specification.md`.
    - **Redundancy & Stale Content**: Identify duplicated descriptions, obsolete function references, deprecated parameters, and broken internal links or outdated workflow instructions.

3. **Generate Report**:
    - **Location**: `Plans/DocCheckReports/` (ensure directory exists).
    - **File Name**: `YYYY-MM-DD_DocCheck.md` (using current date).
    - **Structure**:
        1. **Metadata & Scope**: Date, scope of docs audited, reference commit.
        2. **Executive Summary**: Overall documentation health score/status (`PASS`, `PASS with Warnings`, or `FAIL`) and summary count of discrepancies found.
        3. **Code-to-Documentation Drift**: Differences between active code and `Technical_Specification.md` / `Features.md`.
        4. **Cross-Doc Inconsistencies & Duplication**: Conflicting statements, stale versions, redundant text blocks that should be cross-linked.
        5. **Backlog Traceability**: Status mismatches between actual code features and `Backlog.md` items.
        6. **Stale References & Dead Links**: Mentions of removed functions, old parameters, or broken markdown paths.
        7. **Proposed Remediation Plan**: Specific, file-by-file edits proposed to bring all documentation into 100% synchronization.

4. **Present & Review**:
    - Output a concise executive summary in the chat highlighting key discrepancies and the proposed remediation plan.
    - Provide a clickable link to the full report in `Plans/DocCheckReports/`.
    - Wait for user approval before making any edits.

5. **Remediate & Sync (Upon Approval)**:
    - Apply all approved documentation updates across `Docs/`.
    - Stage changes with `git add Docs/`.
    - Commit with a descriptive message (e.g., `docs: sync documentation with codebase per doc_check audit`).
    - Push to git remote (`git push origin master`).
