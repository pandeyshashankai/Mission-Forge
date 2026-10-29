import { EARTH, G0 } from "./constants";
import { add, cross, dot, len, norm, scale, sub, clamp } from "./vec";
import { thrustState, runtimeMass } from "./design";
import { orbitalElements } from "./orbit";

const grav = (r) => {
  const rm = len(r);
  return scale(r, -EARTH.mu / (rm * rm * rm));
};

function rk4(r, v, dt) {
  const k1v = grav(r);
  const v2 = add(v, scale(k1v, dt / 2));
  const k2v = grav(add(r, scale(v, dt / 2)));
  const v3 = add(v, scale(k2v, dt / 2));
  const k3v = grav(add(r, scale(v2, dt / 2)));
  const v4 = add(v, scale(k3v, dt));
  const k4v = grav(add(r, scale(v3, dt)));
  return {
    r: add(r, scale(add(add(v, scale(v2, 2)), add(scale(v3, 2), v4)), dt / 6)),
    v: add(v, scale(add(add(k1v, scale(k2v, 2)), add(scale(k3v, 2), k4v)), dt / 6)),
  };
}

// Step the two-body motion forward (vacuum, Earth only).
export function stateAt(r, v, dt, maxStep = 5) {
  if (dt <= 0) return { r, v };
  const n = Math.ceil(dt / maxStep);
  const h = dt / n;
  let s = { r, v };
  for (let i = 0; i < n; i++) s = rk4(s.r, s.v, h);
  return s;
}

// Predicted path by numerical propagation; stops at the surface.
export function predictPath(r, v, { points = 240 } = {}) {
  const el = orbitalElements(r, v, EARTH.mu, EARTH.radius);
  const span = el.period && el.period < 2e5 ? el.period : 6 * 3600;
  const h = span / points;
  const pts = [r];
  let s = { r, v };
  let impact = false;
  for (let i = 0; i < points; i++) {
    s = stateAt(s.r, s.v, h, 10);
    pts.push(s.r);
    if (len(s.r) < EARTH.radius) {
      impact = true;
      break;
    }
  }
  return { pts, impact, el };
}

export function nodeFrame(r, v) {
  const pro = norm(v);
  const nrm = norm(cross(r, v));
  const rad = cross(nrm, pro);
  return { pro, nrm, rad };
}

export const nodeDvEci = (dv, f) => add(add(scale(f.pro, dv[0]), scale(f.nrm, dv[1])), scale(f.rad, dv[2]));

export function nodePrediction(sim, node) {
  const at = stateAt(sim.r, sim.v, node.t - sim.t);
  const f = nodeFrame(at.r, at.v);
  const dvVec = nodeDvEci(node.dv, f);
  const v2 = add(at.v, dvVec);
  const after = orbitalElements(at.r, v2, EARTH.mu, EARTH.radius);
  return { at, dvVec, v2, after, dv: len(dvVec) };
}

// Burn time from the rocket equation using the currently active (or next) engines.
export function burnTime(sim, dv) {
  const ts = thrustState(sim.rt, 1, 0);
  const mdot = ts.flows.reduce((a, f) => a + f.mdot, 0);
  if (!(ts.F > 0)) return null;
  const ve = ts.F / mdot;
  const m0 = runtimeMass(sim.rt);
  return (m0 * (1 - Math.exp(-dv / ve))) / mdot;
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
  }

  remaining() {
    return sub(this.dvVec, this.delivered);
  }

  target() {
    const rem = this.remaining();
    return len(rem) > 1e-6 ? norm(rem) : norm(this.dvVec);
  }

  update(sim, nav) {
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
      sim.addLog("success", `Maneuver complete — residual ${remM.toFixed(2)} m/s`);
      return;
    }
    const a = nav.Fmax > 0 ? nav.Fmax / nav.mass : 0;
    const align = Math.max(0, dot(sim.dir, norm(rem)));
    sim.throttle = a > 0 ? clamp(remM / (a * 1.5), 0.01, 1) * align ** 6 : 0;
  }

  record(dir, F, m, dt) {
    if (this.phase === "burn" && F > 0) this.delivered = add(this.delivered, scale(dir, (F / m) * dt));
  }
}

export { G0 };
