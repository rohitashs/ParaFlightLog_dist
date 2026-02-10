/***********************************************
 * Paragliding Flight Log — Single Paste Script
 * Clean baseline (Status first, Flight No + Auto Summary, Lookups header-aware)
 * Last updated: 2025-10-15
 * Features:
 *  - Parses IGC/IGX (plain, .gz, .zip) from Drive or URL
 *  - Inserts new flight at row 6 in the Flights sheet (headers on row 5)
 *  - Reverse geocodes country/town (Nominatim default)
 *  - Finds nearest paragliding launch/landing via OSM Overpass
 *  - Computes track length, times, alt/speed stats
 *  - Classifies flight modes: Thermal / Soar / Glide / Sink
 *  - XContest-style scoring (Free / Flat / FAI triangle) + National bonus
 *  - Watched folder: scans for new files; dedupe; one row per inner IGC if ZIP
 *  - Manual: add from Drive URL/ID (supports .igc/.igx/.gz/.zip)
 *  - Equipment defaults: copy Wing/Harness/Reserve1/Reserve2 from previous row
 *  - Wing from IGC if present, else previous row; validated against master lists

 ***********************************************/

/** ========= CONFIG ========= */
var CFG = {
  sheets: {
    flights: 'Flights',
    wings: 'Equipment_Wings',
    harnesses: 'Equipment_Harnesses',
    reserves: 'Equipment_Reserves',
    lookups: 'Lookups',
    importLog: 'Import_Log',
    sites: 'Sites',           // optional / not required
    raw: 'Raw_Imports'        // optional / not required
  },
  defaultWatchPeriodMin: 15,
  defaultOsmRadiusM: 3000,
  contactEmail: 'you@example.com',
  revgeoProvider: 'nominatim', // or 'opencage' | 'geonames'
  modeWindowSec: 10,
  reversalWindowSec: 30,
  modeHysteresisSec: 6,
  national: { closedWithinPct: 5, bonusMultiplier: 1.2 },
  thresholds: {
    THERMAL_MIN_CLIMB: 0.3,
    THERMAL_MIN_TURN: 8,
    SOAR_TURN_MAX: 5,
    SOAR_VARIO_MIN: -0.2,
    SOAR_VARIO_MAX: 1.5,
    GLIDE_TURN_MAX: 5,
    GLIDE_LD_TOL_PCT: 30,
    GLIDE_VARIO_MAX: 0.2,
    SINK_TURN_MAX: 10,
    SINK_VARIO: -2.5
  },
  flightTypes: ['Free Fly','XC','Soaring','Comp','SIV / Maneuvers','Training','Other']
};

/** ========= HEADERS ========= */
/* Basic: Status, Flight No, Auto Summary, FlightID, Date, Launch Time, Flight Type, Duration, Track Len, Straight */
var HEADERS = {
  basic: [
    'Status',
    'Flight No',
    'Auto Summary',
    'FlightID',
    'Date',
    'Launch Time',
    'Flight Type',
    'Flight Duration (hh:mm:ss)',
    'Track Length (km)',
    'Straight Start→Finish (km)'
  ],
  gear: [
    'Wing','Harness','Reserve 1','Reserve 2','Other equipment',
    'GlideRatio_LD (snap)','Trim_kmh (snap)','FullBar_kmh (snap)'
  ],
  stats: [
    'XC Distance (km)','Flat Triangle (km)','FAI Triangle (km)',
    'XContest Points (World)','XContest Points (National)','XC Flight Class','Closed?',
    'Max Alt (m)','Min Alt (m)','Total Height Gain (m)',
    'Max Ascent (m/s)','Max Descent (m/s)',
    'Max Groundspeed (km/h)','Avg Groundspeed (km/h)'
  ],
  launch: [
  'Launch Lat','Launch Lon','Launch Site','Launch Nearest Town','Launch Country','Launch Region',
  'Launch Alt (m)','Launch Time'
  ],
  landing: [
  'Landing Lat','Landing Lon','Landing Site','Landing Nearest Town','Landing Country','Landing Region',
  'Landing Alt (m)','Landing Time','Launch↔Landing (km)'
  ],
  weather: [
    'Wind@Launch Dir (°)','Wind@Launch Avg (kt)','Wind@Launch Gust (kt)',
    'Wind@Landing Dir (°)','Wind@Landing Avg (kt)','Wind@Landing Gust (kt)',
    'Cloud %','Cloudbase (m MSL)','Top of lift (m MSL)',
    'Temp Launch (°C)','Temp Landing (°C)','Observations'
  ],
  analytics: [
    'Time Thermal (min)','Time Soar (min)','Time Glide (min)','Time Sink (min)',
    'Thermals Count','Thermal Avg Climb (m/s)','Thermal Longest (min)','Thermal Best (m/s)','Thermal Total Gain (m)',
    'Soar Time (min)','Soar Distance (km)','Soar Net Gain (m)','Soar Passes (#)','Soar Mean Leg (km)','Soar Efficiency (m/km)',
    'Glide Median L/D','Glide p90 L/D','Glide Best L/D','Glide Mean GS (km/h)',
    'Sink Time < -3 (min)','Sink Worst 5s (m/s)'
  ],
  meta: [
    'IGC file name','IGC Drive ID','IGC URL',
    'Import timestamp','Parser version','Rev-geo provider','OSM radius (m)','Watch Folder ID'
  ]
};

/** ========= MENU ========= */
function onOpen(e){
  try{
    SpreadsheetApp.getUi()
      .createMenu('Flight Log')
      .addItem('Add flight from IGC (Drive URL/ID or upload)…', 'uiAddFlightFromIgc_')
      .addItem('Add blank flight row', 'uiAddBlankFlight_')
      .addSeparator()
      .addItem('Scan Watch Folder now', 'scanWatchFolderNow_')
      .addItem('Open Import Log', 'openImportLog_')
      .addSeparator()
      .addItem('Recompute selected flight(s)', 'uiRecomputeSelected_')
      .addItem('Settings / Lookups', 'openLookups_')
      .addSeparator()
      .addItem('Scaffold: Create tabs & headers', 'scaffoldAll_')
      .addItem('Scaffold: Flights headers only', 'scaffoldFlightsHeaders_')
      .addItem('Scaffold: Equipment headers only', 'scaffoldEquipmentHeaders_')
      .addItem('Scaffold: Lookups seed data', 'scaffoldLookupsSeed_')
      .addItem('Scaffold: Import_Log headers', 'scaffoldImportLog_')
      .addSeparator()
      .addItem('Setup 5-min watcher trigger', 'setupWatcherTrigger_')
      .addSeparator()
      .addItem('Debug: Clear dedupe cache (all)', 'debugClearAllDedupe_')
      .addItem('Debug: Clear dedupe for 1 file…', 'debugClearDedupeForOne_')
      .addItem('Debug: Reset watcher throttle', 'debugResetWatcherThrottle_')
      .addToUi();
  } catch(_) {}
}

/** ========= UTILITIES (math/time/etc) ========= */
function extractDriveId_(s){
  var m = String(s||'').match(/[-\w]{25,}/);
  return m?m[0]:null;
}
function igcDateToIso_(dd,mm,yy){
  var d=+dd,m=+mm,y=+yy; y=(y<80)?2000+y:1900+y;
  var dt=new Date(Date.UTC(y,m-1,d));
  return Utilities.formatDate(dt,'UTC','yyyy-MM-dd');
}
function dmToDec_(degStr,minStr,thouStr,hemi,isLat){
  var deg=parseInt(degStr,10);
  var minutes=parseInt(minStr,10)+parseInt(thouStr||'0',10)/1000.0;
  var dec=deg+minutes/60.0;
  if (hemi==='S'||hemi==='W') dec=-dec;
  if (isLat){ if (dec>90||dec<-90) return ''; }
  else { if (dec>180||dec<-180) return ''; }
  return dec;
}
function toIntSafe_(s){
  var n=parseInt(String(s||'').replace(/[^\d-]/g,''),10);
  return isNaN(n)?NaN:n;
}
function haversineM_(lat1,lon1,lat2,lon2){
  var R=6371000,toRad=Math.PI/180;
  var dLat=(lat2-lat1)*toRad, dLon=(lon2-lon1)*toRad;
  var s1=Math.sin(dLat/2), s2=Math.sin(dLon/2);
  var a=(s1*s1)+Math.cos(lat1*toRad)*Math.cos(lat2*toRad)*(s2*s2);
  return 2*R*Math.atan2(Math.sqrt(a),Math.sqrt(1-a));
}
function bearingDeg_(lat1,lon1,lat2,lon2){
  var toR=Math.PI/180,toD=180/Math.PI;
  var f1=lat1*toR,f2=lat2*toR, l1=lon1*toR, l2=lon2*toR;
  var y=Math.sin(l2-l1)*Math.cos(f2);
  var x=Math.cos(f1)*Math.sin(f2)-Math.sin(f1)*Math.cos(f2)*Math.cos(l2-l1);
  var brg=(Math.atan2(y,x)*toD+360)%360;
  return brg;
}
function toKm_(m){ return m/1000.0; }
function round_(v,p){ if(typeof v!=='number'||!isFinite(v))return v; var mul=Math.pow(10,p); return Math.round(v*mul)/mul; }
function avg_(arr){ if(!arr.length) return 0; var s=0; for (var i=0;i<arr.length;i++) s+=arr[i]; return s/arr.length; }
function median_(a){ if(!a.length) return 0; var b=a.slice().sort(function(x,y){return x-y;}); var n=b.length; return (n%2)?b[(n-1)/2]:(b[n/2-1]+b[n/2])/2; }
function percentile_(a,p){ if(!a.length) return 0; var b=a.slice().sort(function(x,y){return x-y;}); var idx=Math.floor(p*(b.length-1)); return b[idx]; }
function fmtHMS_(s){ s=Math.max(0,Math.floor(s)); var h=Math.floor(s/3600),m=Math.floor((s%3600)/60),ss=s%60; function pad(x){return(''+x).padStart(2,'0');} return pad(h)+':'+pad(m)+':'+pad(ss); }
function fmtHhMm_(s){ s=Math.max(0,Math.floor(s)); var h=Math.floor(s/3600),m=Math.floor((s%3600)/60); return h+'h '+(''+m).padStart(2,'0')+'m'; }

