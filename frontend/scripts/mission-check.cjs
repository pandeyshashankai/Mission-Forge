require("./register.cjs");
const { FlightSim } = require("../src/sim/flight");
const { PRESETS } = require("../src/sim/presets");
const { getMission } = require("../src/sim/missions");
const { DEFAULT_PROFILE } = require("../src/sim/guidance");
const {
  planTLI,
  planMCC,
  planLOI,
  planCorridor,
} = require("../src/sim/transfer");
const { evaluateFlight } = require("../src/sim/scoring");
const { len } = require("../src/sim/vec");
const { stateAt, raiseApoDv } = require("../src/sim/maneuver");
const { EARTH } = require("../src/sim/constants");
const id = process.argv[2] || "lunar_orbiter";
const m = getMission(id);
const difficulty = process.argv[3] || "amateur";
const preset = m.preset || (m.payload ? "orbiter9eo" : "orbiter9");
const sim = new FlightSim({
  design: PRESETS.find((p) => p.id === preset).make(),
  mission: m,
  difficulty,
  profile: {
    ...DEFAULT_PROFILE,
    targetAltitude: m.target.parkingAltitude || m.target.altitude,
    targetInclination: m.target.inclination,
  },
});
function advanceUntil(check, maxTime) {
  while (sim.t < maxTime && !sim.isEnded() && !check()) {
    sim.advance(Math.min(sim.t < 1500 ? 10 : 300, maxTime - sim.t));
    sim.checkpointQueue = [];
  }
  console.log(
    JSON.stringify({
      t: sim.t,
      status: sim.status,
      body: sim.nav.body,
      alt: sim.nav.alt,
      apo: sim.nav.el.apoapsis,
      peri: sim.nav.el.periapsis,
      reason: sim.endReason,
    }),
  );
}
sim.launch();
advanceUntil(() => sim.orbitAt && sim.guidance.done, 1500);
if (!sim.orbitAt) throw Error("Parking orbit failed");
if (m.id === "earth_observer") {
  const at = stateAt(sim.r, sim.v, 120, 5, sim.ctx());
  sim.planManeuver({
    t: sim.t + 120,
    dv: [raiseApoDv(at.r, at.v, EARTH.radius + m.target.altitude), 0, 0],
  });
  advanceUntil(() => sim.maneuver.done, sim.t + 2000);
  const toApo = sim.nav.el.timeToApo;
  const ap = stateAt(sim.r, sim.v, toApo, 5, sim.ctx());
  sim.planManeuver({
    t: sim.t + toApo,
    dv: [Math.sqrt(EARTH.mu / len(ap.r)) - len(ap.v), 0, 0],
  });
  advanceUntil(() => sim.maneuver.done, sim.t + 8000);
}
if (m.moon) {
  const opts = {
    periAlt: m.flyby?.periAlt || m.lunar.altitude,
    freeReturn: !!m.flyby,
    returnAlt: 40000,
    apogeeFactor: m.flyby?.apogeeFactor || 1,
  };
  console.time("TLI");
  const tli = planTLI(sim, opts);
  console.timeEnd("TLI");
  console.log("TLI", tli.node);
  sim.planManeuver(tli.node);
  advanceUntil(() => sim.maneuver.done, sim.t + 20000);
  advanceUntil(() => sim.t > tli.node.t + 86400, sim.t + 100000);
  console.time("MCC");
  const mcc = planMCC(sim, opts);
  console.timeEnd("MCC");
  console.log("MCC", mcc?.node);
  if (mcc) {
    sim.planManeuver(mcc.node);
    advanceUntil(() => sim.maneuver.done, sim.t + 10000);
  }
  advanceUntil(() => sim.nav.body === "moon", sim.t + 7 * 86400);
  if (m.kind === "lunar_orbit") {
    const loi = planLOI(sim);
    console.log("LOI", loi);
    if (loi) {
      sim.planManeuver(loi);
      advanceUntil(() => sim.maneuver.done, sim.t + 200000);
    }
    advanceUntil(() => sim.lunarOrbitAt, sim.t + 3000);
  } else {
    advanceUntil(() => sim.nav.body === "earth", sim.t + 8 * 86400);
    const corridor = planCorridor(sim);
    console.log("Corridor", corridor);
    if (corridor) {
      sim.planManeuver(corridor);
      advanceUntil(() => sim.maneuver.done, sim.t + 10000);
    }
    advanceUntil(() => sim.nav.alt < 200000, sim.t + 8 * 86400);
    sim.autoStage = false;
    while (!sim.aero.blunt && sim.rt.events[sim.rt.eventIndex]) sim.stage();
    advanceUntil(() => sim.isEnded(), sim.t + 20000);
  }
}
const result = evaluateFlight(sim, sim.design, m, difficulty);
console.log(
  JSON.stringify(
    {
      outcome: result.outcome,
      summary: result.summary,
      objectives: result.objectives,
      log: sim.log.slice(-15),
    },
    null,
    2,
  ),
);
if (result.outcome !== "success") process.exitCode = 1;
