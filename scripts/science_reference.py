"""Generate independent, high-precision two-body benchmarks; never import game JS."""
import json
from decimal import Decimal as D, getcontext
from pathlib import Path
getcontext().prec = 60
root = Path(__file__).resolve().parents[1]
data = json.loads((root / 'frontend/src/science/data/planetary.json').read_text())
pi = D('3.14159265358979323846264338327950288419716939937510582097494')
rows = []
for body, altitude in [('earth', 200000), ('moon', 100000), ('mars', 200000)]:
    item = data['bodies'][body]
    axes = [D(str(x)) for x in item['radiiKm']]
    radius = (axes[0] * axes[1] * axes[2]) ** (D(1)/D(3)) * 1000
    mu = D(str(item['muKm3s2'])) * 10**9
    r = radius + altitude
    rows.append(dict(body=body, altitude=altitude, radius=str(radius), mu=str(mu),
                     speed=str((mu/r).sqrt()), escape=str((2*mu/r).sqrt()),
                     period=str(2*pi*(r**3/mu).sqrt())))
# The engineering references are also computed independently of game JavaScript.
mu = D(str(data['bodies']['earth']['muKm3s2'])) * 10**9
radius = D(rows[0]['radius'])
r1, r2 = radius + 200000, radius + 400000
a = (r1+r2)/2
burn1 = (mu*(2/r1-1/a)).sqrt() - (mu/r1).sqrt()
burn2 = (mu/r2).sqrt() - (mu*(2/r2-1/a)).sqrt()
g0, isp, dry, fuel = D('9.80665'), D(345), D(1800), D(3200)
engineering = dict(transfer=dict(body='earth', fromAltitude=200000, toAltitude=400000, burn1=str(burn1), burn2=str(burn2), coastTime=str(pi*(a**3/mu).sqrt())),
                   rocket=dict(isp=float(isp), dryMass=float(dry), fuelMass=float(fuel), deltaV=str(g0*isp*((dry+fuel)/dry).ln())))
atmosphere = []
for name, altitude in [('earth', 115000), ('mars', 55000)]:
    bands = data['atmospheres'][name]['bands']
    band = max((b for b in bands if b['altitude'] <= altitude), key=lambda b: b['altitude'])
    rho = D(str(band['density'])) * (-(D(altitude)-D(str(band['altitude'])))/D(str(band['scaleHeight']))).exp()
    atmosphere.append(dict(body=name, altitude=altitude, density=str(rho)))
output = dict(method='Python Decimal (60 significant digits); independent of the JavaScript implementation. Analytic two-body reference, not an observed spacecraft trajectory.',
              sourceCommit=data['commit'], cases=rows, engineering=engineering, atmosphere=atmosphere)
(root / 'frontend/src/science/data/benchmarks.json').write_text(json.dumps(output, indent=2)+'\n')
print('Generated orbital, density, rocket-equation and transfer benchmarks at 60-digit precision.')