function computeKinematics_(fixes){
  if (!fixes || fixes.length < 2) return null;
  var totalGain = 0, maxClimb = -1e9, maxSink = 1e9, maxGs = 0, distSum = 0, timeSum = 0;

  for (var i=1;i<fixes.length;i++){
    var f0=fixes[i-1], f1=fixes[i];
    var dt = Math.max(1, f1.t - f0.t);
    var dz = f1.alt - f0.alt;
    if (dz > 0) totalGain += dz;
    var climb = dz / dt;                  // m/s
    if (climb > maxClimb) maxClimb = climb;
    if (climb < maxSink)  maxSink  = climb;

    var d = haversineM_(f0.lat,f0.lon,f1.lat,f1.lon);
    var gs = (d / dt) * 3.6;              // km/h
    if (gs > maxGs) maxGs = gs;
    distSum += d; timeSum += dt;
  }

  return {
    totalGain: totalGain,
    maxAscent: maxClimb,                  // m/s
    maxDescent: maxSink,                  // m/s (negative)
    maxGsKmh: maxGs,
    avgGsKmh: timeSum ? (distSum / timeSum) * 3.6 : 0
  };
}


/** ========= LOOKUPS (header-aware + cached) ========= */
function getLookups_(){
  var ss=SpreadsheetApp.getActive();
  var sh=ss.getSheetByName(CFG.sheets.lookups);
  var obj=JSON.parse(PropertiesService.getDocumentProperties().getProperty('LOOKUPS_CACHE')||'{}');

  if (sh){
    var last=sh.getLastRow();
    if (last>=1){
      var startRow=1;
      try{
        var h=sh.getRange(1,1,1,2).getValues()[0];
        var h0=String(h[0]||'').toLowerCase(), h1=String(h[1]||'').toLowerCase();
        if (h0.indexOf('parameter')===0 && h1.indexOf('value')===0) startRow=2;
      }catch(e){}

      if (last>=startRow){
        var vals=sh.getRange(startRow,1,last-startRow+1,2).getValues();
        for (var i=0;i<vals.length;i++){
          var k=String(vals[i][0]||'').trim(); if (!k) continue;
          obj[k]=vals[i][1];
        }
      }
    }
  }
  // Defaults
  obj['OSM_RADIUS_M'] = Number(obj['OSM_RADIUS_M']||CFG.defaultOsmRadiusM);
  obj['WATCH_PERIOD_MIN'] = Number(obj['WATCH_PERIOD_MIN']||CFG.defaultWatchPeriodMin);
  obj['NATIONAL_BONUS_WITHIN_PCT'] = Number(obj['NATIONAL_BONUS_WITHIN_PCT']||CFG.national.closedWithinPct);
  obj['NATIONAL_BONUS_MULTIPLIER'] = Number(obj['NATIONAL_BONUS_MULTIPLIER']||CFG.national.bonusMultiplier);
  obj['CONTACT_EMAIL'] = String(obj['CONTACT_EMAIL']||CFG.contactEmail);
  obj['REVGEO_PROVIDER'] = String(obj['REVGEO_PROVIDER']||CFG.revgeoProvider);
  Object.keys(CFG.thresholds).forEach(function(k){ obj[k]=Number(obj[k]||CFG.thresholds[k]); });
  obj['MODE_WINDOW_SEC']=Number(obj['MODE_WINDOW_SEC']||CFG.modeWindowSec);
  obj['REVERSAL_WINDOW_SEC']=Number(obj['REVERSAL_WINDOW_SEC']||CFG.reversalWindowSec);
  obj['MODE_HYSTERESIS_SEC']=Number(obj['MODE_HYSTERESIS_SEC']||CFG.modeHysteresisSec);
  if (obj['FLIGHT_TYPES']){
    var arr=String(obj['FLIGHT_TYPES']).split(',').map(function(s){return s.trim();}).filter(String);
    obj['FLIGHT_TYPES_LIST']=arr.length?arr:CFG.flightTypes.slice();
  } else obj['FLIGHT_TYPES_LIST']=CFG.flightTypes.slice();

  PropertiesService.getDocumentProperties().setProperty('LOOKUPS_CACHE', JSON.stringify(obj));
  return obj;
}

/** ========= HEADER FORMATTING ========= */
var HEADER_BORDER_COLOR='#5F6368';
var HEADER_BG_LIGHTGREY='#F2F3F5';
function applyThinBorders_(range){
  range.setBorder(true,true,true,true,true,true,HEADER_BORDER_COLOR,SpreadsheetApp.BorderStyle.SOLID);
}
function applyHeaderTextStyle_(range){
  range.setFontWeight('bold').setFontSize(10).setFontColor('#202124').setVerticalAlignment('middle').setWrap(true);
  range.getSheet().setRowHeight(range.getRow(),36);
}
function formatSimpleHeaderRow_(sheet, headerRow, colCount){
  var rng=sheet.getRange(headerRow,1,1,colCount);
  rng.setBackground(HEADER_BG_LIGHTGREY);
  applyThinBorders_(rng); applyHeaderTextStyle_(rng);
}
function applyDataBanding_(sh, firstDataRow, colCount){
  var bands=sh.getBandings(); for (var i=0;i<bands.length;i++) bands[i].remove();
  var last=Math.max(firstDataRow, sh.getMaxRows());
  if (colCount>0 && last>=firstDataRow){
    sh.getRange(firstDataRow,1,last-firstDataRow+1,colCount)
      .applyRowBanding(SpreadsheetApp.BandingTheme.LIGHT_GREY)
      .setFirstRowColor('#FFFFFF').setSecondRowColor('#FAFBFC');
  }
}
function colorizeFlightsHeader_(sheet, headerRow, colStart, buckets){
  var COLORS={
    basic:'#F2F3F5',
    gear:'#E8F0FE',
    stats:'#E6F4EA',
    launch:'#FFF7CC',
    landing:'#FFE8D5',
    weather:'#FCE8E6',
    analytics:'#EDE7F6',
    meta:'#E0F2F1'
  };
  var c=colStart;
  buckets.forEach(function(b){
    var len=b.len; if (len<=0) return;
    var rng=sheet.getRange(headerRow,c,1,len);
    rng.setBackground(COLORS[b.key]||HEADER_BG_LIGHTGREY);
    applyThinBorders_(rng); applyHeaderTextStyle_(rng); c+=len;
  });
}
function applyStatusFormatting_(){
  var ss=SpreadsheetApp.getActive(), sh=ss.getSheetByName(CFG.sheets.flights);
  var col=getColumnMap_(); var c=col['Status']; if(!c) return;
  var rules=sh.getConditionalFormatRules().filter(function(r){
    var rgs=r.getRanges(); for (var i=0;i<rgs.length;i++) if (rgs[i].getColumn()===c) return false; return true;
  });
  var last=Math.max(6,sh.getMaxRows()); var rng=sh.getRange(6,c,last-5,1);
  function ruleEq(txt,bg){ return SpreadsheetApp.newConditionalFormatRule().whenTextEqualTo(txt).setBackground(bg).setRanges([rng]).build(); }
  var pastel={ ok:'#E6F4EA', review:'#FFF7CC', possDup:'#FFE8D5', likelyDup:'#FDE7E9', fetchFail:'#FCE8E6', parseFail:'#F9DDE0', noFile:'#EEEEEE' };
  rules.push(ruleEq('OK',pastel.ok));
  rules.push(ruleEq('Needs review',pastel.review));
  rules.push(ruleEq('Possible duplicate',pastel.possDup));
  rules.push(ruleEq('Likely duplicate',pastel.likelyDup));
  rules.push(ruleEq('Fetch fail',pastel.fetchFail));
  rules.push(ruleEq('Parse fail',pastel.parseFail));
  rules.push(ruleEq('No file',pastel.noFile));
  sh.setConditionalFormatRules(rules);
}

