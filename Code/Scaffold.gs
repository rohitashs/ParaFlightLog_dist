/**
 * Paragliding Flight Log v2.0
 * Updated: 2026-02-08 20:38:56
 */
/**
 * Paragliding Flight Log v2.0 - Scaffolding & Setup
 * 
 * Contains:
 * 1. Sheet Creation & Ordering (scaffoldAll_)
 * 2. Sheet Specific Setup (scaffoldFlights_, etc)
 * 3. Validation Logic (applyFlightValidation_)
 */

/* ==========================================================================================
   MAIN ORCHESTRATION
   ========================================================================================== */

function scaffoldAll_() {
  var ss = SpreadsheetApp.getActive();
  
  // 1. Create/Ensure Sheets
  ensureSheet_(ss, TABS.OVERVIEW.name);
  ensureSheet_(ss, TABS.FLIGHTS.name);
  ensureSheet_(ss, TABS.EQUIPMENT.name);
  ensureSheet_(ss, TABS.PARAMETERS.name);
  ensureSheet_(ss, TABS.LOOKUPS.name);
  ensureSheet_(ss, TABS.APP_LOG.name);
  
  // 2. Scaffolding Content
  scaffoldOverview_(ss);
  scaffoldParameters_(ss);
  scaffoldEquipment_(ss);
  scaffoldLookups_(ss);
  scaffoldFlights_(ss);
  scaffoldAppLog_(ss);
  
  // 3. Reorder Tabs
  var sheets = [
    TABS.OVERVIEW.name, 
    TABS.FLIGHTS.name, 
    TABS.EQUIPMENT.name, 
    TABS.PARAMETERS.name, 
    TABS.LOOKUPS.name, 
    TABS.APP_LOG.name
  ];
  
  for (var i = 0; i < sheets.length; i++) {
     var sh = ss.getSheetByName(sheets[i]);
     if (sh) {
       sh.activate();
       ss.moveActiveSheet(i + 1);
       // Apply Tab Color from Config
       var color = getTabColor_(sheets[i]);
       if (color) sh.setTabColor(color);
     }
  }
  
  // Default to Overview
  var shOverview = ss.getSheetByName(TABS.OVERVIEW.name);
  if (shOverview) shOverview.activate();

  ss.toast('Scaffolding complete. Tabs reordered and colored.');
}

function ensureSheet_(ss, name) {
  var sh = ss.getSheetByName(name);
  if (!sh) {
    sh = ss.insertSheet(name);
  }
  return sh;
}

function getTabColor_(name) {
  for (var key in TABS) {
    if (TABS[key].name === name) return TABS[key].color;
  }
  return null;
}

/* ==========================================================================================
   SHEET SPECIFIC SCAFFOLDING
   ========================================================================================== */

function scaffoldOverview_(ss) {
  var sh = ss.getSheetByName(TABS.OVERVIEW.name);
  if (sh.getLastRow() === 0) {
     sh.getRange('A1').setValue(TABS.OVERVIEW.name).setFontWeight('bold').setFontSize(12);
     sh.getRange('A1:Z1').setBackground(TABS.OVERVIEW.color).setFontColor('white');
  }
}

