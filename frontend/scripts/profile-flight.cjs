require('./register.cjs');
// Load frozen pre-optimization implementations in an isolated comparison process.
// The application sources and production build are never changed by this probe.
if (process.env.MF_PROFILE_REFERENCE === '1') {
  const fs = require('node:fs'), path = require('node:path'), babel = require('@babel/core');
  const references = new Map([
    ['../src/sim/advanced/harmonics.js', 'harmonics'],
    ['../src/sim/advanced/oceanTides.js', 'ocean'],
    ['../src/sim/solarSystem.js', 'solar'],
  ].map(([file, name]) => [path.resolve(__dirname, file), path.resolve(__dirname, '../tests/fixtures/' + name + '-before.txt')]));
  const load = require.extensions['.js'];
  require.extensions['.js'] = (mod, filename) => {
    if (!references.has(filename)) return load(mod, filename);
    const { code } = babel.transformSync(fs.readFileSync(references.get(filename), 'utf8'), {
      filename, configFile: false, babelrc: false,
      plugins: [require.resolve('@babel/plugin-transform-modules-commonjs')],
    });
    mod._compile(code, filename);
  };
}
const fs = require('node:fs'),
  path = require('node:path'),
  assert = require('node:assert/strict');
const {
  ExplorationSim
} = require('../src/sim/exploration');
const configurations = [['central', {}], ['advanced', {
  j2: true,
  harmonicDegree: 8,
  thirdBody: true,
  srp: true,
  tides: true,
  advancedTides: true,
  oceanTides: true,
  relativity: true,
  power: true,
  communications: true,
  damage: true
}], ['adaptive', {
  integrator: 'accurate',
  thirdBody: true,
  srp: true,
  damage: true
}]];
const cases = [];
for (const [name, options] of configurations) for (const requestedSeconds of [.1, 10, 1000]) {
  const sim = new ExplorationSim('earth', 'pathfinder', 0, 600000, options),
    samples = [];
  for (let i = 0; i < 10; i++) sim.advance(requestedSeconds);
  for (let i = 0; i < 100; i++) {
    const start = performance.now();
    sim.advance(requestedSeconds);
    samples.push(performance.now() - start);
    assert.ok([...sim.r, ...sim.v].every(Number.isFinite));
  }
  samples.sort((a, b) => a - b);
  cases.push({
    name,
    requestedSeconds,
    requests: 100,
    medianMs: samples[50],
    p95Ms: samples[94],
    maxMs: samples[99],
    finalSimulationTime: sim.t,
    stateSHA256: require("node:crypto").createHash("sha256").update(JSON.stringify(sim.serialize())).digest("hex")
  });
}
const report = {
  checkedAt: new Date().toISOString(),
  runtime: process.version,
  platform: process.platform,
  scope: 'Single-vessel Earth 600 km coasts; 10 warmups then 100 bounded advance calls per setting. Timings include this environment and are not physical-device certification.',
  cases,
  decision: 'Retain the existing integration steps, force models, rendering quality and requested warp behavior. Optimize repeated harmonic, tide and Kepler calculations with exact-result regression checks. No automatic step-budget throttling is active. The isolated Wasm component remains a diagnostic experiment, not a flight-engine replacement.'
};
fs.writeFileSync(process.env.MF_PROFILE_OUTPUT || path.resolve(__dirname, '../../docs/submission/performance-profile.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report));
