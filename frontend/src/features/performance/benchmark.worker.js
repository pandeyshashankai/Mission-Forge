/* global globalThis */
import { accelerationX, circularTrace, benchmarkKernel } from './kernel';
globalThis.onmessage = async event => {
  try {
    const {
      mu,
      radius
    } = event.data;
    let wasm = null,
      reason = '';
    try {
      const response = await fetch('/science/models/central-gravity.wasm');
      if (!response.ok) throw Error('Kernel file unavailable');
      const loaded = await WebAssembly.instantiate(await response.arrayBuffer());
      wasm = loaded.instance.exports.accel;
    } catch (e) {
      reason = e.message;
    }
    let error = 0;
    if (wasm) for (const [x, y, z] of [[radius, 0, 0], [radius, 30000, 1200], [-radius, 2500, -600]]) error = Math.max(error, Math.abs(accelerationX(mu, x, y, z) - wasm(mu, x, y, z)));
    if (error > 1e-10) throw Error('Kernel reference mismatch');
    const benchmark = benchmarkKernel(accelerationX, wasm, mu),
      orbit = circularTrace(benchmark.preferred === 'wasm' ? wasm : accelerationX, mu, radius);
    globalThis.postMessage({
      benchmark,
      orbit,
      kernelError: error,
      wasmAvailable: !!wasm,
      reason
    });
  } catch (e) {
    globalThis.postMessage({
      error: e.message
    });
  }
};
