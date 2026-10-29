import { EARTH, LAUNCH_SITES, DEG } from "./constants";

export const DIFFICULTIES = {
  amateur: { id: "amateur", label: "Amateur", budgetMult: 1.5, hints: "full", guidance: true, desc: "Larger budgets, good starting presets, full guidance and detailed explanations. No random faults." },
  intermediate: { id: "intermediate", label: "Intermediate", budgetMult: 1.0, hints: "some", guidance: true, desc: "Standard budgets, fewer hints, guidance computer available. Occasional faults (0.15 per day after orbit)." },
  expert: { id: "expert", label: "Expert", budgetMult: 0.8, hints: "minimal", guidance: true, desc: "Tight budgets and minimal hints. Full engineering data. Frequent faults (0.4 per day after orbit)." },
  custom: { id: "custom", label: "Custom", budgetMult: 1.0, faultRate: 0.15, hints: "some", guidance: true, desc: "Your own budget multiplier and fault rate." },
};
const LS = typeof localStorage !== "undefined" ? localStorage : null;
const readLS = (k, d) => { try { return JSON.parse(LS.getItem(k)) ?? d; } catch { return d; } };
if (LS) Object.assign(DIFFICULTIES.custom, readLS("mf.customDifficulty", {}));
export function setCustomDifficulty(v) {
  Object.assign(DIFFICULTIES.custom, v);
  DIFFICULTIES.custom.desc = `Budget ×${DIFFICULTIES.custom.budgetMult}, ${DIFFICULTIES.custom.faultRate} faults per day after orbit.`;
  if (LS) LS.setItem("mf.customDifficulty", JSON.stringify({ budgetMult: DIFFICULTIES.custom.budgetMult, faultRate: DIFFICULTIES.custom.faultRate, desc: DIFFICULTIES.custom.desc }));
}

