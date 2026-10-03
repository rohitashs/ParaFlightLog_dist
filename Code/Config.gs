/**
 * Paragliding Flight Log v2.0
 * Updated: 2026-10-03 00:44:24
 * 
 * MODULE: Configuration
 * 
 * Contains:
 * 1. Global Configuration (CFG)
 * 2. Tab & Column Definitions (TABS)
 * 
 * @design Docs/Design/DSGN-CORE-004_Google_Sheets_Database_Substrate_and_Formula_Engine.md
 * @architecture Docs/Architecture/Views/03_Data_and_Storage_Model.md
 */

/* ==========================================================================================
   GLOBAL CONFIG
   ========================================================================================== */

var CFG = {
  sheets: {
    flights: 'Flights',
    equipment: 'Equipment',
    config: 'Config',
    parameters: 'Config', // Legacy alias
    lookups: 'Config',    // Legacy alias
    appLog: 'Activity Logs',
    sites: 'Sites',
    dashboard: 'Dashboard',
    pilotProfile: 'Pilot_Profile',
    userGuide: 'User Guide',
    queue: 'Automation_Queue'
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
    { section: 'Geo & Time', key: 'CONTACT_EMAIL', val: '', desc: 'Required for open Nominatim / Overpass APIs (User-Agent header)', input: true },
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
    { section: 'Scoring', key: 'RDP_TOLERANCE', val: 0.0005, desc: 'Ramer-Douglas-Peucker track simplification tolerance in degrees (default 0.0005, approx 50m)' },
    { section: 'Scoring', key: 'NATIONAL_BONUS_MULTIPLIER', val: 1.2, desc: 'Triangle Multiplier' },
    { section: 'Scoring', key: 'NATIONAL_BONUS_WITHIN_PCT', val: 5, desc: 'Triangle gap tolerance %' },
    
    // Format and Units
    { section: 'Format and Units', key: 'DATE_FORMAT', val: 'yyyy-MM-dd', desc: 'Date Display Format' },
    { section: 'Format and Units', key: 'TIME_FORMAT', val: 'h:mm a', desc: 'Time Display Format' },

    // Dashboard & Currency
    { section: 'Dashboard & Currency', key: 'TIMELINE_FLIGHTS_LOW', val: 2, desc: 'Monthly flights low threshold (Orange < X)' },
    { section: 'Dashboard & Currency', key: 'TIMELINE_FLIGHTS_MED', val: 6, desc: 'Monthly flights med threshold (Yellow X..Y, Green >= Y)' },
    { section: 'Dashboard & Currency', key: 'TIMELINE_HOURS_LOW', val: 1 / 24, desc: 'Monthly duration low threshold (Orange < X, [h]:mm "hrs")' },
    { section: 'Dashboard & Currency', key: 'TIMELINE_HOURS_MED', val: 4 / 24, desc: 'Monthly duration med threshold (Yellow X..Y, Green >= Y, [h]:mm "hrs")' },

    // Logging & Admin
    { section: 'Logging & Admin', key: 'LOG_LEVEL', val: 'Normal', desc: 'Spreadsheet log verbosity (Brief, Normal, Debug)' },
    { section: 'Logging & Admin', key: 'LOG_AUTO_CLEAN', val: 'Yes', desc: 'Automatically prune historical activity logs (Yes/No)' },
    { section: 'Logging & Admin', key: 'LOG_CLEAN_FREQUENCY_DAYS', val: 3, desc: 'Days between automated log cleanup checks' },
    { section: 'Logging & Admin', key: 'LOG_ROWS_TO_KEEP', val: 2000, desc: 'Minimum activity log rows to retain before pruning' },
    { section: 'Logging & Admin', key: 'LOG_TIME_TO_KEEP_DAYS', val: 90, desc: 'Minimum age (days) of logs to retain before pruning' }
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
      'FlightID': 'Unique flight identifier. Click to view 3D flight track in SeeYou Cloud.',
      'Status': 'Flight validation state: Valid, Review?, Dup-Primary, Dup-Others, Invalid?, Remove. Dashboard KPIs count "Valid" flights.',
      'Flight No': 'Sequential flight number from first flight to present. Automatically adjusts on sort.',
      'Auto Summary': 'Concise human-readable flight summary: Site, Duration, Track Dist, Max Altitude, Flight Type.',
      'IGC File': 'Click to download raw source IGC track file from Google Drive.',
      'Notes': 'Pilot notes, manual observations, and paired duplicate cross-references [DupRef: ...].',
      'Flight Type': 'Free Fly, XC, Soaring, Thermalling, Hike & Fly, Tandem, SIV/Acro, or Training.',
      'Date': 'Local flight date (YYYY-MM-DD).',
      'Time Zone': 'Local IANA timezone for takeoff location (e.g. America/Los_Angeles, Asia/Kolkata).',
      'Launch Time': 'Local takeoff timestamp (HH:mm).',
      'Landing Time': 'Local touchdown timestamp (HH:mm).',
      'Flight Duration': 'Total airborne duration from takeoff to landing (HH:mm).',
      'Track Length (km)': 'Cumulative distance flown through the air along the GPS track.',
      'Straight Dist (km)': 'Direct straight-line distance from launch to landing.',
      'Wing': 'Paraglider wing model used for this flight (managed in Equipment tab).',
      'Harness': 'Harness model used for this flight (managed in Equipment tab).',
      'Reserve 1': 'Primary reserve parachute (managed in Equipment tab).',
      'Reserve 2': 'Secondary reserve parachute (managed in Equipment tab).',
      'Other equipment': 'Instruments, cameras, or ballast used.',
      'XContest': 'Direct flight link on XContest (e.g. XC#6952654) or claim deadline status ("Claim soon!" / "Expired").',
      'XC Distance (km)': 'Optimized 3-turnpoint cross-country distance under league scoring rules.',
      'XC Score': 'Competition score points: Distance * Multiplier (1.0x Free, 1.2x Flat/Out-and-Return, 1.4x FAI).',
      'XC Flight Class': 'Geometric track classification: Free Flight, Flat Triangle, FAI Triangle, or Out-and-Return.',
      'FAI Triangle (km)': 'Strict FAI triangle distance (shortest leg >= 28% total perimeter; 1.4x multiplier).',
      'Points (World)': 'World contest scoring points.',
      'Points (National)': 'National league contest scoring points.',
      'Closed?': 'Triangle circuit closed back to launch within 20% gap (Y/N).',
      'Max Alt (m)': 'Maximum altitude reached above mean sea level (MSL).',
      'Min Alt (m)': 'Minimum altitude recorded during flight.',
      'Total Height Gain (m)': 'Total cumulative altitude gained during climbs.',
      'Max Ascent (m/s)': 'Maximum instantaneous vario climb rate.',
      'Max Descent (m/s)': 'Maximum instantaneous vario sink rate.',
      'Max Groundspeed (km/h)': 'Maximum GPS groundspeed.',
      'Avg Groundspeed (km/h)': 'Average GPS groundspeed across the track.',
      'Launch Alt (m)': 'Elevation of takeoff above mean sea level.',
      'Launch Lat': 'Latitude coordinate of takeoff (decimal degrees).',
      'Launch Lon': 'Longitude coordinate of takeoff (decimal degrees).',
      'Launch Site': 'Nearest recognized paragliding takeoff site (Paragliding Earth / OSM).',
      'Launch Town': 'Administrative town/city for launch location.',
      'Launch Country': 'Country of launch location.',
      'Launch Region': 'State/province/region of launch location.',
      'Landing Alt (m)': 'Elevation of touchdown above mean sea level.',
      'Landing Lat': 'Latitude coordinate of landing.',
      'Landing Lon': 'Longitude coordinate of landing.',
      'Landing Site': 'Nearest recognized paragliding landing site.',
      'Landing Town': 'Administrative town/city for landing location.',
      'Landing Country': 'Country of landing location.',
      'Landing Region': 'State/province/region of landing location.',
      'Wind@Launch': 'Surface 10m wind speed, cardinal direction, and gusts at takeoff.',
      'Wind@Landing': 'Surface 10m wind speed, cardinal direction, and gusts at landing.',
      'Cloud %': 'Total cloud cover percentage at flight time (0-100%).',
      'Cloudbase': 'Estimated convective condensation level (MSL & AGL) via temperature/dewpoint spread.',
      'Temp (C)': 'Ambient 2m air temperature in Celsius at launch.',
      'Observations': 'WMO atmospheric condition description (e.g. Partly cloudy, Clear sky).',
      'Thermal %': 'Percentage of flight time spent thermalling (turn rate > 8 deg/s and climb > 0.3 m/s).',
      'Thermals Count': 'Total count of distinct thermal cores entered and climbed.',
      'Thermal Avg (m/s)': 'Average climb rate inside thermal cores.',
      'Thermal Best (m/s)': 'Best climb rate inside thermal cores.',
      'Soar %': 'Percentage of flight time spent ridge soaring in figure-8 S-turns.',
      'Efficiency': 'Height gain (m) per km of soaring track.',
      'Glide %': 'Percentage of flight time spent in straight transitions between lift.',
      'Glide L/D': 'Realized net lift-to-drag glide ratio during transitions.',
      'Sink %': 'Percentage of flight time spent in heavy sink (< -2.5 m/s).',
      'Sink Time': 'Total duration spent in heavy sink zones or rotor.',
      'Validation Status': 'Automated heuristic check: Valid, Needs Review, or Invalid.',
      'Val: Reason': 'Specific heuristic violation message explaining review flag.',
      'Import File': 'Name of original source file imported.',
      'Import ID': 'Drive file ID or transaction ID of import batch.',
      'IGC Hash': 'MD5 content digest used for row-level duplicate detection (Internal System Key).',
      'Timestamp': 'UTC timestamp when this flight record was created or modified.',
      'Parser Ver': 'Version of IGC parser used to process telemetry.'
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
        cols: ['Import File', 'Import ID', 'Timestamp', 'Parser Ver'],
        editable: []
      },
      { 
        name: 'System', 
        visibleCols: 1, 
        collapsedRows: 1,
        color: '#CFD8DC', 
        cols: ['IGC Hash'],
        editable: []
      }
    ]
  },
  PILOT_PROFILE: {
    name: CFG.sheets.pilotProfile,
    color: '#00695C', // Deep Teal
    index: 3,
    headerRow: 3,
    frozenRows: 0,
    columns: ['Field', 'Value', 'Notes / Instructions']
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
  CONFIG: {
    name: CFG.sheets.config,
    color: '#FF9800', // Amber
    index: 6,
    headerRow: 2,
    frozenRows: 0,
    columns: ['Parameter', 'Value', 'Description']
  },
  ACTIVITY: {
    name: CFG.sheets.activityLogs || CFG.sheets.appLog,
    color: '#D32F2F', // Dark Red
    index: 7,
    headerRow: 2,
    frozenRows: 2,
    columns: ['Process', 'Timestamp', 'Activity / Event', 'Additional Info']
  },
  QUEUE: {
    name: CFG.sheets.queue,
    color: '#455A64', // Dark Slate Gray
    index: 8,
    headerRow: 1,
    frozenRows: 1,
    columns: ['Job ID', 'Type', 'Status', 'Progress', 'Started At', 'Updated At', 'Payload & State', 'Last Error']
  }
};

