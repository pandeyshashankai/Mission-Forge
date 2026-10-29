def edit(p, pairs):
    s=open(p).read()
    for a,b in pairs:
        assert a in s, (p, a[:70])
        s=s.replace(a,b)
    open(p,'w').write(s)
F='/app/frontend/src/sim/'
edit(F+'mars.js',[('''export { propagate, nodeFrame, nodeDvEci };''','''let bestDayCache = null;
export function bestDepartureDay() {
  if (bestDayCache === null) bestDayCache = launchWindowChart(240, 460, 4).reduce((a, b) => (b.vinf < a.vinf ? b : a)).day;
  return bestDayCache;
}

// Mars orbit insertion at periapsis into a capture ellipse (default apoapsis 33,000 km).
export function planMOI(sim, apoAlt = 33000e3) {
  const el = sim.nav.el;
  if (sim.nav.body !== "mars" || !(el.timeToPeri > 60)) return null;
  const t = sim.t + el.timeToPeri;
  const at = stateAt(sim.r, sim.v, el.timeToPeri, 5, sim.ctx());
  const rp = len(at.r), ra = MARS.radius + apoAlt;
  return { t, dv: [Math.sqrt(MARS.mu * (2 / rp - 2 / (rp + ra))) - len(at.v), 0, 0] };
}

export { propagate, nodeFrame, nodeDvEci };''')])
edit(F+'flight.js',[
('''import { newSystems, systemsStep, applyFaultFactors } from "./systems";''','''import { newSystems, systemsStep, applyFaultFactors } from "./systems";
import { startCruise, bestDepartureDay, dayOf, planetState, eclToEq, EARTH_SOI, MARS } from "./mars";'''),
('''    this.sys = newSystems(mission.id, difficulty);''','''    this.sys = newSystems(mission.id, difficulty);
    this.mars = mission.kind === "mars" ? { depDay: profile.marsDepartDay ?? bestDepartureDay(), periAlt: mission.marsTarget.periAlt, inc: 0, arrival: null } : null;
    this.marsOrbitAt = null;
    this.sunAU = 1;'''),
('''  get sunDir() {
    return sunDirAt(this.t, this.sunLon0);
  }''','''  get sunDir() {
    if (!this.mars) return sunDirAt(this.t, this.sunLon0);
    return norm(eclToEq(scale(planetState(this.eph && this.eph.central ? "mars" : "earth", dayOf(this)).r, -1)));
  }

  earthVector() {
    if (!(this.eph && this.eph.central)) return scale(this.r, -1);
    const d = dayOf(this);
    return sub(eclToEq(sub(planetState("earth", d).r, planetState("mars", d).r)), this.r);
  }

  inAtmo() {
    return !(this.eph && this.eph.central) && len(this.r) - EARTH.radius < ATMOS_TOP;
  }

  spendDeltaV(dv) {
    const ts = thrustState(this.rt, 1, 0);
    if (!(ts.F > 0)) return false;
    const mdot = ts.flows.reduce((a, f) => a + f.mdot, 0);
    const need = runtimeMass(this.rt) * (1 - Math.exp(-dv / (ts.F / mdot)));
    if (this.remainingDeltaV() < dv) return false;
    consume(this.rt, ts.flows, need / mdot);
    return true;
  }

  lifeAndSystemsCruise(T) {
    lifeSupportStep(this, T);
  }'''),
('''  trackMoon() {
    if (!this.eph) return;''','''  trackMoon() {
    if (!this.eph || this.eph.central) return;'''),
('''    const alt = len(r) - EARTH.radius;
    if (alt >= ATMOS_TOP) return [0, 0, 0];''','''    const alt = len(r) - EARTH.radius;
    if (alt >= ATMOS_TOP || (this.eph && this.eph.central)) return [0, 0, 0];'''),
('''    if (nav.alt < 0) {
      if (nav.body === "moon") this.end("crashed", `Vehicle impacted the lunar surface at ${nav.surfSpeed.toFixed(0)} m/s`);''','''    if (this.mars && !this.mars.arrival && nav.body === "earth" && len(this.r) > EARTH_SOI) {
      startCruise(this);
      this.nav = this.computeNav();
      return;
    }
    if (nav.body === "mars" && !this.marsOrbitAt && nav.F === 0 && nav.el.e < 1 && nav.el.periapsis > 100000) {
      this.marsOrbitAt = this.t;
      this.requestCheckpoint("Mars orbit");
      this.addLog("success", `Mars orbit achieved — ${(nav.el.apoapsis / 1000).toFixed(0)} × ${(nav.el.periapsis / 1000).toFixed(0)} km`);
    }
    if (nav.alt < 0) {
      if (nav.body === "mars") this.end("crashed", `Vehicle impacted Mars at ${nav.surfSpeed.toFixed(0)} m/s`);
      else if (nav.body === "moon") this.end("crashed", `Vehicle impacted the lunar surface at ${nav.surfSpeed.toFixed(0)} m/s`);'''),
('''eph: this.eph ? { raan: this.eph.raan, argp: this.eph.argp, M0: this.eph.M0 } : null,''','''eph: this.eph ? (this.eph.central ? { central: this.eph.central } : { raan: this.eph.raan, argp: this.eph.argp, M0: this.eph.M0 }) : null, mars: this.mars, marsOrbitAt: this.marsOrbitAt, sunAU: this.sunAU,'''),
])
s=open(F+'flight.js').read()
n=s.count('len(this.r) - EARTH.radius >= ATMOS_TOP')
s=s.replace('len(this.r) - EARTH.radius >= ATMOS_TOP','!this.inAtmo()')
open(F+'flight.js','w').write(s)
print("ok", n)
