require('../scripts/register.cjs');
const test=require('node:test'),assert=require('node:assert/strict'),THREE=require('three');
const {assemblyConnections}=require('../src/sim/assemblyConnections');
const {createRuntime,applyEvent,thrustState,runtimeMass}=require('../src/sim/design');
const {thrustDirection}=require('../src/sim/thrustDirection');
const {PARTS}=require('../src/sim/parts');
const design=()=>({editorLayout:true,name:'Connection test',stack:[{uid:'c',partId:'probe_core',position:{x:0,y:6,z:0}},{uid:'t',partId:'tank_k_37_s',position:{x:0,y:0,z:0}},{uid:'e',partId:'eng_k1',position:{x:0,y:-PARTS.eng_k1.height,z:0}}],radials:[],events:null});
const force=d=>{const rt=createRuntime(d);applyEvent(rt,'ignite-0');return {rt,f:thrustState(rt,1,1).F};};
test('floating engine keeps its stage link but cannot produce thrust until physically reattached',()=>{const d=design(),on=force(d);assert.ok(on.f>0);d.stack[2].position.x=30;d.stack[2].mount={parentUid:'t',x:30,y:-PARTS.eng_k1.height,z:0};assert.equal(force(d).f,0);assert.equal(assemblyConnections(d).loose[0].uid,'e');d.stack[2].position.x=0;assert.equal(force(d).f,on.f);});
test('floating tank preserves loaded mass but cannot donate fuel to the controlled rocket',()=>{const d=design(),base=force(d);d.stack.push({uid:'loose',partId:'tank_k_37_s',position:{x:50,y:0,z:0}});const r=force(d);assert.equal(r.rt.sections[0].tanks.kerolox,base.rt.sections[0].tanks.kerolox);assert.equal(runtimeMass(r.rt)-runtimeMass(base.rt),PARTS.tank_k_37_s.dryMass+PARTS.tank_k_37_s.propellant.mass);});
test('rotated thrust agrees with rendered nozzle orientation at poles and general attitudes',()=>{for(const axis of [[0,0,-1],[0,0,1],[1,2,3],[-3,1,2]])for(const angle of [0,90,180,270]){const d=new THREE.Vector3(...axis).normalize(),q=new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),new THREE.Vector3(d.x,d.z,-d.y)),a=angle*Math.PI/180,v=[-Math.sin(a),Math.cos(a),0],r=new THREE.Vector3(...v).applyQuaternion(q),expected=new THREE.Vector3(r.x,-r.z,r.y),actual=new THREE.Vector3(...thrustDirection(d.toArray(),v));assert.ok(actual.distanceTo(expected)<1e-12);}});
test('readiness flags loose parts and checkpoint restore cannot reactivate a floating engine',()=>{
 const {FlightSim}=require('../src/sim/flight'),{getMission}=require('../src/sim/missions'),{runReadiness}=require('../src/sim/readiness');
 const d=design();d.stack[2].position.x=30;
 assert.equal(runReadiness(d,getMission('first_orbit'),'amateur').checks.find(c=>c.id==='connections').status,'fail');
 const sim=new FlightSim({design:d,mission:getMission('first_orbit'),guidanceOn:false});sim.launch();const state=sim.serialize();for(const s of state.rt.sections)for(const e of s.engines)e.connected=true;sim.restore(state);assert.equal(thrustState(sim.rt,1,1).F,0);
});
test('launch leaves loose equipment out of the vessel mass, resources and owned parts',()=>{
 const {FlightSim}=require('../src/sim/flight'),{getMission}=require('../src/sim/missions'),{designStats}=require('../src/sim/design');
 const d=design(),baseline=new FlightSim({design:d,mission:getMission('first_orbit')});d.stack.push({uid:'parked',partId:'tank_k_37_s',position:{x:40,y:0,z:0}});
 const before=JSON.stringify(d),sim=new FlightSim({design:d,mission:getMission('first_orbit')});
 assert.equal(JSON.stringify(d),before);assert.equal(sim.design.stack.some(n=>n.uid==='parked'),false);assert.equal(sim.leftBehindDesign.stack[0].uid,'parked');assert.equal(runtimeMass(sim.rt),runtimeMass(baseline.rt));assert.equal(designStats(d).mass,runtimeMass(baseline.rt));
 sim.launch();sim.advance(1);assert.ok(sim.sections.every(s=>!s.uids.has('parked')));const state=sim.serialize(),restored=new FlightSim({design:sim.design,mission:getMission('first_orbit')});restored.restore(state);assert.equal(restored.leftBehindDesign.stack[0].uid,'parked');
});
test('guidance does not report insertion complete merely because thrust disappears',()=>{
 const {AscentGuidance}=require('../src/sim/guidance'),g=new AscentGuidance();g.phase='insert';const sim={cmd:{pitch:0,heading:90},v:[0,0,0],dir:[1,0,0],azimuth:90};
 g.update(sim,{mass:1000,Fmax:0,alt:200000,up:[1,0,0],north:[0,0,1],east:[0,1,0],vc:7800,q:0},.02);assert.equal(g.done,false);assert.equal(g.phase,'insert');assert.equal(sim.throttle,0);assert.match(g.holdReason,/Waiting for thrust/);
});
test('manual staging resets the automatic staging timer',()=>{
 const {FlightSim}=require('../src/sim/flight'),{getMission}=require('../src/sim/missions'),{presetFalconLike}=require('../src/sim/presets');const sim=new FlightSim({design:presetFalconLike(),mission:getMission('first_orbit')});sim.launch();sim.stageDelay=.99;sim.stage();assert.equal(sim.stageDelay,0);
});
test('completed insertion cuts thrust and holds actual attitude instead of turning prograde',()=>{
 const {AscentGuidance}=require('../src/sim/guidance'),g=new AscentGuidance();g.phase='insert';g.planeHeading=()=>90;const sim={cmd:{pitch:0,heading:90},v:[0,7800,0],dir:[1,0,0],azimuth:90};
 g.update(sim,{mass:1000,Fmax:10000,alt:200000,up:[1,0,0],north:[0,0,1],east:[0,1,0],vc:7800,q:0},.02);assert.equal(g.done,true);assert.equal(sim.throttle,0);assert.equal(sim.attMode,'hold');assert.deepEqual(sim.holdDir,sim.dir);assert.notEqual(sim.holdDir,sim.dir);
});
