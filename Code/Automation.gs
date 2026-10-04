/**
 * Paragliding Flight Log v2.0
 * Updated: 2026-10-04 09:43:52
 * 
 * MODULE: Table-Driven Automation Engine
 * 
 * Contains:
 * 1. Parameter Parsing & Serialization (with schema fallback)
 * 2. Condition Evaluation & Due Interval Checking
 * 3. Master Heartbeat Pulse Dispatcher (masterHeartbeatDispatcher)
 * 4. Action Handlers (Dual-Context Invariant: headless safe, LOG telemetry)
 * 5. Event Dispatcher (emitAutomationEvent)
 * 6. RPC Gateways for Rule Builder Modal Dialog
 * 
 * @design Docs/Design/DSGN-AUT-001_Table_Driven_Automation_Engine.md
 * @architecture Docs/Architecture/Views/02_Execution_and_Runtime.md
 * @pattern Docs/Patterns_and_Practices.md#pattern-21-subsystem-domain-decoupling-domain-configuration-vs-domain-engine
 * @pattern Docs/Patterns_and_Practices.md#pattern-22-dual-context-execution-invariant-interactive-ui-vs-headless-trigger
 * @pattern Docs/Patterns_and_Practices.md#pattern-23-progressive-feature-flagging-in-component-registries-actionavailable
 */

/* ==========================================================================================
   1. PARAMETER PARSER & SERIALIZER
   ========================================================================================== */

/**
 * Parses semicolon-delimited parameter string (e.g. "KeepRows=2000; KeepDays=90")
 * into a typed JavaScript object. Backfills schema defaults for any unspecified keys.
 * 
 * @param {string} paramStr
 * @param {Object} actionDef - Action definition from AUTOMATION_REGISTRY
 * @return {Object} Key-value map of parsed parameters
 */
function parseAutomationParams_(paramStr, actionDef) {
  var params = {};
  var schema = (actionDef && actionDef.parametersSchema) ? actionDef.parametersSchema : {};

  // 1. Parse explicit string tokens if provided
  if (paramStr && typeof paramStr === 'string') {
    var pairs = paramStr.split(';');
    for (var i = 0; i < pairs.length; i++) {
      var pair = pairs[i].trim();
      if (!pair) continue;

      var delimIdx = pair.indexOf('=');
      if (delimIdx === -1) delimIdx = pair.indexOf(':');
      if (delimIdx === -1) continue;

      var key = pair.slice(0, delimIdx).trim();
      var rawVal = pair.slice(delimIdx + 1).trim();
      var paramDef = schema[key];

      if (paramDef) {
        var vType = String(paramDef.valueType || '').toLowerCase();
        if (vType === 'boolean') {
          var lower = rawVal.toLowerCase();
          params[key] = (lower === 'yes' || lower === 'true' || lower === 'y' || lower === '1');
        } else if (vType === 'number') {
          var num = Number(rawVal);
          params[key] = isNaN(num) ? paramDef.defaultValue : num;
        } else if (vType === 'multi' || paramDef.valueInput === 'Multi') {
          params[key] = rawVal.split(',').map(function(s) { return s.trim(); }).filter(Boolean);
        } else {
          params[key] = rawVal;
        }
      } else {
        // Untyped key fallback: auto-detect boolean / number / string
        var lowerVal = rawVal.toLowerCase();
        if (lowerVal === 'true' || lowerVal === 'yes') {
          params[key] = true;
        } else if (lowerVal === 'false' || lowerVal === 'no') {
          params[key] = false;
        } else if (!isNaN(Number(rawVal)) && rawVal !== '') {
          params[key] = Number(rawVal);
        } else {
          params[key] = rawVal;
        }
      }
    }
  }

  // 2. Backfill missing schema defaults (Pattern 21 & DSGN-AUT-001)
  for (var schemaKey in schema) {
    if (params[schemaKey] === undefined || params[schemaKey] === null) {
      params[schemaKey] = schema[schemaKey].defaultValue;
    }
  }

  return params;
}

