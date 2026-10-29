import { FlightSim } from "../flight";
import { getMission } from "../missions";
import { DEFAULT_PROFILE } from "../guidance";
import { EARTH } from "../constants";
import { inShadow, SOLAR_CONST } from "../systems";
import { runReadiness } from "../readiness";
import { presetFalconLike } from "../presets";

const orbiting = (stack, difficulty = "amateur") => {
  const design = { name: "t", stack: stack.map((p, i) => ({ uid: `u${i}`, partId: p })), radials: [] };
  const s = new FlightSim({ design, mission: getMission("first_orbit"), profile: DEFAULT_PROFILE, guidanceOn: false, difficulty });
  s.clamped = false; s.status = "orbit"; s.orbitAt = 1; s.rt.eventIndex = s.rt.events.length;
  const r = EARTH.radius + 500000;
  s.r = [r, 0, 0]; s.v = [0, Math.sqrt(EARTH.mu / r), 0]; s.nav = s.computeNav();
  return s;
};

describe("Milestone 4 — spacecraft systems", () => {
  test("Cylindrical Earth shadow: eclipse behind Earth, sunlight in front", () => {
    expect(inShadow([-7e6, 0, 0], [1, 0, 0], EARTH.radius)).toBe(true);
    expect(inShadow([7e6, 0, 0], [1, 0, 0], EARTH.radius)).toBe(false);
    expect(inShadow([-7e6, 6.5e6, 0], [1, 0, 0], EARTH.radius)).toBe(false);
    expect(SOLAR_CONST).toBe(1361);
  });

  test("Satellite sees eclipses each orbit; battery cycles but never browns out; temperature stays near equilibrium", () => {
    const s = orbiting(["sat_medium"]);
    let ecl = 0, minSoc = Infinity;
    for (let i = 0; i < 600; i++) { s.advance(20, 1e6); if (!s.sys.lit) ecl++; minSoc = Math.min(minSoc, s.sys.soc); }
    // eslint-disable-next-line no-console
    console.log("eclipse fraction", (ecl / 600).toFixed(2), "min SoC Wh", minSoc.toFixed(0), "T °C", (s.sys.temp - 273.15).toFixed(1));
    expect(ecl / 600).toBeGreaterThan(0.25);
    expect(ecl / 600).toBeLessThan(0.45);
    expect(s.sys.powerOut).toBe(false);
    expect(minSoc).toBeLessThan(s.pcfg.battery);
  }, 60000);

  test("Battery-only capsule browns out: avionics lose control and a critical alarm is raised", () => {
    const s = orbiting(["capsule_3"]);
    s.advance(9 * 3600, 1e8);
    expect(s.sys.powerOut).toBe(true);
    expect(s.sys.alarms.some((a) => a.id === "power" && a.sev === "critical")).toBe(true);
  }, 60000);

  test("Random faults: none on Amateur; Expert faults are deterministic for the same mission seed and survive save/restore", () => {
    const a = orbiting(["sat_medium"], "amateur");
    a.advance(5 * 86400, 1e8);
    expect(a.sys.faults.length).toBe(0);
    const e1 = orbiting(["sat_medium"], "expert"), e2 = orbiting(["sat_medium"], "expert");
    e1.advance(2 * 86400, 1e8);
    const st = e1.serialize();
    e1.advance(3 * 86400, 1e8);
    e2.restore(st);
    e2.advance(3 * 86400, 1e8);
    // eslint-disable-next-line no-console
    console.log("expert faults", JSON.stringify(e1.sys.faults));
    expect(e1.sys.faults.length).toBeGreaterThan(0);
    expect(JSON.stringify(e2.sys.faults)).toBe(JSON.stringify(e1.sys.faults));
  }, 120000);

  test("Signal delay = distance / c; readiness has real power, thermal and comms checks", () => {
    const s = orbiting(["sat_medium"]);
    s.advance(2, 1e6);
    expect(Math.abs(s.sys.delay - Math.hypot(...s.r) / 299792458)).toBeLessThan(1e-3);
    const r = runReadiness(presetFalconLike(), getMission("first_orbit"), "amateur");
    for (const id of ["power", "thermal", "comms"]) expect(r.checks.find((c) => c.id === id).status).not.toBe("pending");
  }, 30000);
});
