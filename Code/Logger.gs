/**
 * Paragliding Flight Log v2.0
 * Updated: 2026-10-02 23:47:08
 */
/**
 * Paragliding Flight Log - Activity Logging Engine
 * 
 * @design Docs/Design/DSGN-LOG-001_Activity_Logging_System.md
 * @architecture Docs/Architecture/Cross_Cutting/Resilience_and_Evolution.md#3-activity-logging--audit-trail-dsgn-log-001
 * @revision Rev 1.0
 * @status Implemented
 * 
 * Centralized logging service providing:
 * - 4-column Activity Logs schema: Process | Timestamp | Activity / Event | Additional Info
 * - Tiered log levels (Brief, Normal, Debug)
 * - Atomic batch logging and session-scoped buffering
 * - Conservative dual-threshold pruning (keeps logs unless > rowsToKeep AND > daysToKeep)
 * - Client-server RPC gateway for modal dialog activity consoles
 */

var LOG = {
  /**
   * Resolves a process key or string into a clean display label using CFG.LOG_PROCESSES.
   * @param {string} key - Process key or ad-hoc name.
   * @return {string} Standardized process label.
   */
  resolveProcess: function(key) {
    if (!key) return 'System';
    if (typeof CFG !== 'undefined' && CFG.LOG_PROCESSES && CFG.LOG_PROCESSES[key]) {
      return CFG.LOG_PROCESSES[key];
    }
    return String(key);
  },

  /**
   * Retrieves the active log verbosity level ('Brief', 'Normal', or 'Debug').
   * @return {string} Configured log level (default: 'Normal').
   */
  getLogLevel: function() {
    try {
      if (typeof getParameters_ === 'function') {
        var params = getParameters_();
        if (params && params.LOG_LEVEL) {
          return String(params.LOG_LEVEL).trim();
        }
      }
    } catch (e) {}
    return 'Normal';
  },

  /**
   * Evaluates whether an activity message should be recorded to the persistent sheet.
   * - 'Brief': Only records lifecycle boundaries ([START], [COMPLETE]) and warnings/errors ([WARN], [ERR]).
   * - 'Normal': Records all lifecycle events and individual transactions ([OK], [DUPE], etc.).
   * - 'Debug': Records everything with high verbosity.
   * @param {string} message - Activity message string.
   * @param {string} logLevel - Active log level.
   * @return {boolean} True if the message passes the level filter.
   */
  shouldLog: function(message, logLevel) {
    // Defensively handle swapped arguments (logLevel, message) vs (message, logLevel)
    if (typeof message === 'string' && (message === 'Brief' || message === 'Normal' || message === 'Debug')) {
      var tmp = message;
      message = logLevel;
      logLevel = tmp;
    }
    if (!message) return false;
    var lvl = logLevel || 'Normal';
    if (lvl === 'Debug') return true;
    if (String(message).indexOf('[DEBUG]') > -1) return false;
    if (lvl === 'Normal') {
      // Normal logs all lifecycle boundaries, discovery events, transactions, and alerts
      return true;
    }

    // Brief mode filter: logs lifecycle boundaries ([START], [COMPLETE]), discovery ([INFO]), and alerts ([WARN], [ERR]),
    // skipping individual per-file transaction records ([OK], [DUPE])
    var str = String(message);
    var isTransaction = str.indexOf('[OK]') > -1 || str.indexOf('[DUPE]') > -1;
    return !isTransaction;
  },

  /**
   * Writes a single log entry to the Activity Logs sheet.
   * @param {string} processKey - Process key or label.
   * @param {string} message - Core activity narrative.
   * @param {string} [additionalInfo] - Optional diagnostic details or error info.
   * @param {Date} [date] - Optional timestamp (defaults to now).
   */
  write: function(processKey, message, additionalInfo, date) {
    var logLevel = this.getLogLevel();
    if (!this.shouldLog(message, logLevel)) return;

    try {
      var ss = SpreadsheetApp.getActive();
      var sheetName = (typeof TABS !== 'undefined' && TABS.ACTIVITY) ? TABS.ACTIVITY.name : 'Activity Logs';
      var sh = ss ? ss.getSheetByName(sheetName) : null;
      if (!sh) {
        // Fallback check for legacy App_Log (migration bridge)
        sh = ss ? ss.getSheetByName('App_Log') : null; // Legacy migration bridge
      }
      if (!sh) return;

      var proc = this.resolveProcess(processKey);
      var ts = date || new Date();
      var msg = String(message || '');
      var info = String(additionalInfo || '');

      var lastRow = Math.max(2, sh.getLastRow());
      sh.getRange(lastRow + 1, 1, 1, 4).setValues([[proc, ts, msg, info]]);
    } catch (e) {
      console.warn('LOG.write error: ' + e.message);
    }
  },

  /**
   * Appends an array of log entries to the Activity Logs sheet in a single atomic batch call.
   * @param {Array<Array>} entries - 2D array of [process, timestamp, message, info].
   */
  writeBatch: function(entries) {
    if (!entries || entries.length === 0) return;
    var logLevel = this.getLogLevel();

    var filtered = [];
    for (var i = 0; i < entries.length; i++) {
      var row = entries[i];
      if (this.shouldLog(row[2], logLevel)) {
        filtered.push([
          this.resolveProcess(row[0]),
          row[1] instanceof Date ? row[1] : new Date(row[1] || Date.now()),
          String(row[2] || ''),
          String(row[3] || '')
        ]);
      }
    }

    if (filtered.length === 0) return;

    try {
      var ss = SpreadsheetApp.getActive();
      var sheetName = (typeof TABS !== 'undefined' && TABS.ACTIVITY) ? TABS.ACTIVITY.name : 'Activity Logs';
      var sh = ss ? ss.getSheetByName(sheetName) : null;
      if (!sh && ss) sh = ss.getSheetByName('App_Log'); // Legacy migration bridge
      if (!sh) return;

      var lastRow = Math.max(2, sh.getLastRow());
      sh.getRange(lastRow + 1, 1, filtered.length, 4).setValues(filtered);
    } catch (e) {
      console.warn('LOG.writeBatch error: ' + e.message);
    }
  },

  /**
   * Creates an in-memory session logger for multi-step tasks.
   * Buffers lines in memory and flushes them to the sheet in a single atomic RPC.
   * @param {string} processKey - Process key or name.
   * @return {Object} Session logger object.
   */
  createSession: function(processKey) {
    var self = this;
    var proc = this.resolveProcess(processKey);
    var buffer = [];

    return {
      start: function(msg, info) {
        buffer.push([proc, new Date(), '[START] ' + (msg || 'Starting process...'), info || '']);
      },
      info: function(msg, info) {
        buffer.push([proc, new Date(), '[INFO] ' + (msg || ''), info || '']);
      },
      ok: function(msg, info) {
        buffer.push([proc, new Date(), '[OK] ' + (msg || ''), info || '']);
      },
      dupe: function(msg, info) {
        buffer.push([proc, new Date(), '[DUPE] ' + (msg || ''), info || '']);
      },
      warn: function(msg, info) {
        buffer.push([proc, new Date(), '[WARN] ' + (msg || ''), info || '']);
      },
      err: function(msg, info) {
        buffer.push([proc, new Date(), '[ERR] ' + (msg || ''), info || '']);
      },
      complete: function(msg, info) {
        buffer.push([proc, new Date(), '[COMPLETE] ' + (msg || 'Finished'), info || '']);
      },
      flush: function() {
        if (buffer.length > 0) {
          self.writeBatch(buffer);
          buffer = [];
        }
      }
    };
  },

  /**
   * Executes conservative dual-threshold pruning on the Activity Logs sheet.
   * A historical row is ONLY pruned if it simultaneously exceeds the row threshold
   * AND is older than the time threshold.
   * @param {number} [rowsToKeep] - Minimum rows to retain (default: 2000 or config).
   * @param {number} [daysToKeep] - Minimum days to retain (default: 90 or config).
   * @param {boolean} [force] - If true, bypasses LOG_AUTO_CLEAN parameter toggle.
   * @return {Object} Result object { success: boolean, cleaned: number, preserved: number, reason: string }.
   */
  cleanLogs: function(rowsToKeep, daysToKeep, force) {
    try {
      var params = (typeof getParameters_ === 'function') ? getParameters_() : {};
      var autoClean = params.LOG_AUTO_CLEAN;
      if (!force && autoClean !== 'Yes' && autoClean !== true && autoClean !== 'TRUE') {
        return { success: true, cleaned: 0, reason: 'LOG_AUTO_CLEAN is disabled in Config' };
      }

      var maxRows = Number(rowsToKeep) || Number(params.LOG_ROWS_TO_KEEP) || 2000;
      var maxDays = Number(daysToKeep) || Number(params.LOG_TIME_TO_KEEP_DAYS) || 90;

      var ss = SpreadsheetApp.getActive();
      var sheetName = (typeof TABS !== 'undefined' && TABS.ACTIVITY) ? TABS.ACTIVITY.name : 'Activity Logs';
      var sh = ss ? ss.getSheetByName(sheetName) : null;
      if (!sh && ss) sh = ss.getSheetByName('App_Log'); // Legacy migration bridge
      if (!sh) return { success: false, cleaned: 0, reason: 'Activity Logs sheet not found' };

      var totalRows = Math.max(0, sh.getLastRow() - 2); // Exclude 2 frozen header rows
      if (totalRows <= maxRows) {
        return { success: true, cleaned: 0, preserved: totalRows, reason: 'Total rows (' + totalRows + ') within row retention threshold (' + maxRows + ')' };
      }

      var cutoffDate = new Date(Date.now() - (maxDays * 86400000));
      var maxPrunable = totalRows - maxRows;

      // Read timestamps from Column B starting at Row 3
      var timestampRange = sh.getRange(3, 2, maxPrunable, 1).getValues();
      var countToDelete = 0;

      for (var i = 0; i < timestampRange.length; i++) {
        var rawVal = timestampRange[i][0];
        var rowDate = (rawVal instanceof Date) ? rawVal : new Date(rawVal);
        if (!isNaN(rowDate.getTime()) && rowDate < cutoffDate) {
          countToDelete++;
        } else {
          // Once a row within the age window is reached, stop pruning to maintain strict chronological order
          break;
        }
      }

      if (countToDelete > 0) {
        sh.deleteRows(3, countToDelete);
        PropertiesService.getScriptProperties().setProperty('LOG_LAST_CLEAN_DATE', new Date().toISOString());
        this.write(
          'LOG_CLEAN',
          '[COMPLETE] Cleaned ' + countToDelete + ' historical log rows (preserved ' + (totalRows - countToDelete) + ' recent rows within ' + maxDays + ' days)',
          'Rows pruned: ' + countToDelete + ', Kept: ' + (totalRows - countToDelete) + ', Cutoff: ' + cutoffDate.toISOString().slice(0, 10)
        );
      }

      return {
        success: true,
        cleaned: countToDelete,
        preserved: totalRows - countToDelete,
        reason: countToDelete > 0 ? 'Cleaned ' + countToDelete + ' expired rows' : 'Zero rows exceeded both row and age thresholds'
      };
    } catch (e) {
      console.warn('LOG.cleanLogs error: ' + e.message);
      return { success: false, cleaned: 0, error: e.message };
    }
  }
};

