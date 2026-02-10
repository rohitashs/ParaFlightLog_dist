/***************************************************************
 * IGC → Google Sheets: parser + metrics + summaries + helpers
 * Paste into Extensions → Apps Script (bound to your spreadsheet)
 ****************************************************************/

/* ===================== PUBLIC SHEET FUNCTIONS ===================== */

/** Fetch IGC from a (public) URL and return full fixes table. */
function IMPORTIGC(url) {
  if (!url) return [["Error","No URL"]];
  var res = UrlFetchApp.fetch(url, { muteHttpExceptions: true, followRedirects: true });
  if (res.getResponseCode() !== 200) return [["Error","Fetch failed " + res.getResponseCode()]];
  var text = _maybeGunzipToText(res.getBlob(), (res.getHeaders()["Content-Type"]||""));
  var parsed = _parseIgc(text);
  return _fixesToTable(parsed);
}

/** Fetch IGC from Drive by fileId and return full fixes table. */
function IMPORTIGC_BY_ID(fileId) {
  if (!fileId) return [["Error","No file ID"]];
  var file = DriveApp.getFileById(fileId);
  var blob = file.getBlob();
  var text = _maybeGunzipToText(blob, blob.getContentType(), file.getName());
  var parsed = _parseIgc(text);
  return _fixesToTable(parsed);
}

/** Summarize a public/direct URL (no Drive permission required). */
function IGC_SUMMARY(url) {
  if (!url) return [["Error","No URL"]];
  var res = UrlFetchApp.fetch(url, { muteHttpExceptions: true, followRedirects: true });
  if (res.getResponseCode() !== 200) return [["Error","Fetch failed " + res.getResponseCode()]];
  var text = _maybeGunzipToText(res.getBlob(), (res.getHeaders()["Content-Type"]||""));
  var parsed = _parseIgc(text);
  return _summaryFromParsed(parsed, "URL");
}

/** Summarize a Drive file by ID (uses your account permissions). */
function IGC_SUMMARY_BY_ID(fileId) {
  if (!fileId) return [["Error","No file ID"]];
  var file = DriveApp.getFileById(fileId);
  var blob = file.getBlob();
  var text = _maybeGunzipToText(blob, blob.getContentType(), file.getName());
  var parsed = _parseIgc(text);
  parsed.meta.fileName = file.getName();
  return _summaryFromParsed(parsed, "DRIVE");
}

/**
 * Smart wrapper: Accepts a full Drive URL, a file ID, or a public URL.
 * Tries Drive (if an ID can be extracted); falls back to URL fetch.
 */
function IGC_SUMMARY_SMART(input) {
  var s = String(input||"").trim();
  if (!s) return [["Error","No input"]];
  // Extract Drive file ID from common shapes (/-_A-Za-z0-9, length ≥ 25)
  var idMatch = s.match(/[-\w]{25,}/);
  var id = idMatch ? idMatch[0] : null;

  if (id) {
    try {
      return IGC_SUMMARY_BY_ID(id);  // requires you to run AUTHORIZE_IGC once
    } catch (e) {
      // If Drive fails (permissions), try public URL
      var url = "https://drive.google.com/uc?id=" + id;
      try { return IGC_SUMMARY(url); } catch (e2) { return [["Error", String(e2)]]; }
    }
  }
  // Otherwise assume it’s a normal URL (must be publicly fetchable)
  try { return IGC_SUMMARY(s); } catch (e3) { return [["Error", String(e3)]]; }
}

/** One-time authorizer: run this from the editor and Allow. */
function AUTHORIZE_IGC() {
  DriveApp.getRootFolder();                       // Drive read scopes
  UrlFetchApp.fetch("https://example.com");       // UrlFetch
  SpreadsheetApp.getActiveSpreadsheet();          // Spreadsheet access
  return "Authorized.";
}

/* ========================= OPTIONAL MENU ========================= */

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('IGC')
    .addItem('Import IGC by Drive File ID…', 'igcPromptAndImport')
    .addItem('Summarize IGC by Drive File ID…', 'igcPromptAndSummarize')
    .addToUi();
}

function igcPromptAndImport() {
  var ui = SpreadsheetApp.getUi();
  var res = ui.prompt('Drive File ID', 'Paste the IGC Drive file ID:', ui.ButtonSet.OK_CANCEL);
  if (res.getSelectedButton() !== ui.Button.OK) return;
  var id = (res.getResponseText()||"").trim();
  var data = IMPORTIGC_BY_ID(id);
  var sh = SpreadsheetApp.getActiveSheet();
  sh.clear();
  sh.getRange(1,1,data.length, data[0].length).setValues(data);
  ui.alert('Imported ' + Math.max(0, data.length - 2) + ' fixes.');
}

