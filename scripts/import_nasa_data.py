"""Reproduce the game's NASA data subset from pinned, checksum-verified sources.

Normal runs use the committed snapshots. --fetch refreshes those exact snapshots
from NASA's official GMAT repository, never a moving branch.
"""
import argparse
import csv
import hashlib
import json
import math
import re
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
COMMIT = 'c9b78bd1c8499845cb78fde315e1f761b6b06f1c'
SOURCES = [
    dict(id='naif-pck11', name='JPL/NAIF pck00011 planetary constants',
         file='pck00011.tpc', path='application/data/planetary_coeff/SPICEPlanetaryConstantsKernel.tpc',
         sha256='3dff7b1dbeceaa01f25467767d3fa25816051c85d162d1edf04acb310ee28bb1',
         upstream='https://naif.jpl.nasa.gov/pub/naif/generic_kernels/pck/pck00011.tpc',
         fields='Triaxial radii (km) and linear prime-meridian rates (degrees/day). Original kernel by Nat Bachman (NAIF), 2022-12-27.'),
    dict(id='nasa-gmat', name='NASA GMAT gravitational-parameter defaults',
         file='GmatDefaults.hpp', path='src/gmatutil/util/GmatDefaults.hpp',
         sha256='430845c2e8b700559690c43069de5d347c4384631efd881cc1a3a3cc5917465e',
         upstream='https://github.com/nasa/GMAT',
         fields='PLANET_MU, MOON_MU and STAR_MU, km³/s². Software defaults, not a current precision ephemeris.'),
    dict(id='nasa-earth-atmosphere', name='NASA GMAT Earth exponential density table', file='EarthExponentialAtmosphereData.txt', path='application/data/atmosphere/earth/EarthExponentialAtmosphereData.txt', sha256='75762f679f82e089a4a6eadaa1251c797a2151aab5311b36b2ae96cffefda85e', upstream='https://github.com/nasa/GMAT', fields='Altitude km, density kg/m³, scale height km; 28 archived model bands.', kind='dataset'),
    dict(id='nasa-mars-atmosphere', name='NASA GMAT Mars exponential density table', file='MarsExponentialAtmosphereData.txt', path='application/data/atmosphere/mars/MarsExponentialAtmosphereData.txt', sha256='376cd96341c3eaf20f9cdc9e39b43b1fa2e65aa61550df4349b96c26ed6ed027', upstream='https://github.com/nasa/GMAT', fields='Altitude km, density kg/m³, scale height km; 150 archived model bands.', kind='dataset'),
    dict(id='nasa-density-method', name='NASA GMAT exponential atmosphere implementation', file='ExponentialAtmosphere.cpp', path='src/base/solarsys/ExponentialAtmosphere.cpp', sha256='e0aacfbaa27c951f05680a69ac88ce3ee49687ead35d226e302233be1e1b7f13', upstream='https://github.com/nasa/GMAT', fields='Reference implementation for band selection and density units; game implementation is separate.', kind='method'),
    dict(id='nasa-transfer-guide', name='NASA GMAT Simple Orbit Transfer tutorial', file='Tut_SimpleOrbitTransfer.xml', path='doc/help/src/Tut_SimpleOrbitTransfer.xml', sha256='28fb7f4d787db0a61115084f91a18602fc497e519f07559fdf33f74ea24db52d', upstream='https://github.com/nasa/GMAT', fields='Two-burn coplanar orbit transfer and coast to apoapsis/periapsis; method reference.', kind='method'),
    dict(id='nasa-burn-guide', name='NASA GMAT ImpulsiveBurn reference', file='Resource_ImpulsiveBurn.xml', path='doc/help/src/Resource_ImpulsiveBurn.xml', sha256='f5565ebe6a695faed43ff182a9894dc47918a7f03b685506ec2410072f9accf0', upstream='https://github.com/nasa/GMAT', fields='Local burn directions, Isp and propellant accounting; method reference, not engine hardware data.', kind='method'),
]
BODIES = dict(sun=10, mercury=199, venus=299, earth=399, mars=499,
              jupiter=599, saturn=699, uranus=799, neptune=899,
              moon=301, europa=502, titan=606)
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--fetch', action='store_true')
args = parser.parse_args()
texts = {}
for source in SOURCES:
    source.setdefault("kind", "dataset")
    source['url'] = f"https://raw.githubusercontent.com/nasa/GMAT/{COMMIT}/{source['path']}"
    source['repositoryUrl'] = f"https://github.com/nasa/GMAT/blob/{COMMIT}/{source['path']}"
    source['retrievedAt'] = '2026-11-04'
    path = ROOT / 'data/nasa' / source['file']
    raw = urllib.request.urlopen(source['url'], timeout=40).read() if args.fetch else path.read_bytes()
    if hashlib.sha256(raw).hexdigest() != source['sha256']:
        raise ValueError(f"Checksum mismatch for {source['file']}")
    if args.fetch:
        path.write_bytes(raw)
    public_source = ROOT / 'frontend/public/science/sources' / source['file']
    public_source.parent.mkdir(parents=True, exist_ok=True)
    public_source.write_bytes(raw)
    texts[source['id']] = raw.decode('utf-8')

# Only assignments inside SPICE data sections are operative; ignore prose examples.
data = '\n'.join(re.findall(r'\\begindata(.*?)(?=\\begintext|\Z)', texts['naif-pck11'], re.S))
def numbers(value):
    value = re.sub(r'//[^\n]*', '', value)
    return [float(x.replace('D', 'E')) for x in re.findall(r'[-+]?\d+(?:\.\d*)?(?:[EeDd][-+]?\d+)?', value)]
