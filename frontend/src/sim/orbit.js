import { cross, dot, len, norm, scale, sub } from "./vec";

export function orbitalElements(r, v, mu, R) {
  const rm = len(r);
  const vm2 = dot(v, v);
  const h = cross(r, v);
  const hm = len(h);
  const eVec = sub(scale(cross(v, h), 1 / mu), scale(r, 1 / rm));
  const e = len(eVec);
  const energy = vm2 / 2 - mu / rm;
  const a = -mu / (2 * energy);
  const inc = hm > 0 ? Math.acos(Math.max(-1, Math.min(1, h[2] / hm))) : 0;
  const rp = (hm * hm) / mu / (1 + e);
  const ra = e < 1 ? a * (1 + e) : Infinity;
  let timeToApo = null;
  let period = null;
  if (e < 1 && a > 0) {
    const n = Math.sqrt(mu / (a * a * a));
    period = (2 * Math.PI) / n;
    if (e > 1e-6) {
      const cosE = Math.max(-1, Math.min(1, (1 - rm / a) / e));
      let E = Math.acos(cosE);
      if (dot(r, v) < 0) E = 2 * Math.PI - E;
      const M = E - e * Math.sin(E);
      timeToApo = (((Math.PI - M) / n) % period + period) % period;
    }
  }
  return { a, e, eVec, h, inc, energy, periapsis: rp - R, apoapsis: ra - R, rp, ra, period, timeToApo };
}

export function orbitPoints(el, mu, count = 256) {
  if (!(el.e < 1) || !(el.a > 0)) return [];
  const p = norm(el.eVec[0] || el.eVec[1] || el.eVec[2] ? el.eVec : [1, 0, 0]);
  const hn = norm(el.h);
  const q = cross(hn, p);
  const pts = [];
  for (let i = 0; i <= count; i++) {
    const nu = (i / count) * 2 * Math.PI;
    const rr = (el.a * (1 - el.e * el.e)) / (1 + el.e * Math.cos(nu));
    pts.push([
      rr * (Math.cos(nu) * p[0] + Math.sin(nu) * q[0]),
      rr * (Math.cos(nu) * p[1] + Math.sin(nu) * q[1]),
      rr * (Math.cos(nu) * p[2] + Math.sin(nu) * q[2]),
    ]);
  }
  return pts;
}

export const circularSpeed = (mu, r) => Math.sqrt(mu / r);
export const orbitalPeriod = (mu, a) => 2 * Math.PI * Math.sqrt((a * a * a) / mu);
