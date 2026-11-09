// Keep generated test output outside the source tree.
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const output = path.join(os.tmpdir(), 'mission-forge-test-results');
fs.mkdirSync(output, { recursive: true });
module.exports = output;
