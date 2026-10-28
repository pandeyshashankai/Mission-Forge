import { EARTH, LAUNCH_SITES, DEG } from "./constants";

export const DIFFICULTIES = {
  amateur: { id: "amateur", label: "Amateur", budgetMult: 1.5, hints: "full", guidance: true, desc: "Larger budgets, good starting presets, full guidance and detailed explanations." },
  intermediate: { id: "intermediate", label: "Intermediate", budgetMult: 1.0, hints: "some", guidance: true, desc: "Standard budgets, fewer hints, guidance computer available." },
  expert: { id: "expert", label: "Expert", budgetMult: 0.8, hints: "minimal", guidance: true, desc: "Tight budgets and minimal hints. Full engineering data." },
};

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
    objectives: [
      "Place a controllable spacecraft in a stable orbit (periapsis ≥ 140 km)",
      "Both apoapsis and periapsis within 175–225 km",
      "Inclination within ±2° of 28.6°",
      "Total cost within budget",
    ],
    constraints: ["Liftoff mass ≤ 600 t (pad limit)", "Liftoff thrust-to-weight ≥ 1.2 recommended"],
  },
  { id: "earth_observer", name: "Earth Observer", destination: "Sun-synchronous Earth orbit", crewed: false, available: false, milestone: 2, inspiredBy: "Inspired by Landsat-class missions" },
  { id: "lunar_orbiter", name: "Lunar Orbiter", destination: "Moon orbit", crewed: false, available: false, milestone: 3, inspiredBy: "Inspired by Lunar Reconnaissance Orbiter" },
  { id: "crewed_lunar_flyby", name: "Crewed Lunar Flyby & Return", destination: "Moon flyby, Earth return", crewed: true, available: false, milestone: 3, inspiredBy: "Inspired by Artemis II" },
  { id: "mars_orbiter", name: "Mars Orbiter", destination: "Mars orbit", crewed: false, available: false, milestone: 5, inspiredBy: "Inspired by MAVEN / Mars Reconnaissance Orbiter" },
];

export const getMission = (id) => MISSIONS.find((m) => m.id === id);

export function missionBudget(mission, difficulty) {
  return +(mission.baseBudget * DIFFICULTIES[difficulty].budgetMult).toFixed(1);
}

export const LOSS_ALLOWANCE = 1500;

// Ascent delta-v requirement with traceable steps.
export function requiredDeltaV(mission) {
  const site = LAUNCH_SITES[mission.site];
  const { mu, radius: R, rotationRate: w } = EARTH;
  const r = R + mission.target.altitude;
  const dvEnergy = Math.sqrt(2 * (mu / R - mu / (2 * r)));
  const vEq = w * R;
  const inc = Math.max(mission.target.inclination, site.lat);
  const assist = vEq * Math.cos(inc * DEG);
  const value = dvEnergy - assist + LOSS_ALLOWANCE;
  return {
    value,
    dvEnergy,
    assist,
    calc: {
      formula: "Δv_req = √(2·(μ/R − μ/2r)) − ωR·cos(i) + Δv_losses",
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
        `Δv_req = ${dvEnergy.toFixed(0)} − ${assist.toFixed(0)} + ${LOSS_ALLOWANCE} = ${value.toFixed(0)} m/s`,
      ],
      assumptions: [
        "Energy-equivalent ideal Δv (includes climb to altitude) plus a fixed loss allowance.",
        "Launch due-east-equivalent azimuth for the target inclination.",
        "The flight simulation is the ground truth; this is a pre-flight estimate.",
      ],
    },
  };
}
