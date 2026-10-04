const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const codeDir = path.join(rootDir, 'Code');

global.SpreadsheetApp = {
  getActive: () => ({
    toast: (msg) => console.log('Toast:', msg),
    getSheetByName: (name) => null
  }),
  getUi: () => null,
  newDataValidation: () => ({
    requireValueInList: () => ({
      setAllowInvalid: () => ({
        build: () => ({})
      })
    })
  })
};
global.PropertiesService = {
  _store: {},
  getDocumentProperties: () => ({
    getProperty: (k) => global.PropertiesService._store[k] || null,
    setProperty: (k, v) => { global.PropertiesService._store[k] = v; },
    deleteProperty: (k) => { delete global.PropertiesService._store[k]; }
  })
};
global.Session = {

  getScriptTimeZone: () => 'UTC'
};
global.Utilities = {
  formatDate: (d, tz, fmt) => d.toISOString(),
  computeDigest: (algo, text) => {
    const crypto = require('crypto');
    const hash = crypto.createHash('md5').update(text).digest();
    return Array.from(hash);
  },
  DigestAlgorithm: { MD5: 'MD5' }
};

// Load codebase
eval(fs.readFileSync(path.join(codeDir, 'Config.gs'), 'utf8'));
eval(fs.readFileSync(path.join(codeDir, 'Utils.gs'), 'utf8'));
eval(fs.readFileSync(path.join(codeDir, 'Logger.gs'), 'utf8'));
eval(fs.readFileSync(path.join(codeDir, 'Geo.gs'), 'utf8'));
eval(fs.readFileSync(path.join(codeDir, 'Ingestion.gs'), 'utf8'));
eval(fs.readFileSync(path.join(codeDir, 'Parser.gs'), 'utf8'));
eval(fs.readFileSync(path.join(codeDir, 'Analysis.gs'), 'utf8'));
eval(fs.readFileSync(path.join(codeDir, 'Scoring.gs'), 'utf8'));
eval(fs.readFileSync(path.join(codeDir, 'FileHandling.gs'), 'utf8'));
eval(fs.readFileSync(path.join(codeDir, 'TimeBudget.gs'), 'utf8'));
eval(fs.readFileSync(path.join(codeDir, 'QueueService.gs'), 'utf8'));
eval(fs.readFileSync(path.join(codeDir, 'AutomationConfig.gs'), 'utf8'));
eval(fs.readFileSync(path.join(codeDir, 'Automation.gs'), 'utf8'));
eval(fs.readFileSync(path.join(codeDir, 'Scaffold.gs'), 'utf8'));
eval(fs.readFileSync(path.join(codeDir, 'Code.gs'), 'utf8'));
eval(fs.readFileSync(path.join(rootDir, 'tests', 'Test.gs'), 'utf8'));

function testTimeBudget_() {
  const budget = TimeBudgetService.create(5000);
  if (budget.isExhausted()) return { idx: false, error: 'Budget should not be exhausted initially' };
  if (!budget.hasTimeRemaining()) return { idx: false, error: 'Budget should have time remaining' };
  if (budget.remainingSeconds() <= 0) return { idx: false, error: 'Remaining seconds should be positive' };
  return { idx: true };
}

function testQueueConstants_() {
  if (TABS.QUEUE.name !== 'Automation_Queue') return { idx: false, error: 'TABS.QUEUE name mismatch' };
  if (QueueService.STATUS.QUEUED !== 'QUEUED') return { idx: false, error: 'QueueService STATUS.QUEUED mismatch' };
  if (QueueService.STATUS.RUNNING !== 'RUNNING') return { idx: false, error: 'QueueService STATUS.RUNNING mismatch' };
  if (QueueService.STATUS.CHECKPOINT_PAUSED !== 'CHECKPOINT_PAUSED') return { idx: false, error: 'QueueService STATUS.CHECKPOINT_PAUSED mismatch' };
  return { idx: true };
}

function testWorkerBatchRouting_() {
  if (typeof executeWorkerBatch !== 'function') return { idx: false, error: 'executeWorkerBatch missing' };
  if (typeof finalizeWorkerJob !== 'function') return { idx: false, error: 'finalizeWorkerJob missing' };

  try {
    executeWorkerBatch('INVALID_TYPE', [], {}, 0);
    return { idx: false, error: 'Should throw on unsupported jobType' };
  } catch (e) {
    if (e.message.indexOf('Unsupported jobType') === -1) {
      return { idx: false, error: 'Unexpected error message: ' + e.message };
    }
  }

  return { idx: true };
}

const results = [];
results.push(testParser_());
results.push(testAnalysis_());
results.push(testScoring_());
results.push(testCleanDriveId_());
results.push(testLogProcessResolution_());
results.push(testLogLevelFiltering_());
results.push(testConservativePruningMath_());
results.push(testTimeBudget_());
results.push(testQueueConstants_());
results.push(testWorkerBatchRouting_());
results.push(testDedupeEngineEnhancements_());
results.push(testStatusChangeUtility_());
results.push(testDynamicFormulaResilience_());
results.push(testSystemMaintenanceAndManifest_());
results.push(testAutomationEngine_());
results.push(testAutoSummaryFormat_());

const failures = results.filter(r => !r.idx || r.error);
console.log('Results summary: Total=' + results.length + ', Passed=' + (results.length - failures.length) + ', Failed=' + failures.length);
if (failures.length > 0) {
  console.error('FAILURES:', failures);
  process.exit(1);
} else {
  console.log('ALL OFFLINE SUITE TESTS (INCLUDING TIMEBUDGET & QUEUE) PASSED PERFECTLY!');
  process.exit(0);
}
