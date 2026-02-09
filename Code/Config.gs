/**
 * Paragliding Flight Log v2.0
 * Updated: 2026-02-08 20:38:56
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
  defaults: {
    WATCH_PERIOD_MIN: 15,
    OSM_RADIUS_M: 3000,
    REVGEO_PROVIDER: 'nominatim',
    NATIONAL_BONUS_WITHIN_PCT: 5,
    NATIONAL_BONUS_MULTIPLIER: 1.2,
    
    // Flight Mode Defaults
    THERMAL_MIN_CLIMB: 0.3,
    THERMAL_MIN_TURN: 8,
    SOAR_TURN_MAX: 5,
    SOAR_VARIO_MIN: -0.2,
    SOAR_VARIO_MAX: 1.5,
    GLIDE_TURN_MAX: 5,
    GLIDE_LD_TOL_PCT: 30,
    GLIDE_VARIO_MAX: 0.2,
    SINK_TURN_MAX: 10,
    SINK_VARIO: -2.5,
    
    // Analysis Windows
    MODE_WINDOW_SEC: 10,
    REVERSAL_WINDOW_SEC: 30,
    MODE_HYSTERESIS_SEC: 6,

    // Validation Thresholds
    VALIDATION_MIN_DURATION_SEC: 120,
    VALIDATION_MIN_HEIGHT_CHANGE_M: 20,
    VALIDATION_MAX_SPEED_KMH: 120,
    VALIDATION_MAX_AVG_SPEED_KMH: 60,

    FLIGHT_TYPES: 'Free Fly, XC, Soaring, Comp, SIV / Maneuvers, Training, Other',
    DATE_FORMAT: 'yyyy-MM-dd',
    TIME_FORMAT: 'HH:mm:ss'
  }
};

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
      { name: 'Flight Info', color: '#F5F5F5', cols: ['FlightID', 'Status', 'Flight No', 'Auto Summary', 'Notes', 'Flight Type', 'Date', 'Time Zone', 'Launch Time', 'Landing Time', 'Flight Duration', 'Track Length (km)', 'Straight Dist (km)'] },
      { name: 'Gear', color: '#FFF9C4', cols: ['Wing', 'Harness', 'Reserve 1', 'Reserve 2', 'Other equipment', 'GlideRatio_LD (snap)', 'Trim_kmh (snap)', 'FullBar_kmh (snap)'] },
      { name: 'XC Scoring', color: '#FFCCBC', cols: ['XC Distance (km)', 'XC Score', 'XC Flight Class', 'FAI Triangle (km)', 'Points (World)', 'Points (National)', 'Closed?', 'Max Alt (m)', 'Min Alt (m)', 'Total Height Gain (m)', 'Max Ascent (m/s)', 'Max Descent (m/s)', 'Max Groundspeed (km/h)', 'Avg Groundspeed (km/h)'] },
      { name: 'Launch', color: '#C8E6C9', cols: ['Launch Alt (m)', 'Launch Lat', 'Launch Lon', 'Launch Site', 'Launch Town', 'Launch Country', 'Launch Region'] },
      { name: 'Landing', color: '#DCEDC8', cols: ['Landing Alt (m)', 'Landing Lat', 'Landing Lon', 'Landing Site', 'Landing Town', 'Landing Country', 'Landing Region', 'Launch-Landing Dist (km)'] },
      { name: 'Weather', color: '#E1F5FE', cols: ['Wind@Launch', 'Wind@Landing', 'Cloud %', 'Cloudbase', 'Temp (C)', 'Observations'] },
      { name: 'Analytics', color: '#E1BEE7', cols: ['Thermal %', 'Thermals Count', 'Thermal Avg (m/s)', 'Thermal Best (m/s)', 'Soar %', 'Efficiency', 'Glide %', 'Glide L/D', 'Sink %', 'Sink Time'] },
      { name: 'Validation', color: '#FFCDD2', cols: ['Validation Status', 'Val: Reason'] },
      { name: 'Meta', color: '#CFD8DC', cols: ['Import File', 'Import ID', 'Timestamp', 'Parser Ver'] }
    ]
  },
  EQUIPMENT: {
    name: CFG.sheets.equipment,
    color: '#2196F3', // Blue
    index: 3,
    headerRow: 2,
    dataStartRow: 3,
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
