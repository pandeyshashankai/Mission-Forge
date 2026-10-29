import { EARTH, G0, LAUNCH_SITES, DEG, STABLE_PERIAPSIS } from "./constants";
import { add, cross, dot, len, norm, scale, sub, clamp } from "./vec";
import { atmosphere, dragCoefficient, ATMOS_TOP } from "./atmosphere";
import { applyEvent, createRuntime, describeEvent, buildSections, frontalArea, runtimeMass, thrustState, consume, activeSources, dropsOf, deltaVFromRuntime } from "./design";
import { orbitalElements } from "./orbit";
import { AscentGuidance, launchAzimuth } from "./guidance";
import { vehicleConfig, attitudeStep, attitudeCoarse, MAX_RATE } from "./attitude";
import { ManeuverExec } from "./maneuver";
import { gravity, primaryOf, regionOf, dynStep, rk4, moonState, lunarEphemeris, sunDirAt, MOON } from "./bodies";
import { initLifeSupport, lifeSupportStep } from "./crew";
import { newSystems, systemsStep, applyFaultFactors } from "./systems";
import { startCruise, bestDepartureDay, dayOf, planetState, eclToEq, EARTH_SOI } from "./mars";
import { aeroConfig, newEntryState, capsuleAero, entryUpdate, sensedAccelG, SPLASH_SPEED } from "./entry";

const OMEGA = [0, 0, EARTH.rotationRate];
export const DT_FAST = 0.02;
export const DT_COAST = 0.1;
export const DT_COAST_MAX = 2;
const RAD = 180 / Math.PI;
const srcKey = (s) => (s.kind === "section" ? `S${s.s}-${s.prop}` : `R-${s.uid}`);

export class FlightSim {
  constructor({ design, mission, profile, guidanceOn = true, difficulty = "amateur" }) {
    this.sys = newSystems(mission.id, difficulty);
    this.mars = mission.kind === "mars" ? { depDay: profile.marsDepartDay ?? bestDepartureDay(), periAlt: mission.marsTarget.periAlt, inc: 0, arrival: null } : null;
    this.marsOrbitAt = null;
    this.sunAU = 1;
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
    this.prematureStaging = [];
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
    this.dir = this.dirFromAtt(this.att);
    this.omega = [0, 0, 0];
    this.wheelH = [0, 0, 0];
    this.rcsEnabled = true;
    this.attMode = "auto";
    this.holdDir = null;
    this.inputActive = false;
    this.maneuver = null;
    this.node = null;
    this.checkpointQueue = [];
    this.lastAutoCkpt = 0;
    this.eph = mission.moon ? lunarEphemeris(this.site, mission.moon.phase) : null;
    this.sunLon0 = lon + 25 * DEG;
    this.region = "earth";
    this.ls = initLifeSupport(design);
    this.entry = newEntryState();
    this.moonClosest = null;
    this.lunarOrbitAt = null;
    this.crewLost = false;
    this.lossReason = null;
    this.config = vehicleConfig(this);
    applyFaultFactors(this);
    this.pcfg = null;
    this.aero = aeroConfig(this);
    this.nav = this.computeNav();
  }

  get sunDir() {
    if (!this.mars) return sunDirAt(this.t, this.sunLon0);
    return norm(eclToEq(scale(planetState(this.eph && this.eph.central ? "mars" : "earth", dayOf(this)).r, -1)));
  }

  earthVector() {
    if (!(this.eph && this.eph.central)) return scale(this.r, -1);
    const d = dayOf(this);
    return sub(eclToEq(sub(planetState("earth", d).r, planetState("mars", d).r)), this.r);
  }

  inAtmo() {
    return !(this.eph && this.eph.central) && len(this.r) - EARTH.radius < ATMOS_TOP;
  }