function igcPromptAndSummarize() {
  var ui = SpreadsheetApp.getUi();
  var res = ui.prompt('Drive File ID', 'Paste the IGC Drive file ID:', ui.ButtonSet.OK_CANCEL);
  if (res.getSelectedButton() !== ui.Button.OK) return;
  var id = (res.getResponseText()||"").trim();
  var data = IGC_SUMMARY_BY_ID(id);
  var sh = SpreadsheetApp.getActiveSheet();
  sh.clear();
  sh.getRange(1,1,data.length, data[0].length).setValues(data);
  ui.alert('Summary created.');
}

/* ======================== CORE IMPLEMENTATION ======================== */

/** Parse IGC text, return {meta:{...}, fixes:[...]}. */
function _parseIgc(text) {
  if (!text) return { meta:_emptyMeta(), fixes:[] };
  var lines = text.split(/\r?\n/).filter(Boolean);

  var meta = _extractMeta(lines);
  var fixes = _extractFixes(lines, meta.dateIso);

  return { meta: meta, fixes: fixes };
}

/** Convert parsed fixes to a full table with metrics. */
function _fixesToTable(parsed) {
  if (!parsed || parsed.fixes.length === 0) return [["Error","No B-records found"]];
  var out = [];
  out.push(["Pilot", parsed.meta.pilot, "Glider", parsed.meta.glider, "Reg", parsed.meta.reg, "Date", parsed.meta.dateIso, "TZ hint", parsed.meta.tzNote, "File", parsed.meta.fileName||""]);
  out.push(["Timestamp","Latitude","Longitude","GNSS Alt (m)","Press Alt (m)","Fix Valid","Elapsed (s)","ΔDist (m)","Cumulative Dist (m)","Bearing (°)","Ground Speed (km/h)","ΔAlt GNSS (m)","Vario (m/s)"]);

  var f = parsed.fixes, prev = null, cum = 0;
  for (var i=0;i<f.length;i++){
    var el = prev ? (f[i].ts - f[0].ts)/1000 : 0;
    var dt = prev ? (f[i].ts - prev.ts)/1000 : 0;
    var d=0, brg="", spd="", dAlt="", vario="";
    if (prev && dt>0){
      d = _haversine(prev.lat, prev.lon, f[i].lat, f[i].lon);
      cum += d;
      brg = _bearing(prev.lat, prev.lon, f[i].lat, f[i].lon);
      spd = (d/dt)*3.6;
      if (prev.gAlt!=null && f[i].gAlt!=null){
        dAlt = f[i].gAlt - prev.gAlt;
        vario = dAlt / dt;
      }
    }
    out.push([
      f[i].ts, f[i].lat, f[i].lon,
      f[i].gAlt==null?"":f[i].gAlt,
      f[i].pAlt==null?"":f[i].pAlt,
      f[i].valid||"",
      _round(el,1),
      _round(d,1),
      _round(cum,1),
      brg===""?"":_round(brg,1),
      spd===""?"":_round(spd,1),
      dAlt===""?"":dAlt,
      vario===""?"":_round(vario,2)
    ]);
    prev = f[i];
  }
  return out;
}

