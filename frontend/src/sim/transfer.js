import { EARTH } from "./constants";
import { add, cross, dot, len, norm, scale, sub } from "./vec";
import { propagate, primaryOf, elementsOf, moonState, MOON } from "./bodies";
import { stateAt, nodeFrame, nodeDvEci } from "./maneuver";

const OPT = { k: 2e-3, lo: 0.5, hi: 600 };

// Fly a node state forward: closest Moon approach, SOI entry state, Earth elements after SOI exit.
export function flyOut(r, v, t0, eph, { tMax = 7 * 86400, through = false } = {}) {
  let minD = Infinity, entry = null, exit = null, impact = false, inMoon = false;
  propagate(r, v, t0, tMax, {
    eph, ...OPT,
    onStep: (s, t) => {
      const m = moonState(t, eph);
      const d = len(sub(s.r, m.r));
      if (d < minD) minD = d;
      if (d < MOON.radius || len(s.r) < EARTH.radius) {
        impact = true;
        return false;
      }
      const nowMoon = d < MOON.soi;
      if (nowMoon && !inMoon && !entry) {
        entry = { r: s.r, v: s.v, t, rel: { r: sub(s.r, m.r), v: sub(s.v, m.v) } };
        if (!through) return false;
      }
      if (!nowMoon && inMoon) {
        exit = { r: s.r, v: s.v, t, el: elementsOf(primaryOf(s.r, s.v, t, eph)) };
        return false;
      }
      inMoon = nowMoon;
      return true;
    },
  });
  return { minD, entry, exit, impact };
}

// B-plane of the Moon-relative hyperbola at SOI entry (T axis in the lunar orbit plane).
export function bPlane(rel, eph, t) {
  const { r, v } = rel;
  const mu = MOON.mu;
  const h = cross(r, v);
  const vinf2 = dot(v, v) - (2 * mu) / len(r);
  const eVec = sub(scale(cross(v, h), 1 / mu), scale(r, 1 / len(r)));
  const e = len(eVec);
  const P = norm(eVec), hn = norm(h);
  const S = add(scale(P, 1 / e), scale(cross(hn, P), Math.sqrt(Math.max(0, 1 - 1 / (e * e)))));
  const k = norm(cross(moonState(t, eph).r, moonState(t, eph).v));
  const T = norm(cross(S, k));
  const Rax = cross(S, T);
  const b = len(h) / Math.sqrt(Math.max(1, vinf2));
  const B = scale(cross(S, hn), b);
  const rp = (dot(h, h) / mu) / (1 + e);
  return { BT: dot(B, T), BR: dot(B, Rax), b, vinf: Math.sqrt(Math.max(0, vinf2)), rp };
}

const bForPeri = (rp, vinf) => rp * Math.sqrt(1 + (2 * MOON.mu) / (rp * vinf * vinf));

function nodeState(sim, t) {
  const at = stateAt(sim.r, sim.v, t - sim.t, 5, sim.ctx());
  return { ...at, f: nodeFrame(at.r, at.v), t };
}

const applyDv = (ns, dv) => add(ns.v, nodeDvEci(dv, ns.f));

function bAt(ns, dv, eph) {
  const res = flyOut(ns.r, applyDv(ns, dv), ns.t, eph);
  return res.entry ? { ...bPlane(res.entry.rel, eph, res.entry.t), res } : { res };
}

// Newton iteration on (prograde, normal) Δv so the arrival B-vector hits (BT*, BR*).
function solveB(ns, dv0, target, eph, iters = 14, inPlaneOnly = false) {
  let dv = [...dv0];
  let cur = bAt(ns, dv, eph);
  for (let i = 0; i < iters && cur.BT !== undefined; i++) {
    const eT = target[0] - cur.BT, eR = target[1] - cur.BR;
    if (inPlaneOnly ? Math.abs(eT) < 5000 : Math.hypot(eT, eR) < 5000) break;
    const d = 0.05;
    const a = bAt(ns, [dv[0] + d, dv[1], dv[2]], eph);
    if (inPlaneOnly) {
      if (a.BT === undefined) break;
      const x = Math.max(-30, Math.min(30, eT / ((a.BT - cur.BT) / d)));
      dv = [dv[0] + x, dv[1], dv[2]];
      cur = bAt(ns, dv, eph);
      continue;
    }
    const b = bAt(ns, [dv[0], dv[1] + d, dv[2]], eph);
    if (a.BT === undefined || b.BT === undefined) break;
    const J = [[(a.BT - cur.BT) / d, (b.BT - cur.BT) / d], [(a.BR - cur.BR) / d, (b.BR - cur.BR) / d]];
    const det = J[0][0] * J[1][1] - J[0][1] * J[1][0];
    if (!det) break;
    let x = (J[1][1] * eT - J[0][1] * eR) / det, y = (-J[1][0] * eT + J[0][0] * eR) / det;
    const m = Math.hypot(x, y);
    if (m > 60) { x *= 60 / m; y *= 60 / m; }
    dv = [dv[0] + x, dv[1] + y, dv[2]];
    cur = bAt(ns, dv, eph);
  }
  return { dv, cur };
}

