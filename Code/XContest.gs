/**
 * Paragliding Flight Log v2.0
 * Updated: 2026-09-30 16:29:22
 */
/**
 * Paragliding Flight Log v2.0 - XContest Integration
 * 
 * Logic to verify if a flight exists on XContest.org using direct flight URL probing,
 * extract permanent internal flight IDs, and evaluate the 14-day competition claim deadline.
 */

var XContest = {};

/**
 * Checks if a flight exists on XContest.org using direct flight URL probing.
 * Probes candidate UTC launch times within tolerance and extracts the permanent flight ID.
 * If not found, checks against the 14-day competition claiming deadline.
 * 
 * @param {Date|string} flightDateObj - The flight date (from IGC or sheet).
 * @param {number} flightDurationMin - Flight duration in minutes (kept for API compatibility).
 * @param {number} flightStartTimeMin - UTC launch time in minutes from midnight (0..1439).
 * @param {Object} config - Config object containing XCONTEST_USERNAME, etc.
 * @return {Object} { status: "Yes"|"Claim soon!"|"Expired"|"No Username"|"Error", url: string|null, label: string, flightId: string|null, note: string }
 */
XContest.checkFlight = function(flightDateObj, flightDurationMin, flightStartTimeMin, config) {
  var username = config.XCONTEST_USERNAME;
  if (!username) {
    return { status: "No Username", label: "No Username", url: null, flightId: null, note: "No XContest username configured" };
  }

  // 1. Parse Year, Month, Day safely
  var y, m, d;
  if (typeof flightDateObj === 'string' && flightDateObj.match(/^\d{4}-\d{2}-\d{2}/)) {
    var dParts = flightDateObj.split('-');
    y = parseInt(dParts[0], 10);
    m = parseInt(dParts[1], 10);
    d = parseInt(dParts[2], 10);
  } else if (flightDateObj instanceof Date && !isNaN(flightDateObj.getTime())) {
    // If UTC midnight (e.g. new Date('YYYY-MM-DD')), use UTC to prevent Western TZ rollback
    if (flightDateObj.getUTCHours() === 0 && flightDateObj.getUTCMinutes() === 0 && flightDateObj.getUTCSeconds() === 0) {
      y = flightDateObj.getUTCFullYear();
      m = flightDateObj.getUTCMonth() + 1;
      d = flightDateObj.getUTCDate();
    } else {
      y = flightDateObj.getFullYear();
      m = flightDateObj.getMonth() + 1;
      d = flightDateObj.getDate();
    }
  } else {
    return { status: "Error", label: "Error", url: null, flightId: null, note: "Invalid flight date" };
  }

  var dd = ("0" + d).slice(-2);
  var mm = ("0" + m).slice(-2);
  var yyyy = String(y);
  var dateStrLeading = dd + "." + mm + "." + yyyy; // e.g. 17.09.2026

  // 2. Generate Candidate UTC Start Times
  var baseMin = Math.round(Number(flightStartTimeMin) || 0);
  var timeTol = (config.XCONTEST_MATCH_START_TIME_TOLERANCE_MIN !== undefined) ? parseInt(config.XCONTEST_MATCH_START_TIME_TOLERANCE_MIN, 10) : 2;
  if (isNaN(timeTol) || timeTol < 1) timeTol = 2;

  // Prioritize exact base minute, then +/- 1, then +/- 2
  var offsets = [0, -1, 1, -2, 2];
  if (timeTol > 2) {
    for (var o = 3; o <= timeTol; o++) {
      offsets.push(-o);
      offsets.push(o);
    }
  }

  function minToHHMM(totalMins) {
    var norm = ((totalMins % 1440) + 1440) % 1440;
    var hh = Math.floor(norm / 60);
    var min = norm % 60;
    return ("0" + hh).slice(-2) + ":" + ("0" + min).slice(-2);
  }

  var timeCandidates = [];
  for (var i = 0; i < offsets.length; i++) {
    var candStr = minToHHMM(baseMin + offsets[i]);
    if (timeCandidates.indexOf(candStr) === -1) {
      timeCandidates.push(candStr);
    }
  }

  // 3. Construct URL & Probe
  var pattern = config.XCONTEST_FLIGHT_URL_PATTERN || 'https://www.xcontest.org/world/en/flights/detail:{username}/{date}/{time}';

  try {
    for (var t = 0; t < timeCandidates.length; t++) {
      var timeStr = timeCandidates[t];
      var probeUrl = pattern.replace('{username}', username)
                            .replace('{date}', dateStrLeading)
                            .replace('{time}', timeStr);

      var resp = UrlFetchApp.fetch(probeUrl, { muteHttpExceptions: true });
      if (resp.getResponseCode() === 200) {
        var html = resp.getContentText();
        // Check for flight existence markers (disc-* class or Flight detail with pilot name)
        var isMatch = (html.indexOf('class="disc-') !== -1) ||
                      (/Flight detail\s*:\s*[^:]+::/i.test(html)) ||
                      (html.indexOf('<div class="bar">') !== -1 && html.indexOf('Flight detail <em>') !== -1);

        if (isMatch) {
          // Extract permanent internal flight ID from og:image if available
          var idMatch = html.match(/[?&]fl=(\d+)/);
          var flId = idMatch ? idMatch[1] : null;
          var label = flId ? ('XC#' + flId) : ('XC-' + yyyy + mm + dd + '-' + timeStr.replace(':', ''));

          return {
            status: "Yes",
            url: probeUrl,
            flightId: flId,
            label: label,
            note: "Verified on XContest"
          };
        }
      }
    }

    // 4. Not found on XContest - Evaluate 14-day claim deadline
    var now = new Date();
    var flightMidday = new Date(y, m - 1, d, 12, 0, 0);
    var diffMs = now.getTime() - flightMidday.getTime();
    var diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays <= 14 && diffDays >= 0) {
      return {
        status: "Claim soon!",
        label: "Claim soon!",
        url: null,
        flightId: null,
        note: "Not found on XContest (within 14-day deadline, " + (14 - diffDays) + "d remaining)"
      };
    } else {
      return {
        status: "Expired",
        label: "Expired",
        url: null,
        flightId: null,
        note: "Not found on XContest (>14-day claim deadline)"
      };
    }

  } catch (e) {
    console.warn("XContest Direct Probe Error", e);
    return {
      status: "Error",
      label: "Error",
      url: null,
      flightId: null,
      note: e.message
    };
  }
};
