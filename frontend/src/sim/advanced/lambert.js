import { len, dot, cross, scale, sub } from "../vec";
const stumpff = (z) => {
  if (Math.abs(z) < 1e-7)
    return {
      c: 0.5 - z / 24 + (z * z) / 720,
      s: 1 / 6 - z / 120 + (z * z) / 5040,
    };
  if (z > 0) {
    const x = Math.sqrt(z);
    return { c: (1 - Math.cos(x)) / z, s: (x - Math.sin(x)) / (x * x * x) };
  }
  const x = Math.sqrt(-z);
  return { c: (Math.cosh(x) - 1) / -z, s: (Math.sinh(x) - x) / (x * x * x) };
};
// Zero-revolution, prograde universal-variable Lambert solution. No atmospheric or SOI forces.
export function lambert(r1, r2, seconds, mu) {
  if (
    ![...r1, ...r2, seconds, mu].every(Number.isFinite) ||
    seconds <= 0 ||
    mu <= 0
  )
    throw Error("Invalid Lambert inputs");
  const m1 = len(r1),
    m2 = len(r2),
    cosine = Math.max(-1, Math.min(1, dot(r1, r2) / (m1 * m2)));
  let angle = Math.acos(cosine);
  if (cross(r1, r2)[2] < 0) angle = 2 * Math.PI - angle;
  const A = Math.sin(angle) * Math.sqrt((m1 * m2) / (1 - cosine));
  if (!Number.isFinite(A) || Math.abs(A) < Math.sqrt(m1 * m2) * 1e-10)
    throw Error("Collinear Lambert geometry is singular");
  const evaluate = (z) => {
    const { c, s } = stumpff(z);
    if (c <= 0) return null;
    const y = m1 + m2 + (A * (z * s - 1)) / Math.sqrt(c);
    if (y < 0) return null;
    return { time: ((y / c) ** 1.5 * s + A * Math.sqrt(y)) / Math.sqrt(mu), y };
  };
  let low = null,
    high = null,
    last = null;
  for (let i = 0; i <= 512; i++) {
    const z =
        -4 * Math.PI * Math.PI + (i * (8 * Math.PI * Math.PI - 1e-6)) / 512,
      q = evaluate(z);
    if (q && Number.isFinite(q.time)) {
      if (last && last.time <= seconds && q.time >= seconds) {
        low = last.z;
        high = z;
        break;
      }
      last = { z, time: q.time };
    }
  }
  if (low === null)
    throw Error("No zero-revolution solution within the solver bracket");
  let z, y;
  for (let i = 0; i < 90; i++) {
    z = (low + high) / 2;
    const q = evaluate(z);
    if (!q) {
      low = z;
      continue;
    }
    y = q.y;
    if (q.time < seconds) low = z;
    else high = z;
  }
  const f = 1 - y / m1,
    g = A * Math.sqrt(y / mu),
    gdot = 1 - y / m2;
  return {
    departureVelocity: scale(sub(r2, scale(r1, f)), 1 / g),
    arrivalVelocity: scale(sub(scale(r2, gdot), r1), 1 / g),
    flightTime: seconds,
    transferAngle: angle,
  };
}