function returnPerigee(ns, dv, eph) {
  const res = flyOut(ns.r, applyDv(ns, dv), ns.t, eph, { through: true, tMax: 9 * 86400 });
  if (!res.exit) return { alt: Infinity, res };
  const el = res.exit.el;
  return { alt: el.e < 1 ? el.periapsis : Infinity, res };
}

// Aim at the Moon from a node state: periselene altitude and (for free return) an Earth-return perigee.
// The B-vector magnitude is re-scaled from the achieved periselene until it converges (≤ 2 km).
function aimPeri(ns, dv0, th, rpT, eph, inPlaneOnly, iters = 14) {
  let sol = solveB(ns, dv0, [0, 0], eph, 0);
  if (sol.cur.BT === undefined) return sol;
  let bm = bForPeri(rpT, sol.cur.vinf);
  for (let k = 0; k < 4; k++) {
    const tgt = inPlaneOnly ? [Math.sign(sol.cur.BT || 1) * Math.sqrt(Math.max(0, bm * bm - sol.cur.BR ** 2)), sol.cur.BR] : [bm * Math.cos(th), bm * Math.sin(th)];
    sol = solveB(ns, sol.dv, tgt, eph, iters, inPlaneOnly);
    if (sol.cur.rp === undefined || Math.abs(sol.cur.rp - rpT) < 2000 || (inPlaneOnly && Math.abs(sol.cur.BR) > bm)) break;
    bm *= bForPeri(rpT, sol.cur.vinf) / bForPeri(sol.cur.rp, sol.cur.vinf);
  }
  return sol;
}

function aimFromNode(ns, dv0, eph, { periAlt, freeReturn, returnAlt = 40000, inPlaneOnly = false }) {
  const first = solveB(ns, dv0, [0, 0], eph, 0);
  if (first.cur.BT === undefined) return null;
  const rpT = MOON.radius + periAlt;
  const th0 = Math.atan2(first.cur.BR, first.cur.BT);
  const sol = aimPeri(ns, dv0, th0, rpT, eph, inPlaneOnly);
  if (!freeReturn || inPlaneOnly || sol.cur.BT === undefined) return sol;
  const f = (ang) => {
    const s = aimPeri(ns, sol.dv, ang, rpT, eph, false, 4);
    return { ang, s, alt: returnPerigee(ns, s.dv, eph).alt };
  };
  const scan = [];
  for (let i = 0; i < 24; i++) scan.push(f((i / 24) * 2 * Math.PI));
  let best = scan.reduce((a, b) => (Math.abs(b.alt - returnAlt) < Math.abs(a.alt - returnAlt) ? b : a));
  for (let i = 0; i < 24; i++) {
    const a = scan[i], b = scan[(i + 1) % 24];
    if (!Number.isFinite(a.alt) || !Number.isFinite(b.alt) || (a.alt - returnAlt) * (b.alt - returnAlt) > 0) continue;
    let lo = a;
    let hi = { ...b, ang: b.ang < a.ang ? b.ang + 2 * Math.PI : b.ang };
    for (let k = 0; k < 10; k++) {
      const mid = f((lo.ang + hi.ang) / 2);
      if ((mid.alt - returnAlt) * (lo.alt - returnAlt) <= 0) hi = mid;
      else lo = mid;
    }
    const c = Math.abs(lo.alt - returnAlt) < Math.abs(hi.alt - returnAlt) ? lo : hi;
    if (Math.abs(c.alt - returnAlt) < Math.abs(best.alt - returnAlt)) best = c;
    if (Math.abs(best.alt - returnAlt) < 15000) break;
  }
  return { ...best.s, returnAlt: best.alt };
}

