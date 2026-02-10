# Technical Specifications (Source of Truth)

## 1. Overview
This document defines the **Code Organization**, **Algorithms**, and **Data Schema**.
*   **Feature Map**: See `Features.md` for the functional view.
*   **Requirements**: See `Backlog.md` (`RQ-*`).

---

## 2. System Architecture
**Stack**: Google Apps Script (GAS) bound to Google Sheets.
**Patterns**: Service-Oriented (Modules), MVC-lite (Sheet as View).

### Modules (`Code/`)
1.  **Orchestrator (`Code.gs`)**: Entry point. Maps Triggers/Menus to Controllers.
2.  **Config (`Config.gs`)**: Static Definitions (`TABS`, `CFG`).
    *   *Rule*: Never hardcode column indices. Use `Config` maps.
3.  **Scaffold (`Scaffold.gs`)**: View Controller. Creates Sheets/Validations.
    *   *Map*: `RQ-SYS-002`.
4.  **Ingestion Service (`Ingestion.gs`)**: Pipeline Controller.
    *   *Map*: `RQ-ING-001`.
5.  **Domain Logic**:
    *   **`Parser.gs`**: IGC extraction (B-Records, H-Records).
    *   **`Analysis.gs`**: Physics engine (Thermals, Glide).
    *   **`Scoring.gs`**: Optimization engine (Graph theory/RDP).
    *   **`Geo.gs`**: External API Gateway (Nominatim, Overpass).

---

## 3. Data Schema (`Flights` Tab)
Fixed Header Schema (Row 4=Category, Row 5=Name). Data starts Row 6.

### Primary Column Groups
| Group | Key Fields | Mapping |
| :--- | :--- | :--- |
| **Identity** | `Status`, `Flight No`, `Date`, `Type` | `RQ-ING-002` |
| **Gear** | `Wing`, `Harness`, `Reserve` | `RQ-SYS-001` |
| **Scoring** | `XC Score`, `Triangle`, `Points` | `RQ-SCR-001` |
| **Geo** | `Launch Site`, `Land Town` | `RQ-SCR-002` |
| **Metrics** | `Duration`, `Max Alt`, `Gain` | `RQ-ANA-002` |
| **System** | `Import ID`, `Hash`, `Notes` | Validation/Audit |

---

## 4. Algorithms & Logic

### A. Deduplication Strategy (`RQ-ING-002`)
1.  **Hard Dedupe**: MD5 Hash of file content.
2.  **Soft Dedupe (Overlap)**: `New.Start < Existing.End` AND `New.End > Existing.Start`.
3.  **Soft Dedupe (Proximity)**: `StartTime` within 15min AND `Dist` < 500m.

### B. Flight Mode Detection (`RQ-ANA-001`)
*   **Window**: 10s sliding window.
*   **Thermal**: `Vario > 0.3m/s` AND `TurnRate > 8deg/s`.
*   **Soaring**: `Vario > -0.2m/s` AND `HeadingChange > 90deg` (S-Turns).
*   **Glide**: `TurnRate < 5deg/s` AND `Vario < 0.2m/s`.

### C. XC Scoring (`RQ-SCR-001`)
1.  **Simplification**: Ramer-Douglas-Peucker (RDP) epsilon=0.001.
2.  **Optimization**: Brute-force 3 TP max distance.
3.  **Triangle Rules**:
    *   **Flat**: Gap < 20%.
    *   **FAI**: Shortest Leg >= 28%.

---

## 5. Configuration Strategy (`RQ-SYS-001`)
1.  **`Config.gs`**: Defines structural constants (Sheet names, Colors).
2.  **`Parameters` Sheet**: Defines User runtime values (Thresholds, API Keys).
    *   *Priority*: User Sheet Values > Default Config constants.

## 6. API Integrations (`RQ-SCR-002`)
*   **Geocoding**: Chain of Responsibility (`BigDataCloud` -> `Nominatim` -> Fail).
*   **Caching**: `CacheService` (6 hour TTL) for all external calls.
