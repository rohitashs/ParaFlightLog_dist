/**
 * Paragliding Flight Log v2.0
 * Updated: 2026-09-30 23:53:37
 * 
 * WEATHER MODULE: Automated Historical & Forecast Weather Enrichment (RQ-SCR-004)
 * Supports:
 * - Open-Meteo Historical Archive & Recent 7-Day Forecast Fallback (Primary)
 * - Visual Crossing Timeline API (Backup)
 * - Convective Cloudbase Estimation: MSL & AGL (Lawrence Formula)
 * - Cardinal Wind Direction & Gust Formatting
 */

var WEATHER = {

  /**
   * Main entry point: Get weather enrichment for launch and landing.
   * @param {Object} launchFix {lat, lon, alt}
   * @param {Object} landFix {lat, lon, alt}
   * @param {string} dateIso "YYYY-MM-DD"
   * @param {number} startTimeSec Seconds from midnight UTC or local
   * @param {number} endTimeSec Seconds from midnight UTC or local
   * @param {Object} config Parameters map
   * @returns {Object} Enrichment fields matching sheet schema
   */
  getEnrichment: function(launchFix, landFix, dateIso, startTimeSec, endTimeSec, config) {
    config = config || {};
    var providersStr = config.WEATHER_PROVIDERS || 'open_meteo, visual_crossing';
    var providers = providersStr.split(',').map(function(p) { return p.trim().toLowerCase(); });

    var launchHour = this.getHourFromSeconds_(startTimeSec);
    var landHour = this.getHourFromSeconds_(endTimeSec || (startTimeSec + 3600));

    var launchAlt = (launchFix && typeof launchFix.alt === 'number') ? launchFix.alt : null;

    var launchData = null;
    var landData = null;
    var usedProvider = '';
    var lastError = null;

    for (var i = 0; i < providers.length; i++) {
      var p = providers[i];
      try {
        if (p === 'open_meteo') {
          launchData = this.fetchOpenMeteo_(launchFix.lat, launchFix.lon, dateIso, launchHour, launchAlt, config);
          if (launchData && landFix) {
            landData = this.fetchOpenMeteo_(landFix.lat, landFix.lon, dateIso, landHour, landFix.alt, config);
          }
          if (launchData) {
            usedProvider = 'Open-Meteo';
            break;
          }
        } else if (p === 'visual_crossing') {
          if (!config.VISUAL_CROSSING_API_KEY) {
            console.log('Weather: Visual Crossing API key not configured, skipping');
            continue;
          }
          launchData = this.fetchVisualCrossing_(launchFix.lat, launchFix.lon, dateIso, launchHour, launchAlt, config);
          if (launchData && landFix) {
            landData = this.fetchVisualCrossing_(landFix.lat, landFix.lon, dateIso, landHour, landFix.alt, config);
          }
          if (launchData) {
            usedProvider = 'Visual Crossing';
            break;
          }
        }
      } catch (err) {
        lastError = err.message || String(err);
        console.warn('Weather provider ' + p + ' failed: ' + lastError);
      }
    }

    if (!launchData) {
      return {
        windLaunch: '',
        windLanding: '',
        cloudPct: '',
        cloudbase: '',
        tempC: '',
        observations: '',
        provider: '',
        error: lastError || 'No weather data found'
      };
    }

    // Format fields
    var windLaunch = this.formatWind_(launchData.windSpeed, launchData.windDir, launchData.windGust);
    var windLand = landData ? this.formatWind_(landData.windSpeed, landData.windDir, landData.windGust) : '';
    var cloudPct = (typeof launchData.cloudCover === 'number') ? Math.round(launchData.cloudCover) + '%' : '';
    var cloudbase = this.calculateCloudbase_(launchData.temp, launchData.dewPoint, launchAlt);
    var tempC = (typeof launchData.temp === 'number') ? Math.round(launchData.temp) + '°C' : '';
    var observations = launchData.conditions || '';

    return {
      windLaunch: windLaunch,
      windLanding: windLand,
      cloudPct: cloudPct,
      cloudbase: cloudbase,
      tempC: tempC,
      observations: observations,
      provider: usedProvider,
      error: null
    };
  },

  /**
   * Helper: Convert seconds from midnight to 0-23 hour.
   */
  getHourFromSeconds_: function(sec) {
    if (typeof sec !== 'number' || isNaN(sec)) return 12; // default midday
    var h = Math.floor(sec / 3600) % 24;
    return (h >= 0 && h <= 23) ? h : 12;
  },

  /**
   * Fetch from Open-Meteo: Automatic selection of 7-day forecast API or archive API.
   */
  fetchOpenMeteo_: function(lat, lon, dateIso, hour, launchAlt, config) {
    if (!lat || !lon || !dateIso) return null;

    var cacheKey = 'WX_OM_' + Number(lat).toFixed(2) + '_' + Number(lon).toFixed(2) + '_' + dateIso + '_' + hour;
    var cached = this.getCache_(cacheKey);
    if (cached) return cached;

    // Check age of flight date in days
    var flightDate = new Date(dateIso);
    var now = new Date();
    var diffDays = Math.floor((now.getTime() - flightDate.getTime()) / (1000 * 60 * 60 * 24));

    var url = '';
    var hourlyVars = 'temperature_2m,dew_point_2m,cloud_cover,wind_speed_10m,wind_direction_10m,wind_gusts_10m,weather_code';

    if (diffDays >= 0 && diffDays <= 5) {
      // Recent flight: query forecast API with past_days=7
      url = 'https://api.open-meteo.com/v1/forecast?latitude=' + encodeURIComponent(lat) +
            '&longitude=' + encodeURIComponent(lon) +
            '&hourly=' + hourlyVars +
            '&past_days=7&forecast_days=1&timezone=auto';
    } else {
      // Historical flight: query archive API
      url = 'https://archive-api.open-meteo.com/v1/archive?latitude=' + encodeURIComponent(lat) +
            '&longitude=' + encodeURIComponent(lon) +
            '&start_date=' + encodeURIComponent(dateIso) +
            '&end_date=' + encodeURIComponent(dateIso) +
            '&hourly=' + hourlyVars +
            '&timezone=auto';
    }

    var options = {
      muteHttpExceptions: true,
      headers: {
        'User-Agent': 'ParaFlightLog/2.0 (' + (config.CONTACT_EMAIL || 'pilot@flightlog.local') + ')'
      }
    };

    var response = UrlFetchApp.fetch(url, options);
    var statusCode = response.getResponseCode();
    if (statusCode !== 200) {
      console.warn('Open-Meteo API returned HTTP ' + statusCode + ': ' + response.getContentText());
      return null;
    }

    var data = JSON.parse(response.getContentText());
    if (!data || !data.hourly || !data.hourly.time) return null;

    // Find the hourly index that matches target date & hour
    var targetPrefix = dateIso + 'T' + ('0' + hour).slice(-2);
    var idx = -1;
    for (var i = 0; i < data.hourly.time.length; i++) {
      if (data.hourly.time[i].indexOf(targetPrefix) === 0) {
        idx = i;
        break;
      }
    }

    // Fallback if exact hour not found (e.g., timezone mismatch in time array)
    if (idx === -1 && data.hourly.time.length > 0) {
      idx = Math.min(hour, data.hourly.time.length - 1);
    }

    if (idx === -1) return null;

    var hData = data.hourly;
    var wCode = hData.weather_code ? hData.weather_code[idx] : null;
    var conditions = this.wmoWeatherCodeToText_(wCode);

    var res = {
      temp: hData.temperature_2m ? hData.temperature_2m[idx] : null,
      dewPoint: hData.dew_point_2m ? hData.dew_point_2m[idx] : null,
      cloudCover: hData.cloud_cover ? hData.cloud_cover[idx] : null,
      windSpeed: hData.wind_speed_10m ? hData.wind_speed_10m[idx] : null,
      windDir: hData.wind_direction_10m ? hData.wind_direction_10m[idx] : null,
      windGust: hData.wind_gusts_10m ? hData.wind_gusts_10m[idx] : null,
      conditions: conditions
    };

    this.setCache_(cacheKey, res, 21600); // 6 hours
    return res;
  },

  /**
   * Fetch from Visual Crossing Timeline API.
   */
  fetchVisualCrossing_: function(lat, lon, dateIso, hour, launchAlt, config) {
    if (!config.VISUAL_CROSSING_API_KEY) return null;

    var cacheKey = 'WX_VC_' + Number(lat).toFixed(2) + '_' + Number(lon).toFixed(2) + '_' + dateIso + '_' + hour;
    var cached = this.getCache_(cacheKey);
    if (cached) return cached;

    var url = 'https://weather.visualcrossing.com/VisualCrossingWebServices/rest/services/timeline/' +
              encodeURIComponent(lat) + ',' + encodeURIComponent(lon) + '/' +
              encodeURIComponent(dateIso) +
              '?unitGroup=metric&key=' + encodeURIComponent(config.VISUAL_CROSSING_API_KEY) +
              '&include=hours';

    var options = { muteHttpExceptions: true };
    var response = UrlFetchApp.fetch(url, options);
    var statusCode = response.getResponseCode();
    if (statusCode !== 200) {
      console.warn('Visual Crossing API returned HTTP ' + statusCode + ': ' + response.getContentText());
      return null;
    }

    var data = JSON.parse(response.getContentText());
    if (!data || !data.days || !data.days[0] || !data.days[0].hours) return null;

    var hours = data.days[0].hours;
    var hData = hours[hour] || hours[Math.min(hour, hours.length - 1)];
    if (!hData) return null;

    var res = {
      temp: (typeof hData.temp === 'number') ? hData.temp : null,
      dewPoint: (typeof hData.dew === 'number') ? hData.dew : null,
      cloudCover: (typeof hData.cloudcover === 'number') ? hData.cloudcover : null,
      windSpeed: (typeof hData.windspeed === 'number') ? hData.windspeed : null,
      windDir: (typeof hData.winddir === 'number') ? hData.winddir : null,
      windGust: (typeof hData.windgust === 'number') ? hData.windgust : null,
      conditions: hData.conditions || ''
    };

    this.setCache_(cacheKey, res, 21600); // 6 hours
    return res;
  },

  /**
   * Format wind speed, cardinal direction, and gusts (Option A).
   * Example: "14 km/h WNW (gust 20)"
   */
  formatWind_: function(speedKmh, dirDeg, gustKmh) {
    if (typeof speedKmh !== 'number' || isNaN(speedKmh)) return '';
    var roundedSpd = Math.round(speedKmh);
    var cardinal = (typeof dirDeg === 'number' && !isNaN(dirDeg)) ? this.degToCompass_(dirDeg) : '';
    var str = roundedSpd + ' km/h' + (cardinal ? ' ' + cardinal : '');

    if (typeof gustKmh === 'number' && !isNaN(gustKmh)) {
      var roundedGust = Math.round(gustKmh);
      if (roundedGust >= roundedSpd + 3) {
        str += ' (gust ' + roundedGust + ')';
      }
    }
    return str;
  },

  /**
   * Convert degrees to 16-point cardinal compass direction.
   */
  degToCompass_: function(deg) {
    if (typeof deg !== 'number' || isNaN(deg)) return '';
    var cardinals = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
    var normalized = (deg % 360 + 360) % 360;
    var idx = Math.floor((normalized / 22.5) + 0.5) % 16;
    return cardinals[idx];
  },

  /**
   * Estimate convective cloudbase using Lawrence formula (Option A: MSL and AGL).
   * Cloudbase AGL ≈ (T - Td) * 125 meters.
   * Format: "2400m MSL (1200m AGL)"
   */
  calculateCloudbase_: function(tempC, dewPointC, launchAltM) {
    if (typeof tempC !== 'number' || typeof dewPointC !== 'number' || isNaN(tempC) || isNaN(dewPointC)) {
      return '';
    }
    var spread = tempC - dewPointC;
    if (spread < 0) spread = 0;

    var agl = Math.round(spread * 125);
    if (typeof launchAltM === 'number' && !isNaN(launchAltM) && launchAltM > 0) {
      var msl = Math.round(launchAltM + agl);
      return msl + 'm MSL (' + agl + 'm AGL)';
    }
    return agl + 'm AGL';
  },

  /**
   * Map standard WMO weather codes to human-readable paragliding conditions.
   */
  wmoWeatherCodeToText_: function(code) {
    if (code === null || code === undefined) return '';
    var map = {
      0: 'Clear sky',
      1: 'Mainly clear',
      2: 'Partly cloudy',
      3: 'Overcast',
      45: 'Fog',
      48: 'Depositing rime fog',
      51: 'Light drizzle',
      53: 'Moderate drizzle',
      55: 'Dense drizzle',
      56: 'Light freezing drizzle',
      57: 'Dense freezing drizzle',
      61: 'Slight rain',
      62: 'Moderate rain',
      63: 'Heavy rain',
      65: 'Heavy rain',
      66: 'Light freezing rain',
      67: 'Heavy freezing rain',
      71: 'Slight snow',
      73: 'Moderate snow',
      75: 'Heavy snow',
      77: 'Snow grains',
      80: 'Slight rain showers',
      81: 'Moderate rain showers',
      82: 'Violent rain showers',
      85: 'Slight snow showers',
      86: 'Heavy snow showers',
      95: 'Thunderstorm',
      96: 'Thunderstorm with slight hail',
      99: 'Thunderstorm with heavy hail'
    };
    return map[code] || ('WMO ' + code);
  },

  /**
   * Cache helpers using ScriptCache
   */
  getCache_: function(key) {
    try {
      var c = CacheService.getScriptCache();
      var v = c.get(key);
      return v ? JSON.parse(v) : null;
    } catch (e) {
      return null;
    }
  },

  setCache_: function(key, val, ttlSec) {
    try {
      var c = CacheService.getScriptCache();
      c.put(key, JSON.stringify(val), ttlSec || 21600);
    } catch (e) {
      // Ignore cache put errors
    }
  }
};
