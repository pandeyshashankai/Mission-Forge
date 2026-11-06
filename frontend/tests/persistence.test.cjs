require('../scripts/register.cjs');
const test = require('node:test'),
  assert = require('node:assert/strict');
const {
  makeBackup,
  verifyBackup,
  canonical,
  digest,
  validateJson,
  validateEntries
} = require('../src/persistence/backup');
const {
  validateArchive
} = require('../src/persistence/domain');
const {
  presetFalconLike
} = require('../src/sim/presets');
test('verified backup round trips canonical payload with stable SHA-256', async () => {
  const entries = [['mf.designs', JSON.stringify([presetFalconLike()])]],
    b = await makeBackup(entries);
  assert.equal(b.sha256.length, 64);
  assert.deepEqual((await verifyBackup(JSON.stringify(b))).entries, entries);
  assert.equal(canonical({
    b: 2,
    a: 1
  }), canonical({
    a: 1,
    b: 2
  }));
  validateArchive(entries);
  const large = JSON.stringify('x'.repeat(11 * 1024 * 1024));
  await assert.rejects(makeBackup([['mf.large-a', large], ['mf.large-b', large]]), /size/);
});
test('tampering and future backup schemas fail before import', async () => {
  const b = await makeBackup([['mf.designs', '[]']]);
  b.payload.entries[0][1] = '[1]';
  await assert.rejects(verifyBackup(b), /checksum/);
  b.schemaVersion = 2;
  await assert.rejects(verifyBackup(b), /schema/);
  const malformed = await makeBackup([['mf.designs', '[]']]);
  malformed.payload.build = {};
  malformed.sha256 = await digest(malformed.payload);
  await assert.rejects(verifyBackup(malformed), /metadata/);
});
test('unsafe keys, nonfinite numbers, excessive depth and oversized values fail', () => {
  for (const v of ['{"__proto__":{}}', '{"x":1e999}']) assert.throws(() => validateJson(v));
  assert.throws(() => validateJson({
    x: NaN
  }));
  let nested = {};
  for (let i = 0; i < 45; i++) nested = {
    nested
  };
  assert.throws(() => validateJson(nested));
  assert.throws(() => validateJson('"abcdef"', {
    maxBytes: 3
  }));
});
test('backup rejects duplicate and foreign keys and malformed JSON', () => {
  for (const entries of [[['mf.x', '{}'], ['mf.x', '{}']], [['foreign', '{}']], [['mf.x', 'bad']]]) assert.throws(() => validateEntries(entries));
});
test('craft archive rejects unknown parts, oversized stacks and duplicate IDs', () => {
  for (const change of [d => d.stack[0].partId = 'unknown', d => d.stack.push({
    ...d.stack[0]
  }), d => d.stack = Array.from({
    length: 513
  }, (_, i) => ({
    uid: String(i),
    partId: 'tank_k_37_m'
  }))]) {
    const d = presetFalconLike();
    change(d);
    assert.throws(() => validateArchive([['mf.designs', JSON.stringify([d])]]));
  }
});
test('archive rejects unknown custom schemas and invalid flight or exploration state', () => {
  for (const [key, value] of [['mf.local-content', {
    version: 99,
    bodies: [],
    parts: []
  }], ['mf.recovery-flight', {
    design: presetFalconLike()
  }], ['mf.exploration', {
    version: 1,
    craftId: 'pathfinder',
    primary: 'earth',
    r: [0, 0, 0],
    v: [0, 0, 0],
    fuel: -1,
    t: 0
  }]]) assert.throws(() => validateArchive([[key, JSON.stringify(value)]]));
});
test('campaign recovery accepts a real state and rejects schema or method replacement', () => {
  const {
      FlightSim
    } = require('../src/sim/flight'),
    {
      getMission
    } = require('../src/sim/missions'),
    {
      DEFAULT_PROFILE
    } = require('../src/sim/guidance');
  const sim = new FlightSim({
    design: presetFalconLike(),
    mission: getMission('first_orbit'),
    difficulty: 'amateur',
    profile: DEFAULT_PROFILE
  });
  sim.launch();
  sim.advance(5);
  const ck = {
    schemaVersion: 1,
    design: sim.design,
    missionId: 'first_orbit',
    difficulty: 'amateur',
    state: sim.serialize()
  };
  const check = () => validateArchive([['mf.recovery-flight', JSON.stringify(ck)]]);
  assert.doesNotThrow(check);
  ck.schemaVersion = 2;
  assert.throws(check, /schema/);
  ck.schemaVersion = 1;
  ck.state.advance = 'replace';
  assert.throws(check, /runtime/);
  delete ck.state.advance;
  ck.state.guidance.update = 'replace';
  assert.throws(check, /guidance/);
  const {
    localData,
    storageStatus
  } = require('../src/persistence/localData');
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  try {
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      get() {
        throw Error('Storage denied');
      }
    });
    assert.equal(localData.getItem('mf.settings'), null);
    assert.throws(() => localData.setItem('mf.settings', '{}'), /unavailable/);
    assert.match(storageStatus().error, /Save failed/);
    assert.equal(localData.getItem('mf.settings'), '{}');
    assert.ok(localData.entries().some(([key, value]) => key === 'mf.settings' && value === '{}'));
    const values = new Map();
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: {
        getItem: k => values.get(k) || null,
        setItem: (k, v) => values.set(k, v)
      }
    });
    localData.setItem('mf.settings', '{}');
    assert.equal(storageStatus().error, null);
  } finally {
    if (descriptor) Object.defineProperty(globalThis, 'localStorage', descriptor);else delete globalThis.localStorage;
  }
});
