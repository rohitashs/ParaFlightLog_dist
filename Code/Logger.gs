/**
 * Paragliding Flight Log v2.0
 * Updated: 2026-10-04 16:45:00
 * 
 * MODULE: System Logging & Telemetry Engine
 * 
 * @design Docs/Design/DSGN-LOG-002_Dual_Tier_Logging_and_Granular_Telemetry.md
 * @architecture Docs/Architecture/Cross_Cutting/Resilience_and_Evolution.md#3-activity-logging--audit-trail-dsgn-log-001
 * @pattern Docs/Patterns_and_Practices.md#pattern-24-dual-tier-logging--orchestrator-worker-telemetry-contract
 * @revision Rev 2.0
 * @status Implemented
 * 
 * Centralized logging service providing:
 * - 4-column System Log schema: Process | Timestamp | Activity / Event | Additional Info
 * - 6-tier granular log levels: Silent, Silent unless some activity, Exceptions, Summary, Normal, Debug
 * - Multi-tier cascading resolution (Caller Override -> Action Rule Parameter -> Category Config -> Default -> Normal)
 * - Atomic batch logging and session-scoped buffering with no-op suppression
 * - Conservative dual-threshold pruning on System Log tab
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
   * Resolves the controlling category for a given process key.
   * @param {string} key - Process key.
   * @return {string} Controlling category (HEARTBEAT, INGESTION, MAINTENANCE, ADMIN, INTEGRATIONS, AUTOMATION).
   */
  resolveCategory: function(key) {
    if (!key) return 'ADMIN';
    if (typeof CFG !== 'undefined' && CFG.LOG_CATEGORY_MAP && CFG.LOG_CATEGORY_MAP[key]) {
      return CFG.LOG_CATEGORY_MAP[key];
    }
    return String(key).toUpperCase();
  },

  /**
   * Retrieves the active log verbosity level via multi-tier cascade:
   * 1. Direct canonical log level passed by caller
   * 2. Controlling category parameter (LOG_LEVEL_<CATEGORY>)
   * 3. Global default parameter (LOG_LEVEL_DEFAULT)
   * 4. Legacy parameter fallback (LOG_LEVEL)
   * 5. Hard default ('Normal')
   * 
   * @param {string} [categoryOrProcess] - Process key, category, or direct level string.
   * @return {string} Configured log level.
   */
  getLogLevel: function(categoryOrProcess) {
    try {
      if (categoryOrProcess && typeof categoryOrProcess === 'string') {
        var direct = categoryOrProcess.trim();
        if (typeof CFG !== 'undefined' && CFG.LOG_LEVELS && CFG.LOG_LEVELS.indexOf(direct) > -1) {
          return direct;
        }
      }

      var params = (typeof getParameters_ === 'function') ? getParameters_() : {};

      if (categoryOrProcess) {
        var cat = this.resolveCategory(categoryOrProcess);
        var catParamKey = 'LOG_LEVEL_' + cat;
        if (params[catParamKey]) {
          return String(params[catParamKey]).trim();
        }
      }

      if (params.LOG_LEVEL_DEFAULT) {
        return String(params.LOG_LEVEL_DEFAULT).trim();
      }

      if (params.LOG_LEVEL) {
        return String(params.LOG_LEVEL).trim();
      }
    } catch (e) {
      console.warn('LOG.getLogLevel error: ' + e.message);
    }
    return 'Normal';
  },

  /**
   * Evaluates whether an individual activity message passes the specified log level filter.
   * - 'Silent': Suppresses all output.
   * - 'Silent unless some activity': Allowed during active execution; buffered session drops if 0 activity.
   * - 'Exceptions': Only records alerts ([ERR], [WARN], [FATAL]).
   * - 'Summary': Records lifecycle boundaries ([START], [COMPLETE], [STOP]), discovery ([DISCOVERY], [INFO]), and alerts.
   * - 'Normal': Records all lifecycle events and individual transactions ([OK], [DUPE], etc.). Suppresses [DEBUG].
   * - 'Debug': Records everything with maximum verbosity.
   * 
   * @param {string} message - Activity message string.
   * @param {string} logLevel - Active log level.
   * @return {boolean} True if the message passes the level filter.
   */
  shouldLog: function(message, logLevel) {
    // Defensively handle swapped arguments (logLevel, message) vs (message, logLevel)
    var isKnownLevel = function(val) {
      if (!val || typeof val !== 'string') return false;
      var trimmed = val.trim();
      if (trimmed === 'Brief') return true;
      return (typeof CFG !== 'undefined' && CFG.LOG_LEVELS && CFG.LOG_LEVELS.indexOf(trimmed) > -1);
    };

    if (isKnownLevel(message) && !isKnownLevel(logLevel)) {
      var tmp = message;
      message = logLevel;
      logLevel = tmp;
    }
    if (!message) return false;

    var lvl = logLevel || 'Normal';
    if (lvl === 'Brief') lvl = 'Summary'; // Legacy alias bridge
    var str = String(message);

    if (lvl === 'Silent') return false;
    if (lvl === 'Debug') return true;
    if (str.indexOf('[DEBUG]') > -1) return false;

    var isAlert = str.indexOf('[ERR]') > -1 || str.indexOf('[WARN]') > -1 || str.indexOf('[FATAL]') > -1;
    if (lvl === 'Exceptions') {
      return isAlert;
    }

    var isBoundaryOrDiscovery = str.indexOf('[START]') > -1 ||
                                str.indexOf('[COMPLETE]') > -1 ||
                                str.indexOf('[STOP]') > -1 ||
                                str.indexOf('[DISCOVERY]') > -1 ||
                                str.indexOf('[INFO]') > -1;

    if (lvl === 'Summary') {
      return isBoundaryOrDiscovery || isAlert;
    }

    if (lvl === 'Normal' || lvl === 'Silent unless some activity') {
      return true;
    }

    return true;
  },

  /**
   * Resolves the persistent System Log sheet with graceful migration fallbacks.
   * @param {Spreadsheet} [ss] - Optional spreadsheet reference.
   * @return {Sheet|null}
   */
  getSystemLogSheet: function(ss) {
    if (!ss) ss = SpreadsheetApp.getActive();
    if (!ss) return null;

    var targetName = (typeof TABS !== 'undefined' && TABS.SYSTEM_LOG) ? TABS.SYSTEM_LOG.name : 'System Log';
    var sh = ss.getSheetByName(targetName);
    if (!sh) sh = ss.getSheetByName('System Log');
    if (!sh) sh = ss.getSheetByName('Activity Logs'); // Migration bridge
    if (!sh) sh = ss.getSheetByName('App_Log');       // Legacy migration bridge
    return sh;
  },

  /**
   * Writes a single log entry to the System Log sheet.
   * @param {string} processKey - Process key or label.
   * @param {string} message - Core activity narrative.
   * @param {string} [additionalInfo] - Optional diagnostic details or error info.
   * @param {Date} [date] - Optional timestamp (defaults to now).
   */
  write: function(processKey, message, additionalInfo, date) {
    var logLevel = this.getLogLevel(processKey);
    if (!this.shouldLog(message, logLevel)) return;

    try {
      var sh = this.getSystemLogSheet();
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
   * Appends an array of log entries to the System Log sheet in a single atomic batch call.
   * @param {Array<Array>} entries - 2D array of [process, timestamp, message, info].
   * @param {string} [logLevelOrProcessKey] - Optional explicit log level or process key to resolve.
   */
  writeBatch: function(entries, logLevelOrProcessKey) {
    if (!entries || entries.length === 0) return;
    var resolvedLogLevel = this.getLogLevel(logLevelOrProcessKey);

    var filtered = [];
    for (var i = 0; i < entries.length; i++) {
      var row = entries[i];
      if (this.shouldLog(row[2], resolvedLogLevel)) {
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
      var sh = this.getSystemLogSheet();
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
   * Implements no-op suppression for 'Silent unless some activity' (DSGN-LOG-002).
   * 
   * @param {string} processKey - Process key or name.
   * @param {string} [logLevel] - Optional explicit log level override.
   * @return {Object} Session logger object.
   */
  createSession: function(processKey, logLevel) {
    var self = this;
    var proc = this.resolveProcess(processKey);
    var resolvedLogLevel = logLevel || this.getLogLevel(processKey);
    var buffer = [];
    var stats = { processed: 0, updated: 0, skipped: 0, errors: 0, message: '' };

    return {
      start: function(msg, info) {
        buffer.push([proc, new Date(), '[START] ' + (msg || 'Starting process...'), info || '']);
      },
      discovery: function(msg, info) {
        buffer.push([proc, new Date(), '[DISCOVERY] ' + (msg || ''), info || '']);
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
      recordStats: function(s) {
        if (!s) return;
        if (typeof s.processed === 'number') stats.processed += s.processed;
        if (typeof s.updated === 'number') stats.updated += s.updated;
        if (typeof s.skipped === 'number') stats.skipped += s.skipped;
        if (typeof s.errors === 'number') stats.errors += s.errors;
        if (s.message) stats.message = s.message;
      },
      getStats: function() {
        return stats;
      },
      getLogLevel: function() {
        return resolvedLogLevel;
      },
      flush: function() {
        if (buffer.length === 0) return;

        // 1. Silent: suppress all persistent writing
        if (resolvedLogLevel === 'Silent') {
          buffer = [];
          return;
        }

        // 2. Silent unless some activity: drop buffer completely if 0 items processed and 0 errors
        if (resolvedLogLevel === 'Silent unless some activity') {
          var hasActivity = (stats.processed > 0 || stats.updated > 0 || stats.errors > 0);
          if (!hasActivity) {
            buffer = [];
            return;
          }
        }

        self.writeBatch(buffer, resolvedLogLevel);
        buffer = [];
      }
    };
  },

  /**
   * Executes conservative dual-threshold pruning on the System Log sheet.
   * A historical row is ONLY pruned if it simultaneously exceeds the row threshold
   * AND is older than the time threshold.
   * 
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

      var sh = this.getSystemLogSheet();
      if (!sh) return { success: false, cleaned: 0, reason: 'System Log sheet not found' };

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
          // Maintain strict chronological order
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
 * Public Menu Callback for manual on-demand System Log cleaning.
 */
function cleanSystemLog() {
  var ui = SpreadsheetApp.getUi();
  var params = (typeof getParameters_ === 'function') ? getParameters_() : {};
  var rowsToKeep = params.LOG_ROWS_TO_KEEP || 2000;
  var daysToKeep = params.LOG_TIME_TO_KEEP_DAYS || 90;

  var promptMsg = 'This will prune log entries older than ' + daysToKeep + ' days if the System Log tab exceeds ' + rowsToKeep + ' rows.\n\nRecent logs and logs within ' + daysToKeep + ' days are always preserved.\n\nProceed?';
  var resp = ui.alert('Clean System Log Now', promptMsg, ui.ButtonSet.YES_NO);

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
 * Backward compatibility callback wrapper for cleanActivityLogs.
 */
function cleanActivityLogs() {
  return cleanSystemLog();
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
