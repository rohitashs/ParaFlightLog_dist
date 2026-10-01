/**
 * Paragliding Flight Log v2.0
 * Updated: 2026-09-30 21:59:57
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
  var ss = SpreadsheetApp.getActive();
  var sh = ss ? ss.getSheetByName(TABS.FLIGHTS.name) : null;
  
  // A. Dedupe Check (MD5 against active sheet)
  var hash = Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, text);
  var hashStr = hash.map(function(b) { return ('0' + (b & 0xFF).toString(16)).slice(-2); }).join('');
  
  if (isHashSeen_(hashStr, sh)) {
    logImport_(new Date(), fileId, outerName, fileName, 'Duplicate (MD5)', 'Skipped (Already in Flights)');
    return false;
  }
  
  // B. Parse
  var parsed = PARSER.parseIgc(text, fileName);
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

  // Override status if duplicate file name (and not an exact MD5 master match)
  if (masterRes.isDuplicate && !masterRes.isExactMasterMatch) {
    status = 'Duplicate';
    noteLog.push('Duplicate Filename');
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
  logImport_(new Date(), fileId, outerName, fileName, 'Success', finalNotes || 'OK');
  
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
  var igcCol = map['IGC File'];
  var durCol = map['Flight Duration'];
  
  if (!dateCol || !timeCol || !latCol || !lonCol || !idCol) return result;

  var numRows = sh.getLastRow() - 4;
  var lastCol = sh.getLastColumn();
  var data = sh.getRange(5, 1, numRows, lastCol).getValues();

  for (var i = 0; i < data.length; i++) {
    var row = data[i];
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

    // 3. Time overlap (within 15 minutes)
    var rowTimeVal = row[timeCol - 1];
    var rowLaunchMin = parseTimeToMinutes_(rowTimeVal);
    if (rowLaunchMin === null) continue;

    var diffMin = Math.abs(incomingLaunchMin - rowLaunchMin);
    if (diffMin > 720) diffMin = 1440 - diffMin;

    var isTimeOverlap = (diffMin <= 15);
    
    // Also check interval overlap if durations are available
    if (!isTimeOverlap && diffMin <= 35) {
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
    var rowIgcVal = String(row[igcCol - 1] || '');

    // Score the existing flight
    var existingScore = scoreExistingFlight_(rowIgcVal, row, map);

    var dateCompact = incomingDate.replace(/-/g, '');
    var hourStr = ('0' + Math.floor(incomingLaunchMin / 60)).slice(-2);
    var minStr = ('0' + (incomingLaunchMin % 60)).slice(-2);
    var dupTag = 'DUP_' + dateCompact + '_' + hourStr + minStr;

    var incomingStatus, existingStatus;
    if (incomingScore > existingScore) {
      incomingStatus = 'Dup-Primary';
      existingStatus = 'Dup-Others';
    } else {
      incomingStatus = 'Dup-Others';
      existingStatus = (rowStatus === 'Valid') ? 'Valid' : 'Dup-Primary';
    }

    var incomingNote = '[DupRef: ' + dupTag + ' | Paired with ' + rowFlightId + ' (Score: ' + incomingScore + ' vs ' + existingScore + ')]';

    return {
      matched: true,
      matchedRow: rowNum,
      flightId: rowFlightId,
      incomingScore: incomingScore,
      existingScore: existingScore,
      incomingStatus: incomingStatus,
      existingStatus: existingStatus,
      dupTag: dupTag,
      incomingNote: incomingNote
    };
  }

  return result;
}

/**
 * Scores an existing flight row from its linked Master IGC file or row heuristics.
 */
function scoreExistingFlight_(igcVal, rowData, map) {
  var score = 20; // Default base
  try {
    var idMatch = igcVal.match(/id=([a-zA-Z0-9_-]+)/);
    if (idMatch && idMatch[1]) {
      var file = DriveApp.getFileById(idMatch[1]);
      var text = file.getBlob().getDataAsString();
      var parsed = PARSER.parseIgc(text, file.getName());
      if (parsed) {
        return scoreFlightQuality_(parsed, text, file.getName());
      }
    }
  } catch (e) {
    // If Drive fetch fails, use row heuristics
  }

  // Row Heuristics
  var igcUpper = igcVal.toUpperCase();
  if (igcUpper.indexOf('XCTRACK') !== -1) {
    score += 30;
  } else if (igcUpper.indexOf('ULTRABLIP') !== -1 || igcUpper.indexOf('XCTRACER') !== -1 || igcUpper.indexOf('FLYMASTER') !== -1) {
    score += 20;
  }
  
  if (map['Flight Duration'] && rowData[map['Flight Duration'] - 1]) {
    score += 10;
  }
  if (map['Max Alt (m)'] && rowData[map['Max Alt (m)'] - 1]) {
    score += 10;
  }
  return score;
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
        // Search adjacent rows (+- 2) if row indices shifted differently
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
      var pairedNote = '[DupRef: ' + overlapInfo.dupTag + ' | Paired with ' + incomingFlightId +
                       ' (Score: ' + overlapInfo.existingScore + ' vs ' + overlapInfo.incomingScore + ')]';
      if (currentNote.indexOf(overlapInfo.dupTag) === -1) {
        var updatedNote = currentNote ? (currentNote + ' | ' + pairedNote) : pairedNote;
        sh.getRange(targetRow, notesCol).setValue(updatedNote);
      }
    }
  } catch (e) {
    console.warn('Error updating paired flight row ' + overlapInfo.matchedRow, e);
  }
}

/**
 * Converts HH:mm or Date to minutes from midnight.
 */
function parseTimeToMinutes_(timeVal) {
  if (!timeVal) return null;
  if (timeVal instanceof Date) {
    return timeVal.getHours() * 60 + timeVal.getMinutes();
  }
  var str = String(timeVal).trim();
  var match = str.match(/(\d{1,2}):(\d{2})/);
  if (match) {
    return parseInt(match[1], 10) * 60 + parseInt(match[2], 10);
  }
  return null;
}

/**
 * Converts Date or string to yyyy-MM-dd format.
 */
function formatDateToYmd_(dateVal) {
  if (!dateVal) return '';
  if (dateVal instanceof Date) {
    return Utilities.formatDate(dateVal, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  }
  var str = String(dateVal).trim();
  var match = str.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (match) {
    return match[1] + '-' + ('0' + match[2]).slice(-2) + '-' + ('0' + match[3]).slice(-2);
  }
  return str;
}

function logImport_(date, fileId, outer, inner, status, notes) {
  var ss = SpreadsheetApp.getActive();
  var sh = ss ? ss.getSheetByName(TABS.APP_LOG.name) : null;
  if (sh) {
    sh.appendRow([date, fileId, outer, inner, status, notes]);
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
  ensureFlightCapacity_(sh, 50);
  
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
  setVal('Status', 'Review?');
  setVal('Flight No', flightNoFormula);
  setVal('Auto Summary', 'Manual Entry');
  setVal('Notes', '');
  setVal('Flight Type', 'Free Fly');
  setVal('Closed?', 'No');
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
  if (!sh) return;
  ensureFlightCapacity_(sh, 50);
  
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
  setVal('IGC Hash', hashStr || '');

  // Insert
  sh.insertRowBefore(5);
  sh.getRange(5, 1, 1, row.length).setValues([row]);
  return { flightId: flightId, rowNum: 5 };
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
INGESTION.findHeuristicOverlap = findHeuristicOverlap_;
INGESTION.getExistingSheetHashes = getExistingSheetHashes_;
INGESTION.getCachedSheetHashes = getCachedSheetHashes_;