/** ========= SCAFFOLD HELPERS ========= */
function ensureSheet_(name){ var ss=SpreadsheetApp.getActive(); return ss.getSheetByName(name)||ss.insertSheet(name); }
function scaffoldAll_(){ scaffoldFlightsHeaders_(); scaffoldEquipmentHeaders_(); scaffoldLookupsSeed_(); scaffoldImportLog_(); applyGearValidations_(); SpreadsheetApp.getActive().toast('Scaffold complete.'); }
function scaffoldFlightsHeaders_(){
  var sh=ensureSheet_(CFG.sheets.flights);
  var all=HEADERS.basic.concat(HEADERS.gear,HEADERS.stats,HEADERS.launch,HEADERS.landing,HEADERS.weather,HEADERS.analytics,HEADERS.meta);
  if (sh.getMaxRows()<5) sh.insertRows(1,5-sh.getMaxRows());
  sh.getRange(5,1,1,all.length).setValues([all]);
  sh.setFrozenRows(5);

  var buckets=[
    {key:'basic',len:HEADERS.basic.length},
    {key:'gear',len:HEADERS.gear.length},
    {key:'stats',len:HEADERS.stats.length},
    {key:'launch',len:HEADERS.launch.length},
    {key:'landing',len:HEADERS.landing.length},
    {key:'weather',len:HEADERS.weather.length},
    {key:'analytics',len:HEADERS.analytics.length},
    {key:'meta',len:HEADERS.meta.length}
  ];
  colorizeFlightsHeader_(sh,5,1,buckets);
  applyDataBanding_(sh,6,all.length);

  // Flight Type dropdown
  var col=getColumnMap_(); var ftCol=col['Flight Type'];
  if (ftCol){
    var look=getLookups_(); var list=look['FLIGHT_TYPES_LIST']||CFG.flightTypes;
    var rule=SpreadsheetApp.newDataValidation().requireValueInList(list,true).build();
    sh.getRange(6,ftCol,Math.max(1,sh.getMaxRows()-5),1).setDataValidation(rule);
  }
  applyStatusFormatting_();
  SpreadsheetApp.getActive().toast('Flights headers created & formatted.');
}
function scaffoldEquipmentHeaders_(){
  var sw=ensureSheet_(CFG.sheets.wings), shh=ensureSheet_(CFG.sheets.harnesses), sr=ensureSheet_(CFG.sheets.reserves);
  var wh=['WingID','Make','Model','Size','Year','GlideRatio_LD','Trim_kmh','FullBar_kmh','Serial','InServiceFrom','InServiceTo','RetiredFlag','Notes'];
  sw.getRange(1,1,1,wh.length).setValues([wh]); formatSimpleHeaderRow_(sw,1,wh.length); applyDataBanding_(sw,2,wh.length);
  if (sw.getLastRow()<2) sw.getRange(2,1,1,wh.length).setValues([['MyWing','Brand','Model','ML','2024',9,38,52,'','','',false,'Example row – edit or delete']]);

  var hh=['HarnessID','Make','Model','Size','Category','InServiceFrom','InServiceTo','RetiredFlag','Notes'];
  shh.getRange(1,1,1,hh.length).setValues([hh]); formatSimpleHeaderRow_(shh,1,hh.length); applyDataBanding_(shh,2,hh.length);
  if (shh.getLastRow()<2) shh.getRange(2,1,1,hh.length).setValues([['MyHarness','Brand','Model','M','XC','','',false,'Example row – edit or delete']]);

  var rh=['ReserveID','Make','Model','Size','Certification','InServiceFrom','InServiceTo','RetiredFlag','Notes'];
  sr.getRange(1,1,1,rh.length).setValues([rh]); formatSimpleHeaderRow_(sr,1,rh.length); applyDataBanding_(sr,2,rh.length);
  if (sr.getLastRow()<2) sr.getRange(2,1,1,rh.length).setValues([['MyReserve','Brand','Model','110','EN/LTF','','',false,'Example row – edit or delete']]);

  SpreadsheetApp.getActive().toast('Equipment headers & sample rows created.');
}
function scaffoldLookupsSeed_(){
  var sh=ensureSheet_(CFG.sheets.lookups);
  sh.getRange(1,1,1,2).setValues([['Parameter','Value']]);
  formatSimpleHeaderRow_(sh,1,2); applyDataBanding_(sh,2,2);

  var kv=[
    ['WATCH_FOLDER_ID',''],
    ['WATCH_PERIOD_MIN', String(CFG.defaultWatchPeriodMin)],
    ['OSM_RADIUS_M', String(CFG.defaultOsmRadiusM)],
    ['CONTACT_EMAIL', CFG.contactEmail],
    ['REVGEO_PROVIDER', CFG.revgeoProvider],
    ['FLIGHT_TYPES', CFG.flightTypes.join(', ')],
    ['NATIONAL_BONUS_WITHIN_PCT', String(CFG.national.closedWithinPct)],
    ['NATIONAL_BONUS_MULTIPLIER', String(CFG.national.bonusMultiplier)],
    ['THERMAL_MIN_CLIMB', String(CFG.thresholds.THERMAL_MIN_CLIMB)],
    ['THERMAL_MIN_TURN', String(CFG.thresholds.THERMAL_MIN_TURN)],
    ['SOAR_TURN_MAX', String(CFG.thresholds.SOAR_TURN_MAX)],
    ['SOAR_VARIO_MIN', String(CFG.thresholds.SOAR_VARIO_MIN)],
    ['SOAR_VARIO_MAX', String(CFG.thresholds.SOAR_VARIO_MAX)],
    ['GLIDE_TURN_MAX', String(CFG.thresholds.GLIDE_TURN_MAX)],
    ['GLIDE_LD_TOL_PCT', String(CFG.thresholds.GLIDE_LD_TOL_PCT)],
    ['GLIDE_VARIO_MAX', String(CFG.thresholds.GLIDE_VARIO_MAX)],
    ['SINK_TURN_MAX', String(CFG.thresholds.SINK_TURN_MAX)],
    ['SINK_VARIO', String(CFG.thresholds.SINK_VARIO)],
    ['MODE_WINDOW_SEC', String(CFG.modeWindowSec)],
    ['REVERSAL_WINDOW_SEC', String(CFG.reversalWindowSec)],
    ['MODE_HYSTERESIS_SEC', String(CFG.modeHysteresisSec)]
  ];
  // existing map from row 2 down
  var last=sh.getLastRow(), existing={};
  if (last>=2){
    var vals=sh.getRange(2,1,last-1,2).getValues();
    for (var i=0;i<vals.length;i++){ var k=(vals[i][0]||'').toString().trim(); if(k) existing[k]=true; }
  }
  var out=[]; for (var j=0;j<kv.length;j++) if (!existing[kv[j][0]]) out.push(kv[j]);
  if (out.length) sh.getRange(sh.getLastRow()+1,1,out.length,2).setValues(out);
  SpreadsheetApp.getActive().toast('Lookups seeded (headers in row 1; values from row 2).');
}

function scaffoldImportLog_(){
  var sh = ensureSheet_(CFG.sheets.importLog);
  var headers = [
    'When', 'InputType', 'InputValue', 'FetchMethod',
    'FileId', 'OuterName', 'InnerName', 'ActualFileName',
    'Fixes', 'RevGeoL_Status', 'RevGeoD_Status', 'Overpass_Status',
    'Status', 'Notes'
  ];
  if (sh.getLastRow() === 0) sh.appendRow(headers);
  else sh.getRange(1,1,1,headers.length).setValues([headers]);
  formatSimpleHeaderRow_(sh, 1, headers.length);
  applyDataBanding_(sh, 2, headers.length);
  SpreadsheetApp.getActive().toast('Import_Log headers ready.');
}

function applyGearValidations_(){
  var shF=ensureSheet_(CFG.sheets.flights), col=getColumnMap_();
  function ruleFrom(sheetName){
    var sh=SpreadsheetApp.getActive().getSheetByName(sheetName); if (!sh) return null;
    var last=sh.getLastRow(); if (last<2) return null;
    return SpreadsheetApp.newDataValidation().requireValueInRange(sh.getRange(2,1,last-1,1), true).build();
  }
  var wingR=ruleFrom(CFG.sheets.wings), harR=ruleFrom(CFG.sheets.harnesses), resR=ruleFrom(CFG.sheets.reserves);
  var rows=Math.max(1, shF.getMaxRows()-5);
  if (wingR && col['Wing']) shF.getRange(6,col['Wing'],rows,1).setDataValidation(wingR);
  if (harR && col['Harness']) shF.getRange(6,col['Harness'],rows,1).setDataValidation(harR);
  if (resR && col['Reserve 1']) shF.getRange(6,col['Reserve 1'],rows,1).setDataValidation(resR);
  if (resR && col['Reserve 2']) shF.getRange(6,col['Reserve 2'],rows,1).setDataValidation(resR);
}

/** ========= MAP HEADERS ========= */
function getColumnMap_(){
  var sh=SpreadsheetApp.getActive().getSheetByName(CFG.sheets.flights);
  var lastCol=sh.getLastColumn(); var headers=sh.getRange(5,1,1,lastCol).getValues()[0];
  var map={}; for (var i=0;i<headers.length;i++){ var h=String(headers[i]||'').trim(); if (h) map[h]=i+1; }
  return map;
}

