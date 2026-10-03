/**
 * Paragliding Flight Log v2.0
 * Updated: 2026-10-03 01:40:27
 * 
 * MODULE: Ingestion Service
 * Handles Flight Log Parsing, Analysis/Scoring Orchestration, Geo-enrichment,
 * Deduplication (MD5), and Spreadsheet Row Insertion.
 * 
 * Note: File uploads, Watch Folder scanning, and Drive I/O are handled in FileHandling.gs.
 * 
 * @design Docs/Design/DSGN-CORE-001_Flight_Ingestion_and_Deduplication_Engine.md
 * @architecture Docs/Architecture/Views/01_Functional_View.md#21-subsystem-1-intelligent-flight-ingestion--extraction
 * @revision Rev 2.1
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
function processDriveFile_(file, config, processSource) {
  var blob = file.getBlob();
  var name = file.getName();
  var id = file.getId();
  
  return processBlob_(blob, name, id, config, processSource);
}

/**
 * Processes a Blob, unpacking archives if necessary.
 * @param {GoogleAppsScript.Base.Blob} blob
 * @param {string} fileName
 * @param {string} fileId
 * @param {Object} config
 * @param {string} [processSource]
 * @return {Object} { processed: boolean, isDuplicate: boolean, count: number }
 */
function processBlob_(blob, fileName, fileId, config, processSource) {
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
          var success = processSingleIgcBlob_(b, bName, fileId, fileName, config, processSource); // pass outer name
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
      var success = processSingleIgcBlob_(rawBlob, innerName, fileId, fileName, config, processSource);
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
  var success = processSingleIgcBlob_(blob, fileName, fileId, fileName, config, processSource);
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
 * @param {string} [processSource] - Optional process key (e.g. 'WATCH_FOLDER', 'URL_IMPORT', 'MASTER_RESYNC')
 * @return {boolean}
 */
function processSingleIgcBlob_(blob, fileName, fileId, outerName, config, processSource) {
  var procKey = processSource || 'FILE_UPLOAD';
  var text = blob.getDataAsString();
  var ss = SpreadsheetApp.getActive();
  var sh = ss ? ss.getSheetByName(TABS.FLIGHTS.name) : null;
  
  // A. Dedupe Check (MD5 against active sheet)
  var hash = Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, text);
  var hashStr = hash.map(function(b) { return ('0' + (b & 0xFF).toString(16)).slice(-2); }).join('');
  
  if (isHashSeen_(hashStr, sh)) {
    LOG.write(procKey, '[DUPE] ' + fileName, (fileId ? 'FileID: ' + fileId + ' | ' : '') + 'Skipped (Already in Flights)');
    return false;
  }
  
  // B. Parse
  var parsed = PARSER.parseIgc(text, fileName);
  if (!parsed) {
     LOG.write(procKey, '[ERR] ' + fileName, (fileId ? 'FileID: ' + fileId + ' | ' : '') + 'Invalid IGC structure');
     copyToErrorFolder_(blob, fileName, config);
     return false;
  }
  
  // C. Analysis & Scoring
  var analysis = ANALYSIS.analyzeFlight(parsed.fixes, config);
  var scoring = SCORING.calculateXcScore(parsed.fixes, config);
  
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
  
  // E. Master Log copy / smart re-link
  var masterRes = copyToMasterLog_(blob, fileName, config, hashStr);
  if (masterRes.error) {
     noteLog.push('Master Log Error: ' + masterRes.error);
  } else if (masterRes.isExactMasterMatch) {
     noteLog.push('Re-linked to existing Master IGC');
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

  // G. Status Determination & Heuristic Overlap
  var status = 'Review?';
  if (scoring.error) {
     status = 'Invalid?';
     noteLog.push('Scoring Error: ' + scoring.error);
  }
  
  if (analysis.validation.status !== 'OK') {
     status = analysis.validation.status;
     if (analysis.validation.reason) noteLog.push(analysis.validation.reason);
  }

  // Check Master Folder drift: if master had a file with this name without a flight row, self-heal drift
  if (masterRes.isDuplicate && !masterRes.isExactMasterMatch && masterRes.existingMasterFileId && sh) {
    try {
      var isSeen = masterRes.existingMasterHash ? isHashSeen_(masterRes.existingMasterHash, sh) : false;
      if (!isSeen) {
        // Restore orphaned master log so both flights exist in the logbook and can be evaluated
        restoreSingleMasterFlight(masterRes.existingMasterFileId);
      }
    } catch (driftErr) {
      console.warn('Drift self-heal check warning:', driftErr);
    }
  }

  // Check Heuristic Overlap
  var overlapInfo = null;
  if (status !== 'Invalid?') {
    overlapInfo = findHeuristicOverlap_(parsed, launchFix, text, fileName, timeZone, sh, config);
    if (overlapInfo && overlapInfo.matched) {
      status = overlapInfo.incomingStatus;
      if (overlapInfo.incomingNote) {
        noteLog.push(overlapInfo.incomingNote);
      }
    }
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
  var inserted = insertFlightRow_(parsed, fileId, outerName, status, finalNotes, analysis, scoring, masterRes.finalName, masterRes.fileId, {
    l: geoLaunch, ls: siteLaunch,
    d: geoLand, ds: siteLand,
    tz: timeZone
  }, xcStatus, weatherData, hashStr);
  
  // If overlap detected, update the paired existing row now that we have incoming flightId
  if (overlapInfo && overlapInfo.matched && inserted && inserted.flightId && sh) {
    updatePairedFlightRow_(sh, overlapInfo, inserted.flightId);
  }

  // J. Mark Hash as Seen & Log
  markHashSeen_(hashStr, 5);
  LOG.write(procKey, '[OK] ' + fileName, (fileId ? 'FileID: ' + fileId + ' | ' : '') + (finalNotes || 'OK'));
  
  return true;
}

/* ==========================================================================================
   DEDUPLICATION & AUDIT LOGGING
   ========================================================================================== */

var _cachedSheetHashes = null;

/**
 * Reads existing MD5 hashes from the 'IGC Hash' column in the Flights sheet.
 * Returns an object mapping hash -> row number.
 * @param {GoogleAppsScript.Spreadsheet.Sheet} [sh]
 * @return {Object<string, number>}
 */
function getExistingSheetHashes_(sh) {
  var ss = SpreadsheetApp.getActive();
  sh = sh || (ss ? ss.getSheetByName(TABS.FLIGHTS.name) : null);
  var hashes = {};
  if (!sh || sh.getLastRow() < 5) return hashes;

  var map = getColumnMap_(sh);
  var hashCol = map['IGC Hash'];
  if (!hashCol) return hashes;

  var numRows = sh.getLastRow() - 4;
  var values = sh.getRange(5, hashCol, numRows, 1).getValues();
  for (var i = 0; i < values.length; i++) {
    var h = String(values[i][0] || '').trim().toLowerCase();
    if (h) {
      hashes[h] = 5 + i;
    }
  }
  return hashes;
}

/**
 * Gets cached sheet hashes or loads from sheet if not yet cached or forceRefresh is true.
 * @param {GoogleAppsScript.Spreadsheet.Sheet} [sh]
 * @param {boolean} [forceRefresh]
 * @return {Object<string, number>}
 */
function getCachedSheetHashes_(sh, forceRefresh) {
  if (_cachedSheetHashes === null || forceRefresh) {
    _cachedSheetHashes = getExistingSheetHashes_(sh);
  }
  return _cachedSheetHashes;
}

/**
 * Checks if a hash is present in the sheet's IGC Hash column (via memory cache).
 * @param {string} hashStr
 * @param {GoogleAppsScript.Spreadsheet.Sheet} [sh]
 * @return {boolean}
 */
function isHashSeen_(hashStr, sh) {
  if (!hashStr) return false;
  hashStr = String(hashStr).trim().toLowerCase();
  var cached = getCachedSheetHashes_(sh);
  if (cached && cached[hashStr]) {
    return true;
  }
  return false;
}

/**
 * Marks a hash as seen in the memory cache.
 * @param {string} hashStr
 * @param {number} [rowNum]
 */
function markHashSeen_(hashStr, rowNum) {
  if (!hashStr) return;
  hashStr = String(hashStr).trim().toLowerCase();
  if (_cachedSheetHashes === null) {
    _cachedSheetHashes = {};
  }
  _cachedSheetHashes[hashStr] = rowNum || true;
}

/* ==========================================================================================
   HEURISTIC FLIGHT QUALITY SCORING & OVERLAP DETECTION
   ========================================================================================== */

/**
 * Scores the data quality of a flight on a 0-100 scale.
 * Preference:
 * 1. Device/Software: XCTrack (40 pts), Vario/Instrument (30 pts), Generic/App (20 pts), Other (10 pts)
 * 2. Barometric Altitude: Fixes have genuine baro altitude (up to 30 pts)
 * 3. Temporal Resolution & Duration: Fix interval <= 1s (15 pts), flight duration (up to 5 pts)
 * 4. Metadata Richness: Glider, pilot, logger info populated (10 pts)
 * 
 * @param {Object} parsed - Result of PARSER.parseIgc
 * @param {string} rawText - Raw IGC content
 * @param {string} fileName - File name
 * @return {number} Score from 0 to 100
 */
function scoreFlightQuality_(parsed, rawText, fileName) {
  var score = 0;
  if (!parsed || !parsed.fixes || parsed.fixes.length === 0) return 0;
  
  var textUpper = (rawText || '').toUpperCase();
  var nameUpper = (fileName || '').toUpperCase();
  var meta = parsed.meta || {};
  
  // 1. Device / Software Source (Max 40 pts)
  var isXCTrack = (nameUpper.indexOf('XCTRACK') !== -1) ||
                  (textUpper.indexOf('XCTRACK') !== -1) ||
                  (meta.gliderType && meta.gliderType.toUpperCase().indexOf('XCTRACK') !== -1);
  var isVario = (textUpper.indexOf('ULTRABLIP') !== -1 || nameUpper.indexOf('ULTRABLIP') !== -1 ||
                 textUpper.indexOf('XCTRACER') !== -1 || nameUpper.indexOf('XCTRACER') !== -1 ||
                 textUpper.indexOf('FLYMASTER') !== -1 || nameUpper.indexOf('FLYMASTER') !== -1 ||
                 textUpper.indexOf('SKYTRAXX') !== -1 || nameUpper.indexOf('SKYTRAXX') !== -1 ||
                 textUpper.indexOf('OUDIE') !== -1 || nameUpper.indexOf('OUDIE') !== -1 ||
                 textUpper.indexOf('SYRIDE') !== -1 || nameUpper.indexOf('SYRIDE') !== -1);
  var isOtherApp = (textUpper.indexOf('XCSOAR') !== -1 || textUpper.indexOf('SEEYOU') !== -1 || textUpper.indexOf('FLYME') !== -1);
  
  if (isXCTrack) {
    score += 40; // Primary source of truth
  } else if (isVario) {
    score += 30; // Dedicated vario backup
  } else if (isOtherApp) {
    score += 20;
  } else {
    score += 10;
  }
  
  // 2. Barometric Altitude Integrity (Max 30 pts)
  var fixes = parsed.fixes;
  var hasBaro = false;
  var diffCount = 0;
  var sampleStep = Math.max(1, Math.floor(fixes.length / 50));
  for (var i = 0; i < fixes.length; i += sampleStep) {
    var f = fixes[i];
    if (typeof f.altBaro === 'number' && f.altBaro > 0) {
      hasBaro = true;
      if (typeof f.alt === 'number' && Math.abs(f.altBaro - f.alt) > 1) {
        diffCount++;
      }
    }
  }
  if (hasBaro && diffCount > 5) {
    score += 30; // Genuine baro sensor
  } else if (hasBaro) {
    score += 20;
  } else {
    score += 5; // GPS only
  }
  
  // 3. Temporal Resolution (15 pts) & Duration (5 pts) (Max 20 pts)
  if (fixes.length >= 2) {
    var sampleCount = Math.min(fixes.length - 1, 30);
    var totalDt = 0;
    for (var j = 0; j < sampleCount; j++) {
      var dt = fixes[j + 1].time - fixes[j].time;
      if (dt > 0 && dt < 60) totalDt += dt;
    }
    var avgInterval = totalDt / sampleCount;
    if (avgInterval <= 1.2) {
      score += 15; // 1Hz recording
    } else if (avgInterval <= 2.5) {
      score += 10;
    } else if (avgInterval <= 5.5) {
      score += 5;
    }
  }
  
  var durSec = (parsed.stats && parsed.stats.durationSec) || 0;
  if (durSec > 1800) {
    score += 5;
  } else if (durSec > 600) {
    score += 3;
  } else if (durSec > 120) {
    score += 1;
  }
  
  // 4. Metadata Richness (Max 10 pts)
  var metaCount = 0;
  if (meta.gliderType && meta.gliderType.trim().length > 1) metaCount += 3;
  if (meta.pilot && meta.pilot.trim().length > 1) metaCount += 3;
  if (meta.gliderId && meta.gliderId.trim().length > 1) metaCount += 2;
  if (textUpper.indexOf('HFFTY') !== -1 || textUpper.indexOf('HFRFW') !== -1 || textUpper.indexOf('HFGPS') !== -1) metaCount += 2;
  score += Math.min(10, metaCount);
  
  return score;
}

/**
 * Searches the Flights sheet for an existing flight that overlaps in date,
 * launch time (+-15 min or interval overlap), and launch location (<= 1000m).
 * @param {Object} parsed
 * @param {Object} launchFix
 * @param {string} rawText
 * @param {string} fileName
 * @param {string} timeZone
 * @param {GoogleAppsScript.Spreadsheet.Sheet} sh
 * @param {Object} config
 * @return {Object} Overlap result
 */
function findHeuristicOverlap_(parsed, launchFix, rawText, fileName, timeZone, sh, config) {
  var result = { matched: false };
  if (!sh || sh.getLastRow() < 5) return result;
  
  var incomingDate = parsed.meta.dateIso || '';
  if (!incomingDate) return result;

  var incomingScore = scoreFlightQuality_(parsed, rawText, fileName);
  
  // Incoming launch time formatted in local time zone
  var timeFmt = (config && config.TIME_FORMAT) || 'HH:mm';
  var incomingLaunchTimeStr = GEO.formatInTimezone(new Date(parsed.stats.startTime * 1000), timeZone, timeFmt);
  var incomingLaunchMin = parseTimeToMinutes_(incomingLaunchTimeStr);
  if (incomingLaunchMin === null) return result;

  var map = getColumnMap_(sh);
  var dateCol = map['Date'];
  var timeCol = map['Launch Time'];
  var latCol = map['Launch Lat'];
  var lonCol = map['Launch Lon'];
  var idCol = map['FlightID'];
  var statusCol = map['Status'];
  var notesCol = map['Notes'];
  var durCol = map['Flight Duration'];
  
  if (!dateCol || !timeCol || !latCol || !lonCol || !idCol) return result;

  var numRows = sh.getLastRow() - 4;
  var lastCol = sh.getLastColumn();
  // Use getDisplayValues to avoid Date/Time object timezone shift bugs
  var displayData = sh.getRange(5, 1, numRows, lastCol).getDisplayValues();

  for (var i = 0; i < displayData.length; i++) {
    var row = displayData[i];
    var rowNum = 5 + i;
    
    // 1. Date match
    var rowDateVal = row[dateCol - 1];
    var rowDateStr = formatDateToYmd_(rowDateVal);
    if (rowDateStr !== incomingDate) continue;

    // 2. Launch Lat/Lon proximity (<= 1000 meters)
    var rowLat = parseFloat(row[latCol - 1]);
    var rowLon = parseFloat(row[lonCol - 1]);
    if (isNaN(rowLat) || isNaN(rowLon)) continue;

    var dist = haversine_(launchFix.lat, launchFix.lon, rowLat, rowLon);
    if (dist > 1000) continue;

    // 3. Time overlap (within 20 minutes or duration overlap)
    var rowTimeVal = row[timeCol - 1];
    var rowLaunchMin = parseTimeToMinutes_(rowTimeVal);
    if (rowLaunchMin === null) continue;

    var diffMin = Math.abs(incomingLaunchMin - rowLaunchMin);
    if (diffMin > 720) diffMin = 1440 - diffMin;

    var isTimeOverlap = (diffMin <= 20);
    
    // Also check interval overlap if durations are available
    if (!isTimeOverlap && diffMin <= 45) {
      var rowDurVal = row[durCol - 1];
      var rowDurMin = parseTimeToMinutes_(rowDurVal) || 0;
      var inDurMin = Math.round((parsed.stats.durationSec || 0) / 60);
      if (rowDurMin > 10 && inDurMin > 10) {
        isTimeOverlap = true;
      }
    }

    if (!isTimeOverlap) continue;

    // Overlap Found!
    var rowFlightId = String(row[idCol - 1] || '');
    rowFlightId = rowFlightId.replace(/=HYPERLINK\("[^"]*",\s*"([^"]+)"\)/, '$1').trim();
    var rowStatus = String(row[statusCol - 1] || '').trim();
    var rowNotes = notesCol ? String(row[notesCol - 1] || '') : '';

    // Fast in-memory quality scoring without Drive fetches
    var existingScore = scoreFlightQualityFromRow_(row, map);

    // Reuse existing short dupTag if already on the flight note, otherwise get next short tag
    var mTag = rowNotes.match(/\[DupRef:\s*(D\d+)/i);
    var dupTag = mTag ? mTag[1].toUpperCase() : getNextShortDupRef_();

    var incomingStatus, existingStatus;
    if (incomingScore > existingScore && rowStatus !== 'Valid') {
      incomingStatus = 'Dup-Primary';
      existingStatus = 'Dup-Others';
    } else {
      incomingStatus = 'Dup-Others';
      existingStatus = (rowStatus === 'Valid') ? 'Valid' : 'Dup-Primary';
    }

    return {
      matched: true,
      matchedRow: rowNum,
      flightId: rowFlightId,
      incomingScore: incomingScore,
      existingScore: existingScore,
      incomingStatus: incomingStatus,
      existingStatus: existingStatus,
      dupTag: dupTag,
      existingNotes: rowNotes
    };
  }

  return result;
}

/**
 * Scores an existing flight row directly from sheet columns without Drive fetches.
 * Fast, pure in-memory evaluation (0-100 pts).
 */
function scoreFlightQualityFromRow_(row, map, igcVal) {
  var score = 10; // Default base

  var igcStr = String(igcVal || (map['IGC File'] ? row[map['IGC File'] - 1] : '')).toUpperCase();
  var notesStr = String((map['Notes'] ? row[map['Notes'] - 1] : '')).toUpperCase();
  var summaryStr = String((map['Auto Summary'] ? row[map['Auto Summary'] - 1] : '')).toUpperCase();
  var wingStr = String((map['Wing'] ? row[map['Wing'] - 1] : '')).toUpperCase();

  // 1. Device / Source (Max 40 pts)
  if (igcStr.indexOf('XCTRACK') !== -1 || notesStr.indexOf('XCTRACK') !== -1) {
    score += 35;
  } else if (igcStr.indexOf('FLYMASTER') !== -1 || igcStr.indexOf('XCTRACER') !== -1 || 
             igcStr.indexOf('ULTRABLIP') !== -1 || igcStr.indexOf('SKYTRAXX') !== -1 || 
             igcStr.indexOf('OUDIE') !== -1 || igcStr.indexOf('SYRIDE') !== -1) {
    score += 25;
  } else if (igcStr.indexOf('XCSOAR') !== -1 || igcStr.indexOf('SEEYOU') !== -1 || igcStr.indexOf('FLYME') !== -1) {
    score += 15;
  }

  // 2. Barometric / Altitude Integrity (Max 30 pts)
  var maxAlt = parseFloat(map['Max Alt (m)'] ? row[map['Max Alt (m)'] - 1] : 0);
  var minAlt = parseFloat(map['Min Alt (m)'] ? row[map['Min Alt (m)'] - 1] : 0);
  var heightGain = parseFloat(map['Total Height Gain (m)'] ? row[map['Total Height Gain (m)'] - 1] : 0);
  if (!isNaN(maxAlt) && maxAlt > 0 && !isNaN(minAlt) && minAlt > 0 && maxAlt !== minAlt) {
    score += 30; // Authentic baro altitude profile
  } else if (!isNaN(maxAlt) && maxAlt > 0) {
    score += 15;
  }

  // 3. Duration & Distance (Max 20 pts)
  var durVal = map['Flight Duration'] ? row[map['Flight Duration'] - 1] : '';
  var durMin = parseTimeToMinutes_(durVal) || 0;
  if (durMin > 30) {
    score += 15;
  } else if (durMin > 10) {
    score += 10;
  } else if (durMin > 2) {
    score += 5;
  }

  var trackLen = parseFloat(map['Track Length (km)'] ? row[map['Track Length (km)'] - 1] : 0);
  if (!isNaN(trackLen) && trackLen > 5) {
    score += 5;
  }

  // 4. Metadata Richness (Max 10 pts)
  if (wingStr && wingStr.length > 1) score += 4;
  if (summaryStr && summaryStr.length > 5) score += 3;
  var xcClass = map['XC Flight Class'] ? String(row[map['XC Flight Class'] - 1] || '') : '';
  if (xcClass && xcClass.length > 1) score += 3;

  return Math.min(100, score);
}

function scoreExistingFlight_(igcVal, rowData, map) {
  return scoreFlightQualityFromRow_(rowData, map, igcVal);
}

/**
 * Short throwaway counter for duplicate clusters (e.g. D01, D02).
 */
var _shortDupCounter = 0;
function getNextShortDupRef_() {
  _shortDupCounter++;
  return 'D' + (_shortDupCounter < 10 ? '0' + _shortDupCounter : _shortDupCounter);
}

/**
 * Generates or updates reciprocal duplicate notes for Primary and Others.
 * For Primary: [DupRef: D01 | Others: F20240515_02, F20240515_03]
 * For Others:  [DupRef: D01 | Primary: F20240515_01]
 * @param {string} currentNote Existing row notes
 * @param {string} dupTag Short cluster tag (e.g. 'D01')
 * @param {boolean} isPrimary Whether this row is the primary
 * @param {string} partnerIds Partner flight ID (single for Others, comma-separated for Primary)
 * @return {string} Updated notes string
 */
function formatOrAppendDupNote_(currentNote, dupTag, isPrimary, partnerIds) {
  currentNote = String(currentNote || '').trim();
  partnerIds = String(partnerIds || '').trim();
  
  if (isPrimary) {
    var re = new RegExp('\\[DupRef:\\s*' + dupTag + '\\s*\\|\\s*Others:\\s*([^\\]]+)\\]', 'i');
    var m = currentNote.match(re);
    if (m) {
      var existingList = m[1].split(',').map(function(s) { return s.trim(); });
      var newIds = partnerIds.split(',').map(function(s) { return s.trim(); });
      newIds.forEach(function(id) {
        if (id && existingList.indexOf(id) === -1) existingList.push(id);
      });
      return currentNote.replace(m[0], '[DupRef: ' + dupTag + ' | Others: ' + existingList.join(', ') + ']');
    } else {
      // Remove any legacy "Primary: This" or placeholder if present
      currentNote = currentNote.replace(/\[DupRef:[^\]]*Primary:\s*This[^\]]*\]/gi, '').trim();
      var newTag = '[DupRef: ' + dupTag + ' | Others: ' + partnerIds + ']';
      return currentNote ? (currentNote + ' | ' + newTag) : newTag;
    }
  } else {
    // For Dup-Others: points to single Primary
    var newTag = '[DupRef: ' + dupTag + ' | Primary: ' + partnerIds + ']';
    var reOld = new RegExp('\\[DupRef:\\s*' + dupTag + '[^\\]]*\\]', 'i');
    if (reOld.test(currentNote)) {
      return currentNote.replace(reOld, newTag);
    }
    return currentNote ? (currentNote + ' | ' + newTag) : newTag;
  }
}

/**
 * Updates an existing flight row that was paired as a duplicate.
 * Adjusts for row shift caused by inserting row at Row 5.
 */
function updatePairedFlightRow_(sh, overlapInfo, incomingFlightId) {
  try {
    var map = getColumnMap_(sh);
    var statusCol = map['Status'];
    var notesCol = map['Notes'];
    var idCol = map['FlightID'];
    
    // Row 5 was just inserted, so the matched row shifted down by 1
    var targetRow = overlapInfo.matchedRow + 1;
    
    // Safety check: confirm Flight ID matches
    if (idCol) {
      var actualId = String(sh.getRange(targetRow, idCol).getValue() || '');
      actualId = actualId.replace(/=HYPERLINK\("[^"]*",\s*"([^"]+)"\)/, '$1').trim();
      if (actualId !== overlapInfo.flightId) {
        for (var offset = -2; offset <= 2; offset++) {
          var checkRow = targetRow + offset;
          if (checkRow >= 5 && checkRow <= sh.getLastRow()) {
            var checkId = String(sh.getRange(checkRow, idCol).getValue() || '');
            checkId = checkId.replace(/=HYPERLINK\("[^"]*",\s*"([^"]+)"\)/, '$1').trim();
            if (checkId === overlapInfo.flightId) {
              targetRow = checkRow;
              break;
            }
          }
        }
      }
    }

    if (statusCol) {
      sh.getRange(targetRow, statusCol).setValue(overlapInfo.existingStatus);
    }
    if (notesCol) {
      var currentNote = String(sh.getRange(targetRow, notesCol).getValue() || '');
      var isExistingPrimary = (overlapInfo.existingStatus === 'Dup-Primary' || overlapInfo.existingStatus === 'Valid');
      var updatedNote = formatOrAppendDupNote_(currentNote, overlapInfo.dupTag, isExistingPrimary, incomingFlightId);
      sh.getRange(targetRow, notesCol).setValue(updatedNote);
    }
  } catch (e) {
    console.warn('Error updating paired flight row ' + overlapInfo.matchedRow, e);
  }
}

/**
 * Converts HH:mm, HH:mm:ss, 12-hour AM/PM or Date to minutes from midnight.
 * Uses spreadsheet timezone when formatting Date objects to prevent script timezone drift.
 */
function parseTimeToMinutes_(timeVal) {
  if (!timeVal) return null;
  var str = String(timeVal).trim();
  var match = str.match(/(\d{1,2}):(\d{2})(?::\d{2})?(?:\s*([ap]m))?/i);
  if (match) {
    var h = parseInt(match[1], 10);
    var m = parseInt(match[2], 10);
    if (match[3]) {
      var ampm = match[3].toLowerCase();
      if (ampm === 'pm' && h < 12) h += 12;
      if (ampm === 'am' && h === 12) h = 0;
    }
    return h * 60 + m;
  }
  if (timeVal instanceof Date) {
    var ss = SpreadsheetApp.getActive();
    var tz = ss ? ss.getSpreadsheetTimeZone() : Session.getScriptTimeZone();
    var formatted = Utilities.formatDate(timeVal, tz, 'HH:mm');
    var parts = formatted.split(':');
    return parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
  }
  return null;
}

/**
 * Converts Date or string to yyyy-MM-dd format.
 * Uses spreadsheet timezone when formatting Date objects.
 */
function formatDateToYmd_(dateVal) {
  if (!dateVal) return '';
  if (dateVal instanceof Date) {
    var ss = SpreadsheetApp.getActive();
    var tz = ss ? ss.getSpreadsheetTimeZone() : Session.getScriptTimeZone();
    return Utilities.formatDate(dateVal, tz, 'yyyy-MM-dd');
  }
  var str = String(dateVal).trim();
  var match = str.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (match) {
    return match[1] + '-' + ('0' + match[2]).slice(-2) + '-' + ('0' + match[3]).slice(-2);
  }
  var match2 = str.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
  if (match2) {
    return match2[3] + '-' + ('0' + match2[2]).slice(-2) + '-' + ('0' + match2[1]).slice(-2);
  }
  return str;
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
  ensureFlightCapacity_(sh, 50);
  
  // 1. Generate ID
  var dateObj = new Date();
  var yyyy = dateObj.getFullYear();
  var mm = ('0' + (dateObj.getMonth() + 1)).slice(-2);
  var dd = ('0' + dateObj.getDate()).slice(-2);
  var dateStr = yyyy + mm + dd;
  var idSuffix = getNextDailyId_(sh, dateStr);
  var flightId = 'F' + dateStr + '_' + idSuffix;
  
  // 2. Map to Columns safely
  var map = getColumnMap_(sh);
  var lastCol = sh.getLastColumn();
  var row = new Array(lastCol).fill('');
  
  // 3. Flight No Formula (Dynamically resolved)
  var fNoColLetter = getColLetter_(map, 'Flight No', 'C');
  var flightNoFormula = '=IFERROR(MAX(INDIRECT("' + fNoColLetter + '" & (ROW()+1) & ":' + fNoColLetter + '")), 0) + 1';
  
  // 4. Defaults
  var eq = lookupDefaultEquipment_();
  var prevGear = getPreviousGear_(sh);
  
  var setVal = function(header, value) {
    if (map[header]) {
      row[map[header] - 1] = value;
    }
  };
  
  setVal('FlightID', flightId);
  setVal('Status', 'Review?');
  setVal('Flight No', flightNoFormula);
  setVal('Auto Summary', 'Manual Entry');
  setVal('Notes', '');
  setVal('Flight Type', 'Free Fly');
  setVal('Closed?', 'N');
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

function insertFlightRow_(data, fileId, outerName, status, notes, analysis, scoring, igcFileName, masterFileId, geo, xcStatus, weather, hashStr) {
  var ss = SpreadsheetApp.getActive();
  var sh = ss.getSheetByName(TABS.FLIGHTS.name);
  if (!sh) return null;
  ensureFlightCapacity_(sh, 50);
  
  var map = getColumnMap_(sh);
  var config = getParameters_();
  var prevGear = getPreviousGear_(sh);
  var defGear = lookupDefaultEquipment_();

  var dateObj = new Date(data.meta.dateIso || Date.now());
  var yyyy = dateObj.getFullYear();
  var mm = ('0' + (dateObj.getMonth() + 1)).slice(-2);
  var dd = ('0' + dateObj.getDate()).slice(-2);
  var dateStr = yyyy + mm + dd;
  
  var idSuffix = getNextDailyId_(sh, dateStr);
  var flightId = 'F' + dateStr + '_' + idSuffix;

  // Build standard 60-column row array
  var row = buildFlightRowArray_(data, fileId, outerName, status, notes, analysis, scoring, igcFileName, masterFileId, geo, xcStatus, weather, hashStr, sh, map, config, prevGear, defGear, flightId);

  // Standard Ingestion: Insert before row 5 (top insertion preserved)
  sh.insertRowBefore(5);
  sh.getRange(5, 1, 1, row.length).setValues([row]);
  return { flightId: flightId, rowNum: 5 };
}

/**
 * Constructs the standard 60-column row array for a flight.
 * Shared by both standard insertFlightRow_ (top insert) and processBulkBatch (bottom insert).
 */
function buildFlightRowArray_(data, fileId, outerName, status, notes, analysis, scoring, igcFileName, masterFileId, geo, xcStatus, weather, hashStr, sh, map, config, prevGear, defGear, flightId) {
  geo = geo || { l:{}, ls:'', d:{}, ds:'', tz:'UTC' };
  map = map || getColumnMap_(sh);
  config = config || getParameters_();
  var lastCol = sh.getLastColumn();
  var row = new Array(lastCol).fill('');
  
  var setVal = function(header, value) {
    if (map[header]) {
      row[map[header] - 1] = value;
    }
  };

  var fNoColLetter = getColLetter_(map, 'Flight No', 'C');
  var flightNoFormula = '=IFERROR(MAX(INDIRECT("' + fNoColLetter + '" & (ROW()+1) & ":' + fNoColLetter + '")), 0) + 1';
  
  // Auto Summary: "Site, Duration, Track Dist, Max Altitude, Flight Type"
  var site = geo.ls || (geo.l && geo.l.town) || '';
  var trackDistKm = (data.stats.totalDistance / 1000);
  var maxAltM = (analysis && analysis.stats && analysis.stats.maxAlt);
  var fType = scoring.flightType || 'Free Fly';
  var autoSummary = buildAutoSummary_(site, data.stats.durationSec, trackDistKm, maxAltM, fType);

  // Times
  var timeFmt = (config && config.TIME_FORMAT) || 'HH:mm';
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
  var wingStr = (prevGear && prevGear.wing) || (defGear && defGear.wing) || '';

  // Analytics
  var pct = (analysis && analysis.modes && analysis.modes.pct) || { thermal: 0, soar: 0, glide: 0, sink: 0 };
  var raw = (analysis && analysis.modes && analysis.modes.raw) || { thermal: { count: 0, avg: 0, best: 0 }, soar: {}, glide: {}, sink: { time: 0 } };

  // Map Data to Headers
  var flightIdVal = flightId;
  if (masterFileId) {
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
  setVal('Track Length (km)', (data.stats.trackLenKm || 0).toFixed(1));
  setVal('Straight Dist (km)', (data.stats.straightDistKm || 0).toFixed(1));

  // -- Gear --
  setVal('Wing', wingStr);
  setVal('Harness', (prevGear && prevGear.harness) || (defGear && defGear.harness) || '');
  setVal('Reserve 1', (prevGear && prevGear.res1) || (defGear && defGear.res1) || '');
  setVal('Reserve 2', (prevGear && prevGear.res2) || (defGear && defGear.res2) || '');
  setVal('Other equipment', '');

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
  setVal('XC Flight Class', normalizeXcClass_(best.type || ''));
  setVal('FAI Triangle (km)', (tri.valid && tri.dist) ? tri.dist.toFixed(1) : '');
  setVal('Points (World)', best.pointsWorld ? best.pointsWorld.toFixed(1) : '');
  setVal('Points (National)', best.score ? best.score.toFixed(1) : '');
  setVal('Closed?', tri.closed ? 'Y' : 'N');
  
  var aStats = (analysis && analysis.stats) || {};
  setVal('Max Alt (m)', (aStats.maxAlt || 0).toFixed(1));
  setVal('Min Alt (m)', (aStats.minAlt || 0).toFixed(1));
  setVal('Total Height Gain (m)', ((aStats.maxAlt || 0) - (aStats.minAlt || 0)).toFixed(1));
  setVal('Max Ascent (m/s)', (aStats.maxClimb || 0).toFixed(1));
  setVal('Max Descent (m/s)', (aStats.maxSink || 0).toFixed(1));
  setVal('Max Groundspeed (km/h)', (aStats.maxGs || 0).toFixed(1));
  setVal('Avg Groundspeed (km/h)', (aStats.avgGs || 0).toFixed(1));

  // -- Launch --
  var launchFix = data.fixes[0] || { alt: 0, lat: 0, lon: 0 };
  setVal('Launch Alt (m)', launchFix.alt.toFixed(1));
  setVal('Launch Lat', launchFix.lat);
  setVal('Launch Lon', launchFix.lon);
  setVal('Launch Site', geo.ls || '');
  setVal('Launch Town', (geo.l && geo.l.town) || '');
  setVal('Launch Country', (geo.l && geo.l.country) || '');
  setVal('Launch Region', (geo.l && geo.l.region) || '');

  // -- Landing --
  var landFix = data.fixes[data.fixes.length - 1] || { alt: 0, lat: 0, lon: 0 };
  setVal('Landing Alt (m)', landFix.alt.toFixed(1));
  setVal('Landing Lat', landFix.lat);
  setVal('Landing Lon', landFix.lon);
  setVal('Landing Site', geo.ds || '');
  setVal('Landing Town', (geo.d && geo.d.town) || '');
  setVal('Landing Country', (geo.d && geo.d.country) || '');
  setVal('Landing Region', (geo.d && geo.d.region) || '');

  // -- Weather (RQ-SCR-004) --
  var wx = weather || {};
  setVal('Wind@Launch', wx.windLaunch || '');
  setVal('Wind@Landing', wx.windLanding || '');
  setVal('Cloud %', wx.cloudPct || '');
  setVal('Cloudbase', wx.cloudbase || '');
  setVal('Temp (C)', wx.tempC || '');
  setVal('Observations', wx.observations || '');

  // -- Analytics --
  setVal('Thermal %', ((pct.thermal || 0) * 100).toFixed(2) + '%');
  setVal('Thermals Count', (raw.thermal && raw.thermal.count) || 0);
  setVal('Thermal Avg (m/s)', (raw.thermal && raw.thermal.avg) ? raw.thermal.avg.toFixed(1) : '0.0');
  setVal('Thermal Best (m/s)', (raw.thermal && raw.thermal.best) ? raw.thermal.best.toFixed(1) : '0.0');
  setVal('Soar %', ((pct.soar || 0) * 100).toFixed(2) + '%');
  setVal('Efficiency', (raw.soar && raw.soar.efficiency) || '');
  setVal('Glide %', ((pct.glide || 0) * 100).toFixed(2) + '%');
  setVal('Glide L/D', (raw.glide && raw.glide.ld) || '');
  setVal('Sink %', ((pct.sink || 0) * 100).toFixed(2) + '%');
  setVal('Sink Time', Math.round(((raw.sink && raw.sink.time) || 0) / 60) + ' min');

  // -- Validation --
  var valObj = (analysis && analysis.validation) || { status: 'OK', reason: '' };
  setVal('Validation Status', valObj.status || 'OK');
  setVal('Val: Reason', valObj.reason || '');

  // -- Meta --
  setVal('Import File', outerName || '');
  setVal('Import ID', fileId || '');
  setVal('Timestamp', new Date());
  setVal('Parser Ver', 'v2.0');
  setVal('IGC Hash', hashStr || '');

  return row;
}

/**
 * High-speed batch processor for bulk flight ingestion.
 * Appends all rows in a single batch operation at the bottom of the Flights sheet
 * and bypasses redundant sheet shifting and row recalculations.
 *
 * @param {Array<Object>} batchFiles - Array of file items [{ id, name, isDriveSource }]
 * @param {Object} options - Enrichment toggles { siteLookup, geoLookup, weatherLookup, xcontestLookup, xcScoring, analytics, deleteSource }
 * @return {Object} Batch execution results
 */
function processBulkBatch(batchFiles, options) {
  options = options || {};
  var config = getParameters_();
  var ss = SpreadsheetApp.getActive();
  var sh = ss ? ss.getSheetByName(TABS.FLIGHTS.name) : null;
  if (!sh) throw new Error('Flights sheet not found');

  var isDelete = (options.deleteSource === true || options.deleteSource === 'true');
  ensureFlightCapacity_(sh, (batchFiles.length * 2) + 20);

  var map = getColumnMap_(sh);
  var lastCol = sh.getLastColumn();
  var sheetHashes = getExistingSheetHashes_(sh);
  var existingSummaries = getFlightSummariesForOverlap_(sh, map);
  var prevGear = getPreviousGear_(sh);
  var defGear = lookupDefaultEquipment_();

  var nextIdByDate = {};
  var batchRows = [];
  var batchLogs = [];
  var results = [];
  var processedCount = 0;
  var dupeCount = 0;
  var errorCount = 0;

  for (var i = 0; i < batchFiles.length; i++) {
    var item = batchFiles[i];
    var file = null;
    try {
      file = DriveApp.getFileById(item.id);
      var blob = file.getBlob();
      var fileName = file.getName();
      var outerName = item.outerName || fileName;

      // Archive unpacking
      var innerBlobs = [];
      var lowerName = fileName.toLowerCase();
      if (lowerName.endsWith('.zip')) {
        try {
          var unzipped = Utilities.unzip(blob);
          unzipped.forEach(function(b) {
            if (b.getName().match(/\.(igc|igx)$/i)) innerBlobs.push(b);
          });
        } catch(eZip) { console.warn('Unzip error in bulk batch: ' + eZip.message); }
      } else if (lowerName.endsWith('.gz')) {
        try {
          innerBlobs.push(Utilities.gunzip(blob));
        } catch(eGz) { console.warn('Gunzip error in bulk batch: ' + eGz.message); }
      } else {
        innerBlobs.push(blob);
      }

      if (innerBlobs.length === 0) {
        batchLogs.push(['Bulk Ingestion', new Date(), '[ERR] ' + fileName, 'No supported flight files found in archive']);
        errorCount++;
        results.push({ name: fileName, success: false, msg: 'No flight files in archive' });
        continue;
      }

      for (var bIdx = 0; bIdx < innerBlobs.length; bIdx++) {
        var currentBlob = innerBlobs[bIdx];
        var currentName = currentBlob.getName() || fileName;
        var text = currentBlob.getDataAsString();

        // 1. MD5 Dedupe
        var hash = Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, text);
        var hashStr = hash.map(function(b) { return ('0' + (b & 0xFF).toString(16)).slice(-2); }).join('');
        if (sheetHashes[hashStr]) {
          batchLogs.push(['Bulk Ingestion', new Date(), '[DUPE] ' + currentName, (item.id ? 'FileID: ' + item.id + ' | ' : '') + 'Skipped (Already in Flights)']);
          dupeCount++;
          results.push({ name: currentName, success: true, isDuplicate: true, msg: 'Duplicate (MD5)' });
          continue;
        }

        // 2. Parse IGC
        var parsed = PARSER.parseIgc(text, currentName);
        if (!parsed || !parsed.fixes || parsed.fixes.length < 2) {
          copyToErrorFolder_(currentBlob, currentName, config);
          batchLogs.push(['Bulk Ingestion', new Date(), '[ERR] ' + currentName, 'Invalid IGC structure or < 2 fixes']);
          errorCount++;
          results.push({ name: currentName, success: false, msg: 'Parse Fail (< 2 fixes)' });
          continue;
        }

        var noteLog = [];

        // 3. Analytics & Scoring
        var analysis = (options.analytics !== false)
          ? ANALYSIS.analyzeFlight(parsed.fixes, config)
          : createLightweightAnalysis_(parsed);
        
        var scoring = (options.xcScoring !== false)
          ? SCORING.calculateXcScore(parsed.fixes, config)
          : createLightweightScoring_(parsed);

        // 4. Geo, Sites, Timezone
        var launchFix = parsed.fixes[0];
        var landFix = parsed.fixes[parsed.fixes.length - 1];

        var timeZone = GEO.getTimezone(launchFix.lat, launchFix.lon, config) || 'UTC';

        var geoLaunch = {};
        var geoLand = {};
        if (options.geoLookup) {
          geoLaunch = GEO.getReverseGeo(launchFix.lat, launchFix.lon, config) || {};
          geoLand = GEO.getReverseGeo(landFix.lat, landFix.lon, config) || {};
          if (geoLaunch && geoLaunch.error) noteLog.push(geoLaunch.error);
          if (geoLand && geoLand.error) noteLog.push(geoLand.error);
        }

        var siteLaunch = '';
        var siteLand = '';
        if (options.siteLookup) {
          siteLaunch = GEO.getNearestSite(launchFix.lat, launchFix.lon, config.OSM_RADIUS_M, config, 'takeoff', launchFix.alt) || '';
          siteLand = GEO.getNearestSite(landFix.lat, landFix.lon, config.OSM_RADIUS_M, config, 'landing', landFix.alt) || '';
          if (launchFix && landFix && siteLaunch && !siteLand) {
            var l2lDist = (parsed.stats && typeof parsed.stats.straightDistKm === 'number')
              ? (parsed.stats.straightDistKm * 1000)
              : haversine_(launchFix.lat, launchFix.lon, landFix.lat, landFix.lon);
            if (l2lDist <= 100) siteLand = siteLaunch;
          }
        }

        // 5. Master Log Copy
        var masterRes = copyToMasterLog_(currentBlob, currentName, config, hashStr);
        if (masterRes.error) {
          noteLog.push('Master Log Error: ' + masterRes.error);
        } else if (masterRes.isExactMasterMatch) {
          noteLog.push('Re-linked to existing Master IGC');
        }

        // 6. Optional XContest
        var xcStatus = { status: '' };
        if (options.xcontestLookup && config.XCONTEST_USERNAME) {
          try {
            var flightDateStr = parsed.meta.dateIso || '';
            var durMin = Math.round(parsed.stats.durationSec / 60);
            var utcStartMin = Math.round(parsed.stats.startTime / 60);
            xcStatus = XContest.checkFlight(flightDateStr, durMin, utcStartMin, config);
          } catch(eXc) { console.warn('Bulk XContest error:', eXc); }
        }

        // 7. Optional Weather
        var weatherData = null;
        if (options.weatherLookup) {
          try {
            weatherData = WEATHER.getEnrichment(launchFix, landFix, parsed.meta.dateIso, parsed.stats.startTime, parsed.stats.endTime, config);
          } catch(eWx) { console.warn('Bulk Weather error:', eWx); }
        }

        // 8. Generate Flight ID early with in-memory suffix tracking
        var dateObj = new Date(parsed.meta.dateIso || Date.now());
        var yyyy = dateObj.getFullYear();
        var mm = ('0' + (dateObj.getMonth() + 1)).slice(-2);
        var dd = ('0' + dateObj.getDate()).slice(-2);
        var dateStr = yyyy + mm + dd;

        if (nextIdByDate[dateStr] === undefined) {
          var currentMax = getNextDailyId_(sh, dateStr);
          nextIdByDate[dateStr] = parseInt(currentMax, 10);
        } else {
          nextIdByDate[dateStr]++;
        }
        var nextNum = nextIdByDate[dateStr];
        var idSuffix = (nextNum < 10) ? ('0' + nextNum) : String(nextNum);
        var flightId = 'F' + dateStr + '_' + idSuffix;

        // 9. Status & Overlap Deduplication
        var status = 'Review?';
        if (scoring.error) {
          status = 'Invalid?';
          noteLog.push('Scoring Error: ' + scoring.error);
        }
        if (analysis.validation && analysis.validation.status !== 'OK') {
          status = analysis.validation.status;
          if (analysis.validation.reason) noteLog.push(analysis.validation.reason);
        }

        var assignedDupTag = null;
        if (status !== 'Invalid?') {
          var overlap = findHeuristicOverlapInMemory_(parsed, launchFix, text, currentName, timeZone, existingSummaries, config, flightId);
          if (overlap && overlap.matched) {
            status = overlap.incomingStatus;
            assignedDupTag = overlap.dupTag;
            if (overlap.incomingNote) noteLog.push(overlap.incomingNote);

            // Update matched existing flight (either already in sheet or earlier in this batch)
            var matchedFlight = overlap.matchedFlight;
            var isExistingPrimary = (overlap.existingStatus === 'Dup-Primary' || (matchedFlight && matchedFlight.status === 'Valid'));
            if (matchedFlight) {
              matchedFlight.dupTag = assignedDupTag;
              if (matchedFlight.rowNum) {
                // In spreadsheet
                updateExistingMatchedRow_(sh, map, matchedFlight.rowNum, overlap.existingStatus, assignedDupTag, isExistingPrimary, flightId);
              } else if (matchedFlight.batchIndex !== undefined && batchRows[matchedFlight.batchIndex]) {
                // Earlier in current batch!
                var priorBatchRow = batchRows[matchedFlight.batchIndex];
                if (map['Status']) {
                  priorBatchRow[map['Status'] - 1] = overlap.existingStatus;
                }
                if (map['Notes']) {
                  var curPriorNotes = priorBatchRow[map['Notes'] - 1] || '';
                  priorBatchRow[map['Notes'] - 1] = formatOrAppendDupNote_(curPriorNotes, assignedDupTag, isExistingPrimary, flightId);
                }
              }
            }
          }
        }

        var finalNotes = noteLog.length > 0 ? noteLog.join(' | ') : '';

        // 10. Build 60-column row
        var rowData = buildFlightRowArray_(parsed, item.id, outerName, status, finalNotes, analysis, scoring, masterRes.finalName, masterRes.fileId, {
          l: geoLaunch, ls: siteLaunch,
          d: geoLand, ds: siteLand,
          tz: timeZone
        }, xcStatus, weatherData, hashStr, sh, map, config, prevGear, defGear, flightId);

        var currentBatchRowIndex = batchRows.length;
        batchRows.push(rowData);
        sheetHashes[hashStr] = true;

        // In-memory summary for intra-batch overlap
        var incomingLaunchMin = parseTimeToMinutes_(GEO.formatInTimezone(new Date(parsed.stats.startTime * 1000), timeZone, config.TIME_FORMAT || 'HH:mm'));
        existingSummaries.push({
          dateIso: parsed.meta.dateIso,
          launchMin: incomingLaunchMin,
          durMin: Math.round((parsed.stats.durationSec || 0) / 60),
          lat: launchFix.lat,
          lon: launchFix.lon,
          flightId: flightId,
          status: status,
          score: scoreFlightQualityFromRow_(rowData, map, currentName),
          rowNum: null,
          batchIndex: currentBatchRowIndex,
          dupTag: assignedDupTag
        });

        batchLogs.push(['Bulk Ingestion', new Date(), '[OK] ' + currentName, (item.id ? 'FileID: ' + item.id + ' | ' : '') + (finalNotes || 'OK')]);
        processedCount++;
        results.push({ name: currentName, success: true, processed: true, status: status, flightId: flightId });
      }

      // Cleanup source file if requested or if it was a temporary staged upload
      if (isDelete || item.isDriveSource === false) {
        try { file.setTrashed(true); } catch(eTrash) { console.warn('Failed to trash file:', eTrash.message); }
      }

    } catch (err) {
      var itemName = (item && item.name) ? item.name : (item && item.id ? item.id : 'Unknown');
      console.error('Error processing bulk file ' + itemName + ':', err);
      errorCount++;
      batchLogs.push(['Bulk Ingestion', new Date(), '[ERR] ' + itemName, err.message]);
      results.push({ name: itemName, success: false, msg: err.message });
    }
  }

  // 11. BATCH WRITE TO BOTTOM OF SHEET (Instantaneous single write)
  if (batchRows.length > 0) {
    var curLastRow = Math.max(4, sh.getLastRow());
    sh.getRange(curLastRow + 1, 1, batchRows.length, lastCol).setValues(batchRows);
  }

  // 12. Batch Write Activity Logs
  if (batchLogs.length > 0) {
    LOG.writeBatch(batchLogs);
  }

  return {
    success: true,
    processedCount: processedCount,
    duplicateCount: dupeCount,
    errorCount: errorCount,
    results: results
  };
}

/**
 * Loads summaries of existing flights in memory for fast heuristic overlap checks.
 */
function getFlightSummariesForOverlap_(sh, map) {
  var list = [];
  if (!sh || sh.getLastRow() < 5) return list;
  var numRows = sh.getLastRow() - 4;
  var lastCol = sh.getLastColumn();
  // Read display values to prevent timezone/epoch shifts
  var data = sh.getRange(5, 1, numRows, lastCol).getDisplayValues();

  var dateCol = map['Date'];
  var timeCol = map['Launch Time'];
  var latCol = map['Launch Lat'];
  var lonCol = map['Launch Lon'];
  var idCol = map['FlightID'];
  var statusCol = map['Status'];
  var notesCol = map['Notes'];
  var durCol = map['Flight Duration'];

  for (var i = 0; i < data.length; i++) {
    var row = data[i];
    var rowDateVal = row[dateCol - 1];
    var rowDateStr = formatDateToYmd_(rowDateVal);
    var rowTimeVal = row[timeCol - 1];
    var rowLaunchMin = parseTimeToMinutes_(rowTimeVal);
    var rowLat = parseFloat(row[latCol - 1]);
    var rowLon = parseFloat(row[lonCol - 1]);
    var rowFlightId = String(row[idCol - 1] || '').replace(/=HYPERLINK\("[^"]*",\s*"([^"]+)"\)/, '$1').trim();
    var rowStatus = String(row[statusCol - 1] || '').trim();
    var rowNotes = notesCol ? String(row[notesCol - 1] || '') : '';
    var rowDurVal = row[durCol - 1];
    var rowDurMin = parseTimeToMinutes_(rowDurVal) || 0;

    var mTag = rowNotes.match(/\[DupRef:\s*(D\d+)/i);
    var dupTag = mTag ? mTag[1].toUpperCase() : null;

    if (rowDateStr && !isNaN(rowLat) && !isNaN(rowLon)) {
      list.push({
        dateIso: rowDateStr,
        launchMin: rowLaunchMin,
        durMin: rowDurMin,
        lat: rowLat,
        lon: rowLon,
        flightId: rowFlightId,
        status: rowStatus,
        notes: rowNotes,
        score: scoreFlightQualityFromRow_(row, map),
        rowNum: 5 + i,
        dupTag: dupTag
      });
    }
  }
  return list;
}

/**
 * In-memory heuristic overlap check against loaded flight summaries.
 */
function findHeuristicOverlapInMemory_(parsed, launchFix, rawText, fileName, timeZone, summaries, config, incomingFlightId) {
  var result = { matched: false };
  if (!summaries || summaries.length === 0) return result;

  var incomingDate = parsed.meta.dateIso || '';
  if (!incomingDate) return result;

  var incomingScore = scoreFlightQuality_(parsed, rawText, fileName);
  var timeFmt = (config && config.TIME_FORMAT) || 'HH:mm';
  var incomingLaunchTimeStr = GEO.formatInTimezone(new Date(parsed.stats.startTime * 1000), timeZone, timeFmt);
  var incomingLaunchMin = parseTimeToMinutes_(incomingLaunchTimeStr);
  if (incomingLaunchMin === null) return result;

  for (var i = 0; i < summaries.length; i++) {
    var item = summaries[i];
    if (item.dateIso !== incomingDate) continue;

    var dist = haversine_(launchFix.lat, launchFix.lon, item.lat, item.lon);
    if (dist > 1000) continue;

    if (item.launchMin === null) continue;
    var diffMin = Math.abs(incomingLaunchMin - item.launchMin);
    if (diffMin > 720) diffMin = 1440 - diffMin;

    var isTimeOverlap = (diffMin <= 20);
    if (!isTimeOverlap && diffMin <= 45) {
      var inDurMin = Math.round((parsed.stats.durationSec || 0) / 60);
      if (item.durMin > 10 && inDurMin > 10) {
        isTimeOverlap = true;
      }
    }

    if (!isTimeOverlap) continue;

    // Overlap match found!
    // Reuse cluster tag if matched flight already has one; otherwise assign new short tag
    var dupTag = item.dupTag || getNextShortDupRef_();
    item.dupTag = dupTag;

    var incomingStatus, existingStatus;
    var incomingNote;

    if (incomingScore > item.score && item.status !== 'Valid') {
      incomingStatus = 'Dup-Primary';
      existingStatus = 'Dup-Others';
      incomingNote = formatOrAppendDupNote_('', dupTag, true, item.flightId);
    } else {
      incomingStatus = 'Dup-Others';
      existingStatus = (item.status === 'Valid') ? 'Valid' : 'Dup-Primary';
      incomingNote = formatOrAppendDupNote_('', dupTag, false, item.flightId);
    }

    return {
      matched: true,
      dupTag: dupTag,
      incomingStatus: incomingStatus,
      existingStatus: existingStatus,
      incomingNote: incomingNote,
      matchedFlight: item
    };
  }
  return result;
}

/**
 * Updates status and notes on an existing flight row without shifting rows.
 */
function updateExistingMatchedRow_(sh, map, rowNum, newStatus, dupTag, isPrimary, partnerFlightId) {
  try {
    if (!sh || !rowNum || rowNum < 5) return;
    var statusCol = map['Status'];
    var notesCol = map['Notes'];
    if (statusCol && newStatus) {
      sh.getRange(rowNum, statusCol).setValue(newStatus);
    }
    if (notesCol && dupTag && partnerFlightId) {
      var curVal = String(sh.getRange(rowNum, notesCol).getValue() || '');
      var updatedNote = formatOrAppendDupNote_(curVal, dupTag, isPrimary, partnerFlightId);
      if (updatedNote !== curVal) {
        sh.getRange(rowNum, notesCol).setValue(updatedNote);
      }
    }
  } catch(e) {
    console.warn('updateExistingMatchedRow_ error:', e);
  }
}

/**
 * Lightweight fallbacks when user disables intensive analytics or scoring during bulk ingest.
 */
function createLightweightAnalysis_(parsed) {
  var dur = (parsed && parsed.stats && parsed.stats.durationSec) || 0;
  return {
    stats: {
      durationSec: dur,
      maxAlt: (parsed && parsed.stats && parsed.stats.maxAlt) || 0,
      minAlt: (parsed && parsed.stats && parsed.stats.minAlt) || 0,
      maxClimb: 0,
      maxSink: 0,
      maxGs: 0,
      avgGs: 0
    },
    validation: { status: 'OK', reason: '' },
    modes: {
      pct: { thermal: 0, soar: 0, glide: 0, sink: 0 },
      raw: { thermal: { count: 0, avg: 0, best: 0 }, soar: { efficiency: '' }, glide: { ld: '' }, sink: { time: 0 } }
    }
  };
}

function createLightweightScoring_(parsed) {
  var dist = (parsed && parsed.stats && parsed.stats.trackLenKm) || 0;
  return {
    flightType: 'Free Fly',
    best: { dist: dist, score: dist, type: 'Free Flight' },
    free: { dist: dist },
    triangle: { valid: false, dist: 0, closed: false }
  };
}



/**
 * Ensures the Flights sheet maintains at least minBuffer empty rows at the bottom.
 * If capacity drops below minBuffer, automatically appends 200 rows.
 * @param {Sheet} sh - The Flights sheet
 * @param {number} minBuffer - Minimum buffer rows (default: 50)
 */
function ensureFlightCapacity_(sh, minBuffer) {
  if (!sh) return;
  minBuffer = minBuffer || 50;
  var maxRows = sh.getMaxRows();
  var lastRow = sh.getLastRow();
  if (maxRows - lastRow < minBuffer) {
    sh.insertRowsAfter(maxRows, 200);
  }
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
INGESTION.scoreFlightQuality = scoreFlightQuality_;
INGESTION.scoreFlightQualityFromRow = scoreFlightQualityFromRow_;
INGESTION.findHeuristicOverlap = findHeuristicOverlap_;
INGESTION.getExistingSheetHashes = getExistingSheetHashes_;
INGESTION.getCachedSheetHashes = getCachedSheetHashes_;
INGESTION.buildFlightRowArray = buildFlightRowArray_;
INGESTION.processBulkBatch = processBulkBatch;
INGESTION.scanAndFlagLogbookDuplicates = scanAndFlagLogbookDuplicates_;

/**
 * Scans the entire Flights sheet for duplicate flight recordings.
 * Groups by date, clusters by launch proximity (<= 1000m) and time overlap (<= 20 min or interval overlap),
 * quality scores candidates (0-100), sets Dup-Primary and Dup-Others, and formats reciprocal notes.
 * @return {Object} { success: boolean, totalFlights: number, clusterCount: number, duplicateCount: number }
 */
function scanAndFlagLogbookDuplicates_() {
  var ss = SpreadsheetApp.getActive();
  var sh = ss ? ss.getSheetByName(TABS.FLIGHTS.name) : null;
  if (!sh || sh.getLastRow() < 5) {
    return { success: true, totalFlights: 0, clusterCount: 0, duplicateCount: 0 };
  }

  var map = getColumnMap_(sh);
  var dateCol = map['Date'];
  var timeCol = map['Launch Time'];
  var latCol = map['Launch Lat'];
  var lonCol = map['Launch Lon'];
  var idCol = map['FlightID'];
  var statusCol = map['Status'];
  var notesCol = map['Notes'];
  var durCol = map['Flight Duration'];

  if (!dateCol || !timeCol || !latCol || !lonCol || !idCol || !statusCol || !notesCol) {
    return { success: false, error: 'Missing required columns in Flights sheet.' };
  }

  var numRows = sh.getLastRow() - 4;
  var lastCol = sh.getLastColumn();
  var displayData = sh.getRange(5, 1, numRows, lastCol).getDisplayValues();

  var flights = [];
  var existingMaxTagNum = 0;

  for (var i = 0; i < displayData.length; i++) {
    var row = displayData[i];
    var rowNum = 5 + i;
    var rawId = String(row[idCol - 1] || '');
    var flightId = rawId.replace(/=HYPERLINK\("[^"]*",\s*"([^"]+)"\)/, '$1').trim();
    if (!flightId) continue;

    var dateStr = formatDateToYmd_(row[dateCol - 1]);
    var timeStr = String(row[timeCol - 1] || '').trim();
    var launchMin = parseTimeToMinutes_(timeStr);
    var lat = parseFloat(row[latCol - 1]);
    var lon = parseFloat(row[lonCol - 1]);
    var durMin = parseTimeToMinutes_(row[durCol - 1]) || 0;
    var status = String(row[statusCol - 1] || '').trim();
    var notes = String(row[notesCol - 1] || '').trim();

    var mTag = notes.match(/\[DupRef:\s*D(\d+)/i);
    if (mTag) {
      var tNum = parseInt(mTag[1], 10);
      if (tNum > existingMaxTagNum) existingMaxTagNum = tNum;
    }

    var score = scoreFlightQualityFromRow_(row, map);

    flights.push({
      rowNum: rowNum,
      flightId: flightId,
      dateIso: dateStr,
      timeStr: timeStr,
      launchMin: launchMin,
      durMin: durMin,
      lat: lat,
      lon: lon,
      status: status,
      notes: notes,
      score: score,
      clusterId: null
    });
  }

  if (flights.length === 0) {
    return { success: true, totalFlights: 0, clusterCount: 0, duplicateCount: 0 };
  }

  // 1. Group flights by Date
  var byDate = {};
  for (var f = 0; f < flights.length; f++) {
    var fl = flights[f];
    if (!fl.dateIso || isNaN(fl.lat) || isNaN(fl.lon) || fl.launchMin === null) continue;
    if (!byDate[fl.dateIso]) byDate[fl.dateIso] = [];
    byDate[fl.dateIso].push(fl);
  }

  var clusterList = [];
  var clusterCounter = existingMaxTagNum;

  // 2. Identify clusters within each date
  for (var d in byDate) {
    var dayFlights = byDate[d];
    if (dayFlights.length < 2) continue;

    for (var a = 0; a < dayFlights.length; a++) {
      for (var b = a + 1; b < dayFlights.length; b++) {
        var fA = dayFlights[a];
        var fB = dayFlights[b];

        // Launch proximity <= 1000m
        var dist = haversine_(fA.lat, fA.lon, fB.lat, fB.lon);
        if (dist > 1000) continue;

        // Time overlap: launch within 20 min OR duration overlap
        var diffMin = Math.abs(fA.launchMin - fB.launchMin);
        if (diffMin > 720) diffMin = 1440 - diffMin;

        var isOverlap = (diffMin <= 20);
        if (!isOverlap && diffMin <= 45 && fA.durMin > 10 && fB.durMin > 10) {
          isOverlap = true;
        }

        if (isOverlap) {
          // Merge or create cluster
          if (fA.clusterId === null && fB.clusterId === null) {
            clusterCounter++;
            var newCId = 'D' + (clusterCounter < 10 ? '0' + clusterCounter : clusterCounter);
            fA.clusterId = newCId;
            fB.clusterId = newCId;
            clusterList.push({ id: newCId, members: [fA, fB] });
          } else if (fA.clusterId !== null && fB.clusterId === null) {
            fB.clusterId = fA.clusterId;
            var cObj = clusterList.find(function(c) { return c.id === fA.clusterId; });
            if (cObj && cObj.members.indexOf(fB) === -1) cObj.members.push(fB);
          } else if (fA.clusterId === null && fB.clusterId !== null) {
            fA.clusterId = fB.clusterId;
            var cObj = clusterList.find(function(c) { return c.id === fB.clusterId; });
            if (cObj && cObj.members.indexOf(fA) === -1) cObj.members.push(fA);
          }
        }
      }
    }
  }

  if (clusterList.length === 0) {
    LOG.write('DUPE_TRIAGE', '[INFO] Duplicate logbook scan completed', 'Scanned ' + flights.length + ' flights: 0 duplicates detected.');
    return { success: true, totalFlights: flights.length, clusterCount: 0, duplicateCount: 0 };
  }

  // 3. For each cluster, elect Primary and Others, format reciprocal notes
  var totalDupsFlagged = 0;
  var rowsToUpdate = [];

  for (var c = 0; c < clusterList.length; c++) {
    var cluster = clusterList[c];
    var members = cluster.members;

    // Elect Primary:
    // If one is already marked 'Valid' by pilot, that one remains Primary
    // Otherwise, highest quality score wins
    members.sort(function(m1, m2) {
      if (m1.status === 'Valid' && m2.status !== 'Valid') return -1;
      if (m2.status === 'Valid' && m1.status !== 'Valid') return 1;
      return m2.score - m1.score;
    });

    var primary = members[0];
    var others = members.slice(1);
    var otherIds = others.map(function(o) { return o.flightId; });

    // Primary updates
    var primaryStatus = (primary.status === 'Valid') ? 'Valid' : 'Dup-Primary';
    var primaryNotes = formatOrAppendDupNote_(primary.notes, cluster.id, true, otherIds.join(', '));
    rowsToUpdate.push({
      rowNum: primary.rowNum,
      status: primaryStatus,
      notes: primaryNotes
    });

    // Others updates
    for (var o = 0; o < others.length; o++) {
      var otherFl = others[o];
      var otherNotes = formatOrAppendDupNote_(otherFl.notes, cluster.id, false, primary.flightId);
      rowsToUpdate.push({
        rowNum: otherFl.rowNum,
        status: 'Dup-Others',
        notes: otherNotes
      });
      totalDupsFlagged++;
    }
  }

  // 4. Batch commit updates to sheet
  for (var u = 0; u < rowsToUpdate.length; u++) {
    var up = rowsToUpdate[u];
    sh.getRange(up.rowNum, statusCol).setValue(up.status);
    sh.getRange(up.rowNum, notesCol).setValue(up.notes);
  }
  SpreadsheetApp.flush();

  LOG.write(
    'DUPE_TRIAGE',
    '[COMPLETE] Duplicate scan finished: Found ' + clusterList.length + ' cluster(s)',
    'Scanned ' + flights.length + ' flights | Flagged ' + totalDupsFlagged + ' as Dup-Others, ' + clusterList.length + ' as Dup-Primary'
  );

  return {
    success: true,
    totalFlights: flights.length,
    clusterCount: clusterList.length,
    duplicateCount: totalDupsFlagged
  };
}
