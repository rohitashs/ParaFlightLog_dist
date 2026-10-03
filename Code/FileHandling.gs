/**
 * Paragliding Flight Log v2.0
 * Updated: 2026-10-02 21:35:41
 * 
 * MODULE: File Handling Service
 * Handles Google Drive I/O, Watch Folder scanning, File Uploads, URL Fetching,
 * Archive extraction (.zip, .gz), File Cleanup, and Master Log copying.
 */

var FILE_HANDLING = FILE_HANDLING || {};

/* ==========================================================================================
   WATCH FOLDER SCANNING
   ========================================================================================== */

/**
 * Triggered by Time-Based Trigger or manual menu click.
 * Scans configured Watch Folder(s) for new flight log files.
 */
function scanWatchFolderNow_() {
  var stats = { processed: 0, skipped: 0, errors: 0, flights: 0, log: [] };
  
  console.log('Starting Watch Folder Scan...');
  var config = getParameters_();
  var rawFolderIds = config.WATCH_FOLDER_ID || '';
  
  // Check Enable Switch (Handle boolean or string)
  var enabled = String(config.ENABLE_WATCH_FOLDER).toUpperCase();
  console.log('Watch Config: Enable=' + enabled + ', FolderIDs=' + rawFolderIds);

  if (enabled !== 'TRUE' && enabled !== 'YES') {
     var msg = 'Watch Folder is DISABLED in Config. Skipping.';
     console.warn(msg);
     stats.log.push(msg);
     return stats;
  }
  
  var folderCheck = validateRequiredFolders_(['WATCH_FOLDER_ID', 'MASTER_LOG_FOLDER_ID', 'ERROR_FOLDER_ID'], config);
  if (!folderCheck.valid) {
    console.error(folderCheck.error);
    stats.errors++;
    stats.log.push(folderCheck.error);
    return stats;
  }
  
  var folderIds = rawFolderIds.split(',').map(function(id) { return cleanDriveId_(id.trim()); }).filter(Boolean);
  
  var maxProcess = 25; // Cap to avoid execution timeouts per run
  var foundAny = false;
  
  for (var i = 0; i < folderIds.length; i++) {
    if (stats.processed >= maxProcess) break;
    var folderId = folderIds[i];
    try {
      var folder = DriveApp.getFolderById(folderId);
      var files = getFilesRecursive_(folder, 10, 0);
      
      for (var j = 0; j < files.length; j++) {
        if (stats.processed >= maxProcess) break;
        foundAny = true;
        var file = files[j];
        var fId = file.getId();
        var fName = file.getName();
        
        console.log('Checking file: ' + fName);
        try {
          var result = processDriveFile_(file, config, 'WATCH_FOLDER');
          if (result && result.processed) {
            console.log('Processed: ' + fName);
            stats.processed++;
            stats.flights += (result.count || 0);
            stats.log.push('Processed: ' + fName + ' (' + (result.count || 1) + ' flights)');
            handleFileCleanup_(file, 'SUCCESS', config);
          } else if (result && result.isDuplicate) {
            console.log('Skipped (All Duplicates): ' + fName);
            stats.skipped++;
            stats.log.push('Skipped (Duplicate): ' + fName);
            handleFileCleanup_(file, 'DUPLICATE', config);
          } else {
            console.log('Skipped (Duplicate/Error): ' + fName);
            stats.skipped++;
            stats.log.push('Skipped: ' + fName);
            handleFileCleanup_(file, 'ERROR', config);
          }
        } catch (e) {
          LOG.write('WATCH_FOLDER', '[ERR] ' + fName, 'FileID: ' + fId + ' | ' + e.message);
          console.error('Error processing ' + fName, e);
          stats.errors++;
          stats.log.push('Error (' + fName + '): ' + e.message);
          handleFileCleanup_(file, 'ERROR', config);
        }
      }
    } catch (e) {
      console.error('Watch Scan Error for folder ' + folderId + ':', e);
      stats.errors++;
      stats.log.push('Fatal Error accessing folder ' + folderId + ': ' + e.message);
    }
  }
  
  if (stats.processed > 0) {
    try {
      sortFlightsByDate_();
      stats.log.push('Logbook sorted chronologically.');
    } catch (sortErr) {
      console.warn('Watch scan auto-sort warning:', sortErr);
    }
  }

  if (stats.processed > 0 || stats.errors > 0) {
    LOG.write('WATCH_FOLDER', '[COMPLETE] Scan finished: ' + stats.processed + ' processed, ' + stats.skipped + ' skipped, ' + stats.errors + ' errors', stats.flights + ' flight(s) added');
  }

  return stats;
}