/**
 * Public RPC Gateway for client-side modal dialogs to log activity milestones directly.
 * @param {string} process - Process name or key.
 * @param {string} message - Activity message.
 * @param {string} [additionalInfo] - Optional metadata.
 */
function logClientActivity(process, message, additionalInfo) {
  LOG.write(process, message, additionalInfo);
}

/**
 * Public Menu Callback for manual on-demand Activity Log cleaning.
 */
function cleanActivityLogs() {
  var ui = SpreadsheetApp.getUi();
  var params = (typeof getParameters_ === 'function') ? getParameters_() : {};
  var rowsToKeep = params.LOG_ROWS_TO_KEEP || 2000;
  var daysToKeep = params.LOG_TIME_TO_KEEP_DAYS || 90;

  var promptMsg = 'This will prune log entries older than ' + daysToKeep + ' days if the Activity Logs tab exceeds ' + rowsToKeep + ' rows.\n\nRecent logs and logs within ' + daysToKeep + ' days are always preserved.\n\nProceed?';
  var resp = ui.alert('Clean Activity Logs Now', promptMsg, ui.ButtonSet.YES_NO);

  if (resp === ui.Button.YES) {
    var res = LOG.cleanLogs(rowsToKeep, daysToKeep, true);
    if (res.success) {
      if (res.cleaned > 0) {
        ui.alert('Log Pruning Complete', 'Successfully cleaned ' + res.cleaned + ' historical log entries.\nPreserved ' + res.preserved + ' active rows.', ui.ButtonSet.OK);
      } else {
        ui.alert('No Pruning Needed', res.reason || 'All log rows are currently within retention thresholds.', ui.ButtonSet.OK);
      }
    } else {
      ui.alert('Log Clean Failed', res.error || res.reason || 'Unknown error', ui.ButtonSet.OK);
    }
  }
}