export const MISSIONS = [
  {
    id: "first_orbit",
    name: "First Orbit",
    inspiredBy: "Inspired by early orbital launch demonstrations (e.g. Explorer 1 era); figures approximate",
    destination: "Earth orbit",
    crewed: false,
    available: true,
    milestone: 1,
    site: "cape",
    target: { altitude: 200000, tolerance: 25000, inclination: 28.6, incTolerance: 2 },
    baseBudget: 70,
    massLimit: 600000,
    reserve: 0.05,
    duration: "≈ 10 minutes to orbit",
    timeScore: { basis: "orbit", full: 600, zero: 1500 },
    objectives: [
      "Place a controllable spacecraft in a stable orbit (periapsis ≥ 140 km)",
      "Both apoapsis and periapsis within 175–225 km",
      "Inclination within ±2° of 28.6°",
      "Total cost within budget",
    ],
    constraints: ["Liftoff mass ≤ 600 t (pad limit)", "Liftoff thrust-to-weight ≥ 1.2 recommended"],
  },
  {
    id: "earth_observer",
    name: "Earth Observer",
    inspiredBy: "Inspired by Landsat-class Earth observation missions; figures approximate",
    destination: "Sun-synchronous Earth orbit",
    crewed: false,
    available: true,
    milestone: 2,
    site: "vandenberg",
    target: { altitude: 700000, tolerance: 25000, inclination: 98.2, incTolerance: 0.5, parkingAltitude: 200000 },
    payload: "sat_medium",
    baseBudget: 100,
    massLimit: 600000,
    reserve: 0.05,
    duration: "≈ 1–2 hours: ascent to a 200 km parking orbit + two-burn Hohmann transfer",
    timeScore: { basis: "end", full: 4000, zero: 12000 },
    objectives: [
      "Place a controllable spacecraft in a stable orbit (periapsis ≥ 140 km)",
      "Both apoapsis and periapsis within 675–725 km",
      "Inclination within ±0.5° of 98.2°",
      "Total cost within budget",
      "Deliver the Observation Bus 2.5 t payload",
      "Sun-synchronous: J2 node drift within ±0.05°/day of the Sun's 0.9856°/day",
    ],
    sso: true,
    constraints: ["Launch south from Vandenberg (retrograde orbit — Earth's rotation works against you)", "Use maneuver nodes on the Orbital Map to raise the orbit", "Liftoff mass ≤ 600 t"],
  },
  {
    id: "lunar_orbiter",
    kind: "lunar_orbit",
    name: "Lunar Orbiter",
    inspiredBy: "Inspired by the Lunar Reconnaissance Orbiter (LRO); figures approximate",
    destination: "Lunar orbit",
    crewed: false,
    available: true,
    milestone: 3,
    site: "cape",
    preset: "lunar_orbiter",
    target: { altitude: 185000, tolerance: 1e9, inclination: 28.6, incTolerance: 90, parkingAltitude: 185000 },
    lunar: { altitude: 100000, tolerance: 75000 },
    moon: { phase: 40 },
    payload: "sat_lunar",
    baseBudget: 110,
    massLimit: 600000,
    reserve: 0.05,
    durationDays: 6,
    duration: "≈ 4–5 days: parking orbit, trans-lunar injection, mid-course correction, lunar orbit insertion",
    timeScore: { basis: "lunar", full: 5.5 * 86400, zero: 10 * 86400 },
    objectives: [
      "Reach a 185 km parking orbit and perform trans-lunar injection",
      "Capture into lunar orbit: periselene and aposelene within 25–175 km",
      "Orbit stays clear of the surface (no lunar impact)",
      "Total cost within budget",
      "Deliver the Lunar Orbiter Bus 1.2 t",
    ],
    constraints: ["Moon moves on its real tilted orbit (28.6° to the equator here) — timing of TLI matters", "Patched-conic gravity: Earth outside, Moon inside its 66,000 km sphere of influence", "Spacecraft needs its own engine for lunar orbit insertion"],
  },
  {
    id: "crewed_lunar_flyby",
    kind: "lunar_flyby",
    name: "Crewed Lunar Flyby & Return",
    inspiredBy: "Inspired by Artemis II (crewed lunar flyby, free return); figures approximate",
    destination: "Moon flyby, Earth return & splashdown",
    crewed: true,
    crew: 3,
    available: true,
    milestone: 3,
    site: "cape",
    preset: "crewed_flyby",
    target: { altitude: 185000, tolerance: 1e9, inclination: 28.6, incTolerance: 90, parkingAltitude: 185000 },
    flyby: { maxAlt: 15000000, periAlt: 7000000, apogeeFactor: 1.14 },
    moon: { phase: 40 },
    baseBudget: 250,
    massLimit: 3000000,
    reserve: 0.05,
    durationDays: 10,
    duration: "≈ 8–10 days: parking orbit, TLI, free-return flyby behind the Moon, return correction, re-entry, splashdown",
    timeScore: { basis: "end", full: 9 * 86400, zero: 14 * 86400 },
    objectives: [
      "Fly within 15,000 km of the lunar surface",
      "Re-enter and splash down with the crew safe",
      "Peak crew load ≤ 10 g and heat shield within its limits",
      "Consumables (O2, water, food) never run out",
      "Total cost within budget",
    ],
    constraints: ["3 crew in a capsule with a heat shield below and parachutes above", "Separate the service module before re-entry", "Entry corridor ≈ −5.5° to −7.5° at 122 km (vacuum perigee ≈ 20–60 km)", "Super-heavy pad: liftoff mass ≤ 3,000 t"],
  },
  {
    id: "mars_orbiter",
    kind: "mars",
    name: "Mars Orbiter",
    inspiredBy: "Inspired by MAVEN / Mars Reconnaissance Orbiter; figures approximate",
    destination: "Mars orbit",
    crewed: false,
    available: true,
    milestone: 5,
    site: "cape",
    preset: "mars_orbiter",
    target: { altitude: 185000, tolerance: 1e9, inclination: 28.6, incTolerance: 90, parkingAltitude: 185000 },
    marsTarget: { periAlt: 400000, periTol: 200000, apoMax: 45000000 },
    payload: "sat_lunar",
    baseBudget: 260,
    massLimit: 3000000,
    reserve: 0.05,
    durationDays: 330,
    duration: "≈ 7–9 months: parking orbit, trans-Mars injection in the launch window, simplified cruise, Mars orbit insertion",
    timeScore: { basis: "mars", full: 320 * 86400, zero: 430 * 86400 },
    objectives: [
      "Depart Earth on a trans-Mars trajectory inside the launch window",
      "Capture into Mars orbit: periapsis 200–600 km, apoapsis ≤ 45,000 km",
      "Orbit stays clear of the surface",
      "Total cost within budget",
      "Deliver the orbiter bus",
    ],
    constraints: ["Earth and Mars move on their real (coplanar) orbits — pick a departure day on the launch-window chart", "Cruise is simplified: Lambert transfer + automatic correction burns charged to your spacecraft", "Mars atmosphere / aerobraking not modelled"],
  },
];
const CUSTOM_KEY = "mf.customMissions";
export const customMissions = () => (LS ? readLS(CUSTOM_KEY, []) : []);
export function makeCustomMission({ name, site, altitude, inclination, payload, budget }) {
  const alt = altitude * 1000;
  return {
    id: `custom_${Date.now().toString(36)}`, custom: true, name: name || "Custom orbit", inspiredBy: "Player-created mission", destination: `${altitude} km × ${inclination}° Earth orbit`,
    crewed: false, available: true, milestone: 6, site,
    target: { altitude: alt, tolerance: 25000, inclination, incTolerance: 0.5, ...(alt > 400000 ? { parkingAltitude: 200000 } : {}) },
    payload: payload || undefined, baseBudget: budget, massLimit: 600000, reserve: 0.05,
    duration: alt > 400000 ? "Parking orbit + Hohmann transfer" : "Direct ascent",
    timeScore: { basis: "end", full: alt > 400000 ? 4000 : 900, zero: alt > 400000 ? 12000 : 2400 },
    objectives: ["Place a controllable spacecraft in a stable orbit (periapsis ≥ 140 km)", `Both apoapsis and periapsis within ${altitude - 25}–${altitude + 25} km`, `Inclination within ±0.5° of ${inclination}°`, "Total cost within budget", "Deliver the selected payload"],
    constraints: ["Player-defined target", "Liftoff mass ≤ 600 t"],
  };
}
export function saveCustomMission(m) {
  if (LS) LS.setItem(CUSTOM_KEY, JSON.stringify([m, ...customMissions().filter((x) => x.id !== m.id)].slice(0, 20)));
}
export function deleteCustomMission(id) {
  if (LS) LS.setItem(CUSTOM_KEY, JSON.stringify(customMissions().filter((x) => x.id !== id)));
}
export const allMissions = () => [...MISSIONS, ...customMissions()];

