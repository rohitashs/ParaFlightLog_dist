/**
 * Paragliding Flight Log v2.0
 * Updated: 2026-10-04 09:43:52
 */
/**
 * Paragliding Flight Log v2.0 - Scaffolding & Setup
 * 
 * @design Docs/Design/DSGN-MNT-001_Unified_Update_Manager_and_Maintenance_Orchestrator.md
 * @architecture Docs/Architecture/Views/03_Data_and_Storage_Model.md
 * @architecture Docs/Architecture/Cross_Cutting/Resilience_and_Evolution.md#2-schema-evolution-protocol
 * @revision Rev 2.1
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
  ensureSheet_(ss, TABS.DASHBOARD.name);
  ensureSheet_(ss, TABS.FLIGHTS.name);
  ensureSheet_(ss, TABS.PILOT_PROFILE.name);
  ensureSheet_(ss, TABS.EQUIPMENT.name);
  ensureSheet_(ss, TABS.USER_GUIDE.name);
  ensureSheet_(ss, TABS.CONFIG.name);
  ensureSheet_(ss, TABS.AUTOMATION_RULES.name);
  ensureSheet_(ss, TABS.QUEUE.name);
  ensureSheet_(ss, TABS.ACTIVITY.name);
  
  // Clean up legacy tabs if present (migration bridges)
  var oldParamSheet = ss.getSheetByName('Parameters');
  var oldLookSheet = ss.getSheetByName('Lookups');
  var oldAppLog = ss.getSheetByName('App_Log'); // Legacy migration bridge
  if (oldParamSheet && !ss.getSheetByName(TABS.CONFIG.name)) {
    oldParamSheet.setName(TABS.CONFIG.name);
  }
  if (oldLookSheet && oldLookSheet.getName() !== TABS.CONFIG.name) {
    try { ss.deleteSheet(oldLookSheet); } catch (e) {}
  }
  if (oldAppLog && !ss.getSheetByName(TABS.ACTIVITY.name)) {
    oldAppLog.setName(TABS.ACTIVITY.name);
  }

  // 2. Scaffolding Content
  scaffoldDashboard_(ss);
  scaffoldConfig_(ss); // Populates parameters on left and lookups on right
  scaffoldFlights_(ss);
  scaffoldPilotProfile_(ss);
  scaffoldEquipment_(ss);
  scaffoldUserGuide_(ss);
  scaffoldAutomation_(ss);
  scaffoldQueue_(ss);
  scaffoldAppLog_(ss);
  
  // 3. Reorder Tabs
  var sheets = [
    TABS.DASHBOARD.name, 
    TABS.FLIGHTS.name, 
    TABS.PILOT_PROFILE.name,
    TABS.EQUIPMENT.name, 
    TABS.USER_GUIDE.name,
    TABS.CONFIG.name, 
    TABS.AUTOMATION_RULES.name,
    TABS.QUEUE.name,
    TABS.ACTIVITY.name
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
  
  // Default to Dashboard
  var shDash = ss.getSheetByName(TABS.DASHBOARD.name);
  if (shDash) shDash.activate();

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

/**
 * Ensures a sheet has at least minRows and minCols before populating
 * to prevent out-of-bounds range access exceptions.
 */
function ensureDimensions_(sh, minRows, minCols) {
  if (!sh) return;
  var curRows = sh.getMaxRows();
  if (curRows < minRows) {
    sh.insertRowsAfter(curRows, minRows - curRows);
  }
  var curCols = sh.getMaxColumns();
  if (curCols < minCols) {
    sh.insertColumnsAfter(curCols, minCols - curCols);
  }
}

/* ==========================================================================================
   SHEET SPECIFIC SCAFFOLDING
   ========================================================================================== */

