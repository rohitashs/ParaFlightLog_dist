/**
 * Paragliding Flight Log v2.0
 * Updated: 2026-10-02 20:48:43
 */
/**
 * Paragliding Flight Log v2.0
 * 
 * MODULE: Analysis Engine
 * Handles Flight Mode Detection (Thermal/Soar/Glide/Sink), Validation, and Detailed Stats.
 */

var ANALYSIS = {};

/**
 * Main Analysis Function
 * @param {Array} fixes - Array of {t, lat, lon, alt}
 * @param {Object} config - Config object from Lookups
 * @return {Object} - { modes: {}, stats: {}, validation: {} }
 */
function analyzeFlight(fixes, config) {
  if (!fixes || fixes.length < 2) return null;
  
  // 1. Resample / Smooth (Optional, but good for noise)
  // For MVP we use raw fixes but might skip seconds if needed.
  
  // 2. Compute Derivatives (Vario, Turn Rate, GS per second)
  var derived = computeDerivatives_(fixes);
  
  // 3. Classify Modes
  var classifications = classifyModes_(derived, config);
  
  // 4. Aggregate Mode Stats
  var modeStats = aggregateModeStats_(classifications, derived);
  
  // 5. Validation Checks
  var validation = validateFlight_(fixes, derived, config);
  
  return {
    modes: modeStats,      // { thermalTime, glideTime, ... }
    stats: derived.summary, // { maxClimb, maxSink, etc }
    validation: validation // { status: 'OK'|'Invalid?', reason: '' }
  };
}

/**
 * Validates the flight against heuristics (Short hop, Driving, Kiting)
 */
function validateFlight_(fixes, derived, config) {
  var notes = [];
  var isInvalid = false;
  
  // Short Flight
  var dur = fixes[fixes.length-1].t - fixes[0].t;
  if (dur < config.VALIDATION_MIN_DURATION_SEC) {
    isInvalid = true;
    notes.push('Short duration (<' + Math.floor(dur) + 's)');
  }
  
  // Kiting (Height range)
  var minAlt = derived.summary.minAlt;
  var maxAlt = derived.summary.maxAlt;
  if ((maxAlt - minAlt) < config.VALIDATION_MIN_HEIGHT_CHANGE_M) {
    isInvalid = true;
    notes.push('Little height gain (<' + (maxAlt - minAlt) + 'm)');
  }
  
  // Driving (Speed)
  if (derived.summary.maxGs > config.VALIDATION_MAX_SPEED_KMH) {
    isInvalid = true;
    notes.push('Max speed high (' + Math.round(derived.summary.maxGs) + 'km/h)');
  }
  if (derived.summary.avgGs > config.VALIDATION_MAX_AVG_SPEED_KMH) {
    isInvalid = true;
    notes.push('Avg speed high (' + Math.round(derived.summary.avgGs) + 'km/h)');
  }
  
  return {
     status: isInvalid ? 'Invalid?' : 'OK',
     reason: notes.join(', ')
  };
}


/* ==========================================================================================
   INTERNAL LOGIC
   ========================================================================================== */

function computeDerivatives_(fixes) {
  var processed = [];
  var maxClimb = -Infinity, maxSink = Infinity, maxGs = 0, sumGs = 0;
  var minAlt = Infinity, maxAlt = -Infinity;
  var totalDist = 0;

  for (var i = 1; i < fixes.length; i++) {
    var p = fixes[i-1];
    var c = fixes[i];
    var dt = c.t - p.t;
    if (dt <= 0) continue; // Skip duplicate times
    
    var distM = haversine_(p.lat, p.lon, c.lat, c.lon);
    var dAlt = c.alt - p.alt;
    
    var vario = dAlt / dt;
    var gsKmh = (distM / dt) * 3.6;
    var bearing = bearing_(p.lat, p.lon, c.lat, c.lon);
    
    // Turn Rate (approx)
    var turnRate = 0;
    if (i > 1) {
       var prevBearing = processed[processed.length-1].bearing;
       var diff = angleDiff_(bearing, prevBearing);
       turnRate = diff / dt;
    }
    
    processed.push({
      t: c.t,
      dt: dt,
      alt: c.alt,
      dAlt: dAlt,
      vario: vario,
      gs: gsKmh,
      bearing: bearing,
      turn: turnRate,
      dist: distM
    });
    
    if (vario > maxClimb) maxClimb = vario;
    if (vario < maxSink) maxSink = vario;
    if (gsKmh > maxGs) maxGs = gsKmh;
    
    sumGs += gsKmh * dt; // Weighted by time
    totalDist += distM;
    if (c.alt > maxAlt) maxAlt = c.alt;
    if (c.alt < minAlt) minAlt = c.alt;
  }
  
  var totalTime = fixes[fixes.length-1].t - fixes[0].t;
  
  return {
    points: processed,
    summary: {
      maxClimb: maxClimb,
      maxSink: maxSink,
      maxGs: maxGs,
      avgGs: totalTime ? (totalDist / totalTime * 3.6) : 0,
      maxAlt: maxAlt,
      minAlt: minAlt,
      totalDist: totalDist,
      durationSec: totalTime,
      startTime: fixes[0].t,
      endTime: fixes[fixes.length - 1].t
    }
  };
}

