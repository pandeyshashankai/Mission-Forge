import { EARTH, G0 } from "./constants";
import { clamp, dot, len, norm, scale, sub, add } from "./vec";

export const DEFAULT_PROFILE = {
  targetAltitude: 200000,
  targetInclination: 28.6,
  turnStartSpeed: 60,
  pitchKick: 4,
  turnEndAltitude: 35000,
  maxAccelG: 4,
  maxQ: 35000,
  autoStage: true,
};

const RAD = 180 / Math.PI;

export class AscentGuidance {
  constructor(profile) {
    this.p = { ...DEFAULT_PROFILE, ...profile };
    this.phase = "vertical";
    this.phaseT = 0;
    this.done = false;
    this.frozenDir = null;
  }

  setPhase(ph) {
    this.phase = ph;
    this.phaseT = 0;
  }

  limitThrottle(nav, thr) {
    if (nav.Fmax <= 0) return thr;
    const accelLimit = (this.p.maxAccelG * G0 * nav.mass) / nav.Fmax;
    const qLimit = clamp(1 - (nav.q - this.p.maxQ) / (0.2 * this.p.maxQ), 0, 1);
    return clamp(Math.min(thr, accelLimit, qLimit), 0, 1);
  }

  // Inertial heading that keeps the trajectory in the target orbital plane at the current latitude.
  planeHeading(sim, nav) {
    const lat = Math.asin(clamp(nav.up[2], -1, 1));
    const inc = Math.max(this.p.targetInclination, Math.abs(lat * RAD)) / RAD;
    let b = Math.asin(clamp(Math.cos(inc) / Math.cos(lat), -1, 1));
    if (Math.cos(sim.azimuth / RAD) < 0) b = Math.PI - b;
    return b * RAD;
  }

  update(sim, nav, dt) {
    const p = this.p;
    this.phaseT += dt;
    let att = sim.cmd;
    let thr = 1;
    const a = Math.min(nav.Fmax / nav.mass, p.maxAccelG * G0);
    switch (this.phase) {
      case "vertical":
        att = { pitch: 90, heading: sim.azimuth };
        if (!sim.clamped && nav.surfSpeed > p.turnStartSpeed) this.setPhase("pitchover");
        break;
      case "pitchover":
        att = { pitch: 90 - p.pitchKick, heading: sim.azimuth };
        if ((this.phaseT > 2 && Math.abs(nav.surfFPA - sim.att.pitch) < 0.5) || this.phaseT > 15) this.setPhase("gravityTurn");
        break;
      case "gravityTurn":
        att = { pitch: nav.surfFPA, heading: nav.surfHeading };
        if (nav.alt > p.turnEndAltitude) this.setPhase("ascent");
        break;
      case "ascent": {
        if (a <= 0) break;
        const { vr, vh, vc, gEff } = nav;
        const tgo = Math.max(5, (vc - vh) / a);
        const dh = p.targetAltitude - nav.alt;
        const vrDes = clamp((2 * dh) / tgo, -100, 2500);
        const ar = gEff - vr / tgo + (vrDes - vr) / 20;
        const s = clamp(ar / a, -0.5, 1);
        att = { pitch: Math.asin(s) * RAD, heading: this.planeHeading(sim, nav) };
        if (vc - vh < a * 8 && Math.abs(dh) < 15000) this.setPhase("insert");
        break;
      }
      case "insert": {
        const dh = p.targetAltitude - nav.alt;
        const h = this.planeHeading(sim, nav) / RAD;
        const hdir = add(scale(nav.north, Math.cos(h)), scale(nav.east, Math.sin(h)));
        const vDes = add(scale(hdir, nav.vc), scale(nav.up, clamp(dh / 60, -15, 15)));
        const dv = sub(vDes, sim.v);
        const dvm = len(dv);
        if (dvm < 0.5 || nav.Fmax <= 0) {
          this.setPhase("done");
          this.done = true;
          thr = 0;
          break;
        }
        if (dvm > 4 || !this.frozenDir) this.frozenDir = norm(dv);
        att = sim.attFromDir(this.frozenDir, nav);
        const align = Math.max(0, dot(sim.dir, this.frozenDir));
        thr = clamp(dvm / (Math.max(a, 0.01) * 2), 0.001, 1) * align ** 4;
        if (thr < 0.002) thr = 0;
        break;
      }
      default:
        thr = 0;
        att = sim.attFromDir(norm(sim.v), nav);
    }
    sim.cmd = att;
    sim.throttle = this.phase === "done" ? 0 : this.limitThrottle(nav, thr);
  }
}

export function launchAzimuth(site, inclination) {
  const lat = site.lat * (Math.PI / 180);
  const i = Math.max(inclination, site.lat) * (Math.PI / 180);
  let beta = Math.asin(clamp(Math.cos(i) / Math.cos(lat), -1, 1));
  if (inclination > 90) beta = Math.PI - beta;
  const vOrb = 7790;
  const vEq = EARTH.rotationRate * EARTH.radius * Math.cos(lat);
  return Math.atan2(vOrb * Math.sin(beta) - vEq, vOrb * Math.cos(beta)) * RAD;
}
