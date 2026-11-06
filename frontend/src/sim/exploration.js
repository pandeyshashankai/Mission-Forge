import {vehicleFragments,restoreMeshFragment} from './advanced/meshFracture';
import {hangarCraft} from './hangarCraft';
import { tpsxMaterial } from "./advanced/tpsx";
import { calibrateThermal } from "./advanced/materials";
import {
  rigidState,
  spin,
  rotate,
  angularVelocity,
} from "./advanced/rigidBody";
import { stateFor, ephemerisData } from "./advanced/ephemerides";
import { damageState, thermalStep, breakup } from "./advanced/damage";
import { weatherReady } from "./advanced/weatherAtmosphere";
import { controlInput, finishRecordingStep } from "./advanced/controlRecording";
import { runProgram } from "./advanced/automation";
import { appendTelemetry } from "./advanced/telemetry";
import {
  forceOptions,
  environmentAcceleration,
  densityAt,
  eclipseStepLimit,
} from "./advanced/forces";
import { adaptiveStep } from "./advanced/integrator";
import {
  powerEnvironment,
  updateBattery,
  groundLink,
  BATTERY_WH,
} from "./advanced/resources";
import { planOrbitTransfer, propellantForDeltaV } from "./orbitPlanning";
import { add, sub, scale, norm, len, cross, dot, clamp } from "./vec";
import { orbitalElements } from "./orbit";
import {
  BODIES,
  BODY_BY_ID,
  bodyState,
  sphereOfInfluence,
  DAY,
  AU,
} from "./solarSystem";
import { G0 } from "./constants";

export const EXPLORERS = [
  {
    id: "pathfinder",
    name: "Pathfinder",
    role: "Orbital survey craft",
    dryMass: 1800,
    fuel: 3200,
    thrust: 42000,
    isp: 345,
    color: "#67e8f9",
  },
  {
    id: "voyager",
    name: "Wayfarer",
    role: "Deep-space transfer stage",
    dryMass: 4200,
    fuel: 22000,
    thrust: 110000,
    isp: 455,
    color: "#fbbf24",
  },
  {
    id: "lander",
    name: "Pioneer",
    role: "Airless-world lander",
    dryMass: 2400,
    fuel: 5800,
    thrust: 85000,
    isp: 360,
    color: "#c4b5fd",
  },
];
export const FLIGHT_MODES = [
  "prograde",
  "retrograde",
  "radialOut",
  "radialIn",
  "normal",
  "antinormal",
];

export function primaryAt(r, t, provider = bodyState) {
  let best = BODY_BY_ID.sun,
    smallestSphere = Infinity;
  for (const b of BODIES) {
    if (!b.parent) continue;
    const d = len(sub(r, provider(b.id, t).r));
    const sphere = sphereOfInfluence(b);
    if (d < sphere && sphere < smallestSphere) {
      best = b;
      smallestSphere = sphere;
    }
  }
  return best;
}

export function directionFor(mode, r, v, pitch = 0, yaw = 0) {
  const pro = norm(v),
    normal = norm(cross(r, v)),
    radial = norm(r);
  const d =
    {
      prograde: pro,
      retrograde: scale(pro, -1),
      radialOut: radial,
      radialIn: scale(radial, -1),
      normal,
      antinormal: scale(normal, -1),
    }[mode] || pro;
  let right = norm(cross(d, normal));
  if (len(right) < 0.5) right = radial;
  const up = norm(cross(right, d));
  const p = (pitch * Math.PI) / 180,
    y = (yaw * Math.PI) / 180;
  return norm(
    add(
      scale(d, Math.cos(p) * Math.cos(y)),
      add(scale(right, Math.sin(y) * Math.cos(p)), scale(up, Math.sin(p))),
    ),
  );
}

function integrate(r, v, dt, accel, time = 0) {
  const a1 = accel(r, v, time);
  const v2 = add(v, scale(a1, dt / 2)),
    r2 = add(r, scale(v, dt / 2));
  const a2 = accel(r2, v2, time + dt / 2);
  const v3 = add(v, scale(a2, dt / 2)),
    r3 = add(r, scale(v2, dt / 2));
  const a3 = accel(r3, v3, time + dt / 2);
  const v4 = add(v, scale(a3, dt)),
    r4 = add(r, scale(v3, dt));
  const a4 = accel(r4, v4, time + dt);
  return {
    r: add(r, scale(add(add(v, scale(v2, 2)), add(scale(v3, 2), v4)), dt / 6)),
    v: add(v, scale(add(add(a1, scale(a2, 2)), add(scale(a3, 2), a4)), dt / 6)),
  };
}

