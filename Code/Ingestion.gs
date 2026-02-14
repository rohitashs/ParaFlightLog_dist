/**
 * Paragliding Flight Log v2.0
 * Updated: 2026-02-13 17:08:53
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
  var stats = { processed: 0, skipped: 0, errors: 0, flights: 0, log: [] };
  
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
             stats.processed++; // Files
             stats.flights += (result.count || 0); // Flights
             stats.log.push('Processed: ' + fName + ' (' + (result.count||1) + ' flights)');
             
             // Cleanup: Success
             handleFileCleanup_(file, 'SUCCESS', config);
             
           } else {
             console.log('Skipped (Duplicate/Error): ' + fName);
             stats.skipped++;
             stats.log.push('Skipped: ' + fName);
             
             // Cleanup: Error/Skipped (Treat as Error to move out of Watch?)
             // User said: "Files with errors... moved or copied into ERROR_FOLDER_ID"
             handleFileCleanup_(file, 'ERROR', config);
           }
         } catch (e) {
           logImport_(new Date(), fId, fName, fName, 'Scan Error', e.message);
           console.error('Error processing ' + fName, e);
           stats.errors++;
           stats.log.push('Error (' + fName + '): ' + e.message);
           
           // Cleanup: Fatal Error
           handleFileCleanup_(file, 'ERROR', config);
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
 * Returns capabilities and status of Watch Folder for UI.
 * Used by ScanDialog.
 */
function getWatchFolderStatus() {
  var config = getParameters_();
  var folderId = config.WATCH_FOLDER_ID;
  
  if (!folderId) return { error: 'No Watch Folder ID configured.' };
  
  try {
    var folder = DriveApp.getFolderById(folderId);
    var files = folder.getFiles();
    var itemList = [];
    
    while (files.hasNext()) {
      var f = files.next();
      var fname = f.getName().toLowerCase();
      // Simple filter for supported types
      if (fname.endsWith('.igc') || fname.endsWith('.zip') || fname.endsWith('.igx') || fname.endsWith('.gz')) {
        // Peek count?
        var count = 1;
        // Optimization: For ZIPs in Watch Folder, we *could* peek, but Utilities.unzip(blob) might be heavy if files are huge.
        // Let's rely on filename hint or just basic count for now, unless requested to be 100% accurate.
        // User requested: "scan Watch Folder Now... should say x no of new files / flights found"
        // Let's try to peek if it's a ZIP.
        if (fname.endsWith('.zip')) {
           try {
             // We can't peek without fetching blob, which might be slow. 
             // But for Watch Folder usage it's likely acceptable.
             var blob = f.getBlob();
             var entries = Utilities.unzip(blob);
             count = entries.filter(function(e){ return e.getName().match(/\.(igc|igx)$/i); }).length;
           } catch(e) { count = 1; } // specific error or encrypted zip
        }
        
        itemList.push({ id: f.getId(), name: f.getName(), flightCount: count });
      }
    }
    return { folderName: folder.getName(), files: itemList };
  } catch (e) {
    return { error: 'Error accessing folder: ' + e.message };
  }
}

/**
 * Handle Client Stage Upload
 * Unzips if needed, saves to Upload folder, returns list of individual IGC IDs to process.
 */
