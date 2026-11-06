"""Reproduce the browser EGM96 subset from the pinned original NASA GMAT snapshot."""
from pathlib import Path
import argparse,hashlib,json,re,urllib.request
ROOT=Path(__file__).resolve().parents[1]
SOURCE='https://raw.githubusercontent.com/nasa/GMAT/c9b78bd1c8499845cb78fde315e1f761b6b06f1c/application/data/gravity/earth/EGM96.cof'
EXPECTED='4735c9301e20ee8db09b6d0882a24671b327cd35ec5740ea497c8eeb43a39807'
parser=argparse.ArgumentParser();parser.add_argument('--fetch',action='store_true');args=parser.parse_args();original=ROOT/'data/nasa/EGM96.cof'
raw=urllib.request.urlopen(SOURCE,timeout=40).read()if args.fetch else original.read_bytes()
if hashlib.sha256(raw).hexdigest()!=EXPECTED:raise ValueError('Original gravity snapshot hash mismatch')
if args.fetch:original.write_bytes(raw)
existing=json.loads((ROOT/'frontend/src/science/data/egm96.json').read_text());coefficients=[]
for line in raw.decode().splitlines():
    if not line.startswith('RECOEF'):continue
    degree=int(line[6:11]);order=int(line[11:14])
    if degree>8:continue
    values=re.findall(r'[-+]?\d+\.\d+(?:[EeDd][-+]?\d+)?',line[14:])
    coefficients.append({'n':degree,'m':order,'c':float(values[0].replace('D','E')),'s':float(values[1].replace('D','E'))if len(values)>1 else 0})
if len(coefficients)!=42:raise ValueError('Unexpected degree/order-8 coefficient count')
existing['coefficients']=coefficients
for target in ['frontend/src/science/data/egm96.json','frontend/public/science/egm96.json']:(ROOT/target).write_text(json.dumps(existing,indent=2)+'\n')
(ROOT/'frontend/public/science/sources/EGM96.cof').write_bytes(raw)
print('Verified original EGM96 hash; reproduced all 42 degree/order-8 coefficients.')
