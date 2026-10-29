import { PARTS } from "./parts";
import { len, dot, sub, scale } from "./vec";
import { EARTH } from "./constants";
import { attachedNodes } from "./crew";

export const SOLAR_CONST = 1361;
const SIGMA = 5.670374e-8;
const C_LIGHT = 299792458;
export const T_MIN = 263, T_MAX = 318, T_FAULT = 338;
export const FAULT_RATES = { amateur: 0, intermediate: 0, expert: 0.4 };
export const SYSTEMS_SOURCE = "Solar constant 1361 W/m² (TSIS-1); Stefan–Boltzmann radiator, ε 0.85, absorptance 0.3; cylindrical shadow model";

// Defaults for control parts that carry their own power & thermal hardware.
const BUILTIN = {
  capsule: { load: 1200, battery: 8000, gen: 0, rad: 6 },
  satellite: { load: 250, battery: 1500, gen: 1200, rad: 3 },
  probe: { load: 60, battery: 400, gen: 0, rad: 0.5 },
};

export function powerConfig(sim) {
  return powerOfNodes(attachedNodes(sim), sim.sys.factors);
}

export function powerOfNodes(nodes, f = { gen: 1, battery: 1, rad: 1 }) {
  const c = { gen: 0, battery: 0, load: 0, rad: 0, ionW: 0, mass: 0 };
  for (const n of nodes) {
    const p = PARTS[n.partId];
    const b = p.control ? BUILTIN[p.look] || BUILTIN.probe : null;
    const s = p.systems || {};
    for (const k of ["gen", "battery", "load", "rad"]) c[k] += (s[k] || 0) + (b ? b[k] : 0);
    if (p.engine && p.engine.powerW) c.ionW += p.engine.powerW;
    c.mass += p.dryMass;
  }
  c.gen *= f.gen;
  c.battery *= f.battery;
  c.rad *= f.rad;
  return c;
}

export function newSystems(missionId, difficulty) {
  let seed = 2166136261;
  for (const ch of `${missionId}|${difficulty}`) seed = Math.imul(seed ^ ch.charCodeAt(0), 16777619) >>> 0;
  return { soc: null, temp: 293, rng: seed, faults: [], alarms: [], factors: { gen: 1, battery: 1, rad: 1, wheel: 1 }, commsOutUntil: 0, powerOut: false, lit: true, lastCheck: 0, delay: 0, link: true, rate: FAULT_RATES[difficulty] ?? 0 };
}