/**
 * Serializes a parameter dictionary into a canonical semicolon-delimited string.
 * @param {Object} paramObj
 * @return {string} E.g. "MoveToTrash=Yes; MaxFiles=20"
 */
function serializeAutomationParams_(paramObj) {
  if (!paramObj || typeof paramObj !== 'object') return '';
  var parts = [];

  for (var key in paramObj) {
    if (!paramObj.hasOwnProperty(key)) continue;
    var val = paramObj[key];
    var valStr = '';

    if (typeof val === 'boolean') {
      valStr = val ? 'Yes' : 'No';
    } else if (Array.isArray(val)) {
      valStr = val.join(', ');
    } else if (val !== null && val !== undefined) {
      valStr = String(val);
    }
    parts.push(key + '=' + valStr);
  }

  return parts.join('; ');
}

/* ==========================================================================================
   2. CONDITION EVALUATION & DUE CHECK
   ========================================================================================== */

/**
 * Evaluates an optional condition expression against runtime context.
 * Safe relational evaluation without eval().
 * 
 * @param {string} conditionText - E.g. "FILE_COUNT > 0" or blank (unconditional)
 * @param {string} actionKey
 * @param {Object} [context]
 * @return {{ met: boolean, reason: string }}
 */
function evaluateCondition_(conditionText, actionKey, context) {
  if (!conditionText || !String(conditionText).trim()) {
    return { met: true, reason: 'Unconditional' };
  }

  var cond = String(conditionText).trim();
  context = context || {};

  // Relational expression pattern: VARIABLE OPERATOR VALUE
  var match = cond.match(/^([A-Z0-9_]+)\s*(>=|<=|==|!=|>|<|=)\s*(.+)$/i);
  if (!match) {
    return { met: true, reason: 'Unrecognized condition format: ' + cond };
  }

  var varName = match[1].toUpperCase();
  var op = match[2];
  if (op === '=') op = '==';
  var targetRaw = match[3].trim();

  // Dynamically resolve variable if not in context
  var actualVal = context[varName];
  if (actualVal === undefined) {
    if (varName === 'QUEUE_SIZE' || varName === 'PENDING_JOBS') {
      try {
        var qSh = (typeof QueueService !== 'undefined') ? QueueService.getQueueSheet() : null;
        actualVal = qSh ? Math.max(0, qSh.getLastRow() - 1) : 0;
      } catch (e) { actualVal = 0; }
    } else if (varName === 'LOG_ROWS' || varName === 'ROW_COUNT') {
      try {
        var ss = SpreadsheetApp.getActive();
        var actSh = ss.getSheetByName(TABS.ACTIVITY.name);
        actualVal = actSh ? Math.max(0, actSh.getLastRow() - 2) : 0;
      } catch (e) { actualVal = 0; }
    } else {
      actualVal = 0;
    }
  }

  var targetVal = isNaN(Number(targetRaw)) ? targetRaw : Number(targetRaw);
  var met = false;

  switch (op) {
    case '>':  met = (actualVal > targetVal); break;
    case '>=': met = (actualVal >= targetVal); break;
    case '<':  met = (actualVal < targetVal); break;
    case '<=': met = (actualVal <= targetVal); break;
    case '==': met = (String(actualVal).toLowerCase() === String(targetVal).toLowerCase()); break;
    case '!=': met = (String(actualVal).toLowerCase() !== String(targetVal).toLowerCase()); break;
    default:   met = true;
  }

  return {
    met: met,
    reason: varName + ' (' + actualVal + ') ' + op + ' ' + targetVal
  };
}

/**
 * Checks whether an automation rule is due for execution.
 * 
 * @param {Object} rule - Rule record from Automation_Rules sheet
 * @param {Date} now - Current timestamp
 * @return {boolean}
 */
