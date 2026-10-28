import { EARTH, G0, LAUNCH_SITES, DEG, STABLE_PERIAPSIS } from "./constants";
import { add, cross, dot, len, norm, scale, sub, clamp } from "./vec";
import { atmosphere, dragCoefficient, ATMOS_TOP } from "./atmosphere";
import { applyEvent, createRuntime, describeEvent, buildSections, frontalArea, runtimeMass, thrustState, consume, activeSources, dropsOf, deltaVFromRuntime } from "./design";
import { orbitalElements } from "./orbit";
import { AscentGuidance, launchAzimuth } from "./guidance";

const OMEGA = [0, 0, EARTH.rotationRate];
export const DT_FAST = 0.02;
export const DT_COAST = 0.1;
const SLEW = 10;
const RAD = 180 / Math.PI;
const srcKey = (s) => (s.kind === "section" ? `S${s.s}-${s.prop}` : `R-${s.uid}`);

export class FlightSim {
  constructor({ design, mission, profile, guidanceOn = true }) {
    this.design = design;
    this.mission = mission;
    this.sections = buildSections(design);
    this.rt = createRuntime(design);
    this.site = LAUNCH_SITES[mission.site];
    const lat = this.site.lat * DEG;
    const lon = this.site.lon * DEG;
    this.padUnit = [Math.cos(lat) * Math.cos(lon), Math.cos(lat) * Math.sin(lon), Math.sin(lat)];
    this.padRadius = EARTH.radius + 2;
    this.t = 0;
    this.r = scale(this.padUnit, this.padRadius);
    this.v = cross(OMEGA, this.r);
    this.status = "prelaunch";
    this.clamped = true;
    this.azimuth = launchAzimuth(this.site, profile?.targetInclination ?? mission.target.inclination);
    this.att = { pitch: 90, heading: this.azimuth };
    this.cmd = { ...this.att };
    this.input = { pitch: 0, yaw: 0 };
    this.throttle = 1;
    this.guidance = guidanceOn ? new AscentGuidance(profile) : null;
    this.autoStage = profile?.autoStage ?? true;
    this.log = [];
    this.telemetry = [];
    this.flameouts = [];
    this.stagedAt = [];
    this.maxQ = { q: 0, t: 0, alt: 0 };
    this.maxApo = -Infinity;
    this.maxAlt = 0;
    this.lastSample = -Infinity;
    this.stageDelay = 0;
    this.prevSources = new Set();
    this.propFull = this.totalProp();
    this.orbitAt = null;
    this.endReason = null;
    this.nav = this.computeNav();
  }

  totalProp() {
    let p = 0;
    for (const s of this.rt.sections) if (s.attached) for (const k in s.tanks) p += s.tanks[k];
    for (const r of this.rt.radials) if (r.attached) p += r.fuel;
    return p;
  }

  frame(r = this.r) {
    const up = norm(r);
    const east = norm(cross([0, 0, 1], up));
    const north = cross(up, east);
    return { up, east, north };
  }

  dirFromAtt(att, f = this.frame()) {
    const p = att.pitch * DEG;
    const h = att.heading * DEG;
    const horiz = add(scale(f.north, Math.cos(h)), scale(f.east, Math.sin(h)));
    return norm(add(scale(horiz, Math.cos(p)), scale(f.up, Math.sin(p))));
  }

  attFromDir(d, f = this.frame()) {
    const pitch = Math.asin(clamp(dot(d, f.up), -1, 1)) * RAD;
    const heading = Math.atan2(dot(d, f.east), dot(d, f.north)) * RAD;
    return { pitch, heading };
  }