/**
 * Returns capabilities and status of Watch Folder for UI.
 * Used by ScanDialog. Supports multiple comma-separated folders and recursive search.
 */
function getWatchFolderStatus() {
  var config = getParameters_();
  var folderCheck = validateRequiredFolders_(['WATCH_FOLDER_ID', 'MASTER_LOG_FOLDER_ID', 'ERROR_FOLDER_ID'], config);
  if (!folderCheck.valid) return { error: folderCheck.error };
  
  var rawFolderIds = config.WATCH_FOLDER_ID || '';
  var folderIds = rawFolderIds.split(',').map(function(id) { return cleanDriveId_(id.trim()); }).filter(Boolean);
  
  try {
    var folderNames = [];
    var itemList = [];
    var seenIds = {};
    
    for (var i = 0; i < folderIds.length; i++) {
      var fId = folderIds[i];
      try {
        var folder = DriveApp.getFolderById(fId);
        folderNames.push(folder.getName());
        var files = getFilesRecursive_(folder, 10, 0);
        
        for (var j = 0; j < files.length; j++) {
          var f = files[j];
          var fileId = f.getId();
          if (seenIds[fileId]) continue;
          seenIds[fileId] = true;
          
          var fname = f.getName().toLowerCase();
          var count = 1;
          if (fname.endsWith('.zip')) {
            try {
              var blob = f.getBlob();
              var entries = Utilities.unzip(blob);
              count = entries.filter(function(e) { return e.getName().match(/\.(igc|igx)$/i); }).length;
            } catch(e) { count = 1; }
          }
          itemList.push({ id: fileId, name: f.getName(), flightCount: count });
        }
      } catch (err) {
        console.warn('Error accessing watch folder ID ' + fId + ': ' + err.message);
        folderNames.push('Invalid Folder (' + fId.slice(0, 8) + '...)');
      }
    }
    
    return { folderName: folderNames.join(', '), files: itemList };
  } catch (e) {
    return { error: 'Error accessing watch folders: ' + e.message };
  }
}

/* ==========================================================================================
   STAGING & INGESTION PIPELINE (CLIENT & URL)
   ========================================================================================== */

/**
 * Handle Client Stage Upload
 * Unzips if needed, saves to Upload folder, returns list of individual IGC IDs to process.
 * @param {Object} fileObj { name: string, type: string, data: base64 }
 */
