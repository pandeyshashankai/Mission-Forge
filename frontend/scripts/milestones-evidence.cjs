require('./register.cjs');
const fs=require('node:fs'),path=require('node:path');
const {loadingDisplacement}=require('../src/sim/advanced/oceanLoading');
const refs=require('../src/science/data/ocean-loading-reference.json');
const stations=require('../src/science/data/loading-stations.json').stations;
const {createWasmEngine}=require('../src/engine/fullEngineRunner');
const {verifyEngine}=require('../src/engine/fullEngineVerification');
const {presetFalconLike}=require('../src/sim/presets');
const {initializeWeatherModel}=require('../src/sim/advanced/weatherAtmosphere');
(async()=>{
 const stationSeries=refs.cases.map(c=>{
  const station=stations.find(s=>s.name===c.station),start=(Date.parse(c.startUt1+'Z')-Date.UTC(2000,0,1,12))/1000;
  const errors=c.samples.flatMap((row,i)=>{const d=loadingDisplacement(station,start+i*3600,66.184);return ['up','south','west'].map((k,j)=>Math.abs(d[k]-row[j]));});
  return {station:c.station,hours:24,components:3,ttMinusUt1:66.184,maxAbsoluteErrorMetres:Math.max(...errors),toleranceMetres:c.toleranceMetres,pass:errors.every(e=>e<=c.toleranceMetres)};
 });
 const factoryModule=await import(require('node:url').pathToFileURL(path.resolve(__dirname,'../public/science/models/nrlmsise-browser.mjs')).href); initializeWeatherModel(await factoryModule.default());
 const source=fs.readFileSync(path.resolve(__dirname,'../public/science/models/full-engine.js'),'utf8'),factory=()=>createWasmEngine(source);
 const wasm=[];
 for(const initial of [{type:'initCampaign',design:presetFalconLike(),missionId:'first_orbit'}, {type:'initFleet',body:'earth',craftId:'pathfinder',physics:{integrator:'accurate',harmonicDegree:8,thirdBody:true,srp:true,tides:true,oceanTides:true,relativity:true,damage:true,power:true,atmosphere:'msis'}}]) wasm.push(await verifyEngine(factory,initial));
 const report={checkedAt:new Date().toISOString(),status:stationSeries.every(r=>r.pass)&&wasm.every(r=>r.pass)?'PASS':'FAIL',stationSeries,wasm,scope:'Supplemental numeric evidence; all-world/craft coverage and fracture/contact conservation are in the 12 milestone regression groups. Native command timings include the typed atmosphere bridge; Wasm timings include VM marshaling. No speedup is claimed.'};
 fs.writeFileSync(process.env.MF_MILESTONE_EVIDENCE||'/tmp/mission-forge-milestone-validation.json',JSON.stringify(report,null,2)+'\n'); console.log(report.status);
})().catch(e=>{console.error(e);process.exitCode=1});
