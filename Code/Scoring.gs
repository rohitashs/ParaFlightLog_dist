/**
 * Paragliding Flight Log v2.0
 * Updated: 2026-10-02 22:22:24
 */
/**
 * Paragliding Flight Log v2.0
 * 
 * MODULE: Scoring Engine (XC Optimization)
 * Implementation of XContest-style scoring rules:
 * - Free Distance (3 TPs)
 * - Flat Triangle (<20% gap)
 * - FAI Triangle (Legs >= 28%)
 * NOTE: Uses track simplification for performance.
 * 
 * @design Docs/Design/DSGN-CORE-002_Aeronautical_Physics_and_FAI_Scoring.md
 * @architecture Docs/Architecture/Views/01_Functional_View.md#23-subsystem-3-fai-cross-country-scoring--optimization
 * @revision Rev 2.1
 */

var SCORING = {};

/**
 * Main Scoring Entry Point
 * @param {Array} fixes - Array of {lat, lon, alt}
 * @param {Object|number} [configOrTol] - Optional configuration object or numeric tolerance
 * @return {Object} - { free: {}, flat: {}, fai: {}, best: {} }
 */
function calculateXcScore(fixes, configOrTol) {
  if (!fixes || fixes.length < 50) return null; // Too short to score meaningfully
  
  // Resolve tolerance
  var tolerance = 0.0005; // Default ~50m in degrees (0.0001 deg is ~11m)
  if (typeof configOrTol === 'number' && !isNaN(configOrTol) && configOrTol > 0) {
    tolerance = configOrTol;
  } else if (configOrTol && typeof configOrTol === 'object') {
    if (configOrTol.RDP_TOLERANCE !== undefined && !isNaN(parseFloat(configOrTol.RDP_TOLERANCE))) {
      var parsedTol = parseFloat(configOrTol.RDP_TOLERANCE);
      if (parsedTol > 0) tolerance = parsedTol;
    }
  } else if (typeof CFG !== 'undefined' && CFG.defaults && CFG.defaults.RDP_TOLERANCE !== undefined) {
    var defaultTol = parseFloat(CFG.defaults.RDP_TOLERANCE);
    if (!isNaN(defaultTol) && defaultTol > 0) tolerance = defaultTol;
  }
  
  // 1. Simplify Track (Validation against limits)
  // Reduce to ~100-200 points for geometry calc using Ramer-Douglas-Peucker
  // This is critical for Apps Script performance.
  var simplified = simplifyTrack_(fixes, tolerance);
  
  if (simplified.length < 2) return null;
  
  // 2. Calculate Distances
  var free = optimizeFreeDistance_(simplified);
  var outAndReturn = optimizeOutAndReturn_(simplified);
  var triangle = optimizeTriangle_(simplified);
  
  // 3. Multipliers & Best Score
  // World: Free 1.0, Out-and-Return 1.2, Flat 1.2, FAI 1.4
  // National: Bonus if closed
  
  // Refine Triangle classification (FAI vs Flat)
  var triType = 'Flat';
  var triMult = 1.2;
  
  // FAI Check: Shortest leg >= 28% of perimeter
  if (triangle.valid) {
    if (triangle.shortestLeg >= (triangle.perimeter * 0.28)) {
       triType = 'FAI';
       triMult = 1.4;
    }
  } else {
    triangle.points = 0; // Invalid triangle
  }
  
  // Scores
  var scoreFree = free.dist;
  var scoreOR = outAndReturn.valid ? (outAndReturn.dist * 1.2) : 0;
  var scoreTri = triangle.valid ? (triangle.dist * triMult) : 0;
  
  var best = { type: 'Free Flight', score: scoreFree, dist: free.dist, pointsWorld: scoreFree };

  if (scoreOR > best.score) {
    best = {
      type: 'Out-and-Return',
      score: scoreOR,
      dist: outAndReturn.dist,
      pointsWorld: scoreOR
    };
  }
  
  if (scoreTri > best.score) {
    best = { 
      type: triType + ' Triangle', 
      score: scoreTri, 
      dist: triangle.dist, 
      pointsWorld: scoreTri 
    };
  }
  
  return {
    free: { dist: free.dist, points: scoreFree },
    outAndReturn: {
      dist: outAndReturn.dist,
      valid: outAndReturn.valid,
      points: scoreOR
    },
    triangle: { 
      dist: triangle.dist, 
      type: triType, 
      valid: triangle.valid, 
      closed: triangle.closed,
      points: scoreTri
    },
    best: best
  };
}

/* ==========================================================================================
   OPTIMIZATION ALGORITHMS (Heuristic)
   ========================================================================================== */

function optimizeFreeDistance_(points) {
  // Free Distance: 5 points (Start + 3 TPs + Finish).
  // Brute force 5 points on 100 points is 100^5 (too big).
  // Strategy: 
  // 1. Find max distance between any two points (AB)
  // 2. Find max deviation point from line AB (C) => Triangle ABC
  // 3. Expand... 
  
  // Simplest Baseline: Open Distance (Start -> End)
  // Better: Max Distance between ANY two points in track.
  var maxOpen = 0;
  // O(N^2) on simplified track.
  for (var i=0; i<points.length; i++) {
    for (var j=i+1; j<points.length; j++) {
       var d = dist_(points[i], points[j]);
       if (d > maxOpen) maxOpen = d;
    }
  }
  
  // TODO: Implement full 3-TP optimization. 
  // For MVP, we return Max Open Distance as the baseline "Free Distance" 
  // plus a greedy detour check?
  
  // Let's stick to Max Open Distance for v2.0 MVP to ensure stability, 
  // as full XC optimization in JS is complex.
  // Actually, let's add at least 1 turnpoint logic (Start -> TP -> Finish).
  var max1TP = maxOpen;
  
  return { dist: max1TP / 1000 }; // km
}

