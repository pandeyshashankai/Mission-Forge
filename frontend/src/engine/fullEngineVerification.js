import { createEngine } from "./fullEngineEntry";
export async function verifyEngine(createWasm, initial) {
  const wasm = await createWasm(),
    native = createEngine();
  try {
    wasm.dispatch(initial);
    const initialState = native.dispatch(initial);
    if (
      initialState.mode === "campaign" &&
      initialState.status === "prelaunch"
    ) {
      wasm.dispatch({ type: "launch" });
      native.dispatch({ type: "launch" });
    }
    const rows = [];
    let nativeMs = 0,
      wasmMs = 0;
    for (let i = 0; i < 30; i++) {
      const command = {
        type: "advance",
        seconds: initialState.mode === "campaign" ? 1 : 4,
      };
      let start = performance.now();
      const a = native.dispatch(command);
      nativeMs += performance.now() - start;
      start = performance.now();
      const b = wasm.dispatch(command);
      wasmMs += performance.now() - start;
      const positionError = Math.hypot(...a.r.map((v, k) => v - b.r[k])),
        velocityError = Math.hypot(...a.v.map((v, k) => v - b.v[k])),
        fuelError = Math.abs(a.fuel - b.fuel);
      rows.push({
        t: a.t,
        wasmTime: b.t,
        positionError,
        velocityError,
        fuelError,
      });
      if (
        ![positionError, velocityError, fuelError].every(Number.isFinite) ||
        Math.abs(a.t - b.t) > 1e-7 ||
        positionError > 1 ||
        velocityError > 0.01 ||
        fuelError > 1e-5
      )
        throw Error(
          "Full-engine parity exceeded the declared 1 m / 0.01 m/s / 0.00001 kg tolerance.",
        );
      if (i % 5 === 0) await new Promise((r) => setTimeout(r, 0));
    }
    return {
      kind: "missionforge-full-engine-parity",
      initial,
      rows,
      nativeMs,
      wasmMs,
      pass: true,
      maxPositionError: Math.max(...rows.map((r) => r.positionError)),
      maxVelocityError: Math.max(...rows.map((r) => r.velocityError)),
      maxFuelError: Math.max(...rows.map((r) => r.fuelError)),
      notice:
        "Complete source runs inside the QuickJS WebAssembly interpreter. This is not a native C/Rust rewrite; measured end-to-end command timings include marshaling. The regular renderer keeps its existing backend.",
    };
  } finally {
    wasm.dispose();
  }
}
