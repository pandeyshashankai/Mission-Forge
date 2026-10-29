import { EARTH, G0 } from "./constants";
import { add, cross, dot, len, norm, scale, sub, clamp } from "./vec";
import { PARTS } from "./parts";

export const MAX_RATE = 10 * (Math.PI / 180);
export const RCS_ISP = 220;

// Rigid-body properties of the attached vehicle (uniform cylinder approximation).
export function vehicleConfig(sim) {
  let L = 0, maxD = 0, wheelTorque = 0, wheelMomentum = 0, rcsThrust = 0, gimbal = 0;
  sim.rt.sections.forEach((s, i) => {
    if (!s.attached) return;
    for (const n of sim.sections[i].parts) {
      const p = PARTS[n.partId];
      if (p.fairing && s.fairings.find((f) => f.uid === n.uid && !f.attached)) continue;
      L += p.fairing ? p.height : p.height;
      maxD = Math.max(maxD, p.diameter);
      if (p.attitude) {
        wheelTorque += p.attitude.wheelTorque || 0;
        wheelMomentum += p.attitude.wheelMomentum || 0;
        rcsThrust += p.attitude.rcsThrust || 0;
      }
      if (p.engine && s.ignited) gimbal = Math.max(gimbal, p.engine.gimbal || 0);
    }
  });
  return { L: Math.max(L, 1), R: maxD / 2, wheelTorque, wheelMomentum, rcsThrust, gimbal };
}

export const inertiaT = (m, c) => m * ((c.L * c.L) / 12 + (c.R * c.R) / 4);
export const rcsTorque = (c) => c.rcsThrust * 0.9 * c.L;

export function rcsFuel(rt) {
  let f = 0;
  for (const s of rt.sections) if (s.attached) f += s.tanks.monoprop || 0;
  return f;
}

function burnRcs(rt, kg) {
  for (const s of rt.sections) {
    if (!s.attached || !(s.tanks.monoprop > 0)) continue;
    const take = Math.min(kg, s.tanks.monoprop);
    s.tanks.monoprop -= take;
    kg -= take;
    if (kg <= 0) return;
  }
}

function anyPerp(d) {
  return norm(Math.abs(d[2]) < 0.9 ? cross(d, [0, 0, 1]) : cross(d, [1, 0, 0]));
}

// Gravity-gradient and aerodynamic (weathervane) disturbance torques.
export function disturbance(sim, m, c, vRel, q, area) {
  const pr = sim.prim || { r: sim.r, mu: EARTH.mu };
  const rm = len(pr.r);
  const rh = scale(pr.r, 1 / rm);
  const It = inertiaT(m, c);
  const Ia = (m * c.R * c.R) / 2;
  let tau = scale(cross(sim.dir, rh), ((3 * pr.mu) / (rm * rm * rm)) * (It - Ia) * dot(sim.dir, rh));
  if (q > 0) {
    const vh = norm(vRel);
    tau = add(tau, scale(cross(sim.dir, vh), q * area * 0.5 * 0.1 * c.L));
  }
  return tau;
}