function stageUpload(fileObj) {
  try {
    var config = getParameters_();
    var folderCheck = validateRequiredFolders_(['MASTER_LOG_FOLDER_ID', 'ERROR_FOLDER_ID', 'UPLOAD_FOLDER_ID'], config);
    if (!folderCheck.valid) {
      return { error: folderCheck.error };
    }
    
    var raw = Utilities.base64Decode(fileObj.data);
    var blob = Utilities.newBlob(raw, fileObj.type, fileObj.name);
    var uploadFolderId = cleanDriveId_(config.UPLOAD_FOLDER_ID);
    var folder = DriveApp.getFolderById(uploadFolderId);
    
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
 * @param {string} fileId
 * @param {string} source - 'WATCH', 'UPLOAD', 'URL', 'URL_CUSTOM'
 * @param {boolean} [deleteSource=false]
 */
function processFileById(fileId, source, deleteSource, isDriveSource) {
  var file = null;
  var config = getParameters_();
  var isDelete = (deleteSource === true || deleteSource === 'true');
  if (isDriveSource === undefined) isDriveSource = true;

  var procKey = 'FILE_UPLOAD';
  if (source === 'WATCH') procKey = 'WATCH_FOLDER';
  else if (source === 'URL' || source === 'URL_CUSTOM') procKey = 'URL_IMPORT';

  try {
    file = DriveApp.getFileById(fileId);
    var result = processDriveFile_(file, config, procKey);
    
    // Context-Aware Cleanup
    if (source === 'UPLOAD' || source === 'URL') {
       // Staged upload temp files are ALWAYS removed from Upload Folder
       // Master Log copy is already handled inside processDriveFile_ -> processBlob_ -> copyToMasterLog_
       if (!result.processed && !result.isDuplicate) {
          copyToErrorFolder_(file, file.getName(), config);
       }
       try { file.setTrashed(true); } catch(e) { console.warn('Failed to trash temp upload file', e); }
    }
    else if (source === 'URL_CUSTOM') {
       if (result.processed || result.isDuplicate) {
          // File was successfully processed (and copied to Master Log inside processSingleIgcBlob_)
          // Or is duplicate (already in Master Log)
          if (isDelete || isDriveSource === false) {
             try { file.setTrashed(true); } catch(e) { console.warn('Failed to trash source/temp file', e); }
          }
       } else {
          // Unsuccessful file (Parse failure / invalid / heuristic error)
          // Always copy to Error Folder
          copyToErrorFolder_(file, file.getName(), config);
          if (isDelete || isDriveSource === false) {
             try { file.setTrashed(true); } catch(e) { console.warn('Failed to trash failed source/temp file', e); }
          }
       }
    }
    else {
       // WATCH FOLDER Context (Default)
       if (result.processed) {
          handleFileCleanup_(file, 'SUCCESS', config);
       } else if (result.isDuplicate) {
          handleFileCleanup_(file, 'DUPLICATE', config);
       } else {
          handleFileCleanup_(file, 'ERROR', config);
       }
    }

    return { 
      success: true, 
      msg: result.processed ? 'Imported' : (result.isDuplicate ? 'Duplicate (Skipped)' : 'Failed/Invalid'),
      processed: result.processed,
      isDuplicate: result.isDuplicate,
      flights: result.count || 0 
    };
  } catch (e) {
    console.error('processFileById fatal error for ' + fileId, e);
    // On Fatal Error: always copy to error folder
    if (file) {
      copyToErrorFolder_(file, file.getName(), config);
    }
    if (source === 'UPLOAD' || source === 'URL') {
       try { if (file && !file.isTrashed()) file.setTrashed(true); } catch(ex) {}
    } else if (source === 'URL_CUSTOM') {
       if ((isDelete || isDriveSource === false) && file) {
          try { if (!file.isTrashed()) file.setTrashed(true); } catch(ex) {}
       }
    } else {
       if (file) handleFileCleanup_(file, 'ERROR', config);
    }
    return { success: false, error: e.message };
  }
}

/**
 * Called from URLDialog.html
 * Accepts an external URL, Drive File ID/URL, or Drive Folder ID/URL.
 * Discovers and stages files (unzipping archives, recursively scanning folders).
 * Returns { success: true, count: number, files: [ { id: string, name: string, isDriveSource: boolean } ] }
 */
function stageUrlOrDriveImport(input) {
  try {
    var config = getParameters_();
    var folderCheck = validateRequiredFolders_(['MASTER_LOG_FOLDER_ID', 'ERROR_FOLDER_ID', 'UPLOAD_FOLDER_ID'], config);
    if (!folderCheck.valid) {
      return { error: folderCheck.error };
    }
    if (!input) throw new Error('No URL or Folder ID provided');
    var str = String(input).trim();
    
    // Check for Google Drive folder or file ID
    var driveId = getDriveIdFromUrl_(str) || str;
    
    // 1. Check if it's a Drive Folder
    try {
      var folder = DriveApp.getFolderById(driveId);
      if (folder) {
        var stats = {};
        var foundFiles = getFilesRecursive_(folder, 10, 0, stats);
        if (foundFiles.length === 0) {
          return { error: 'No supported flight files (.igc, .zip, etc.) found in folder: ' + folder.getName() };
        }
        var filesList = [];
        var sourceArchiveIds = [];
        for (var i = 0; i < foundFiles.length; i++) {
          var f = foundFiles[i];
          var fName = f.getName().toLowerCase();
          // If a file inside folder is a zip, unpack it
          if (fName.endsWith('.zip') || fName.endsWith('.gz')) {
            sourceArchiveIds.push(f.getId());
            var stagedZip = stageBlob_(f.getBlob(), f.getName(), config);
            if (stagedZip && stagedZip.files) {
              filesList = filesList.concat(stagedZip.files);
            }
          } else {
            filesList.push({
              id: f.getId(),
              name: f.getName(),
              isDriveSource: true
            });
          }
        }

        // Log Discovery Event in Activity Logs (Recorded regardless of execution mode: Modal, Sidebar, Background)
        var totalScanned = stats.totalScanned || foundFiles.length;
        var subCount = stats.subfolderCount || 0;
        var archCount = stats.archiveCount || 0;
        var unsuppCount = stats.unsupportedCount || 0;
        var discMsg = '[DISCOVERY] Found ' + totalScanned + ' file(s) across ' + subCount + ' subfolder(s) and ' + archCount + ' archive(s)';
        var discDetails = 'Staged ' + filesList.length + ' flight file(s) for ingestion' + (unsuppCount > 0 ? ' (' + unsuppCount + ' non-flight files ignored)' : '');
        LOG.write('BULK_INGEST', discMsg, discDetails);

        return {
          success: true,
          type: 'FOLDER',
          folderName: folder.getName(),
          files: filesList,
          sourceArchiveIds: sourceArchiveIds,
          discoveryStats: {
            totalScanned: totalScanned,
            subfolders: subCount,
            archives: archCount,
            flightFiles: filesList.length,
            unsupported: unsuppCount
          }
        };
      }
    } catch (eNotFolder) {
      // Not a folder, proceed
    }
    
    // 2. Check if it's a Drive File
    try {
      if (driveId && !str.match(/^https?:\/\/(?!drive\.google\.com)/)) {
        var file = DriveApp.getFileById(driveId);
        if (file) {
          var fName = file.getName().toLowerCase();
          if (fName.endsWith('.zip') || fName.endsWith('.gz')) {
            var staged = stageBlob_(file.getBlob(), file.getName(), config);
            if (staged && staged.files) {
              return {
                success: true,
                type: 'FILE',
                folderName: file.getName(),
                files: staged.files,
                sourceArchiveIds: [file.getId()]
              };
            }
            return staged;
          } else {
            return {
              success: true,
              type: 'FILE',
              folderName: file.getName(),
              files: [{ id: file.getId(), name: file.getName(), isDriveSource: true }],
              sourceArchiveIds: []
            };
          }
        }
      }
    } catch (eNotFile) {
      // Not a file, proceed
    }
    
    // 3. External URL
    if (str.match(/^https?:\/\//)) {
      var res = UrlFetchApp.fetch(str);
      var blob = res.getBlob();
      var name = 'download.igc';
      var headers = res.getHeaders();
      if (headers['Content-Disposition']) {
        var match = headers['Content-Disposition'].match(/filename="?([^"]+)"?/);
        if (match) name = match[1];
      }
      if (name === 'download.igc') {
        var parts = str.split('/');
        var last = parts[parts.length - 1];
        if (last && last.match(/\.(igc|zip|gz|igx)/i)) name = last;
      }
      return stageBlob_(blob, name, config);
    }
    
    return { error: 'Invalid URL or Google Drive ID. Please verify the input.' };
    
  } catch (e) {
    console.error('stageUrlOrDriveImport Error', e);
    return { error: e.message };
  }
}

/**
 * Trash source files (e.g. source ZIP archives) when user selected 'deleteSource'
 * @param {Array<string>} fileIds
 */
function trashSourceFiles(fileIds) {
  if (!fileIds || !fileIds.length) return { success: true, count: 0 };
  var trashedCount = 0;
  var config = getParameters_();
  for (var i = 0; i < fileIds.length; i++) {
    try {
      var f = DriveApp.getFileById(fileIds[i]);
      if (f && !f.isTrashed()) {
        moveToTrashFolder_(f, f.getName(), config);
        trashedCount++;
      }
    } catch (e) {
      console.warn('trashSourceFiles error for ID ' + fileIds[i], e);
    }
  }
  return { success: true, count: trashedCount };
}

/* ==========================================================================================
   DRIVE FILE UTILITIES & CLEANUP
   ========================================================================================== */

/**
 * Helper to stage a Blob (from URL or Upload) to Drive
 */
function stageBlob_(blob, fileName, config) {
  config = config || getParameters_();
  var uploadFolderId = cleanDriveId_(config.UPLOAD_FOLDER_ID);
  if (!uploadFolderId) {
    return { error: 'Upload Folder (UPLOAD_FOLDER_ID) is not configured in Parameters tab.' };
  }
  var folder = null;
  try {
    folder = DriveApp.getFolderById(uploadFolderId);
  } catch (e) {
    return { error: 'Upload Folder (ID: ' + uploadFolderId + ') is not accessible: ' + e.message };
  }
  if (!folder) {
    return { error: 'Upload Folder could not be found with ID: ' + uploadFolderId };
  }
  var createdFiles = [];
  var lowerName = fileName.toLowerCase();
  
  try {
      if (lowerName.endsWith('.zip')) {
         var blobs = Utilities.unzip(blob);
         blobs.forEach(function(b) {
            if (b.getName().match(/\.(igc|igx)$/i)) {
               var f = folder.createFile(b);
               createdFiles.push({ id: f.getId(), name: f.getName(), isDriveSource: false });
            }
         });
      } 
      else if (lowerName.endsWith('.gz')) {
         var b = Utilities.gunzip(blob);
         b.setName(fileName.replace(/\.gz$/i, ''));
         var f = folder.createFile(b);
         createdFiles.push({ id: f.getId(), name: f.getName(), isDriveSource: false });
      }
      else {
         // Plain IGC
         blob.setName(fileName);
         var f = folder.createFile(blob);
         createdFiles.push({ id: f.getId(), name: f.getName(), isDriveSource: false });
      }
      
      return { success: true, files: createdFiles };
      
  } catch(e) {
      return { error: 'Staging Failed: ' + e.message };
  }
}

/**
 * Moves or copies a discarded or duplicate flight file to the Trash / Discard Folder.
 * Strictly uses TRASH_FOLDER_ID from Parameters.
 * Falls back to Drive soft-delete (setTrashed) if TRASH_FOLDER_ID is not configured.
 * @param {GoogleAppsScript.Drive.File|GoogleAppsScript.Base.Blob} fileOrBlob
 * @param {string} [fileName]
 * @param {Object} [config]
 * @return {{ success: boolean, fileId: string|null, error: string|null }}
 */
function moveToTrashFolder_(fileOrBlob, fileName, config) {
  var result = { success: false, fileId: null, error: null };
  config = config || getParameters_();
  var folderId = cleanDriveId_(config.TRASH_FOLDER_ID);

  if (!folderId) {
    try {
      if (fileOrBlob && typeof fileOrBlob.setTrashed === 'function') {
        fileOrBlob.setTrashed(true);
        result.success = true;
      }
    } catch (e) {
      result.error = e.message;
    }
    return result;
  }

  var trashFolder = null;
  try {
    trashFolder = DriveApp.getFolderById(folderId);
  } catch (e) {
    result.error = 'Trash folder inaccessible: ' + e.message;
    return result;
  }

  if (!trashFolder) {
    result.error = 'Trash folder not found with ID: ' + folderId;
    return result;
  }

  try {
    if (fileOrBlob && typeof fileOrBlob.moveTo === 'function') {
      fileOrBlob.moveTo(trashFolder);
      result.success = true;
      result.fileId = fileOrBlob.getId();
    } else if (fileOrBlob && typeof fileOrBlob.makeCopy === 'function') {
      var copy = fileOrBlob.makeCopy(fileName || fileOrBlob.getName(), trashFolder);
      result.success = true;
      result.fileId = copy.getId();
    } else {
      var blob = (fileOrBlob && typeof fileOrBlob.getBlob === 'function') ? fileOrBlob.getBlob() : fileOrBlob;
      var newF = trashFolder.createFile(blob).setName(fileName || 'discarded.igc');
      result.success = true;
      result.fileId = newF.getId();
    }
  } catch (e) {
    console.error('Error moving to trash folder:', e);
    result.error = e.message;
  }
  return result;
}

/**
 * Cleanup Helper: Move/Copy/Delete based on status and config
 */
function handleFileCleanup_(file, status, config) {
  try {
    var rawMove = config.MOVE_FROM_WATCH_FOLDER;
    // Default shouldMove to true unless explicitly configured as FALSE
    var shouldMove = (rawMove !== false && String(rawMove).toUpperCase() !== 'FALSE');
    
    // 1. Success or Duplicate -> Route to TRASH folder!
    if (status === 'SUCCESS' || status === 'DUPLICATE') {
      if (shouldMove) {
        moveToTrashFolder_(file, file.getName(), config);
      }
    }
    // 2. Error / Partial / Unparseable -> Route to ERROR folder!
    else if (status === 'ERROR') {
      copyToErrorFolder_(file, file.getName(), config);
      if (shouldMove) {
        file.setTrashed(true);
      }
    }
    
  } catch (e) {
    console.error('Cleanup Error for ' + file.getName(), e);
  }
}

/**
 * Validates that all required Google Drive folders are configured in Parameters and accessible.
 * Never creates folders in Drive root.
 * @param {Array<string>} requiredKeys - e.g. ['MASTER_LOG_FOLDER_ID', 'ERROR_FOLDER_ID', 'UPLOAD_FOLDER_ID']
 * @param {Object} [config]
 * @return {{ valid: boolean, error?: string }}
 */
function validateRequiredFolders_(requiredKeys, config) {
  config = config || getParameters_();
  
  var folderLabels = {
    MASTER_LOG_FOLDER_ID: { name: 'Master Log Folder', menu: 'Update Master Log Folder...' },
    ERROR_FOLDER_ID: { name: 'Error Folder', menu: 'Update Error Folder...' },
    UPLOAD_FOLDER_ID: { name: 'Upload Folder', menu: 'Update Upload Folder...' },
    WATCH_FOLDER_ID: { name: 'Watch Folder', menu: 'Update Watch Folder...' },
    TRASH_FOLDER_ID: { name: 'Trash / Discard Folder', menu: 'Set Trash / Discard Folder...' }
  };

  for (var i = 0; i < requiredKeys.length; i++) {
    var key = requiredKeys[i];
    var label = folderLabels[key] || { name: key, menu: 'Parameters tab' };
    
    if (key === 'WATCH_FOLDER_ID') {
      var rawWatch = config.WATCH_FOLDER_ID || '';
      var watchIds = String(rawWatch).split(',').map(function(s) {
        return cleanDriveId_(s.trim());
      }).filter(Boolean);
      
      if (watchIds.length === 0) {
        return {
          valid: false,
          error: 'Configuration Error: Watch Folder (' + key + ') is not configured. Please set it in the Parameters tab (Flight Log > Admin > ' + label.menu + ').'
        };
      }
      
      var anyAccessible = false;
      for (var w = 0; w < watchIds.length; w++) {
        try {
          var wf = DriveApp.getFolderById(watchIds[w]);
          if (wf) {
            anyAccessible = true;
            break;
          }
        } catch (eWatch) {}
      }
      if (!anyAccessible) {
        return {
          valid: false,
          error: 'Configuration Error: None of the configured Watch Folder ID(s) are accessible (' + watchIds.join(', ') + '). Please verify permissions or update via Flight Log > Admin > ' + label.menu + '.'
        };
      }
    } else {
      var rawId = config[key];
      var cleanId = cleanDriveId_(rawId);
      if (!cleanId) {
        return {
          valid: false,
          error: 'Configuration Error: ' + label.name + ' (' + key + ') is not configured. Please set it in the Parameters tab (Flight Log > Admin > ' + label.menu + ').'
        };
      }
      try {
        var folder = DriveApp.getFolderById(cleanId);
        if (!folder) {
          return {
            valid: false,
            error: 'Configuration Error: ' + label.name + ' (' + key + ') could not be found with ID "' + cleanId + '". Please update it via Flight Log > Admin > ' + label.menu + '.'
          };
        }
      } catch (e) {
        return {
          valid: false,
          error: 'Configuration Error: ' + label.name + ' (' + key + ') is not accessible with ID "' + cleanId + '": ' + e.message + '. Please verify permissions or update via Flight Log > Admin > ' + label.menu + '.'
        };
      }
    }
  }

  return { valid: true };
}

/**
 * Copies a failed/unsuccessful flight file to the Error Folder.
 * Strictly uses ERROR_FOLDER_ID from Parameters (never creates folders in Drive root).
 * Returns { success: boolean, fileId: string, error: string }
 */
function copyToErrorFolder_(fileOrBlob, fileName, config) {
  var result = { success: false, fileId: null, error: null };
  config = config || getParameters_();
  
  var folderId = cleanDriveId_(config.ERROR_FOLDER_ID);
  if (!folderId) {
    result.error = 'Error folder (ERROR_FOLDER_ID) is not configured in Parameters tab.';
    return result;
  }
  
  var errorFolder = null;
  try {
    errorFolder = DriveApp.getFolderById(folderId);
  } catch (e) {
    result.error = 'Error folder (ID: ' + folderId + ') is not accessible: ' + e.message;
    return result;
  }
  
  if (!errorFolder) {
    result.error = 'Error folder could not be found with ID: ' + folderId;
    return result;
  }
  
  try {
    var errName = 'ERROR_' + (fileName || 'flight.igc');
    var newFile;
    if (fileOrBlob && typeof fileOrBlob.makeCopy === 'function') {
      newFile = fileOrBlob.makeCopy(errName, errorFolder);
    } else {
      var blob = (fileOrBlob && typeof fileOrBlob.getBlob === 'function') ? fileOrBlob.getBlob() : fileOrBlob;
      newFile = errorFolder.createFile(blob).setName(errName);
    }
    result.success = true;
    result.fileId = newFile.getId();
  } catch (e) {
    console.error('Error copying to error folder for ' + fileName, e);
    result.error = e.message;
  }
  return result;
}

/**
 * Copies the IGC file to the Master Log Folder.
 * Strictly uses MASTER_LOG_FOLDER_ID from Parameters (never creates folders in Drive root).
 * Handles duplicates by renaming (append _copy) and flagging.
 * Returns { finalName: string, isDuplicate: boolean, error: string, fileId: string }
 */
function copyToMasterLog_(blob, fileName, config, hashStr) {
  var result = { finalName: fileName, isDuplicate: false, isExactMasterMatch: false, error: null, fileId: null };
  config = config || getParameters_();
  
  var folderId = cleanDriveId_(config.MASTER_LOG_FOLDER_ID);
  if (!folderId) {
    result.error = 'Master Log folder (MASTER_LOG_FOLDER_ID) is not configured in Parameters tab.';
    return result;
  }
  
  var folder = null;
  try {
    folder = DriveApp.getFolderById(folderId);
  } catch (e) {
    result.error = 'Master Log folder (ID: ' + folderId + ') is not accessible: ' + e.message;
    return result;
  }
  
  if (!folder) {
    result.error = 'Master Log folder could not be found with ID: ' + folderId;
    return result;
  }
  
  try {
    var finalName = fileName;
    
    // Check for existing file with same name
    var existing = folder.getFilesByName(fileName);
    if (existing.hasNext()) {
       var existingFile = existing.next();
       try {
         var existingDigest = Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, existingFile.getBlob().getDataAsString());
         var existingHashStr = existingDigest.map(function(b) { return ('0' + (b & 0xFF).toString(16)).slice(-2); }).join('');
         if (hashStr && existingHashStr === hashStr) {
           // Exact MD5 match already in Master Log!
           result.finalName = existingFile.getName();
           result.fileId = existingFile.getId();
           result.isDuplicate = false;
           result.isExactMasterMatch = true;
           return result;
         }
       } catch (eHash) {
         console.warn('Could not compute existing master file hash:', eHash);
       }

       result.isDuplicate = true;
       result.existingMasterFileId = existingFile.getId();
       result.existingMasterHash = existingHashStr || null;
       // Append suffix
       var parts = fileName.split('.');
       var ext = parts.pop();
       var base = parts.join('.');
       finalName = base + '_copy.' + ext;
       
       if (folder.getFilesByName(finalName).hasNext()) {
          finalName = base + '_copy_' + Date.now() + '.' + ext;
       }
    }
    
    result.finalName = finalName;
    
    // Create File in Master Folder
    var newFile = folder.createFile(blob).setName(finalName);
    result.fileId = newFile.getId();
    
    // Set Permission: Anyone with link can view (graceful if restricted)
    try {
      newFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    } catch (eShare) {
      console.warn('Master Log public sharing note: ' + eShare.message);
    }
    
  } catch (e) {
    console.error('Master Log Copy Error', e);
    result.error = e.message;
  }
  
  return result;
}

/**
 * Recursively collects files matching supported flight log extensions (.igc, .igx, .zip, .gz)
 * up to maxDepth levels deep (default 10).
 * @param {GoogleAppsScript.Drive.Folder} folder
 * @param {number} [maxDepth=10]
 * @param {number} [currentDepth=0]
 * @return {Array<GoogleAppsScript.Drive.File>}
 */
function getFilesRecursive_(folder, maxDepth, currentDepth, stats) {
  if (currentDepth === undefined) currentDepth = 0;
  if (maxDepth === undefined) maxDepth = 10;
  if (currentDepth > maxDepth) return [];
  if (stats && currentDepth === 0 && !stats.initialized) {
    stats.totalScanned = 0;
    stats.subfolderCount = 0;
    stats.archiveCount = 0;
    stats.flightFileCount = 0;
    stats.unsupportedCount = 0;
    stats.initialized = true;
  }
  
  var result = [];
  try {
    var files = folder.getFiles();
    while (files.hasNext()) {
      var f = files.next();
      var fName = f.getName();
      if (stats) stats.totalScanned++;
      if (fName.match(/\.(igc|igx)$/i)) {
        result.push(f);
        if (stats) stats.flightFileCount++;
      } else if (fName.match(/\.(zip|gz)$/i)) {
        result.push(f);
        if (stats) stats.archiveCount++;
      } else {
        if (stats) stats.unsupportedCount++;
      }
    }
    
    var subfolders = folder.getFolders();
    while (subfolders.hasNext()) {
      var sub = subfolders.next();
      if (stats) stats.subfolderCount++;
      var subFiles = getFilesRecursive_(sub, maxDepth, currentDepth + 1, stats);
      result = result.concat(subFiles);
    }
  } catch (e) {
    console.warn('Error reading folder recursively: ' + e.message);
  }
  return result;
}

/**
 * Extracts a Google Drive file/folder ID from a URL or raw string.
 * @param {string} url
 * @return {string|null}
 */
function getDriveIdFromUrl_(url) {
  var re = /[-\w]{25,}/;
  var match = url.match(re);
  if (url.indexOf('drive.google.com') > -1 && match) {
    return match[0];
  }
  return null;
}

// Export to FILE_HANDLING namespace
FILE_HANDLING.scanWatchFolderNow = scanWatchFolderNow_;
FILE_HANDLING.getWatchFolderStatus = getWatchFolderStatus;
FILE_HANDLING.stageUpload = stageUpload;
FILE_HANDLING.processFileById = processFileById;
FILE_HANDLING.stageUrlOrDriveImport = stageUrlOrDriveImport;
FILE_HANDLING.trashSourceFiles = trashSourceFiles;
FILE_HANDLING.moveToTrashFolder = moveToTrashFolder_;
FILE_HANDLING.copyToMasterLog = copyToMasterLog_;
FILE_HANDLING.copyToErrorFolder = copyToErrorFolder_;
FILE_HANDLING.validateRequiredFolders = validateRequiredFolders_;
FILE_HANDLING.getFilesRecursive = getFilesRecursive_;
FILE_HANDLING.getDriveIdFromUrl = getDriveIdFromUrl_;
