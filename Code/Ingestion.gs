/**
 * Paragliding Flight Log v2.0
 * Updated: 2026-02-09 19:35:59
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
  var stats = { processed: 0, skipped: 0, errors: 0, log: [] };
  
  console.log('Starting Watch Folder Scan...');
  var config = getParameters_();
  var folderId = config.WATCH_FOLDER_ID;
  
  // Check Enable Switch (Handle boolean or string)
  var enabled = String(config.ENABLE_WATCH_FOLDER).toUpperCase();
  console.log('Watch Config: Enable=' + enabled + ', FolderID=' + folderId);

  if (enabled !== 'TRUE' && enabled !== 'YES') {
     var msg = 'Watch Folder is DISABLED in Config. Skipping.';
     console.warn(msg);
     stats.log.push(msg);
     return stats;
  }
  
  if (!folderId) {
    var msg = 'No Watch Folder ID configured.';
    console.error(msg);
    stats.log.push(msg);
    stats.errors++;
    return stats;
  }
  
  try {
    var folder = DriveApp.getFolderById(folderId);
    var files = folder.getFiles();
    var maxProcess = 5; // Cap to avoid timeouts per execution
    var foundAny = false;
    
    while (files.hasNext() && stats.processed < maxProcess) {
      foundAny = true;
      var file = files.next();
      var fId = file.getId();
      var fName = file.getName();
      
      // We process .igc, .igx, .zip, .gz
      if (fName.match(/\.(igc|igx|zip|gz)$/i)) {
         console.log('Checking file: ' + fName);
         try {
           var result = processDriveFile_(file, config);
           if (result && result.processed) {
             console.log('Processed: ' + fName);
             stats.processed++;
             stats.log.push('Processed: ' + fName);
           } else {
             console.log('Skipped (Duplicate/Error): ' + fName);
             stats.skipped++;
             stats.log.push('Skipped: ' + fName);
           }
         } catch (e) {
           logImport_(new Date(), fId, fName, fName, 'Scan Error', e.message);
           console.error('Error processing ' + fName, e);
           stats.errors++;
           stats.log.push('Error (' + fName + '): ' + e.message);
         }
      } else {
         // console.log('Ignored file type: ' + fName);
      }
    }
    
    if (!foundAny) {
      stats.log.push('Watch Folder is empty.');
    } else if (stats.processed === 0 && stats.skipped === 0 && stats.errors === 0) {
      stats.log.push('No relevant files found (only ignored types).'); 
    }
    
  } catch (e) {
    console.error('Watch Scan Error:', e);
    stats.errors++;
    stats.log.push('Fatal Error: ' + e.message);
  }
  
  return stats;
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
  
  var config = getParameters_();
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
    logImport_(new Date(), 'Manual URL/ID', 'UI Import', input, 'Error', e.message);
    ui.alert('Import Failed: ' + e.message);
  }
}

/**
 * Called from UrlEntry.html
 * Returns object { success: true } or { error: 'msg' }
 */
function handleUrlImportAction(url) {
  try {
    var config = getParameters_();
    if (!url) throw new Error('No URL provided');
    
    // Check if it's a Drive ID or URL
    var driveId = getDriveIdFromUrl_(url);
    if (driveId) {
       // Drive File
       var file = DriveApp.getFileById(driveId);
       var res = processDriveFile_(file, config);
       if (!res.processed) return { error: 'Skipped (Duplicate or Error)' };
       return { success: true };
    } else {
       // Direct Import
       // Use a simple context
       var res = handleUrlImport_(url, { source: 'Dialog' }, config);
       if (!res.processed) return { error: 'Skipped (Duplicate or Error)' };
       return { success: true };
    }
  } catch (e) {
    console.error('handleUrlImportAction Error', e);
    return { error: e.message };
  }
}


/**
 * Handle Client-Side Upload (Base64)
 * files = [ { name: 'foo.igc', data: 'base64...', type: 'application/...' }, ... ]
 */
