import { atmosphere } from "../atmosphere";
import { EARTH, G0 } from "../constants";
import { designStats, createRuntime, applyEvent, deltaVFromRuntime } from "../design";
import { FlightSim, runAutopilotFlight, DT_COAST } from "../flight";
import { getMission, requiredDeltaV } from "../missions";
import { orbitalElements } from "../orbit";
import { presetFalconLike, presetBoosted } from "../presets";
import { DEFAULT_PROFILE } from "../guidance";

const mission = getMission("first_orbit");
const rel = (a, b) => Math.abs(a - b) / Math.abs(b);

describe("Reference physics checks", () => {
  test("US Standard Atmosphere 1976 reference densities", () => {
    expect(rel(atmosphere(0).rho, 1.225)).toBeLessThan(0.002);
    expect(rel(atmosphere(11000).rho, 0.3639)).toBeLessThan(0.005);
    expect(rel(atmosphere(20000).rho, 0.08891)).toBeLessThan(0.005);
    expect(rel(atmosphere(50000).rho, 0.001027)).toBeLessThan(0.01);
    expect(atmosphere(200000).rho).toBe(0);
  });

  test("Tsiolkovsky rocket equation: single stage matches analytic Δv", () => {
    const design = { stack: [{ uid: "a", partId: "probe_core" }, { uid: "b", partId: "tank_k_37_m" }, { uid: "c", partId: "eng_kv" }], radials: [] };
    const rt = createRuntime(design);
    const m0 = 120 + 5400 + 90000 + 490;
    const m1 = m0 - 90000;
    const expected = 348 * G0 * Math.log(m0 / m1);
    const dv = deltaVFromRuntime(rt, { applyFirst: true }).totalVac;
    expect(rel(dv, expected)).toBeLessThan(1e-9);
  });

  test("Circular orbit speed and period at 400 km", () => {
    const r = EARTH.radius + 400000;
    const v = Math.sqrt(EARTH.mu / r);
    expect(Math.abs(v - 7672.6)).toBeLessThan(1);
    const el = orbitalElements([r, 0, 0], [0, v, 0], EARTH.mu, EARTH.radius);
    expect(el.e).toBeLessThan(1e-9);
    expect(Math.abs(el.period / 60 - 92.42)).toBeLessThan(0.05);
  });

  test("Orbit shape: apoapsis/periapsis from state vector (elliptical)", () => {
    const rp = EARTH.radius + 200000;
    const ra = EARTH.radius + 1000000;
    const a = (rp + ra) / 2;
    const vp = Math.sqrt(EARTH.mu * (2 / rp - 1 / a));
    const el = orbitalElements([rp, 0, 0], [0, vp, 0], EARTH.mu, EARTH.radius);
    expect(Math.abs(el.periapsis - 200000)).toBeLessThan(1);
    expect(Math.abs(el.apoapsis - 1000000)).toBeLessThan(1);
  });

  test("Energy conservation over 5 orbits of coasting (RK4, vacuum)", () => {
    const sim = new FlightSim({ design: presetFalconLike(), mission, profile: DEFAULT_PROFILE, guidanceOn: false });
    const r = EARTH.radius + 400000;
    sim.clamped = false;
    sim.status = "flight";
    sim.r = [r, 0, 0];
    sim.v = [0, Math.sqrt(EARTH.mu / r) * 1.01, 0];
    sim.throttle = 0;
    const e0 = orbitalElements(sim.r, sim.v, EARTH.mu, EARTH.radius).energy;
    const steps = Math.round((5 * 5600) / DT_COAST);
    for (let i = 0; i < steps; i++) sim.coastStep(DT_COAST);
    const e1 = orbitalElements(sim.r, sim.v, EARTH.mu, EARTH.radius).energy;
    expect(rel(e1, e0)).toBeLessThan(1e-7);
  });

  test("Required Δv estimate for 200 km LEO is in published 9.0–9.6 km/s band", () => {
    const req = requiredDeltaV(mission).value;
    expect(req).toBeGreaterThan(8900);
    expect(req).toBeLessThan(9600);
  });
});

describe("End-to-end ascent with the guidance computer", () => {
  test.each([["Orbiter-9", presetFalconLike], ["Hydro-Boost", presetBoosted]])("%s reaches target orbit", (_, make) => {
    const design = make();
    const stats = designStats(design);
    const sim = runAutopilotFlight(design, mission, DEFAULT_PROFILE);
    const el = sim.nav.el;
    // eslint-disable-next-line no-console
    console.log(_, "dv", stats.dv.total.toFixed(0), "twr", stats.liftoffTWR.toFixed(2), "t", sim.t.toFixed(0), "apo", (el.apoapsis / 1000).toFixed(1), "peri", (el.periapsis / 1000).toFixed(1), "inc", ((el.inc * 180) / Math.PI).toFixed(2), "rem", sim.remainingDeltaV().toFixed(0), sim.status, sim.guidance.phase);
    expect(sim.status).toBe("orbit");
    expect(Math.abs(el.apoapsis - 200000)).toBeLessThan(25000);
    expect(Math.abs(el.periapsis - 200000)).toBeLessThan(25000);
    expect(Math.abs((el.inc * 180) / Math.PI - 28.6)).toBeLessThan(2);
  });

  test("Same design + same inputs give identical results run to run", () => {
    const d = presetFalconLike();
    const a = runAutopilotFlight(d, mission, DEFAULT_PROFILE, 400);
    const b = runAutopilotFlight(d, mission, DEFAULT_PROFILE, 400);
    expect(a.digest()).toBe(b.digest());
  });

  test("Underpowered vehicle cannot lift off (outcome from physics, not script)", () => {
    const design = { stack: [{ uid: "a", partId: "probe_core" }, { uid: "b", partId: "tank_k_37_l" }, { uid: "c", partId: "tank_k_37_l" }, { uid: "d", partId: "eng_k1" }], radials: [] };
    const sim = runAutopilotFlight(design, mission, DEFAULT_PROFILE, 60);
    expect(sim.clamped).toBe(true);
    expect(sim.nav.alt).toBeLessThan(10);
  });
});

