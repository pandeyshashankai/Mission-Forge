/* global globalThis */
import { compareModels } from "./modelComparison";
globalThis.onmessage = async (e) => {
  try {
    globalThis.postMessage({
      result: await compareModels(
        e.data,
        () => new Promise((r) => setTimeout(r, 0)),
      ),
    });
  } catch (error) {
    globalThis.postMessage({ error: error.message });
  }
};
