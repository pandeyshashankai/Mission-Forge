import { verifyEngine } from "./fullEngineVerification";
/* global globalThis */
import { createWasmEngine } from "./fullEngineRunner";
import { loadWeatherModel } from "../sim/advanced/weatherAtmosphere";
let engine = null,
  sourceText = null;
globalThis.onmessage = async (e) => {
  try {
    if (e.data.type === "initialize") {
      engine?.dispose();
      engine = null;
      await loadWeatherModel();
      const [s, m] = await Promise.all([
        fetch("/science/models/full-engine.js"),
        fetch("/science/models/full-engine.json"),
      ]);
      if (!s.ok || !m.ok)
        throw Error(
          "Full-engine assets unavailable. Prepare offline play while online.",
        );
      const source = await s.text(),
        meta = await m.json(),
        hash = Array.from(
          new Uint8Array(
            await crypto.subtle.digest(
              "SHA-256",
              new TextEncoder().encode(source),
            ),
          ),
        )
          .map((x) => x.toString(16).padStart(2, "0"))
          .join("");
      if (hash !== meta.sha256)
        throw Error("Full-engine source checksum mismatch.");
      sourceText = source;
      engine = await createWasmEngine(source);
      globalThis.postMessage({ ready: true, metadata: meta });
    } else if (e.data.type === "verify") {
      if (!sourceText) throw Error("Initialize first.");
      globalThis.postMessage({
        verification: await verifyEngine(
          () => createWasmEngine(sourceText),
          e.data.initial,
        ),
      });
    } else {
      if (!engine) throw Error("Initialize the full Wasm engine first.");
      globalThis.postMessage({ result: engine.dispatch(e.data) });
    }
  } catch (error) {
    if (error.fatal) engine = null;
    globalThis.postMessage({ error: error.message, fatal: !!error.fatal });
  }
};