// Backwards compatibility aliases (legacy migration bridges)
TABS.PARAMETERS = TABS.CONFIG;      // Legacy migration bridge
TABS.LOOKUPS = TABS.CONFIG;         // Legacy migration bridge
TABS.APP_LOG = TABS.ACTIVITY;       // Legacy migration bridge
TABS.AUTOMATION_QUEUE = TABS.QUEUE; // Legacy migration bridge

// Extensible Process and Message Registries
CFG.LOG_PROCESSES = {
  WATCH_FOLDER:   'Watch Folder',
  BULK_INGEST:    'Bulk Ingestion',
  URL_IMPORT:     'URL / Drive Import',
  URL_CUSTOM:     'URL / Drive Import',
  FILE_UPLOAD:    'File Upload',
  MANUAL_ENTRY:   'Manual Flight Entry',
  MAINTENANCE:    'Flight Maintenance',
  DUPE_TRIAGE:    'Duplicate Triage',
  PURGE_FLIGHTS:  'Purge Flights',
  MASTER_RESYNC:  'Master Re-sync',
  SORT_LOGBOOK:   'Sort Logbook',
  SORT_FLIGHTS:   'Sort Logbook',
  SAVE_CONFIG:    'Save Config',
  LOAD_CONFIG:    'Load Config',
  SYSTEM_SETUP:   'System Setup',
  LOG_CLEAN:      'Log Maintenance',
  BACKGROUND_QUEUE: 'Background Queue',
  STATUS_CHANGE:  'Status Change',
  SYSTEM_MAINTENANCE: 'System Maintenance'
};

