/**
 * Paragliding Flight Log v2.0
 * Updated: 2026-09-30 17:48:50
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
  ensureSheet_(ss, TABS.DASHBOARD.name);
  ensureSheet_(ss, TABS.FLIGHTS.name);
  ensureSheet_(ss, TABS.PILOT_PROFILE.name);
  ensureSheet_(ss, TABS.EQUIPMENT.name);
  ensureSheet_(ss, TABS.USER_GUIDE.name);
  ensureSheet_(ss, TABS.PARAMETERS.name);
  ensureSheet_(ss, TABS.LOOKUPS.name);
  ensureSheet_(ss, TABS.APP_LOG.name);
  
  // 2. Scaffolding Content
  scaffoldDashboard_(ss);
  scaffoldLookups_(ss); // Must run before Flights & Parameters to populate validation lists
  scaffoldFlights_(ss);
  scaffoldPilotProfile_(ss);
  scaffoldEquipment_(ss);
  scaffoldUserGuide_(ss);

  scaffoldParameters_(ss);
  scaffoldAppLog_(ss);
  
  // 3. Reorder Tabs
  var sheets = [
    TABS.DASHBOARD.name, 
    TABS.FLIGHTS.name, 
    TABS.PILOT_PROFILE.name,
    TABS.EQUIPMENT.name, 
    TABS.USER_GUIDE.name,
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
  
  // 1b. Master Folder Link (Row 2, Cols A:F)
  var masterLinkFormula = '=IF(ISBLANK(VLOOKUP("MASTER_LOG_FOLDER_ID", ' + TABS.PARAMETERS.name + '!A:B, 2, FALSE)), "Master Flight Logs folder (Not Configured)", HYPERLINK("https://drive.google.com/drive/folders/" & VLOOKUP("MASTER_LOG_FOLDER_ID", ' + TABS.PARAMETERS.name + '!A:B, 2, FALSE), "📁 Master Flight Logs folder"))';
  sh.getRange('A2:F2').merge().setFormula(masterLinkFormula).setFontSize(10).setFontStyle('italic').setHorizontalAlignment('center');
  sh.setRowHeight(2, 22);

  // Spacer Row 3
  sh.setRowHeight(3, 10);
  
  // 2. Banner 1: All-Time Stats (Row 4 Header, Rows 5-6 Cards)
  sh.getRange('A4:F4').merge().setValue('ALL-TIME SUMMARY').setBackground('#ECEFF1').setFontColor('#546E7A').setFontWeight('bold').setFontSize(10).setHorizontalAlignment('center').setVerticalAlignment('middle');
  sh.setRowHeight(4, 18);

  var fTotalFlights = '=IFERROR(TEXT(COUNTIF(INDIRECT("' + fSheet + '!A' + fStart + ':A"), "<>"), "#,##0") & CHAR(10) & "Total Flights", "0" & CHAR(10) & "Total Flights")';
  var fTotalHours = '=IFERROR(TEXT(SUMPRODUCT(IFERROR(TIMEVALUE(INDIRECT("' + fSheet + '!L' + fStart + ':L")), 0)), "[h]:mm") & " hrs" & CHAR(10) & "Total Hours", "0:00 hrs" & CHAR(10) & "Total Hours")';
  var fTotalDist = '=IFERROR(TEXT(SUM(INDIRECT("' + fSheet + '!M' + fStart + ':M")), "#,##0") & " km" & CHAR(10) & "Total Distance", "0 km" & CHAR(10) & "Total Distance")';

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

  var fYearFlights = '=IFERROR(TEXT(COUNTIFS(INDIRECT("' + fSheet + '!H' + fStart + ':H"), ">=" & DATE(YEAR(TODAY()), 1, 1), INDIRECT("' + fSheet + '!H' + fStart + ':H"), "<=" & DATE(YEAR(TODAY()), 12, 31)), "#,##0") & CHAR(10) & "Flights (" & YEAR(TODAY()) & ")", "0" & CHAR(10) & "Flights (" & YEAR(TODAY()) & ")")';
  var fYearHours = '=IFERROR(TEXT(SUMPRODUCT((IFERROR(YEAR(INDIRECT("' + fSheet + '!H' + fStart + ':H")), 0)=YEAR(TODAY())) * IFERROR(TIMEVALUE(INDIRECT("' + fSheet + '!L' + fStart + ':L")), 0)), "[h]:mm") & " hrs" & CHAR(10) & "Hours (" & YEAR(TODAY()) & ")", "0:00 hrs" & CHAR(10) & "Hours (" & YEAR(TODAY()) & ")")';
  var fYearDist = '=IFERROR(TEXT(SUMIFS(INDIRECT("' + fSheet + '!M' + fStart + ':M"), INDIRECT("' + fSheet + '!H' + fStart + ':H"), ">=" & DATE(YEAR(TODAY()), 1, 1), INDIRECT("' + fSheet + '!H' + fStart + ':H"), "<=" & DATE(YEAR(TODAY()), 12, 31)), "#,##0") & " km" & CHAR(10) & "Distance (" & YEAR(TODAY()) & ")", "0 km" & CHAR(10) & "Distance (" & YEAR(TODAY()) & ")")';

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
    var fMonthFlights = '=IFERROR(COUNTIFS(INDIRECT("' + fSheet + '!H' + fStart + ':H"), ">=" & DATE(YEAR(EDATE(TODAY(), ' + offset + ')), MONTH(EDATE(TODAY(), ' + offset + ')), 1), INDIRECT("' + fSheet + '!H' + fStart + ':H"), "<=" & EOMONTH(EDATE(TODAY(), ' + offset + '), 0)), 0)';
    var rFlights = sh.getRange(colLetter + '14');
    rFlights.setFormula(fMonthFlights).setNumberFormat('0 "flts"').setHorizontalAlignment('center').setVerticalAlignment('middle').setBorder(true, true, true, true, true, true, '#E0E0E0', SpreadsheetApp.BorderStyle.SOLID);

    // Row 15: Total Time (pure numeric day fraction, format [h]:mm "hrs")
    var fMonthHours = '=IFERROR(SUMPRODUCT((INDIRECT("' + fSheet + '!H' + fStart + ':H") >= DATE(YEAR(EDATE(TODAY(), ' + offset + ')), MONTH(EDATE(TODAY(), ' + offset + ')), 1)) * (INDIRECT("' + fSheet + '!H' + fStart + ':H") <= EOMONTH(EDATE(TODAY(), ' + offset + '), 0)) * IFERROR(TIMEVALUE(INDIRECT("' + fSheet + '!L' + fStart + ':L")), 0)), 0)';
    var rHours = sh.getRange(colLetter + '15');
    rHours.setFormula(fMonthHours).setNumberFormat('[h]:mm "hrs"').setHorizontalAlignment('center').setVerticalAlignment('middle').setBorder(true, true, true, true, true, true, '#E0E0E0', SpreadsheetApp.BorderStyle.SOLID);

    // Row 16: Total Distance (pure numeric, format #,##0 "km")
    var fMonthDist = '=IFERROR(SUMIFS(INDIRECT("' + fSheet + '!M' + fStart + ':M"), INDIRECT("' + fSheet + '!H' + fStart + ':H"), ">=" & DATE(YEAR(EDATE(TODAY(), ' + offset + ')), MONTH(EDATE(TODAY(), ' + offset + ')), 1), INDIRECT("' + fSheet + '!H' + fStart + ':H"), "<=" & EOMONTH(EDATE(TODAY(), ' + offset + '), 0)), 0)';
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
  var pSheet = TABS.PARAMETERS.name;

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

  for (var k = 1; k <= 5; k++) {
    var rNum1 = k + 18;
    // Top Duration (A:C): Col C (Flight No), Col L (Duration formatted as [h]:mm hrs), Col D (Auto Summary), sorted on TIMEVALUE
    var fDur = '=IFERROR("Flight " & INDEX(SORT(FILTER({INDIRECT("' + fSheet + '!C' + fStart + ':C"), TEXT(IFERROR(TIMEVALUE(INDIRECT("' + fSheet + '!L' + fStart + ':L")), INDIRECT("' + fSheet + '!L' + fStart + ':L")), "[h]:mm") & " hrs", INDIRECT("' + fSheet + '!D' + fStart + ':D"), IFERROR(TIMEVALUE(INDIRECT("' + fSheet + '!L' + fStart + ':L")), 0)}, (INDIRECT("' + fSheet + '!A' + fStart + ':A")<>"") * (IFERROR(TIMEVALUE(INDIRECT("' + fSheet + '!L' + fStart + ':L")), 0)>0)), 4, FALSE), ' + k + ', 1) & " - " & INDEX(SORT(FILTER({INDIRECT("' + fSheet + '!C' + fStart + ':C"), TEXT(IFERROR(TIMEVALUE(INDIRECT("' + fSheet + '!L' + fStart + ':L")), INDIRECT("' + fSheet + '!L' + fStart + ':L")), "[h]:mm") & " hrs", INDIRECT("' + fSheet + '!D' + fStart + ':D"), IFERROR(TIMEVALUE(INDIRECT("' + fSheet + '!L' + fStart + ':L")), 0)}, (INDIRECT("' + fSheet + '!A' + fStart + ':A")<>"") * (IFERROR(TIMEVALUE(INDIRECT("' + fSheet + '!L' + fStart + ':L")), 0)>0)), 4, FALSE), ' + k + ', 2) & " (" & INDEX(SORT(FILTER({INDIRECT("' + fSheet + '!C' + fStart + ':C"), TEXT(IFERROR(TIMEVALUE(INDIRECT("' + fSheet + '!L' + fStart + ':L")), INDIRECT("' + fSheet + '!L' + fStart + ':L")), "[h]:mm") & " hrs", INDIRECT("' + fSheet + '!D' + fStart + ':D"), IFERROR(TIMEVALUE(INDIRECT("' + fSheet + '!L' + fStart + ':L")), 0)}, (INDIRECT("' + fSheet + '!A' + fStart + ':A")<>"") * (IFERROR(TIMEVALUE(INDIRECT("' + fSheet + '!L' + fStart + ':L")), 0)>0)), 4, FALSE), ' + k + ', 3) & ")", "-")';
    sh.getRange(rNum1, 1, 1, 3).merge().setFormula(fDur).setBorder(false, false, true, false, false, false, '#E0E0E0', SpreadsheetApp.BorderStyle.SOLID).setVerticalAlignment('middle');

    // Top Distance (D:F): Col C (Flight No), Col M (Track Length), Col D (Auto Summary)
    var fDist = '=IFERROR("Flight " & INDEX(SORT(FILTER({INDIRECT("' + fSheet + '!C' + fStart + ':C"), INDIRECT("' + fSheet + '!M' + fStart + ':M"), INDIRECT("' + fSheet + '!D' + fStart + ':D")}, (INDIRECT("' + fSheet + '!A' + fStart + ':A")<>"") * (IFERROR(VALUE(INDIRECT("' + fSheet + '!M' + fStart + ':M")), 0)>0)), 2, FALSE), ' + k + ', 1) & " - " & TEXT(INDEX(SORT(FILTER({INDIRECT("' + fSheet + '!C' + fStart + ':C"), INDIRECT("' + fSheet + '!M' + fStart + ':M"), INDIRECT("' + fSheet + '!D' + fStart + ':D")}, (INDIRECT("' + fSheet + '!A' + fStart + ':A")<>"") * (IFERROR(VALUE(INDIRECT("' + fSheet + '!M' + fStart + ':M")), 0)>0)), 2, FALSE), ' + k + ', 2), "0.0") & " km (" & INDEX(SORT(FILTER({INDIRECT("' + fSheet + '!C' + fStart + ':C"), INDIRECT("' + fSheet + '!M' + fStart + ':M"), INDIRECT("' + fSheet + '!D' + fStart + ':D")}, (INDIRECT("' + fSheet + '!A' + fStart + ':A")<>"") * (IFERROR(VALUE(INDIRECT("' + fSheet + '!M' + fStart + ':M")), 0)>0)), 2, FALSE), ' + k + ', 3) & ")", "-")';
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
    // Top Max Altitude (A:C): Col C (Flight No), Col AB (Max Alt in m), Col D (Auto Summary)
    var fAlt = '=IFERROR("Flight " & INDEX(SORT(FILTER({INDIRECT("' + fSheet + '!C' + fStart + ':C"), INDIRECT("' + fSheet + '!AB' + fStart + ':AB"), INDIRECT("' + fSheet + '!D' + fStart + ':D")}, (INDIRECT("' + fSheet + '!A' + fStart + ':A")<>"") * (IFERROR(VALUE(INDIRECT("' + fSheet + '!AB' + fStart + ':AB")), 0)>0)), 2, FALSE), ' + m + ', 1) & " - " & TEXT(INDEX(SORT(FILTER({INDIRECT("' + fSheet + '!C' + fStart + ':C"), INDIRECT("' + fSheet + '!AB' + fStart + ':AB"), INDIRECT("' + fSheet + '!D' + fStart + ':D")}, (INDIRECT("' + fSheet + '!A' + fStart + ':A")<>"") * (IFERROR(VALUE(INDIRECT("' + fSheet + '!AB' + fStart + ':AB")), 0)>0)), 2, FALSE), ' + m + ', 2), "#,##0") & " m (" & INDEX(SORT(FILTER({INDIRECT("' + fSheet + '!C' + fStart + ':C"), INDIRECT("' + fSheet + '!AB' + fStart + ':AB"), INDIRECT("' + fSheet + '!D' + fStart + ':D")}, (INDIRECT("' + fSheet + '!A' + fStart + ':A")<>"") * (IFERROR(VALUE(INDIRECT("' + fSheet + '!AB' + fStart + ':AB")), 0)>0)), 2, FALSE), ' + m + ', 3) & ")", "-")';
    sh.getRange(rNum2, 1, 1, 3).merge().setFormula(fAlt).setBorder(false, false, true, false, false, false, '#E0E0E0', SpreadsheetApp.BorderStyle.SOLID).setVerticalAlignment('middle');

    // Top Altitude Gain (D:F): Col C (Flight No), Col AD (Total Height Gain in m), Col D (Auto Summary)
    var fGain = '=IFERROR("Flight " & INDEX(SORT(FILTER({INDIRECT("' + fSheet + '!C' + fStart + ':C"), INDIRECT("' + fSheet + '!AD' + fStart + ':AD"), INDIRECT("' + fSheet + '!D' + fStart + ':D")}, (INDIRECT("' + fSheet + '!A' + fStart + ':A")<>"") * (IFERROR(VALUE(INDIRECT("' + fSheet + '!AD' + fStart + ':AD")), 0)>0)), 2, FALSE), ' + m + ', 1) & " - " & TEXT(INDEX(SORT(FILTER({INDIRECT("' + fSheet + '!C' + fStart + ':C"), INDIRECT("' + fSheet + '!AD' + fStart + ':AD"), INDIRECT("' + fSheet + '!D' + fStart + ':D")}, (INDIRECT("' + fSheet + '!A' + fStart + ':A")<>"") * (IFERROR(VALUE(INDIRECT("' + fSheet + '!AD' + fStart + ':AD")), 0)>0)), 2, FALSE), ' + m + ', 2), "#,##0") & " m (" & INDEX(SORT(FILTER({INDIRECT("' + fSheet + '!C' + fStart + ':C"), INDIRECT("' + fSheet + '!AD' + fStart + ':AD"), INDIRECT("' + fSheet + '!D' + fStart + ':D")}, (INDIRECT("' + fSheet + '!A' + fStart + ':A")<>"") * (IFERROR(VALUE(INDIRECT("' + fSheet + '!AD' + fStart + ':AD")), 0)>0)), 2, FALSE), ' + m + ', 3) & ")", "-")';
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
    // Top Thermal Flights (A:C): Thermal% (Col BC) * Flight Duration (Col L)
    var fTherm = '=IFERROR("Flight " & INDEX(SORT(FILTER({INDIRECT("' + fSheet + '!C' + fStart + ':C"), TEXT(IFERROR(VALUE(INDIRECT("' + fSheet + '!BC' + fStart + ':BC")) * TIMEVALUE(INDIRECT("' + fSheet + '!L' + fStart + ':L")), 0), "[h]:mm") & " hrs", INDIRECT("' + fSheet + '!BC' + fStart + ':BC"), INDIRECT("' + fSheet + '!D' + fStart + ':D"), IFERROR(VALUE(INDIRECT("' + fSheet + '!BC' + fStart + ':BC")) * TIMEVALUE(INDIRECT("' + fSheet + '!L' + fStart + ':L")), 0)}, (INDIRECT("' + fSheet + '!A' + fStart + ':A")<>"") * (IFERROR(VALUE(INDIRECT("' + fSheet + '!BC' + fStart + ':BC")) * TIMEVALUE(INDIRECT("' + fSheet + '!L' + fStart + ':L")), 0)>0)), 5, FALSE), ' + t + ', 1) & " - " & INDEX(SORT(FILTER({INDIRECT("' + fSheet + '!C' + fStart + ':C"), TEXT(IFERROR(VALUE(INDIRECT("' + fSheet + '!BC' + fStart + ':BC")) * TIMEVALUE(INDIRECT("' + fSheet + '!L' + fStart + ':L")), 0), "[h]:mm") & " hrs", INDIRECT("' + fSheet + '!BC' + fStart + ':BC"), INDIRECT("' + fSheet + '!D' + fStart + ':D"), IFERROR(VALUE(INDIRECT("' + fSheet + '!BC' + fStart + ':BC")) * TIMEVALUE(INDIRECT("' + fSheet + '!L' + fStart + ':L")), 0)}, (INDIRECT("' + fSheet + '!A' + fStart + ':A")<>"") * (IFERROR(VALUE(INDIRECT("' + fSheet + '!BC' + fStart + ':BC")) * TIMEVALUE(INDIRECT("' + fSheet + '!L' + fStart + ':L")), 0)>0)), 5, FALSE), ' + t + ', 2) & " (" & INDEX(SORT(FILTER({INDIRECT("' + fSheet + '!C' + fStart + ':C"), TEXT(IFERROR(VALUE(INDIRECT("' + fSheet + '!BC' + fStart + ':BC")) * TIMEVALUE(INDIRECT("' + fSheet + '!L' + fStart + ':L")), 0), "[h]:mm") & " hrs", INDIRECT("' + fSheet + '!BC' + fStart + ':BC"), INDIRECT("' + fSheet + '!D' + fStart + ':D"), IFERROR(VALUE(INDIRECT("' + fSheet + '!BC' + fStart + ':BC")) * TIMEVALUE(INDIRECT("' + fSheet + '!L' + fStart + ':L")), 0)}, (INDIRECT("' + fSheet + '!A' + fStart + ':A")<>"") * (IFERROR(VALUE(INDIRECT("' + fSheet + '!BC' + fStart + ':BC")) * TIMEVALUE(INDIRECT("' + fSheet + '!L' + fStart + ':L")), 0)>0)), 5, FALSE), ' + t + ', 3) & ", " & INDEX(SORT(FILTER({INDIRECT("' + fSheet + '!C' + fStart + ':C"), TEXT(IFERROR(VALUE(INDIRECT("' + fSheet + '!BC' + fStart + ':BC")) * TIMEVALUE(INDIRECT("' + fSheet + '!L' + fStart + ':L")), 0), "[h]:mm") & " hrs", INDIRECT("' + fSheet + '!BC' + fStart + ':BC"), INDIRECT("' + fSheet + '!D' + fStart + ':D"), IFERROR(VALUE(INDIRECT("' + fSheet + '!BC' + fStart + ':BC")) * TIMEVALUE(INDIRECT("' + fSheet + '!L' + fStart + ':L")), 0)}, (INDIRECT("' + fSheet + '!A' + fStart + ':A")<>"") * (IFERROR(VALUE(INDIRECT("' + fSheet + '!BC' + fStart + ':BC")) * TIMEVALUE(INDIRECT("' + fSheet + '!L' + fStart + ':L")), 0)>0)), 5, FALSE), ' + t + ', 4) & ")", "-")';
    sh.getRange(rNum3, 1, 1, 3).merge().setFormula(fTherm).setBorder(false, false, true, false, false, false, '#E0E0E0', SpreadsheetApp.BorderStyle.SOLID).setVerticalAlignment('middle');

    // Top Soaring Flights (D:F): Soar% (Col BG) * Flight Duration (Col L)
    var fSoar = '=IFERROR("Flight " & INDEX(SORT(FILTER({INDIRECT("' + fSheet + '!C' + fStart + ':C"), TEXT(IFERROR(VALUE(INDIRECT("' + fSheet + '!BG' + fStart + ':BG")) * TIMEVALUE(INDIRECT("' + fSheet + '!L' + fStart + ':L")), 0), "[h]:mm") & " hrs", INDIRECT("' + fSheet + '!BG' + fStart + ':BG"), INDIRECT("' + fSheet + '!D' + fStart + ':D"), IFERROR(VALUE(INDIRECT("' + fSheet + '!BG' + fStart + ':BG")) * TIMEVALUE(INDIRECT("' + fSheet + '!L' + fStart + ':L")), 0)}, (INDIRECT("' + fSheet + '!A' + fStart + ':A")<>"") * (IFERROR(VALUE(INDIRECT("' + fSheet + '!BG' + fStart + ':BG")) * TIMEVALUE(INDIRECT("' + fSheet + '!L' + fStart + ':L")), 0)>0)), 5, FALSE), ' + t + ', 1) & " - " & INDEX(SORT(FILTER({INDIRECT("' + fSheet + '!C' + fStart + ':C"), TEXT(IFERROR(VALUE(INDIRECT("' + fSheet + '!BG' + fStart + ':BG")) * TIMEVALUE(INDIRECT("' + fSheet + '!L' + fStart + ':L")), 0), "[h]:mm") & " hrs", INDIRECT("' + fSheet + '!BG' + fStart + ':BG"), INDIRECT("' + fSheet + '!D' + fStart + ':D"), IFERROR(VALUE(INDIRECT("' + fSheet + '!BG' + fStart + ':BG")) * TIMEVALUE(INDIRECT("' + fSheet + '!L' + fStart + ':L")), 0)}, (INDIRECT("' + fSheet + '!A' + fStart + ':A")<>"") * (IFERROR(VALUE(INDIRECT("' + fSheet + '!BG' + fStart + ':BG")) * TIMEVALUE(INDIRECT("' + fSheet + '!L' + fStart + ':L")), 0)>0)), 5, FALSE), ' + t + ', 2) & " (" & INDEX(SORT(FILTER({INDIRECT("' + fSheet + '!C' + fStart + ':C"), TEXT(IFERROR(VALUE(INDIRECT("' + fSheet + '!BG' + fStart + ':BG")) * TIMEVALUE(INDIRECT("' + fSheet + '!L' + fStart + ':L")), 0), "[h]:mm") & " hrs", INDIRECT("' + fSheet + '!BG' + fStart + ':BG"), INDIRECT("' + fSheet + '!D' + fStart + ':D"), IFERROR(VALUE(INDIRECT("' + fSheet + '!BG' + fStart + ':BG")) * TIMEVALUE(INDIRECT("' + fSheet + '!L' + fStart + ':L")), 0)}, (INDIRECT("' + fSheet + '!A' + fStart + ':A")<>"") * (IFERROR(VALUE(INDIRECT("' + fSheet + '!BG' + fStart + ':BG")) * TIMEVALUE(INDIRECT("' + fSheet + '!L' + fStart + ':L")), 0)>0)), 5, FALSE), ' + t + ', 3) & ", " & INDEX(SORT(FILTER({INDIRECT("' + fSheet + '!C' + fStart + ':C"), TEXT(IFERROR(VALUE(INDIRECT("' + fSheet + '!BG' + fStart + ':BG")) * TIMEVALUE(INDIRECT("' + fSheet + '!L' + fStart + ':L")), 0), "[h]:mm") & " hrs", INDIRECT("' + fSheet + '!BG' + fStart + ':BG"), INDIRECT("' + fSheet + '!D' + fStart + ':D"), IFERROR(VALUE(INDIRECT("' + fSheet + '!BG' + fStart + ':BG")) * TIMEVALUE(INDIRECT("' + fSheet + '!L' + fStart + ':L")), 0)}, (INDIRECT("' + fSheet + '!A' + fStart + ':A")<>"") * (IFERROR(VALUE(INDIRECT("' + fSheet + '!BG' + fStart + ':BG")) * TIMEVALUE(INDIRECT("' + fSheet + '!L' + fStart + ':L")), 0)>0)), 5, FALSE), ' + t + ', 4) & ")", "-")';
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
    // Top XC Score (A:C): Col C (Flight No), Col V (XC Score), Col D (Auto Summary)
    var fXC = '=IFERROR("Flight " & INDEX(SORT(FILTER({INDIRECT("' + fSheet + '!C' + fStart + ':C"), IFERROR(VALUE(INDIRECT("' + fSheet + '!V' + fStart + ':V")), 0), INDIRECT("' + fSheet + '!D' + fStart + ':D")}, (INDIRECT("' + fSheet + '!A' + fStart + ':A")<>"") * (IFERROR(VALUE(INDIRECT("' + fSheet + '!V' + fStart + ':V")), 0)>0)), 2, FALSE), ' + p + ', 1) & " - " & TEXT(INDEX(SORT(FILTER({INDIRECT("' + fSheet + '!C' + fStart + ':C"), IFERROR(VALUE(INDIRECT("' + fSheet + '!V' + fStart + ':V")), 0), INDIRECT("' + fSheet + '!D' + fStart + ':D")}, (INDIRECT("' + fSheet + '!A' + fStart + ':A")<>"") * (IFERROR(VALUE(INDIRECT("' + fSheet + '!V' + fStart + ':V")), 0)>0)), 2, FALSE), ' + p + ', 2), "0.0") & " pts (" & INDEX(SORT(FILTER({INDIRECT("' + fSheet + '!C' + fStart + ':C"), IFERROR(VALUE(INDIRECT("' + fSheet + '!V' + fStart + ':V")), 0), INDIRECT("' + fSheet + '!D' + fStart + ':D")}, (INDIRECT("' + fSheet + '!A' + fStart + ':A")<>"") * (IFERROR(VALUE(INDIRECT("' + fSheet + '!V' + fStart + ':V")), 0)>0)), 2, FALSE), ' + p + ', 3) & ")", "-")';
    sh.getRange(rNum4, 1, 1, 3).merge().setFormula(fXC).setBorder(false, false, true, false, false, false, '#E0E0E0', SpreadsheetApp.BorderStyle.SOLID).setVerticalAlignment('middle');

    // Top Max Groundspeed (D:F): Col C (Flight No), Col AG (Max Groundspeed in km/h), Col D (Auto Summary)
    var fSpeed = '=IFERROR("Flight " & INDEX(SORT(FILTER({INDIRECT("' + fSheet + '!C' + fStart + ':C"), IFERROR(VALUE(INDIRECT("' + fSheet + '!AG' + fStart + ':AG")), 0), INDIRECT("' + fSheet + '!D' + fStart + ':D")}, (INDIRECT("' + fSheet + '!A' + fStart + ':A")<>"") * (IFERROR(VALUE(INDIRECT("' + fSheet + '!AG' + fStart + ':AG")), 0)>0)), 2, FALSE), ' + p + ', 1) & " - " & TEXT(INDEX(SORT(FILTER({INDIRECT("' + fSheet + '!C' + fStart + ':C"), IFERROR(VALUE(INDIRECT("' + fSheet + '!AG' + fStart + ':AG")), 0), INDIRECT("' + fSheet + '!D' + fStart + ':D")}, (INDIRECT("' + fSheet + '!A' + fStart + ':A")<>"") * (IFERROR(VALUE(INDIRECT("' + fSheet + '!AG' + fStart + ':AG")), 0)>0)), 2, FALSE), ' + p + ', 2), "0.0") & " km/h (" & INDEX(SORT(FILTER({INDIRECT("' + fSheet + '!C' + fStart + ':C"), IFERROR(VALUE(INDIRECT("' + fSheet + '!AG' + fStart + ':AG")), 0), INDIRECT("' + fSheet + '!D' + fStart + ':D")}, (INDIRECT("' + fSheet + '!A' + fStart + ':A")<>"") * (IFERROR(VALUE(INDIRECT("' + fSheet + '!AG' + fStart + ':AG")), 0)>0)), 2, FALSE), ' + p + ', 3) & ")", "-")';
    sh.getRange(rNum4, 4, 1, 3).merge().setFormula(fSpeed).setBorder(false, false, true, false, false, false, '#E0E0E0', SpreadsheetApp.BorderStyle.SOLID).setVerticalAlignment('middle');
    sh.setRowHeight(rNum4, 22);
  }

  // Spacer Row 45
  sh.setRowHeight(45, 14);

  // 6. Section 5: Lists (Launch Sites & Countries Flown - 20 Rows Pre-scaffolded)
  sh.getRange('A46:C46').merge().setValue('List of Launch Sites').setBackground('#CFD8DC').setFontWeight('bold').setHorizontalAlignment('center').setVerticalAlignment('middle');
  sh.getRange('D46:F46').merge().setValue('List of Countries').setBackground('#CFD8DC').setFontWeight('bold').setHorizontalAlignment('center').setVerticalAlignment('middle');
  sh.setRowHeight(46, 26);

  for (var n = 1; n <= 20; n++) {
    var rNum5 = n + 46;
    // Launch Sites (A:C): Col AL (Launch Site)
    var fSite = '=IFERROR(INDEX(QUERY(INDIRECT("' + fSheet + '!AL' + fStart + ':AL"), "SELECT Col1, COUNT(Col1) WHERE Col1 IS NOT NULL AND Col1 <> \'\' GROUP BY Col1 ORDER BY COUNT(Col1) DESC LABEL COUNT(Col1) \'\'"), ' + n + ', 1) & " - " & INDEX(QUERY(INDIRECT("' + fSheet + '!AL' + fStart + ':AL"), "SELECT Col1, COUNT(Col1) WHERE Col1 IS NOT NULL AND Col1 <> \'\' GROUP BY Col1 ORDER BY COUNT(Col1) DESC LABEL COUNT(Col1) \'\'"), ' + n + ', 2) & " Flights", "")';
    sh.getRange(rNum5, 1, 1, 3).merge().setFormula(fSite).setBorder(false, false, true, false, false, false, '#E0E0E0', SpreadsheetApp.BorderStyle.SOLID).setVerticalAlignment('middle');

    // Countries Flown (D:F): Col AN (Launch Country)
    var fCtry = '=IFERROR(INDEX(QUERY(INDIRECT("' + fSheet + '!AN' + fStart + ':AN"), "SELECT Col1, COUNT(Col1) WHERE Col1 IS NOT NULL AND Col1 <> \'\' GROUP BY Col1 ORDER BY COUNT(Col1) DESC LABEL COUNT(Col1) \'\'"), ' + n + ', 1) & " - " & INDEX(QUERY(INDIRECT("' + fSheet + '!AN' + fStart + ':AN"), "SELECT Col1, COUNT(Col1) WHERE Col1 IS NOT NULL AND Col1 <> \'\' GROUP BY Col1 ORDER BY COUNT(Col1) DESC LABEL COUNT(Col1) \'\'"), ' + n + ', 2) & " Flights", "")';
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

  sh.setHiddenGridlines(true);
}

function scaffoldParameters_(ss) {
  var sh = ss.getSheetByName(TABS.PARAMETERS.name);
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
      var isFolder = (p.key === 'WATCH_FOLDER_ID' || p.key === 'UPLOAD_FOLDER_ID' || p.key === 'MASTER_LOG_FOLDER_ID' || p.key === 'ERROR_FOLDER_ID');
      if (isFolder && val) {
        var pStr = (p.key === 'WATCH_FOLDER_ID') ? getMultiFolderPath_(val) : getFolderPath_(val);
        if (pStr) desc += '\n[Path: ' + pStr + ']';
      }
      rows.push([p.key, val, desc, p.input]); // p.input is meta, removed before write
  });

  // Write Data
  var writeRows = rows.map(function(r) { return [r[0], r[1], r[2]]; });
  ensureDimensions_(sh, writeRows.length + 5, 3);
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
     if (rows[i][0] === 'DATE_FORMAT' || rows[i][0] === 'TIME_FORMAT') {
        sh.getRange(rowNum, 2).setNumberFormat('@');
     } else if (rows[i][0] === 'TIMELINE_HOURS_LOW' || rows[i][0] === 'TIMELINE_HOURS_MED') {
        sh.getRange(rowNum, 2).setNumberFormat('[h]:mm "hrs"');
     } else if (rows[i][0] === 'TIMELINE_FLIGHTS_LOW' || rows[i][0] === 'TIMELINE_FLIGHTS_MED') {
        sh.getRange(rowNum, 2).setNumberFormat('0 "flts"');
     }
  }
  sh.autoResizeColumns(1, 3);
  
  // Validation for Date/Time Formats
  var shLook = ss.getSheetByName(TABS.LOOKUPS.name);
  if (shLook) {
      // Use Range instead of List for dynamic updates
      var dateRange = shLook.getRange('I3:I7');
      var timeRange = shLook.getRange('J3:J4');
      
      var dateRule = SpreadsheetApp.newDataValidation().requireValueInRange(dateRange, true).build();
      var timeRule = SpreadsheetApp.newDataValidation().requireValueInRange(timeRange, true).build();
      
      // Find rows for DATE_FORMAT and TIME_FORMAT
      for (var i=0; i<rows.length; i++) {
         if (rows[i][0] === 'DATE_FORMAT') sh.getRange(i+3, 2).setNumberFormat('@').setDataValidation(dateRule);
         if (rows[i][0] === 'TIME_FORMAT') sh.getRange(i+3, 2).setNumberFormat('@').setDataValidation(timeRule);
         
         // Boolean Dropdowns
         if (['ENABLE_WATCH_FOLDER', 'MOVE_FROM_WATCH_FOLDER'].indexOf(rows[i][0]) > -1) {
            var boolRule = SpreadsheetApp.newDataValidation().requireValueInList(['TRUE', 'FALSE'], true).build();
            sh.getRange(i+3, 2).setDataValidation(boolRule);
         }
      }
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
  ensureDimensions_(sh, 50, 10);
  
  // Row 1
  sh.getRange('A1').setValue(TABS.LOOKUPS.name).setFontWeight('bold').setFontSize(12);
  sh.getRange('A1:G1').setBackground(TABS.LOOKUPS.color);
  
  // Row 2
  // Row 2
  sh.getRange('A2:J2').setValues([TABS.LOOKUPS.columns.concat(['XC Classes', 'Date Formats', 'Time Formats'])]);
  sh.getRange('A2:J2').setFontWeight('bold').setBackground('#EEEEEE');
  
  // Static Categories
  sh.getRange('A3:A6').setValues([['Wing'], ['Harness'], ['Reserve'], ['Other']]);
  
  // Queries
  var eqName = TABS.EQUIPMENT.name;
  sh.getRange('B3').setFormula('=IFERROR(QUERY(' + eqName + '!A:M, "select B where A=\'Wing\' and H=FALSE order by B asc label B \'\'", 0), "")');
  sh.getRange('C3').setFormula('=IFERROR(QUERY(' + eqName + '!A:M, "select B where A=\'Harness\' and H=FALSE order by B asc label B \'\'", 0), "")');
  sh.getRange('D3').setFormula('=IFERROR(QUERY(' + eqName + '!A:M, "select B where A=\'Reserve\' and H=FALSE order by B asc label B \'\'", 0), "")');
  sh.getRange('E3').setFormula('=IFERROR(QUERY(' + eqName + '!A:M, "select B where A=\'Other\' and H=FALSE order by B asc label B \'\'", 0), "")');

  // Status & Types from CFG
  var statuses = ['Review?', 'Valid', 'Invalid?', 'Duplicate'];
  var types = ['Free Fly', 'XC', 'Soaring', 'Comp', 'SIV / Maneuvers', 'Training', 'Other'];
  var xcClasses = ['Open', 'Triangle', 'FAI Triangle', 'Out-and-Return'];
  var dateFormats = ['yyyy-MM-dd', 'MM/dd/yyyy', 'dd/MM/yyyy', 'MMM dd, yyyy', 'ddd, MMM dd'];
  var timeFormats = ['HH:mm', 'h:mm a'];
  
  if (statuses.length > 0) sh.getRange(3, 6, statuses.length, 1).setValues(statuses.map(function(s) { return [s]; }));
  if (types.length > 0) sh.getRange(3, 7, types.length, 1).setValues(types.map(function(t) { return [t]; }));
  if (xcClasses.length > 0) sh.getRange(3, 8, xcClasses.length, 1).setValues(xcClasses.map(function(t) { return [t]; }));
  if (dateFormats.length > 0) sh.getRange(3, 9, dateFormats.length, 1).setNumberFormat('@').setValues(dateFormats.map(function(t) { return [t]; }));
  if (timeFormats.length > 0) sh.getRange(3, 10, timeFormats.length, 1).setNumberFormat('@').setValues(timeFormats.map(function(t) { return [t]; }));
  
  sh.autoResizeColumns(1, 10);
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
  
  // Row 2: Link to Master Flight Log Folder (Cell A2)
  var masterLinkFormula = '=IF(ISBLANK(VLOOKUP("MASTER_LOG_FOLDER_ID", ' + TABS.PARAMETERS.name + '!A:B, 2, FALSE)), "Master Flight Logs folder (Not Configured)", HYPERLINK("https://drive.google.com/drive/folders/" & VLOOKUP("MASTER_LOG_FOLDER_ID", ' + TABS.PARAMETERS.name + '!A:B, 2, FALSE), "📁 Master Flight Logs folder"))';
  sh.getRange('A2').setFormula(masterLinkFormula).setFontSize(10).setFontStyle('italic');
  
  // Flatten Headers
  var groups = TABS.FLIGHTS.groups;
  var flatHeaders = [];
  groups.forEach(function(g) { flatHeaders = flatHeaders.concat(g.cols); });
  
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
}

/* ==========================================================================================
   VALIDATION & UPDATES
   ========================================================================================== */