export class ExplorationSim {
  constructor(
    bodyId = "earth",
    craftId = "pathfinder",
    t = 0,
    altitude,
    options = {},
  ) {
    const b = BODY_BY_ID[bodyId];
    if (!b || !b.parent) throw new Error("Choose a planet or moon");
    this.craft = craftId === 'hangar' ? hangarCraft(options.hangarDesign) : EXPLORERS.find((c) => c.id === craftId) || EXPLORERS[0];
    this.baseCraft = this.craft;
    this.t = t;
    this.fuel = this.craft.fuel;
    this.throttle = 0;
    this.dragEnabled = options.drag !== false;
    this.physics = forceOptions(options);
    this.damage = damageState();
    this.debris = [];
    this.rigid = rigidState();
    this.rigidEnabled = false;
    this.thermalCalibration = options.thermalCalibration
      ? calibrateThermal(
          options.thermalCalibration.records,
          options.thermalCalibration,
        )
      : null;
    if (
      this.physics.thermalMaterial === "calibrated" &&
      !this.thermalCalibration
    )
      throw Error(
        "A calibrated thermal material requires retained calibration observations",
      );
    this.batteryWh = this.craft.power?.batteryWh ?? BATTERY_WH;
    this.integrationStats = null;
    this.transfer = null;
    this.mode = "prograde";
    this.rcsEnabled = true;
    this.heldDirection = null;
    this.pitch = 0;
    this.yaw = 0;
    this.status = "flying";
    this.visited = [bodyId];
    this.log = [];
    const h =
      altitude ??
      Math.max(
        200000,
        b.atmosphere ? b.atmosphere.top + 100000 : b.radius * 0.08,
      );
    const radius = b.radius + h;
    if (
      !Number.isFinite(radius) ||
      radius <= b.radius ||
      radius > sphereOfInfluence(b) * 0.9
    )
      throw new Error(
        "Starting orbit must fit within the body's sphere of influence",
      );
    const base = this.state(bodyId, t);
    this.r = add(base.r, [radius, 0, 0]);
    this.v = add(base.v, [0, Math.sqrt(b.mu / radius), 0]);
    this.primary = bodyId;
    this.record(`Placed ${this.craft.name} in ${b.name} orbit`);
  }

  state(id, t) {
    return stateFor(this.physics, id, t);
  }
  get dryMass() {
    return this.craft.dryMass - (120 - (this.damage?.shieldKg ?? 120));
  }
  record(text) {
    this.log = [...this.log.slice(-29), { t: this.t, text }];
  }

  navigation() {
    const b = BODY_BY_ID[this.primary];
    const base = this.state(b.id, this.t);
    const r = sub(this.r, base.r),
      v = sub(this.v, base.v);
    const omega = b.rotation ? (2 * Math.PI) / b.rotation : 0;
    const surfaceV = sub(v, cross([0, 0, omega], r));
    return {
      body: b,
      r,
      v,
      altitude: len(r) - b.radius,
      speed: len(v),
      vertical: dot(v, norm(r)),
      surfaceSpeed: len(surfaceV),
      el: orbitalElements(r, v, b.mu, b.radius),
      deltaV:
        G0 *
        this.craft.isp *
        Math.log((this.dryMass + this.fuel) / this.dryMass),
      direction: this.rigidEnabled
        ? rotate(this.rigid.q, [0, 1, 0])
        : this.rcsEnabled
          ? directionFor(this.mode, r, v, this.pitch, this.yaw)
          : this.heldDirection || norm(v),
    };
  }