function isRuleDue_(rule, now) {
  if (!rule || !rule.active) return false;
  var activeStr = String(rule.active).trim().toLowerCase();
  if (activeStr !== 'yes' && activeStr !== 'true') return false;

  var tType = String(rule.triggerType || '').toUpperCase();

  // Event and Manual triggers are never executed via heartbeat pulse
  if (tType.indexOf('EVENT') !== -1 || tType.indexOf('MANUAL') !== -1) {
    return false;
  }

  var intervalMs = 0;

  if (tType.indexOf('MIN') !== -1) {
    var rawMins = extractNumericConfig_(rule.triggerConfig, 15);
    var mins = Math.max(5, rawMins); // Minimum 5 minutes
    intervalMs = mins * 60 * 1000;
  } else if (tType.indexOf('DAY') !== -1) {
    var rawDays = extractNumericConfig_(rule.triggerConfig, 1);
    var days = Math.max(1, rawDays); // Minimum 1 day
    intervalMs = days * 86400 * 1000;
  } else {
    return false;
  }

  if (!rule.lastRun) return true;

  var lastRunDate = (rule.lastRun instanceof Date) ? rule.lastRun : new Date(rule.lastRun);
  if (isNaN(lastRunDate.getTime())) return true;

  return (now.getTime() - lastRunDate.getTime()) >= intervalMs;
}

/**
 * Helper to safely extract numeric trigger interval from raw config.
 */
function extractNumericConfig_(configVal, defaultVal) {
  if (typeof configVal === 'number' && !isNaN(configVal)) return configVal;
  if (!configVal) return defaultVal;

  var str = String(configVal);
  var match = str.match(/\d+/);
  return match ? Number(match[0]) : defaultVal;
}

/* ==========================================================================================
   3. MASTER HEARTBEAT DISPATCHER (Pattern 22: Dual-Context Execution Invariant)
   ========================================================================================== */

/**
 * Single project-level timer trigger entry point.
 * Sweeps the Automation_Rules tab, evaluates intervals, and executes due rules under the 4.5m budget.
 * NEVER calls getUi() (Dual-Context Invariant).
 */