/** Build a compact summary table from parsed data. */
function _summaryFromParsed(parsed, sourceTag) {
  if (!parsed || parsed.fixes.length === 0) return [["Error","No B-records found"]];
  var f = parsed.fixes;
  var start = f[0].ts, end = f[f.length-1].ts, durationSec = Math.max(0,(end - start)/1000);

  // Distances/speeds/vario + altitude extrema
  var cum=0, maxSpd=0, maxVario=-1e9, minVario=1e9;
  var maxAlt = null, minAlt = null;
  for (var i=1;i<f.length;i++){
    var d = _haversine(f[i-1].lat, f[i-1].lon, f[i].lat, f[i].lon);
    cum += d;
    var dt = (f[i].ts - f[i-1].ts)/1000;
    if (dt>0){
      var spd = (d/dt)*3.6; // km/h
      if (spd>maxSpd) maxSpd=spd;
      if (f[i].gAlt!=null && f[i-1].gAlt!=null){
        var v = (f[i].gAlt - f[i-1].gAlt)/dt; // m/s
        if (v>maxVario) maxVario=v;
        if (v<minVario) minVario=v;
      }
    }
  }
  for (var k=0;k<f.length;k++){
    var a = (f[k].gAlt!=null)?f[k].gAlt : f[k].pAlt;
    if (a==null) continue;
    if (maxAlt==null || a>maxAlt) maxAlt=a;
    if (minAlt==null || a<minAlt) minAlt=a;
  }

  var takeoff = f[0], landing = f[f.length-1];

  return [
    ["Source", sourceTag||"", "File Name", parsed.meta.fileName||""],
    ["Pilot", parsed.meta.pilot], ["Glider", parsed.meta.glider], ["Registration", parsed.meta.reg],
    ["Flight Date (IGC)", parsed.meta.dateIso], ["TZ Hint", parsed.meta.tzNote],
    ["Fixes", f.length],
    ["Start Time", start], ["End Time", end],
    ["Duration (hh:mm:ss)", _fmtDur(durationSec)],
    ["Total Distance (km)", _round(cum/1000,2)],
    ["Max Ground Speed (km/h)", _round(maxSpd,1)],
    ["Max Climb (m/s)", maxVario===-1e9 ? "" : _round(maxVario,2)],
    ["Max Sink (m/s)",  minVario===1e9  ? "" : _round(minVario,2)],
    ["Max Alt (m)", maxAlt==null?"":maxAlt],
    ["Min Alt (m)", minAlt==null?"":minAlt],
    ["Takeoff Lat", takeoff.lat], ["Takeoff Lon", takeoff.lon],
    ["Landing Lat", landing.lat], ["Landing Lon", landing.lon]
  ];
}

/* =========================== PARSING HELPERS =========================== */

function _emptyMeta() { return { dateIso:null, pilot:"", glider:"", reg:"", tzNote:"", fileName:"" }; }

function _extractMeta(lines) {
  var meta = _emptyMeta();
  for (var i=0;i<lines.length;i++) {
    var ln = lines[i];
    if (ln.startsWith("HFDTE")) { // HFDTE130325
      var m = ln.match(/^HFDTE(\d{2})(\d{2})(\d{2})/);
      if (m) meta.dateIso = _igcDateToIso(m[1], m[2], m[3]);
    }
    if (/HFPLT|HOPLT/.test(ln)) {
      var m1 = ln.match(/(?:HFPLT|HOPLT).*?:\s*(.*)$/); if (m1) meta.pilot = m1[1].trim();
    }
    if (/HFGTY|HOGTY/.test(ln)) {
      var m2 = ln.match(/(?:HFGTY|HOGTY).*?:\s*(.*)$/); if (m2) meta.glider = m2[1].trim();
    }
    if (/HFGID|HOGID/.test(ln)) {
      var m3 = ln.match(/(?:HFGID|HOGID).*?:\s*(.*)$/); if (m3) meta.reg = m3[1].trim();
    }
    if (/HFTZNTIME|HFTZN/.test(ln)) {
      var tz = ln.replace(/^HF\w+.*?:/,'').trim(); if (tz) meta.tzNote = tz;
    }
  }
  if (!meta.dateIso) {
    var c = lines.find(function(l){ return l[0]==="C" && /\d{2}\.\d{2}\.\d{2}/.test(l); });
    if (c) {
      var m = c.match(/(\d{2})\.(\d{2})\.(\d{2})/);
      if (m) meta.dateIso = _igcDateToIso(m[1], m[2], m[3]);
    }
    if (!meta.dateIso) {
      var today = new Date();
      meta.dateIso = Utilities.formatDate(today, Session.getScriptTimeZone(), "yyyy-MM-dd");
    }
  }
  return meta;
}

