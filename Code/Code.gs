/**
 * Paragliding Flight Log v2.0
 * Updated: 2026-09-29 23:17:49
 * Test access verification: Verified GAS write access on 2026-09-25 08:26:00.
 * 
 * CORE MODULE: Orchestration Only.
 * Configuration -> Config.gs
 * Scaffolding -> Scaffold.gs
 * Logic -> Ingestion.gs, Parser.gs, Analysis.gs, Scoring.gs, Geo.gs
 */

/* ==========================================================================================
   MENU & TRIGGERS
   ========================================================================================== */

function onOpen(e) {
  var ui = SpreadsheetApp.getUi();
  ui.createMenu('Flight Log')
    .addItem('Flight Inspector', 'showInspectorSidebar')
    .addSeparator()
    .addSubMenu(ui.createMenu('Add Flight')
        .addItem('Add manual flight (blank row)', 'uiAddManualFlight_')
        .addItem('Add files from URL (folder, igc, zip)...', 'showUrlDialog')
        .addItem('Add flight from Upload (Local File)...', 'showUploadDialog')
        .addItem('Scan Watch Folder Now', 'showScanDialog'))
    .addSubMenu(ui.createMenu('Flight maintenance')
        .addItem('Recompute Selected Flights', 'uiRecomputeSelected_')
        .addItem('Sort All Flights by Date', 'sortFlightsByDate_')
        .addItem('Update missing data for selected Flights', 'uiUpdateMissingDataSelected_')
        .addItem('Update missing data for all flights', 'uiUpdateMissingDataAll_'))
    .addSeparator()
    .addSubMenu(ui.createMenu('Admin')
        .addItem('First Time Setup (Full Scaffold)', 'scaffoldAll_')
        .addItem('Admin: Update Validation & Params', 'updateValidationOnly_')
        .addItem('Admin: Reapply Formatting (Safe)', 'reapplyFormatting_')
        .addItem('Admin: Backup Data', 'backupSystemSheets_')
        .addSeparator()
        .addItem('Admin: Delete System Sheets (Reset)', 'deleteSystemSheets_')
        .addSeparator()
        .addItem('Update Watch Folder...', 'uiUpdateWatchFolder_')
        .addItem('Update Upload Folder...', 'uiUpdateUploadFolder_')
        .addItem('Update Master Log Folder...', 'uiUpdateMasterLogFolder_')
        .addItem('Update Error Folder...', 'uiUpdateErrorFolder_')
        .addSeparator()
        .addItem('Setup 5-min watcher trigger', 'setupWatcherTrigger_')
        .addItem('Debug: Clear dedupe cache', 'debugClearDedupe_'))
    .addToUi();
}

/* ==========================================================================================
   CONFIG HELPERS (Orchestration wrappers)
   ========================================================================================== */

function getParameters_() {
  var ss = SpreadsheetApp.getActive();
  var sh = ss.getSheetByName(TABS.PARAMETERS.name);
  var config = JSON.parse(JSON.stringify(CFG.defaults));
  
  if (sh) {
    var last = sh.getLastRow();
    if (last > 1) {
      try {
        var params = sh.getRange(2, 1, last - 1, 2).getValues();
        params.forEach(function(row) {
          var key = String(row[0]).trim();
          var val = row[1];
          if (key && key.indexOf('[') !== 0 && val !== '') { 
             // Fix: Don't convert Booleans to Numbers (Number(true) === 1)
             if (typeof val === 'boolean') {
               config[key] = val;
             } else if (!isNaN(Number(val)) && val !== '') {
               config[key] = Number(val);
             } else {
               config[key] = val;
             }
          }
        });
      } catch (e) {
        console.error('Error reading Parameters:', e);
      }
    }
  }
  
  // Parse list types
  if (typeof config.FLIGHT_TYPES === 'string') {
    config.FLIGHT_TYPES_LIST = config.FLIGHT_TYPES.split(',').map(function(s) { return s.trim(); });
  } else {
    config.FLIGHT_TYPES_LIST = CFG.defaults.FLIGHT_TYPES.split(',').map(function(s) { return s.trim(); });
  }

  return config;
}

/* ==========================================================================================
   UI ACTIONS (Orchestration)
   ========================================================================================== */

