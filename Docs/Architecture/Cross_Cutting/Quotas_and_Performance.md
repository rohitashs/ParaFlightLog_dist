# Architecture Cross-Cutting: Quotas & Performance Optimization

* **Status**: `Living Specification`
* **Parent Architecture**: [`Docs/Architecture/README.md`](../README.md)
* **Governing Pattern**: [Pattern 6, 14, 15 (`Docs/Patterns_and_Practices.md`)](../../Patterns_and_Practices.md)

---

## 1. Google Workspace Quota Budgeting

As a zero-cost serverless platform, **ParaFlightLog** operates strictly within Google's free tier consumer limits:

| Quota Dimension | Google Consumer Limit | ParaFlightLog Architectural Budget |
| :--- | :--- | :--- |
| **Script Execution Time** | 6 min / execution | **4.5 min cutoff (`TimeBudgetService`)** with self-continuation. |
| **URLFetch Calls** | 20,000 calls / day | **6h CacheService TTL** + 1s Nominatim rate limiter. |
| **Drive API Rate Limit** | Varies (~100 req / 100s) | **In-memory quality scoring** from sheet rows; zero Drive calls during dedupe triage. |
| **Batch Cell Writes** | ~50,000 cells / call | **Chunked 2D array appends** (`setValues` / `setFormulas`). |
| **Client-Side RPC** | ~30–45s browser timeout | **Client-side stepping** (5–10 items per RPC call). |

---

## 2. In-Memory Telemetry Scoring (Zero Drive Round-Trips)

* **The Anti-Pattern**: Iterating over 500 flight rows and calling `DriveApp.getFileById(id).getBlob()` on each row to parse timestamps. This triggers 500 Google Drive HTTPS round-trips, consuming 3–5 minutes and hitting Drive rate limits.
* **The High-Performance Solution (`scoreFlightQualityFromRow_`)**:
  * Evaluates candidate overlap and quality scores (0–100 pts) strictly using data already loaded in memory from `sheet.getDisplayValues()`.
  * Drops execution time from **minutes** to **under 50 milliseconds**.

---

## 3. Batch Formula Application (`setFormulas` vs `setFormula`)

* **The Anti-Pattern**: Updating 500 flight sequence numbers using a loop:
  ```javascript
  for (var r = 5; r <= lastRow; r++) {
    sheet.getRange(r, 2).setFormula(formula); // 500 synchronous Google Sheets network calls!
  }
  ```
  Execution time: ~25 seconds.
* **The High-Performance Solution**:
  ```javascript
  var formulaArray = [];
  for (var r = 5; r <= lastRow; r++) {
    formulaArray.push([formula]);
  }
  sheet.getRange(5, 2, formulaArray.length, 1).setFormulas(formulaArray); // 1 atomic call
  ```
  Execution time: **~120 milliseconds** (200x speedup).

---

## 4. Caching Architecture (`CacheService`)

* External geocoding results (coordinates $\to$ town, region) and takeoff site bounding boxes are cached in `CacheService.getUserCache()` with a **6-hour TTL**.
* Repeated imports of flights from the same home flying sites incur **zero external HTTP requests**.
