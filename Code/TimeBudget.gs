/**
 * Paragliding Flight Log v2.0
 * Updated: 2026-10-02 19:33:18
 */
/**
 * Paragliding Flight Log - Time Budget & Safety Checkpoint Service
 * Implementation of DSGN-UI-001 Section 3.4
 * 
 * Provides deterministic wall-clock time monitoring for Google Apps Script
 * long-running processes to prevent unhandled 6-minute script execution timeouts.
 */

var TimeBudgetService = {
  // Safe ceiling: 4.5 minutes (270,000 ms), leaving a 90-second safety buffer for commit & trigger creation
  DEFAULT_MAX_EXECUTION_MS: 270000,

  /**
   * Creates a new time budget tracker starting at the current timestamp.
   * @param {number} [maxMs] Optional custom execution duration in milliseconds. Defaults to 270,000 ms (4.5 min).
   * @return {Object} Time budget instance with inspection methods.
   */
  create: function(maxMs) {
    var ceilingMs = (typeof maxMs === 'number' && maxMs > 0) ? maxMs : TimeBudgetService.DEFAULT_MAX_EXECUTION_MS;
    var startTime = new Date().getTime();

    return {
      startTime: startTime,
      ceilingMs: ceilingMs,

      /**
       * Checks whether the allocated time budget has been exhausted.
       * @return {boolean} True if elapsed time >= ceiling.
       */
      isExhausted: function() {
        return (new Date().getTime() - startTime) >= ceilingMs;
      },

      /**
       * Checks whether execution time remains within the budget.
       * @param {number} [safetyMarginMs] Optional additional safety margin (e.g. 10,000 ms).
       * @return {boolean} True if time remains.
       */
      hasTimeRemaining: function(safetyMarginMs) {
        var margin = (typeof safetyMarginMs === 'number') ? safetyMarginMs : 0;
        return (new Date().getTime() - startTime + margin) < ceilingMs;
      },

      /**
       * Returns elapsed time in seconds.
       * @return {number}
       */
      elapsedSeconds: function() {
        return Math.round((new Date().getTime() - startTime) / 1000);
      },

      /**
       * Returns elapsed time in milliseconds.
       * @return {number}
       */
      elapsedMs: function() {
        return new Date().getTime() - startTime;
      },

      /**
       * Returns remaining time in seconds before budget exhaustion.
       * @return {number}
       */
      remainingSeconds: function() {
        var remaining = Math.max(0, ceilingMs - (new Date().getTime() - startTime));
        return Math.round(remaining / 1000);
      }
    };
  }
};