function showUrlDialog() {
  var html = HtmlService.createTemplateFromFile('URLDialog')
      .evaluate()
      .setWidth(580)
      .setHeight(570);
  SpreadsheetApp.getUi().showModalDialog(html, 'Flight Import');
}

function showInspectorSidebar() {
  var html = HtmlService.createTemplateFromFile('Inspector')
      .evaluate()
      .setTitle('Flight Inspector')
      .setWidth(500);
  SpreadsheetApp.getUi().showSidebar(html);
}

function sortFlightsByDate_() {
  SpreadsheetApp.getActive().toast('Sort functionality coming soon!', 'Flight Log');
}

function showScanDialog() {
  var html = HtmlService.createTemplateFromFile('ScanDialog')
      .evaluate()
      .setWidth(500)
      .setHeight(450);
  SpreadsheetApp.getUi().showModalDialog(html, 'Flight Import');
}


function getInspectorData() {
  var log = [];
  try {
    var ss = SpreadsheetApp.getActive();
    var sh = ss.getActiveSheet();
    var actName = sh.getName();
    log.push('Active Sheet: ' + actName);
    
    // Check Config
    if (typeof TABS === 'undefined') {
       return JSON.stringify({ error: 'Critical: TABS config object is undefined.', log: log });
    }
    log.push('Target Sheet: ' + TABS.FLIGHTS.name);
    
    // Validation: Must be Flights sheet
    if (actName !== TABS.FLIGHTS.name) {
      return JSON.stringify({ error: 'Incorrect Sheet. Please open "Flights". (Current: ' + actName + ')', log: log });
    }
    
    var row = sh.getActiveRange().getRow();
    log.push('Row: ' + row);
    
    // Validation: Header or above
    if (row < TABS.FLIGHTS.dataStartRow) {
      return JSON.stringify({ error: 'Please select a flight row (Row ' + TABS.FLIGHTS.dataStartRow + '+).', log: log });
    }
    
    // Get Data
    var lastCol = sh.getLastColumn();
    if (lastCol < 1) {
       return JSON.stringify({ error: 'Sheet is empty.', log: log });
    }
    
    var values = sh.getRange(row, 1, 1, lastCol).getValues()[0];
    
    // Get Headers
    var headers = sh.getRange(TABS.FLIGHTS.headerRow, 1, 1, lastCol).getValues()[0];
    
    // Get Validation Rules (for Dropdowns)
    var validations = sh.getRange(row, 1, 1, lastCol).getDataValidations()[0];
    
    // Extract Flight URL (if any)
    var flightUrl = null;
    var flightIdIndex = headers.indexOf('FlightID');
    if (flightIdIndex > -1) {
       // Check for RichText link first
       try {
         var cell = sh.getRange(row, flightIdIndex + 1);
         var rt = cell.getRichTextValue();
         if (rt) flightUrl = rt.getLinkUrl();
         
         // Fallback to Formula parsing if no rich text link
         if (!flightUrl && cell.getFormula()) {
            var match = cell.getFormula().match(/HYPERLINK\("([^"]+)"/i);
            if (match) flightUrl = match[1];
         }
       } catch(e) { log.push('Link extract fail: ' + e.message); }
    }

    // Build Response
    var resp = { 
      flightId: values[0], 
      flightUrl: flightUrl,
      groups: [],
      debugHeaders: headers,
      debugGroups: TABS.FLIGHTS.groups,
      log: log
    };
    
    // Get Date/Time Patterns
    var dateFormat = 'yyyy-MM-dd'; 
    var timeFormat = 'HH:mm';
    try {
      var paramSheet = ss.getSheetByName(TABS.PARAMETERS.name);
      var params = paramSheet.getRange(3, 1, paramSheet.getLastRow()-2, 2).getValues();
      params.forEach(function(r) {
         if (r[0] === 'DATE_FORMAT') dateFormat = r[1];
         if (r[0] === 'TIME_FORMAT') timeFormat = r[1];
      });
    } catch(e) {}

    TABS.FLIGHTS.groups.forEach(function(g) {
      var groupObj = { 
        name: g.name, 
        color: g.color, 
        collapsedRows: g.collapsedRows || 1, // Pass config to UI
        fields: [] 
      };
      
      var editableCols = g.editable || [];
      
      g.cols.forEach(function(colName) {
         var colIndex = headers.indexOf(colName);
         if (colIndex > -1) {
           var val = values[colIndex];
           
           // Format Dates/Times
           // Heuristic: If column name contains 'Time' or 'Duration' -> Time Format?
           // Actually, standard Date objects in Sheets are 'Date' type.
           if (val instanceof Date) {
              // Check if it's a "Date" column or "Time" column based on Header Name
              if (colName.match(/Time|Duration/i)) {
                 // Check if it's a Duration value (number) or Date object?
                 // In Sheets, Time is Date object.
                 val = Utilities.formatDate(val, Session.getScriptTimeZone(), timeFormat);
              } else {
                 // Assume Date
                 val = Utilities.formatDate(val, Session.getScriptTimeZone(), dateFormat);
              }
           }
           
           var choices = null;
           var rule = validations[colIndex];
           if (rule) {
              var criteria = rule.getCriteriaType();
              if (criteria === SpreadsheetApp.DataValidationCriteria.VALUE_IN_LIST) {
                 choices = rule.getCriteriaValues()[0]; 
              } else if (criteria === SpreadsheetApp.DataValidationCriteria.VALUE_IN_RANGE) {
                 try {
                   var range = rule.getCriteriaValues()[0];
                   var v = range.getValues();
                   choices = v.map(function(r){ return r[0]; }).filter(function(x){ return x !== ''; });
                 } catch(e) { log.push('Validation read error col ' + colIndex); }
              } else if (criteria === SpreadsheetApp.DataValidationCriteria.CHECKBOX) {
                 choices = ['TRUE','FALSE']; // Signal to UI it's a checkbox (or handle as select)
              }
           }
           
           // Determine Editing status from Config
           var isEditable = (editableCols.indexOf(colName) > -1);
           
           groupObj.fields.push({
              name: colName,
              value: val,
              colIndex: colIndex + 1,
              choices: choices,
              editable: isEditable
           });
         }
      });

      
      if (groupObj.fields.length > 0) {
        resp.groups.push(groupObj);
      }
    });
    
    return JSON.stringify(resp);
    
  } catch (e) {
    return JSON.stringify({ error: 'Exception: ' + e.message + '\nStack: ' + e.stack, log: log });
  }
}

