require('../scripts/register.cjs');
const test = require('node:test'),
  assert = require('node:assert/strict'),
  fs = require('node:fs'),
  path = require('node:path');
const {
  searchCommands,
  NAV_COMMANDS
} = require('../src/features/navigation');
const {
  seededChallenge
} = require('../src/features/challenges');
const {
  gamepadActions,
  normalizeGamepad,
  rebindGamepad
} = require('../src/input/gamepad');
const {
  readFlightLog,
  achievements,
  compareFlights
} = require('../src/features/logbook');
const {
  replayHeader
} = require('../src/persistence/replayFile');
const {
  accelerationX,
  circularTrace
} = require('../src/features/performance/kernel');
const {
  EARTH
} = require('../src/sim/constants');
test('command search matches all terms and unique real workspaces', () => {
  assert.equal(new Set(NAV_COMMANDS.map(c => c.id)).size, NAV_COMMANDS.length);
  assert.equal(searchCommands('NASA source')[0].id, 'science');
  assert.equal(searchCommands('rocket builder')[0].id, 'hangar');
  assert.deepEqual(searchCommands('impossible-workspace'), []);
});
test('seeded challenges repeat across sessions and canonical Unicode', () => {
  assert.deepEqual(seededChallenge('astroverse'), seededChallenge('astroverse'));
  assert.deepEqual(seededChallenge(' é '), seededChallenge('e\u0301'));
  assert.throws(() => seededChallenge(' '));
  const ids = new Set();
  for (let i = 0; i < 1000; i++) {
    const c = seededChallenge('seed-' + i);
    assert.ok([200000, 250000, 350000, 500000].includes(c.mission.altitude));
    assert.ok([28.6, 45, 65, 98].includes(c.mission.inclination));
    assert.ok(c.mission.budget >= 60 && c.mission.budget <= 80);
    ids.add(c.mission.id);
  }
  assert.equal(ids.size, 1000);
});
test('controller mappings normalize invalid values and swap conflicts', () => {
  const c = normalizeGamepad({
    deadzone: 100,
    buttons: {
      stage: 0
    },
    pitchAxis: 99
  });
  assert.equal(c.deadzone, .6);
  assert.equal(c.pitchAxis, 1);
  const rebound = rebindGamepad({}, 'stage', 0);
  assert.equal(rebound.buttons.stage, 0);
  assert.equal(rebound.buttons.fullThrottle, 2);
  assert.throws(() => rebindGamepad({}, 'not-action', 4));
});
test('controller sampling applies deadzone, inversion, held axes and button releases', () => {
  const pad = {
    connected: true,
    axes: [-.8, -.9, 0, -.6],
    buttons: Array.from({
      length: 12
    }, () => ({
      pressed: false,
      value: 0
    }))
  };
  let a = gamepadActions(pad, {});
  assert.ok(a.has('yawLeft') && a.has('pitchForward') && a.has('throttleUp'));
  pad.axes = [.1, .1, 0, .1];
  assert.equal(gamepadActions(pad, {}).size, 0);
  pad.axes = [0, -.9, 0, 0];
  assert.ok(gamepadActions(pad, {
    invertPitch: true
  }).has('pitchBack'));
  pad.buttons[2].pressed = true;
  assert.ok(gamepadActions(pad, {}).has('stage'));
  pad.connected = false;
  assert.equal(gamepadActions(pad, {}).size, 0);
});
test('logbook handles legacy history and compares nullable metrics honestly', () => {
  const entries = [['mf.attempts.first_orbit.amateur', JSON.stringify([{
    at: '2026-01-01',
    designName: 'A',
    outcome: 'success',
    total: 90,
    peri: 180000,
    cost: 40
  }])], ['mf.attempts.bad.expert', 'oops']];
  const flights = readFlightLog(entries);
  assert.equal(flights.length, 1);
  assert.ok(achievements(flights).find(a => a.id === 'orbit').earned);
  assert.equal(compareFlights({
    cost: 40
  }, {
    cost: 50
  }).find(r => r.key === 'cost').delta, 10);
  assert.equal(compareFlights({}, {}).find(r => r.key === 'cost').delta, null);
  assert.equal(achievements([], ['mars']).find(a => a.id === 'explorer').earned, true);
});
test('replay archive validates supported headers without executing payloads', () => {
  assert.equal(replayHeader(JSON.stringify({
    version: 1,
    kind: 'exploration-control-trace',
    commands: []
  })).commands, 0);
  assert.equal(replayHeader(JSON.stringify({
    spec: {
      version: 1,
      model: 'mission-forge-guided-v1',
      commands: []
    }
  })).version, 1);
  for (const text of ['bad', '{}', '{"version":99,"kind":"exploration-control-trace","commands":[]}']) assert.throws(() => replayHeader(text));
});
test('WebAssembly gravity matches independent axis values and JavaScript vectors', async () => {
  const {
    instance
  } = await WebAssembly.instantiate(fs.readFileSync(path.resolve(__dirname, '../public/science/models/central-gravity.wasm')));
  const wasm = instance.exports.accel;
  for (const radius of [EARTH.radius + 200000, 1e8, 1e10]) {
    const expected = -EARTH.mu / (radius * radius);
    assert.ok(Math.abs((wasm(EARTH.mu, radius, 0, 0) - expected) / expected) < 1e-14);
    assert.equal(Math.abs(wasm(EARTH.mu, 0, radius, 0)), 0);
  }
  for (const [x, y, z] of [[7e6, 3e4, 2e3], [-8e6, 2e5, -400]]) assert.ok(Math.abs(wasm(EARTH.mu, x, y, z) - accelerationX(EARTH.mu, x, y, z)) < 1e-12);
});
test('central orbit experiment closes analytically and preserves invariants', () => {
  const radius = EARTH.radius + 200000,
    r = circularTrace(accelerationX, EARTH.mu, radius);
  assert.ok(r.maxEnergyDrift < 1e-8);
  assert.ok(r.maxRadiusError < 1);
  const end = r.trace.slice(-2);
  assert.ok(Math.hypot(end[0] - radius, end[1]) < 1);
  assert.throws(() => circularTrace(accelerationX, 0, radius));
});

test('adaptive frame work limits keep integration and replay consistent',()=>{
 const {FrameBudget}=require('../src/features/frameBudget'),{ExplorationSim}=require('../src/sim/exploration'),{FleetWorld}=require('../src/sim/advanced/fleetWorld'),{beginRecording}=require('../src/sim/advanced/controlRecording'),{replayControls}=require('../src/sim/advanced/controlReplay');
 const budget=new FrameBudget();assert.ok(budget.limit(6)<budget.limit(1));const previous=budget.limit();budget.observe(100,10);assert.ok(budget.limit()<previous);budget.observe(0,0);assert.ok(Number.isInteger(budget.limit()));
 const a=new FleetWorld(new ExplorationSim()),b=FleetWorld.restore(a.serialize());const elapsed=a.advance(500,2);assert.equal(a.active.lastStepCount,2);b.advance(elapsed);assert.ok(Math.hypot(...a.active.r.map((n,i)=>n-b.active.r[i]))<.01);
 const sim=new ExplorationSim();beginRecording(sim);sim.advance(500,2);sim.recording.active=false;assert.equal(sim.recording.commands[0].maxSteps,2);assert.ok(replayControls(sim.recording).pass);
});