  toggleRcs() {
    if (this.physics.power && this.batteryWh <= 0 && !this.rcsEnabled) {
      this.record("Attitude control unavailable: battery empty");
      return false;
    }
    if (this.rcsEnabled) this.heldDirection = [...this.navigation().direction];
    this.rcsEnabled = !this.rcsEnabled;
    this.record(
      this.rcsEnabled
        ? "Attitude control on"
        : "Attitude control off — holding inertial direction",
    );
  }

  setPhysics(options) {
    const physics = forceOptions(options);
    if (physics.thermalMaterial === "calibrated" && !this.thermalCalibration)
      throw Error("Import and verify experimental calibration first");
    if (
      physics.ephemeris === "de421" &&
      physics.tides &&
      physics.advancedTides &&
      this.t < physics.tideLag
    )
      throw Error(
        "Advance beyond the tidal lag before enabling lagged DE421 tides",
      );
    if (this.recording?.active && physics.ephemeris !== this.physics.ephemeris)
      throw Error("Stop recording before changing ephemerides");
    this.cancelTransfer("Physics configuration changed");
    const n = this.navigation(),
      base = stateFor(physics, this.primary, this.t);
    this.physics = physics;
    this.r = add(base.r, n.r);
    this.v = add(base.v, n.v);
    this.record("Physics configuration updated");
  }

  resources() {
    return {
      batteryWh: this.batteryWh,
      damage: this.damage,
      debris: this.debris,
      ...(this.meshFracture?{meshFracture:true}:{}),
      ...powerEnvironment(
        this.r,
        this.t,
        this.primary,
        this.throttle,
        this.physics,
        this.craft.power,
      ),
      link: this.physics.communications
        ? groundLink(this.r, this.t, this.physics)
        : null,
    };
  }

  ignitionAllowed() {
    return (
      (!this.physics.power || this.batteryWh > 0) &&
      (!this.physics.communications ||
        groundLink(this.r, this.t, this.physics).connected)
    );
  }

  startTransfer(targetAltitude) {
    if (this.recording?.active)
      throw Error("Stop control recording before using transfer assistance.");
    if (!this.ignitionAllowed())
      throw Error(
        "Ignition unavailable: restore electrical power or ground link.",
      );
    if (
      this.transfer &&
      ["burn1", "coast", "ready", "burn2"].includes(this.transfer.phase)
    )
      throw new Error("Cancel the current transfer first.");
    const plan = planOrbitTransfer(this, targetAltitude);
    this.transfer = {
      ...plan,
      phase: "burn1",
      remaining: Math.abs(plan.burn1),
      signedBurn: plan.burn1,
      delivered: 0,
    };
    this.rcsEnabled = true;
    this.pitch = this.yaw = 0;
    this.mode = plan.burn1 >= 0 ? "prograde" : "retrograde";
    this.throttle = 1;
    this.record(
      `Transfer burn 1 started toward ${(targetAltitude / 1000).toFixed(0)} km orbit`,
    );
    return this.transfer;
  }

  cancelTransfer(reason = "Manual control") {
    this.rendezvous = null;
    if (this.program) this.program.running = false;
    if (
      !this.transfer ||
      !["burn1", "coast", "ready", "burn2"].includes(this.transfer.phase)
    )
      return;
    this.transfer.phase = "cancelled";
    this.throttle = 0;
    this.record(`Transfer assistance cancelled — ${reason}`);
  }

  circularizeTransfer() {
    const plan = this.transfer;
    if (!this.ignitionAllowed())
      throw Error(
        "Ignition unavailable: restore electrical power or ground link.",
      );
    if (plan?.phase !== "ready")
      throw new Error("Coast to the circularization window first.");
    const nav = this.navigation();
    const deltaV = Math.sqrt(nav.body.mu / len(nav.r)) - nav.speed;
    if (
      propellantForDeltaV(
        this.dryMass + this.fuel,
        this.craft.isp,
        Math.abs(deltaV),
      ) > this.fuel
    )
      throw new Error("Insufficient propellant to circularize.");
    plan.phase = "burn2";
    plan.signedBurn = deltaV;
    plan.remaining = Math.abs(deltaV);
    plan.delivered = 0;
    this.mode = deltaV >= 0 ? "prograde" : "retrograde";
    this.pitch = this.yaw = 0;
    this.rcsEnabled = true;
    this.throttle = 1;
    this.record("Circularization burn started");
  }

