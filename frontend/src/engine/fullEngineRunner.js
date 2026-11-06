import variant from "@jitl/quickjs-singlefile-browser-release-sync";
import { newQuickJSWASMModuleFromVariant } from "quickjs-emscripten-core";
import { weatherDensity } from "../sim/advanced/weatherAtmosphere";
let runtimeModule;
export async function createWasmEngine(
  source,
  { memoryBytes = 256 * 1024 * 1024, commandMilliseconds = 15000 } = {},
) {
  if (
    typeof source !== "string" ||
    source.length > 10000000 ||
    !source.includes("MissionForgeRuntime")
  )
    throw Error("Use the bundled full-engine source.");
  runtimeModule ??= newQuickJSWASMModuleFromVariant(variant);
  const module = await runtimeModule,
    rt = module.newRuntime();
  rt.setMemoryLimit(memoryBytes);
  rt.setMaxStackSize(2 * 1024 * 1024);
  let deadline = Date.now() + commandMilliseconds,
    disposed = false;
  rt.setInterruptHandler(() => Date.now() > deadline);
  const vm = rt.newContext();
  const bridge = vm.newFunction("__mfNrl", (input) => {
    const a = JSON.parse(vm.getString(input)),
      r = weatherDensity({
        doy: a[0],
        seconds: a[1],
        altitude: a[2] * 1000,
        latitude: a[3],
        longitude: a[4],
        f107a: a[6],
        f107: a[7],
        ap: a[8],
      });
    return vm.newString(JSON.stringify(r));
  });
  vm.setProp(vm.global, "__mfNrl", bridge);
  bridge.dispose();
  const evaluate = (code) => {
    deadline = Date.now() + commandMilliseconds;
    const result = vm.evalCode(code, "missionforge-full-engine.js");
    if (result.error) {
      const error = vm.dump(result.error);
      result.error.dispose();
      const message = error?.message || String(error);
      const fatal = /interrupted|out of memory|stack overflow/i.test(message);
      if (fatal) { disposed = true; vm.dispose(); rt.dispose(); }
      const failure = Error(message); failure.fatal = fatal;
      throw failure;
    }
    try {
      return vm.dump(result.value);
    } finally {
      result.value.dispose();
    }
  };
  try {
    evaluate(
      "globalThis.TextEncoder=class{encode(text){const bytes=[];for(const ch of String(text)){let c=ch.codePointAt(0);if(c>=0xD800&&c<=0xDFFF)c=0xFFFD;if(c<128)bytes.push(c);else if(c<2048)bytes.push(192|(c>>6),128|(c&63));else if(c<65536)bytes.push(224|(c>>12),128|((c>>6)&63),128|(c&63));else bytes.push(240|(c>>18),128|((c>>12)&63),128|((c>>6)&63),128|(c&63));}return new Uint8Array(bytes)}};" +
        source +
        "\n;globalThis.__engine=MissionForgeRuntime.createEngine();",
    );
  } catch (e) {
    if (!disposed) { vm.dispose(); rt.dispose(); }
    throw e;
  }
  return {
    dispatch(command) {
      if (disposed) throw Error("Engine session disposed.");
      const raw = JSON.stringify(command);
      if (raw.length > 5000000) throw Error("Engine command exceeds 5 MB.");
      return JSON.parse(
        evaluate(
          "JSON.stringify(__engine.dispatch(JSON.parse(" +
            JSON.stringify(raw) +
            ")))",
        ),
      );
    },
    dispose() {
      if (!disposed) {
        disposed = true;
        vm.dispose();
        rt.dispose();
      }
    },
  };
}
