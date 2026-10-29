import { EARTH, DEG } from "./constants";
import { add, cross, dot, len, norm, scale, sub } from "./vec";
import { OBLIQUITY, propagate } from "./bodies";
import { stateAt, nodeFrame, nodeDvEci } from "./maneuver";
import { orbitalElements } from "./orbit";

export const AU = 1.495978707e11;
export const MU_SUN = 1.32712440018e20;
export const MARS = { name: "Mars", mu: 4.282837e13, radius: 3389500, soi: 5.77e8 };
export const EARTH_SOI = 9.24e8;
export const EPOCH_LABEL = "2026-01-01";
const J2000_TO_EPOCH = 9496.5;
// Mean elements at J2000 (Standish/JPL approximate ephemeris); planets coplanar in the ecliptic here.
const PLANETS = {
  earth: { a: 1.00000261, e: 0.01671123, L0: 100.46457166, w: 102.93768193, n: 0.98560911 },
  mars: { a: 1.52371034, e: 0.0933941, L0: -4.55343205, w: -23.94362959, n: 0.52402068 },
};
export const EPHEM_SOURCE = "JPL approximate planetary elements (Standish), coplanar ecliptic approximation";

export function planetState(name, day) {
  const p = PLANETS[name];
  const M = ((p.L0 + p.n * (day + J2000_TO_EPOCH) - p.w) * DEG) % (2 * Math.PI);
  let E = M;
  for (let i = 0; i < 10; i++) E -= (E - p.e * Math.sin(E) - M) / (1 - p.e * Math.cos(E));
  const a = p.a * AU, b = a * Math.sqrt(1 - p.e * p.e);
  const n = Math.sqrt(MU_SUN / a ** 3);
  const Ed = n / (1 - p.e * Math.cos(E));
  const x = a * (Math.cos(E) - p.e), y = b * Math.sin(E), vx = -a * Math.sin(E) * Ed, vy = b * Math.cos(E) * Ed;
  const w = p.w * DEG, c = Math.cos(w), s = Math.sin(w);
  return { r: [c * x - s * y, s * x + c * y, 0], v: [c * vx - s * vy, s * vx + c * vy, 0] };
}

const stumpC = (z) => (z > 1e-8 ? (1 - Math.cos(Math.sqrt(z))) / z : z < -1e-8 ? (Math.cosh(Math.sqrt(-z)) - 1) / -z : 0.5);
const stumpS = (z) => (z > 1e-8 ? (Math.sqrt(z) - Math.sin(Math.sqrt(z))) / z ** 1.5 : z < -1e-8 ? (Math.sinh(Math.sqrt(-z)) - Math.sqrt(-z)) / (-z) ** 1.5 : 1 / 6);

// Lambert's problem, universal variables (Curtis Alg. 5.2), prograde single revolution.
export function lambert(r1, r2, tof, mu = MU_SUN) {
  const R1 = len(r1), R2 = len(r2);
  let dth = Math.acos(Math.max(-1, Math.min(1, dot(r1, r2) / (R1 * R2))));
  if (cross(r1, r2)[2] < 0) dth = 2 * Math.PI - dth;
  const A = Math.sin(dth) * Math.sqrt((R1 * R2) / (1 - Math.cos(dth)));
  const y = (z) => R1 + R2 + (A * (z * stumpS(z) - 1)) / Math.sqrt(stumpC(z));
  const F = (z) => (y(z) / stumpC(z)) ** 1.5 * stumpS(z) + A * Math.sqrt(y(z)) - Math.sqrt(mu) * tof;
  let lo = -4 * Math.PI ** 2, hi = 4 * Math.PI ** 2;
  while (y(lo) < 0) lo += 0.1;
  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2;
    if (F(mid) > 0) hi = mid;
    else lo = mid;
  }
  const z = (lo + hi) / 2, yz = y(z);
  const f = 1 - yz / R1, g = A * Math.sqrt(yz / mu), gd = 1 - yz / R2;
  return { v1: scale(sub(r2, scale(r1, f)), 1 / g), v2: scale(sub(scale(r2, gd), r1), 1 / g) };
}

export function transfer(depDay, tofDays) {
  const e = planetState("earth", depDay), m = planetState("mars", depDay + tofDays);
  const { v1, v2 } = lambert(e.r, m.r, tofDays * 86400);
  return { vinfDep: sub(v1, e.v), vinfArr: sub(v2, m.v), c3: len(sub(v1, e.v)) ** 2 / 1e6 };
}

// Best time of flight for a departure day (scan 150–330 days), minimising departure + arrival v∞.
export function bestTransfer(depDay) {
  let best = null;
  for (let tof = 150; tof <= 330; tof += 10) {
    const t = transfer(depDay, tof);
    const cost = len(t.vinfDep) + 0.5 * len(t.vinfArr);
    if (!best || cost < best.cost) best = { ...t, tof, cost, depDay };
  }
  return best;
}

export function launchWindowChart(from = 0, to = 900, step = 6) {
  const pts = [];
  for (let d = from; d <= to; d += step) {
    const b = bestTransfer(d);
    pts.push({ day: d, vinf: +(len(b.vinfDep) / 1000).toFixed(3), arr: +(len(b.vinfArr) / 1000).toFixed(3), tof: b.tof });
  }
  return pts;
}