function handleClientSideUpload(files) {
  var config = getParameters_();
  var folderId = config.UPLOAD_FOLDER_ID;
  var folder;
  
  try {
    if (folderId) {
      folder = DriveApp.getFolderById(folderId);
    } else {
      folder = DriveApp.getRootFolder();
    }
  } catch (e) {
    return { error: 'Invalid Upload Folder ID: ' + e.message };
  }
  
  var results = { uploaded: 0, processed: 0, flights: 0, errors: [], log: [] };
  
  if (!files || !Array.isArray(files)) {
      return { error: 'Invalid data format (expected array)' };
  }
  
  results.log.push('Received ' + files.length + ' files via Client-Side Upload');
  
  for (var i = 0; i < files.length; i++) {
    var f = files[i];
    if (!f.data || !f.name) continue;
    
    try {
      // Decode Base64
      var decoded = Utilities.base64Decode(f.data);
      var blob = Utilities.newBlob(decoded, f.type || 'application/octet-stream', f.name);
      
      var file = folder.createFile(blob);
      results.uploaded++;
      
      var res = processDriveFile_(file, config);
      if (res && res.processed) {
         results.processed++;
         // Use accumulated count if available (for ZIPs), else 1
         var count = res.count || 1; 
         results.flights += count;
         results.log.push('Success: ' + f.name + ' (' + count + ' flights)');
      } else {
         results.errors.push(f.name + ': Skipped');
         results.log.push('Skipped: ' + f.name);
      }
    } catch (e) {
      results.errors.push(f.name + ': ' + e.message);
      results.log.push('Error: ' + f.name + ' ' + e.message);
    }
  }
  
  return results;
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
  var result = { processed: false, count: 0 };
  
  // 1. ZIP Handling
  if (lowerName.endsWith('.zip')) {
    try {
      var zipBlobs = Utilities.unzip(blob);
      zipBlobs.forEach(function(b) {
        var bName = b.getName();
        if (bName.match(/\.(igc|igx)$/i)) {
          var success = processSingleIgcBlob_(b, bName, fileId, fileName, config); // pass outer name
          if (success) {
             result.processed = true;
             result.count++;
          }
        }
      });
    } catch (e) {
      console.warn('ZIP extraction failed: ' + fileName, e);
    }
    return result;
  }
  
  // 2. GZIP Handling
  if (lowerName.endsWith('.gz')) {
    try {
      var rawBlob = Utilities.gunzip(blob);
      var innerName = fileName.replace(/\.gz$/i, '');
      var success = processSingleIgcBlob_(rawBlob, innerName, fileId, fileName, config);
      if (success) {
         result.processed = true;
         result.count = 1;
      }
    } catch (e) {
       console.warn('GZIP failed', e);
    }
    return result;
  }
  
  // 3. Plain IGC
  var success = processSingleIgcBlob_(blob, fileName, fileId, fileName, config);
  if (success) {
     result.processed = true;
     result.count = 1;
  }
  return result;
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
  
  var noteLog = []; // Accumulate notes here
  
  // D. Geo Enrichment
  var launchFix = parsed.fixes[0];
  var landFix = parsed.fixes[parsed.fixes.length-1];
  var geoLaunch = GEO.getReverseGeo(launchFix.lat, launchFix.lon, config);
  if (geoLaunch && geoLaunch.error) { noteLog.push(geoLaunch.error); } // Don't null it out, just log error.
  geoLaunch = geoLaunch || {}; // But if it was an error object, it's still an object. We might need to handle empty fields in row push.
  // Actually getReverseGeo now returns { error: ... } OR valid object.
  // If error, we want to log it, but treat data as empty.
  if (geoLaunch.error) { geoLaunch = {}; } 

  var siteLaunch = GEO.getNearestSite(launchFix.lat, launchFix.lon, config.OSM_RADIUS_M, config);
  
  var geoLand = GEO.getReverseGeo(landFix.lat, landFix.lon, config);
  if (geoLand && geoLand.error) { noteLog.push(geoLand.error); }
  if (geoLand.error) { geoLand = {}; }
  geoLand = geoLand || {};

  var siteLand = GEO.getNearestSite(landFix.lat, landFix.lon, config.OSM_RADIUS_M, config);
  
  // TimeZone
  var timeZone = GEO.getTimezone(launchFix.lat, launchFix.lon, config); // Pass config
  if (!timeZone) noteLog.push('Geo/Timezone: Lookup failed, using UTC');
  timeZone = timeZone || 'UTC';
  
  // E. Validation Check
  var status = 'Needs review';
  // notes handled by array
  
  if (analysis.validation.status !== 'OK') {
     status = analysis.validation.status;
     if (analysis.validation.reason) noteLog.push(analysis.validation.reason);
  }
  
  var finalNotes = noteLog.length > 0 ? noteLog.join(' | ') : '';
  
  // F. Insert Flight
  insertFlightRow_(parsed, fileId, outerName, status, finalNotes, analysis, scoring, {
    l: geoLaunch, ls: siteLaunch,
    d: geoLand, ds: siteLand,
    tz: timeZone
  });
  
  // G. Mark Hard Hash as Seen
  markHashSeen_(hashStr);
  logImport_(new Date(), fileId, outerName, fileName, 'Success', finalNotes || 'OK');
  
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
  var sh = ss.getSheetByName(TABS.APP_LOG.name);
  if (sh) {
    sh.appendRow([date, fileId, outer, inner, status, notes]);
  }
}

