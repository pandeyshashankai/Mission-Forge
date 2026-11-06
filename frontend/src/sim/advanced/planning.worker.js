import { ExplorationSim } from "../exploration";
import { predictAerobrake } from "./aerobraking";
/* global globalThis */
import { predictEncounter } from "./encounters";
import { installLocalBodies } from "../solarSystem";
import { loadWeatherModel } from "./weatherAtmosphere";
globalThis.onmessage = async (event) => {
  try {
    installLocalBodies(event.data.customBodies || []);
    if (event.data.initial?.physics?.atmosphere === "msis")
      await loadWeatherModel();
    const cargo = event.data.cargoMass || 0;
    if (!Number.isFinite(cargo) || cargo < 0 || cargo > 200000)
      throw Error("Invalid forecast cargo mass");
    let result;
    if (event.data.kind === "aerobrake") {
      const sim = ExplorationSim.restore(event.data.initial);
      sim.craft = { ...sim.craft, dryMass: sim.craft.dryMass + cargo };
      result = predictAerobrake(sim, event.data.periAltitude);
    } else
      result = predictEncounter(
        event.data.initial,
        event.data.targetId,
        event.data.hours,
        cargo,
      );
    globalThis.postMessage({ result });
  } catch (error) {
    globalThis.postMessage({ error: error.message });
  }
};
