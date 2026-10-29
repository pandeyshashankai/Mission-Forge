import { EARTH, DEG, STABLE_PERIAPSIS } from "./constants";
import { designStats } from "./design";
import { missionBudget, requiredDeltaV, DIFFICULTIES, isLunar } from "./missions";
import { j2NodeRate, MOON } from "./bodies";
import { lifeSupportStatus } from "./crew";
import { CREW_G_LIMIT } from "./entry";

const SUN_DEG_DAY = 0.9856;

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
  const has = (pid) => design.stack.some((n) => n.partId === pid && sim.sections.some((sec, i) => sim.rt.sections[i].attached && sec.uids.has(n.uid)));
  const reachedMoon = !!sim.moonClosest && sim.moonClosest.d < MOON.soi;
  let objectives;
  let achieved = inOrbit;
  if (mission.kind === "lunar_orbit") {
    const L = mission.lunar;
    const inLunar = !!sim.lunarOrbitAt && sim.nav.body === "moon" && el.e < 1 && sim.status !== "crashed";
    const band = inLunar && Math.abs(el.apoapsis - L.altitude) <= L.tolerance && Math.abs(el.periapsis - L.altitude) <= L.tolerance;
    achieved = band;
    objectives = [
      { id: "tli", label: mission.objectives[0], met: !!sim.orbitAt && reachedMoon, detail: sim.moonClosest ? `Closest Moon approach ${km(sim.moonClosest.alt)}` : "Never left Earth orbit" },
      { id: "lunar", label: mission.objectives[1], met: band, detail: inLunar ? `${km(el.apoapsis)} × ${km(el.periapsis)} (i ${fmt(incDeg, 1)}°)` : "Not in lunar orbit" },
      { id: "safe", label: mission.objectives[2], met: reachedMoon && sim.status !== "crashed", detail: sim.status === "crashed" ? sim.endReason : "No impact" },
      { id: "budget", label: mission.objectives[3], met: stats.cost <= budget, detail: `$${fmt(stats.cost, 1)}M of $${fmt(budget, 1)}M` },
      { id: "payload", label: mission.objectives[4], met: has(mission.payload) && band, detail: !has(mission.payload) ? "Payload missing" : band ? "Payload delivered to lunar orbit" : "Payload on board, but not in the target lunar orbit" },
    ];
  } else if (mission.kind === "lunar_flyby") {
    const e = sim.entry;
    const splash = sim.status === "splashdown" && !sim.crewLost;
    achieved = splash;
    const out = Object.keys(sim.ls.outAt);
    objectives = [
      { id: "flyby", label: mission.objectives[0], met: !!sim.moonClosest && sim.moonClosest.alt <= mission.flyby.maxAlt, detail: sim.moonClosest ? `Closest approach ${km(sim.moonClosest.alt)} above the surface` : "No lunar encounter" },
      { id: "splash", label: mission.objectives[1], met: splash, detail: splash ? sim.endReason : sim.endReason || "Flight ended before splashdown" },
      { id: "crew_g", label: mission.objectives[2], met: splash && e.maxG <= CREW_G_LIMIT, detail: `Peak load ${fmt(e.maxG, 1)} g · peak heat flux ${fmt(e.maxFlux / 1e6, 2)} MW/m² · heat load ${fmt(e.heatLoad / 1e7, 1)} kJ/cm²${e.ei ? ` · entry ${fmt(e.ei.fpa, 2)}° at ${fmt(e.ei.speed)} m/s` : ""}` },
      { id: "consumables", label: mission.objectives[3], met: out.length === 0 && !sim.crewLost, detail: out.length ? `${out.join(", ")} ran out` : `${fmt(lifeSupportStatus(sim).daysLeft, 1)} days of consumables left` },
      { id: "budget", label: mission.objectives[4], met: stats.cost <= budget, detail: `$${fmt(stats.cost, 1)}M of $${fmt(budget, 1)}M` },
    ];
  } else {
    objectives = [
      { id: "orbit", label: mission.objectives[0], met: inOrbit && stats.hasControl, detail: inOrbit ? `Periapsis ${km(el.periapsis)}` : `Periapsis ${el.periapsis > -EARTH.radius ? km(el.periapsis) : "below surface"}` },
      { id: "band", label: mission.objectives[1], met: inOrbit && Math.abs(el.apoapsis - tgt.altitude) <= tgt.tolerance && Math.abs(el.periapsis - tgt.altitude) <= tgt.tolerance, detail: inOrbit ? `${km(el.apoapsis)} × ${km(el.periapsis)}` : "No orbit" },
      { id: "inc", label: mission.objectives[2], met: inOrbit && Math.abs(incDeg - tgt.inclination) <= tgt.incTolerance, detail: inOrbit ? `i = ${fmt(incDeg, 2)}°` : "No orbit" },
      { id: "budget", label: mission.objectives[3], met: stats.cost <= budget, detail: `$${fmt(stats.cost, 1)}M of $${fmt(budget, 1)}M` },
    ];
    if (mission.payload) objectives.push({ id: "payload", label: mission.objectives[4], met: has(mission.payload) && inOrbit, detail: !has(mission.payload) ? "Payload missing" : inOrbit ? "Payload on board in orbit" : "Payload on board, but no stable orbit" });
    if (mission.sso) {
      const rate = (j2NodeRate(el) * 86400) / DEG;
      objectives.push({ id: "sso", label: mission.objectives[5], met: inOrbit && Math.abs(rate - SUN_DEG_DAY) <= 0.05, detail: inOrbit ? `Node drift ${fmt(rate, 3)}°/day from simulated J2 (Sun ${SUN_DEG_DAY}°/day)` : "No orbit" });
    }
  }
  const metCount = objectives.filter((o) => o.met).length;
  const reqFull = requiredDeltaV(mission);
  const refDv = isLunar(mission) ? reqFull.extra.reduce((a, x) => a + x.value, 0) : req;
  const margin = achieved ? remDv / refDv : 0;
  const ts = mission.timeScore;
  const tOrbit = ts.basis === "orbit" ? sim.orbitAt || 0 : ts.basis === "lunar" ? sim.lunarOrbitAt || 0 : sim.t;
  const crewed = stats.crew > 0;
  const W = crewed ? { obj: 40, cost: 15, fuel: 10, crew: 20, time: 15 } : { obj: 50, cost: 20, fuel: 15, crew: 0, time: 15 };
  const ls = lifeSupportStatus(sim);
  const gF = clamp01((CREW_G_LIMIT - sim.entry.maxG) / 4);
  const lsF = clamp01(ls.daysLeft);
  const safe = crewed && !sim.crewLost && sim.status === "splashdown";
  const score = [
    { name: "Objectives", points: W.obj * (metCount / objectives.length), max: W.obj, basis: `${metCount} of ${objectives.length} objectives met × ${fmt(W.obj / objectives.length, 1)}` },
    { name: "Cost efficiency", points: stats.cost <= budget ? W.cost * clamp01(1.5 - stats.cost / budget) : 0, max: W.cost, basis: stats.cost <= budget ? `${W.cost} × clamp(1.5 − ${fmt(stats.cost, 1)}/${fmt(budget, 1)})` : "Over budget → 0" },
    { name: "Fuel margin", points: achieved ? W.fuel * clamp01(margin / 0.1) : 0, max: W.fuel, basis: achieved ? `${fmt(remDv)} m/s left = ${fmt(margin * 100, 1)}% of ${fmt(refDv)} m/s${isLunar(mission) ? " (beyond-LEO budget)" : ""}; full points at ≥ 10%` : "Goal not reached → 0" },
    { name: "Crew safety", points: safe ? W.crew * Math.min(gF, lsF) : 0, max: W.crew, basis: !crewed ? "Not applicable — uncrewed mission" : safe ? `${W.crew} × min(g factor clamp((10 − ${fmt(sim.entry.maxG, 1)} g)/4), consumables factor clamp(${fmt(ls.daysLeft, 1)} days left / 1 day))` : `Crew not recovered safely → 0${sim.lossReason ? ` (${sim.lossReason})` : ""}` },
    { name: "Time", points: achieved ? W.time * clamp01((ts.zero - tOrbit) / (ts.zero - ts.full)) : 0, max: W.time, basis: achieved ? `${ts.basis === "orbit" ? "Orbit" : ts.basis === "lunar" ? "Lunar orbit" : "Mission complete"} at T+${fmt(tOrbit)} s; full points ≤ ${fmt(ts.full)} s, zero at ${fmt(ts.zero)} s` : "Goal not reached → 0" },
  ];
  const total = score.reduce((a, s) => a + s.points, 0);
  const outcome = metCount === objectives.length ? "success" : achieved || inOrbit ? "partial" : "failed";
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
    causeChain: isLunar(mission) ? lunarCauseChain(sim, mission) : buildCauseChain(sim, inOrbit, el, tgt),
    recommendations: isLunar(mission) ? lunarRecommendations(sim, mission, achieved, remDv, refDv) : buildRecommendations(sim, inOrbit, remDv, req, el, tgt, incDeg),
    telemetry: sim.telemetry,
    log: sim.log,
    entry: sim.entry.ei ? { ...sim.entry.ei, maxG: sim.entry.maxGEntry || sim.entry.maxG, maxFlux: sim.entry.maxFlux, heatLoad: sim.entry.heatLoad } : null,
    summary: { mass: stats.mass, cost: stats.cost, dv: stats.dv.total, twr: stats.liftoffTWR, stages: stats.stageCount, remDv, apo: el.apoapsis, peri: el.periapsis, inc: incDeg, maxQ: sim.maxQ.q, flightTime: sim.t, guidance: !!sim.guidance && !sim.guidance.disengaged, moonClosest: sim.moonClosest ? sim.moonClosest.alt : null, maxG: sim.entry.maxG },
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
    if (Math.abs(el.apoapsis - tgt.altitude) > tgt.tolerance || Math.abs(el.periapsis - tgt.altitude) > tgt.tolerance) chain.push(`Orbit lies outside the ${fmt((tgt.altitude - tgt.tolerance) / 1000)}–${fmt((tgt.altitude + tgt.tolerance) / 1000)} km target band`);
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
  } else if (sim.prematureStaging.length) {
    const p = sim.prematureStaging[0];
    recs.push(`A stage was separated at T+${fmt(p.t)} s while it still had propellant (${fmt(p.fuel / 1000, 1)} t). Stage only after flameout, or enable automatic staging.`);
  } else if (remDv > 200) {
    recs.push(`The vehicle still had ${fmt(remDv)} m/s of Δv when the flight ended — the design could have continued. Let the guidance computer finish the ascent or keep burning prograde.`);
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

function lunarCauseChain(sim, mission) {
  const chain = sim.log.filter((l) => /orbit achieved|Maneuver complete|sphere of influence|Entry interface|parachutes|Splashdown|Heat shield|Crew lost|impacted|exhausted/.test(l.text)).map((l) => `T+${fmt(l.t / 3600, 1)} h — ${l.text}`);
  if (!sim.orbitAt) chain.unshift("Parking orbit was never reached");
  else if (!sim.moonClosest || sim.moonClosest.d >= MOON.soi) chain.push(`Trajectory never entered the Moon's sphere of influence${sim.moonClosest ? ` (closest ${km(sim.moonClosest.d)} from the Moon's centre)` : ""}`);
  if (sim.endReason && !chain.some((c) => c.includes(sim.endReason))) chain.push(sim.endReason);
  return chain.slice(-14);
}

function lunarRecommendations(sim, mission, achieved, remDv, refDv) {
  const recs = [];
  const e = sim.entry;
  if (!sim.orbitAt) recs.push("Reach the 185 km parking orbit first — check liftoff TWR and total Δv in the Readiness Review.");
  else if (!sim.moonClosest || sim.moonClosest.d >= MOON.soi) recs.push("Use the Maneuver planner's 'Trans-lunar injection' suggestion; it times the burn so the Moon is there on arrival, then add a mid-course correction.");
  if (mission.kind === "lunar_orbit" && sim.moonClosest && sim.moonClosest.d < MOON.soi && !sim.lunarOrbitAt) recs.push("Plan 'Lunar orbit insertion' at periselene — a retrograde burn of ~800 m/s captures you; without it the craft flies past.");
  if (e.ei) {
    if (e.ei.fpa < -7.5) recs.push(`Entry at ${fmt(e.ei.fpa, 2)}° was too steep — aim the return correction at a ~40 km vacuum perigee (≈ −6.5°) to keep g-loads and heating down.`);
    else if (e.ei.fpa > -5.5) recs.push(`Entry at ${fmt(e.ei.fpa, 2)}° was shallow — the capsule risks skipping out; lower the vacuum perigee to ~40 km.`);
  }
  if (sim.ls.outAt.o2 != null || sim.ls.outAt.water != null) recs.push("Consumables ran out — add a Crew Consumables Pallet or shorten the mission.");
  if (sim.aero.crew && sim.nav.alt < 1e6 && !sim.aero.blunt && sim.status === "crashed") recs.push("Separate the service module before entry so the capsule flies heat-shield first.");
  if (achieved) recs.push(`${fmt(remDv)} m/s left (${fmt((100 * remDv) / refDv, 1)}% of the beyond-LEO budget).`);
  return recs;
}
