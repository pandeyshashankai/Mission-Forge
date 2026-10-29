def edit(p, pairs):
    s=open(p).read()
    for a,b in pairs:
        assert a in s, (p, a[:70])
        s=s.replace(a,b)
    open(p,'w').write(s)
F='/app/frontend/src/'
edit(F+'pages/Flight.jsx', [
('''function coastWarpCap(sim) {
  return Math.min(20000, Math.max(1000, Math.round((1000 * sim.coastDt()) / 0.1)));
}''','''function coastWarpCap(sim) {
  const raw = Math.min(20000, Math.max(1000, (1000 * sim.coastDt()) / 0.1));
  return WARPS.filter((w) => w <= raw).pop();
}'''),
('''    const why = sim.nav.F > 0 ? "engines are firing" : limited ? "inside the atmosphere" : max === maneuverWarpCap(sim) && max < coastWarpCap(sim) ? "approaching a maneuver node" : "in a low orbit (integrator step 0.1 s)";''','''    const why = sim.nav.F > 0 ? "engines are firing" : limited ? "inside the atmosphere" : max === maneuverWarpCap(sim) && max < coastWarpCap(sim) ? "approaching a maneuver node" : `the integrator step is ${sim.coastDt().toFixed(2)} s this close to ${sim.nav.body === "moon" ? "the Moon" : "Earth"}`;'''),
('''s.status === "orbit" || s.status === "flight" ? (s.body === "moon"''','''s.status === "orbit" || s.status === "flight" ? (s.body === "earth" && s.orbitAt && s.alt < 160000 && s.vr < 0 ? (s.entry.chute === "drogue" || s.entry.chute === "main" ? "descent" : "entry") : s.body === "moon"'''),
])
edit(F+'sim/maneuver.js', [('''      if (need <= fuel) return time + need / mdot;
      time += fuel / mdot;
      left -= ve * Math.log(m0 / (m0 - fuel));''','''      // Crewed vehicles are throttled to 4 g, which stretches high-thrust burns.
      const capped = (dvPart, tPart) => (sim.aero && sim.aero.crew ? Math.max(tPart, dvPart / (4 * G0)) : tPart);
      if (need <= fuel) return time + capped(left, need / mdot);
      const dvStage = ve * Math.log(m0 / (m0 - fuel));
      time += capped(dvStage, fuel / mdot);
      left -= dvStage;''')])
edit(F+'components/game/FlightPanels.jsx', [('''disabled={body !== "moon"} fn={() => planLOI(sim)}''','''disabled={body !== "moon" || !!sim.lunarOrbitAt} fn={() => planLOI(sim)}''')])
edit(F+'components/game/CrewPanel.jsx', [('''<span className="text-slate-500">Load now / peak</span><span className="text-right text-sky-300" data-testid="entry-g">{fmt(e.g, 1)} / {fmt(e.maxG, 1)} g</span>''','''<span className="text-slate-500">Load now / mission pk</span><span className="text-right text-sky-300" data-testid="entry-g">{fmt(e.g, 1)} / {fmt(e.maxG, 1)} g</span>
        <span className="text-slate-500">Entry peak</span><span className="text-right text-sky-300" data-testid="entry-g-peak">{e.ei ? `${fmt(e.maxGEntry || 0, 1)} g` : "—"}</span>''')])
edit(F+'sim/entry.js', [('''  e.maxG = Math.max(e.maxG, sensedG);''','''  e.maxG = Math.max(e.maxG, sensedG);
  if (e.ei) e.maxGEntry = Math.max(e.maxGEntry || 0, sensedG);''')])
edit(F+'components/game/FlightHud.jsx', [('''    <Row label="Time to apo" value={mmss(s.tApo)} testId="telemetry-time-to-apo-value" />
    <Row label="Period" value={mmss(s.period)} testId="telemetry-period-value" />''','''    <Row label="Time to apo" value={s.status === "splashdown" || s.status === "crashed" ? "—" : mmss(s.tApo)} testId="telemetry-time-to-apo-value" />
    <Row label="Period" value={s.status === "splashdown" || s.status === "crashed" ? "—" : mmss(s.period)} testId="telemetry-period-value" />''')])
print("ok")
