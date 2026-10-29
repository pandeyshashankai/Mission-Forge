import { PARTS } from "./parts";
import { buildSections } from "./design";
import { RATES, RATE_SOURCE, consumablesOf, crewOf } from "./crew";
import { FlightSim } from "./flight";
import { EARTH } from "./constants";
import { getMission } from "./missions";
import { DEFAULT_PROFILE } from "./guidance";
import { CREW_G_LIMIT, SUTTON_GRAVES_K, CD_CAPSULE, LIFT_TO_DRAG } from "./entry";

const fmt = (x, d = 0) => Number(x).toLocaleString("en-US", { maximumFractionDigits: d, minimumFractionDigits: d });
const chk = (id, subsystem, status, summary, formula, inputs, steps, assumptions = []) => ({ id, subsystem, status, summary, calc: { formula, inputs, steps, assumptions } });

const cache = new Map();
// Nominal lunar-return entry of the separable top section: 122 km, 11.0 km/s, −6.5°, automatic bank logic.
export function nominalEntry(design) {
  const top = buildSections(design).slice(-1)[0];
  const key = top.parts.map((p) => p.partId).join(",");
  if (cache.has(key)) return cache.get(key);
  const d = { name: "entry", stack: top.parts.map((p) => ({ ...p })), radials: [] };
  const sim = new FlightSim({ design: d, mission: getMission("first_orbit"), profile: DEFAULT_PROFILE, guidanceOn: false });
  sim.clamped = false;
  sim.status = "flight";
  sim.rt.eventIndex = sim.rt.events.length;
  const r = EARTH.radius + 122000, g = (-6.5 * Math.PI) / 180, V = 11000;
  sim.r = [r, 0, 0];
  sim.v = [V * Math.sin(g), V * Math.cos(g), 0];
  sim.nav = sim.computeNav();
  while (!sim.isEnded() && sim.t < 3000 && !(sim.nav.alt > 140000 && sim.nav.vr > 0)) sim.step(0.05);
  const out = { status: sim.status, reason: sim.endReason, e: sim.entry, blunt: sim.aero.blunt, shield: sim.aero.shield, chute: sim.aero.chute, mass: sim.nav.mass, area: sim.aero.area, rn: sim.aero.noseRadius, crewLost: sim.crewLost };
  cache.set(key, out);
  return out;
}

export function crewChecks(design, mission, stats) {
  if (!mission.crewed) return [chk("crew", "Crew safety", "pass", "Not applicable — uncrewed mission", "—", [], [])];
  const nodes = design.stack;
  const crew = crewOf(nodes);
  const need = mission.crew || 1;
  const checks = [chk("crew_seats", "Crew seats", crew >= need ? "pass" : "fail", `${crew} seat(s) for a ${need}-person crew`, "Σ capsule seats ≥ mission crew", nodes.filter((n) => PARTS[n.partId].crew).map((n) => ({ name: PARTS[n.partId].name, value: PARTS[n.partId].crew, unit: "seats", source: "Part catalog" })), [`${crew} ${crew >= need ? "≥" : "<"} ${need}`])];
  const stores = Object.fromEntries(nodes.filter((n) => PARTS[n.partId].lifeSupport).map((n) => [n.uid, PARTS[n.partId].lifeSupport]));
  const tot = consumablesOf(nodes, stores);
  const days = Math.min(...Object.keys(RATES).map((k) => tot[k] / (RATES[k] * Math.max(1, crew))));
  const reqDays = mission.durationDays * 1.2;
  checks.push(chk("life_support", "Life support (O2 · water · food)", days >= reqDays ? "pass" : days >= mission.durationDays ? "warn" : "fail",
    `${fmt(days, 1)} days of consumables for ${crew} crew vs ${fmt(mission.durationDays)} days planned + 20% margin (${fmt(reqDays, 1)} d)`,
    "days = min_k( stored_k / (rate_k × crew) )",
    [...Object.keys(RATES).map((k) => ({ name: `${k} stored / rate`, value: `${fmt(tot[k], 1)} kg / ${RATES[k]} kg per crew-day`, unit: "", source: RATE_SOURCE }))],
    Object.keys(RATES).map((k) => `${k}: ${fmt(tot[k], 1)} / (${RATES[k]} × ${crew}) = ${fmt(tot[k] / (RATES[k] * Math.max(1, crew)), 2)} days`),
    ["Open-loop supply (no recycling). Consumables in parts that are jettisoned are lost with them.", "Mass of consumables is counted in the part dry mass and not reduced as they are used."]));
  const ne = nominalEntry(design);
  const e = ne.e;
  const ok = ne.status === "splashdown" && !ne.crewLost && e.maxG <= CREW_G_LIMIT;
  checks.push(chk("reentry", "Re-entry & recovery (simulated nominal lunar return)", ok ? "pass" : "fail",
    !ne.blunt ? "Top stage is not a capsule + heat shield without engines — separate the service module with a decoupler below the heat shield" : ok ? `Peak ${fmt(e.maxG, 1)} g, ${fmt(e.maxFlux / 1e6, 2)} MW/m², ${fmt(e.heatLoad / 1e7, 1)} kJ/cm²; ${ne.reason}` : `Nominal entry fails: ${ne.reason || "did not reach splashdown"}`,
    "q̇ = k·√(ρ/r_n)·V³ (Sutton–Graves),  a = q·S·C_D/m (L/D 0.3, auto bank),  chutes: drag area C_D·A",
    [
      { name: "Entry state", value: "122 km, 11.0 km/s, −6.5°", unit: "", source: "Typical lunar-return corridor (Apollo class)" },
      { name: "k (Sutton–Graves, Earth)", value: SUTTON_GRAVES_K, unit: "kg^0.5/m", source: "Sutton & Graves 1971" },
      { name: "Nose radius r_n · area S", value: `${fmt(ne.rn, 1)} m · ${fmt(ne.area, 1)} m²`, unit: "", source: "Heat shield part" },
      { name: "C_D · L/D", value: `${CD_CAPSULE} · ${LIFT_TO_DRAG}`, unit: "", source: "Apollo-class hypersonic capsule" },
      { name: "Shield limits", value: ne.shield ? `${fmt(ne.shield.maxFlux / 1e6, 0)} MW/m², ${fmt(ne.shield.capacity / 1e7, 0)} kJ/cm²` : "none", unit: "", source: "Part catalog" },
      { name: "Crew g limit", value: CREW_G_LIMIT, unit: "g", source: "Simplified from NASA-STD-3001 sustained eyeballs-in tolerance" },
    ],
    [`Simulated with the flight integrator (RK4, 0.05 s) to ${ne.status}`, `Peak load ${fmt(e.maxG, 2)} g; peak stagnation heat flux ${fmt(e.maxFlux / 1e6, 2)} MW/m²; heat load ${fmt(e.heatLoad / 1e7, 2)} kJ/cm²`, `Parachutes: ${e.chute}`],
    ["Convective heating only (radiative heating at > 10 km/s is not modelled).", "The flight itself is the ground truth — a steeper or shallower entry changes these numbers."]));
  return checks;
}
