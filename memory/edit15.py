def edit(p, pairs):
    s=open(p).read()
    for a,b in pairs:
        assert a in s, (p, a[:70])
        s=s.replace(a,b)
    open(p,'w').write(s)
F='/app/frontend/src/sim/'
edit(F+'systems.js',[
('''export function powerConfig(sim) {
  const c = { gen: 0, battery: 0, load: 0, rad: 0, ionW: 0, mass: 0 };
  for (const n of attachedNodes(sim)) {''','''export function powerConfig(sim) {
  return powerOfNodes(attachedNodes(sim), sim.sys.factors);
}

export function powerOfNodes(nodes, f = { gen: 1, battery: 1, rad: 1 }) {
  const c = { gen: 0, battery: 0, load: 0, rad: 0, ionW: 0, mass: 0 };
  for (const n of nodes) {'''),
('''  const f = sim.sys.factors;
  c.gen *= f.gen;''','''  c.gen *= f.gen;'''),
])
s=open(F+'systems.js').read()
s+='''
// Readiness: the top (payload) stage must power itself through eclipses and stay within thermal limits.
export function systemsChecks(sections, mission) {
  const c = powerOfNodes(sections[sections.length - 1].parts);
  const hours = mission.durationDays ? mission.durationDays * 24 : mission.timeScore.zero / 3600;
  const ecl = 0.38;
  const avg = c.gen * (1 - ecl);
  const battH = c.load > 0 ? c.battery / c.load : Infinity;
  const powerOk = c.gen > 0 ? avg >= c.load * 1.1 && battH * 0.8 >= 0.6 : battH * 0.8 >= hours;
  const tHot = ((c.load + 0.3 * SOLAR_CONST * 2) / (0.85 * SIGMA * Math.max(c.rad, 0.2))) ** 0.25;
  const tCold = (c.load / (0.85 * SIGMA * Math.max(c.rad, 0.2))) ** 0.25;
  const thermOk = tHot <= T_MAX + 15 && tCold >= T_MIN - 30;
  const mk = (id, subsystem, status, summary, formula, inputs, steps) => ({ id, subsystem, status, summary, calc: { formula, inputs, steps, assumptions: [SYSTEMS_SOURCE] } });
  return [
    mk("power", "Electrical power", c.load === 0 ? "pass" : powerOk ? "pass" : "fail",
      c.load === 0 ? "No powered avionics on the top stage" : c.gen > 0 ? `Orbit-average ${Math.round(avg)} W vs ${Math.round(c.load)} W load; battery ${battH.toFixed(1)} h` : `Battery only: ${(battH * 0.8).toFixed(1)} h usable vs ${hours.toFixed(1)} h mission`,
      "P_avg = P_array × (1 − eclipse fraction);  t_batt = E_batt × 0.8 DoD / P_load",
      [{ name: "Array output (1 AU)", value: c.gen, unit: "W", source: "Part catalog" }, { name: "Battery", value: c.battery, unit: "Wh", source: "Part catalog" }, { name: "Load", value: c.load, unit: "W", source: "Avionics / crew systems" }, { name: "Eclipse fraction (LEO)", value: ecl, unit: "", source: "≈ 36 min of a 92 min orbit" }],
      [`P_avg = ${c.gen} × ${1 - ecl} = ${Math.round(avg)} W ${c.gen > 0 ? (avg >= c.load * 1.1 ? "≥" : "<") : ""} 1.1 × ${c.load} W`, `Usable battery = ${c.battery} × 0.8 / ${c.load} = ${(battH * 0.8).toFixed(2)} h`]),
    mk("thermal", "Thermal control", thermOk ? "pass" : "warn",
      `Equilibrium ${Math.round(tHot - 273.15)} °C in sun, ${Math.round(tCold - 273.15)} °C in eclipse (limits ${T_MIN - 273} to ${T_MAX - 273} °C)`,
      "T_eq = ((Q_int + αS·A_sun) / (εσA_rad))^¼",
      [{ name: "Radiator area", value: c.rad.toFixed(1), unit: "m²", source: "Built-in + radiator parts" }, { name: "Internal heat", value: c.load, unit: "W", source: "Avionics load" }, { name: "Absorbed sunlight", value: Math.round(0.3 * SOLAR_CONST * 2), unit: "W", source: "α 0.3 × 1361 W/m² × 2 m²" }],
      [`T_sun = ${Math.round(tHot)} K, T_eclipse = ${Math.round(tCold)} K`]),
  ];
}
'''
open(F+'systems.js','w').write(s)
edit(F+'readiness.js',[('''  checks.push(...crewChecks(design, mission, stats));''','''  checks.push(...crewChecks(design, mission, stats));
  checks.push(...systemsChecks(buildSections(design), mission));'''),
('''import { crewChecks } from "./crewReadiness";''','''import { crewChecks } from "./crewReadiness";
import { systemsChecks } from "./systems";''')])
print("ok")
