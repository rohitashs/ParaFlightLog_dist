/**
 * Paragliding Flight Log v2.0
 * 
 * MODULE: Ingestion Service
 * Handles File inputs (Drive, URL), ZIP extraction, Deduplication, and calls Parser.
 */

/* ==========================================================================================
   PUBLIC ENTRY POINTS
   ========================================================================================== */

/**
 * Triggered by Time-Based Trigger (e.g. every 5 or 15 mins).
 * Scans the Watch Folder for new files.
 */
function scanWatchFolderNow_() {
  var config = getLookups_();
  var folderId = config.WATCH_FOLDER_ID;
  
  if (!folderId) {
    console.warn('No Watch Folder ID configured.');
    return;
  }
  
  try {
    var folder = DriveApp.getFolderById(folderId);
    var files = folder.getFiles();
    var processedCount = 0;
    var maxProcess = 5; // Cap to avoid timeouts per execution
    
    while (files.hasNext() && processedCount < maxProcess) {
      var file = files.next();
      var fId = file.getId();
      var fName = file.getName();
      
      // Basic check: Only process files modified recently? 
      // Or relies entirely on Dedupe Hash. Relying on Hash is safer but slower if folder huge.
      // Optimization: Could check property 'PROCESSED' on file, but read-only access prevents writing to file metadata potentially.
      // So we use our internal Dedupe Cache (MD5) as the primary gate.
      
      // We process .igc, .igx, .zip, .gz
      if (fName.match(/\.(igc|igx|zip|gz)$/i)) {
         var result = processDriveFile_(file, config);
         if (result.processed) processedCount++;
      }
    }
  } catch (e) {
    console.error('Watch Scan Error:', e);
  }
}

/**
 * Manual Import from UI
 */
function uiAddFlightFromIgc_() {
  var ui = SpreadsheetApp.getUi();
  var resp = ui.prompt('Import Flight', 'Enter Drive File ID or Direct URL:', ui.ButtonSet.OK_CANCEL);
  if (resp.getSelectedButton() !== ui.Button.OK) return;
  
  var input = resp.getResponseText().trim();
  if (!input) return;
  
  var config = getLookups_();
  var ctx = { source: 'Manual' };
  
  try {
    if (input.match(/^https?:\/\//)) {
      // URL import
      handleUrlImport_(input, ctx, config);
    } else {
      // Assume Drive ID
      var file = DriveApp.getFileById(input);
      processDriveFile_(file, config);
    }
    SpreadsheetApp.getActive().toast('Import finished.');
  } catch (e) {
    ui.alert('Import Failed: ' + e.message);
  }
}


/* ==========================================================================================
   INTERNAL PROCESSING
   ========================================================================================== */

function processDriveFile_(file, config) {
  var blob = file.getBlob();
  var name = file.getName();
  var id = file.getId();
  
  return processBlob_(blob, name, id, config);
}

function handleUrlImport_(url, ctx, config) {
  var res = UrlFetchApp.fetch(url);
  var blob = res.getBlob();
  // Try to guess filename from header or url
  var name = 'download.igc'; // fallback
  // ... (header parsing skipped for brevity, simplistic)
  
  return processBlob_(blob, name, 'URL', config);
}

function processBlob_(blob, fileName, fileId, config) {
  var lowerName = fileName.toLowerCase();
  
  // 1. ZIP Handling
  if (lowerName.endsWith('.zip')) {
    var zipBlobs = Utilities.unzip(blob);
    var anyProcessed = false;
    zipBlobs.forEach(function(b) {
      var bName = b.getName();
      if (bName.match(/\.(igc|igx)$/i)) {
        var res = processSingleIgcBlob_(b, bName, fileId, fileName, config); // pass outer name
        if (res) anyProcessed = true;
      }
    });
    return { processed: anyProcessed };
  }
  
  // 2. GZIP Handling
  if (lowerName.endsWith('.gz')) {
    var rawBlob = Utilities.gunzip(blob);
    var innerName = fileName.replace(/\.gz$/i, '');
    return { processed: processSingleIgcBlob_(rawBlob, innerName, fileId, fileName, config) };
  }
  
  // 3. Plain IGC
  return { processed: processSingleIgcBlob_(blob, fileName, fileId, fileName, config) };
}

/**
 * Core processor for a single IGC blob.
 * Returns true if processed/added, false if skipped (dedupe).
 */
function processSingleIgcBlob_(blob, fileName, fileId, outerName, config) {
  var text = blob.getDataAsString();
  
  // A. Dedupe Check (MD5)
  var hash = Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, text);
  var hashStr = hash.map(function(b) { return ('0' + (b & 0xFF).toString(16)).slice(-2); }).join('');
  
  if (isHashSeen_(hashStr)) {
    logImport_(new Date(), fileId, outerName, fileName, 'Duplicate (MD5)', 'Skipped');
    return false;
  }
  
  // B. Parse
  var parsed = parseIgc(text, fileName);
  if (!parsed) {
     logImport_(new Date(), fileId, outerName, fileName, 'Parse Fail', 'Invalid IGC structure');
     return false;
  }
  
  // C. Analysis & Scoring
  var analysis = ANALYSIS.analyzeFlight(parsed.fixes, config);
  var scoring = SCORING.calculateXcScore(parsed.fixes);
  
  // D. Enrichment (Geo)
  var geoLaunch = GEO.getReverseGeo(parsed.meta.lat, parsed.meta.lon, config) || {}; // meta usually doesn't have lat/lon, fixes[0] does.
  // Actually parsed.fixes[0] is start.
  var launchFix = parsed.fixes[0];
  var landFix = parsed.fixes[parsed.fixes.length-1];
  
  var geoLaunch = GEO.getReverseGeo(launchFix.lat, launchFix.lon, config) || {};
  var siteLaunch = GEO.getNearestSite(launchFix.lat, launchFix.lon, config.OSM_RADIUS_M, config);
  
  var geoLand = GEO.getReverseGeo(landFix.lat, landFix.lon, config) || {};
  var siteLand = GEO.getNearestSite(landFix.lat, landFix.lon, config.OSM_RADIUS_M, config);
  
  // E. Validation Check
  var status = 'Needs review';
  var notes = '';
  
  if (analysis.validation.status !== 'OK') {
     status = analysis.validation.status;
     notes = analysis.validation.reason;
  }
  
  // F. Insert Flight
  insertFlightRow_(parsed, fileId, outerName, status, notes, analysis, scoring, {
    l: geoLaunch, ls: siteLaunch,
    d: geoLand, ds: siteLand
  });
  
  // G. Mark Hard Hash as Seen
  markHashSeen_(hashStr);
  logImport_(new Date(), fileId, outerName, fileName, 'Success', notes || 'OK');
  
  return true;
}

