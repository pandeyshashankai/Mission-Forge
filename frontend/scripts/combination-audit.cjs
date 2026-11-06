require("./register.cjs");
const assert = require("node:assert/strict"),
  fs = require("node:fs"),
  path = require("node:path");
const { PART_LIST, PARTS } = require("../src/sim/parts");
const D = require("../src/sim/design");
const O = require("../src/game/designOps");
const { isValidDesign } = require("../src/sim/storage");
const { runReadiness } = require("../src/sim/readiness");
const { MISSIONS, DIFFICULTIES } = require("../src/sim/missions");
const { PRESETS } = require("../src/sim/presets");
const { FlightSim } = require("../src/sim/flight"),
  { DEFAULT_PROFILE } = require("../src/sim/guidance");
const report = {
  date: "2026-11-05",
  scope:
    "Built-in catalogue; exhaustive ordered axial singles/pairs/triples, compatible tank/engine/command and booster groups; bounded sampled option matrix. Not all arbitrary-length rockets or continuous controls.",
  groups: {},
  failures: [],
};
const check = (group, label, fn) => {
  const g = (report.groups[group] ??= { cases: 0, passed: 0, failed: 0 });
  g.cases++;
  try {
    fn();
    g.passed++;
  } catch (e) {
    g.failed++;
    report.failures.push({ group, label, error: e.stack });
  }
};
const axial = PART_LIST.filter((p) => !p.radialOnly),
  boosters = PART_LIST.filter((p) => p.radialOnly),
  design = (ids) => ({
    name: "Combination audit",
    stack: ids.map((id, i) => ({ uid: "node-" + i, partId: id })),
    radials: [],
    events: null,
  });
const close = (a, b) =>
  assert.ok(
    Math.abs(a - b) <= Math.max(1e-7, Math.abs(b) * 1e-10),
    `${a} != ${b}`,
  );
function physics(d) {
  const s = D.designStats(d),
    rt = D.createRuntime(d);
  assert.ok(isValidDesign(d));
  for (const key of [
    "mass",
    "dryMass",
    "cost",
    "liftoffThrustSL",
    "liftoffTWR",
  ])
    assert.ok(Number.isFinite(s[key]) && s[key] >= 0, key);
  assert.ok(Number.isFinite(s.dv.total) && s.dv.total >= 0);
  assert.ok(s.mass >= s.dryMass);
  const expected =
    d.stack.reduce(
      (sum, n) =>
        sum + PARTS[n.partId].dryMass + (PARTS[n.partId].propellant?.mass || 0),
      0,
    ) +
    (d.radials || []).reduce(
      (sum, n) =>
        sum +
        n.symmetry *
          (PARTS[n.partId].dryMass + (PARTS[n.partId].propellant?.mass || 0)),
      0,
    );
  close(s.mass, expected);
  close(D.runtimeMass(rt), expected);
  let last = D.runtimeMass(rt);
  for (const event of rt.events) {
    D.applyEvent(rt, event);
    assert.ok(D.runtimeMass(rt) <= last + 1e-7);
    last = D.runtimeMass(rt);
  }
  assert.ok(D.runtimeMass(rt) >= 0);
  return s;
}
for (const p of axial)
  check("individual axial parts", p.id, () => physics(design([p.id])));
for (const a of axial)
  for (const b of axial)
    check("all ordered axial pairs", a.id + "/" + b.id, () =>
      physics(design([a.id, b.id])),
    );
for (const a of axial)
  for (const b of axial)
    for (const c of axial)
      check("all ordered axial triples", a.id + "/" + b.id + "/" + c.id, () =>
        physics(design([a.id, b.id, c.id])),
      );
