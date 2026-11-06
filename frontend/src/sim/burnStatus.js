import { G0 } from "./constants";
import { propellantForDeltaV } from "./orbitPlanning";
export function burnStatus(sim) {
  const t=sim.transfer;
  if(!t) return null;
  const mass=sim.craft.dryMass+sim.fuel;
  const remaining=Math.max(0,t.remaining||0);
  const burnFuel=propellantForDeltaV(mass,sim.craft.isp,remaining);
  const flow=sim.craft.thrust/(G0*sim.craft.isp);
  const delivered=t.delivered||0, total=remaining+delivered;
  return { remaining,delivered,seconds:burnFuel/flow,burnFuel,
    fuelAfter:sim.fuel-burnFuel,progress:total?100*delivered/total:0,
    countdown:Math.max(0,(t.readyAt||sim.t)-sim.t) };
}