  finishAssistedBurn() {
    const plan = this.transfer;
    this.throttle = 0;
    if (plan.phase === "burn1") {
      const nav = this.navigation();
      const coast = plan.burn1 > 0 ? nav.el.timeToApo : nav.el.timeToPeri;
      if (!(coast > 0) || !Number.isFinite(coast)) {
        this.cancelTransfer("No bound transfer apsis found");
        return;
      }
      plan.phase = "coast";
      plan.apsisAt = this.t + coast;
      plan.readyAt = this.t + Math.max(0, coast - plan.burn2Seconds / 2);
      this.record("First burn complete — coast to the circularization window");
    } else {
      plan.phase = "complete";
      const nav = this.navigation();
      plan.actualApoapsis = nav.el.apoapsis;
      plan.actualPeriapsis = nav.el.periapsis;
      this.record(
        `Transfer complete: ${(nav.el.periapsis / 1000).toFixed(1)} × ${(nav.el.apoapsis / 1000).toFixed(1)} km`,
      );
    }
  }

  advance(seconds, maxSteps = 600) {
    if (!Number.isFinite(seconds) || seconds <= 0 || this.status !== "flying")
      return 0;
    if (this.transfer?.phase === "ready") return 0;
    if (this.physics.atmosphere === "msis" && !weatherReady())
      throw Error("Load the local NRLMSISE atmosphere before flight.");
    if (this.physics.power && this.batteryWh <= 0 && this.rcsEnabled)
      this.toggleRcs();
    runProgram(this);
    if (!this.ignitionAllowed() && this.throttle > 0) {
      this.cancelTransfer("Ignition inhibited by resources");
      this.throttle = 0;
    }
    if (["burn1", "burn2"].includes(this.transfer?.phase)) this.throttle = 1;
    if(this.craft.id === "hangar" && this.throttle>0)this.throttle=Math.max(this.craft.minThrottle,Math.min(1,this.throttle));
    // High warp is coast-only. Discard excess wall-clock demand rather than queueing a runaway backlog.
    const wanted =
      this.throttle > 0 && this.fuel > 0 ? Math.min(seconds, 1) : seconds;
    const recordedInput = this.recording?.active ? controlInput(this) : null;
    let stepsUsed = 0;
    let elapsed = 0;
    for (
      let steps = 0;
      steps < maxSteps && elapsed < wanted && this.status === "flying";
      steps++
    ) {
      if (
        this.transfer?.phase === "coast" &&
        this.t >= this.transfer.readyAt - 1e-6
      ) {
        this.transfer.phase = "ready";
        this.record("Circularization window reached — confirm the second burn");
        break;
      }
      const b = BODY_BY_ID[this.primary];
      const base = this.state(b.id, this.t);
      const r = sub(this.r, base.r),
        v = sub(this.v, base.v);
      const rm = len(r),
        alt = rm - b.radius;
      const flow =
        (this.craft.thrust * clamp(this.throttle, 0, 1)) /
        (G0 * this.craft.isp);
      const burning = flow > 0 && this.fuel > 0;
      let dt = Math.min(
        wanted - elapsed,
        1800,
        0.012 * Math.sqrt(rm ** 3 / b.mu),
      );
      // Resolve surface approach even when a high-speed escape trajectory crosses a small moon.
      dt = Math.min(
        dt,
        Math.max(0.02, (Math.max(0, alt) / Math.max(1, len(v))) * 0.3),
      );
      if (this.physics.srp || this.physics.power)
        dt = Math.min(
          dt,
          eclipseStepLimit(this.r, this.v, this.t, this.primary, this.physics),
        );
      if (this.physics.ephemeris === "de421")
        dt = Math.min(dt, ephemerisData.end - this.t);
      if (this.rigidEnabled) dt = Math.min(dt, 0.1);
      if (burning) dt = Math.min(dt, 0.25, this.fuel / flow);
      const assisted = ["burn1", "burn2"].includes(this.transfer?.phase);
      if (assisted && burning)
        dt = Math.min(
          dt,
          propellantForDeltaV(
            this.dryMass + this.fuel,
            this.craft.isp,
            this.transfer.remaining,
          ) / flow,
        );
      if (this.transfer?.phase === "coast")
        dt = Math.min(dt, Math.max(0, this.transfer.readyAt - this.t));
      if (b.atmosphere && alt < b.atmosphere.top) dt = Math.min(dt, 0.1);
      if (dt < 1e-9) break;
      stepsUsed++;
      const dm = burning ? Math.min(this.fuel, flow * dt) : 0;
      const mass = this.dryMass + this.fuel - dm / 2;
      const dir = this.rigidEnabled
        ? rotate(this.rigid.q, [0, 1, 0])
        : this.rcsEnabled
          ? directionFor(this.mode, r, v, this.pitch, this.yaw)
          : this.heldDirection || norm(v);
      const thrustA = burning
        ? scale(dir, (this.craft.thrust * clamp(this.throttle, 0, 1)) / mass)
        : [0, 0, 0];
      const massBefore = this.dryMass + this.fuel;
      const acceleration = (rp, vp, time) =>
        environmentAcceleration({
          r: rp,
          v: vp,
          t: time,
          body: b,
          mass,
          drag: this.dragEnabled,
          options: this.physics,
          thrust: thrustA,
        });
      const state =
        this.physics.integrator === "accurate"
          ? adaptiveStep(r, v, this.t, dt, acceleration)
          : integrate(r, v, dt, acceleration, this.t);
      this.integrationStats =
        this.physics.integrator === "accurate"
          ? {
              accepted: state.accepted,
              rejected: state.rejected,
              evaluations: state.evaluations,
            }
          : null;
      if (this.physics.power) {
        const powerStart = powerEnvironment(
          this.r,
          this.t,
          this.primary,
          this.throttle,
          this.physics,
          this.craft.power,
        );
        const powerEnd = powerEnvironment(
          add(this.state(b.id, this.t + dt).r, state.r),
          this.t + dt,
          this.primary,
          this.throttle,
          this.physics,
          this.craft.power,
        );
        this.batteryWh = updateBattery(
          this.batteryWh,
          {
            solarWatts: (powerStart.solarWatts + powerEnd.solarWatts) / 2,
            loadWatts: powerStart.loadWatts,
          },
          dt,
          this.craft.power?.batteryWh,
        );
        if (this.batteryWh <= 0) {
          this.heldDirection = [...dir];
          this.rcsEnabled = false;
          this.cancelTransfer("Electrical blackout");
          this.throttle = 0;
        }
      }
      if (this.physics.damage) {
        const surfaceV = sub(
          v,
          cross([0, 0, b.rotation ? (2 * Math.PI) / b.rotation : 0], r),
        );
        const rho = densityAt(b, alt, { r, t: this.t, options: this.physics });
        const heat =
          b.id === "earth"
            ? 1.83e-4 * Math.sqrt(Math.max(0, rho)) * len(surfaceV) ** 3
            : 0;
        this.damage = thermalStep(
          this.damage,
          heat,
          0.5 * rho * len(surfaceV) ** 2,
          len(thrustA),
          dt,
          this.physics.thermalMaterial === "aluminium"
            ? { type: "aluminium" }
            : this.physics.thermalMaterial === "calibrated"
              ? this.thermalCalibration
              : ["pica-virgin", "avcoat-virgin", "avcoat-char"].includes(
                    this.physics.thermalMaterial,
                  )
                ? this.damage.shieldKg > 0
                  ? tpsxMaterial(
                      this.physics.thermalMaterial,
                      this.damage.shieldKg,
                    )
                  : { type: "exposed", heatCapacity: 180000, emissivity: 0.8 }
                : null,
        );
        if (this.damage.integrity <= 0) {
          this.status = "crashed";
          this.throttle = 0;
          this.cancelTransfer("Structural breakup");
          this.debris = vehicleFragments(this) || breakup(this.r, this.v, this.dryMass + this.fuel);
          this.record("Vehicle lost: structural/thermal failure");
        }
      }
      if (this.rigidEnabled) {
        const rotating = { ...this.rigid, mass: this.dryMass + this.fuel };
        if (this.rcsEnabled) {
          const desired = directionFor(this.mode, r, v, this.pitch, this.yaw),
            axis = rotate(rotating.q, [0, 1, 0]);
          const requested = sub(
            scale(cross(axis, desired), 400),
            scale(angularVelocity(rotating), 250),
          );
          const torque = scale(
            requested,
            Math.min(1, 200 / Math.max(1e-10, len(requested))),
          );
          rotating.L = add(rotating.L, scale(torque, dt));
        }
        spin(rotating, dt);
        this.rigid = { q: rotating.q, L: rotating.L, half: rotating.half };
      }
      this.t += dt;
      elapsed += dt;
      this.fuel = Math.max(0, this.fuel - dm);
      const nextBase = this.state(b.id, this.t);
      this.r = add(nextBase.r, state.r);
      this.v = add(nextBase.v, state.v);
      if (len(state.r) <= b.radius) {
        const surfaceV = sub(
          state.v,
          cross([0, 0, b.rotation ? (2 * Math.PI) / b.rotation : 0], state.r),
        );
        const speed = len(surfaceV);
        this.status =
          !b.gas && b.id !== "sun" && speed <= 8 ? "landed" : "crashed";
        this.throttle = 0;
        this.cancelTransfer(
          this.status === "landed" ? "Vehicle landed" : "Vehicle lost",
        );
        this.record(
          this.status === "landed"
            ? `Landed on ${b.name} at ${speed.toFixed(1)} m/s`
            : `${b.gas ? "Vehicle lost in" : "Impact on"} ${b.name} at ${speed.toFixed(0)} m/s`,
        );
        break;
      }
      if (assisted && dm > 0) {
        const delivered =
          G0 * this.craft.isp * Math.log(massBefore / (massBefore - dm));
        this.transfer.remaining = Math.max(
          0,
          this.transfer.remaining - delivered,
        );
        this.transfer.delivered += delivered;
        if (this.transfer.remaining < 1e-6) this.finishAssistedBurn();
      }
      const next = primaryAt(this.r, this.t, (id, t) => this.state(id, t));
      if (next.id !== this.primary) {
        this.cancelTransfer("Sphere of influence changed");
        this.primary = next.id;
        if (!this.visited.includes(next.id)) this.visited.push(next.id);
        this.record(`Entered ${next.name}'s sphere of influence`);
      }
      if (dm > 0 && this.fuel === 0) {
        this.throttle = 0;
        this.cancelTransfer("Propellant depleted");
        this.record("Propellant depleted — coasting");
      }
    }
    this.lastStepCount = stepsUsed;
    if (elapsed > 0) {
      appendTelemetry(this);
      if (recordedInput)
        finishRecordingStep(this, { seconds, input: recordedInput }, stepsUsed);
    }
    return elapsed;
  }