/* ==========================================================================================
   HELPERS
   ========================================================================================== */

function isHashSeen_(hashStr) {
  var p = PropertiesService.getDocumentProperties();
  return p.getProperty('HASH_' + hashStr) === '1';
}

function markHashSeen_(hashStr) {
  var p = PropertiesService.getDocumentProperties();
  p.setProperty('HASH_' + hashStr, '1');
}

function logImport_(date, fileId, outer, inner, status, notes) {
  var ss = SpreadsheetApp.getActive();
  var sh = ss.getSheetByName(CFG.sheets.importLog);
  if (sh) {
    sh.appendRow([date, fileId, outer, inner, status, notes]);
  }
}

/**
 * Inserts the Data Row into 'Flights' Sheet.
 */
function insertFlightRow_(data, fileId, outerName, status, notes, analysis, scoring, geo) {
  var ss = SpreadsheetApp.getActive();
  var sh = ss.getSheetByName(CFG.sheets.flights);
  
  // Geo Fallbacks
  geo = geo || { l:{}, ls:'', d:{}, ds:'' };
  
  // Group Mapping (Must match `scaffoldFlights_` order)
  // Col 1=Status, 2=FlightNo, 3=AutoSummary, 4=FlightID, 5=Date, 6=Time, 7=Type
  // ...
  
  // Group Mapping (Must match `scaffoldFlights_` order)
  // Col 1=Status, 2=FlightNo, 3=AutoSummary, 4=FlightID, 5=Date, 6=Time, 7=Type
  // ...
  
  // Generate IDs
  var flightIdStr = 'F-' + data.meta.dateIso.replace(/-/g,'') + '-' + Math.floor(Math.random()*10000);
  var flightNo = getNextFlightNo_(sh);
  
  // Auto Summary
  var hrs = Math.floor(data.stats.durationSec / 3600);
  var mins = Math.floor((data.stats.durationSec % 3600) / 60);
  var summary = hrs + 'h ' + mins + 'm, ' + data.stats.trackLenKm.toFixed(1) + 'km';
  if (analysis.stats.maxAlt > -Infinity) summary += ', Max Alt ' + Math.round(analysis.stats.maxAlt) + 'm';
  
  // Gear Autofill (Previous Row)
  var prevGear = getPreviousGear_(sh); // {wing, harness, res1, res2}
  
  // Construct Row Array (matching headers in Code.gs)
  // 1. Identity
  var row = [
    status,
    flightNo,
    summary,
    flightIdStr,
    data.meta.dateIso,
    formatTime_(data.stats.startTime), 
    'Free Fly' // Default Type
  ];
  
  // 2. Metrics
  row.push(formatDuration_(data.stats.durationSec));
  row.push(data.stats.trackLenKm);
  row.push(data.stats.straightDistKm);
  
  // 3. Gear (8 cols)
  row.push(prevGear.wing || '');
  row.push(prevGear.harness || '');
  row.push(prevGear.res1 || '');
  row.push(prevGear.res2 || '');
  row.push(''); // Other
  row.push(''); // Snap LD
  row.push(''); // Snap Trim
  row.push(''); // Snap Full
  
  // 4. XC Scoring
  row.push(scoring ? scoring.free.dist : '');
  row.push(scoring ? scoring.best.score : '');
  row.push(scoring ? scoring.best.type : '');
  row.push(scoring ? scoring.triangle.dist : '');
  row.push(scoring ? scoring.best.pointsWorld : '');
  row.push(''); // Pts Nat (TODO)
  row.push(scoring ? (scoring.triangle.closed ? 'Yes' : 'No') : '');
  row.push(analysis.stats.maxAlt);
  row.push(analysis.stats.minAlt);
  row.push(analysis.stats.maxAlt - analysis.stats.minAlt); // Gain
  row.push(analysis.stats.maxClimb);
  row.push(analysis.stats.maxSink);
  row.push(analysis.stats.maxGs);
  row.push(analysis.stats.avgGs);
  
  // 5. Launch (7 cols)
  row.push(data.fixes[0].lat);
  row.push(data.fixes[0].lon);
  row.push(geo.ls); // Site
  row.push(geo.l.town);
  row.push(geo.l.country);
  row.push(geo.l.region);
  row.push(data.fixes[0].alt);
  
  // 6. Landing (8 cols)
  row.push(data.fixes[data.fixes.length-1].lat);
  row.push(data.fixes[data.fixes.length-1].lon);
  row.push(geo.ds); // Site
  row.push(geo.d.town);
  row.push(geo.d.country);
  row.push(geo.d.region);
  row.push(data.fixes[data.fixes.length-1].alt);
  row.push(analysis.stats.straightDistKm); // Launch-Landing Dist
  
  // 7. Weather (6 cols)
  row.push(''); row.push(''); row.push(''); row.push(''); row.push(''); row.push(notes);
  
  // 8. Analytics (10 cols)
  // Thermal %, Count, Avg, Best, Soar %, Efficiency, Glide %, LD, Sink %, Sink Time
  var pct = analysis.modes.pct;
  var raw = analysis.modes.raw;
  
  row.push(pct.thermal);
  row.push(raw.thermal.count);
  row.push(raw.thermal.avg);
  row.push(raw.thermal.best);
  row.push(pct.soar);
  row.push(''); // Soar efficiency (TODO)
  row.push(pct.glide);
  row.push(''); // Glide LD (TODO)
  row.push(pct.sink);
  row.push(raw.sink.time / 60); // Sink time in min
  
  // 9. Validation (2 cols)
  row.push(analysis.validation.status);
  row.push(analysis.validation.reason);
  
  // 10. Meta
  row.push(outerName);
  row.push(fileId);
  row.push(new Date());
  row.push('v2.0');
  
  sh.insertRowBefore(6);
  sh.getRange(6, 1, 1, row.length).setValues([row]);
}

