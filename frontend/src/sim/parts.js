// Approximate public-class figures; labelled as approximations in the UI.
const P = (o) => o;

export const CATEGORIES = [
  { id: "command", label: "Command & Probe" },
  { id: "payload", label: "Payloads" },
  { id: "tank", label: "Fuel Tanks" },
  { id: "engine", label: "Engines" },
  { id: "booster", label: "Solid Boosters" },
  { id: "structure", label: "Structure" },
];

export const PROPELLANTS = {
  kerolox: { label: "Kerosene / Oxygen", short: "RP-1/LOX" },
  hydrolox: { label: "Hydrogen / Oxygen", short: "LH2/LOX" },
  solid: { label: "Solid (APCP)", short: "Solid" },
};

const list = [
  P({ id: "probe_core", name: "PC-1 Probe Core", category: "command", diameter: 1.8, height: 0.6, dryMass: 120, cost: 2.0, control: true, crew: 0, look: "probe", desc: "Flight computer, guidance and telemetry for uncrewed vehicles.", source: "Approx. small-avionics-bay class" }),
  P({ id: "capsule_1", name: "Solo Capsule (1 crew)", category: "command", diameter: 1.9, height: 2.4, dryMass: 1350, cost: 15, control: true, crew: 1, look: "capsule", desc: "Single-seat capsule. Crew systems are evaluated from Milestone 3.", source: "Approx. Mercury-class capsule (~1.35 t)" }),
  P({ id: "capsule_3", name: "Tri Capsule (3 crew)", category: "command", diameter: 3.7, height: 3.5, dryMass: 5800, cost: 60, control: true, crew: 3, look: "capsule", desc: "Three-seat capsule. Crew systems are evaluated from Milestone 3.", source: "Approx. Apollo CM-class capsule (~5.8 t)" }),
  P({ id: "sat_small", name: "Smallsat Bus 500 kg", category: "payload", diameter: 1.8, height: 1.2, dryMass: 500, cost: 8, control: true, payload: true, look: "satellite", desc: "Small satellite with its own avionics.", source: "Approx. ESPA-class smallsat" }),
  P({ id: "sat_medium", name: "Observation Bus 2.5 t", category: "payload", diameter: 3.0, height: 2.8, dryMass: 2500, cost: 40, control: true, payload: true, look: "satellite", desc: "Medium satellite bus with avionics.", source: "Approx. medium EO satellite class" }),
  P({ id: "tank_k_37_s", name: "Kerolox Tank 3.7 m — Short", category: "tank", diameter: 3.7, height: 6, dryMass: 2600, cost: 1.2, propellant: { type: "kerolox", mass: 40000 }, look: "tank_white", source: "Approx. aluminium-lithium stage tank, ~6.5% structure" }),
  P({ id: "tank_k_37_m", name: "Kerolox Tank 3.7 m — Medium", category: "tank", diameter: 3.7, height: 12, dryMass: 5400, cost: 2.2, propellant: { type: "kerolox", mass: 90000 }, look: "tank_white", source: "Approx. aluminium-lithium stage tank, ~6% structure" }),
  P({ id: "tank_k_37_l", name: "Kerolox Tank 3.7 m — Long", category: "tank", diameter: 3.7, height: 22, dryMass: 10000, cost: 4.0, propellant: { type: "kerolox", mass: 180000 }, look: "tank_white", source: "Approx. aluminium-lithium stage tank, ~5.5% structure" }),
  P({ id: "tank_k_18", name: "Kerolox Tank 1.8 m", category: "tank", diameter: 1.8, height: 4, dryMass: 650, cost: 0.5, propellant: { type: "kerolox", mass: 8000 }, look: "tank_white", source: "Approx. small upper-stage tank" }),
  P({ id: "tank_h_37", name: "Hydrolox Tank 3.7 m", category: "tank", diameter: 3.7, height: 14, dryMass: 3600, cost: 3.5, propellant: { type: "hydrolox", mass: 40000 }, look: "tank_orange", source: "Approx. insulated LH2/LOX tank (low density, heavier structure)" }),
  P({ id: "eng_k9", name: "K-9 Cluster (9× K-1)", category: "engine", diameter: 3.7, height: 2.8, dryMass: 4500, cost: 9.5, look: "cluster", engine: { propellant: "kerolox", thrustVac: 8226000, ispVac: 311, ispSL: 282, minThrottle: 0.4, gimbal: 5 }, source: "Approx. Merlin 1D ×9 class (public figures)" }),
  P({ id: "eng_k1", name: "K-1 Kerolox Engine", category: "engine", diameter: 1.8, height: 2.5, dryMass: 470, cost: 1.0, look: "engine", engine: { propellant: "kerolox", thrustVac: 914000, ispVac: 311, ispSL: 282, minThrottle: 0.4, gimbal: 5 }, source: "Approx. Merlin 1D class" }),
  P({ id: "eng_kv", name: "K-1V Vacuum Kerolox", category: "engine", diameter: 3.0, height: 4.0, dryMass: 490, cost: 1.3, look: "engine_vac", engine: { propellant: "kerolox", thrustVac: 981000, ispVac: 348, ispSL: 180, minThrottle: 0.39, gimbal: 5 }, source: "Approx. Merlin Vacuum class; large nozzle, poor at sea level" }),
  P({ id: "eng_h10", name: "H-10 Hydrolox Upper Engine", category: "engine", diameter: 1.8, height: 2.3, dryMass: 300, cost: 9.0, look: "engine_vac", engine: { propellant: "hydrolox", thrustVac: 110000, ispVac: 465, ispSL: 200, minThrottle: 0.3, gimbal: 4 }, source: "Approx. RL10 class" }),
  P({ id: "eng_hm", name: "H-1M Hydrolox Main Engine", category: "engine", diameter: 3.0, height: 3.4, dryMass: 3200, cost: 25, look: "engine", engine: { propellant: "hydrolox", thrustVac: 2280000, ispVac: 452, ispSL: 366, minThrottle: 0.67, gimbal: 8 }, source: "Approx. RS-25 class" }),
  P({ id: "srb_63", name: "SRB-63 Solid Booster", category: "booster", diameter: 1.6, height: 20, dryMass: 5150, cost: 6.0, look: "srb", propellant: { type: "solid", mass: 44000 }, engine: { propellant: "solid", thrustVac: 1320000, ispVac: 279, ispSL: 245, solid: true, minThrottle: 1, gimbal: 0 }, radialOnly: true, desc: "Radial booster with built-in nose cone and radial decoupler. Cannot throttle or shut down.", source: "Approx. GEM-63 class (inert mass incl. radial decoupler)" }),
  P({ id: "decoupler_37", name: "Stage Decoupler 3.7 m", category: "structure", diameter: 3.7, height: 0.6, dryMass: 420, cost: 0.3, decoupler: true, look: "decoupler", desc: "Separates stages. Stays with the stage below.", source: "Approx. interstage ring" }),
  P({ id: "decoupler_18", name: "Stage Decoupler 1.8 m", category: "structure", diameter: 1.8, height: 0.35, dryMass: 120, cost: 0.15, decoupler: true, look: "decoupler", source: "Approx. small separation ring" }),
  P({ id: "adapter_37_18", name: "Adapter 3.7 → 1.8 m", category: "structure", diameter: 3.7, diameterTop: 1.8, height: 1.4, dryMass: 300, cost: 0.2, look: "adapter", source: "Approx. conical adapter" }),
  P({ id: "fairing_37", name: "Payload Fairing 3.7 m", category: "structure", diameter: 3.7, height: 4.5, dryMass: 1100, cost: 1.5, fairing: true, look: "fairing", desc: "Encloses the parts directly below it until the next tank or decoupler. Jettisoned above 100 km by auto-staging.", source: "Approx. composite fairing class" }),
];

export const PARTS = Object.fromEntries(list.map((p) => [p.id, p]));
export const PART_LIST = list;

export function engineSL(eng) {
  return (eng.thrustVac * eng.ispSL) / eng.ispVac;
}