function scaffoldParameters_(ss) {
  var sh = ss.getSheetByName(TABS.PARAMETERS.name);
  if (sh.getLastRow() === 0) {
    // Row 1: Header
    sh.getRange('A1').setValue(TABS.PARAMETERS.name).setFontWeight('bold').setFontSize(12);
    sh.getRange('A1:C1').setBackground(TABS.PARAMETERS.color).setHorizontalAlignment('center');

    // Row 2: Columns
    sh.getRange(2, 1, 1, 3).setValues([TABS.PARAMETERS.columns]);
    sh.getRange(2, 1, 1, 3).setFontWeight('bold').setBackground('#616161').setFontColor('white');
    
    var rows = [];
    var addSection = function(name) { rows.push(['[ ' + name + ' ]', '', '']); };
    var addParam = function(key, val, desc, needsInput) { rows.push([key, val, desc, needsInput]); };
    
    // Ingestion
    addSection('Ingestion');
    addParam('WATCH_FOLDER_ID', '', 'Google Drive Folder ID to watch for .igc files', true);
    addParam('UPLOAD_FOLDER_ID', '', 'Google Drive Folder ID for manual uploads', true);
    addParam('ENABLE_WATCH_FOLDER', 'FALSE', 'Enable automated scanning? (TRUE/FALSE)');
    addParam('WATCH_PERIOD_MIN', CFG.defaults.WATCH_PERIOD_MIN, 'How often (mins) the trigger runs');
    
    // Geo & Time
    addSection('Geo & Time');
    addParam('GEO_REV_PROVIDERS', 'nominatim_osm, big_data_cloud', 'Reverse Geo Providers');
    addParam('GEO_SITE_PROVIDERS', 'overpass_api', 'Site Name Providers');
    addParam('GEO_TZ_PROVIDERS', 'timeapi_io', 'Time Zone Providers');
    addParam('OSM_RADIUS_M', CFG.defaults.OSM_RADIUS_M, 'Radius (m) to search for sites');
    
    // Validation
    addSection('Validation');
    addParam('VALIDATION_MIN_DURATION_SEC', CFG.defaults.VALIDATION_MIN_DURATION_SEC, 'Min duration (sec)');
    addParam('VALIDATION_MAX_SPEED_KMH', CFG.defaults.VALIDATION_MAX_SPEED_KMH, 'Max speed (km/h)');
    
    // Analysis
    addSection('Analysis Rules');
    addParam('THERMAL_MIN_CLIMB', CFG.defaults.THERMAL_MIN_CLIMB, 'Min vario (m/s) for thermal');
    addParam('THERMAL_MIN_TURN', CFG.defaults.THERMAL_MIN_TURN, 'Min turn (deg/s) for thermal');
    addParam('SOAR_VARIO_MIN', CFG.defaults.SOAR_VARIO_MIN, 'Min climb (m/s) for Soaring');
    
    // Scoring
    addSection('Scoring');
    addParam('NATIONAL_BONUS_MULTIPLIER', CFG.defaults.NATIONAL_BONUS_MULTIPLIER, 'Triangle Multiplier');
    
    // Admin
    addSection('Admin');
    addParam('CONTACT_EMAIL', '', 'Required for APIs', true);

    // Write Data
    var valRows = rows.map(function(r) { return [r[0], r[1], r[2]]; });
    sh.getRange(3, 1, valRows.length, 3).setValues(valRows);
    
    // Formatting
    for (var i=0; i<rows.length; i++) {
       var rowNum = i + 3;
       if (rows[i][0].indexOf('[') === 0) {
          sh.getRange(rowNum, 1, 1, 3).setBackground('#E0E0E0').setFontWeight('bold');
       } else if (rows[i][3] === true) {
          sh.getRange(rowNum, 2).setBackground('#FFF9C4');
       }
    }
    sh.autoResizeColumns(1, 3);
  }
}

function scaffoldEquipment_(ss) {
  var sh = ss.getSheetByName(TABS.EQUIPMENT.name);
  if (sh.getLastRow() === 0) {
    // Header Row 1
    sh.getRange('A1').setValue(TABS.EQUIPMENT.name).setFontWeight('bold').setFontSize(12);
    sh.getRange('A1:M1').setBackground(TABS.EQUIPMENT.color).setFontColor('white');

    // Column Headers Row 2
    var head = TABS.EQUIPMENT.columns;
    sh.getRange(2, 1, 1, head.length).setValues([head]);
    sh.getRange(2, 1, 1, head.length).setFontWeight('bold').setBackground('#E0F7FA').setBorder(true, true, true, true, true, true);
    
    // Validation Placeholders (Applied via updateValidation)
    // Checkboxes (G=Default?, H=Retired?)
    sh.getRange(3, 7, 999, 2).insertCheckboxes(); 
  
    sh.setFrozenRows(2);
    sh.autoResizeColumns(1, head.length);
  }
  applyEquipmentValidation_(sh);
}

