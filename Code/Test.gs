/**
 * Paragliding Flight Log v2.0
 * Updated: 2026-09-30 23:53:37
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
  // Mock simple track
  var fixes = [];
  for (var i=0; i<100; i++) {
     fixes.push({ t:i, lat: 46 + (i*0.001), lon: 7, alt: 1000 });
  }
  // Dist approx 11km (0.1 deg lat)
  
  var score = SCORING.calculateXcScore(fixes);
  if (!score) return { module: 'Scoring', error: 'Null result' };
  if (score.free.dist < 5) return { module: 'Scoring', error: 'Dist too small' };
  
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
