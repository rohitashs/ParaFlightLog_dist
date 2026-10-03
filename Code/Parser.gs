/**
 * Paragliding Flight Log v2.0
 * Updated: 2026-10-02 21:52:07
 */
/**
 * Paragliding Flight Log v2.0
 * 
 * MODULE: IGC Parser
 * Responsible for parsing raw IGC text into a structured object with fixes.
 */

var PARSER = {
  // Regex for B-record (lenient):
  // B HHMMSS DDMMmmm N DDDMMmmm E V PPPPP GGGGG
  // Groups: 1=Time, 2=LatDeg, 3=LatMin, 4=LatThou, 5=LatHem, 6=LonDeg, 7=LonMin, 8=LonThou, 9=LonHem, 10=Val, 11=PressAlt, 12=GnssAlt
  RE_B_RECORD: /^B(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})(\d{3})([NSns])(\d{3})(\d{2})(\d{3})([EWew])([AVav])?(\d{0,5})(\d{0,5})/,
  
  // Headers
  RE_DATE: /H[FO]DTE(?:DATE:)?(\d{2})(\d{2})(\d{2})/, // DDMMYY
  RE_PILOT: /H[FO]PLT(?:.*?):(.*)$/i,
  RE_GLIDER: /H[FO]GTY(?:.*?):(.*)$/i,
  RE_ID: /H[FO]GID(?:.*?):(.*)$/i,
};

/**
 * Main Parse Function
 * @param {string} text - Raw IGC file content
 * @param {string} fileName - Original filename for meta
 * @return {Object|null} - { meta, fixes, stats } or null if invalid
 */
function parseIgc(text, fileName) {
  if (!text) return null;
  
  var lines = text.split(/\r?\n/);
  var meta = {
    dateIso: null,
    pilot: '',
    glider: '',
    flightId: '',
    fileName: fileName || ''
  };
  var fixes = [];
  
  // 1. Scan for Headers & Fixes
  for (var i = 0; i < lines.length; i++) {
    var line = lines[i].trim();
    if (!line) continue;
    
    var char = line[0].toUpperCase();
    
    if (char === 'B') {
      var fix = parseBRecord_(line, meta.dateIso);
      if (fix) fixes.push(fix);
    } else if (char === 'H') {
      // Parse headers
      if (!meta.dateIso) {
        var mDate = line.match(PARSER.RE_DATE);
        if (mDate) meta.dateIso = igcDateToIso_(mDate[1], mDate[2], mDate[3]);
      }
      if (!meta.pilot) {
        var mPilot = line.match(PARSER.RE_PILOT);
        if (mPilot) meta.pilot = mPilot[1].trim();
      }
      if (!meta.glider) {
        var mGlider = line.match(PARSER.RE_GLIDER);
        if (mGlider) meta.glider = mGlider[1].trim();
      }
      if (!meta.flightId) {
        var mId = line.match(PARSER.RE_ID);
        if (mId) meta.flightId = mId[1].trim();
      }
    }
  }

  // 2. Validate & Post-Process
  if (fixes.length < 2) return null; // Need at least 2 points
  
  // Handle midnight UTC crossover: normalize timestamps to be monotonically increasing
  var dayOffsetSec = 0;
  for (var i = 1; i < fixes.length; i++) {
    while ((fixes[i].t + dayOffsetSec) < fixes[i-1].t - 43200) {
      dayOffsetSec += 86400;
    }
    fixes[i].t += dayOffsetSec;
  }
  
  if (!meta.dateIso) {
    // Fallback: Current date if missing in header
    meta.dateIso = new Date().toISOString().substring(0, 10); 
  }

  // 3. Compute Basic Stats (Track Len, Duration)
  var stats = computeBasicStats_(fixes);
  
  return {
    meta: meta,
    fixes: fixes,
    stats: stats
  };
}

/**
 * Parses a single B-record line.
 * @return {Object|null} { timeSec, lat, lon, alt, valid }
 */
function parseBRecord_(line, dateIso) {
  // Parsing logic
  var m = line.match(PARSER.RE_B_RECORD);
  if (!m) return null;
  
  // Time
  var hh = parseInt(m[1], 10);
  var mm = parseInt(m[2], 10);
  var ss = parseInt(m[3], 10);
  var timeSec = hh * 3600 + mm * 60 + ss;
  
  // Lat
  var latDeg = parseInt(m[4], 10);
  var latMin = parseInt(m[5], 10) + parseInt(m[6], 10) / 1000;
  var lat = latDeg + latMin / 60;
  if (m[7].toUpperCase() === 'S') lat = -lat;
  
  // Lon
  var lonDeg = parseInt(m[8], 10);
  var lonMin = parseInt(m[9], 10) + parseInt(m[10], 10) / 1000;
  var lon = lonDeg + lonMin / 60;
  if (m[11].toUpperCase() === 'W') lon = -lon;
  
  // Validity
  var valid = m[12] ? (m[12].toUpperCase() === 'A') : true; // Default valid if missing
  
  // Alt
  var pressAlt = m[13] ? parseInt(m[13], 10) : 0;
  var gnssAlt = m[14] ? parseInt(m[14], 10) : null;
  
  // Use GNSS if available, else Pressure
  var alt = (gnssAlt !== null && !isNaN(gnssAlt)) ? gnssAlt : pressAlt;

  return {
    t: timeSec,
    lat: lat,
    lon: lon,
    alt: alt,
    valid: valid
  };
}

/**
 * Helper: DDMMYY -> YYYY-MM-DD
 */
function igcDateToIso_(dd, mm, yy) {
  var y = parseInt(yy, 10);
  var year = (y < 70) ? 2000 + y : 1900 + y; // Pivot 1970/2070
  var mon = parseInt(mm, 10);
  var day = parseInt(dd, 10);
  
  return year + '-' + ('0' + mon).slice(-2) + '-' + ('0' + day).slice(-2);
}

/**
 * Helper: Basic statistics (Dist, Dur, MaxAlt)
 */
function computeBasicStats_(fixes) {
  var dist = 0;
  var maxAlt = -Infinity;
  var minAlt = Infinity;
  var startTime = fixes[0].t;
  var endTime = fixes[fixes.length - 1].t;
  
  // Fix midnight crossover for duration if needed (simple version: assume same day)
  if (endTime < startTime) endTime += 86400; 
  var duration = endTime - startTime;

  for (var i = 0; i < fixes.length; i++) {
    var f = fixes[i];
    if (f.alt > maxAlt) maxAlt = f.alt;
    if (f.alt < minAlt) minAlt = f.alt;
    
    if (i > 0) {
      var prev = fixes[i-1];
      dist += haversine_(prev.lat, prev.lon, f.lat, f.lon);
    }
  }

  // Straight line
  var start = fixes[0];
  var end = fixes[fixes.length - 1];
  var straightDist = haversine_(start.lat, start.lon, end.lat, end.lon);

  return {
    trackLenKm: dist / 1000,
    straightDistKm: straightDist / 1000,
    durationSec: duration,
    maxAlt: maxAlt,
    minAlt: minAlt,
    startTime: startTime,
    endTime: endTime
  };
}

// Export to Namespace
PARSER.parseIgc = parseIgc;