import { stateAt, predictPath, raiseApoDv, nodePrediction } from "../maneuver";
import { presetFalconLike as pf } from "../presets";

const orbitSim = () => {
  const s = runAutopilotFlight(pf(), mission, DEFAULT_PROFILE);
  s.attMode = "prograde";
  return s;
};
const runUntil = (sim, cond, max = 20000) => {
  const t0 = sim.t;
  while (!cond() && sim.t - t0 < max && !sim.isEnded()) sim.advance(5, 100000);
};

describe("Milestone 2 — attitude, maneuvers, checkpoints, prediction", () => {
  test("Torque-free rotation keeps a constant rate (angular momentum conserved)", () => {
    const sim = orbitSim();
    sim.attMode = "free";
    sim.omega = scale3(norm3(cross3(sim.dir, [0, 0, 1])), 0.01);
    const w0 = Math.hypot(...sim.omega);
    for (let i = 0; i < 100; i++) sim.coastStep(0.1);
    expect(rel(Math.hypot(...sim.omega), w0)).toBeLessThan(0.01);
  });

  test("Reaction wheels saturate under steady gravity-gradient torque; RCS unloads them", () => {
    const sim = orbitSim();
    sim.rcsEnabled = false;
    const up = norm3(sim.r);
    const pro = norm3(sim.v);
    sim.holdDir = norm3([up[0] + pro[0], up[1] + pro[1], up[2] + pro[2]]);
    sim.attMode = "hold";
    for (let i = 0; i < 4000; i++) sim.coastStep(0.1);
    expect(sim.wheelsSaturated).toBe(true);
    const fuel0 = sim.attStatus.rcsFuel;
    sim.rcsEnabled = true;
    for (let i = 0; i < 300; i++) sim.coastStep(0.1);
    expect(sim.attStatus.wheelPct).toBeLessThan(75);
    expect(sim.attStatus.rcsFuel).toBeLessThan(fuel0);
  });

  test("Numerical trajectory prediction closes after one period (≤ 50 m)", () => {
    const r = [EARTH.radius + 300000, 0, 0];
    const v = [0, 7800, 300];
    const el = orbitalElements(r, v, EARTH.mu, EARTH.radius);
    const s = stateAt(r, v, el.period, 5);
    expect(Math.hypot(s.r[0] - r[0], s.r[1] - r[1], s.r[2] - r[2])).toBeLessThan(50);
    expect(predictPath(r, v).impact).toBe(false);
  });

  test("Checkpoint restore resumes exactly (bit-identical continuation)", () => {
    const d = pf();
    const a = new FlightSim({ design: d, mission, profile: DEFAULT_PROFILE });
    a.launch();
    a.advance(300, 1e6);
    const ck = a.serialize();
    a.advance(200, 1e6);
    const b = new FlightSim({ design: d, mission, profile: DEFAULT_PROFILE });
    b.restore(ck);
    b.advance(200, 1e6);
    expect(b.digest()).toBe(a.digest());
  });

  test("Guidance executes a two-burn Hohmann transfer 200 → 700 km", () => {
    const sim = orbitSim();
    const t1 = sim.t + 600;
    const at = stateAt(sim.r, sim.v, 600);
    sim.planManeuver({ t: t1, dv: [raiseApoDv(at.r, at.v, EARTH.radius + 700000), 0, 0] });
    runUntil(sim, () => sim.maneuver.done);
    expect(Math.abs(sim.nav.el.apoapsis - 700000)).toBeLessThan(10000);
    const tApo = sim.t + sim.nav.el.timeToApo;
    const pa = stateAt(sim.r, sim.v, sim.nav.el.timeToApo);
    const vc = Math.sqrt(EARTH.mu / Math.hypot(...pa.r));
    sim.planManeuver({ t: tApo, dv: [vc - Math.hypot(...pa.v), 0, 0] });
    const pred = nodePrediction(sim, sim.node);
    runUntil(sim, () => sim.maneuver.done);
    const el = sim.nav.el;
    // eslint-disable-next-line no-console
    console.log("hohmann", (el.apoapsis / 1000).toFixed(1), (el.periapsis / 1000).toFixed(1), "pred peri", (pred.after.periapsis / 1000).toFixed(1));
    expect(Math.abs(el.periapsis - 700000)).toBeLessThan(25000);
    expect(Math.abs(el.apoapsis - 700000)).toBeLessThan(25000);
  });

  test("Earth Observer: retrograde ascent from Vandenberg reaches parking orbit near 98.2°", () => {
    const eo = getMission("earth_observer");
    const prof = { ...DEFAULT_PROFILE, targetAltitude: 200000, targetInclination: 98.2 };
    const sim = runAutopilotFlight({ ...pf("sat_medium") }, eo, prof);
    // eslint-disable-next-line no-console
    console.log("EO", (sim.nav.el.apoapsis / 1000).toFixed(1), (sim.nav.el.periapsis / 1000).toFixed(1), ((sim.nav.el.inc * 180) / Math.PI).toFixed(2));
    expect(sim.status).toBe("orbit");
    expect(Math.abs((sim.nav.el.inc * 180) / Math.PI - 98.2)).toBeLessThan(0.5);
  });
});

function cross3(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
function norm3(a) { const l = Math.hypot(...a); return a.map((x) => x / l); }
function scale3(a, s) { return a.map((x) => x * s); }