function masterHeartbeatDispatcher() {
  // 1. Guard: Check Master Heartbeat Enable Switch in Config
  var params = (typeof getParameters_ === 'function') ? getParameters_() : {};
  var heartbeatEnabled = String(params.HEARTBEAT_ENABLED || 'Yes').trim().toLowerCase();
  if (heartbeatEnabled !== 'yes' && heartbeatEnabled !== 'true') {
    console.log('masterHeartbeatDispatcher: HEARTBEAT_ENABLED is disabled in Config. Skipping pulse.');
    return;
  }

  // 2. Concurrency Lock (10s timeout)
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) {
    console.warn('masterHeartbeatDispatcher: Lock contention, another instance is running. Skipping pulse.');
    return;
  }

  try {
    var ss = SpreadsheetApp.getActive();
    var tabName = (typeof TABS !== 'undefined' && TABS.AUTOMATION_RULES) ? TABS.AUTOMATION_RULES.name : 'Automation_Rules';
    var sh = ss ? ss.getSheetByName(tabName) : null;
    if (!sh) {
      console.warn('masterHeartbeatDispatcher: Automation_Rules tab not found.');
      return;
    }

    var lastRow = sh.getLastRow();
    if (lastRow < 3) return; // No rules configured

    var budget = (typeof TimeBudgetService !== 'undefined') ? TimeBudgetService.create(270000) : null;
    var now = new Date();
    var timeZone = Session.getScriptTimeZone() || 'UTC';
    var nowStr = Utilities.formatDate(now, timeZone, 'yyyy-MM-dd HH:mm:ss');

    var data = sh.getRange(3, 1, lastRow - 2, 9).getValues();

    for (var i = 0; i < data.length; i++) {
      if (budget && (!budget.hasTimeRemaining(30000) || budget.isExhausted())) {
        LOG.write(CFG.LOG_PROCESSES.AUTOMATION, '[WARN] Execution ceiling reached (4.5 min). Pausing pulse until next heartbeat.');
        break;
      }

      var rowNum = i + 3;
      var row = data[i];
      var rule = {
        row: rowNum,
        active: row[0],
        name: String(row[1] || '').trim(),
        action: String(row[2] || '').trim(),
        triggerType: String(row[3] || '').trim(),
        triggerConfig: row[4],
        condition: String(row[5] || '').trim(),
        parameters: String(row[6] || '').trim(),
        lastRun: row[7],
        lastResult: row[8]
      };

      if (!rule.name || !rule.action) continue;

      if (!isRuleDue_(rule, now)) continue;

      var actionDef = AUTOMATION_REGISTRY.getAction(rule.action);
      if (!actionDef) {
        sh.getRange(rowNum, 9).setValue('Error: Unknown action ' + rule.action);
        continue;
      }

      var condResult = evaluateCondition_(rule.condition, rule.action, {});
      if (!condResult.met) {
        sh.getRange(rowNum, 9).setValue('Condition not met: ' + condResult.reason);
        continue;
      }

      var parsedParams = parseAutomationParams_(rule.parameters, actionDef);
      LOG.write(CFG.LOG_PROCESSES.AUTOMATION, '[START] Rule: ' + rule.name, 'Action: ' + rule.action + ' | Interval: ' + rule.triggerType);

      var resultMsg = '';
      try {
        if (rule.action === 'SCAN_WATCH_FOLDER') {
          resultMsg = executeWatchFolderScan_(rule, parsedParams, budget);
        } else if (rule.action === 'CLEAN_LOGS') {
          resultMsg = executeCleanLogs_(rule, parsedParams, budget);
        } else if (rule.action === 'PROCESS_QUEUE') {
          resultMsg = executeProcessQueue_(rule, parsedParams, budget);
        } else if (actionDef.handlerName && typeof this[actionDef.handlerName] === 'function') {
          resultMsg = this[actionDef.handlerName](rule, parsedParams, budget);
        } else {
          resultMsg = 'Warning: No handler found for ' + rule.action;
        }
      } catch (err) {
        resultMsg = 'Error: ' + err.message;
        LOG.write(CFG.LOG_PROCESSES.AUTOMATION, '[ERR] ' + rule.name + ' failed: ' + err.message, err.stack);
      }

      sh.getRange(rowNum, 8).setValue(nowStr);
      sh.getRange(rowNum, 9).setValue(resultMsg);
      LOG.write(CFG.LOG_PROCESSES.AUTOMATION, '[COMPLETE] Rule: ' + rule.name, resultMsg);
    }

    SpreadsheetApp.flush();
  } catch (e) {
    LOG.write(CFG.LOG_PROCESSES.HEARTBEAT, '[FATAL] Heartbeat pulse crashed: ' + e.message, e.stack);
  } finally {
    lock.releaseLock();
  }
}

/* ==========================================================================================
   4. ACTION HANDLERS (Dual-Context Invariant: headless safe, LOG telemetry)
   ========================================================================================== */

/**
 * Handler for SCAN_WATCH_FOLDER.
 */
function executeWatchFolderScan_(rule, params, budget) {
  if (typeof scanWatchFolderNow_ !== 'function') {
    return 'Error: scanWatchFolderNow_ not found';
  }

  var options = {
    force: true,
    maxFiles: params.MaxFiles || 20,
    moveToTrash: (params.MoveToTrash === true || params.MoveToTrash === 'Yes')
  };

  var stats = scanWatchFolderNow_(options);
  if (!stats) return 'Completed (No stats returned)';
  if (stats.errors > 0) {
    return 'Partial: ' + stats.processed + ' processed, ' + stats.skipped + ' skipped, ' + stats.errors + ' errors';
  }
  return 'Success: ' + stats.processed + ' processed, ' + stats.skipped + ' skipped (' + (stats.flights || 0) + ' flights)';
}

/**
 * Handler for CLEAN_LOGS.
 */
