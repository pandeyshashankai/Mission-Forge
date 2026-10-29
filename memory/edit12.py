def edit(p, pairs):
    s=open(p).read()
    for a,b in pairs:
        assert a in s, (p, a[:70])
        s=s.replace(a,b)
    open(p,'w').write(s)
F='/app/frontend/src/'
edit(F+'components/game/FlightPanels.jsx',[
('''import { planTLI, planMCC, planLOI, planCorridor } from "../../sim/transfer";''','''import { planTLI, planMCC, planLOI, planCorridor } from "../../sim/transfer";
import { planTMI, planMOI } from "../../sim/mars";'''),
('''  const flyby = mission.kind === "lunar_flyby";
  const periAlt = flyby ? mission.flyby.periAlt : mission.lunar.altitude;''','''  const flyby = mission.kind === "lunar_flyby";
  const mars = mission.kind === "mars";
  const periAlt = flyby ? mission.flyby.periAlt : mars ? 0 : mission.lunar.altitude;'''),
('''  return (
    <div className="mt-1 grid grid-cols-2 gap-1" data-testid="lunar-planner">''','''  if (mars)
    return (
      <div className="mt-1 grid grid-cols-2 gap-1" data-testid="mars-planner">
        {B({ id: "node-tmi-btn", label: "Trans-Mars injection", disabled: body !== "earth" || !(sim.nav.el.apoapsis < 2e6), fn: () => planTMI(sim).node })}
        {B({ id: "node-moi-btn", label: "Mars orbit insertion", disabled: body !== "mars" || !!sim.marsOrbitAt, fn: () => planMOI(sim) })}
      </div>
    );
  return (
    <div className="mt-1 grid grid-cols-2 gap-1" data-testid="lunar-planner">'''),
('''  const lunar = mission && mission.kind && mission.kind.startsWith("lunar");''','''  const lunar = mission && mission.kind && (mission.kind.startsWith("lunar") || mission.kind === "mars");'''),
])
edit(F+'pages/Flight.jsx',[
('''import { CrewPanel } from "../components/game/CrewPanel";''','''import { CrewPanel } from "../components/game/CrewPanel";
import { SystemsPanel, AlarmPanel } from "../components/game/SystemsPanel";'''),
('''    body: n.body, moonDist: sim.eph ?''','''    sys: { ...sim.sys, alarms: sim.sys.alarms.map((a) => ({ ...a })) }, marsOrbitAt: sim.marsOrbitAt, cruise: sim.mars && sim.mars.arrival,
    body: n.body, moonDist: sim.eph && !sim.eph.central ?'''),
('''<OrbitPanel s={s} />{s.crew > 0 && <CrewPanel s={s} sim={simRef.current} />}''','''<OrbitPanel s={s} /><SystemsPanel s={s} sim={simRef.current} />{s.crew > 0 && <CrewPanel s={s} sim={simRef.current} />}'''),
('''          <div className="absolute bottom-3 left-3"><EventLog log={s.log} /></div>''','''          <div className="absolute bottom-3 left-3"><EventLog log={s.log} /></div>
          <div className="absolute left-1/2 top-16 -translate-x-1/2"><AlarmPanel s={s} sim={simRef.current} onChange={() => setSnap(snapshot(simRef.current, warpRef.current))} /></div>'''),
('''s.body === "moon" ? (s.lunarOrbitAt ? "lunar orbit" : "lunar SOI")''','''s.body === "mars" ? (s.marsOrbitAt ? "mars orbit" : "mars SOI") : s.body === "moon" ? (s.lunarOrbitAt ? "lunar orbit" : "lunar SOI")'''),
('''(mission.kind === "lunar_orbit" && s.lunarOrbitAt && s.body === "moon")) && !crashed && (''','''(mission.kind === "lunar_orbit" && s.lunarOrbitAt && s.body === "moon") || (mission.kind === "mars" && s.marsOrbitAt && s.body === "mars")) && !crashed && ('''),
('''<CheckCircle2 size={18} /> {s.body === "moon" ? "Lunar orbit" : "Stable orbit"}</div>''','''<CheckCircle2 size={18} /> {s.body === "moon" ? "Lunar orbit" : s.body === "mars" ? "Mars orbit" : "Stable orbit"}</div>'''),
])
edit(F+'components/game/FlightHud.jsx',[('''<Row label="Region" value={s.body === "moon" ? "Moon SOI" : "Earth"}''','''<Row label="Region" value={s.body === "moon" ? "Moon SOI" : s.body === "mars" ? "Mars SOI" : "Earth"}'''),
('''<Row label={s.body === "moon" ? "Aposelene" : "Apoapsis"}''','''<Row label={s.body === "moon" ? "Aposelene" : s.body === "mars" ? "Apoareion" : "Apoapsis"}'''),
('''<Row label={s.body === "moon" ? "Periselene" : "Periapsis"}''','''<Row label={s.body === "moon" ? "Periselene" : s.body === "mars" ? "Periareion" : "Periapsis"}''')])
edit(F+'three/FlightView.jsx',[
('''    moonCenter.visible = !!simRef.current.eph;''','''    moonCenter.visible = !!simRef.current.eph;
    const marsCenter = new THREE.Group();
    scene.add(marsCenter);
    const marsMesh = new THREE.Mesh(new THREE.SphereGeometry(3389500, q.seg, q.seg / 2), new THREE.MeshStandardMaterial({ map: moonTex, color: "#e0764a", roughness: 1 }));
    marsCenter.add(marsMesh);
    marsCenter.visible = false;
    let fpsAcc = 0, fpsN = 0, px = Math.min(window.devicePixelRatio, q.px);'''),
('''    const frameOf = (body) => (body === "moon" ? moonCenter : earthCenter);''','''    const frameOf = (body) => (body === "moon" ? moonCenter : body === "mars" ? marsCenter : earthCenter);'''),
('''      if (sim.eph) {
        moonCenter.visible = true;''','''      const atMars = !!(sim.eph && sim.eph.central);
      earthCenter.visible = !atMars;
      marsCenter.visible = atMars;
      if (atMars) {
        moonCenter.visible = false;
        marsCenter.position.copy(rPos).multiplyScalar(-1);
      } else if (sim.eph) {
        moonCenter.visible = true;'''),
])
print("ok")
