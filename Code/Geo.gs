/**
 * Paragliding Flight Log v2.0
 * Updated: 2026-09-30 16:13:07
 * 
 * MODULE: Geo Service
 * Handles Reverse Geocoding (Nominatim) and Site Detection (Overpass API).
 */

var GEO = {};

/**
 * Reverse Geocode a coordinate
 * @param {number} lat
 * @param {number} lon
 * @param {Object} config
 * @return {Object} { town, region, country, full } or null
 */
function getReverseGeo(lat, lon, config) {
  if (!lat || !lon) return null;
  config = config || {};
  
  // Cache Key (Round to ~100m = 3 decimal places to improve hit rate)
  var key = 'GEO_REV_' + lat.toFixed(3) + '_' + lon.toFixed(3) + '_' + (config.GEO_REV_PROVIDERS || 'def');
  var cached = CacheService.getScriptCache().get(key);
  if (cached) return JSON.parse(cached);
  
  // Ensure valid User-Agent
  var email = (config.CONTACT_EMAIL && config.CONTACT_EMAIL.indexOf('@') > 0) ? config.CONTACT_EMAIL : 'appscript_user@example.com';
  var providers = (config.GEO_REV_PROVIDERS || 'google, big_data_cloud, nominatim_osm').split(',');
  
  var errors = [];
  
  for (var i = 0; i < providers.length; i++) {
    var provider = providers[i].trim().toLowerCase();
    
    // 1. Google Native Geocoder (Google Apps Script Maps service) - Fast, built-in, English native
    if (provider.indexOf('google') === 0 || provider.indexOf('maps') === 0) {
      try {
        var geocoder = Maps.newGeocoder().setLanguage('en');
        var response = geocoder.reverseGeocode(lat, lon);
        if (response && response.status === 'OK' && response.results && response.results.length > 0) {
          var best = response.results[0];
          var town = '', region = '', country = '';
          if (best.address_components) {
            for (var c = 0; c < best.address_components.length; c++) {
              var comp = best.address_components[c];
              var types = comp.types || [];
              if (!town && (types.indexOf('locality') > -1 || types.indexOf('postal_town') > -1 || types.indexOf('sublocality') > -1 || types.indexOf('administrative_area_level_3') > -1)) {
                town = comp.long_name;
              }
              if (!region && types.indexOf('administrative_area_level_1') > -1) {
                region = comp.long_name;
              }
              if (!country && types.indexOf('country') > -1) {
                country = comp.long_name;
              }
            }
          }
          var resultGoogle = {
            town: town,
            region: region,
            country: expandCountryName_(country),
            full: best.formatted_address || ''
          };
          if (resultGoogle.country || resultGoogle.town) {
            CacheService.getScriptCache().put(key, JSON.stringify(resultGoogle), 21600);
            return resultGoogle;
          }
        } else {
          errors.push('Google:' + (response ? response.status : 'Empty'));
        }
      } catch (eGoogle) {
        console.warn('Google Maps Geocoder error: ' + eGoogle.message);
        errors.push('Google:' + eGoogle.message);
      }
    }
    
    // 2. BigDataCloud (Free Client API) - Fast, no API key, localityLanguage=en
    if (provider.indexOf('big') === 0) {
      try {
        var urlFb = 'https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=' + lat.toFixed(6) + '&longitude=' + lon.toFixed(6) + '&localityLanguage=en';
        var resFb = UrlFetchApp.fetch(urlFb, { muteHttpExceptions: true });
        if (resFb.getResponseCode() === 200) {
          var dataFb = JSON.parse(resFb.getContentText());
          var cName = dataFb.countryName || dataFb.countryCode || '';
          var resultFb = {
            town: dataFb.locality || dataFb.city || '',
            region: dataFb.principalSubdivision || '',
            country: expandCountryName_(cName),
            full: (dataFb.locality || '') + (dataFb.countryName ? ', ' + dataFb.countryName : '')
          };
          if (resultFb.country || resultFb.town || resultFb.region) {
            CacheService.getScriptCache().put(key, JSON.stringify(resultFb), 21600);
            return resultFb;
          }
        } else {
          errors.push('BigDataCloud:' + resFb.getResponseCode());
        }
      } catch (e2) {
        console.warn('BigDataCloud Error: ' + e2.message);
        errors.push('BigDataCloud:' + e2.message);
      }
    }
    
    // 3. Nominatim OSM (with accept-language=en)
    if (provider.indexOf('nominatim') === 0) {
      try {
        var url = 'https://nominatim.openstreetmap.org/reverse?format=json&lat=' + lat.toFixed(6) + '&lon=' + lon.toFixed(6) + '&zoom=10&addressdetails=1&accept-language=en';
        var userAgent = 'ParaFlightLog/2.0 (' + email + ')';
        
        Utilities.sleep(1000); // Rate limit throttling (1 per sec)
        var res = UrlFetchApp.fetch(url, { headers: { 'User-Agent': userAgent }, muteHttpExceptions: true });
        
        if (res.getResponseCode() === 200) {
          var data = JSON.parse(res.getContentText());
          var addr = data.address || {};
          var cVal = addr.country || addr.country_code || '';
          var result = {
            town: addr.village || addr.town || addr.city || addr.suburb || addr.municipality || '',
            region: addr.state || addr.county || '',
            country: expandCountryName_(cVal),
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
  } // End Loop
  
  return { error: 'Geo: All providers failed (' + errors.join('; ') + ')' };
}

/**
 * Expand country code or normalize country name to common English name
 * e.g., 'PT' -> 'Portugal', 'FR' -> 'France', 'US' -> 'USA', 'MN' -> 'Mongolia'
 */
function expandCountryName_(codeOrName) {
  if (!codeOrName) return '';
  var raw = String(codeOrName).trim();
  var upper = raw.toUpperCase();
  
  var map = {
    'US': 'USA', 'USA': 'USA', 'UNITED STATES': 'USA', 'UNITED STATES OF AMERICA': 'USA', 'UNITED STATES OF AMERICA (THE)': 'USA',
    'GB': 'United Kingdom', 'UK': 'United Kingdom', 'GREAT BRITAIN': 'United Kingdom',
    'PT': 'Portugal', 'FR': 'France', 'ES': 'Spain', 'IT': 'Italy', 'DE': 'Germany',
    'CH': 'Switzerland', 'AT': 'Austria', 'SI': 'Slovenia', 'HR': 'Croatia', 'GR': 'Greece',
    'TR': 'Turkey', 'BG': 'Bulgaria', 'RO': 'Romania', 'HU': 'Hungary', 'PL': 'Poland',
    'CZ': 'Czech Republic', 'SK': 'Slovakia', 'NO': 'Norway', 'SE': 'Sweden', 'FI': 'Finland',
    'MN': 'Mongolia', 'IN': 'India', 'NP': 'Nepal', 'JP': 'Japan', 'KR': 'South Korea',
    'AU': 'Australia', 'NZ': 'New Zealand', 'CA': 'Canada', 'MX': 'Mexico', 'BR': 'Brazil',
    'AR': 'Argentina', 'CL': 'Chile', 'CO': 'Colombia', 'PE': 'Peru', 'ZA': 'South Africa',
    'RU': 'Russia', 'UA': 'Ukraine', 'TH': 'Thailand', 'VN': 'Vietnam', 'ID': 'Indonesia',
    'MY': 'Malaysia', 'PH': 'Philippines', 'MA': 'Morocco', 'GE': 'Georgia', 'AM': 'Armenia'
  };
  
  if (map[upper]) return map[upper];
  // If it's already a full name like "Portugal" or "France", return as is
  return raw;
}

/**
 * Find nearest Paragliding Site (Takeoff/Landing) with 3-tier adaptive radius (50m -> 200m -> 1km)
 * and keyword-based takeoff/landing disambiguation.
 * @param {number} lat
 * @param {number} lon
 * @param {number} radiusM
 * @param {Object} config
 * @param {string} [siteType] - 'takeoff' or 'landing'
 * @param {number} [altM] - Altitude of fix in meters
 * @return {string} Site Name or ''
 */
function getNearestSite(lat, lon, radiusM, config, siteType, altM) {
  if (!lat || !lon) return '';
  config = config || {};
  siteType = (siteType || '').toLowerCase();
  
  var key = 'GEO_SITE_' + lat.toFixed(3) + '_' + lon.toFixed(3) + '_' + siteType;
  var cached = CacheService.getScriptCache().get(key);
  if (cached) return cached;

  var email = (config.CONTACT_EMAIL && config.CONTACT_EMAIL.indexOf('@') > 0) ? config.CONTACT_EMAIL : 'appscript_user@example.com';
  var userAgent = 'ParaFlightLog/2.0 (' + email + ')';
  var providers = (config.GEO_SITE_PROVIDERS || 'paragliding_earth, overpass_api').split(',');
  
  // Keywords from Config or CFG defaults
  var launchKwRaw = config.LAUNCH_SITE_KEYWORDS || 'Launch, Takeoff, Take off';
  var landingKwRaw = config.LANDING_SITE_KEYWORDS || 'Landing, LZ';
  var launchKeywords = launchKwRaw.split(',').map(function(k) { return k.trim().toLowerCase(); }).filter(function(k) { return k.length > 0; });
  var landingKeywords = landingKwRaw.split(',').map(function(k) { return k.trim().toLowerCase(); }).filter(function(k) { return k.length > 0; });
  
  for (var i = 0; i < providers.length; i++) {
    var provider = providers[i].trim().toLowerCase();
    
    // 1. Paragliding Earth (GeoJSON) - Primary
    if (provider.indexOf('paragliding') === 0 || provider === 'pg_earth' || provider === 'pgearth') {
      try {
        // Query 1.0 km radius with up to 10 sites in a single request, then evaluate 50m -> 200m -> 1000m
        var url = 'https://www.paraglidingearth.com/api/geojson/getAroundLatLngSites.php' +
                  '?lat=' + lat.toFixed(6) +
                  '&lng=' + lon.toFixed(6) +
                  '&distance=1.0' +
                  '&limit=10';
        
        var res = UrlFetchApp.fetch(url, {
          headers: { 'User-Agent': userAgent },
          muteHttpExceptions: true
        });
        
        if (res.getResponseCode() === 200) {
          var data = JSON.parse(res.getContentText());
          if (data && data.features && data.features.length > 0) {
            var candidates = [];
            for (var f = 0; f < data.features.length; f++) {
              var feat = data.features[f];
              var p = feat.properties || {};
              var sName = p.name ? p.name.trim() : '';
              if (!sName) continue;
              
              var distM = parseFloat(p.distance);
              if (isNaN(distM)) {
                if (feat.geometry && feat.geometry.coordinates) {
                  distM = haversineGeo_(lat, lon, feat.geometry.coordinates[1], feat.geometry.coordinates[0]);
                } else {
                  distM = 9999;
                }
              }
              
              var placeStr = (p.place || '').toLowerCase();
              var sNameLower = sName.toLowerCase();
              var toAlt = parseFloat(p.takeoff_altitude || 0);
              
              var isLaunchMatch = false;
              for (var lk = 0; lk < launchKeywords.length; lk++) {
                if (placeStr.indexOf(launchKeywords[lk]) > -1 || sNameLower.indexOf(launchKeywords[lk]) > -1) {
                  isLaunchMatch = true;
                  break;
                }
              }
              
              var isLandingMatch = false;
              for (var ldk = 0; ldk < landingKeywords.length; ldk++) {
                if (placeStr.indexOf(landingKeywords[ldk]) > -1 || sNameLower.indexOf(landingKeywords[ldk]) > -1) {
                  isLandingMatch = true;
                  break;
                }
              }
              
              candidates.push({
                name: sName,
                dist: distM,
                place: placeStr,
                toAlt: toAlt,
                isLaunchMatch: isLaunchMatch,
                isLandingMatch: isLandingMatch
              });
            }
            
            // Picker helper for a given maximum radius tier
            var pickBestCandidate = function(maxDist) {
              var tierList = candidates.filter(function(c) { return c.dist <= maxDist; });
              if (tierList.length === 0) return null;
              
              // Sort by:
              // 1. Specific keyword match for requested siteType
              // 2. Altitude proximity (if altM provided and toAlt > 0)
              // 3. Proximity / distance
              tierList.sort(function(a, b) {
                var aPref = (siteType === 'takeoff' && a.isLaunchMatch) || (siteType === 'landing' && a.isLandingMatch) ? 1 : 0;
                var bPref = (siteType === 'takeoff' && b.isLaunchMatch) || (siteType === 'landing' && b.isLandingMatch) ? 1 : 0;
                if (aPref !== bPref) return bPref - aPref;
                
                if (altM && a.toAlt > 0 && b.toAlt > 0) {
                  var aAltDiff = Math.abs(altM - a.toAlt);
                  var bAltDiff = Math.abs(altM - b.toAlt);
                  if (Math.abs(aAltDiff - bAltDiff) > 100) {
                    return aAltDiff - bAltDiff;
                  }
                }
                
                return a.dist - b.dist;
              });
              
              return tierList[0].name;
            };
            
            // 3 Tries: 50m -> 200m -> 1000m
            var selectedSite = pickBestCandidate(50) || pickBestCandidate(200) || pickBestCandidate(1000);
            if (selectedSite) {
              CacheService.getScriptCache().put(key, selectedSite, 21600);
              return selectedSite;
            }
          }
        } else {
          console.warn('ParaglidingEarth returned status: ' + res.getResponseCode());
        }
      } catch (e) {
        console.warn('ParaglidingEarth Error:', e);
      }
    }
    
    // 2. Overpass API (OSM) - Fallback
    if (provider.indexOf('overpass') === 0) {
      try {
        var r = radiusM || 3000;
        var q = '[out:json];(node["sport"="paragliding"](around:' + r + ',' + lat + ',' + lon + ');way["sport"="paragliding"](around:' + r + ',' + lat + ',' + lon + '););out center;';
        var url = 'https://overpass-api.de/api/interpreter?data=' + encodeURIComponent(q);
        Utilities.sleep(1000); 
        var res = UrlFetchApp.fetch(url, {
          headers: { 'User-Agent': userAgent },
          muteHttpExceptions: true
        });
        
        if (res.getResponseCode() === 200) {
          var body = JSON.parse(res.getContentText());
          var elements = body.elements;
          
          var bestDist = Infinity;
          var bestName = '';
          
          if (elements && elements.length > 0) {
            elements.forEach(function(el) {
               var elLat = el.lat || (el.center && el.center.lat);
               var elLon = el.lon || (el.center && el.center.lon);
               if (elLat && elLon) {
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
        } else {
          console.warn('Overpass API returned status: ' + res.getResponseCode());
        }
      } catch (e2) {
        console.warn('Overpass Error:', e2);
      }
    }
  }
  return '';
}

function haversineGeo_(lat1, lon1, lat2, lon2) {
  return haversine_(lat1, lon1, lat2, lon2);
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