  spendDeltaV(dv) {
    const ts = thrustState(this.rt, 1, 0);
    if (!(ts.F > 0)) return false;
    const mdot = ts.flows.reduce((a, f) => a + f.mdot, 0);
    const need = runtimeMass(this.rt) * (1 - Math.exp(-dv / (ts.F / mdot)));
    if (this.remainingDeltaV() < dv) return false;
    consume(this.rt, ts.flows, need / mdot);
    return true;
  }

  lifeAndSystemsCruise(T) {
    lifeSupportStep(this, T);
  }

  requestCheckpoint(label) {
    this.checkpointQueue.push({ label, auto: true, t: this.t, state: this.serialize() });
  }

  ctx() {
    return { t0: this.t, eph: this.eph };
  }

  loseCrew(reason) {
    if (this.isEnded()) return;
    this.crewLost = this.aero.crew > 0;
    this.lossReason = reason;
    this.end("crashed", reason);
  }

  onRegionChange(region) {
    this.region = region;
    const d = (len(sub(this.r, moonState(this.t, this.eph).r)) / 1000).toFixed(0);
    this.addLog("info", region === "moon" ? `Entered the Moon's sphere of influence (${d} km) — Moon gravity now governs the path` : `Left the Moon's sphere of influence — Earth gravity governs the path`);
    this.requestCheckpoint(region === "moon" ? "Lunar arrival (SOI)" : "Lunar departure (SOI)");
  }

  trackMoon() {
    if (!this.eph || this.eph.central) return;
    const m = moonState(this.t, this.eph);
    const d = len(sub(this.r, m.r));
    if (!this.moonClosest || d < this.moonClosest.d) this.moonClosest = { d, alt: d - MOON.radius, t: this.t };
  }

  setAttMode(mode) {
    this.attMode = mode;
    if (mode === "hold") this.holdDir = [...this.dir];
    if (this.guidance && mode !== "auto") this.guidance.disengaged = true;
    if (mode === "auto" && this.guidance) this.guidance.disengaged = false;
  }

  planManeuver(node) {
    this.node = node;
    this.maneuver = node ? new ManeuverExec(this, node) : null;
    if (node) this.addLog("info", `Guidance armed for maneuver at T+${node.t.toFixed(0)} s — ${this.maneuver.dvTot.toFixed(1)} m/s, burn ≈ ${this.maneuver.burnTime.toFixed(0)} s`);
  }

  targetDir() {
    if (this.maneuver && !this.maneuver.done) return this.maneuver.target();
    if (this.attMode === "auto" && this.guidance && !this.guidance.disengaged && !this.guidance.done) return this.dirFromAtt(this.cmd);
    const r = this.r, v = this.v;
    switch (this.attMode === "auto" ? "prograde" : this.attMode) {
      case "hold": return this.holdDir;
      case "prograde": return norm(v);
      case "retrograde": return scale(norm(v), -1);
      case "normal": return norm(cross(r, v));
      case "antinormal": return scale(norm(cross(r, v)), -1);
      case "radialOut": return norm(r);
      case "radialIn": return scale(norm(r), -1);
      case "sun": return this.sunDir;
      default: return null;
    }
  }

  controlAttitude(dt, F, m, vRel, q, area) {
    if (this.sys.powerOut) {
      this.dir = norm(add(this.dir, scale(cross(this.omega, this.dir), dt)));
      return;
    }
    const active = this.input.pitch !== 0 || this.input.yaw !== 0;
    let rateCmd = null;
    if (active) {
      const up = norm(this.r);
      let a = cross(this.dir, up);
      a = len(a) < 1e-6 ? norm(cross([0, 0, 1], up)) : norm(a);
      rateCmd = add(scale(a, this.input.pitch * MAX_RATE * 0.5), scale(up, -this.input.yaw * MAX_RATE * 0.5));
      this.attMode = "hold";
    } else if (this.inputActive) this.holdDir = [...this.dir];
    this.inputActive = active;
    attitudeStep(this, dt, { F, m, target: active ? null : this.targetDir(), rateCmd, vRel, q, area });
  }