function _extractFixes(lines, dateIso) {
  var fixes = [];
  for (var j=0;j<lines.length;j++) {
    var L = lines[j];
    if (L[0] !== "B") continue;

    // Positional parse per IGC spec:
    // B HHMMSS DDMMmmm N DDDMMmmm E V PPPPP GGGGG
    function seg(s,e){ return L.substring(s,e); }
    var hh = seg(1,3), mm = seg(3,5), ss = seg(5,7);
    var latDeg = seg(7,9), latMin = seg(9,11), latThou = seg(11,14), latHem = seg(14,15);
    var lonDeg = seg(15,18), lonMin = seg(18,20), lonThou = seg(20,23), lonHem = seg(23,24);
    var validity = seg(24,25);
    var pAltStr = seg(25,30);
    var gAltStr = seg(30,35);

    // Fallback regex for non-standard alt widths/omissions
    if (L.length < 35 || !/^\d{5}$/.test(pAltStr)) {
      var m = L.match(/^B(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})(\d{3})([NS])(\d{3})(\d{2})(\d{3})([EW])([AV]?)(\d{4,5})(\d{4,5})?/);
      if (!m) continue;
      hh=m[1]; mm=m[2]; ss=m[3];
      latDeg=m[4]; latMin=m[5]; latThou=m[6]; latHem=m[7];
      lonDeg=m[8]; lonMin=m[9]; lonThou=m[10]; lonHem=m[11];
      validity=m[12]||"";
      pAltStr=m[13]||""; gAltStr=m[14]||"";
    }

    var lat = _dmToDec(latDeg, latMin, latThou, latHem, true);
    var lon = _dmToDec(lonDeg, lonMin, lonThou, lonHem, false);
    if (lat === "" || lon === "") continue;

    var pAlt = _toIntSafe(pAltStr);
    var gAlt = _toIntSafe(gAltStr);

    var ts = new Date(dateIso + "T" + hh + ":" + mm + ":" + ss);
    fixes.push({ ts: ts, lat: lat, lon: lon,
                 gAlt: isNaN(gAlt)?null:gAlt,
                 pAlt: isNaN(pAlt)?null:pAlt,
                 valid: validity||"" });
  }
  return fixes;
}

/* ============================== UTILITIES ============================== */

function _maybeGunzipToText(blob, contentType, filename) {
  var name = (filename || "").toLowerCase();
  var ct = (contentType || "").toLowerCase();
  var bytes = blob.getBytes();
  var looksGz = bytes && bytes.length>=2 && bytes[0]===0x1f && bytes[1]===0x8b;
  var isGz = looksGz || name.endsWith(".gz") || ct.indexOf("gzip") >= 0;
  if (isGz) return Utilities.newBlob(Utilities.gunzip(blob)).getDataAsString();
  return blob.getDataAsString();
}

function _igcDateToIso(dd, mm, yy) {
  var d = parseInt(dd,10), m = parseInt(mm,10), y = parseInt(yy,10);
  y = y < 80 ? 2000 + y : 1900 + y; // common IGC convention
  var date = new Date(Date.UTC(y, m - 1, d));
  return Utilities.formatDate(date, "UTC", "yyyy-MM-dd");
}

function _dmToDec(degStr, minStr, thouStr, hemi, isLat) {
  var deg = parseInt(degStr,10);
  var minutes = parseInt(minStr,10) + parseInt(thouStr||"0",10)/1000.0;
  var dec = deg + minutes/60.0;
  if (hemi === "S" || hemi === "W") dec = -dec;
  if (isLat) { if (dec > 90 || dec < -90) return ""; }
  else       { if (dec > 180 || dec < -180) return ""; }
  return dec;
}

function _toIntSafe(s){ var n = parseInt(String(s||"").replace(/[^\d-]/g,""),10); return isNaN(n)?NaN:n; }

function _haversine(lat1, lon1, lat2, lon2) {
  var R = 6371000; // meters
  var toRad = Math.PI/180;
  var dLat = (lat2-lat1)*toRad;
  var dLon = (lon2-lon1)*toRad;
  var a = Math.sin(dLat/2)**2 + Math.cos(lat1*toRad)*Math.cos(lat2*toRad)*Math.sin(dLon/2)**2;
  var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R*c;
}

function _bearing(lat1, lon1, lat2, lon2) {
  var toRad = Math.PI/180, toDeg = 180/Math.PI;
  var φ1 = lat1*toRad, φ2 = lat2*toRad, λ1 = lon1*toRad, λ2 = lon2*toRad;
  var y = Math.sin(λ2-λ1)*Math.cos(φ2);
  var x = Math.cos(φ1)*Math.sin(φ2) - Math.sin(φ1)*Math.cos(φ2)*Math.cos(λ2-λ1);
  var θ = Math.atan2(y,x)*toDeg;
  return (θ+360)%360;
}

function _round(v, p){ return (typeof v==="number" && isFinite(v)) ? Math.round(v*Math.pow(10,p))/Math.pow(10,p) : v; }

function _fmtDur(s){
  s = Math.max(0, Math.floor(s));
  var h = Math.floor(s/3600), m = Math.floor((s%3600)/60), ss = s%60;
  return (""+h).padStart(2,"0")+":" + (""+m).padStart(2,"0")+":" + (""+ss).padStart(2,"0");
}