export const eclToEq = (v) => [v[0], v[1] * Math.cos(OBLIQUITY) - v[2] * Math.sin(OBLIQUITY), v[1] * Math.sin(OBLIQUITY) + v[2] * Math.cos(OBLIQUITY)];
export const dayOf = (sim) => (sim.mars ? sim.mars.depDay : 0) + sim.t / 86400;

const outAsymptote = (el) => {
  const P = norm(el.eVec), Q = norm(cross(el.h, P));
  return add(scale(P, -1 / el.e), scale(Q, Math.sqrt(1 - 1 / (el.e * el.e))));
};

// Trans-Mars injection: scan the parking orbit for the burn point whose escape asymptote best matches the required v∞ direction.
export function planTMI(sim) {
  const tr = bestTransfer(dayOf(sim));
  const vinfReq = eclToEq(tr.vinfDep);
  const want = norm(vinfReq);
  const P = sim.nav.el.period || 5300;
  let best = null;
  for (let i = 0; i < 72; i++) {
    const t = sim.t + 600 + (i * P) / 72;
    const at = stateAt(sim.r, sim.v, t - sim.t, 5);
    const rm = len(at.r);
    const dv = Math.sqrt(len(vinfReq) ** 2 + (2 * EARTH.mu) / rm) - len(at.v);
    const el = orbitalElements(at.r, add(at.v, scale(norm(at.v), dv)), EARTH.mu, EARTH.radius);
    const score = dot(outAsymptote(el), want);
    if (!best || score > best.score) best = { t, dv, score };
  }
  return { node: { t: best.t, dv: [best.dv, 0, 0] }, transfer: tr, alignDeg: Math.acos(Math.min(1, best.score)) / DEG };
}

// Simplified cruise: when the craft leaves Earth's SOI, the heliocentric leg is the Lambert transfer; the v∞ error is
// removed by automatic correction burns charged to the spacecraft's propellant, then the craft is placed on its
// Mars approach hyperbola at the SOI boundary.
export function startCruise(sim) {
  const el = sim.nav.el;
  if (!(el.e > 1)) return false;
  const day = dayOf(sim);
  const tr = bestTransfer(day - 2);
  const vinfAct = scale(norm(outAsymptote(el)), Math.sqrt(Math.max(0, len(sim.v) ** 2 - (2 * EARTH.mu) / len(sim.r))));
  // Magnitude error only: the asymptote direction is assumed met by choosing the launch time within the day's window.
  const err = Math.abs(len(vinfAct) - len(tr.vinfDep));
  const tcm = err + 10;
  const ok = sim.spendDeltaV(tcm);
  sim.addLog(ok ? "info" : "fail", `Interplanetary cruise: ${tr.tof} days, Lambert transfer; correction burns ${tcm.toFixed(0)} m/s ${ok ? "executed" : "— not enough propellant, Mars missed"}`);
  if (!ok) return sim.end("ended", "Missed Mars — insufficient propellant for cruise corrections");
  sim.lifeAndSystemsCruise(tr.tof * 86400);
  sim.t += tr.tof * 86400;
  sim.mars.arrival = { vinf: len(tr.vinfArr), tof: tr.tof, tcm };
  const vinf = len(tr.vinfArr), mu = MARS.mu, rp = MARS.radius + sim.mars.periAlt;
  const e = 1 + (rp * vinf * vinf) / mu, h = rp * Math.sqrt(vinf * vinf + (2 * mu) / rp), r = MARS.soi * 0.98;
  const nu = -Math.acos(((h * h) / (mu * r) - 1) / e);
  const i = (sim.mars.inc || 0) * DEG;
  const P = [1, 0, 0], Q = [0, Math.cos(i), Math.sin(i)];
  sim.r = add(scale(P, r * Math.cos(nu)), scale(Q, r * Math.sin(nu)));
  sim.v = add(scale(P, (-mu / h) * Math.sin(nu)), scale(Q, (mu / h) * (e + Math.cos(nu))));
  sim.eph = { central: "mars" };
  sim.region = "mars";
  sim.sunAU = len(planetState("mars", dayOf(sim)).r) / AU;
  sim.addLog("info", `Arrived at Mars' sphere of influence — v∞ ${(vinf / 1000).toFixed(2)} km/s, periapsis ${(sim.mars.periAlt / 1000).toFixed(0)} km`);
  sim.requestCheckpoint("Mars arrival (SOI)");
  return true;
}

let bestDayCache = null;
export function bestDepartureDay() {
  if (bestDayCache === null) bestDayCache = launchWindowChart(240, 460, 4).reduce((a, b) => (b.vinf < a.vinf ? b : a)).day;
  return bestDayCache;
}

// Mars orbit insertion at periapsis into a capture ellipse (default apoapsis 33,000 km).
export function planMOI(sim, apoAlt = 33000e3) {
  const el = sim.nav.el;
  if (sim.nav.body !== "mars" || !(el.timeToPeri > 60)) return null;
  const t = sim.t + el.timeToPeri;
  const at = stateAt(sim.r, sim.v, el.timeToPeri, 5, sim.ctx());
  const rp = len(at.r), ra = MARS.radius + apoAlt;
  return { t, dv: [Math.sqrt(MARS.mu * (2 / rp - 2 / (rp + ra))) - len(at.v), 0, 0] };
}

export { propagate, nodeFrame, nodeDvEci };
