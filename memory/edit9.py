def edit(p, pairs):
    s=open(p).read()
    for a,b in pairs:
        assert a in s, (p, a[:70])
        s=s.replace(a,b)
    open(p,'w').write(s)
F='/app/frontend/src/sim/'
edit(F+'missions.js',[
('''  expert: { id: "expert", label: "Expert", budgetMult: 0.8, hints: "minimal", guidance: true, desc: "Tight budgets and minimal hints. Full engineering data." },
};''','''  expert: { id: "expert", label: "Expert", budgetMult: 0.8, hints: "minimal", guidance: true, desc: "Tight budgets and minimal hints. Full engineering data." },
  custom: { id: "custom", label: "Custom", budgetMult: 1.0, faultRate: 0.15, hints: "some", guidance: true, desc: "Your own budget multiplier and fault rate." },
};
const LS = typeof localStorage !== "undefined" ? localStorage : null;
const readLS = (k, d) => { try { return JSON.parse(LS.getItem(k)) ?? d; } catch { return d; } };
if (LS) Object.assign(DIFFICULTIES.custom, readLS("mf.customDifficulty", {}));
export function setCustomDifficulty(v) {
  Object.assign(DIFFICULTIES.custom, v);
  DIFFICULTIES.custom.desc = `Budget ×${DIFFICULTIES.custom.budgetMult}, ${DIFFICULTIES.custom.faultRate} faults per day after orbit.`;
  if (LS) LS.setItem("mf.customDifficulty", JSON.stringify({ budgetMult: DIFFICULTIES.custom.budgetMult, faultRate: DIFFICULTIES.custom.faultRate, desc: DIFFICULTIES.custom.desc }));
}'''),
('''  { id: "mars_orbiter", name: "Mars Orbiter", destination: "Mars orbit", crewed: false, available: false, milestone: 5, inspiredBy: "Inspired by MAVEN / Mars Reconnaissance Orbiter" },
];''','''  {
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
    durationDays: 240,
    duration: "≈ 7–9 months: parking orbit, trans-Mars injection in the launch window, simplified cruise, Mars orbit insertion",
    timeScore: { basis: "mars", full: 230 * 86400, zero: 340 * 86400 },
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
export const allMissions = () => [...MISSIONS, ...customMissions()];'''),
('''export const getMission = (id) => MISSIONS.find((m) => m.id === id);''','''export const getMission = (id) => MISSIONS.find((m) => m.id === id) || customMissions().find((m) => m.id === id);'''),
('''  const extra = mission.kind && mission.kind.startsWith("lunar") ? lunarSteps(mission, r) : [];''','''  const extra = mission.kind === "mars" ? marsSteps(mission, r) : mission.kind && mission.kind.startsWith("lunar") ? lunarSteps(mission, r) : [];'''),
('''export const LOSS_ALLOWANCE = 1500;''','''export const LOSS_ALLOWANCE = 1500;
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
}'''),
])
edit(F+'systems.js',[('''import { attachedNodes } from "./crew";''','''import { attachedNodes } from "./crew";
import { DIFFICULTIES } from "./missions";'''),
('''rate: FAULT_RATES[difficulty] ?? 0.15 };''','''rate: difficulty === "custom" ? DIFFICULTIES.custom.faultRate : FAULT_RATES[difficulty] ?? 0.15 };''')])
# bodies: Mars-centred phase
edit(F+'bodies.js',[
('''export function moonState(t, eph) {
  if (cache.t === t''','''const FAR = { r: [1e15, 0, 0], v: [0, 0, 0] };
const MARS_MU = 4.282837e13, MARS_R = 3389500;
export function moonState(t, eph) {
  if (eph.central) return FAR;
  if (cache.t === t'''),
('''export function regionOf(r, t, eph) {
  if (!eph) return "earth";''','''export function regionOf(r, t, eph) {
  if (!eph) return "earth";
  if (eph.central) return eph.central;'''),
('''export function gravity(r, t, eph, j2 = true) {
  if (eph) {''','''export function gravity(r, t, eph, j2 = true) {
  if (eph && eph.central) return scale(r, -MARS_MU / len(r) ** 3);
  if (eph) {'''),
('''export function primaryOf(r, v, t, eph) {''','''export function primaryOf(r, v, t, eph) {
  if (eph && eph.central) return { body: "mars", mu: MARS_MU, R: MARS_R, r, v, center: [0, 0, 0], cv: [0, 0, 0] };'''),
('''  let d = len(r), mu = EARTH.mu;
  if (eph) {''','''  let d = len(r), mu = eph && eph.central ? MARS_MU : EARTH.mu;
  if (eph && !eph.central) {'''),
])
print("ok")
