// Approximate public-class figures; labelled as approximations in the UI.
const P = (o) => o;

export const CATEGORIES = [
  { id: "command", label: "Command & Probe" },
  { id: "payload", label: "Payloads" },
  { id: "tank", label: "Fuel Tanks" },
  { id: "engine", label: "Engines" },
  { id: "booster", label: "Solid Boosters" },
  { id: "control", label: "Attitude Control" },
  { id: "recovery", label: "Crew & Recovery" },
  { id: "power", label: "Power & Thermal" },
  { id: "structure", label: "Structure" },
];

export const PROPELLANTS = {
  kerolox: { label: "Kerosene / Oxygen", short: "RP-1/LOX" },
  hydrolox: { label: "Hydrogen / Oxygen", short: "LH2/LOX" },
  solid: { label: "Solid (APCP)", short: "Solid" },
  monoprop: { label: "Hydrazine (RCS)", short: "N2H4" },
  hypergolic: { label: "MMH / N2O4 (storable)", short: "MMH/NTO" },
  methalox: { label: "Liquid methane / LOX", short: "CH4/LOX" },
};

const list = [
  P({ id: "probe_core", name: "PC-1 Probe Core", category: "command", diameter: 1.8, height: 0.6, dryMass: 120, cost: 2.0, control: true, crew: 0, attitude: { wheelTorque: 30, wheelMomentum: 200 }, look: "probe", desc: "Flight computer, guidance and telemetry for uncrewed vehicles.", source: "Approx. small-avionics-bay class" }),
  P({ id: "capsule_1", name: "Solo Capsule (1 crew)", category: "command", diameter: 1.9, height: 2.4, dryMass: 1350, cost: 15, control: true, crew: 1, attitude: { wheelTorque: 100, wheelMomentum: 600 }, lifeSupport: { o2: 4, water: 10, food: 6 }, look: "capsule", desc: "Single-seat capsule with ~3 days of built-in consumables. Needs a heat shield below and a parachute pack above to come home.", source: "Approx. Mercury-class capsule (~1.35 t)" }),
  P({ id: "capsule_3", name: "Tri Capsule (3 crew)", category: "command", diameter: 3.7, height: 3.5, dryMass: 5800, cost: 60, control: true, crew: 3, attitude: { wheelTorque: 300, wheelMomentum: 2000 }, lifeSupport: { o2: 10, water: 30, food: 18 }, look: "capsule", desc: "Three-seat capsule with ~3.5 days of built-in consumables (O2, water, food). Needs a heat shield below and a parachute pack above.", source: "Approx. Apollo CM-class capsule (~5.8 t)" }),
  P({ id: "sat_small", name: "Smallsat Bus 500 kg", category: "payload", diameter: 1.8, height: 1.2, dryMass: 500, cost: 8, control: true, payload: true, attitude: { wheelTorque: 5, wheelMomentum: 20 }, look: "satellite", desc: "Small satellite with its own avionics.", source: "Approx. ESPA-class smallsat" }),
  P({ id: "sat_medium", name: "Observation Bus 2.5 t", category: "payload", diameter: 3.0, height: 2.8, dryMass: 2500, cost: 40, control: true, payload: true, attitude: { wheelTorque: 20, wheelMomentum: 150 }, look: "satellite", desc: "Medium satellite bus with avionics.", source: "Approx. medium EO satellite class" }),
  P({ id: "sat_lunar", name: "Lunar Orbiter Bus 1.2 t", category: "payload", diameter: 2.5, height: 2.2, dryMass: 1200, cost: 30, control: true, payload: true, attitude: { wheelTorque: 20, wheelMomentum: 150 }, look: "satellite", desc: "Mapping orbiter with avionics. Needs its own engine and storable propellant below it for lunar orbit insertion.", source: "Approx. LRO-class bus without propellant" }),
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
  P({ id: "rw_4", name: "RW-4 Reaction Wheel Assembly", category: "control", diameter: 1.8, height: 0.5, dryMass: 120, cost: 1.5, attitude: { wheelTorque: 400, wheelMomentum: 4000 }, look: "wheel", desc: "Electric momentum wheels: smooth torque, no propellant, but they saturate under steady disturbance torques.", source: "Approx. large spacecraft RWA cluster" }),
  P({ id: "rcs_ring", name: "RCS Thruster Ring (8× 445 N)", category: "control", diameter: 3.7, height: 0.4, dryMass: 160, cost: 1.2, attitude: { rcsThrust: 890 }, look: "rcs", desc: "Hydrazine thrusters fired in couples. Torque = 890 N × 0.9 × vehicle length. Needs monopropellant on board.", source: "Approx. MR-106 class thrusters" }),
  P({ id: "tank_mono", name: "Monopropellant Tank 3.7 m", category: "control", diameter: 3.7, height: 0.8, dryMass: 90, cost: 0.4, propellant: { type: "monoprop", mass: 600 }, look: "tank_mono", desc: "Hydrazine for RCS (Isp 220 s). Shared by all RCS on the attached vehicle.", source: "Approx. titanium diaphragm tank" }),
  P({ id: "tank_hyp_37", name: "Storable Propellant Tank 3.7 m", category: "tank", diameter: 3.7, height: 1.8, dryMass: 420, cost: 1.5, propellant: { type: "hypergolic", mass: 5000 }, look: "tank_mono", desc: "MMH/N2O4 — no boil-off, ideal for service modules and orbit insertion.", source: "Approx. titanium storable-propellant tank set" }),
  P({ id: "tank_hyp_18", name: "Storable Propellant Tank 1.8 m", category: "tank", diameter: 1.8, height: 1.2, dryMass: 110, cost: 0.6, propellant: { type: "hypergolic", mass: 1200 }, look: "tank_mono", desc: "Small MMH/N2O4 tank for probes and service modules.", source: "Approx. titanium storable-propellant tank" }),
  P({ id: "eng_oms", name: "S-27 Storable Engine", category: "engine", diameter: 1.8, height: 1.9, dryMass: 120, cost: 3.0, look: "engine_vac", engine: { propellant: "hypergolic", thrustVac: 26700, ispVac: 316, ispSL: 160, minThrottle: 1, gimbal: 6 }, desc: "Pressure-fed service-module engine. Not throttleable; restartable.", source: "Approx. AJ10-190 (OMS / ESM main engine) class" }),
  P({ id: "heat_shield_37", name: "Ablative Heat Shield 3.7 m", category: "recovery", diameter: 3.7, height: 0.35, dryMass: 850, cost: 6, heatShield: { maxFlux: 7e6, capacity: 4e8, noseRadius: 4.6 }, look: "heatshield", desc: "Goes directly below a capsule. Limits: peak heat flux 7 MW/m², total heat load 40 kJ/cm². Gives the capsule a lift-to-drag ratio of ~0.3.", source: "Approx. Apollo/Orion Avcoat-class shield; Sutton-Graves stagnation heating" }),
  P({ id: "chute_pack", name: "Parachute System (2 drogues + 3 mains)", category: "recovery", diameter: 1.4, height: 0.7, dryMass: 250, cost: 2.5, parachute: { drogueCdA: 22, mainCdA: 1200, drogueMaxQ: 10000, mainMaxSpeed: 100, drogueAlt: 7300, mainAlt: 3000 }, look: "chute", desc: "Goes on top of the capsule. Drogues open below 7.3 km if dynamic pressure ≤ 10 kPa, mains below 3 km if slower than 100 m/s.", source: "Approx. Apollo ELS (5 m drogues, 25 m mains)" }),
  P({ id: "ls_pallet", name: "Crew Consumables Pallet", category: "recovery", diameter: 3.7, height: 0.9, dryMass: 560, cost: 3, lifeSupport: { o2: 40, water: 140, food: 90 }, look: "pallet", desc: "O2, water and food for longer missions (≈ 16 days for 3 crew). Mass includes full consumables.", source: "Rates: NASA BVAD (O2 0.84, water 2.5, food 1.8 kg per crew-day, no recycling)" }),
  P({ id: "solar_array", name: "Solar Array Wings 4 kW", category: "power", diameter: 2.5, height: 0.6, dryMass: 220, cost: 4, systems: { gen: 4000 }, look: "solar", desc: "Deployable arrays: 4 kW at 1 AU in sunlight, nothing in eclipse. Output scales with 1/r² from the Sun.", source: "Approx. 30% GaAs cells, ~18 W/kg wing" }),
  P({ id: "battery_pack", name: "Li-ion Battery 6 kWh", category: "power", diameter: 1.8, height: 0.4, dryMass: 45, cost: 0.8, systems: { battery: 6000 }, look: "pallet", desc: "Carries the vehicle through eclipses (~36 min per LEO orbit).", source: "Approx. 150 Wh/kg space Li-ion" }),
  P({ id: "radiator_panel", name: "Radiator Panels 6 m²", category: "power", diameter: 2.5, height: 0.5, dryMass: 70, cost: 1.2, systems: { rad: 6 }, look: "pallet", desc: "Rejects heat: εσAT⁴ with ε = 0.85 (~2.1 kW at 20 °C).", source: "Approx. body-mounted loop radiator" }),
  P({ id: "tank_m_37", name: "Methalox Tank 3.7 m", category: "tank", diameter: 3.7, height: 14, dryMass: 9500, cost: 3.5, propellant: { type: "methalox", mass: 160000 }, look: "tank_white", desc: "CH4/LOX — lower density than kerosene, cleaner and reusable-friendly.", source: "Approx. stainless methalox tank set" }),
  P({ id: "eng_m2", name: "M-2 Methalox Engine (full-flow)", category: "engine", diameter: 1.8, height: 3.1, dryMass: 1600, cost: 9, look: "engine_sl", engine: { propellant: "methalox", thrustVac: 2450000, ispVac: 363, ispSL: 327, minThrottle: 0.4, gimbal: 15 }, desc: "High-pressure full-flow staged combustion.", source: "Approx. Raptor 2 class" }),
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