  computeNav() {
    const { mu, radius: R } = EARTH;
    const f = this.frame();
    const rm = len(this.r);
    const alt = rm - R;
    const atm = atmosphere(alt);
    const vRel = sub(this.v, cross(OMEGA, this.r));
    const surfSpeed = len(vRel);
    const q = 0.5 * atm.rho * surfSpeed * surfSpeed;
    const mass = runtimeMass(this.rt);
    const pRatio = atm.P / 101325;
    const ts = thrustState(this.rt, 1, pRatio);
    const tsNow = thrustState(this.rt, this.throttle, pRatio);
    const vr = dot(this.v, f.up);
    const vhVec = sub(this.v, scale(f.up, vr));
    const vh = len(vhVec);
    const sAtt = surfSpeed > 1 ? this.attFromDir(norm(vRel), f) : { pitch: 90, heading: this.azimuth };
    const oAtt = vh > 1 ? this.attFromDir(norm(vhVec), f) : { pitch: 0, heading: this.azimuth };
    const el = orbitalElements(this.r, this.v, mu, R);
    return {
      ...f,
      alt,
      rm,
      atm,
      pRatio,
      q,
      mach: surfSpeed / atm.a,
      surfSpeed,
      speed: len(this.v),
      vr,
      vh,
      hdir: norm(vhVec),
      vc: Math.sqrt(mu / rm),
      gEff: mu / (rm * rm) - (vh * vh) / rm,
      surfFPA: sAtt.pitch,
      surfHeading: sAtt.heading,
      orbHeading: oAtt.heading,
      mass,
      Fmax: ts.Fmax,
      F: this.clamped && this.status === "prelaunch" ? 0 : tsNow.F,
      accel: tsNow.F / mass,
      el,
    };
  }

  addLog(type, text) {
    this.log.push({ t: this.t, type, text, alt: this.nav ? this.nav.alt : 0 });
  }

  launch() {
    if (this.status !== "prelaunch") return;
    this.fireNextEvent();
    this.status = "flight";
    this.addLog("info", "Ignition — Stage 1 engines start");
  }

  fireNextEvent() {
    const id = this.rt.events[this.rt.eventIndex];
    if (!id) return false;
    applyEvent(this.rt, id);
    this.rt.eventIndex++;
    if (id !== "ignite-0") {
      this.addLog("stage", describeEvent(id, this.sections).label);
      this.stagedAt.push({ t: this.t, id });
    }
    this.prevSources = new Set(activeSources(this.rt).map(srcKey));
    return true;
  }

  stage() {
    if (this.status === "prelaunch") return this.launch();
    if (this.isEnded()) return false;
    return this.fireNextEvent();
  }

  isEnded() {
    return this.status === "crashed" || this.status === "ended";
  }

  stepSize() {
    const powered = this.nav && this.nav.F > 0;
    return powered || this.clamped || this.nav.alt < ATMOS_TOP ? DT_FAST : DT_COAST;
  }

  advance(seconds, maxSteps = 4000) {
    this.acc = (this.acc || 0) + seconds;
    let steps = 0;
    while (steps < maxSteps && !this.isEnded()) {
      const dt = this.stepSize();
      if (this.acc < dt) break;
      if (dt === DT_COAST) {
        while (this.acc >= DT_COAST && steps < maxSteps * 20 && len(this.r) - EARTH.radius >= ATMOS_TOP) {
          this.coastStep(DT_COAST);
          this.acc -= DT_COAST;
          steps++;
        }
        this.nav = this.computeNav();
        this.postStep(this.nav);
        continue;
      }
      this.step(dt);
      this.acc -= dt;
      steps++;
    }
    if (steps >= maxSteps) this.acc = 0;
    return steps;
  }

  // Gravity-only RK4 step used for unpowered flight above the atmosphere.
  coastStep(dt) {
    const g = (r) => {
      const rm = len(r);
      return scale(r, -EARTH.mu / (rm * rm * rm));
    };
    const r0 = this.r, v0 = this.v;
    const k1v = g(r0);
    const v2 = add(v0, scale(k1v, dt / 2));
    const k2v = g(add(r0, scale(v0, dt / 2)));
    const v3 = add(v0, scale(k2v, dt / 2));
    const k3v = g(add(r0, scale(v2, dt / 2)));
    const v4 = add(v0, scale(k3v, dt));
    const k4v = g(add(r0, scale(v3, dt)));
    this.r = add(r0, scale(add(add(v0, scale(v2, 2)), add(scale(v3, 2), v4)), dt / 6));
    this.v = add(v0, scale(add(add(k1v, scale(k2v, 2)), add(scale(k3v, 2), k4v)), dt / 6));
    this.t += dt;
  }