function executeCleanLogs_(rule, params, budget) {
  var keepRows = Number(params.KeepRows) || 2000;
  var keepDays = Number(params.KeepDays) || 90;

  var res = LOG.cleanLogs(keepRows, keepDays, true);
  if (!res || !res.success) {
    return 'Error: ' + (res ? res.reason : 'Clean logs failed');
  }
  if (res.cleaned > 0) {
    return 'Success: ' + res.cleaned + ' rows pruned (' + res.preserved + ' retained)';
  }
  return 'OK: ' + (res.reason || 'Within limits');
}

/**
 * Handler for PROCESS_QUEUE.
 */
function executeProcessQueue_(rule, params, budget) {
  if (typeof QueueService === 'undefined') {
    return 'Error: QueueService not available';
  }

  var job = QueueService.getNextActiveJob();
  if (!job) {
    return 'Idle: Queue empty';
  }

  if (typeof processBackgroundQueue === 'function') {
    processBackgroundQueue();
    return 'Success: Processed job ' + job.jobId + ' (' + job.jobType + ')';
  }

  return 'Error: processBackgroundQueue runner not found';
}

/* ==========================================================================================
   5. LIFECYCLE EVENT DISPATCHER
   ========================================================================================== */

/**
 * Emits a lifecycle event to trigger any matching EVENT_DRIVEN automation rules.
 * 
 * @param {string} eventName - E.g. 'INGESTION_COMPLETED', 'FLIGHT_PURGED'
 * @param {Object} [payload] - Event context data
 */
function emitAutomationEvent(eventName, payload) {
  try {
    var ss = SpreadsheetApp.getActive();
    var tabName = (typeof TABS !== 'undefined' && TABS.AUTOMATION_RULES) ? TABS.AUTOMATION_RULES.name : 'Automation_Rules';
    var sh = ss ? ss.getSheetByName(tabName) : null;
    if (!sh) return;

    var lastRow = sh.getLastRow();
    if (lastRow < 3) return;

    var data = sh.getRange(3, 1, lastRow - 2, 9).getValues();
    var now = new Date();
    var timeZone = Session.getScriptTimeZone() || 'UTC';
    var nowStr = Utilities.formatDate(now, timeZone, 'yyyy-MM-dd HH:mm:ss');

    for (var i = 0; i < data.length; i++) {
      var rowNum = i + 3;
      var row = data[i];
      var active = String(row[0]).trim().toLowerCase();
      if (active !== 'yes' && active !== 'true') continue;

      var triggerType = String(row[3]).trim().toUpperCase();
      if (triggerType.indexOf('EVENT') === -1) continue;

      var triggerConfig = String(row[4]).trim();
      if (triggerConfig !== eventName && triggerConfig !== 'ALL') continue;

      var rule = {
        row: rowNum,
        name: String(row[1]).trim(),
        action: String(row[2]).trim(),
        condition: String(row[5] || '').trim(),
        parameters: String(row[6] || '').trim()
      };

      var actionDef = AUTOMATION_REGISTRY.getAction(rule.action);
      if (!actionDef) continue;

      var condResult = evaluateCondition_(rule.condition, rule.action, payload || {});
      if (!condResult.met) continue;

      var parsedParams = parseAutomationParams_(rule.parameters, actionDef);
      LOG.write(CFG.LOG_PROCESSES.AUTOMATION, '[EVENT: ' + eventName + '] Triggered Rule: ' + rule.name);

      var resultMsg = '';
      try {
        if (rule.action === 'SCAN_WATCH_FOLDER') {
          resultMsg = executeWatchFolderScan_(rule, parsedParams, null);
        } else if (rule.action === 'CLEAN_LOGS') {
          resultMsg = executeCleanLogs_(rule, parsedParams, null);
        } else if (rule.action === 'PROCESS_QUEUE') {
          resultMsg = executeProcessQueue_(rule, parsedParams, null);
        } else if (actionDef.handlerName && typeof this[actionDef.handlerName] === 'function') {
          resultMsg = this[actionDef.handlerName](rule, parsedParams, null);
        }
      } catch (err) {
        resultMsg = 'Event Error: ' + err.message;
      }

      sh.getRange(rowNum, 8).setValue(nowStr);
      sh.getRange(rowNum, 9).setValue(resultMsg);
      LOG.write(CFG.LOG_PROCESSES.AUTOMATION, '[EVENT: ' + eventName + '] Finished: ' + rule.name, resultMsg);
    }
  } catch (e) {
    console.warn('emitAutomationEvent error:', e);
  }
}

