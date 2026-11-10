require('../scripts/register.cjs');
const test=require('node:test'),assert=require('node:assert/strict'),THREE=require('three');
const {profileFraming,profileBasis}=require('../src/three/profileCamera');
const {createRecoveryVisuals,updateRecoveryVisuals}=require('../src/three/recoveryVisuals');
const {paletteAnchor}=require('../src/game/studioOps');
const {PARTS}=require('../src/sim/parts');
test('side camera fits tall and wide craft inside edge-control margins across device sizes',()=>{
 for(const [w,h]of [[320,568],[390,844],[844,390],[1440,1000]])for(const [height,width]of [[60,5],[8,40],[1,1]]){
  const f=profileFraming(height,width,w,h);assert.ok(Number.isFinite(f.distance)&&f.distance>0);assert.ok(height/f.span*h<=Math.max(h*.5,h-240)+1e-8);assert.ok(width/f.span*h<=Math.max(w*.45,w-150)+1e-8);assert.ok(Math.abs(2*f.distance*Math.tan(f.fov*Math.PI/360)-f.span)<1e-8);
 }
});
test('side basis remains orthonormal at both poles and arbitrary launch sites',()=>{
 for(const up of [new THREE.Vector3(0,1,0),new THREE.Vector3(0,-1,0),new THREE.Vector3(1,2,3),new THREE.Vector3()])for(const heading of [0,90,180,270]){const b=profileBasis(up,heading);for(const v of Object.values(b))assert.ok(Math.abs(v.length()-1)<1e-12);assert.ok(Math.abs(b.up.dot(b.right))<1e-12);assert.ok(Math.abs(b.normal.dot(b.right))<1e-12);}
});
test('every palette part is carried by its center without changing simulation geometry',()=>{for(const [id,p]of Object.entries(PARTS)){const point={x:7,y:20},a=paletteAnchor(id,point);assert.equal(a.x,7);assert.equal(a.y+p.height/2,20);assert.deepEqual(point,{x:7,y:20});}});
test('recovery rendering follows stowed, inflating, main and failed chute states without mutating inputs',()=>{
 const root=createRecoveryVisuals(),options={state:'stowed',time:0,chuteTime:0,top:5,bottom:0,bodyWidth:3,flux:0},copy=JSON.stringify(options);
 assert.equal(updateRecoveryVisuals(root,options).chute,false);assert.equal(JSON.stringify(options),copy);
 const a=updateRecoveryVisuals(root,{...options,state:'drogue',time:1}),b=updateRecoveryVisuals(root,{...options,state:'main',time:8});assert.ok(a.chute&&b.chute&&b.top>a.top&&b.width>a.width);assert.ok([...root.userData.rigging.geometry.attributes.position.array].every(Number.isFinite));
 assert.equal(updateRecoveryVisuals(root,{...options,state:'failed'}).chute,false);assert.equal(updateRecoveryVisuals(root,{...options,flux:1e6}).heat,true);assert.equal(updateRecoveryVisuals(root,options).heat,false);
 root.traverse(n=>{n.geometry?.dispose();n.material?.dispose();});
});
test('solid booster groups follow an off-axis core instead of staying at the origin',()=>{
 const {presetBoosted}=require('../src/sim/presets'),{layoutDesign}=require('../src/sim/assemblyLayout');const d=presetBoosted(),parent=d.stack.find(n=>n.uid===d.radials[0].parentUid);parent.position={x:12,y:10,z:4};const l=layoutDesign(d),core=l.items.find(n=>n.uid===parent.uid);assert.equal(l.radials.length,2);assert.ok(Math.abs(l.radials.reduce((s,n)=>s+n.x,0)/2-core.x)<1e-10);assert.ok(Math.abs(l.radials.reduce((s,n)=>s+n.z,0)/2-core.z)<1e-10);
});

test('map trajectory retains its world curve and sub-metre detail without replacing geometry', () => {
  const {FlightPath} = require('../src/three/flightPath');
  const path = new FlightPath(3), craft = [6371000.123, 0, 0];
  path.setTarget([craft, [craft[0]+.125,1,2], [craft[0]+.25,2,4]], 'earth');
  const geometry=path.geometry, buffer=path.positions.array;
  path.update(0, craft);
  assert.ok(Math.abs(buffer[3]-.125)<1e-6);
  path.update(0, [craft[0]+.01,0,0]);
  assert.ok(Math.abs(buffer[0]+.01)<1e-6, 'Do not splice the old curve onto the moving craft');
  assert.ok(Math.abs(buffer[3]-.115)<1e-6);
  assert.equal(path.geometry,geometry);assert.equal(path.positions.array,buffer);
});

test('map forecasts replace changed topology without inventing intermediate curves', () => {
  const {FlightPath}=require('../src/three/flightPath');const path=new FlightPath(3);
  path.setTarget([[0,0,0],[10,0,0]],'earth');path.update(0,[0,0,0]);
  path.setTarget([[0,0,0],[0,10,0]],'earth');path.update(0,[0,0,0]);
  assert.equal(path.positions.array[3],0);assert.equal(path.positions.array[5],-5);
  path.setTarget([[100,0,0],[110,0,0]],'moon');path.update(0,[200,0,0],[100,0,0]);
  assert.equal(path.positions.array[3],5);path.reset();assert.equal(path.line.visible,false);
});

test('close-up trajectory starts fresh each frame through velocity changes and staging', () => {
  const {FlightPath}=require('../src/three/flightPath');const path=new FlightPath(21);
  const geometry=path.geometry;
  for(const velocity of [[0,200,0],[800,1600,30],[-40,0,0],[0,0,0],[11000,0,0]]) {
    const before=velocity.slice();path.updateLocal(velocity,[0,-9.8,0]);
    assert.deepEqual([...path.positions.array.slice(0,3)],[0,0,0]);
    assert.ok([...path.positions.array].every(Number.isFinite));
    assert.equal(path.geometry,geometry);assert.deepEqual(velocity,before);
    const [x,z,ny]=path.positions.array.slice(3,6);
    if(Math.hypot(...velocity)>0)assert.ok(x*velocity[0]-ny*velocity[1]+z*velocity[2]>0,'First segment follows the live velocity');
    assert.equal(path.geometry.drawRange.start,0);assert.equal(path.geometry.drawRange.count,21);
  }
});

test('an actual stage separation cannot jump the local forecast without a velocity change', () => {
  const {FlightPath}=require('../src/three/flightPath');
  const {FlightSim}=require('../src/sim/flight');
  const {presetFalconLike}=require('../src/sim/presets');
  const {getMission}=require('../src/sim/missions');
  const {DEFAULT_PROFILE}=require('../src/sim/guidance');
  const {gravity}=require('../src/sim/bodies');
  const sim=new FlightSim({design:presetFalconLike(),mission:getMission('first_orbit'),difficulty:'amateur',profile:DEFAULT_PROFILE});
  sim.launch();sim.advance(60);sim.advance(60);
  const path=new FlightPath(),r=sim.r.slice(),v=sim.v.slice(),stage=sim.rt.eventIndex;
  path.updateLocal(sim.v,gravity(sim.r,sim.t,sim.eph));
  const before=path.positions.array.slice();
  sim.stage();assert.ok(sim.rt.eventIndex>stage);
  assert.deepEqual(sim.r,r);assert.deepEqual(sim.v,v);
  path.updateLocal(sim.v,gravity(sim.r,sim.t,sim.eph));
  assert.deepEqual(path.positions.array,before);
});