function saveInspectorData(flightId, updates) {
  var ss = SpreadsheetApp.getActive();
  var sh = ss.getSheetByName(TABS.FLIGHTS.name);
  
  // 1. Find Row (Don't assume active row, search by ID for safety)
  // Optimization: Use text finder
  var finder = sh.createTextFinder(flightId).matchEntireCell(true);
  var cell = finder.findNext();
  
  if (!cell) return { error: 'Flight ID not found: ' + flightId };
  
  var row = cell.getRow();
  
  // 2. Apply Updates
  // updates = [ { colIndex: 5, value: 'New Note' }, ... ]
  updates.forEach(function(u) {
     sh.getRange(row, u.colIndex).setValue(u.value);
  });
  
  return { success: true };
}

function showUploadDialog() {
  var html = HtmlService.createTemplateFromFile('UploadDialog')
      .evaluate()
      .setWidth(600)
      .setHeight(550);
  SpreadsheetApp.getUi().showModalDialog(html, 'Flight Import');
}

function uiRecomputeSelected_() {
  SpreadsheetApp.getUi().alert('Recompute not yet implemented.');
}

function uiUpdateMissingDataSelected_() {
  SpreadsheetApp.getActive().toast('Update missing data for selected flights will be available soon.', 'Flight Log');
}

function uiUpdateMissingDataAll_() {
  SpreadsheetApp.getActive().toast('Update missing data for all flights will be available soon.', 'Flight Log');
}

/**
 * Public trigger entry point for automated Watch Folder background scans.
 * Must not have a trailing underscore so GAS time-based triggers can dispatch it.
 */
function scanWatchFolderTrigger() {
  scanWatchFolderNow_();
}

