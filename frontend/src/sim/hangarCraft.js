import { PARTS } from "./parts";
import { isValidDesign } from "./storage";
export function hangarCraft(design) {
  if (!isValidDesign(design) || design.stack.length > 64)
    throw Error("Use a valid design with at most 64 axial parts.");
  if (design.radials?.length)
    throw Error("Remove radial boosters before exploration transfer.");
  const parts = design.stack.map((n) => PARTS[n.partId]);
  if (
    parts.some(
      (p) =>
        p.custom ||
        p.decoupler ||
        p.fairing ||
        p.crew > 0 ||
        p.category === "recovery" ||
        p.systems?.rad ||
        p.category === "booster",
    )
  )
    throw Error(
      "Use built-in uncrewed single-stage parts; remove decouplers, fairings, recovery equipment, radiators and boosters.",
    );
  if (!parts.some((p) => p.control))
    throw Error("Add a probe or controllable payload.");
  const engines = parts.filter((p) => p.engine).map((p) => p.engine),
    types = new Set(engines.map((e) => e.propellant));
  if (!engines.length || types.size !== 1 || types.has("solid"))
    throw Error(
      "Use at least one liquid engine and one shared propellant type.",
    );
  const propellant = engines[0].propellant;
  if (parts.some((p) => p.propellant && p.propellant.type !== propellant))
    throw Error(
      "Remove tanks for other propellants; separate RCS propellant is not supported by this adapter.",
    );
  const fuel = parts.reduce((s, p) => s + (p.propellant?.mass || 0), 0),
    dryMass = parts.reduce((s, p) => s + p.dryMass, 0),
    thrust = engines.reduce((s, e) => s + e.thrustVac, 0),
    flow = engines.reduce((s, e) => s + e.thrustVac / e.ispVac, 0),
    batteryWh = parts.reduce((s, p) => s + (p.systems?.battery || 0), 0),
    solarWatts = parts.reduce((s, p) => s + (p.systems?.gen || 0), 0);
  if (
    !(fuel > 0 && dryMass > 120 && batteryWh > 0) ||
    fuel > 1e7 ||
    dryMass > 1e7
  )
    throw Error(
      "Add matching fuel and a battery; dry mass must exceed 120 kg and masses stay below 10 million kg.",
    );
  const clean = {
    name: design.name.slice(0, 60),
    stack: design.stack.map((n) => ({ uid: n.uid, partId: n.partId })),
    radials: [],
    events: null,
  };
  let hash = 2166136261;
  for (const c of JSON.stringify(clean)) {
    hash ^= c.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return {
    id: "hangar",
    name: clean.name || "Hangar spacecraft",
    role: "Imported single-stage spacecraft",
    propellant,
    dryMass,
    fuel,
    thrust,
    isp: thrust / flow,
    minThrottle: Math.max(...engines.map((e) => e.minThrottle || 0)),
    power: { batteryWh, solarWatts },
    color: "#67e8f9",
    design: clean,
    designKey: (hash >>> 0).toString(16),
    notice:
      "Vacuum aggregate propulsion; common throttle with the strictest engine minimum. Manual rendezvous for engines with minimum throttle above 15%; fuel transfer only between matching propellants. Ideal attitude control, 100 W base/80 W throttle electrical load, and existing exploration drag/contact/thermal assumptions. Placement in orbit is not a simulated launch.",
  };
}
export function explorationStarter() {
  return {
    name: "Workshop single-stage",
    stack: [
      "probe_core",
      "solar_array",
      "battery_pack",
      "tank_k_37_s",
      "eng_kv",
    ].map((partId, i) => ({ uid: "workshop-" + i, partId })),
    radials: [],
    events: null,
  };
}