function scaffoldDashboard_(ss) {
  var sh = ss.getSheetByName(TABS.DASHBOARD.name);
  if (!sh) return;
  sh.clear();
  
  // Ensure sufficient dimensions before populating (70 rows, 6 columns)
  ensureDimensions_(sh, 70, 6);
  
  var fStart = (TABS.FLIGHTS && TABS.FLIGHTS.dataStartRow) ? TABS.FLIGHTS.dataStartRow : 5;
  var fSheet = TABS.FLIGHTS.name;

  // 1. Page Title (Row 1, Cols A:F)
  sh.getRange('A1').setValue("Flight Dashboard").setFontWeight('bold').setFontSize(18);
  sh.getRange('A1:F1').setBackground(TABS.DASHBOARD.color).setFontColor('white').merge();
  sh.getRange('A1').setHorizontalAlignment('center').setVerticalAlignment('middle');
  sh.setRowHeight(1, 40);
  
  // 1b. Row 2: Include "Review?" selector (Cols A:B) and Master Folder Link (Cols C:F)
  var currentIncludeReview = 'No';
  try {
    var existingB2 = String(sh.getRange('B2').getValue() || '').trim();
    if (existingB2 === 'Yes') currentIncludeReview = 'Yes';
  } catch(e) {}

  sh.getRange('A2').setValue('Include "Review?":')
    .setFontWeight('bold')
    .setFontSize(10)
    .setFontColor('#37474F')
    .setHorizontalAlignment('right')
    .setVerticalAlignment('middle')
    .setBackground('#ECEFF1');

  var ruleReview = SpreadsheetApp.newDataValidation()
    .requireValueInList(['No', 'Yes'], true)
    .setAllowInvalid(false)
    .build();

  sh.getRange('B2')
    .setDataValidation(ruleReview)
    .setValue(currentIncludeReview)
    .setFontWeight('bold')
    .setFontSize(10)
    .setFontColor('#1565C0')
    .setHorizontalAlignment('center')
    .setVerticalAlignment('middle')
    .setBackground('#FFFFFF')
    .setBorder(true, true, true, true, true, true, '#B0BEC5', SpreadsheetApp.BorderStyle.SOLID);

  // Register Native Google Sheets Named Range for Review Toggle (survives cell/col movements)
  registerNamedRange_(ss, 'DASHBOARD_REVIEW_FILTER', sh.getRange('B2'));

  var masterLinkFormula = '=IF(ISBLANK(VLOOKUP("MASTER_LOG_FOLDER_ID", ' + TABS.CONFIG.name + '!A:B, 2, FALSE)), "Master Flight Logs folder (Not Configured)", HYPERLINK("https://drive.google.com/drive/folders/" & VLOOKUP("MASTER_LOG_FOLDER_ID", ' + TABS.CONFIG.name + '!A:B, 2, FALSE), "📁 Master Flight Logs folder"))';
  sh.getRange('C2:F2').merge().setFormula(masterLinkFormula).setFontSize(10).setFontStyle('italic').setHorizontalAlignment('center').setVerticalAlignment('middle');
  sh.setRowHeight(2, 24);

  // 1c. Dynamic Column Letter Resolution (CR-SYS-005 / DSGN-SYS-003)
  var fMap = {};
  var shF = ss.getSheetByName(fSheet);
  if (shF) {
    fMap = getColumnMap_(shF);
  }

  var colStatus = getColLetter_(fMap, 'Status', 'B');
  var colFlightNo = getColLetter_(fMap, 'Flight No', 'C');
  var colSummary = getColLetter_(fMap, 'Auto Summary', 'D');
  var colDate = getColLetter_(fMap, 'Date', 'H');
  var colDuration = getColLetter_(fMap, 'Flight Duration', 'L');
  var colDist = getColLetter_(fMap, 'Track Length (km)', 'M');
  var colXcScore = getColLetter_(fMap, 'XC Score', 'V');
  var colMaxAlt = getColLetter_(fMap, 'Max Alt (m)', 'AB');
  var colAltGain = getColLetter_(fMap, 'Total Height Gain (m)', 'AD');
  var colMaxSpeed = getColLetter_(fMap, 'Max Groundspeed (km/h)', 'AG');
  var colLaunchSite = getColLetter_(fMap, 'Launch Site', 'AL');
  var colLaunchCountry = getColLetter_(fMap, 'Launch Country', 'AN');
  var colThermalPct = getColLetter_(fMap, 'Thermal %', 'BC');
  var colSoarPct = getColLetter_(fMap, 'Soar %', 'BG');

  // Status Filter Expression for formulas (When DASHBOARD_REVIEW_FILTER="Yes", includes both "Valid" and "Review?")
  var fStatusFilter = '((INDIRECT("' + fSheet + '!' + colStatus + fStart + ':' + colStatus + '")="Valid") + (DASHBOARD_REVIEW_FILTER="Yes")*(INDIRECT("' + fSheet + '!' + colStatus + fStart + ':' + colStatus + '")="Review?"))';

  // Spacer Row 3
  sh.setRowHeight(3, 10);
  
  // 2. Banner 1: All-Time Stats (Row 4 Header, Rows 5-6 Cards)
  sh.getRange('A4:F4').merge().setValue('ALL-TIME SUMMARY').setBackground('#ECEFF1').setFontColor('#546E7A').setFontWeight('bold').setFontSize(10).setHorizontalAlignment('center').setVerticalAlignment('middle');
  sh.setRowHeight(4, 18);

  var fTotalFlights = '=IFERROR(TEXT(COUNTIF(INDIRECT("' + fSheet + '!' + colStatus + fStart + ':' + colStatus + '"), "Valid") + IF(DASHBOARD_REVIEW_FILTER="Yes", COUNTIF(INDIRECT("' + fSheet + '!' + colStatus + fStart + ':' + colStatus + '"), "Review?"), 0), "#,##0") & CHAR(10) & "Total Flights", "0" & CHAR(10) & "Total Flights")';
  var fTotalHours = '=IFERROR(TEXT(SUMPRODUCT(' + fStatusFilter + ' * IFERROR(TIMEVALUE(INDIRECT("' + fSheet + '!' + colDuration + fStart + ':' + colDuration + '")), 0)), "[h]:mm") & " hrs" & CHAR(10) & "Total Hours", "0:00 hrs" & CHAR(10) & "Total Hours")';
  var fTotalDist = '=IFERROR(TEXT(SUMIF(INDIRECT("' + fSheet + '!' + colStatus + fStart + ':' + colStatus + '"), "Valid", INDIRECT("' + fSheet + '!' + colDist + fStart + ':' + colDist + '")) + IF(DASHBOARD_REVIEW_FILTER="Yes", SUMIF(INDIRECT("' + fSheet + '!' + colStatus + fStart + ':' + colStatus + '"), "Review?", INDIRECT("' + fSheet + '!' + colDist + fStart + ':' + colDist + '")), 0), "#,##0") & " km" & CHAR(10) & "Total Distance", "0 km" & CHAR(10) & "Total Distance")';

  var kpisAllTime = [
    { r: 'A5:B6', f: fTotalFlights },
    { r: 'C5:D6', f: fTotalHours },
    { r: 'E5:F6', f: fTotalDist }
  ];

  kpisAllTime.forEach(function(k) {
    var rng = sh.getRange(k.r);
    rng.merge();
    rng.setBackground('#F5F7F8').setBorder(true, true, true, true, true, true, '#CFD8DC', SpreadsheetApp.BorderStyle.SOLID);
    rng.setHorizontalAlignment('center').setVerticalAlignment('middle');
    rng.setFormula(k.f);
    rng.setFontSize(13).setWrap(true);
  });
  sh.setRowHeight(5, 24);
  sh.setRowHeight(6, 24);

  // Spacer Row 7
  sh.setRowHeight(7, 10);

  // 3. Banner 2: Current Year Stats (Row 8 Header, Rows 9-10 Cards)
  sh.getRange('A8:F8').merge().setFormula('="YEAR-TO-DATE SUMMARY (" & YEAR(TODAY()) & ")"').setBackground('#ECEFF1').setFontColor('#546E7A').setFontWeight('bold').setFontSize(10).setHorizontalAlignment('center').setVerticalAlignment('middle');
  sh.setRowHeight(8, 18);

  var fYearFlights = '=IFERROR(TEXT(COUNTIFS(INDIRECT("' + fSheet + '!' + colStatus + fStart + ':' + colStatus + '"), "Valid", INDIRECT("' + fSheet + '!' + colDate + fStart + ':' + colDate + '"), ">=" & DATE(YEAR(TODAY()), 1, 1), INDIRECT("' + fSheet + '!' + colDate + fStart + ':' + colDate + '"), "<=" & DATE(YEAR(TODAY()), 12, 31)) + IF(DASHBOARD_REVIEW_FILTER="Yes", COUNTIFS(INDIRECT("' + fSheet + '!' + colStatus + fStart + ':' + colStatus + '"), "Review?", INDIRECT("' + fSheet + '!' + colDate + fStart + ':' + colDate + '"), ">=" & DATE(YEAR(TODAY()), 1, 1), INDIRECT("' + fSheet + '!' + colDate + fStart + ':' + colDate + '"), "<=" & DATE(YEAR(TODAY()), 12, 31)), 0), "#,##0") & CHAR(10) & "Flights (" & YEAR(TODAY()) & ")", "0" & CHAR(10) & "Flights (" & YEAR(TODAY()) & ")")';
  var fYearHours = '=IFERROR(TEXT(SUMPRODUCT(' + fStatusFilter + ' * (IFERROR(YEAR(INDIRECT("' + fSheet + '!' + colDate + fStart + ':' + colDate + '")), 0)=YEAR(TODAY())) * IFERROR(TIMEVALUE(INDIRECT("' + fSheet + '!' + colDuration + fStart + ':' + colDuration + '")), 0)), "[h]:mm") & " hrs" & CHAR(10) & "Hours (" & YEAR(TODAY()) & ")", "0:00 hrs" & CHAR(10) & "Hours (" & YEAR(TODAY()) & ")")';
  var fYearDist = '=IFERROR(TEXT(SUMIFS(INDIRECT("' + fSheet + '!' + colDist + fStart + ':' + colDist + '"), INDIRECT("' + fSheet + '!' + colStatus + fStart + ':' + colStatus + '"), "Valid", INDIRECT("' + fSheet + '!' + colDate + fStart + ':' + colDate + '"), ">=" & DATE(YEAR(TODAY()), 1, 1), INDIRECT("' + fSheet + '!' + colDate + fStart + ':' + colDate + '"), "<=" & DATE(YEAR(TODAY()), 12, 31)) + IF(DASHBOARD_REVIEW_FILTER="Yes", SUMIFS(INDIRECT("' + fSheet + '!' + colDist + fStart + ':' + colDist + '"), INDIRECT("' + fSheet + '!' + colStatus + fStart + ':' + colStatus + '"), "Review?", INDIRECT("' + fSheet + '!' + colDate + fStart + ':' + colDate + '"), ">=" & DATE(YEAR(TODAY()), 1, 1), INDIRECT("' + fSheet + '!' + colDate + fStart + ':' + colDate + '"), "<=" & DATE(YEAR(TODAY()), 12, 31)), 0), "#,##0") & " km" & CHAR(10) & "Distance (" & YEAR(TODAY()) & ")", "0 km" & CHAR(10) & "Distance (" & YEAR(TODAY()) & ")")';

  var kpisYear = [
    { r: 'A9:B10', f: fYearFlights },
    { r: 'C9:D10', f: fYearHours },
    { r: 'E9:F10', f: fYearDist }
  ];

  kpisYear.forEach(function(k) {
    var rng = sh.getRange(k.r);
    rng.merge();
    rng.setBackground('#F5F7F8').setBorder(true, true, true, true, true, true, '#CFD8DC', SpreadsheetApp.BorderStyle.SOLID);
    rng.setHorizontalAlignment('center').setVerticalAlignment('middle');
    rng.setFormula(k.f);
    rng.setFontSize(13).setWrap(true);
  });
  sh.setRowHeight(9, 24);
  sh.setRowHeight(10, 24);

  // Spacer Row 11
  sh.setRowHeight(11, 10);

  // 4. Section 3: Last 6 Months Activity Timeline (Row 12 Header, Rows 13-16 Data)
  sh.getRange('A12:F12').merge().setValue('6-MONTH ACTIVITY TIMELINE').setBackground('#CFD8DC').setFontColor('#37474F').setFontWeight('bold').setFontSize(11).setHorizontalAlignment('center').setVerticalAlignment('middle');
  sh.setRowHeight(12, 24);

  // Horizontal Timeline: 6 Months across Cols A through F (offsets: -5 to 0)
  var cols = ['A', 'B', 'C', 'D', 'E', 'F'];
  for (var i = 0; i < 6; i++) {
    var offset = i - 5; // -5, -4, -3, -2, -1, 0
    var colLetter = cols[i];

    // Row 13: Month Name
    var fMonthName = '=TEXT(EDATE(TODAY(), ' + offset + '), "mmm-yyyy")';
    var rMonth = sh.getRange(colLetter + '13');
    rMonth.setFormula(fMonthName).setBackground('#ECEFF1').setFontWeight('bold').setHorizontalAlignment('center').setVerticalAlignment('middle').setBorder(true, true, true, true, true, true, '#B0BEC5', SpreadsheetApp.BorderStyle.SOLID);

    // Row 14: Total Flights (pure numeric, format 0 "flts")
    var fMonthFlights = '=IFERROR(COUNTIFS(INDIRECT("' + fSheet + '!' + colStatus + fStart + ':' + colStatus + '"), "Valid", INDIRECT("' + fSheet + '!' + colDate + fStart + ':' + colDate + '"), ">=" & DATE(YEAR(EDATE(TODAY(), ' + offset + ')), MONTH(EDATE(TODAY(), ' + offset + ')), 1), INDIRECT("' + fSheet + '!' + colDate + fStart + ':' + colDate + '"), "<=" & EOMONTH(EDATE(TODAY(), ' + offset + '), 0)) + IF($B$2="Yes", COUNTIFS(INDIRECT("' + fSheet + '!' + colStatus + fStart + ':' + colStatus + '"), "Review?", INDIRECT("' + fSheet + '!' + colDate + fStart + ':' + colDate + '"), ">=" & DATE(YEAR(EDATE(TODAY(), ' + offset + ')), MONTH(EDATE(TODAY(), ' + offset + ')), 1), INDIRECT("' + fSheet + '!' + colDate + fStart + ':' + colDate + '"), "<=" & EOMONTH(EDATE(TODAY(), ' + offset + '), 0)), 0), 0)';
    var rFlights = sh.getRange(colLetter + '14');
    rFlights.setFormula(fMonthFlights).setNumberFormat('0 "flts"').setHorizontalAlignment('center').setVerticalAlignment('middle').setBorder(true, true, true, true, true, true, '#E0E0E0', SpreadsheetApp.BorderStyle.SOLID);

    // Row 15: Total Time (pure numeric day fraction, format [h]:mm "hrs")
    var fMonthHours = '=IFERROR(SUMPRODUCT(' + fStatusFilter + ' * (INDIRECT("' + fSheet + '!' + colDate + fStart + ':' + colDate + '") >= DATE(YEAR(EDATE(TODAY(), ' + offset + ')), MONTH(EDATE(TODAY(), ' + offset + ')), 1)) * (INDIRECT("' + fSheet + '!' + colDate + fStart + ':' + colDate + '") <= EOMONTH(EDATE(TODAY(), ' + offset + '), 0)) * IFERROR(TIMEVALUE(INDIRECT("' + fSheet + '!' + colDuration + fStart + ':' + colDuration + '")), 0)), 0)';
    var rHours = sh.getRange(colLetter + '15');
    rHours.setFormula(fMonthHours).setNumberFormat('[h]:mm "hrs"').setHorizontalAlignment('center').setVerticalAlignment('middle').setBorder(true, true, true, true, true, true, '#E0E0E0', SpreadsheetApp.BorderStyle.SOLID);

    // Row 16: Total Distance (pure numeric, format #,##0 "km")
    var fMonthDist = '=IFERROR(SUMIFS(INDIRECT("' + fSheet + '!' + colDist + fStart + ':' + colDist + '"), INDIRECT("' + fSheet + '!' + colStatus + fStart + ':' + colStatus + '"), "Valid", INDIRECT("' + fSheet + '!' + colDate + fStart + ':' + colDate + '"), ">=" & DATE(YEAR(EDATE(TODAY(), ' + offset + ')), MONTH(EDATE(TODAY(), ' + offset + ')), 1), INDIRECT("' + fSheet + '!' + colDate + fStart + ':' + colDate + '"), "<=" & EOMONTH(EDATE(TODAY(), ' + offset + '), 0)) + IF($B$2="Yes", SUMIFS(INDIRECT("' + fSheet + '!' + colDist + fStart + ':' + colDist + '"), INDIRECT("' + fSheet + '!' + colStatus + fStart + ':' + colStatus + '"), "Review?", INDIRECT("' + fSheet + '!' + colDate + fStart + ':' + colDate + '"), ">=" & DATE(YEAR(EDATE(TODAY(), ' + offset + ')), MONTH(EDATE(TODAY(), ' + offset + ')), 1), INDIRECT("' + fSheet + '!' + colDate + fStart + ':' + colDate + '"), "<=" & EOMONTH(EDATE(TODAY(), ' + offset + '), 0)), 0), 0)';
    var rDist = sh.getRange(colLetter + '16');
    rDist.setFormula(fMonthDist).setNumberFormat('#,##0 "km"').setHorizontalAlignment('center').setVerticalAlignment('middle').setBorder(true, true, true, true, true, true, '#E0E0E0', SpreadsheetApp.BorderStyle.SOLID);
  }
  sh.setRowHeight(13, 22);
  sh.setRowHeight(14, 20);
  sh.setRowHeight(15, 20);
  sh.setRowHeight(16, 20);

  // Timeline Pilot Currency Shading (Conditional Formatting)
  var rangeFlights = sh.getRange('A14:F14');
  var rangeHours = sh.getRange('A15:F15');
  var pSheet = TABS.CONFIG.name;

  var ruleFlightsGreen = SpreadsheetApp.newConditionalFormatRule()
    .whenFormulaSatisfied('=A14 >= VLOOKUP("TIMELINE_FLIGHTS_MED", INDIRECT("' + pSheet + '!A:B"), 2, FALSE)')
    .setBackground('#C8E6C9')
    .setRanges([rangeFlights])
    .build();

  var ruleFlightsYellow = SpreadsheetApp.newConditionalFormatRule()
    .whenFormulaSatisfied('=A14 >= VLOOKUP("TIMELINE_FLIGHTS_LOW", INDIRECT("' + pSheet + '!A:B"), 2, FALSE)')
    .setBackground('#FFF9C4')
    .setRanges([rangeFlights])
    .build();

  var ruleFlightsOrange = SpreadsheetApp.newConditionalFormatRule()
    .whenFormulaSatisfied('=A14 < VLOOKUP("TIMELINE_FLIGHTS_LOW", INDIRECT("' + pSheet + '!A:B"), 2, FALSE)')
    .setBackground('#FFE0B2')
    .setRanges([rangeFlights])
    .build();

  var ruleHoursGreen = SpreadsheetApp.newConditionalFormatRule()
    .whenFormulaSatisfied('=A15 >= VLOOKUP("TIMELINE_HOURS_MED", INDIRECT("' + pSheet + '!A:B"), 2, FALSE)')
    .setBackground('#C8E6C9')
    .setRanges([rangeHours])
    .build();

  var ruleHoursYellow = SpreadsheetApp.newConditionalFormatRule()
    .whenFormulaSatisfied('=A15 >= VLOOKUP("TIMELINE_HOURS_LOW", INDIRECT("' + pSheet + '!A:B"), 2, FALSE)')
    .setBackground('#FFF9C4')
    .setRanges([rangeHours])
    .build();

  var ruleHoursOrange = SpreadsheetApp.newConditionalFormatRule()
    .whenFormulaSatisfied('=A15 < VLOOKUP("TIMELINE_HOURS_LOW", INDIRECT("' + pSheet + '!A:B"), 2, FALSE)')
    .setBackground('#FFE0B2')
    .setRanges([rangeHours])
    .build();

  sh.setConditionalFormatRules([ruleFlightsGreen, ruleFlightsYellow, ruleFlightsOrange, ruleHoursGreen, ruleHoursYellow, ruleHoursOrange]);

  // Spacer Row 17
  sh.setRowHeight(17, 14);

  // 5. Section 4: Leaderboards (4 Rows x 2 Cards = 8 Cards)
  // Grid Row 1 (Row 18 Header, Rows 19-23 Data): Top 5 by Duration (A:C) & Top 5 by Distance (D:F)
  sh.getRange('A18:C18').merge().setValue('Top 5 by Duration').setBackground('#CFD8DC').setFontWeight('bold').setHorizontalAlignment('center').setVerticalAlignment('middle');
  sh.getRange('D18:F18').merge().setValue('Top 5 by Distance').setBackground('#CFD8DC').setFontWeight('bold').setHorizontalAlignment('center').setVerticalAlignment('middle');
  sh.setRowHeight(18, 26);

  var dConfig = getParameters_();
  var dateFmt = (dConfig && dConfig.DATE_FORMAT) || 'yyyy-MM-dd';

  for (var k = 1; k <= 5; k++) {
    var rNum1 = k + 18;
    // Top Duration (A:C): colFlightNo, colDuration formatted as [h]:mm hrs, colDate formatted, colLaunchSite, sorted on TIMEVALUE
    var durRange = 'SORT(FILTER({' +
      'INDIRECT("' + fSheet + '!' + colFlightNo + fStart + ':' + colFlightNo + '"), ' +
      'TEXT(IFERROR(TIMEVALUE(INDIRECT("' + fSheet + '!' + colDuration + fStart + ':' + colDuration + '")), INDIRECT("' + fSheet + '!' + colDuration + fStart + ':' + colDuration + '")), "[h]:mm") & " hrs", ' +
      'TEXT(INDIRECT("' + fSheet + '!' + colDate + fStart + ':' + colDate + '"), "' + dateFmt + '"), ' +
      'INDIRECT("' + fSheet + '!' + colLaunchSite + fStart + ':' + colLaunchSite + '"), ' +
      'IFERROR(TIMEVALUE(INDIRECT("' + fSheet + '!' + colDuration + fStart + ':' + colDuration + '")), 0)}, ' +
      fStatusFilter + ' * (IFERROR(TIMEVALUE(INDIRECT("' + fSheet + '!' + colDuration + fStart + ':' + colDuration + '")), 0)>0)), 5, FALSE)';

    var fDur = '=IFERROR("Flight " & INDEX(' + durRange + ', ' + k + ', 1) & ": " & INDEX(' + durRange + ', ' + k + ', 2) & " (" & INDEX(' + durRange + ', ' + k + ', 3) & IF(INDEX(' + durRange + ', ' + k + ', 4) <> "", ", " & INDEX(' + durRange + ', ' + k + ', 4), "") & ")", "-")';
    sh.getRange(rNum1, 1, 1, 3).merge().setFormula(fDur).setBorder(false, false, true, false, false, false, '#E0E0E0', SpreadsheetApp.BorderStyle.SOLID).setVerticalAlignment('middle');

    // Top Distance (D:F): colFlightNo, colDist (raw), colDate formatted, colLaunchSite, sorted on colDist
    var distRange = 'SORT(FILTER({' +
      'INDIRECT("' + fSheet + '!' + colFlightNo + fStart + ':' + colFlightNo + '"), ' +
      'INDIRECT("' + fSheet + '!' + colDist + fStart + ':' + colDist + '"), ' +
      'TEXT(INDIRECT("' + fSheet + '!' + colDate + fStart + ':' + colDate + '"), "' + dateFmt + '"), ' +
      'INDIRECT("' + fSheet + '!' + colLaunchSite + fStart + ':' + colLaunchSite + '")}, ' +
      fStatusFilter + ' * (IFERROR(VALUE(INDIRECT("' + fSheet + '!' + colDist + fStart + ':' + colDist + '")), 0)>0)), 2, FALSE)';

    var fDist = '=IFERROR("Flight " & INDEX(' + distRange + ', ' + k + ', 1) & ": " & IF(ROUND(INDEX(' + distRange + ', ' + k + ', 2), 1)=ROUND(INDEX(' + distRange + ', ' + k + ', 2), 0), TEXT(INDEX(' + distRange + ', ' + k + ', 2), "#,##0"), TEXT(INDEX(' + distRange + ', ' + k + ', 2), "#,##0.0")) & " km (" & INDEX(' + distRange + ', ' + k + ', 3) & IF(INDEX(' + distRange + ', ' + k + ', 4) <> "", ", " & INDEX(' + distRange + ', ' + k + ', 4), "") & ")", "-")';
    sh.getRange(rNum1, 4, 1, 3).merge().setFormula(fDist).setBorder(false, false, true, false, false, false, '#E0E0E0', SpreadsheetApp.BorderStyle.SOLID).setVerticalAlignment('middle');
    sh.setRowHeight(rNum1, 22);
  }

  // Spacer Row 24
  sh.setRowHeight(24, 14);

  // Grid Row 2 (Row 25 Header, Rows 26-30 Data): Top 5 by Max Altitude (A:C) & Top 5 by Altitude Gain (D:F)
  sh.getRange('A25:C25').merge().setValue('Top 5 by Max Altitude').setBackground('#CFD8DC').setFontWeight('bold').setHorizontalAlignment('center').setVerticalAlignment('middle');
  sh.getRange('D25:F25').merge().setValue('Top 5 by Altitude Gain').setBackground('#CFD8DC').setFontWeight('bold').setHorizontalAlignment('center').setVerticalAlignment('middle');
  sh.setRowHeight(25, 26);

  for (var m = 1; m <= 5; m++) {
    var rNum2 = m + 25;
    // Top Max Altitude (A:C): colFlightNo, colMaxAlt, colDate formatted, colLaunchSite, sorted on colMaxAlt
    var altRange = 'SORT(FILTER({' +
      'INDIRECT("' + fSheet + '!' + colFlightNo + fStart + ':' + colFlightNo + '"), ' +
      'INDIRECT("' + fSheet + '!' + colMaxAlt + fStart + ':' + colMaxAlt + '"), ' +
      'TEXT(INDIRECT("' + fSheet + '!' + colDate + fStart + ':' + colDate + '"), "' + dateFmt + '"), ' +
      'INDIRECT("' + fSheet + '!' + colLaunchSite + fStart + ':' + colLaunchSite + '")}, ' +
      fStatusFilter + ' * (IFERROR(VALUE(INDIRECT("' + fSheet + '!' + colMaxAlt + fStart + ':' + colMaxAlt + '")), 0)>0)), 2, FALSE)';

    var fAlt = '=IFERROR("Flight " & INDEX(' + altRange + ', ' + m + ', 1) & ": " & TEXT(INDEX(' + altRange + ', ' + m + ', 2), "#,##0") & " m (" & INDEX(' + altRange + ', ' + m + ', 3) & IF(INDEX(' + altRange + ', ' + m + ', 4) <> "", ", " & INDEX(' + altRange + ', ' + m + ', 4), "") & ")", "-")';
    sh.getRange(rNum2, 1, 1, 3).merge().setFormula(fAlt).setBorder(false, false, true, false, false, false, '#E0E0E0', SpreadsheetApp.BorderStyle.SOLID).setVerticalAlignment('middle');

    // Top Altitude Gain (D:F): colFlightNo, colAltGain, colDate formatted, colLaunchSite, sorted on colAltGain
    var gainRange = 'SORT(FILTER({' +
      'INDIRECT("' + fSheet + '!' + colFlightNo + fStart + ':' + colFlightNo + '"), ' +
      'INDIRECT("' + fSheet + '!' + colAltGain + fStart + ':' + colAltGain + '"), ' +
      'TEXT(INDIRECT("' + fSheet + '!' + colDate + fStart + ':' + colDate + '"), "' + dateFmt + '"), ' +
      'INDIRECT("' + fSheet + '!' + colLaunchSite + fStart + ':' + colLaunchSite + '")}, ' +
      fStatusFilter + ' * (IFERROR(VALUE(INDIRECT("' + fSheet + '!' + colAltGain + fStart + ':' + colAltGain + '")), 0)>0)), 2, FALSE)';

    var fGain = '=IFERROR("Flight " & INDEX(' + gainRange + ', ' + m + ', 1) & ": " & TEXT(INDEX(' + gainRange + ', ' + m + ', 2), "#,##0") & " m (" & INDEX(' + gainRange + ', ' + m + ', 3) & IF(INDEX(' + gainRange + ', ' + m + ', 4) <> "", ", " & INDEX(' + gainRange + ', ' + m + ', 4), "") & ")", "-")';
    sh.getRange(rNum2, 4, 1, 3).merge().setFormula(fGain).setBorder(false, false, true, false, false, false, '#E0E0E0', SpreadsheetApp.BorderStyle.SOLID).setVerticalAlignment('middle');
    sh.setRowHeight(rNum2, 22);
  }

  // Spacer Row 31
  sh.setRowHeight(31, 14);

  // Grid Row 3 (Row 32 Header, Rows 33-37 Data): Top 5 Thermal Flights (A:C) & Top 5 Soaring Flights (D:F)
  sh.getRange('A32:C32').merge().setValue('Top 5 Thermal Flights').setBackground('#CFD8DC').setFontWeight('bold').setHorizontalAlignment('center').setVerticalAlignment('middle');
  sh.getRange('D32:F32').merge().setValue('Top 5 Soaring Flights').setBackground('#CFD8DC').setFontWeight('bold').setHorizontalAlignment('center').setVerticalAlignment('middle');
  sh.setRowHeight(32, 26);

  for (var t = 1; t <= 5; t++) {
    var rNum3 = t + 32;
    // Top Thermal Flights (A:C): colFlightNo, colDuration formatted, colThermalPct formatted, colDate formatted, colLaunchSite, sorted on thermalling time
    var thermRange = 'SORT(FILTER({' +
      'INDIRECT("' + fSheet + '!' + colFlightNo + fStart + ':' + colFlightNo + '"), ' +
      'TEXT(IFERROR(TIMEVALUE(INDIRECT("' + fSheet + '!' + colDuration + fStart + ':' + colDuration + '")), INDIRECT("' + fSheet + '!' + colDuration + fStart + ':' + colDuration + '")), "[h]:mm") & " hrs", ' +
      'TEXT(IFERROR(VALUE(INDIRECT("' + fSheet + '!' + colThermalPct + fStart + ':' + colThermalPct + '")), 0), "0%"), ' +
      'TEXT(INDIRECT("' + fSheet + '!' + colDate + fStart + ':' + colDate + '"), "' + dateFmt + '"), ' +
      'INDIRECT("' + fSheet + '!' + colLaunchSite + fStart + ':' + colLaunchSite + '"), ' +
      'IFERROR(VALUE(INDIRECT("' + fSheet + '!' + colThermalPct + fStart + ':' + colThermalPct + '")) * TIMEVALUE(INDIRECT("' + fSheet + '!' + colDuration + fStart + ':' + colDuration + '")), 0)}, ' +
      fStatusFilter + ' * (IFERROR(VALUE(INDIRECT("' + fSheet + '!' + colThermalPct + fStart + ':' + colThermalPct + '")) * TIMEVALUE(INDIRECT("' + fSheet + '!' + colDuration + fStart + ':' + colDuration + '")), 0)>0)), 6, FALSE)';

    var fTherm = '=IFERROR("Flight " & INDEX(' + thermRange + ', ' + t + ', 1) & ": " & INDEX(' + thermRange + ', ' + t + ', 2) & ", " & INDEX(' + thermRange + ', ' + t + ', 3) & " (" & INDEX(' + thermRange + ', ' + t + ', 4) & IF(INDEX(' + thermRange + ', ' + t + ', 5) <> "", ", " & INDEX(' + thermRange + ', ' + t + ', 5), "") & ")", "-")';
    sh.getRange(rNum3, 1, 1, 3).merge().setFormula(fTherm).setBorder(false, false, true, false, false, false, '#E0E0E0', SpreadsheetApp.BorderStyle.SOLID).setVerticalAlignment('middle');

    // Top Soaring Flights (D:F): colFlightNo, colDuration formatted, colSoarPct formatted, colDate formatted, colLaunchSite, sorted on soaring time
    var soarRange = 'SORT(FILTER({' +
      'INDIRECT("' + fSheet + '!' + colFlightNo + fStart + ':' + colFlightNo + '"), ' +
      'TEXT(IFERROR(TIMEVALUE(INDIRECT("' + fSheet + '!' + colDuration + fStart + ':' + colDuration + '")), INDIRECT("' + fSheet + '!' + colDuration + fStart + ':' + colDuration + '")), "[h]:mm") & " hrs", ' +
      'TEXT(IFERROR(VALUE(INDIRECT("' + fSheet + '!' + colSoarPct + fStart + ':' + colSoarPct + '")), 0), "0%"), ' +
      'TEXT(INDIRECT("' + fSheet + '!' + colDate + fStart + ':' + colDate + '"), "' + dateFmt + '"), ' +
      'INDIRECT("' + fSheet + '!' + colLaunchSite + fStart + ':' + colLaunchSite + '"), ' +
      'IFERROR(VALUE(INDIRECT("' + fSheet + '!' + colSoarPct + fStart + ':' + colSoarPct + '")) * TIMEVALUE(INDIRECT("' + fSheet + '!' + colDuration + fStart + ':' + colDuration + '")), 0)}, ' +
      fStatusFilter + ' * (IFERROR(VALUE(INDIRECT("' + fSheet + '!' + colSoarPct + fStart + ':' + colSoarPct + '")), 0)>0)), 6, FALSE)';

    var fSoar = '=IFERROR("Flight " & INDEX(' + soarRange + ', ' + t + ', 1) & ": " & INDEX(' + soarRange + ', ' + t + ', 2) & ", " & INDEX(' + soarRange + ', ' + t + ', 3) & " (" & INDEX(' + soarRange + ', ' + t + ', 4) & IF(INDEX(' + soarRange + ', ' + t + ', 5) <> "", ", " & INDEX(' + soarRange + ', ' + t + ', 5), "") & ")", "-")';
    sh.getRange(rNum3, 4, 1, 3).merge().setFormula(fSoar).setBorder(false, false, true, false, false, false, '#E0E0E0', SpreadsheetApp.BorderStyle.SOLID).setVerticalAlignment('middle');
    sh.setRowHeight(rNum3, 22);
  }

  // Spacer Row 38
  sh.setRowHeight(38, 14);

  // Grid Row 4 (Row 39 Header, Rows 40-44 Data): Top 5 by XC Score (A:C) & Top 5 by Max Groundspeed (D:F)
  sh.getRange('A39:C39').merge().setValue('Top 5 by XC Score').setBackground('#CFD8DC').setFontWeight('bold').setHorizontalAlignment('center').setVerticalAlignment('middle');
  sh.getRange('D39:F39').merge().setValue('Top 5 by Max Groundspeed').setBackground('#CFD8DC').setFontWeight('bold').setHorizontalAlignment('center').setVerticalAlignment('middle');
  sh.setRowHeight(39, 26);

  for (var p = 1; p <= 5; p++) {
    var rNum4 = p + 39;
    // Top XC Score (A:C): colFlightNo, colXcScore, colDate formatted, colLaunchSite, sorted on colXcScore
    var xcRange = 'SORT(FILTER({' +
      'INDIRECT("' + fSheet + '!' + colFlightNo + fStart + ':' + colFlightNo + '"), ' +
      'IFERROR(VALUE(INDIRECT("' + fSheet + '!' + colXcScore + fStart + ':' + colXcScore + '")), 0), ' +
      'TEXT(INDIRECT("' + fSheet + '!' + colDate + fStart + ':' + colDate + '"), "' + dateFmt + '"), ' +
      'INDIRECT("' + fSheet + '!' + colLaunchSite + fStart + ':' + colLaunchSite + '")}, ' +
      fStatusFilter + ' * (IFERROR(VALUE(INDIRECT("' + fSheet + '!' + colXcScore + fStart + ':' + colXcScore + '")), 0)>0)), 2, FALSE)';

    var fXC = '=IFERROR("Flight " & INDEX(' + xcRange + ', ' + p + ', 1) & ": " & TEXT(INDEX(' + xcRange + ', ' + p + ', 2), "0.0") & " pts (" & INDEX(' + xcRange + ', ' + p + ', 3) & IF(INDEX(' + xcRange + ', ' + p + ', 4) <> "", ", " & INDEX(' + xcRange + ', ' + p + ', 4), "") & ")", "-")';
    sh.getRange(rNum4, 1, 1, 3).merge().setFormula(fXC).setBorder(false, false, true, false, false, false, '#E0E0E0', SpreadsheetApp.BorderStyle.SOLID).setVerticalAlignment('middle');

    // Top Max Groundspeed (D:F): colFlightNo, colMaxSpeed, colDate formatted, colLaunchSite, sorted on colMaxSpeed
    var speedRange = 'SORT(FILTER({' +
      'INDIRECT("' + fSheet + '!' + colFlightNo + fStart + ':' + colFlightNo + '"), ' +
      'IFERROR(VALUE(INDIRECT("' + fSheet + '!' + colMaxSpeed + fStart + ':' + colMaxSpeed + '")), 0), ' +
      'TEXT(INDIRECT("' + fSheet + '!' + colDate + fStart + ':' + colDate + '"), "' + dateFmt + '"), ' +
      'INDIRECT("' + fSheet + '!' + colLaunchSite + fStart + ':' + colLaunchSite + '")}, ' +
      fStatusFilter + ' * (IFERROR(VALUE(INDIRECT("' + fSheet + '!' + colMaxSpeed + fStart + ':' + colMaxSpeed + '")), 0)>0)), 2, FALSE)';

    var fSpeed = '=IFERROR("Flight " & INDEX(' + speedRange + ', ' + p + ', 1) & ": " & TEXT(INDEX(' + speedRange + ', ' + p + ', 2), "0.0") & " km/h (" & INDEX(' + speedRange + ', ' + p + ', 3) & IF(INDEX(' + speedRange + ', ' + p + ', 4) <> "", ", " & INDEX(' + speedRange + ', ' + p + ', 4), "") & ")", "-")';
    sh.getRange(rNum4, 4, 1, 3).merge().setFormula(fSpeed).setBorder(false, false, true, false, false, false, '#E0E0E0', SpreadsheetApp.BorderStyle.SOLID).setVerticalAlignment('middle');
    sh.setRowHeight(rNum4, 22);
  }

  // Spacer Row 45
  sh.setRowHeight(45, 14);

  // 6. Section 5: Lists (Launch Sites & Countries Flown - 20 Rows Pre-scaffolded)
  sh.getRange('A46:C46').merge().setValue('List of Launch Sites').setBackground('#CFD8DC').setFontWeight('bold').setHorizontalAlignment('center').setVerticalAlignment('middle');
  sh.getRange('D46:F46').merge().setValue('List of Countries').setBackground('#CFD8DC').setFontWeight('bold').setHorizontalAlignment('center').setVerticalAlignment('middle');
  sh.setRowHeight(46, 26);

  var qWhere = '"SELECT Col2, COUNT(Col2) WHERE (Col1 = \'Valid\' " & IF(DASHBOARD_REVIEW_FILTER="Yes", "OR Col1 = \'Review?\'", "") & ") AND Col2 IS NOT NULL AND Col2 <> \'\' GROUP BY Col2 ORDER BY COUNT(Col2) DESC LABEL COUNT(Col2) \'\'"';

  for (var n = 1; n <= 20; n++) {
    var rNum5 = n + 46;
    // Launch Sites (A:C): colLaunchSite, filtered by colStatus = 'Valid' (or 'Review?' if B2="Yes")
    var fSite = '=IFERROR(INDEX(QUERY({INDIRECT("' + fSheet + '!' + colStatus + fStart + ':' + colStatus + '"), INDIRECT("' + fSheet + '!' + colLaunchSite + fStart + ':' + colLaunchSite + '")}, ' + qWhere + '), ' + n + ', 1) & " - " & INDEX(QUERY({INDIRECT("' + fSheet + '!' + colStatus + fStart + ':' + colStatus + '"), INDIRECT("' + fSheet + '!' + colLaunchSite + fStart + ':' + colLaunchSite + '")}, ' + qWhere + '), ' + n + ', 2) & " Flights", "")';
    sh.getRange(rNum5, 1, 1, 3).merge().setFormula(fSite).setBorder(false, false, true, false, false, false, '#E0E0E0', SpreadsheetApp.BorderStyle.SOLID).setVerticalAlignment('middle');

    // Countries Flown (D:F): colLaunchCountry, filtered by colStatus = 'Valid' (or 'Review?' if B2="Yes")
    var fCtry = '=IFERROR(INDEX(QUERY({INDIRECT("' + fSheet + '!' + colStatus + fStart + ':' + colStatus + '"), INDIRECT("' + fSheet + '!' + colLaunchCountry + fStart + ':' + colLaunchCountry + '")}, ' + qWhere + '), ' + n + ', 1) & " - " & INDEX(QUERY({INDIRECT("' + fSheet + '!' + colStatus + fStart + ':' + colStatus + '"), INDIRECT("' + fSheet + '!' + colLaunchCountry + fStart + ':' + colLaunchCountry + '")}, ' + qWhere + '), ' + n + ', 2) & " Flights", "")';
    sh.getRange(rNum5, 4, 1, 3).merge().setFormula(fCtry).setBorder(false, false, true, false, false, false, '#E0E0E0', SpreadsheetApp.BorderStyle.SOLID).setVerticalAlignment('middle');
    sh.setRowHeight(rNum5, 22);
  }

  // Spacer Row 67
  sh.setRowHeight(67, 14);

  // 7. Formatting & Cleanup
  // Column Widths for clean 6-column layout (155px per column = 930px total)
  for (var col = 1; col <= 6; col++) {
    sh.setColumnWidth(col, 155);
  }

  // Set Word Wrap on ALL populated cells
  sh.getRange(1, 1, 67, 6).setWrapStrategy(SpreadsheetApp.WrapStrategy.WRAP);

  // Clean bounds: remove excess columns and rows for a crisp, app-like finish with a 3-row buffer
  if (sh.getMaxColumns() > 6) {
    try { sh.deleteColumns(7, sh.getMaxColumns() - 6); } catch(e) {}
  }
  if (sh.getMaxRows() > 70) {
    try { sh.deleteRows(71, sh.getMaxRows() - 70); } catch(e) {}
  }

  // Soft Guardrails on Dashboard to prevent accidental paste wipes
  applySoftGuardrail_(sh, sh.getRange('A4:F15'), 'Guardrail: Dashboard Summary & Activity KPIs');
  applySoftGuardrail_(sh, sh.getRange('A18:F45'), 'Guardrail: Dashboard Leaderboard Cards');
  applySoftGuardrail_(sh, sh.getRange('A46:F66'), 'Guardrail: Dashboard Lists');

  registerSheetId_(ss, 'DASHBOARD', sh);
  sh.setHiddenGridlines(true);
}

