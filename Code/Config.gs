/**
 * Paragliding Flight Log v2.0
 * Updated: 2026-09-30 21:59:57
 */
/**
 * Paragliding Flight Log v2.0 - Configuration
 * 
 * Contains:
 * 1. Global Configuration (CFG)
 * 2. Tab & Column Definitions (TABS)
 */

/* ==========================================================================================
   GLOBAL CONFIG
   ========================================================================================== */

var CFG = {
  sheets: {
    flights: 'Flights',
    equipment: 'Equipment',
    parameters: 'Parameters',
    lookups: 'Lookups',
    appLog: 'App_Log',
    sites: 'Sites',
    dashboard: 'Dashboard',
    pilotProfile: 'Pilot_Profile',
    userGuide: 'User Guide'
  },
  // Centralized Parameter Definitions (Source of Truth for Parameters Sheet)
  parameters: [
    // Ingestion
    { section: 'Ingestion', key: 'WATCH_FOLDER_ID', val: '', desc: 'Google Drive Folder ID(s) to watch for .igc files (comma separated)', input: true },
    { section: 'Ingestion', key: 'MASTER_LOG_FOLDER_ID', val: '', desc: 'Google Drive ID for Master Log (Public)', input: true },
    { section: 'Ingestion', key: 'UPLOAD_FOLDER_ID', val: '', desc: 'Google Drive Folder ID for manual uploads', input: true },
    { section: 'Ingestion', key: 'ERROR_FOLDER_ID', val: '', desc: 'Google Drive Folder ID for failed imports', input: true },
    { section: 'Ingestion', key: 'TRASH_FOLDER_ID', val: '', desc: 'Google Drive Trash/Discard folder for purged and duplicate files', input: true },
    { section: 'Ingestion', key: 'ENABLE_WATCH_FOLDER', val: 'FALSE', desc: 'Enable automated scanning? (TRUE/FALSE)' },
    { section: 'Ingestion', key: 'MOVE_FROM_WATCH_FOLDER', val: 'TRUE', desc: 'Move files from Watch Folder after success? (TRUE/FALSE)' },
    { section: 'Ingestion', key: 'WATCH_PERIOD_MIN', val: 15, desc: 'How often (mins) the trigger runs' },
    
    // Integrations
    { section: 'Integrations', key: 'WEATHER_PROVIDERS', val: 'open_meteo, visual_crossing', desc: 'Weather Providers (comma-sep: open_meteo, visual_crossing)' },
    { section: 'Integrations', key: 'VISUAL_CROSSING_API_KEY', val: '', desc: 'Optional API Key for Visual Crossing Weather backup', input: true },
    { section: 'Integrations', key: 'GDRIVE_DOWNLOAD_URL_PATTERN', val: 'https://drive.google.com/uc?export=download&id={ID}', desc: 'Pattern for direct file download' },
    { section: 'Integrations', key: 'SEEYOU_CLOUD_URL_PATTERN', val: 'https://seeyou.cloud/api/open?igc={URL}', desc: 'Pattern for SeeYou Cloud link' },
    { section: 'Integrations', key: 'XCONTEST_USERNAME', val: '', desc: 'XContest Username for Flight verification', input: true },
    { section: 'Integrations', key: 'XCONTEST_PILOT_URL_PATTERN', val: 'https://www.xcontest.org/world/en/pilots/detail:{username}', desc: 'Pattern for Pilot Profile' },
    { section: 'Integrations', key: 'XCONTEST_FLIGHT_URL_PATTERN', val: 'https://www.xcontest.org/world/en/flights/detail:{username}/{date}/{time}', desc: 'Pattern for Flight Detail' },
    { section: 'Integrations', key: 'XCONTEST_MATCH_DURATION_TOLERANCE_MIN', val: 2, desc: 'Tolerance (min) for Duration match' },
    { section: 'Integrations', key: 'XCONTEST_MATCH_START_TIME_TOLERANCE_MIN', val: 2, desc: 'Tolerance (min) for Start Time match (Fallback)' },
    
    // Geo & Time
    { section: 'Geo & Time', key: 'GEO_REV_PROVIDERS', val: 'google, big_data_cloud, nominatim_osm', desc: 'Reverse Geo Providers (comma-sep: google, big_data_cloud, nominatim_osm)' },
    { section: 'Geo & Time', key: 'GEO_SITE_PROVIDERS', val: 'paragliding_earth, overpass_api', desc: 'Site Name Providers (comma-sep: paragliding_earth, overpass_api)' },
    { section: 'Geo & Time', key: 'LAUNCH_SITE_KEYWORDS', val: 'Launch, Takeoff, Take off', desc: 'Keywords to prioritize Launch sites' },
    { section: 'Geo & Time', key: 'LANDING_SITE_KEYWORDS', val: 'Landing, LZ', desc: 'Keywords to prioritize Landing sites' },
    { section: 'Geo & Time', key: 'GEO_TZ_PROVIDERS', val: 'timeapi_io', desc: 'Time Zone Providers' },
    { section: 'Geo & Time', key: 'OSM_RADIUS_M', val: 3000, desc: 'Radius (m) to search for sites' },
    
    // Validation
    { section: 'Validation', key: 'VALIDATION_MIN_DURATION_SEC', val: 120, desc: 'Min flight duration (sec)' },
    { section: 'Validation', key: 'VALIDATION_MIN_HEIGHT_CHANGE_M', val: 20, desc: 'Min height gain (m) for flight' },
    { section: 'Validation', key: 'VALIDATION_MAX_SPEED_KMH', val: 120, desc: 'Max valid speed (km/h)' },
    { section: 'Validation', key: 'VALIDATION_MAX_AVG_SPEED_KMH', val: 60, desc: 'Max valid avg speed (km/h)' },
    
    // Analysis Rules
    { section: 'Analysis Rules', key: 'THERMAL_MIN_CLIMB', val: 0.3, desc: 'Min vario (m/s) for thermal' },
    { section: 'Analysis Rules', key: 'THERMAL_MIN_TURN', val: 8, desc: 'Min turn rate (deg/s) for thermal' },
    { section: 'Analysis Rules', key: 'SOAR_VARIO_MIN', val: -0.2, desc: 'Min climb (m/s) for Soaring' },
    { section: 'Analysis Rules', key: 'SOAR_VARIO_MAX', val: 1.5, desc: 'Max climb (m/s) for Soaring' },
    { section: 'Analysis Rules', key: 'SOAR_TURN_MAX', val: 5, desc: 'Max turn rate (deg/s) for Soaring' },
    { section: 'Analysis Rules', key: 'GLIDE_VARIO_MAX', val: 0.2, desc: 'Max vario (m/s) for Glide' },
    { section: 'Analysis Rules', key: 'GLIDE_TURN_MAX', val: 5, desc: 'Max turn rate (deg/s) for Glide' },
    { section: 'Analysis Rules', key: 'GLIDE_LD_TOL_PCT', val: 30, desc: 'Glide L/D Tolerance %' },
    { section: 'Analysis Rules', key: 'SINK_VARIO', val: -2.5, desc: 'Max sink (m/s) for Sink mode' },
    { section: 'Analysis Rules', key: 'SINK_TURN_MAX', val: 10, desc: 'Max turn rate (deg/s) for Sink' },

    // Analysis - Advanced
    { section: 'Analysis - Adv', key: 'MODE_WINDOW_SEC', val: 10, desc: 'Smoothing window (sec)' },
    { section: 'Analysis - Adv', key: 'REVERSAL_WINDOW_SEC', val: 30, desc: 'Heading reversal window (sec)' },
    { section: 'Analysis - Adv', key: 'MODE_HYSTERESIS_SEC', val: 6, desc: 'Mode switch delay (sec)' },

    // Scoring
    { section: 'Scoring', key: 'NATIONAL_BONUS_MULTIPLIER', val: 1.2, desc: 'Triangle Multiplier' },
    { section: 'Scoring', key: 'NATIONAL_BONUS_WITHIN_PCT', val: 5, desc: 'Triangle gap tolerance %' },

    // Admin
    { section: 'Admin', key: 'CONTACT_EMAIL', val: '', desc: 'Required for APIs', input: true },
    
    // Lists
    { section: 'Lists', key: 'DATE_FORMAT', val: 'yyyy-MM-dd', desc: 'Date Display Format' },
    { section: 'Lists', key: 'TIME_FORMAT', val: 'h:mm a', desc: 'Time Display Format' },

    // Dashboard & Currency
    { section: 'Dashboard & Currency', key: 'TIMELINE_FLIGHTS_LOW', val: 2, desc: 'Monthly flights low threshold (Orange < X)' },
    { section: 'Dashboard & Currency', key: 'TIMELINE_FLIGHTS_MED', val: 6, desc: 'Monthly flights med threshold (Yellow X..Y, Green >= Y)' },
    { section: 'Dashboard & Currency', key: 'TIMELINE_HOURS_LOW', val: 1 / 24, desc: 'Monthly duration low threshold (Orange < X, [h]:mm "hrs")' },
    { section: 'Dashboard & Currency', key: 'TIMELINE_HOURS_MED', val: 4 / 24, desc: 'Monthly duration med threshold (Yellow X..Y, Green >= Y, [h]:mm "hrs")' }
  ],
  
  // Helper to get defaults map
  getDefaults: function() {
    var defs = {};
    for (var i=0; i<this.parameters.length; i++) {
       defs[this.parameters[i].key] = this.parameters[i].val;
    }
    return defs;
  }
};