/**
 * Automated background check invoked during periodic watcher scans.
 */
function autoCleanLogsIfDue_() {
  try {
    var params = (typeof getParameters_ === 'function') ? getParameters_() : {};
    var autoClean = params.LOG_AUTO_CLEAN;
    if (autoClean !== 'Yes' && autoClean !== true && autoClean !== 'TRUE') return;

    var freqDays = Number(params.LOG_CLEAN_FREQUENCY_DAYS) || 3;
    var lastCleanStr = PropertiesService.getScriptProperties().getProperty('LOG_LAST_CLEAN_DATE');
    if (lastCleanStr) {
      var lastCleanTime = new Date(lastCleanStr).getTime();
      if (!isNaN(lastCleanTime)) {
        var elapsedDays = (Date.now() - lastCleanTime) / 86400000;
        if (elapsedDays < freqDays) return; // Not due yet
      }
    }

    LOG.cleanLogs(params.LOG_ROWS_TO_KEEP, params.LOG_TIME_TO_KEEP_DAYS, false);
  } catch (e) {
    console.warn('autoCleanLogsIfDue_ error: ' + e.message);
  }
}

/* ==========================================================================================
   BACKWARD COMPATIBILITY ALIASES
   ========================================================================================== */

/**
 * Deprecated legacy import logging helper routed to LOG.write.
 */
function logImport_(date, fileId, outer, inner, status, notes) {
  var processName = outer || 'Ingestion';
  var msg = (status ? '[' + status + '] ' : '') + (inner || outer || 'File import');
  var info = (fileId ? 'FileID: ' + fileId + ' | ' : '') + (notes || '');
  LOG.write(processName, msg, info, date);
}

/**
 * Deprecated legacy batch import logging helper routed to LOG.writeBatch.
 */
function logImportBatch_(logs) {
  if (!logs || logs.length === 0) return;
  var entries = [];
  for (var i = 0; i < logs.length; i++) {
    var r = logs[i]; // [date, fileId, outer, inner, status, notes]
    var proc = r[2] || 'Bulk Ingestion';
    var msg = (r[4] ? '[' + r[4] + '] ' : '') + (r[3] || r[2] || 'Flight record');
    var info = (r[1] ? 'FileID: ' + r[1] + ' | ' : '') + (r[5] || '');
    entries.push([proc, r[0] || new Date(), msg, info]);
  }
  LOG.writeBatch(entries);
}
