require('../scripts/register.cjs');
const test=require('node:test'),assert=require('node:assert/strict');
const {newBlueprint,studioDrop,moveSelection,copySelection,deleteSelection,transformSelection}=require('../src/game/studioOps');
const {editorLayout,layoutDesign}=require('../src/sim/assemblyLayout');
const {designStats,createRuntime,applyEvent,thrustState}=require('../src/sim/design');
const {isValidDesign}=require('../src/sim/storage');
const {runReadiness}=require('../src/sim/readiness');
const {adviseDesign}=require('../src/sim/advisor');
const {MISSIONS}=require('../src/sim/missions');
const {FlightSim}=require('../src/sim/flight');
const {PARTS}=require('../src/sim/parts');
function drop(d,id,x,y,mirror=false){const r=studioDrop(d,id,{x,y},mirror,2,false);assert.ok(!r.error,r.error);return r;}
function rocket(){let d=newBlueprint();d=drop(d,'capsule_1',0,20).design;d=drop(d,'tank_k_37_s',0,20-PARTS.tank_k_37_s.height).design;d=drop(d,'eng_k1',0,20-PARTS.tank_k_37_s.height-PARTS.eng_k1.height).design;return d;}
test('blank blueprint saves safely, has finite stats and advice, and cannot launch',()=>{
 const d=newBlueprint();assert.ok(isValidDesign(d));assert.equal(designStats(d).mass,0);assert.equal(designStats(d).liftoffTWR,0);
 for(const mission of MISSIONS){const r=runReadiness(d,mission,'amateur');assert.equal(r.overall,'NO-GO');assert.ok(adviseDesign(d,r).length);}assert.throws(()=>new FlightSim({design:d,mission:MISSIONS[0]}),/Add parts/);
 assert.equal(isValidDesign({...d,editorDraft:false}),false);
});
test('free placement and movement preserve existing absolute coordinates instead of reflowing the stack',()=>{
 const d=rocket(),old=editorLayout(d).items;const r=drop(d,'probe_core',12,70);for(const n of old)assert.deepEqual(editorLayout(r.design).items.find(v=>v.uid===n.uid),n);
 const id=d.stack[0].uid,m=moveSelection(d,[id],7,-4),a=editorLayout(m).items.find(n=>n.uid===id),b=old.find(n=>n.uid===id);assert.equal(a.x-b.x,7);assert.equal(a.y-b.y,-4);assert.ok(isValidDesign(m));
});
test('mirrored tanks and engines provide two working side propulsion assemblies',()=>{
 let d=rocket();const y=editorLayout(d).items.find(n=>n.partId==='tank_k_37_s').y,before=designStats(d);d=drop(d,'tank_k_37_s',3.7,y,true).design;d=drop(d,'eng_k1',3.7,y-PARTS.eng_k1.height,true).design;
 assert.equal(d.stack.filter(n=>n.partId==='tank_k_37_s').length,3);assert.equal(d.stack.filter(n=>n.partId==='eng_k1').length,3);assert.ok(isValidDesign(d));
 const after=designStats(d);assert.ok(after.liftoffThrustSL>before.liftoffThrustSL*2.9);assert.ok(after.mass>before.mass);assert.ok(Math.abs(editorLayout(d).items.filter(n=>n.partId==='eng_k1').reduce((s,n)=>s+n.x,0))<1e-9);
 const rt=createRuntime(d);applyEvent(rt,'ignite-0');assert.ok(thrustState(rt,1,1).flows.length);
});
test('rectangle selection operations copy mount graphs, move children, transform and delete without damaging originals',()=>{
 let d=rocket();const y=editorLayout(d).items.find(n=>n.partId==='tank_k_37_s').y,r=drop(d,'tank_k_37_s',5,y);d=r.design;const e=drop(d,'eng_k1',5,y-PARTS.eng_k1.height);d=e.design;
 const c=copySelection(d,[r.uid]);assert.equal(c.ids.length,2);assert.ok(isValidDesign(c.design));const copiedEngine=c.design.stack.find(n=>c.ids.includes(n.uid)&&n.partId==='eng_k1');assert.ok(c.ids.includes(copiedEngine.mount.parentUid));
 const moved=moveSelection(c.design,c.ids,8,3),rotated=transformSelection(moved,c.ids,'rotate');assert.ok(isValidDesign(rotated));assert.equal(rotated.stack.find(n=>n.uid===copiedEngine.uid).rotation,270);assert.equal(deleteSelection(rotated,c.ids).stack.length,d.stack.length);assert.equal(deleteSelection(d,d.stack.map(n=>n.uid)).stack.length,0);
});
test('engine rotation changes physical thrust direction and prevents upside-down liftoff',()=>{
 const d=rocket(),engine=d.stack.find(n=>n.partId==='eng_k1');function force(rotation){const design={...d,stack:d.stack.map(n=>n.uid===engine.uid?{...n,rotation,...(rotation===90?{position:{...n.position,y:n.position.y+(PARTS[n.partId].height-PARTS[n.partId].diameter)/2}}:{})}:n)},rt=createRuntime(design);applyEvent(rt,'ignite-0');return {design,force:thrustState(rt,1,1)};}
 const upright=force(0).force,side=force(90).force,reverse=force(180);assert.ok(upright.axial>0);assert.ok(Math.abs(side.axial)<1e-6);assert.ok(side.forceBody[0]<0);assert.ok(reverse.force.axial<0);assert.ok(reverse.force.flows.length);
 const sim=new FlightSim({design:reverse.design,mission:MISSIONS[0],guidanceOn:false});sim.launch();sim.step(.1);assert.equal(sim.clamped,true);
});
test('landing gear deployment and all new parts survive save/import and physical layout normalization',()=>{
 let d=rocket();d=drop(d,'landing_leg',2.1,12,true).design;d={...d,stack:d.stack.map(n=>n.partId==='landing_leg'?{...n,deployed:true}:n)};assert.ok(isValidDesign(JSON.parse(JSON.stringify(d))));assert.equal(createRuntime(d).sections.reduce((s,n)=>s+n.legs,0),2);
 for(const id of ['nose_37','nose_slanted_37','rcs_block','truss_separator_37'])assert.ok(PARTS[id]);const l=layoutDesign(d);assert.equal(Math.min(...l.items.map(n=>n.y)),0);
 assert.equal(isValidDesign({...d,stack:d.stack.map((n,i)=>i? n:{...n,position:{x:NaN,y:0,z:0}})}),false);
});
test('deployed paired legs allow slow upright touchdown, while folded legs and hard impacts crash',()=>{
 const {EARTH}=require('../src/sim/constants');
 for(const [deployed,speed,expected]of [[true,1,'landed'],[false,1,'crashed'],[true,20,'crashed']]){
  const d=rocket();const tank=d.stack.find(n=>PARTS[n.partId].propellant);d.stack.push(...[-1,1].map((side,i)=>({uid:'foot-'+i,partId:'landing_leg',deployed,position:{x:side*2.1,y:tank.position.y,z:0},mount:{parentUid:tank.uid,x:side*2.1,y:0,z:0}})));
  const sim=new FlightSim({design:d,mission:MISSIONS[0],guidanceOn:false});sim.status='flight';sim.clamped=false;sim.throttle=0;sim.r=[EARTH.radius-.1,0,0];sim.v=[-speed,EARTH.rotationRate*sim.r[0],0];sim.dir=[1,0,0];sim.nav=sim.computeNav();sim.step(.01);assert.equal(sim.status,expected);assert.ok(sim.isEnded());
 }
});
test('mixed legacy/editor assemblies fill missing poses before moving, and deleting a solid group preserves its core',()=>{
 const d=rocket();d.stack.push({uid:'legacy-pose',partId:'probe_core'});assert.doesNotThrow(()=>moveSelection(d,['legacy-pose'],2,3));
 const {presetBoosted}=require('../src/sim/presets');const p=presetBoosted();assert.ok(p.radials.length);const deleted=deleteSelection(p,[p.radials[0].uid]);assert.equal(deleted.stack.length,p.stack.length);assert.equal(deleted.radials.length,p.radials.length-1);
});