/** ========= ID / SERIAL HELPERS ========= */
function genFlightId_(){
  var now=new Date(), tz=Session.getScriptTimeZone()||'UTC';
  var stamp=Utilities.formatDate(now,tz,'yyyyMMdd-HHmmss');
  var rand=Math.floor(Math.random()*2176782336); // 36^6
  var r36=rand.toString(36).toUpperCase();
  return 'FL-'+stamp+'-'+('000000'+r36).slice(-6);
}
function getNextFlightNo_(row){
  var sh=SpreadsheetApp.getActive().getSheetByName(CFG.sheets.flights);
  var col=getColumnMap_(); if (!col['Flight No']) return 1;
  var prev=sh.getRange(7,col['Flight No']).getValue(); var n=Number(prev);
  if (isNaN(n)||n<0) n=0; return n+1;
}

/** ========= UI ACTIONS ========= */
function openLookups_(){ var sh=ensureSheet_(CFG.sheets.lookups); sh.activate(); sh.setActiveSelection('A1'); }
function openImportLog_(){ var sh=ensureSheet_(CFG.sheets.importLog); sh.activate(); sh.setActiveSelection('A1'); }

function uiAddBlankFlight_(){
  var sh=ensureSheet_(CFG.sheets.flights);
  sh.insertRows(6,1);
  prefillNewRowDefaults_(6);
  SpreadsheetApp.getActive().toast('Blank flight row inserted at 6.');
}

function uiAddFlightFromIgc_(){
  var ui=SpreadsheetApp.getUi();
  var resp=ui.prompt('Add flight from IGC / IGX / ZIP / GZ','Paste a Google Drive file ID/URL or a direct URL:', ui.ButtonSet.OK_CANCEL);
  if (resp.getSelectedButton()!==ui.Button.OK) return;
  var input=resp.getResponseText().trim(); if(!input){ ui.alert('No input provided.'); return; }
  processOneInputIgc_(input);
}

function uiRecomputeSelected_(){
  var sh=ensureSheet_(CFG.sheets.flights); var sel=sh.getActiveRange();
  if (!sel){ SpreadsheetApp.getActive().toast('Select one or more rows first.'); return; }
  var rowStart=sel.getRow(); var rowEnd=rowStart+sel.getNumRows()-1;
  for (var r=rowStart;r<=rowEnd;r++) if (r>=6) recomputeRow_(r);
  SpreadsheetApp.getActive().toast('Recompute complete.');
}

/** ========= DEFAULTS FOR NEW ROW ========= */
function prefillNewRowDefaults_(row){
  var ss=SpreadsheetApp.getActive(), sh=ss.getSheetByName(CFG.sheets.flights), col=getColumnMap_(), look=getLookups_();
  function W(h,v){ if (col[h]) sh.getRange(row,col[h]).setValue(v); }
  function copyPrev(h){ if (!col[h]) return; var v=sh.getRange(7,col[h]).getValue(); if (v!=='') sh.getRange(row,col[h]).setValue(v); }

  W('Status','Needs review');
  W('Flight No', getNextFlightNo_(row));
  W('FlightID', genFlightId_());

  var ftList=look['FLIGHT_TYPES_LIST']||CFG.flightTypes||['Free Fly'];
  W('Flight Type', ftList[0]||'Free Fly');

  copyPrev('Wing'); copyPrev('Harness'); copyPrev('Reserve 1'); copyPrev('Reserve 2');
  W('Import timestamp', new Date());
  if (look['WATCH_FOLDER_ID']) W('Watch Folder ID', String(look['WATCH_FOLDER_ID']));
}

/** ========= DRIVE FETCH HARDENING ========= */
function withRetries_(fn, tries, baseMs){ tries=tries||3; baseMs=baseMs||500;
  for (var i=0;i<tries;i++){ try{ return fn(); } catch(e){ if (i===tries-1) throw e; Utilities.sleep(baseMs*Math.pow(2,i)); } }
}
function driveGetFileByIdSafe_(id){ return withRetries_(function(){ return DriveApp.getFileById(id); },3,500); }
function directDownloadUrlFromId_(id){ return 'https://drive.google.com/uc?export=download&id='+encodeURIComponent(id); }

/** ========= IMPORT ENTRY ========= */
function processOneInputIgc_(input){
  var raw = String(input||'').trim();
  if (!raw) throw new Error('No input provided');

  if (isHttpUrl_(raw)){
    var ctx = { inputType:'DirectURL', inputValue: raw };

    // If it’s a Google Drive URL with an ID, prefer DriveApp first
    var maybeId = extractDriveId_(raw);
    if (maybeId){
      ctx.fileId = maybeId;
      ctx.fetchMethod = 'DriveAppFromURL';
      try {
        var f = driveGetFileByIdSafe_(maybeId);
        ctx.actualName = f.getName();
        importDriveFile_(f, ctx);
        return;
      } catch (e) {
        // Fall back to direct download URL
        ctx.fetchMethod = 'UrlFetchDirect';
        var dl = normalizeDriveUrlToDownload_(raw);
        importFromUrl_(dl, ctx);
        return;
      }
    }

    // Non-Drive URL → fetch directly
    ctx.fetchMethod = 'UrlFetchDirect';
    importFromUrl_(raw, ctx);
    return;
  }

  // Otherwise treat as a DriveID
  var id = extractDriveId_(raw);
  if (!id) throw new Error('Could not extract a Drive file ID');
  var ctx2 = { inputType:'DriveID', inputValue: raw, fetchMethod:'DriveApp', fileId:id };
  try{
    var file = driveGetFileByIdSafe_(id);
    ctx2.actualName = file.getName();
    importDriveFile_(file, ctx2);
  }catch(e){
    // Fallback to direct download URL using the ID
    ctx2.fetchMethod = 'UrlFetchFallback';
    importFromUrl_(directDownloadUrlFromId_(id), ctx2);
  }
}


function importFromUrl_(url, ctx){
  // Normalize Drive links to direct download + capture fileId/name when possible
  var maybeId = extractDriveId_(url);
  if (maybeId){
    ctx.fileId = ctx.fileId || maybeId;
    var dn = getDriveNameSafe_(maybeId);
    if (dn) ctx.actualName = dn;
    url = normalizeDriveUrlToDownload_(url);
  }

  var res = UrlFetchApp.fetch(url, { muteHttpExceptions:true, followRedirects:true });
  var code = res.getResponseCode();
  if (code !== 200){
    ctx.status='Fetch fail'; ctx.notes='HTTP '+code; logImport_(ctx);
    throw new Error('Fetch failed '+code);
  }

  var ct = getHeaderCI_(res,'Content-Type') || '';
  var blob = res.getBlob();
  var headerName = extractFilenameFromHeaders_(res);
  var urlName = guessFilenameFromUrl_(url);
  var outerName = ctx.actualName || headerName || urlName || '';
  var kind = detectArchiveType_(blob, ct, outerName);

  // Finalize outerName now (with sensible default)
  outerName = coerceFilename_(outerName, kind==='zip'?'.zip':kind==='gzip'?'.gz':'.igc');
  ctx.outerName = outerName;

  if (kind === 'zip'){
    var entries = Utilities.unzip(blob);
    if (!entries.length){ ctx.status='Parse fail'; ctx.notes='Empty ZIP'; logImport_(ctx); return; }
    for (var i=0;i<entries.length;i++){
      var en = entries[i];
      if (!/\.(igc|igx)$/i.test(en.getName())) continue;
      var innerCtx = JSON.parse(JSON.stringify(ctx));
      innerCtx.innerName = en.getName();
      var txt = decodeTextSmart_(en);
      handlePlainIgc_(txt, en.getName(), ctx.fileId||null, url, outerName, innerCtx);
      Utilities.sleep(150);
    }
    return;
  }

  if (kind === 'gzip'){
    var txtGz = Utilities.newBlob(Utilities.gunzip(blob));
    var innerName = outerName.replace(/\.gz$/i,'');
    if (!/\.(igc|igx)$/i.test(innerName)) innerName += '.igc';
    ctx.innerName = innerName;
    handlePlainIgc_(txtGz.getDataAsString(), innerName, ctx.fileId||null, url, outerName, ctx);
    return;
  }

  // Plain text (maybe mislabelled); decode smartly
  var txt2 = decodeTextSmart_(blob);
  var innerName2 = outerName;
  if (!/\.(igc|igx)$/i.test(innerName2)) innerName2 += '.igc';
  ctx.innerName = innerName2;
  handlePlainIgc_(txt2, innerName2, ctx.fileId||null, url, outerName, ctx);
}

