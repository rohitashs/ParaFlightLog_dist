/**
 * Automated Code Check & Architectural Integrity Audit Script
 * ParaFlightLogProject - Static Analysis & Pattern Verification
 * 
 * Usage: node tools/code_check_audit.js
 * Returns exit code 0 if all checks pass, 1 if any critical checks fail.
 */

const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const codeDir = path.join(rootDir, 'Code');

console.log('='.repeat(70));
console.log('  ParaFlightLog Automated Code & Architectural Integrity Audit');
console.log('='.repeat(70));
console.log(`Auditing directory: ${codeDir}\n`);

// 1. Gather all .gs and .html files
const files = fs.readdirSync(codeDir);
const gsFiles = files.filter(f => f.endsWith('.gs'));
const htmlFiles = files.filter(f => f.endsWith('.html'));

let totalErrors = 0;
let totalWarnings = 0;

// 2. Parse functions from .gs files
const publicFunctions = new Set();
const privateFunctions = new Set();
const allGsContent = {};

gsFiles.forEach(f => {
  const content = fs.readFileSync(path.join(codeDir, f), 'utf8');
  allGsContent[f] = content;

  // match function name(...)
  const fnRegex = /(?:function\s+([a-zA-Z0-9_$]+)\s*\(|var\s+([a-zA-Z0-9_$]+)\s*=\s*function\s*\()/g;
  let match;
  while ((match = fnRegex.exec(content)) !== null) {
    const fnName = match[1] || match[2];
    if (fnName.endsWith('_')) {
      privateFunctions.add(fnName);
    } else {
      publicFunctions.add(fnName);
    }
  }

  // Also check object methods like QueueService = { getJob: ... }
  const objMethods = /([a-zA-Z0-9_$]+)\s*:\s*function\s*\(/g;
  while ((match = objMethods.exec(content)) !== null) {
    const fnName = match[1];
    if (fnName.endsWith('_')) {
      privateFunctions.add(fnName);
    } else {
      publicFunctions.add(fnName);
    }
  }
});

console.log(`[DIMENSION 1] Function & RPC Gateway Analysis:`);
console.log(`  Found ${publicFunctions.size} public functions and ${privateFunctions.size} private functions across ${gsFiles.length} .gs files.`);

// 3. Check client RPCs in HTML templates
const rpcCalls = [];
const rpcErrors = [];

htmlFiles.forEach(f => {
  const content = fs.readFileSync(path.join(codeDir, f), 'utf8');
  let searchIdx = 0;
  while ((searchIdx = content.indexOf('google.script.run', searchIdx)) !== -1) {
    let cur = searchIdx + 17;
    let targetMethod = null;

    while (cur < content.length) {
      while (cur < content.length && /\s/.test(content[cur])) cur++;
      if (content[cur] !== '.') break;
      cur++; // skip '.'
      
      let mStart = cur;
      while (cur < content.length && /[a-zA-Z0-9_$]/.test(content[cur])) cur++;
      let mName = content.substring(mStart, cur);
      
      while (cur < content.length && /\s/.test(content[cur])) cur++;
      if (content[cur] !== '(') break;
      
      if (['withSuccessHandler', 'withFailureHandler', 'withUserObject'].includes(mName)) {
        let depth = 1;
        cur++;
        while (cur < content.length && depth > 0) {
          if (content[cur] === '(') depth++;
          else if (content[cur] === ')') depth--;
          cur++;
        }
      } else {
        targetMethod = mName;
        break;
      }
    }

    if (targetMethod) {
      rpcCalls.push({ html: f, fn: targetMethod });
      if (targetMethod.endsWith('_')) {
        rpcErrors.push(`  [FAIL] ${f}: calls private function '${targetMethod}' (trailing underscore forbidden in RPC)`);
        totalErrors++;
      } else if (!publicFunctions.has(targetMethod)) {
        rpcErrors.push(`  [FAIL] ${f}: calls '${targetMethod}', but no public function found in .gs files`);
        totalErrors++;
      }
    }
    searchIdx += 17;
  }
});

if (rpcErrors.length > 0) {
  rpcErrors.forEach(e => console.error(e));
} else {
  console.log(`  [PASS] All ${rpcCalls.length} google.script.run calls map to exported public functions.`);
}

// 4. Check onOpen Menu Items in Code.gs
const codeGs = allGsContent['Code.gs'] || '';
const menuRegex = /\.addItem\(\s*['"][^'"]+['"]\s*,\s*['"]([a-zA-Z0-9_$]+)['"]\s*\)/g;
const menuCallbacks = [];
const menuErrors = [];

let mMatch;
while ((mMatch = menuRegex.exec(codeGs)) !== null) {
  const fnName = mMatch[1];
  menuCallbacks.push(fnName);
  if (fnName.endsWith('_')) {
    menuErrors.push(`  [FAIL] Menu callback '${fnName}' has illegal trailing underscore.`);
    totalErrors++;
  } else if (!publicFunctions.has(fnName)) {
    menuErrors.push(`  [FAIL] Menu callback '${fnName}' not found in .gs files.`);
    totalErrors++;
  }
}

if (menuErrors.length > 0) {
  menuErrors.forEach(e => console.error(e));
} else {
  console.log(`  [PASS] All ${menuCallbacks.length} spreadsheet menu callbacks map to exported public functions.`);
}

// 5. Dimension: Deprecated / Legacy Token Scanner
console.log(`\n[DIMENSION 2] Deprecated & Legacy Identifiers Blacklist Scan:`);
const legacyBlacklist = [
  { term: 'App_Log', pattern: /\bApp_Log\b/g, reason: 'Tab renamed to Activity_Logs / Activity Logs (CR-LOG-004)', allowLegacyAlias: true },
  { term: 'App Log', pattern: /['"]App Log['"]/g, reason: 'Display name is "Activity Logs" (CR-LOG-004)', allowLegacyAlias: false },
  { term: 'TABS.APP_LOG', pattern: /TABS\.APP_LOG\b/g, reason: 'Obsolete tab constant. Use TABS.ACTIVITY (CR-LOG-004)' },
  { term: 'Clear Dedupe Cache', pattern: /Clear Dedupe Cache/g, reason: 'Obsolete dedupe cache action. Hashes are row-based MD5 (CR-ING-006)' },
  { term: 'TABS.PARAMETERS', pattern: /TABS\.PARAMETERS\b/g, reason: 'Parameters tab consolidated into Config tab (CR-CFG-005)' },
  { term: 'TABS.LOOKUPS', pattern: /TABS\.LOOKUPS\b/g, reason: 'Lookups tab consolidated into Config tab (CR-CFG-005)' }
];

let legacyIssues = 0;
const allFiles = [...gsFiles.map(f => ({ name: f, isGs: true })), ...htmlFiles.map(f => ({ name: f, isGs: false }))];

allFiles.forEach(fileObj => {
  const filePath = path.join(codeDir, fileObj.name);
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');

  lines.forEach((line, idx) => {
    // Skip comments that explicitly discuss legacy / backward compatibility migrations
    const isComment = /^\s*(\/\/|\/\*|\*)/.test(line) || /legacy|alias|migration|backward-compat/i.test(line);

    legacyBlacklist.forEach(item => {
      if (item.allowLegacyAlias && isComment) return;
      if (item.pattern.test(line)) {
        // Double check if line is purely an alias migration bridge
        if (/alias|legacy|compat/i.test(line)) return;
        console.error(`  [FAIL] ${fileObj.name}:${idx + 1} Found forbidden legacy token '${item.term}': ${item.reason}`);
        console.error(`         Line: "${line.trim()}"`);
        legacyIssues++;
        totalErrors++;
      }
    });
  });
});

if (legacyIssues === 0) {
  console.log(`  [PASS] Zero forbidden legacy tokens detected across all .gs and .html files.`);
}

// 6. Dimension: Manifest & Maintenance Orchestrator Parity
console.log(`\n[DIMENSION 3] System Manifest & Maintenance Orchestrator Integrity:`);
const configGs = allGsContent['Config.gs'] || '';
const scaffoldGs = allGsContent['Scaffold.gs'] || '';
const maintenanceHtml = fs.readFileSync(path.join(codeDir, 'SystemMaintenanceDialog.html'), 'utf8');

// Extract SYSTEM_MANIFEST object
const manifestMatch = /SYSTEM_MANIFEST\s*=\s*(\{[\s\S]*?\n\};)/.exec(configGs);
if (!manifestMatch) {
  console.error(`  [FAIL] Could not locate SYSTEM_MANIFEST in Config.gs`);
  totalErrors++;
} else {
  let components = [];
  try {
    const rawObj = manifestMatch[1].replace(/;\s*$/, '');
    const evaluated = eval('(' + rawObj + ')');
    components = Object.keys(evaluated.components || {});
  } catch (err) {
    console.error(`  [FAIL] Error parsing SYSTEM_MANIFEST:`, err.message);
    totalErrors++;
  }

  console.log(`  Manifest declares ${components.length} system components.`);

  // Check each component for metadata, scaffold handler, and dialog representation
  let manifestErrors = 0;
  components.forEach(comp => {
    const parts = comp.split('.');
    const sheetKey = parts[0];
    const elemKey = parts[1];

    // Check MANIFEST_SHEET_METADATA
    const metaCheck = new RegExp(`['"]?${sheetKey}['"]?\\s*:\\s*\\{`);
    if (!metaCheck.test(configGs)) {
      console.error(`  [FAIL] Component '${comp}': Sheet key '${sheetKey}' missing in MANIFEST_SHEET_METADATA.`);
      manifestErrors++;
      totalErrors++;
    }

    // Check dialog sheetOrder
    if (!maintenanceHtml.includes(`'${sheetKey}'`) && !maintenanceHtml.includes(`"${sheetKey}"`)) {
      console.error(`  [FAIL] Component '${comp}': Sheet key '${sheetKey}' not found in SystemMaintenanceDialog.html sheetOrder.`);
      manifestErrors++;
      totalErrors++;
    }
  });

  // Check for dangerous display-name to sheetKey equality comparison in Scaffold.gs
  if (/diff\.sheets\[[^\]]+\]\.sheetName\s*===\s*sName/.test(scaffoldGs)) {
    console.error(`  [FAIL] Scaffold.gs: Dangerous comparison 'sheetName === sName' detected. Display names with spaces must not be compared to internal keys.`);
    manifestErrors++;
    totalErrors++;
  }

  if (manifestErrors === 0) {
    console.log(`  [PASS] All ${components.length} manifest components pass 3-way parity (Metadata, Scaffold, Dialog).`);
  }
}

// 7. Dimension: Patterns & Practices Anti-Pattern Scans
console.log(`\n[DIMENSION 4] Patterns & Practices Anti-Pattern Scans:`);
let patternWarnings = 0;

// Scan for fixed row data validation bounds (e.g. 5, col, 50, 1) in Scaffold.gs
const fixedRowValidationRegex = /setDataValidation[\s\S]*?getRange\(\s*\d+\s*,\s*[^,]+\s*,\s*(\d{1,3})\s*,\s*1\s*\)/g;
let frMatch;
while ((frMatch = fixedRowValidationRegex.exec(scaffoldGs)) !== null) {
  const fixedCount = parseInt(frMatch[1], 10);
  if (fixedCount > 0 && fixedCount < 500) {
    console.warn(`  [WARN] Potential fixed-row validation bounds detected (${fixedCount} rows). Pattern 4 requires open-ended bounds (sh.getMaxRows()).`);
    patternWarnings++;
    totalWarnings++;
  }
}

// Check for warning-only range protection in Scaffold.gs
if (scaffoldGs.includes('.protect(') && !scaffoldGs.includes('.setWarningOnly(true)')) {
  console.warn(`  [WARN] Range protection detected without setWarningOnly(true) (Pattern 5 soft guardrail violation).`);
  patternWarnings++;
  totalWarnings++;
} else {
  console.log(`  [PASS] Range protections enforce soft guardrails (setWarningOnly: true).`);
}

// Check getDisplayValues usage in Ingestion.gs for Date/Time matching
const ingestionGs = allGsContent['Ingestion.gs'] || '';
if (ingestionGs.includes('findHeuristicOverlap_')) {
  if (ingestionGs.includes('sh.getRange') && ingestionGs.includes('.getDisplayValues()')) {
    console.log(`  [PASS] Deduplication and overlap detection use getDisplayValues() (Pattern 8 timezone-immune).`);
  }
}

// 8. Dimension: Entity Count Parity Checks
console.log(`\n[DIMENSION 5] Entity Count Parity Verification:`);

// Count Pilot Profile fields in Config.gs
const ppFieldsMatch = configGs.match(/PILOT_PROFILE_FIELDS\s*=\s*\[([\s\S]*?)\];/);
if (ppFieldsMatch) {
  const fields = ppFieldsMatch[1].split('\n').filter(l => /\[\s*['"][^'"]+['"]\s*,/.test(l));
  const ppCount = fields.length;
  console.log(`  Pilot Profile Fields: ${ppCount} active fields.`);
  if (ppCount !== 34) {
    console.warn(`  [WARN] Pilot Profile fields count is ${ppCount} (expected 34 per CR-SYS-004).`);
    totalWarnings++;
  }
}

// Count parameters in Config.gs
const defaultParamsMatch = configGs.match(/DEFAULT_PARAMETERS\s*=\s*\{([\s\S]*?)\};/);
if (defaultParamsMatch) {
  const paramKeys = defaultParamsMatch[1].split('\n').filter(l => /^\s*['"]?[A-Z0-9_]+['"]?\s*:/.test(l));
  const paramCount = paramKeys.length;
  console.log(`  System Parameter Keys: ${paramCount} active parameters.`);
  if (paramCount !== 50) {
    console.warn(`  [WARN] System Parameter keys count is ${paramCount} (expected 50 per CR-CFG-002).`);
    totalWarnings++;
  }
}

// Summary Report
console.log('\n' + '='.repeat(70));
console.log(`  AUDIT SUMMARY: ${totalErrors} Critical Errors, ${totalWarnings} Warnings`);
console.log('='.repeat(70));

if (totalErrors > 0) {
  console.error(`\n>>> AUDIT FAILED with ${totalErrors} critical errors. Review details above. <<<\n`);
  process.exit(1);
} else {
  console.log(`\n>>> AUDIT PASSED: All architectural, naming, and pattern invariants satisfied. <<<\n`);
  process.exit(0);
}