const rand = (sys) => {
  let t = (sys.rng = (sys.rng + 0x6d2b79f5) >>> 0);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

export function inShadow(p, sun, R) {
  const along = dot(p, sun);
  return along < 0 && len(sub(p, scale(sun, along))) < R;
}

export function alarm(sim, id, sev, text) {
  const sys = sim.sys;
  if (sys.alarms.some((a) => a.id === id && !a.cleared)) return;
  sys.alarms.unshift({ id, sev, text, t: sim.t, ack: false, cleared: false });
  sys.alarms = sys.alarms.slice(0, 20);
  sim.addLog(sev === "critical" ? "fail" : "warn", `ALARM: ${text}`);
}
const clearAlarm = (sim, id) => sim.sys.alarms.forEach((a) => a.id === id && (a.cleared = true));

const FAULTS = [
  { id: "wheel", text: "Reaction wheel failure — control torque and momentum halved", apply: (s) => (s.factors.wheel *= 0.5) },
  { id: "array", text: "Solar array string failure — power generation −40%", apply: (s) => (s.factors.gen *= 0.6) },
  { id: "battery", text: "Battery cell failure — capacity −30%", apply: (s) => (s.factors.battery *= 0.7) },
  { id: "radiator", text: "Radiator loop leak — radiating area −50%", apply: (s) => (s.factors.rad *= 0.5) },
  { id: "comms", text: "Transponder reset — communications lost for 6 h", apply: (s, sim) => (s.commsOutUntil = sim.t + 6 * 3600) },
];

export function applyFaultFactors(sim) {
  const f = sim.sys.factors.wheel;
  sim.config.wheelTorque *= f;
  sim.config.wheelMomentum *= f;
}

// Integrated in ≥ 1 s chunks (accumulated sim time keeps it deterministic).
export function systemsStep(sim, dtIn, firingIon = 0) {
  const sys = sim.sys;
  sys.acc = (sys.acc || 0) + dtIn;
  if (sys.acc < 1 && !firingIon) return;
  const dt = sys.acc;
  sys.acc = 0;
  const c = sim.pcfg || (sim.pcfg = powerConfig(sim));
  if (sys.soc === null) sys.soc = c.battery;
  const sun = sim.sunDir;
  let lit = !inShadow(sim.r, sun, EARTH.radius);
  if (lit && sim.prim && sim.prim.body !== "earth") lit = !inShadow(sim.prim.r, sun, sim.prim.R);
  sys.lit = lit;
  // Survival heaters switch on below 5 °C (half the avionics load).
  const heater = sys.temp < 278 && !sys.powerOut ? 0.5 * c.load : 0;
  const load = c.load + c.ionW * firingIon + heater;
  const gen = lit ? c.gen / (sim.sunAU || 1) ** 2 : 0;
  sys.gen = gen;
  sys.load = load;
  sys.soc = Math.min(c.battery, Math.max(0, sys.soc + ((gen - load) * dt) / 3600));
  const out = c.load > 0 && sys.soc <= 0 && gen < load;
  if (out && !sys.powerOut) alarm(sim, "power", "critical", "Battery depleted — avionics brown-out, attitude & engine control lost");
  if (!out && sys.powerOut) clearAlarm(sim, "power");
  sys.powerOut = out;
  if (c.battery > 0 && sys.soc < 0.2 * c.battery && !out) alarm(sim, "lowbatt", "warning", "Battery below 20%");
  else if (sys.soc > 0.3 * c.battery) clearAlarm(sim, "lowbatt");
  // Single-node thermal balance: internal dissipation + absorbed sunlight − radiated heat.
  const Cth = 900 * Math.min(Math.max(c.mass, 200), 6000);
  const qSun = lit ? (0.3 * SOLAR_CONST * 2) / (sim.sunAU || 1) ** 2 : 0;
  const qRad = 0.85 * SIGMA * Math.max(c.rad, 0.2) * (sys.temp ** 4 - 3 ** 4);
  sys.temp += ((load + qSun - qRad) * dt) / Cth;
  if (sys.temp > T_FAULT) alarm(sim, "overheat", "critical", `Avionics overheating (${(sys.temp - 273.15).toFixed(0)} °C)`);
  else if (sys.temp > T_MAX) alarm(sim, "hot", "warning", `Temperature high (${(sys.temp - 273.15).toFixed(0)} °C)`);
  else if (sys.temp < T_MIN) alarm(sim, "cold", "warning", `Temperature low (${(sys.temp - 273.15).toFixed(0)} °C)`);
  else ["hot", "cold", "overheat"].forEach((id) => clearAlarm(sim, id));
  // Communications: one-way light time to Earth, line of sight past the Moon.
  const toEarth = sim.earthVector ? sim.earthVector() : scale(sim.r, -1);
  sys.delay = len(toEarth) / C_LIGHT;
  let link = sim.t >= sys.commsOutUntil && !out;
  if (link && sim.prim && sim.prim.body === "moon") {
    const d = sim.prim.r, u = scale(toEarth, 1 / len(toEarth));
    const along = -dot(d, u);
    if (along > 0 && len(sub(scale(d, -1), scale(u, along))) < sim.prim.R) link = false;
  }
  if (!link && sys.link) alarm(sim, "comms", "warning", sim.t < sys.commsOutUntil ? "Loss of signal — transponder fault" : out ? "Loss of signal — no power" : "Loss of signal — behind the Moon");
  if (link && !sys.link) clearAlarm(sim, "comms");
  sys.link = link;
  // Random faults: Poisson process at the difficulty rate (per day), seeded and serialized for determinism.
  if (sim.orbitAt && sys.rate > 0 && sim.t - sys.lastCheck >= 600) {
    sys.lastCheck = sim.t;
    if (sys.faults.length < 4 && rand(sys) < 1 - Math.exp((-sys.rate * 600) / 86400)) {
      const f = FAULTS[Math.floor(rand(sys) * FAULTS.length)];
      sys.faults.push({ id: f.id, t: sim.t });
      f.apply(sys, sim);
      sim.pcfg = null;
      if (f.id === "wheel") {
        sim.config.wheelTorque *= 0.5;
        sim.config.wheelMomentum *= 0.5;
      }
      alarm(sim, `fault-${sys.faults.length}`, "critical", f.text);
    }
  }
}

// Readiness: the top (payload) stage must power itself through eclipses and stay within thermal limits.
export function systemsChecks(sections, mission) {
  // Spacecraft = top sections down to the first launch/escape stage (engines > 200 kN).
  const sc = [];
  for (let i = sections.length - 1; i >= 0; i--) {
    const big = sections[i].parts.some((n) => PARTS[n.partId].engine && PARTS[n.partId].engine.thrustVac > 2e5);
    if (big && sc.length) break;
    sc.push(...sections[i].parts);
    if (big) break;
  }
  const c = powerOfNodes(sc);
  const hours = mission.durationDays ? mission.durationDays * 24 : mission.timeScore.zero / 3600;
  const ecl = 0.38;
  const avg = c.gen * (1 - ecl);
  const battH = c.load > 0 ? c.battery / c.load : Infinity;
  const powerOk = c.gen > 0 ? avg >= c.load * 1.1 && battH * 0.8 >= 0.6 : battH * 0.8 >= hours;
  const tHot = ((c.load + 0.3 * SOLAR_CONST * 2) / (0.85 * SIGMA * Math.max(c.rad, 0.2))) ** 0.25;
  const tCold = (c.load / (0.85 * SIGMA * Math.max(c.rad, 0.2))) ** 0.25;
  const thermOk = tHot <= T_MAX + 15 && tCold >= T_MIN - 30;
  const mk = (id, subsystem, status, summary, formula, inputs, steps) => ({ id, subsystem, status, summary, calc: { formula, inputs, steps, assumptions: [SYSTEMS_SOURCE] } });
  return [
    mk("power", "Electrical power", c.load === 0 ? "pass" : powerOk ? "pass" : "fail",
      c.load === 0 ? "No powered avionics on the top stage" : c.gen > 0 ? `Orbit-average ${Math.round(avg)} W vs ${Math.round(c.load)} W load; battery ${battH.toFixed(1)} h` : `Battery only: ${(battH * 0.8).toFixed(1)} h usable vs ${hours.toFixed(1)} h mission`,
      "P_avg = P_array × (1 − eclipse fraction);  t_batt = E_batt × 0.8 DoD / P_load",
      [{ name: "Array output (1 AU)", value: c.gen, unit: "W", source: "Part catalog" }, { name: "Battery", value: c.battery, unit: "Wh", source: "Part catalog" }, { name: "Load", value: c.load, unit: "W", source: "Avionics / crew systems" }, { name: "Eclipse fraction (LEO)", value: ecl, unit: "", source: "≈ 36 min of a 92 min orbit" }],
      [`P_avg = ${c.gen} × ${1 - ecl} = ${Math.round(avg)} W ${c.gen > 0 ? (avg >= c.load * 1.1 ? "≥" : "<") : ""} 1.1 × ${c.load} W`, `Usable battery = ${c.battery} × 0.8 / ${c.load} = ${(battH * 0.8).toFixed(2)} h`]),
    mk("thermal", "Thermal control", thermOk ? "pass" : "warn",
      `Equilibrium ${Math.round(tHot - 273.15)} °C in sun, ${Math.round(tCold - 273.15)} °C in eclipse (limits ${T_MIN - 273} to ${T_MAX - 273} °C)`,
      "T_eq = ((Q_int + αS·A_sun) / (εσA_rad))^¼",
      [{ name: "Radiator area", value: c.rad.toFixed(1), unit: "m²", source: "Built-in + radiator parts" }, { name: "Internal heat", value: c.load, unit: "W", source: "Avionics load" }, { name: "Absorbed sunlight", value: Math.round(0.3 * SOLAR_CONST * 2), unit: "W", source: "α 0.3 × 1361 W/m² × 2 m²" }],
      [`T_sun = ${Math.round(tHot)} K, T_eclipse = ${Math.round(tCold)} K`]),
    (() => {
      const d = mission.kind && mission.kind.startsWith("lunar") ? 4.06e8 : 2e6;
      return mk("comms", "Communication link", "pass", `Max one-way signal delay ≈ ${d / C_LIGHT > 60 ? `${(d / C_LIGHT / 60).toFixed(1)} min` : `${(d / C_LIGHT).toFixed(2)} s`} at the destination; occultation by the Moon/planet causes loss of signal`, "delay = distance / c", [{ name: "Max distance", value: (d / 1000).toExponential(2), unit: "km", source: "Mission geometry" }, { name: "c", value: C_LIGHT, unit: "m/s", source: "SI definition" }], [`${(d / 1000).toExponential(3)} km / c = ${(d / C_LIGHT).toFixed(2)} s`]);
    })(),
  ];
}
