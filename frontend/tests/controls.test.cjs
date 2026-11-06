require("../scripts/register.cjs");
const test = require("node:test");
const assert = require("node:assert/strict");
const {
  DEFAULT_BINDINGS,
  CONTROL_ACTIONS,
  defaultBindings,
  rebind,
  normalizeBindings,
  eventCode,
  keyLabel,
  isBindable,
  steeringAxes,
} = require("../src/input/bindings");
const { FlightInputState } = require("../src/input/useFlightInput");
const { ExplorationSim } = require("../src/sim/exploration");
const { storage } = require("../src/sim/storage");

test("default controls use WASD and conventional nearby flight keys", () => {
  assert.deepEqual(
    ["pitchForward", "yawLeft", "pitchBack", "yawRight"].map(
      (a) => DEFAULT_BINDINGS[a],
    ),
    ["KeyW", "KeyA", "KeyS", "KeyD"],
  );
  assert.equal(DEFAULT_BINDINGS.stage, "Space");
  assert.equal(DEFAULT_BINDINGS.rcs, "KeyR");
  assert.equal(DEFAULT_BINDINGS.fullThrottle, "KeyE");
  assert.equal(DEFAULT_BINDINGS.cutThrottle, "KeyQ");
  assert.equal(
    new Set(Object.values(DEFAULT_BINDINGS)).size,
    CONTROL_ACTIONS.length,
  );
});
test("rebinding a duplicate swaps actions without disabling either one", () => {
  const saved = rebind(defaultBindings(), "pitchForward", "KeyD");
  assert.equal(saved.pitchForward, "KeyD");
  assert.equal(saved.yawRight, "KeyW");
  assert.equal(new Set(Object.values(saved)).size, CONTROL_ACTIONS.length);
  assert.equal(DEFAULT_BINDINGS.pitchForward, "KeyW");
});
test("arrow-key preset is complete and leaves common actions unchanged", () => {
  const b = defaultBindings("arrows");
  assert.equal(b.pitchForward, "ArrowUp");
  assert.equal(b.yawLeft, "ArrowLeft");
  assert.equal(b.stage, "Space");
  assert.equal(new Set(Object.values(b)).size, CONTROL_ACTIONS.length);
});
test("malformed saved bindings cannot introduce invalid codes or collisions", () => {
  const b = normalizeBindings({
    pitchForward: "KeyD",
    yawLeft: "KeyD",
    stage: ["KeyN"],
    rcs: null,
    pause: "F5",
  });
  assert.equal(new Set(Object.values(b)).size, CONTROL_ACTIONS.length);
  assert.ok(Object.values(b).every(isBindable));
  assert.equal(b.stage, "Space");
  assert.equal(b.pause, "KeyP");
});
test("physical codes, letter fallbacks and both modifier sides normalize", () => {
  assert.equal(eventCode({ code: "KeyW", key: "z" }), "KeyW");
  assert.equal(eventCode({ key: "W" }), "KeyW");
  assert.equal(eventCode({ code: "ShiftRight" }), "ShiftLeft");
  assert.equal(eventCode({ code: "ControlRight" }), "ControlLeft");
  assert.equal(keyLabel("KeyI"), "I");
  assert.equal(keyLabel("ArrowLeft"), "←");
});
test("browser and accessibility keys are not bindable", () => {
  for (const code of [
    "Tab",
    "Escape",
    "F5",
    "F12",
    "MetaLeft",
    "AltLeft",
    null,
    {},
    ["KeyW"],
  ])
    assert.equal(isBindable(code), false);
});
test("one released pointer does not release another pointer or keyboard hold", () => {
  const s = new FlightInputState();
  s.press("pitchForward", "pointer:1");
  s.press("pitchForward", "pointer:2");
  s.press("pitchForward", "key:KeyW");
  s.release("pitchForward", "pointer:1");
  assert.equal(s.active("pitchForward"), true);
  s.release("pitchForward", "key:KeyW");
  assert.equal(s.active("pitchForward"), true);
  s.release("pitchForward", "pointer:2");
  assert.equal(s.active("pitchForward"), false);
});
test("simultaneous steering and throttle are independent", () => {
  const s = new FlightInputState();
  s.press("pitchForward", "pointer:1");
  s.press("yawRight", "pointer:2");
  s.press("throttleUp", "pointer:3");
  assert.deepEqual(
    steeringAxes((a) => s.active(a)),
    { pitch: -1, yaw: 1 },
  );
  s.release("throttleUp", "pointer:3");
  assert.deepEqual(
    steeringAxes((a) => s.active(a)),
    { pitch: -1, yaw: 1 },
  );
  assert.equal(s.active("throttleUp"), false);
});
test("opposite steering inputs cancel instead of producing an invalid command", () => {
  const s = new FlightInputState();
  for (const a of ["pitchForward", "pitchBack", "yawLeft", "yawRight"])
    s.press(a, a);
  assert.deepEqual(
    steeringAxes((a) => s.active(a)),
    { pitch: 0, yaw: 0 },
  );
});
test("repeated key press is idempotent and clearing releases every source", () => {
  const s = new FlightInputState();
  s.press("pitchForward", "key:KeyW");
  s.press("pitchForward", "key:KeyW");
  assert.equal(s.sources.get("pitchForward").size, 1);
  s.press("throttleUp", "pointer:1");
  s.clear();
  assert.equal(s.sources.size, 0);
});
test("control preferences roundtrip and invalid saved choices fall back safely", () => {
  const values = new Map();
  global.localStorage = {
    getItem: (k) => values.get(k) || null,
    setItem: (k, v) => values.set(k, v),
  };
  storage.saveSettings({
    bindings: rebind(defaultBindings(), "stage", "KeyN"),
    touchControls: "on",
    touchSize: "large",
    steeringSide: "right",
    steeringSensitivity: 1.5,
  });
  const s = storage.settings();
  assert.equal(s.bindings.stage, "KeyN");
  assert.equal(s.touchControls, "on");
  assert.equal(s.steeringSensitivity, 1.5);
  assert.equal(s.steeringSide, "right");
  storage.saveSettings({ touchControls: "unknown", steeringSensitivity: -1 });
  assert.equal(storage.settings().touchControls, "auto");
  assert.equal(storage.settings().steeringSensitivity, 1);
});
test("exploration RCS off holds burn direction and survives save/restore", () => {
  const sim = new ExplorationSim();
  sim.toggleRcs();
  const before = sim.navigation().direction;
  sim.pitch = 45;
  sim.mode = "retrograde";
  sim.advance(20);
  assert.deepEqual(sim.navigation().direction, before);
  const restored = ExplorationSim.restore(
    JSON.parse(JSON.stringify(sim.serialize())),
  );
  assert.equal(restored.rcsEnabled, false);
  assert.deepEqual(restored.navigation().direction, before);
  sim.toggleRcs();
  assert.equal(sim.rcsEnabled, true);
  assert.notDeepEqual(sim.navigation().direction, before);
});
test("old expedition saves enable attitude control by default", () => {
  const s = new ExplorationSim().serialize();
  delete s.rcsEnabled;
  delete s.heldDirection;
  assert.equal(ExplorationSim.restore(s).rcsEnabled, true);
});