CFG.LOG_PREFIXES = {
  START:    '[START]',
  INFO:     '[INFO]',
  OK:       '[OK]',
  DUPE:     '[DUPE]',
  WARN:     '[WARN]',
  ERR:      '[ERR]',
  COMPLETE: '[COMPLETE]'
};

/* ==========================================================================================
   RESILIENT SHEET ID RESOLUTION (CR-SYS-009 / AUD-RES-003)
   ========================================================================================== */

/**
 * Registers a sheet's immutable integer SheetId into DocumentProperties.
 * This allows the system to locate the tab even if the user renames it in the UI.
 */
function registerSheetId_(ss, tabKey, sheet) {
  if (!sheet) return;
  try {
    var props = PropertiesService.getDocumentProperties();
    var id = String(sheet.getSheetId());
    props.setProperty('SHEET_ID_' + tabKey, id);
    props.setProperty('SHEET_NAME_' + tabKey, sheet.getName());
  } catch (e) {
    console.warn('Failed to register sheetId for ' + tabKey + ':', e.message);
  }
}

/**
 * Retrieves a sheet by its immutable integer SheetId, with fallback to name lookup.
 * Survives user tab renaming in Google Sheets UI.
 */
function getSheetByIdOrName_(ss, tabKey, defaultName) {
  if (!ss) ss = SpreadsheetApp.getActive();
  if (!ss) return null;
  
  var props = PropertiesService.getDocumentProperties();
  var propKey = 'SHEET_ID_' + tabKey;
  var savedId = props.getProperty(propKey);
  
  if (savedId !== null && savedId !== undefined && savedId !== '') {
    var numId = parseInt(savedId, 10);
    var allSheets = ss.getSheets();
    for (var i = 0; i < allSheets.length; i++) {
      if (allSheets[i].getSheetId() === numId) {
        if (allSheets[i].getName() !== defaultName) {
          props.setProperty('SHEET_NAME_' + tabKey, allSheets[i].getName());
        }
        return allSheets[i];
      }
    }
  }
  
  var sh = ss.getSheetByName(defaultName);
  if (sh) {
    registerSheetId_(ss, tabKey, sh);
  }
  return sh;
}