function stageUpload(fileObj) {
  try {
    var raw = Utilities.base64Decode(fileObj.data);
    var blob = Utilities.newBlob(raw, fileObj.type, fileObj.name);
    var config = getParameters_();
    
    var uploadFolderId = config.UPLOAD_FOLDER_ID;
    var folder = uploadFolderId ? DriveApp.getFolderById(uploadFolderId) : DriveApp.getRootFolder();
    
    var createdFiles = [];
    var lowerName = fileObj.name.toLowerCase();
    
    // Unzip Strategy
    if (lowerName.endsWith('.zip')) {
       try {
         var blobs = Utilities.unzip(blob);
         blobs.forEach(function(b) {
            if (b.getName().match(/\.(igc|igx)$/i)) {
               var f = folder.createFile(b);
               createdFiles.push({ id: f.getId(), name: f.getName() });
            }
         });
       } catch(e) {
          // If unzip fails, maybe it's just a corrupt file, treat as single? 
          // Or return error.
          return { error: 'ZIP Extraction failed: ' + e.message };
       }
    } 
    else if (lowerName.endsWith('.gz')) {
       try {
         var b = Utilities.gunzip(blob);
         b.setName(fileObj.name.replace(/\.gz$/i, ''));
         var f = folder.createFile(b);
         createdFiles.push({ id: f.getId(), name: f.getName() });
       } catch(e) {
         return { error: 'GZ Extraction failed: ' + e.message };
       }
    }
    else {
       // Regular IGC
       var f = folder.createFile(blob);
       createdFiles.push({ id: f.getId(), name: f.getName() });
    }
    
    return { success: true, files: createdFiles };
    
  } catch (e) {
    return { error: e.message };
  }
}

/**
 * Process a single file by ID.
 * Returns { success, msg } for UI.
 */
/**
 * Process a single file by ID.
 * Returns { success, msg } for UI.
 * @param {string} fileId
 * @param {string} source - 'WATCH', 'UPLOAD', 'URL'
 */
function processFileById(fileId, source) {
  var file = null;
  var config = getParameters_();

  try {
    file = DriveApp.getFileById(fileId);
    var result = processDriveFile_(file, config);
    
    // Context-Aware Cleanup
    if (source === 'UPLOAD' || source === 'URL') {
       // ALWAYS delete temp files from Upload Folder
       // The 'Master Log' copy is handled inside processDriveFile_ -> processBlob_ -> copyToMasterLog_
       // So we can safely trash this staging file.
       try { file.setTrashed(true); } catch(e) { console.warn('Failed to trash temp file', e); }
    } 
    else {
       // WATCH FOLDER Context (Default)
       if (result.processed) {
          handleFileCleanup_(file, 'SUCCESS', config);
       } else {
          handleFileCleanup_(file, 'ERROR', config);
       }
    }

    return { 
      success: true, 
      msg: result.processed ? 'Imported' : 'Skipped/Duplicate',
      processed: result.processed,
      flights: result.count || 0 
    };
  } catch (e) {
    // On Fatal Error
    if (source === 'UPLOAD' || source === 'URL') {
       // If it failed hard, we generally want to clean it up so it doesn't clutter, 
       // OR move to Error? User said: "Files with errors... moved or copied into ERROR_FOLDER_ID"
       // But for Upload/URL, usually the user just wants to retry or ignore. 
       // Let's Move to Error to be safe and delete from Upload.
       if (file) handleFileCleanup_(file, 'ERROR', config); // This copies to Error, may delete source if configured
       // Force delete source for Uploads if handleFileCleanup didn't (because MOVE_FROM_WATCH might be false)
       try { if (file && !file.isTrashed()) file.setTrashed(true); } catch(ex) {}
    } else {
       if (file) handleFileCleanup_(file, 'ERROR', config);
    }
    return { success: false, error: e.message };
  }
}

/**
 * Upload and process a single file (Base64).
 * Used by Picker.html for granular progress.
 */
