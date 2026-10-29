def edit(p, pairs):
    s=open(p).read()
    for a,b in pairs:
        assert a in s, (p, a[:70])
        s=s.replace(a,b)
    open(p,'w').write(s)
F='/app/frontend/src/'
edit(F+'sim/flight.js',[('''planetState, eclToEq, EARTH_SOI, MARS } from "./mars";''','''planetState, eclToEq, EARTH_SOI } from "./mars";''')])
edit(F+'sim/presets.js',[('''export const PRESETS = [''','''export function presetMarsOrbiter() {
  const stack = [n("fairing_37"), n("sat_lunar"), n("rcs_ring"), n("tank_mono"), n("tank_hyp_18"), n("tank_hyp_18"), n("eng_oms"), n("decoupler_37"), n("tank_h_37"), n("tank_h_37"), n("eng_hm"), n("decoupler_37"), n("tank_k_37_l"), n("tank_k_37_l"), n("tank_k_37_l"), n("tank_k_37_l"), n("tank_k_37_l"), n("eng_k9"), n("eng_k9")];
  return { name: "Ares Pathfinder (preset)", stack, radials: [{ uid: newUid(), parentUid: stack[12].uid, partId: "srb_63", symmetry: 4 }], events: null };
}

export const PRESETS = ['''),
('''  { id: "empty",''','''  { id: "mars_orbiter", label: "Ares Pathfinder — super-heavy, hydrolox escape stage, storable orbiter", make: presetMarsOrbiter },
  { id: "empty",''')])
edit(F+'sim/scoring.js',[
('''  } else if (mission.kind === "lunar_flyby") {''','''  } else if (mission.kind === "mars") {
    const T = mission.marsTarget;
    const inMars = !!sim.marsOrbitAt && sim.nav.body === "mars" && el.e < 1 && sim.status !== "crashed";
    const band = inMars && Math.abs(el.periapsis - T.periAlt) <= T.periTol && el.apoapsis <= T.apoMax;
    achieved = band;
    const arr = sim.mars && sim.mars.arrival;
    objectives = [
      { id: "tmi", label: mission.objectives[0], met: !!arr, detail: arr ? `Cruise ${arr.tof} days, corrections ${fmt(arr.tcm)} m/s, arrival v∞ ${fmt(arr.vinf)} m/s` : "Never left Earth" },
      { id: "mars", label: mission.objectives[1], met: band, detail: inMars ? `${km(el.apoapsis)} × ${km(el.periapsis)}` : "Not in Mars orbit" },
      { id: "safe", label: mission.objectives[2], met: !!arr && sim.status !== "crashed", detail: sim.status === "crashed" ? sim.endReason : "No impact" },
      { id: "budget", label: mission.objectives[3], met: stats.cost <= budget, detail: `$${fmt(stats.cost, 1)}M of $${fmt(budget, 1)}M` },
      { id: "payload", label: mission.objectives[4], met: has(mission.payload) && band, detail: has(mission.payload) ? (band ? "Orbiter delivered" : "On board, not in target orbit") : "Payload missing" },
    ];
  } else if (mission.kind === "lunar_flyby") {'''),
('''  const refDv = isLunar(mission) ?''','''  const refDv = isLunar(mission) || mission.kind === "mars" ?'''),
('''ts.basis === "lunar" ? sim.lunarOrbitAt || 0 : sim.t;''','''ts.basis === "lunar" ? sim.lunarOrbitAt || 0 : ts.basis === "mars" ? sim.marsOrbitAt || 0 : sim.t;'''),
('''    causeChain: isLunar(mission) ?''','''    causeChain: isLunar(mission) || mission.kind === "mars" ?'''),
('''    recommendations: isLunar(mission) ?''','''    recommendations: isLunar(mission) || mission.kind === "mars" ?'''),
])
print("ok")
