export function accelerationX(mu, x, y, z) {
  const r = Math.sqrt(x * x + y * y + z * z);
  return -mu * x / (r * r * r);
}
export function circularTrace(accel, mu, radius, steps = 720) {
  if (!(mu > 0 && radius > 0) || !Number.isInteger(steps) || steps < 32 || steps > 4096) throw Error('Invalid central orbit bounds');
  const period = 2 * Math.PI * Math.sqrt(radius ** 3 / mu),
    dt = period / steps;
  let s = [radius, 0, 0, Math.sqrt(mu / radius)],
    maxRadiusError = 0,
    maxEnergyDrift = 0;
  const initial = -mu / (2 * radius),
    trace = [s[0], s[1]];
  const derivative = state => [state[2], state[3], accel(mu, state[0], state[1], 0), accel(mu, state[1], state[0], 0)];
  for (let i = 0; i < steps; i++) {
    const a = derivative(s),
      b = derivative(s.map((x, k) => x + a[k] * dt / 2)),
      c = derivative(s.map((x, k) => x + b[k] * dt / 2)),
      d = derivative(s.map((x, k) => x + c[k] * dt));
    s = s.map((x, k) => x + dt * (a[k] + 2 * b[k] + 2 * c[k] + d[k]) / 6);
    const r = Math.hypot(s[0], s[1]),
      energy = (s[2] ** 2 + s[3] ** 2) / 2 - mu / r;
    maxRadiusError = Math.max(maxRadiusError, Math.abs(r - radius));
    maxEnergyDrift = Math.max(maxEnergyDrift, Math.abs((energy - initial) / initial));
    trace.push(s[0], s[1]);
  }
  return {
    trace,
    maxRadiusError,
    maxEnergyDrift,
    period,
    steps
  };
}
export function benchmarkKernel(js, wasm, mu, iterations = 100000) {
  if (!Number.isInteger(iterations) || iterations < 1000 || iterations > 500000) throw Error('Benchmark work limit');
  let checksum = 0;
  const run = fn => {
    let sum = 0;
    const start = performance.now();
    for (let i = 0; i < iterations; i++) sum += fn(mu, 7000000 + i % 1000, 2000, 3000);
    checksum += sum;
    return performance.now() - start;
  };
  for (let i = 0; i < 2000; i++) {
    js(mu, 7000000 + i, 2000, 3000);
    wasm?.(mu, 7000000 + i, 2000, 3000);
  }
  const j = [],
    w = [];
  for (let n = 0; n < 5; n++) {
    if (n % 2 && wasm) w.push(run(wasm));
    j.push(run(js));
    if (n % 2 === 0 && wasm) w.push(run(wasm));
  }
  const median = xs => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];
  const jsMs = median(j),
    wasmMs = w.length ? median(w) : null;
  return {
    iterations,
    trials: 5,
    jsMs,
    wasmMs,
    checksum,
    preferred: wasmMs !== null && wasmMs < jsMs * .85 ? 'wasm' : 'javascript'
  };
}