function importDriveFile_(file, ctx){
  ctx.fileId = ctx.fileId || file.getId();
  ctx.actualName = ctx.actualName || file.getName();

  var low = (file.getName()||'').toLowerCase();
  if (low.slice(-4) === '.zip'){
    var entries = Utilities.unzip(file.getBlob());
    if (!entries.length){ ctx.status='Parse fail'; ctx.notes='Empty ZIP'; ctx.outerName=file.getName(); logImport_(ctx); return; }
    ctx.outerName = file.getName();
    for (var i=0;i<entries.length;i++){
      var en = entries[i], nm = en.getName();
      if (!/\.(igc|igx)$/i.test(nm)) continue;
      var innerCtx = JSON.parse(JSON.stringify(ctx));
      innerCtx.innerName = nm;
      var txt = decodeTextSmart_(en);
      handlePlainIgc_(txt, nm, file.getId(), null, file.getName(), innerCtx);
      Utilities.sleep(150);
    }
  } else if (low.slice(-3) === '.gz'){
    var txtG = Utilities.newBlob(Utilities.gunzip(file.getBlob())).getDataAsString();
    ctx.outerName = file.getName();
    ctx.innerName = file.getName().replace(/\.gz$/i,'');
    handlePlainIgc_(txtG, ctx.innerName, file.getId(), null, file.getName(), ctx);
  } else {
    var txt2 = decodeTextSmart_(file.getBlob());
    ctx.outerName = file.getName();
    ctx.innerName = file.getName();
    handlePlainIgc_(txt2, file.getName(), file.getId(), null, file.getName(), ctx);
  }
}

/** ========= IGC PARSE + ROW CREATION ========= */
// Robust, spec-style B-record parser using fixed columns.
// Accepts: A/V validity, lowercase 'b', short lines (skips), missing GPS altitude (falls back to pressure)

// Ultra-tolerant IGC/IGX parser (XCTrack-friendly)
// - Cleans control chars & spaces
// - Accepts lon degrees with 2 or 3 digits (e.g., "72..." or "072...")
// - Accepts 'A'/'V' (or missing) validity
// - Accepts missing GPS altitude (falls back to pressure)
// - Ignores leading junk before 'B'

// Ultra-tolerant IGC/IGX parser (XCTrack-friendly)
function safeParseIgc_(txt, fileName){
  var raw = String(txt||'').replace(/\r/g,'').replace(/\u0000/g,''); // normalize & strip NULs
  var lines = raw.split('\n');

  // Header grabs (lenient)
  var dateIso = null, pilot = null, glider = null;
  var reDate  = /H..DTE\s*(\d{2})(\d{2})(\d{2})/i;   // ddmmyy
  var rePilot = /H(FPL|OPL)[^:]*:(.*)$/i;            // HFPLT/HOPLT
  var reGlide = /H(FGT|OGT)[^:]*:(.*)$/i;            // HFGTY/HOGTY

  // Results
  var fixes = []; // {t, lat, lon, alt}

  // Helpers
  function s2i(s){ var n = parseInt(s,10); return isNaN(n)?NaN:n; }
  function dmToDec_(degStr, min2Str, thou3Str, hemi, isLat){
    var deg = s2i(degStr), min2 = s2i(min2Str), thou = s2i(thou3Str);
    if (isNaN(deg)||isNaN(min2)||isNaN(thou)) return '';
    var minutes = min2 + (thou/1000.0);
    var dec = deg + minutes/60.0;
    hemi = (hemi||'').toUpperCase();
    if (hemi==='S'||hemi==='W') dec = -dec;
    if (isLat){ if (dec>90||dec<-90) return ''; } else { if (dec>180||dec<-180) return ''; }
    return dec;
  }

  // Remove all whitespace/control chars; slice from first 'B'
  function normalizeForMatch(L){
    L = String(L||'').replace(/[^\x20-\x7E]/g,''); // keep visible ASCII only
    L = L.replace(/\s+/g,'').trim();               // remove spaces/tabs
    var b = (L[0]==='B'||L[0]==='b') ? 0 : Math.max(L.indexOf('B'), L.indexOf('b'));
    if (b>0) L = L.slice(b);
    return L;
  }

  // Regex (no /x flag). Accepts lon degrees with 2 or 3 digits; validity optional; GPS alt optional.
  var reB = /^B(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})(\d{3})([NSns])(\d{2,3})(\d{2})(\d{3})([EWew])([AVav])?(\d{0,5})(\d{0,5})$/;

  for (var i=0;i<lines.length;i++){
    var Lraw = lines[i]; if (!Lraw) continue;

    // Headers (don’t strip spaces aggressively here)
    if (Lraw[0]==='H' || Lraw[0]==='h'){
      var mD = Lraw.match(reDate);  if (mD) dateIso = igcDateToIso_(mD[1],mD[2],mD[3]);
      var mP = Lraw.match(rePilot); if (mP) pilot   = (mP[2]||'').trim();
      var mG = Lraw.match(reGlide); if (mG) glider  = (mG[2]||'').trim();
      continue;
    }

    // Normalize potential B line
    var L = normalizeForMatch(Lraw);
    if (!L || (L[0]!=='B' && L[0]!=='b')) continue;

    var m = L.match(reB);
    if (!m) continue;

    var hh = s2i(m[1]), mm = s2i(m[2]), ss = s2i(m[3]);
    var lat = dmToDec_(m[4], m[5], m[6], m[7], true);
    var lon = dmToDec_(m[8], m[9], m[10], m[11], false);
    if (lat==='' || lon==='') continue;

    var altPrs = m[13] ? s2i(m[13]) : NaN;
    var altGps = m[14] ? s2i(m[14]) : NaN;
    var alt = !isNaN(altGps) ? altGps : (!isNaN(altPrs) ? altPrs : NaN);
    if (isNaN(alt)) continue;

    var t = hh*3600 + mm*60 + ss;
    fixes.push({ t:t, lat:lat, lon:lon, alt:alt });
  }

  if (!fixes.length) return null;

  var trackLenM = 0, maxAlt = -1e9, minAlt = 1e9;
  for (var j=1;j<fixes.length;j++){
    trackLenM += haversineM_(fixes[j-1].lat, fixes[j-1].lon, fixes[j].lat, fixes[j].lon);
  }
  for (var k=0;k<fixes.length;k++){
    var a=fixes[k].alt; if (a>maxAlt) maxAlt=a; if (a<minAlt) minAlt=a;
  }

  return {
    dateIso: dateIso,
    glider: glider,
    pilot: pilot,
    fixes: fixes,
    trackLenM: trackLenM,
    maxAlt: maxAlt,
    minAlt: minAlt,
    fileName: fileName
  };
}


function handlePlainIgc_(text, name, driveId, url, outerName, ctx){
  var parsed = safeParseIgc_(text, name);

  // Compute content hash for dedupe
  var hash = Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, text);
  var hashStr = hash.map(function(b){return ('0'+(b&0xFF).toString(16)).slice(-2);}).join('');

  if (!parsed){
    ctx.status='Parse fail';
    ctx.notes='No valid B-fixes';
    ctx.outerName = outerName || ctx.outerName || '';
    ctx.innerName = name || ctx.innerName || '';
    // Try to provide a meaningful ActualFileName even on failure
    if (!ctx.actualName){
      ctx.actualName = getDriveNameSafe_(driveId||'') || ctx.innerName || ctx.outerName || 'unknown.igc';
    }
    ctx.fileId = ctx.fileId || driveId || '';
    ctx.fixes = 0;
    logImport_(ctx);
    return;
  }

  // Check dedupe
  var seen = PropertiesService.getDocumentProperties().getProperty('HASH_'+hashStr);
  if (seen){
    ctx.status='Duplicate - skipped';
    ctx.notes='Content hash seen';
    ctx.outerName = outerName || ctx.outerName || '';
    ctx.innerName = name || ctx.innerName || '';
    ctx.actualName = ctx.actualName || parsed.fileName || getDriveNameSafe_(driveId||'') || '';
    ctx.fileId = ctx.fileId || driveId || '';
    ctx.fixes = parsed.fixes.length;
    logImport_(ctx);
    return;
  }
  PropertiesService.getDocumentProperties().setProperty('HASH_'+hashStr,'1');

  // Insert a row and write the flight
  var sh = ensureSheet_(CFG.sheets.flights);
  sh.insertRows(6,1);
  var row=6;
  createFlightRowFromParsed_(row, parsed, driveId, url, ctx);

  // Finalize ctx and log OK
  ctx.status='OK'; ctx.notes='';
  ctx.outerName = outerName || ctx.outerName || '';
  ctx.innerName = name || ctx.innerName || '';
  ctx.actualName = ctx.actualName || parsed.fileName || getDriveNameSafe_(driveId||'') || '';
  ctx.fileId = ctx.fileId || driveId || '';
  ctx.fixes = ctx.fixes != null ? ctx.fixes : parsed.fixes.length;
  logImport_(ctx);
}