/* ==========================================================================================
   6. RPC GATEWAYS FOR RULE BUILDER MODAL DIALOG
   ========================================================================================== */

/**
 * Returns metadata and currently selected rule data for the Rule Builder modal dialog.
 * @param {number} [selectedRowIndex] - Optional 1-based row index in Automation_Rules sheet.
 * @return {Object} Dialog initial data payload
 */
function getAutomationDialogData(selectedRowIndex) {
  var ruleData = null;
  var ss = SpreadsheetApp.getActive();
  var tabName = (typeof TABS !== 'undefined' && TABS.AUTOMATION_RULES) ? TABS.AUTOMATION_RULES.name : 'Automation_Rules';
  var sh = ss ? ss.getSheetByName(tabName) : null;

  if (sh && selectedRowIndex && selectedRowIndex >= 3 && selectedRowIndex <= sh.getLastRow()) {
    var row = sh.getRange(selectedRowIndex, 1, 1, 9).getValues()[0];
    ruleData = {
      rowIndex: selectedRowIndex,
      active: String(row[0]).trim().toLowerCase() === 'yes',
      name: String(row[1] || ''),
      action: String(row[2] || ''),
      triggerType: String(row[3] || 'Time (Minutes)'),
      triggerConfig: row[4],
      condition: String(row[5] || ''),
      parameters: String(row[6] || ''),
      lastRun: row[7],
      lastResult: row[8]
    };
  }

  return {
    success: true,
    actions: AUTOMATION_REGISTRY.getAvailableActions(),
    triggers: AUTOMATION_REGISTRY.triggers,
    events: AUTOMATION_REGISTRY.events,
    templates: AUTOMATION_REGISTRY.getTemplates(),
    rule: ruleData
  };
}

/**
 * Validates an automation rule before saving.
 * @param {Object} ruleData
 * @return {{ valid: boolean, errors: Array<string> }}
 */
function validateAutomationRule(ruleData) {
  var errors = [];
  if (!ruleData) return { valid: false, errors: ['No rule data provided.'] };

  if (!ruleData.name || !String(ruleData.name).trim()) {
    errors.push('Rule Name is required.');
  }

  if (!ruleData.action) {
    errors.push('Action must be selected.');
  } else {
    var actionDef = AUTOMATION_REGISTRY.getAction(ruleData.action);
    if (!actionDef) {
      errors.push('Action "' + ruleData.action + '" does not exist.');
    } else if (actionDef.actionAvailable === false) {
      errors.push('Action "' + ruleData.action + '" is currently not available for configuration.');
    }
  }

  if (!ruleData.triggerType) {
    errors.push('Trigger Type must be selected.');
  }

  return {
    valid: errors.length === 0,
    errors: errors
  };
}

/**
 * Saves a rule (creates new or updates existing) in the Automation_Rules tab.
 * @param {Object} ruleData
 * @param {number} [targetRowIndex]
 * @return {Object}
 */
