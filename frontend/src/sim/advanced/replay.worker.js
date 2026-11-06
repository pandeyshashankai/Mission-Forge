/* global globalThis */
import { loadWeatherModel } from "./weatherAtmosphere";
import { replayControls } from "./controlReplay";
// Runs bounded replay work away from the UI. Recordings contain data, never executable code.
globalThis.onmessage = async (event) => {
  try {
    if (
      event.data?.initial?.physics?.atmosphere === "msis" ||
      event.data?.commands?.some((c) => c.input?.physics?.atmosphere === "msis")
    )
      await loadWeatherModel();
    globalThis.postMessage({ result: replayControls(event.data) });
  } catch (error) {
    globalThis.postMessage({ error: error.message });
  }
};
