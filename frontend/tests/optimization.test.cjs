require('../scripts/register.cjs');
const test = require('node:test'),
  assert = require('node:assert/strict'),
  fs = require('node:fs'),
  path = require('node:path'),
  Module = require('node:module'),
  babel = require('@babel/core');
function reference(name) {
  const filename = path.resolve(__dirname, '../src/sim/' + (name === 'solar' ? '' : 'advanced/') + 'reference-' + name + '.js'),
    mod = new Module(filename, module);
  mod.filename = filename;
  mod.paths = Module._nodeModulePaths(path.dirname(filename));
  const text = fs.readFileSync(path.resolve(__dirname, 'fixtures/' + name + '-before.txt'), 'utf8');
  const code = babel.transformSync(text, {
    configFile: false,
    babelrc: false,
    plugins: [require.resolve('@babel/plugin-transform-modules-commonjs')]
  }).code;
  mod._compile(code, filename);
  return mod.exports;
}
const oldH = reference('harmonics'),
  oldO = reference('ocean');
const h = require('../src/sim/advanced/harmonics'),
  o = require('../src/sim/advanced/oceanTides');
test('optimized harmonics and ocean coefficients retain exact IEEE-754 outputs', () => {
  for (const t of [-1e7, -1000, 0, 1000, 86400, 1e7]) {
    assert.deepEqual(o.oceanCoefficients(t), oldO.oceanCoefficients(t));
    for (const r of [[7e6, 2e5, -3e4], [1, 0, 7e6], [-8e6, 400, -500]]) for (const degree of [0, 2, 4, 8]) {
      assert.equal(h.harmonicPotential(r, 3.986004418e14, degree), oldH.harmonicPotential(r, 3.986004418e14, degree));
      assert.deepEqual(h.harmonicAcceleration(r, 3.986004418e14, t, 86164, degree), oldH.harmonicAcceleration(r, 3.986004418e14, t, 86164, degree));
    }
  }
});
test('ocean optimization preserves fresh values and observes coefficient and topology edits', () => {
  const data = o.oceanTideData,
    original = data.rows;
  try {
    const a = o.oceanCoefficients(0);
    a[0].c = 999;
    assert.deepEqual(o.oceanCoefficients(0), oldO.oceanCoefficients(0));
    data.rows = original.map(r => ({
      ...r
    }));
    data.rows[0].cp += 1e-10;
    assert.deepEqual(o.oceanCoefficients(0), oldO.oceanCoefficients(0));
    data.rows.reverse();
    assert.deepEqual(o.oceanCoefficients(0), oldO.oceanCoefficients(0));
  } finally {
    data.rows = original;
  }
});
test('optimized trajectories match all pre-change serialized states exactly', () => {
  const {
      ExplorationSim
    } = require('../src/sim/exploration'),
    fixture = require('./fixtures/pre-optimization.json');
  for (const c of fixture.records) {
    const sim = new ExplorationSim(c.body, 'pathfinder', c.initialTime, undefined, c.options);
    for (let i = 0; i < c.requests; i++) sim.advance(c.seconds);
    assert.deepEqual(JSON.parse(JSON.stringify(sim.serialize())), c.state, c.body + '/' + JSON.stringify(c.options));
  }
});
test('Kepler convergence shortcut preserves exact positions and velocities for all worlds and epochs', () => {
  const old = reference('solar'),
    current = require('../src/sim/solarSystem');
  for (const b of current.BODIES) for (const t of [-1e10, -1234567, 0, 1, 86400, 1e8, 1e10]) assert.deepEqual(current.bodyState(b.id, t), old.bodyState(b.id, t), b.id + '/' + t);
});
