require('./register.cjs');
const assert=require('node:assert/strict'),fs=require('node:fs');
const {browserSession}=require('./browser-session.cjs');
(async()=>{
 const b=await browserSession(),touch=(type,points)=>b.call('Input.dispatchTouchEvent',{type,touchPoints:points.map(p=>({...p,radiusX:5,radiusY:5,force:1}))});
 const design=async()=>{await b.pause(250);return b.evaluate("(()=>{window.missionForgeData.flush();return JSON.parse(localStorage.getItem('mf.autosave')).design})()");};
 try{
  await b.viewport(390,844);await b.call('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:5});await b.home();await b.evaluate("localStorage.clear();localStorage.setItem('mf.settings',JSON.stringify({graphics:'low',reduceMotion:true}));window.missionForgeData.flush()");await b.home();
  await b.click('menu-new-mission-btn');await b.click('mission-card-first_orbit');await b.click('planner-open-hangar-btn');const before=await design();
  await b.evaluate("document.querySelector('[data-testid=part-catalog-item-probe_core]').scrollIntoView({block:'center'})");
  const start=await b.evaluate("(()=>{const r=document.querySelector('[data-testid=part-catalog-item-probe_core]').getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2,id:1}})()");
  const end=await b.evaluate("(()=>{const r=document.querySelector('[data-testid=assembly-placement-grid]').getBoundingClientRect();return {x:r.x+r.width*.72,y:r.y+r.height*.55,id:1}})()");
  await touch('touchStart',[start]);await touch('touchEnd',[]);await b.wait("!document.querySelector('[data-testid=held-part]')");
  await touch('touchStart',[end]);await touch('touchEnd',[]);assert.deepEqual(await design(),before,'Tap then tap grid must not place a part');
  await touch('touchStart',[start]);await touch('touchMove',[{x:start.x+85,y:start.y,id:1}]);await touch('touchMove',[{x:380,y:30,id:1}]);await touch('touchEnd',[]);await b.wait("!document.querySelector('[data-testid=held-part]')");assert.deepEqual(await design(),before,'Drop outside grid must cancel');
  await touch('touchStart',[start]);await b.wait(b.exists('held-part'));const carry={x:start.x+85,y:start.y,id:1};await touch('touchMove',[carry]);
  await touch('touchStart',[carry,{x:end.x,y:end.y-30,id:2}]);await touch('touchEnd',[{x:end.x,y:end.y-30,id:2}]);assert.deepEqual(await design(),before,'Releasing a second finger must not drop the first finger’s part');
  for(let i=1;i<=8;i++){await touch('touchMove',[{x:carry.x+(end.x-carry.x)*i/8,y:carry.y+(end.y-carry.y)*i/8,id:1}]);await b.pause(20);}await touch('touchEnd',[]);await b.wait("!document.querySelector('[data-testid=held-part]')");
  const after=await design();assert.equal(after.stack.length,before.stack.length+1);assert.ok(after.stack.at(-1).mount);
  const vb=()=>b.evaluate("document.querySelector('[data-testid=assembly-placement-grid]').getAttribute('viewBox')");let view=await vb();
  const r=await b.evaluate("(()=>{const r=document.querySelector('[data-testid=assembly-placement-grid]').getBoundingClientRect();return {x:r.left+r.width/2,y:r.top+r.height*.6}})()");
  await touch('touchStart',[{x:r.x-25,y:r.y,id:1}]);await touch('touchStart',[{x:r.x-25,y:r.y,id:1},{x:r.x+25,y:r.y,id:2}]);await touch('touchMove',[{x:r.x-55,y:r.y,id:1},{x:r.x+55,y:r.y,id:2}]);await touch('touchEnd',[]);await b.pause(200);assert.notEqual(await vb(),view);assert.deepEqual(await design(),after);
  console.log('PASS: native phone drag/drop; tap-to-place rejected, outside drops cancel, second-finger release ignored, and pinch preserves equipment');
  const tall={name:'Tall inspection test',stack:['probe_core',...Array(32).fill('tank_k_37_s'),'eng_k1'].map((partId,i)=>({partId,uid:'tall-'+i})),radials:[],events:null};fs.writeFileSync('/tmp/mf-tall-placement.json',JSON.stringify(tall));await b.upload('[data-testid=hangar-import-input]',['/tmp/mf-tall-placement.json']);await b.click('assembly-fit');
  const bounds=await b.evaluate("(()=>{const s=document.querySelector('[data-testid=assembly-placement-grid]'),r=s.getBoundingClientRect();return [document.querySelector('[data-testid=blueprint-part-tall-0]'),document.querySelector('[data-testid=blueprint-part-tall-33]')].map(e=>{const q=e.getBoundingClientRect();return q.top>=r.top&&q.bottom<=r.bottom})})()");assert.ok(bounds.every(Boolean));
  for(let i=0;i<3;i++)await b.click('assembly-zoom-in');view=await vb();const p=await b.evaluate("(()=>{const r=document.querySelector('[data-testid=assembly-placement-grid]').getBoundingClientRect();return {x:r.right-75,y:r.top+r.height/2}})()");
  await b.call('Input.dispatchMouseEvent',{type:'mouseWheel',...p,deltaX:0,deltaY:180});await b.pause(200);assert.notEqual(await vb(),view);await b.click('assembly-fit');await b.screenshot('tall-assembly-phone');
  await b.evaluate("document.querySelector('[data-testid=blueprint-part-tall-33]').dispatchEvent(new MouseEvent('click',{bubbles:true}))");await b.wait(b.exists('duplicate-selected-btn'));
  console.log('PASS: tall rocket fits with top and engine visible; zoom, scroll pan, Fit and assistive click selection work');assert.deepEqual(b.errors,[]);
 }finally{b.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