export const isLunar = (m) => !!m.kind && m.kind.startsWith("lunar");
export const getMission = (id) => MISSIONS.find((m) => m.id === id) || customMissions().find((m) => m.id === id);

export function missionBudget(mission, difficulty) {
  return +(mission.baseBudget * DIFFICULTIES[difficulty].budgetMult).toFixed(1);
}

export const LOSS_ALLOWANCE = 1500;
// Typical 2026 window values: departure v∞ 2.95 km/s (C3 ≈ 8.7 km²/s²), arrival v∞ 2.65 km/s.
const MARS_VINF_DEP = 2950, MARS_VINF_ARR = 2650, MARS_MU = 4.282837e13, MARS_R = 3389500;
function marsSteps(mission, r) {
  const { mu } = EARTH;
  const vc = Math.sqrt(mu / r);
  const tmi = Math.sqrt(MARS_VINF_DEP ** 2 + (2 * mu) / r) - vc;
  const rp = MARS_R + mission.marsTarget.periAlt, ra = MARS_R + 33000e3;
  const moi = Math.sqrt(MARS_VINF_ARR ** 2 + (2 * MARS_MU) / rp) - Math.sqrt(MARS_MU * (2 / rp - 2 / (rp + ra)));
  return [
    { name: "Trans-Mars injection", value: tmi, step: `TMI = √(v∞² + 2μ/r) − √(μ/r) = ${tmi.toFixed(0)} m/s (v∞ ${MARS_VINF_DEP} m/s)` },
    { name: "Cruise corrections", value: 60, step: "Correction allowance = 60 m/s (assumed)" },
    { name: "Mars orbit insertion", value: moi, step: `MOI = √(v∞² + 2μ_M/r_p) − √(μ_M(2/r_p − 2/(r_p + r_a))) = ${moi.toFixed(0)} m/s (400 × 33,000 km capture)` },
  ];
}
const MOON_MU = 4.9048695e12, MOON_R = 1737400, MOON_A = 384400e3;