test('exploration adapter rejects rotated engines instead of silently adding their scalar thrust',()=>{
 const {explorationStarter,hangarCraft}=require('../src/sim/hangarCraft');const d=explorationStarter();d.stack=d.stack.map(n=>PARTS[n.partId].engine?{...n,rotation:180}:n);assert.throws(()=>hangarCraft(d),/aligned engines/);
});
test('lunar touchdown uses the Moon-relative surface normal',()=>{
 const {moonState,MOON}=require('../src/sim/bodies'),{add}=require('../src/sim/vec');const d=rocket();const tank=d.stack.find(n=>PARTS[n.partId].propellant);d.stack.push(...[-1,1].map((side,i)=>({uid:'lunar-foot-'+i,partId:'landing_leg',deployed:true,position:{x:side*2.1,y:tank.position.y,z:0},mount:{parentUid:tank.uid,x:side*2.1,y:0,z:0}})));
 const s=new FlightSim({design:d,mission:MISSIONS.find(m=>m.moon),guidanceOn:false});const moon=moonState(0,s.eph);s.status='flight';s.clamped=false;s.throttle=0;s.r=add(moon.r,[0,MOON.radius-.1,0]);s.v=add(moon.v,[0,-1,0]);s.dir=[0,1,0];s.nav=s.computeNav();assert.equal(s.nav.body,'moon');s.step(.01);assert.equal(s.status,'landed');
});
test('magnetic moves snap edge-to-edge, preserve children and allow an exact unsnapped override',()=>{
 const {magneticTranslation,magnetMove}=require('../src/game/studioOps');let d=rocket();const anchor=editorLayout(d).items.find(n=>n.partId==='tank_k_37_s'),r=drop(d,'tank_k_37_s',12,anchor.y+4);d=r.design;const e=drop(d,'eng_k1',12,anchor.y+4-PARTS.eng_k1.height);d=e.design;
 const move=magneticTranslation(d,[r.uid],-8, -3.7);assert.ok(move.targetUid);const moved=magnetMove(d,[r.uid],-8,-3.7),items=editorLayout(moved).items,tank=items.find(n=>n.uid===r.uid),engine=items.find(n=>n.uid===e.uid);
 assert.ok(Math.abs(tank.x-3.7)<1e-9);assert.equal(tank.y,anchor.y);assert.equal(engine.x,tank.x);assert.ok(Math.abs(engine.y+engine.height-tank.y)<1e-9);assert.ok(isValidDesign(moved));
 const free=magnetMove(d,[r.uid],-8,-3.7,false);assert.equal(editorLayout(free).items.find(n=>n.uid===r.uid).x,4);assert.equal(magneticTranslation(d,d.stack.map(n=>n.uid),1.2,2.3).dx,1.2);
});
test('a side engine moved to another tank magnetically reconnects to that tank',()=>{
 const {magnetMove}=require('../src/game/studioOps');let d=rocket(),a=drop(d,'tank_k_37_s',10,10);d=a.design;const b=drop(d,'tank_k_37_s',20,10);d=b.design;const e=drop(d,'eng_k1',10,10-PARTS.eng_k1.height);d=e.design;
 const moved=magnetMove(d,[e.uid],9.6,.2);assert.equal(moved.stack.find(n=>n.uid===e.uid).mount.parentUid,b.uid);assert.equal(editorLayout(moved).items.find(n=>n.uid===e.uid).x,20);assert.ok(isValidDesign(moved));
});
test('launch scenery uses finite instanced geometry with a small draw-call budget',()=>{
 const {buildLaunchStation}=require('../src/three/launchStation');for(const quality of ['low','high']){const site=buildLaunchStation(85,quality);assert.ok(site.userData.instancedBatches<=20);let count=0;site.traverse(o=>{if(o.isInstancedMesh){count+=o.count;assert.ok([...o.instanceMatrix.array].every(Number.isFinite));}});assert.ok(count>150);site.traverse(o=>{o.geometry?.dispose();o.material?.dispose();});}
});
test('3D selection uses black edges without a glow or accumulating outlines across frames',()=>{
 const THREE=require('three'),{setHighlight}=require('../src/three/partMeshes');const root=new THREE.Group(),mesh=new THREE.Mesh(new THREE.BoxGeometry(1,2,1),new THREE.MeshStandardMaterial());mesh.userData.uid='selected';root.add(mesh);
 setHighlight(root,'selected');assert.equal(mesh.children.length,1);assert.equal(mesh.children[0].material.color.getHex(),0x111111);assert.equal(mesh.material.emissiveIntensity,0);const outline=mesh.children[0];setHighlight(root,'selected');assert.equal(mesh.children[0],outline);setHighlight(root,null);assert.equal(mesh.children.length,0);mesh.geometry.dispose();mesh.material.dispose();
});
