// Dormand-Prince 5(4), embedded error estimate, bounded work. SI positions and velocities.
const A = [
  [],
  [1 / 5],
  [3 / 40, 9 / 40],
  [44 / 45, -56 / 15, 32 / 9],
  [19372 / 6561, -25360 / 2187, 64448 / 6561, -212 / 729],
  [9017 / 3168, -355 / 33, 46732 / 5247, 49 / 176, -5103 / 18656],
  [35 / 384, 0, 500 / 1113, 125 / 192, -2187 / 6784, 11 / 84],
];
const C = [0, 1 / 5, 3 / 10, 4 / 5, 8 / 9, 1, 1],
  B = [35 / 384, 0, 500 / 1113, 125 / 192, -2187 / 6784, 11 / 84, 0],
  E = [
    35 / 384 - 5179 / 57600,
    0,
    500 / 1113 - 7571 / 16695,
    125 / 192 - 393 / 640,
    -2187 / 6784 + 92097 / 339200,
    11 / 84 - 187 / 2100,
    -1 / 40,
  ];
export function adaptiveStep(
  r,
  v,
  t,
  duration,
  acceleration,
  {
    relativeTolerance = 1e-9,
    positionTolerance = 0.02,
    velocityTolerance = 1e-5,
    maxEvaluations = 14000,
  } = {},
) {
  let y = [...r, ...v],
    elapsed = 0,
    h = duration,
    evaluations = 0,
    accepted = 0,
    rejected = 0;
  while (duration - elapsed > 1e-10) {
    h = Math.min(h, duration - elapsed);
    const step = h;
    const k = [];
    for (let stage = 0; stage < 7; stage++) {
      const state = y.map(
        (x, i) =>
          x + step * A[stage].reduce((sum, a, j) => sum + a * k[j][i], 0),
      );
      const accelerationVector = acceleration(
        state.slice(0, 3),
        state.slice(3),
        t + elapsed + C[stage] * step,
      );
      k.push([...state.slice(3), ...accelerationVector]);
      evaluations++;
    }
    const next = y.map(
      (x, i) => x + step * B.reduce((sum, b, j) => sum + b * k[j][i], 0),
    );
    const error = Math.max(
      ...y.map(
        (x, i) =>
          Math.abs(step * E.reduce((sum, e, j) => sum + e * k[j][i], 0)) /
          ((i < 3 ? positionTolerance : velocityTolerance) +
            relativeTolerance * Math.max(Math.abs(x), Math.abs(next[i]))),
      ),
    );
    if (!next.every(Number.isFinite) || !Number.isFinite(error))
      throw Error("Integrator produced a non-finite state");
    if (error <= 1) {
      y = next;
      elapsed += h;
      accepted++;
    } else rejected++;
    if (evaluations > maxEvaluations || h < 1e-8)
      throw Error("Integrator work limit reached; reduce time speed");
    h *= Math.min(5, Math.max(0.15, 0.9 * Math.max(error, 1e-12) ** -0.2));
  }
  return { r: y.slice(0, 3), v: y.slice(3), accepted, rejected, evaluations };
}