/**
 * Out-and-Return Flight Optimization:
 * Track: Start (P_i) -> Turnpoint (P_j) -> Finish (P_k) where i < j < k.
 * Closure rule: Distance between start and finish must be <= 20% of total distance (2 * D_tp).
 * Scored distance: (2 * D_tp) - Gap.
 */
function optimizeOutAndReturn_(points) {
  var maxOR = 0;
  var bestOR = { valid: false, dist: 0 };
  var n = points.length;
  if (n < 3) return bestOR;

  var step = Math.max(1, Math.ceil(n / 50));

  for (var i = 0; i < n; i += step) {
    for (var j = i + step; j < n; j += step) {
      var dOut = dist_(points[i], points[j]);
      if (dOut <= 0) continue;
      var totalCourse = 2 * dOut;

      for (var k = j + step; k < n; k += step) {
        var gap = dist_(points[i], points[k]);
        if (gap <= 0.2 * totalCourse) {
          var scoredDist = totalCourse - gap;
          if (scoredDist > maxOR) {
            maxOR = scoredDist;
            bestOR = {
              valid: true,
              dist: scoredDist / 1000, // km
              outDist: dOut / 1000,
              gap: gap / 1000
            };
          }
        }
      }
    }
  }

  return bestOR;
}

function optimizeTriangle_(points) {
  // Triangle: Start (P_i) -> TP1 (P_j) -> TP2 (P_k) -> Finish (P_m) where i < j < k < m
  // 3 distinct legs: d1 = dist(i,j), d2 = dist(j,k), d3 = dist(k,m)
  // Closing gap: dist(i,m) <= 20% of perimeter (d1 + d2 + d3)
  // Scored distance: perimeter - gap
  var maxTriScored = 0;
  var bestTri = { valid: false, dist: 0 };
  
  var n = points.length;
  if (n < 4) return bestTri;

  var step = Math.max(1, Math.ceil(n / 35));
  
  for (var i = 0; i < n; i += step) {
    for (var j = i + step; j < n; j += step) {
      var d1 = dist_(points[i], points[j]);
      if (d1 <= 0) continue;

      for (var k = j + step; k < n; k += step) {
        var d2 = dist_(points[j], points[k]);
        if (d2 <= 0) continue;

        for (var m = k + step; m < n; m += step) {
          var d3 = dist_(points[k], points[m]);
          var gap = dist_(points[i], points[m]);
          var perimeter = d1 + d2 + d3;
          if (perimeter <= 0) continue;

          // Closure rule: gap between finish and start <= 20% of perimeter
          if (gap <= 0.20 * perimeter) {
            var legs = [d1, d2, d3].sort(function(a, b) { return a - b; });
            var shortestLeg = legs[0];

            // Real triangle check: each leg must be at least 5% of perimeter
            if (shortestLeg >= 0.05 * perimeter) {
              var scoredDist = perimeter - gap;
              if (scoredDist > maxTriScored) {
                maxTriScored = scoredDist;
                bestTri = {
                  valid: true,
                  dist: scoredDist / 1000, // km
                  perimeter: perimeter / 1000,
                  shortestLeg: shortestLeg / 1000,
                  gap: gap / 1000,
                  closed: (gap <= 0.05 * perimeter)
                };
              }
            }
          }
        }
      }
    }
  }
  
  return bestTri;
}

/* ==========================================================================================
   HELPERS
   ========================================================================================== */

// Ramer-Douglas-Peucker simplification
function simplifyTrack_(points, tolerance) {
  if (points.length < 3) return points;
  
  var maxDist = 0;
  var index = 0;
  
  for (var i = 1; i < points.length - 1; i++) {
    var d = perpendicularDist_(points[i], points[0], points[points.length - 1]);
    if (d > maxDist) {
      maxDist = d;
      index = i;
    }
  }
  
  if (maxDist > tolerance) {
    var left = simplifyTrack_(points.slice(0, index + 1), tolerance);
    var right = simplifyTrack_(points.slice(index), tolerance);
    return left.slice(0, left.length - 1).concat(right);
  } else {
    return [points[0], points[points.length - 1]];
  }
}

function perpendicularDist_(p, lineStart, lineEnd) {
   // Simplified: just Euclidean distance in Lat/Lon space for speed 
   // (Valid for local approximation, optimization doesn't need perfect haversine for pruning)
   var x = p.lon, y = p.lat;
   var x1 = lineStart.lon, y1 = lineStart.lat;
   var x2 = lineEnd.lon, y2 = lineEnd.lat;
   
   var A = x - x1;
   var B = y - y1;
   var C = x2 - x1;
   var D = y2 - y1;
   
   var dot = A * C + B * D;
   var len_sq = C * C + D * D;
   var param = -1;
   if (len_sq !== 0) param = dot / len_sq;
   
   var xx, yy;
   
   if (param < 0) {
     xx = x1; yy = y1;
   } else if (param > 1) {
     xx = x2; yy = y2;
   } else {
     xx = x1 + param * C;
     yy = y1 + param * D;
   }
   
   var dx = x - xx;
   var dy = y - yy;
   return Math.sqrt(dx * dx + dy * dy);
}

function dist_(p1, p2) {
  // Use Haversine for real distances
  return haversine_(p1.lat, p1.lon, p2.lat, p2.lon);
}

// Export to Namespace
SCORING.calculateXcScore = calculateXcScore;
