import { EARTH, DEG, STABLE_PERIAPSIS } from "./constants";
import { designStats } from "./design";
import { missionBudget, requiredDeltaV, DIFFICULTIES } from "./missions";

const fmt = (x, d = 0) => Number(x).toLocaleString("en-US", { maximumFractionDigits: d, minimumFractionDigits: d });
const km = (m) => `${fmt(m / 1000, 1)} km`;
const clamp01 = (x) => Math.max(0, Math.min(1, x));

export function evaluateFlight(sim, design, mission, difficulty) {
  const stats = designStats(design);
  const budget = missionBudget(mission, difficulty);
  const req = requiredDeltaV(mission).value;
  const el = sim.nav.el;
  const tgt = mission.target;
  const inOrbit = !!sim.orbitAt && sim.status !== "crashed" && el.periapsis >= STABLE_PERIAPSIS;
  const incDeg = el.inc / DEG;
  const remDv = sim.remainingDeltaV();
  const objectives = [
    { id: "orbit", label: mission.objectives[0], met: inOrbit && stats.hasControl, detail: inOrbit ? `Periapsis ${km(el.periapsis)}` : `Periapsis ${el.periapsis > -EARTH.radius ? km(el.periapsis) : "below surface"}` },
    { id: "band", label: mission.objectives[1], met: inOrbit && Math.abs(el.apoapsis - tgt.altitude) <= tgt.tolerance && Math.abs(el.periapsis - tgt.altitude) <= tgt.tolerance, detail: inOrbit ? `${km(el.apoapsis)} × ${km(el.periapsis)}` : "No orbit" },
    { id: "inc", label: mission.objectives[2], met: inOrbit && Math.abs(incDeg - tgt.inclination) <= tgt.incTolerance, detail: `i = ${fmt(incDeg, 2)}°` },
    { id: "budget", label: mission.objectives[3], met: stats.cost <= budget, detail: `$${fmt(stats.cost, 1)}M of $${fmt(budget, 1)}M` },
  ];
  const metCount = objectives.filter((o) => o.met).length;
  const margin = inOrbit ? remDv / req : 0;
  const tOrbit = sim.orbitAt || 0;
  const score = [
    { name: "Objectives", points: 50 * (metCount / objectives.length), max: 50, basis: `${metCount} of ${objectives.length} objectives met × 12.5` },
    { name: "Cost efficiency", points: stats.cost <= budget ? 20 * clamp01(1.5 - stats.cost / budget) : 0, max: 20, basis: stats.cost <= budget ? `20 × clamp(1.5 − ${fmt(stats.cost, 1)}/${fmt(budget, 1)})` : "Over budget → 0" },
    { name: "Fuel margin", points: inOrbit ? 15 * clamp01(margin / 0.1) : 0, max: 15, basis: inOrbit ? `${fmt(remDv)} m/s left = ${fmt(margin * 100, 1)}% of ${fmt(req)} m/s; full points at ≥ 10%` : "No orbit → 0" },
    { name: "Crew safety", points: 0, max: 0, basis: "Not applicable — uncrewed mission" },
    { name: "Time", points: inOrbit ? 15 * clamp01((1500 - tOrbit) / 900) : 0, max: 15, basis: inOrbit ? `Orbit at T+${fmt(tOrbit)} s; full points ≤ 600 s, zero at 1,500 s` : "No orbit → 0" },
  ];
  const total = score.reduce((a, s) => a + s.points, 0);
  const outcome = metCount === objectives.length ? "success" : inOrbit ? "partial" : "failed";
  return {
    at: new Date().toISOString(),
    missionId: mission.id,
    missionName: mission.name,
    difficulty,
    difficultyLabel: DIFFICULTIES[difficulty].label,
    designName: design.name,
    design,
    outcome,
    objectives,
    score,
    total,
    causeChain: buildCauseChain(sim, inOrbit, el, tgt),
    recommendations: buildRecommendations(sim, inOrbit, remDv, req, el, tgt, incDeg),
    telemetry: sim.telemetry,
    log: sim.log,
    summary: { mass: stats.mass, cost: stats.cost, dv: stats.dv.total, twr: stats.liftoffTWR, stages: stats.stageCount, remDv, apo: el.apoapsis, peri: el.periapsis, inc: incDeg, maxQ: sim.maxQ.q, flightTime: sim.t, guidance: !!sim.guidance && !sim.guidance.disengaged },
  };
}

