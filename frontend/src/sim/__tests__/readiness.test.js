import { runReadiness } from "../readiness";
import { presetCrewedFlyby, presetLunarOrbiter } from "../presets";
import { getMission, requiredDeltaV } from "../missions";

describe("Milestone 3 — readiness checks use real calculations", () => {
  test("Crewed flyby preset: seats, life support and simulated nominal re-entry pass; GO overall", () => {
    const r = runReadiness(presetCrewedFlyby(), getMission("crewed_lunar_flyby"), "amateur");
    const st = Object.fromEntries(r.checks.map((c) => [c.id, c.status]));
    expect(st.crew_seats).toBe("pass");
    expect(st.life_support).toBe("pass");
    expect(st.reentry).toBe("pass");
    expect(r.overall).not.toBe("NO-GO");
  }, 60000);

  test("Removing the heat shield makes the simulated re-entry fail", () => {
    const d = presetCrewedFlyby();
    d.stack = d.stack.filter((n) => n.partId !== "heat_shield_37");
    const r = runReadiness(d, getMission("crewed_lunar_flyby"), "amateur");
    expect(r.checks.find((c) => c.id === "reentry").status).toBe("fail");
  }, 60000);

  test("Lunar Δv requirement = ascent + vis-viva TLI (≈3.1 km/s) + corrections + LOI (≈0.8 km/s)", () => {
    const req = requiredDeltaV(getMission("lunar_orbiter"));
    const tli = req.extra.find((x) => /injection/.test(x.name)).value;
    const loi = req.extra.find((x) => /insertion/.test(x.name)).value;
    expect(tli).toBeGreaterThan(3050);
    expect(tli).toBeLessThan(3200);
    expect(loi).toBeGreaterThan(750);
    expect(loi).toBeLessThan(900);
    const r = runReadiness(presetLunarOrbiter(), getMission("lunar_orbiter"), "amateur");
    expect(r.checks.find((c) => c.id === "propulsion").status).toBe("pass");
  });
});
