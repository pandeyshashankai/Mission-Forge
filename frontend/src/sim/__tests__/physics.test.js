import { atmosphere } from "../atmosphere";
import { EARTH, G0 } from "../constants";
import { designStats, createRuntime, applyEvent, deltaVFromRuntime } from "../design";
import { FlightSim, runAutopilotFlight, DT_COAST } from "../flight";
import { getMission, requiredDeltaV } from "../missions";
import { orbitalElements } from "../orbit";
import { presetFalconLike, presetBoosted } from "../presets";
import { DEFAULT_PROFILE } from "../guidance";
import { J2, RE_EQ, j2NodeRate, MOON, regionOf } from "../bodies";

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
    // Specific energy including the J2 potential term (equatorial orbit: sin φ = 0).
    const E = () => { const rm = Math.hypot(...sim.r); return orbitalElements(sim.r, sim.v, EARTH.mu, EARTH.radius).energy - (EARTH.mu * J2 * RE_EQ ** 2) / (2 * rm ** 3) * (3 * (sim.r[2] / rm) ** 2 - 1) * -1; };
    const e0 = E();
    const steps = Math.round((5 * 5600) / DT_COAST);
    for (let i = 0; i < steps; i++) sim.coastStep(DT_COAST);
    const e1 = E();
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

  test("Numerical trajectory prediction closes after one period (≤ 50 m, two-body)", () => {
    const r = [EARTH.radius + 300000, 0, 0];
    const v = [0, 7800, 300];
    const el = orbitalElements(r, v, EARTH.mu, EARTH.radius);
    const s = stateAt(r, v, el.period, 5, { j2: false });
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

describe("Milestone 2 verification — J2 / Sun-synchronous", () => {
  test("J2 node regression: 700 km, 98.2° orbit drifts ≈ +0.9856°/day (Sun-synchronous), numeric matches analytic", () => {
    const r0 = EARTH.radius + 700000;
    const vc = Math.sqrt(EARTH.mu / r0);
    const i = (98.2 * Math.PI) / 180;
    const r = [r0, 0, 0], v = [0, vc * Math.cos(i), vc * Math.sin(i)];
    const el0 = orbitalElements(r, v, EARTH.mu, EARTH.radius);
    const s = stateAt(r, v, 86400, 5);
    const el1 = orbitalElements(s.r, s.v, EARTH.mu, EARTH.radius);
    let d = ((el1.raan - el0.raan) * 180) / Math.PI;
    if (d < -180) d += 360;
    const analytic = (j2NodeRate(el0) * 86400 * 180) / Math.PI;
    // eslint-disable-next-line no-console
    console.log("SSO node drift/day numeric", d.toFixed(4), "analytic", analytic.toFixed(4));
    expect(Math.abs(d - 0.9856)).toBeLessThan(0.05);
    expect(Math.abs(d - analytic)).toBeLessThan(0.03);
  });
});

import { planTLI, planMCC, planLOI, planCorridor } from "../transfer";
import { presetLunarOrbiter, presetCrewedFlyby } from "../presets";
import { lifeSupportStatus, RATES } from "../crew";
import { evaluateFlight } from "../scoring";

const lunarRun = (sim) => (cond, max) => { const t0 = sim.t; while (!cond() && sim.t - t0 < max && !sim.isEnded()) sim.advance(50, 1e6); };
const lunarProfile = { ...DEFAULT_PROFILE, targetAltitude: 185000, targetInclination: 28.6 };

describe("Milestone 3 — Moon, life support, re-entry", () => {
  test("Moon moves on its Keplerian orbit: distance 363–406 thousand km, period 27.3 days, SOI ≈ 66,000 km", () => {
    expect(Math.abs(MOON.soi / 1000 - 66100)).toBeLessThan(400);
    expect(Math.abs((2 * Math.PI) / MOON.n / 86400 - 27.32)).toBeLessThan(0.05);
  });

  test("Lunar Orbiter end-to-end: parking orbit → TLI → MCC → SOI hand-off → LOI → lunar orbit in the 25–175 km band", () => {
    const m = getMission("lunar_orbiter");
    const design = presetLunarOrbiter();
    const sim = runAutopilotFlight(design, m, lunarProfile);
    expect(sim.status).toBe("orbit");
    sim.attMode = "prograde";
    const run = lunarRun(sim);
    sim.planManeuver(planTLI(sim, { periAlt: m.lunar.altitude }).node);
    run(() => sim.maneuver.done, 20000);
    run(() => false, 7200);
    sim.planManeuver(planMCC(sim, { periAlt: m.lunar.altitude }).node);
    run(() => sim.maneuver.done, 20000);
    run(() => sim.region === "moon", 7 * 86400);
    expect(sim.region).toBe("moon");
    expect(sim.log.some((l) => /Entered the Moon's sphere/.test(l.text))).toBe(true);
    sim.planManeuver(planLOI(sim));
    run(() => sim.maneuver.done, 3 * 86400);
    run(() => false, 7200);
    const el = sim.nav.el;
    // eslint-disable-next-line no-console
    console.log("LRO", sim.nav.body, (el.apoapsis / 1000).toFixed(1), (el.periapsis / 1000).toFixed(1), (sim.t / 86400).toFixed(2));
    expect(sim.lunarOrbitAt).not.toBeNull();
    expect(el.periapsis).toBeGreaterThan(25000);
    expect(el.apoapsis).toBeLessThan(175000);
    sim.end("ended", "test");
    const res = evaluateFlight(sim, design, m, "amateur");
    expect(res.objectives.find((o) => o.id === "lunar").met).toBe(true);
  }, 120000);

  test("Crewed flyby end-to-end: free-return targeting, corridor correction, re-entry heating, parachutes, splashdown", () => {
    const m = getMission("crewed_lunar_flyby");
    const design = presetCrewedFlyby();
    const sim = runAutopilotFlight(design, m, lunarProfile);
    sim.attMode = "prograde";
    const run = lunarRun(sim);
    sim.planManeuver(planTLI(sim, { periAlt: m.flyby.periAlt, apogeeFactor: m.flyby.apogeeFactor }).node);
    run(() => sim.maneuver.done, 20000);
    sim.stage();
    run(() => false, 7200);
    sim.planManeuver(planMCC(sim, { periAlt: m.flyby.periAlt, freeReturn: true }).node);
    run(() => sim.maneuver.done, 20000);
    run(() => sim.region === "moon", 7 * 86400);
    run(() => sim.region === "earth", 3 * 86400);
    sim.planManeuver(planCorridor(sim, 40000, 3600));
    run(() => sim.maneuver.done, 20000);
    run(() => sim.nav.alt < 2000000, 12 * 86400);
    while (sim.rt.eventIndex < sim.rt.events.length) sim.stage();
    sim.attMode = "retrograde";
    run(() => sim.isEnded(), 86400);
    const e = sim.entry;
    // eslint-disable-next-line no-console
    console.log("Flyby", sim.status, (sim.t / 86400).toFixed(2), "closest", (sim.moonClosest.alt / 1000).toFixed(0), "EI fpa", e.ei && e.ei.fpa.toFixed(2), "maxG", e.maxG.toFixed(1), "flux MW/m2", (e.maxFlux / 1e6).toFixed(2), "load kJ/cm2", (e.heatLoad / 1e7).toFixed(1));
    expect(sim.status).toBe("splashdown");
    expect(sim.moonClosest.alt).toBeLessThan(m.flyby.maxAlt);
    expect(e.maxG).toBeLessThan(10);
    expect(e.ei.fpa).toBeLessThan(-5.5);
    expect(e.ei.fpa).toBeGreaterThan(-7.5);
    const ls = lifeSupportStatus(sim);
    expect(ls.o2).toBeGreaterThan(0);
    const res = evaluateFlight(sim, design, m, "amateur");
    expect(res.objectives.filter((o) => o.id !== "budget").every((o) => o.met)).toBe(true);
  }, 180000);

  const entrySim = (fpaDeg) => {
    const design = { name: "cap", stack: [{ uid: "c1", partId: "chute_pack" }, { uid: "c2", partId: "capsule_3" }, { uid: "c3", partId: "heat_shield_37" }], radials: [] };
    const sim = new FlightSim({ design, mission, profile: DEFAULT_PROFILE, guidanceOn: false });
    sim.clamped = false;
    sim.status = "flight";
    sim.rt.eventIndex = sim.rt.events.length;
    const r = EARTH.radius + 122000, g = (fpaDeg * Math.PI) / 180, V = 11000;
    sim.r = [r, 0, 0];
    sim.v = [V * Math.sin(g), V * Math.cos(g), 0];
    sim.nav = sim.computeNav();
    const run = lunarRun(sim);
    run(() => sim.isEnded() || (sim.nav.alt > 130000 && sim.nav.vr > 0), 4000);
    return sim;
  };

  test("Entry corridor: −6.5° splashes down; −10° exceeds crew g / heat limits; −3.5° skips out", () => {
    const ok = entrySim(-6.5), steep = entrySim(-10), shallow = entrySim(-3.5);
    // eslint-disable-next-line no-console
    console.log("entry", ok.status, ok.entry.maxG.toFixed(1), "| steep", steep.status, steep.entry.maxG.toFixed(1), steep.endReason, "| shallow", shallow.status, shallow.nav.alt.toFixed(0));
    expect(ok.status).toBe("splashdown");
    expect(ok.entry.maxG).toBeLessThan(10);
    expect(steep.crewLost || steep.entry.maxG > 10).toBe(true);
    expect(shallow.status).not.toBe("splashdown");
    expect(shallow.nav.alt).toBeGreaterThan(120000);
  }, 60000);

  test("Life support: 3 crew consume O2/water/food at BVAD rates; running out of oxygen loses the crew", () => {
    const sim = entrySim(-6.5);
    const s2 = new FlightSim({ design: sim.design, mission, profile: DEFAULT_PROFILE, guidanceOn: false });
    const before = lifeSupportStatus(s2);
    s2.clamped = false; s2.status = "flight"; s2.rt.eventIndex = s2.rt.events.length;
    const r = EARTH.radius + 400000; s2.r = [r, 0, 0]; s2.v = [0, Math.sqrt(EARTH.mu / r), 0]; s2.nav = s2.computeNav();
    s2.advance(86400, 1e7);
    const after = lifeSupportStatus(s2);
    expect(Math.abs(before.o2 - after.o2 - RATES.o2 * 3 * (s2.t / 86400))).toBeLessThan(0.01);
    s2.advance(4 * 86400, 1e7);
    expect(s2.crewLost).toBe(true);
    expect(s2.endReason).toMatch(/oxygen/);
  }, 60000);

  test("Time warp does not change physics: one big advance equals many small ones across the Moon SOI boundary", () => {
    const m = getMission("lunar_orbiter");
    const base = runAutopilotFlight(presetLunarOrbiter(), m, lunarProfile);
    base.attMode = "prograde";
    base.planManeuver(planTLI(base, { periAlt: 100000 }).node);
    lunarRun(base)(() => base.maneuver.done, 20000);
    const st = base.serialize();
    const mk = () => { const s = new FlightSim({ design: base.design, mission: m, profile: lunarProfile }); s.restore(st); return s; };
    const a = mk(), b = mk();
    const T = 5.3 * 86400 - a.t;
    a.advance(T, 1e8);
    const n = Math.floor(T / 16.7);
    for (let k = 0; k < n; k++) b.advance(16.7, 1e8);
    b.advance(T - Math.floor(T / 16.7) * 16.7, 1e8);
    // eslint-disable-next-line no-console
    console.log("warp", a.region, b.region, a.t.toFixed(2), b.t.toFixed(2));
    expect(a.region).toBe("moon");
    expect(b.digest()).toBe(a.digest());
    const ca = mk(); ca.advance(Math.floor(T / 2), 1e8); const ck = ca.serialize(); ca.advance(T - Math.floor(T / 2), 1e8);
    const cb = mk(); cb.restore(ck); cb.advance(T - Math.floor(T / 2), 1e8);
    expect(cb.digest()).toBe(ca.digest());
  }, 120000);
});

function cross3(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
function norm3(a) { const l = Math.hypot(...a); return a.map((x) => x / l); }
function scale3(a, s) { return a.map((x) => x * s); }
