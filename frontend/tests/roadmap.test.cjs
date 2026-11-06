require('../scripts/register.cjs');
const test=require('node:test'),assert=require('node:assert/strict');
const {ExplorationSim}=require('../src/sim/exploration');
const {BODY_BY_ID,bodyState}=require('../src/sim/solarSystem');
const {add,scale,len,sub}=require('../src/sim/vec');
const {orbitalOrientation,orbitalElements}=require('../src/sim/orbit');
const {coastInvariants,invariantDrift,seededRandom}=require('../src/sim/invariants');
const {burnStatus}=require('../src/sim/burnStatus');
const {runMissionReplay,compareReplay}=require('../src/sim/missionReplay');
const reference=require('../public/science/showcase-replay.json');
function coast(sim,seconds){let left=seconds;while(left>1e-6){const elapsed=sim.advance(Math.min(10000,left));assert.ok(elapsed>0);left-=elapsed;}}
test('recorded command replay reproduces all numerical checkpoints',()=>{
  const a=runMissionReplay(reference.spec), b=runMissionReplay(reference.spec);
  assert.ok(compareReplay(a,reference.reference)); assert.deepEqual(a,b);
  const changed=structuredClone(reference.spec);changed.initial.profile.targetAltitude=250000;
  assert.equal(compareReplay(runMissionReplay(changed),reference.reference),false);
  assert.throws(()=>runMissionReplay({...reference.spec,sourceCommit:'changed'}));
  assert.throws(()=>runMissionReplay({...reference.spec,commands:[{action:'advance',seconds:Infinity}]}));
});
test('circular orbit: ten periods conserve radius, energy and angular momentum',()=>{
  const sim=new ExplorationSim('earth','pathfinder',0,400000,{drag:false}), n=sim.navigation();
  const before=coastInvariants(n.r,n.v,n.body.mu);
  coast(sim,10*n.el.period);const after=sim.navigation();
  const drift=invariantDrift(before,coastInvariants(after.r,after.v,n.body.mu));
  assert.ok(Math.abs(len(after.r)/len(n.r)-1)<0.001);
  assert.ok(drift.energyRelative<0.001); assert.ok(drift.angularMomentumRelative<0.001);
});
test('elliptical orbit: twenty periods preserve apsides within 0.2%',()=>{
  const sim=new ExplorationSim('earth','pathfinder',0,400000,{drag:false}), b=BODY_BY_ID.earth;
  const n=sim.navigation(), base=bodyState('earth',0);
  sim.v=add(base.v,scale(n.v,1.12));const first=sim.navigation();
  coast(sim,20*first.el.period);const last=sim.navigation();
  assert.ok(Math.abs(last.el.rp/first.el.rp-1)<0.002);
  assert.ok(Math.abs(last.el.ra/first.el.ra-1)<0.002);
  assert.ok(invariantDrift(coastInvariants(first.r,first.v,b.mu),coastInvariants(last.r,last.v,b.mu)).energyRelative<0.002);
});
test('orbital angle singularities are explicit and an inclined eccentric case reconstructs',()=>{
  const mu=BODY_BY_ID.earth.mu,r=7e6,speed=Math.sqrt(mu/r);
  assert.deepEqual(orbitalOrientation([r,0,0],[0,speed,0],mu),{raan:null,argumentOfPeriapsis:null,trueAnomaly:null});
  const a=orbitalOrientation([r,0,0],[0,speed*1.1/Math.sqrt(2),speed*1.1/Math.sqrt(2)],mu);
  assert.ok(Math.abs(a.raan)<1e-8);assert.ok(Math.abs(a.argumentOfPeriapsis)<1e-8);assert.ok(Math.abs(a.trueAnomaly)<1e-8);
});
test('burn card matches fuel use and decreases estimated remaining time',()=>{
  const sim=new ExplorationSim('earth');sim.startTransfer(500000);
  const first=burnStatus(sim);sim.advance(1);const next=burnStatus(sim);
  assert.ok(next.seconds<first.seconds);assert.ok(next.delivered>0);assert.ok(next.progress>0);
  assert.ok(Math.abs(first.burnFuel-next.burnFuel-(5000-(sim.craft.dryMass+sim.fuel)))<1e-6);
  sim.cancelTransfer();assert.equal(sim.throttle,0);
});
test('10,000 seeded valid orbit states propagate without NaN or infinity',()=>{
  const random=seededRandom(20261104), bodies=['earth','moon','mars'];
  for(let i=0;i<10000;i++){
    const id=bodies[i%3],sim=new ExplorationSim(id,'pathfinder',random()*1e6,300000+random()*2e6,{drag:false});
    const n=sim.navigation(),base=bodyState(id,sim.t);
    sim.v=add(base.v,scale(n.v,0.9+random()*0.25));
    sim.advance(1+random()*30);
    assert.ok([sim.t,...sim.r,...sim.v,sim.fuel,sim.navigation().el.e].every(Number.isFinite));
  }
});
test('invariants reject nonfinite initial values',()=>assert.throws(()=>coastInvariants([NaN,0,0],[0,0,0],1)));
test('integrated Earth J2 node regression agrees with first-order secular estimate',()=>{
  const {EARTH}=require('../src/sim/constants');
  const {rk4,j2NodeRate}=require('../src/sim/bodies');
  const radius=EARTH.radius+600000, inc=55*Math.PI/180, speed=Math.sqrt(EARTH.mu/radius);
  let state={r:[radius,0,0],v:[0,speed*Math.cos(inc),speed*Math.sin(inc)]};
  const first=orbitalElements(state.r,state.v,EARTH.mu,EARTH.radius),duration=20*first.period;
  let t=0;while(t<duration){const dt=Math.min(20,duration-t);state=rk4(state.r,state.v,t,dt,null,true);t+=dt;}
  const last=orbitalElements(state.r,state.v,EARTH.mu,EARTH.radius);
  let angle=last.raan-first.raan;angle=Math.atan2(Math.sin(angle),Math.cos(angle));
  const expected=j2NodeRate(first)*duration;
  assert.ok(Math.abs(angle/expected-1)<0.03,`${angle} vs ${expected}`);
});
test('attitude display projects ahead/behind markers and handles radial pointing',()=>{
 const {attitudeMarkers}=require('../src/sim/attitudeDisplay');
 const pro=attitudeMarkers([1,0,0],[0,1,0],[0,1,0]);
 const p=pro.markers.find(m=>m.id==='prograde'),r=pro.markers.find(m=>m.id==='retrograde');
 assert.equal(p.front,true);assert.equal(r.front,false);assert.ok(Math.abs(p.x)+Math.abs(p.y)<1e-10);
 assert.equal(pro.pitch,0);
 const radial=attitudeMarkers([1,0,0],[0,1,0],[1,0,0]);assert.equal(radial.pitch,90);
 for(const m of radial.markers)assert.ok([m.x,m.y].every(Number.isFinite));
});
test('saved stage insertion remaps all IDs, preserves boosters and leaves original untouched',()=>{
 const {captureStage,appendSubassembly,validSubassembly}=require('../src/game/subassemblies');
 const {presetFalconLike}=require('../src/sim/presets');
 const {isValidDesign}=require('../src/sim/storage');
 const design=presetFalconLike(),original=JSON.stringify(design);
 const saved=captureStage(design,design.stack.at(-1).uid,'Reusable booster');
 assert.ok(validSubassembly(saved));
 const inserted=appendSubassembly(design,saved),twice=appendSubassembly(inserted,saved);
 assert.ok(isValidDesign(twice));assert.equal(twice.stack.length,design.stack.length+2*saved.stack.length);
 const nodes=[...twice.stack,...twice.radials];assert.equal(new Set(nodes.map(n=>n.uid)).size,nodes.length);
 assert.equal(JSON.stringify(design),original);assert.equal(twice.events,undefined);
 assert.throws(()=>captureStage(design,'missing','Stage'));
 assert.throws(()=>captureStage(design,design.stack[0].uid,''));
 assert.throws(()=>appendSubassembly(design,{...saved,stack:[]}));
});
test('bundled original sources match all seven published checksums',()=>{
 const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
 const data=require('../src/science/data/planetary.json');
 for(const source of data.sources){const bytes=fs.readFileSync(path.resolve(__dirname,'../public/science/sources',source.file));assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),source.sha256);}
});
