/**
 * Paragliding Flight Log v2.0
 * Updated: 2026-09-29 23:04:10
 */
/**
 * Paragliding Flight Log v2.0 - XContest Integration
 * 
 * Logic to verify if a flight exists on XContest.org
 */

var XContest = {};

/**
 * Checks if a flight exists on XContest using Pilot Detail page.
 * Strategy: Date Match + Duration Match (Primary) or Time Match (Secondary).
 * 
 * @param {Date} flightDateObj - The flight date (from IGC).
 * @param {number} flightDurationMin - Flight duration in minutes.
 * @param {number} flightStartTimeMin - Start time in minutes from midnight (UTC).
 * @param {Object} config - Config object containing XCONTEST_USERNAME, etc.
 * @return {Object} { status: "Yes"|"No"|"Error", url: string|null, note: string }
 */
XContest.checkFlight = function(flightDateObj, flightDurationMin, flightStartTimeMin, config) {
  var username = config.XCONTEST_USERNAME;
  if (!username) return { status: "No", note: "No Username" };

  // 1. Determine Season
  // XContest Season: Oct 1st previous year -> Sept 30th named year.
  // If Month is Oct(9), Nov(10), Dec(11), Season is Year + 1.
  var year = flightDateObj.getFullYear();
  var month = flightDateObj.getMonth();
  var season = (month >= 9) ? year + 1 : year; // Updated: 2026-02-13 01:10:00
  
  // 2. Construct URL
  // Pattern: .../detail:{username}?list[season]={season}
  var baseUrl = config.XCONTEST_PILOT_URL_PATTERN.replace('{username}', username);
  var fetchUrl = baseUrl + "?list[season]=" + season;
  
  try {
    var response = UrlFetchApp.fetch(fetchUrl, { muteHttpExceptions: true });
    if (response.getResponseCode() !== 200) {
      return { status: "Error", note: "HTTP " + response.getResponseCode() };
    }
    
    var html = response.getContentText();
    
    // 3. Find Date Rows
    // Date Format in HTML: DD.MM.YY (e.g. 12.08.24)
    var dd = ("0" + flightDateObj.getDate()).slice(-2);
    var mm = ("0" + (flightDateObj.getMonth() + 1)).slice(-2);
    var yy = String(year).slice(-2);
    var dateStr = dd + "." + mm + "." + yy;
    
    // Split into table rows to parse safely
    var rows = html.match(/<tr[^>]*>[\s\S]*?<\/tr>/gi) || [];
   // Tolerances
  var durTol = (config.XCONTEST_MATCH_DURATION_TOLERANCE_MIN !== undefined) ? config.XCONTEST_MATCH_DURATION_TOLERANCE_MIN : 2;
  var timeTol = (config.XCONTEST_MATCH_START_TIME_TOLERANCE_MIN !== undefined) ? config.XCONTEST_MATCH_START_TIME_TOLERANCE_MIN : 2; 

  // Fuzzy Match Logic
  for (var i = 0; i < rows.length; i++) {
        var row = rows[i];
        if (row.indexOf(dateStr) === -1) continue; // Skip if date not found
        
        // 4. Fuzzy Match Logic
        
        // Extract Duration (Airtime) - Look for class "km" or "pts" usually? 
        // XContest table structure varies, but usually: Date | Start Time | Type | Dist | Points | Airtime ...
        // We look for pattern: H:MM (Duration)
        // Warning: Start Time is also H:MM. Duration usually later in the row.
        
        // Let's try to extract all HH:MM patterns
        var timeMatches = row.match(/(\d{1,2}):(\d{2})/g);
        if (!timeMatches || timeMatches.length < 2) continue;
        
        // Usually: [0] = Start Time (Local), [Last] = Duration (Airtime)
        // Check Duration (Last one is safest for Airtime?)
        // Wait, standard columns: Start | Flight | Launch | ... | Airtime
        
        // Strategy: Check ALL time patterns for Duration match first
        var matched = false;
        var matchType = "";
        
        for (var t = 0; t < timeMatches.length; t++) {
           var parts = timeMatches[t].split(':');
           var mins = parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
           
           // Check Duration (Tolerance from Config)
    if (Math.abs(mins - flightDurationMin) <= durTol) {
      matched = true;
               matchType = "Duration";
               break; 
           }
        }
        
        // Fallback: Check Start Time
        // Only if duration didn't match definitively but date matched
        if (!matched && timeMatches.length > 0) {
           var startParts = timeMatches[0].split(':');
           var startMins = parseInt(startParts[0], 10) * 60 + parseInt(startParts[1], 10);
           
           var diffMins = Math.abs(startMins - flightStartTimeMin);
           if (diffMins > 720) diffMins = 1440 - diffMins;
           if (diffMins <= timeTol) {
               matched = true;
               matchType = "Start Time (Fallback)";
           }
        }

        if (matched) {
            // Generate Specific Flight URL
            // Pattern: .../detail:{username}/{d.m.yyyy}/{hh:mm}
            // Use the Start Time from the ROW for the URL
            var xcStartTime = timeMatches[0]; // First time match is usually Start Time
             
            // XContest URL uses 4-digit year? Let's verify pattern request.
            // User said: .../detail:rohitash/3.2.2026/20:27
            // So d.m.yyyy (no leading zeros?) and H:MM
            
            var d_url = flightDateObj.getDate();
            var m_url = flightDateObj.getMonth() + 1;
            var y_url = year;
            var urlDatePart = d_url + "." + m_url + "." + y_url;
            
            var flightUrl = baseUrl + "/" + urlDatePart + "/" + xcStartTime;
            
            return { status: "Yes", url: flightUrl, note: "Matched " + matchType };
        }
    }
    
    return { status: "No", note: "Not found on Date" };
    
  } catch (e) {
    console.warn("XContest Check Error", e);
    return { status: "Error", note: e.message };
  }
};