function buildCauseChain(sim, inOrbit, el, tgt) {
  const chain = [];
  if (sim.clamped && sim.status !== "prelaunch") {
    chain.push("Liftoff thrust was lower than vehicle weight", "Vehicle never left the pad");
    return chain;
  }
  for (const f of sim.flameouts) chain.push(`${f.label} at ${km(f.alt)}, ${fmt(f.speed)} m/s (apoapsis ${f.apo === Infinity ? "escape" : km(f.apo)})`);
  if (!inOrbit) {
    const unfired = sim.rt.eventIndex < sim.rt.events.length;
    if (sim.totalProp() > 1 && unfired) chain.push("Propellant remained in a stage that was never staged/ignited");
    chain.push(`Apoapsis peaked at ${km(sim.maxApo)}; periapsis stayed ${el.periapsis < 0 ? "below the surface" : `at ${km(el.periapsis)}`}`);
    if (sim.status === "crashed") chain.push(sim.endReason || "Vehicle re-entered and impacted");
    else chain.push("Flight ended before a stable orbit was reached");
  } else {
    chain.push(`Orbit inserted: ${km(el.apoapsis)} × ${km(el.periapsis)}`);
    if (Math.abs(el.apoapsis - tgt.altitude) > tgt.tolerance || Math.abs(el.periapsis - tgt.altitude) > tgt.tolerance) chain.push("Orbit lies outside the 175–225 km target band");
  }
  return chain;
}

function buildRecommendations(sim, inOrbit, remDv, req, el, tgt, incDeg) {
  const recs = [];
  if (inOrbit) {
    const pct = (100 * remDv) / req;
    if (pct < 3) recs.push(`Fuel margin at orbit insertion was ${fmt(pct, 1)}% (${fmt(remDv)} m/s); add ~${fmt(0.05 * req - remDv)} m/s of Δv or move to a hydrogen upper stage.`);
    else if (pct > 20) recs.push(`${fmt(remDv)} m/s (${fmt(pct)}%) was left over — a smaller upper-stage tank would cut cost and mass.`);
    else recs.push(`Fuel margin ${fmt(pct, 1)}% (${fmt(remDv)} m/s) is healthy.`);
  } else if (!(sim.clamped && sim.status !== "prelaunch")) {
    const r = EARTH.radius + tgt.altitude;
    const eTarget = -EARTH.mu / (2 * r);
    const v = Math.max(sim.flameouts.length ? sim.flameouts[sim.flameouts.length - 1].speed : sim.nav.speed, 1000);
    const lastEnergy = sim.lastBurnEnergy ?? el.energy;
    const short = Math.max(0, (eTarget - lastEnergy) / v);
    if (short > 0) recs.push(`Estimated Δv shortfall ≈ ${fmt(short)} m/s (orbital-energy deficit ÷ speed at last burnout). Add propellant or a more efficient upper stage.`);
  } else recs.push("Increase liftoff thrust or reduce mass to reach a thrust-to-weight of at least 1.2.");
  if (sim.maxQ.q > 45000) recs.push(`Peak dynamic pressure reached ${fmt(sim.maxQ.q / 1000, 1)} kPa at ${km(sim.maxQ.alt)}; lower the guidance max-Q limit.`);
  if (inOrbit && Math.abs(incDeg - tgt.inclination) > tgt.incTolerance) recs.push(`Inclination off by ${fmt(Math.abs(incDeg - tgt.inclination), 2)}°; set the target inclination in the guidance profile before launch.`);
  return recs;
}