function saveAutomationRule(ruleData, targetRowIndex) {
  var valResult = validateAutomationRule(ruleData);
  if (!valResult.valid) {
    return { success: false, errors: valResult.errors };
  }

  var ss = SpreadsheetApp.getActive();
  var tabName = (typeof TABS !== 'undefined' && TABS.AUTOMATION_RULES) ? TABS.AUTOMATION_RULES.name : 'Automation_Rules';
  var sh = ss.getSheetByName(tabName);
  if (!sh) {
    scaffoldAutomation_(ss);
    sh = ss.getSheetByName(tabName);
  }

  var activeVal = ruleData.active ? 'Yes' : 'No';
  var paramStr = (typeof ruleData.parameters === 'object') ? serializeAutomationParams_(ruleData.parameters) : String(ruleData.parameters || '');

  var rowValues = [
    activeVal,
    ruleData.name.trim(),
    ruleData.action,
    ruleData.triggerType,
    ruleData.triggerConfig || '',
    ruleData.condition || '',
    paramStr,
    '',
    'Ready'
  ];

  var rowToWrite = targetRowIndex;
  if (!rowToWrite || rowToWrite < 3) {
    // Find first row where Automation Name (Col B) is blank
    var lastRow = sh.getLastRow();
    var foundBlank = false;
    if (lastRow >= 3) {
      var names = sh.getRange(3, 2, lastRow - 2, 1).getValues();
      for (var i = 0; i < names.length; i++) {
        if (!names[i][0] || !String(names[i][0]).trim()) {
          rowToWrite = i + 3;
          foundBlank = true;
          break;
        }
      }
    }
    if (!foundBlank) {
      rowToWrite = Math.max(3, lastRow + 1);
    }
  } else {
    // Preserve existing Last Run and Last Result if updating
    var existingMeta = sh.getRange(rowToWrite, 8, 1, 2).getValues()[0];
    rowValues[7] = existingMeta[0] || '';
    rowValues[8] = existingMeta[1] || 'Updated';
  }

  sh.getRange(rowToWrite, 1, 1, 9).setValues([rowValues]);
  SpreadsheetApp.flush();

  return {
    success: true,
    rowIndex: rowToWrite,
    message: 'Rule saved successfully.'
  };
}

/**
 * Manually executes a single rule immediately from the Automation_Rules tab.
 * @param {number} rowIndex - 1-based row index in Automation_Rules sheet.
 * @return {Object} { success: boolean, result: string }
 */
function executeRuleNow(rowIndex) {
  var ss = SpreadsheetApp.getActive();
  var tabName = (typeof TABS !== 'undefined' && TABS.AUTOMATION_RULES) ? TABS.AUTOMATION_RULES.name : 'Automation_Rules';
  var sh = ss.getSheetByName(tabName);
  if (!sh || rowIndex < 3 || rowIndex > sh.getLastRow()) {
    return { success: false, result: 'Invalid rule row index: ' + rowIndex };
  }

  var row = sh.getRange(rowIndex, 1, 1, 9).getValues()[0];
  var rule = {
    row: rowIndex,
    name: String(row[1] || ''),
    action: String(row[2] || ''),
    condition: String(row[5] || ''),
    parameters: String(row[6] || '')
  };

  var actionDef = AUTOMATION_REGISTRY.getAction(rule.action);
  if (!actionDef) {
    return { success: false, result: 'Unknown action: ' + rule.action };
  }

  var condResult = evaluateCondition_(rule.condition, rule.action, {});
  if (!condResult.met) {
    return { success: false, result: 'Condition not met: ' + condResult.reason };
  }

  var parsedParams = parseAutomationParams_(rule.parameters, actionDef);
  var resultMsg = '';
  var now = new Date();
  var timeZone = Session.getScriptTimeZone() || 'UTC';
  var nowStr = Utilities.formatDate(now, timeZone, 'yyyy-MM-dd HH:mm:ss');

  try {
    if (rule.action === 'SCAN_WATCH_FOLDER') {
      resultMsg = executeWatchFolderScan_(rule, parsedParams, null);
    } else if (rule.action === 'CLEAN_LOGS') {
      resultMsg = executeCleanLogs_(rule, parsedParams, null);
    } else if (rule.action === 'PROCESS_QUEUE') {
      resultMsg = executeProcessQueue_(rule, parsedParams, null);
    } else if (actionDef.handlerName && typeof this[actionDef.handlerName] === 'function') {
      resultMsg = this[actionDef.handlerName](rule, parsedParams, null);
    } else {
      resultMsg = 'Warning: No handler found for ' + rule.action;
    }
  } catch (err) {
    resultMsg = 'Error: ' + err.message;
  }

  sh.getRange(rowIndex, 8).setValue(nowStr);
  sh.getRange(rowIndex, 9).setValue(resultMsg);
  SpreadsheetApp.flush();

  return { success: true, result: resultMsg };
}