function uiAddManualFlight_() {
  var ss = SpreadsheetApp.getActive();
  var sh = ss.getSheetByName(TABS.FLIGHTS.name);
  if (!sh) return;
  
  // 1. Generate ID
  var dateObj = new Date();
  var yyyy = dateObj.getFullYear();
  var mm = ('0' + (dateObj.getMonth() + 1)).slice(-2);
  var dd = ('0' + dateObj.getDate()).slice(-2);
  var dateStr = yyyy + mm + dd;
  var idSuffix = getNextDailyId_(sh, dateStr);
  var flightId = 'F' + dateStr + '_' + idSuffix;
  
  // 2. Flight No Formula
  var flightNoFormula = '=IFERROR(MAX(INDIRECT("C" & (ROW()+1) & ":C")), 0) + 1';
  
  // 3. Defaults
  var eq = lookupDefaultEquipment_();
  var prevGear = getPreviousGear_(sh);
  
  // 4. Map to Columns safely
  var map = getColumnMap_(sh);
  var lastCol = sh.getLastColumn();
  var row = new Array(lastCol).fill('');
  
  var setVal = function(header, value) {
    if (map[header]) {
      row[map[header] - 1] = value;
    }
  };
  
  setVal('FlightID', flightId);
  setVal('Status', 'Needs Review');
  setVal('Flight No', flightNoFormula);
  setVal('Auto Summary', 'Manual Entry');
  setVal('Notes', '');
  setVal('Flight Type', 'Free Fly');
  setVal('Date', dateObj);
  setVal('Time Zone', Session.getScriptTimeZone());
  setVal('Launch Time', formatTime_(dateObj.getTime()/1000));
  
  setVal('Wing', prevGear.wing || eq.wing);
  setVal('Harness', prevGear.harness || eq.harness);
  setVal('Reserve 1', prevGear.res1 || eq.res1);
  setVal('Reserve 2', prevGear.res2 || eq.res2);
  
  sh.insertRowBefore(5);
  sh.getRange(5, 1, 1, row.length).setValues([row]);
  SpreadsheetApp.flush();
}

/**
 * Inserts the Data Row into 'Flights' Sheet.
 */
