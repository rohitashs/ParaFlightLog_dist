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
    var driveId = getDriveIdFromUrl_(input);
    if (driveId) {
      // It's a Drive URL or ID
      var file = DriveApp.getFileById(driveId);
      processDriveFile_(file, config);
    } else if (input.match(/^https?:\/\//)) {
      // External URL (non-Drive)
      handleUrlImport_(input, ctx, config);
    } else {
      // Raw ID fallback
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

function addManualFlight() {
  var ss = SpreadsheetApp.getActive();
  var sh = ss.getSheetByName(CFG.sheets.flights);
  if (!sh) return;
  
  // 1. Generate ID
  var dateObj = new Date();
  var yyyy = dateObj.getFullYear();
  var mm = ('0' + (dateObj.getMonth() + 1)).slice(-2);
  var dd = ('0' + dateObj.getDate()).slice(-2);
  var dateStr = yyyy + mm + dd;
  var idSuffix = getNextDailyId_(sh, dateStr);
  var flightId = 'F' + dateStr + '_' + idSuffix;
  
  // 2. Flight No
  var flightNo = '=IFERROR(MAX(C7:C),0)+1';
  
  // 3. Defaults
  var eq = lookupDefaultEquipment_();
  var prevGear = getPreviousGear_(sh);
  
  var row = [];
  row.push(flightId);          // 1. ID
  row.push('Needs Review');    // 2. Status
  row.push(flightNo);          // 3. No
  row.push('Manual Entry');    // 4. Summary
  row.push('');                // 5. Notes
  row.push('Free Fly');        // 6. Type
  row.push(dateObj);           // 7. Date
  row.push(Session.getScriptTimeZone()); // 8. TimeZone
  row.push(formatTime_(dateObj.getTime()/1000)); // 9. Launch Time
  row.push('');                // 10. Land Time
  row.push('');                // 11. Dur
  row.push('');                // 12. Dist
  row.push('');                // 13. Dist
  
  // Gear
  row.push(prevGear.wing || eq.wing);
  row.push(prevGear.harness || eq.harness);
  row.push(prevGear.res1 || eq.res1);
  row.push(prevGear.res2 || eq.res2);
  
  sh.insertRowBefore(6);
  sh.getRange(6, 1, 1, row.length).setValues([row]);
  SpreadsheetApp.flush();
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
  // Flight ID: Format FYYYYMMDD_nn
  var dateObj = new Date(data.meta.dateIso || Date.now());
  var yyyy = dateObj.getFullYear();
  var mm = ('0' + (dateObj.getMonth() + 1)).slice(-2);
  var dd = ('0' + dateObj.getDate()).slice(-2);
  var dateStr = yyyy + mm + dd;
  
  // Find next suffix for this date
  var idSuffix = getNextDailyId_(sh, dateStr);
  var flightId = 'F' + dateStr + '_' + idSuffix;

  // Flight No: Formula
  var flightNo = '=IFERROR(MAX(C7:C),0)+1'; // Note: Flight No is now Col 3 (C)
  
  // Equipment Defaults
  var eq = lookupDefaultEquipment_();
  
  // Auto Summary
  // Logic: Duration + Type + Site
  var site = geo.ls || geo.l.town || '';
  var durStr = formatDuration_(data.stats.durationSec);
  // Simplify duration? 1230 -> 20m? Lets stick to H:MM:SS for now or simplify.
  // User asked "Like 12 mins or 1.3 hrs".
  var durFriendly = friendlyDuration_(data.stats.durationSec);
  var autoSummary = durFriendly + ' ' + ('Free Fly') + (site ? ' at ' + site : '');

  // ROW INITIALIZATION
  // 1. Flight Info (13 cols)
  // ['FlightID', 'Status', 'Flight No', 'Auto Summary', 'Notes', 'Flight Type', 'Date', 'Time Zone', 'Launch Time', 'Landing Time', 'Flight Duration', 'Track Length (km)', 'Straight Dist (km)']
  var row = [];
  row.push(flightId);
  row.push('Needs Review');
  row.push(flightNo);
  row.push(autoSummary);
  row.push(notes || ''); // Notes
  row.push('Free Fly');  // Flight Type default
  row.push(data.meta.dateIso);
  row.push('UTC');       // Time Zone (Default)
  
  // Times
  var tLaunchStr = formatTime_(data.stats.startTime);
  var tLandStr = '';
  if (data.stats.endTime && !isNaN(data.stats.endTime)) {
     tLandStr = formatTime_(data.stats.endTime);
  } else {
     tLandStr = formatTime_(data.stats.startTime + data.stats.durationSec);
  }
  row.push(tLaunchStr);
  row.push(tLandStr);
  
  row.push(formatDuration_(data.stats.durationSec));
  row.push((data.stats.trackLenKm).toFixed(2));
  row.push((data.stats.straightDistKm).toFixed(2));

  
  // 2. Gear
  // Logic: Previous Row -> Default -> Empty
  var prevGear = getPreviousGear_(sh);
  var defGear = lookupDefaultEquipment_();
  var wingStr = prevGear.wing || defGear.wing || '';
  var harnStr = prevGear.harness || defGear.harness || '';
  var res1Str = prevGear.res1 || defGear.res1 || '';
  var res2Str = prevGear.res2 || defGear.res2 || '';
  
  row.push(wingStr);
  row.push(harnStr);
  row.push(res1Str);
  row.push(res2Str);
  row.push(''); // Other
  
  // Wing Specs Lookup
  var wSpecs = lookupWingSpecs_(wingStr);
  row.push(wSpecs.glide);
  row.push(wSpecs.trim);
  row.push(wSpecs.full);
  
  // 3. XC Scoring
  if (scoring && scoring.best) {
    row.push((scoring.free.dist ? scoring.free.dist/1000 : 0).toFixed(2)); // XC Dist
    row.push((scoring.best.score).toFixed(2)); // Score
    row.push(scoring.best.type);
    row.push(scoring.triangle ? (scoring.triangle.dist/1000).toFixed(2) : 0);
    row.push(scoring.best.pointsWorld || '');
    row.push(''); // National
    row.push(scoring.triangle && scoring.triangle.isClosed ? 'Yes' : 'No');
  } else {
     row.push(''); row.push(''); row.push(''); row.push(''); row.push(''); row.push(''); row.push('');
  }
  row.push(analysis.stats.maxAlt);
  row.push(analysis.stats.minAlt);
  row.push(analysis.stats.maxAlt - analysis.stats.minAlt); // Gain
  row.push(analysis.stats.maxClimb);
  row.push(analysis.stats.maxSink);
  row.push(analysis.stats.maxGs);
  row.push(analysis.stats.avgGs);
  
  // 5. Launch (7 cols) - Alt first
  // ['Launch Alt (m)', 'Launch Lat', 'Launch Lon', 'Launch Site', 'Launch Town', 'Launch Country', 'Launch Region']
  row.push(data.fixes[0].alt);
  row.push(data.fixes[0].lat);
  row.push(data.fixes[0].lon);
  row.push(geo.ls); // Site
  row.push(geo.l.town);
  row.push(geo.l.country);
  row.push(geo.l.region);
  
  // 6. Landing (8 cols) - Alt first
  // ['Landing Alt (m)', 'Landing Lat', 'Landing Lon', 'Landing Site', 'Landing Town', 'Landing Country', 'Landing Region', 'Launch-Landing Dist (km)']
  row.push(data.fixes[data.fixes.length-1].alt);
  row.push(data.fixes[data.fixes.length-1].lat);
  row.push(data.fixes[data.fixes.length-1].lon);
  row.push(geo.ds); // Site
  row.push(geo.d.town);
  row.push(geo.d.country);
  row.push(geo.d.region);
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

function getDriveIdFromUrl_(url) {
  // Matches /file/d/ID/ or ?id=ID patterns
  var re = /[-\w]{25,}/;
  var match = url.match(re);
  // Simple check: if input is a URL containing a long ID, assumes it's that ID. 
  // Specifically for drive.google.com
  if (url.indexOf('drive.google.com') > -1 && match) {
    return match[0];
  }
  return null;
}

function lookupDefaultEquipment_() {
  var ss = SpreadsheetApp.getActive();
  var eq = { wing: '', harness: '', res1: '', res2: '' };
  
  // Helper to find default in a sheet
  // Default col is 5 (E). Data starts row 2.
  var findDef = function(sheetName) {
    var sh = ss.getSheetByName(sheetName);
    if (!sh || sh.getLastRow() < 2) return '';
    // Get all data: A2:E
    var data = sh.getRange(2, 1, sh.getLastRow()-1, 5).getValues();
    // Loop valid rows
    for (var i=0; i<data.length; i++) {
      if (data[i][4] === true) { // Col 5 is boolean checkbox
         return data[i][0]; // ID is Col 1
      }
    }
    return '';
  };
  
  eq.wing = findDef(CFG.sheets.wings);
  eq.harness = findDef(CFG.sheets.harnesses);
  eq.res1 = findDef(CFG.sheets.reserves);
  // res2? usually same sheet, logic might need check "Second Default?" or just leave blank.
  // For now leave res2 blank.
  
  return eq;
}

function lookupWingSpecs_(wingName) {
  if (!wingName) return { glide:'', trim:'', full:'' };
  var ss = SpreadsheetApp.getActive();
  var sh = ss.getSheetByName(CFG.sheets.wings);
  if (!sh) return { glide:'', trim:'', full:'' };
  
  // Columns: A=ID(0)... F=Glide(5), G=Trim(6), H=Full(7) (?)
  // Let's check scaffoldEquipment_:
  // ['Brand', 'Model', 'Size', 'Color', 'Default?', 'Glide Ratio', 'Trim Speed', 'Full Bar Speed']
  // Indices: 0, 1, 2, 3, 4, 5, 6, 7.
  
  // Ideally use a Finder logic or loop.
  // Performance: Read all data once.
  var data = sh.getRange(2, 1, sh.getLastRow()-1, 8).getValues();
  for (var i=0; i<data.length; i++) {
    if (data[i][0] === wingName) {
      return {
        glide: data[i][5],
        trim: data[i][6],
        full: data[i][7]
      };
    }
  }
  return { glide:'', trim:'', full:'' };
}

function getNextDailyId_(sh, dateStr) {
  // Heuristic: Check last few rows. If they match dateStr, increment suffix.
  // Col 1 is FlightID.
  var maxSuffix = 0;
  // Limit check to last 20 rows for performance
  var lastRow = sh.getLastRow();
  if (lastRow < 6) return '01';
  var startRow = Math.max(6, lastRow - 19);
  var vals = sh.getRange(startRow, 1, lastRow - startRow + 1, 1).getValues();
  
  var prefix = 'F' + dateStr + '_';
  
  for (var i = 0; i < vals.length; i++) {
    var val = String(vals[i][0]);
    if (val.indexOf(prefix) === 0) {
      var suf = parseInt(val.replace(prefix, ''), 10);
      if (!isNaN(suf) && suf > maxSuffix) maxSuffix = suf;
    }
  }
  return ('0' + (maxSuffix + 1)).slice(-2);
}

function friendlyDuration_(sec) {
  var m = Math.round(sec / 60);
  if (m < 60) return m + ' min';
  return (m / 60).toFixed(1) + ' hrs';
}