function createFlightRowFromParsed_(row, p, driveId, url, ctx){
  var sh=ensureSheet_(CFG.sheets.flights), col=getColumnMap_(), look=getLookups_();
  function W(h,v){ if (col[h]) sh.getRange(row,col[h]).setValue(v); }
  function setIf(h,v){ if (v!==undefined && v!==null && v!=='') W(h,v); }

  // Basics
  W('Status','Needs review');
  W('Flight No', getNextFlightNo_(row));
  W('FlightID', genFlightId_());

  var fixes=p.fixes, start=fixes[0], end=fixes[fixes.length-1];
  var duration=end.t - start.t;

  setIf('Date', p.dateIso);
  W('Launch Time', fmtHMS_(start.t));                 // (1) Basic Launch Time
  W('Track Length (km)', round_(toKm_(p.trackLenM),2));
  var straightKm=toKm_(haversineM_(start.lat,start.lon,end.lat,end.lon));
  W('Straight Start→Finish (km)', round_(straightKm,2));
  W('Flight Duration (hh:mm:ss)', fmtHMS_(duration));
  W('Launch↔Landing (km)', round_(toKm_(haversineM_(start.lat,start.lon,end.lat,end.lon)),2));

  // Default Flight Type (2)
  var ftList = look['FLIGHT_TYPES_LIST'] || CFG.flightTypes || ['Free Fly'];
  W('Flight Type', ftList[0] || 'Free Fly');

  // Launch/Landing core
  W('Launch Lat', start.lat); W('Launch Lon', start.lon); W('Launch Alt (m)', start.alt); W('Launch Time', fmtHMS_(start.t));
  W('Landing Lat', end.lat);  W('Landing Lon', end.lon);  W('Landing Alt (m)', end.alt);   W('Landing Time', fmtHMS_(end.t));

  // Wing from IGC header if empty (3)
  var wingCell = col['Wing'] ? sh.getRange(row, col['Wing']) : null;
  if (wingCell && !wingCell.getValue() && p.glider) wingCell.setValue(p.glider);

  // Snapshot wing specs after we may have set Wing
  var wingSnap = snapshotWingSpecs_(sh, col, row);

  // Reverse-geo + nearest PG sites with basic retry + status capture (4)
  var revLStatus='SKIP', revDStatus='SKIP', overStatus='SKIP';
  try{
    var revL=null, revD=null;
    for (var rtry=0;rtry<2;rtry++){
      try{ revL=reverseGeo_(start.lat,start.lon,look); revLStatus='OK'; break; }
      catch(e){ Utilities.sleep(300); revLStatus='ERR:'+String(e.message||e); }
    }
    for (var rtry2=0;rtry2<2;rtry2++){
      try{ revD=reverseGeo_(end.lat,end.lon,look); revDStatus='OK'; break; }
      catch(e2){ Utilities.sleep(300); revDStatus='ERR:'+String(e2.message||e2); }
    }
    if (revL){ setIf('Launch Country', revL.country); setIf('Launch Region', revL.admin1); setIf('Launch Nearest Town', revL.town); }
    if (revD){ setIf('Landing Country', revD.country); setIf('Landing Region', revD.admin1); setIf('Landing Nearest Town', revD.town); }
    W('Rev-geo provider', look['REVGEO_PROVIDER']);
  }catch(_) {}

  try{
    var siteL=null, siteD=null;
    for (var s=0;s<2;s++){
      try{ siteL=nearestPgSite_(start.lat,start.lon,look); siteD=nearestPgSite_(end.lat,end.lon,look); overStatus='OK'; break; }
      catch(e3){ Utilities.sleep(300); overStatus='ERR:'+String(e3.message||e3); }
    }
    if (siteL && siteL.name) W('Launch Site', siteL.name);
    if (siteD && siteD.name) W('Landing Site', siteD.name);
    W('OSM radius (m)', Number(look['OSM_RADIUS_M']));
  }catch(_) {}

  // Max/Min Alt from parser + extra metrics (5)
  setIf('Max Alt (m)', p.maxAlt); setIf('Min Alt (m)', p.minAlt);
  var kin = computeKinematics_(p.fixes);
  if (kin){
    setIf('Total Height Gain (m)', Math.round(kin.totalGain));
    setIf('Max Ascent (m/s)', round_(kin.maxAscent,2));
    setIf('Max Descent (m/s)', round_(kin.maxDescent,2));
    setIf('Max Groundspeed (km/h)', round_(kin.maxGsKmh,1));
    setIf('Avg Groundspeed (km/h)', round_(kin.avgGsKmh,1));
  }

  // XC scoring (keep as-is)
  var xc = computeXcScores_(p.fixes);
  if (xc){
    W('XC Distance (km)', round_(xc.bestFreeKm,2));
    W('Flat Triangle (km)', round_(xc.bestFlatKm,2));
    W('FAI Triangle (km)', round_(xc.bestFaiKm,2));
    W('XContest Points (World)', round_(xc.worldPts,1));
    W('XContest Points (National)', round_(xc.nationalPts,1));
    W('XC Flight Class', xc.className);
    W('Closed?', xc.closed ? 'Y':'N');
  }

  // Modes (leave minimal writes)
  try{
    var modes = classifyModes_(p.fixes, wingSnap && wingSnap.ld || null);
    setIf('Time Thermal (min)', round_(modes.time.thermal/60,1));
    setIf('Time Soar (min)',    round_(modes.time.soar/60,1));
    setIf('Time Glide (min)',   round_(modes.time.glide/60,1));
    setIf('Time Sink (min)',    round_(modes.time.sink/60,1));
    setIf('Thermals Count',     modes.thermals.count);
    setIf('Thermal Avg Climb (m/s)', round_(modes.thermals.avgClimb,2));
    setIf('Thermal Best (m/s)', round_(modes.thermals.best,2));
  }catch(_){}

  // Meta
  setIf('IGC file name', p.fileName);
  setIf('IGC Drive ID', driveId||'');
  setIf('IGC URL', url||'');
  W('Import timestamp', new Date());

  // Auto Summary
  var place = sh.getRange(row, col['Launch Site']||col['Launch Nearest Town']||col['Launch Country']).getValue();
  var auto = fmtHhMm_(duration)+', Track '+round_(toKm_(p.trackLenM),1)+' km, max alt '+p.maxAlt+' m'+(place?(' at '+place):'');
  W('Auto Summary', auto);

  // record lookup statuses in ctx for Import_Log
  if (ctx){ ctx.revL = revLStatus; ctx.revD = revDStatus; ctx.over = overStatus; ctx.fixes = fixes.length; ctx.actualName = p.fileName || ''; }
}


/** Snapshot wing specs into row (returns {ld, trim, full}) */
function snapshotWingSpecs_(sh, col, row){
  var wingCol=col['Wing']; if (!wingCol) return null;
  var wing=sh.getRange(row, wingCol).getValue();
  if (!wing) return null;
  var shW=SpreadsheetApp.getActive().getSheetByName(CFG.sheets.wings);
  if (!shW) return null;
  var last=shW.getLastRow(); if (last<2) return null;
  var vals=shW.getRange(2,1,last-1,shW.getLastColumn()).getValues();
  var hdr=shW.getRange(1,1,1,shW.getLastColumn()).getValues()[0];
  var idxId=0, idxLD=hdr.indexOf('GlideRatio_LD'), idxTrim=hdr.indexOf('Trim_kmh'), idxFull=hdr.indexOf('FullBar_kmh');
  for (var i=0;i<vals.length;i++){
    if (String(vals[i][idxId])===String(wing)){
      var ld=Number(vals[i][idxLD]||''); var tr=Number(vals[i][idxTrim]||''); var fb=Number(vals[i][idxFull]||'');
      if (col['GlideRatio_LD (snap)']) sh.getRange(row,col['GlideRatio_LD (snap)']).setValue(ld||'');
      if (col['Trim_kmh (snap)']) sh.getRange(row,col['Trim_kmh (snap)']).setValue(tr||'');
      if (col['FullBar_kmh (snap)']) sh.getRange(row,col['FullBar_kmh (snap)']).setValue(fb||'');
      return { ld: ld||null, trim: tr||null, full: fb||null };
    }
  }
  return null;
}

/** ========= RECOMPUTE ========= */
function recomputeRow_(row){
  var sh=ensureSheet_(CFG.sheets.flights), col=getColumnMap_();
  var lat1=sh.getRange(row,col['Launch Lat']).getValue(), lon1=sh.getRange(row,col['Launch Lon']).getValue();
  var lat2=sh.getRange(row,col['Landing Lat']).getValue(), lon2=sh.getRange(row,col['Landing Lon']).getValue();
  if (lat1===''||lon1===''||lat2===''||lon2==='') return;
  var distKm=toKm_(haversineM_(lat1,lon1,lat2,lon2));
  sh.getRange(row,col['Launch↔Landing (km)']).setValue(round_(distKm,2));
  // (In a fuller impl, we’d reparse from raw, but here we just leave it concise.)
}

/** ========= REVERSE GEO ========= */
function reverseGeo_(lat,lon,look){
  var email=String(look['CONTACT_EMAIL']||CFG.contactEmail);
  var url='https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat='+encodeURIComponent(lat)+'&lon='+encodeURIComponent(lon)+'&zoom=10&addressdetails=1&email='+encodeURIComponent(email);
  var res=UrlFetchApp.fetch(url,{muteHttpExceptions:true,headers:{'User-Agent':'PG-Log/1.0 '+email}});
  if (res.getResponseCode()!==200) return {};
  var o=JSON.parse(res.getContentText());
  var a=o.address||{};
  return { country:a.country||'', admin1:a.state||a.region||'', town:a.town||a.city||a.village||a.hamlet||'' };
}

