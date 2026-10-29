import { EARTH, G0 } from "./constants";
import { add, cross, dot, len, norm, scale, sub, clamp } from "./vec";
import { thrustState, runtimeMass, cloneRuntime, consume, applyEvent } from "./design";
import { rk4, propagate, primaryOf, elementsOf, moonState } from "./bodies";

// Step the motion forward (vacuum). Without ctx: Earth with J2, fixed steps. With ctx {t0, eph}: patched-conic Earth/Moon, adaptive steps.
export function stateAt(r, v, dt, maxStep = 5, ctx = null) {
  if (dt <= 0) return { r, v };
  if (ctx && ctx.eph) return propagate(r, v, ctx.t0 || 0, dt, { eph: ctx.eph, j2: ctx.j2 ?? true, k: 2e-3, lo: 0.5, hi: maxStep * 60 });
  const n = Math.ceil(dt / maxStep);
  const h = dt / n;
  const t0 = ctx?.t0 || 0;
  let s = { r, v };
  for (let i = 0; i < n; i++) s = rk4(s.r, s.v, t0 + i * h, h, null, ctx?.j2 ?? true);
  return s;
}

// Predicted path by numerical propagation, expressed in the frame of the body that governs the start point.
export function predictPath(r, v, { points = 240, ctx = null } = {}) {
  const t0 = ctx?.t0 || 0;
  const eph = ctx?.eph || null;
  const p0 = primaryOf(r, v, t0, eph);
  const el = elementsOf(p0);
  const toFrame = (x, t) => (p0.body === "moon" ? sub(x, moonState(t, eph).r) : x);
  if (!eph) {
    const span = el.period && el.period < 2e5 ? el.period : 6 * 3600;
    const h = span / points;
    const pts = [r];
    let s = { r, v };
    let impact = false;
    for (let i = 0; i < points; i++) {
      s = stateAt(s.r, s.v, h, 10, { t0: t0 + i * h, j2: ctx?.j2 });
      pts.push(s.r);
      if (len(s.r) < EARTH.radius) {
        impact = true;
        break;
      }
    }
    return { pts, impact, el, body: "earth" };
  }
  const span = el.period && el.period < 12 * 86400 ? el.period : 12 * 86400;
  const pts = [toFrame(r, t0)];
  let impact = false;
  let n = 0;
  const soi = [];
  let reg = p0.body;
  propagate(r, v, t0, span, {
    eph, k: 0.02, lo: 2, hi: 1800,
    onStep: (s, t) => {
      const q = primaryOf(s.r, s.v, t, eph);
      if (q.body !== reg) {
        soi.push({ t, body: q.body, r: toFrame(s.r, t) });
        reg = q.body;
      }
      if (++n % 2 === 0 || q.body === "moon") pts.push(toFrame(s.r, t));
      if (len(q.r) < q.R) {
        impact = q.body;
        return false;
      }
      return pts.length < 3000;
    },
  });
  return { pts, impact, el, body: p0.body, soi };
}

export function nodeFrame(r, v) {
  const pro = norm(v);
  const nrm = norm(cross(r, v));
  const rad = cross(nrm, pro);
  return { pro, nrm, rad };
}

export const nodeDvEci = (dv, f) => add(add(scale(f.pro, dv[0]), scale(f.nrm, dv[1])), scale(f.rad, dv[2]));

export function nodePrediction(sim, node) {
  const at = stateAt(sim.r, sim.v, node.t - sim.t, 5, sim.ctx());
  const p = primaryOf(at.r, at.v, node.t, sim.eph);
  const dvVec = nodeDvEci(node.dv, nodeFrame(p.r, p.v));
  const v2 = add(at.v, dvVec);
  const after = elementsOf({ ...p, v: add(p.v, dvVec) });
  return { at, dvVec, v2, after, dv: len(dvVec), body: p.body };
}