/**
 * Deletes an automation rule row.
 * @param {number} rowIndex
 * @return {Object}
 */
function deleteAutomationRule(rowIndex) {
  var ss = SpreadsheetApp.getActive();
  var tabName = (typeof TABS !== 'undefined' && TABS.AUTOMATION_RULES) ? TABS.AUTOMATION_RULES.name : 'Automation_Rules';
  var sh = ss.getSheetByName(tabName);
  if (!sh || rowIndex < 3 || rowIndex > sh.getLastRow()) {
    return { success: false, error: 'Invalid row index.' };
  }

  sh.deleteRow(rowIndex);
  SpreadsheetApp.flush();
  return { success: true };
}

/**
 * Retrieves the current selection and context for the Automation Sidebar.
 * @return {Object} Sidebar context payload
 */
function getActiveAutomationContext_() {
  var ss = SpreadsheetApp.getActive();
  var sh = ss ? ss.getActiveSheet() : null;
  var tabName = (typeof TABS !== 'undefined' && TABS.AUTOMATION_RULES) ? TABS.AUTOMATION_RULES.name : 'Automation_Rules';

  var isAutomation = (sh && sh.getName() === tabName);
  var currentSheet = sh ? sh.getName() : '';

  var ruleSh = ss ? ss.getSheetByName(tabName) : null;
  var nextBlankRow = 3;
  if (ruleSh) {
    var lastRow = ruleSh.getLastRow();
    if (lastRow >= 3) {
      var names = ruleSh.getRange(3, 2, lastRow - 2, 1).getValues();
      var foundBlank = false;
      for (var i = 0; i < names.length; i++) {
        if (!names[i][0] || !String(names[i][0]).trim()) {
          nextBlankRow = i + 3;
          foundBlank = true;
          break;
        }
      }
      if (!foundBlank) {
        nextBlankRow = lastRow + 1;
      }
    }
  }

  var activeRow = 3;
  var ruleData = null;

  if (isAutomation && sh) {
    var activeCell = sh.getActiveCell();
    activeRow = activeCell ? activeCell.getRow() : 3;

    if (activeRow >= 3 && activeRow <= sh.getLastRow()) {
      var row = sh.getRange(activeRow, 1, 1, 9).getValues()[0];
      var nameVal = String(row[1] || '').trim();
      if (nameVal) {
        ruleData = {
          rowIndex: activeRow,
          active: String(row[0]).trim().toLowerCase() === 'yes',
          name: nameVal,
          action: String(row[2] || '').trim(),
          triggerType: String(row[3] || 'Time (Minutes)').trim(),
          triggerConfig: row[4],
          condition: String(row[5] || '').trim(),
          parameters: String(row[6] || '').trim(),
          lastRun: row[7],
          lastResult: row[8]
        };
      }
    }
  }

  return {
    isAutomationSheet: isAutomation,
    currentSheet: currentSheet,
    activeRow: activeRow,
    hasRule: !!(ruleData && ruleData.name),
    rule: ruleData,
    nextBlankRow: nextBlankRow,
    actions: AUTOMATION_REGISTRY.getAvailableActions(),
    triggers: AUTOMATION_REGISTRY.triggers,
    events: AUTOMATION_REGISTRY.events,
    templates: AUTOMATION_REGISTRY.getTemplates()
  };
}

/**
 * Public RPC Gateway for the Automation Sidebar to inspect active row selection.
 */
function getActiveAutomationContext() {
  return getActiveAutomationContext_();
}

/**
 * Activates the Automation_Rules sheet tab in the active spreadsheet.
 */
function activateAutomationRulesSheet() {
  var ss = SpreadsheetApp.getActive();
  var tabName = (typeof TABS !== 'undefined' && TABS.AUTOMATION_RULES) ? TABS.AUTOMATION_RULES.name : 'Automation_Rules';
  var sh = ss ? ss.getSheetByName(tabName) : null;
  if (sh) {
    sh.activate();
  }
}


