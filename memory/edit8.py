def edit(p, pairs):
    s=open(p).read()
    for a,b in pairs:
        assert a in s, (p, a[:70])
        s=s.replace(a,b)
    open(p,'w').write(s)
F='/app/frontend/src/'
edit(F+'sim/parts.js',[
('''  { id: "recovery", label: "Crew & Recovery" },''','''  { id: "recovery", label: "Crew & Recovery" },
  { id: "power", label: "Power & Thermal" },'''),
('''  hypergolic: { label: "MMH / N2O4 (storable)", short: "MMH/NTO" },''','''  hypergolic: { label: "MMH / N2O4 (storable)", short: "MMH/NTO" },
  methalox: { label: "Liquid methane / LOX", short: "CH4/LOX" },
  xenon: { label: "Xenon (electric propulsion)", short: "Xe" },'''),
('''  P({ id: "decoupler_37",''','''  P({ id: "solar_array", name: "Solar Array Wings 4 kW", category: "power", diameter: 2.5, height: 0.6, dryMass: 220, cost: 4, systems: { gen: 4000 }, look: "solar", desc: "Deployable arrays: 4 kW at 1 AU in sunlight, nothing in eclipse. Output scales with 1/r² from the Sun.", source: "Approx. 30% GaAs cells, ~18 W/kg wing" }),
  P({ id: "battery_pack", name: "Li-ion Battery 6 kWh", category: "power", diameter: 1.8, height: 0.4, dryMass: 45, cost: 0.8, systems: { battery: 6000 }, look: "pallet", desc: "Carries the vehicle through eclipses (~36 min per LEO orbit).", source: "Approx. 150 Wh/kg space Li-ion" }),
  P({ id: "radiator_panel", name: "Radiator Panels 6 m²", category: "power", diameter: 2.5, height: 0.5, dryMass: 70, cost: 1.2, systems: { rad: 6 }, look: "pallet", desc: "Rejects heat: εσAT⁴ with ε = 0.85 (~2.1 kW at 20 °C).", source: "Approx. body-mounted loop radiator" }),
  P({ id: "tank_m_37", name: "Methalox Tank 3.7 m", category: "tank", diameter: 3.7, height: 14, dryMass: 9500, cost: 3.5, propellant: { type: "methalox", mass: 160000 }, look: "tank_white", desc: "CH4/LOX — lower density than kerosene, cleaner and reusable-friendly.", source: "Approx. stainless methalox tank set" }),
  P({ id: "eng_m2", name: "M-2 Methalox Engine (full-flow)", category: "engine", diameter: 1.8, height: 3.1, dryMass: 1600, cost: 9, look: "engine_sl", engine: { propellant: "methalox", thrustVac: 2450000, ispVac: 363, ispSL: 327, minThrottle: 0.4, gimbal: 15 }, desc: "High-pressure full-flow staged combustion.", source: "Approx. Raptor 2 class" }),
  P({ id: "tank_xe", name: "Xenon Tank 450 kg", category: "tank", diameter: 1.8, height: 0.9, dryMass: 45, cost: 1.5, propellant: { type: "xenon", mass: 450 }, look: "tank_mono", desc: "High-pressure composite xenon tank for ion engines.", source: "Approx. Dawn xenon tank" }),
  P({ id: "eng_ion", name: "Ion Thruster Pair (gridded, 2 × 0.09 N)", category: "engine", diameter: 1.8, height: 0.6, dryMass: 60, cost: 6, look: "engine_vac", engine: { propellant: "xenon", thrustVac: 0.18, ispVac: 3100, ispSL: 1, minThrottle: 1, gimbal: 0, powerW: 4600 }, desc: "Very high efficiency, tiny thrust. Draws 4.6 kW while firing — no power, no thrust.", source: "Approx. NSTAR / NEXT gridded ion thrusters" }),
  P({ id: "decoupler_37",''')])
edit(F+'three/partMeshes.js',[('''    case "heatshield":''','''    case "solar": {
      g.add(cyl(r * 0.6, r * 0.6, h, M.gray()));
      const wing = new THREE.Mesh(new THREE.BoxGeometry(r * 7, h * 0.7, 0.05), new THREE.MeshStandardMaterial({ color: "#1e3a8a", metalness: 0.4, roughness: 0.4 }));
      wing.position.y = h / 2;
      g.add(wing);
      break;
    }
    case "heatshield":''')])
edit(F+'sim/presets.js',[('''n("decoupler_37"), n("ls_pallet"), n("rcs_ring"),''','''n("decoupler_37"), n("ls_pallet"), n("solar_array"), n("rcs_ring"),''')])
print("ok")
