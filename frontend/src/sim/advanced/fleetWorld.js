import {vehicleFragments,spinMesh,resolveDebrisMeshes,meshAngularVelocity} from './meshFracture';
import {
  boxContact,
  resolveContact,
  angularVelocity,
  alignRigidBody,
} from "./rigidBody";
import { dockingGeometry, portPose } from "./docking";
import { sweptContact, breakup } from "./damage";
import { ExplorationSim, EXPLORERS } from "../exploration";
import { add, sub, scale, len, norm } from "../vec";
let sequence = 0;
const id = () => `vessel-${Date.now().toString(36)}-${++sequence}`;
const mass = (s) => s.dryMass + s.fuel;
export class FleetWorld {
  constructor(sim = new ExplorationSim()) {
    this.activeId = id();
    this.entries = [{ id: this.activeId, name: sim.craft.name, sim }];
    this.links = [];
    this.message = "";
    this.meshFracture=sim.meshFracture===true;
    this.strictDocking = false;
    this.collisions = false;
    this.rigidContacts = false;
    this.approachReady = null;
    if(this.meshFracture)this.setMeshFracture(true);
  }
  get hasMeshDebris(){return this.entries.some(e=>e.sim.debris?.some(f=>f.mesh));}
  setMeshFracture(enabled){const wasEnabled=this.meshFracture===true;this.meshFracture=!!enabled;if(enabled)this.collisions=true;for(const e of this.entries){e.sim.meshFracture=!!enabled;if(enabled)alignRigidBody(e.sim);else if(wasEnabled&&!this.rigidContacts)e.sim.rigidEnabled=false;}}
  setRigidContacts(enabled) {
    this.rigidContacts = enabled;
    if (enabled) this.collisions = true;
    for (const entry of this.entries) {
      if (enabled) alignRigidBody(entry.sim);
      else entry.sim.rigidEnabled = false;
    }
  }
  setCollisions(enabled) {
    if (!enabled) {this.setRigidContacts(false);this.setMeshFracture(false);}
    this.collisions = enabled;
  }
  get active() {
    return this.entries.find((e) => e.id === this.activeId).sim;
  }
  get hostIds() {
    return new Set(this.links.map((l) => l[1]));
  }
  replaceActive(sim) {
    const entry = this.entries.find((e) => e.id === this.activeId);
    if (entry.sim !== sim) entry.name = sim.craft.name;
    if(this.meshFracture){sim.meshFracture=true;alignRigidBody(sim);}
    entry.sim = sim;
    this.applyCargo();
  }
  applyCargo() {
    for (const e of this.entries) {
      const definition = e.sim.baseCraft || EXPLORERS.find((c) => c.id === e.sim.craft.id);
      e.sim.craft = { ...definition };
    }
    for (const [host, guest] of this.links) {
      const h = this.entries.find((e) => e.id === host),
        g = this.entries.find((e) => e.id === guest);
      h.sim.craft = {
        ...h.sim.craft,
        dryMass: h.sim.craft.dryMass + mass(g.sim),
      };
    }
  }
  switchTo(targetId) {
    const entry = this.entries.find((e) => e.id === targetId);
    if (!entry || this.hostIds.has(targetId))
      throw Error("Choose a free vessel or the docking host.");
    if (
      entry.sim.status === "flying" &&
      Math.abs(entry.sim.t - this.active.t) > 1e-4
    )
      throw Error(
        "This vessel is catching up. Pause and allow synchronization.",
      );
    this.active.cancelTransfer("Vessel parked");
    this.active.throttle = 0;
    this.activeId = targetId;
    return this.active;
  }
  create(craftId) {
    if (this.active.recording?.active)
      throw Error("Stop the single-vessel recording before adding companions.");
    if (this.entries.length >= 6)
      throw Error("This local world supports six vessels.");
    const active = this.active;
    if (active.status !== "flying")
      throw Error("Create a companion from a flying vessel.");
    active.cancelTransfer("Companion created");
    active.throttle = 0;
    const sim = new ExplorationSim(
      active.primary,
      craftId,
      active.t,
      active.navigation().altitude,
      { ...active.physics, thermalCalibration: active.thermalCalibration },
    );
    sim.meshFracture=this.meshFracture===true;
    sim.r = add(active.r, scale(norm(active.navigation().r), 100));
    sim.v = [...active.v];
    let ordinal = 2;
    const existingNames = new Set(this.entries.map((entry) => entry.name));
    while (existingNames.has(`${sim.craft.name} ${ordinal}`)) ordinal++;
    const entry = {
      id: id(),
      name: `${sim.craft.name} ${ordinal}`,
      sim,
    };
    this.entries.push(entry);
    return entry;
  }
  remove(targetId) {
    if (
      targetId === this.activeId ||
      this.links.some((l) => l.includes(targetId))
    )
      throw Error("Only free, parked vessels can be removed.");
    const index = this.entries.findIndex((e) => e.id === targetId);
    if (index < 0) throw Error("Unknown vessel");
    if (this.active.rendezvous === targetId) {
      this.active.cancelTransfer("Target removed");
      this.active.throttle = 0;
    }
    this.entries.splice(index, 1);
    this.message = "Parked vessel removed from this local world.";
  }
  relative(targetId) {
    const target = this.entries.find((e) => e.id === targetId);
    if (!target) return null;
    return {
      distance: len(sub(target.sim.r, this.active.r)),
      speed: len(sub(target.sim.v, this.active.v)),
      lag: this.active.t - target.sim.t,
    };
  }
  startApproach(targetId) {
    if (this.active.recording?.active)
      throw Error("Stop control recording before rendezvous assistance.");
    const target = this.entries.find((e) => e.id === targetId),
      a = this.active,
      r = this.relative(targetId);
    if (
      !target ||
      targetId === this.activeId ||
      this.links.some(
        (l) => l.includes(targetId) || l.includes(this.activeId),
      ) ||
      target.sim.status !== "flying" ||
      a.status !== "flying" ||
      target.sim.primary !== a.primary ||
      !r ||
      r.distance > 100000 ||
      Math.abs(r.lag) > 1e-4
    )
      throw Error(
        "Rendezvous requires two free, synchronized vessels within 100 km of one another around the same body.",
      );
    if(a.craft.id === "hangar" && a.craft.minThrottle>0.15)throw Error("This engine minimum throttle is too high for rendezvous assistance; use manual control.");
    if (!a.ignitionAllowed())
      throw Error(
        "Rendezvous requires available electrical power and ground link.",
      );
    this.approachReady = null;
    a.cancelTransfer("Rendezvous control selected");
    a.rendezvous = targetId;
    this.message = "Rendezvous assistance active · real thrust and propellant";
  }
  guideApproach() {
    const a = this.active,
      target = this.entries.find((e) => e.id === a.rendezvous);
    if (!target) return;
    const delta = sub(target.sim.r, a.r),
      relative = sub(target.sim.v, a.v),
      distance = len(delta),
      speed = len(relative);
    if (distance < 18 && speed < 0.12) {
      a.rendezvous = null;
      a.throttle = 0;
      this.approachReady = target.id;
      this.message = "Docking capture ready · confirm Dock";
      return;
    }
    if (a.fuel <= 0) {
      a.rendezvous = null;
      a.throttle = 0;
      this.message = "Rendezvous stopped: no propellant";
      return;
    }
    const desiredVelocity = scale(
      norm(delta),
      Math.min(8, Math.max(0, (distance - 12) * 0.035)),
    );
    const acceleration = scale(add(desiredVelocity, relative), 0.25);
    a.rcsEnabled = false;
    if (len(acceleration) > 1e-12) a.heldDirection = norm(acceleration);
    a.throttle = Math.min(0.15, (mass(a) * len(acceleration)) / a.craft.thrust);
  }
  syncOthers(maxSteps = 300) {
    const active = this.active,
      attached = this.hostIds;
    let ready = true;
    for (const entry of this.entries) {
      const s = entry.sim;
      if (
        entry.id === this.activeId ||
        attached.has(entry.id) ||
        s.status !== "flying"
      )
        continue;
      const behind = active.t - s.t;
      if (behind > 1e-7) s.advance(behind, maxSteps);
      if (active.t - s.t > 1e-5) ready = false;
    }
    for (const [host, guest] of this.links) {
      const h = this.entries.find((e) => e.id === host).sim,
        g = this.entries.find((e) => e.id === guest).sim;
      g.r = this.strictDocking
        ? add(h.r, scale(portPose(h).axis, 6))
        : [...h.r];
      if (this.strictDocking) {
        g.rcsEnabled = false;
        g.heldDirection = scale(portPose(h).axis, -1);
      }
      g.v = [...h.v];
      g.t = h.t;
      g.primary = h.primary;
    }
    return ready;
  }
  advance(seconds,maxSteps=600) {
    if(!Number.isInteger(maxSteps)||maxSteps<1||maxSteps>600)throw Error("Work limit must be between 1 and 600 steps");
    const syncSteps=Math.min(300,maxSteps);
    if(this.meshFracture||this.entries.some(e=>e.sim.debris?.some(f=>f.mesh))){let speed=1;for(const e of this.entries){speed=Math.max(speed,len(sub(e.sim.v,this.active.v)));for(const f of e.sim.debris||[])if(f.mesh)speed=Math.max(speed,len(sub(f.v,this.active.v))+len(meshAngularVelocity(f))*f.radius);}seconds=Math.min(seconds,.02,.05/speed);}
    if (!this.syncOthers(syncSteps)) return 0;
    this.applyCargo();
    this.guideApproach();
    if (this.rigidContacts) {
      this.collisions = true;
      for (const entry of this.entries) {
        alignRigidBody(entry.sim);
      }
      let maximumSweepSpeed = 0;
      for (let i = 0; i < this.entries.length; i++)
        for (let j = i + 1; j < this.entries.length; j++)
          maximumSweepSpeed = Math.max(
            maximumSweepSpeed,
            len(sub(this.entries[i].sim.v, this.entries[j].sim.v)),
          );
      for (const entry of this.entries)
        maximumSweepSpeed +=
          len(angularVelocity({ ...entry.sim.rigid, mass: mass(entry.sim) })) *
          len(entry.sim.rigid.half);
      seconds = Math.min(seconds, 0.02, 0.2 / Math.max(1, maximumSweepSpeed));
    }
    if (this.collisions) seconds = Math.min(seconds, 10);
    const before = this.entries.map((e) => [...e.sim.r]);
    let advanced = this.active.advance(
      this.active.rendezvous ? Math.min(seconds, 0.25) : seconds,
      maxSteps,
    );
    if(!advanced&&this.active.status!=="flying"&&this.hasMeshDebris){advanced=seconds;this.active.t+=advanced;}
    this.syncOthers(syncSteps);
    if (this.collisions && advanced > 0)
      for (let i = 0; i < this.entries.length; i++)
        for (let j = i + 1; j < this.entries.length; j++) {
          const a = this.entries[i],
            b = this.entries[j];
          if (
            a.sim.status !== "flying" ||
            b.sim.status !== "flying" ||
            this.links.some((l) => l.includes(a.id) && l.includes(b.id))
          )
            continue;
          if (Math.abs(a.sim.t - b.sim.t) > 1e-5) continue;
          if (this.rigidContacts) {
            const A = {
                ...a.sim.rigid,
                mass: mass(a.sim),
                r: a.sim.r,
                v: a.sim.v,
              },
              B = { ...b.sim.rigid, mass: mass(b.sim), r: b.sim.r, v: b.sim.v };
            const contact = boxContact(A, B);
            if (contact) {
              for (let iteration = 0; iteration < 8; iteration++) {
                const c = boxContact(A, B);
                if (c) resolveContact(A, B, c);
              }
              for (const [entry, body] of [
                [a, A],
                [b, B],
              ]) {
                entry.sim.r = body.r;
                entry.sim.v = body.v;
                entry.sim.rigid = { q: body.q, L: body.L, half: body.half };
                entry.sim.cancelTransfer("Hull contact");
              }
              this.message =
                "Rigid hull contact: translation, spin and friction resolved";
            }
            continue;
          }
          if (sweptContact(before[i], a.sim.r, before[j], b.sim.r, 4).hit) {
            const destroyed = new Set([a.id, b.id]);
            for (const link of this.links)
              if (link.some((id) => destroyed.has(id)))
                link.forEach((id) => destroyed.add(id));
            this.links = this.links.filter(
              (link) => !link.some((id) => destroyed.has(id)),
            );
            this.applyCargo();
            for (const e of this.entries.filter((entry) =>
              destroyed.has(entry.id),
            )) {
              e.sim.status = "crashed";
              e.sim.throttle = 0;
              e.sim.cancelTransfer("Vessel collision");
              e.sim.debris = vehicleFragments(e.sim) || breakup(e.sim.r, e.sim.v, mass(e.sim));
              e.sim.record("Vehicle lost in fleet collision");
            }
            this.message = "Collision: both vehicles fragmented";
          }
        }
    if (this.collisions && advanced > 0)
      for (const owner of this.entries)
        for (const fragment of owner.sim.debris || []) {
          const old = [...fragment.r],
            center = owner.sim.state(owner.sim.primary, this.active.t).r,
            local = sub(fragment.r, center),
            radius = len(local);
          const acc = scale(
            local,
            -owner.sim.navigation().body.mu / Math.max(1, radius ** 3),
          );
          fragment.r = add(
            fragment.r,
            add(scale(fragment.v, advanced), scale(acc, 0.5 * advanced ** 2)),
          );
          fragment.v = add(fragment.v, scale(acc, advanced));
          if(fragment.mesh)spinMesh(fragment,Math.min(.1,advanced));
          for (let i = 0; i < this.entries.length; i++) {
            const target = this.entries[i];
            if (target === owner || target.sim.status !== "flying" || fragment.mesh) continue;
            if (
              sweptContact(
                before[i],
                target.sim.r,
                old,
                fragment.r,
                2 + fragment.radius,
              ).hit
            ) {
              target.sim.status = "crashed";
              target.sim.throttle = 0;
              target.sim.cancelTransfer("Debris strike");
              target.sim.record("Vehicle lost: debris strike");
            }
          }
        }
    if(this.collisions&&advanced>0){resolveDebrisMeshes(this.entries);for(const e of this.entries){const fragments=e.sim.debris;if(e.sim.status==='crashed'&&fragments?.some(f=>f.mesh)){const mass=fragments.reduce((s,f)=>s+f.mass,0);e.sim.r=scale(fragments.reduce((s,f)=>add(s,scale(f.r,f.mass)),[0,0,0]),1/mass);e.sim.v=scale(fragments.reduce((s,f)=>add(s,scale(f.v,f.mass)),[0,0,0]),1/mass);e.sim.t=this.active.t;}}}
    return advanced;
  }
  dock(targetId) {
    const a = this.active,
      target = this.entries.find((e) => e.id === targetId),
      r = this.relative(targetId);
    if (
      !target ||
      targetId === this.activeId ||
      this.links.some(
        (l) => l.includes(targetId) || l.includes(this.activeId),
      ) ||
      a.status !== "flying" ||
      target.sim.status !== "flying" ||
      a.primary !== target.sim.primary ||
      Math.abs(r.lag) > 1e-4 ||
      r.distance > 25 ||
      r.speed > 0.5
    )
      throw Error(
        "Docking needs two free vessels within 25 m, relative speed ≤0.5 m/s, and synchronized time.",
      );
    if (this.strictDocking && !dockingGeometry(a, target.sim).ready)
      throw Error(
        "Align opposed ports within 5°, gap 0.5 m, lateral 0.2 m and relative speed 0.1 m/s.",
      );
    this.approachReady = null;
    a.cancelTransfer("Docking capture");
    target.sim.cancelTransfer("Docking capture");
    a.throttle = target.sim.throttle = 0;
    const m1 = mass(a),
      m2 = mass(target.sim),
      velocity = scale(
        add(scale(a.v, m1), scale(target.sim.v, m2)),
        1 / (m1 + m2),
      );
    a.v = velocity;
    target.sim.v = [...velocity];
    target.sim.r = [...a.r];
    this.links.push([this.activeId, targetId]);
    this.applyCargo();
    this.message = "Docked · combined mass applied to propulsion";
  }
  undock() {
    const link = this.links.find((l) => l[0] === this.activeId);
    if (!link) throw Error("No attached vessel");
    const a = this.active,
      b = this.entries.find((e) => e.id === link[1]).sim;
    a.cancelTransfer("Undocking");
    a.throttle = 0;
    this.links = this.links.filter((l) => l !== link);
    this.applyCargo();
    const n = this.strictDocking ? portPose(a).axis : norm(a.navigation().r),
      dv = scale(n, 0.05);
    b.r = add(a.r, scale(n, 12));
    b.v = add(a.v, dv);
    a.v = sub(a.v, scale(dv, mass(b) / mass(a)));
    b.t = a.t;
    this.message = "Undocked · gentle separation";
    return b;
  }
  transferFuel(targetId, amount) {
    if (!Number.isFinite(amount) || amount === 0)
      throw Error("Enter a finite, non-zero fuel amount.");
    const link = this.links.find(
      (l) => l[0] === this.activeId && l[1] === targetId,
    );
    if (!link) throw Error("Fuel transfer requires docking.");
    const a = this.active,
      b = this.entries.find((e) => e.id === targetId).sim;
    if (a.throttle || b.throttle)
      throw Error("Cut thrust before transferring fuel.");
    // Positive amount moves fuel to the active host; negative sends it to the guest.
    const donor = amount > 0 ? b : a,
      receiver = amount > 0 ? a : b,
      capacity = (receiver.baseCraft || EXPLORERS.find((c) => c.id === receiver.craft.id)).fuel;
    if((donor.craft.id === "hangar" || receiver.craft.id === "hangar") && donor.craft.propellant!==receiver.craft.propellant)throw Error("Fuel transfer requires matching known propellant types.");
    const moved = Math.min(
      Math.abs(amount),
      donor.fuel,
      capacity - receiver.fuel,
    );
    if (moved <= 0) throw Error("Donor empty or receiver full.");
    donor.fuel -= moved;
    receiver.fuel += moved;
    this.applyCargo();
    this.message = `Transferred ${moved.toFixed(1)} kg`;
    return moved;
  }
  serialize() {
    return {
      version: 1,
      rigidContacts: this.rigidContacts,
      strictDocking: this.strictDocking,
      collisions: this.collisions,
      ...(this.meshFracture?{meshFracture:true}:{}),
      activeId: this.activeId,
      entries: this.entries.map((e) => ({
        id: e.id,
        name: e.name,
        state: e.sim.serialize(),
      })),
      links: this.links.map((l) => [...l]),
    };
  }
  static restore(data) {
    if (
      data?.version !== 1 ||
      !Array.isArray(data.entries) ||
      data.entries.length < 1 ||
      data.entries.length > 6 ||
      !Array.isArray(data.links)
    )
      throw Error("Invalid fleet world");
    const world = Object.create(FleetWorld.prototype);
    world.entries = data.entries.map((e) => {
      if (
        typeof e.id !== "string" ||
        e.id.length > 100 ||
        typeof e.name !== "string" ||
        e.name.length > 80
      )
        throw Error("Invalid vessel label");
      return { id: e.id, name: e.name, sim: ExplorationSim.restore(e.state) };
    });
    const ids = new Set(world.entries.map((e) => e.id)),
      used = new Set();
    if (ids.size !== world.entries.length || !ids.has(data.activeId))
      throw Error("Invalid fleet IDs");
    world.links = data.links.map((l) => {
      if (
        !Array.isArray(l) ||
        l.length !== 2 ||
        l[0] === l[1] ||
        !l.every((id) => ids.has(id) && !used.has(id))
      )
        throw Error("Invalid docking links");
      l.forEach((id) => used.add(id));
      return [...l];
    });
    if (world.links.some((l) => l[1] === data.activeId))
      throw Error("Active vessel must be the docking host");
    if (
      [data.strictDocking, data.collisions, data.meshFracture].some(
        (v) => v !== undefined && typeof v !== "boolean",
      )
    )
      throw Error("Invalid fleet contact settings");
    if (
      data.rigidContacts !== undefined &&
      typeof data.rigidContacts !== "boolean"
    )
      throw Error("Invalid rigid contact option");
    world.rigidContacts = data.rigidContacts === true;
    world.strictDocking = data.strictDocking === true;
    world.collisions = data.collisions === true;
    world.approachReady = null;
    world.activeId = data.activeId;
    if(world.entries.reduce((n,e)=>n+(e.sim.debris||[]).filter(f=>f.mesh).length,0)>64)throw Error('Fleet supports at most 64 convex debris hulls.');
    world.setMeshFracture(data.meshFracture === true);
    world.message = "Local fleet restored · engines disarmed";
    for (const e of world.entries) {
      e.sim.rendezvous = null;
      e.sim.throttle = 0;
    }
    world.applyCargo();
    return world;
  }
}
