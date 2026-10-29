import { runAutopilotFlight } from "../flight";
import { presetMarsOrbiter } from "../presets";
import { getMission } from "../missions";
import { DEFAULT_PROFILE } from "../guidance";
import { planTMI, planMOI, bestDepartureDay, transfer, lambert, planetState, AU } from "../mars";
import { evaluateFlight } from "../scoring";

describe("Milestone 5 — Mars", () => {
  test("Lambert: Hohmann-like Earth→Mars transfer; 2026 window minimum near late 2026 with v∞ ≈ 3 km/s", () => {
    const d = bestDepartureDay();
    const t = transfer(d, 210);
    // eslint-disable-next-line no-console
    console.log("best departure day", d, "v∞", (Math.hypot(...t.vinfDep) / 1000).toFixed(2));
    expect(d).toBeGreaterThan(270);
    expect(d).toBeLessThan(400);
    expect(Math.hypot(...t.vinfDep)).toBeLessThan(3800);
    const e = planetState("earth", 0), m = planetState("mars", 0);
    expect(Math.abs(Math.hypot(...e.r) / AU - 1)).toBeLessThan(0.02);
    expect(Math.hypot(...m.r) / AU).toBeGreaterThan(1.38);
    const mu = 1.32712440018e20, r1 = [AU, 0, 0], r2 = [-1.2 * AU, 0.8 * AU, 0], tof = 200 * 86400;
    const { v1 } = lambert(r1, r2, tof);
    let r = r1, v = v1;
    const h = 600;
    for (let i = 0; i < tof / h; i++) {
      const a = (x) => x.map((c) => (-mu * c) / Math.hypot(...x) ** 3);
      const k1 = a(r), r2_ = r.map((c, j) => c + v[j] * h / 2), v2 = v.map((c, j) => c + k1[j] * h / 2), k2 = a(r2_);
      const r3 = r.map((c, j) => c + v2[j] * h / 2), v3 = v.map((c, j) => c + k2[j] * h / 2), k3 = a(r3);
      const r4 = r.map((c, j) => c + v3[j] * h), v4 = v.map((c, j) => c + k3[j] * h), k4 = a(r4);
      r = r.map((c, j) => c + (h / 6) * (v[j] + 2 * v2[j] + 2 * v3[j] + v4[j]));
      v = v.map((c, j) => c + (h / 6) * (k1[j] + 2 * k2[j] + 2 * k3[j] + k4[j]));
    }
    expect(Math.hypot(...r.map((c, j) => c - r2[j]))).toBeLessThan(1e6);
  });

  test("Mars Orbiter end-to-end: parking orbit → TMI → simplified cruise → MOI → Mars orbit", () => {
    const m = getMission("mars_orbiter");
    const design = presetMarsOrbiter();
    const prof = { ...DEFAULT_PROFILE, targetAltitude: 185000, targetInclination: 28.6 };
    const sim = runAutopilotFlight(design, m, prof);
    expect(sim.status).toBe("orbit");
    sim.attMode = "prograde";
    const run = (c, max) => { const t0 = sim.t; while (!c() && sim.t - t0 < max && !sim.isEnded()) sim.advance(50, 1e6); };
    const p = planTMI(sim);
    sim.planManeuver(p.node);
    run(() => sim.maneuver.done, 2e4);
    // eslint-disable-next-line no-console
    console.log("TMI", JSON.stringify(p.node.dv), "e", sim.nav.el.e.toFixed(3), "status", sim.status, sim.log.slice(-3).map((l) => l.text).join(" / "));
    sim.stage();
    run(() => sim.region === "mars", 5 * 86400);
    expect(sim.region).toBe("mars");
    sim.planManeuver(planMOI(sim));
    run(() => sim.maneuver.done, 5 * 86400);
    run(() => false, 3600);
    // eslint-disable-next-line no-console
    console.log("Mars", sim.nav.body, (sim.nav.el.apoapsis / 1000).toFixed(0), (sim.nav.el.periapsis / 1000).toFixed(0), "align", p.alignDeg.toFixed(1), JSON.stringify(sim.mars.arrival), (sim.t / 86400).toFixed(1));
    expect(sim.marsOrbitAt).not.toBeNull();
    sim.end("ended", "test");
    const res = evaluateFlight(sim, design, m, "amateur");
    expect(res.objectives.find((o) => o.id === "mars").met).toBe(true);
  }, 200000);
});