function scaffoldConfig_(ss) {
  var sh = ss.getSheetByName(TABS.CONFIG.name);
  if (!sh) {
    sh = ss.insertSheet(TABS.CONFIG.name, TABS.CONFIG.index);
  }
  sh.showSheet();
  sh.setTabColor(TABS.CONFIG.color);
  var existingMap = {};
  
  // Preserve existing user values if present
  if (sh.getLastRow() > 2) {
      try {
        var vals = sh.getRange(3, 1, sh.getLastRow()-2, 2).getValues();
        var paramMap = {};
        // Build map of Config Keys for fuzzy matching
        CFG.parameters.forEach(function(p) { paramMap[p.key] = p.key; });
        
        vals.forEach(function(r) { 
           var key = r[0];
           var val = r[1];
           if (key) {
             // Direct Match
             if (paramMap[key]) {
               if (key === 'DATE_FORMAT' && (val instanceof Date || typeof val === 'number')) {
                 val = CFG.defaults.DATE_FORMAT;
               } else if (key === 'TIME_FORMAT' && (val instanceof Date || typeof val === 'number')) {
                 val = CFG.defaults.TIME_FORMAT;
               }
               existingMap[key] = val;
             } else {
               // Migration / Friendly Name Mapping
               // Handle cases where user or old version used Friendly Names
               if (key.match(/Watch Folder ID/i)) existingMap['WATCH_FOLDER_ID'] = val;
               else if (key.match(/Upload Folder ID/i)) existingMap['UPLOAD_FOLDER_ID'] = val;
               else if (key.match(/Enable.*Watch/i)) existingMap['ENABLE_WATCH_FOLDER'] = val;
               else if (key.match(/Watch.*Period/i)) existingMap['WATCH_PERIOD_MIN'] = val;
               else if (key.match(/Email/i)) existingMap['CONTACT_EMAIL'] = val;
             }
           }
        });
      } catch(e) { console.warn('Param preservation error', e); }
  }
  
  sh.clear();
  ensureDimensions_(sh, 60, 14);

  // Row 1: Header Blocks
  // Left: System Parameters (A1:C1)
  sh.getRange('A1').setValue('Config - System Parameters & Settings').setFontWeight('bold').setFontSize(12);
  sh.getRange('A1:C1').setBackground(TABS.CONFIG.color).setHorizontalAlignment('center');

  // Col D: blank spacer column
  sh.setColumnWidth(4, 25);

  // Right: Controlled Vocabularies & Lookups (E1:N1)
  sh.getRange('E1').setValue('Lookups & Controlled Vocabularies').setFontWeight('bold').setFontSize(12);
  sh.getRange('E1:N1').setBackground('#795548').setFontColor('white').setHorizontalAlignment('center');

  // Row 2: Columns
  // Left side (A2:C2)
  sh.getRange(2, 1, 1, 3).setValues([TABS.CONFIG.columns]);
  sh.getRange(2, 1, 1, 3).setFontWeight('bold').setBackground('#616161').setFontColor('white');

  // Right side (E2:N2)
  var lookupCols = [
    'Equipment Categories',
    'Flight Status',
    'Flight Type',
    'XC Classes',
    'Date Formats',
    'Time Formats',
    'Wings (Auto)',
    'Harnesses (Auto)',
    'Reserves (Auto)',
    'Other (Auto)'
  ];
  sh.getRange(2, 5, 1, lookupCols.length).setValues([lookupCols]);
  sh.getRange(2, 5, 1, lookupCols.length).setFontWeight('bold').setBackground('#EEEEEE');

  var rows = [];
  var lastSection = '';
  
  CFG.parameters.forEach(function(p) {
      if (p.section !== lastSection) {
          rows.push(['[ ' + p.section + ' ]', '', '']);
          lastSection = p.section;
      }
      // Use existing value if available, else default
      var val = (existingMap[p.key] !== undefined && existingMap[p.key] !== '') ? existingMap[p.key] : p.val;
      // Upgrade default if legacy config lacks google
      if (p.key === 'GEO_REV_PROVIDERS' && val && String(val).indexOf('google') === -1) {
        val = p.val;
      }
      if (p.key === 'TIMELINE_HOURS_LOW' || p.key === 'TIMELINE_HOURS_MED') {
        if (typeof val === 'string' && val.indexOf(':') !== -1) {
          var parts = val.replace(/[^0-9:]/g, '').split(':');
          val = (Number(parts[0]) || 0) / 24 + (Number(parts[1]) || 0) / 1440;
        } else if (val instanceof Date) {
          val = (val.getHours() + val.getMinutes() / 60) / 24;
        } else if (typeof val === 'string' && !isNaN(Number(val)) && val !== '') {
          val = Number(val);
        }
      } else if (p.key === 'TIMELINE_FLIGHTS_LOW' || p.key === 'TIMELINE_FLIGHTS_MED') {
        if (typeof val === 'string') {
          val = Number(val.replace(/[^0-9.]/g, '')) || p.val;
        }
      }
      var desc = p.desc;
      var isFolder = (p.key === 'WATCH_FOLDER_ID' || p.key === 'UPLOAD_FOLDER_ID' || p.key === 'MASTER_LOG_FOLDER_ID' || p.key === 'ERROR_FOLDER_ID' || p.key === 'TRASH_FOLDER_ID');
      if (isFolder && val) {
        var pStr = (p.key === 'WATCH_FOLDER_ID') ? getMultiFolderPath_(val) : getFolderPath_(val);
        if (pStr) desc += '\n[Path: ' + pStr + ']';
      }
      rows.push([p.key, val, desc, p.input]);
  });

  // Write Parameters Data
  var writeRows = rows.map(function(r) { return [r[0], r[1], r[2]]; });
  ensureDimensions_(sh, writeRows.length + 5, 14);
  sh.getRange(3, 1, writeRows.length, 3).setValues(writeRows);
  
  // Formatting Parameters
  for (var i=0; i<rows.length; i++) {
     var rowNum = i + 3;
     if (rows[i][0].indexOf('[') === 0) {
        // Section Header
        sh.getRange(rowNum, 1, 1, 3).setBackground('#E0E0E0').setFontWeight('bold');
     } else if (rows[i][3] === true) {
        // Input Field
        sh.getRange(rowNum, 2).setBackground('#FFF9C4');
     }
     if (rows[i][0] === 'DATE_FORMAT' || rows[i][0] === 'TIME_FORMAT') {
        sh.getRange(rowNum, 2).setNumberFormat('@');
     } else if (rows[i][0] === 'TIMELINE_HOURS_LOW' || rows[i][0] === 'TIMELINE_HOURS_MED') {
        sh.getRange(rowNum, 2).setNumberFormat('[h]:mm "hrs"');
     } else if (rows[i][0] === 'TIMELINE_FLIGHTS_LOW' || rows[i][0] === 'TIMELINE_FLIGHTS_MED') {
        sh.getRange(rowNum, 2).setNumberFormat('0 "flts"');
     }
  }

  // Populate Lookups on Right (Row 3+)
  // E3:E6: Static Equipment Categories (Col 5)
  sh.getRange('E3:E6').setValues([['Wing'], ['Harness'], ['Reserve'], ['Other']]);

  // Status & Types from CFG (Manual Lookups: Cols F=6, G=7, H=8, I=9, J=10)
  var statuses = ['Valid', 'Review?', 'Dup-Primary', 'Dup-Others', 'Invalid?', 'Remove'];
  var types = ['Free Fly', 'XC', 'Thermal XC', 'Ridge Soaring', 'Hike & Fly', 'Tandem', 'SIV / Maneuvers', 'Comp', 'Training', 'Other'];
  var xcClasses = ['Free Flight', 'Flat Triangle', 'FAI Triangle', 'Out-and-Return'];
  var dateFormats = ['yyyy-MM-dd', 'MM/dd/yyyy', 'dd/MM/yyyy', 'MMM dd, yyyy', 'ddd, MMM dd'];
  var timeFormats = ['HH:mm', 'h:mm a'];

  if (statuses.length > 0) sh.getRange(3, 6, statuses.length, 1).setValues(statuses.map(function(s) { return [s]; }));
  if (types.length > 0) sh.getRange(3, 7, types.length, 1).setValues(types.map(function(t) { return [t]; }));
  if (xcClasses.length > 0) sh.getRange(3, 8, xcClasses.length, 1).setValues(xcClasses.map(function(t) { return [t]; }));
  if (dateFormats.length > 0) sh.getRange(3, 9, dateFormats.length, 1).setNumberFormat('@').setValues(dateFormats.map(function(t) { return [t]; }));
  if (timeFormats.length > 0) sh.getRange(3, 10, timeFormats.length, 1).setNumberFormat('@').setValues(timeFormats.map(function(t) { return [t]; }));

  // K3:N3: Native FILTER & SORT from Equipment (Auto Lookups: Cols K=11, L=12, M=13, N=14)
  // Replaces string-based SQL QUERY with native FILTER/SORT so Google Sheets auto-tracks column moves
  var eqName = TABS.EQUIPMENT.name;
  var eqCols = (TABS.EQUIPMENT && TABS.EQUIPMENT.columns) ? TABS.EQUIPMENT.columns : [];
  var colCatIdx = eqCols.indexOf('Category') + 1;
  var colIdIdx = eqCols.indexOf('EquipmentID') + 1;
  var colRetIdx = eqCols.indexOf('Retired?') + 1;
  var cCat = columnToLetter_(colCatIdx > 0 ? colCatIdx : 1);
  var cId = columnToLetter_(colIdIdx > 0 ? colIdIdx : 2);
  var cRet = columnToLetter_(colRetIdx > 0 ? colRetIdx : 8);

  var rngId = eqName + '!$' + cId + '$3:$' + cId;
  var rngCat = eqName + '!$' + cCat + '$3:$' + cCat;
  var rngRet = eqName + '!$' + cRet + '$3:$' + cRet;

  sh.getRange('K3').setFormula('=IFERROR(SORT(FILTER(' + rngId + ', ' + rngCat + '="Wing", (' + rngRet + '<>"Y"))), "")');
  sh.getRange('L3').setFormula('=IFERROR(SORT(FILTER(' + rngId + ', ' + rngCat + '="Harness", (' + rngRet + '<>"Y"))), "")');
  sh.getRange('M3').setFormula('=IFERROR(SORT(FILTER(' + rngId + ', ' + rngCat + '="Reserve", (' + rngRet + '<>"Y"))), "")');
  sh.getRange('N3').setFormula('=IFERROR(SORT(FILTER(' + rngId + ', ' + rngCat + '="Other", (' + rngRet + '<>"Y"))), "")');

  // Register Native Google Sheets Named Ranges for Lookups
  registerNamedRange_(ss, 'LOOKUP_EQUIPMENT_CATS', sh.getRange('E3:E'));
  registerNamedRange_(ss, 'LOOKUP_FLIGHT_STATUSES', sh.getRange('F3:F'));
  registerNamedRange_(ss, 'LOOKUP_FLIGHT_TYPES', sh.getRange('G3:G'));
  registerNamedRange_(ss, 'LOOKUP_XC_CLASSES', sh.getRange('H3:H'));
  registerNamedRange_(ss, 'LOOKUP_ACTIVE_WINGS', sh.getRange('K3:K'));
  registerNamedRange_(ss, 'LOOKUP_ACTIVE_HARNESSES', sh.getRange('L3:L'));
  registerNamedRange_(ss, 'LOOKUP_ACTIVE_RESERVES', sh.getRange('M3:M'));
  registerNamedRange_(ss, 'LOOKUP_ACTIVE_OTHER', sh.getRange('N3:N'));

  // Soft Guardrails on Config Tab
  applySoftGuardrail_(sh, sh.getRange('K3:N3'), 'Guardrail: Equipment Auto-Lookup Formulas');
  registerSheetId_(ss, 'CONFIG', sh);

  // Validation for Date/Time Formats & Booleans in Parameters
  var dateRange = sh.getRange('I3:I7');
  var timeRange = sh.getRange('J3:J4');
  var dateRule = SpreadsheetApp.newDataValidation().requireValueInRange(dateRange, true).build();
  var timeRule = SpreadsheetApp.newDataValidation().requireValueInRange(timeRange, true).build();

  var logLevels = (typeof CFG !== 'undefined' && CFG.LOG_LEVELS) ? CFG.LOG_LEVELS : ['Silent', 'Silent unless some activity', 'Exceptions', 'Summary', 'Normal', 'Debug'];
  var logLevelRule = SpreadsheetApp.newDataValidation().requireValueInList(logLevels, true).build();
  var yesNoRule = SpreadsheetApp.newDataValidation().requireValueInList(['Yes', 'No'], true).build();
  var intervalRule = SpreadsheetApp.newDataValidation().requireValueInList(['5', '10', '15', '30', '60'], true).build();

  for (var i = 0; i < rows.length; i++) {
    var pKey = String(rows[i][0] || '');
    if (pKey === 'DATE_FORMAT') sh.getRange(i + 3, 2).setNumberFormat('@').setDataValidation(dateRule);
    if (pKey === 'TIME_FORMAT') sh.getRange(i + 3, 2).setNumberFormat('@').setDataValidation(timeRule);
    if (pKey.indexOf('LOG_LEVEL') === 0) sh.getRange(i + 3, 2).setDataValidation(logLevelRule);
    if (pKey === 'LOG_AUTO_CLEAN' || pKey === 'HEARTBEAT_ENABLED') sh.getRange(i + 3, 2).setDataValidation(yesNoRule);
    if (pKey === 'HEARTBEAT_INTERVAL_MIN') sh.getRange(i + 3, 2).setDataValidation(intervalRule);
    if (['ENABLE_WATCH_FOLDER', 'MOVE_FROM_WATCH_FOLDER'].indexOf(pKey) > -1) {
      var boolRule = SpreadsheetApp.newDataValidation().requireValueInList(['TRUE', 'FALSE'], true).build();
      sh.getRange(i + 3, 2).setDataValidation(boolRule);
    }
  }

  sh.autoResizeColumns(1, 3);
  sh.autoResizeColumns(5, 10);
}

