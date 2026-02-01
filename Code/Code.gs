/**
 * Paragliding Flight Log v2.0
 * 
 * CORE MODULE: Configuration, Menus, Scaffolding, Helpers.
 */

/* ==========================================================================================
   CONFIG & TYPES
   ========================================================================================== */

var CFG = {
  sheets: {
    flights: 'Flights',
    wings: 'Equipment_Wings',
    harnesses: 'Equipment_Harnesses',
    reserves: 'Equipment_Reserves',
    lookups: 'Lookups',
    importLog: 'Import_Log',
    sites: 'Sites' // Optional
  },
  // Default values used if Lookups sheet is missing an entry
  defaults: {
    WATCH_PERIOD_MIN: 15,
    OSM_RADIUS_M: 3000,
    REVGEO_PROVIDER: 'nominatim',
    NATIONAL_BONUS_WITHIN_PCT: 5,
    NATIONAL_BONUS_MULTIPLIER: 1.2,
    
    // Flight Mode Defaults
    THERMAL_MIN_CLIMB: 0.3,
    THERMAL_MIN_TURN: 8,
    SOAR_TURN_MAX: 5,
    SOAR_VARIO_MIN: -0.2,
    SOAR_VARIO_MAX: 1.5,
    GLIDE_TURN_MAX: 5,
    GLIDE_LD_TOL_PCT: 30,
    GLIDE_VARIO_MAX: 0.2,
    SINK_TURN_MAX: 10,
    SINK_VARIO: -2.5,
    
    // Analysis Windows
    MODE_WINDOW_SEC: 10,
    REVERSAL_WINDOW_SEC: 30,
    MODE_HYSTERESIS_SEC: 6,

    // Validation Thresholds
    VALIDATION_MIN_DURATION_SEC: 120,   // 2 minutes
    VALIDATION_MIN_HEIGHT_CHANGE_M: 20, // 20 meters
    VALIDATION_MAX_SPEED_KMH: 120,      // Driving?
    VALIDATION_MAX_AVG_SPEED_KMH: 60,   // Fast driving?

    FLIGHT_TYPES: 'Free Fly, XC, Soaring, Comp, SIV / Maneuvers, Training, Other',
    DATE_FORMAT: 'yyyy-MM-dd',
    TIME_FORMAT: 'HH:mm:ss'
  }
};

/* ==========================================================================================
   MENU & TRIGGERS
   ========================================================================================== */

function onOpen(e) {
  SpreadsheetApp.getUi()
    .createMenu('Flight Log')
    .addItem('Add manual flight (blank row)', 'uiAddManualFlight_')
    .addItem('Add flight from IGC (URL/Drive ID)...', 'uiAddFlightFromIgc_')
    .addSeparator()
    .addItem('Scan Watch Folder now', 'scanWatchFolderNow_')
    .addItem('Recompute selected flight(s)', 'uiRecomputeSelected_')
    .addSeparator()
    .addSubMenu(SpreadsheetApp.getUi().createMenu('Setup & Tools')
        .addItem('Scaffold: Create tabs & headers', 'scaffoldAll_')
        .addItem('Setup 5-min watcher trigger', 'setupWatcherTrigger_')
        .addItem('Debug: Clear dedupe cache', 'debugClearDedupe_'))
    .addToUi();
}

/* ==========================================================================================
   CONFIGURATION (LOOKUPS)
   ========================================================================================== */

/** 
 * Reads all settings from the Lookups sheet, falling back to CFG.defaults.
 * Returns an object with key-value pairs (types converted where possible).
 */
