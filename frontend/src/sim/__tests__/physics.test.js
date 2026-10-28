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