// Trans-lunar injection from a circular parking orbit: scan departure times over one orbit with a vis-viva burn
// to the Moon's distance, refine timing on closest approach, then target the arrival B-vector.
export function planTLI(sim, opts) {
  const eph = sim.eph;
  const P = sim.nav.el.period || 5300;
  const minDist = (t, dvp) => {
    const ns = nodeState(sim, t);
    return { ns, d: flyOut(ns.r, applyDv(ns, [dvp, 0, 0]), t, eph).minD };
  };
  const dvHoh = (t) => {
    const ns = nodeState(sim, t);
    const rA = len(moonState(t + 4 * 86400, eph).r) * (opts.apogeeFactor || 1);
    const rm = len(ns.r);
    return Math.sqrt(EARTH.mu * (2 / rm - 2 / (rm + rA))) - len(ns.v);
  };
  let best = null;
  for (let i = 0; i < 36; i++) {
    const t = sim.t + 600 + (i * P) / 36;
    const dvp = dvHoh(t);
    const c = minDist(t, dvp);
    if (!best || c.d < best.d) best = { t, dvp, d: c.d };
  }
  let lo = best.t - P / 36, hi = best.t + P / 36;
  for (let i = 0; i < 14; i++) {
    const a = lo + (hi - lo) * 0.382, b = lo + (hi - lo) * 0.618;
    if (minDist(a, best.dvp).d < minDist(b, best.dvp).d) hi = b;
    else lo = a;
  }
  const t = Math.max(sim.t + 300, (lo + hi) / 2);
  const ns = nodeState(sim, t);
  const sol = aimFromNode(ns, [best.dvp, 0, 0], eph, { ...opts, freeReturn: false, inPlaneOnly: true });
  return sol ? { node: { t, dv: sol.dv }, arrival: sol.cur, returnAlt: sol.returnAlt } : { node: { t, dv: [best.dvp, 0, 0] }, arrival: null };
}

// Mid-course correction toward the same arrival targets.
// For a free return the periselene is relaxed (7,000 → 4,000 → 10,000 → 2,000 km) until a return perigee in the corridor exists.
export function planMCC(sim, opts, lead = 600) {
  const t = sim.t + lead;
  const ns = nodeState(sim, t);
  const alts = opts.freeReturn ? [opts.periAlt, 4e6, 1e7, 2e6] : [opts.periAlt];
  let best = null;
  for (const periAlt of alts) {
    const sol = aimFromNode(ns, [0, 0, 0], sim.eph, { ...opts, periAlt });
    if (!sol || sol.cur.BT === undefined) continue;
    const err = opts.freeReturn ? Math.abs((sol.returnAlt ?? Infinity) - (opts.returnAlt || 40000)) : 0;
    if (!best || err < best.err) best = { sol, err };
    if (err < 15000) break;
  }
  return best ? { node: { t, dv: best.sol.dv }, arrival: best.sol.cur, returnAlt: best.sol.returnAlt } : null;
}

// Lunar orbit insertion: retrograde burn at periselene to a circular orbit there.
export function planLOI(sim) {
  const el = sim.nav.el;
  if (sim.nav.body !== "moon" || !(el.timeToPeri > 60)) return null;
  const t = sim.t + el.timeToPeri;
  const at = stateAt(sim.r, sim.v, el.timeToPeri, 5, sim.ctx());
  const p = primaryOf(at.r, at.v, t, sim.eph);
  return { t, dv: [Math.sqrt(MOON.mu / len(p.r)) - len(p.v), 0, 0] };
}

// Return-corridor correction in Earth's region: bisection on a horizontal (in-plane) burn, which changes the
// angular momentum and therefore the vacuum perigee monotonically between "now" and a straight-down return.
export function planCorridor(sim, targetAlt = 40000, lead = 600) {
  const t = sim.t + lead;
  const ns = nodeState(sim, t);
  if (primaryOf(ns.r, ns.v, t, sim.eph).body !== "earth") return null;
  const up = norm(ns.r);
  const vt = sub(ns.v, scale(up, dot(ns.v, up)));
  const u = norm(vt);
  const per = (sv) => {
    const el = elementsOf({ r: ns.r, v: add(ns.v, scale(u, sv)), mu: EARTH.mu, R: EARTH.radius });
    return el.rp - EARTH.radius;
  };
  const f0 = per(0);
  let lo = 0, hi = f0 > targetAlt ? -len(vt) : len(vt) * 0.5;
  if ((per(hi) - targetAlt) * (f0 - targetAlt) > 0) return null;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    if ((per(mid) - targetAlt) * (f0 - targetAlt) > 0) lo = mid;
    else hi = mid;
  }
  const s = (lo + hi) / 2;
  const dvE = scale(u, s);
  return { t, dv: [dot(dvE, ns.f.pro), dot(dvE, ns.f.nrm), dot(dvE, ns.f.rad)], perigeeAlt: per(s) };
}