// Burn time from the rocket equation using the currently active (or next) engines.
// Burn time from the rocket equation, continuing through later stages when the current one runs dry.
export function burnTime(sim, dv) {
  const rt = cloneRuntime(sim.rt);
  let left = dv, time = 0;
  for (let guard = 0; guard < 20 && left > 1e-6; guard++) {
    const ts = thrustState(rt, 1, 0);
    const mdot = ts.flows.reduce((a, f) => a + f.mdot, 0);
    if (ts.F > 0) {
      const ve = ts.F / mdot;
      const m0 = runtimeMass(rt);
      const fuel = Math.min(...ts.flows.map((f) => (f.src.kind === "section" ? rt.sections[f.src.s].tanks[f.src.prop] : rt.radials.find((r) => r.uid === f.src.uid).fuel) / f.mdot)) * mdot;
      const need = m0 * (1 - Math.exp(-left / ve));
      // Crewed vehicles are throttled to 4 g, which stretches high-thrust burns.
      const capped = (dvPart, tPart) => (sim.aero && sim.aero.crew ? Math.max(tPart, dvPart / (4 * G0)) : tPart);
      if (need <= fuel) return time + capped(left, need / mdot);
      const dvStage = ve * Math.log(m0 / (m0 - fuel));
      time += capped(dvStage, fuel / mdot);
      left -= dvStage;
      consume(rt, ts.flows, fuel / mdot);
    }
    const id = rt.events[rt.eventIndex];
    if (!id) return time > 0 ? time : null;
    applyEvent(rt, id);
    rt.eventIndex++;
  }
  return time;
}

// Vis-viva helpers for suggested nodes.
export function raiseApoDv(r, v, targetRadius) {
  const rm = len(r);
  const a = (rm + targetRadius) / 2;
  const vNeed = Math.sqrt(EARTH.mu * (2 / rm - 1 / a));
  return vNeed - len(v);
}

export class ManeuverExec {
  constructor(sim, node) {
    this.type = "maneuver";
    this.node = { ...node };
    const pred = nodePrediction(sim, node);
    this.dvVec = pred.dvVec;
    this.dvTot = pred.dv;
    this.burnTime = burnTime(sim, this.dvTot) ?? 0;
    this.tStart = node.t - this.burnTime / 2;
    this.delivered = [0, 0, 0];
    this.phase = "align";
    this.done = false;
    this.pulse = 1;
  }

  remaining() {
    return sub(this.dvVec, this.delivered);
  }

  target() {
    const rem = this.remaining();
    return len(rem) > 1e-6 ? norm(rem) : norm(this.dvVec);
  }

  update(sim, nav, dt = 0.02) {
    const rem = this.remaining();
    const remM = len(rem);
    if (this.phase !== "burn") {
      sim.throttle = 0;
      if (sim.t >= this.tStart) {
        this.phase = "burn";
        sim.requestCheckpoint(`Before burn (${this.dvTot.toFixed(0)} m/s)`);
        sim.addLog("info", `Maneuver burn start — ${this.dvTot.toFixed(1)} m/s`);
      }
      return;
    }
    if (remM < 0.1 || dot(rem, this.dvVec) <= 0 || (nav.Fmax <= 0 && !sim.rt.events[sim.rt.eventIndex])) {
      sim.throttle = 0;
      this.phase = "done";
      this.done = true;
      sim.node = null;
      sim.addLog("success", `Maneuver complete — residual ${remM.toFixed(2)} m/s`);
      return;
    }
    const a = nav.Fmax > 0 ? nav.Fmax / nav.mass : 0;
    const align = Math.max(0, dot(sim.dir, norm(rem)));
    sim.throttle = a > 0 && align > 0.996 ? clamp(remM / (a * 1.5), 0.01, 1) * align ** 6 : 0;
    if (sim.aero && sim.aero.crew && a > 0) sim.throttle = Math.min(sim.throttle, (4 * G0) / a);
    // Engines with a minimum throttle fire a partial-step pulse for the last fraction of a m/s.
    const aThr = sim.throttle > 0 ? thrustState(sim.rt, sim.throttle, nav.pRatio).F / nav.mass : 0;
    this.pulse = aThr > 0 ? Math.min(1, remM / (aThr * dt)) : 1;
  }

  record(dir, F, m, dt) {
    if (this.phase === "burn" && F > 0) this.delivered = add(this.delivered, scale(dir, (F / m) * dt));
  }
}

export { G0 };