function scaffoldParameters_(ss) {
  scaffoldConfig_(ss);
}

function scaffoldEquipment_(ss) {
  var sh = ss.getSheetByName(TABS.EQUIPMENT.name);
  if (!sh) return;
  ensureDimensions_(sh, 55, 13);
  if (sh.getLastRow() === 0) {
    // Header Row 1
    sh.getRange('A1').setValue(TABS.EQUIPMENT.name).setFontWeight('bold').setFontSize(12);
    sh.getRange('A1:M1').setBackground(TABS.EQUIPMENT.color).setFontColor('white');

    // Column Headers Row 2
    var head = TABS.EQUIPMENT.columns;
    sh.getRange(2, 1, 1, head.length).setValues([head]);
    sh.getRange(2, 1, 1, head.length).setFontWeight('bold').setBackground('#E0F7FA').setBorder(true, true, true, true, true, true);
    
    // Y/N Dropdowns (G=Default?, H=Retired?) - Limit to dataEndRow
    var limit = TABS.EQUIPMENT.dataEndRow;
    var rows = limit - 2; 
    if (rows > 0) {
       var ynRule = SpreadsheetApp.newDataValidation().requireValueInList(['Y', 'N'], true).setAllowInvalid(true).build();
       sh.getRange(3, 7, rows, 2).setDataValidation(ynRule); 
    }
  
    sh.setFrozenRows(2);
    sh.autoResizeColumns(1, head.length);
  }
  applyEquipmentValidation_(sh);
}

function scaffoldLookups_(ss) {
  scaffoldConfig_(ss);
}

function scaffoldSystemLog_(ss) {
  var tabDef = (typeof TABS !== 'undefined' && TABS.SYSTEM_LOG) ? TABS.SYSTEM_LOG : { name: 'System Log', color: '#D32F2F', index: 7, columns: ['Process', 'Timestamp', 'Activity / Event', 'Additional Info'] };
  var targetName = tabDef.name || 'System Log';
  var sh = ss.getSheetByName(targetName);
  if (!sh) {
    // Auto-detect and gracefully rename legacy Activity Logs or App_Log to preserve user history
    var oldSh = ss.getSheetByName('Activity Logs') || ss.getSheetByName('App_Log'); // Legacy migration bridge
    if (oldSh) {
      oldSh.setName(targetName);
      sh = oldSh;
    } else {
      sh = ss.insertSheet(targetName, tabDef.index || 7);
    }
  }
  if (!sh) return;
  registerSheetId_(ss, 'SYSTEM_LOG', sh);
  sh.setTabColor(tabDef.color || '#D32F2F');
  ensureDimensions_(sh, 50, 4);

  // Set / refresh headers
  var lastCol = Math.max(4, sh.getLastColumn());
  sh.getRange('A1:D1').setBackground(tabDef.color || '#D32F2F').setFontColor('white');
  sh.getRange('A1').setValue(targetName).setFontWeight('bold').setFontSize(12);
  if (lastCol > 4) {
    sh.getRange(1, 5, 1, lastCol - 4).clear();
    sh.getRange(2, 5, 1, lastCol - 4).clear();
  }
  
  var cols = tabDef.columns || ['Process', 'Timestamp', 'Activity / Event', 'Additional Info'];
  sh.getRange(2, 1, 1, 4).setValues([cols]);
  sh.getRange(2, 1, 1, 4).setFontWeight('bold').setBackground('#F5F5F5').setFontColor('#333333');
  sh.setFrozenRows(2);

  // Set explicit column widths per design spec
  sh.setColumnWidth(1, 175); // Process
  sh.setColumnWidth(2, 165); // Timestamp
  sh.setColumnWidth(3, 530); // Activity / Event
  sh.setColumnWidth(4, 380); // Additional Info

  // Text wrap on Activity and Info columns
  sh.getRange('C:D').setWrap(true);
  sh.getRange('B3:B').setNumberFormat('yyyy-mm-dd hh:mm:ss');
}

function scaffoldActivityLogs_(ss) {
  scaffoldSystemLog_(ss); // Migration bridge
}

function scaffoldAppLog_(ss) {
  scaffoldSystemLog_(ss); // Backward-compatibility migration bridge
}

/**
 * Scaffolds the Automation_Queue sheet per DSGN-UI-001 Section 3.3
 * Provides persistent, observable storage for background and automation jobs.
 */
function scaffoldQueue_(ss) {
  var sh = ss.getSheetByName(TABS.QUEUE.name);
  if (!sh) {
    sh = ss.insertSheet(TABS.QUEUE.name, TABS.QUEUE.index);
  }
  if (!sh) return;
  sh.setTabColor(TABS.QUEUE.color);
  ensureDimensions_(sh, 30, 8);

  // Row 1: Headers
  var lastCol = Math.max(8, sh.getLastColumn());
  if (lastCol > 8) {
    sh.getRange(1, 9, 1, lastCol - 8).clear();
  }
  sh.getRange(1, 1, 1, 8).setValues([TABS.QUEUE.columns]);
  sh.getRange(1, 1, 1, 8)
    .setFontWeight('bold')
    .setBackground(TABS.QUEUE.color)
    .setFontColor('#FFFFFF')
    .setFontSize(10);
  sh.setFrozenRows(1);

  // Explicit column widths per DSGN-UI-001
  sh.setColumnWidth(1, 170); // Job ID
  sh.setColumnWidth(2, 130); // Type
  sh.setColumnWidth(3, 120); // Status
  sh.setColumnWidth(4, 100); // Progress
  sh.setColumnWidth(5, 150); // Started At
  sh.setColumnWidth(6, 150); // Updated At
  sh.setColumnWidth(7, 350); // Payload & State
  sh.setColumnWidth(8, 200); // Last Error

  // Dropdown validations
  var ruleType = SpreadsheetApp.newDataValidation()
    .requireValueInList(['BULK_INGEST', 'PURGE', 'RESYNC', 'MAINTENANCE', 'LOG_CLEANUP'], true)
    .setAllowInvalid(true)
    .build();
  sh.getRange('B2:B').setDataValidation(ruleType);

  var ruleStatus = SpreadsheetApp.newDataValidation()
    .requireValueInList(['QUEUED', 'RUNNING', 'CHECKPOINT_PAUSED', 'COMPLETED', 'CANCELLED', 'FAILED'], true)
    .setAllowInvalid(true)
    .build();
  sh.getRange('C2:C').setDataValidation(ruleStatus);

  // Formatting
  sh.getRange('A2:A').setFontFamily('monospace');
  sh.getRange('G2:G').setFontFamily('monospace').setWrap(true);
  sh.getRange('H2:H').setWrap(true);
  sh.getRange('D2:D').setHorizontalAlignment('center');
  sh.getRange('E2:F').setNumberFormat('yyyy-mm-dd hh:mm:ss');
}

/**
 * Scaffolds the Automation_Rules sheet per DSGN-AUT-001 Rev 2.1
 * Provides persistent, table-driven automation rule definitions.
 */
function scaffoldAutomation_(ss) {
  var tabName = TABS.AUTOMATION_RULES ? TABS.AUTOMATION_RULES.name : 'Automation_Rules';
  var sh = ss.getSheetByName(tabName);
  if (!sh) {
    sh = ss.insertSheet(tabName);
  }
  if (!sh) return;
  registerSheetId_(ss, 'AUTOMATION_RULES', sh);

  var tabColor = (TABS.AUTOMATION_RULES && TABS.AUTOMATION_RULES.color) ? TABS.AUTOMATION_RULES.color : '#00897B';
  sh.setTabColor(tabColor);
  ensureDimensions_(sh, 50, 9);

  // Row 1: Title Banner (Unmerged to prevent frozen column pane collision)
  try {
    sh.getRange('A1:I1').breakApart();
  } catch (breakErr) {}

  sh.getRange('A1:I1')
    .setBackground(tabColor)
    .setFontColor('#FFFFFF')
    .setFontWeight('bold')
    .setFontSize(11)
    .setVerticalAlignment('middle');
  sh.getRange('A1').setValue('⚡ FLIGHT LOG - AUTOMATION RULES ENGINE');
  sh.setRowHeight(1, 32);

  // Row 2: Headers
  var headers = TABS.AUTOMATION_RULES.columns;
  sh.getRange(2, 1, 1, headers.length)
    .setValues([headers])
    .setBackground('#E0F2F1')
    .setFontColor('#004D40')
    .setFontWeight('bold')
    .setFontSize(10)
    .setVerticalAlignment('middle');
  sh.setRowHeight(2, 26);

  sh.setFrozenRows(2);
  sh.setFrozenColumns(2);

  // Column widths per DSGN-AUT-001
  sh.setColumnWidth(1, 75);  // Active?
  sh.setColumnWidth(2, 220); // Automation Name
  sh.setColumnWidth(3, 180); // Action
  sh.setColumnWidth(4, 140); // Trigger Type
  sh.setColumnWidth(5, 140); // Trigger Config
  sh.setColumnWidth(6, 200); // Condition
  sh.setColumnWidth(7, 280); // Parameters
  sh.setColumnWidth(8, 160); // Last Run
  sh.setColumnWidth(9, 260); // Last Result

  // Dropdown Validations
  // Col A: Active? (Yes / No)
  var ruleActive = SpreadsheetApp.newDataValidation()
    .requireValueInList(['Yes', 'No'], true)
    .setAllowInvalid(true)
    .build();
  sh.getRange('A3:A50').setDataValidation(ruleActive).setHorizontalAlignment('center');

  // Col C: Action (Vetted production actions)
  var availableActions = (typeof AUTOMATION_REGISTRY !== 'undefined' && AUTOMATION_REGISTRY.getAvailableActionKeys)
    ? AUTOMATION_REGISTRY.getAvailableActionKeys()
    : ['SCAN_WATCH_FOLDER', 'CLEAN_LOGS', 'PROCESS_QUEUE'];
  var ruleAction = SpreadsheetApp.newDataValidation()
    .requireValueInList(availableActions, true)
    .setAllowInvalid(true)
    .build();
  sh.getRange('C3:C50').setDataValidation(ruleAction);

  // Col D: Trigger Type
  var triggerTypes = ['Time (Minutes)', 'Time (Days)', 'Event (Lifecycle)', 'Manual Execution Only'];
  var ruleTriggerType = SpreadsheetApp.newDataValidation()
    .requireValueInList(triggerTypes, true)
    .setAllowInvalid(true)
    .build();
  sh.getRange('D3:D50').setDataValidation(ruleTriggerType);

  // Data Column Formats
  sh.getRange('G3:G50').setFontFamily('monospace');
  sh.getRange('H3:H50').setNumberFormat('yyyy-mm-dd hh:mm:ss');
  sh.getRange('I3:I50').setWrap(true);

  // Seed Predefined Templates if sheet is empty of rules (row 3 is blank)
  var existingName = sh.getRange('B3').getValue();
  if (!existingName) {
    seedAutomationTemplates_(sh, ss);
  }
}

/**
 * Seeds the 3 core automation rule templates into Automation_Rules
 * Migrates legacy watch folder config if present.
 */
function seedAutomationTemplates_(sh, ss) {
  var watchActive = 'Yes';
  var watchInterval = 15;
  var watchMove = 'Yes';

  try {
    var params = (typeof getParameters_ === 'function') ? getParameters_() : {};
    if (params.ENABLE_WATCH_FOLDER === 'FALSE') watchActive = 'No';
    if (params.WATCH_PERIOD_MIN && !isNaN(Number(params.WATCH_PERIOD_MIN))) {
      watchInterval = Number(params.WATCH_PERIOD_MIN);
    }
    if (params.MOVE_FROM_WATCH_FOLDER === 'FALSE') watchMove = 'No';
  } catch (e) {
    console.warn('Could not read legacy params for automation seed:', e);
  }

  var defaultRows = [
    [watchActive, 'Poll Watch Folders', 'SCAN_WATCH_FOLDER', 'Time (Minutes)', watchInterval, '', 'MoveToTrash=' + watchMove + '; MaxFiles=20', '', 'Ready'],
    ['Yes', 'Prune Activity Logs', 'CLEAN_LOGS', 'Time (Days)', 3, '', 'KeepRows=2000; KeepDays=90', '', 'Ready'],
    ['Yes', 'Process Background Queue', 'PROCESS_QUEUE', 'Time (Minutes)', 5, '', 'BatchSize=5; MaxExecutionSeconds=240', '', 'Ready']
  ];

  sh.getRange(3, 1, defaultRows.length, 9).setValues(defaultRows);
}

