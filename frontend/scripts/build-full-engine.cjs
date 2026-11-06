const path = require("node:path"),
  fs = require("node:fs"),
  crypto = require("node:crypto"),
  esbuild = require("esbuild");
const root = path.resolve(__dirname, ".."),
  output = path.join(root, "public/science/models/full-engine.js");
esbuild.buildSync({
  entryPoints: [path.join(root, "src/engine/fullEngineEntry.js")],
  bundle: true,
  platform: "neutral",
  format: "iife",
  globalName: "MissionForgeRuntime",
  target: "es2020",
  outfile: output,
  minify: true,
  legalComments: "inline",
});
const bytes = fs.readFileSync(output),
  metadata = {
    version: 1,
    engine: "Complete campaign and fleet source in QuickJS WebAssembly",
    runtime: "QuickJS 2025-09-13 via quickjs-emscripten 0.32.0",
    sha256: crypto.createHash("sha256").update(bytes).digest("hex"),
    bytes: bytes.length,
    notice:
      "All bundled flight, force, resource, staging, crew, thermal, contact and fleet logic executes inside the Wasm VM. NRLMSISE uses the separately bundled atmosphere Wasm through a typed synchronous bridge. This is an interpreter backend, not a native C/Rust rewrite or a performance claim.",
  };
fs.writeFileSync(
  path.join(root, "public/science/models/full-engine.json"),
  JSON.stringify(metadata, null, 2) + "\n",
);
console.log(
  "Built full-engine VM bundle: " +
    bytes.length +
    " bytes, " +
    metadata.sha256.slice(0, 12),
);