  serialize() {
    return {
      version: 1,
      craftId: this.craft.id,
      ...(this.baseCraft?.id === "hangar" ? {hangarDesign:this.baseCraft.design} : {}),
      physics: { ...this.physics },
      damage: this.damage,
      thermalCalibration: this.thermalCalibration,
      rigid: this.rigid,
      rigidEnabled: this.rigidEnabled,
      debris: this.debris,
      ...(this.meshFracture?{meshFracture:true}:{}),
      dragEnabled: this.dragEnabled,
      batteryWh: this.batteryWh,
      t: this.t,
      r: [...this.r],
      v: [...this.v],
      fuel: this.fuel,
      primary: this.primary,
      mode: this.mode,
      rcsEnabled: this.rcsEnabled,
      heldDirection: this.heldDirection,
      pitch: this.pitch,
      yaw: this.yaw,
      status: this.status,
      visited: [...this.visited],
      log: this.log,
    };
  }

  static restore(s) {
    const craft = s?.craftId === 'hangar' ? hangarCraft(s.hangarDesign) : EXPLORERS.find((c) => c.id === s?.craftId);
    const vector = (x) =>
      Array.isArray(x) && x.length === 3 && x.every(Number.isFinite);
    if (
      s?.version !== 1 ||
      !craft ||
      !Object.prototype.hasOwnProperty.call(BODY_BY_ID, s.primary) ||
      !vector(s.r) ||
      !vector(s.v) ||
      len(s.r) > 1000 * AU ||
      len(s.r) < BODY_BY_ID.sun.radius ||
      len(s.v) > 1e7 ||
      !Number.isFinite(s.t) ||
      s.t < 0 ||
      s.t > 36525 * DAY ||
      !Number.isFinite(s.fuel) ||
      s.fuel < 0 ||
      s.fuel > craft.fuel ||
      !FLIGHT_MODES.includes(s.mode) ||
      ![s.pitch, s.yaw].every(
        (x) => Number.isFinite(x) && Math.abs(x) <= 180,
      ) ||
      (s.rcsEnabled !== undefined && typeof s.rcsEnabled !== "boolean") ||
      (s.heldDirection != null &&
        (!vector(s.heldDirection) ||
          len(s.heldDirection) < 0.5 ||
          len(s.heldDirection) > 1.5)) ||
      !["flying", "landed", "crashed"].includes(s.status)
    )
      throw new Error("This exploration save is not valid");
    if (s.rigidEnabled !== undefined && typeof s.rigidEnabled !== "boolean")
      throw Error("Invalid rotational state");
    if (s.dragEnabled !== undefined && typeof s.dragEnabled !== "boolean")
      throw Error("Invalid saved drag option");
    if (
      s.batteryWh !== undefined &&
      (!Number.isFinite(s.batteryWh) ||
        s.batteryWh < 0 ||
        s.batteryWh > (craft.power?.batteryWh ?? BATTERY_WH))
    )
      throw Error("Invalid saved battery");
    const provider = (id, t) => stateFor(s.physics, id, t);
    const governing = primaryAt(s.r, s.t, provider),
      relativeRadius = len(sub(s.r, provider(governing.id, s.t).r));
    if (
      relativeRadius < governing.radius * 0.5 ||
      (s.status === "flying" && relativeRadius <= governing.radius)
    )
      throw Error("Saved vessel is inside the model surface");
    const physics = forceOptions(s.physics);
    const sim = Object.create(ExplorationSim.prototype);
    Object.assign(sim, {
      t: s.t,
      fuel: s.fuel,
      primary: s.primary,
      mode: s.mode,
      pitch: s.pitch,
      yaw: s.yaw,
      status: s.status,
      r: [...s.r],
      v: [...s.v],
      craft,
      baseCraft: craft,
      throttle: 0,
      transfer: null,
      dragEnabled: s.dragEnabled !== false,
      physics,
      batteryWh: s.batteryWh ?? craft.power?.batteryWh ?? BATTERY_WH,
      damage: damageState(s.damage),
      thermalCalibration: s.thermalCalibration
        ? calibrateThermal(s.thermalCalibration.records, s.thermalCalibration)
        : null,
      rigid: rigidState(s.rigid),
      rigidEnabled: s.rigidEnabled === true,
      meshFracture: s.meshFracture === true,
      debris:
        Array.isArray(s.debris) && s.debris.length <= 32
          ? s.debris.map((f) => {
              if(f.mesh)return restoreMeshFragment(f);
              if (
                !vector(f.r) ||
                !vector(f.v) ||
                !Number.isFinite(f.mass) ||
                f.mass <= 0 ||
                !Number.isFinite(f.radius) ||
                f.radius <= 0
              )
                throw Error("Invalid saved fragment");
              return {
                r: [...f.r],
                v: [...f.v],
                mass: f.mass,
                radius: f.radius,
              };
            })
          : [],
      integrationStats: null,
      program: null,
      recording: null,
      rendezvous: null,
      telemetry: [],
      peakQ: 0,
      rcsEnabled: s.rcsEnabled !== false,
      heldDirection: s.heldDirection ? norm(s.heldDirection) : null,
      visited: (s.visited || []).filter((id) => BODY_BY_ID[id]),
      log: Array.isArray(s.log)
        ? s.log
            .filter((e) => Number.isFinite(e.t) && typeof e.text === "string")
            .slice(-30)
        : [],
    });
    // Derive the governing body rather than trusting a saved label.
    if (s.status === "flying")
      sim.primary = primaryAt(sim.r, sim.t, provider).id;
    if (sim.physics.thermalMaterial === "calibrated" && !sim.thermalCalibration)
      throw Error("Saved custom material lacks experimental calibration");
    return sim;
  }
}