function setupWatcherTrigger_() {
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    var handler = triggers[i].getHandlerFunction();
    if (handler === 'scanWatchFolderNow_' || handler === 'scanWatchFolderTrigger') {
      ScriptApp.deleteTrigger(triggers[i]);
    }
  }
  ScriptApp.newTrigger('scanWatchFolderTrigger')
    .timeBased()
    .everyMinutes(5)
    .create();
  SpreadsheetApp.getUi().alert('Trigger set for every 5 minutes.');
}

function debugClearDedupe_() {
  var props = PropertiesService.getDocumentProperties();
  var keys = props.getKeys();
  var toDel = keys.filter(function(k) { return k.indexOf('HASH_') === 0; });
  toDel.forEach(function(k) { props.deleteProperty(k); });
  SpreadsheetApp.getActive().toast('Cleared ' + toDel.length + ' dedupe hashes.');
}

/* ==========================================================================================
   PARAMETER UPDATES & FOLDER PICKER (UI Helpers)
   ========================================================================================== */

/* Folder Updaters (Open In-App Folder Picker Dialog) */
function uiUpdateWatchFolder_() { openFolderPicker_('WATCH_FOLDER_ID', 'Watch Folder'); }
function uiUpdateUploadFolder_() { openFolderPicker_('UPLOAD_FOLDER_ID', 'Upload Folder'); }
function uiUpdateMasterLogFolder_() { openFolderPicker_('MASTER_LOG_FOLDER_ID', 'Master Log Folder'); }
function uiUpdateErrorFolder_() { openFolderPicker_('ERROR_FOLDER_ID', 'Error Folder'); }

function openFolderPicker_(key, name) {
  var config = getParameters_();
  var currentId = config[key] || '';
  var currentPath = (key === 'WATCH_FOLDER_ID') ? getMultiFolderPath_(currentId) : getFolderPath_(currentId);
  
  var template = HtmlService.createTemplateFromFile('FolderPickerDialog');
  template.paramKey = key;
  template.paramName = name;
  template.currentId = currentId;
  template.currentPath = currentPath || '(Not configured)';
  
  var html = template.evaluate()
      .setWidth(550)
      .setHeight(520);
  SpreadsheetApp.getUi().showModalDialog(html, 'Select ' + name);
}

/**
 * Lists subfolders of a given folder ID (or My Drive root).
 * Called by FolderPickerDialog.html.
 */
function getDriveFolderContents(folderId) {
  try {
    var folder;
    var isRoot = (!folderId || folderId === 'root');
    if (isRoot) {
      folder = DriveApp.getRootFolder();
    } else {
      folder = DriveApp.getFolderById(folderId);
    }
    
    var currentId = isRoot ? 'root' : folder.getId();
    var actualId = folder.getId();
    var currentName = isRoot ? 'My Drive' : folder.getName();
    var currentPath = isRoot ? 'My Drive' : getFolderPath_(actualId);
    
    var subfolders = [];
    var it = folder.getFolders();
    while (it.hasNext() && subfolders.length < 100) {
      var sub = it.next();
      subfolders.push({ id: sub.getId(), name: sub.getName() });
    }
    subfolders.sort(function(a, b) { return a.name.localeCompare(b.name); });
    
    return {
      success: true,
      currentId: currentId,
      actualId: actualId,
      currentName: currentName,
      currentPath: currentPath,
      isRoot: isRoot,
      subfolders: subfolders
    };
  } catch (e) {
    console.error('getDriveFolderContents error:', e);
    return { success: false, error: e.message };
  }
}

/**
 * Validates a folder URL or raw ID, returns folder name and full path.
 * Called by FolderPickerDialog.html.
 */
function resolveFolderInput(input) {
  if (!input) return { success: false, error: 'Empty input' };
  var str = String(input).trim();
  
  var id = str;
  var folderMatch = str.match(/\/folders\/([-\w]+)/);
  if (folderMatch) {
    id = folderMatch[1];
  } else {
    var idParamMatch = str.match(/[?&]id=([-\w]+)/);
    if (idParamMatch) {
      id = idParamMatch[1];
    } else {
      var rawMatch = str.match(/[-\w]{15,}/);
      if (rawMatch) {
        id = rawMatch[0];
      }
    }
  }
  
  try {
    var folder = DriveApp.getFolderById(id);
    return {
      success: true,
      id: id,
      name: folder.getName(),
      path: getFolderPath_(id)
    };
  } catch (e) {
    console.error('resolveFolderInput error for ' + id + ':', e);
    return { success: false, error: 'Folder not found or inaccessible (' + id + '): ' + e.message };
  }
}