// Bind defaults for backward compatibility
CFG.defaults = CFG.getDefaults();

// Site Keywords for Launch and Landing Disambiguation
CFG.siteKeywords = {
  launch: ['Launch', 'Takeoff', 'Take off'],
  landing: ['Landing', 'LZ']
};

/* ==========================================================================================
   TAB DEFINITIONS
   ========================================================================================== */

var TABS = {
  DASHBOARD: {
    name: CFG.sheets.dashboard,
    color: '#607D8B', // Blue Grey
    index: 1,
    headerRow: 1,
    frozenRows: 0
  },
  FLIGHTS: {
    name: CFG.sheets.flights,
    color: '#4CAF50', // Green
    index: 2,
    headerRow: 4, // Headers are on Row 4
    dataStartRow: 5, 
    dataEndRow: 15, // Optimization: Only apply dropdowns to top 15 rows initially
    frozenRows: 4,
    frozenCols: 4,
    /**
     * COLUMN HELPER NOTES (Header Tooltips on Row 4)
     * --------------------------------------------------------------------------------------
     * HOW TO EDIT MANUALLY:
     * Add or edit entries below matching the exact Column Name: 'Note text'.
     * When scaffolding runs (or reapplyFormatting_), each column with a note here will have
     * a hover tooltip note added to its Row 4 header cell in Google Sheets.
     * Any column not listed below will have its header note left blank.
     * --------------------------------------------------------------------------------------
     */
    colNotes: {
      'FlightID': 'Click to view flight',
      'IGC File': 'Click to download igc',
      'XContest': 'Click to view on XContest'
    },
    groups: [
      { 
        name: 'Flight Info', 
        visibleCols: 4, 
        collapsedRows: 2, // Show 2 rows (4 items) when collapsed
        color: '#F5F5F5', 
        cols: ['FlightID', 'Status', 'Flight No', 'Auto Summary', 'IGC File', 'Notes', 'Flight Type', 'Date', 'Time Zone', 'Launch Time', 'Landing Time', 'Flight Duration', 'Track Length (km)', 'Straight Dist (km)'],
        editable: ['Status', 'Notes', 'Flight Type', 'Date', 'Time Zone', 'Launch Time', 'Landing Time']
      },
      { 
        name: 'Gear', 
        visibleCols: 1, 
        collapsedRows: 1,
        color: '#FFF9C4', 
        cols: ['Wing', 'Harness', 'Reserve 1', 'Reserve 2', 'Other equipment'],
        editable: ['Wing', 'Harness', 'Reserve 1', 'Reserve 2', 'Other equipment']
      },
      { 
        name: 'XC Scoring', 
        visibleCols: 1, 
        collapsedRows: 1,
        color: '#FFCCBC', 
        cols: ['XContest', 'XC Distance (km)', 'XC Score', 'XC Flight Class', 'FAI Triangle (km)', 'Points (World)', 'Points (National)', 'Closed?', 'Max Alt (m)', 'Min Alt (m)', 'Total Height Gain (m)', 'Max Ascent (m/s)', 'Max Descent (m/s)', 'Max Groundspeed (km/h)', 'Avg Groundspeed (km/h)'],
        editable: ['XC Flight Class', 'Closed?']
      },
      { 
        name: 'Launch', 
        visibleCols: 1, 
        collapsedRows: 1,
        color: '#C8E6C9', 
        cols: ['Launch Alt (m)', 'Launch Lat', 'Launch Lon', 'Launch Site', 'Launch Town', 'Launch Country', 'Launch Region'],
        editable: ['Launch Site']
      },
      { 
        name: 'Landing', 
        visibleCols: 1, 
        collapsedRows: 1,
        color: '#DCEDC8', 
        cols: ['Landing Alt (m)', 'Landing Lat', 'Landing Lon', 'Landing Site', 'Landing Town', 'Landing Country', 'Landing Region'],
        editable: ['Landing Site']
      },
      { 
        name: 'Weather', 
        visibleCols: 1, 
        collapsedRows: 1,
        color: '#E1F5FE', 
        cols: ['Wind@Launch', 'Wind@Landing', 'Cloud %', 'Cloudbase', 'Temp (C)', 'Observations'],
        editable: ['Wind@Launch', 'Wind@Landing', 'Cloud %', 'Cloudbase', 'Temp (C)', 'Observations']
      },
      { 
        name: 'Analytics', 
        visibleCols: 1, 
        collapsedRows: 1,
        color: '#E1BEE7', 
        cols: ['Thermal %', 'Thermals Count', 'Thermal Avg (m/s)', 'Thermal Best (m/s)', 'Soar %', 'Efficiency', 'Glide %', 'Glide L/D', 'Sink %', 'Sink Time'],
        editable: []
      },
      { 
        name: 'Validation', 
        visibleCols: 1, 
        collapsedRows: 1,
        color: '#FFCDD2', 
        cols: ['Validation Status', 'Val: Reason'],
        editable: ['Validation Status', 'Val: Reason']
      },
      { 
        name: 'Meta', 
        visibleCols: 1, 
        collapsedRows: 1,
        color: '#CFD8DC', 
        cols: ['Import File', 'Import ID', 'IGC Hash', 'Timestamp', 'Parser Ver'],
        editable: []
      }
    ]
  },
  PILOT_PROFILE: {
    name: CFG.sheets.pilotProfile,
    color: '#00695C', // Deep Teal
    index: 3,
    headerRow: 2,
    frozenRows: 0,
    columns: ['Category', 'Field', 'Value', 'Notes']
  },
  EQUIPMENT: {
    name: CFG.sheets.equipment,
    color: '#2196F3', // Blue
    index: 4,
    headerRow: 2,
    dataStartRow: 3,
    dataEndRow: 50, // Limit validation/formatting to 50 rows
    frozenRows: 2,
    columns: ['Category', 'EquipmentID', 'Make', 'Model', 'Size', 'Type', 'Default?', 'Retired?', 'Glide', 'Trim', 'Full', 'Link', 'Notes']
  },
  USER_GUIDE: {
    name: CFG.sheets.userGuide,
    color: '#455A64', // Blue Grey Dark
    index: 5,
    headerRow: 1,
    frozenRows: 0
  },
  PARAMETERS: {
    name: CFG.sheets.parameters,
    color: '#FFEB3B', // Yellow
    index: 6,
    headerRow: 2,
    frozenRows: 0,
    columns: ['Parameter', 'Value', 'Description']
  },
  LOOKUPS: {
    name: CFG.sheets.lookups,
    color: '#FF9800', // Orange
    index: 7,
    headerRow: 2,
    frozenRows: 0,
    columns: ['Categories', 'Wings (Auto)', 'Harnesses (Auto)', 'Reserves (Auto)', 'Other (Auto)', 'Flight Status', 'Flight Type']
  },
  APP_LOG: {
    name: CFG.sheets.appLog,
    color: '#F44336', // Red
    index: 8,
    headerRow: 2,
    frozenRows: 2,
    columns: ['Timestamp', 'FileID', 'FileName', 'InnerName', 'Status', 'Info']
  }
};
