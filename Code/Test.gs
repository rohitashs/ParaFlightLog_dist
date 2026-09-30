/**
 * Paragliding Flight Log v2.0
 * Updated: 2026-09-29 19:13:05
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
  if (res.status !== 'No' || res.note !== 'No Username') return { module: 'XContest', error: 'Fail: No User handling' };

  // Test 2: Season Logic (Conceptual check via manual calc if we extracted it, but here we just check safe execution)
  // We can't easily mock UrlFetchApp here without refactoring.
  
  return { module: 'XContest', idx: true };
}