def array(name):
    return numbers(re.search(name + r'\[.*?\]\s*=\s*\{(.*?)\}', texts['nasa-gmat'], re.S)[1])
mu = dict(zip(list(BODIES)[1:9], array('PLANET_MU')[:8]))
mu['moon'] = array('MOON_MU')[0]
mu['sun'] = float(re.search(r'STAR_MU\s*=\s*([\d.]+)', texts['nasa-gmat'])[1])
rows = {}
for name, code in BODIES.items():
    matches = re.findall(rf'BODY{code}_RADII\s*=\s*\((.*?)\)', data, re.S)
    axes = numbers(matches[-1])
    assert len(axes) == 3 and all(v > 0 for v in axes)
    row = dict(naifId=code, radiiKm=axes, radius=math.prod(axes)**(1/3)*1000,
               radiusSource='naif-pck11', radiusField=f'BODY{code}_RADII', radiusMethod='volume-equivalent sphere: 1000 × (a × b × c)^(1/3)')
    if name in mu:
        row.update(mu=mu[name]*1e9, muKm3s2=mu[name], muSource='nasa-gmat', muField='STAR_MU' if name == 'sun' else 'MOON_MU[0]' if name == 'moon' else f'PLANET_MU[{list(BODIES)[1:9].index(name)}]')
    rotation = numbers(re.findall(rf'BODY{code}_PM\s*=\s*\((.*?)\)', data, re.S)[-1])
    row.update(rotation=86400*360/rotation[1], rotationSource='naif-pck11', rotationField=f'BODY{code}_PM', rotationRateDegDay=rotation[1], primeMeridianDeg=rotation[0])
    rows[name] = row
atmospheres = {}
for name in ['earth', 'mars']:
    bands = []
    for line in texts[f'nasa-{name}-atmosphere'].splitlines():
        if not line.strip():
            continue
        altitude, density, height = map(float, line.split(','))
        if density <= 0 or height <= 0 or (bands and altitude*1000 <= bands[-1]['altitude']):
            raise ValueError(f'Invalid atmosphere band: {line}')
        bands.append(dict(altitude=altitude*1000, density=density, scaleHeight=height*1000))
    atmospheres[name] = dict(source=f'nasa-{name}-atmosphere', methodSource='nasa-density-method', bands=bands,
                            maximumAltitude=bands[-1]['altitude'], units=dict(altitude='m', density='kg/m³', scaleHeight='m'))
output = dict(version=1, commit=COMMIT, retrievedAt='2026-11-04',
              units=dict(radius='m', radiiKm='km', mu='m³/s²', muKm3s2='km³/s²', rotation='s', rotationRateDegDay='degrees/day', primeMeridianDeg='degrees'),
              sources=SOURCES, bodies=rows, atmospheres=atmospheres,
              limits=['Spherical bodies replace the source triaxial shapes.',
                      'GMAT values are archived software defaults, not the latest gravitational solutions.',
                      'Europa and Titan gravitational parameters retain labelled model values; only their radii are imported.',
                      'Rotation uses only the linear prime-meridian rate; axis tilt, periodic terms and full SPICE orientation are not evaluated.',
                      'Earth/Mars densities are archived exponential models, not live weather. Other atmospheres and fixed orbital elements remain separate model inputs.',
                      'No live SPICE ephemeris, orientation kernel evaluation or mission navigation service is provided.'])
serialized = json.dumps(output, indent=2, ensure_ascii=False) + '\n'
for target in ['frontend/src/science/data/planetary.json', 'frontend/public/science/planetary-data.json']:
    (ROOT / target).write_text(serialized)
with (ROOT / 'data/nasa/analysis.csv').open('w', newline='') as stream:
    writer = csv.writer(stream, lineterminator='\n')
    writer.writerow(['body', 'NAIF_id', 'axis_a_km', 'axis_b_km', 'axis_c_km', 'volume_radius_km', 'NASA_mu_m3_s2', 'model_surface_gravity_m_s2', 'circular_speed_at_200km_m_s', 'radius_source', 'mu_source', 'rotation_period_s', 'rotation_rate_deg_day', 'rotation_source'])
    for name, row in rows.items():
        value = row.get('mu')
        radius = row['radius']
        writer.writerow([name, row['naifId'], *row['radiiKm'], radius/1000, value if value else '', value/radius**2 if value else '', math.sqrt(value/(radius+200000)) if value else '', row['radiusSource'], row.get('muSource', 'not supplied; existing model value'), row['rotation'], row['rotationRateDegDay'], row['rotationSource']])
(ROOT / 'frontend/public/science/analysis.csv').write_bytes((ROOT / 'data/nasa/analysis.csv').read_bytes())
with (ROOT / 'data/nasa/atmospheres.csv').open('w', newline='') as stream:
    writer = csv.writer(stream, lineterminator='\n')
    writer.writerow(['world', 'altitude_m', 'density_kg_m3', 'scale_height_m', 'source'])
    for name, model in atmospheres.items():
        for band in model['bands']:
            writer.writerow([name, band['altitude'], band['density'], band['scaleHeight'], model['source']])
(ROOT / 'frontend/public/science/atmospheres.csv').write_bytes((ROOT / 'data/nasa/atmospheres.csv').read_bytes())
print(f"Verified {len(SOURCES)} source hashes; generated {len(rows)} bodies, {len(mu)} gravitational parameters, and analysis.csv.")

(ROOT / 'frontend/public/science/sources/LICENSE-GMAT.txt').write_bytes((ROOT / 'data/nasa/LICENSE-GMAT.txt').read_bytes())
