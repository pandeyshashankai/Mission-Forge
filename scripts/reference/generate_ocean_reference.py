"""Actual Orekit ocean-wave and force checks; TT used as UT1 explicitly."""
import json,math
from pathlib import Path
import jpype
root=Path(__file__).resolve().parents[2]
jpype.startJVM(classpath=[str(p)for p in Path('/tmp/mission-forge-orekit').glob('*.jar')]);J=jpype.JClass
raw=json.loads((root/'frontend/src/science/data/ocean-tides.json').read_text())
groups={}
for row in raw['rows']:
 if row['n']<2:continue
 groups.setdefault(row['doodson'],[]).append(row)
waves=[]
for code,rows in groups.items():
 coeff=[[[0.]*4 for m in range(n+1)]for n in range(9)]
 for r in rows:coeff[r['n']][r['m']]=[r['cp'],r['sp'],r['cm'],r['sm']]
 waves.append(J('org.orekit.forces.gravity.potential.OceanTidesWave')(code,8,8,jpype.JArray(jpype.JDouble,3)(coeff)))
epoch=J('org.orekit.time.AbsoluteDate').J2000_EPOCH;args=J('org.orekit.utils.IERSConventions').IERS_2010.getNutationArguments(J('org.orekit.time.TimeScalesFactory').getTT())
samples=[]
for seconds in [0.,86400.,10000000.]:
 date=epoch.shiftedBy(seconds);elements=args.evaluateAll(date)
 c=jpype.JArray(jpype.JDouble,2)([[0.]*(n+1)for n in range(9)]);s=jpype.JArray(jpype.JDouble,2)([[0.]*(n+1)for n in range(9)])
 for wave in waves:wave.addContribution(elements,c,s)
 samples.append({'seconds':seconds,'arguments':dict(zip(['gamma','l','lp','F','D','O'],[float(elements.getGamma()),float(elements.getL()),float(elements.getLPrime()),float(elements.getF()),float(elements.getD()),float(elements.getOmega())])),'terms':[{'n':n,'m':m,'c':float(c[n][m]),'s':float(s[n][m])}for n in range(2,9)for m in range(n+1)]})
result={'tool':'Orekit 13.1.9','timeAssumption':'TT = UT1; no real EOP. Truncated degree-8 FES2004 test file, not full global loading.','sourceSha256':raw['sha256'],'samples':samples}
for file in ['frontend/src/science/data/ocean-reference.json','frontend/public/science/ocean-reference.json']:(root/file).write_text(json.dumps(result,indent=2)+'\n')
print('Generated 3 actual Orekit ocean-wave coefficient cases')
