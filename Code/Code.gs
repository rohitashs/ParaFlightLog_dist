/**
 * Paragliding Flight Log v2.0
 * Updated: 2026-09-30 14:38:36
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
        .addItem('Flight Maintenance...', 'showFlightMaintenanceDialog')
        .addItem('Sort All Flights by Date', 'sortFlightsByDate_'))
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
             } else if (key === 'DATE_FORMAT' || key === 'TIME_FORMAT') {
               if (val instanceof Date || typeof val === 'number') {
                 config[key] = CFG.defaults[key] || (key === 'DATE_FORMAT' ? 'yyyy-MM-dd' : 'h:mm a');
               } else {
                 config[key] = String(val).trim();
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
  var singleFolderKeys = ['MASTER_LOG_FOLDER_ID', 'UPLOAD_FOLDER_ID', 'ERROR_FOLDER_ID'];
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

function showFlightMaintenanceDialog() {
  var html = HtmlService.createTemplateFromFile('FlightMaintenanceDialog')
      .evaluate()
      .setWidth(560)
      .setHeight(580);
  SpreadsheetApp.getUi().showModalDialog(html, 'Flight Maintenance');
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
              setV('XC Flight Class', best.type || '');
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
  var lastCol = sh.getLastColumn();

  // Sort only actual flight rows (from minRow to maxRow) by Date descending
  var numRows = maxRow - minRow + 1;
  var dataRange = sh.getRange(minRow, 1, numRows, lastCol);
  dataRange.sort({ column: dateCol, ascending: false });

  // Re-apply Flight No formula only to actual flight rows
  var flightNoCol = map['Flight No'] || 3;
  for (var r = minRow; r <= maxRow; r++) {
    sh.getRange(r, flightNoCol).setFormula('=IFERROR(MAX(INDIRECT("C" & (ROW()+1) & ":C")), 0) + 1');
  }

  ss.toast('Flights (' + actualFlights.length + ') sorted chronologically by date.', 'Flight Log');
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
