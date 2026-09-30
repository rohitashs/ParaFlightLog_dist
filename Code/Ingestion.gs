/**
 * Paragliding Flight Log v2.0
 * Updated: 2026-09-30 14:38:36
 * 
 * MODULE: Ingestion Service
 * Handles Flight Log Parsing, Analysis/Scoring Orchestration, Geo-enrichment,
 * Deduplication (MD5), and Spreadsheet Row Insertion.
 * 
 * Note: File uploads, Watch Folder scanning, and Drive I/O are handled in FileHandling.gs.
 */

var INGESTION = INGESTION || {};

/* ==========================================================================================
   FLIGHT PROCESSING PIPELINE
   ========================================================================================== */

/**
 * Processes a single Drive file (IGC, ZIP, or GZ).
 * Called from FileHandling.gs (processFileById and scanWatchFolderNow_).
 * @param {GoogleAppsScript.Drive.File} file
 * @param {Object} config
 * @return {Object} { processed: boolean, isDuplicate: boolean, count: number }
 */
function processDriveFile_(file, config) {
  var blob = file.getBlob();
  var name = file.getName();
  var id = file.getId();
  
  return processBlob_(blob, name, id, config);
}

/**
 * Processes a Blob, unpacking archives if necessary.
 * @param {GoogleAppsScript.Base.Blob} blob
 * @param {string} fileName
 * @param {string} fileId
 * @param {Object} config
 * @return {Object} { processed: boolean, isDuplicate: boolean, count: number }
 */
