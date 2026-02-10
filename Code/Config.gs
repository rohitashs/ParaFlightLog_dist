/**
 * Paragliding Flight Log v2.0
 * Updated: 2026-02-09 18:06:12
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
    overview: 'Overview'
  },
  // Centralized Parameter Definitions (Source of Truth for Parameters Sheet)
  parameters: [
    // Ingestion
    { section: 'Ingestion', key: 'WATCH_FOLDER_ID', val: '', desc: 'Google Drive Folder ID to watch for .igc files', input: true },
    { section: 'Ingestion', key: 'UPLOAD_FOLDER_ID', val: '', desc: 'Google Drive Folder ID for manual uploads', input: true },
    { section: 'Ingestion', key: 'ENABLE_WATCH_FOLDER', val: 'FALSE', desc: 'Enable automated scanning? (TRUE/FALSE)' },
    { section: 'Ingestion', key: 'WATCH_PERIOD_MIN', val: 15, desc: 'How often (mins) the trigger runs' },
    
    // Geo & Time
    { section: 'Geo & Time', key: 'GEO_REV_PROVIDERS', val: 'nominatim_osm, big_data_cloud', desc: 'Reverse Geo Providers (comma-sep)' },
    { section: 'Geo & Time', key: 'GEO_SITE_PROVIDERS', val: 'overpass_api', desc: 'Site Name Providers' },
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
    { section: 'Lists', key: 'FLIGHT_TYPES', val: 'Free Fly, XC, Soaring, Comp, SIV / Maneuvers, Training, Other', desc: 'Flight Type Dropdown Options' },
    { section: 'Lists', key: 'DATE_FORMAT', val: 'yyyy-MM-dd', desc: 'Date Display Format' },
    { section: 'Lists', key: 'TIME_FORMAT', val: 'HH:mm:ss', desc: 'Time Display Format' }
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

/* ==========================================================================================
   TAB DEFINITIONS
   ========================================================================================== */

var TABS = {
  OVERVIEW: {
    name: CFG.sheets.overview,
    color: '#9E9E9E', // Grey
    index: 1,
    headerRow: 1,
    frozenRows: 0
  },
  FLIGHTS: {
    name: CFG.sheets.flights,
    color: '#4CAF50', // Green
    index: 2,
    headerRow: 5, // Data starts after this
    dataStartRow: 5, 
    dataEndRow: 15, // Optimization: Only apply dropdowns to top 15 rows initially
    frozenRows: 4,
    groups: [
      { name: 'Flight Info', visibleCols: 4, color: '#F5F5F5', cols: ['FlightID', 'Status', 'Flight No', 'Auto Summary', 'Notes', 'Flight Type', 'Date', 'Time Zone', 'Launch Time', 'Landing Time', 'Flight Duration', 'Track Length (km)', 'Straight Dist (km)'] },
      { name: 'Gear', visibleCols: 1, color: '#FFF9C4', cols: ['Wing', 'Harness', 'Reserve 1', 'Reserve 2', 'Other equipment', 'GlideRatio_LD (snap)', 'Trim_kmh (snap)', 'FullBar_kmh (snap)'] },
      { name: 'XC Scoring', visibleCols: 1, color: '#FFCCBC', cols: ['XC Distance (km)', 'XC Score', 'XC Flight Class', 'FAI Triangle (km)', 'Points (World)', 'Points (National)', 'Closed?', 'Max Alt (m)', 'Min Alt (m)', 'Total Height Gain (m)', 'Max Ascent (m/s)', 'Max Descent (m/s)', 'Max Groundspeed (km/h)', 'Avg Groundspeed (km/h)'] },
      { name: 'Launch', visibleCols: 1, color: '#C8E6C9', cols: ['Launch Alt (m)', 'Launch Lat', 'Launch Lon', 'Launch Site', 'Launch Town', 'Launch Country', 'Launch Region'] },
      { name: 'Landing', visibleCols: 1, color: '#DCEDC8', cols: ['Landing Alt (m)', 'Landing Lat', 'Landing Lon', 'Landing Site', 'Landing Town', 'Landing Country', 'Landing Region', 'Launch-Landing Dist (km)'] },
      { name: 'Weather', visibleCols: 1, color: '#E1F5FE', cols: ['Wind@Launch', 'Wind@Landing', 'Cloud %', 'Cloudbase', 'Temp (C)', 'Observations'] },
      { name: 'Analytics', visibleCols: 1, color: '#E1BEE7', cols: ['Thermal %', 'Thermals Count', 'Thermal Avg (m/s)', 'Thermal Best (m/s)', 'Soar %', 'Efficiency', 'Glide %', 'Glide L/D', 'Sink %', 'Sink Time'] },
      { name: 'Validation', visibleCols: 1, color: '#FFCDD2', cols: ['Validation Status', 'Val: Reason'] },
      { name: 'Meta', visibleCols: 1, color: '#CFD8DC', cols: ['Import File', 'Import ID', 'Timestamp', 'Parser Ver'] }
    ]
  },
  EQUIPMENT: {
    name: CFG.sheets.equipment,
    color: '#2196F3', // Blue
    index: 3,
    headerRow: 2,
    dataStartRow: 3,
    dataEndRow: 50, // Limit validation/formatting to 50 rows
    frozenRows: 2,
    columns: ['Category', 'EquipmentID', 'Make', 'Model', 'Size', 'Type', 'Default?', 'Retired?', 'Glide', 'Trim', 'Full', 'Link', 'Notes']
  },
  PARAMETERS: {
    name: CFG.sheets.parameters,
    color: '#FFEB3B', // Yellow
    index: 4,
    headerRow: 2,
    frozenRows: 0,
    columns: ['Parameter', 'Value', 'Description']
  },
  LOOKUPS: {
    name: CFG.sheets.lookups,
    color: '#FF9800', // Orange
    index: 5,
    headerRow: 2,
    frozenRows: 0,
    columns: ['Categories', 'Wings (Auto)', 'Harnesses (Auto)', 'Reserves (Auto)', 'Other (Auto)', 'Flight Status', 'Flight Type']
  },
  APP_LOG: {
    name: CFG.sheets.appLog,
    color: '#F44336', // Red
    index: 6,
    headerRow: 2,
    frozenRows: 2,
    columns: ['Timestamp', 'FileID', 'FileName', 'InnerName', 'Status', 'Notes']
  }
};
