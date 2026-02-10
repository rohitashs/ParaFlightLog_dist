/**
 * Paragliding Flight Log v2.0
 * Updated: 2026-02-09 19:19:06
 */
/**
 * Paragliding Flight Log v2.0 - Scaffolding & Setup
 * 
 * Contains:
 * 1. Sheet Creation & Ordering (scaffoldAll_)
 * 2. Sheet Specific Setup (scaffoldFlights_, etc)
 * 3. Validation Logic (applyFlightValidation_)
 * 4. Admin Tools (Backup, Formatting, Delete)
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
  var existingMap = {};
  
  // Preserve existing user values if present
  if (sh.getLastRow() > 2) {
      try {
        var vals = sh.getRange(3, 1, sh.getLastRow()-2, 2).getValues();
        vals.forEach(function(r) { if(r[0]) existingMap[r[0]] = r[1]; });
      } catch(e) {}
  }
  
  sh.clear();

  // Row 1: Header
  sh.getRange('A1').setValue(TABS.PARAMETERS.name).setFontWeight('bold').setFontSize(12);
  sh.getRange('A1:C1').setBackground(TABS.PARAMETERS.color).setHorizontalAlignment('center');

  // Row 2: Columns
  sh.getRange(2, 1, 1, 3).setValues([TABS.PARAMETERS.columns]);
  sh.getRange(2, 1, 1, 3).setFontWeight('bold').setBackground('#616161').setFontColor('white');
  
  var rows = [];
  var lastSection = '';
  
  CFG.parameters.forEach(function(p) {
      if (p.section !== lastSection) {
          rows.push(['[ ' + p.section + ' ]', '', '']);
          lastSection = p.section;
      }
      // Use existing value if available, else default
      var val = (existingMap[p.key] !== undefined && existingMap[p.key] !== '') ? existingMap[p.key] : p.val;
      rows.push([p.key, val, p.desc, p.input]); // p.input is meta, removed before write
  });

  // Write Data
  var writeRows = rows.map(function(r) { return [r[0], r[1], r[2]]; });
  sh.getRange(3, 1, writeRows.length, 3).setValues(writeRows);
  
  // Formatting
  for (var i=0; i<rows.length; i++) {
     var rowNum = i + 3;
     if (rows[i][0].indexOf('[') === 0) {
        // Section Header
        sh.getRange(rowNum, 1, 1, 3).setBackground('#E0E0E0').setFontWeight('bold');
     } else if (rows[i][3] === true) {
        // Input Field
        sh.getRange(rowNum, 2).setBackground('#FFF9C4');
     }
  }
  sh.autoResizeColumns(1, 3);
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
    
    // Checkboxes (G=Default?, H=Retired?) - Limit to dataEndRow
    var limit = TABS.EQUIPMENT.dataEndRow;
    var rows = limit - 2; 
    if (rows > 0) {
       sh.getRange(3, 7, rows, 2).insertCheckboxes(); 
    }
  
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

  // Status & Types from CFG
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

    // Column Collapse logic using visibleCols
    if (groupLen > 1) {
       // Safe default if visibleCols not defined
       var visCols = g.visibleCols || 1; 
       
       var startCollapse = colIndex + visCols;
       var endCollapse = colIndex + groupLen - 1;
       
       if (endCollapse >= startCollapse) {
         try {
           sh.getColumnGroup(startCollapse, 1).collapse(); 
         } catch(e) {
           // Create group if doesn't exist? (Not trivial via script, usually assumes existing)
           // Actually, standard practice is to create group then collapse.
           // GAS issue: getColumnGroup throws if no group. 
           // We might need to shift+alt+right logic, which is:
           // sh.getRange(1, startCollapse, 1, (endCollapse-startCollapse+1)).shiftColumnGroupDepth(1);
           // Then collapse.
           // However, if groups exist, we just collapse. User asked to fix "grouping missing", so we likely need to Create it.
           try {
              var range = sh.getRange(1, startCollapse, sh.getMaxRows(), (endCollapse - startCollapse + 1));
              range.shiftColumnGroupDepth(1);
              sh.getColumnGroup(startCollapse, 1).collapse();
           } catch(err) { console.warn('Group create fail', err); }
         }
       }
    }
    colIndex += groupLen;
    // Throttling
    SpreadsheetApp.flush();
    if (colIndex % 10 === 0) Utilities.sleep(500);
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
  
  // Also refresh parameters in case new ones added
  scaffoldParameters_(ss);
  
  ss.toast('Validation rules and Parameters updated.');
}

function applyFlightsValidation_(sh) {
  var ss = SpreadsheetApp.getActive();
  var map = getColumnMap_(sh);
  
  var startRow = TABS.FLIGHTS.dataStartRow;
  var endRow = TABS.FLIGHTS.dataEndRow; 
  var valRows = endRow - startRow + 1;
  if (valRows < 1) return;

  // Status
  if (map['Status']) {
    var rule = SpreadsheetApp.newDataValidation().requireValueInList(['Needs Review', 'Valid', 'Invalid?', 'Duplicate'], true).setAllowInvalid(true).build();
    sh.getRange(startRow, map['Status'], valRows, 1).setDataValidation(rule);
    
    // Conditional Formatting
    var range = sh.getRange(startRow, map['Status'], valRows, 1);
    var rules = sh.getConditionalFormatRules();
    // Clear old rules on this range? difficult to isolate. Append is safer for now.
    // Ideally we clear all rules and rebuild.
    // For now, let's just append.
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
      var dataStart = TABS.EQUIPMENT.dataStartRow;
      var dataEnd = TABS.EQUIPMENT.dataEndRow;
      var numRows = dataEnd - dataStart + 1; // 50 - 3 + 1 = 48 rows.
      
      if (numRows < 1) return;

      // Category Range (A3:A)
      var range = shLook.getRange('A3:A');
      var rule = SpreadsheetApp.newDataValidation().requireValueInRange(range, true).setAllowInvalid(true).build();
      
      // Apply to limited range
      sh.getRange(dataStart, 1, numRows, 1).setDataValidation(rule);
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

/* ==========================================================================================
   ADMIN TOOLS
   ========================================================================================== */

