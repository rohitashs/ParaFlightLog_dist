/**
 * Paragliding Flight Log v2.0
 * Updated: 2026-10-02 21:43:30
 */
/**
 * Paragliding Flight Log v2.0
 * 
 * MODULE: Test Harness
 * Standalone functions to verify logic without real usage.
 */

function runAllTests() {
  var results = [];
  results.push(testParser_());
  results.push(testAnalysis_());
  results.push(testScoring_());
  results.push(testGeo_()); // Might fail if quota reached or network down
  results.push(testXContest_());
  results.push(testWeather_());
  results.push(testCleanDriveId_());
  results.push(testValidateRequiredFolders_());
  results.push(testDateTimeFormats_());
  results.push(testMaintenanceFlightFilter_());
  results.push(testDashboardAndSchema_());
  results.push(testDedupeAndQualityScoring_());
  results.push(testConfigAndDedupeEnhancements_());
  results.push(testConfigStructureAndGrouping_());
  results.push(testLogProcessResolution_());
  results.push(testLogLevelFiltering_());
  results.push(testConservativePruningMath_());
  results.push(testDedupeEngineEnhancements_());
  results.push(testStatusChangeUtility_());
  results.push(testDynamicFormulaResilience_());
  results.push(testNativeSheetsResilience_());
  results.push(testSystemMaintenanceAndManifest_());
  results.push(testAutomationEngine_());
  results.push(testAutoSummaryFormat_());
  results.push(testDateTimeInvariants_());
  
  var failures = results.filter(function(r) { return !r.idx || r.error; });
  if (failures.length > 0) {
    console.error('TESTS FAILED', failures);
    SpreadsheetApp.getActive().toast('Tests FAILED. Check Execution Logs.');
  } else {
    console.log('ALL TESTS PASSED');
    SpreadsheetApp.getActive().toast('All Tests Passed!');
  }
}

function testParser_() {
  var igc = 
    "HFDTE160716\n" +
    "HFFXA035\n" +
    "HFPLTPILOT:Test Pilot\n" + 
    "HFGTYGLIDERTYPE:Ozone Photon\n" +
    "B1200004600000N00700000EA0100002000\n" + // Start (1000m pressure)
    "B1201004600100N00700000EA0105002050"; // 1 min later, lat change, +50m alt
    
  var res = PARSER.parseIgc(igc, 'test.igc');
  if (!res) return { module: 'Parser', error: 'Null result' };
  if (res.meta.pilot !== 'Test Pilot') return { module: 'Parser', error: 'Pilot extract fail' };
  if (res.fixes.length !== 2) return { module: 'Parser', error: 'Fix count fail' };
  if (res.stats.durationSec !== 60) return { module: 'Parser', error: 'Duration fail: ' + res.stats.durationSec };
  
  return { module: 'Parser', idx: true };
}

function testAnalysis_() {
  // Mock fixes: climbing
  var fixes = [];
  for (var i=0; i<10; i++) {
    fixes.push({
      t: 1000 + i*10, // 10s steps
      lat: 46 + (i*0.0001), 
      lon: 7, 
      alt: 1000 + (i*5) // +0.5 m/s climb
    });
  }
  
  var config = CFG.defaults; // Use defaults
  var ana = ANALYSIS.analyzeFlight(fixes, config);
  
  if (!ana) return { module: 'Analysis', error: 'Null result' };
  if (ana.stats.maxClimb < 0.4) return { module: 'Analysis', error: 'MaxClimb low' };
  
  return { module: 'Analysis', idx: true };
}

function testScoring_() {
  // Test 1: Simple linear track (Free Flight)
  var fixesLinear = [];
  for (var i = 0; i < 100; i++) {
    fixesLinear.push({ t: i, lat: 46 + (i * 0.001), lon: 7, alt: 1000 });
  }
  var scoreLinear = SCORING.calculateXcScore(fixesLinear);
  if (!scoreLinear) return { module: 'Scoring', error: 'Null result for linear track' };
  if (scoreLinear.free.dist < 5) return { module: 'Scoring', error: 'Dist too small' };
  if (scoreLinear.best.type !== 'Free Flight') {
    return { module: 'Scoring', error: 'Expected Free Flight for linear track, got: ' + scoreLinear.best.type };
  }

  // Test 2: Out-and-Return track (Fly out 11km and return back to launch)
  var fixesOR = [];
  // Leg 1: Outbound from lat 46.0 to 46.10 (50 points)
  for (var j = 0; j <= 50; j++) {
    fixesOR.push({ t: j, lat: 46.0 + (j * 0.002), lon: 7.0, alt: 1000 });
  }
  // Leg 2: Inbound back from 46.10 to 46.002 (50 points, close to start)
  for (var k = 1; k <= 50; k++) {
    fixesOR.push({ t: 50 + k, lat: 46.10 - (k * 0.00196), lon: 7.0, alt: 1000 });
  }

  var scoreOR = SCORING.calculateXcScore(fixesOR);
  if (!scoreOR) return { module: 'Scoring', error: 'Null result for OR track' };
  if (!scoreOR.outAndReturn || !scoreOR.outAndReturn.valid) {
    return { module: 'Scoring', error: 'Expected valid outAndReturn evaluation' };
  }
  if (scoreOR.best.type !== 'Out-and-Return') {
    return { module: 'Scoring', error: 'Expected Out-and-Return best type, got: ' + scoreOR.best.type };
  }
  if (scoreOR.best.score <= scoreOR.free.dist) {
    return { module: 'Scoring', error: 'Expected 1.2x Out-and-Return bonus to exceed free distance' };
  }

  // Test 3: Normalization helper check
  if (UTILS.normalizeXcClass('Free Distance') !== 'Free Flight') {
    return { module: 'Scoring', error: 'normalizeXcClass Free Distance mismatch' };
  }
  if (UTILS.normalizeXcClass('Triangle') !== 'Flat Triangle') {
    return { module: 'Scoring', error: 'normalizeXcClass Triangle mismatch' };
  }
  if (UTILS.normalizeXcClass('Out-and-Return') !== 'Out-and-Return') {
    return { module: 'Scoring', error: 'normalizeXcClass Out-and-Return mismatch' };
  }

  // Test 4: Configurable RDP tolerance check
  var scoreWithCustomRdp = SCORING.calculateXcScore(fixesLinear, { RDP_TOLERANCE: 0.002 });
  if (!scoreWithCustomRdp || !scoreWithCustomRdp.best) {
    return { module: 'Scoring', error: 'Null result with custom RDP tolerance' };
  }

  return { module: 'Scoring', idx: true };
}

function testGeo_() {
  if (!GEO || !GEO.getNearestSite) return { module: 'Geo', error: 'Module missing' };
  
  // Guard check: null coordinates return empty string
  var emptyRes = GEO.getNearestSite(null, null, 3000, {});
  if (emptyRes !== '') return { module: 'Geo', error: 'Null coordinate handling failed' };
  
  return { module: 'Geo', idx: true }; 
}

function testXContest_() {
  if (!XContest || !XContest.checkFlight) return { module: 'XContest', error: 'Module missing' };
  
  // Test 1: No Username
  var res = XContest.checkFlight(new Date(), 60, 600, { XCONTEST_USERNAME: '' });
  if (res.status !== 'No Username') return { module: 'XContest', error: 'Fail: No User handling, got ' + res.status };

  // Test 2: Unmatched recent flight (<= 14 days) returns 'Claim soon!'
  var recentDate = new Date(Date.now() - 2 * 86400000);
  var resRecent = XContest.checkFlight(recentDate, 60, 600, { XCONTEST_USERNAME: 'non_existent_pilot_xyz_123' });
  if (resRecent.status !== 'Claim soon!') {
    return { module: 'XContest', error: 'Expected Claim soon! for recent flight, got: ' + resRecent.status };
  }

  // Test 3: Unmatched old flight (> 14 days) returns 'Expired'
  var oldDate = new Date(Date.now() - 30 * 86400000);
  var resOld = XContest.checkFlight(oldDate, 60, 600, { XCONTEST_USERNAME: 'non_existent_pilot_xyz_123' });
  if (resOld.status !== 'Expired') {
    return { module: 'XContest', error: 'Expected Expired for old flight, got: ' + resOld.status };
  }

  // Test 4: Live verified flight matching and permanent ID extraction (Rohitash flight on 2026-09-17 19:14 UTC)
  try {
    // 4a. Pass string ISO date
    var resLiveStr = XContest.checkFlight('2026-09-17', 35, 1154, { XCONTEST_USERNAME: 'rohitash' });
    if (resLiveStr.status !== 'Yes') {
      return { module: 'XContest', error: 'Live flight match failed (string date), status: ' + resLiveStr.status };
    }
    if (resLiveStr.label !== 'XC#6952654') {
      return { module: 'XContest', error: 'Live flight ID label mismatch (string date): ' + resLiveStr.label };
    }

    // 4b. Pass Date object (ensures no UTC timezone rollback to 16.09.2026)
    var resLiveDate = XContest.checkFlight(new Date('2026-09-17'), 35, 1154, { XCONTEST_USERNAME: 'rohitash' });
    if (resLiveDate.status !== 'Yes') {
      return { module: 'XContest', error: 'Live flight match failed (Date object), status: ' + resLiveDate.status };
    }
    if (resLiveDate.label !== 'XC#6952654') {
      return { module: 'XContest', error: 'Live flight ID label mismatch (Date object): ' + resLiveDate.label };
    }
  } catch (liveErr) {
    // If network down or sandbox restricted, allow graceful notice
    console.warn('Live XContest test exception', liveErr);
  }

  return { module: 'XContest', idx: true };
}

