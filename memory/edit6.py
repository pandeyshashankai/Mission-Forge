def edit(p, pairs):
    s=open(p).read()
    for a,b in pairs:
        assert a in s, (p, a[:70])
        s=s.replace(a,b)
    open(p,'w').write(s)
F='/app/frontend/src/'
s=open(F+'sim/maneuver.js').read()
i=s.index('// Burn time from the rocket equation'); j=s.index('// Vis-viva helpers')
s=s[:i]+'''// Burn time by stepping the burn (0.5 s) through later stages; crewed vehicles are throttled to 4 g.
export function burnTime(sim, dv) {
  const rt = cloneRuntime(sim.rt);
  const crew = sim.aero && sim.aero.crew;
  let left = dv, time = 0;
  for (let guard = 0; guard < 40000 && left > 1e-6; guard++) {
    const full = thrustState(rt, 1, 0);
    if (!(full.F > 0)) {
      const id = rt.events[rt.eventIndex];
      if (!id) return time > 0 ? time : null;
      applyEvent(rt, id);
      rt.eventIndex++;
      continue;
    }
    const m = runtimeMass(rt);
    const ts = crew ? thrustState(rt, Math.min(1, (4 * G0 * m) / full.F), 0) : full;
    const a = ts.F / m;
    const h = Math.min(0.5, left / a);
    consume(rt, ts.flows, h);
    left -= a * h;
    time += h;
  }
  return time;
}

'''+s[j:]
open(F+'sim/maneuver.js','w').write(s)
edit(F+'pages/Flight.jsx', [('''s.body === "earth" && s.orbitAt && s.alt < 160000 && s.vr < 0 ?''','''s.body === "earth" && s.orbitAt && s.alt < 160000 && (s.vr < 0 || s.entry.ei) ?''')])
edit(F+'components/game/FlightHud.jsx', [('''{s.nodeDrift !== null && s.status === "orbit" && s.apo < 1e8 &&''','''{s.nodeDrift !== null && s.status === "orbit" && s.apo < 1e8 && s.peri > 140000 &&''')])
edit(F+'components/game/CrewPanel.jsx', [('''Load now / mission pk</span>''','''g now / peak</span>''')])
edit(F+'sim/flight.js', [('''    if (this.status === "orbit" && this.t - this.lastAutoCkpt > 86400) {''','''    if (this.status === "orbit" && !this.eph && this.t - this.lastAutoCkpt > 86400) {''')])
print("ok")
