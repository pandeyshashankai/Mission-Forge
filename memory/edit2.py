p='/app/frontend/src/pages/Flight.jsx'
s=open(p).read()
a='''<OrbitPanel s={s} /><AttitudePanel s={s} sim={simRef.current} /></div>
          {s.crew > 0 && <div className="absolute left-3 top-[440px]"><CrewPanel s={s} sim={simRef.current} /></div>}'''
assert a in s
s=s.replace(a,'''<OrbitPanel s={s} />{s.crew > 0 && <CrewPanel s={s} sim={simRef.current} />}<AttitudePanel s={s} sim={simRef.current} /></div>''')
open(p,'w').write(s)
p='/app/frontend/src/components/game/FlightPanels.jsx'
s=open(p).read()
a='''disabled={body !== "earth" || sim.nav.el.apoapsis < 2e7} fn'''
assert a in s
s=s.replace(a,'''disabled={body !== "earth" || sim.nav.el.apoapsis < 2e7 || (sim.moonClosest && sim.moonClosest.d < 66e6)} fn''')
open(p,'w').write(s)
print("ok")
