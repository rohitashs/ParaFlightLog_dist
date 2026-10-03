# Design Specification: Aeronautical Physics Engine & FAI XC Scoring

* **Design ID**: `DSGN-CORE-002`
* **Status**: `Implemented`
* **Current Revision**: `Rev 2.1`
* **Date Created**: `2026-10-02`
* **Last Updated**: `2026-10-02`
* **Author / Contributors**: `Rohitashwa / Antigravity AI`
* **Parent Design**: `None` (Core Subsystem)
* **Child Designs**: `None`
* **Umbrella Module / Primary Code**: [`Code/Analysis.gs`](../../Code/Analysis.gs), [`Code/Scoring.gs`](../../Code/Scoring.gs), [`Code/Parser.gs`](../../Code/Parser.gs)
* **Code Revision Stamp**: `Core v2.1.0 Implemented`
* **Related Requirements / CRs**: `[RQ-ANA-001]`, `[RQ-ANA-002]`, `[RQ-SCR-001]`, `[CR-CFG-002]`

---

## 1. Executive Summary & Intent

### Problem Statement
Raw IGC flight logs consist of thousands of discrete sensor fixes (time, lat, lon, GPS altitude, barometric altitude). Transforming these unstructured GPS streams into meaningful aeronautical analytics (thermal count, average core climb, glide efficiency) and official FAI Cross-Country contest scores requires complex aerodynamic classification and geometric graph optimization.

### Proposed Solution
A two-tiered analysis engine:
1. **Aeronautical Physics Engine (`Analysis.gs`, `Parser.gs`)**: Extracts B/H records and applies sliding-window differential calculus to classify flight segments into Thermalling, Ridge Soaring, and Gliding.
2. **FAI Cross-Country Optimizer (`Scoring.gs`)**: Implements Ramer-Douglas-Peucker (RDP) polygon reduction followed by a 5-point combinatorial search to maximize contest distance and multiplier points.

---

## 2. Requirements & Scope

### Functional Requirements
* **REQ-1 (IGC Record Parsing)**: Parse FAI-standard B-records (fix telemetry) and H-records (glider, pilot, instrument metadata).
* **REQ-2 (Aeronautical Mode Detection)**: Classify flight intervals into Thermalling, Ridge Soaring, and Gliding.
* **REQ-3 (Climb & Altitude Metrics)**: Calculate max altitude, launch/landing elevation, height gain, integrated 20s climb rate, and sink rates.
* **REQ-4 (FAI XC Optimization)**: Calculate Free Flight distance, Flat Triangle, and FAI Triangle scores under FAI Rule 4.4.2 closure constraints.
* **REQ-5 (Configurable RDP Simplification)**: Support dynamic trajectory tolerance via `RDP_TOLERANCE` (default $25.0\text{ m}$).

---

## 3. Architecture & Detailed Design

### 3.1 Aeronautical Mode Detection State Machine
Using sliding-window integration over consecutive GPS/baro fixes:
* **Thermal Mode**: Vertical speed $V_z > 0.3\text{ m/s}$ and turn rate $\omega > 8^\circ/\text{s}$ sustained for $\ge 30\text{ seconds}$. Records thermal apex, height gained in core, and thermal strength.
* **Ridge Soaring Mode**: Vertical speed $V_z > -0.2\text{ m/s}$ with alternating S-turn heading reversals $> 90^\circ$.
* **Glide Mode**: Vertical speed $V_z < 0.2\text{ m/s}$ and turn rate $\omega < 5^\circ/\text{s}$. Computes instantaneous groundspeed and glide ratio ($L/D$).

### 3.2 FAI Cross-Country Scoring Pipeline
1. **Ramer-Douglas-Peucker (RDP) Trajectory Reduction**:
   Reduces 10,000+ raw fixes to ~150 critical directional vertices using perpendicular distance threshold $\epsilon = \text{RDP\_TOLERANCE}$.
2. **5-Point Combinatorial Graph Search**:
   Evaluates all permutations of 5 points: Takeoff ($T_0$), Turnpoint 1 ($P_1$), Turnpoint 2 ($P_2$), Turnpoint 3 ($P_3$), and Landing ($T_1$).
3. **Triangle Closure Evaluation (FAI Rule 4.4.2)**:
   * Gap distance $D_{\text{gap}} = \text{dist}(T_0, T_1)$.
   * Triangle distance $D_{\text{tri}} = \text{dist}(P_1, P_2) + \text{dist}(P_2, P_3) + \text{dist}(P_3, P_1)$.
   * Valid triangle condition: $D_{\text{gap}} \le 0.20 \times D_{\text{tri}}$ or $D_{\text{gap}} \le 3.0\text{ km}$.
   * FAI Triangle: Shortest leg $\ge 28\%$ of total perimeter.

---

## 4. Implementation & Code Mapping

* **IGC Parser**: [`Code/Parser.gs`](../../Code/Parser.gs)
* **Physics & Thermals Engine**: [`Code/Analysis.gs`](../../Code/Analysis.gs)
* **FAI Scoring Optimizer**: [`Code/Scoring.gs`](../../Code/Scoring.gs)
* **Math & Geometry Helpers**: [`Code/Utils.gs`](../../Code/Utils.gs)
* **Automated Unit Tests**: [`tests/Test.gs`](../../tests/Test.gs) (`testParser_`, `testAnalysis_`, `testScoring_`)
