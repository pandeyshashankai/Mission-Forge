def edit(p, pairs):
    s=open(p).read()
    for a,b in pairs:
        assert a in s, (p, a[:70])
        s=s.replace(a,b)
    open(p,'w').write(s)

F='/app/frontend/src/'
edit(F+'pages/Flight.jsx', [
('''  return rem > 3000 ? 1000 : rem > 400 ? 100 : rem > 45 ? 10 : 1;''','''  return rem > 30000 ? 20000 : rem > 600 ? 1000 : rem > 120 ? 100 : rem > 45 ? 10 : 1;'''),
('''    if (w > max) toast.message(`Warp limited to ×${max} while ${sim.nav.F > 0 ? "engines are firing" : "inside the atmosphere"}`);''','''    const why = sim.nav.F > 0 ? "engines are firing" : limited ? "inside the atmosphere" : max === maneuverWarpCap(sim) && max < coastWarpCap(sim) ? "approaching a maneuver node" : "in a low orbit (integrator step 0.1 s)";
    if (w > max) toast.message(`Warp limited to ×${max} while ${why}`);'''),
])
edit(F+'pages/MainMenu.jsx', [('''Phase 1 · Milestones 1–2 — First Orbit & orbital operations''','''Phase 1 · Milestones 1–3 — First Orbit, orbital operations & the Moon''')])
edit(F+'sim/maneuver.js', [('''export function burnTime(sim, dv) {
  const ts = thrustState(sim.rt, 1, 0);
  const mdot = ts.flows.reduce((a, f) => a + f.mdot, 0);
  if (!(ts.F > 0)) return null;
  const ve = ts.F / mdot;
  const m0 = runtimeMass(sim.rt);
  return (m0 * (1 - Math.exp(-dv / ve))) / mdot;
}''','''// Burn time from the rocket equation, continuing through later stages when the current one runs dry.
export function burnTime(sim, dv) {
  const rt = cloneRuntime(sim.rt);
  let left = dv, time = 0;
  for (let guard = 0; guard < 20 && left > 1e-6; guard++) {
    const ts = thrustState(rt, 1, 0);
    const mdot = ts.flows.reduce((a, f) => a + f.mdot, 0);
    if (ts.F > 0) {
      const ve = ts.F / mdot;
      const m0 = runtimeMass(rt);
      const fuel = Math.min(...ts.flows.map((f) => (f.src.kind === "section" ? rt.sections[f.src.s].tanks[f.src.prop] : rt.radials.find((r) => r.uid === f.src.uid).fuel) / f.mdot)) * mdot;
      const need = m0 * (1 - Math.exp(-left / ve));
      if (need <= fuel) return time + need / mdot;
      time += fuel / mdot;
      left -= ve * Math.log(m0 / (m0 - fuel));
      consume(rt, ts.flows, fuel / mdot);
    }
    const id = rt.events[rt.eventIndex];
    if (!id) return time > 0 ? time : null;
    applyEvent(rt, id);
    rt.eventIndex++;
  }
  return time;
}''')])
edit(F+'sim/maneuver.js', [('''import { thrustState, runtimeMass } from "./design";''','''import { thrustState, runtimeMass, cloneRuntime, consume, applyEvent } from "./design";''')])
edit(F+'sim/scoring.js', [('''      { id: "payload", label: mission.objectives[4], met: has(mission.payload) && band, detail: has(mission.payload) ? "Payload on board" : "Payload missing" },''','''      { id: "payload", label: mission.objectives[4], met: has(mission.payload) && band, detail: !has(mission.payload) ? "Payload missing" : band ? "Payload delivered to lunar orbit" : "Payload on board, but not in the target lunar orbit" },'''),
('''    if (mission.payload) objectives.push({ id: "payload", label: mission.objectives[4], met: has(mission.payload) && inOrbit, detail: has(mission.payload) ? "Payload on board" : "Payload missing" });''','''    if (mission.payload) objectives.push({ id: "payload", label: mission.objectives[4], met: has(mission.payload) && inOrbit, detail: !has(mission.payload) ? "Payload missing" : inOrbit ? "Payload on board in orbit" : "Payload on board, but no stable orbit" });''')])
edit(F+'sim/flight.js', [('''    applyEvent(this.rt, id);
    this.rt.eventIndex++;
    this.config = vehicleConfig(this);''','''    applyEvent(this.rt, id);
    this.rt.eventIndex++;
    const cap0 = this.config ? this.config.wheelMomentum : 0;
    this.config = vehicleConfig(this);
    // Momentum stored in jettisoned wheels leaves with them.
    if (cap0 > 0 && this.config.wheelMomentum < cap0) this.wheelH = scale(this.wheelH, this.config.wheelMomentum / cap0);''')])
edit(F+'three/FlightView.jsx', [('''      if (mode === "map" && nav.body !== lastBody) lastMode = null;
      lastBody = nav.body;''','''      const scaleKey = `${nav.body}|${nav.el.e < 1 && nav.el.ra > 1e8 ? "far" : "near"}`;
      if (mode === "map" && scaleKey !== lastBody) lastMode = null;
      lastBody = scaleKey;''')])
print("ok")