function classifyModes_(derived, config) {
  // Sliding window approach (simple version)
  // Window size e.g. 10s.
  // We classify each point based on average of surrounding window.
  
  var points = derived.points;
  var modes = []; // 'Thermal', 'Soar', 'Glide', 'Sink', 'None'
  
  var wHalf = Math.floor(config.MODE_WINDOW_SEC / 2); // approx samples if 1hz. 
  // Actually need to look at time. assuming ~1s/fix for simplicity in MVP.
  
  for (var i = 0; i < points.length; i++) {
    // Collect window stats
    var start = Math.max(0, i - wHalf);
    var end = Math.min(points.length, i + wHalf);
    var wPoints = points.slice(start, end);
    
    var avgVario = 0, avgTurn = 0, count = 0;
    wPoints.forEach(function(p){ avgVario += p.vario; avgTurn += p.turn; count++; });
    if (count) { avgVario /= count; avgTurn /= count; }
    
    // Classification Logic
    var mode = 'Glide'; // Default
    
    if (avgVario > config.THERMAL_MIN_CLIMB && avgTurn > config.THERMAL_MIN_TURN) {
      mode = 'Thermal';
    } 
    else if (avgVario < config.SINK_VARIO) {
       mode = 'Sink';
    }
    else if (avgVario >= config.SOAR_VARIO_MIN && (checkReversals_(points, i, config) || avgVario >= 0.2)) {
       mode = 'Soar';
    }
    else {
       mode = 'Glide';
    }
    
    modes.push({ t: points[i].t, dt: points[i].dt, mode: mode, vario: points[i].vario, dist: points[i].dist, dAlt: points[i].dAlt });
  }
  return modes;
}

function checkReversals_(points, index, config) {
  var targetT = points[index].t;
  var winSec = config.REVERSAL_WINDOW_SEC || 45;
  var curBearing = points[index].bearing;
  
  // Look back within winSec for heading change >= 90 deg (ridge reversals / S-turns)
  for (var j = index - 1; j >= 0; j--) {
    if (targetT - points[j].t > winSec) break;
    if (angleDiff_(curBearing, points[j].bearing) >= 90) return true;
  }
  // Look forward within winSec
  for (var j = index + 1; j < points.length; j++) {
    if (points[j].t - targetT > winSec) break;
    if (angleDiff_(curBearing, points[j].bearing) >= 90) return true;
  }
  return false; 
}

function aggregateModeStats_(modes, derived) {
  var stats = {
    thermal: { time: 0, gain: 0, count: 0, best: 0, avg: 0 },
    soar: { time: 0, dist: 0, gain: 0, efficiency: '' },
    glide: { time: 0, dist: 0, altLoss: 0, descDist: 0, ld: '' },
    sink: { time: 0 }
  };
  
  var currentMode = '';
  var modeStart = 0;
  
  for (var i = 0; i < modes.length; i++) {
    var m = modes[i];
    
    if (m.mode === 'Thermal') {
      stats.thermal.time += m.dt;
      if (m.vario > 0) stats.thermal.gain += m.vario * m.dt;
      if (m.vario > stats.thermal.best) stats.thermal.best = m.vario;
    } else if (m.mode === 'Soar') {
      stats.soar.time += m.dt;
      stats.soar.dist += m.dist;
      if (m.dAlt > 0) stats.soar.gain += m.dAlt;
    } else if (m.mode === 'Sink') {
      stats.sink.time += m.dt;
    } else {
      stats.glide.time += m.dt;
      stats.glide.dist += m.dist;
      if (m.dAlt < 0) {
        stats.glide.altLoss += Math.abs(m.dAlt);
        stats.glide.descDist += m.dist;
      }
    }
    
    // Count Thermals (State change)
    if (m.mode !== currentMode) {
      if (m.mode === 'Thermal') stats.thermal.count++;
      currentMode = m.mode;
    }
  }
  
  // Averages
  if (stats.thermal.time > 0) {
      stats.thermal.avg = stats.thermal.gain / stats.thermal.time;
  }
  
  // Soar Efficiency: Soar Height Gain (m) / Soar Distance (km)
  var soarDistKm = stats.soar.dist / 1000;
  if (soarDistKm > 0 && stats.soar.gain > 0) {
    stats.soar.efficiency = (stats.soar.gain / soarDistKm).toFixed(1);
  }
  
  // Glide L/D: Horizontal Glide Distance (m) / Altitude Lost in Glides (m)
  if (stats.glide.altLoss > 0 && stats.glide.descDist > 0) {
    stats.glide.ld = (stats.glide.descDist / stats.glide.altLoss).toFixed(1);
  }
  
  var totalTime = (derived.points && derived.points.length > 1) 
    ? (derived.points[derived.points.length-1].t - derived.points[0].t) 
    : 1;
  if (totalTime <= 0) totalTime = 1;
  
  return {
    raw: stats,
    pct: {
      thermal: stats.thermal.time / totalTime,
      soar: stats.soar.time / totalTime,
      glide: stats.glide.time / totalTime,
      sink: stats.sink.time / totalTime
    }
  };
}
// Export to Namespace
ANALYSIS.analyzeFlight = analyzeFlight;
