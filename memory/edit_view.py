p='/app/frontend/src/three/FlightView.jsx'
s=open(p).read()
def R(a,b):
    global s
    assert a in s, a[:80]
    s=s.replace(a,b)
R('''import { predictPath, nodePrediction } from "../sim/maneuver";''','''import { predictPath, nodePrediction } from "../sim/maneuver";
import { moonState, MOON } from "../sim/bodies";''')
R('''    controls.maxDistance = 5e7;
    const pu = simRef.current.padUnit;
    const pe = [-pu[1], pu[0], 0];
    const sunDir = toThree([pu[0] + 0.7 * pe[0] - 0.2, pu[1] + 0.7 * pe[1], pu[2] - 0.25]).normalize();''','''    controls.maxDistance = 2e9;
    const sunDir = new THREE.Vector3();''')
R('''    const atmo = atmosphereShell();
    earthCenter.add(atmo);''','''    const atmo = atmosphereShell();
    earthCenter.add(atmo);
    const moonCenter = new THREE.Group();
    scene.add(moonCenter);
    const moonTex = loader.load("/textures/moon_1024.jpg");
    moonTex.colorSpace = THREE.SRGBColorSpace;
    const moonMesh = new THREE.Mesh(new THREE.SphereGeometry(MOON.radius, q.seg, q.seg / 2), new THREE.MeshStandardMaterial({ map: moonTex, roughness: 1, metalness: 0 }));
    moonCenter.add(moonMesh);
    moonCenter.visible = !!simRef.current.eph;''')
R('''    let lastMode = null;''','''    let lastMode = null;
    let lastBody = "earth";
    const frameOf = (body) => (body === "moon" ? moonCenter : earthCenter);''')
R('''      earthCenter.position.copy(rPos).multiplyScalar(-1);''','''      earthCenter.position.copy(rPos).multiplyScalar(-1);
      if (sim.eph) {
        moonCenter.visible = true;
        moonCenter.position.copy(toThree(moonState(sim.t, sim.eph).r)).sub(rPos);
        moonMesh.rotation.y = MOON.n * sim.t;
      }
      sunDir.copy(toThree(sim.sunDir)).normalize();''')
R('''      const alt = nav.alt;''','''      const alt = Math.hypot(...sim.r) - R;''')
R('''        orbitTimer = 0.25;
        const show = alt > 25000 || mode0() === "map";
        orbitLine.visible = show;
        apoM.visible = periM.visible = false;
        if (show) {
          const pred = predictPath(sim.r, sim.v, { points: 240 });
          setLine(orbitLine, pred.pts);''','''        orbitTimer = sim.eph ? 1 : 0.25;
        const show = alt > 25000 || mode0() === "map";
        orbitLine.visible = show;
        apoM.visible = periM.visible = false;
        if (show) {
          const pred = predictPath(sim.r, sim.v, { points: 240, ctx: sim.ctx() });
          const grp = frameOf(pred.body);
          grp.add(orbitLine, apoM, periM);
          setLine(orbitLine, pred.pts);''')
R('''            apoM.visible = pred.el.ra < 4e8;
            periM.visible = pred.el.rp > R;''','''            apoM.visible = pred.el.ra < (pred.body === "moon" ? MOON.soi : 4e8);
            periM.visible = pred.el.rp > (pred.body === "moon" ? MOON.radius : R);''')
R('''          const np = nodePrediction(sim, node);
          nodeM.position.copy(toThree(np.at.r));
          setLine(nodeLine, predictPath(np.at.r, np.v2, { points: 240 }).pts);''','''          const np = nodePrediction(sim, node);
          const ctx = { t0: node.t, eph: sim.eph };
          const pp = predictPath(np.at.r, np.v2, { points: 240, ctx });
          frameOf(np.body).add(nodeM);
          frameOf(pp.body).add(nodeLine);
          nodeM.position.copy(toThree(np.body === "moon" ? np.at.r.map((x, i) => x - moonState(node.t, sim.eph).r[i]) : np.at.r));
          setLine(nodeLine, pp.pts);''')
R('''      if (mode !== lastMode) {''','''      if (mode === "map" && nav.body !== lastBody) lastMode = null;
      lastBody = nav.body;
      const mapTarget = frameOf(nav.body);
      if (mode !== lastMode) {''')
R('''          controls.target.copy(earthCenter.position);
          camera.position.copy(earthCenter.position).addScaledVector(rPos.clone().normalize(), R * 3.2).add(new THREE.Vector3(0, R * 1.2, 0));
          mapPrev.copy(earthCenter.position);''','''          const el0 = nav.el;
          const D = nav.body === "moon" ? MOON.radius * 7 : el0.ra && el0.ra < 1e9 && el0.e < 1 ? Math.max(R * 3.2, el0.ra * 1.8) : R * 3.2;
          const off = toThree(nav.body === "moon" ? sim.prim.r : sim.r).normalize();
          controls.target.copy(mapTarget.position);
          camera.position.copy(mapTarget.position).addScaledVector(off, D).add(new THREE.Vector3(0, D * 0.38, 0));
          mapPrev.copy(mapTarget.position);''')
R('''        const delta = earthCenter.position.clone().sub(mapPrev);
        camera.position.add(delta);
        mapPrev.copy(earthCenter.position);
        controls.target.copy(earthCenter.position);''','''        const delta = mapTarget.position.clone().sub(mapPrev);
        camera.position.add(delta);
        mapPrev.copy(mapTarget.position);
        controls.target.copy(mapTarget.position);''')
R('''      earthTex.dispose();''','''      earthTex.dispose();
      moonTex.dispose();''')
open(p,'w').write(s)
print("ok")
