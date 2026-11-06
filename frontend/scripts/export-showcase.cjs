require("./register.cjs");
const fs = require("node:fs");
const path = require("node:path");
const { FlightSim } = require("../src/sim/flight");
const { presetFalconLike } = require("../src/sim/presets");
const { getMission } = require("../src/sim/missions");
const { DEFAULT_PROFILE } = require("../src/sim/guidance");
const { evaluateFlight } = require("../src/sim/scoring");
const { NASA_DATA } = require("../src/science/catalog");
const mission = getMission("first_orbit");
const design = presetFalconLike();
const sim = new FlightSim({
  design,
  mission,
  difficulty: "amateur",
  profile: {
    ...DEFAULT_PROFILE,
    targetAltitude: mission.target.altitude,
    targetInclination: mission.target.inclination,
  },
});
sim.launch();
while (!sim.isEnded() && !(sim.orbitAt && sim.guidance.done) && sim.t < 1500) {
  sim.advance(10);
  sim.checkpointQueue = [];
}
const result = evaluateFlight(sim, design, mission, "amateur");
if (result.outcome !== "success")
  throw new Error("Showcase export requires a successful completed flight");
const output = {
  kind: "recorded-simulation-example",
  notice:
    "An automated guided run of the actual FlightSim. This is a recorded example, not a live browser flight, student result, or observed spacecraft track.",
  sourceCommit: NASA_DATA.commit,
  result,
};
fs.writeFileSync(
  path.resolve(__dirname, "../public/submission/showcase-result.json"),
  JSON.stringify(output, null, 2) + "\n",
);
console.log(
  `Exported genuine simulation result: ${result.outcome}, ${sim.t.toFixed(1)} s, periapsis ${(sim.nav.el.periapsis / 1000).toFixed(1)} km`,
);