/**
 * Resolves the full breadcrumb path of a single folder.
 */
function getFolderPath_(folderId) {
  if (!folderId) return '';
  try {
    var folder = DriveApp.getFolderById(folderId);
    var parts = [folder.getName()];
    try {
      var parents = folder.getParents();
      var depth = 0;
      while (parents.hasNext() && depth < 10) {
        var p = parents.next();
        var pName = p.getName();
        if (pName) parts.unshift(pName);
        parents = p.getParents();
        depth++;
      }
    } catch (eParent) {
      console.warn('Parent traversal note: ' + eParent.message);
    }
    return parts.join(' / ');
  } catch (e) {
    return '(Invalid folder ID: ' + folderId + ')';
  }
}

/**
 * Resolves human-readable paths for comma-separated folder IDs.
 */
function getMultiFolderPath_(folderIdsStr) {
  if (!folderIdsStr) return '';
  var ids = String(folderIdsStr).split(',').map(function(s) { return s.trim(); }).filter(Boolean);
  if (ids.length === 0) return '';
  var paths = ids.map(function(id, idx) {
    var path = getFolderPath_(id);
    return (ids.length > 1 ? (idx + 1) + '. ' : '') + path;
  });
  return paths.join(' | ');
}

/**
 * Saves a folder parameter, updates the ID and Description in Parameters sheet.
 * Called by FolderPickerDialog.html.
 */
function saveFolderParam(key, folderId, mode) {
  try {
    var finalValue = folderId;
    
    // Handle multi-folder append for WATCH_FOLDER_ID
    if (key === 'WATCH_FOLDER_ID' && mode === 'append') {
      var currentConfig = getParameters_();
      var existingIds = String(currentConfig.WATCH_FOLDER_ID || '').split(',').map(function(s){ return s.trim(); }).filter(Boolean);
      if (existingIds.indexOf(folderId) === -1) {
        existingIds.push(folderId);
      }
      finalValue = existingIds.join(', ');
    }
    
    setParameter_(key, finalValue);
    
    var ss = SpreadsheetApp.getActive();
    var folderPath = (key === 'WATCH_FOLDER_ID') ? getMultiFolderPath_(finalValue) : getFolderPath_(finalValue);
    ss.toast('Updated ' + key + ':\n' + folderPath, 'Flight Log', 5);
    
    return { success: true, value: finalValue, path: folderPath };
  } catch (e) {
    console.error('saveFolderParam error:', e);
    return { success: false, error: e.message };
  }
}

function uiEnableWatch_() {
  setParameter_('ENABLE_WATCH_FOLDER', 'TRUE');
  SpreadsheetApp.getActive().toast('Watch Folder ENABLED.');
}

function uiDisableWatch_() {
  setParameter_('ENABLE_WATCH_FOLDER', 'FALSE');
  SpreadsheetApp.getActive().toast('Watch Folder DISABLED.');
}

function setParameter_(key, value, description) {
  var ss = SpreadsheetApp.getActive();
  var sh = ss.getSheetByName(TABS.PARAMETERS.name);
  if (!sh) return;
  
  var data = sh.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) { 
    if (String(data[i][0]).trim() === key) {
      sh.getRange(i + 1, 2).setValue(value);
      
      // Update Description with human-readable path if it's a folder parameter
      var isFolderParam = (key === 'WATCH_FOLDER_ID' || key === 'UPLOAD_FOLDER_ID' || key === 'MASTER_LOG_FOLDER_ID' || key === 'ERROR_FOLDER_ID');
      if (description) {
        sh.getRange(i + 1, 3).setValue(description);
      } else if (isFolderParam) {
        // Base description from CFG
        var baseDesc = '';
        CFG.parameters.forEach(function(p) { if (p.key === key) baseDesc = p.desc; });
        var pathStr = (key === 'WATCH_FOLDER_ID') ? getMultiFolderPath_(value) : getFolderPath_(value);
        if (pathStr) {
          sh.getRange(i + 1, 3).setValue(baseDesc + '\n[Path: ' + pathStr + ']');
        }
      }
      return;
    }
  }
}