/* ==========================================================================================
   SYSTEM MANIFEST & DECOUPLED UPDATE PIPELINE (DSGN-MNT-001 Rev 2.0 / CR-SYS-006)
   ========================================================================================== */

var SYSTEM_MANIFEST = {
  version: '2.1.0',
  components: {
    // Flights
    'Flights.grid':        { version: 'v2.0-dim-2000x70',     tier: 'recommended' },
    'Flights.headers':     { version: 'v2.1-col-schema',       tier: 'mandatory' },
    'Flights.notes':       { version: 'v2.2-comprehensive-tooltips', tier: 'optional' },
    'Flights.validations': { version: 'v2.2-yn-closed-valid', tier: 'recommended' },
    'Flights.formulas':    { version: 'v2.1-flight-no-dynamic',tier: 'mandatory' },
    'Flights.guardrails':  { version: 'v2.2-formula-only',     tier: 'recommended' },

    // Dashboard
    'Dashboard.grid':      { version: 'v2.0-clean-bounds',     tier: 'recommended' },
    'Dashboard.formulas':  { version: 'v2.1-named-range-filter',tier: 'mandatory' },
    'Dashboard.guardrails':{ version: 'v2.1-card-soft-warn',   tier: 'recommended' },

    // Config
    'Config.grid':         { version: 'v2.0-dim-60x14',        tier: 'recommended' },
    'Config.headers':      { version: 'v2.0-config-headers',   tier: 'optional' },
    'Config.parameters':   { version: 'v2.1-param-merge',      tier: 'mandatory' },
    'Config.lookups':      { version: 'v2.2-yn-filter',        tier: 'mandatory' },
    'Config.namedRanges':  { version: 'v2.1-lookup-ranges',    tier: 'mandatory' },
    'Config.validations':  { version: 'v2.0-config-validation',tier: 'recommended' },
    'Config.guardrails':   { version: 'v2.1-lookup-soft-warn', tier: 'recommended' },

    // Equipment
    'Equipment.grid':      { version: 'v2.0-dim-100x13',       tier: 'recommended' },
    'Equipment.headers':   { version: 'v2.0-eq-schema',        tier: 'mandatory' },
    'Equipment.validations':{ version: 'v2.1-yn-dropdowns',   tier: 'recommended' },

    // Reference Sheets
    'Pilot_Profile.keys':  { version: 'v2.0-profile-fields',   tier: 'recommended' },
    'Automation_Queue.headers': { version: 'v2.0-queue-schema', tier: 'mandatory' },
    'Activity_Logs.headers':    { version: 'v2.0-log-schema',   tier: 'recommended' },
    'User_Guide.content':  { version: 'v2.0-guide-content',    tier: 'optional' }
  }
};

/**
 * Friendly display labels for manifest components
 */
