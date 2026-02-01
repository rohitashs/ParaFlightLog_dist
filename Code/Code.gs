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

    FLIGHT_TYPES: 'Free Fly, XC, Soaring, Comp, SIV / Maneuvers, Training, Other'
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
    var head = ['WingID', 'Make', 'Model', 'Size', 'GlideRatio_LD', 'Trim_kmh', 'FullBar_kmh', 'Serial', 'InServiceFrom', 'InServiceTo', 'RetiredFlag', 'Notes'];
    shW.appendRow(head);
    shW.getRange(1, 1, 1, head.length).setFontWeight('bold').setBackground('#E0F7FA');
    shW.appendRow(['Example-Wing', 'Ozone', 'Photon', 'MS', 10.5, 39, 58, '', '', '', false, 'Edit this row']);
  }
  
  // Harnesses
  var shH = ensureSheet_(ss, CFG.sheets.harnesses);
  if (shH.getLastRow() === 0) {
    var head = ['HarnessID', 'Make', 'Model', 'Category', 'InServiceFrom', 'InServiceTo', 'RetiredFlag', 'Notes'];
    shH.appendRow(head);
    shH.getRange(1, 1, 1, head.length).setFontWeight('bold').setBackground('#E0F2F1');
    shH.appendRow(['Example-Harness', 'SupAir', 'Delight 4', 'Pod', '', '', false, 'Edit this row']);
  }
  
  // Reserves
  var shR = ensureSheet_(ss, CFG.sheets.reserves);
  if (shR.getLastRow() === 0) {
    var head = ['ReserveID', 'Make', 'Model', 'Size', 'PackDate', 'InServiceFrom', 'InServiceTo', 'RetiredFlag', 'Notes'];
    shR.appendRow(head);
    shR.getRange(1, 1, 1, head.length).setFontWeight('bold').setBackground('#FFFDE7');
    shR.appendRow(['Example-Reserve', 'Beamer', '3', '130', '', '', '', false, '']);
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
  
  // Headers row 5
  if (sh.getMaxRows() < 6) sh.insertRows(1, 6 - sh.getMaxRows());
  sh.setFrozenRows(5);
  
  // Define Groups & Columns
  // Group Structure: { name: 'Basic', cols: ['Status', ...] }
  
  var groups = [
    { name: 'Identity', cols: ['Status', 'Flight No', 'Auto Summary', 'FlightID', 'Date', 'Launch Time', 'Flight Type'] },
    { name: 'Metrics', cols: ['Flight Duration', 'Track Length (km)', 'Straight Dist (km)'] },
    { name: 'Gear', cols: ['Wing', 'Harness', 'Reserve 1', 'Reserve 2', 'Other equipment', 'GlideRatio_LD (snap)', 'Trim_kmh (snap)', 'FullBar_kmh (snap)'] },
    { name: 'XC Scoring', cols: ['XC Distance (km)', 'XC Score', 'XC Flight Class', 'FAI Triangle (km)', 'Points (World)', 'Points (National)', 'Closed?', 'Max Alt (m)', 'Min Alt (m)', 'Total Height Gain (m)', 'Max Ascent (m/s)', 'Max Descent (m/s)', 'Max Groundspeed (km/h)', 'Avg Groundspeed (km/h)'] },
    { name: 'Launch', cols: ['Launch Lat', 'Launch Lon', 'Launch Site', 'Launch Town', 'Launch Country', 'Launch Region', 'Launch Alt (m)'] },
    { name: 'Landing', cols: ['Landing Lat', 'Landing Lon', 'Landing Site', 'Landing Town', 'Landing Country', 'Landing Region', 'Landing Alt (m)', 'Launch-Landing Dist (km)'] },
    { name: 'Weather', cols: ['Wind@Launch', 'Wind@Landing', 'Cloud %', 'Cloudbase', 'Temp (C)', 'Observations'] },
    { name: 'Analytics', cols: ['Thermal %', 'Thermals Count', 'Thermal Avg (m/s)', 'Thermal Best (m/s)', 'Soar %', 'Efficiency', 'Glide %', 'Glide L/D', 'Sink %', 'Sink Time'] },
    { name: 'Validation', cols: ['Validation Status', 'Val: Reason'] }, // New validation cols
    { name: 'Meta', cols: ['Import File', 'Import ID', 'Timestamp', 'Parser Ver'] }
  ];
  
  var flatHeaders = [];
  groups.forEach(function(g) {
    flatHeaders = flatHeaders.concat(g.cols); 
  });
  
  // Set headers
  sh.getRange(5, 1, 1, flatHeaders.length).setValues([flatHeaders]);
  sh.getRange(5, 1, 1, flatHeaders.length).setFontWeight('bold').setBorder(true, true, true, true, true, true);
  
  // Create Column Groups
  // We want to collapse everything except the first column of the group
  var colIndex = 1;
  groups.forEach(function(g) {
    var groupSize = g.cols.length;
    if (groupSize > 1) {
      // Create group from colIndex+1 to colIndex+groupSize-1
      // e.g. if group starts at 1 and has 3 cols (1, 2, 3), we group 2-3.
      var startGroup = colIndex + 1;
      var numGroup = groupSize - 1;
      
      // Check if group already exists to avoid errors (naive check: just try/catch)
      try {
        var range = sh.getRange(1, startGroup, sh.getMaxRows(), numGroup);
        // Apps Script doesn't have a direct "hasGroup" check easily, removing all groups first is cleaner but destructive.
        // For now, we attempt to shift group. Ideally we'd clear groups first.
        range.shiftColumnGroupDepth(1);
        // Collapse by default? User choice. Lets collapse Gear/Analytics/Meta by default
        if (['Gear', 'Analytics', 'Meta', 'Validation'].indexOf(g.name) > -1) {
           sh.getColumnGroup(startGroup, 1).collapse();
        }
      } catch (e) {
        // limit reached or overlap
        console.warn('Grouping skip', e);
      }
    }
    colIndex += groupSize;
  });

  ss.toast('Flights sheet scaffolded with Groups.');
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