function insertFlightRow_(data, fileId, outerName, status, notes, analysis, scoring, geo) {
  var ss = SpreadsheetApp.getActive();
  var sh = ss.getSheetByName(TABS.FLIGHTS.name);
  
  // Geo Fallbacks
  geo = geo || { l:{}, ls:'', d:{}, ds:'', tz:'UTC' };
  
  // 1. Get Column Map
  var map = getColumnMap_(sh);
  var lastCol = sh.getLastColumn();
  // Initialize empty row array
  var row = new Array(lastCol).fill('');
  
  // Helper to set value safely
  var setVal = function(header, value) {
    if (map[header]) {
      row[map[header] - 1] = value;
    } else {
      console.warn('Column not found: ' + header);
    }
  };

  // 2. Prepare Data
  var dateObj = new Date(data.meta.dateIso || Date.now());
  var yyyy = dateObj.getFullYear();
  var mm = ('0' + (dateObj.getMonth() + 1)).slice(-2);
  var dd = ('0' + dateObj.getDate()).slice(-2);
  var dateStr = yyyy + mm + dd;
  
  // Find next suffix for this date
  var idSuffix = getNextDailyId_(sh, dateStr);
  var flightId = 'F' + dateStr + '_' + idSuffix;

  var flightNoFormula = '=IFERROR(MAX(INDIRECT("C" & (ROW()+1) & ":C")), 0) + 1';
  
  // Auto Summary
  var site = geo.ls || geo.l.town || '';
  var durFriendly = friendlyDuration_(data.stats.durationSec);
  var maxAlt = analysis.stats.maxAlt ? analysis.stats.maxAlt.toFixed(0) + 'm' : '';
  var autoSummary = durFriendly + ' ' + (scoring.flightType || 'Free Fly') + (site ? ' at ' + site : '') + ' ' + maxAlt;

  // Times
  var startTimeTz = GEO.formatInTimezone(new Date(data.stats.startTime * 1000), geo.tz, 'HH:mm');
  var endTimeTz = '';
  var tEnd = data.stats.endTime;
  if (!tEnd || isNaN(tEnd)) { tEnd = data.stats.startTime + data.stats.durationSec; }
  if (tEnd && !isNaN(tEnd)) {
     endTimeTz = GEO.formatInTimezone(new Date(tEnd * 1000), geo.tz, 'HH:mm');
  }

  // Duration
  var durMin = Math.round(data.stats.durationSec / 60);
  var durStr = Math.floor(durMin / 60) + ':' + ('0' + (durMin % 60)).slice(-2);

  // Defaults
  var prevGear = getPreviousGear_(sh);
  var defGear = lookupDefaultEquipment_();
  var wingStr = prevGear.wing || defGear.wing || '';
  var wSpecs = lookupWingSpecs_(wingStr);

  // Analytics
  var pct = analysis.modes.pct;
  var raw = analysis.modes.raw;

  // 3. Map Data to Headers
  
  // -- Flight Info --
  setVal('FlightID', flightId);
  setVal('Status', status);
  setVal('Flight No', flightNoFormula);
  setVal('Auto Summary', autoSummary);
  setVal('Notes', ''); // Blank for user
  setVal('Flight Type', scoring.flightType || 'Free Fly');
  setVal('Date', data.meta.dateIso);
  setVal('Time Zone', geo.tz || 'UTC');
  setVal('Launch Time', startTimeTz);
  setVal('Landing Time', endTimeTz);
  setVal('Flight Duration', durStr);
  setVal('Track Length (km)', (data.stats.trackLenKm).toFixed(1));
  setVal('Straight Dist (km)', (data.stats.straightDistKm || 0).toFixed(1));

  // -- Gear --
  setVal('Wing', wingStr);
  setVal('Harness', prevGear.harness || defGear.harness || '');
  setVal('Reserve 1', prevGear.res1 || defGear.res1 || '');
  setVal('Reserve 2', prevGear.res2 || defGear.res2 || '');
  setVal('Other equipment', '');
  setVal('GlideRatio_LD (snap)', wSpecs.glide);
  setVal('Trim_kmh (snap)', wSpecs.trim);
  setVal('FullBar_kmh (snap)', wSpecs.full);

  // -- XC Scoring --
  // Use scoring object or default to empty
  var sc = scoring || {}; 
  var best = sc.best || {};
  var free = sc.free || {};
  var tri  = sc.triangle || {};

  setVal('XC Distance (km)', best.dist ? best.dist.toFixed(1) : (free.dist ? free.dist.toFixed(1) : ''));
  setVal('XC Score', best.score ? best.score.toFixed(1) : '');
  setVal('XC Flight Class', best.type || '');
  setVal('FAI Triangle (km)', (tri.valid && tri.dist) ? tri.dist.toFixed(1) : '');
  setVal('Points (World)', best.pointsWorld ? best.pointsWorld.toFixed(1) : '');
  setVal('Points (National)', best.score ? best.score.toFixed(1) : ''); // Map national to score for now
  setVal('Closed?', tri.closed ? 'Yes' : 'No');
  
  setVal('Max Alt (m)', analysis.stats.maxAlt.toFixed(1));
  setVal('Min Alt (m)', analysis.stats.minAlt.toFixed(1));
  setVal('Total Height Gain (m)', (analysis.stats.maxAlt - analysis.stats.minAlt).toFixed(1));
  setVal('Max Ascent (m/s)', analysis.stats.maxClimb.toFixed(1));
  setVal('Max Descent (m/s)', analysis.stats.maxSink.toFixed(1));
  setVal('Max Groundspeed (km/h)', analysis.stats.maxGs.toFixed(1));
  setVal('Avg Groundspeed (km/h)', analysis.stats.avgGs.toFixed(1));

  // -- Launch --
  setVal('Launch Alt (m)', data.fixes[0].alt.toFixed(1));
  setVal('Launch Lat', data.fixes[0].lat);
  setVal('Launch Lon', data.fixes[0].lon);
  setVal('Launch Site', geo.ls);
  setVal('Launch Town', geo.l.town || '');
  setVal('Launch Country', geo.l.country || '');
  setVal('Launch Region', geo.l.region || '');

  // -- Landing --
  var landFix = data.fixes[data.fixes.length-1];
  setVal('Landing Alt (m)', landFix.alt.toFixed(1));
  setVal('Landing Lat', landFix.lat);
  setVal('Landing Lon', landFix.lon);
  setVal('Landing Site', geo.ds);
  setVal('Landing Town', geo.d.town || '');
  setVal('Landing Country', geo.d.country || '');
  setVal('Landing Region', geo.d.region || '');
  setVal('Launch-Landing Dist (km)', analysis.stats.straightDistKm ? analysis.stats.straightDistKm.toFixed(1) : '');

  // -- Weather (Blank) --
  // 'Wind@Launch', 'Wind@Landing', 'Cloud %', 'Cloudbase', 'Temp (C)', 'Observations'

  // -- Analytics --
  setVal('Thermal %', (pct.thermal * 100).toFixed(2) + '%');
  setVal('Thermals Count', raw.thermal.count);
  setVal('Thermal Avg (m/s)', raw.thermal.avg.toFixed(1));
  setVal('Thermal Best (m/s)', raw.thermal.best.toFixed(1));
  setVal('Soar %', (pct.soar * 100).toFixed(2) + '%');
  setVal('Glide %', (pct.glide * 100).toFixed(2) + '%');
  setVal('Sink %', (pct.sink * 100).toFixed(2) + '%');
  setVal('Sink Time', Math.round(raw.sink.time/60) + ' min');

  // -- Validation --
  setVal('Validation Status', analysis.validation.status);
  setVal('Val: Reason', analysis.validation.reason);

  // -- Meta --
  setVal('Import File', outerName);
  setVal('Import ID', fileId);
  setVal('Timestamp', new Date());
  setVal('Parser Ver', 'v2.0');

  // Insert
  sh.insertRowBefore(5);
  sh.getRange(5, 1, 1, row.length).setValues([row]);
}