var MANIFEST_COMPONENT_LABELS = {
  'Flights.grid': 'Grid Dimensions & Frozen Panes (2000x70, 4x4)',
  'Flights.headers': 'Row 3 Category Groupings & Row 4 Column Headers',
  'Flights.notes': 'Row 4 Column Tooltips & Field Notes',
  'Flights.validations': 'Dropdown Validations & Conditional Formatting',
  'Flights.formulas': 'Dynamic Flight No Formula Sequence (=ROW()-4)',
  'Flights.guardrails': 'Soft Guardrail Protections (Formula Sequence Only)',
  'Dashboard.grid': 'Grid Bounds & Clean Layout (6 Cols, 70 Rows)',
  'Dashboard.formulas': 'Dynamic Formulas, Queries & DASHBOARD_REVIEW_FILTER',
  'Dashboard.guardrails': 'Soft Guardrail Protections (KPI Cards & Lists)',
  'Config.grid': 'Grid Dimensions & Column Widths (60 Rows, 14 Cols)',
  'Config.headers': 'Header Banners & Section Separators',
  'Config.parameters': 'System Parameters (Preserving User Values)',
  'Config.lookups': 'Native Equipment Auto-Lookups (=SORT(FILTER()))',
  'Config.namedRanges': 'Workbook-Scoped Named Ranges (LOOKUP_*)',
  'Config.validations': 'Format & Setting Input Validations',
  'Config.guardrails': 'Soft Guardrail Protections (Lookups K3:N3)',
  'Equipment.grid': 'Grid Dimensions & Palette (100 Rows, 13 Cols)',
  'Equipment.headers': 'Equipment Schema Headers (Row 2)',
  'Equipment.validations': 'Category Dropdown Validation Rule',
  'Pilot_Profile.keys': 'Pilot Profile Fields & Descriptions',
  'Automation_Queue.headers': 'Background Automation Queue Schema',
  'Activity_Logs.headers': 'Activity Logs Schema & Header Formatting',
  'App_Log.headers': 'Activity Logs Schema & Header Formatting', // Legacy migration bridge
  'User_Guide.content': 'Documentation, Metric Dictionary & Instructions'
};

var MANIFEST_SHEET_METADATA = {
  'Flights': { key: 'FLIGHTS', name: TABS.FLIGHTS ? TABS.FLIGHTS.name : 'Flights', icon: '🛫', color: '#4CAF50' },
  'Dashboard': { key: 'DASHBOARD', name: TABS.DASHBOARD ? TABS.DASHBOARD.name : 'Dashboard', icon: '📊', color: '#2196F3' },
  'Config': { key: 'CONFIG', name: TABS.CONFIG ? TABS.CONFIG.name : 'Config', icon: '⚙️', color: '#FF9800' },
  'Equipment': { key: 'EQUIPMENT', name: TABS.EQUIPMENT ? TABS.EQUIPMENT.name : 'Equipment', icon: '🪂', color: '#00BCD4' },
  'Pilot_Profile': { key: 'PILOT_PROFILE', name: TABS.PILOT_PROFILE ? TABS.PILOT_PROFILE.name : 'Pilot_Profile', icon: '👤', color: '#9C27B0' },
  'Automation_Queue': { key: 'QUEUE', name: TABS.QUEUE ? TABS.QUEUE.name : 'Automation_Queue', icon: '📋', color: '#455A64' },
  'Activity_Logs': { key: 'ACTIVITY_LOGS', name: TABS.ACTIVITY ? TABS.ACTIVITY.name : 'Activity Logs', icon: '📜', color: '#D32F2F' },
  'App_Log': { key: 'ACTIVITY_LOGS', name: TABS.ACTIVITY ? TABS.ACTIVITY.name : 'Activity Logs', icon: '📜', color: '#D32F2F' }, // Legacy migration bridge
  'User_Guide': { key: 'USER_GUIDE', name: TABS.USER_GUIDE ? TABS.USER_GUIDE.name : 'User Guide', icon: '📖', color: '#607D8B' }
};

/**
 * Retrieves the applied manifest state from DocumentProperties.
 * @return {Object} Dictionary of componentKey -> appliedVersionTag
 */
function getAppliedManifest_() {
  try {
    var raw = PropertiesService.getDocumentProperties().getProperty('APPLIED_MANIFEST');
    if (raw) {
      var parsed = JSON.parse(raw);
      if (parsed['App_Log.headers'] && !parsed['Activity_Logs.headers']) { // Legacy migration bridge
        parsed['Activity_Logs.headers'] = parsed['App_Log.headers']; // Legacy migration bridge
      }
      return parsed;
    }
  } catch (e) {
    console.warn('Error reading APPLIED_MANIFEST:', e);
  }
  return {};
}

