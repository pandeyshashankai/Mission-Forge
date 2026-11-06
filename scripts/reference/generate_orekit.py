"""Generate pinned external-tool fixtures. Requires JPype1 1.7.1 and Java 21+.
The browser game has no Java, Python, hosted service, or network dependency.
"""
from pathlib import Path
import hashlib,json,math,urllib.request
import jpype
ROOT=Path(__file__).resolve().parents[2]
dependencies=json.loads((Path(__file__).parent/'orekit-dependencies.json').read_text())
cache=Path('/tmp/mission-forge-orekit');cache.mkdir(exist_ok=True)
for artifact in dependencies:
    path=cache/artifact['url'].rsplit('/',1)[1]
    if not path.exists():path.write_bytes(urllib.request.urlopen(artifact['url'],timeout=40).read())
    if hashlib.sha256(path.read_bytes()).hexdigest()!=artifact['sha256']:raise ValueError('Reference jar hash mismatch')
jpype.startJVM(classpath=[str(p)for p in cache.glob('*.jar')])
J=jpype.JClass
Vector=J('org.hipparchus.geometry.euclidean.threed.Vector3D')
PV=J('org.orekit.utils.PVCoordinates');Orbit=J('org.orekit.orbits.CartesianOrbit')
Frame=J('org.orekit.frames.FramesFactory').getEME2000();Epoch=J('org.orekit.time.AbsoluteDate').J2000_EPOCH
Kepler=J('org.orekit.propagation.analytical.KeplerianPropagator')
State=J('org.orekit.propagation.SpacecraftState');Numerical=J('org.orekit.propagation.numerical.NumericalPropagator')
DP853=J('org.hipparchus.ode.nonstiff.DormandPrince853Integrator');J2Force=J('org.orekit.forces.gravity.J2OnlyPerturbation')
body_data=json.loads((ROOT/'frontend/src/science/data/planetary.json').read_text())
vec=lambda v:[float(v.getX()),float(v.getY()),float(v.getZ())]
cases=[]
for body_id,mode,speed_factor,inc in [('earth','central',1,0),('earth','central',1.12,55),('moon','central',1,25),('earth','j2',1,55)]:
    b=body_data['bodies'][body_id];mu=b['mu'];radius=b['radius']+600000;v=math.sqrt(mu/radius)*speed_factor
    initial_r=[radius,0,0];initial_v=[0,v*math.cos(math.radians(inc)),v*math.sin(math.radians(inc))]
    orbit=Orbit(PV(Vector(*initial_r),Vector(*initial_v)),Frame,Epoch,mu)
    if mode=='central':propagator=Kepler(orbit);integrator='Orekit analytical KeplerianPropagator'
    else:
        atol=jpype.JArray(jpype.JDouble)([0.001]*3+[1e-6]*4);rtol=jpype.JArray(jpype.JDouble)([1e-12]*7)
        propagator=Numerical(DP853(0.001,60.0,atol,rtol))
        propagator.setOrbitType(J('org.orekit.orbits.OrbitType').CARTESIAN)
        propagator.setInitialState(State(orbit));propagator.setMu(mu)
        propagator.addForceModel(J2Force(mu,6378137.0,1.08262668e-3,Frame))
        integrator='DormandPrince853; 0.001..60 s; absolute r 0.001 m/v 1e-6 m/s; relative 1e-12'
    period=float(orbit.getKeplerianPeriod());samples=[]
    for t in [0,600,3600,period,2*period]:
        p=propagator.propagate(Epoch.shiftedBy(t)).getPVCoordinates(Frame)
        samples.append({'seconds':t,'r':vec(p.getPosition()),'v':vec(p.getVelocity())})
    cases.append({'id':f'{body_id}-{mode}-{speed_factor}-{inc}','body':body_id,'mu':mu,'radius':b['radius'],'initial':{'r':initial_r,'v':initial_v},'forceModel':mode,'integrator':integrator,'samples':samples})
result={'tool':'Orekit','version':'13.1.9','hipparchus':'4.0.3','generatedOn':'2026-11-04','epoch':'2000-01-01T12:00:00 TT (J2000)','frame':'EME2000; J2 symmetry axis fixed at +Z','units':{'r':'m','v':'m/s','seconds':'s','mu':'m3/s2'},'notice':'Actual Orekit runs. Central and fixed-axis J2 cases only. No drag, third bodies, precision Earth orientation or live ephemerides.','artifacts':dependencies,'cases':cases}
# Independent non-central force vectors validate normalized degree/order-8 parsing.
gravity=json.loads((ROOT/'frontend/src/science/data/egm96.json').read_text());earth_mu=body_data['bodies']['earth']['mu']
cbar=[[0.0]*9 for _ in range(9)];sbar=[[0.0]*9 for _ in range(9)];cbar[0][0]=1.0
for coefficient in gravity['coefficients']:cbar[coefficient['n']][coefficient['m']]=coefficient['c'];sbar[coefficient['n']][coefficient['m']]=coefficient['s']
provider=J('org.orekit.forces.gravity.potential.GravityFieldFactory').getNormalizedProvider(gravity['radius'],earth_mu,J('org.orekit.forces.gravity.potential.TideSystem').UNKNOWN,jpype.JArray(jpype.JDouble,2)(cbar),jpype.JArray(jpype.JDouble,2)(sbar))
force=J('org.orekit.forces.gravity.HolmesFeatherstoneAttractionModel')(Frame,provider)
force_cases=[]
for position in [[7000000.0,0.0,0.0],[5000000.0,3000000.0,4000000.0],[-4000000.0,5000000.0,-3000000.0]]:
    state=State(Orbit(PV(Vector(*position),Vector(0.0,7000.0,100.0)),Frame,Epoch,earth_mu))
    force_cases.append({'r':position,'acceleration':vec(force.acceleration(state,force.getParameters(Epoch)))})
result['harmonicForces']={'model':'HolmesFeatherstoneAttractionModel; non-central only, normalized EGM96 degree/order 8, fixed EME2000 body axes at J2000','mu':earth_mu,'radius':gravity['radius'],'sourceSha256':gravity['source']['sha256'],'samples':force_cases}
for path in [ROOT/'frontend/src/science/data/orekit-reference.json',ROOT/'frontend/public/science/orekit-reference.json']:
    path.write_text(json.dumps(result,indent=2)+'\n')
print(f'Generated {len(cases)} actual Orekit reference trajectories, {sum(len(c["samples"])for c in cases)} checkpoints.')
