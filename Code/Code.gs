/**
 * Paragliding Flight Log v2.0
 * Updated: 2026-10-01 01:31:18
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
        .addItem('Add manual flight (blank row)', 'uiAddManualFlight')
        .addItem('Add files from URL (folder, igc, zip)...', 'showUrlDialog')
        .addItem('Add flight from Upload (Local File)...', 'showUploadDialog')
        .addItem('Scan Watch Folder Now', 'showScanDialog'))
    .addSubMenu(ui.createMenu('Flight maintenance')
        .addItem('Flight Updates...', 'showFlightMaintenanceDialog')
        .addItem('Sort All Flights by Date', 'sortFlightsByDate')
        .addSeparator()
        .addItem('Mark Duplicates for Removal...', 'showMarkDuplicatesDialog')
        .addItem('Purge Flights Marked \'Remove\'', 'showPurgeDialog')
        .addItem('Re-sync Missing Flights from Master Folder', 'showResyncDialog'))
    .addSeparator()
    .addSubMenu(ui.createMenu('Admin')
        .addItem('Bulk Flight Ingestion (Batch)...', 'showBulkIngestionDialog')
        .addSeparator()
        .addSubMenu(ui.createMenu('Configuration Management')
            .addItem('Save Config (Export JSON)...', 'showSaveConfigDialog')
            .addItem('Load Config (Import JSON)...', 'showLoadConfigDialog'))
        .addSubMenu(ui.createMenu('Sheet Maintenance & Views')
            .addItem('Refresh Dashboard (KPIs & Cards)', 'uiRefreshDashboard')
            .addItem('Refresh User Guide & Metric Dictionary', 'uiRefreshUserGuide')
            .addItem('Update Dropdowns, Parameters & Notes', 'updateValidationOnly')
            .addItem('Repair Sheet Schema & Formatting (Safe)', 'reapplyFormatting'))
        .addSubMenu(ui.createMenu('Folder Configuration')
            .addItem('Set Watch Folder(s)...', 'uiUpdateWatchFolder')
            .addItem('Set Upload Folder...', 'uiUpdateUploadFolder')
            .addItem('Set Master Log Folder...', 'uiUpdateMasterLogFolder')
            .addItem('Set Error Folder...', 'uiUpdateErrorFolder')
            .addItem('Set Trash / Discard Folder...', 'uiUpdateTrashFolder'))
        .addSubMenu(ui.createMenu('Data Backup')
            .addItem('Backup System Sheets', 'backupSystemSheets'))
        .addSubMenu(ui.createMenu('Automation & Services')
            .addItem('Setup / Reset 5-min Watcher Trigger', 'setupWatcherTrigger'))
        .addSeparator()
        .addSubMenu(ui.createMenu('System Setup & Reset (Danger Zone)')
            .addItem('First Time Setup (Full Scaffold)', 'scaffoldAll')
            .addItem('Delete System Sheets (Full Reset)', 'deleteSystemSheets')))
    .addToUi();
}

/* ==========================================================================================
   CONFIG HELPERS (Orchestration wrappers)
   ========================================================================================== */

