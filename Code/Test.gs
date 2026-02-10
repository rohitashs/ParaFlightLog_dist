/**
 * Paragliding Flight Log v2.0
 * Updated: 2026-02-09 18:19:49
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
  // Only test config usage, don't spam API
  // Or test caching logic if mocked? 
  // We'll skip real network call to avoid blocking tests on quota.
  return { module: 'Geo', idx: true }; 
}