function processBlob_(blob, fileName, fileId, config) {
  var lowerName = fileName.toLowerCase();
  var result = { processed: false, count: 0 };
  
  // 1. ZIP Handling
  if (lowerName.endsWith('.zip')) {
    try {
      var zipBlobs = Utilities.unzip(blob);
      var totalInZip = 0;
      var dupeCount = 0;
      zipBlobs.forEach(function(b) {
        var bName = b.getName();
        if (bName.match(/\.(igc|igx)$/i)) {
          totalInZip++;
          var success = processSingleIgcBlob_(b, bName, fileId, fileName, config); // pass outer name
          if (success) {
             result.processed = true;
             result.count++;
          } else {
             dupeCount++;
          }
        }
      });
      if (totalInZip > 0 && dupeCount === totalInZip && result.count === 0) {
        result.isDuplicate = true;
      }
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
      } else {
         result.isDuplicate = true;
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
  } else {
     result.isDuplicate = true;
  }
  return result;
}

/**
 * Core processor for a single IGC blob.
 * Returns true if processed/added, false if skipped (dedupe).
 * @param {GoogleAppsScript.Base.Blob} blob
 * @param {string} fileName
 * @param {string} fileId
 * @param {string} outerName
 * @param {Object} config
 * @return {boolean}
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
     copyToErrorFolder_(blob, fileName, config);
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
  if (geoLaunch && geoLaunch.error) { noteLog.push(geoLaunch.error); }
  if (geoLaunch && geoLaunch.error) { geoLaunch = {}; }
  geoLaunch = geoLaunch || {};

  var siteLaunch = GEO.getNearestSite(launchFix.lat, launchFix.lon, config.OSM_RADIUS_M, config, 'takeoff', launchFix.alt);
  
  var geoLand = GEO.getReverseGeo(landFix.lat, landFix.lon, config);
  if (geoLand && geoLand.error) { noteLog.push(geoLand.error); }
  if (geoLand && geoLand.error) { geoLand = {}; }
  geoLand = geoLand || {};

  var siteLand = GEO.getNearestSite(landFix.lat, landFix.lon, config.OSM_RADIUS_M, config, 'landing', landFix.alt);
  
  // Top landing check: if landing is within 100m of launch and landing site is blank
  if (launchFix && landFix && siteLaunch && !siteLand) {
    var l2lDist = (parsed.stats && typeof parsed.stats.straightDistKm === 'number')
      ? (parsed.stats.straightDistKm * 1000)
      : haversine_(launchFix.lat, launchFix.lon, landFix.lat, landFix.lon);
    if (l2lDist <= 100) {
      siteLand = siteLaunch;
    }
  }
  
  // TimeZone
  var timeZone = GEO.getTimezone(launchFix.lat, launchFix.lon, config);
  if (!timeZone) noteLog.push('Geo/Timezone: Lookup failed, using UTC');
  timeZone = timeZone || 'UTC';
  
  var masterRes = copyToMasterLog_(blob, fileName, config);
  if (masterRes.error) {
     noteLog.push('Master Log Error: ' + masterRes.error);
  }

  // F. XContest Verification
  var xcStatus = { status: '' };
  if (config.XCONTEST_USERNAME) {
     try {
       var flightDateStr = parsed.meta.dateIso || '';
       var durMin = Math.round(parsed.stats.durationSec / 60);
       // Pass UTC start time in minutes (not local time) for XContest matching
       var utcStartMin = Math.round(parsed.stats.startTime / 60);
       xcStatus = XContest.checkFlight(flightDateStr, durMin, utcStartMin, config);
       
       if (xcStatus.status === 'Error') {
          noteLog.push('XC Check: ' + xcStatus.note);
       } else if (xcStatus.status === 'Claim soon!') {
          noteLog.push('XC: Claim soon! (within 14d deadline)');
       } else if (xcStatus.status === 'Expired') {
          noteLog.push('XC: Expired (>14d deadline)');
       }
     } catch(e) { console.warn('XC Check Logic Fail', e); }
  } else {
     noteLog.push('XC: Skipped (No XCONTEST_USERNAME in Parameters)');
  }

  // G. Validation Check
  var status = 'Review?';
  if (scoring.error) {
     status = 'Invalid?';
     noteLog.push('Scoring Error: ' + scoring.error);
  }
  
  if (analysis.validation.status !== 'OK') {
     status = analysis.validation.status;
     if (analysis.validation.reason) noteLog.push(analysis.validation.reason);
  }

  // Override status if duplicate file name
  if (masterRes.isDuplicate) {
    status = 'Duplicate';
    noteLog.push('Duplicate Filename');
  }
  
  // H. Weather Enrichment (RQ-SCR-004)
  var weatherData = null;
  try {
    var flightDateIso = parsed.meta.dateIso || '';
    weatherData = WEATHER.getEnrichment(launchFix, landFix, flightDateIso, parsed.stats.startTime, parsed.stats.endTime, config);
    if (weatherData && weatherData.error) {
      noteLog.push('Weather: ' + weatherData.error);
    }
  } catch (wErr) {
    console.warn('Weather enrichment error:', wErr);
    noteLog.push('Weather: Fetch failed');
  }

  var finalNotes = noteLog.length > 0 ? noteLog.join(' | ') : '';
  
  // I. Insert Flight Row
  insertFlightRow_(parsed, fileId, outerName, status, finalNotes, analysis, scoring, masterRes.finalName, masterRes.fileId, {
    l: geoLaunch, ls: siteLaunch,
    d: geoLand, ds: siteLand,
    tz: timeZone
  }, xcStatus, weatherData);
  
  // I. Mark Hash as Seen & Log
  markHashSeen_(hashStr);
  logImport_(new Date(), fileId, outerName, fileName, 'Success', finalNotes || 'OK');
  
  return true;
}

/* ==========================================================================================
   DEDUPLICATION & AUDIT LOGGING
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
    var lastRow = sh.getLastRow();
    var foundRow = -1;
    
    // Check last 50 rows for existing row to append
    var checkRows = Math.min(lastRow, 50); 
    if (checkRows > 0) {
       var start = Math.max(1, lastRow - checkRows + 1);
       var data = sh.getRange(start, 2, checkRows, 3).getValues();
       
       for (var i = data.length - 1; i >= 0; i--) {
          if (data[i][0] == fileId && data[i][2] == inner) { 
             foundRow = start + i;
             break;
          }
       }
    }
    
    if (foundRow > 0) {
       var cell = sh.getRange(foundRow, 6);
       var curr = cell.getValue();
       var newInfo = curr ? (curr + ' | ' + notes) : notes;
       cell.setValue(newInfo);
       sh.getRange(foundRow, 5).setValue(status);
    } else {
       sh.appendRow([date, fileId, outer, inner, status, notes]);
    }
  }
}

/* ==========================================================================================
   SPREADSHEET ROW INSERTION & LOOKUPS
   ========================================================================================== */

/**
 * Inserts a manual blank flight entry row at Row 5 with smart ID and defaults.
 */
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
 * Inserts the parsed, enriched flight data row into 'Flights' Sheet.
 */
function insertFlightRow_(data, fileId, outerName, status, notes, analysis, scoring, igcFileName, masterFileId, geo, xcStatus, weather) {
  var ss = SpreadsheetApp.getActive();
  var sh = ss.getSheetByName(TABS.FLIGHTS.name);
  
  // Geo Fallbacks
  geo = geo || { l:{}, ls:'', d:{}, ds:'', tz:'UTC' };
  
  // 1. Get Column Map
  var map = getColumnMap_(sh);
  var lastCol = sh.getLastColumn();
  var row = new Array(lastCol).fill('');
  
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
  
  var idSuffix = getNextDailyId_(sh, dateStr);
  var flightId = 'F' + dateStr + '_' + idSuffix;

  var flightNoFormula = '=IFERROR(MAX(INDIRECT("C" & (ROW()+1) & ":C")), 0) + 1';
  
  // Auto Summary
  var site = geo.ls || geo.l.town || '';
  var durFriendly = friendlyDuration_(data.stats.durationSec);
  var maxAlt = analysis.stats.maxAlt ? analysis.stats.maxAlt.toFixed(0) + 'm' : '';
  var autoSummary = durFriendly + ' ' + (scoring.flightType || 'Free Fly') + (site ? ' at ' + site : '') + ' ' + maxAlt;

  // Times
  var config = getParameters_();
  var timeFmt = config.TIME_FORMAT || 'HH:mm';
  
  var startTimeTz = GEO.formatInTimezone(new Date(data.stats.startTime * 1000), geo.tz, timeFmt);
  var endTimeTz = '';
  var tEnd = data.stats.endTime;
  if (!tEnd || isNaN(tEnd)) { tEnd = data.stats.startTime + data.stats.durationSec; }
  if (tEnd && !isNaN(tEnd)) {
     endTimeTz = GEO.formatInTimezone(new Date(tEnd * 1000), geo.tz, timeFmt);
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
  var flightIdVal = flightId;
  if (masterFileId) {
    var config = getParameters_();
    var dlPattern = config.GDRIVE_DOWNLOAD_URL_PATTERN;
    var syPattern = config.SEEYOU_CLOUD_URL_PATTERN;
    if (dlPattern && syPattern) {
       var directUrl = dlPattern.replace('{ID}', masterFileId);
       var syUrl = syPattern.replace('{URL}', encodeURIComponent(directUrl));
       flightIdVal = '=HYPERLINK("' + syUrl + '", "' + flightId + '")';
    }
  }

  // Direct Download Link for IGC File
  var igcFileVal = igcFileName;
  if (masterFileId) {
    var config = config || getParameters_();
    var dlPattern = (config && config.GDRIVE_DOWNLOAD_URL_PATTERN) || 'https://drive.google.com/uc?export=download&id={ID}';
    var directDlUrl = dlPattern.replace('{ID}', masterFileId);
    igcFileVal = '=HYPERLINK("' + directDlUrl + '", "' + (igcFileName || 'Download') + '")';
  }

  setVal('FlightID', flightIdVal);
  setVal('Status', status);
  setVal('Flight No', flightNoFormula);
  setVal('Auto Summary', autoSummary);
  setVal('IGC File', igcFileVal);
  setVal('Notes', notes);
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

  // -- XContest --
  if (xcStatus && xcStatus.status) {
     var val = xcStatus.status;
     if (val === 'Yes' && xcStatus.url) {
        var label = xcStatus.label || 'Yes';
        val = '=HYPERLINK("' + xcStatus.url + '", "' + label + '")';
     } else if (val === 'No Username') {
        val = '';
     }
     setVal('XContest', val);
  }

  // -- XC Scoring --
  var sc = scoring || {}; 
  var best = sc.best || {};
  var free = sc.free || {};
  var tri  = sc.triangle || {};

  setVal('XC Distance (km)', best.dist ? best.dist.toFixed(1) : (free.dist ? free.dist.toFixed(1) : ''));
  setVal('XC Score', best.score ? best.score.toFixed(1) : '');
  setVal('XC Flight Class', best.type || '');
  setVal('FAI Triangle (km)', (tri.valid && tri.dist) ? tri.dist.toFixed(1) : '');
  setVal('Points (World)', best.pointsWorld ? best.pointsWorld.toFixed(1) : '');
  setVal('Points (National)', best.score ? best.score.toFixed(1) : '');
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
  var launchLandDist = (data.stats && typeof data.stats.straightDistKm === 'number')
    ? data.stats.straightDistKm.toFixed(1)
    : '';
  setVal('Launch-Landing Dist (km)', launchLandDist);

  // -- Weather (RQ-SCR-004) --
  var wx = weather || {};
  setVal('Wind@Launch', wx.windLaunch || '');
  setVal('Wind@Landing', wx.windLanding || '');
  setVal('Cloud %', wx.cloudPct || '');
  setVal('Cloudbase', wx.cloudbase || '');
  setVal('Temp (C)', wx.tempC || '');
  setVal('Observations', wx.observations || '');

  // -- Analytics --
  setVal('Thermal %', (pct.thermal * 100).toFixed(2) + '%');
  setVal('Thermals Count', raw.thermal.count);
  setVal('Thermal Avg (m/s)', raw.thermal.avg.toFixed(1));
  setVal('Thermal Best (m/s)', raw.thermal.best.toFixed(1));
  setVal('Soar %', (pct.soar * 100).toFixed(2) + '%');
  setVal('Efficiency', raw.soar.efficiency || '');
  setVal('Glide %', (pct.glide * 100).toFixed(2) + '%');
  setVal('Glide L/D', raw.glide.ld || '');
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
  if (sh.getLastRow() < 5) return 1;
  var val = sh.getRange(5, 2).getValue();
  return (typeof val === 'number') ? val + 1 : 1;
}

function getPreviousGear_(sh) {
  if (sh.getLastRow() < 5) return {};
  
  var map = getColumnMap_(sh);
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

function lookupDefaultEquipment_() {
  var ss = SpreadsheetApp.getActive();
  var eq = { wing: '', harness: '', res1: '', res2: '' };
  
  var sh = ss.getSheetByName(TABS.EQUIPMENT.name);
  if (!sh || sh.getLastRow() < 2) return eq;
  
  var data = sh.getRange(2, 1, sh.getLastRow()-1, 7).getValues();
  
  for (var i=0; i<data.length; i++) {
    var type = String(data[i][0]).toLowerCase();
    var id = data[i][1];
    var isDef = data[i][6];
    
    if (isDef === true) {
      if (type === 'wing') eq.wing = id;
      if (type === 'harness') eq.harness = id;
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
  var lastRow = sh.getLastRow();
  if (lastRow < 5) return '01';
  
  var numRows = lastRow - 4;
  if (numRows <= 0) return '01';
  
  var map = getColumnMap_(sh);
  var col = map['FlightID'] || 1;
  
  var vals = sh.getRange(5, col, numRows, 1).getDisplayValues();
  var prefix = 'F' + dateStr + '_';
  var maxSuffix = 0;
  
  for (var i = 0; i < vals.length; i++) {
    var val = String(vals[i][0]).trim();
    if (val.indexOf(prefix) === 0) {
      var sufStr = val.substring(prefix.length);
      var suf = parseInt(sufStr, 10);
      if (!isNaN(suf) && suf > maxSuffix) {
        maxSuffix = suf;
      }
    }
  }
  
  var nextNum = maxSuffix + 1;
  return (nextNum < 10) ? ('0' + nextNum) : String(nextNum);
}

// Export to INGESTION namespace
INGESTION.processDriveFile = processDriveFile_;
INGESTION.processBlob = processBlob_;
INGESTION.processSingleIgcBlob = processSingleIgcBlob_;
INGESTION.insertFlightRow = insertFlightRow_;
INGESTION.uiAddManualFlight = uiAddManualFlight_;
