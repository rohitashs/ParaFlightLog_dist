# Architecture & In-Code Documentation Standards
**Developer & AI Pair Programmer Handbook**

* **Status**: `Living Standard`
* **Authority**: Tier 4 Architecture Reference
* **Governing Pattern**: [Pattern 20 (`Docs/Patterns_and_Practices.md`)](file:///g:/My%20Drive/~RS2B/~Projects/ParaFlightLogProject/Docs/Patterns_and_Practices.md)
* **Target Audience**: Human Contributors, Core Maintainers, and AI Agents (Antigravity, Cursor, Claude Code)

---

## 1. Intent & Core Philosophy

This standard defines how to document the **Paragliding Flight Log** system across both persistent markdown documents and production source code.

As an open-source project designed for collaborative development and AI pair programming ("vibe coding"), our documentation must satisfy two strict criteria:
1. **Human Clarity**: A new developer or flight enthusiast can understand the architectural topology, design trade-offs, and domain physics in minutes.
2. **AI Determinism**: An AI coding agent operating under a constrained context window can navigate the repository without hallucinating signatures, violating Google Apps Script runtime quotas, or breaking historical invariants.

---

## 2. The Three-Level Tier 4 Hierarchy

Tier 4 (Systems Architecture & Detailed Design) is structured into three distinct layers:

```
┌────────────────────────────────────────────────────────┐
│ LEVEL A: System Architecture (Docs/Architecture/)      │
│ Macro C4 models, functional views, runtime execution,  │
│ data substrate, external API gateways.                 │
└───────────────────────────▲────────────────────────────┘
                            │ Refines into
┌───────────────────────────┴────────────────────────────┐
│ LEVEL B: Subsystem Designs & RFCs (Docs/Design/)       │
│ Micro-specifications for each individual subsystem     │
│ (DSGN-CORE-* for foundations, DSGN-* for features).    │
└───────────────────────────▲────────────────────────────┘
                            │ Governed by
┌───────────────────────────┴────────────────────────────┐
│ LEVEL C: Patterns & Practices (Patterns_and_Practices) │
│ Numbered engineering rules (Pattern 1..20) and         │
│ forbidden anti-pattern checklists.                     │
└────────────────────────────────────────────────────────┘
```

---

## 3. The Dual-Track Architectural View Model

To avoid mixing aeronautical domain logic with Google platform technical constraints, all architecture documentation follows a **Dual-Track (Matrix) Model**:

```
┌────────────────────────────────────────────────────────────────────────┐
│                      FUNCTIONAL DOMAIN VIEW                            │
│           (Pilot Capabilities & Aeronautical Problem Space)            │
├─────────────────┬──────────────────┬─────────────────┬─────────────────┤
│ 1. Ingestion    │ 2. Aero Physics  │ 3. Logbook &    │ 4. System       │
│    & Dedupe     │    & Scoring     │    Dashboard    │    Maintenance  │
├─────────────────┼──────────────────┼─────────────────┼─────────────────┤
│    ═══════════════════════════════════════════════════════════════     │
│                     CROSS-CUTTING TECHNICAL CONCERNS                   │
│         (Google Platform Constraints, Quotas, Storage Substrate)       │
├─────────────────┬──────────────────┬─────────────────┬─────────────────┤
│ • Storage (DB)  │ • Concurrency    │ • UI / RPC      │ • Resilience &  │
│   Sheets/Drive  │   TimeBudget/4.5m│   Modal/Sidebar │   Soft Guardrail│
└─────────────────┴──────────────────┴─────────────────┴─────────────────┘
```

* **Functional Views (`Docs/Architecture/Views/01_Functional_View.md`)**:
  Focus strictly on the flight problem space: IGC fix parsing, thermal detection, FAI triangle optimization, and equipment tracking. Decoupled from runtime implementation details.
* **Technical Concerns (`Docs/Architecture/Views/02_Execution_and_Runtime.md`, etc.)**:
  Focus strictly on engineering reality: Google Sheets 10M cell limit, Apps Script 6-minute execution cutoff, client-server RPC gateways, timezone rollover protections, and non-destructive schema migrations.

---

## 4. The Two-Way Linking Contract (Code $\longleftrightarrow$ Docs)

Code and documentation must never exist in disconnected silos. They are bound together using **durable conceptual anchors**:

### A. Top-Down Code Header Contract (Code $\to$ Docs)
Every `.gs` file in `Code/` must begin with a standardized JSDoc metadata header:

```javascript
/**
 * Paragliding Flight Log v2.0
 * Updated: 2026-10-02 21:52:07
 */
/**
 * MODULE: Scoring Engine (Aero Physics & FAI 5-Point Optimizer)
 * 
 * @design Docs/Design/Core_Subsystems/DSGN-CORE-002_Physics_and_Scoring.md
 * @architecture Docs/Architecture/Views/01_Functional_View.md#2-aeronautical-physics--scoring
 * @tenet Tenet 2 (Zero-Cost Serverless), Tenet 4 (4.5m Bounded Execution)
 * @pattern Pattern 8 (Timezone Shielding), Pattern 14 (Batch In-Memory Calculation)
 * @revision Rev 2.1
 */
```

### B. Bottom-Up Implementation Map Contract (Docs $\to$ Code)
Every architecture view and subsystem RFC must conclude with an explicit machine-readable **Implementation & Code Map**:

```markdown
### 5. Implementation & Code Mapping
* **Primary Service**: [`Code/Scoring.gs`](file:///g:/My%20Drive/~RS2B/~Projects/ParaFlightLogProject/Code/Scoring.gs)
* **Key Interfaces**:
  * `SCORING.calculateXCOptimization(fixes, config)`: Main graph search & RDP reduction.
  * `findBestTriangle_(fixes)`: 5-point FAI turnpoint permutation optimizer.
* **Dependent Dialogs**: [`Code/FlightMaintenanceDialog.html`](file:///g:/My%20Drive/~RS2B/~Projects/ParaFlightLogProject/Code/FlightMaintenanceDialog.html)
* **Automated Unit Tests**: [`tests/Test.gs`](file:///g:/My%20Drive/~RS2B/~Projects/ParaFlightLogProject/tests/Test.gs) (`testScoring_`)
```

---

## 5. Three-Tier In-Code Commenting Standard

To prevent comment bloat while protecting critical system invariants, developers and AI agents must follow the **Three-Tier Commenting Rule**:

### Golden Rule:
> **Never comment what the syntax already says. Comment the WHY, the INVARIANT, and the TRAP.**

| Tier | Scope | Target Content | Style & Tags |
| :--- | :--- | :--- | :--- |
| **Tier 1: Module Header** | Top of file | Architecture, Design spec, Tenets, Patterns, Revision. | Standard JSDoc block with `@design`, `@architecture`. |
| **Tier 2: Public Interface** | Exported methods | Complete parameter types, return shapes, and error modes. | JSDoc `@param`, `@returns`, `@throws`. (Critical for AI signature inference). |
| **Tier 3: Invariant Guardrail** | In-line code | Non-obvious domain rules, quota workarounds, safety traps. | Prefixed tags: `// INVARIANT:`, `// PATTERN X:`, `// GAS LIMIT:`, `// ZERO-LOSS CONTRACT:` |

#### Concrete Examples:

```javascript
// ❌ BAD: Syntax Echo (Avoid)
// Loop through rows
for (var i = 0; i < rows.length; i++) {
  // Check if flight is valid
  if (rows[i][0] === 'Valid') { ... }
}

// ✅ GOOD: Defensive Invariant (Prescribed)
// INVARIANT (Pattern 8): MUST use getDisplayValues() instead of getValues().
// Date objects in GAS suffer from script-timezone shift that rolls midnight flights
// back to the previous calendar day.
var displayValues = range.getDisplayValues();

// ✅ GOOD: Platform Quota Guardrail (Prescribed)
// GAS QUOTA LIMIT (Pattern 14): Avoid sheet.setFormula() inside this loop.
// Accumulate formulas into a 2D array and apply in a single batch setFormulas()
// to prevent exceeding Google's 30-second RPC latency budget.
```

---

## 6. AI-Friendly ("Vibe Coding") Authoring Rules

When collaborating with AI agents:

1. **Cite Numbered Patterns Directly**:
   Instead of writing long prompts explaining how to handle formulas, tell the AI: *"Implement this calculation following Pattern 1 (Dynamic Column Map) and Pattern 14 (Batch Array Formulas)."*
2. **Use Deterministic Decision Tables**:
   AIs parse markdown tables with near-zero error rates compared to prose paragraphs. Format all operational tiers, state machines, and scoring rules as markdown tables.
3. **Reference the Anti-Patterns Checklist**:
   The **Forbidden Code Smells & Anti-Patterns Checklist** in `Patterns_and_Practices.md` acts as an authoritative negative constraint to keep generated code clean.
4. **Use Clickable File Links**:
   Always link files using github-style markdown links with forward slashes (`[Config.gs](file:///path/to/Code/Config.gs)`).

---

## 7. Automated Continuous Verification Gate

Documentation compliance is not left to manual review. It is enforced programmatically:

1. **Automated Static Audit (`node tools/code_check_audit.js`)**:
   * Scans all `.gs` files to ensure `@design` headers exist and link to active design specs.
   * Scans for forbidden legacy tokens (`App_Log`, `TABS.PARAMETERS`).
   * Validates 3-way manifest parity across metadata, updaters, and dialogs.
2. **Documentation Audit (`/doc_check`)**:
   * Cross-references `Docs/Design/README.md` against active code revision stamps.
   * Audits Backlog status markers against implemented code features.