/** ========= NEAREST PG SITE (OSM Overpass) ========= */
function nearestPgSite_(lat,lon,look){
  var rad=Number(look['OSM_RADIUS_M']||CFG.defaultOsmRadiusM);
  var email=String(look['CONTACT_EMAIL']||CFG.contactEmail);
  var q='[out:json][timeout:25];('+
        'node(around:'+rad+','+lat+','+lon+')[paragliding~\"takeoff|landing\",i];'+
        'node(around:'+rad+','+lat+','+lon+')[sport=paragliding][site~\"takeoff|landing\",i];'+
        ');out 10;';
  var res=UrlFetchApp.fetch('https://overpass-api.de/api/interpreter',{method:'post',payload:{data:q},muteHttpExceptions:true,headers:{'User-Agent':'PG-Log/1.0 '+email}});
  if (res.getResponseCode()!==200) return null;
  var o=JSON.parse(res.getContentText());
  if (!o.elements||!o.elements.length) return null;
  var best=o.elements[0]; var name=(best.tags&& (best.tags.name||best.tags['name:en']))||'PG Site';
  return { name:name };
}

/** ========= XC SCORING (concise implementation) ========= */
function computeXcScores_(fixes){
  // Lightweight heuristic: downsample ~2s, compute convex-hull-ish best free and triangles (pruned search)
  if (!fixes || fixes.length<5) return null;
  // Downsample: every 2s
  var ds=[fixes[0]]; for (var i=1;i<fixes.length;i++){ if (fixes[i].t - ds[ds.length-1].t >= 2) ds.push(fixes[i]); }
  function dkm(a,b){ return toKm_(haversineM_(a.lat,a.lon,b.lat,b.lon)); }
  var bestFree=0;
  for (var i1=0;i1<ds.length;i1+=Math.max(1,Math.floor(ds.length/200))){
    for (var i2=i1+1;i2<ds.length;i2+=Math.max(1,Math.floor(ds.length/200))){
      var d=dkm(ds[i1],ds[i2]); if (d>bestFree) bestFree=d;
    }
  }
  // Triangle search (very pruned)
  var bestFlat=0, bestFai=0, closed=false;
  var step=Math.max(1,Math.floor(ds.length/150));
  for (var i=0;i<ds.length;i+=step){
    for (var j=i+5;j<ds.length;j+=step){
      for (var k=j+5;k<ds.length;k+=step){
        var A=ds[i],B=ds[j],C=ds[k];
        var AB=dkm(A,B), BC=dkm(B,C), CA=dkm(C,A);
        var P=AB+BC+CA; if (P<1) continue;
        var close=dkm(ds[0], ds[ds.length-1]);
        var gap=dkm(C, ds[ds.length-1]); // rough
        var tri=P;
        // Closure rule (use simple P and close gap <= 20%)
        var closedTri = (close <= 0.2*P);
        if (closedTri) { if (tri>bestFlat) bestFlat=tri; }
        // FAI rule
        var shortest=Math.min(AB,BC,CA);
        if (closedTri && shortest >= 0.28*P) { if (tri>bestFai) bestFai=tri; }
      }
    }
  }
  var className='Free', world=bestFree, closedFlag=false;
  if (bestFai>0){ className='FAI'; world=bestFai*1.4; closedFlag=true; }
  else if (bestFlat>0){ className='Flat'; world=bestFlat*1.2; closedFlag=true; }
  else { className='Free'; world=bestFree*1.0; closedFlag=false; }

  var look=getLookups_();
  var national=world;
  if (closedFlag){
    // Assume closed within threshold for this estimate (we use 20% closure above; national uses tighter)
    national = world * Number(look['NATIONAL_BONUS_MULTIPLIER']||CFG.national.bonusMultiplier);
  }
  return { bestFreeKm:bestFree||0, bestFlatKm:bestFlat||0, bestFaiKm:bestFai||0, worldPts:world||0, nationalPts:national||0, className:className, closed:closedFlag };
}

/** ========= MODE CLASSIFICATION (concise) ========= */
function classifyModes_(fixes, gliderLD){
  var look=getLookups_(), T={
    THERMAL_MIN_CLIMB: look['THERMAL_MIN_CLIMB'],
    THERMAL_MIN_TURN:  look['THERMAL_MIN_TURN'],
    SOAR_TURN_MAX:     look['SOAR_TURN_MAX'],
    SOAR_VARIO_MIN:    look['SOAR_VARIO_MIN'],
    SOAR_VARIO_MAX:    look['SOAR_VARIO_MAX'],
    GLIDE_TURN_MAX:    look['GLIDE_TURN_MAX'],
    GLIDE_LD_TOL_PCT:  look['GLIDE_LD_TOL_PCT'],
    GLIDE_VARIO_MAX:   look['GLIDE_VARIO_MAX'],
    SINK_TURN_MAX:     look['SINK_TURN_MAX'],
    SINK_VARIO:        look['SINK_VARIO']
  };
  var winSec=Number(look['MODE_WINDOW_SEC']||CFG.modeWindowSec);

  function windowVario(i,w){
    var j0=Math.max(0,i-w), j1=Math.min(fixes.length-1,i+w);
    var dz=fixes[j1].alt - fixes[j0].alt;
    var dt= (fixes[j1].t - fixes[j0].t)||1;
    return dz/dt;
  }
  function turnRate(i,w){
    var j0=Math.max(0,i-w), j1=Math.min(fixes.length-1,i+w);
    var b=bearingDeg_(fixes[j0].lat,fixes[j0].lon,fixes[j1].lat,fixes[j1].lon);
    var b2=bearingDeg_(fixes[Math.max(0,i-1)].lat,fixes[Math.max(0,i-1)].lon,fixes[Math.min(fixes.length-1,i+1)].lat,fixes[Math.min(fixes.length-1,i+1)].lon);
    var d=Math.abs(b-b2); if (d>180) d=360-d; var dt=(fixes[j1].t - fixes[j0].t)||1; return d/dt;
  }
  function obsLD(i,w){
    var j0=Math.max(0,i-w), j1=Math.min(fixes.length-1,i+w);
    var d=haversineM_(fixes[j0].lat,fixes[j0].lon,fixes[j1].lat,fixes[j1].lon);
    var v=fixes[j0].alt - fixes[j1].alt; if (v<=0) return 99; return (d/ v); // m per m → L/D
  }

  var w=Math.max(1, Math.round(winSec/2)); // since fixes are ~1s
  var time={thermal:0,soar:0,glide:0,sink:0};
  var thermals={count:0, avgClimb:0, best:-1e9}; var climbSum=0, climbN=0;
  for (var i=1;i<fixes.length-1;i++){
    var vr=windowVario(i,w), tr=turnRate(i,w), ld=obsLD(i,w);
    var mode='glide';
    if (vr>=T.THERMAL_MIN_CLIMB && tr>=T.THERMAL_MIN_TURN){ mode='thermal'; }
    else if (tr<=T.SOAR_TURN_MAX && vr>=T.SOAR_VARIO_MIN && vr<=T.SOAR_VARIO_MAX){ mode='soar'; }
    else if (tr<=T.GLIDE_TURN_MAX && vr<=T.GLIDE_VARIO_MAX){
      if (gliderLD){ var tol=T.GLIDE_LD_TOL_PCT/100.0; if (ld<gliderLD*(1- tol) || ld>gliderLD*(1+tol)) mode='sink'; else mode='glide'; }
      else { mode='glide'; }
    } else if (vr<=T.SINK_VARIO) mode='sink';

    var dt=fixes[i+1].t - fixes[i].t; if (dt<=0) dt=1;
    time[mode]+=dt;
    if (mode==='thermal'){ climbSum+=vr; climbN++; if (vr>thermals.best) thermals.best=vr; }
  }
  thermals.count = climbN; thermals.avgClimb = climbN? (climbSum/climbN):0;
  return { time:time, thermals:thermals };
}

/** ========= WATCHER ========= */
function scanWatchFolderNow_(){ scanWatchFolder_(); }
function setupWatcherTrigger_(){
  var ts=ScriptApp.getProjectTriggers();
  for (var i=0;i<ts.length;i++) if (ts[i].getHandlerFunction()==='scanWatchFolder_'){ SpreadsheetApp.getActive().toast('Watcher trigger already exists.'); return; }
  ScriptApp.newTrigger('scanWatchFolder_').timeBased().everyMinutes(5).create();
  SpreadsheetApp.getActive().toast('Watcher trigger created (every 5 min). Control cadence via Lookups.WATCH_PERIOD_MIN.');
}
function scanWatchFolder_(){
  var look=getLookups_(); var folderId=String(look['WATCH_FOLDER_ID']||'').trim(); if (!folderId){ SpreadsheetApp.getActive().toast('WATCH_FOLDER_ID not set.'); return; }
  var now=Date.now(); var lastScan=Number(PropertiesService.getDocumentProperties().getProperty('LAST_SCAN_TS')||0);
  var minMs=(Number(look['WATCH_PERIOD_MIN']||CFG.defaultWatchPeriodMin))*60000;
  if (now-lastScan<minMs) return;
  PropertiesService.getDocumentProperties().setProperty('LAST_SCAN_TS', String(now));

  var folder; try{ folder=DriveApp.getFolderById(folderId);}catch(e){ SpreadsheetApp.getActive().toast('Invalid WATCH_FOLDER_ID.'); return;}
  var files=folder.getFiles();
  while (files.hasNext()){
    var f=files.next();
    try{ importDriveFile_(f); }catch(e){ logImport_(f.getId(), f.getName(), '', 'Fetch/Import fail'); }
  }
}