for (const parent of axial)
  for (const booster of boosters)
    for (const symmetry of [2, 3, 4])
      check(
        "all booster parent symmetry groups",
        parent.id + "/" + booster.id + "/" + symmetry,
        () => {
          const d = design([parent.id]),
            added = O.addPart(d, booster.id, d.stack[0].uid, "below", symmetry);
          if (parent.diameter < 1.8) {
            assert.ok(added.error);
            return;
          }
          assert.ok(added.design);
          physics(added.design);
          assert.equal(O.removePart(added.design, added.uid).radials.length, 0);
        },
      );
const tanks = axial.filter((p) => p.propellant),
  engines = axial.filter((p) => p.engine),
  commands = axial.filter((p) => p.control);
for (const command of commands)
  for (const tank of tanks)
    for (const engine of engines)
      for (const throttle of [0, 0.01, 0.5, 1])
        for (const pressure of [0, 0.5, 1])
          check(
            "command tank engine throttle pressure",
            `${command.id}/${tank.id}/${engine.id}/${throttle}/${pressure}`,
            () => {
              const d = design([command.id, tank.id, engine.id]),
                rt = D.createRuntime(d);
              D.applyEvent(rt, "ignite-0");
              const mass = D.runtimeMass(rt),
                thrust = D.thrustState(rt, throttle, pressure);
              const compatible =
                tank.propellant.type === engine.engine.propellant;
              assert.equal(thrust.F > 0, compatible && throttle > 0);
              D.consume(rt, thrust.flows, 0.01);
              const used = thrust.flows.reduce((s, f) => s + f.mdot * 0.01, 0);
              close(mass - D.runtimeMass(rt), used);
              assert.ok(
                Object.values(rt.sections[0].tanks).every((x) => x >= 0),
              );
            },
          );
for (const preset of PRESETS)
  for (const mission of MISSIONS)
    for (const difficulty of Object.keys(DIFFICULTIES))
      check(
        "preset mission difficulty readiness",
        `${preset.id}/${mission.id}/${difficulty}`,
        () => {
          const r = runReadiness(preset.make(), mission, difficulty);
          assert.ok(["GO", "GO-WARN", "NO-GO"].includes(r.overall), r.overall);
          assert.ok(r.checks.length > 0);
        },
      );
for (const preset of PRESETS)
  for (const part of PART_LIST)
    for (const mode of ["above", "below", "radial"])
      check(
        "every preset part placement",
        `${preset.id}/${part.id}/${mode}`,
        () => {
          const d = preset.make(),
            before = JSON.stringify(d),
            selected =
              d.stack.find((n) => PARTS[n.partId].diameter >= 1.8) ||
              d.stack[0];
          const added = O.addPart(d, part.id, selected.uid, mode, 4);
          assert.equal(JSON.stringify(d), before, "input mutated");
          if (added.error) {
            assert.ok(part.radialOnly || mode === "radial");
            return;
          }
          physics(added.design);
          const duplicated = O.duplicatePart(added.design, added.uid);
          assert.ok(isValidDesign(duplicated.design || duplicated));
        },
      );
for (const command of commands)
  for (const tank of tanks)
    for (const engine of engines)
      check(
        "grouped short physical launches",
        `${command.id}/${tank.id}/${engine.id}`,
        () => {
          const d = design([command.id, tank.id, engine.id]);
          const sim = new FlightSim({
            design: d,
            mission: MISSIONS[0],
            profile: DEFAULT_PROFILE,
            guidanceOn: false,
          });
          sim.launch();
          sim.advance(0.25);
          assert.ok([...sim.r, ...sim.v, sim.t].every(Number.isFinite));
          assert.ok(D.runtimeMass(sim.rt) >= 0);
        },
      );

