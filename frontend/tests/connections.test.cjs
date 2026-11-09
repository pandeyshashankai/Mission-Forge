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
