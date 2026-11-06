"""Independent native-C reference for the browser WASM port. Requires gcc, not a game runtime dependency."""
from pathlib import Path
import ctypes as C,subprocess,json,hashlib
ROOT=Path(__file__).resolve().parents[2];sources=ROOT/'data/models'
manifest=json.loads((sources/'nrlmsise-native-sources.json').read_text())
for source in manifest['files']:
    if hashlib.sha256((sources/source['file']).read_bytes()).hexdigest()!=source['sha256']:raise ValueError('NRLMSISE source hash mismatch')
library='/tmp/mission-forge-msis-reference.so'
subprocess.run(['gcc','-shared','-fPIC','-O2',str(sources/'nrlmsise-00.c'),str(sources/'nrlmsise-00_data.c'),'-lm','-o',library],check=True)
class Flags(C.Structure):_fields_=[('switches',C.c_int*24),('sw',C.c_double*24),('swc',C.c_double*24)]
class Input(C.Structure):_fields_=[('year',C.c_int),('doy',C.c_int)]+[(name,C.c_double)for name in ['sec','alt','g_lat','g_long','lst','f107A','f107','ap']]+[('ap_a',C.c_void_p)]
class Output(C.Structure):_fields_=[('d',C.c_double*9),('t',C.c_double*2)]
lib=C.CDLL(library);lib.gtd7.argtypes=[C.POINTER(Input),C.POINTER(Flags),C.POINTER(Output)]
cases=[]
for altitude,flux,ap in [(0,150,4),(100000,150,4),(400000,150,4),(400000,70,4),(400000,250,40),(800000,150,4)]:
    record={'altitude':altitude,'latitude':60,'longitude':-70,'doy':172,'seconds':29000,'f107':flux,'f107a':flux,'ap':ap}
    input=Input();input.doy=172;input.sec=29000;input.alt=altitude/1000;input.g_lat=60;input.g_long=-70;input.lst=(input.sec/3600+input.g_long/15)%24;input.f107A=flux;input.f107=flux;input.ap=ap
    flags=Flags();flags.switches[:]=[1]*24;output=Output();lib.gtd7(C.byref(input),C.byref(flags),C.byref(output))
    cases.append({'input':record,'density':output.d[5],'temperature':output.t[1],'exosphericTemperature':output.t[0]})
result={'reference':'NRLMSISE-00 native C gtd7, gcc -O2; all switches 1, including SI output','source':manifest,'units':{'density':'kg/m3','temperature':'K'},'cases':cases,'notice':'Offline specified weather inputs, not observations. Tests browser WASM against a separately compiled native implementation of the same empirical model.'}
for path in [ROOT/'frontend/src/science/data/msis-reference.json',ROOT/'frontend/public/science/msis-reference.json']:path.write_text(json.dumps(result,indent=2)+'\n')
print('Generated',len(cases),'native-C atmosphere fixtures')
