/**
 * Paragliding Flight Log v2.0
 * Updated: 2026-02-09 19:35:59
 */
/**
 * Paragliding Flight Log v2.0
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
             if (!isNaN(Number(val)) && val !== '') {
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
  SpreadsheetApp.getActive().toast('Scanning Watch Folder in background...', 'Ingestion', 3);
  
  var stats = scanWatchFolderNow_();
  
  if (stats) {
    var msg = 'Scan Complete.\n\n' +
              'Processed: ' + stats.processed + '\n' +
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