  totalProp() {
    let p = 0;
    for (const s of this.rt.sections) if (s.attached) for (const k in s.tanks) p += s.tanks[k];
    for (const r of this.rt.radials) if (r.attached) p += r.fuel;
    return p;
  }

  frame(r = this.prim ? this.prim.r : this.r) {
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
    const p = (this.prim = primaryOf(this.r, this.v, this.t, this.eph));
    const { mu, R } = p;
    const f = this.frame(p.r);
    const rm = len(p.r);
    const alt = rm - R;
    const atm = atmosphere(p.body === "earth" ? alt : 1e9);
    const vRel = p.body === "earth" ? sub(this.v, cross(OMEGA, this.r)) : p.v;
    const surfSpeed = len(vRel);
    const q = 0.5 * atm.rho * surfSpeed * surfSpeed;
    const mass = runtimeMass(this.rt);
    const pRatio = atm.P / 101325;
    const ts = thrustState(this.rt, 1, pRatio);
    const tsNow = thrustState(this.rt, this.throttle, pRatio);
    const vr = dot(p.v, f.up);
    const vhVec = sub(p.v, scale(f.up, vr));
    const vh = len(vhVec);
    const sAtt = surfSpeed > 1 ? this.attFromDir(norm(vRel), f) : { pitch: 90, heading: this.azimuth };
    const oAtt = vh > 1 ? this.attFromDir(norm(vhVec), f) : { pitch: 0, heading: this.azimuth };
    const el = orbitalElements(p.r, p.v, mu, R);
    return {
      ...f,
      body: p.body,
      alt,
      rm,
      atm,
      pRatio,
      q,
      mach: surfSpeed / atm.a,
      surfSpeed,
      speed: len(p.v),
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
    const dropped = dropsOf(this.rt, id);
    if (dropped.length) {
      const fuel = dropped.reduce((a, s) => a + (s.kind === "section" ? this.rt.sections[s.s].tanks[s.prop] : this.rt.radials.find((r) => r.uid === s.uid).fuel), 0);
      this.prematureStaging.push({ t: this.t, id, fuel });
      this.addLog("warn", `Staged with ${(fuel / 1000).toFixed(1)} t of propellant still in the dropped stage`);
    }
    applyEvent(this.rt, id);
    this.rt.eventIndex++;
    const cap0 = this.config ? this.config.wheelMomentum : 0;
    this.config = vehicleConfig(this);
    applyFaultFactors(this);
    this.pcfg = null;
    // Momentum stored in jettisoned wheels leaves with them.
    if (cap0 > 0 && this.config.wheelMomentum < cap0) this.wheelH = scale(this.wheelH, this.config.wheelMomentum / cap0);
    this.aero = aeroConfig(this);
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
    return this.status === "crashed" || this.status === "ended" || this.status === "splashdown";
  }

  stepSize() {
    const powered = (this.nav && this.nav.F > 0) || (this.maneuver && this.maneuver.phase === "burn" && !this.maneuver.done);
    return powered || this.clamped || (this.nav.body === "earth" && this.nav.alt < ATMOS_TOP) ? DT_FAST : DT_COAST;
  }

  coastDt() {
    return dynStep(this.r, this.t, this.eph, 1e-4, DT_COAST, DT_COAST_MAX);
  }

  advance(seconds, maxSteps = 4000) {
    this.acc = (this.acc || 0) + seconds;
    let steps = 0;
    while (steps < maxSteps && !this.isEnded()) {
      const dt = this.stepSize();
      if (this.acc < dt) break;
      const stopAt = this.maneuver && !this.maneuver.done ? this.maneuver.tStart - 10 : Infinity;
      if (dt === DT_COAST && this.t < stopAt) {
        while (steps < maxSteps * 20 && !this.inAtmo() && this.t < stopAt && !this.isEnded()) {
          const h = Math.min(this.coastDt(), Math.max(DT_COAST, stopAt - this.t));
          if (this.acc < h) break;
          this.coastStep(h);
          this.acc -= h;
          steps++;
          if (this.region !== regionOf(this.r, this.t, this.eph) || (this.region === "moon" && this.moonClosest && this.moonClosest.alt < 0)) break;
        }
        this.nav = this.computeNav();
        this.att = this.attFromDir(this.dir, this.nav);
        this.postStep(this.nav);
        if (this.acc < this.coastDt() && this.stepSize() === DT_COAST && this.t < stopAt) break;
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
    const s = rk4(this.r, this.v, this.t, dt, this.eph);
    this.r = s.r;
    this.v = s.v;
    this.t += dt;
    this.prim = primaryOf(this.r, this.v, this.t, this.eph);
    const m = runtimeMass(this.rt);
    if (dt <= DT_COAST + 1e-9) this.controlAttitude(dt, 0, m, [0, 0, 0], 0, 0);
    else if (this.sys.powerOut) this.controlAttitude(dt, 0, m);
    else attitudeCoarse(this, dt, m, this.targetDir());
    lifeSupportStep(this, dt);
    systemsStep(this, dt, 0);
    this.trackMoon();
  }

  ionFiring(ts) {
    return ts.F > 0 && this.pcfg && this.pcfg.ionW > 0 ? this.throttle : 0;
  }

  aeroAccel(r, v, m, area) {
    const alt = len(r) - EARTH.radius;
    if (alt >= ATMOS_TOP || (this.eph && this.eph.central)) return [0, 0, 0];
    const atm = atmosphere(alt);
    const vRel = sub(v, cross(OMEGA, r));
    if (this.aero.blunt) return capsuleAero(this, r, vRel, atm.rho, m);
    const s = len(vRel);
    if (!(atm.rho > 0) || s <= 0) return [0, 0, 0];
    const D = 0.5 * atm.rho * s * s * dragCoefficient(s / atm.a) * area;
    return scale(vRel, -D / (m * s));
  }

  accel(r, v, dir, F, m, area, t) {
    let a = add(gravity(r, t, this.eph), this.aeroAccel(r, v, m, area));
    if (F > 0) a = add(a, scale(dir, F / m));
    return a;
  }

  step(dt) {
    if (this.isEnded()) return;
    let nav = (this.nav = this.computeNav());
    if (this.status !== "prelaunch") {
      if (this.maneuver && !this.maneuver.done) this.maneuver.update(this, nav, dt);
      else if (this.guidance && !this.guidance.disengaged) this.guidance.update(this, nav, dt);
      this.autoStageCheck(nav, dt);
    }
    const ts = this.status === "prelaunch" ? { F: 0, flows: [] } : thrustState(this.rt, this.sys.powerOut ? 0 : this.throttle, nav.pRatio);
    systemsStep(this, dt, this.ionFiring(ts));
    const pulse = this.maneuver && this.maneuver.phase === "burn" && !this.maneuver.done ? this.maneuver.pulse : 1;
    if (pulse < 1) {
      ts.F *= pulse;
      ts.flows = ts.flows.map((f) => ({ ...f, mdot: f.mdot * pulse }));
    }
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
      this.dir = norm(this.r);
      this.nav = this.computeNav();
      return;
    }
    const area = frontalArea(this.rt);
    if (this.aero.blunt && nav.q > 20 && nav.body === "earth") {
      this.dir = scale(norm(sub(this.v, cross(OMEGA, this.r))), -1);
      this.omega = [0, 0, 0];
    } else this.controlAttitude(dt, ts.F, m, sub(this.v, cross(OMEGA, this.r)), nav.q, area);
    const dir = this.dir;
    this.att = this.attFromDir(dir, nav);
    const F = ts.F;
    const r0 = this.r;
    const v0 = this.v;
    const t0 = this.t;
    const k1v = this.accel(r0, v0, dir, F, m, area, t0);
    const k1r = v0;
    const r2 = add(r0, scale(k1r, dt / 2)), v2 = add(v0, scale(k1v, dt / 2));
    const k2v = this.accel(r2, v2, dir, F, m, area, t0 + dt / 2);
    const r3 = add(r0, scale(v2, dt / 2)), v3 = add(v0, scale(k2v, dt / 2));
    const k3v = this.accel(r3, v3, dir, F, m, area, t0 + dt / 2);
    const r4 = add(r0, scale(v3, dt)), v4 = add(v0, scale(k3v, dt));
    const k4v = this.accel(r4, v4, dir, F, m, area, t0 + dt);
    this.r = add(r0, scale(add(add(v0, scale(v2, 2)), add(scale(v3, 2), v4)), dt / 6));
    this.v = add(v0, scale(add(add(k1v, scale(k2v, 2)), add(scale(k3v, 2), k4v)), dt / 6));
    consume(this.rt, ts.flows, dt);
    if (this.maneuver) this.maneuver.record(dir, F, m, dt);
    this.t += dt;
    lifeSupportStep(this, dt);
    this.trackMoon();
    nav = this.nav = this.computeNav();
    const mNow = runtimeMass(this.rt);
    const sensed = add(scale(dir, F / m), this.aeroAccel(this.r, this.v, mNow, area));
    if (!this.isEnded()) entryUpdate(this, nav, dt, sensedAccelG(sensed));
    if (this.isEnded()) return;
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
    const interval = this.t < 1500 || (this.entry.ei && nav.alt < 160000) ? 1 : this.t < 86400 ? 30 : 600;
    if (this.telemetry.length > 4000) this.telemetry = [...this.telemetry.slice(0, 1500), ...this.telemetry.slice(1500).filter((_, i) => i % 2 === 0)];
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
        g: +this.entry.g.toFixed(2),
        flux: +(this.entry.flux / 1e6).toFixed(3),
      });
    }
    if (this.status === "orbit" && !this.eph && this.t - this.lastAutoCkpt > 86400) {
      this.lastAutoCkpt = this.t;
      this.requestCheckpoint("Long coast (24 h)");
    }
    if (this.eph) {
      const reg = regionOf(this.r, this.t, this.eph);
      if (reg !== this.region) this.onRegionChange(reg);
    }
    if (this.mars && !this.mars.arrival && nav.body === "earth" && len(this.r) > EARTH_SOI) {
      startCruise(this);
      this.nav = this.computeNav();
      return;
    }
    if (nav.body === "mars" && !this.marsOrbitAt && nav.F === 0 && nav.el.e < 1 && nav.el.periapsis > 100000) {
      this.marsOrbitAt = this.t;
      this.requestCheckpoint("Mars orbit");
      this.addLog("success", `Mars orbit achieved — ${(nav.el.apoapsis / 1000).toFixed(0)} × ${(nav.el.periapsis / 1000).toFixed(0)} km`);
    }
    if (nav.alt < 0) {
      if (nav.body === "mars") this.end("crashed", `Vehicle impacted Mars at ${nav.surfSpeed.toFixed(0)} m/s`);
      else if (nav.body === "moon") this.end("crashed", `Vehicle impacted the lunar surface at ${nav.surfSpeed.toFixed(0)} m/s`);
      else if (this.aero.blunt && nav.surfSpeed <= SPLASH_SPEED) this.end("splashdown", `Splashdown at ${nav.surfSpeed.toFixed(1)} m/s${this.aero.crew ? " — crew recovered" : ""}`);
      else this.end("crashed", `Vehicle impacted the surface at ${nav.surfSpeed.toFixed(0)} m/s`);
      if (this.status === "crashed" && this.aero.crew) this.crewLost = true;
      return;
    }
    if (nav.body === "moon" && !this.lunarOrbitAt && nav.F === 0 && nav.el.e < 1 && nav.el.periapsis > 15000 && nav.el.ra < MOON.soi * 0.9) {
      this.lunarOrbitAt = this.t;
      this.requestCheckpoint("Lunar orbit");
      this.addLog("success", `Lunar orbit achieved — ${(nav.el.apoapsis / 1000).toFixed(1)} × ${(nav.el.periapsis / 1000).toFixed(1)} km, i = ${(nav.el.inc / DEG).toFixed(1)}°`);
    }
    if (nav.body === "earth" && nav.el.periapsis >= STABLE_PERIAPSIS && nav.F === 0 && !this.orbitAt) {
      this.orbitAt = this.t;
      // Launch-window assumption: the Moon's orbit plane passes through the parking-orbit node line.
      if (this.eph) this.eph = { ...this.eph, raan: nav.el.raan / DEG, frame: undefined };
      this.status = "orbit";
      this.requestCheckpoint("Orbit reached");
      this.addLog("success", `Stable orbit achieved — ${(nav.el.apoapsis / 1000).toFixed(1)} × ${(nav.el.periapsis / 1000).toFixed(1)} km, i = ${(nav.el.inc / DEG).toFixed(2)}°`);
    }
  }

  serialize() {
    const g = this.guidance;
    const mv = this.maneuver;
    return JSON.parse(JSON.stringify({
      t: this.t, r: this.r, v: this.v, dir: this.dir, omega: this.omega, wheelH: this.wheelH, rt: this.rt, status: this.status, clamped: this.clamped,
      att: this.att, cmd: this.cmd, throttle: this.throttle, attMode: this.attMode, holdDir: this.holdDir, rcsEnabled: this.rcsEnabled, autoStage: this.autoStage,
      log: this.log, telemetry: this.telemetry, flameouts: this.flameouts, prematureStaging: this.prematureStaging, stagedAt: this.stagedAt,
      maxQ: this.maxQ, maxApo: this.maxApo, maxAlt: this.maxAlt, lastSample: this.lastSample, orbitAt: this.orbitAt, lastAutoCkpt: this.lastAutoCkpt,
      lastBurnEnergy: this.lastBurnEnergy ?? null, stageDelay: this.stageDelay, acc: this.acc || 0, node: this.node, wheelsSaturated: !!this.wheelsSaturated, rcsEmptyLogged: !!this.rcsEmptyLogged,
      sys: this.sys, region: this.region, eph: this.eph ? (this.eph.central ? { central: this.eph.central } : { raan: this.eph.raan, argp: this.eph.argp, M0: this.eph.M0 }) : null, mars: this.mars, marsOrbitAt: this.marsOrbitAt, sunAU: this.sunAU, ls: this.ls, entry: this.entry, moonClosest: this.moonClosest, lunarOrbitAt: this.lunarOrbitAt, crewLost: this.crewLost, lossReason: this.lossReason, endReason: this.endReason, input: this.input, inputActive: this.inputActive,
      guidance: g ? { p: g.p, phase: g.phase, phaseT: g.phaseT, done: g.done, frozenDir: g.frozenDir, disengaged: !!g.disengaged } : null,
      maneuver: mv ? { node: mv.node, dvVec: mv.dvVec, dvTot: mv.dvTot, burnTime: mv.burnTime, tStart: mv.tStart, delivered: mv.delivered, phase: mv.phase, done: mv.done } : null,
    }));
  }

  restore(st) {
    const { guidance, maneuver, ...rest } = JSON.parse(JSON.stringify(st));
    Object.assign(this, rest);
    if (this.maxApo === null) this.maxApo = -Infinity;
    if (this.lastSample === null) this.lastSample = -Infinity;
    if (guidance) {
      this.guidance = new AscentGuidance(guidance.p);
      Object.assign(this.guidance, guidance);
    } else this.guidance = null;
    if (maneuver) {
      this.maneuver = Object.create(ManeuverExec.prototype);
      Object.assign(this.maneuver, { type: "maneuver", ...maneuver });
    } else this.maneuver = null;
    this.checkpointQueue = [];
    this.config = vehicleConfig(this);
    applyFaultFactors(this);
    this.pcfg = null;
    this.aero = aeroConfig(this);
    this.propFull = this.propFull || this.totalProp();
    this.nav = this.computeNav();
    this.prevSources = new Set(activeSources(this.rt).map(srcKey));
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
