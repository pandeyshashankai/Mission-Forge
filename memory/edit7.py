def edit(p, pairs):
    s=open(p).read()
    for a,b in pairs:
        assert a in s, (p, a[:70])
        s=s.replace(a,b,1) if s.count(a)==1 else s.replace(a,b)
    open(p,'w').write(s)
F='/app/frontend/src/sim/'
edit(F+'systems.js',[('''      if (f.id === "wheel") applyFaultFactors(sim);''','''      if (f.id === "wheel") {
        sim.config.wheelTorque *= 0.5;
        sim.config.wheelMomentum *= 0.5;
      }''')])
edit(F+'flight.js',[
('''import { aeroConfig, newEntryState''','''import { newSystems, systemsStep, applyFaultFactors } from "./systems";
import { aeroConfig, newEntryState'''),
('''  constructor({ design, mission, profile, guidanceOn = true }) {''','''  constructor({ design, mission, profile, guidanceOn = true, difficulty = "amateur" }) {
    this.sys = newSystems(mission.id, difficulty);'''),
('''    this.config = vehicleConfig(this);''','''    this.config = vehicleConfig(this);
    applyFaultFactors(this);
    this.pcfg = null;'''),
('''  controlAttitude(dt, F, m, vRel, q, area) {''','''  controlAttitude(dt, F, m, vRel, q, area) {
    if (this.sys.powerOut) return attitudeStep(this, dt, { F, m, vRel, q, area, target: null, powerOut: true });'''),
('''    const ts = this.status === "prelaunch" ? { F: 0, flows: [] } : thrustState(this.rt, this.throttle, nav.pRatio);''','''    const ts = this.status === "prelaunch" ? { F: 0, flows: [] } : thrustState(this.rt, this.sys.powerOut ? 0 : this.throttle, nav.pRatio);
    systemsStep(this, dt, this.ionFiring(ts));'''),
('''    lifeSupportStep(this, dt);
    this.trackMoon();
  }''','''    lifeSupportStep(this, dt);
    systemsStep(this, dt, 0);
    this.trackMoon();
  }

  ionFiring(ts) {
    return ts.F > 0 && this.pcfg && this.pcfg.ionW > 0 ? this.throttle : 0;
  }'''),
('''      region: this.region,''','''      sys: this.sys, region: this.region,'''),
])
print("ok")
