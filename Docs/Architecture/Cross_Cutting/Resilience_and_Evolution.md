# Architecture Cross-Cutting: Resilience & Schema Evolution

* **Status**: `Living Specification`
* **Parent Architecture**: [`Docs/Architecture/README.md`](file:///g:/My%20Drive/~RS2B/~Projects/ParaFlightLogProject/Docs/Architecture/README.md)
* **Governing Pattern**: [Pattern 7, 8, 16, 17 (`Docs/Patterns_and_Practices.md`)](file:///g:/My%20Drive/~RS2B/~Projects/ParaFlightLogProject/Docs/Patterns_and_Practices.md)

---

## 1. The Zero-Loss Data Contract

The foundational invariant of the ParaFlightLog update system is the **Strict Zero-Loss Guarantee**:
* **Rows 5:N Strictly Read-Only**: Automated maintenance routines, formatters, and scaffolding scripts treat pilot flight data (Rows 5:N on `Flights`), custom equipment inventories, and personalized parameter values as strictly read-only.
* **No Blanket Overwrites**: Scripts never call `sheet.clear()` or overwrite existing headers without verifying existing column maps.

---

## 2. Script-to-Sheet Decoupling & Dual-State Lag Resilience

In Google Workspace development, new code pushed via clasp often executes against spreadsheets whose visual grid, named ranges, or formulas were scaffolded one or more versions earlier.

To prevent fatal crashes during dual-state lag:
1. **Loose Coupling & Tolerant Lookups**: Code falls back gracefully if expected columns or named ranges are temporarily absent.
2. **Mandatory Invariant Auto-Enforcement**: During maintenance, core structural prerequisites (`Flights.formulas`, `Dashboard.formulas`, `Config.lookups`, `Config.namedRanges`, `Config.parameters`, `Equipment.headers`) are auto-enforced by the orchestrator as mandatory invariants, even if a user unchecked that sheet in the UI.
3. **Lazy Self-Healing**: Operations inspect sheet prerequisites on the fly and auto-repair missing named ranges or lookup formulas before proceeding.

---

## 3. Native Soft Guardrails (`setWarningOnly`)

To prevent pilots from accidentally wiping out complex formulas or header tooltips via copy-paste or errant keystrokes:
* Range protections are applied to:
  * `Flights` Rows 1–4 (headers & categories).
  * `Flights` `Flight No` formula column.
  * `Dashboard` formula KPI banners and leaderboards.
  * `Config` dynamic lookup formulas.
* **Soft Warning Only**: Protections are configured with `setWarningOnly(true)`. Users receive Google Sheets' native *"Are you sure you want to edit this cell?"* confirmation dialog without locking them out or requiring administrative domain permissions.

---

## 4. Dual Pre-Flight Safety Backups

Before executing any structural update, the System Maintenance Orchestrator enforces dual safety snapshots:
1. **In-Workbook Sheet Clones (`_MNT_BAK_*`)**: Clones targeted sheets directly within the workbook, allowing instant one-click rollback if an update produces unexpected visual shifts.
2. **Client-Side Config JSON Snapshot**: Serializes all parameters, lookups, and profile fields into a downloadable `.json` file triggered automatically in the pilot's browser.