function getLookups_() {
  var ss = SpreadsheetApp.getActive();
  var sh = ss.getSheetByName(CFG.sheets.lookups);
  var config = JSON.parse(JSON.stringify(CFG.defaults)); // Clone defaults
  
  if (sh) {
    var last = sh.getLastRow();
    if (last > 1) {
      try {
        var params = sh.getRange(2, 1, last - 1, 2).getValues();
        params.forEach(function(row) {
          var key = String(row[0]).trim();
          var val = row[1];
          if (key && val !== '') {
            // Type conversion
             if (!isNaN(Number(val)) && val !== '') {
               config[key] = Number(val);
             } else {
               config[key] = val;
             }
          }
        });
      } catch (e) {
        console.error('Error reading Lookups:', e);
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
   SCAFFOLDING (Tab Creation)
   ========================================================================================== */

function scaffoldAll_() {
  var ss = SpreadsheetApp.getActive();
  
  scaffoldLookups_(ss);
  scaffoldEquipment_(ss);
  scaffoldFlights_(ss);
  scaffoldImportLog_(ss);
  
  ss.toast('Scaffolding complete. Please fill in Lookups/Equipment tabs.');
}

function ensureSheet_(ss, name) {
  var sh = ss.getSheetByName(name);
  if (!sh) {
    sh = ss.insertSheet(name);
  }
  return sh;
}

function scaffoldLookups_(ss) {
  var sh = ensureSheet_(ss, CFG.sheets.lookups);
  if (sh.getLastRow() === 0) {
    sh.getRange(1, 1, 1, 2).setValues([['Parameter', 'Value']]);
    sh.getRange(1, 1, 1, 2).setFontWeight('bold').setBackground('#EFEFEF');
    
    // Seed with all defaults
    var rows = [];
    rows.push(['WATCH_FOLDER_ID', '']);
    rows.push(['CONTACT_EMAIL', '']); // Required
    
    Object.keys(CFG.defaults).forEach(function(k) {
       rows.push([k, CFG.defaults[k]]);
    });
    
    sh.getRange(2, 1, rows.length, 2).setValues(rows);
    sh.autoResizeColumns(1, 2);
  }
}

function scaffoldEquipment_(ss) {
  // Wings
  var shW = ensureSheet_(ss, CFG.sheets.wings);
  if (shW.getLastRow() === 0) {
    var head = ['WingID', 'Make', 'Model', 'Size', 'Default?', 'GlideRatio_LD', 'Trim_kmh', 'FullBar_kmh', 'Serial', 'InServiceFrom', 'InServiceTo', 'RetiredFlag', 'Notes'];
    shW.appendRow(head);
    shW.getRange(1, 1, 1, head.length).setFontWeight('bold').setBackground('#E0F7FA');
    shW.appendRow(['Example-Wing', 'Ozone', 'Photon', 'MS', false, 10.5, 39, 58, '', '', '', false, 'Edit this row']);
    shW.getRange(2, 5).insertCheckboxes(); // Default? col
  }
  
  // Harnesses
  var shH = ensureSheet_(ss, CFG.sheets.harnesses);
  if (shH.getLastRow() === 0) {
    var head = ['HarnessID', 'Make', 'Model', 'Category', 'Default?', 'InServiceFrom', 'InServiceTo', 'RetiredFlag', 'Notes'];
    shH.appendRow(head);
    shH.getRange(1, 1, 1, head.length).setFontWeight('bold').setBackground('#E0F2F1');
    shH.appendRow(['Example-Harness', 'SupAir', 'Delight 4', 'Pod', false, '', '', false, 'Edit this row']);
    shH.getRange(2, 5).insertCheckboxes();
  }
  
  // Reserves
  var shR = ensureSheet_(ss, CFG.sheets.reserves);
  if (shR.getLastRow() === 0) {
    var head = ['ReserveID', 'Make', 'Model', 'Size', 'Default?', 'PackDate', 'InServiceFrom', 'InServiceTo', 'RetiredFlag', 'Notes'];
    shR.appendRow(head);
    shR.getRange(1, 1, 1, head.length).setFontWeight('bold').setBackground('#FFFDE7');
    shR.appendRow(['Example-Reserve', 'Beamer', '3', '130', false, '', '', '', false, '']);
    shR.getRange(2, 5).insertCheckboxes();
  }
}

function scaffoldImportLog_(ss) {
  var sh = ensureSheet_(ss, CFG.sheets.importLog);
  if (sh.getLastRow() === 0) {
    var head = ['Timestamp', 'FileID', 'FileName', 'InnerName', 'Status', 'Notes'];
    sh.appendRow(head);
    sh.getRange(1, 1, 1, head.length).setFontWeight('bold').setBackground('#F5F5F5');
    sh.setFrozenRows(1);
  }
}

/* ==========================================================================================
   FLIGHTS SHEET SCAFFOLDING (Column Groups)
   ========================================================================================== */

function scaffoldFlights_(ss) {
  var sh = ensureSheet_(ss, CFG.sheets.flights);
  
  // Headers row 4 & 5
  // We need 5 frozen rows (1-3 optional info, 4 Category, 5 Header)
  if (sh.getMaxRows() < 10) sh.insertRows(1, 10);
  sh.setFrozenRows(5);
  
  // Define Groups & Columns
  // Group Structure: { name: 'Basic', color: '#...', cols: ['Status', ...] }
  var groups = [
    { name: 'Flight Info', color: '#D1C4E9', cols: ['Status', 'Flight No', 'Auto Summary', 'FlightID', 'Flight Type', 'Date', 'Launch Time', 'Landing Time', 'Flight Duration', 'Track Length (km)', 'Straight Dist (km)'] },
    { name: 'Gear', color: '#B3E5FC', cols: ['Wing', 'Harness', 'Reserve 1', 'Reserve 2', 'Other equipment', 'GlideRatio_LD (snap)', 'Trim_kmh (snap)', 'FullBar_kmh (snap)'] },
    { name: 'XC Scoring', color: '#FFCCBC', cols: ['XC Distance (km)', 'XC Score', 'XC Flight Class', 'FAI Triangle (km)', 'Points (World)', 'Points (National)', 'Closed?', 'Max Alt (m)', 'Min Alt (m)', 'Total Height Gain (m)', 'Max Ascent (m/s)', 'Max Descent (m/s)', 'Max Groundspeed (km/h)', 'Avg Groundspeed (km/h)'] },
    { name: 'Launch', color: '#C8E6C9', cols: ['Launch Lat', 'Launch Lon', 'Launch Site', 'Launch Town', 'Launch Country', 'Launch Region', 'Launch Alt (m)'] },
    { name: 'Landing', color: '#DCEDC8', cols: ['Landing Lat', 'Landing Lon', 'Landing Site', 'Landing Town', 'Landing Country', 'Landing Region', 'Landing Alt (m)', 'Launch-Landing Dist (km)'] },
    { name: 'Weather', color: '#F0F4C3', cols: ['Wind@Launch', 'Wind@Landing', 'Cloud %', 'Cloudbase', 'Temp (C)', 'Observations'] },
    { name: 'Analytics', color: '#E1BEE7', cols: ['Thermal %', 'Thermals Count', 'Thermal Avg (m/s)', 'Thermal Best (m/s)', 'Soar %', 'Efficiency', 'Glide %', 'Glide L/D', 'Sink %', 'Sink Time'] },
    { name: 'Validation', color: '#FFCDD2', cols: ['Validation Status', 'Val: Reason'] },
    { name: 'Meta', color: '#CFD8DC', cols: ['Import File', 'Import ID', 'Timestamp', 'Parser Ver'] }
  ];
  
  var flatHeaders = [];
  var colIndex = 1;
  
  groups.forEach(function(g) {
    var groupLen = g.cols.length;
    flatHeaders = flatHeaders.concat(g.cols);
    
    // Row 4: Category Header
    var rangeCat = sh.getRange(4, colIndex, 1, groupLen);
    rangeCat.merge();
    rangeCat.setValue(g.name);
    rangeCat.setBackground(g.color);
    rangeCat.setHorizontalAlignment('center');
    rangeCat.setBorder(true, true, true, true, false, false, "medium", null); // Box border
    
    // Row 5: Column Headers
    var rangeHead = sh.getRange(5, colIndex, 1, groupLen);
    rangeHead.setValues([g.cols]);
    rangeHead.setFontWeight('bold');
    rangeHead.setBorder(true, true, true, true, true, true); // All borders
    
    // Grouping
    if (groupLen > 1) {
       // Start from colIndex + 3 (Keep first 3 visible for Flight Info)
       // Flight Info has 11 cols. We want to keep Status(1), No(2), Summary(3) visible. Collapse 4..11.
       var startCollapse = -1;
       var endCollapse = -1;
       
       if (g.name === 'Flight Info') {
          startCollapse = colIndex + 3;
          endCollapse = colIndex + groupLen - 1;
       } else {
          // Flatten specific groups by default
          if (['Gear', 'Analytics', 'Meta', 'Validation'].indexOf(g.name) > -1) {
            startCollapse = colIndex + 1;
            endCollapse = colIndex + groupLen - 1;
          }
       }
       
       if (startCollapse > 0 && endCollapse >= startCollapse) {
         try {
           var grpRange = sh.getRange(1, startCollapse, sh.getMaxRows(), (endCollapse - startCollapse + 1));
           grpRange.shiftColumnGroupDepth(1);
           if (['Gear', 'Analytics', 'Meta', 'Validation', 'Flight Info'].indexOf(g.name) > -1) {
              sh.getColumnGroup(startCollapse, 1).collapse();
           }
         } catch(e) { console.warn('Group exist', e); }
       }
    }
    
    colIndex += groupLen;
    SpreadsheetApp.flush(); // Flush after each group to prevent timeout
  });
  
  SpreadsheetApp.flush(); // Force write headers/groups before validation

  // Data Validation: Status
  var maxRows = sh.getMaxRows();
  var valRows = maxRows - 5;
  if (valRows < 1) valRows = 1; // Safety

  try {
    var ruleStatus = SpreadsheetApp.newDataValidation()
      .requireValueInList(['Needs Review', 'Valid', 'Invalid', 'Duplicate'], true)
      .setAllowInvalid(true)
      .build();
    sh.getRange(6, 1, valRows, 1).setDataValidation(ruleStatus);
  } catch (e) {
    console.warn('Status validation error', e); 
  }

  // Conditional Formatting Status
  try {
    var rules = sh.getConditionalFormatRules();
    // Clear old status rules if any (simplistic: just append new ones)
    // Needs Review: Yellow
    rules.push(SpreadsheetApp.newConditionalFormatRule().whenTextEqualTo('Needs Review').setBackground('#FFF9C4').setRanges([sh.getRange(6,1,valRows,1)]).build());
    // Valid: Green
    rules.push(SpreadsheetApp.newConditionalFormatRule().whenTextEqualTo('Valid').setBackground('#C8E6C9').setRanges([sh.getRange(6,1,valRows,1)]).build());
    // Invalid: Red
    rules.push(SpreadsheetApp.newConditionalFormatRule().whenTextEqualTo('Invalid').setBackground('#FFCDD2').setRanges([sh.getRange(6,1,valRows,1)]).build());
    // Duplicate: Orange
    rules.push(SpreadsheetApp.newConditionalFormatRule().whenTextEqualTo('Duplicate').setBackground('#FFE0B2').setRanges([sh.getRange(6,1,valRows,1)]).build());
    
    sh.setConditionalFormatRules(rules);
  } catch (e) {
    console.warn('CondFormat error', e);
  }
  
  // Data Validation: Equipment
  try {
    applyDropdownFromRange_(sh, 12, CFG.sheets.wings, 'A2:A');
    applyDropdownFromRange_(sh, 13, CFG.sheets.harnesses, 'A2:A');
    applyDropdownFromRange_(sh, 14, CFG.sheets.reserves, 'A2:A');
    applyDropdownFromRange_(sh, 15, CFG.sheets.reserves, 'A2:A');
  } catch(e) {
    console.warn('Equipment validation error', e);
  }

  ss.toast('Flights sheet scaffolded with Groups & Validation.');
}

function applyDropdownFromRange_(shTarget, colIndex, sourceSheetName, sourceRangeA1) {
  var ss = SpreadsheetApp.getActive();
  var shSrc = ss.getSheetByName(sourceSheetName);
  
  if (shSrc) {
    var maxRows = shTarget.getMaxRows();
    var valRows = maxRows - 5;
    if (valRows < 1) return;
    
    // Dynamic range
    var range = shSrc.getRange(sourceRangeA1);
    var rule = SpreadsheetApp.newDataValidation().requireValueInRange(range).setAllowInvalid(true).build();
    shTarget.getRange(6, colIndex, valRows, 1).setDataValidation(rule);
  }
}

/* ==========================================================================================
   PLACEHOLDER ACTIONS
   ========================================================================================== */

function uiAddManualFlight_() {
  SpreadsheetApp.getUi().alert('Manual entry not yet implemented.');
}

function uiRecomputeSelected_() {
  SpreadsheetApp.getUi().alert('Recompute not yet implemented.');
}

function setupWatcherTrigger_() {
  // Clear old
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === 'scanWatchFolderNow_') {
      ScriptApp.deleteTrigger(triggers[i]);
    }
  }
  // Create new
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