function scaffoldLookups_(ss) {
  var sh = ss.getSheetByName(TABS.LOOKUPS.name);
  sh.showSheet();
  sh.clear();
  
  // Row 1
  sh.getRange('A1').setValue(TABS.LOOKUPS.name).setFontWeight('bold').setFontSize(12);
  sh.getRange('A1:G1').setBackground(TABS.LOOKUPS.color);
  
  // Row 2
  sh.getRange('A2:G2').setValues([TABS.LOOKUPS.columns]);
  sh.getRange('A2:G2').setFontWeight('bold').setBackground('#EEEEEE');
  
  // Static Categories
  sh.getRange('A3:A6').setValues([['Wing'], ['Harness'], ['Reserve'], ['Other']]);
  
  // Queries
  var eqName = TABS.EQUIPMENT.name;
  sh.getRange('B3').setFormula('=IFERROR(QUERY(' + eqName + '!A:M, "select B where A=\'Wing\' and H=FALSE order by B asc label B \'\'", 0), "")');
  sh.getRange('C3').setFormula('=IFERROR(QUERY(' + eqName + '!A:M, "select B where A=\'Harness\' and H=FALSE order by B asc label B \'\'", 0), "")');
  sh.getRange('D3').setFormula('=IFERROR(QUERY(' + eqName + '!A:M, "select B where A=\'Reserve\' and H=FALSE order by B asc label B \'\'", 0), "")');
  sh.getRange('E3').setFormula('=IFERROR(QUERY(' + eqName + '!A:M, "select B where A=\'Other\' and H=FALSE order by B asc label B \'\'", 0), "")');

  // Status & Types
  var statuses = ['Needs Review', 'Valid', 'Invalid?', 'Duplicate'];
  var types = CFG.defaults.FLIGHT_TYPES.split(',');
  
  if (statuses.length > 0) sh.getRange(3, 6, statuses.length, 1).setValues(statuses.map(function(s) { return [s]; }));
  if (types.length > 0) sh.getRange(3, 7, types.length, 1).setValues(types.map(function(t) { return [t]; }));
  
  sh.autoResizeColumns(1, 7);
}

function scaffoldAppLog_(ss) {
  var sh = ss.getSheetByName(TABS.APP_LOG.name);
  if (sh.getLastRow() === 0) {
    sh.getRange('A1').setValue(TABS.APP_LOG.name).setFontWeight('bold').setFontSize(12);
    sh.getRange('A1:F1').setBackground(TABS.APP_LOG.color).setFontColor('white');
    
    sh.getRange(2, 1, 1, 6).setValues([TABS.APP_LOG.columns]);
    sh.getRange(2, 1, 1, 6).setFontWeight('bold').setBackground('#F5F5F5');
    sh.setFrozenRows(2);
  }
}

function scaffoldFlights_(ss) {
  var sh = ss.getSheetByName(TABS.FLIGHTS.name);
  
  // Tab Header
  sh.getRange('A1').setValue(TABS.FLIGHTS.name).setFontWeight('bold').setFontSize(12);
  sh.getRange('A1:Z1').setBackground(TABS.FLIGHTS.color).setFontColor('white');
  
  // Flatten Headers
  var groups = TABS.FLIGHTS.groups;
  var flatHeaders = [];
  groups.forEach(function(g) { flatHeaders = flatHeaders.concat(g.cols); });
  
  // Write Headers (Row 4)
  sh.getRange(4, 1, 1, flatHeaders.length).setValues([flatHeaders]);
  sh.getRange(4, 1, 1, flatHeaders.length).setFontWeight('bold').setBorder(true, true, true, true, true, true);
  
  // Grouping & Formatting
  var colIndex = 1;
  groups.forEach(function(g) {
    var groupLen = g.cols.length;
    // Category Header (Row 3)
    try {
      var rangeCat = sh.getRange(3, colIndex, 1, groupLen);
      rangeCat.merge().setValue(g.name).setBackground(g.color).setHorizontalAlignment('center').setFontWeight('bold').setBorder(true, true, true, true, false, false, "medium", null);
      
      // Col Header Color (Row 4)
      sh.getRange(4, colIndex, 1, groupLen).setBackground(g.color).setFontWeight('bold');
    } catch(e) { console.warn('Header fail', g.name); }

    // Column Collapse logic
    if (groupLen > 1) {
       var startCollapse = -1, endCollapse = -1;
       if (g.name === 'Flight Info') {
          // Collapse from Col 5 (Notes) onwards
          startCollapse = colIndex + 4; endCollapse = colIndex + groupLen - 1;
       } else {
          startCollapse = colIndex + 1; endCollapse = colIndex + groupLen - 1;
       }
       if (startCollapse > 0 && endCollapse >= startCollapse) {
         try {
           sh.getColumnGroup(startCollapse, 1).collapse(); 
         } catch(e) {}
       }
    }
    colIndex += groupLen;
    if (colIndex % 10 === 0) SpreadsheetApp.flush();
  });

  sh.setFrozenRows(4);
  SpreadsheetApp.flush();
  applyFlightsValidation_(sh);
}

