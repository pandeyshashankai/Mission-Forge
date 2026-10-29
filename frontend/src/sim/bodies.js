import { EARTH, DEG } from "./constants";
import { add, sub, scale, len, cross, norm } from "./vec";
import { orbitalElements } from "./orbit";

// Earth oblateness (EGM-96 / WGS-84 class values).
export const J2 = 1.08262668e-3;
export const RE_EQ = 6378137;

export const MOON = {
  name: "Moon",
  mu: 4.9048695e12,
  radius: 1737400,
  a: 384400e3,
  e: 0.0549,
  incEq: 28.58,
  source: "IAU / JPL mean lunar orbit elements (a 384,400 km, e 0.0549); equator inclination at major standstill",
};
MOON.soi = MOON.a * Math.pow(MOON.mu / EARTH.mu, 0.4);
MOON.n = Math.sqrt((EARTH.mu + MOON.mu) / MOON.a ** 3);

export const SUN_RATE = (2 * Math.PI) / (365.2422 * 86400);
export const OBLIQUITY = 23.439 * DEG;

export function sunDirAt(t, lon0) {
  const l = lon0 + SUN_RATE * t;
  return [Math.cos(l), Math.sin(l) * Math.cos(OBLIQUITY), Math.sin(l) * Math.sin(OBLIQUITY)];
}

// Moon on a fixed Keplerian ellipse (no nodal precession / solar perturbation).
let cache = { t: NaN, eph: null, s: null };
export function moonState(t, eph) {
  if (cache.t === t && cache.eph === eph) return cache.s;
  const M = eph.M0 + MOON.n * t;
  const e = MOON.e;
  let E = M;
  for (let i = 0; i < 8; i++) E -= (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E));
  const a = MOON.a;
  const b = a * Math.sqrt(1 - e * e);
  const px = a * (Math.cos(E) - e), py = b * Math.sin(E);
  const Ed = MOON.n / (1 - e * Math.cos(E));
  const vx = -a * Math.sin(E) * Ed, vy = b * Math.cos(E) * Ed;
  const { P, Q } = eph.frame || (eph.frame = perifocal(eph));
  const s = { r: add(scale(P, px), scale(Q, py)), v: add(scale(P, vx), scale(Q, vy)) };
  cache = { t, eph, s };
  return s;
}

function perifocal(eph) {
  const O = eph.raan * DEG, i = MOON.incEq * DEG, w = eph.argp * DEG;
  const cO = Math.cos(O), sO = Math.sin(O), ci = Math.cos(i), si = Math.sin(i), cw = Math.cos(w), sw = Math.sin(w);
  return {
    P: [cO * cw - sO * sw * ci, sO * cw + cO * sw * ci, sw * si],
    Q: [-cO * sw - sO * cw * ci, -sO * sw + cO * cw * ci, cw * si],
  };
}

export function earthGravity(r, j2 = true) {
  const rm = len(r);
  const k = -EARTH.mu / (rm * rm * rm);
  if (!j2) return scale(r, k);
  const z2 = (r[2] * r[2]) / (rm * rm);
  const f = 1.5 * J2 * (RE_EQ / rm) ** 2;
  return [k * r[0] * (1 + f * (1 - 5 * z2)), k * r[1] * (1 + f * (1 - 5 * z2)), k * r[2] * (1 + f * (3 - 5 * z2))];
}

// Patched-conic region: Moon gravity only inside its sphere of influence, Earth (with J2) elsewhere.
export function regionOf(r, t, eph) {
  if (!eph) return "earth";
  const m = moonState(t, eph);
  return len(sub(r, m.r)) < MOON.soi ? "moon" : "earth";
}

export function gravity(r, t, eph, j2 = true) {
  if (eph) {
    const m = moonState(t, eph);
    const d = sub(r, m.r);
    const dm = len(d);
    if (dm < MOON.soi) {
      const mAcc = scale(m.r, -(EARTH.mu + MOON.mu) / len(m.r) ** 3);
      return add(scale(d, -MOON.mu / (dm * dm * dm)), mAcc);
    }
  }
  return earthGravity(r, j2);
}

// State relative to the body whose gravity currently applies.
export function primaryOf(r, v, t, eph) {
  if (regionOf(r, t, eph) === "moon") {
    const m = moonState(t, eph);
    return { body: "moon", mu: MOON.mu, R: MOON.radius, r: sub(r, m.r), v: sub(v, m.v), center: m.r, cv: m.v };
  }
  return { body: "earth", mu: EARTH.mu, R: EARTH.radius, r, v, center: [0, 0, 0], cv: [0, 0, 0] };
}

export const elementsOf = (p) => orbitalElements(p.r, p.v, p.mu, p.R);

// Integration step from the local dynamical time sqrt(d³/μ); 0.1 s in low orbit, up to 30 s in cislunar space.
export function dynStep(r, t, eph, k, lo, hi) {
  let d = len(r), mu = EARTH.mu;
  if (eph) {
    const dmoon = len(sub(r, moonState(t, eph).r));
    if (dmoon < MOON.soi) {
      d = dmoon;
      mu = MOON.mu;
    }
  }
  return Math.min(hi, Math.max(lo, k * Math.sqrt((d * d * d) / mu)));
}

export function rk4(r, v, t, h, eph, j2 = true) {
  const k1v = gravity(r, t, eph, j2);
  const r2 = add(r, scale(v, h / 2)), v2 = add(v, scale(k1v, h / 2));
  const k2v = gravity(r2, t + h / 2, eph, j2);
  const r3 = add(r, scale(v2, h / 2)), v3 = add(v, scale(k2v, h / 2));
  const k3v = gravity(r3, t + h / 2, eph, j2);
  const v4 = add(v, scale(k3v, h));
  const k4v = gravity(add(r, scale(v3, h)), t + h, eph, j2);
  return {
    r: add(r, scale(add(add(v, scale(v2, 2)), add(scale(v3, 2), v4)), h / 6)),
    v: add(v, scale(add(add(k1v, scale(k2v, 2)), add(scale(k3v, 2), k4v)), h / 6)),
  };
}

// Adaptive propagation for predictions and targeting (not used by the flight integrator itself).
export function propagate(r, v, t0, dt, { eph = null, j2 = true, k = 2e-3, lo = 0.5, hi = 600, onStep = null } = {}) {
  let s = { r, v }, t = t0;
  const tEnd = t0 + dt;
  while (t < tEnd - 1e-9) {
    const h = Math.min(tEnd - t, dynStep(s.r, t, eph, k, lo, hi));
    s = rk4(s.r, s.v, t, h, eph, j2);
    t += h;
    if (onStep && onStep(s, t) === false) break;
  }
  return { ...s, t };
}

// Analytic J2 secular node regression rate (rad/s).
export function j2NodeRate(el) {
  if (!(el.e < 1) || !(el.a > 0)) return 0;
  const n = Math.sqrt(EARTH.mu / el.a ** 3);
  const p = el.a * (1 - el.e * el.e);
  return -1.5 * n * J2 * (RE_EQ / p) ** 2 * Math.cos(el.inc);
}

export const sunBeta = (sun, h) => Math.asin(Math.max(-1, Math.min(1, sun[0] * norm(h)[0] + sun[1] * norm(h)[1] + sun[2] * norm(h)[2])));

// Ephemeris that puts the Moon's orbit plane through the parking-orbit plane of a due-east launch from the site.
export function lunarEphemeris(site, phaseDeg = 40) {
  return { raan: site.lon - 90, argp: 0, M0: phaseDeg * DEG };
}

export { cross };