function reapplyFormatting_() {
  var ss = SpreadsheetApp.getActive();
  
  // Re-run the scaffold logic which handles headers & formatting.
  // It checks `if (sh.getLastRow() === 0)` usually, but we want to force format.
  // So we'll iterate and apply styles directly.
  
  // 1. Flights
  var shF = ss.getSheetByName(TABS.FLIGHTS.name);
  if (shF) {
     // Apply Tab Color
     shF.setTabColor(TABS.FLIGHTS.color);
     // Apply Header 1
     shF.getRange('A1:Z1').setBackground(TABS.FLIGHTS.color).setFontColor('white').setFontWeight('bold');
     
     // Rescaffold groupings (this applies headers Row 3 & 4)
     var groups = TABS.FLIGHTS.groups;
     var colIndex = 1;
     groups.forEach(function(g) {
         var groupLen = g.cols.length;
         try {
            // Row 3 (Category)
            shF.getRange(3, colIndex, 1, groupLen).merge().setValue(g.name).setBackground(g.color).setHorizontalAlignment('center').setFontWeight('bold').setBorder(true, true, true, true, false, false, "medium", null);
            // Row 4 (Columns)
            shF.getRange(4, colIndex, 1, groupLen).setBackground(g.color).setFontWeight('bold');
         } catch(e) {}
         colIndex += groupLen;
     });
  }
  
  // 2. Equipment
  var shE = ss.getSheetByName(TABS.EQUIPMENT.name);
  if (shE) {
     shE.setTabColor(TABS.EQUIPMENT.color);
     shE.getRange('A1:M1').setBackground(TABS.EQUIPMENT.color).setFontColor('white');
     shE.getRange(2, 1, 1, TABS.EQUIPMENT.columns.length).setBackground('#E0F7FA').setFontWeight('bold');
  }
  
  // 3. Parameters
  var shP = ss.getSheetByName(TABS.PARAMETERS.name);
  if (shP) {
      shP.setTabColor(TABS.PARAMETERS.color);
      shP.getRange('A1:C1').setBackground(TABS.PARAMETERS.color);
      shP.getRange(2, 1, 1, 3).setBackground('#616161').setFontColor('white');
      // Re-run scaffold to fix row colors
      scaffoldParameters_(ss);
  }

  ss.toast('Formatting Re-applied.');
}

function backupSystemSheets_() {
  var ss = SpreadsheetApp.getActive();
  var backup = function(srcName, destName) {
     var src = ss.getSheetByName(srcName);
     if (src) {
        var existing = ss.getSheetByName(destName);
        if (existing) ss.deleteSheet(existing); // Overwrite? Or version? User said "Backup Flights", implies singular.
        src.copyTo(ss).setName(destName);
     }
  };
  
  backup(TABS.FLIGHTS.name, 'Backup ' + TABS.FLIGHTS.name);
  backup(TABS.EQUIPMENT.name, 'Backup ' + TABS.EQUIPMENT.name);
  
  ss.toast('Backup created: Backup Flights & Backup Equipment');
}

function deleteSystemSheets_() {
  var ui = SpreadsheetApp.getUi();
  var resp = ui.alert('DELETE SYSTEM SHEETS', 'Are you sure you want to delete all system tabs (Flights, Equipment, etc)? This is irreversible (unless backed up).', ui.ButtonSet.YES_NO);
  
  if (resp == ui.Button.YES) {
    var ss = SpreadsheetApp.getActive();
    var targets = [TABS.FLIGHTS.name, TABS.EQUIPMENT.name, TABS.PARAMETERS.name, TABS.LOOKUPS.name, TABS.APP_LOG.name, TABS.OVERVIEW.name, TABS.APP_LOG.name, 'Sites']; // Sites is legacy but safe to nuke
    
    var count = 0;
    targets.forEach(function(name) {
       var sh = ss.getSheetByName(name);
       if (sh) {
          try { ss.deleteSheet(sh); count++; } catch(e) { console.warn('Delete fail', name); }
       }
    });
    ss.toast('Deleted ' + count + ' system sheets.');
  }
}