  slewAttitude(dt) {
    const max = SLEW * dt;
    const dp = clamp(this.cmd.pitch - this.att.pitch, -max, max);
    let dh = ((this.cmd.heading - this.att.heading + 540) % 360) - 180;
    const hmax = Math.abs(this.att.pitch) > 89.5 ? 360 : max / Math.max(0.05, Math.cos(this.att.pitch * DEG));
    dh = clamp(dh, -hmax, hmax);
    this.att = { pitch: clamp(this.att.pitch + dp, -90, 90), heading: (this.att.heading + dh + 360) % 360 };
  }

  accel(r, v, dir, F, m, area) {
    const rm = len(r);
    let a = scale(r, -EARTH.mu / (rm * rm * rm));
    if (F > 0) a = add(a, scale(dir, F / m));
    const alt = rm - EARTH.radius;
    if (alt < ATMOS_TOP) {
      const atm = atmosphere(alt);
      const vRel = sub(v, cross(OMEGA, r));
      const s = len(vRel);
      if (atm.rho > 0 && s > 0) {
        const D = 0.5 * atm.rho * s * s * dragCoefficient(s / atm.a) * area;
        a = add(a, scale(vRel, -D / (m * s)));
      }
    }
    return a;
  }

  step(dt) {
    if (this.isEnded()) return;
    let nav = (this.nav = this.computeNav());
    if (this.status !== "prelaunch") {
      if (this.guidance && !this.guidance.disengaged) this.guidance.update(this, nav, dt);
      else {
        this.cmd = { pitch: clamp(this.cmd.pitch + this.input.pitch * SLEW * dt, -90, 90), heading: (this.cmd.heading + this.input.yaw * SLEW * dt + 360) % 360 };
      }
      this.slewAttitude(dt);
      this.autoStageCheck(nav, dt);
    }
    const ts = this.status === "prelaunch" ? { F: 0, flows: [] } : thrustState(this.rt, this.throttle, nav.pRatio);
    const m = runtimeMass(this.rt);
    if (this.clamped) {
      consume(this.rt, ts.flows, dt);
      this.t += this.status === "prelaunch" ? 0 : dt;
      const g = EARTH.mu / (this.padRadius * this.padRadius);
      if (ts.F > m * g && this.status === "flight") {
        this.clamped = false;
        this.addLog("info", `Liftoff — thrust-to-weight ${(ts.F / (m * g)).toFixed(2)}`);
      } else {
        const th = EARTH.rotationRate * this.t;
        const p = this.padUnit;
        this.r = scale([p[0] * Math.cos(th) - p[1] * Math.sin(th), p[0] * Math.sin(th) + p[1] * Math.cos(th), p[2]], this.padRadius);
        this.v = cross(OMEGA, this.r);
        if (this.status === "flight" && this.t > 10 && activeSources(this.rt).length === 0) this.end("crashed", "Engines could not lift the vehicle off the pad");
      }
      this.nav = this.computeNav();
      return;
    }
    const dir = this.dirFromAtt(this.att, nav);
    const area = frontalArea(this.rt);
    const F = ts.F;
    const r0 = this.r;
    const v0 = this.v;
    const k1v = this.accel(r0, v0, dir, F, m, area);
    const k1r = v0;
    const r2 = add(r0, scale(k1r, dt / 2)), v2 = add(v0, scale(k1v, dt / 2));
    const k2v = this.accel(r2, v2, dir, F, m, area);
    const r3 = add(r0, scale(v2, dt / 2)), v3 = add(v0, scale(k2v, dt / 2));
    const k3v = this.accel(r3, v3, dir, F, m, area);
    const r4 = add(r0, scale(v3, dt)), v4 = add(v0, scale(k3v, dt));
    const k4v = this.accel(r4, v4, dir, F, m, area);
    this.r = add(r0, scale(add(add(v0, scale(v2, 2)), add(scale(v3, 2), v4)), dt / 6));
    this.v = add(v0, scale(add(add(k1v, scale(k2v, 2)), add(scale(k3v, 2), k4v)), dt / 6));
    consume(this.rt, ts.flows, dt);
    this.t += dt;
    nav = this.nav = this.computeNav();
    this.postStep(nav);
  }

