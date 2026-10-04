const assert = require('assert');
const fs = require('fs');
const path = require('path');

// Setup mock GAS environment
const rootDir = path.resolve(__dirname, '..');
const codeDir = path.join(rootDir, 'Code');

global.TABS = {
  FLIGHTS: { name: 'Flights' }
};
global.LOG = {
  write: () => {}
};
global.Utilities = {
  formatDate: (d, tz, fmt) => {
    const dateObj = new Date(d);
    const y = dateObj.getUTCFullYear();
    const m = ('0' + (dateObj.getUTCMonth() + 1)).slice(-2);
    const day = ('0' + dateObj.getUTCDate()).slice(-2);
    return `${y}${m}${day}`;
  }
};

// Load Code.gs into execution scope
const codeContent = fs.readFileSync(path.join(codeDir, 'Code.gs'), 'utf8');

// Mock helpers needed by resyncFlightIdsBatch_
global.getColumnMap_ = (sh) => ({
  'FlightID': 1,
  'Status': 2,
  'Flight No': 3,
  'Auto Summary': 4,
  'IGC File': 5,
  'Notes': 6,
  'Flight Type': 7,
  'Date': 8,
  'Time Zone': 9,
  'Launch Time': 10
});

// Evaluate Code.gs partially or mock functions from Code.gs
eval(codeContent.slice(codeContent.indexOf('function parseTimeToMinutes_')));

console.log('Testing parseTimeToMinutes_...');
assert.strictEqual(parseTimeToMinutes_('9:30 AM'), 570);
assert.strictEqual(parseTimeToMinutes_('9:30 am'), 570);
assert.strictEqual(parseTimeToMinutes_('12:00 AM'), 0);
assert.strictEqual(parseTimeToMinutes_('12:15 AM'), 15);
assert.strictEqual(parseTimeToMinutes_('12:00 PM'), 720);
assert.strictEqual(parseTimeToMinutes_('2:30 PM'), 870);
assert.strictEqual(parseTimeToMinutes_('14:30'), 870);
assert.strictEqual(parseTimeToMinutes_('09:05:30'), 545);
assert.strictEqual(parseTimeToMinutes_(''), null);
assert.strictEqual(parseTimeToMinutes_(null), null);
assert.strictEqual(parseTimeToMinutes_('invalid'), null);
console.log('[PASS] parseTimeToMinutes_ handles all 12h/24h formats correctly');

// Mock Sheet setup
console.log('Testing resyncFlightIdsBatch_...');
const mockGrid = [
  // Row 5: 2:00 PM flight with SeeYou link formula
  { row: 5, id: '=HYPERLINK("https://cloud.seeyou.cloud/?track=abc", "F20240515_10")', formula: '=HYPERLINK("https://cloud.seeyou.cloud/?track=abc", "F20240515_10")', date: '2024-05-15', time: '2:00 PM', flightNo: 102, notes: '[DupRef: D01 | Others: F20240515_11]' },
  // Row 6: 9:30 AM flight
  { row: 6, id: 'F20240515_11', formula: '', date: '2024-05-15', time: '9:30 AM', flightNo: 101, notes: '[DupRef: D01 | Primary: F20240515_10]' },
  // Row 7: Flight with no launch time
  { row: 7, id: 'F20240515_12', formula: '', date: '2024-05-15', time: '', flightNo: 103, notes: 'Standalone flight' },
  // Row 8: Flight on different date
  { row: 8, id: 'F20240516_10', formula: '', date: '2024-05-16', time: '11:00 AM', flightNo: 104, notes: '' },
  // Row 9: Date mismatch test (Date col is 2024-05-20, FlightID has old 1-day offset F20240519_01)
  { row: 9, id: 'F20240519_01', formula: '', date: '2024-05-20', time: '10:00 AM', flightNo: 105, notes: '' }
];

const mockSheet = {
  getLastRow: () => 9,
  getSpreadsheetTimeZone: () => 'UTC',
  getRange: (r, c, nr, nc) => {
    nr = nr || 1;
    nc = nc || 1;
    return {
      getFormulas: () => {
        const out = [];
        for (let idx = 0; idx < nr; idx++) {
          out.push([mockGrid[r - 5 + idx].formula]);
        }
        return out;
      },
      getValues: () => {
        const out = [];
        for (let idx = 0; idx < nr; idx++) {
          const item = mockGrid[r - 5 + idx];
          if (c === 1) out.push([item.id]);
          else if (c === 8) out.push([item.date]);
          else if (c === 10) out.push([item.time]);
          else if (c === 3) out.push([item.flightNo]);
          else if (c === 6) out.push([item.notes]);
          else out.push(['']);
        }
        return out;
      },
      getDisplayValues: () => {
        const out = [];
        for (let idx = 0; idx < nr; idx++) {
          const item = mockGrid[r - 5 + idx];
          if (c === 1) out.push([item.id]);
          else if (c === 8) out.push([item.date]);
          else if (c === 10) out.push([item.time]);
          else if (c === 3) out.push([String(item.flightNo)]);
          else if (c === 6) out.push([item.notes]);
          else out.push(['']);
        }
        return out;
      },
      setValue: (val) => {
        const item = mockGrid[r - 5];
        if (c === 1) {
          item.id = val;
          if (String(val).startsWith('=')) item.formula = val;
        } else if (c === 6) {
          item.notes = val;
        }
      }
    };
  }
};

global.getActualFlightRows_ = () => [
  { row: 5 }, { row: 6 }, { row: 7 }, { row: 8 }, { row: 9 }
];

global.SpreadsheetApp = {
  getActive: () => ({
    getSheetByName: (name) => (name === 'Flights' ? mockSheet : null),
    getSpreadsheetTimeZone: () => 'UTC',
    toast: (msg) => console.log('Toast:', msg)
  })
};

const result = resyncFlightIdsBatch_();
console.log('Result:', result);
assert.strictEqual(result.success, true);
assert.strictEqual(result.updatedCount, 5);
assert.strictEqual(result.dateMismatchCount, 1);

// Row 6 (9:30 AM) was earliest on 2024-05-15 -> F20240515_01
assert.strictEqual(mockGrid[1].id, 'F20240515_01');

// Row 5 (2:00 PM) was second on 2024-05-15 -> F20240515_02, preserved hyperlink formula
assert.strictEqual(mockGrid[0].id, '=HYPERLINK("https://cloud.seeyou.cloud/?track=abc", "F20240515_02")');

// Row 7 (no time) went to tail end -> F20240515_03
assert.strictEqual(mockGrid[2].id, 'F20240515_03');

// Row 8 (different date) -> F20240516_01
assert.strictEqual(mockGrid[3].id, 'F20240516_01');

// Row 9 (repaired date mismatch from F20240519_01 to F20240520_01)
assert.strictEqual(mockGrid[4].id, 'F20240520_01');

// Reciprocal duplicate notes:
// Row 5 old was F20240515_10, Row 6 old was F20240515_11
// In Row 5 notes: '[DupRef: D01 | Others: F20240515_11]' -> '[DupRef: D01 | Others: F20240515_01]'
assert.strictEqual(mockGrid[0].notes, '[DupRef: D01 | Others: F20240515_01]');
// In Row 6 notes: '[DupRef: D01 | Primary: F20240515_10]' -> '[DupRef: D01 | Primary: F20240515_02]'
assert.strictEqual(mockGrid[1].notes, '[DupRef: D01 | Primary: F20240515_02]');

console.log('[PASS] resyncFlightIdsBatch_ passed all test assertions!');
