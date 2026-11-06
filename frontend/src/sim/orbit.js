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
      timeToApo = ((((Math.PI - M) / n) % period) + period) % period;
    }
  }
  const raan = Math.atan2(h[0], -h[1]);
  let timeToPeri = null;
  if (e > 1e-6 && a < 0) {
    const coshF = Math.max(1, (1 + rm / -a) / e);
    const F = Math.log(coshF + Math.sqrt(coshF * coshF - 1));
    const M = e * Math.sinh(F) - F;
    timeToPeri = dot(r, v) < 0 ? M / Math.sqrt(mu / (-a) ** 3) : null;
  } else if (period && timeToApo !== null)
    timeToPeri = (timeToApo + period / 2) % period;
  return {
    a,
    e,
    eVec,
    h,
    inc,
    raan,
    energy,
    periapsis: rp - R,
    apoapsis: ra - R,
    rp,
    ra,
    period,
    timeToApo,
    timeToPeri,
  };
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
export const orbitalPeriod = (mu, a) =>
  2 * Math.PI * Math.sqrt((a * a * a) / mu);

export const escapeSpeed = (mu, r) => Math.sqrt((2 * mu) / r);

// Classical angles; singular circular/equatorial cases stay explicit rather than inventing zeros.
export function orbitalOrientation(r, v, mu) {
  const e = orbitalElements(r, v, mu, 0), n = cross([0, 0, 1], e.h);
  const nm = len(n), hm = len(e.h), rm = len(r);
  const wrap = x => (x + 2 * Math.PI) % (2 * Math.PI);
  const angle = (a,b) => Math.acos(Math.max(-1,Math.min(1,dot(a,b)/(len(a)*len(b)))));
  let raan = null, argumentOfPeriapsis = null, trueAnomaly = null;
  if (hm > 0 && nm / hm > 1e-8) raan = wrap(Math.atan2(n[1],n[0]));
  if (e.e > 1e-8 && rm > 0) {
    trueAnomaly = angle(e.eVec,r);
    if (dot(r,v)<0) trueAnomaly=2*Math.PI-trueAnomaly;
    if (raan !== null) {
      argumentOfPeriapsis=angle(n,e.eVec);
      if(e.eVec[2]<0) argumentOfPeriapsis=2*Math.PI-argumentOfPeriapsis;
    }
  }
  return {raan,argumentOfPeriapsis,trueAnomaly};
}