  autoStageCheck(nav, dt) {
    if (!this.autoStage || this.clamped) return;
    const id = this.rt.events[this.rt.eventIndex];
    if (!id) return;
    if (id.startsWith("fair-") ? nav.alt > 100000 : dropsOf(this.rt, id).length === 0) {
      this.stageDelay += dt;
      if (this.stageDelay >= 1) {
        this.stageDelay = 0;
        this.fireNextEvent();
      }
    } else this.stageDelay = 0;
  }

  postStep(nav) {
    const now = new Set(activeSources(this.rt).map(srcKey));
    for (const k of this.prevSources) {
      if (!now.has(k)) {
        const label = k.startsWith("R-") ? "Solid boosters burnout" : `Stage ${+k.split("-")[0].slice(1) + 1} flameout — propellant depleted`;
        this.flameouts.push({ t: this.t, key: k, label, alt: nav.alt, apo: nav.el.apoapsis, peri: nav.el.periapsis, speed: nav.speed });
        this.lastBurnEnergy = nav.el.energy;
        this.addLog(k.startsWith("R-") ? "info" : "stage", label);
      }
    }
    this.prevSources = now;
    if (nav.q > this.maxQ.q) this.maxQ = { q: nav.q, t: this.t, alt: nav.alt };
    if (nav.el.apoapsis > this.maxApo) this.maxApo = nav.el.apoapsis;
    this.maxAlt = Math.max(this.maxAlt, nav.alt);
    const interval = this.t < 1500 ? 1 : 30;
    if (this.t - this.lastSample >= interval) {
      this.lastSample = this.t;
      this.telemetry.push({
        t: +this.t.toFixed(1),
        alt: nav.alt / 1000,
        speed: nav.speed,
        surfSpeed: nav.surfSpeed,
        fuel: this.propFull > 0 ? (100 * this.totalProp()) / this.propFull : 0,
        throttle: nav.F > 0 ? this.throttle * 100 : 0,
        apo: Math.min(nav.el.apoapsis, 5e6) / 1000,
        peri: Math.max(nav.el.periapsis, -EARTH.radius) / 1000,
        q: nav.q / 1000,
        accelG: nav.accel / G0,
        mass: nav.mass / 1000,
      });
    }
    if (nav.alt < 0) {
      this.end("crashed", `Vehicle impacted the surface at ${nav.surfSpeed.toFixed(0)} m/s`);
      return;
    }
    if (nav.el.periapsis >= STABLE_PERIAPSIS && nav.F === 0 && !this.orbitAt) {
      this.orbitAt = this.t;
      this.status = "orbit";
      this.addLog("success", `Stable orbit achieved — ${(nav.el.apoapsis / 1000).toFixed(1)} × ${(nav.el.periapsis / 1000).toFixed(1)} km, i = ${(nav.el.inc / DEG).toFixed(2)}°`);
    }
  }

  end(status, reason) {
    this.status = status;
    this.endReason = reason;
    this.addLog(status === "crashed" ? "fail" : "info", reason);
  }

  remainingDeltaV() {
    return deltaVFromRuntime(this.rt).totalVac;
  }

  // Deterministic state digest for checkpoint/consistency checks.
  digest() {
    return [this.t, ...this.r, ...this.v, runtimeMass(this.rt)].map((x) => x.toFixed(6)).join("|");
  }
}

export function runAutopilotFlight(design, mission, profile, maxTime = 1500) {
  const sim = new FlightSim({ design, mission, profile, guidanceOn: true });
  sim.launch();
  while (sim.t < maxTime && !sim.isEnded()) {
    sim.step(sim.stepSize());
    if (sim.guidance.done && sim.orbitAt) break;
  }
  return sim;
}