// One attitude step: controller -> torque allocation (gimbal, wheels, RCS) -> rotation integration.
export function attitudeStep(sim, dt, { F, m, target, rateCmd, vRel = [0, 0, 0], q = 0, area = 0 }) {
  const c = sim.config;
  const I = inertiaT(m, c);
  const tg = F > 0 ? F * Math.sin(c.gimbal * (Math.PI / 180)) * 0.4 * c.L : 0;
  const tw = c.wheelTorque;
  const fuel = rcsFuel(sim.rt);
  const tr = sim.rcsEnabled && fuel > 0 ? rcsTorque(c) : 0;
  const tAvail = tg + tw + tr;
  const dist = disturbance(sim, m, c, vRel, q, area);
  let wDes = null;
  if (target) {
    const e = cross(sim.dir, target);
    const s = len(e);
    const ang = Math.atan2(s, dot(sim.dir, target));
    const axis = s > 1e-9 ? scale(e, 1 / s) : ang > 1 ? anyPerp(sim.dir) : [0, 0, 0];
    const alpha = tAvail / I;
    wDes = scale(axis, Math.min(MAX_RATE, Math.sqrt(2 * alpha * ang) * 0.8, ang * 1.5));
  } else if (rateCmd) wDes = rateCmd;
  let tauCtl = [0, 0, 0];
  let wheelUsed = [0, 0, 0];
  let rcsUsed = 0;
  if (wDes) {
    const tauc = Math.max(0.5, 4 * dt);
    const need = sub(scale(sub(wDes, sim.omega), I / tauc), dist);
    let mag = len(need);
    if (mag > 1e-12) {
      const dirT = scale(need, 1 / mag);
      const g = Math.min(mag, tg);
      mag -= g;
      let w = Math.min(mag, tw);
      const Hm = len(sim.wheelH);
      if (Hm >= c.wheelMomentum && dot(dirT, sim.wheelH) < 0) w = 0;
      mag -= w;
      const r = Math.min(mag, tr);
      tauCtl = scale(dirT, g + w + r);
      wheelUsed = scale(dirT, w);
      rcsUsed += r;
    }
  }
  sim.wheelH = sub(sim.wheelH, scale(wheelUsed, dt));
  const Hm = len(sim.wheelH);
  if (Hm > c.wheelMomentum) sim.wheelH = scale(sim.wheelH, c.wheelMomentum / Hm);
  if (c.wheelMomentum > 0 && Hm >= c.wheelMomentum * 0.999 && !sim.wheelsSaturated) {
    sim.wheelsSaturated = true;
    sim.addLog("warn", "Reaction wheels saturated — RCS needed to unload");
  } else if (Hm < c.wheelMomentum * 0.8) sim.wheelsSaturated = false;
  if (tr > 0 && Hm > c.wheelMomentum * 0.7) {
    const u = Math.min(tr - rcsUsed, (Hm - c.wheelMomentum * 0.3) / dt);
    if (u > 0) {
      sim.wheelH = sub(sim.wheelH, scale(norm(sim.wheelH), u * dt));
      rcsUsed += u;
    }
  }
  if (rcsUsed > 0) {
    burnRcs(sim.rt, ((rcsUsed / (0.9 * c.L)) / (RCS_ISP * G0)) * dt);
    if (rcsFuel(sim.rt) <= 0 && !sim.rcsEmptyLogged) {
      sim.rcsEmptyLogged = true;
      sim.addLog("warn", "RCS propellant depleted");
    }
  }
  let w = add(sim.omega, scale(add(tauCtl, dist), dt / I));
  w = sub(w, scale(sim.dir, dot(w, sim.dir)));
  sim.omega = w;
  const wm = len(w);
  if (wm > 0) {
    const a = wm * dt;
    const k = scale(w, 1 / wm);
    sim.dir = norm(add(scale(sim.dir, Math.cos(a)), scale(cross(k, sim.dir), Math.sin(a))));
  }
  sim.attStatus = { torqueAvail: tAvail, gimbal: tg, wheels: tw, rcs: tr, required: wDes ? I * MAX_RATE / 10 : 0, wheelPct: c.wheelMomentum ? (100 * len(sim.wheelH)) / c.wheelMomentum : 0, rcsFuel: rcsFuel(sim.rt), rate: (wm * 180) / Math.PI, inertia: I };
}

const FINE = 0.1;

// Long coast steps (> 0.1 s, high orbits): a settled vehicle holds its target exactly while the wheels absorb
// the disturbance momentum (RCS unloads / takes over); otherwise the full dynamics are sub-stepped at 0.1 s.
export function attitudeCoarse(sim, dt, m, target) {
  const c = sim.config;
  const settled = target && dot(sim.dir, target) > Math.cos(Math.PI / 180) && len(sim.omega) < 0.05 * (Math.PI / 180);
  if (settled) {
    const dist = disturbance(sim, m, c, [0, 0, 0], 0, 0);
    const fuel = rcsFuel(sim.rt);
    const rcsOk = sim.rcsEnabled && fuel > 0 && c.rcsThrust > 0;
    let H = add(sim.wheelH, scale(dist, c.wheelTorque >= len(dist) ? dt : 0));
    let rcsImpulse = c.wheelTorque >= len(dist) ? 0 : len(dist) * dt;
    if (c.wheelTorque >= len(dist) && len(H) > c.wheelMomentum * 0.7 && rcsOk) {
      const dH = len(H) - c.wheelMomentum * 0.3;
      H = scale(norm(H), c.wheelMomentum * 0.3);
      rcsImpulse += dH;
    }
    const canHold = len(H) <= c.wheelMomentum && (rcsImpulse === 0 || rcsOk);
    if (canHold) {
      sim.wheelH = H;
      if (rcsImpulse > 0) burnRcs(sim.rt, rcsImpulse / (0.9 * c.L) / (RCS_ISP * G0));
      sim.dir = target;
      sim.omega = [0, 0, 0];
      const I = inertiaT(m, c);
      sim.attStatus = { ...(sim.attStatus || {}), wheelPct: c.wheelMomentum ? (100 * len(H)) / c.wheelMomentum : 0, rcsFuel: rcsFuel(sim.rt), rate: 0, inertia: I, torqueAvail: c.wheelTorque + (rcsOk ? rcsTorque(c) : 0) };
      return;
    }
  }
  if (!target && !(len(sim.omega) > 0)) return;
  const n = Math.ceil(dt / FINE - 1e-9);
  for (let i = 0; i < n; i++) attitudeStep(sim, dt / n, { F: 0, m, target: target && sim.targetDir() });
}

export function attitudeRequirement(mass, cfg, slewDeg = 90, slewTime = 60) {
  const I = inertiaT(mass, cfg);
  const th = (slewDeg * Math.PI) / 180;
  const alpha = (4 * th) / (slewTime * slewTime);
  return { I, alpha, torque: I * alpha, momentum: (I * 2 * th) / slewTime, theta: th };
}

export const clampRate = (x) => clamp(x, -MAX_RATE, MAX_RATE);
