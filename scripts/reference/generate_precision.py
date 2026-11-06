"""Independent Orekit references for relativistic gravity and finite-Sun eclipses.
Requires the same pinned JPype/Java dependencies as generate_orekit.py.
No network access is needed when the verified Maven jars are already cached.
"""
from pathlib import Path
import hashlib
import json
import math
import urllib.request
import jpype

ROOT = Path(__file__).resolve().parents[2]
dependencies = json.loads((Path(__file__).parent / 'orekit-dependencies.json').read_text())
cache = Path('/tmp/mission-forge-orekit')
cache.mkdir(exist_ok=True)
for artifact in dependencies:
    path = cache / artifact['url'].rsplit('/', 1)[1]
    if not path.exists():
        path.write_bytes(urllib.request.urlopen(artifact['url'], timeout=40).read())
    if hashlib.sha256(path.read_bytes()).hexdigest() != artifact['sha256']:
        raise ValueError('Reference jar hash mismatch')
jpype.startJVM(classpath=[str(cache / a['url'].rsplit('/', 1)[1]) for a in dependencies])
J = jpype.JClass
Vector = J('org.hipparchus.geometry.euclidean.threed.Vector3D')
Frame = J('org.orekit.frames.FramesFactory').getEME2000()
Epoch = J('org.orekit.time.AbsoluteDate').J2000_EPOCH
PV = J('org.orekit.utils.PVCoordinates')
Orbit = J('org.orekit.orbits.CartesianOrbit')
State = J('org.orekit.propagation.SpacecraftState')
Relativity = J('org.orekit.forces.gravity.Relativity')
planetary = json.loads((ROOT / 'frontend/src/science/data/planetary.json').read_text())['bodies']
vec = lambda v: [float(v.getX()), float(v.getY()), float(v.getZ())]
def state(r, v, mu):
    return State(Orbit(PV(Vector(*r), Vector(*v)), Frame, Epoch, mu))
forces = []
for body, r, v in [
    ('earth', [7e6, 0., 100.], [200., 7500., 800.]),
    ('earth', [4e6, 5e6, -3e6], [-6000., 2500., 4000.]),
    ('earth', [42e6, -1e6, 2e6], [100., 3000., -50.]),
    ('sun', [46e9, 0., 1e8], [100., 58980., 1000.]),
    ('sun', [70e9, 40e9, -3e9], [-20000., 30000., 1000.]),
]:
    mu = planetary[body]['mu']
    model = Relativity(mu)
    forces.append({'body': body, 'mu': mu, 'r': r, 'v': v,
                   'acceleration': vec(model.acceleration(state(r, v, mu), model.getParameters(Epoch)))})

sun_distance = 149597870700.
sun_radius = float(J('org.orekit.utils.Constants').SUN_RADIUS)
sun_position = Vector(sun_distance, 0., 0.)
def position(date, frame):
    if hasattr(date, 'getField'):
        return J('org.hipparchus.geometry.euclidean.threed.FieldVector3D')(date.getField(), sun_position)
    return sun_position
provider = jpype.JProxy('org.orekit.utils.ExtendedPositionProvider', dict(getPosition=position))
shadows = []
for name, radius, distance in [('earth-low', 6378137., 7e6), ('earth-high', 6378137., 42e6), ('moon-annular', 1737400., 6e8)]:
    ellipsoid = J('org.orekit.bodies.OneAxisEllipsoid')(radius, 0., Frame)
    pressure = J('org.orekit.forces.radiation.SolarRadiationPressure')(
        provider, ellipsoid, J('org.orekit.forces.radiation.IsotropicRadiationSingleCoefficient')(8., 1.3))
    for offset in [-2., -1.2, -.9, -.5, 0., .5, .9, 1.2, 2.]:
        y = max(1., radius * (1 + distance / sun_distance) + offset * distance * sun_radius / sun_distance)
        r = [-distance, y, 120.]
        fraction = float(pressure.getLightingRatio(state(r, [0., 7000., 10.], planetary['earth']['mu'])))
        shadows.append({'id': f'{name}-{offset}', 'r': r, 'sun': vec(sun_position),
                        'center': [0., 0., 0.], 'radius': radius, 'sunRadius': sun_radius, 'fraction': fraction})

trajectories = []
for name, body, radius, eccentricity, inclination in [
    ('earth-1pn', 'earth', 7e6, .1, 55.),
    ('solar-mercury-1pn', 'sun', .38709927 * 149597870700 * (1 - .20563593), .20563593, 7.),
]:
    mu = planetary[body]['mu']
    speed = math.sqrt(mu * (1 + eccentricity) / radius)
    r = [radius, 0., 0.]
    v = [0., speed * math.cos(math.radians(inclination)), speed * math.sin(math.radians(inclination))]
    period = 2 * math.pi * math.sqrt((radius / (1 - eccentricity)) ** 3 / mu)
    atol = jpype.JArray(jpype.JDouble)([.0001] * 3 + [1e-8] * 4)
    rtol = jpype.JArray(jpype.JDouble)([1e-13] * 7)
    integrator = J('org.hipparchus.ode.nonstiff.DormandPrince853Integrator')(.001, min(600., period / 2000), atol, rtol)
    prop = J('org.orekit.propagation.numerical.NumericalPropagator')(integrator)
    prop.setOrbitType(J('org.orekit.orbits.OrbitType').CARTESIAN)
    prop.setInitialState(state(r, v, mu))
    prop.setMu(mu)
    prop.addForceModel(Relativity(mu))
    samples = []
    for t in [period / 4, period / 2, period, 3 * period]:
        p = prop.propagate(Epoch.shiftedBy(t)).getPVCoordinates(Frame)
        samples.append({'seconds': t, 'r': vec(p.getPosition()), 'v': vec(p.getVelocity())})
    trajectories.append({'id': name, 'body': body, 'mu': mu, 'initial': {'r': r, 'v': v},
                         'period': period, 'samples': samples})
result = {'tool': 'Orekit', 'version': '13.1.9', 'generatedOn': '2026-11-04',
          'frame': 'EME2000', 'epoch': 'J2000 TT', 'units': 'SI; illumination fraction dimensionless',
          'artifacts': dependencies, 'relativity': forces, 'eclipses': shadows, 'trajectories': trajectories,
          'limits': 'Schwarzschild 1PN in primary rest frame; spherical occultor and uniform solar disk. Fixed Sun for eclipse fixtures. No ephemeris or operational navigation accuracy claim.'}
for target in ['frontend/src/science/data/precision-reference.json', 'frontend/public/science/precision-reference.json']:
    (ROOT / target).write_text(json.dumps(result, indent=2) + '\n')
print(f'Generated {len(forces)} relativistic force vectors, {len(shadows)} eclipses and {len(trajectories)} three-period trajectories using Orekit.')