/** ========= IMPORT LOG ========= */
function logImport_(ctx){
  // ctx = { status, notes, inputType, inputValue, fetchMethod, fileId, outerName, innerName, actualName, fixes, revL, revD, over }
  var sh = ensureSheet_(CFG.sheets.importLog);
  var row = [
    new Date(),
    ctx.inputType || '', ctx.inputValue || '', ctx.fetchMethod || '',
    ctx.fileId || '', ctx.outerName || '', ctx.innerName || '', ctx.actualName || '',
    (ctx.fixes!=null ? ctx.fixes : ''), ctx.revL || '', ctx.revD || '', ctx.over || '',
    ctx.status || '', ctx.notes || ''
  ];
  sh.appendRow(row);
}

/**===============Helpers=====================**/

function isHttpUrl_(s){ return /^https?:\/\//i.test(String(s||'')); }

function getDriveNameSafe_(id){
  try { return DriveApp.getFileById(id).getName(); } catch(_) { return ''; }
}

// Case-insensitive header get
function getHeaderCI_(res, name){
  var hdrs = res && res.getHeaders ? res.getHeaders() : null;
  if (!hdrs) return null;
  var want = String(name||'').toLowerCase();
  for (var k in hdrs){
    if (!hdrs.hasOwnProperty(k)) continue;
    if (String(k).toLowerCase() === want) return hdrs[k];
  }
  return null;
}

// Try hard to extract a filename from response headers (Drive often sets it)
function extractFilenameFromHeaders_(res){
  var cand = null;

  // 1) Content-Disposition (most common)
  var cd = getHeaderCI_(res, 'Content-Disposition');
  if (cd){
    var m = cd.match(/filename\*=UTF-8''([^;]+)|filename="?([^";]+)"?/i);
    if (m){
      cand = decodeURIComponent(m[1] || m[2] || '').trim();
      if (cand) return cand;
    }
  }

  // 2) Any header whose VALUE contains something like *.igc / *.igx / *.zip / *.gz
  var hdrs = res.getHeaders() || {};
  for (var k in hdrs){
    if (!hdrs.hasOwnProperty(k)) continue;
    var v = String(hdrs[k] || '');
    var m2 = v.match(/([A-Za-z0-9 _.-]+\.(?:igc|igx|zip|gz))/i);
    if (m2) return m2[1].trim();
  }

  // 3) Any header NAME that looks filename-ish (rare, but try)
  for (var k2 in hdrs){
    if (!hdrs.hasOwnProperty(k2)) continue;
    if (String(k2).toLowerCase().indexOf('filename') >= 0){
      var v2 = String(hdrs[k2] || '').trim();
      if (v2) return v2;
    }
  }

  return null;
}

// Fallback: infer from URL when headers don’t help
function guessFilenameFromUrl_(url){
  try{
    var u = String(url||'');
    var path = u.split('?')[0];
    var last = path.split('/').filter(Boolean).pop();
    if (last && last.length <= 200 && last.indexOf('.') > 0) return last;
  }catch(_){}
  return null;
}

function normalizeDriveUrlToDownload_(url){
  var id = extractDriveId_(url);
  if (!id) return url;
  // If it’s not already a uc? link, convert it
  if (!/https?:\/\/[^\/]*drive\.google\.com\/uc\?/i.test(url)) {
    return directDownloadUrlFromId_(id);
  }
  return url;
}

// Detect archive type from bytes (fallback to content-type)
function detectArchiveType_(blob, ct, nameHint){
  var bytes = blob.getBytes();
  if (bytes && bytes.length >= 4){
    // ZIP: 50 4B 03 04
    if (bytes[0] === 0x50 && bytes[1] === 0x4B && bytes[2] === 0x03 && bytes[3] === 0x04) return 'zip';
    // GZIP: 1F 8B
    if (bytes[0] === 0x1F && bytes[1] === 0x8B) return 'gzip';
  }
  ct = String(ct||'').toLowerCase();
  if (ct.indexOf('zip')>=0) return 'zip';
  if (ct.indexOf('gzip')>=0) return 'gzip';
  // name hint
  nameHint = String(nameHint||'').toLowerCase();
  if (nameHint.endsWith('.zip')) return 'zip';
  if (nameHint.endsWith('.gz'))  return 'gzip';
  return 'text';
}

// Decode text from a blob robustly (handles UTF-16, BOM, stray NULs)
function decodeTextSmart_(blob){
  // 1) try UTF-8
  var txt = blob.getDataAsString('UTF-8');
  if (txt.indexOf('\u0000') >= 0){
    // 2) try UTF-16LE
    try { txt = blob.getDataAsString('UTF-16LE'); } catch(_) {}
  }
  // strip BOM if any
  if (txt.charCodeAt(0) === 0xFEFF) txt = txt.slice(1);
  // remove stray NULs (common with UTF-16 misreads)
  if (txt.indexOf('\u0000') >= 0) txt = txt.replace(/\u0000/g,'');
  return txt;
}

// Ensure a reasonable filename when we can’t see Drive metadata
function coerceFilename_(name, extFallback){
  var n = String(name||'').trim();
  if (!n) n = 'download';
  if (!/\.[A-Za-z0-9]+$/.test(n) && extFallback) n += extFallback;
  return n;
}

/**================Debug =====================**/
function debug_LogFirstFixes_(txt){
  var lines = String(txt || '').replace(/\r/g,'').split('\n');
  var shown = 0;
  for (var i=0; i<lines.length && shown<10; i++){
    var L = lines[i];
    if (L && (L[0]==='B' || L[0]==='b')){
      Logger.log('B-line len=%s | "%s"', L.length, L);
      shown++;
    }
  }
  if (shown===0) Logger.log('No B lines found.');
}

function debugClearAllDedupe_(){
  var dp = PropertiesService.getDocumentProperties();
  var all = dp.getProperties();
  var removed = 0;
  Object.keys(all).forEach(function(k){
    if (k.indexOf('HASH_') === 0) { dp.deleteProperty(k); removed++; }
  });
  // Also clear watcher throttle so "Scan Watch Folder now" runs immediately
  dp.deleteProperty('LAST_SCAN_TS');
  SpreadsheetApp.getActive().toast('Cleared ' + removed + ' dedupe entries. Watcher throttle reset.');
}

function debugClearDedupeForOne_(){
  var ui = SpreadsheetApp.getUi();
  var resp = ui.prompt('Clear dedupe for one file', 'Paste a Drive file ID/URL or a direct download URL:', ui.ButtonSet.OK_CANCEL);
  if (resp.getSelectedButton() !== ui.Button.OK) return;
  var input = resp.getResponseText().trim();
  if (!input) { ui.alert('No input.'); return; }

  var id = extractDriveId_(input);
  var blob, name = 'file';
  try {
    if (id) {
      var f = DriveApp.getFileById(id);
      blob = f.getBlob(); name = f.getName();
    } else {
      var res = UrlFetchApp.fetch(input, {muteHttpExceptions:true, followRedirects:true});
      if (res.getResponseCode() !== 200) throw new Error('Fetch failed ' + res.getResponseCode());
      blob = res.getBlob(); name = 'URL';
    }
  } catch (e) {
    ui.alert('Could not fetch the file: ' + e);
    return;
  }

  // If ZIP or GZ, take the first inner .igc/.igx for targeted clearing
  var lowName = String(name||'').toLowerCase();
  var txt;
  try {
    var ct = '';
    try { ct = String(blob.getContentType()||'').toLowerCase(); } catch(_){}
    if (ct.indexOf('zip') >= 0 || lowName.slice(-4)==='.zip') {
      var entries = Utilities.unzip(blob);
      for (var i=0;i<entries.length;i++){
        if (/\.(igc|igx)$/i.test(entries[i].getName())) { txt = entries[i].getDataAsString(); name = entries[i].getName(); break; }
      }
      if (!txt) { ui.alert('ZIP did not contain any .igc/.igx'); return; }
    } else if (ct.indexOf('gzip') >= 0 || lowName.slice(-3)==='.gz') {
      txt = Utilities.newBlob(Utilities.gunzip(blob)).getDataAsString();
    } else {
      txt = blob.getDataAsString();
    }
  } catch (e2) {
    ui.alert('Failed to read content: ' + e2);
    return;
  }

  // Compute MD5 and delete
  var hash = Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, txt);
  var hashStr = hash.map(function(b){ return ('0'+(b&0xFF).toString(16)).slice(-2); }).join('');
  var key = 'HASH_' + hashStr;
  var dp = PropertiesService.getDocumentProperties();
  if (dp.getProperty(key)) {
    dp.deleteProperty(key);
    ui.alert('Cleared dedupe entry for: ' + name + '\nKey: ' + key);
  } else {
    ui.alert('No dedupe entry found for: ' + name + '\nKey (not present): ' + key);
  }
}

function debugResetWatcherThrottle_(){
  PropertiesService.getDocumentProperties().deleteProperty('LAST_SCAN_TS');
  SpreadsheetApp.getActive().toast('Watcher throttle reset. Run "Scan Watch Folder now".');
}


/* End of script */