function uploadAndProcessSingleFile(fileObj) {
  try {
    var raw = Utilities.base64Decode(fileObj.data);
    var blob = Utilities.newBlob(raw, fileObj.type, fileObj.name);
    var config = getParameters_();
    
    // 1. Save to Upload Folder (if configured, or Temp)
    // Actually, processDriveFile_ expects a DriveFile. 
    // We should create it in the Upload Folder first.
    var uploadFolderId = config.UPLOAD_FOLDER_ID; // We need to ensure this is in Config
    var folder;
    if (uploadFolderId) {
       folder = DriveApp.getFolderById(uploadFolderId);
    } else {
       folder = DriveApp.getRootFolder(); // Fallback
    }
    
    var file = folder.createFile(blob);
    var result = processDriveFile_(file, config);
    
    // Cleanup for Upload:
    // User: "Successful files always get deleted from UPLOAD_FOLDER_ID... Failed files always get deleted..."
    // Because processDriveFile_ -> processBlob_ now handles saving IGCs to Master/Error,
    // we just need to delete the temp file here.
    
    file.setTrashed(true); // Always delete temp file from Upload Folder
    
    return {
      success: true,
      msg: result.processed ? 'Imported' : 'Skipped (Duplicate)',
      processed: result.processed,
      flights: result.count || 0,
      fileId: file.getId()
    };
    
  } catch (e) {
    return { success: false, error: e.message };
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
 * Called from URLDialog.html
 * Phase 1: Download -> Unzip/Stage -> Return list of file IDs to process.
 */
function stageUrlImport(url) {
  try {
    var config = getParameters_();
    if (!url) throw new Error('No URL provided');
    
    var blob;
    var name = 'download.igc'; // default fallback
    
    // Check if it's a Drive ID/URL
    var driveId = getDriveIdFromUrl_(url);
    if (driveId) {
      var file = DriveApp.getFileById(driveId);
      blob = file.getBlob();
      name = file.getName();
    } else {
      // External URL
      var res = UrlFetchApp.fetch(url);
      blob = res.getBlob();
      // Try to get filename from Content-Disposition
      var headers = res.getHeaders();
      if (headers['Content-Disposition']) {
         var match = headers['Content-Disposition'].match(/filename="?([^"]+)"?/);
         if (match) name = match[1];
      }
      // If still generic, try URL path
      if (name === 'download.igc') {
         var parts = url.split('/');
         var last = parts[parts.length-1];
         if (last && last.match(/\.(igc|zip|gz|igx)/i)) name = last;
      }
    }
    
    // Reuse stageUpload logic by mocking the fileObj
    // We need to encode to base64? No, stageUpload expects base64 string.
    // Actually, we can just write a helper to stage a Blob directly to avoid base64 roundtrip overhead.
    
    return stageBlob_(blob, name, config);

  } catch (e) {
    console.error('stageUrlImport Error', e);
    return { error: e.message };
  }
}

/**
 * Helper to stage a Blob (from URL or Upload) to Drive
 */
function stageBlob_(blob, fileName, config) {
    var uploadFolderId = config.UPLOAD_FOLDER_ID;
    var folder = uploadFolderId ? DriveApp.getFolderById(uploadFolderId) : DriveApp.getRootFolder();
    var createdFiles = [];
    var lowerName = fileName.toLowerCase();
    
    try {
        if (lowerName.endsWith('.zip')) {
           var blobs = Utilities.unzip(blob);
           blobs.forEach(function(b) {
              if (b.getName().match(/\.(igc|igx)$/i)) {
                 var f = folder.createFile(b);
                 createdFiles.push({ id: f.getId(), name: f.getName() });
              }
           });
        } 
        else if (lowerName.endsWith('.gz')) {
           var b = Utilities.gunzip(blob);
           b.setName(fileName.replace(/\.gz$/i, ''));
           var f = folder.createFile(b);
           createdFiles.push({ id: f.getId(), name: f.getName() });
        }
        else {
           // Plain IGC
           blob.setName(fileName); // Ensure name is set
           var f = folder.createFile(blob);
           createdFiles.push({ id: f.getId(), name: f.getName() });
        }
        
        return { success: true, files: createdFiles };
        
    } catch(e) {
        return { error: 'Staging Failed: ' + e.message };
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

/**
 * Cleanup Helper: Move/Copy/Delete based on status and config
 */
function handleFileCleanup_(file, status, config) {
  try {
    var rawMove = config.MOVE_FROM_WATCH_FOLDER;
    var shouldMove = (rawMove === true || String(rawMove).toUpperCase() === 'TRUE');
    
    // 1. Success
    if (status === 'SUCCESS') {
      // NOTE: We do NOT copy to Master Log here anymore.
      // processBlob_ handles saving extracted IGCs to Master Log individually.
      // This prevents ZIP files or Archive containers from being copied to Master Log.
      
      // Delete from source if MOVE is true
      if (shouldMove) {
        file.setTrashed(true);
      }
    }
    // 2. Error / Partial
    else if (status === 'ERROR') {
      // Copy/Move to Error Folder
      if (config.ERROR_FOLDER_ID) {
        var errorFolder = DriveApp.getFolderById(config.ERROR_FOLDER_ID);
        var copy = file.makeCopy('ERROR_' + file.getName(), errorFolder);
      }
      
      // If MOVE is true, we delete the original from Watch to prevent loops
      // BUT only if we successfully backed it up to Error Folder
      if (shouldMove && config.ERROR_FOLDER_ID) {
        file.setTrashed(true);
      }
    }
    
  } catch (e) {
    console.error('Cleanup Error for ' + file.getName(), e);
  }
}

/* ==========================================================================================
   INTERNAL PROCESSING
   ========================================================================================== */

function processDriveFile_(file, config) {
  var blob = file.getBlob();
  var name = file.getName();
  var id = file.getId();
  
  var result = processBlob_(blob, name, id, config);
  
  // Clean up based on result
  // Note: processBlob_ returns { processed: bool, count: int, errors: [] }
  var status = result.processed ? 'SUCCESS' : 'ERROR';
  
  // Only cleanup if it's a Watch Folder file (checked via context usually, but here we can check parent?)
  // Actually, handleFileCleanup_ logic relies on 'MOVE_FROM_WATCH_FOLDER' config.
  // For Uploads/URLs, the calling function handles cleanup. 
  // This function is shared. We need to be careful.
  // Let's NOT call cleanup here. The CALLER (scanWatchFolder, uploadAndProcess) knows the context.
  
  return result;
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
     // Copy to Error Folder logic for individual files
     if (config.ERROR_FOLDER_ID) {
        try {
           var errFolder = DriveApp.getFolderById(config.ERROR_FOLDER_ID);
           var errName = 'ERROR_PARSE_' + fileName;
           errFolder.createFile(blob).setName(errName);
        } catch(e) { console.error('Failed to save to Error Folder', e); }
     }
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
  
  var masterRes = copyToMasterLog_(blob, fileName, config);
  if (masterRes.error) {
     noteLog.push('Master Log Error: ' + masterRes.error);
  }

  // F. XContest Verification
  var xcStatus = { status: '' };
  if (config.XCONTEST_USERNAME) {
     try {
       var flightDate = new Date(parsed.meta.dateIso); // Parse ISO date
       var durMin = Math.round(analysis.stats.durationSec / 60);
       var startMin = Math.round(analysis.stats.startTime / 60);
       xcStatus = XContest.checkFlight(flightDate, durMin, startMin, config);
       
       if (xcStatus.status === 'Error') {
          noteLog.push('XC Check: ' + xcStatus.note);
       } else if (xcStatus.status === 'No') {
          // Log to Info column if not found (per User Request)
          // We can't easily append to App_Log *row* here without knowing which row it is.
          // The log is written at the END of this function via logImport_.
          // So we just add it to 'noteLog' which gets joined into 'finalNotes' which gets passed to logImport_.
          // Wait, logImport_ writes to App_Log.
          // noteLog is used for the FLIGHT ENTRY notes? 
          // insertFlightRow -> uses finalNotes in the 'Notes' column of FLIGHTS sheet.
          // logImport_ -> uses finalNotes in the 'Info' column of APP_LOG sheet.
          // So adding to noteLog will make it appear in BOTH.
          // If user wants it ONLY in App_Log Info, we might need separate accumulator?
          // "The Xcontest matching function should write to the Info column when no match is found."
          // "all logging functions should append Info to this column... Nothing should get overwritten."
          // I will assume simple append to noteLog covers it.
          noteLog.push('XC: No Match'); 
       }
     } catch(e) { console.warn('XC Check Logic Fail', e); }
  }

  // G. Validation Check
  var status = 'Review?';
  // notes handled by array
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
  
  var finalNotes = noteLog.length > 0 ? noteLog.join(' | ') : '';
  
  // G. Insert Flight
  insertFlightRow_(parsed, fileId, outerName, status, finalNotes, analysis, scoring, masterRes.finalName, masterRes.fileId, {
    l: geoLaunch, ls: siteLaunch,
    d: geoLand, ds: siteLand,
    tz: timeZone
  }, xcStatus);
  
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
    // Check if this fileId/inner combo already exists to append?
    // User: "any function that writesto the log should always call one function to append to the Info column... Nothing should get overwritten."
    // This implies if we log multiple times for same file, we append to THAT row?
    // OR just append a NEW row?
    // "append Info to this column for each respective flight" -> Sounds like 1 row per flight, append info.
    // Finding the row is expensive. 
    // Current usage: logImport_ is called ONCE per finish or error.
    // Except scanWatchFolder calls it on error catch.
    // Let's implement row finding for Append.
    
    var lastRow = sh.getLastRow();
    var foundRow = -1;
    
    // Optimization: Only check last 50 rows?
    var checkRows = Math.min(lastRow, 50); 
    if (checkRows > 0) {
       var start = Math.max(1, lastRow - checkRows + 1);
       var data = sh.getRange(start, 2, checkRows, 3).getValues(); // FileID(B), FileName(C), InnerName(D)
       
       // Search backwards
       for (var i = data.length - 1; i >= 0; i--) {
          if (data[i][0] == fileId && data[i][2] == inner) { 
             foundRow = start + i;
             break;
          }
       }
    }
    
    if (foundRow > 0) {
       // Append to Info (Col 6)
       var cell = sh.getRange(foundRow, 6);
       var curr = cell.getValue();
       var newInfo = curr ? (curr + ' | ' + notes) : notes;
       cell.setValue(newInfo);
       // Also update status if useful? "Success" might overwrite "Processing"? 
       sh.getRange(foundRow, 5).setValue(status);
    } else {
       sh.appendRow([date, fileId, outer, inner, status, notes]);
    }
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
function insertFlightRow_(data, fileId, outerName, status, notes, analysis, scoring, igcFileName, masterFileId, geo, xcStatus) {
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
  // Use Config TIME_FORMAT if available
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
  
  // -- Flight Info --
  // 3. Map Data to Headers
  
  // -- Flight Info --
  // Generate SeeYou Link if Master File ID exists
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

  setVal('FlightID', flightIdVal);
  setVal('Status', status);
  setVal('Flight No', flightNoFormula);
  setVal('Auto Summary', autoSummary);
  setVal('IGC File', igcFileName);
  setVal('Notes', notes); // Write System Notes (Geo errors, Validation, etc)
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
        val = '=HYPERLINK("' + xcStatus.url + '", "Yes")';
     }
     setVal('XContest', val);
  }

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

/**
 * Copies the IGC file to the Master Log Folder.
 * Handles duplicates by renaming (append _copy) and flagging.
 * Returns { finalName: string, isDuplicate: boolean, error: string }
 */
function copyToMasterLog_(blob, fileName, config) {
  var result = { finalName: fileName, isDuplicate: false, error: null };
  var folderId = config.MASTER_LOG_FOLDER_ID;
  
  if (!folderId) return result; // Feature disabled key missing
  
  try {
    var folder = DriveApp.getFolderById(folderId);
    var finalName = fileName;
    
    // Check for existing file with same name
    var existing = folder.getFilesByName(fileName);
    if (existing.hasNext()) {
       result.isDuplicate = true;
       // Append suffix
       var parts = fileName.split('.');
       var ext = parts.pop();
       var base = parts.join('.');
       finalName = base + '_copy.' + ext;
       
       // Ensure unique copy name (simple check, not recursive for performance)
       if (folder.getFilesByName(finalName).hasNext()) {
          // If even _copy exists, add timestamp
          finalName = base + '_copy_' + Date.now() + '.' + ext;
       }
    }
    
    result.finalName = finalName;
    
    // Create File
    var newFile = folder.createFile(blob).setName(finalName);
    result.fileId = newFile.getId();
    
    // Set Permission: Anyone with link can view
    newFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    
  } catch (e) {
    console.error('Master Log Copy Error', e);
    result.error = e.message;
  }
  
  return result;
}
