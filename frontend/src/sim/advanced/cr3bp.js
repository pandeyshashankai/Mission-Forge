import { adaptiveStep } from "./integrator";
export function cr3bpAcceleration(r, v, mu) {
  const x = r[0],
    y = r[1],
    z = r[2],
    d1 = Math.hypot(x + mu, y, z),
    d2 = Math.hypot(x - 1 + mu, y, z);
  return [
    x +
      2 * v[1] -
      ((1 - mu) * (x + mu)) / d1 ** 3 -
      (mu * (x - 1 + mu)) / d2 ** 3,
    y - 2 * v[0] - ((1 - mu) * y) / d1 ** 3 - (mu * y) / d2 ** 3,
    (-(1 - mu) * z) / d1 ** 3 - (mu * z) / d2 ** 3,
  ];
}
export function jacobi(r, v, mu) {
  return (
    r[0] ** 2 +
    r[1] ** 2 +
    2 *
      ((1 - mu) / Math.hypot(r[0] + mu, r[1], r[2]) +
        mu / Math.hypot(r[0] - 1 + mu, r[1], r[2])) -
    v.reduce((s, x) => s + x * x, 0)
  );
}
export function lagrangePoints(mu) {
  if (!(mu > 0 && mu < 0.5))
    throw Error("Mass ratio must be between zero and one half.");
  const root = (lo, hi) => {
    for (let i = 0; i < 100; i++) {
      const mid = (lo + hi) / 2,
        f = cr3bpAcceleration([mid, 0, 0], [0, 0, 0], mu)[0];
      const flo = cr3bpAcceleration([lo, 0, 0], [0, 0, 0], mu)[0];
      if (f * flo > 0) lo = mid;
      else hi = mid;
    }
    return [(lo + hi) / 2, 0, 0];
  };
  return {
    L1: root(-mu + 1e-6, 1 - mu - 1e-6),
    L2: root(1 - mu + 1e-6, 3),
    L3: root(-3, -mu - 1e-6),
    L4: [0.5 - mu, Math.sqrt(3) / 2, 0],
    L5: [0.5 - mu, -Math.sqrt(3) / 2, 0],
  };
}
export function propagateCR3BP(initial, mu, duration) {
  if (
    !initial?.r ||
    !initial?.v ||
    ![...initial.r, ...initial.v, mu, duration].every(Number.isFinite) ||
    initial.r.length !== 3 ||
    initial.v.length !== 3 ||
    mu <= 0 ||
    mu >= 0.5 ||
    duration <= 0 ||
    duration > 12
  )
    throw Error("Invalid restricted-three-body scenario.");
  let state = { r: [...initial.r], v: [...initial.v] },
    t = 0;
  const points = [{ t, ...state }],
    c0 = jacobi(state.r, state.v, mu);
  let maxDrift = 0,
    impact = false;
  while (t < duration - 1e-10) {
    if (
      Math.hypot(state.r[0] + mu, state.r[1], state.r[2]) < 0.017 ||
      Math.hypot(state.r[0] - 1 + mu, state.r[1], state.r[2]) < 0.0046
    ) {
      impact = true;
      break;
    }
    const dt = Math.min(0.01, duration - t);
    state = adaptiveStep(
      state.r,
      state.v,
      t,
      dt,
      (r, v) => cr3bpAcceleration(r, v, mu),
      {
        positionTolerance: 1e-11,
        velocityTolerance: 1e-11,
        relativeTolerance: 1e-10,
      },
    );
    t += dt;
    maxDrift = Math.max(maxDrift, Math.abs(jacobi(state.r, state.v, mu) - c0));
    points.push({ t, r: state.r, v: state.v });
  }
  return { points, jacobi: c0, maxDrift, impact };
}