function getNextFlightNo_(sh) {
  // Check row 5 (previous top)
  if (sh.getLastRow() < 5) return 1;
  var val = sh.getRange(5, 2).getValue(); // Col 2 is Flight No
  return (typeof val === 'number') ? val + 1 : 1;
}

function getPreviousGear_(sh) {
  if (sh.getLastRow() < 5) return {};
  
  var map = getColumnMap_(sh);
  // Default to old locations (14,15,16,17) if map fails, but prefer map.
  var colW = map['Wing'] || 14;
  var colH = map['Harness'] || 15;
  var colR1 = map['Reserve 1'] || 16;
  var colR2 = map['Reserve 2'] || 17;
  
  var lastRowData = sh.getRange(5, 1, 1, sh.getLastColumn()).getValues()[0];
  
  return {
    wing: lastRowData[colW-1],
    harness: lastRowData[colH-1],
    res1: lastRowData[colR1-1],
    res2: lastRowData[colR2-1]
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
  
  var sh = ss.getSheetByName(TABS.EQUIPMENT.name);
  if (!sh || sh.getLastRow() < 2) return eq;
  
  // Data: A2:LastCol. 
  // Cols: Category(A/0), ID(B/1), ... Type(F/5), Default?(G/6)
  // Indices: 0=Cat, 1=ID, 6=Default
  var data = sh.getRange(2, 1, sh.getLastRow()-1, 7).getValues();
  
  for (var i=0; i<data.length; i++) {
    var type = String(data[i][0]).toLowerCase(); // Wing, Harness, Reserve...
    var id = data[i][1];
    var isDef = data[i][6]; // Col G (index 6)
    
    if (isDef === true) {
      if (type === 'wing') eq.wing = id;
      if (type === 'harness') eq.harness = id;
      // Reserve logic: if we have multiple default reserves? 
      // Populate res1 then res2.
      if (type === 'reserve') {
         if (!eq.res1) eq.res1 = id;
         else if (!eq.res2) eq.res2 = id;
      }
    }
  }
  return eq;
}

function lookupWingSpecs_(wingID) {
  if (!wingID) return { glide:'', trim:'', full:'' };
  var ss = SpreadsheetApp.getActive();
  var sh = ss.getSheetByName(TABS.EQUIPMENT.name);
  if (!sh || sh.getLastRow() < 2) return { glide:'', trim:'', full:'' };
  
  // Data: A2:LastCol. 
  // Col 2 (B) is EquipmentID. 
  // Cols: Glide(I/8), Trim(J/9), Full(K/10)
  // Indices (0-based): ID=1, Glide=8, Trim=9, Full=10
  var data = sh.getRange(2, 1, sh.getLastRow()-1, 11).getValues();
  
  for (var i=0; i<data.length; i++) {
    if (data[i][1] === wingID) {
      return {
        glide: data[i][8],
        trim: data[i][9],
        full: data[i][10]
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

function isHashSeen_(hashStr) {
  var p = PropertiesService.getDocumentProperties();
  return p.getProperty('HASH_' + hashStr) === '1';
}

function markHashSeen_(hashStr) {
  var p = PropertiesService.getDocumentProperties();
  p.setProperty('HASH_' + hashStr, '1');
}
