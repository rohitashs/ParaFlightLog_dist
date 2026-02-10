/**
 * Paragliding Flight Log v2.0
 * Updated: 2026-02-10 11:50:06
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
  var key = 'GEO_REV_' + lat.toFixed(3) + '_' + lon.toFixed(3) + '_' + (config.GEO_REV_PROVIDERS || 'nom');
  var cached = CacheService.getScriptCache().get(key);
  if (cached) return JSON.parse(cached);
  
  // Ensure valid User-Agent
  var email = (config.CONTACT_EMAIL && config.CONTACT_EMAIL.indexOf('@') > 0) ? config.CONTACT_EMAIL : 'appscript_user@example.com';
  var providers = (config.GEO_REV_PROVIDERS || 'nominatim_osm, big_data_cloud').split(',');
  
  var errors = [];
  
  for (var i = 0; i < providers.length; i++) {
    var provider = providers[i].trim().toLowerCase();
    
    // 1. Nominatim OSM
    if (provider.indexOf('nominatim') === 0) { // Matches 'nominatim', 'nominatim_osm'
      try {
        var url = 'https://nominatim.openstreetmap.org/reverse?format=json&lat=' + lat.toFixed(6) + '&lon=' + lon.toFixed(6) + '&zoom=10&addressdetails=1';
        var userAgent = 'ParaFlightLog/2.0 (' + email + ')';
        
        Utilities.sleep(1000); // Rate limit throttling (1 per sec)
        var res = UrlFetchApp.fetch(url, { headers: { 'User-Agent': userAgent }, muteHttpExceptions: true });
        
        if (res.getResponseCode() === 200) {
          var data = JSON.parse(res.getContentText());
          var addr = data.address || {};
          var result = {
            town: addr.village || addr.town || addr.city || addr.suburb || '',
            region: addr.state || addr.county || '',
            country: addr.country_code ? addr.country_code.toUpperCase() : '',
            full: data.display_name
          };
          CacheService.getScriptCache().put(key, JSON.stringify(result), 21600);
          return result;
        } else {
          console.warn('Nominatim Failed (' + res.getResponseCode() + '), continuing chain.');
          errors.push('Nominatim:' + res.getResponseCode());
        }
      } catch (e) {
        console.warn('Nominatim Error: ' + e.message);
        errors.push('Nominatim:' + e.message);
      }
    }
    
    // 2. BigDataCloud (Free)
    if (provider.indexOf('big') === 0) { // Matches 'big_data_cloud', 'bigdatacloud'
      try {
        var urlFb = 'https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=' + lat.toFixed(6) + '&longitude=' + lon.toFixed(6) + '&localityLanguage=en';
        var resFb = UrlFetchApp.fetch(urlFb, { muteHttpExceptions: true });
        if (resFb.getResponseCode() === 200) {
          var dataFb = JSON.parse(resFb.getContentText());
          var resultFb = {
            town: dataFb.locality || dataFb.city || '',
            region: dataFb.principalSubdivision || '',
            country: dataFb.countryCode || '',
            full: (dataFb.locality || '') + ', ' + (dataFb.countryName || '')
          };
          // Only cache if we got something useful
          if (resultFb.country || resultFb.town || resultFb.region) {
            CacheService.getScriptCache().put(key, JSON.stringify(resultFb), 21600);
            return resultFb;
          }
        }
      } catch (e2) {
        console.warn('BigDataCloud Error: ' + e2.message);
        errors.push('BigDataCloud:' + e2.message);
      }
    }
  } // End Loop
  
  return { error: 'Geo: All providers failed (' + errors.join('; ') + ')' };
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

  var providers = (config.GEO_SITE_PROVIDERS || 'overpass_api').split(',');
  
  for (var i = 0; i < providers.length; i++) {
    var provider = providers[i].trim().toLowerCase();
    
    // 1. Overpass API
    if (provider === 'overpass_api' || provider === 'overpass') {
      try {
        var q = '[out:json];(node["sport"="paragliding"](around:' + r + ',' + lat + ',' + lon + ');way["sport"="paragliding"](around:' + r + ',' + lat + ',' + lon + '););out center;';
        var url = 'https://overpass-api.de/api/interpreter?data=' + encodeURIComponent(q);
        Utilities.sleep(1000); 
        var res = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
        
        if (res.getResponseCode() === 200) {
          var body = JSON.parse(res.getContentText());
          var elements = body.elements;
          
          var bestDist = Infinity;
          var bestName = '';
          
          elements.forEach(function(el) {
             var elLat = el.lat || (el.center && el.center.lat);
             var elLon = el.lon || (el.center && el.center.lon);
             if (elLat) {
               var dist = haversineGeo_(lat, lon, elLat, elLon);
               if (dist < bestDist) {
                 var name = (el.tags && (el.tags.name || el.tags.site_name)) || '';
                 if (name) { bestDist = dist; bestName = name; }
               }
             }
          });
          
          if (bestName) {
            CacheService.getScriptCache().put(key, bestName, 21600);
            return bestName;
          }
        }
      } catch (e) {
        console.warn('Overpass Error:', e);
      }
    }
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

/**
 * Get TimeZone for a coordinate
 * @param {number} lat
 * @param {number} lon
 * @return {string} TimeZone ID (e.g., "Europe/Berlin") or null
 */
function getTimezone(lat, lon, config) {
  if (!lat || !lon) return null;
  
  var key = 'GEO_TZ_' + lat.toFixed(2) + '_' + lon.toFixed(2);
  var cached = CacheService.getScriptCache().get(key);
  if (cached) return cached;
  
  var providers = (config && config.GEO_TZ_PROVIDERS || 'timeapi_io').split(',');
  
  for (var i = 0; i < providers.length; i++) {
    var provider = providers[i].trim().toLowerCase();
    
    // 1. TimeAPI.io
    if (provider === 'timeapi_io' || provider === 'timeapi') {
      try {
        var url = 'https://timeapi.io/api/TimeZone/coordinate?latitude=' + lat + '&longitude=' + lon;
        Utilities.sleep(1000); 
        var res = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
        if (res.getResponseCode() === 200) {
           var data = JSON.parse(res.getContentText());
           var tz = data.timeZone;
           if (tz) {
             CacheService.getScriptCache().put(key, tz, 21600);
             return tz;
           }
        }
      } catch (e) {
        console.warn('TimeZone API Error:', e);
      }
    }
  }
  return null;
}

/**
 * Convert a Date (UTC) to a specific TimeZone
 * @param {Date} dateObj - The date object (which wraps a UTC timestamp)
 * @param {string} timeZone - Target TimeZone (e.g. "America/Los_Angeles")
 * @return {string} Formatted string in that TZ (YYYY-MM-DD HH:mm:ss)
 */
function formatInTimezone(dateObj, timeZone, format) {
  if (!dateObj || !timeZone) return '';
  try {
    return Utilities.formatDate(dateObj, timeZone, format || 'yyyy-MM-dd HH:mm:ss');
  } catch (e) {
    console.warn('Date convert fail', e);
    return '';
  }
}

// Export to Namespace
GEO.getReverseGeo = getReverseGeo;
GEO.getNearestSite = getNearestSite;
GEO.getTimezone = getTimezone;
GEO.formatInTimezone = formatInTimezone;
