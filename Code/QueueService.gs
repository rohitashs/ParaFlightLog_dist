/**
 * Paragliding Flight Log v2.0
 * Updated: 2026-10-02 19:33:18
 */
/**
 * Paragliding Flight Log - Persistent Job Queue Service
 * Implementation of DSGN-UI-001 Section 3.3
 * 
 * Manages persistent job states, batch cursors, and progress tracking in the
 * 'Automation_Queue' sheet tab. Provides the execution substrate for both
 * user-initiated background tasks and the Table-Driven Automation Engine (DSGN-AUT-001).
 */

var QueueService = {
  STATUS: {
    QUEUED: 'QUEUED',
    RUNNING: 'RUNNING',
    CHECKPOINT_PAUSED: 'CHECKPOINT_PAUSED',
    COMPLETED: 'COMPLETED',
    CANCELLED: 'CANCELLED',
    FAILED: 'FAILED'
  },

  /**
   * Lazily retrieves or auto-scaffolds the Automation_Queue sheet tab.
   * @param {GoogleAppsScript.Spreadsheet.Spreadsheet} [ss] Optional active spreadsheet instance.
   * @return {GoogleAppsScript.Spreadsheet.Sheet}
   */
  getQueueSheet: function(ss) {
    var targetSs = ss || SpreadsheetApp.getActive();
    var sheetName = (typeof CFG !== 'undefined' && CFG.sheets && CFG.sheets.queue) ? CFG.sheets.queue : 'Automation_Queue';
    var sh = targetSs.getSheetByName(sheetName);
    if (!sh) {
      if (typeof scaffoldQueue_ === 'function') {
        scaffoldQueue_(targetSs);
        sh = targetSs.getSheetByName(sheetName);
      } else {
        sh = targetSs.insertSheet(sheetName);
      }
    }
    return sh;
  },

  /**
   * Enqueues a new asynchronous job into the Automation_Queue tab.
   * @param {string} jobType E.g. 'BULK_INGEST', 'PURGE', 'RESYNC', 'MAINTENANCE', 'LOG_CLEANUP'
   * @param {string} title Human-readable task title
   * @param {string} contextText Context details (e.g. folder path, selection scope)
   * @param {number} totalItems Total number of items/files/rows targeted
   * @param {Array} queueItems Array of raw items (e.g. file objects with id/name, or row targets)
   * @param {number} batchSize Number of items to process per step/batch
   * @param {Object} options Configurable options and toggles
   * @return {Object} { success: boolean, jobId: string }
   */
  enqueue: function(jobType, title, contextText, totalItems, queueItems, batchSize, options) {
    var sh = QueueService.getQueueSheet();
    var now = new Date();
    var timestampStr = Utilities.formatDate(now, 'UTC', 'yyyyMMdd_HHmmss');
    var randomSuffix = ('000' + Math.floor(Math.random() * 1000)).slice(-3);
    var jobId = 'JOB_' + timestampStr + '_' + randomSuffix;

    // Sanitize queue items: store only necessary fields (id, name) to conserve cell memory
    var sanitizedItems = (queueItems || []).map(function(item) {
      if (typeof item === 'object' && item !== null) {
        return { id: item.id || '', name: item.name || '', row: item.row || 0 };
      }
      return item;
    });

    var payload = {
      jobId: jobId,
      jobType: jobType,
      title: title || jobType,
      contextText: contextText || '',
      totalItems: totalItems || sanitizedItems.length,
      queue: sanitizedItems,
      cursorIndex: 0,
      batchSize: batchSize || 5,
      options: options || {},
      stats: {
        processed: 0,
        duplicates: 0,
        errors: 0
      }
    };

    var progressStr = '0 / ' + payload.totalItems + ' (0%)';
    var rowData = [
      jobId,
      jobType,
      QueueService.STATUS.QUEUED,
      progressStr,
      now,
      now,
      JSON.stringify(payload),
      ''
    ];

    sh.appendRow(rowData);
    SpreadsheetApp.flush();

    return {
      success: true,
      jobId: jobId,
      payload: payload
    };
  },

  /**
   * Finds the 1-based row index for a given Job ID.
   * @param {string} jobId
   * @param {GoogleAppsScript.Spreadsheet.Sheet} [sh]
   * @return {number} Row index (1-based), or -1 if not found.
   */
  findJobRow: function(jobId, sh) {
    var targetSh = sh || QueueService.getQueueSheet();
    var lastRow = targetSh.getLastRow();
    if (lastRow < 2) return -1;

    var jobIds = targetSh.getRange(2, 1, lastRow - 1, 1).getValues();
    for (var i = 0; i < jobIds.length; i++) {
      if (jobIds[i][0] === jobId) {
        return i + 2;
      }
    }
    return -1;
  },

  /**
   * Retrieves and deserializes the full state of a job.
   * @param {string} jobId
   * @return {Object|null}
   */
  getJob: function(jobId) {
    var sh = QueueService.getQueueSheet();
    var row = QueueService.findJobRow(jobId, sh);
    if (row === -1) return null;

    var rowValues = sh.getRange(row, 1, 1, 8).getValues()[0];
    var parsedPayload = {};
    try {
      parsedPayload = JSON.parse(rowValues[6] || '{}');
    } catch (e) {
      parsedPayload = {};
    }

    return {
      row: row,
      jobId: rowValues[0],
      jobType: rowValues[1],
      status: rowValues[2],
      progress: rowValues[3],
      startedAt: rowValues[4],
      updatedAt: rowValues[5],
      payload: parsedPayload,
      lastError: rowValues[7]
    };
  },

  /**
   * Updates job status to RUNNING.
   * @param {string} jobId
   */
  markRunning: function(jobId) {
    var sh = QueueService.getQueueSheet();
    var row = QueueService.findJobRow(jobId, sh);
    if (row === -1) return false;

    sh.getRange(row, 3).setValue(QueueService.STATUS.RUNNING);
    sh.getRange(row, 6).setValue(new Date());
    return true;
  },

  /**
   * Updates job progress and statistics.
   * @param {string} jobId
   * @param {number} processedCount
   * @param {number} totalItems
   * @param {Object} [stats] Optional updated metrics { duplicates, errors }
   * @param {Object} [payload] Optional updated payload to serialize
   */
  updateProgress: function(jobId, processedCount, totalItems, stats, payload) {
    var sh = QueueService.getQueueSheet();
    var row = QueueService.findJobRow(jobId, sh);
    if (row === -1) return false;

    var pct = (totalItems > 0) ? Math.round((processedCount / totalItems) * 100) : 0;
    var progressStr = processedCount + ' / ' + totalItems + ' (' + pct + '%)';

    sh.getRange(row, 4).setValue(progressStr);
    sh.getRange(row, 6).setValue(new Date());

    if (payload) {
      payload.stats = payload.stats || {};
      if (stats) {
        if (typeof stats.importedCount === 'number') payload.stats.imported = stats.importedCount;
        if (typeof stats.duplicateCount === 'number') payload.stats.duplicates = stats.duplicateCount;
        if (typeof stats.errorCount === 'number') payload.stats.errors = stats.errorCount;
        if (typeof stats.processedCount === 'number') payload.stats.processedCount = stats.processedCount;
      }
      payload.stats.processed = processedCount;
      sh.getRange(row, 7).setValue(JSON.stringify(payload));
    }
    SpreadsheetApp.flush();

    return true;
  },

  /**
   * Checkpoints a job when the 4.5-minute time budget is reached.
   * Updates state to CHECKPOINT_PAUSED and saves remaining cursor.
   * @param {string} jobId
   * @param {number} cursorIndex
   * @param {Object} payload
   */
  checkpoint: function(jobId, cursorIndex, payload) {
    var sh = QueueService.getQueueSheet();
    var row = QueueService.findJobRow(jobId, sh);
    if (row === -1) return false;

    payload.cursorIndex = cursorIndex;
    var total = payload.totalItems || 0;
    var processed = Math.max(cursorIndex, (payload.stats && typeof payload.stats.processed === 'number') ? payload.stats.processed : 0);
    var pct = (total > 0) ? Math.round((processed / total) * 100) : 0;
    var progressStr = processed + ' / ' + total + ' (' + pct + '%)';

    sh.getRange(row, 3).setValue(QueueService.STATUS.CHECKPOINT_PAUSED);
    sh.getRange(row, 4).setValue(progressStr);
    sh.getRange(row, 6).setValue(new Date());
    sh.getRange(row, 7).setValue(JSON.stringify(payload));
    SpreadsheetApp.flush();

    return true;
  },

  /**
   * Marks a job as successfully COMPLETED.
   * @param {string} jobId
   * @param {Object} [payload]
   */
  complete: function(jobId, payload) {
    var sh = QueueService.getQueueSheet();
    var row = QueueService.findJobRow(jobId, sh);
    if (row === -1) return false;

    var total = payload ? payload.totalItems : 0;
    var progressStr = (total > 0) ? (total + ' / ' + total + ' (100%)') : 'Done (100%)';

    sh.getRange(row, 3).setValue(QueueService.STATUS.COMPLETED);
    sh.getRange(row, 4).setValue(progressStr);
    sh.getRange(row, 6).setValue(new Date());
    if (payload) {
      sh.getRange(row, 7).setValue(JSON.stringify(payload));
    }
    SpreadsheetApp.flush();

    return true;
  },

  /**
   * Marks a job as FAILED with an error message.
   * @param {string} jobId
   * @param {string} errorMsg
   */
  fail: function(jobId, errorMsg) {
    var sh = QueueService.getQueueSheet();
    var row = QueueService.findJobRow(jobId, sh);
    if (row === -1) return false;

    sh.getRange(row, 3).setValue(QueueService.STATUS.FAILED);
    sh.getRange(row, 6).setValue(new Date());
    sh.getRange(row, 8).setValue(String(errorMsg || 'Unknown error'));
    SpreadsheetApp.flush();

    return true;
  },

  /**
   * Cancels a job.
   * @param {string} jobId
   */
  cancel: function(jobId) {
    var sh = QueueService.getQueueSheet();
    var row = QueueService.findJobRow(jobId, sh);
    if (row === -1) return false;

    sh.getRange(row, 3).setValue(QueueService.STATUS.CANCELLED);
    sh.getRange(row, 6).setValue(new Date());
    SpreadsheetApp.flush();

    return true;
  },

  /**
   * Checks whether the user has set the job status to CANCELLED in the sheet.
   * Enables instant human-in-the-loop cancellation.
   * @param {string} jobId
   * @return {boolean}
   */
  isCancelled: function(jobId) {
    var sh = QueueService.getQueueSheet();
    var row = QueueService.findJobRow(jobId, sh);
    if (row === -1) return true; // If removed from sheet, treat as cancelled

    var status = sh.getRange(row, 3).getValue();
    return String(status).toUpperCase() === QueueService.STATUS.CANCELLED;
  },

  /**
   * Retrieves the next active job waiting to be processed (QUEUED or CHECKPOINT_PAUSED).
   * @return {Object|null}
   */
  getNextActiveJob: function() {
    var sh = QueueService.getQueueSheet();
    var lastRow = sh.getLastRow();
    if (lastRow < 2) return null;

    var data = sh.getRange(2, 1, lastRow - 1, 8).getValues();
    for (var i = 0; i < data.length; i++) {
      var status = String(data[i][2]).toUpperCase();
      if (status === QueueService.STATUS.QUEUED || status === QueueService.STATUS.CHECKPOINT_PAUSED) {
        var parsedPayload = {};
        try {
          parsedPayload = JSON.parse(data[i][6] || '{}');
        } catch (e) {
          parsedPayload = {};
        }

        return {
          row: i + 2,
          jobId: data[i][0],
          jobType: data[i][1],
          status: status,
          progress: data[i][3],
          startedAt: data[i][4],
          updatedAt: data[i][5],
          payload: parsedPayload,
          lastError: data[i][7]
        };
      }
    }
    return null;
  }
};