function updateValidationOnly_() {
  var ss = SpreadsheetApp.getActive();
  var sh = ss.getSheetByName(TABS.FLIGHTS.name);
  if (sh) {
    applyFlightsValidation_(sh);
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
  
  ss.toast('Validation rules, Column Notes, Parameters, and User Guide updated.');
}

function applyFlightsValidation_(sh) {
  var ss = SpreadsheetApp.getActive();
  var map = getColumnMap_(sh);
  
  var startRow = TABS.FLIGHTS.dataStartRow;
  var endRow = TABS.FLIGHTS.dataEndRow; 
  var valRows = endRow - startRow + 1;
  if (valRows < 1) return;

  // Status
  // Status
  if (map['Status']) {
    var rule = SpreadsheetApp.newDataValidation().requireValueInList(['Review?', 'Valid', 'Invalid?', 'Duplicate'], true).setAllowInvalid(true).build();
    sh.getRange(startRow, map['Status'], valRows, 1).setDataValidation(rule);
    
    // Conditional Formatting
    var range = sh.getRange(startRow, map['Status'], valRows, 1);
    var rules = sh.getConditionalFormatRules();

    rules.push(SpreadsheetApp.newConditionalFormatRule().whenTextEqualTo('Review?').setBackground('#FFF9C4').setRanges([range]).build());
    rules.push(SpreadsheetApp.newConditionalFormatRule().whenTextEqualTo('Valid').setBackground('#C8E6C9').setRanges([range]).build());
    rules.push(SpreadsheetApp.newConditionalFormatRule().whenTextEqualTo('Invalid?').setBackground('#FFCDD2').setRanges([range]).build());
    rules.push(SpreadsheetApp.newConditionalFormatRule().whenTextEqualTo('Duplicate').setBackground('#FFCC80').setRanges([range]).build()); // Orange 200
    sh.setConditionalFormatRules(rules);
  }

  // Flight Type
  if (map['Flight Type']) {
      var shLook = ss.getSheetByName(TABS.LOOKUPS.name);

      var rule = SpreadsheetApp.newDataValidation().requireValueInRange(shLook.getRange('G3:G'), true).build();
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
  
  // XC Flight Class (New)
  if (map['XC Flight Class']) {
      var shLook = ss.getSheetByName(TABS.LOOKUPS.name);
      var rule = SpreadsheetApp.newDataValidation().requireValueInRange(shLook.getRange('H3:H'), true).build();
      sh.getRange(startRow, map['XC Flight Class'], valRows, 1).setDataValidation(rule);
  }
  
  // Closed? (Checkbox)
  if (map['Closed?']) {
     var rule = SpreadsheetApp.newDataValidation().requireValueInList(['Yes', 'No'], true).setAllowInvalid(true).build();
     sh.getRange(startRow, map['Closed?'], valRows, 1).setDataValidation(rule);
  }
  
  // Formatting: Wrap & Top Align ALL data cells
  var allData = sh.getRange(startRow, 1, valRows, sh.getLastColumn());
  allData.setWrapStrategy(SpreadsheetApp.WrapStrategy.WRAP);
  allData.setVerticalAlignment("top");
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
  
  // 3. Parameters
  var shP = ss.getSheetByName(TABS.PARAMETERS.name);
  if (shP) {
      shP.setTabColor(TABS.PARAMETERS.color);
      shP.getRange('A1:C1').setBackground(TABS.PARAMETERS.color);
      shP.getRange(2, 1, 1, 3).setBackground('#616161').setFontColor('white');
      // Re-run scaffold to fix row colors
      scaffoldParameters_(ss);
  }

  // 4. Dashboard
  scaffoldDashboard_(ss);

  ss.toast('Formatting Re-applied: Obsolete columns eliminated, Parameters updated, Dashboard refreshed, Flights frozen.');
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
    TABS.PARAMETERS.name,
    TABS.LOOKUPS.name
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
      TABS.PARAMETERS.name, 
      TABS.LOOKUPS.name, 
      TABS.APP_LOG.name, 
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
  
  // Preserve existing values if user already entered data
  var existingVals = {};
  if (sh.getLastRow() >= 4) {
    try {
      var raw = sh.getRange(4, 2, sh.getLastRow() - 3, 2).getValues();
      raw.forEach(function(r) {
        if (r[0]) existingVals[r[0]] = r[1];
      });
    } catch(e) { console.warn('Pilot Profile preservation error', e); }
  }

  sh.clear();
  ensureDimensions_(sh, 50, 4);

  // Header Title
  sh.getRange('A1').setValue("Pilot Profile & Credentials").setFontWeight('bold').setFontSize(16);
  sh.getRange('A1:D1').setBackground(TABS.PILOT_PROFILE.color).setFontColor('white').merge();
  sh.getRange('A1').setHorizontalAlignment('center').setVerticalAlignment('middle');
  sh.setRowHeight(1, 38);

  sh.getRange('A2').setValue("Personal credentials, licensing, emergency info, and live satellite tracking gear").setFontStyle('italic').setFontSize(10);
  sh.getRange('A2:D2').merge().setHorizontalAlignment('center');
  sh.setRowHeight(2, 22);

  // Column Headers Row 3
  sh.getRange(3, 1, 1, 4).setValues([['Category', 'Field', 'Value', 'Notes / Instructions']]);
  sh.getRange(3, 1, 1, 4).setBackground('#37474F').setFontColor('white').setFontWeight('bold');

  var profileFields = [
    // Section 1: Pilot Identity
    { cat: 'Identity', field: 'Full Name', val: '', note: 'Legal name as shown on official pilot license' },
    { cat: 'Identity', field: 'Callsign / Nickname', val: '', note: 'Radio callsign or competition display name' },
    { cat: 'Identity', field: 'Email', val: '', note: 'Primary contact email' },
    { cat: 'Identity', field: 'Phone Number', val: '', note: 'Mobile phone with international dialing code' },
    { cat: 'Identity', field: 'Home Country & Town', val: '', note: 'Home flying base location' },

    // Section 2: Ratings & Certifications
    { cat: 'Licensing', field: 'National Association', val: '', note: 'e.g. USHPA, BHPA, FFVL, DHV, HPAC, FAI' },
    { cat: 'Licensing', field: 'Pilot Rating', val: '', note: 'e.g. P2 (Novice), P3, P4 (Advanced), APPI 4' },
    { cat: 'Licensing', field: 'License Number', val: '', note: 'National association member / pilot license ID' },
    { cat: 'Licensing', field: 'FAI Sporting License #', val: '', note: 'Required for FAI Category 1 & 2 competitions' },
    { cat: 'Licensing', field: 'Tandem / Instructor', val: '', note: 'Tandem T1/T2, Instructor, or No' },
    { cat: 'Licensing', field: 'License Expiration Date', val: '', note: 'YYYY-MM-DD' },

    // Section 3: Clubs & Federations
    { cat: 'Affiliations', field: 'Primary Flying Club', val: '', note: 'Home club name' },
    { cat: 'Affiliations', field: 'Secondary Clubs', val: '', note: 'Regional or visiting club memberships' },
    { cat: 'Affiliations', field: 'National Federation Member #', val: '', note: 'Aero club or federation identifier' },

    // Section 4: Emergency, Medical & SAR
    { cat: 'Emergency / SAR', field: 'Primary Emergency Contact', val: '', note: 'Full Name and Relationship (e.g. Spouse, Parent)' },
    { cat: 'Emergency / SAR', field: 'Primary Contact Phone', val: '', note: 'Emergency mobile number with country code' },
    { cat: 'Emergency / SAR', field: 'Secondary Contact & Phone', val: '', note: 'Alternate emergency contact details' },
    { cat: 'Emergency / SAR', field: 'SAR / Evacuation Insurance', val: '', note: 'Provider (e.g. GEOS, Garmin SAR, Global Rescue, AAC)' },
    { cat: 'Emergency / SAR', field: 'Insurance Policy Number', val: '', note: 'Medical evacuation policy number' },
    { cat: 'Emergency / SAR', field: 'Blood Type', val: '', note: 'e.g. O+, A+, B+, etc.' },
    { cat: 'Emergency / SAR', field: 'Medical Conditions / Allergies', val: '', note: 'Critical details for first responders' },

    // Section 5: Live Tracking & Satellite Gear
    { cat: 'Tracking / Gear', field: 'Garmin inReach IMEI', val: '', note: 'Satellite messenger IMEI number' },
    { cat: 'Tracking / Gear', field: 'Garmin MapShare URL', val: '', note: 'https://share.garmin.com/username' },
    { cat: 'Tracking / Gear', field: 'Flymaster Live URL', val: '', note: 'Flymaster / Livetrack24 public link' },
    { cat: 'Tracking / Gear', field: 'XContest Live URL', val: '', note: 'XContest live tracking pilot link' },
    { cat: 'Tracking / Gear', field: 'Emergency Beacon Hex ID', val: '', note: '406 MHz PLB / ELT 15-character hex ID' },

    // Section 6: Notes & Progression
    { cat: 'Progression', field: 'Current Season XC Goals', val: '', note: 'Targets for season (distance, triangles, hours)' },
    { cat: 'Progression', field: 'SIV / Maneuver Notes', val: '', note: 'Stalls, spins, collapses, acro progression log' },
    { cat: 'Progression', field: 'General Flying Notes', val: '', note: 'Free-form reflections, wing trim checks, line check dates' }
  ];

  var rows = [];
  for (var i = 0; i < profileFields.length; i++) {
    var f = profileFields[i];
    var val = (existingVals[f.field] !== undefined && existingVals[f.field] !== '') ? existingVals[f.field] : f.val;
    rows.push([f.cat, f.field, val, f.note]);
  }

  sh.getRange(4, 1, rows.length, 4).setValues(rows);

  // Formatting rows
  var curCat = '';
  for (var r = 0; r < rows.length; r++) {
    var rowIdx = r + 4;
    var rowCat = rows[r][0];
    if (rowCat !== curCat) {
      sh.getRange(rowIdx, 1).setFontWeight('bold').setBackground('#ECEFF1');
      curCat = rowCat;
    }
    // Highlight editable value column
    sh.getRange(rowIdx, 3).setBackground('#FFFDE7').setBorder(true, true, true, true, true, true, '#BDBDBD', SpreadsheetApp.BorderStyle.SOLID);
    sh.getRange(rowIdx, 4).setFontSize(9).setFontColor('#616161');
  }

  sh.autoResizeColumns(1, 4);
  sh.setColumnWidth(2, 220);
  sh.setColumnWidth(3, 280);
  sh.setColumnWidth(4, 380);
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
  ensureDimensions_(sh, 120, 4);

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
  addRow('Google Sheets View', 'Primary User Interface', 'Organized logbook tabs: Dashboard, Flights, Pilot Profile, Equipment, User Guide, Parameters, Lookups, App_Log.', 'Familiar, accessible on desktop & mobile.');
  addRow('Google Apps Script', 'Automated Processing Engine', 'Orchestrates file parsing, physics & thermal analysis, XC scoring, geo-enrichment, and weather queries.', 'Zero server hosting costs, runs completely inside Google Cloud.');
  addRow('Master Flight Log', 'Permanent Cloud Archive', 'Automatically mirrors processed IGCs into MASTER_LOG_FOLDER_ID with standardized names and public links.', 'Direct 1-click downloads and 3D SeeYou Cloud visualization.');
  addRow('Watcher Triggers', 'Background Automation', 'Runs automated scans of designated Google Drive folders every 5 to 15 minutes to ingest new flights automatically.', 'Drop files into Drive and your logbook updates hands-free.');

  rIdx++;

  // Section 2: Setup & Folders
  addSection('2. Initial Configuration & Weather Setup', '#2E7D32');
  addRow('Setting / Folder', 'Key Parameter', 'Configuration Instructions', 'Default / Recommendation', true);
  addRow('Watch Folder', 'WATCH_FOLDER_ID', 'Google Drive folder where flight instruments or XC apps drop .igc / .zip files. Multiple folders supported via comma-separation.', 'Use Admin > Update Watch Folder... to select via in-app picker.');
  addRow('Master Log Folder', 'MASTER_LOG_FOLDER_ID', 'Google Drive folder holding permanent, clean flight log copies for public sharing and 3D viewer links.', 'Set via Admin > Update Master Log Folder... Share folder as Anyone with link.');
  addRow('Upload / Error Folders', 'UPLOAD_FOLDER_ID / ERROR_FOLDER_ID', 'Temporary staging folder for browser uploads, and quarantine folder for corrupt / unparseable files.', 'Set via Admin > Update Upload Folder... / Update Error Folder...');
  addRow('Weather Providers', 'WEATHER_PROVIDERS', 'Comma-separated order of weather services: "open_meteo, visual_crossing". Open-Meteo runs with zero API keys required.', 'open_meteo, visual_crossing');
  addRow('Visual Crossing Key', 'VISUAL_CROSSING_API_KEY', 'Optional API key for Visual Crossing backup (1,000 free calls/day). Sign up at visualcrossing.com.', 'Leave blank to use free Open-Meteo exclusively.');
  addRow('Contact Email', 'CONTACT_EMAIL', 'Your email address used in User-Agent headers for open Nominatim / Open-Meteo / Overpass API requests.', 'Required to prevent HTTP 403 API blocking.');
  addRow('XContest Username', 'XCONTEST_USERNAME', 'Your public XContest pilot username (e.g. "rohitash"). Required for automated XContest flight verification, permanent ID linking, and claim window alerts.', 'Set your username in Parameters');

  rIdx++;

  // Section 3: Daily Logging Workflows
  addSection('3. Day-to-Day Flight Logging Workflows', '#1565C0');
  addRow('Workflow Method', 'Menu / Action', 'Step-by-Step Instructions', 'Best For', true);
  addRow('Automated Watcher', 'Flight Log > Add Flight > Scan Watch Folder Now', 'Drop files into your Drive folder. Trigger will process automatically every 5 mins, or click Scan Now for immediate import.', 'Day-to-day automated syncing from Syride, Oudie, Flymaster, or Google Drive mobile.');
  addRow('Drive / URL Import', 'Flight Log > Add Flight > Add files from URL...', 'Option A: Paste any Google Drive folder/file URL or public IGC link. Option B: Browse Drive folders directly with optional source deletion.', 'Bulk importing historical logs or shared club folders.');
  addRow('Browser Upload', 'Flight Log > Add Flight > Add flight from Upload...', 'Drag and drop single or multiple .igc, .zip, or .gz files directly from your computer into the modal window.', 'Quick manual imports from desktop downloads.');
  addRow('Manual Blank Row', 'Flight Log > Add Flight > Add manual flight', 'Inserts a clean, pre-formatted flight row with sticky equipment defaults for flights without GPS track logs.', 'Tandem flights, dune soaring, or flights where instrument was off.');
  addRow('Flight Inspector', 'Flight Log > Flight Inspector', 'Highlight any flight row and open the sidebar to review detailed thermal analysis, mode breakdowns, and edit notes.', 'In-depth post-flight analysis.');

  rIdx++;

  // Section 4: Flight Maintenance
  addSection('4. Flight Maintenance & Bulk Operations', '#D84315');
  addRow('Operation', 'Tool / Menu', 'Behavior & Execution Details', 'When to Use', true);
  addRow('Unified Maintenance', 'Flight Log > Flight maintenance > Flight Maintenance...', 'Configurable modal dialog: choose between Selected Rows vs All Flights, and check operations to batch process.', 'Periodic log maintenance, bulk backfilling, or score recalculation.');
  addRow('Weather Backfill', 'Maintenance Dialog Checkbox', 'Fetches historical launch/landing wind, cloudbase, cloud %, temperature, and conditions via Open-Meteo & Visual Crossing.', 'Enriching older flights or flights imported while offline.');
  addRow('Geo & Site Backfill', 'Maintenance Dialog Checkbox', 'Reverse geocodes Lat/Lon coordinates into Town, Region, Country and matches nearest takeoff/landing site names.', 'Populating missing location names.');
  addRow('XContest Verification', 'Maintenance Dialog Checkbox', 'Directly probes XContest.org via UTC date/time (+/- 2 min) to verify if flight is published, links flight with permanent ID (e.g. XC#6952654), or flags claim deadline (Claim soon! if <= 14 days, Expired if > 14 days).', 'Updating XContest league claim status.');
  addRow('Physics & XC Recompute', 'Maintenance Dialog Checkbox', 'Reads master IGC from Drive; re-runs thermal circling, soaring efficiency, glide L/D, and optimal FAI triangle scoring.', 'When scoring rules or thermal detection thresholds are updated.');
  addRow('Date Sorting', 'Flight Log > Flight maintenance > Sort All Flights by Date', 'Chronologically sorts logbook descending (newest on top) and re-indexes sequential Flight Numbers.', 'After importing out-of-order historical flights.');

  rIdx++;

  // Section 5: Metric Dictionary
  addSection('5. Comprehensive Metric Dictionary', '#455A64');
  addRow('Category', 'Metric / Column', 'Calculation / Formula', 'Description & Interpretation', true);
  
  // Flight Info
  addRow('Flight Info', 'FlightID', 'F{YYYYMMDD}_{DailySeq}', 'Unique flight identifier linking directly to 3D SeeYou Cloud track visualization.');
  addRow('Flight Info', 'Flight No', '=IFERROR(MAX(INDIRECT("C" & (ROW()+1) & ":C")), 0) + 1', 'Sequential flight counter from first flight to present. Automatically adjusts on sort.');
  addRow('Flight Info', 'Auto Summary', 'Duration + Flight Type + Site + Max Alt', 'Concise human-readable flight summary (e.g. "2h 15m XC at Bir Billing 3100m").');
  addRow('Flight Info', 'Duration', 'Landing Time - Launch Time', 'Total flight duration in h:mm format.');
  addRow('Flight Info', 'Track Length (km)', 'Sum of Haversine fix intervals', 'Cumulative distance flown through the air along the GPS track.');
  addRow('Flight Info', 'Straight Dist (km)', 'Haversine(Launch, Landing)', 'Direct straight-line distance from launch to landing.');

  // Gear
  addRow('Gear Tracking', 'Wing / Harness / Reserves', 'Inherited from previous flight or Equipment defaults', 'Equipment logged for flight. Equipment tab manages fleet hours and specs.');


  // XC Scoring
  addRow('XC Scoring', 'XC Distance (km)', 'Optimal 3 Turnpoints via Ramer-Douglas-Peucker', 'Optimized cross-country distance under league scoring rules.');
  addRow('XC Scoring', 'XC Score', 'Distance * Multiplier (1.0x Free, 1.2x Flat, 1.4x FAI)', 'Official cross-country competition score points.');
  addRow('XC Scoring', 'XC Flight Class', 'Free Flight, Flat Triangle, or FAI Triangle', 'Geometric classification of the track.');
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

  // Validation
  addRow('Validation', 'Validation Status', 'Valid, Needs Review, or Invalid', 'Automated heuristics check (e.g. driving, kiting, short flights).');
  addRow('Validation', 'Val: Reason', 'Specific heuristic rule violation message', 'Details for flights flagged for review.');

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
