/**
 * Paragliding Flight Log v2.0
 * Updated: 2026-10-02 21:35:41
 * 
 * MODULE: Utilities (Math & Formatting)
 * Consolidated geospatial calculations (Haversine, Bearing, Angular Difference)
 * and time/duration formatting helpers.
 */

var UTILS = UTILS || {};

/**
 * Calculates great-circle distance between two points in meters using the Haversine formula.
 * @param {number} lat1 Latitude of point 1 in decimal degrees
 * @param {number} lon1 Longitude of point 1 in decimal degrees
 * @param {number} lat2 Latitude of point 2 in decimal degrees
 * @param {number} lon2 Longitude of point 2 in decimal degrees
 * @return {number} Distance in meters
 */
function haversine_(lat1, lon1, lat2, lon2) {
  var R = 6371000; // Radius of Earth in meters
  var dLat = (lat2 - lat1) * Math.PI / 180;
  var dLon = (lon2 - lon1) * Math.PI / 180;
  var a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
          Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
          Math.sin(dLon / 2) * Math.sin(dLon / 2);
  var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Calculates the initial bearing (compass heading) from point 1 to point 2 in degrees (0..360).
 * @param {number} lat1 Latitude of point 1 in decimal degrees
 * @param {number} lon1 Longitude of point 1 in decimal degrees
 * @param {number} lat2 Latitude of point 2 in decimal degrees
 * @param {number} lon2 Longitude of point 2 in decimal degrees
 * @return {number} Bearing in degrees (0..360)
 */
function bearing_(lat1, lon1, lat2, lon2) {
  var toRad = Math.PI / 180;
  var toDeg = 180 / Math.PI;
  var y = Math.sin((lon2 - lon1) * toRad) * Math.cos(lat2 * toRad);
  var x = Math.cos(lat1 * toRad) * Math.sin(lat2 * toRad) -
          Math.sin(lat1 * toRad) * Math.cos(lat2 * toRad) * Math.cos((lon2 - lon1) * toRad);
  var brg = Math.atan2(y, x) * toDeg;
  return (brg + 360) % 360;
}

/**
 * Calculates the absolute smallest difference between two bearings in degrees (0..180).
 * @param {number} b1 Bearing 1 in degrees
 * @param {number} b2 Bearing 2 in degrees
 * @return {number} Angular difference in degrees (0..180)
 */
function angleDiff_(b1, b2) {
  var diff = Math.abs(b1 - b2) % 360;
  if (diff > 180) diff = 360 - diff;
  return diff;
}

/**
 * Formats a duration in seconds into a human-friendly string (e.g. "45 min" or "1.5 hrs").
 * @param {number} sec Duration in seconds
 * @return {string} Friendly duration text
 */
function friendlyDuration_(sec) {
  var m = Math.round(sec / 60);
  if (m < 60) return m + ' min';
  return (m / 60).toFixed(1) + ' hrs';
}

/**
 * Formats seconds from midnight into HH:mm:ss string.
 * @param {number} sec Seconds from midnight
 * @return {string} Formatted time string
 */
function formatTime_(sec) {
  var h = Math.floor(sec / 3600) % 24;
  var m = Math.floor((sec % 3600) / 60);
  var s = Math.floor(sec % 60);
  return ('0' + h).slice(-2) + ':' + ('0' + m).slice(-2) + ':' + ('0' + s).slice(-2);
}

/**
 * Extracts a clean Google Drive folder or file ID from a URL, link, or raw string.
 * Strips whitespace, query parameters, and folder/file URL paths.
 * @param {string} input - Raw ID or URL
 * @return {string} Extracted ID or empty string
 */
function cleanDriveId_(input) {
  if (!input) return '';
  var str = String(input).trim();
  // Check for /folders/<id>
  var folderMatch = str.match(/\/folders\/([-\w]+)/);
  if (folderMatch) return folderMatch[1];
  // Check for [?&]id=<id>
  var idMatch = str.match(/[?&]id=([-\w]+)/);
  if (idMatch) return idMatch[1];
  // Check for /file/d/<id>
  var fileMatch = str.match(/\/file\/d\/([-\w]+)/);
  if (fileMatch) return fileMatch[1];
  // Check for raw alphanumeric Drive ID (min 15 chars)
  var rawMatch = str.match(/^[-\w]{15,}$/);
  if (rawMatch) return rawMatch[0];
  // General match for any 20+ char token if text contains one
  var generalMatch = str.match(/[-\w]{20,}/);
  if (generalMatch) return generalMatch[0];
  return str;
}

/**
 * Normalizes XC Flight Class to standard taxonomy:
 * 'Free Flight', 'Flat Triangle', 'FAI Triangle', 'Out-and-Return'
 * @param {string} cls - Raw class string
 * @return {string} Normalized standard class
 */
function normalizeXcClass_(cls) {
  if (!cls) return '';
  var c = String(cls).trim();
  if (c === 'Free Distance' || c === 'Open') return 'Free Flight';
  if (c === 'Triangle') return 'Flat Triangle';
  return c;
}

/**
 * Converts a 1-based column number to a Google Sheets column letter (e.g. 1 -> 'A', 28 -> 'AB').
 * @param {number} colIdx - 1-based column index
 * @return {string} Column letter
 */
function columnToLetter_(colIdx) {
  if (!colIdx || colIdx < 1) return '';
  var letter = '';
  var temp = colIdx;
  while (temp > 0) {
    var rem = (temp - 1) % 26;
    letter = String.fromCharCode(65 + rem) + letter;
    temp = Math.floor((temp - 1) / 26);
  }
  return letter;
}

/**
 * Resolves the column letter of a named column on the Flights sheet (or any mapped sheet).
 * Resolves dynamically from:
 * 1. Column map object (or Sheet headers)
 * 2. TABS.FLIGHTS.groups (or provided columns array)
 * 3. Fallback letter
 * @param {Object|Sheet} mapOrSheet - Column map { colName: index } or Sheet object
 * @param {string} colName - Header name (e.g. 'Status', 'Flight Duration')
 * @param {string} [fallbackLetter] - Fallback letter if not found
 * @return {string} Column letter (e.g. 'B', 'M', 'BC')
 */
function getColLetter_(mapOrSheet, colName, fallbackLetter) {
  var idx = 0;
  if (mapOrSheet && typeof mapOrSheet.getLastColumn === 'function') {
    var map = getColumnMap_(mapOrSheet);
    idx = map[colName];
  } else if (mapOrSheet && typeof mapOrSheet === 'object') {
    idx = mapOrSheet[colName];
  }
  if (!idx && typeof TABS !== 'undefined' && TABS.FLIGHTS && TABS.FLIGHTS.groups) {
    var flatHeaders = [];
    TABS.FLIGHTS.groups.forEach(function(g) { flatHeaders = flatHeaders.concat(g.cols); });
    var pos = flatHeaders.indexOf(colName);
    if (pos > -1) idx = pos + 1;
  }
  if (!idx) return fallbackLetter || '';
  return columnToLetter_(idx);
}

// Export to UTILS namespace
UTILS.haversine = haversine_;
UTILS.bearing = bearing_;
UTILS.angleDiff = angleDiff_;
UTILS.friendlyDuration = friendlyDuration_;
UTILS.formatTime = formatTime_;
UTILS.cleanDriveId = cleanDriveId_;
UTILS.normalizeXcClass = normalizeXcClass_;
UTILS.columnToLetter = columnToLetter_;
UTILS.getColLetter = getColLetter_;
