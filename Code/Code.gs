/**
 * Paragliding Flight Log v2.0
 * Updated: 2026-02-12 13:19:59
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
  SpreadsheetApp.getUi()
    .createMenu('Flight Log')
    .addItem('Add manual flight (blank row)', 'uiAddManualFlight_')
    .addItem('Add flight from IGC (URL/Drive ID)...', 'showUrlDialog_')
    .addItem('Add flight from Upload (Local File)...', 'showUploadDialog_')
    .addSeparator()
    .addItem('Scan Watch Folder now', 'scanWatchFolder')
    .addItem('Recompute selected flight(s)', 'uiRecomputeSelected_')
    .addItem('Flight Inspector', 'showInspectorSidebar')
    .addSeparator()
    .addSubMenu(SpreadsheetApp.getUi().createMenu('Admin')
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
        .addItem('Enable Watch Folder', 'uiEnableWatch_')
        .addItem('Disable Watch Folder', 'uiDisableWatch_')
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

function showUrlDialog_() {
  var html = HtmlService.createHtmlOutputFromFile('UrlEntry')
      .setWidth(400)
      .setHeight(250);
  SpreadsheetApp.getUi().showModalDialog(html, 'Enter IGC URL');
}

function showInspectorSidebar() {
  var html = HtmlService.createHtmlOutputFromFile('Inspector')
      .setTitle('Flight Inspector')
      .setWidth(450);
  SpreadsheetApp.getUi().showSidebar(html);
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

function showUploadDialog_() {
  var html = HtmlService.createHtmlOutputFromFile('Picker')
      .setWidth(400)
      .setHeight(350);
  SpreadsheetApp.getUi().showModalDialog(html, 'Upload Flight Logs');
}

function uiRecomputeSelected_() {
  SpreadsheetApp.getUi().alert('Recompute not yet implemented.');
}

function setupWatcherTrigger_() {
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === 'scanWatchFolderNow_') {
      ScriptApp.deleteTrigger(triggers[i]);
    }
  }
  ScriptApp.newTrigger('scanWatchFolderNow_')
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
   PARAMETER UPDATES (UI Helpers)
   ========================================================================================== */

function uiUpdateWatchFolder_() { uiUpdateFolder_('WATCH_FOLDER_ID', 'Watch Folder'); }
function uiUpdateUploadFolder_() { uiUpdateFolder_('UPLOAD_FOLDER_ID', 'Upload Folder'); }
function uiUpdateMasterLogFolder_() { uiUpdateFolder_('MASTER_LOG_FOLDER_ID', 'Master Log Folder'); }

function uiEnableWatch_() {
  setParameter_('ENABLE_WATCH_FOLDER', 'TRUE');
  SpreadsheetApp.getActive().toast('Watch Folder ENABLED.');
}

function uiDisableWatch_() {
  setParameter_('ENABLE_WATCH_FOLDER', 'FALSE');
  SpreadsheetApp.getActive().toast('Watch Folder DISABLED.');
}

/**
 * Manual trigger for Watch Folder Scan
 */
function scanWatchFolder() {
  var ui = SpreadsheetApp.getUi();
  // removed toast as per request
  
  var stats = scanWatchFolderNow_();
  
  if (stats) {
    var msg = 'Scan Complete.\n\n' +
              'Processed: ' + stats.processed + ' files\n' +
              'Flights Created: ' + (stats.flights || 0) + '\n' +
              'Skipped: ' + stats.skipped + '\n' +
              'Errors: ' + stats.errors + '\n\n' +
              '--- Logs ---\n' +
              stats.log.join('\n');
              
    ui.alert('Watch Folder Scan', msg, ui.ButtonSet.OK);
  } else {
    // Should not happen if Ingestion.gs is updated
    ui.alert('Watch Folder Scan', 'Scan finished (No details returned). Check Logs.', ui.ButtonSet.OK);
  }
}

function uiUpdateFolder_(paramName, friendlyName) {
  var ui = SpreadsheetApp.getUi();
  var resp = ui.prompt('Update ' + friendlyName, 'Enter Google Drive Folder URL or ID:', ui.ButtonSet.OK_CANCEL);
  
  if (resp.getSelectedButton() !== ui.Button.OK) return;
  var input = resp.getResponseText().trim();
  if (!input) return;
  
  var id = getDriveIdFromUrl_(input); 
  if (!id) id = input; 
  
  setParameter_(paramName, id);
  ui.alert('Updated ' + friendlyName + ' ID to: ' + id);
}

function setParameter_(key, value) {
  var ss = SpreadsheetApp.getActive();
  var sh = ss.getSheetByName(TABS.PARAMETERS.name);
  if (!sh) return;
  
  var data = sh.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) { 
    if (String(data[i][0]).trim() === key) {
      sh.getRange(i + 1, 2).setValue(value);
      return;
    }
  }
}
