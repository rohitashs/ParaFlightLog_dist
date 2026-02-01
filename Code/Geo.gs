/**
 * Paragliding Flight Log v2.0
 * 
 * MODULE: Geo Service
 * Handles Reverse Geocoding (Nominatim) and Site Detection (Overpass API).
 */

var GEO = {};

/**
 * Reverse Geocode a coordinate
 * @param {number} lat
 * @param {number} lon
 * @return {Object} { town, region, country, full } or null
 */
function getReverseGeo(lat, lon, config) {
  if (!lat || !lon) return null;
  
  // Cache Key (Round to ~100m = 3 decimal places to improve hit rate)
  var key = 'GEO_REV_' + lat.toFixed(3) + '_' + lon.toFixed(3);
  var cached = CacheService.getScriptCache().get(key);
  if (cached) return JSON.parse(cached);
  
  var email = config.CONTACT_EMAIL || 'appscript_user@example.com';
  var url = 'https://nominatim.openstreetmap.org/reverse?format=json&lat=' + lat + '&lon=' + lon + '&zoom=10&addressdetails=1';
  
  try {
    Utilities.sleep(1000); // Rate limit throttling (1 per sec)
    var res = UrlFetchApp.fetch(url, {
      headers: { 'User-Agent': 'ParaFlightLog/2.0 (' + email + ')' },
      muteHttpExceptions: true
    });
    
    if (res.getResponseCode() === 200) {
      var data = JSON.parse(res.getContentText());
      var addr = data.address || {};
      
      var result = {
        town: addr.village || addr.town || addr.city || addr.suburb || '',
        region: addr.state || addr.county || '',
        country: addr.country_code ? addr.country_code.toUpperCase() : '',
        full: data.display_name
      };
      
      // Cache for 6 hours
      CacheService.getScriptCache().put(key, JSON.stringify(result), 21600);
      return result;
    }
  } catch (e) {
    console.error('Nominatim Error:', e);
  }
  return null;
}

/**
 * Find nearest Paragliding Site (Takeoff/Landing)
 * @param {number} lat
 * @param {number} lon
 * @param {number} radiusM
 * @param {string} type - 'takeoff' or 'landing' (optional filter)
 * @return {string} Site Name or ''
 */
function getNearestSite(lat, lon, radiusM, config) {
  var r = radiusM || 3000;
  var key = 'GEO_SITE_' + lat.toFixed(3) + '_' + lon.toFixed(3) + '_' + r;
  var cached = CacheService.getScriptCache().get(key);
  if (cached) return cached;

  // Overpass Query
  // node["sport"="paragliding"](around:radius, lat, lon);
  var q = '[out:json];(node["sport"="paragliding"](around:' + r + ',' + lat + ',' + lon + ');way["sport"="paragliding"](around:' + r + ',' + lat + ',' + lon + '););out center;';
  var url = 'https://overpass-api.de/api/interpreter?data=' + encodeURIComponent(q);
  
  try {
    Utilities.sleep(1000); // Throttling
    var res = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
    
    if (res.getResponseCode() === 200) {
      var body = JSON.parse(res.getContentText());
      var elements = body.elements;
      
      // Find nearest
      var bestDist = Infinity;
      var bestName = '';
      
      elements.forEach(function(el) {
         var elLat = el.lat || (el.center && el.center.lat);
         var elLon = el.lon || (el.center && el.center.lon);
         if (elLat) {
           var dist = haversineGeo_(lat, lon, elLat, elLon);
           if (dist < bestDist) {
             // Prefer 'name', fallback to 'site_name'
             var name = (el.tags && (el.tags.name || el.tags.site_name)) || '';
             if (name) {
                bestDist = dist;
                bestName = name;
             }
           }
         }
      });
      
      if (bestName) {
        CacheService.getScriptCache().put(key, bestName, 21600);
        return bestName;
      }
    }
  } catch (e) {
    console.error('Overpass Error:', e);
  }
  return '';
}

function haversineGeo_(lat1, lon1, lat2, lon2) {
  // Duplicated simple math to avoid cross-module dependency if independent, 
  // but ideally use PARSER.haversine if available globally.
  // For safety/independence in this module:
  var R = 6371000;
  var dLat = (lat2 - lat1) * Math.PI / 180;
  var dLon = (lon2 - lon1) * Math.PI / 180;
  var a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
          Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
          Math.sin(dLon / 2) * Math.sin(dLon / 2);
  var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Export to Namespace
GEO.getReverseGeo = getReverseGeo;
GEO.getNearestSite = getNearestSite;