function getParameters_() {
  var ss = SpreadsheetApp.getActive();
  var sh = ss.getSheetByName(TABS.CONFIG.name);
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
             } else if (key === 'DATE_FORMAT' || key === 'TIME_FORMAT') {
               if (val instanceof Date || typeof val === 'number') {
                 config[key] = CFG.defaults[key] || (key === 'DATE_FORMAT' ? 'yyyy-MM-dd' : 'h:mm a');
               } else {
                 config[key] = String(val).trim();
               }
             } else if (key === 'TIMELINE_HOURS_LOW' || key === 'TIMELINE_HOURS_MED') {
               if (val instanceof Date) {
                 config[key] = (val.getHours() + val.getMinutes() / 60) / 24;
               } else if (typeof val === 'string' && val.indexOf(':') !== -1) {
                 var parts = val.replace(/[^0-9:]/g, '').split(':');
                 config[key] = (Number(parts[0]) || 0) / 24 + (Number(parts[1]) || 0) / 1440;
               } else if (!isNaN(Number(val)) && val !== '') {
                 config[key] = Number(val);
               } else {
                 config[key] = CFG.defaults[key];
               }
             } else if (!isNaN(Number(val)) && val !== '' && !(val instanceof Date)) {
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
  
  // Clean folder parameter IDs so URLs/whitespace don't break DriveApp calls
  var singleFolderKeys = ['MASTER_LOG_FOLDER_ID', 'UPLOAD_FOLDER_ID', 'ERROR_FOLDER_ID', 'TRASH_FOLDER_ID'];
  singleFolderKeys.forEach(function(k) {
    if (config[k]) {
      config[k] = cleanDriveId_(config[k]);
    }
  });
  if (config.WATCH_FOLDER_ID) {
    var ids = String(config.WATCH_FOLDER_ID).split(',').map(function(s) {
      return cleanDriveId_(s.trim());
    }).filter(Boolean);
    config.WATCH_FOLDER_ID = ids.join(', ');
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

function showBulkIngestionDialog() {
  var html = HtmlService.createTemplateFromFile('BulkIngestDialog')
      .evaluate()
      .setWidth(680)
      .setHeight(620);
  SpreadsheetApp.getUi().showModalDialog(html, 'Bulk Flight Ingestion');
}

function showInspectorSidebar() {
  var html = HtmlService.createTemplateFromFile('Inspector')
      .evaluate()
      .setTitle('Flight Inspector')
      .setWidth(500);
  SpreadsheetApp.getUi().showSidebar(html);
}

function showFlightMaintenanceDialog() {
  var html = HtmlService.createTemplateFromFile('FlightMaintenanceDialog')
      .evaluate()
      .setWidth(560)
      .setHeight(580);
  SpreadsheetApp.getUi().showModalDialog(html, 'Flight Updates');
}

function showPurgeDialog() {
  var html = HtmlService.createTemplateFromFile('PurgeDialog')
      .evaluate()
      .setWidth(540)
      .setHeight(500);
  SpreadsheetApp.getUi().showModalDialog(html, 'Purge Flights');
}

function showMarkDuplicatesDialog() {
  var html = HtmlService.createTemplateFromFile('MarkDuplicatesDialog')
      .evaluate()
      .setWidth(520)
      .setHeight(460);
  SpreadsheetApp.getUi().showModalDialog(html, 'Mark Duplicates for Removal');
}

function showSaveConfigDialog() {
  var html = HtmlService.createTemplateFromFile('SaveConfigDialog')
      .evaluate()
      .setWidth(580)
      .setHeight(600);
  SpreadsheetApp.getUi().showModalDialog(html, 'Save Configuration');
}

function showLoadConfigDialog() {
  var html = HtmlService.createTemplateFromFile('LoadConfigDialog')
      .evaluate()
      .setWidth(580)
      .setHeight(620);
  SpreadsheetApp.getUi().showModalDialog(html, 'Load Configuration');
}

function showScanDialog() {
  var html = HtmlService.createTemplateFromFile('ScanDialog')
      .evaluate()
      .setWidth(540)
      .setHeight(480);
  SpreadsheetApp.getUi().showModalDialog(html, 'Flight Import');
}

function showResyncDialog() {
  var html = HtmlService.createTemplateFromFile('ResyncDialog')
      .evaluate()
      .setWidth(540)
      .setHeight(500);
  SpreadsheetApp.getUi().showModalDialog(html, 'Re-sync Master Logs');
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
      var paramSheet = ss.getSheetByName(TABS.CONFIG.name);
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

/* ==========================================================================================
   FLIGHT MAINTENANCE & BULK OPERATIONS (RQ-SYS-007)
   ========================================================================================== */

/**
 * Scans the Flights sheet starting at Row 5 and returns only rows that contain a non-empty FlightID.
 * Filters out empty rows that only contain validation rules/dropdowns.
 * @param {GoogleAppsScript.Spreadsheet.Sheet} sh
 * @return {Array<{row: number, id: string}>}
 */
function getActualFlightRows_(sh) {
  if (!sh) return [];
  var lastRow = sh.getLastRow();
  if (lastRow < 5) return [];

  var map = getColumnMap_(sh);
  var idCol = map['FlightID'] || 1;
  var numRows = lastRow - 4;
  var displayVals = sh.getRange(5, idCol, numRows, 1).getDisplayValues();

  var flightRows = [];
  for (var i = 0; i < displayVals.length; i++) {
    var rawId = String(displayVals[i][0]).trim();
    if (rawId !== '') {
      flightRows.push({ row: 5 + i, id: rawId });
    }
  }
  return flightRows;
}

function getMaintenanceScopeInfo() {
  var ss = SpreadsheetApp.getActive();
  var sh = ss.getActiveSheet();
  var actName = sh.getName();
  var isFlights = (actName === TABS.FLIGHTS.name);
  
  var shFlights = ss.getSheetByName(TABS.FLIGHTS.name);
  var allFlights = getActualFlightRows_(shFlights);
  var totalFlights = allFlights.length;

  var selectedCount = 0;
  var selectedRangeStr = '';
  if (isFlights && totalFlights > 0) {
    var activeRange = sh.getActiveRange();
    if (activeRange) {
      var startRow = activeRange.getRow();
      var endRow = activeRange.getLastRow();
      var selectedFlights = allFlights.filter(function(item) {
        return item.row >= startRow && item.row <= endRow;
      });
      selectedCount = selectedFlights.length;
      if (selectedCount > 0) {
        var minR = selectedFlights[0].row;
        var maxR = selectedFlights[selectedFlights.length - 1].row;
        selectedRangeStr = minR + (minR !== maxR ? ('-' + maxR) : '');
      }
    }
  }

  return {
    isFlightsSheet: isFlights,
    selectedRowCount: selectedCount,
    selectedRowRange: selectedRangeStr,
    totalFlights: totalFlights
  };
}

function getMaintenanceTargetRows(scope) {
  var ss = SpreadsheetApp.getActive();
  var sh = ss.getSheetByName(TABS.FLIGHTS.name);
  var allFlights = getActualFlightRows_(sh);
  if (allFlights.length === 0) return [];

  if (scope === 'selected') {
    var activeRange = ss.getActiveSheet().getActiveRange();
    if (!activeRange) return [];
    var startRow = activeRange.getRow();
    var endRow = activeRange.getLastRow();
    return allFlights.filter(function(item) {
      return item.row >= startRow && item.row <= endRow;
    });
  } else {
    return allFlights;
  }
}

function executeFlightMaintenanceRow(rowNum, opConfig) {
  var ss = SpreadsheetApp.getActive();
  var sh = ss.getSheetByName(TABS.FLIGHTS.name);
  if (!sh) return { success: false, error: 'Flights sheet missing' };

  var map = getColumnMap_(sh);
  var lastCol = sh.getLastColumn();
  var rowValues = sh.getRange(rowNum, 1, 1, lastCol).getValues()[0];

  var getV = function(colName) {
    var idx = map[colName];
    return idx ? rowValues[idx - 1] : '';
  };

  var setV = function(colName, val) {
    var idx = map[colName];
    if (idx) {
      sh.getRange(rowNum, idx).setValue(val);
      rowValues[idx - 1] = val;
    }
  };

  var updated = [];
  var config = getParameters_();

  // 1. Weather Backfill (RQ-SCR-004)
  if (opConfig.weather) {
    try {
      var launchLat = parseFloat(getV('Launch Lat'));
      var launchLon = parseFloat(getV('Launch Lon'));
      var launchAlt = parseFloat(getV('Launch Alt (m)'));
      var landLat = parseFloat(getV('Landing Lat'));
      var landLon = parseFloat(getV('Landing Lon'));
      var landAlt = parseFloat(getV('Landing Alt (m)'));
      var dateRaw = getV('Date');
      var dateIso = '';
      if (dateRaw instanceof Date) {
        dateIso = Utilities.formatDate(dateRaw, 'UTC', 'yyyy-MM-dd');
      } else if (dateRaw) {
        dateIso = String(dateRaw).trim().slice(0, 10);
      }

      if (launchLat && launchLon && dateIso) {
        var lFix = { lat: launchLat, lon: launchLon, alt: launchAlt };
        var dFix = (landLat && landLon) ? { lat: landLat, lon: landLon, alt: landAlt } : null;
        
        var startTimeSec = 43200;
        var lTime = getV('Launch Time');
        if (lTime && typeof lTime === 'string') {
          var parts = lTime.split(':');
          if (parts.length >= 2) startTimeSec = parseInt(parts[0], 10) * 3600 + parseInt(parts[1], 10) * 60;
        }

        var endTimeSec = startTimeSec + 3600;
        var landTime = getV('Landing Time');
        if (landTime && typeof landTime === 'string') {
          var lparts = landTime.split(':');
          if (lparts.length >= 2) endTimeSec = parseInt(lparts[0], 10) * 3600 + parseInt(lparts[1], 10) * 60;
        }

        var wx = WEATHER.getEnrichment(lFix, dFix, dateIso, startTimeSec, endTimeSec, config);
        if (wx && !wx.error) {
          if (wx.windLaunch) setV('Wind@Launch', wx.windLaunch);
          if (wx.windLanding) setV('Wind@Landing', wx.windLanding);
          if (wx.cloudPct) setV('Cloud %', wx.cloudPct);
          if (wx.cloudbase) setV('Cloudbase', wx.cloudbase);
          if (wx.tempC) setV('Temp (C)', wx.tempC);
          if (wx.observations) setV('Observations', wx.observations);
          updated.push('Weather');
        }
      }
    } catch (wErr) {
      console.warn('Maintenance Weather error row ' + rowNum, wErr);
    }
  }

  // 2. Geo Backfill
  if (opConfig.geo) {
    try {
      var lLat = parseFloat(getV('Launch Lat'));
      var lLon = parseFloat(getV('Launch Lon'));
      var lAlt = parseFloat(getV('Launch Alt (m)'));
      var dLat = parseFloat(getV('Landing Lat'));
      var dLon = parseFloat(getV('Landing Lon'));
      var dAlt = parseFloat(getV('Landing Alt (m)'));

      if (lLat && lLon) {
        if (!getV('Launch Town') || !getV('Launch Country')) {
          var geoL = GEO.getReverseGeo(lLat, lLon, config);
          if (geoL && !geoL.error) {
            if (geoL.town) setV('Launch Town', geoL.town);
            if (geoL.country) setV('Launch Country', geoL.country);
            if (geoL.region) setV('Launch Region', geoL.region);
            updated.push('Geo(Launch)');
          }
        }
        if (!getV('Launch Site')) {
          var siteL = GEO.getNearestSite(lLat, lLon, config.OSM_RADIUS_M || 3000, config, 'takeoff', lAlt);
          if (siteL) {
            setV('Launch Site', siteL);
            updated.push('Launch Site');
          }
        }
      }

      if (dLat && dLon) {
        if (!getV('Landing Town') || !getV('Landing Country')) {
          var geoD = GEO.getReverseGeo(dLat, dLon, config);
          if (geoD && !geoD.error) {
            if (geoD.town) setV('Landing Town', geoD.town);
            if (geoD.country) setV('Landing Country', geoD.country);
            if (geoD.region) setV('Landing Region', geoD.region);
            updated.push('Geo(Landing)');
          }
        }
        if (!getV('Landing Site')) {
          var siteD = GEO.getNearestSite(dLat, dLon, config.OSM_RADIUS_M || 3000, config, 'landing', dAlt);
          if (siteD) {
            setV('Landing Site', siteD);
            updated.push('Landing Site');
          }
        }
      }
    } catch (gErr) {
      console.warn('Maintenance Geo error row ' + rowNum, gErr);
    }
  }

  // 3. XContest Re-verification
  if (opConfig.xcontest && config.XCONTEST_USERNAME) {
    try {
      var dVal = getV('Date');
      var fDateStr = '';
      if (dVal instanceof Date) {
        fDateStr = Utilities.formatDate(dVal, Session.getScriptTimeZone(), 'yyyy-MM-dd');
      } else if (dVal) {
        fDateStr = String(dVal).trim();
      }
      var fDate = fDateStr ? new Date(fDateStr + 'T12:00:00Z') : null;
      var durStr = String(getV('Flight Duration') || '');
      var durParts = durStr.split(':');
      var durMin = durParts.length >= 2 ? (parseInt(durParts[0], 10) * 60 + parseInt(durParts[1], 10)) : 0;
      var lTimeStr = String(getV('Launch Time') || '');
      var lParts = lTimeStr.split(':');
      var startMin = lParts.length >= 2 ? (parseInt(lParts[0], 10) * 60 + parseInt(lParts[1], 10)) : 720;

      // Extract UTC start time directly from master IGC if linked
      var utcStartMin = null;
      var igcVal = getV('IGC File');
      var igcId = cleanDriveId_(igcVal);
      if (igcId) {
        try {
          var igcChunk = DriveApp.getFileById(igcId).getBlob().getDataAsString();
          var bMatch = igcChunk.match(/\nB(\d{2})(\d{2})(\d{2})/);
          if (bMatch) {
            utcStartMin = parseInt(bMatch[1], 10) * 60 + parseInt(bMatch[2], 10) + (parseInt(bMatch[3], 10) >= 30 ? 1 : 0);
          }
        } catch (igcErr) {
          console.warn('IGC read for UTC start time skipped', igcErr);
        }
      }

      // Fallback: convert Launch Time + Time Zone to UTC if IGC was not available
      if (utcStartMin === null && fDate && lParts.length >= 2) {
        var tz = String(getV('Time Zone') || 'UTC');
        try {
          var dateYMD = Utilities.formatDate(fDate, 'UTC', 'yyyy-MM-dd');
          var refDate = new Date(dateYMD + 'T' + ("0" + lParts[0]).slice(-2) + ':' + ("0" + lParts[1]).slice(-2) + ':00Z');
          var locStr = Utilities.formatDate(refDate, tz, 'HH:mm');
          var locP = locStr.split(':');
          var locMin = parseInt(locP[0], 10) * 60 + parseInt(locP[1], 10);
          var refMin = refDate.getUTCHours() * 60 + refDate.getUTCMinutes();
          var diff = locMin - refMin;
          if (diff < -720) diff += 1440;
          if (diff > 720) diff -= 1440;
          utcStartMin = startMin - diff;
        } catch (tzErr) {
          utcStartMin = startMin;
        }
      }

      if (fDateStr && (utcStartMin !== null || durMin > 0)) {
        var xcStatus = XContest.checkFlight(fDateStr, durMin, (utcStartMin !== null ? utcStartMin : startMin), config);
        if (xcStatus && xcStatus.status) {
          var cellVal = xcStatus.status;
          if (cellVal === 'Yes' && xcStatus.url) {
            var label = xcStatus.label || 'Yes';
            cellVal = '=HYPERLINK("' + xcStatus.url + '", "' + label + '")';
          } else if (cellVal === 'No Username') {
            cellVal = '';
          }
          setV('XContest', cellVal);
          updated.push('XContest');
        }
      }
    } catch (xErr) {
      console.warn('Maintenance XContest error row ' + rowNum, xErr);
    }
  }

  // 4. Physics & XC Scoring (Requires Master IGC)
  if (opConfig.physics || opConfig.scoring) {
    try {
      var igcVal = String(getV('IGC File') || '');
      var masterFolderId = cleanDriveId_(config.MASTER_LOG_FOLDER_ID);
      var masterFile = null;

      var fileNameMatch = igcVal.match(/,\s*"([^"]+)"\)/);
      var rawFileName = fileNameMatch ? fileNameMatch[1] : igcVal;
      var idMatch = igcVal.match(/id=([a-zA-Z0-9_-]+)/);

      if (idMatch && idMatch[1]) {
        try { masterFile = DriveApp.getFileById(idMatch[1]); } catch(e) {}
      }
      if (!masterFile && masterFolderId && rawFileName) {
        try {
          var mfFolder = DriveApp.getFolderById(masterFolderId);
          var files = mfFolder.getFilesByName(rawFileName);
          if (files.hasNext()) masterFile = files.next();
        } catch(eMf) {}
      }

      if (masterFile) {
        // If IGC File is missing hyperlink, backfill it
        if (!idMatch) {
          var dlPattern = config.GDRIVE_DOWNLOAD_URL_PATTERN || 'https://drive.google.com/uc?export=download&id={ID}';
          var directDlUrl = dlPattern.replace('{ID}', masterFile.getId());
          setV('IGC File', '=HYPERLINK("' + directDlUrl + '", "' + (masterFile.getName() || rawFileName) + '")');
          var rawFlightId = String(getV('FlightID') || '').replace(/=HYPERLINK\("[^"]*",\s*"([^"]+)"\)/, '$1');
          if (rawFlightId) {
            var syPattern = config.SEEYOU_CLOUD_URL_PATTERN;
            if (syPattern) {
              var syUrl = syPattern.replace('{URL}', encodeURIComponent(directDlUrl));
              setV('FlightID', '=HYPERLINK("' + syUrl + '", "' + rawFlightId + '")');
            }
          }
          updated.push('IGC Link');
        }

        var blob = masterFile.getBlob();
        var parsed = PARSER.parseIgc(blob.getDataAsString(), masterFile.getName());
        if (parsed && parsed.fixes && parsed.fixes.length > 5) {
          if (opConfig.physics) {
            var analysis = ANALYSIS.analyzeFlight(parsed.fixes, config);
            if (analysis && analysis.modes) {
              var pct = analysis.modes.pct;
              var raw = analysis.modes.raw;
              setV('Thermal %', (pct.thermal * 100).toFixed(2) + '%');
              setV('Thermals Count', raw.thermal.count);
              setV('Thermal Avg (m/s)', raw.thermal.avg.toFixed(1));
              setV('Thermal Best (m/s)', raw.thermal.best.toFixed(1));
              setV('Soar %', (pct.soar * 100).toFixed(2) + '%');
              setV('Efficiency', raw.soar.efficiency || '');
              setV('Glide %', (pct.glide * 100).toFixed(2) + '%');
              setV('Glide L/D', raw.glide.ld || '');
              setV('Sink %', (pct.sink * 100).toFixed(2) + '%');
              setV('Sink Time', Math.round(raw.sink.time / 60) + ' min');
              updated.push('Physics');
            }
          }
          if (opConfig.scoring) {
            var scoring = SCORING.calculateXcScore(parsed.fixes);
            if (scoring && scoring.best) {
              var best = scoring.best;
              var tri = scoring.triangle || {};
              setV('XC Distance (km)', best.dist ? best.dist.toFixed(1) : '');
              setV('XC Score', best.score ? best.score.toFixed(1) : '');
              setV('XC Flight Class', normalizeXcClass_(best.type || ''));
              setV('FAI Triangle (km)', (tri.valid && tri.dist) ? tri.dist.toFixed(1) : '');
              setV('Points (World)', best.pointsWorld ? best.pointsWorld.toFixed(1) : '');
              setV('Points (National)', best.score ? best.score.toFixed(1) : '');
              setV('Closed?', tri.closed ? 'Yes' : 'No');
              updated.push('Scoring');
            }
          }
        }
      }
    } catch (pErr) {
      console.warn('Maintenance Physics/Scoring error row ' + rowNum, pErr);
    }
  }

  return { success: true, updated: updated };
}

/**
 * Public RPC endpoint to sort flights chronologically (most recent first).
 * Callable from client-side HTML dialogs (FlightMaintenanceDialog, URLDialog, UploadDialog).
 */
function sortFlightsByDate() {
  sortFlightsByDate_();
  return { success: true };
}

function sortFlightsByDate_() {
  var ss = SpreadsheetApp.getActive();
  var sh = ss.getSheetByName(TABS.FLIGHTS.name);
  if (!sh) return;

  var actualFlights = getActualFlightRows_(sh);
  if (actualFlights.length < 2) {
    ss.toast('Not enough flights to sort (' + actualFlights.length + ' found).', 'Flight Log');
    return;
  }

  var minRow = actualFlights[0].row;
  var maxRow = actualFlights[actualFlights.length - 1].row;
  var map = getColumnMap_(sh);
  var dateCol = map['Date'] || 8;
  var launchTimeCol = map['Launch Time'] || 10;
  var lastCol = sh.getLastColumn();

  // Multi-level sort: Date descending (primary), Launch Time descending (secondary)
  var sortSpecs = [{ column: dateCol, ascending: false }];
  if (launchTimeCol) {
    sortSpecs.push({ column: launchTimeCol, ascending: false });
  }

  // Sort only actual flight rows (from minRow to maxRow)
  var numRows = maxRow - minRow + 1;
  var dataRange = sh.getRange(minRow, 1, numRows, lastCol);
  dataRange.sort(sortSpecs);

  // Re-apply Flight No formula only to actual flight rows
  var flightNoCol = map['Flight No'] || 3;
  for (var r = minRow; r <= maxRow; r++) {
    sh.getRange(r, flightNoCol).setFormula('=IFERROR(MAX(INDIRECT("C" & (ROW()+1) & ":C")), 0) + 1');
  }

  ss.toast('Flights (' + actualFlights.length + ') sorted chronologically by date & time.', 'Flight Log');
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


/**
 * Admin action: Purges all flights marked 'Remove'.
 * Confirmation dialog prompts the user with the exact count.
 * For each purged flight:
 * - Moves its Master IGC file to TRASH_FOLDER_ID (if accessible)
 * - Deletes the row from Flights sheet (bottom-up)
 * Clears cached hashes and re-sorts flights.
 */
function purgeRemoveFlights() {
  var ss = SpreadsheetApp.getActive();
  var sh = ss.getSheetByName(TABS.FLIGHTS.name);
  if (!sh) return;

  var lastRow = sh.getLastRow();
  if (lastRow < 5) {
    ss.toast('No flight rows found to purge.', 'Flight Log');
    return;
  }

  var map = getColumnMap_(sh);
  var statusCol = map['Status'];
  var igcCol = map['IGC File'];
  if (!statusCol) {
    SpreadsheetApp.getUi().alert('Status column not found in Flights sheet.');
    return;
  }

  var numRows = lastRow - 4;
  var statusVals = sh.getRange(5, statusCol, numRows, 1).getValues();
  var rowsToRemove = [];

  for (var i = 0; i < statusVals.length; i++) {
    var val = String(statusVals[i][0] || '').trim();
    if (val === 'Remove') {
      rowsToRemove.push(5 + i);
    }
  }

  if (rowsToRemove.length === 0) {
    SpreadsheetApp.getUi().alert('No flights marked \'Remove\' were found.\n\nTo mark flights for deletion, select \'Remove\' in the Status column dropdown.');
    return;
  }

  var ui = SpreadsheetApp.getUi();
  var resp = ui.alert(
    'Confirm Purge Flights',
    'Found ' + rowsToRemove.length + ' flight(s) marked \'Remove\'.\n\n' +
    'This will:\n' +
    '1. Move their Master IGC file(s) to the Trash / Discard folder\n' +
    '2. Delete their row(s) from the Flights sheet\n' +
    '3. Remove their hashes from deduplication tracking\n\n' +
    'Do you want to proceed?',
    ui.ButtonSet.YES_NO
  );

  if (resp !== ui.Button.YES) {
    ss.toast('Purge cancelled by user.', 'Flight Log');
    return;
  }

  var config = getParameters_();
  var trashedFilesCount = 0;
  var deletedRowsCount = 0;

  // Process rows from bottom to top so row indices don't shift!
  rowsToRemove.sort(function(a, b) { return b - a; });

  for (var j = 0; j < rowsToRemove.length; j++) {
    var rNum = rowsToRemove[j];
    try {
      // Find IGC file link / ID
      if (igcCol) {
        var cell = sh.getRange(rNum, igcCol);
        var igcVal = String(cell.getValue() || '');
        var igcFormula = String(cell.getFormula() || '');
        var rt = cell.getRichTextValue();
        var linkUrl = rt ? String(rt.getLinkUrl() || '') : '';

        var idMatch = igcFormula.match(/id=([a-zA-Z0-9_-]+)/) ||
                      linkUrl.match(/id=([a-zA-Z0-9_-]+)/) ||
                      igcVal.match(/id=([a-zA-Z0-9_-]+)/);

        var fileToTrash = null;
        if (idMatch && idMatch[1]) {
          try {
            fileToTrash = DriveApp.getFileById(idMatch[1]);
          } catch (fErr) {
            console.warn('Could not find file by ID ' + idMatch[1] + ' for row ' + rNum + ': ' + fErr.message);
          }
        }

        // Fallback: search Master Log folder by file name
        if (!fileToTrash && igcVal) {
          var cleanName = igcVal.replace(/^=HYPERLINK\("[^"]*",\s*"([^"]+)"\)$/i, '$1').trim();
          if (cleanName && cleanName.match(/\.(igc|igx)$/i)) {
            var masterFolderId = cleanDriveId_(config.MASTER_LOG_FOLDER_ID);
            if (masterFolderId) {
              try {
                var mFolder = DriveApp.getFolderById(masterFolderId);
                var fIter = mFolder.getFilesByName(cleanName);
                if (fIter.hasNext()) {
                  fileToTrash = fIter.next();
                }
              } catch (mfErr) {
                console.warn('Could not find file by name ' + cleanName + ': ' + mfErr.message);
              }
            }
          }
        }

        if (fileToTrash) {
          try {
            moveToTrashFolder_(fileToTrash, fileToTrash.getName(), config);
            trashedFilesCount++;
          } catch (tErr) {
            console.warn('Could not move Master IGC file for row ' + rNum + ': ' + tErr.message);
          }
        }
      }

      sh.deleteRow(rNum);
      deletedRowsCount++;
    } catch (rErr) {
      console.error('Error purging row ' + rNum + ':', rErr);
    }
  }

  // Invalidate in-memory cache
  if (typeof _cachedSheetHashes !== 'undefined') {
    _cachedSheetHashes = null;
  }

  // Re-sort flights
  try {
    sortFlightsByDate_();
  } catch (sortErr) {
    console.warn('Post-purge sort warning:', sortErr);
  }

  ui.alert(
    'Purge Completed',
    'Successfully purged ' + deletedRowsCount + ' flight(s).\n' +
    (trashedFilesCount > 0 ? (trashedFilesCount + ' Master IGC file(s) moved to Trash folder.\n') : '') +
    'The logbook has been re-sorted and deduplication hashes refreshed.',
    ui.ButtonSet.OK
  );
}

/**
 * Scans the Flights sheet for all rows marked with Status = 'Remove'.
 * Used by PurgeDialog.html.
 */
function getPurgeCandidateFlightsStatus() {
  try {
    var ss = SpreadsheetApp.getActive();
    var sh = ss.getSheetByName(TABS.FLIGHTS.name);
    if (!sh || sh.getLastRow() < 5) {
      return { count: 0, flights: [] };
    }
    var map = getColumnMap_(sh);
    var statusCol = map['Status'];
    var idCol = map['FlightID'];
    var dateCol = map['Date'];
    var igcCol = map['IGC File'];
    if (!statusCol) return { count: 0, flights: [], error: 'Status column not found' };

    var numRows = sh.getLastRow() - 4;
    var data = sh.getRange(5, 1, numRows, sh.getLastColumn()).getValues();
    var flights = [];

    // Scan from bottom to top so deletion order is clean
    for (var i = data.length - 1; i >= 0; i--) {
      var row = data[i];
      var st = String(row[statusCol - 1] || '').trim();
      if (st === 'Remove') {
        var flightId = idCol ? String(row[idCol - 1] || '') : '';
        flightId = flightId.replace(/=HYPERLINK\("[^"]*",\s*"([^"]+)"\)/, '$1').trim();
        var fDate = dateCol ? formatDateToYmd_(row[dateCol - 1]) : '';
        var igcName = igcCol ? String(row[igcCol - 1] || '') : '';
        igcName = igcName.replace(/=HYPERLINK\("[^"]*",\s*"([^"]+)"\)/, '$1').trim();

        flights.push({
          rowNum: 5 + i,
          flightId: flightId,
          date: fDate,
          name: igcName
        });
      }
    }

    return {
      count: flights.length,
      flights: flights
    };
  } catch (e) {
    return { count: 0, flights: [], error: e.message };
  }
}

/**
 * Purges a single candidate flight (trashes Master IGC and deletes sheet row).
 * Used by PurgeDialog.html.
 */
function purgeSingleCandidateFlight(flightInfo) {
  try {
    var ss = SpreadsheetApp.getActive();
    var sh = ss.getSheetByName(TABS.FLIGHTS.name);
    if (!sh || sh.getLastRow() < 5) return { success: false, error: 'Flights sheet is empty' };

    var config = getParameters_();
    var map = getColumnMap_(sh);
    var idCol = map['FlightID'];
    var igcCol = map['IGC File'];

    // Locate target row by matching FlightID first (safest against row shifts)
    var targetRow = flightInfo.rowNum;
    if (idCol && flightInfo.flightId) {
      var numRows = sh.getLastRow() - 4;
      var idValues = sh.getRange(5, idCol, numRows, 1).getValues();
      for (var r = 0; r < idValues.length; r++) {
        var curId = String(idValues[r][0] || '').replace(/=HYPERLINK\("[^"]*",\s*"([^"]+)"\)/, '$1').trim();
        if (curId === flightInfo.flightId) {
          targetRow = 5 + r;
          break;
        }
      }
    }

    if (targetRow < 5 || targetRow > sh.getLastRow()) {
      return { success: false, error: 'Target row out of bounds' };
    }

    // Attempt to trash Master IGC file
    var trashed = false;
    if (igcCol) {
      var cell = sh.getRange(targetRow, igcCol);
      var igcVal = String(cell.getValue() || '');
      var igcFormula = String(cell.getFormula() || '');
      var rt = cell.getRichTextValue();
      var linkUrl = rt ? String(rt.getLinkUrl() || '') : '';

      var idMatch = igcFormula.match(/id=([a-zA-Z0-9_-]+)/) ||
                    linkUrl.match(/id=([a-zA-Z0-9_-]+)/) ||
                    igcVal.match(/id=([a-zA-Z0-9_-]+)/);

      var fileToTrash = null;
      if (idMatch && idMatch[1]) {
        try { fileToTrash = DriveApp.getFileById(idMatch[1]); } catch (e) {}
      }

      if (!fileToTrash && igcVal) {
        var cleanName = igcVal.replace(/^=HYPERLINK\("[^"]*",\s*"([^"]+)"\)$/i, '$1').trim();
        if (cleanName && cleanName.match(/\.(igc|igx)$/i)) {
          var mFolderId = cleanDriveId_(config.MASTER_LOG_FOLDER_ID);
          if (mFolderId) {
            try {
              var mFolder = DriveApp.getFolderById(mFolderId);
              var fIter = mFolder.getFilesByName(cleanName);
              if (fIter.hasNext()) fileToTrash = fIter.next();
            } catch (e) {}
          }
        }
      }

      if (fileToTrash) {
        try {
          moveToTrashFolder_(fileToTrash, fileToTrash.getName(), config);
          trashed = true;
        } catch (tErr) {
          console.warn('Could not trash file for ' + flightInfo.flightId, tErr);
        }
      }
    }

    sh.deleteRow(targetRow);
    return { success: true, flightId: flightInfo.flightId, trashed: trashed };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

/**
 * Finalizes purge action by resetting deduplication caches and sorting logbook.
 */
function finalizePurge_() {
  if (typeof _cachedSheetHashes !== 'undefined') {
    _cachedSheetHashes = null;
  }
  try {
    sortFlightsByDate_();
  } catch (e) {
    console.warn('Post-purge sort warning:', e);
  }
  return { success: true };
}

/**
 * Public RPC Gateway for PurgeDialog.html.
 */
function finalizePurge() {
  return finalizePurge_();
}

/**
 * Counts duplicate flights for MarkDuplicatesDialog.html.
 */
function getDuplicateCounts() {
  var ss = SpreadsheetApp.getActive();
  var sh = ss.getSheetByName(TABS.FLIGHTS.name);
  if (!sh || sh.getLastRow() < 5) {
    return { dupOthersCount: 0, dupPrimaryCount: 0 };
  }
  var map = getColumnMap_(sh);
  var statusCol = map['Status'];
  if (!statusCol) return { dupOthersCount: 0, dupPrimaryCount: 0 };

  var numRows = sh.getLastRow() - 4;
  var statuses = sh.getRange(5, statusCol, numRows, 1).getValues();
  var others = 0;
  var primary = 0;
  for (var i = 0; i < statuses.length; i++) {
    var st = String(statuses[i][0] || '').trim();
    if (st === 'Dup-Others') others++;
    else if (st === 'Dup-Primary') primary++;
  }
  return { dupOthersCount: others, dupPrimaryCount: primary };
}

/**
 * Bulk updates selected duplicate flights to Status = 'Remove'.
 * Used by MarkDuplicatesDialog.html.
 */
function markDuplicatesForRemoval_(includeOthers, includePrimary) {
  var ss = SpreadsheetApp.getActive();
  var sh = ss.getSheetByName(TABS.FLIGHTS.name);
  if (!sh || sh.getLastRow() < 5) {
    return { success: false, total: 0, error: 'Flights sheet is empty' };
  }
  var map = getColumnMap_(sh);
  var statusCol = map['Status'];
  if (!statusCol) return { success: false, total: 0, error: 'Status column not found' };

  var numRows = sh.getLastRow() - 4;
  var statusRange = sh.getRange(5, statusCol, numRows, 1);
  var statusValues = statusRange.getValues();
  var updatedOthers = 0;
  var updatedPrimary = 0;

  for (var i = 0; i < statusValues.length; i++) {
    var st = String(statusValues[i][0] || '').trim();
    if (includeOthers && st === 'Dup-Others') {
      statusValues[i][0] = 'Remove';
      updatedOthers++;
    } else if (includePrimary && st === 'Dup-Primary') {
      statusValues[i][0] = 'Remove';
      updatedPrimary++;
    }
  }

  var total = updatedOthers + updatedPrimary;
  if (total > 0) {
    statusRange.setValues(statusValues);
    logImport_(new Date(), '', '', 'Mark Duplicates', 'Updated', 'Marked ' + total + ' flights as Remove (Others: ' + updatedOthers + ', Primary: ' + updatedPrimary + ')');
  }

  return {
    success: true,
    total: total,
    updatedOthers: updatedOthers,
    updatedPrimary: updatedPrimary
  };
}

/**
 * Public RPC Gateway for MarkDuplicatesDialog.html.
 */
function markDuplicatesForRemoval(includeOthers, includePrimary) {
  return markDuplicatesForRemoval_(includeOthers, includePrimary);
}

/**
 * Maps a parameter key and sheet section to one of the 5 granular configuration groups.
 */
function getParameterGroup_(key, section) {
  var s = String(section || '').trim();
  if (s === 'Ingestion' || key.indexOf('FOLDER') !== -1 || key.indexOf('WATCH') !== -1) {
    return 'Ingestion and Folders';
  }
  if (s === 'Integrations' || s === 'Geo & Time' || key.indexOf('WEATHER') !== -1 || key.indexOf('GEO_') !== -1 || key.indexOf('XCONTEST') !== -1 || key === 'CONTACT_EMAIL') {
    return 'Integrations';
  }
  if (s === 'Validation' || s === 'Analysis Rules' || s === 'Analysis - Adv' || s === 'Scoring' || key.indexOf('VALIDATION') !== -1 || key.indexOf('THERMAL') !== -1 || key.indexOf('SOAR') !== -1 || key.indexOf('GLIDE') !== -1 || key.indexOf('SINK') !== -1 || key.indexOf('BONUS') !== -1) {
    return 'Flight Scoring, Physics and Analysis';
  }
  if (s === 'Format and Units' || s === 'Lists' || key === 'DATE_FORMAT' || key === 'TIME_FORMAT') {
    return 'Formats and Units';
  }
  if (s === 'Dashboard & Currency' || s === 'UI' || key.indexOf('TIMELINE') !== -1) {
    return 'UI (dashboard etc)';
  }
  return 'Integrations';
}

/**
 * Serializes configuration from Pilot_Profile and Config into JSON string.
 * Used by SaveConfigDialog.html.
 */
function exportConfigJson_(options) {
  var ss = SpreadsheetApp.getActive();
  var result = {
    system: 'Paragliding Flight Log',
    version: '2.0',
    exportedAt: new Date().toISOString(),
    sections: {}
  };

  // 1. Pilot Profile (Pure Key-Value: Col A = Field, Col B = Value)
  if (options && options.pilotProfile) {
    var shP = ss.getSheetByName(TABS.PILOT_PROFILE ? TABS.PILOT_PROFILE.name : 'Pilot_Profile');
    if (shP && shP.getLastRow() >= 4) {
      result.sections.pilotProfile = {};
      var numCols = Math.min(shP.getLastColumn(), 3);
      var pData = shP.getRange(4, 1, shP.getLastRow() - 3, numCols).getValues();
      pData.forEach(function(row) {
        var k = String(row[0]).trim();
        // Skip section headers '[ ... ]' and empty fields
        if (k && k.indexOf('[') !== 0) {
          result.sections.pilotProfile[k] = row[1];
        }
      });
    }
  }

  // 2. System Parameters (Organized into 5 Granular Sub-Groups)
  if (options && options.parameters) {
    result.sections.parameters = {};
    var paramGroups = (options && options.paramGroups) || {};
    var shC = ss.getSheetByName(TABS.CONFIG.name);
    if (shC && shC.getLastRow() >= 3) {
      var cData = shC.getRange(3, 1, shC.getLastRow() - 2, 2).getValues();
      var currentSection = 'General';
      cData.forEach(function(row) {
        var k = String(row[0]).trim();
        var v = row[1];
        if (k.indexOf('[') === 0) {
          currentSection = k.replace(/[\[\]]/g, '').trim();
        } else if (k && v !== '') {
          var groupName = getParameterGroup_(k, currentSection);
          var includeGroup = true;
          if (groupName === 'Ingestion and Folders' && paramGroups.ingestion === false) includeGroup = false;
          if (groupName === 'Integrations' && paramGroups.integrations === false) includeGroup = false;
          if (groupName === 'Flight Scoring, Physics and Analysis' && paramGroups.scoring === false) includeGroup = false;
          if (groupName === 'Formats and Units' && paramGroups.format === false) includeGroup = false;
          if (groupName === 'UI (dashboard etc)' && paramGroups.ui === false) includeGroup = false;
          
          if (includeGroup) {
            if (!result.sections.parameters[groupName]) result.sections.parameters[groupName] = {};
            result.sections.parameters[groupName][k] = v;
          }
        }
      });
    }
  }

  // 3. Lookups (Exactly 6 Manual Controlled Vocabularies)
  if (options && options.lookups) {
    result.sections.lookups = {};
    var shC = ss.getSheetByName(TABS.CONFIG.name);
    if (shC && shC.getLastRow() >= 3) {
      var lookupDefs = [
        { key: 'Equipment Categories', col: 5, count: 4 },
        { key: 'Flight Status', col: 6, count: 6 },
        { key: 'Flight Type', col: 7, count: 7 },
        { key: 'XC Classes', col: 8, count: 4 },
        { key: 'Date Formats', col: 9, count: 5 },
        { key: 'Time Formats', col: 10, count: 2 }
      ];
      lookupDefs.forEach(function(ld) {
        var vals = shC.getRange(3, ld.col, ld.count, 1).getValues();
        result.sections.lookups[ld.key] = vals.map(function(r) { return r[0]; }).filter(function(v) { return v !== ''; });
      });
    }
  }

  var dateStamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone() || 'UTC', 'yyyyMMdd_HHmm');
  var filename = 'flight_log_config_' + dateStamp + '.json';
  return {
    json: JSON.stringify(result, null, 2),
    filename: filename
  };
}

/**
 * Public RPC Gateway for SaveConfigDialog.html.
 */
function exportConfigJson(options) {
  return exportConfigJson_(options);
}

/**
 * Applies imported configuration to Pilot_Profile and Config sheets.
 * Used by LoadConfigDialog.html.
 */
function importConfigJson_(configPayload, selectedOptions) {
  var ss = SpreadsheetApp.getActive();
  var sections = configPayload.sections || configPayload;
  var res = { success: true, profileUpdated: 0, paramsUpdated: 0, lookupsUpdated: 0 };

  // 1. Apply Pilot Profile (Match Col A Field, write strictly to Col B Value)
  if (selectedOptions && selectedOptions.pilotProfile && sections.pilotProfile) {
    var shP = ss.getSheetByName(TABS.PILOT_PROFILE ? TABS.PILOT_PROFILE.name : 'Pilot_Profile');
    if (shP && shP.getLastRow() >= 4) {
      var fieldAliases = {
        'Primary Emergency Contact': 'Primary Emergency Contact Info',
        'Primary Contact Phone': 'Primary Emergency Contact Info',
        'Secondary Contact & Phone': '2nd Emergency Contact Info',
        'License Number': 'National Licence Info',
        'FAI Sporting License #': 'FAI Sporting Licence Info',
        'Tandem / Instructor': 'Other Licensing Info',
        'License Expiration Date': 'Other Licensing Info',
        'SAR / Evacuation Insurance': 'SAR / Evac Provider Info',
        'Insurance Policy Number': 'Medical Insurance Info'
      };
      var pData = shP.getRange(4, 1, shP.getLastRow() - 3, 2).getValues();
      for (var i = 0; i < pData.length; i++) {
        var fieldKey = String(pData[i][0]).trim();
        if (fieldKey && fieldKey.indexOf('[') !== 0) {
          var valToSet = undefined;
          if (sections.pilotProfile[fieldKey] !== undefined) {
            valToSet = sections.pilotProfile[fieldKey];
          } else {
            Object.keys(fieldAliases).forEach(function(oldKey) {
              if (fieldAliases[oldKey] === fieldKey && sections.pilotProfile[oldKey] !== undefined) {
                valToSet = sections.pilotProfile[oldKey];
              }
            });
          }
          if (valToSet !== undefined) {
            shP.getRange(i + 4, 2).setValue(valToSet);
            res.profileUpdated++;
          }
        }
      }
    }
  }

  // 2. Apply Parameters (Match Col A Key, write strictly to Col B Value)
  if (selectedOptions && selectedOptions.parameters && sections.parameters) {
    var shC = ss.getSheetByName(TABS.CONFIG.name);
    if (shC && shC.getLastRow() >= 3) {
      var flatParams = {};
      var pObj = sections.parameters;
      var paramGroups = selectedOptions.paramGroups || {};

      Object.keys(pObj).forEach(function(g) {
        if (typeof pObj[g] === 'object' && pObj[g] !== null) {
          Object.keys(pObj[g]).forEach(function(k) {
            var val = pObj[g][k];
            var gName = getParameterGroup_(k, g);
            var canApply = true;
            if (gName === 'Ingestion and Folders' && paramGroups.ingestion === false) canApply = false;
            if (gName === 'Integrations' && paramGroups.integrations === false) canApply = false;
            if (gName === 'Flight Scoring, Physics and Analysis' && paramGroups.scoring === false) canApply = false;
            if (gName === 'Formats and Units' && paramGroups.format === false) canApply = false;
            if (gName === 'UI (dashboard etc)' && paramGroups.ui === false) canApply = false;
            if (canApply) flatParams[k] = val;
          });
        } else {
          var k = g;
          var val = pObj[g];
          var gName = getParameterGroup_(k, '');
          var canApply = true;
          if (gName === 'Ingestion and Folders' && paramGroups.ingestion === false) canApply = false;
          if (gName === 'Integrations' && paramGroups.integrations === false) canApply = false;
          if (gName === 'Flight Scoring, Physics and Analysis' && paramGroups.scoring === false) canApply = false;
          if (gName === 'Formats and Units' && paramGroups.format === false) canApply = false;
          if (gName === 'UI (dashboard etc)' && paramGroups.ui === false) canApply = false;
          if (canApply) flatParams[k] = val;
        }
      });

      var cData = shC.getRange(3, 1, shC.getLastRow() - 2, 2).getValues();
      for (var j = 0; j < cData.length; j++) {
        var paramKey = String(cData[j][0]).trim();
        if (paramKey && paramKey.indexOf('[') !== 0 && flatParams[paramKey] !== undefined) {
          shC.getRange(j + 3, 2).setValue(flatParams[paramKey]);
          res.paramsUpdated++;
        }
      }
    }
  }

  // 3. Apply Lookups (Manual Controlled Vocabularies only)
  if (selectedOptions && selectedOptions.lookups && sections.lookups) {
    var shC = ss.getSheetByName(TABS.CONFIG.name);
    if (shC && shC.getLastRow() >= 3) {
      var lookupColMap = {
        'Equipment Categories': 5,
        'Categories': 5,
        'Flight Status': 6,
        'Flight Type': 7,
        'XC Classes': 8,
        'Date Formats': 9,
        'Time Formats': 10
      };
      Object.keys(sections.lookups).forEach(function(lKey) {
        var col = lookupColMap[lKey];
        if (col && Array.isArray(sections.lookups[lKey])) {
          var list = sections.lookups[lKey];
          var cellRange = shC.getRange(3, col, list.length, 1);
          cellRange.setValues(list.map(function(item) { return [item]; }));
          res.lookupsUpdated++;
        }
      });
    }
  }

  logImport_(new Date(), '', '', 'Load Config', 'Success', 'Config applied: Profile=' + res.profileUpdated + ', Params=' + res.paramsUpdated + ', Lookups=' + res.lookupsUpdated);
  return res;
}

/**
 * Public RPC Gateway for LoadConfigDialog.html.
 */
function importConfigJson(configPayload, selectedOptions) {
  return importConfigJson_(configPayload, selectedOptions);
}

/**
 * Scans Master Log Folder and returns status and list of missing IGC files.
 * Used by ResyncDialog.html.
 */
function getMissingMasterLogsStatus() {
  try {
    var ss = SpreadsheetApp.getActive();
    var sh = ss ? ss.getSheetByName(TABS.FLIGHTS.name) : null;
    if (!sh) return { error: 'Flights sheet not found.' };

    var config = getParameters_();
    var folderId = cleanDriveId_(config.MASTER_LOG_FOLDER_ID);
    if (!folderId) {
      return { error: 'Master Log Folder is not configured in Parameters.' };
    }

    var folder = null;
    try {
      folder = DriveApp.getFolderById(folderId);
    } catch (e) {
      return { error: 'Master Log Folder is inaccessible: ' + e.message };
    }

    if (!folder) {
      return { error: 'Master Log Folder could not be found with ID: ' + folderId };
    }

    // Collect all known hashes and file IDs from Flights sheet
    var knownHashes = (typeof getExistingSheetHashes_ === 'function') ? getExistingSheetHashes_(sh) : {};
    var knownFileIds = {};
    var map = getColumnMap_(sh);
    var igcCol = map['IGC File'];

    if (igcCol && sh.getLastRow() >= 5) {
      var numRows = sh.getLastRow() - 4;
      var igcRange = sh.getRange(5, igcCol, numRows, 1);
      var igcVals = igcRange.getValues();
      var igcFormulas = igcRange.getFormulas();
      var richTexts = igcRange.getRichTextValues();

      for (var k = 0; k < numRows; k++) {
        var form = String(igcFormulas[k][0] || '');
        var mForm = form.match(/id=([a-zA-Z0-9_-]+)/);
        if (mForm && mForm[1]) {
          knownFileIds[mForm[1]] = true;
        }

        var rt = richTexts ? richTexts[k][0] : null;
        if (rt) {
          var url = rt.getLinkUrl() || '';
          var mRt = url.match(/id=([a-zA-Z0-9_-]+)/);
          if (mRt && mRt[1]) {
            knownFileIds[mRt[1]] = true;
          }
        }

        var val = String(igcVals[k][0] || '');
        var mVal = val.match(/id=([a-zA-Z0-9_-]+)/);
        if (mVal && mVal[1]) {
          knownFileIds[mVal[1]] = true;
        }
      }
    }

    // Scan Master Log folder
    var files = folder.getFiles();
    var missingFiles = [];
    while (files.hasNext()) {
      var f = files.next();
      var fName = f.getName();
      if (fName.match(/\.(igc|igx)$/i)) {
        var fId = f.getId();
        if (!knownFileIds[fId]) {
          // Check hash
          try {
            var blob = f.getBlob();
            var digest = Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, blob.getDataAsString());
            var hashStr = digest.map(function(b) { return ('0' + (b & 0xFF).toString(16)).slice(-2); }).join('');
            if (!knownHashes[hashStr]) {
              missingFiles.push({ id: fId, name: fName });
            }
          } catch (eHash) {
            console.warn('Error reading Master file ' + fName, eHash);
          }
        }
      }
    }

    return {
      folderName: folder.getName(),
      files: missingFiles
    };
  } catch (err) {
    return { error: err.message };
  }
}

/**
 * Restores a single file from Master Log folder by ID.
 * Used by ResyncDialog.html.
 */
function restoreSingleMasterFlight(fileId) {
  try {
    var file = DriveApp.getFileById(fileId);
    if (!file) return { success: false, name: fileId, error: 'File not found in Drive' };
    var fName = file.getName();
    var blob = file.getBlob();
    var config = getParameters_();

    var success = processSingleIgcBlob_(blob, fName, file.getId(), fName, config);
    if (success) {
      return { success: true, name: fName, msg: 'Restored to Flights sheet' };
    } else {
      return { success: false, name: fName, error: 'Skipped (Duplicate or already present)' };
    }
  } catch (e) {
    return { success: false, name: fileId, error: e.message };
  }
}

/**
 * Post-resync cleanup: resets cache and sorts logbook.
 */
function finalizeResync_() {
  if (typeof _cachedSheetHashes !== 'undefined') {
    _cachedSheetHashes = null;
  }
  try {
    sortFlightsByDate_();
  } catch (e) {
    console.warn('Post-resync sort warning:', e);
  }
  return { success: true };
}

/**
 * Public RPC Gateway for ResyncDialog.html.
 */
function finalizeResync() {
  return finalizeResync_();
}

/**
 * Admin action / Headless utility: Scans the Master Log Folder and restores any orphaned IGC files
 * that are missing from the Flights tab.
 * Helps self-heal the sheet if flight rows were accidentally deleted.
 */
function syncMasterLogsToSheet_() {
  var status = getMissingMasterLogsStatus();
  if (status.error) {
    SpreadsheetApp.getUi().alert(status.error);
    return;
  }

  if (!status.files || status.files.length === 0) {
    SpreadsheetApp.getUi().alert('All flights in the Master Log folder are already present in the Flights sheet. No missing flights found.');
    return;
  }

  var ui = SpreadsheetApp.getUi();
  var confirm = ui.alert(
    'Sync Master Log Folder',
    'Found ' + status.files.length + ' flight file(s) in Master Log folder that are missing from the Flights tab.\n\n' +
    'Would you like to restore them to the Flights tab as \'Review?\'?',
    ui.ButtonSet.YES_NO
  );

  if (confirm !== ui.Button.YES) return;

  var restoredCount = 0;
  for (var m = 0; m < status.files.length; m++) {
    var res = restoreSingleMasterFlight(status.files[m].id);
    if (res && res.success) {
      restoredCount++;
    }
  }

  if (restoredCount > 0) {
    finalizeResync_();
  }

  ui.alert(
    'Sync Complete',
    'Successfully restored ' + restoredCount + ' flight(s) from Master Log folder to the Flights tab.\n' +
    'They have been added with status \'Review?\' and the logbook has been re-sorted.',
    ui.ButtonSet.OK
  );
}

/* ==========================================================================================
   PARAMETER UPDATES & FOLDER PICKER (UI Helpers)
   ========================================================================================== */

/* Folder Updaters (Open In-App Folder Picker Dialog) */
function uiUpdateWatchFolder_() { openFolderPicker_('WATCH_FOLDER_ID', 'Watch Folder'); }
function uiUpdateUploadFolder_() { openFolderPicker_('UPLOAD_FOLDER_ID', 'Upload Folder'); }
function uiUpdateMasterLogFolder_() { openFolderPicker_('MASTER_LOG_FOLDER_ID', 'Master Log Folder'); }
function uiUpdateErrorFolder_() { openFolderPicker_('ERROR_FOLDER_ID', 'Error Folder'); }
function uiUpdateTrashFolder_() { openFolderPicker_('TRASH_FOLDER_ID', 'Trash / Discard Folder'); }

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
    var cleanId = cleanDriveId_(folderId);
    var finalValue = cleanId;
    
    // Handle multi-folder append for WATCH_FOLDER_ID
    if (key === 'WATCH_FOLDER_ID' && mode === 'append') {
      var currentConfig = getParameters_();
      var existingIds = String(currentConfig.WATCH_FOLDER_ID || '').split(',').map(function(s){ return cleanDriveId_(s.trim()); }).filter(Boolean);
      if (existingIds.indexOf(cleanId) === -1) {
        existingIds.push(cleanId);
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
  var sh = ss.getSheetByName(TABS.CONFIG.name);
  if (!sh) return;
  
  var data = sh.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) { 
    if (String(data[i][0]).trim() === key) {
      sh.getRange(i + 1, 2).setValue(value);
      
      // Update Description with human-readable path if it's a folder parameter
      var isFolderParam = (key === 'WATCH_FOLDER_ID' || key === 'UPLOAD_FOLDER_ID' || key === 'MASTER_LOG_FOLDER_ID' || key === 'ERROR_FOLDER_ID' || key === 'TRASH_FOLDER_ID');
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

/**
 * Public wrapper for high-speed bulk batch ingestion.
 * Must not have a trailing underscore so client-side HTML dialogs can dispatch it.
 */
function processBulkBatch(batchFiles, options) {
  return INGESTION.processBulkBatch(batchFiles, options);
}

/**
 * Public wrapper for finalizing bulk import by sorting the logbook chronologically.
 */
function finalizeBulkImport() {
  sortFlightsByDate_();
  return { success: true, message: 'All flights imported and logbook sorted.' };
}

/* ==========================================================================================
   PUBLIC WRAPPERS FOR UI MENU CALLBACKS
   ========================================================================================== */

function scaffoldAll() { return scaffoldAll_(); }
function scaffoldPilotProfile() { return scaffoldPilotProfile_(SpreadsheetApp.getActive()); }
function deleteSystemSheets() { return deleteSystemSheets_(); }
function backupSystemSheets() { return backupSystemSheets_(); }
function setupWatcherTrigger() { return setupWatcherTrigger_(); }
function uiRefreshDashboard() { return uiRefreshDashboard_(); }
function uiRefreshUserGuide() { return uiRefreshUserGuide_(); }
function updateValidationOnly() { return updateValidationOnly_(); }
function reapplyFormatting() { return reapplyFormatting_(); }
function uiAddManualFlight() { return uiAddManualFlight_(); }
function uiUpdateWatchFolder() { return uiUpdateWatchFolder_(); }
function uiUpdateUploadFolder() { return uiUpdateUploadFolder_(); }
function uiUpdateMasterLogFolder() { return uiUpdateMasterLogFolder_(); }
function uiUpdateErrorFolder() { return uiUpdateErrorFolder_(); }
function uiUpdateTrashFolder() { return uiUpdateTrashFolder_(); }