function getNextFlightNo_(sh) {
  // Check row 7 (previous top)
  if (sh.getLastRow() < 7) return 1;
  var val = sh.getRange(7, 2).getValue(); // Col 2 is Flight No
  return (typeof val === 'number') ? val + 1 : 1;
}

function getPreviousGear_(sh) {
  if (sh.getLastRow() < 7) return {};
  // Gear is Col 11? (Identity 7 + Metrics 3 = 10. So Gear starts 11)
  // Let's verify index.
  // Identity: 7 cols
  // Metrics: 3 cols. Total 10.
  // Gear starts at 11. End at 18.
  var rng = sh.getRange(7, 11, 1, 4).getValues()[0];
  return {
    wing: rng[0],
    harness: rng[1],
    res1: rng[2],
    res2: rng[3]
  };
}

function formatTime_(sec) {
  // Seconds from midnight to HH:mm:ss string
  var h = Math.floor(sec / 3600) % 24;
  var m = Math.floor((sec % 3600) / 60);
  var s = Math.floor(sec % 60);
  return ('0'+h).slice(-2) + ':' + ('0'+m).slice(-2) + ':' + ('0'+s).slice(-2);
}

function formatDuration_(sec) {
  var h = Math.floor(sec / 3600);
  var m = Math.floor((sec % 3600) / 60);
  var s = Math.floor(sec % 60);
  return h + ':' + ('0'+m).slice(-2) + ':' + ('0'+s).slice(-2);
}