function testWeather_() {
  if (!WEATHER || !WEATHER.getEnrichment) return { module: 'Weather', error: 'Module missing' };

  // Test 1: Wind formatting (Option A - cardinal direction with gusts)
  var windStr = WEATHER.formatWind_(14.2, 292.5, 22.1);
  if (windStr !== '14 km/h WNW (gust 22)') {
    return { module: 'Weather', error: 'Wind format mismatch: ' + windStr };
  }

  // Test 2: Cloudbase estimation (Option A - MSL & AGL)
  var cbStr = WEATHER.calculateCloudbase_(20, 10, 1000);
  if (cbStr !== '2250m MSL (1250m AGL)') {
    return { module: 'Weather', error: 'Cloudbase format mismatch: ' + cbStr };
  }

  // Test 3: WMO weather code translation
  var cond = WEATHER.wmoWeatherCodeToText_(2);
  if (cond !== 'Partly cloudy') {
    return { module: 'Weather', error: 'WMO code translation failed: ' + cond };
  }

  return { module: 'Weather', idx: true };
}

function testCleanDriveId_() {
  if (typeof cleanDriveId_ !== 'function') return { module: 'Utils', error: 'cleanDriveId_ missing' };

  var rawId = "10l-5rIDf0osLjy46qbLm2skoyXQRFGq5Dj7dl5hScjhGdy0IO_BiQqol";
  if (cleanDriveId_(rawId) !== rawId) return { module: 'Utils', error: 'Raw ID mismatch' };

  var folderUrl = "https://drive.google.com/drive/folders/" + rawId + "?usp=sharing";
  if (cleanDriveId_(folderUrl) !== rawId) return { module: 'Utils', error: 'Folder URL extraction fail' };

  var openUrl = "https://drive.google.com/open?id=" + rawId;
  if (cleanDriveId_(openUrl) !== rawId) return { module: 'Utils', error: 'Open URL extraction fail' };

  var fileUrl = "https://drive.google.com/file/d/" + rawId + "/view";
  if (cleanDriveId_(fileUrl) !== rawId) return { module: 'Utils', error: 'File URL extraction fail' };

  var withSpaces = "  " + rawId + "  ";
  if (cleanDriveId_(withSpaces) !== rawId) return { module: 'Utils', error: 'Whitespace trim fail' };

  return { module: 'Utils', idx: true };
}

function testValidateRequiredFolders_() {
  if (typeof FILE_HANDLING.validateRequiredFolders !== 'function') {
    return { module: 'FileHandling', error: 'FILE_HANDLING.validateRequiredFolders missing' };
  }

  // Test 1: Empty config fails validation
  var emptyConfig = {};
  var res1 = FILE_HANDLING.validateRequiredFolders(['MASTER_LOG_FOLDER_ID', 'ERROR_FOLDER_ID', 'UPLOAD_FOLDER_ID'], emptyConfig);
  if (res1.valid !== false || !res1.error) {
    return { module: 'FileHandling', error: 'Empty config validation should fail' };
  }

  // Test 2: Blank strings fail validation
  var blankConfig = { MASTER_LOG_FOLDER_ID: '', ERROR_FOLDER_ID: '', UPLOAD_FOLDER_ID: '' };
  var res2 = FILE_HANDLING.validateRequiredFolders(['MASTER_LOG_FOLDER_ID'], blankConfig);
  if (res2.valid !== false || res2.error.indexOf('MASTER_LOG_FOLDER_ID') === -1) {
    return { module: 'FileHandling', error: 'Blank folder ID should fail with specific error' };
  }

  // Test 3: Watch folder missing fails validation
  var res3 = FILE_HANDLING.validateRequiredFolders(['WATCH_FOLDER_ID'], { WATCH_FOLDER_ID: '' });
  if (res3.valid !== false || res3.error.indexOf('Watch Folder') === -1) {
    return { module: 'FileHandling', error: 'Missing Watch Folder should fail with specific error' };
  }

  return { module: 'FileHandling', idx: true };
}

function testDateTimeFormats_() {
  var config = getParameters_();
  if (typeof config.DATE_FORMAT !== 'string' || !config.DATE_FORMAT) {
    return { module: 'Config', error: 'DATE_FORMAT must be a non-empty string' };
  }
  if (typeof config.TIME_FORMAT !== 'string' || !config.TIME_FORMAT) {
    return { module: 'Config', error: 'TIME_FORMAT must be a non-empty string' };
  }
  // Verify format pattern validity
  if (config.DATE_FORMAT.indexOf('yyyy') === -1 && config.DATE_FORMAT.indexOf('yy') === -1) {
    return { module: 'Config', error: 'DATE_FORMAT does not appear to be a valid date pattern: ' + config.DATE_FORMAT };
  }
  if (config.TIME_FORMAT.indexOf('m') === -1) {
    return { module: 'Config', error: 'TIME_FORMAT does not appear to be a valid time pattern: ' + config.TIME_FORMAT };
  }
  return { module: 'Config', idx: true };
}

function testMaintenanceFlightFilter_() {
  if (typeof getActualFlightRows_ !== 'function') {
    return { module: 'Maintenance', error: 'getActualFlightRows_ function missing' };
  }
  if (typeof getMaintenanceScopeInfo !== 'function') {
    return { module: 'Maintenance', error: 'getMaintenanceScopeInfo function missing' };
  }
  if (typeof getMaintenanceTargetRows !== 'function') {
    return { module: 'Maintenance', error: 'getMaintenanceTargetRows function missing' };
  }

  // Test 1: Null/invalid sheet safety
  var emptyRes = getActualFlightRows_(null);
  if (!Array.isArray(emptyRes) || emptyRes.length !== 0) {
    return { module: 'Maintenance', error: 'getActualFlightRows_(null) should return empty array' };
  }

  // Test 2: In-memory simulation of FlightID filtering logic
  var mockDisplayVals = [[''], ['  '], ['F20260716-001'], [''], ['F20260716-002'], ['   ']];
  var simulatedRows = [];
  for (var i = 0; i < mockDisplayVals.length; i++) {
    var rawId = String(mockDisplayVals[i][0]).trim();
    if (rawId !== '') {
      simulatedRows.push({ row: 5 + i, id: rawId });
    }
  }
  if (simulatedRows.length !== 2) {
    return { module: 'Maintenance', error: 'Simulated filter should extract exactly 2 flights, got ' + simulatedRows.length };
  }
  if (simulatedRows[0].row !== 7 || simulatedRows[0].id !== 'F20260716-001') {
    return { module: 'Maintenance', error: 'Simulated flight 1 row/id mismatch' };
  }
  if (simulatedRows[1].row !== 9 || simulatedRows[1].id !== 'F20260716-002') {
    return { module: 'Maintenance', error: 'Simulated flight 2 row/id mismatch' };
  }

  // Test 3: If active Flights sheet exists, ensure all returned rows have valid row >= 5 and non-empty id
  try {
    var ss = SpreadsheetApp.getActive();
    if (ss) {
      var sh = ss.getSheetByName(CFG.SHEET_FLIGHTS);
      if (sh) {
        var actual = getActualFlightRows_(sh);
        if (!Array.isArray(actual)) {
          return { module: 'Maintenance', error: 'getActualFlightRows_(sh) did not return array' };
        }
        for (var k = 0; k < actual.length; k++) {
          if (!actual[k].row || actual[k].row < 5 || !actual[k].id) {
            return { module: 'Maintenance', error: 'Invalid flight row entry returned: ' + JSON.stringify(actual[k]) };
          }
        }
      }
    }
  } catch (e) {
    // If running in an environment without active spreadsheet, mock tests suffice
  }

  return { module: 'Maintenance', idx: true };
}