function* permutations(values) {
  if (values.length === 0) {
    yield [];
    return;
  }
  for (let i = 0; i < values.length; i++)
    for (const tail of permutations(values.filter((_, j) => i !== j)))
      yield [values[i], ...tail];
}
for (const preset of PRESETS) {
  const base = preset.make(),
    events = D.createRuntime(base).events;
  for (const order of permutations(events))
    check(
      "all preset staging permutations",
      preset.id + "/" + order.join(","),
      () => {
        const d = { ...base, events: order },
          rt = D.createRuntime(d);
        assert.ok(D.validEventOrder(rt.events));
        assert.equal(new Set(rt.events).size, events.length);
        physics(d);
      },
    );
}
for (const a of axial)
  for (const b of axial)
    for (const selected of [0, 1])
      for (const direction of [-1, 1])
        check(
          "all axial pair edit groups",
          `${a.id}/${b.id}/${selected}/${direction}`,
          () => {
            const d = design([a.id, b.id]),
              before = JSON.stringify(d),
              moved = O.movePart(d, d.stack[selected].uid, direction);
            physics(moved);
            assert.equal(JSON.stringify(d), before);
            const copy = O.duplicatePart(d, d.stack[selected].uid);
            assert.ok(isValidDesign(copy.design));
            const removed = O.removePart(copy.design, copy.uid);
            close(D.designStats(removed).mass, D.designStats(d).mass);
            assert.equal(JSON.stringify(d), before);
          },
        );
for (const part of PART_LIST)
  check("every individual part forced launch and staging", part.id, () => {
    const d = part.radialOnly
      ? {
          ...design(["tank_k_37_m"]),
          radials: [
            {
              uid: "booster",
              parentUid: "node-0",
              partId: part.id,
              symmetry: 2,
            },
          ],
        }
      : design([part.id]);
    const sim = new FlightSim({
      design: d,
      mission: MISSIONS[0],
      profile: DEFAULT_PROFILE,
      guidanceOn: false,
    });
    sim.launch();
    for (let i = 0; i < sim.rt.events.length; i++) sim.stage();
    sim.advance(0.1);
    assert.ok(
      [...sim.r, ...sim.v, sim.nav.mass, sim.nav.accel].every(Number.isFinite),
    );
    if (sim.nav.mass === 0) assert.ok(sim.isEnded());
  });
// CPU geometry audit uses an explicit canvas stub; actual WebGL/textures are checked by browser suites.
global.document = {
  createElement: () => ({
    width: 0,
    height: 0,
    getContext: () => ({
      fillRect() {},
      beginPath() {},
      moveTo() {},
      lineTo() {},
      stroke() {},
      createLinearGradient: () => ({ addColorStop() {} }),
    }),
  }),
};
const THREE = require("three"),
  {
    buildPartMesh,
    buildRocket,
    disposeObject,
  } = require("../src/three/partMeshes");
function geometry(root) {
  const bounds = new THREE.Box3().setFromObject(root);
  assert.ok(!bounds.isEmpty());
  assert.ok(
    [...bounds.min.toArray(), ...bounds.max.toArray()].every(Number.isFinite),
  );
  let count = 0;
  root.traverse((o) => {
    if (o.geometry?.attributes.position) {
      count++;
      assert.ok(
        [...o.geometry.attributes.position.array].every(Number.isFinite),
      );
    }
  });
  assert.ok(count > 0);
  disposeObject(root);
}
for (const part of PART_LIST)
  check("individual part geometry", part.id, () =>
    geometry(buildPartMesh(part)),
  );
for (const a of axial)
  for (const b of axial)
    check("all ordered pair geometry", a.id + "/" + b.id, () =>
      geometry(buildRocket(design([a.id, b.id]))),
    );
report.total = Object.values(report.groups).reduce((s, g) => s + g.cases, 0);
report.passed = report.failures.length === 0;
const output =
  process.env.MF_AUDIT_OUTPUT || "/tmp/mission-forge-combination-audit.json";
fs.writeFileSync(output, JSON.stringify(report, null, 2) + "\n");
console.log(
  JSON.stringify(
    {
      total: report.total,
      groups: report.groups,
      failures: report.failures.slice(0, 12),
      report: output,
    },
    null,
    2,
  ),
);
if (!report.passed) process.exitCode = 1;