/**
 * Persists the applied manifest state into DocumentProperties.
 * @param {Object} manifest - Dictionary of componentKey -> appliedVersionTag
 */
function setAppliedManifest_(manifest) {
  try {
    PropertiesService.getDocumentProperties().setProperty('APPLIED_MANIFEST', JSON.stringify(manifest || {}));
  } catch (e) {
    console.warn('Error saving APPLIED_MANIFEST:', e);
  }
}

/**
 * Compares SYSTEM_MANIFEST against APPLIED_MANIFEST and generates
 * a hierarchical diff structure grouped by Sheet with rollup status and criticality tiers.
 * @param {Object} [optApplied] - Optional custom applied manifest override for testing
 * @return {Object} Detailed diff analysis
 */
function diffManifests_(optApplied) {
  var applied = optApplied || getAppliedManifest_();
  // Bridge legacy App_Log.headers in optApplied (migration bridge)
  if (applied['App_Log.headers'] && !applied['Activity_Logs.headers']) { // Legacy migration bridge
    applied['Activity_Logs.headers'] = applied['App_Log.headers']; // Legacy migration bridge
  }
  var sheetsMap = {};
  var order = ['Flights', 'Dashboard', 'Config', 'Equipment', 'Pilot_Profile', 'Automation_Queue', 'Activity_Logs', 'User_Guide'];
  
  order.forEach(function(sName) {
    var meta = MANIFEST_SHEET_METADATA[sName] || { key: sName, name: sName.replace('_', ' '), icon: '📄', color: '#757575' };
    sheetsMap[sName] = {
      sheetKey: sName,
      sheetName: meta.name,
      icon: meta.icon,
      color: meta.color,
      allUpToDate: true,
      pendingCount: 0,
      totalCount: 0,
      components: []
    };
  });

  var totalComponents = 0;
  var totalPending = 0;
  var mandatoryPending = 0;
  var recommendedPending = 0;
  var optionalPending = 0;

  for (var key in SYSTEM_MANIFEST.components) {
    if (!SYSTEM_MANIFEST.components.hasOwnProperty(key)) continue;
    totalComponents++;
    var parts = key.split('.');
    var sName = parts[0];
    var cType = parts[1];
    var compDef = SYSTEM_MANIFEST.components[key];
    var latest = (typeof compDef === 'object' && compDef.version) ? compDef.version : compDef;
    var tier = (typeof compDef === 'object' && compDef.tier) ? compDef.tier : 'recommended';
    var currRaw = applied[key];
    var curr = (typeof currRaw === 'object' && currRaw !== null && currRaw.version) ? currRaw.version : (currRaw || 'Not Applied');
    var isUpToDate = (curr === latest);

    if (!isUpToDate) {
      totalPending++;
      if (tier === 'mandatory') mandatoryPending++;
      else if (tier === 'optional') optionalPending++;
      else recommendedPending++;
    }

    if (sheetsMap[sName]) {
      sheetsMap[sName].totalCount++;
      if (!isUpToDate) {
        sheetsMap[sName].allUpToDate = false;
        sheetsMap[sName].pendingCount++;
      }
      sheetsMap[sName].components.push({
        key: key,
        type: cType,
        tier: tier,
        label: MANIFEST_COMPONENT_LABELS[key] || (sName + ' ' + cType),
        applied: curr,
        latest: latest,
        isUpToDate: isUpToDate
      });
    }
  }

  var sheetsList = order.map(function(sName) {
    return sheetsMap[sName];
  });

  return {
    systemVersion: SYSTEM_MANIFEST.version,
    totalComponents: totalComponents,
    pendingCount: totalPending,
    mandatoryPending: mandatoryPending,
    recommendedPending: recommendedPending,
    optionalPending: optionalPending,
    allUpToDate: (totalPending === 0),
    sheets: sheetsList
  };
}

/**
 * Returns active configuration parameters and layout preferences for JSON download.
 */
function getConfigExportPayload_() {
  var ss = SpreadsheetApp.getActive();
  var params = getParameters_();
  return {
    exportedAt: new Date().toISOString(),
    spreadsheetName: ss ? ss.getName() : 'Flight Log',
    version: SYSTEM_MANIFEST.version,
    parameters: params
  };
}