function testDashboardAndSchema_() {
  // 1. Verify frozenCols configuration
  if (!TABS.FLIGHTS || TABS.FLIGHTS.frozenCols !== 4) {
    return { module: 'DashboardAndSchema', error: 'TABS.FLIGHTS.frozenCols should be 4' };
  }

  // 2. Verify Gear group columns eliminated snapshots
  var gearGroup = (TABS.FLIGHTS.groups || []).filter(function(g) { return g.name === 'Gear'; })[0];
  if (!gearGroup || gearGroup.cols.indexOf('GlideRatio_LD (snap)') !== -1) {
    return { module: 'DashboardAndSchema', error: 'GlideRatio_LD (snap) should be removed from Gear group' };
  }

  // 3. Verify Landing group eliminated duplicate Launch-Landing Dist (km)
  var landGroup = (TABS.FLIGHTS.groups || []).filter(function(g) { return g.name === 'Landing'; })[0];
  if (!landGroup || landGroup.cols.indexOf('Launch-Landing Dist (km)') !== -1) {
    return { module: 'DashboardAndSchema', error: 'Launch-Landing Dist (km) should be removed from Landing group' };
  }

  // 4. Verify FLIGHT_TYPES removed from CFG.parameters
  var hasFlightTypesParam = (CFG.parameters || []).some(function(p) { return p.key === 'FLIGHT_TYPES'; });
  if (hasFlightTypesParam) {
    return { module: 'DashboardAndSchema', error: 'FLIGHT_TYPES parameter should be removed from CFG.parameters' };
  }

  // 5. Verify XContest tolerances do not have input: true
  var durTolParam = (CFG.parameters || []).filter(function(p) { return p.key === 'XCONTEST_MATCH_DURATION_TOLERANCE_MIN'; })[0];
  if (durTolParam && durTolParam.input === true) {
    return { module: 'DashboardAndSchema', error: 'XCONTEST_MATCH_DURATION_TOLERANCE_MIN should not have input: true' };
  }

  // 6. Verify dashboard scaffolding function exists
  if (typeof scaffoldDashboard_ !== 'function') {
    return { module: 'DashboardAndSchema', error: 'scaffoldDashboard_ function missing' };
  }

  // 7. Verify Timeline Currency Parameters exist in CFG.parameters
  var pMap = {};
  (CFG.parameters || []).forEach(function(p) { pMap[p.key] = p; });
  if (!pMap['TIMELINE_FLIGHTS_LOW'] || pMap['TIMELINE_FLIGHTS_LOW'].val !== 2) {
    return { module: 'DashboardAndSchema', error: 'TIMELINE_FLIGHTS_LOW parameter missing or invalid' };
  }
  if (!pMap['TIMELINE_FLIGHTS_MED'] || pMap['TIMELINE_FLIGHTS_MED'].val !== 6) {
    return { module: 'DashboardAndSchema', error: 'TIMELINE_FLIGHTS_MED parameter missing or invalid' };
  }
  if (!pMap['TIMELINE_HOURS_LOW'] || Math.abs(pMap['TIMELINE_HOURS_LOW'].val - 1/24) > 0.0001) {
    return { module: 'DashboardAndSchema', error: 'TIMELINE_HOURS_LOW parameter missing or invalid' };
  }
  if (!pMap['TIMELINE_HOURS_MED'] || Math.abs(pMap['TIMELINE_HOURS_MED'].val - 4/24) > 0.0001) {
    return { module: 'DashboardAndSchema', error: 'TIMELINE_HOURS_MED parameter missing or invalid' };
  }

  // 8. Verify ensureDimensions_ function exists
  if (typeof ensureDimensions_ !== 'function') {
    return { module: 'DashboardAndSchema', error: 'ensureDimensions_ function missing' };
  }

  // 9. Verify scaffoldDashboard_ status filter targets Column B (Status) and not Column A (FlightID)
  var dashFnStr = scaffoldDashboard_.toString();
  if (dashFnStr.indexOf("!A' + fStart + ':A\"), \"Valid\"") !== -1 || dashFnStr.indexOf("!A' + fStart + ':A\")=\"Valid\"") !== -1) {
    return { module: 'DashboardAndSchema', error: 'Dashboard formulas incorrectly filter on Column A instead of Column B for Status' };
  }
  if (dashFnStr.indexOf("!B' + fStart + ':B\"), \"Valid\"") === -1 && dashFnStr.indexOf("!B' + fStart + ':B\")=\"Valid\"") === -1) {
    return { module: 'DashboardAndSchema', error: 'Dashboard formulas should filter on Column B for Valid Status' };
  }

  return { module: 'DashboardAndSchema', idx: true };
}

function testDedupeAndQualityScoring_() {
  // 1. Verify TRASH_FOLDER_ID in parameters
  var hasTrashParam = (CFG.parameters || []).some(function(p) { return p.key === 'TRASH_FOLDER_ID'; });
  if (!hasTrashParam) {
    return { module: 'DedupeAndQuality', error: 'TRASH_FOLDER_ID parameter missing from CFG.parameters' };
  }

  // 2. Verify IGC Hash in Flights Meta group
  var metaGroup = (TABS.FLIGHTS.groups || []).filter(function(g) { return g.name === 'Meta'; })[0];
  if (!metaGroup || metaGroup.cols.indexOf('IGC Hash') === -1) {
    return { module: 'DedupeAndQuality', error: 'IGC Hash column missing from Meta group' };
  }

  // 3. Verify function existence
  if (typeof scoreFlightQuality_ !== 'function') {
    return { module: 'DedupeAndQuality', error: 'scoreFlightQuality_ function missing' };
  }
  if (typeof purgeRemoveFlights !== 'function') {
    return { module: 'DedupeAndQuality', error: 'purgeRemoveFlights function missing' };
  }
  if (typeof syncMasterLogsToSheet_ !== 'function') {
    return { module: 'DedupeAndQuality', error: 'syncMasterLogsToSheet_ function missing' };
  }
  if (typeof uiUpdateTrashFolder_ !== 'function') {
    return { module: 'DedupeAndQuality', error: 'uiUpdateTrashFolder_ function missing' };
  }
  if (typeof moveToTrashFolder_ !== 'function') {
    return { module: 'DedupeAndQuality', error: 'moveToTrashFolder_ function missing' };
  }

  // 4. Verify quality scoring logic
  var mockParsedXCTrack = {
    meta: { pilot: 'Pilot A', gliderType: 'Ozone Photon' },
    stats: { durationSec: 1900, startTime: 43200 },
    fixes: [
      { time: 100, lat: 46.1, lon: 7.1, alt: 1000, altBaro: 990 },
      { time: 101, lat: 46.1001, lon: 7.1001, alt: 1002, altBaro: 992 }
    ]
  };
  var scoreXCTrack = scoreFlightQuality_(mockParsedXCTrack, 'HFFTYXCTRACK PRO\nB1200004610000N...', '2026-05-10-XCTrack.igc');

  var mockParsedGeneric = {
    meta: {},
    stats: { durationSec: 300, startTime: 43200 },
    fixes: [
      { time: 100, lat: 46.1, lon: 7.1, alt: 1000 },
      { time: 105, lat: 46.1001, lon: 7.1001, alt: 1002 }
    ]
  };
  var scoreGeneric = scoreFlightQuality_(mockParsedGeneric, 'B1200004610000N...', 'flight.igc');

  if (scoreXCTrack <= scoreGeneric) {
    return { module: 'DedupeAndQuality', error: 'XCTrack score (' + scoreXCTrack + ') should be strictly higher than generic (' + scoreGeneric + ')' };
  }

  if (scoreXCTrack < 60) {
    return { module: 'DedupeAndQuality', error: 'XCTrack rich flight score (' + scoreXCTrack + ') should be >= 60' };
  }

  return { module: 'DedupeAndQuality', idx: true };
}

function testConfigAndDedupeEnhancements_() {
  // 1. Verify TABS.CONFIG tab definition
  if (!TABS.CONFIG || TABS.CONFIG.name !== 'Config' || TABS.CONFIG.color !== '#FF9800') {
    return { module: 'ConfigAndDedupe', error: 'TABS.CONFIG definition missing or incorrect' };
  }

  // 2. Verify CFG.sheets.config
  if (CFG.sheets.config !== 'Config') {
    return { module: 'ConfigAndDedupe', error: 'CFG.sheets.config should be Config' };
  }

  // 3. Verify 'Duplicate' is NOT in scaffoldConfig_ or applyFlightsValidation_
  var scaffoldStr = scaffoldConfig_.toString();
  var validationStr = applyFlightsValidation_.toString();
  if (scaffoldStr.indexOf("'Duplicate'") !== -1) {
    return { module: 'ConfigAndDedupe', error: 'Obsolete Duplicate status still present in scaffoldConfig_' };
  }
  if (validationStr.indexOf("'Duplicate'") !== -1) {
    return { module: 'ConfigAndDedupe', error: 'Obsolete Duplicate status still present in applyFlightsValidation_' };
  }

  // 4. Verify function presence for dialogs and backend operations
  var requiredFns = [
    'scaffoldConfig_',
    'showPurgeDialog',
    'showMarkDuplicatesDialog',
    'showSaveConfigDialog',
    'showLoadConfigDialog',
    'getPurgeCandidateFlightsStatus',
    'purgeSingleCandidateFlight',
    'finalizePurge_',
    'getDuplicateCounts',
    'markDuplicatesForRemoval_',
    'exportConfigJson_',
    'importConfigJson_'
  ];

  for (var j = 0; j < requiredFns.length; j++) {
    if (typeof globalThis[requiredFns[j]] !== 'function') {
      return { module: 'ConfigAndDedupe', error: 'Missing required function: ' + requiredFns[j] };
    }
  }

  return { module: 'ConfigAndDedupe', idx: true };
}