// Beyond-LEO budget: trans-lunar injection (vis-viva), corrections, and lunar orbit insertion where needed.
function lunarSteps(mission, r) {
  const { mu } = EARTH;
  const vc = Math.sqrt(mu / r);
  const vTli = Math.sqrt(mu * (2 / r - 2 / (r + MOON_A)));
  const tli = vTli - vc;
  const va = Math.sqrt(mu * (2 / MOON_A - 2 / (r + MOON_A)));
  const vinf = Math.sqrt(mu / MOON_A) - va;
  const items = [{ name: "Trans-lunar injection", value: tli, step: `TLI = √(μ(2/r − 2/(r + a_Moon))) − √(μ/r) = ${vTli.toFixed(0)} − ${vc.toFixed(0)} = ${tli.toFixed(0)} m/s` }];
  items.push({ name: "Mid-course / return corrections", value: mission.kind === "lunar_flyby" ? 100 : 50, step: `Correction allowance = ${mission.kind === "lunar_flyby" ? 100 : 50} m/s (assumed)` });
  if (mission.kind === "lunar_orbit") {
    const rp = MOON_R + mission.lunar.altitude;
    const vp = Math.sqrt(vinf * vinf + (2 * MOON_MU) / rp);
    const loi = vp - Math.sqrt(MOON_MU / rp);
    items.push({ name: "Lunar orbit insertion", value: loi, step: `v∞ ≈ v_Moon − v_apogee = ${vinf.toFixed(0)} m/s; LOI = √(v∞² + 2μ_M/r_p) − √(μ_M/r_p) = ${loi.toFixed(0)} m/s` });
  }
  return items;
}

// Ascent delta-v requirement with traceable steps.
export function requiredDeltaV(mission) {
  const site = LAUNCH_SITES[mission.site];
  const { mu, radius: R, rotationRate: w } = EARTH;
  const r = R + mission.target.altitude;
  const dvEnergy = Math.sqrt(2 * (mu / R - mu / (2 * r)));
  const vEq = w * R;
  const inc = Math.max(mission.target.inclination, site.lat);
  const assist = vEq * Math.cos(inc * DEG);
  const ascent = dvEnergy - assist + LOSS_ALLOWANCE;
  const extra = mission.kind === "mars" ? marsSteps(mission, r) : mission.kind && mission.kind.startsWith("lunar") ? lunarSteps(mission, r) : [];
  const value = ascent + extra.reduce((a, x) => a + x.value, 0);
  return {
    value,
    ascent,
    extra,
    dvEnergy,
    assist,
    calc: {
      formula: extra.length ? "Δv_req = [√(2·(μ/R − μ/2r)) − ωR·cos(i) + Δv_losses] + Δv_TLI + Δv_corrections (+ Δv_LOI)" : "Δv_req = √(2·(μ/R − μ/2r)) − ωR·cos(i) + Δv_losses",
      inputs: [
        { name: "μ (Earth gravitational parameter)", value: mu.toExponential(6), unit: "m³/s²", source: EARTH.source },
        { name: "R (Earth mean radius)", value: R.toLocaleString(), unit: "m", source: EARTH.source },
        { name: "r (target orbit radius)", value: r.toLocaleString(), unit: "m", source: "Mission target altitude + R" },
        { name: "ω (Earth rotation rate)", value: w.toExponential(7), unit: "rad/s", source: "IERS" },
        { name: "i (target inclination)", value: inc.toFixed(1), unit: "°", source: "Mission target (≥ site latitude)" },
        { name: "Δv_losses (gravity + drag + steering)", value: LOSS_ALLOWANCE.toLocaleString(), unit: "m/s", source: "Assumed allowance; typical published LEO ascent losses 1.3–1.8 km/s" },
      ],
      steps: [
        `Ideal energy Δv from surface to circular orbit = ${dvEnergy.toFixed(0)} m/s`,
        `Earth-rotation assist = ${vEq.toFixed(1)} × cos(${inc.toFixed(1)}°) = ${assist.toFixed(0)} m/s`,
        `Δv_ascent = ${dvEnergy.toFixed(0)} − ${assist.toFixed(0)} + ${LOSS_ALLOWANCE} = ${ascent.toFixed(0)} m/s`,
        ...extra.map((x) => `${x.name}: ${x.step}`),
        ...(extra.length ? [`Δv_req = ${ascent.toFixed(0)} + ${extra.map((x) => x.value.toFixed(0)).join(" + ")} = ${value.toFixed(0)} m/s`] : []),
      ],
      assumptions: [
        "Energy-equivalent ideal Δv (includes climb to altitude) plus a fixed loss allowance.",
        "Launch due-east-equivalent azimuth for the target inclination.",
        "The flight simulation is the ground truth; this is a pre-flight estimate.",
      ],
    },
  };
}
