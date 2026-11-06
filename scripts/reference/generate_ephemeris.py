"""PYTHONPATH=/tmp/mission-forge-ephemerides python scripts/reference/generate_ephemeris.py"""
from pathlib import Path
import json,hashlib,math
from jplephem.spk import SPK
root=Path(__file__).resolve().parents[2]
path=Path('/tmp/mission-forge-ephemerides/skyfield_data/data/de421.bsp');k=SPK.open(str(path))
eps=math.radians(23.439291111)
def transform(a):return [float(a[0]),float(a[1]*math.cos(eps)+a[2]*math.sin(eps)),float(-a[1]*math.sin(eps)+a[2]*math.cos(eps))]
def sample(id,t):
 jd=2451545+t/86400
 center={'mercury':1,'venus':2,'earth':3,'moon':3,'mars':4,'jupiter':5,'saturn':6,'uranus':7,'neptune':8}[id]
 p,v=k[0,center].compute_and_differentiate(jd)
 child={'mercury':199,'venus':299,'earth':399,'moon':301,'mars':499}.get(id)
 if child:
  cp,cv=k[center,child].compute_and_differentiate(jd);p=p+cp;v=v+cv
 sp,sv=k[0,10].compute_and_differentiate(jd)
 return {'r':transform((p-sp)*1000),'v':transform((v-sv)*1000/86400)}
ids=['mercury','venus','earth','moon','mars','jupiter','saturn','uranus','neptune']
result={'source':'JPL DE421 via skyfield-data 7.0.0','kernelSha256':hashlib.sha256(path.read_bytes()).hexdigest(),'start':0,'end':31*86400,'step':3600,'frame':'heliocentric ECLIPJ2000','time':'TDB seconds from JD2451545.0','outerPlanets':'system barycentres, not planet centres','states':{id:[sample(id,t) for t in range(0,31*86400+1,3600)] for id in ids},'heldOut':[{'id':id,'t':t,**sample(id,t)}for id in ids for t in [1800,86400+1800,30*86400+1800]]}
for target in ['frontend/src/science/data/de421.json','frontend/public/science/de421.json']:(root/target).write_text(json.dumps(result,separators=(',',':'))+'\n')
(root/'data/ephemerides/de421-provenance.json').write_text(json.dumps({key:val for key,val in result.items()if key not in ['states','heldOut']},indent=2)+'\n')
print('Generated 31 days of hourly DE421 states with independent half-hour checkpoints')