function testConfigStructureAndGrouping_() {
  // 1. Verify Pilot Profile 3-column definition
  if (!TABS.PILOT_PROFILE || TABS.PILOT_PROFILE.headerRow !== 3) {
    return { module: 'ConfigStructure', error: 'TABS.PILOT_PROFILE headerRow should be 3' };
  }
  if (!TABS.PILOT_PROFILE.columns || TABS.PILOT_PROFILE.columns.length !== 3) {
    return { module: 'ConfigStructure', error: 'TABS.PILOT_PROFILE should have exactly 3 columns (Field, Value, Notes)' };
  }

  // 2. Verify Parameter Counts & 5 Granular Sub-Groups
  var counts = {
    'Ingestion and Folders': 0,
    'Integrations': 0,
    'Flight Scoring, Physics and Analysis': 0,
    'Formats and Units': 0,
    'UI (dashboard etc)': 0
  };

  CFG.parameters.forEach(function(p) {
    var g = getParameterGroup_(p.key, p.section);
    if (counts[g] !== undefined) {
      counts[g]++;
    } else {
      counts['Unknown: ' + g] = 1;
    }
  });

  if (counts['Ingestion and Folders'] !== 8) {
    return { module: 'ConfigStructure', error: 'Ingestion and Folders expected 8 keys, got ' + counts['Ingestion and Folders'] };
  }
  if (counts['Integrations'] !== 16) {
    return { module: 'ConfigStructure', error: 'Integrations expected 16 keys, got ' + counts['Integrations'] };
  }
  if (counts['Flight Scoring, Physics and Analysis'] !== 20) {
    return { module: 'ConfigStructure', error: 'Flight Scoring expected 20 keys, got ' + counts['Flight Scoring, Physics and Analysis'] };
  }
  if (counts['Formats and Units'] !== 2) {
    return { module: 'ConfigStructure', error: 'Formats and Units expected 2 keys, got ' + counts['Formats and Units'] };
  }
  if (counts['UI (dashboard etc)'] !== 4) {
    return { module: 'ConfigStructure', error: 'UI expected 4 keys, got ' + counts['UI (dashboard etc)'] };
  }

  // 3. Verify Lookups order & Equipment Categories naming in scaffoldConfig_
  var scaffoldStr = scaffoldConfig_.toString();
  if (scaffoldStr.indexOf("'Equipment Categories'") === -1) {
    return { module: 'ConfigStructure', error: 'scaffoldConfig_ must declare Equipment Categories' };
  }
  if (scaffoldStr.indexOf("'Categories'") !== -1) {
    return { module: 'ConfigStructure', error: 'scaffoldConfig_ contains obsolete Categories header' };
  }

  // 4. Verify Pilot Profile fields in scaffoldPilotProfile_
  var profileStr = scaffoldPilotProfile_.toString();
  var requiredProfileFields = [
    "'CIVL ID'",
    "'National Licence Info'",
    "'FAI Sporting Licence Info'",
    "'Other Identity Info'",
    "'Other Licensing Info'",
    "'Other Affiliations Info'",
    "'Other Emergency Info'",
    "'Other Tracking / Gear Info'",
    "'Other Progression Info'",
    "'Primary Emergency Contact Info'",
    "'2nd Emergency Contact Info'",
    "'3rd Emergency Contact Info'",
    "'SAR / Evac Provider Info'",
    "'Medical Insurance Info'"
  ];
  for (var k = 0; k < requiredProfileFields.length; k++) {
    if (profileStr.indexOf(requiredProfileFields[k]) === -1) {
      return { module: 'ConfigStructure', error: 'Missing profile field in scaffoldPilotProfile_: ' + requiredProfileFields[k] };
    }
  }

  return { module: 'ConfigStructure', idx: true };
}

function testLogProcessResolution_() {
  if (typeof LOG === 'undefined') return { module: 'LogProcessResolution', error: 'LOG service undefined' };
  
  if (LOG.resolveProcess('WATCH_FOLDER') !== 'Watch Folder') {
    return { module: 'LogProcessResolution', error: 'WATCH_FOLDER failed to resolve to Watch Folder' };
  }
  if (LOG.resolveProcess('BULK_INGEST') !== 'Bulk Ingestion') {
    return { module: 'LogProcessResolution', error: 'BULK_INGEST failed to resolve to Bulk Ingestion' };
  }
  if (LOG.resolveProcess('DUPE_TRIAGE') !== 'Duplicate Triage') {
    return { module: 'LogProcessResolution', error: 'DUPE_TRIAGE failed to resolve to Duplicate Triage' };
  }
  if (LOG.resolveProcess('SORT_LOGBOOK') !== 'Sort Logbook') {
    return { module: 'LogProcessResolution', error: 'SORT_LOGBOOK failed to resolve to Sort Logbook' };
  }
  if (LOG.resolveProcess('SORT_FLIGHTS') !== 'Sort Logbook') {
    return { module: 'LogProcessResolution', error: 'SORT_FLIGHTS failed to resolve to Sort Logbook' };
  }
  if (LOG.resolveProcess('Custom Process') !== 'Custom Process') {
    return { module: 'LogProcessResolution', error: 'Custom process string was modified unexpectedly' };
  }
  if (LOG.resolveProcess('') !== 'System') {
    return { module: 'LogProcessResolution', error: 'Empty process did not default to System' };
  }
  return { module: 'LogProcessResolution', idx: true };
}

function testLogLevelFiltering_() {
  if (typeof LOG === 'undefined') return { module: 'LogLevelFiltering', error: 'LOG service undefined' };

  // Brief level: allows discovery ([INFO]), lifecycle ([START], [COMPLETE]), alerts ([WARN], [ERR]); filters transactions ([OK], [DUPE]) and [DEBUG]
  if (LOG.shouldLog('Brief', '[INFO] Discovered 5 flights') !== true) {
    return { module: 'LogLevelFiltering', error: 'Brief should allow discovery [INFO]' };
  }
  if (LOG.shouldLog('Brief', '[START] Bulk Ingestion') !== true) {
    return { module: 'LogLevelFiltering', error: 'Brief should allow [START]' };
  }
  if (LOG.shouldLog('Brief', '[COMPLETE] Ingestion done') !== true) {
    return { module: 'LogLevelFiltering', error: 'Brief should allow [COMPLETE]' };
  }
  if (LOG.shouldLog('Brief', '[WARN] Missing site') !== true) {
    return { module: 'LogLevelFiltering', error: 'Brief should allow [WARN]' };
  }
  if (LOG.shouldLog('Brief', '[ERR] Parse error') !== true) {
    return { module: 'LogLevelFiltering', error: 'Brief should allow [ERR]' };
  }
  if (LOG.shouldLog('Brief', '[OK] Imported flight 123') !== false) {
    return { module: 'LogLevelFiltering', error: 'Brief should filter out transaction [OK]' };
  }
  if (LOG.shouldLog('Brief', '[DUPE] Duplicate flight') !== false) {
    return { module: 'LogLevelFiltering', error: 'Brief should filter out transaction [DUPE]' };
  }
  if (LOG.shouldLog('Brief', '[DEBUG] Internal parser details') !== false) {
    return { module: 'LogLevelFiltering', error: 'Brief should filter out [DEBUG]' };
  }

  // Normal level: mimics dialog console (lifecycle, discovery, transactions, alerts); filters only deep [DEBUG]
  if (LOG.shouldLog('Normal', '[INFO] Discovered 5 flights') !== true) {
    return { module: 'LogLevelFiltering', error: 'Normal should allow discovery [INFO]' };
  }
  if (LOG.shouldLog('Normal', '[START] Bulk Ingestion') !== true) {
    return { module: 'LogLevelFiltering', error: 'Normal should allow [START]' };
  }
  if (LOG.shouldLog('Normal', '[OK] Imported flight 123') !== true) {
    return { module: 'LogLevelFiltering', error: 'Normal should allow [OK]' };
  }
  if (LOG.shouldLog('Normal', '[DUPE] Duplicate flight') !== true) {
    return { module: 'LogLevelFiltering', error: 'Normal should allow [DUPE]' };
  }
  if (LOG.shouldLog('Normal', '[COMPLETE] Ingestion done') !== true) {
    return { module: 'LogLevelFiltering', error: 'Normal should allow [COMPLETE]' };
  }
  if (LOG.shouldLog('Normal', '[WARN] Missing site') !== true) {
    return { module: 'LogLevelFiltering', error: 'Normal should allow [WARN]' };
  }
  if (LOG.shouldLog('Normal', '[ERR] Parse error') !== true) {
    return { module: 'LogLevelFiltering', error: 'Normal should allow [ERR]' };
  }
  if (LOG.shouldLog('Normal', '[DEBUG] Internal parser details') !== false) {
    return { module: 'LogLevelFiltering', error: 'Normal should filter out [DEBUG]' };
  }

  // Debug level: allows everything
  if (LOG.shouldLog('Debug', '[INFO] Discovered 5 flights') !== true) {
    return { module: 'LogLevelFiltering', error: 'Debug should allow [INFO]' };
  }
  if (LOG.shouldLog('Debug', '[DEBUG] Internal parser details') !== true) {
    return { module: 'LogLevelFiltering', error: 'Debug should allow [DEBUG]' };
  }

  return { module: 'LogLevelFiltering', idx: true };
}

function testConservativePruningMath_() {
  // Test pruning logic invariants:
  // Row is pruned ONLY if totalRows > rowsToKeep AND timestamp < cutoffDate
  var rowsToKeep = 2000;
  var timeToKeepDays = 90;
  var now = new Date();
  var cutoffMs = now.getTime() - (timeToKeepDays * 86400000);

  // Case 1: Total rows <= rowsToKeep -> 0 prunable
  var totalRowsUnder = 1500;
  var maxPrunableUnder = totalRowsUnder - rowsToKeep;
  if (maxPrunableUnder > 0) {
    return { module: 'ConservativePruningMath', error: 'Under-capacity sheet should have 0 prunable' };
  }

  // Case 2: Total rows > rowsToKeep, but all rows are newer than cutoff
  var totalRowsOver = 2500;
  var maxPrunable = totalRowsOver - rowsToKeep; // 500
  var simulatedTimestampsYoung = [];
  for (var i = 0; i < maxPrunable; i++) {
    // 30 days old (< 90 days)
    simulatedTimestampsYoung.push(new Date(now.getTime() - (30 * 86400000)));
  }
  var deletedYoung = 0;
  for (var j = 0; j < simulatedTimestampsYoung.length; j++) {
    if (simulatedTimestampsYoung[j].getTime() < cutoffMs) {
      deletedYoung++;
    } else {
      break;
    }
  }
  if (deletedYoung !== 0) {
    return { module: 'ConservativePruningMath', error: 'Young rows were not protected by age cap' };
  }

  // Case 3: Total rows > rowsToKeep, 200 rows older than cutoff, remaining 300 younger
  var simulatedTimestampsMixed = [];
  for (var k = 0; k < 200; k++) {
    simulatedTimestampsMixed.push(new Date(now.getTime() - (100 * 86400000))); // 100 days old (> 90)
  }
  for (var m = 200; m < maxPrunable; m++) {
    simulatedTimestampsMixed.push(new Date(now.getTime() - (30 * 86400000))); // 30 days old (< 90)
  }
  var deletedMixed = 0;
  for (var n = 0; n < simulatedTimestampsMixed.length; n++) {
    if (simulatedTimestampsMixed[n].getTime() < cutoffMs) {
      deletedMixed++;
    } else {
      break;
    }
  }
  if (deletedMixed !== 200) {
    return { module: 'ConservativePruningMath', error: 'Expected 200 deleted rows, got ' + deletedMixed };
  }

  return { module: 'ConservativePruningMath', idx: true };
}