/* ==========================================================================================
   VALIDATION & UPDATES
   ========================================================================================== */

function updateValidationOnly_() {
  var ss = SpreadsheetApp.getActive();
  var sh = ss.getSheetByName(TABS.FLIGHTS.name);
  if (sh) applyFlightsValidation_(sh);
  
  var shEq = ss.getSheetByName(TABS.EQUIPMENT.name);
  if (shEq) applyEquipmentValidation_(shEq);
  
  ss.toast('Validation rules updated.');
}

function applyFlightsValidation_(sh) {
  var ss = SpreadsheetApp.getActive();
  var map = getColumnMap_(sh);
  
  // OPTIMIZATION: Only apply validation to the first N empty rows to keep sheet light.
  // Existing data should already have validation. 
  // We apply to dataStartRow -> dataEndRow (or maxRows if smaller)
  var startRow = TABS.FLIGHTS.dataStartRow;
  var endRow = TABS.FLIGHTS.dataEndRow; 
  // If user wants to force update all, they can increase this, but let's stick to config
  
  var valRows = endRow - startRow + 1;
  if (valRows < 1) return;

  // Status
  if (map['Status']) {
    var rule = SpreadsheetApp.newDataValidation().requireValueInList(['Needs Review', 'Valid', 'Invalid?', 'Duplicate'], true).setAllowInvalid(true).build();
    sh.getRange(startRow, map['Status'], valRows, 1).setDataValidation(rule);
    
    // Conditional Formatting
    var range = sh.getRange(startRow, map['Status'], valRows, 1);
    var rules = sh.getConditionalFormatRules();
    rules.push(SpreadsheetApp.newConditionalFormatRule().whenTextEqualTo('Needs Review').setBackground('#FFF9C4').setRanges([range]).build());
    rules.push(SpreadsheetApp.newConditionalFormatRule().whenTextEqualTo('Valid').setBackground('#C8E6C9').setRanges([range]).build());
    rules.push(SpreadsheetApp.newConditionalFormatRule().whenTextEqualTo('Invalid?').setBackground('#FFCDD2').setRanges([range]).build());
    sh.setConditionalFormatRules(rules);
  }

  // Flight Type
  if (map['Flight Type']) {
      var shLook = ss.getSheetByName(TABS.LOOKUPS.name);
      var vals = shLook.getRange('G3:G').getValues().map(function(r){return r[0]}).filter(function(v){return v!==''});
      var rule = SpreadsheetApp.newDataValidation().requireValueInList(vals, true).build();
      sh.getRange(startRow, map['Flight Type'], valRows, 1).setDataValidation(rule);
  }

  // Equipment
  var shLook = ss.getSheetByName(TABS.LOOKUPS.name);
  var apply = function(colName, rngA1) {
     if (map[colName]) {
       var rule = SpreadsheetApp.newDataValidation().requireValueInRange(shLook.getRange(rngA1), true).build();
       sh.getRange(startRow, map[colName], valRows, 1).setDataValidation(rule);
     }
  };
  apply('Wing', 'B3:B');
  apply('Harness', 'C3:C');
  apply('Reserve 1', 'D3:D');
  apply('Reserve 2', 'D3:D');
}

function applyEquipmentValidation_(sh) {
  var ss = SpreadsheetApp.getActive();
  var shLook = ss.getSheetByName(TABS.LOOKUPS.name);
  if (shLook) {
      // Category Range (A3:A)
      var range = shLook.getRange('A3:A');
      var rule = SpreadsheetApp.newDataValidation().requireValueInRange(range, true).setAllowInvalid(true).build();
      var maxRows = sh.getMaxRows();
      if (maxRows > 2) {
          sh.getRange(3, 1, maxRows - 2, 1).setDataValidation(rule);
      }
  }
}

function getColumnMap_(sh) {
  var lastCol = sh.getLastColumn();
  if (lastCol < 1) return {};
  var headers = sh.getRange(4, 1, 1, lastCol).getValues()[0];
  var map = {};
  headers.forEach(function(h, i) { if (h) map[h] = i + 1; });
  return map;
}
