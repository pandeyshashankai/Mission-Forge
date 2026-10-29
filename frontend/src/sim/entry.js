import { G0 } from "./constants";
import { add, cross, dot, len, norm, scale, sub } from "./vec";
import { PARTS } from "./parts";
import { attachedNodes, crewOf } from "./crew";

export const CD_CAPSULE = 1.3;
export const LIFT_TO_DRAG = 0.3;
export const SUTTON_GRAVES_K = 1.7415e-4;
export const ENTRY_INTERFACE = 122000;
export const CREW_G_LIMIT = 10;
export const CREW_G_FATAL = 16;
export const BARE_FLUX_LIMIT = 3e5;
export const SPLASH_SPEED = 15;

// Blunt-body (capsule) configuration of the attached vehicle.
export function aeroConfig(sim) {
  const nodes = attachedNodes(sim);
  const parts = nodes.map((n) => PARTS[n.partId]);
  const shield = parts.find((p) => p.heatShield);
  const chute = parts.find((p) => p.parachute);
  const capsule = parts.find((p) => p.look === "capsule");
  const engines = parts.some((p) => p.engine);
  const D = shield ? shield.diameter : capsule ? capsule.diameter : 0;
  return {
    blunt: !!shield && !!capsule && !engines,
    shield: shield ? shield.heatShield : null,
    chute: chute ? chute.parachute : null,
    crew: crewOf(nodes),
    area: Math.PI * (D / 2) ** 2,
    noseRadius: shield ? shield.heatShield.noseRadius : Math.max(0.5, D / 2),
  };
}

export const newEntryState = () => ({ chute: "stowed", heatLoad: 0, maxFlux: 0, maxG: 0, gOverT: 0, bankMode: "auto", bank: 0, ei: null, flux: 0, g: 0 });

export const stagnationFlux = (rho, V, rn) => SUTTON_GRAVES_K * Math.sqrt(rho / rn) * V ** 3;

// Drag + lift (+ parachutes) acceleration on a capsule. Lift vector = "lift up" rotated by the bank angle.
export function capsuleAero(sim, r, vRel, rho, m) {
  const s = len(vRel);
  if (!(rho > 0) || s <= 0) return [0, 0, 0];
  const q = 0.5 * rho * s * s;
  const a = sim.aero;
  const e = sim.entry;
  let CdA = CD_CAPSULE * a.area;
  // Reefed canopies: drag area grows over the inflation time (drogue 2 s, mains 8 s).
  const infl = (T) => Math.min(1, Math.max(0, (sim.t - (e.chuteT ?? sim.t)) / T));
  if (a.chute && e.chute === "drogue") CdA += a.chute.drogueCdA * infl(2);
  if (a.chute && e.chute === "main") CdA += a.chute.drogueCdA + (a.chute.mainCdA - a.chute.drogueCdA) * infl(8);
  const vh = scale(vRel, 1 / s);
  let acc = scale(vh, (-q * CdA) / m);
  if (e.chute === "stowed" || e.chute === "failed") {
    const up = norm(r);
    let lu = sub(up, scale(vh, dot(up, vh)));
    if (len(lu) > 1e-9) {
      lu = norm(lu);
      const side = cross(vh, lu);
      const b = (e.bank * Math.PI) / 180;
      const dirL = add(scale(lu, Math.cos(b)), scale(side, Math.sin(b)));
      acc = add(acc, scale(dirL, (q * CD_CAPSULE * a.area * LIFT_TO_DRAG) / m));
    }
  }
  return acc;
}

// Post-step bookkeeping: heating, g-load, entry interface, bank logic and parachute sequencing.
export function entryUpdate(sim, nav, dt, sensedG) {
  const e = sim.entry;
  const a = sim.aero;
  e.g = sensedG;
  e.maxG = Math.max(e.maxG, sensedG);
  if (e.ei) e.maxGEntry = Math.max(e.maxGEntry || 0, sensedG);
  if (a.crew && sensedG > CREW_G_FATAL) {
    e.gOverT += dt;
    if (e.gOverT > 1) return sim.loseCrew(`Crew lost — ${sensedG.toFixed(1)} g exceeded the survivable limit`);
  } else e.gOverT = 0;
  if (nav.alt < ENTRY_INTERFACE && nav.vr < 0 && !e.ei && nav.speed > 7000) {
    e.ei = { t: sim.t, fpa: nav.surfFPA, speed: nav.surfSpeed };
    sim.addLog("info", `Entry interface (122 km) — ${nav.surfSpeed.toFixed(0)} m/s, flight-path angle ${nav.surfFPA.toFixed(2)}°`);
  }
  const rho = nav.atm.rho;
  if (!(rho > 0)) return;
  e.flux = stagnationFlux(rho, nav.surfSpeed, a.noseRadius);
  e.maxFlux = Math.max(e.maxFlux, e.flux);
  if (a.crew || a.blunt) {
    if (a.shield) {
      e.heatLoad += e.flux * dt;
      if (e.flux > a.shield.maxFlux) return sim.loseCrew(`Heat shield failed — peak heat flux ${(e.flux / 1e6).toFixed(1)} MW/m² above its ${(a.shield.maxFlux / 1e6).toFixed(0)} MW/m² limit`, true);
      if (e.heatLoad > a.shield.capacity) return sim.loseCrew(`Heat shield ablator exhausted — heat load ${(e.heatLoad / 1e7).toFixed(1)} kJ/cm²`, true);
    } else if (e.flux > BARE_FLUX_LIMIT && a.crew) return sim.loseCrew(`Capsule burned up — no heat shield (${(e.flux / 1e6).toFixed(2)} MW/m²)`, true);
  }
  if (!a.blunt) return;
  if (e.bankMode === "auto") e.bank = nav.vr > 30 ? 180 : nav.vr < -30 ? 0 : 90;
  else e.bank = e.bankMode;
  const c = a.chute;
  if (!c || nav.vr >= 0) return;
  if (e.chute === "stowed" && nav.alt < c.drogueAlt) {
    if (nav.q <= c.drogueMaxQ) {
      e.chute = "drogue";
      e.chuteT = sim.t;
      sim.addLog("success", `Drogue parachutes deployed at ${(nav.alt / 1000).toFixed(1)} km, ${nav.surfSpeed.toFixed(0)} m/s`);
    } else if (nav.alt < c.mainAlt) {
      e.chute = "failed";
      sim.addLog("fail", `Parachutes shredded — deployed at ${(nav.q / 1000).toFixed(1)} kPa (limit ${(c.drogueMaxQ / 1000).toFixed(0)} kPa)`);
    }
  } else if (e.chute === "drogue" && nav.alt < c.mainAlt) {
    if (nav.surfSpeed <= c.mainMaxSpeed) {
      e.chute = "main";
      e.chuteT = sim.t;
      sim.addLog("success", `Main parachutes deployed at ${(nav.alt / 1000).toFixed(1)} km`);
    } else {
      e.chute = "failed";
      sim.addLog("fail", `Main parachutes failed — ${nav.surfSpeed.toFixed(0)} m/s at deploy (limit ${c.mainMaxSpeed} m/s)`);
    }
  }
}

export const sensedAccelG = (nonGrav) => len(nonGrav) / G0;
