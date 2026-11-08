require('../scripts/register.cjs');
const test=require('node:test'),assert=require('node:assert/strict');
const {placePart,dropPart,movePlacedPart,removePart}=require('../src/game/designOps');
const {designStats,createRuntime,applyEvent,thrustState,consume,runtimeMass,buildSections}=require('../src/sim/design');
const {layoutDesign,validMounts}=require('../src/sim/assemblyLayout');
const {isValidDesign}=require('../src/sim/storage');
const {presetFalconLike}=require('../src/sim/presets');
const {PARTS}=require('../src/sim/parts');
const {captureStage,appendSubassembly}=require('../src/game/subassemblies');
const {geometryAnalysis}=require('../src/sim/advanced/geometry');
function sideAssembly(){
 const original=presetFalconLike(),parent=original.stack.find(n=>n.partId==='tank_k_37_l')||original.stack.at(-2),base=layoutDesign(original).items.find(n=>n.uid===parent.uid);
 const tank=placePart(original,'tank_k_37_s',parent.uid,{x:5,y:base.y});assert.ok(tank.design);
 const engine=placePart(tank.design,'eng_k1',tank.uid,{x:5,y:base.y-PARTS.eng_k1.height});assert.ok(engine.design);
 return {original,tank,engine,design:engine.design};
}
test('side tanks and engines add real fuel, dry mass, cost and liftoff thrust',()=>{
 const {original,design}=sideAssembly(),before=designStats(original),after=designStats(design);
 assert.equal(after.mass-before.mass,PARTS.tank_k_37_s.dryMass+PARTS.tank_k_37_s.propellant.mass+PARTS.eng_k1.dryMass);
 assert.ok(after.liftoffThrustSL>before.liftoffThrustSL);assert.equal(after.stageCount,before.stageCount);
 const rt=createRuntime(design);applyEvent(rt,'ignite-0');const force=thrustState(rt,1,1),mass=runtimeMass(rt);consume(rt,force.flows,.1);assert.ok(runtimeMass(rt)<mass);
});
test('side assembly inherits its parent stage and separates with it',()=>{
 const {tank,engine,design}=sideAssembly(),sections=buildSections(design),s=sections.find(s=>s.uids.has(tank.uid));
 assert.ok(s.uids.has(engine.uid));const rt=createRuntime(design);applyEvent(rt,'ignite-0');applyEvent(rt,'sep-1');assert.equal(rt.sections[s.index].attached,false);
});
test('placed geometry is shared by preview and engineering mass/thrust centres',()=>{
 const {original,tank,engine,design}=sideAssembly(),layout=layoutDesign(design),a=layout.items.find(n=>n.uid===tank.uid),b=layout.items.find(n=>n.uid===engine.uid);
 assert.equal(a.x,5);assert.equal(b.x,5);assert.ok(Math.abs(b.y+b.height-a.y)<1e-9);
 assert.ok(geometryAnalysis(design,layout).wetCOM[0]>geometryAnalysis(original,layoutDesign(original)).wetCOM[0]);
});
test('placed parts survive save/import and reusable stage remapping',()=>{
 const {tank,design}=sideAssembly();assert.ok(isValidDesign(JSON.parse(JSON.stringify(design))));
 const stage=captureStage(design,tank.uid,'Side engines'),copy=appendSubassembly(design,stage);assert.ok(isValidDesign(copy));
 const old=new Set(design.stack.map(n=>n.uid));for(const n of copy.stack.filter(n=>!old.has(n.uid)&&n.mount))assert.ok(!old.has(n.mount.parentUid));
});
test('moving a tank carries connected engines; removing it removes only its descendants',()=>{
 const {tank,engine,design}=sideAssembly(),old=layoutDesign(design).items.find(n=>n.uid===engine.uid);
 const moved=movePlacedPart(design,tank.uid,{x:8,y:20});assert.ok(moved.design);
 assert.equal(layoutDesign(moved.design).items.find(n=>n.uid===engine.uid).x-old.x,3);
 const removed=removePart(design,tank.uid);assert.ok(!removed.stack.some(n=>[tank.uid,engine.uid].includes(n.uid)));assert.ok(isValidDesign(removed));
});
test('invalid mounts reject cycles, missing parents, infinities and mounted stage separators',()=>{
 const {tank,engine,design}=sideAssembly();for(const mount of [{parentUid:engine.uid,x:0,y:0,z:0},{parentUid:'missing',x:0,y:0,z:0},{parentUid:design.stack[0].uid,x:Infinity,y:0,z:0}]){
  const d={...design,stack:design.stack.map(n=>n.uid===tank.uid?{...n,mount}:n)};assert.equal(validMounts(d),false);assert.equal(isValidDesign(d),false);
 }
});
test('drop location infers central versus side attachment without choosing a mode',()=>{
 const d=presetFalconLike(),layout=layoutDesign(d),bottom=layout.items.find(n=>n.uid===d.stack.at(-1).uid);
 const axial=dropPart(d,'tank_k_37_s',{x:0,y:bottom.y-PARTS.tank_k_37_s.height});assert.ok(axial.design);assert.equal(axial.design.stack.find(n=>n.uid===axial.uid).mount,undefined);
 const far=dropPart(d,'tank_k_37_s',{x:0,y:layout.height+20});assert.ok(far.design.stack.find(n=>n.uid===far.uid).mount);
 const side=dropPart(d,'tank_k_37_s',{x:6,y:layout.height/2});assert.ok(side.design.stack.find(n=>n.uid===side.uid).mount);
});

test('single-stage exploration transfer preserves placed geometry and added propulsion',()=>{
 const {explorationStarter,hangarCraft}=require('../src/sim/hangarCraft');
 const starter=explorationStarter(),layout=layoutDesign(starter),parent=layout.items.find(n=>n.partId==='tank_k_37_s');
 const tank=placePart(starter,'tank_k_37_s',parent.uid,{x:5,y:parent.y});
 const engine=placePart(tank.design,'eng_kv',tank.uid,{x:5,y:parent.y-PARTS.eng_kv.height});
 const before=hangarCraft(starter),after=hangarCraft(engine.design);
 assert.ok(after.fuel>before.fuel&&after.thrust>before.thrust);assert.ok(isValidDesign(after.design));
 assert.deepEqual(after.design.stack.find(n=>n.uid===engine.uid).mount,engine.design.stack.find(n=>n.uid===engine.uid).mount);
});