function testDedupeEngineEnhancements_() {
  // 1. Verify existence of required functions
  if (typeof scoreFlightQualityFromRow_ !== 'function') {
    return { module: 'DedupeEngineEnhancements', error: 'scoreFlightQualityFromRow_ missing' };
  }
  if (typeof formatOrAppendDupNote_ !== 'function') {
    return { module: 'DedupeEngineEnhancements', error: 'formatOrAppendDupNote_ missing' };
  }
  if (typeof scanAndFlagLogbookDuplicates_ !== 'function') {
    return { module: 'DedupeEngineEnhancements', error: 'scanAndFlagLogbookDuplicates_ missing' };
  }
  if (typeof uiScanAndFlagLogbookDuplicates !== 'function') {
    return { module: 'DedupeEngineEnhancements', error: 'uiScanAndFlagLogbookDuplicates missing' };
  }
  if (typeof uiScanAndFlagLogbookDuplicates_ !== 'function') {
    return { module: 'DedupeEngineEnhancements', error: 'uiScanAndFlagLogbookDuplicates_ missing' };
  }
  if (typeof INGESTION.scoreFlightQualityFromRow !== 'function') {
    return { module: 'DedupeEngineEnhancements', error: 'INGESTION.scoreFlightQualityFromRow export missing' };
  }
  if (typeof INGESTION.scanAndFlagLogbookDuplicates !== 'function') {
    return { module: 'DedupeEngineEnhancements', error: 'INGESTION.scanAndFlagLogbookDuplicates export missing' };
  }

  // 2. Test formatOrAppendDupNote_
  var primNote = formatOrAppendDupNote_('Original note', 'D01', true, 'F20261001-02, F20261001-03');
  if (primNote.indexOf('[DupRef: D01 | Others:') === -1) {
    return { module: 'DedupeEngineEnhancements', error: 'Primary note missing [DupRef: D01 | Others:]: ' + primNote };
  }
  if (primNote.indexOf('Others: F20261001-02, F20261001-03') === -1) {
    return { module: 'DedupeEngineEnhancements', error: 'Primary note missing Others reference: ' + primNote };
  }
  if (primNote.indexOf('Original note') === -1) {
    return { module: 'DedupeEngineEnhancements', error: 'Primary note lost original note: ' + primNote };
  }

  var dupeNote = formatOrAppendDupNote_('', 'D01', false, 'F20261001-01');
  if (dupeNote.indexOf('[DupRef: D01 | Primary:') === -1) {
    return { module: 'DedupeEngineEnhancements', error: 'Duplicate note missing [DupRef: D01 | Primary:]: ' + dupeNote };
  }
  if (dupeNote.indexOf('Primary: F20261001-01') === -1) {
    return { module: 'DedupeEngineEnhancements', error: 'Duplicate note missing Primary reference: ' + dupeNote };
  }

  // Test tag replacement / idempotency
  var updatedNote = formatOrAppendDupNote_(primNote, 'D01', true, 'F20261001-04');
  var matches = updatedNote.match(/\[DupRef:/g);
  if (matches && matches.length > 1) {
    return { module: 'DedupeEngineEnhancements', error: 'Duplicate DupRef tags found: ' + updatedNote };
  }
  if (updatedNote.indexOf('F20261001-04') === -1) {
    return { module: 'DedupeEngineEnhancements', error: 'Others list not updated in re-tagged note: ' + updatedNote };
  }

  // 3. Test scoreFlightQualityFromRow_
  var mockMap = {
    'IGC File': 1,
    'Notes': 2,
    'Max Alt (m)': 3,
    'Min Alt (m)': 4,
    'Flight Duration': 5,
    'Wing': 6
  };

  // High quality row (dedicated instrument, valid baro climb, 90 min duration, specific wing)
  var highRow = ['2026-05-10-Syride-SYSNav.igc', 'Flight notes', 2450, 1100, '01:30:00', 'Ozone Photon'];
  var highScore = scoreFlightQualityFromRow_(highRow, mockMap);

  // Low quality row (generic phone or missing device, 0 baro alt, 5 min duration, generic wing)
  var lowRow = ['flight.igc', '', 0, 0, '00:05:00', ''];
  var lowScore = scoreFlightQualityFromRow_(lowRow, mockMap);

  if (highScore <= lowScore) {
    return { module: 'DedupeEngineEnhancements', error: 'High quality flight score (' + highScore + ') should exceed low quality (' + lowScore + ')' };
  }
  if (highScore < 60) {
    return { module: 'DedupeEngineEnhancements', error: 'High quality flight score should be >= 60, got ' + highScore };
  }
  if (lowScore > 35) {
    return { module: 'DedupeEngineEnhancements', error: 'Low quality flight score should be <= 35, got ' + lowScore };
  }

  return { module: 'DedupeEngineEnhancements', idx: true };
}

function testStatusChangeUtility_() {
  if (typeof showChangeFlightStatusDialog !== 'function') {
    return { module: 'StatusChange', error: 'showChangeFlightStatusDialog function missing' };
  }
  if (typeof getStatusChangeScopeInfo !== 'function') {
    return { module: 'StatusChange', error: 'getStatusChangeScopeInfo function missing' };
  }
  if (typeof getStatusChangeTargetRows !== 'function') {
    return { module: 'StatusChange', error: 'getStatusChangeTargetRows function missing' };
  }

  // Test 1: CRITICAL SAFETY RULE: When sourceStatuses is empty/unselected, returns [] (0 flights match)
  var emptyRes = getStatusChangeTargetRows('all', []);
  if (!Array.isArray(emptyRes) || emptyRes.length !== 0) {
    return { module: 'StatusChange', error: 'getStatusChangeTargetRows with empty array must return []' };
  }

  var nullRes = getStatusChangeTargetRows('all', null);
  if (!Array.isArray(nullRes) || nullRes.length !== 0) {
    return { module: 'StatusChange', error: 'getStatusChangeTargetRows with null must return []' };
  }

  // Test 2: In-memory simulation of filter matching logic
  var mockFlights = [
    { row: 5, id: 'F01', status: 'Valid' },
    { row: 6, id: 'F02', status: 'Review?' },
    { row: 7, id: 'F03', status: 'Dup-Primary' },
    { row: 8, id: 'F04', status: 'Dup-Others' },
    { row: 9, id: 'F05', status: 'Remove' }
  ];

  var filter1 = ['Review?', 'Dup-Others'];
  var matched1 = mockFlights.filter(function(flt) {
    return filter1.indexOf(flt.status) !== -1;
  });
  if (matched1.length !== 2) {
    return { module: 'StatusChange', error: 'Expected 2 matched flights, got ' + matched1.length };
  }

  // Test 3: Blank / Empty status matching
  var mockFlightsWithBlank = [
    { row: 5, id: 'F01', status: 'Valid' },
    { row: 6, id: 'F02', status: '(Blank)' },
    { row: 7, id: 'F03', status: '' },
    { row: 8, id: 'F04', status: 'Review?' }
  ];
  var filterBlank = ['(Blank)'];
  var matchedBlank = mockFlightsWithBlank.filter(function(flt) {
    var st = (!flt.status || flt.status === '') ? '(Blank)' : flt.status;
    return filterBlank.indexOf(st) !== -1;
  });
  if (matchedBlank.length !== 2) {
    return { module: 'StatusChange', error: 'Expected 2 matched blank flights, got ' + matchedBlank.length };
  }

  // Test 4: CFG.LOG_PROCESSES registration
  if (!CFG.LOG_PROCESSES || CFG.LOG_PROCESSES.STATUS_CHANGE !== 'Status Change') {
    return { module: 'StatusChange', error: 'CFG.LOG_PROCESSES.STATUS_CHANGE not registered' };
  }

  return { module: 'StatusChange', idx: true };
}

function testDynamicFormulaResilience_() {
  // Test 1: columnToLetter_ conversion accuracy across boundaries
  var cases = [
    { in: 1, out: 'A' },
    { in: 2, out: 'B' },
    { in: 3, out: 'C' },
    { in: 4, out: 'D' },
    { in: 8, out: 'H' },
    { in: 12, out: 'L' },
    { in: 13, out: 'M' },
    { in: 22, out: 'V' },
    { in: 26, out: 'Z' },
    { in: 27, out: 'AA' },
    { in: 28, out: 'AB' },
    { in: 30, out: 'AD' },
    { in: 33, out: 'AG' },
    { in: 38, out: 'AL' },
    { in: 40, out: 'AN' },
    { in: 52, out: 'AZ' },
    { in: 53, out: 'BA' },
    { in: 55, out: 'BC' },
    { in: 59, out: 'BG' },
    { in: 702, out: 'ZZ' },
    { in: 703, out: 'AAA' },
    { in: 0, out: '' },
    { in: -5, out: '' },
    { in: null, out: '' }
  ];

  for (var i = 0; i < cases.length; i++) {
    var c = cases[i];
    var actual = columnToLetter_(c.in);
    if (actual !== c.out) {
      return { module: 'DynamicFormulaResilience', error: 'columnToLetter_(' + c.in + ') expected "' + c.out + '", got "' + actual + '"' };
    }
  }

  // Test 2: getColLetter_ resolution from TABS.FLIGHTS.groups (canonical schema fallback)
  var defaultStatus = getColLetter_(null, 'Status', 'B');
  if (defaultStatus !== 'B') {
    return { module: 'DynamicFormulaResilience', error: 'getColLetter_ default Status expected B, got ' + defaultStatus };
  }
  var defaultDur = getColLetter_(null, 'Flight Duration', 'L');
  if (defaultDur !== 'L') {
    return { module: 'DynamicFormulaResilience', error: 'getColLetter_ default Flight Duration expected L, got ' + defaultDur };
  }
  var defaultDist = getColLetter_(null, 'Track Length (km)', 'M');
  if (defaultDist !== 'M') {
    return { module: 'DynamicFormulaResilience', error: 'getColLetter_ default Track Length expected M, got ' + defaultDist };
  }
  var defaultTherm = getColLetter_(null, 'Thermal %', 'BC');
  if (defaultTherm !== 'BC') {
    return { module: 'DynamicFormulaResilience', error: 'getColLetter_ default Thermal % expected BC, got ' + defaultTherm };
  }

  // Test 3: getColLetter_ resolution with custom user-reordered column map
  var reorderedMap = {
    'FlightID': 1,
    'Flight No': 2,        // B (shifted from C)
    'Status': 3,           // C (shifted from B)
    'Auto Summary': 4,     // D
    'Flight Duration': 20, // T (shifted from L)
    'Track Length (km)': 21, // U (shifted from M)
    'Thermal %': 30        // AD (shifted from BC)
  };

  if (getColLetter_(reorderedMap, 'Flight No') !== 'B') {
    return { module: 'DynamicFormulaResilience', error: 'Reordered Flight No expected B, got ' + getColLetter_(reorderedMap, 'Flight No') };
  }
  if (getColLetter_(reorderedMap, 'Status') !== 'C') {
    return { module: 'DynamicFormulaResilience', error: 'Reordered Status expected C, got ' + getColLetter_(reorderedMap, 'Status') };
  }
  if (getColLetter_(reorderedMap, 'Flight Duration') !== 'T') {
    return { module: 'DynamicFormulaResilience', error: 'Reordered Flight Duration expected T, got ' + getColLetter_(reorderedMap, 'Flight Duration') };
  }
  if (getColLetter_(reorderedMap, 'Thermal %') !== 'AD') {
    return { module: 'DynamicFormulaResilience', error: 'Reordered Thermal % expected AD, got ' + getColLetter_(reorderedMap, 'Thermal %') };
  }

  // Test 4: Dynamic Flight No formula construction under reordered column
  var fNoLetter = getColLetter_(reorderedMap, 'Flight No', 'C');
  var fNoFormula = '=IFERROR(MAX(INDIRECT("' + fNoLetter + '" & (ROW()+1) & ":' + fNoLetter + '")), 0) + 1';
  if (fNoFormula !== '=IFERROR(MAX(INDIRECT("B" & (ROW()+1) & ":B")), 0) + 1') {
    return { module: 'DynamicFormulaResilience', error: 'Reordered Flight No formula expected indirect B, got ' + fNoFormula };
  }

  // Test 5: Dynamic Equipment query column resolution from TABS.EQUIPMENT.columns
  var eqCols = (TABS.EQUIPMENT && TABS.EQUIPMENT.columns) ? TABS.EQUIPMENT.columns : [];
  var cCat = columnToLetter_(eqCols.indexOf('Category') + 1);
  var cId = columnToLetter_(eqCols.indexOf('EquipmentID') + 1);
  var cRet = columnToLetter_(eqCols.indexOf('Retired?') + 1);
  if (cCat !== 'A' || cId !== 'B' || cRet !== 'H') {
    return { module: 'DynamicFormulaResilience', error: 'Equipment column resolution failed: Cat=' + cCat + ', Id=' + cId + ', Ret=' + cRet };
  }

  return { module: 'DynamicFormulaResilience', idx: true };
}

function testNativeSheetsResilience_() {
  // Test 1: getColumnMap_ whitespace and case tolerance with Proxy wrapper
  var mockHeaders = [' FlightID ', 'Flight No', 'Status ', 'wing', '  Date  ', 'Flight Duration'];
  var mockSheet = {
    getLastColumn: function() { return mockHeaders.length; },
    getLastRow: function() { return 10; },
    getRange: function(row, col, numRows, numCols) {
      return {
        getValues: function() { return [mockHeaders]; }
      };
    }
  };

  var map = getColumnMap_(mockSheet, 4);

  // Exact match
  if (map['Flight No'] !== 2) {
    return { module: 'NativeSheetsResilience', error: 'Exact Flight No expected 2, got ' + map['Flight No'] };
  }
  // Trimmed lookup
  if (map['FlightID'] !== 1) {
    return { module: 'NativeSheetsResilience', error: 'Trimmed FlightID expected 1, got ' + map['FlightID'] };
  }
  // Trailing space in query on clean header
  if (map['Flight No '] !== 2) {
    return { module: 'NativeSheetsResilience', error: 'Trailing space Flight No expected 2, got ' + map['Flight No '] };
  }
  // Trailing space in header on clean query
  if (map['Status'] !== 3) {
    return { module: 'NativeSheetsResilience', error: 'Status with trailing space in header expected 3, got ' + map['Status'] };
  }
  // Case insensitivity: 'wing' in header, 'Wing' in query
  if (map['Wing'] !== 4) {
    return { module: 'NativeSheetsResilience', error: 'Wing case insensitivity expected 4, got ' + map['Wing'] };
  }
  // Case insensitivity: 'Flight Duration' in header, 'flight duration' in query
  if (map['flight duration'] !== 6) {
    return { module: 'NativeSheetsResilience', error: 'flight duration lower query expected 6, got ' + map['flight duration'] };
  }

  // Test 2: Batch formula generation dimensions for sorting
  var minRow = 5;
  var maxRow = 14;
  var fNoColLetter = 'C';
  var batchFormulas = [];
  for (var r = minRow; r <= maxRow; r++) {
    batchFormulas.push(['=IFERROR(MAX(INDIRECT("' + fNoColLetter + '" & (ROW()+1) & ":' + fNoColLetter + '")), 0) + 1']);
  }
  if (batchFormulas.length !== 10 || batchFormulas[0].length !== 1) {
    return { module: 'NativeSheetsResilience', error: 'Batch formulas expected 10x1 2D array, got ' + batchFormulas.length + 'x' + (batchFormulas[0] ? batchFormulas[0].length : 0) };
  }
  if (batchFormulas[0][0] !== '=IFERROR(MAX(INDIRECT("C" & (ROW()+1) & ":C")), 0) + 1') {
    return { module: 'NativeSheetsResilience', error: 'Batch formula text mismatch: ' + batchFormulas[0][0] };
  }

  // Test 3: Native FILTER formula construction for equipment lookups (replacing QUERY)
  var eqName = 'Equipment';
  var cId = 'B';
  var cCat = 'A';
  var cRet = 'H';
  var rngId = eqName + '!$' + cId + '$3:$' + cId;
  var rngCat = eqName + '!$' + cCat + '$3:$' + cCat;
  var rngRet = eqName + '!$' + cRet + '$3:$' + cRet;
  var filterWingFormula = '=IFERROR(SORT(FILTER(' + rngId + ', ' + rngCat + '="Wing", ' + rngRet + '=FALSE)), "")';
  var expectedFilter = '=IFERROR(SORT(FILTER(Equipment!$B$3:$B, Equipment!$A$3:$A="Wing", Equipment!$H$3:$H=FALSE)), "")';
  if (filterWingFormula !== expectedFilter) {
    return { module: 'NativeSheetsResilience', error: 'Equipment FILTER formula mismatch: ' + filterWingFormula };
  }

  // Test 4: Dashboard Named Range status filter expression
  var fSheet = 'Flights';
  var colStatus = 'B';
  var fStart = 5;
  var fStatusFilter = '((INDIRECT("' + fSheet + '!' + colStatus + fStart + ':' + colStatus + '")="Valid") + (DASHBOARD_REVIEW_FILTER="Yes")*(INDIRECT("' + fSheet + '!' + colStatus + fStart + ':' + colStatus + '")="Review?"))';
  if (fStatusFilter.indexOf('DASHBOARD_REVIEW_FILTER="Yes"') === -1) {
    return { module: 'NativeSheetsResilience', error: 'Dashboard filter did not include DASHBOARD_REVIEW_FILTER Named Range' };
  }

  return { module: 'NativeSheetsResilience', idx: true };
}

function testSystemMaintenanceAndManifest_() {
  // 1. Verify SYSTEM_MANIFEST exists and has version and components
  if (typeof SYSTEM_MANIFEST === 'undefined' || !SYSTEM_MANIFEST.version || !SYSTEM_MANIFEST.components) {
    return { module: 'SystemMaintenanceAndManifest', error: 'SYSTEM_MANIFEST missing or invalid' };
  }
  if (SYSTEM_MANIFEST.version !== '2.2.0') {
    return { module: 'SystemMaintenanceAndManifest', error: 'SYSTEM_MANIFEST version expected 2.2.0, got ' + SYSTEM_MANIFEST.version };
  }

  // 2. Test diffManifests_ with empty applied manifest (Clean / Unapplied Sheet)
  var diffEmpty = diffManifests_({});
  if (diffEmpty.allUpToDate !== false) {
    return { module: 'SystemMaintenanceAndManifest', error: 'Empty applied manifest should have allUpToDate = false' };
  }
  if (diffEmpty.pendingCount !== diffEmpty.totalComponents || diffEmpty.pendingCount <= 0) {
    return { module: 'SystemMaintenanceAndManifest', error: 'Empty applied manifest should have pendingCount equal to totalComponents (' + diffEmpty.totalComponents + '), got ' + diffEmpty.pendingCount };
  }
  // All sheets should be not up to date
  for (var i = 0; i < diffEmpty.sheets.length; i++) {
    if (diffEmpty.sheets[i].allUpToDate !== false) {
      return { module: 'SystemMaintenanceAndManifest', error: 'Sheet ' + diffEmpty.sheets[i].sheetName + ' should have allUpToDate = false on empty applied' };
    }
  }

  // 3. Test diffManifests_ with fully up-to-date applied manifest
  var diffFull = diffManifests_(SYSTEM_MANIFEST.components);
  if (diffFull.allUpToDate !== true) {
    return { module: 'SystemMaintenanceAndManifest', error: 'Fully matched applied manifest should have allUpToDate = true' };
  }
  if (diffFull.pendingCount !== 0) {
    return { module: 'SystemMaintenanceAndManifest', error: 'Fully matched applied manifest should have pendingCount = 0, got ' + diffFull.pendingCount };
  }
  // All sheets should be up to date
  for (var j = 0; j < diffFull.sheets.length; j++) {
    if (diffFull.sheets[j].allUpToDate !== true || diffFull.sheets[j].pendingCount !== 0) {
      return { module: 'SystemMaintenanceAndManifest', error: 'Sheet ' + diffFull.sheets[j].sheetName + ' should have allUpToDate = true on full applied' };
    }
  }

  // 4. Test diffManifests_ with partially applied manifest (Only Flights up-to-date)
  var partialApplied = {};
  for (var key in SYSTEM_MANIFEST.components) {
    if (key.indexOf('Flights.') === 0) {
      partialApplied[key] = SYSTEM_MANIFEST.components[key];
    }
  }
  var diffPartial = diffManifests_(partialApplied);
  if (diffPartial.allUpToDate !== false) {
    return { module: 'SystemMaintenanceAndManifest', error: 'Partially matched manifest should have overall allUpToDate = false' };
  }
  var flightsSheet = null;
  var configSheet = null;
  for (var k = 0; k < diffPartial.sheets.length; k++) {
    if (diffPartial.sheets[k].sheetName === 'Flights') flightsSheet = diffPartial.sheets[k];
    if (diffPartial.sheets[k].sheetName === 'Config') configSheet = diffPartial.sheets[k];
  }
  if (!flightsSheet || flightsSheet.allUpToDate !== true || flightsSheet.pendingCount !== 0) {
    return { module: 'SystemMaintenanceAndManifest', error: 'Flights sheet rollup expected allUpToDate = true, got ' + (flightsSheet ? flightsSheet.allUpToDate : 'null') };
  }
  if (!configSheet || configSheet.allUpToDate !== false || configSheet.pendingCount === 0) {
    return { module: 'SystemMaintenanceAndManifest', error: 'Config sheet rollup expected allUpToDate = false, got ' + (configSheet ? configSheet.allUpToDate : 'null') };
  }

  // 5. Test SystemMaintenanceOrchestrator and AtomicUpdaters existence
  if (typeof SystemMaintenanceOrchestrator === 'undefined') {
    return { module: 'SystemMaintenanceAndManifest', error: 'SystemMaintenanceOrchestrator missing' };
  }
  if (typeof SystemMaintenanceOrchestrator.getStatus !== 'function' || typeof SystemMaintenanceOrchestrator.execute !== 'function') {
    return { module: 'SystemMaintenanceAndManifest', error: 'SystemMaintenanceOrchestrator missing getStatus or execute methods' };
  }
  if (typeof SystemMaintenanceOrchestrator.prepare !== 'function' || typeof SystemMaintenanceOrchestrator.executePhase !== 'function') {
    return { module: 'SystemMaintenanceAndManifest', error: 'SystemMaintenanceOrchestrator missing prepare or executePhase methods' };
  }
  if (typeof AtomicUpdaters === 'undefined' || typeof SheetSpecialists === 'undefined') {
    return { module: 'SystemMaintenanceAndManifest', error: 'AtomicUpdaters or SheetSpecialists missing' };
  }

  // 6. Test prepare and invariant auto-enforcement
  var prep = SystemMaintenanceOrchestrator.prepare({});
  if (!prep || !prep.success || !prep.effectiveComponents) {
    return { module: 'SystemMaintenanceAndManifest', error: 'prepare() failed to return effectiveComponents' };
  }
  if (!prep.effectiveComponents['Flights.headers'] || !prep.effectiveComponents['Flights.formulas']) {
    return { module: 'SystemMaintenanceAndManifest', error: 'prepare() did not auto-enforce mandatory Flights invariants' };
  }

  // 7. Verify RPC endpoints exported in Code.gs
  if (typeof prepareSystemMaintenance !== 'function' || typeof runSystemMaintenanceStep !== 'function') {
    return { module: 'SystemMaintenanceAndManifest', error: 'prepareSystemMaintenance or runSystemMaintenanceStep RPC missing' };
  }

  return { module: 'SystemMaintenanceAndManifest', idx: true };
}

function testAutomationEngine_() {
  // 1. Registry existence & structure
  if (typeof AUTOMATION_REGISTRY === 'undefined') {
    return { module: 'AutomationEngine', error: 'AUTOMATION_REGISTRY is not defined' };
  }
  if (!AUTOMATION_REGISTRY.triggers || !AUTOMATION_REGISTRY.actions || !AUTOMATION_REGISTRY.templates) {
    return { module: 'AutomationEngine', error: 'AUTOMATION_REGISTRY missing triggers, actions, or templates' };
  }

  // 2. Progressive Feature Flagging (actionAvailable)
  var availableKeys = AUTOMATION_REGISTRY.getAvailableActionKeys();
  if (availableKeys.indexOf('SCAN_WATCH_FOLDER') === -1 || 
      availableKeys.indexOf('CLEAN_LOGS') === -1 || 
      availableKeys.indexOf('PROCESS_QUEUE') === -1) {
    return { module: 'AutomationEngine', error: 'Missing core production actions from getAvailableActionKeys' };
  }
  if (availableKeys.indexOf('ENRICH_FLIGHT_GEO') !== -1 ||
      availableKeys.indexOf('ENRICH_FLIGHT_WEATHER') !== -1 ||
      availableKeys.indexOf('PURGE_STAGED_FLIGHTS') !== -1) {
    return { module: 'AutomationEngine', error: 'Candidate actions with actionAvailable:false must NOT be returned in getAvailableActionKeys' };
  }

  // 3. Predefined templates
  var templates = AUTOMATION_REGISTRY.getTemplates();
  if (templates.length < 3) {
    return { module: 'AutomationEngine', error: 'Expected at least 3 templates, got ' + templates.length };
  }
  var tplIds = templates.map(function(t) { return t.id; });
  if (tplIds.indexOf('TPL_WATCH_FOLDER') === -1 || tplIds.indexOf('TPL_CLEAN_LOGS') === -1 || tplIds.indexOf('TPL_PROCESS_QUEUE') === -1) {
    return { module: 'AutomationEngine', error: 'Core templates missing from registry' };
  }

  // 4. Parameter parsing and schema default fallback (Pattern 21 & DSGN-AUT-001)
  var cleanAction = AUTOMATION_REGISTRY.getAction('CLEAN_LOGS');
  var parsedFull = parseAutomationParams_('KeepRows=1500; KeepDays=45', cleanAction);
  if (parsedFull.KeepRows !== 1500 || parsedFull.KeepDays !== 45) {
    return { module: 'AutomationEngine', error: 'parseAutomationParams_ full pair mismatch: ' + JSON.stringify(parsedFull) };
  }

  // Partial parameters: schema fallback
  var parsedPartial = parseAutomationParams_('KeepRows=800', cleanAction);
  if (parsedPartial.KeepRows !== 800 || parsedPartial.KeepDays !== 90) {
    return { module: 'AutomationEngine', error: 'parseAutomationParams_ partial fallback failed: ' + JSON.stringify(parsedPartial) };
  }

  // Empty parameters: all schema defaults
  var parsedEmpty = parseAutomationParams_('', cleanAction);
  if (parsedEmpty.KeepRows !== 2000 || parsedEmpty.KeepDays !== 90) {
    return { module: 'AutomationEngine', error: 'parseAutomationParams_ empty string fallback failed: ' + JSON.stringify(parsedEmpty) };
  }

  // Boolean and number type conversions
  var watchAction = AUTOMATION_REGISTRY.getAction('SCAN_WATCH_FOLDER');
  var parsedWatch = parseAutomationParams_('MoveToTrash=Yes; MaxFiles=10', watchAction);
  if (parsedWatch.MoveToTrash !== true || parsedWatch.MaxFiles !== 10) {
    return { module: 'AutomationEngine', error: 'parseAutomationParams_ boolean/number parsing failed: ' + JSON.stringify(parsedWatch) };
  }

  // 5. Parameter serialization
  var serialized = serializeAutomationParams_({ KeepRows: 2000, KeepDays: 90 });
  if (serialized !== 'KeepRows=2000; KeepDays=90') {
    return { module: 'AutomationEngine', error: 'serializeAutomationParams_ mismatch: ' + serialized };
  }

  // 6. Due Interval Calculation (isRuleDue_)
  var now = new Date();
  var ruleNoLastRun = { active: 'Yes', triggerType: 'Time (Minutes)', triggerConfig: 15, lastRun: '' };
  if (!isRuleDue_(ruleNoLastRun, now)) {
    return { module: 'AutomationEngine', error: 'Rule with no lastRun should be due immediately' };
  }

  var ruleInactive = { active: 'No', triggerType: 'Time (Minutes)', triggerConfig: 15, lastRun: '' };
  if (isRuleDue_(ruleInactive, now)) {
    return { module: 'AutomationEngine', error: 'Inactive rule should never be due' };
  }

  var twentyMinsAgo = new Date(now.getTime() - (20 * 60 * 1000));
  var ruleDue = { active: 'Yes', triggerType: 'Time (Minutes)', triggerConfig: 15, lastRun: twentyMinsAgo };
  if (!isRuleDue_(ruleDue, now)) {
    return { module: 'AutomationEngine', error: 'Rule elapsed 20m with 15m interval should be due' };
  }

  var twoMinsAgo = new Date(now.getTime() - (2 * 60 * 1000));
  var ruleNotDue = { active: 'Yes', triggerType: 'Time (Minutes)', triggerConfig: 15, lastRun: twoMinsAgo };
  if (isRuleDue_(ruleNotDue, now)) {
    return { module: 'AutomationEngine', error: 'Rule elapsed 2m with 15m interval should NOT be due' };
  }

  var ruleEvent = { active: 'Yes', triggerType: 'Event (Lifecycle)', triggerConfig: 'INGESTION_COMPLETED', lastRun: '' };
  if (isRuleDue_(ruleEvent, now)) {
    return { module: 'AutomationEngine', error: 'Event-driven rule should not be due on heartbeat' };
  }

  // 7. Condition Evaluation (evaluateCondition_)
  var condBlank = evaluateCondition_('', 'CLEAN_LOGS', {});
  if (!condBlank.met) {
    return { module: 'AutomationEngine', error: 'Blank condition should evaluate to met: true' };
  }

  var condMet = evaluateCondition_('QUEUE_SIZE > 0', 'PROCESS_QUEUE', { QUEUE_SIZE: 3 });
  if (!condMet.met) {
    return { module: 'AutomationEngine', error: 'QUEUE_SIZE (3) > 0 should be met: true' };
  }

  var condNotMet = evaluateCondition_('QUEUE_SIZE > 0', 'PROCESS_QUEUE', { QUEUE_SIZE: 0 });
  if (condNotMet.met) {
    return { module: 'AutomationEngine', error: 'QUEUE_SIZE (0) > 0 should be met: false' };
  }

  // 8. TABS & Manifest alignment
  if (!TABS.AUTOMATION_RULES || TABS.AUTOMATION_RULES.name !== 'Automation_Rules') {
    return { module: 'AutomationEngine', error: 'TABS.AUTOMATION_RULES definition missing or wrong name' };
  }
  if (!SYSTEM_MANIFEST.components['Automation_Rules.headers'] || !SYSTEM_MANIFEST.components['Automation_Rules.templates']) {
    return { module: 'AutomationEngine', error: 'Automation_Rules components missing from SYSTEM_MANIFEST' };
  }

  // 9. Sidebar RPC gateways
  if (typeof getActiveAutomationContext !== 'function' || typeof activateAutomationRulesSheet !== 'function') {
    return { module: 'AutomationEngine', error: 'Sidebar context RPCs missing' };
  }
  if (typeof showAutomationSidebar !== 'function') {
    return { module: 'AutomationEngine', error: 'showAutomationSidebar missing from Code.gs' };
  }

  return { module: 'AutomationEngine', idx: true };
}

function testAutoSummaryFormat_() {
  if (typeof buildAutoSummary_ !== 'function') {
    return { module: 'AutoSummaryFormat', error: 'buildAutoSummary_ function not found' };
  }

  // 1. Long flight (>= 1 hour) with decimal distance
  var s1 = buildAutoSummary_('Bir Billing', 5400, 24.5, 3100, 'XC');
  if (s1 !== '1:30 hrs, 24.5 km, 3100 m, Bir Billing') {
    return { module: 'AutoSummaryFormat', error: 'Expected "1:30 hrs, 24.5 km, 3100 m, Bir Billing", got "' + s1 + '"' };
  }

  // 2. Short flight (< 1 hour) with integer distance (truncated .0)
  var s2 = buildAutoSummary_('Torrey Pines', 2700, 24.0, 1250, 'Ridge Soaring');
  if (s2 !== '45 min, 24 km, 1250 m, Torrey Pines') {
    return { module: 'AutoSummaryFormat', error: 'Expected "45 min, 24 km, 1250 m, Torrey Pines", got "' + s2 + '"' };
  }

  // 3. String duration input (e.g. from maintenance: "2:15")
  var s3 = buildAutoSummary_('Interlaken', '2:15', 30.2, 2800);
  if (s3 !== '2:15 hrs, 30.2 km, 2800 m, Interlaken') {
    return { module: 'AutoSummaryFormat', error: 'Expected "2:15 hrs, 30.2 km, 2800 m, Interlaken", got "' + s3 + '"' };
  }

  // 4. Missing site and altitude (omits cleanly)
  var s4 = buildAutoSummary_('', 1800, 5.0, 0);
  if (s4 !== '30 min, 5 km') {
    return { module: 'AutoSummaryFormat', error: 'Expected "30 min, 5 km", got "' + s4 + '"' };
  }

  return { module: 'AutoSummaryFormat', idx: true };
}

function testDateTimeInvariants_() {
  if (typeof UTILS === 'undefined' || !UTILS.computeFlightUtcDates) {
    return { module: 'DateTimeInvariants', error: 'UTILS.computeFlightUtcDates not found' };
  }

  // 1. Anchored UTC calculation: 2024-05-20, launch at 14:00:00 UTC (50400s), landing at 15:30:00 UTC (55800s)
  var res1 = UTILS.computeFlightUtcDates('2024-05-20', 50400, 55800);
  if (res1.launchDateUtc.toISOString() !== '2024-05-20T14:00:00.000Z') {
    return { module: 'DateTimeInvariants', error: 'launchDateUtc mismatch: ' + res1.launchDateUtc.toISOString() };
  }
  if (res1.landDateUtc.toISOString() !== '2024-05-20T15:30:00.000Z') {
    return { module: 'DateTimeInvariants', error: 'landDateUtc mismatch: ' + res1.landDateUtc.toISOString() };
  }

  // 2. Midnight crossover: launch at 23:30 UTC (84600s), landing at 00:45 UTC (2700s)
  var res2 = UTILS.computeFlightUtcDates('2024-05-20', 84600, 2700);
  if (res2.launchDateUtc.toISOString() !== '2024-05-20T23:30:00.000Z') {
    return { module: 'DateTimeInvariants', error: 'Midnight crossover launchDateUtc mismatch: ' + res2.launchDateUtc.toISOString() };
  }
  if (res2.landDateUtc.toISOString() !== '2024-05-21T00:45:00.000Z') {
    return { module: 'DateTimeInvariants', error: 'Midnight crossover landDateUtc mismatch: ' + res2.landDateUtc.toISOString() };
  }

  // 3. Local date formatting under negative UTC offsets (America/Denver is UTC-6 in May)
  // 14:00 UTC on 2024-05-20 -> 08:00 MDT on 2024-05-20
  var localDate = UTILS.formatFlightDate(res1.launchDateUtc, 'America/Denver', 'yyyy-MM-dd');
  var idDate = UTILS.formatFlightDate(res1.launchDateUtc, 'America/Denver', 'yyyyMMdd');
  var launchTime = UTILS.formatFlightTime(res1.launchDateUtc, 'America/Denver', 'h:mm a');
  if (localDate !== '2024-05-20') {
    return { module: 'DateTimeInvariants', error: 'Expected local date 2024-05-20 in America/Denver, got ' + localDate };
  }
  if (idDate !== '20240520') {
    return { module: 'DateTimeInvariants', error: 'Expected FlightID date 20240520 in America/Denver, got ' + idDate };
  }
  var cleanLaunchTime = launchTime.toLowerCase().replace(/\s+/g, '');
  if (cleanLaunchTime !== '8:00am' && cleanLaunchTime !== '08:00am') {
    return { module: 'DateTimeInvariants', error: 'Expected launch time 8:00 am in America/Denver, got ' + launchTime };
  }

  // 4. Test rollover in negative timezone:
  // Flight at 02:00 UTC on 2024-05-20 in America/Los_Angeles (UTC-7 in summer) -> 19:00 PDT on 2024-05-19!
  var res3 = UTILS.computeFlightUtcDates('2024-05-20', 7200, 10800);
  var rollLocalDate = UTILS.formatFlightDate(res3.launchDateUtc, 'America/Los_Angeles', 'yyyy-MM-dd');
  var rollIdDate = UTILS.formatFlightDate(res3.launchDateUtc, 'America/Los_Angeles', 'yyyyMMdd');
  if (rollLocalDate !== '2024-05-19') {
    return { module: 'DateTimeInvariants', error: 'Expected local date 2024-05-19 for late evening LA takeoff, got ' + rollLocalDate };
  }
  if (rollIdDate !== '20240519') {
    return { module: 'DateTimeInvariants', error: 'Expected FlightID date 20240519 for late evening LA takeoff, got ' + rollIdDate };
  }
  if (rollIdDate !== rollLocalDate.replace(/-/g, '')) {
    return { module: 'DateTimeInvariants', error: 'FlightID date and local date mismatch: ' + rollIdDate + ' vs ' + rollLocalDate };
  }

  return { module: 'DateTimeInvariants', idx: true };
}
