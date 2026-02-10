/**
 * Paragliding Flight Log v2.0
 * Updated: 2026-02-09 18:19:49
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
       var diff = Math.abs(bearing - prevBearing);
       if (diff > 180) diff = 360 - diff;
       turnRate = diff / dt;
    }
    
    processed.push({
      t: c.t,
      dt: dt,
      alt: c.alt,
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
      totalDist: totalDist
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
    else if (avgVario >= config.SOAR_VARIO_MIN && avgVario <= config.SOAR_VARIO_MAX && avgTurn <= config.SOAR_TURN_MAX && checkReversals_(points, i, config)) {
       mode = 'Soar'; // Reversal check is expensive, maybe simplified?
    }
    else if (avgVario < config.SINK_VARIO) {
       mode = 'Sink';
    }
    else {
       mode = 'Glide';
    }
    
    modes.push({ t: points[i].t, dt: points[i].dt, mode: mode, vario: points[i].vario, dist: points[i].dist });
  }
  return modes;
}

function checkReversals_(points, index, config) {
  // Look back REVERSAL_WINDOW_SEC for heading change > 90 deg?
  // Simplified: standard soaring involves frequent 180s.
  // For MVP, just return false if standard soaring detection is too complex without proper heading analysis object.
  // Let's rely on Turn Rate < MAX (straight) vs Turn Rate > MIN (thermal). 
  // Soaring is tricky: Straight lines + quick 180s.
  // Let's skip complex reversal logic for this iteration and focus on Vario/Turn.
  return false; 
}

function aggregateModeStats_(modes, derived) {
  var stats = {
    thermal: { time: 0, gain: 0, count: 0, best: 0, avg: 0 },
    soar: { time: 0 },
    glide: { time: 0, dist: 0 },
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
    } else if (m.mode === 'Sink') {
      stats.sink.time += m.dt;
    } else {
      stats.glide.time += m.dt;
      stats.glide.dist += m.dist;
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
  
  var totalTime = derived.summary.totalDist ? (derived.points[derived.points.length-1].t - derived.points[0].t) : 1;
  
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