function scaffoldFlights_(ss) {
  var sh = ss.getSheetByName(TABS.FLIGHTS.name);
  
  // Tab Header
  sh.getRange('A1').setValue(TABS.FLIGHTS.name).setFontWeight('bold').setFontSize(12);
  sh.getRange('A1:Z1').setBackground(TABS.FLIGHTS.color).setFontColor('white');
  
  // Row 2: Link to Master Flight Log Folder (Cell A2)
  var masterLinkFormula = '=IF(ISBLANK(VLOOKUP("MASTER_LOG_FOLDER_ID", ' + TABS.CONFIG.name + '!A:B, 2, FALSE)), "Master Flight Logs folder (Not Configured)", HYPERLINK("https://drive.google.com/drive/folders/" & VLOOKUP("MASTER_LOG_FOLDER_ID", ' + TABS.CONFIG.name + '!A:B, 2, FALSE), "📁 Master Flight Logs folder"))';
  sh.getRange('A2').setFormula(masterLinkFormula).setFontSize(10).setFontStyle('italic');
  
  // Flatten Headers
  var groups = TABS.FLIGHTS.groups;
  var flatHeaders = [];
  groups.forEach(function(g) { flatHeaders = flatHeaders.concat(g.cols); });
  ensureDimensions_(sh, 2000, flatHeaders.length);
  
  // Write Headers (Row 4)
  sh.getRange(4, 1, 1, flatHeaders.length).setValues([flatHeaders]);
  sh.getRange(4, 1, 1, flatHeaders.length).setFontWeight('bold').setBorder(true, true, true, true, true, true).setWrapStrategy(SpreadsheetApp.WrapStrategy.WRAP).setVerticalAlignment("top");
  
  // Apply Column Notes / Tooltips (Row 4)
  var colNotes = TABS.FLIGHTS.colNotes || {};
  for (var c = 0; c < flatHeaders.length; c++) {
    var colName = flatHeaders[c];
    var cell = sh.getRange(4, c + 1);
    if (colNotes[colName]) {
      cell.setNote(colNotes[colName]);
    } else {
      cell.clearNote();
    }
  }
  
  // Grouping & Formatting
  sh.getRange(3, 1, 1, sh.getMaxColumns()).breakApart();
  var colIndex = 1;
  groups.forEach(function(g) {
    var groupLen = g.cols.length;
    // Category Header (Row 3)
    try {
      if (colIndex === 1 && TABS.FLIGHTS.frozenCols && TABS.FLIGHTS.frozenCols < groupLen) {
        var frozenCount = TABS.FLIGHTS.frozenCols;
        // Columns 1 to frozenCount (A3:D3): unmerged cells inside frozen pane
        sh.getRange(3, 1, 1, frozenCount).setValue('').setBackground(g.color).setBorder(true, true, true, true, false, false, "medium", null);
        // Columns frozenCount + 1 to groupLen (E3:N3): merged Flight Info header
        var unmergedCount = groupLen - frozenCount;
        sh.getRange(3, frozenCount + 1, 1, unmergedCount)
          .merge()
          .setValue(g.name)
          .setBackground(g.color)
          .setHorizontalAlignment('center')
          .setFontWeight('bold')
          .setBorder(true, true, true, true, false, false, "medium", null);
      } else {
        var rangeCat = sh.getRange(3, colIndex, 1, groupLen);
        rangeCat.merge().setValue(g.name).setBackground(g.color).setHorizontalAlignment('center').setFontWeight('bold').setBorder(true, true, true, true, false, false, "medium", null);
      }
      
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
  sh.setFrozenColumns(4);
  SpreadsheetApp.flush();
  applyFlightsValidation_(sh);
  applyFlightsGuardrails_(sh);
  applyFlightsFilter_(sh);
  registerSheetId_(ss, 'FLIGHTS', sh);
}

/* ==========================================================================================
   VALIDATION & UPDATES
   ========================================================================================== */

function updateValidationOnly_() {
  var ss = SpreadsheetApp.getActive();
  var sh = ss.getSheetByName(TABS.FLIGHTS.name);
  if (sh) {
    applyFlightsValidation_(sh);
    applyFlightsGuardrails_(sh);
    // Also re-apply column notes (row 4)
    var colNotes = TABS.FLIGHTS.colNotes || {};
    var lastCol = sh.getLastColumn();
    if (lastCol > 0) {
      var headers = sh.getRange(4, 1, 1, lastCol).getValues()[0];
      for (var c = 0; c < headers.length; c++) {
        var colName = headers[c];
        var cell = sh.getRange(4, c + 1);
        if (colNotes[colName]) {
          cell.setNote(colNotes[colName]);
        } else {
          cell.clearNote();
        }
      }
    }
  }
  
  var shEq = ss.getSheetByName(TABS.EQUIPMENT.name);
  if (shEq) applyEquipmentValidation_(shEq);
  
  // Also refresh parameters in case new ones added
  scaffoldParameters_(ss);
  
  scaffoldUserGuide_(ss);

  // Refresh Activity Logs tab schema & headers
  scaffoldAppLog_(ss);
  
  ss.toast('Validation rules, Column Notes, Parameters, User Guide, and Activity Logs updated.');
}

function applyFlightsValidation_(sh) {
  var ss = SpreadsheetApp.getActive();
  var map = getColumnMap_(sh);
  
  var startRow = TABS.FLIGHTS.dataStartRow;
  var endRow = Math.max(sh.getMaxRows(), TABS.FLIGHTS.dataEndRow || 100); 
  var valRows = endRow - startRow + 1;
  if (valRows < 1) return;

  // Status (Soft dedupe scoring only)
  if (map['Status']) {
    var rule = SpreadsheetApp.newDataValidation().requireValueInList(['Valid', 'Review?', 'Dup-Primary', 'Dup-Others', 'Invalid?', 'Remove'], true).setAllowInvalid(true).build();
    sh.getRange(startRow, map['Status'], valRows, 1).setDataValidation(rule);
    
    // Conditional Formatting
    var range = sh.getRange(startRow, map['Status'], valRows, 1);
    var existingRules = sh.getConditionalFormatRules() || [];
    var nonStatusRules = existingRules.filter(function(r) {
      var rngs = r.getRanges();
      for (var ri = 0; ri < rngs.length; ri++) {
        if (rngs[ri].getColumn() === map['Status']) return false;
      }
      return true;
    });

    nonStatusRules.push(SpreadsheetApp.newConditionalFormatRule().whenTextEqualTo('Valid').setBackground('#C8E6C9').setRanges([range]).build());
    nonStatusRules.push(SpreadsheetApp.newConditionalFormatRule().whenTextEqualTo('Review?').setBackground('#BBDEFB').setRanges([range]).build());
    nonStatusRules.push(SpreadsheetApp.newConditionalFormatRule().whenTextEqualTo('Dup-Primary').setBackground('#FFE082').setRanges([range]).build());
    nonStatusRules.push(SpreadsheetApp.newConditionalFormatRule().whenTextEqualTo('Dup-Others').setBackground('#FFCC80').setRanges([range]).build());
    nonStatusRules.push(SpreadsheetApp.newConditionalFormatRule().whenTextEqualTo('Invalid?').setBackground('#FFCDD2').setRanges([range]).build());
    nonStatusRules.push(SpreadsheetApp.newConditionalFormatRule().whenTextEqualTo('Remove').setBackground('#E0E0E0').setRanges([range]).build());
    sh.setConditionalFormatRules(nonStatusRules);
  }

  var shConfig = ss.getSheetByName(TABS.CONFIG.name);

  // Flight Type (Config Col G / Named Range LOOKUP_FLIGHT_TYPES)
  if (map['Flight Type']) {
    var rngFlightTypes = ss.getRangeByName('LOOKUP_FLIGHT_TYPES') || (shConfig ? shConfig.getRange('G3:G') : null);
    if (rngFlightTypes) {
      var rule = SpreadsheetApp.newDataValidation().requireValueInRange(rngFlightTypes, true).setAllowInvalid(true).build();
      sh.getRange(startRow, map['Flight Type'], valRows, 1).setDataValidation(rule);
    }
  }

  // Equipment (Config Cols K, L, M / Named Ranges)
  if (shConfig) {
    var applyLookup = function(colName, namedRange, fallbackA1) {
      if (map[colName]) {
        var rng = ss.getRangeByName(namedRange) || shConfig.getRange(fallbackA1);
        if (rng) {
          var rule = SpreadsheetApp.newDataValidation().requireValueInRange(rng, true).setAllowInvalid(true).build();
          sh.getRange(startRow, map[colName], valRows, 1).setDataValidation(rule);
        }
      }
    };
    applyLookup('Wing', 'LOOKUP_ACTIVE_WINGS', 'K3:K');
    applyLookup('Harness', 'LOOKUP_ACTIVE_HARNESSES', 'L3:L');
    applyLookup('Reserve 1', 'LOOKUP_ACTIVE_RESERVES', 'M3:M');
    applyLookup('Reserve 2', 'LOOKUP_ACTIVE_RESERVES', 'M3:M');
  }
  
  // XC Flight Class (Config Col H / Named Range LOOKUP_XC_CLASSES)
  if (map['XC Flight Class'] && shConfig) {
    var rngXcClass = ss.getRangeByName('LOOKUP_XC_CLASSES') || shConfig.getRange('H3:H');
    if (rngXcClass) {
      var rule = SpreadsheetApp.newDataValidation().requireValueInRange(rngXcClass, true).setAllowInvalid(true).build();
      sh.getRange(startRow, map['XC Flight Class'], valRows, 1).setDataValidation(rule);
    }
  }
  
  // Closed? (Dropdown)
  if (map['Closed?']) {
     var rule = SpreadsheetApp.newDataValidation().requireValueInList(['Y', 'N'], true).setAllowInvalid(true).build();
     sh.getRange(startRow, map['Closed?'], valRows, 1).setDataValidation(rule);
  }
  
  // Formatting: Wrap & Top Align ALL data cells
  var allData = sh.getRange(startRow, 1, valRows, sh.getLastColumn());
  allData.setWrapStrategy(SpreadsheetApp.WrapStrategy.WRAP);
  allData.setVerticalAlignment("top");
}

function applyEquipmentValidation_(sh) {
  var ss = SpreadsheetApp.getActive();
  var shConfig = ss.getSheetByName(TABS.CONFIG.name);
  if (shConfig) {
    var dataStart = TABS.EQUIPMENT.dataStartRow;
    var dataEnd = Math.max(sh.getMaxRows(), TABS.EQUIPMENT.dataEndRow || 50);
    var numRows = dataEnd - dataStart + 1;
    if (numRows < 1) return;

    // Category Range (Config Col E: Equipment Categories / Named Range)
    var range = ss.getRangeByName('LOOKUP_EQUIPMENT_CATS') || shConfig.getRange('E3:E');
    var rule = SpreadsheetApp.newDataValidation().requireValueInRange(range, true).setAllowInvalid(true).build();
    sh.getRange(dataStart, 1, numRows, 1).setDataValidation(rule);
    
    // Default? (Col 7 / G) and Retired? (Col 8 / H) Y/N Dropdowns
    var ynRule = SpreadsheetApp.newDataValidation().requireValueInList(['Y', 'N'], true).setAllowInvalid(true).build();
    sh.getRange(dataStart, 7, numRows, 1).setDataValidation(ynRule);
    sh.getRange(dataStart, 8, numRows, 1).setDataValidation(ynRule);
  }
}

function getColumnMap_(sh, headerRow) {
  if (!sh) return {};
  var lastCol = sh.getLastColumn();
  if (lastCol < 1) return {};
  
  var hRow = headerRow || 4;
  if (sh.getLastRow() < hRow) {
    hRow = Math.max(1, Math.min(2, sh.getLastRow()));
  }
  
  var headers = sh.getRange(hRow, 1, 1, lastCol).getValues()[0];
  var map = {};
  var normalized = {};
  
  headers.forEach(function(h, i) {
    if (h !== null && h !== undefined && String(h).trim() !== '') {
      var clean = String(h).trim();
      map[clean] = i + 1;
      normalized[clean.toLowerCase()] = i + 1;
    }
  });

  if (typeof Proxy !== 'undefined') {
    return new Proxy(map, {
      get: function(target, prop) {
        if (typeof prop !== 'string') return target[prop];
        if (prop in target) return target[prop];
        var trimmed = prop.trim();
        if (trimmed in target) return target[trimmed];
        var lower = trimmed.toLowerCase();
        if (lower in normalized) return normalized[lower];
        return undefined;
      },
      has: function(target, prop) {
        if (typeof prop !== 'string') return prop in target;
        if (prop in target) return true;
        var trimmed = prop.trim();
        if (trimmed in target) return true;
        return trimmed.toLowerCase() in normalized;
      }
    });
  }
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
     
     // Detect and safely remove deprecated columns (from right to left so data remains aligned)
     var colsToDelete = [
       'GlideRatio_LD (snap)',
       'Trim_kmh (snap)',
       'FullBar_kmh (snap)',
       'Launch-Landing Dist (km)'
     ];
     var lastCol = shF.getLastColumn();
     if (lastCol > 0) {
       var currentHeaders = shF.getRange(4, 1, 1, lastCol).getValues()[0];
       var toDelete = [];
       for (var c = 0; c < currentHeaders.length; c++) {
         if (colsToDelete.indexOf(currentHeaders[c]) !== -1) {
           toDelete.push(c + 1);
         }
       }
       toDelete.sort(function(a, b) { return b - a; });
       toDelete.forEach(function(colIdx) {
         shF.deleteColumn(colIdx);
       });
     }

     // Unmerge Row 3 before applying new category merges
     shF.getRange(3, 1, 1, shF.getMaxColumns()).breakApart();

     // Flatten and rewrite Headers (Row 4)
     var groups = TABS.FLIGHTS.groups;
     var flatHeaders = [];
     groups.forEach(function(g) { flatHeaders = flatHeaders.concat(g.cols); });
     ensureDimensions_(shF, 2000, flatHeaders.length);
     shF.getRange(4, 1, 1, flatHeaders.length).setValues([flatHeaders]);
     shF.getRange(4, 1, 1, flatHeaders.length).setFontWeight('bold').setBorder(true, true, true, true, true, true).setWrapStrategy(SpreadsheetApp.WrapStrategy.WRAP).setVerticalAlignment("top");

     // Apply Column Notes / Tooltips (Row 4)
     var colNotes = TABS.FLIGHTS.colNotes || {};
     for (var c = 0; c < flatHeaders.length; c++) {
       var colName = flatHeaders[c];
       var cell = shF.getRange(4, c + 1);
       if (colNotes[colName]) {
         cell.setNote(colNotes[colName]);
       } else {
         cell.clearNote();
       }
     }

     // Clear any leftover header cells beyond flatHeaders
     var newLastCol = shF.getLastColumn();
     if (newLastCol > flatHeaders.length) {
       shF.getRange(3, flatHeaders.length + 1, 2, newLastCol - flatHeaders.length).clear();
     }

     // Rescaffold groupings (this applies headers Row 3 & 4)
     var colIndex = 1;
     groups.forEach(function(g) {
         var groupLen = g.cols.length;
         try {
            // Row 3 (Category)
            if (colIndex === 1 && TABS.FLIGHTS.frozenCols && TABS.FLIGHTS.frozenCols < groupLen) {
              var frozenCount = TABS.FLIGHTS.frozenCols;
              // Columns 1 to frozenCount (A3:D3): unmerged cells inside frozen pane
              shF.getRange(3, 1, 1, frozenCount).setValue('').setBackground(g.color).setBorder(true, true, true, true, false, false, "medium", null);
              // Columns frozenCount + 1 to groupLen (E3:N3): merged Flight Info header
              var unmergedCount = groupLen - frozenCount;
              shF.getRange(3, frozenCount + 1, 1, unmergedCount)
                 .merge()
                 .setValue(g.name)
                 .setBackground(g.color)
                 .setHorizontalAlignment('center')
                 .setFontWeight('bold')
                 .setBorder(true, true, true, true, false, false, "medium", null);
            } else {
              shF.getRange(3, colIndex, 1, groupLen).merge().setValue(g.name).setBackground(g.color).setHorizontalAlignment('center').setFontWeight('bold').setBorder(true, true, true, true, false, false, "medium", null);
            }
            // Row 4 (Columns)
            shF.getRange(4, colIndex, 1, groupLen).setBackground(g.color).setFontWeight('bold');
         } catch(e) {}
         colIndex += groupLen;
     });
     shF.setFrozenRows(4);
     shF.setFrozenColumns(4);
     applyFlightsValidation_(shF);
  }
  
  // 2. Equipment
  var shE = ss.getSheetByName(TABS.EQUIPMENT.name);
  if (shE) {
     shE.setTabColor(TABS.EQUIPMENT.color);
     shE.getRange('A1:M1').setBackground(TABS.EQUIPMENT.color).setFontColor('white');
     shE.getRange(2, 1, 1, TABS.EQUIPMENT.columns.length).setBackground('#E0F7FA').setFontWeight('bold');
  }
  
  // 3. Config
  var shP = ss.getSheetByName(TABS.CONFIG.name);
  if (shP) {
      shP.setTabColor(TABS.CONFIG.color);
      shP.getRange('A1:C1').setBackground(TABS.CONFIG.color);
      shP.getRange(2, 1, 1, 3).setBackground('#616161').setFontColor('white');
      // Re-run scaffold to fix row colors
      scaffoldConfig_(ss);
  }

  // 4. Pilot Profile
  scaffoldPilotProfile_(ss);

  // 5. Dashboard
  scaffoldDashboard_(ss);

  // 6. Activity Logs
  scaffoldAppLog_(ss);

  ss.toast('Formatting Re-applied: Obsolete columns eliminated, Config updated, Pilot Profile refreshed, Dashboard refreshed, Activity Logs refreshed, Flights frozen.');
}

function backupSystemSheets_() {
  var ss = SpreadsheetApp.getActive();
  var backup = function(srcName, destName) {
     var src = ss.getSheetByName(srcName);
     if (src) {
        var existing = ss.getSheetByName(destName);
        if (existing) ss.deleteSheet(existing);
        src.copyTo(ss).setName(destName);
        return true;
     }
     return false;
  };
  
  var tabsToBackup = [
    TABS.FLIGHTS.name,
    TABS.PILOT_PROFILE ? TABS.PILOT_PROFILE.name : 'Pilot_Profile',
    TABS.EQUIPMENT.name,
    TABS.CONFIG.name
  ];
  
  var backedUp = [];
  tabsToBackup.forEach(function(name) {
    if (backup(name, 'Backup ' + name)) {
      backedUp.push(name);
    }
  });
  
  ss.toast('Backup created: ' + backedUp.join(', '));
}

function deleteSystemSheets_() {
  var ui = SpreadsheetApp.getUi();
  var resp = ui.alert('DELETE SYSTEM SHEETS', 'Are you sure you want to delete all system tabs (Flights, Equipment, etc)? This is irreversible (unless backed up).', ui.ButtonSet.YES_NO);
  
  if (resp == ui.Button.YES) {
    var ss = SpreadsheetApp.getActive();
    var targets = [
      TABS.FLIGHTS.name, 
      TABS.EQUIPMENT.name, 
      TABS.CONFIG.name, 
      TABS.ACTIVITY.name, 
      'App_Log', // Legacy migration cleanup
      TABS.DASHBOARD.name,
      TABS.PILOT_PROFILE ? TABS.PILOT_PROFILE.name : 'Pilot_Profile',
      TABS.USER_GUIDE ? TABS.USER_GUIDE.name : 'User Guide',
      'Overview', 'Sites'
    ];
    
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

/* ==========================================================================================
   PILOT PROFILE TAB (RQ-SYS-009)
   ========================================================================================== */

function scaffoldPilotProfile_(ss) {
  var sh = ss.getSheetByName(TABS.PILOT_PROFILE.name);
  if (!sh) return;
  
  // Field aliases for seamless migration from older versions
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

  // Preserve existing values if user already entered data
  var existingVals = {};
  if (sh.getLastRow() >= 4) {
    try {
      var numCols = Math.min(sh.getLastColumn(), 4);
      var raw = sh.getRange(4, 1, sh.getLastRow() - 3, numCols).getValues();
      raw.forEach(function(r) {
        // If old 4-column layout: Col A was Category, Col B was Field, Col C was Value
        if (r.length >= 3 && r[1] && r[2] !== '' && !String(r[0]).startsWith('[')) {
          existingVals[String(r[1]).trim()] = r[2];
        }
        // If 3-column layout: Col A is Field (and not a section header '['), Col B is Value
        if (r[0] && !String(r[0]).startsWith('[') && r[1] !== undefined && r[1] !== '') {
          existingVals[String(r[0]).trim()] = r[1];
        }
      });
    } catch(e) { console.warn('Pilot Profile preservation error', e); }
  }

  sh.clear();
  ensureDimensions_(sh, 50, 3);

  // Header Title
  sh.getRange('A1').setValue("Pilot Profile & Credentials").setFontWeight('bold').setFontSize(16);
  sh.getRange('A1:C1').setBackground(TABS.PILOT_PROFILE.color).setFontColor('white').merge();
  sh.getRange('A1').setHorizontalAlignment('center').setVerticalAlignment('middle');
  sh.setRowHeight(1, 38);

  sh.getRange('A2').setValue("Personal credentials, licensing, emergency info, and live satellite tracking gear").setFontStyle('italic').setFontSize(10);
  sh.getRange('A2:C2').merge().setHorizontalAlignment('center');
  sh.setRowHeight(2, 22);

  // Column Headers Row 3
  sh.getRange(3, 1, 1, 3).setValues([['Field', 'Value', 'Notes / Instructions']]);
  sh.getRange(3, 1, 1, 3).setBackground('#37474F').setFontColor('white').setFontWeight('bold');
  sh.setRowHeight(3, 26);

  var sections = [
    {
      title: '[ Identity ]',
      fields: [
        { field: 'Full Name', val: '', note: 'Legal name as shown on official pilot license' },
        { field: 'Callsign / Nickname', val: '', note: 'Radio callsign or competition display name' },
        { field: 'Email', val: '', note: 'Primary contact email' },
        { field: 'Phone Number', val: '', note: 'Mobile phone with international dialing code' },
        { field: 'Home Country & Town', val: '', note: 'Home flying base location' },
        { field: 'Other Identity Info', val: '', note: 'Additional personal, passport, or identity information' }
      ]
    },
    {
      title: '[ Licensing ]',
      fields: [
        { field: 'National Association', val: '', note: 'Issuing aero club or national body (e.g. USHPA, BHPA, FFVL, DHV, HPAC)' },
        { field: 'Pilot Rating', val: '', note: 'Current pilot rating / level (e.g. P2 Novice, P3, P4 Advanced, APPI 4)' },
        { field: 'National Licence Info', val: '', note: 'National license number, ratings, expiration, and endorsements' },
        { field: 'FAI Sporting Licence Info', val: '', note: 'FAI sporting license number, validity, and issuing NAC' },
        { field: 'CIVL ID', val: '', note: 'CIVL pilot ranking ID for FAI sanctioned competitions' },
        { field: 'Other Licensing Info', val: '', note: 'Tandem, instructor ratings, additional foreign licenses, APPI ratings' }
      ]
    },
    {
      title: '[ Affiliations ]',
      fields: [
        { field: 'Primary Flying Club', val: '', note: 'Home club name and flying site' },
        { field: 'Secondary Clubs', val: '', note: 'Regional or visiting club memberships' },
        { field: 'National Federation Member #', val: '', note: 'Aero club or national federation identifier' },
        { field: 'Other Affiliations Info', val: '', note: 'Other club memberships, team affiliations, community groups' }
      ]
    },
    {
      title: '[ Emergency / SAR ]',
      fields: [
        { field: 'Primary Emergency Contact Info', val: '', note: 'Primary contact name, relationship, phone, and email' },
        { field: '2nd Emergency Contact Info', val: '', note: 'Secondary contact name, relationship, phone, and email' },
        { field: '3rd Emergency Contact Info', val: '', note: 'Tertiary contact name, relationship, phone, and email' },
        { field: 'SAR / Evac Provider Info', val: '', note: 'Evacuation provider, policy / member #, and emergency hotline (e.g. Garmin SAR, GEOS, Global Rescue)' },
        { field: 'Medical Insurance Info', val: '', note: 'Medical insurer, policy #, group #, and emergency assistance phone' },
        { field: 'Blood Type', val: '', note: 'Blood group and Rh factor (e.g. O+, A+, B+, AB-)' },
        { field: 'Medical Conditions / Allergies', val: '', note: 'Critical medical conditions, allergies, or medications for first responders' },
        { field: 'Other Emergency Info', val: '', note: 'Hospital preferences, organ donor status, additional medical notes' }
      ]
    },
    {
      title: '[ Tracking / Gear ]',
      fields: [
        { field: 'Garmin inReach IMEI', val: '', note: 'Satellite messenger IMEI number' },
        { field: 'Garmin MapShare URL', val: '', note: 'https://share.garmin.com/username' },
        { field: 'Flymaster Live URL', val: '', note: 'Flymaster / Livetrack24 public tracking link' },
        { field: 'XContest Live URL', val: '', note: 'XContest live tracking pilot link' },
        { field: 'Emergency Beacon Hex ID', val: '', note: '406 MHz PLB / ELT 15-character hex ID' },
        { field: 'Other Tracking / Gear Info', val: '', note: 'Spot messenger, OGN / FANET ID, radio frequencies, gear notes' }
      ]
    },
    {
      title: '[ Progression ]',
      fields: [
        { field: 'Current Season XC Goals', val: '', note: 'Targets for season (distance, triangles, hours)' },
        { field: 'SIV / Maneuver Notes', val: '', note: 'Stalls, spins, collapses, acro progression log' },
        { field: 'General Flying Notes', val: '', note: 'Free-form reflections, wing trim checks, line check dates' },
        { field: 'Other Progression Info', val: '', note: 'Coaching clinics, thermal camps, mentor notes, future aspirations' }
      ]
    }
  ];

  var rows = [];
  sections.forEach(function(sec) {
    rows.push([sec.title, '', '']);
    sec.fields.forEach(function(f) {
      var val = (existingVals[f.field] !== undefined && existingVals[f.field] !== '') ? existingVals[f.field] : '';
      if (!val) {
        Object.keys(fieldAliases).forEach(function(oldKey) {
          if (fieldAliases[oldKey] === f.field && existingVals[oldKey]) {
            val = existingVals[oldKey];
          }
        });
      }
      if (!val) val = f.val;
      rows.push([f.field, val, f.note]);
    });
  });

  sh.getRange(4, 1, rows.length, 3).setValues(rows);

  // Formatting rows
  for (var r = 0; r < rows.length; r++) {
    var rowIdx = r + 4;
    var rowKey = rows[r][0];
    if (rowKey.indexOf('[') === 0) {
      // Section header row: merged A:C with subtle background
      sh.getRange(rowIdx, 1, 1, 3).merge().setBackground('#CFD8DC').setFontWeight('bold').setFontColor('#37474F');
      sh.setRowHeight(rowIdx, 26);
    } else {
      // Field label
      sh.getRange(rowIdx, 1).setFontWeight('bold').setFontColor('#212121');
      // Editable value column
      sh.getRange(rowIdx, 2).setBackground('#FFFDE7').setBorder(true, true, true, true, true, true, '#BDBDBD', SpreadsheetApp.BorderStyle.SOLID);
      // Notes column
      sh.getRange(rowIdx, 3).setFontSize(9).setFontColor('#616161');
      sh.setRowHeight(rowIdx, 22);
    }
  }

  sh.setColumnWidth(1, 250);
  sh.setColumnWidth(2, 320);
  sh.setColumnWidth(3, 450);

  // Clean excess columns if present
  if (sh.getMaxColumns() > 3) {
    try { sh.deleteColumns(4, sh.getMaxColumns() - 3); } catch (e) {}
  }
}

/* ==========================================================================================
   IN-APP USER GUIDE & METRIC DICTIONARY (RQ-SYS-006)
   ========================================================================================== */

function scaffoldUserGuide_(ss) {
  var sh = ss.getSheetByName(TABS.USER_GUIDE.name);
  if (!sh) {
    sh = ss.insertSheet(TABS.USER_GUIDE.name);
    sh.setTabColor(TABS.USER_GUIDE.color);
  }
  sh.clear();
  ensureDimensions_(sh, 160, 4);

  // Title
  sh.getRange('A1').setValue("Paragliding Flight Log - In-App User Guide & Metric Dictionary").setFontWeight('bold').setFontSize(16);
  sh.getRange('A1:D1').setBackground(TABS.USER_GUIDE.color).setFontColor('white').merge();
  sh.getRange('A1').setHorizontalAlignment('center').setVerticalAlignment('middle');
  sh.setRowHeight(1, 38);

  sh.getRange('A2').setValue("Interactive guide for setup, daily flight imports, system maintenance, and calculated flight metrics").setFontStyle('italic').setFontSize(10);
  sh.getRange('A2:D2').merge().setHorizontalAlignment('center');
  sh.setRowHeight(2, 22);

  var rIdx = 4;

  var addSection = function(title, color) {
    sh.getRange(rIdx, 1, 1, 4).merge().setValue(title).setBackground(color || '#607D8B').setFontColor('white').setFontWeight('bold').setFontSize(12);
    sh.setRowHeight(rIdx, 28);
    rIdx++;
  };

  var addRow = function(col1, col2, col3, col4, isHeader) {
    var rng = sh.getRange(rIdx, 1, 1, 4);
    rng.setValues([[col1, col2, col3, col4]]);
    if (isHeader) {
      rng.setBackground('#37474F').setFontColor('white').setFontWeight('bold');
    } else {
      sh.getRange(rIdx, 1).setFontWeight('bold');
      sh.getRange(rIdx, 1, 1, 4).setWrap(true);
    }
    rIdx++;
  };

  // Section 1: Overview
  addSection('1. System Overview & Architecture', '#37474F');
  addRow('Component', 'Function', 'Details', 'Pilot Benefit', true);
  addRow('Google Sheets View', 'Primary User Interface', 'Organized logbook tabs: Dashboard, Flights, Pilot Profile, Equipment, User Guide, Config, Activity Logs.', 'Familiar, accessible on desktop & mobile.');
  addRow('Google Apps Script', 'Automated Processing Engine', 'Orchestrates file parsing, physics & thermal analysis, XC scoring, geo-enrichment, and weather queries.', 'Zero server hosting costs, runs completely inside Google Cloud.');
  addRow('Master Flight Log', 'Permanent Cloud Archive', 'Automatically mirrors processed IGCs into MASTER_LOG_FOLDER_ID with standardized names and public links.', 'Direct 1-click downloads and 3D SeeYou Cloud visualization.');
  addRow('Watcher Triggers', 'Background Automation', 'Runs automated scans of designated Google Drive folders every 5 to 15 minutes to ingest new flights automatically.', 'Drop files into Drive and your logbook updates hands-free.');

  rIdx++;

  // Section 2: Setup & Folders
  addSection('2. Initial Configuration & Folder Setup', '#2E7D32');
  addRow('Setting / Folder', 'Key Parameter', 'Configuration Instructions', 'Default / Recommendation', true);
  addRow('Watch Folder', 'WATCH_FOLDER_ID', 'Google Drive folder where flight instruments or XC apps drop .igc / .zip files. Multiple folders supported via comma-separation.', 'Use Admin > Set Watch Folder(s)... to select via in-app picker.');
  addRow('Master Log Folder', 'MASTER_LOG_FOLDER_ID', 'Google Drive folder holding permanent, clean flight log copies for public sharing and 3D viewer links.', 'Set via Admin > Set Master Log Folder... Share folder as Anyone with link.');
  addRow('Upload / Error Folders', 'UPLOAD_FOLDER_ID / ERROR_FOLDER_ID', 'Temporary staging folder for browser uploads, and quarantine folder strictly for corrupt / unparseable files requiring investigation.', 'Set via Admin > Set Upload Folder... / Set Error Folder...');
  addRow('Trash / Discard Folder', 'TRASH_FOLDER_ID', 'Dedicated Drive folder for discarded, duplicate, and purged flight logs. Safe to empty anytime without data loss risk.', 'Set via Admin > Set Trash / Discard Folder...');
  addRow('Weather Providers', 'WEATHER_PROVIDERS', 'Comma-separated order of weather services: "open_meteo, visual_crossing". Open-Meteo runs with zero API keys required.', 'open_meteo, visual_crossing');
  addRow('Visual Crossing Key', 'VISUAL_CROSSING_API_KEY', 'Optional API key for Visual Crossing backup (1,000 free calls/day). Sign up at visualcrossing.com.', 'Leave blank to use free Open-Meteo exclusively.');
  addRow('Contact Email', 'CONTACT_EMAIL', 'Your email address used in User-Agent headers for open Nominatim / Open-Meteo / Overpass API requests.', 'Required to prevent HTTP 403 API blocking.');
  addRow('XContest Username', 'XCONTEST_USERNAME', 'Your public XContest pilot username (e.g. "rohitash"). Required for automated XContest flight verification, permanent ID linking, and claim window alerts.', 'Set your username in Config');

  rIdx++;

  // Section 3: Daily Logging Workflows
  addSection('3. Day-to-Day Flight Logging Workflows', '#1565C0');
  addRow('Workflow Method', 'Menu / Action', 'Step-by-Step Instructions', 'Best For', true);
  addRow('Automated Watcher', 'Flight Log > Add Flight > Scan Watch Folder Now', 'Drop files into your Drive folder. Trigger will process automatically every 5 mins, or click Scan Now for immediate import.', 'Day-to-day automated syncing from Syride, Oudie, Flymaster, or Google Drive mobile.');
  addRow('Drive / URL Import', 'Flight Log > Add Flight > Add files from URL...', 'Option A: Paste any Google Drive folder/file URL or public IGC link. Option B: Browse Drive folders directly with optional source deletion.', 'Bulk importing historical logs or shared club folders.');
  addRow('Browser Upload', 'Flight Log > Add Flight > Add flight from Upload...', 'Drag and drop single or multiple .igc, .zip, or .gz files directly from your computer into the modal window.', 'Quick manual imports from desktop downloads.');
  addRow('Manual Blank Row', 'Flight Log > Add Flight > Add manual flight', 'Inserts a clean, pre-formatted flight row with sticky equipment defaults for flights without GPS track logs.', 'Tandem flights, dune soaring, or flights where instrument was off.');
  addRow('Duplicate & Overlap Triage', 'Automated on Ingestion', 'Detects duplicate flights (+/- 15m, <= 1000m). Scores candidate quality (XCTrack=40, Vario=30, Baro sensor integrity=30, 1Hz resolution=15, duration, metadata) and tags Dup-Primary (gold) and Dup-Others (orange) with pairing [DupRef: ...] notes.', 'Preserves all logs while highlighting the superior track log.');
  addRow('Flight Inspector', 'Flight Log > Flight Inspector', 'Highlight any flight row and open the sidebar to review detailed thermal analysis, mode breakdowns, and edit notes.', 'In-depth post-flight analysis.');

  rIdx++;

  // Section 4: Flight Maintenance
  addSection('4. Flight Maintenance & Admin Operations', '#D84315');
  addRow('Operation', 'Tool / Menu', 'Behavior & Execution Details', 'When to Use', true);
  addRow('Flight Updates', 'Flight Log > Flight maintenance > Flight Updates...', 'Configurable modal dialog: choose between Selected Rows vs All Flights, and check operations to batch process.', 'Periodic log maintenance, bulk backfilling, or score recalculation.');
  addRow('Change Flight Status in Bulk', 'Flight Log > Flight maintenance > Change Flight Status in Bulk...', 'Multi-scoped status conversion utility with multi-select status filtering (default all unselected matching 0 flights for safety) and Tri-Mode execution (Modal, Sidebar, Background).', 'Bulk-promoting Review? flights to Valid, tagging batches as Remove, or triage state adjustments.');
  addRow('Scan & Flag Duplicates in Logbook', 'Flight Log > Flight maintenance > Scan & Flag Duplicates in Logbook...', 'Heuristic audit scanning existing logbook flights (+/- 20m, <= 1000m), scoring track quality, and tagging Dup-Primary and Dup-Others with reciprocal notes without demoting Valid flights.', 'Auditing previously ingested flights for duplicate tracks.');
  addRow('Mark Duplicates for Removal', 'Flight Log > Flight maintenance > Mark Duplicates for Removal...', 'Interactive dialog with Dup-Primary and Dup-Others checkboxes to bulk-tag duplicate flights as Remove for pre-purge review.', 'Safely preparing detected duplicate flights for culling.');
  addRow('Purge Flights Marked \'Remove\'', 'Flight Log > Flight maintenance > Purge Flights Marked \'Remove\'', 'Interactive progress dialog with live stepping, moves Master IGC files to TRASH_FOLDER_ID, deletes sheet rows bottom-up, refreshes deduplication hashes, and re-sorts flights.', 'Permanently discarding unwanted duplicates or test entries.');
  addRow('Re-sync Missing Flights', 'Flight Log > Flight maintenance > Re-sync Missing Flights from Master Folder', 'Interactive dialog with live progress bar and activity log that scans MASTER_LOG_FOLDER_ID for any orphaned files and restores their flight rows as \'Review?\'.', 'Restoring accidentally deleted flight rows without duplicate files.');
  addRow('Weather Backfill', 'Flight Updates Dialog Checkbox', 'Fetches historical launch/landing wind, cloudbase, cloud %, temperature, and conditions via Open-Meteo & Visual Crossing.', 'Enriching older flights or flights imported while offline.');
  addRow('Geo & Site Backfill', 'Flight Updates Dialog Checkbox', 'Reverse geocodes Lat/Lon coordinates into Town, Region, Country and matches nearest takeoff/landing site names.', 'Populating missing location names.');
  addRow('XContest Verification', 'Flight Updates Dialog Checkbox', 'Directly probes XContest.org via UTC date/time (+/- 2 min) to verify if flight is published, links flight with permanent ID (e.g. XC#6952654), or flags claim deadline (Claim soon! if <= 14 days, Expired if > 14 days).', 'Updating XContest league claim status.');
  addRow('Physics & XC Recompute', 'Flight Updates Dialog Checkbox', 'Reads master IGC from Drive; re-runs thermal circling, soaring efficiency, glide L/D, and optimal FAI triangle scoring.', 'When scoring rules or thermal detection thresholds are updated.');
  addRow('Date Sorting', 'Flight Log > Flight maintenance > Sort All Flights by Date', 'Chronologically sorts logbook descending (newest on top) and re-indexes sequential Flight Numbers.', 'After importing out-of-order historical flights.');

  rIdx++;

  // Section 5: Metric Dictionary
  addSection('5. Comprehensive Metric Dictionary', '#455A64');
  addRow('Category', 'Metric / Column', 'Calculation / Formula', 'Description & Interpretation', true);
  
  // Flight Info
  var fNoCol = getColLetter_(null, 'Flight No', 'C');
  addRow('Flight Info', 'Status', 'Valid, Review?, Dup-Primary, Dup-Others, Invalid?, Remove', 'Flight validation state. Dashboard KPIs strictly count "Valid" flights. New files default to "Review?". Overlap winners are "Dup-Primary" (gold) and backups "Dup-Others" (orange). Mark unwanted flights as "Remove" to purge.');
  addRow('Flight Info', 'FlightID', 'F{YYYYMMDD}_{DailySeq}', 'Unique flight identifier linking directly to 3D SeeYou Cloud track visualization.');
  addRow('Flight Info', 'Flight No', '=IFERROR(MAX(INDIRECT("' + fNoCol + '" & (ROW()+1) & ":' + fNoCol + '")), 0) + 1', 'Sequential flight counter from first flight to present. Automatically adjusts on sort.');
  addRow('Flight Info', 'Auto Summary', 'Duration + Track Dist + Max Alt + Site', 'Concise human-readable flight summary (e.g. "1:30 hrs, 24.5 km, 3100 m, Bir Billing").');
  addRow('Flight Info', 'Duration', 'Landing Time - Launch Time', 'Total flight duration in h:mm format.');
  addRow('Flight Info', 'Track Length (km)', 'Sum of Haversine fix intervals', 'Cumulative distance flown through the air along the GPS track.');
  addRow('Flight Info', 'Straight Dist (km)', 'Haversine(Launch, Landing)', 'Direct straight-line distance from launch to landing.');

  // Gear
  addRow('Gear Tracking', 'Wing / Harness / Reserves', 'Inherited from previous flight or Equipment defaults', 'Equipment logged for flight. Equipment tab manages fleet hours and specs.');

  // XC Scoring
  addRow('XC Scoring', 'XC Distance (km)', 'Optimal 3 Turnpoints via Ramer-Douglas-Peucker', 'Optimized cross-country distance under league scoring rules.');
  addRow('XC Scoring', 'XC Score', 'Distance * Multiplier (1.0x Free, 1.2x Out-and-Return / Flat, 1.4x FAI)', 'Official cross-country competition score points.');
  addRow('XC Scoring', 'XC Flight Class', 'Free Flight, Flat Triangle, FAI Triangle, or Out-and-Return', 'Geometric classification of the track.');
  addRow('XC Scoring', 'FAI Triangle (km)', 'Shortest leg >= 28% of total perimeter', 'Strict FAI triangle distance. Highest multiplier (1.4x) in XC leagues.');
  addRow('XC Scoring', 'Closed?', 'Launch-Landing gap <= 20% (or national bonus)', 'Indicates whether triangle circuit was closed back to launch (Yes / No).');
  addRow('XC Scoring', 'XContest', 'Direct Flight Probing / Rule 3.1 14-day claim window', 'Hyperlink to public XContest flight (e.g. XC#6952654) if verified. Displays "Claim soon!" if within 14-day competition deadline, or "Expired" if older than 14 days.');

  // Physics & Analytics
  addRow('Analytics', 'Thermal %', 'Circling time / Total flight time', 'Percentage of flight spent thermalling (turn rate > 8 deg/s and climb > 0.3 m/s).');
  addRow('Analytics', 'Thermals Count', 'Count of distinct thermal cores entered', 'Total individual thermal climbs utilized during the flight.');
  addRow('Analytics', 'Thermal Avg / Best (m/s)', 'Mean and maximum integrated climb rates', 'Vario climbing performance inside thermal cores.');
  addRow('Analytics', 'Soar %', 'Ridge soaring time / Total flight time', 'Percentage of flight spent ridge soaring in figure-8 S-turns with climb.');
  addRow('Analytics', 'Efficiency', 'Height gain (m) per km of soaring track', 'Energy efficiency metric for ridge soaring.');
  addRow('Analytics', 'Glide % & Glide L/D', 'Transition time & in-flight lift/drag ratio', 'Percentage of flight spent gliding between lift sources and realized L/D.');
  addRow('Analytics', 'Sink % & Sink Time', 'Time spent in heavy sink (< -2.5 m/s)', 'Safety metric monitoring encounter with sink zones or rotor.');

  // Launch & Landing
  addRow('Launch / Landing', 'Launch / Land Alt (m)', 'GNSS or barometric altitude at first/last fix', 'Elevation of takeoff and touchdown above mean sea level.');
  addRow('Launch / Landing', 'Launch / Land Site', 'Paragliding Earth / OpenStreetMap match', 'Recognized paragliding takeoff or landing site within configured search radius.');
  addRow('Launch / Landing', 'Town / Region / Country', 'Reverse geocode via BigDataCloud / Nominatim', 'Administrative geographic location of launch and landing.');

  // Weather
  addRow('Weather', 'Wind@Launch', 'Surface/10m wind speed + cardinal direction + gusts', 'Launch wind conditions (e.g. "12 km/h WNW (gust 18)").');
  addRow('Weather', 'Wind@Landing', 'Landing 10m wind speed + cardinal direction + gusts', 'Touchdown wind conditions at landing coordinates and time.');
  addRow('Weather', 'Cloud %', 'Total cloud cover fraction (0-100%)', 'Sky cloud cover percentage at flight time.');
  addRow('Weather', 'Cloudbase', 'MSL & AGL: LaunchAlt + (Temp - DewPoint) * 125m', 'Convective condensation level (cloudbase) estimated via Lawrence spread formula.');
  addRow('Weather', 'Temp (C)', 'Ambient 2m air temperature in Celsius', 'Surface temperature at takeoff.');
  addRow('Weather', 'Observations', 'WMO weather code condition text', 'General atmospheric condition (e.g. "Partly cloudy", "Clear sky").');

  // Validation & Audit
  addRow('Validation', 'Validation Status', 'Valid, Needs Review, or Invalid', 'Automated heuristics check (e.g. driving, kiting, short flights).');
  addRow('Validation', 'Val: Reason', 'Specific heuristic rule violation message', 'Details for flights flagged for review.');
  addRow('Audit / Meta', 'IGC Hash', 'MD5 content digest', 'Row-based file hash in Column 70. Deleting a flight row automatically removes its hash, allowing clean re-import without blanket cache purges.');
  addRow('Audit / Meta', 'Import ID / File', 'Drive file ID & Source Name', 'Provenance tracking linking the row back to the source file and Drive upload record.');
  addRow('Audit / Meta', 'Notes', 'Pilot & system notes', 'Pilot notes, paired duplicate cross-references [DupRef: ...], and system audit messages.');

  sh.autoResizeColumns(1, 4);
  sh.setColumnWidth(1, 160);
  sh.setColumnWidth(2, 220);
  sh.setColumnWidth(3, 300);
  sh.setColumnWidth(4, 420);
}

function uiRefreshUserGuide_() {
  var ss = SpreadsheetApp.getActive();
  scaffoldUserGuide_(ss);
  ss.toast('User Guide tab refreshed successfully.', 'Flight Log');
}

function uiRefreshDashboard_() {
  var ss = SpreadsheetApp.getActive();
  scaffoldDashboard_(ss);
  ss.toast('Dashboard refreshed successfully.', 'Flight Log');
}

/* ==========================================================================================
   RESILIENCY & NATIVE GOOGLE SHEETS HELPERS (CR-SYS-009 / AUD-RES-003)
   ========================================================================================== */

/**
 * Registers or updates a Google Sheets Named Range.
 * Removes any pre-existing Named Range with the same name before binding.
 */
function registerNamedRange_(ss, name, range) {
  if (!ss || !range) return;
  try {
    var namedRanges = ss.getNamedRanges();
    for (var i = 0; i < namedRanges.length; i++) {
      if (namedRanges[i].getName() === name) {
        namedRanges[i].remove();
        break;
      }
    }
    ss.setNamedRange(name, range);
  } catch (e) {
    console.warn('Error setting named range ' + name + ':', e.message);
  }
}

/**
 * Applies a native Google Sheets soft warning protection to a range.
 * setWarningOnly(true) provides visual safety against accidental keystrokes
 * or clipboard paste-overs without locking users out or causing auth errors.
 */
function applySoftGuardrail_(sh, range, description) {
  if (!sh || !range) return;
  try {
    var protections = sh.getProtections(SpreadsheetApp.ProtectionType.RANGE);
    for (var i = 0; i < protections.length; i++) {
      if (protections[i].getDescription() === description) {
        protections[i].remove();
      }
    }
    var p = range.protect().setDescription(description);
    p.setWarningOnly(true);
  } catch (e) {
    console.warn('Soft guardrail warning on ' + description + ':', e.message);
  }
}

/**
 * Removes a native Google Sheets range protection matching a specific description.
 */
function removeSoftGuardrail_(sh, description) {
  if (!sh) return;
  try {
    var protections = sh.getProtections(SpreadsheetApp.ProtectionType.RANGE);
    for (var i = 0; i < protections.length; i++) {
      if (protections[i].getDescription() === description) {
        protections[i].remove();
      }
    }
  } catch (e) {
    console.warn('Error removing soft guardrail ' + description + ':', e.message);
  }
}

/**
 * Applies native soft guardrails across Flights tab formula sequence cells,
 * while cleanly removing header row protections so that column grouping outline
 * toggles (+/- buttons) can expand and collapse freely with zero warnings (Bug-UI-010).
 */
function applyFlightsGuardrails_(sh) {
  if (!sh) return;
  // Cleanly remove any existing header row protections to allow uninhibited column grouping
  removeSoftGuardrail_(sh, 'Guardrail: Flights Headers (Rows 1-4)');

  var map = getColumnMap_(sh);
  var flightNoCol = map['Flight No'] || 3;
  var maxRows = sh.getMaxRows();
  if (maxRows >= 5) {
    applySoftGuardrail_(sh, sh.getRange(5, flightNoCol, maxRows - 4, 1), 'Guardrail: Flights Auto-Numbering Formulas');
  }

  // Ensure IGC Hash column is hidden and protected from accidental manual tampering
  var hashCol = map['IGC Hash'];
  if (hashCol) {
    try { sh.hideColumns(hashCol); } catch (eH) {}
    applySoftGuardrail_(sh, sh.getRange(1, hashCol, maxRows, 1), 'Guardrail: IGC Hash Deduplication Key');
  }
}

/**
 * Anchors a native Google Sheets filter on Row 4 of the Flights sheet.
 */
function applyFlightsFilter_(sh) {
  if (!sh) return;
  try {
    var maxRows = Math.max(sh.getMaxRows(), 100);
    var lastCol = sh.getLastColumn();
    if (lastCol < 1) return;

    var existingFilter = sh.getFilter();
    if (existingFilter) {
      var filterRange = existingFilter.getRange();
      if (filterRange.getRow() === 4) return;
      existingFilter.remove();
    }
    sh.getRange(4, 1, maxRows - 3, lastCol).createFilter();
  } catch (e) {
    console.warn('applyFlightsFilter_:', e.message);
  }
}

/**
 * Public helper to remove header row protections on the active Flights sheet.
 */
function removeFlightsHeaderProtections() {
  try {
    var ss = SpreadsheetApp.getActive();
    var sh = ss.getSheetByName(TABS.FLIGHTS.name);
    if (sh) {
      removeSoftGuardrail_(sh, 'Guardrail: Flights Headers (Rows 1-4)');
    }
  } catch (e) {
    console.warn('removeFlightsHeaderProtections:', e.message);
  }
}

/* ==========================================================================================
   THREE-TIER SYSTEM MAINTENANCE ENGINE (DSGN-MNT-001 Rev 2.0 / CR-SYS-006)
   ========================================================================================== */

/**
 * TIER 1: ATOMIC ELEMENT UPDATERS
 */
var AtomicUpdaters = {
  updateDimensions: function(sh, rows, cols, frozenRows, frozenCols, tabColor) {
    if (!sh) return;
    if (rows && cols) ensureDimensions_(sh, rows, cols);
    if (frozenRows !== undefined) sh.setFrozenRows(frozenRows);
    if (frozenCols !== undefined) sh.setFrozenColumns(frozenCols);
    if (tabColor) sh.setTabColor(tabColor);
  },

  updateFlightsHeadersAndNotes: function(sh) {
    if (!sh) return;
    sh.setTabColor(TABS.FLIGHTS.color);
    sh.getRange('A1:Z1').setBackground(TABS.FLIGHTS.color).setFontColor('white').setFontWeight('bold');

    // Remove deprecated columns safely (right-to-left)
    var colsToDelete = ['GlideRatio_LD (snap)', 'Trim_kmh (snap)', 'FullBar_kmh (snap)', 'Launch-Landing Dist (km)'];
    var lastCol = sh.getLastColumn();
    if (lastCol > 0) {
      var currentHeaders = sh.getRange(4, 1, 1, lastCol).getValues()[0];
      var toDelete = [];
      for (var c = 0; c < currentHeaders.length; c++) {
        if (colsToDelete.indexOf(currentHeaders[c]) !== -1) toDelete.push(c + 1);
      }
      toDelete.sort(function(a, b) { return b - a; });
      toDelete.forEach(function(colIdx) { sh.deleteColumn(colIdx); });
    }

    // Unmerge Row 3 before applying new category merges
    sh.getRange(3, 1, 1, sh.getMaxColumns()).breakApart();

    // Flatten and rewrite Headers (Row 4)
    var groups = TABS.FLIGHTS.groups;
    var flatHeaders = [];
    groups.forEach(function(g) { flatHeaders = flatHeaders.concat(g.cols); });
    ensureDimensions_(sh, 2000, flatHeaders.length);
    sh.getRange(4, 1, 1, flatHeaders.length).setValues([flatHeaders]);
    sh.getRange(4, 1, 1, flatHeaders.length).setFontWeight('bold').setBorder(true, true, true, true, true, true).setWrapStrategy(SpreadsheetApp.WrapStrategy.WRAP).setVerticalAlignment('top');

    // Apply Column Notes / Tooltips (Row 4)
    var colNotes = TABS.FLIGHTS.colNotes || {};
    for (var c = 0; c < flatHeaders.length; c++) {
      var colName = flatHeaders[c];
      var cell = sh.getRange(4, c + 1);
      if (colNotes[colName]) {
        cell.setNote(colNotes[colName]);
      } else {
        cell.clearNote();
      }
    }

    // Clear leftover header cells beyond flatHeaders
    var newLastCol = sh.getLastColumn();
    if (newLastCol > flatHeaders.length) {
      sh.getRange(3, flatHeaders.length + 1, 2, newLastCol - flatHeaders.length).clear();
    }

    // Rescaffold groupings (Row 3 & 4)
    var colIndex = 1;
    groups.forEach(function(g) {
      var groupLen = g.cols.length;
      try {
        if (colIndex === 1 && TABS.FLIGHTS.frozenCols && TABS.FLIGHTS.frozenCols < groupLen) {
          var frozenCount = TABS.FLIGHTS.frozenCols;
          sh.getRange(3, 1, 1, frozenCount).setValue('').setBackground(g.color).setBorder(true, true, true, true, false, false, 'medium', null);
          var unmergedCount = groupLen - frozenCount;
          sh.getRange(3, frozenCount + 1, 1, unmergedCount).merge().setValue(g.name).setBackground(g.color).setHorizontalAlignment('center').setFontWeight('bold').setBorder(true, true, true, true, false, false, 'medium', null);
        } else {
          sh.getRange(3, colIndex, 1, groupLen).merge().setValue(g.name).setBackground(g.color).setHorizontalAlignment('center').setFontWeight('bold').setBorder(true, true, true, true, false, false, 'medium', null);
        }
        sh.getRange(4, colIndex, 1, groupLen).setBackground(g.color).setFontWeight('bold');
      } catch (e) {}
      colIndex += groupLen;
    });
    sh.setFrozenRows(4);
    sh.setFrozenColumns(4);
  },

  updateFlightsFormulas: function(sh) {
    if (!sh) return;
    var map = getColumnMap_(sh);
    var flightNoCol = map['Flight No'] || 3;
    var fNoColLetter = columnToLetter_(flightNoCol);
    var lastRow = Math.max(sh.getLastRow(), 5);
    var numRows = lastRow - 4;
    if (numRows > 0) {
      var formulas = [];
      for (var r = 0; r < numRows; r++) {
        formulas.push(['=IFERROR(MAX(INDIRECT("' + fNoColLetter + '" & (ROW()+1) & ":' + fNoColLetter + '")), 0) + 1']);
      }
      sh.getRange(5, flightNoCol, numRows, 1).setFormulas(formulas);
    }
  },

  updateConfigLookupsAndNamedRanges: function(ss, sh) {
    if (!sh) return;
    var lookupCols = [
      'Equipment Categories',
      'Flight Status',
      'Flight Type',
      'XC Classes',
      'Date Formats',
      'Time Formats',
      'Active Wings',
      'Active Harnesses',
      'Active Reserves',
      'Active Other'
    ];
    sh.getRange(2, 5, 1, lookupCols.length).setValues([lookupCols]);
    sh.getRange(2, 5, 1, lookupCols.length).setFontWeight('bold').setBackground('#5D4037').setFontColor('white');

    // Static controlled vocabularies
    sh.getRange('E3:E7').setValues([['Wing'], ['Harness'], ['Reserve'], ['Instrument'], ['Other']]);
    sh.getRange('F3:F8').setValues([['Valid'], ['Review?'], ['Dup-Primary'], ['Dup-Others'], ['Invalid?'], ['Remove']]);

    // Canonical Flight Types (Col G) - Guarantees 'Free Fly' is always first and preserved
    var canonicalTypes = ['Free Fly', 'XC', 'Thermal XC', 'Ridge Soaring', 'Hike & Fly', 'Tandem', 'SIV / Maneuvers', 'Comp', 'Training', 'Other'];
    var existingTypes = [];
    if (sh.getLastRow() >= 3) {
      var rawG = sh.getRange('G3:G25').getValues();
      for (var gi = 0; gi < rawG.length; gi++) {
        var gVal = String(rawG[gi][0] || '').trim();
        if (gVal && existingTypes.indexOf(gVal) === -1) {
          existingTypes.push(gVal);
        }
      }
    }
    // Merge: ensure all canonical types are present, preserving any custom user types
    var mergedTypes = canonicalTypes.slice();
    for (var ei = 0; ei < existingTypes.length; ei++) {
      if (mergedTypes.indexOf(existingTypes[ei]) === -1) {
        mergedTypes.push(existingTypes[ei]);
      }
    }
    sh.getRange('G3:G30').clearContent();
    sh.getRange(3, 7, mergedTypes.length, 1).setValues(mergedTypes.map(function(t) { return [t]; }));

    // XC Classes (Col H) - Correct geometric track taxonomy (NOT wing certification classes!)
    var canonicalXcClasses = ['Free Flight', 'Flat Triangle', 'FAI Triangle', 'Out-and-Return'];
    sh.getRange('H3:H20').clearContent();
    sh.getRange(3, 8, canonicalXcClasses.length, 1).setValues(canonicalXcClasses.map(function(c) { return [c]; }));

    sh.getRange('I3:I7').setValues([['yyyy-MM-dd'], ['dd/MM/yyyy'], ['MM/dd/yyyy'], ['yyyy.MM.dd'], ['d MMM yyyy']]);
    sh.getRange('J3:J4').setValues([['h:mm a'], ['HH:mm']]);

    // Native Equipment Auto-Lookups (=SORT(FILTER(...)))
    var eqName = TABS.EQUIPMENT ? TABS.EQUIPMENT.name : 'Equipment';
    var eqCols = (TABS.EQUIPMENT && TABS.EQUIPMENT.columns) ? TABS.EQUIPMENT.columns : [];
    var colCatIdx = eqCols.indexOf('Category') + 1;
    var colIdIdx = eqCols.indexOf('EquipmentID') + 1;
    var colRetIdx = eqCols.indexOf('Retired?') + 1;
    var cCat = columnToLetter_(colCatIdx > 0 ? colCatIdx : 1);
    var cId = columnToLetter_(colIdIdx > 0 ? colIdIdx : 2);
    var cRet = columnToLetter_(colRetIdx > 0 ? colRetIdx : 8);

    var rngId = eqName + '!$' + cId + '$3:$' + cId;
    var rngCat = eqName + '!$' + cCat + '$3:$' + cCat;
    var rngRet = eqName + '!$' + cRet + '$3:$' + cRet;

    sh.getRange('K3').setFormula('=IFERROR(SORT(FILTER(' + rngId + ', ' + rngCat + '="Wing", (' + rngRet + '<>"Y"))), "")');
    sh.getRange('L3').setFormula('=IFERROR(SORT(FILTER(' + rngId + ', ' + rngCat + '="Harness", (' + rngRet + '<>"Y"))), "")');
    sh.getRange('M3').setFormula('=IFERROR(SORT(FILTER(' + rngId + ', ' + rngCat + '="Reserve", (' + rngRet + '<>"Y"))), "")');
    sh.getRange('N3').setFormula('=IFERROR(SORT(FILTER(' + rngId + ', ' + rngCat + '="Other", (' + rngRet + '<>"Y"))), "")');

    // Register Native Google Sheets Named Ranges
    registerNamedRange_(ss, 'LOOKUP_EQUIPMENT_CATS', sh.getRange('E3:E'));
    registerNamedRange_(ss, 'LOOKUP_FLIGHT_STATUSES', sh.getRange('F3:F'));
    registerNamedRange_(ss, 'LOOKUP_FLIGHT_TYPES', sh.getRange('G3:G'));
    registerNamedRange_(ss, 'LOOKUP_XC_CLASSES', sh.getRange('H3:H'));
    registerNamedRange_(ss, 'LOOKUP_ACTIVE_WINGS', sh.getRange('K3:K'));
    registerNamedRange_(ss, 'LOOKUP_ACTIVE_HARNESSES', sh.getRange('L3:L'));
    registerNamedRange_(ss, 'LOOKUP_ACTIVE_RESERVES', sh.getRange('M3:M'));
    registerNamedRange_(ss, 'LOOKUP_ACTIVE_OTHER', sh.getRange('N3:N'));
    registerSheetId_(ss, 'CONFIG', sh);
  }
};

/**
 * TIER 2: SHEET SPECIALISTS (Zero-Loss Contract Enforced)
 */
var SheetSpecialists = {
  updateFlights: function(elements, ss, logs) {
    var sh = ss.getSheetByName(TABS.FLIGHTS.name);
    if (!sh) {
      sh = ensureSheet_(ss, TABS.FLIGHTS.name);
      logs.push('[Flights] Created missing Flights tab.');
    }
    registerSheetId_(ss, 'FLIGHTS', sh);

    if (elements['Flights.grid']) {
      AtomicUpdaters.updateDimensions(sh, 2000, 70, 4, 4, TABS.FLIGHTS.color);
      logs.push('[Flights] Grid dimensions (2000x70) & frozen panes (4x4) verified.');
    }
    if (elements['Flights.headers'] || elements['Flights.notes']) {
      AtomicUpdaters.updateFlightsHeadersAndNotes(sh);
      logs.push('[Flights] Row 3 groupings, Row 4 column headers & tooltips updated.');
    }
    if (elements['Flights.validations']) {
      applyFlightsValidation_(sh);
      logs.push('[Flights] Validations with soft warnings (.setAllowInvalid) & conditional formatting updated.');
    }
    if (elements['Flights.formulas']) {
      AtomicUpdaters.updateFlightsFormulas(sh);
      logs.push('[Flights] Dynamic Flight No sequence batch formulas updated.');
    }
    if (elements['Flights.guardrails']) {
      applyFlightsGuardrails_(sh);
      logs.push('[Flights] Soft warning guardrails applied to formula sequence & hidden IGC Hash.');
    }
    applyFlightsFilter_(sh);
  },

  updateDashboard: function(elements, ss, logs) {
    var sh = ss.getSheetByName(TABS.DASHBOARD.name);
    if (!sh) {
      sh = ensureSheet_(ss, TABS.DASHBOARD.name);
      logs.push('[Dashboard] Created missing Dashboard tab.');
    }
    registerSheetId_(ss, 'DASHBOARD', sh);

    if (elements['Dashboard.grid'] || elements['Dashboard.formulas'] || elements['Dashboard.guardrails']) {
      scaffoldDashboard_(ss);
      logs.push('[Dashboard] Re-linked formulas, DASHBOARD_REVIEW_FILTER named range, clean bounds & guardrails.');
    }
  },

  updateConfig: function(elements, ss, logs) {
    var sh = ss.getSheetByName(TABS.CONFIG.name);
    if (!sh) {
      sh = ensureSheet_(ss, TABS.CONFIG.name);
      logs.push('[Config] Created missing Config tab.');
    }
    registerSheetId_(ss, 'CONFIG', sh);

    if (elements['Config.parameters'] || elements['Config.grid'] || elements['Config.headers'] || elements['Config.validations']) {
      scaffoldConfig_(ss);
      logs.push('[Config] System parameters merged (preserving user values), lookups & validations updated.');
    } else {
      if (elements['Config.lookups'] || elements['Config.namedRanges']) {
        AtomicUpdaters.updateConfigLookupsAndNamedRanges(ss, sh);
        logs.push('[Config] Native =SORT(FILTER()) lookups and LOOKUP_* Named Ranges registered.');
      }
      if (elements['Config.guardrails']) {
        applySoftGuardrail_(sh, sh.getRange('K3:N3'), 'Guardrail: Equipment Auto-Lookup Formulas');
        logs.push('[Config] Soft guardrails applied to lookup formulas K3:N3.');
      }
    }
  },

  updateEquipment: function(elements, ss, logs) {
    var sh = ss.getSheetByName(TABS.EQUIPMENT.name);
    if (!sh) {
      sh = ensureSheet_(ss, TABS.EQUIPMENT.name);
      logs.push('[Equipment] Created missing Equipment tab.');
    }
    registerSheetId_(ss, 'EQUIPMENT', sh);

    if (elements['Equipment.grid']) {
      AtomicUpdaters.updateDimensions(sh, 100, 13, 2, 0, TABS.EQUIPMENT.color);
      logs.push('[Equipment] Grid dimensions (100x13) verified.');
    }
    if (elements['Equipment.headers']) {
      sh.getRange('A1:M1').setBackground(TABS.EQUIPMENT.color).setFontColor('white');
      sh.getRange(2, 1, 1, TABS.EQUIPMENT.columns.length).setValues([TABS.EQUIPMENT.columns]).setBackground('#E0F7FA').setFontWeight('bold');
      logs.push('[Equipment] Headers synchronized.');
    }
    if (elements['Equipment.validations']) {
      applyEquipmentValidation_(sh);
      logs.push('[Equipment] Category validation bound to LOOKUP_EQUIPMENT_CATS.');
    }
  },

  updatePilotProfile: function(elements, ss, logs) {
    if (elements['Pilot_Profile.keys']) {
      scaffoldPilotProfile_(ss);
      logs.push('[Pilot_Profile] Fields synchronized while strictly preserving pilot personal values.');
    }
  },

  updateQueue: function(elements, ss, logs) {
    if (elements['Automation_Queue.headers']) {
      scaffoldQueue_(ss);
      logs.push('[Automation_Queue] Automation Queue schema verified.');
    }
  },

  updateAutomation: function(elements, ss, logs) {
    if (elements['Automation_Rules.grid'] || elements['Automation_Rules.headers'] || elements['Automation_Rules.validations'] || elements['Automation_Rules.templates']) {
      scaffoldAutomation_(ss);
      logs.push('[Automation_Rules] Automation Rules schema, headers, dropdowns, and templates synchronized.');
    }
  },

  updateSystemLog: function(elements, ss, logs) {
    if (elements['System_Log.headers'] || elements['Activity_Logs.headers'] || elements['App_Log.headers']) { // Legacy migration bridge
      scaffoldSystemLog_(ss);
      logs.push('[System_Log] System Log schema & formatting verified.');
    }
  },

  updateActivityLogs: function(elements, ss, logs) {
    this.updateSystemLog(elements, ss, logs); // Legacy alias migration bridge
  },

  updateAppLog: function(elements, ss, logs) {
    this.updateSystemLog(elements, ss, logs); // Legacy alias migration bridge
  },

  updateUserGuide: function(elements, ss, logs) {
    if (elements['User_Guide.content'] || elements['User_Guide.notes']) {
      scaffoldUserGuide_(ss);
      logs.push('[User_Guide] Metric dictionary and documentation refreshed.');
    }
  }
};

/**
 * TIER 3: SYSTEM MAINTENANCE ORCHESTRATOR
 */
var SystemMaintenanceOrchestrator = {
  getStatus: function() {
    var diff = diffManifests_();
    var compLookup = {};
    for (var s = 0; s < diff.sheets.length; s++) {
      for (var c = 0; c < diff.sheets[s].components.length; c++) {
        var cp = diff.sheets[s].components[c];
        compLookup[cp.key] = cp;
      }
    }

    var matrix = {};
    for (var key in SYSTEM_MANIFEST.components) {
      if (SYSTEM_MANIFEST.components.hasOwnProperty(key)) {
        var parts = key.split('.');
        var sName = parts[0];
        var cType = parts[1];
        if (!matrix[sName]) matrix[sName] = {};
        
        var comp = compLookup[key];
        var compDef = SYSTEM_MANIFEST.components[key];
        var latest = (typeof compDef === 'object' && compDef.version) ? compDef.version : compDef;
        var tier = (typeof compDef === 'object' && compDef.tier) ? compDef.tier : 'recommended';

        var item = {
          key: key,
          label: comp ? comp.label : key,
          applied: comp ? comp.applied : 'Not Applied',
          latest: latest,
          tier: tier,
          isUpToDate: comp ? comp.isUpToDate : false,
          isPending: comp ? !comp.isUpToDate : true
        };

        matrix[sName][cType] = item;
        // Aliases for friendly matrix row mappings
        if (cType === 'content') matrix[sName]['notes'] = item;
        if (cType === 'keys') matrix[sName]['parameters'] = item;
        if (cType === 'lookups') matrix[sName]['formulas'] = item;
        if (cType === 'templates') matrix[sName]['parameters'] = item;
      }
    }

    // Compatibility bridge: mirror Activity_Logs to App_Log in matrix if needed (legacy migration bridge)
    if (matrix['Activity_Logs'] && !matrix['App_Log']) { // Legacy migration bridge
      matrix['App_Log'] = matrix['Activity_Logs']; // Legacy migration bridge
    }

    return {
      success: true,
      systemVersion: SYSTEM_MANIFEST.version,
      diff: diff,
      matrix: matrix
    };
  },

  prepare: function(selectedComponents) {
    selectedComponents = selectedComponents || {};
    var currentApplied = getAppliedManifest_();
    var effectiveComponents = {};
    var mandatoryAutoEnforced = [];
    for (var k in selectedComponents) {
      if (selectedComponents[k]) effectiveComponents[k] = true;
    }
    for (var mKey in SYSTEM_MANIFEST.components) {
      if (SYSTEM_MANIFEST.components.hasOwnProperty(mKey)) {
        var mDef = SYSTEM_MANIFEST.components[mKey];
        var mLatest = (typeof mDef === 'object' && mDef.version) ? mDef.version : mDef;
        var mTier = (typeof mDef === 'object' && mDef.tier) ? mDef.tier : 'recommended';
        var mCurrRaw = currentApplied[mKey];
        var mCurr = (typeof mCurrRaw === 'object' && mCurrRaw !== null && mCurrRaw.version) ? mCurrRaw.version : (mCurrRaw || 'Not Applied');
        if (mTier === 'mandatory' && mCurr !== mLatest) {
          if (!effectiveComponents[mKey]) {
            mandatoryAutoEnforced.push(mKey);
          }
          effectiveComponents[mKey] = true;
        }
      }
    }
    return {
      success: true,
      effectiveComponents: effectiveComponents,
      mandatoryAutoEnforced: mandatoryAutoEnforced
    };
  },

  executePhase: function(phase, effectiveComponents, options) {
    var logs = [];
    var ss = SpreadsheetApp.getActive();
    options = options || {};
    effectiveComponents = effectiveComponents || {};

    if (phase === 'init') {
      logs.push('[START] Beginning System Maintenance orchestration...');
      if (options.backupSheets !== false) {
        logs.push('[BACKUP] Creating pre-update safety backup of system sheets...');
        try {
          backupSystemSheets_();
          logs.push('[BACKUP OK] In-workbook sheet clones created successfully.');
        } catch (e) {
          logs.push('[BACKUP WARN] Backup warning: ' + e.message);
        }
      }
    } else if (phase === 'equipment') {
      SheetSpecialists.updateEquipment(effectiveComponents, ss, logs);
    } else if (phase === 'config') {
      SheetSpecialists.updateConfig(effectiveComponents, ss, logs);
    } else if (phase === 'flights') {
      SheetSpecialists.updateFlights(effectiveComponents, ss, logs);
    } else if (phase === 'dashboard') {
      SheetSpecialists.updateDashboard(effectiveComponents, ss, logs);
    } else if (phase === 'reference') {
      SheetSpecialists.updatePilotProfile(effectiveComponents, ss, logs);
      SheetSpecialists.updateAutomation(effectiveComponents, ss, logs);
      SheetSpecialists.updateQueue(effectiveComponents, ss, logs);
      SheetSpecialists.updateSystemLog(effectiveComponents, ss, logs);
      SheetSpecialists.updateUserGuide(effectiveComponents, ss, logs);
    } else if (phase === 'finalize') {
      var applied = getAppliedManifest_();
      var appliedCount = 0;
      for (var key in effectiveComponents) {
        if (effectiveComponents.hasOwnProperty(key) && effectiveComponents[key] && SYSTEM_MANIFEST.components[key]) {
          var cDef = SYSTEM_MANIFEST.components[key];
          applied[key] = (typeof cDef === 'object' && cDef.version) ? cDef.version : cDef;
          appliedCount++;
        }
      }
      if ((effectiveComponents['System_Log.headers'] || effectiveComponents['App_Log.headers'] || effectiveComponents['Activity_Logs.headers']) && SYSTEM_MANIFEST.components['System_Log.headers']) { // Legacy migration bridge
        var slDef = SYSTEM_MANIFEST.components['System_Log.headers'];
        applied['System_Log.headers'] = (typeof slDef === 'object' && slDef.version) ? slDef.version : slDef;
      }
      if ((effectiveComponents['User_Guide.notes'] || effectiveComponents['User_Guide.content']) && SYSTEM_MANIFEST.components['User_Guide.content']) {
        var ugDef = SYSTEM_MANIFEST.components['User_Guide.content'];
        applied['User_Guide.content'] = (typeof ugDef === 'object' && ugDef.version) ? ugDef.version : ugDef;
      }
      setAppliedManifest_(applied);

      logs.push('[COMMIT] Committed ' + appliedCount + ' updated components to APPLIED_MANIFEST.');
      logs.push('[COMPLETE] System Maintenance execution finished successfully.');

      try {
        if (typeof LOG !== 'undefined' && typeof LOG.writeBatch === 'function') {
          var logRows = [];
          var now = new Date();
          for (var li = 0; li < logs.length; li++) {
            logRows.push([
              'System Maintenance',
              now,
              logs[li],
              'Applied ' + appliedCount + ' components'
            ]);
          }
          LOG.writeBatch(logRows);
        }
      } catch (logErr) {
        console.warn('[LOG WARN] Failed to write maintenance logs to Activity Logs: ' + logErr.message);
      }

      var exportPayload = null;
      if (options.exportConfig) {
        try {
          exportPayload = getConfigExportPayload_();
          logs.push('[EXPORT] Prepared configuration JSON backup for download.');
        } catch (e) {
          logs.push('[EXPORT WARN] Config export warning: ' + e.message);
        }
      }

      return {
        success: true,
        phase: phase,
        logs: logs,
        appliedCount: appliedCount,
        exportPayload: exportPayload
      };
    }

    return {
      success: true,
      phase: phase,
      logs: logs
    };
  },

  execute: function(selectedComponents, options) {
    options = options || {};
    var prep = this.prepare(selectedComponents);
    var eff = prep.effectiveComponents;
    var allLogs = [];
    
    if (prep.mandatoryAutoEnforced && prep.mandatoryAutoEnforced.length > 0) {
      prep.mandatoryAutoEnforced.forEach(function(m) {
        allLogs.push('[INVARIANT] Auto-enforcing mandatory system component: ' + m);
      });
    }

    var phases = ['init', 'equipment', 'config', 'flights', 'dashboard', 'reference', 'finalize'];
    var appliedCount = 0;
    var exportPayload = null;

    for (var i = 0; i < phases.length; i++) {
      var res = this.executePhase(phases[i], eff, options);
      if (res.logs) allLogs = allLogs.concat(res.logs);
      if (res.appliedCount !== undefined) appliedCount = res.appliedCount;
      if (res.exportPayload) exportPayload = res.exportPayload;
    }

    return {
      success: true,
      logs: allLogs,
      appliedCount: appliedCount,
      exportPayload: exportPayload
    };
  }
};


