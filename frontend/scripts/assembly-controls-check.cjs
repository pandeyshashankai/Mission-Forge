require('./register.cjs');
const assert=require('node:assert/strict'),fs=require('node:fs');
const {browserSession}=require('./browser-session.cjs');
const {layoutDesign}=require('../src/sim/assemblyLayout');
const {designStats}=require('../src/sim/design');
const {PARTS}=require('../src/sim/parts');
(async()=>{
 const b=await browserSession();
 const mouse=(type,p,more={})=>b.call('Input.dispatchMouseEvent',{type,...p,...more});
 const saved=async()=>{await b.pause(400);return b.evaluate("(()=>{window.missionForgeData.flush();return JSON.parse(localStorage.getItem('mf.autosave')).design})()");};
 const gridPoint=async(x,y)=>b.evaluate(`(()=>{const s=document.querySelector('[data-testid=assembly-placement-grid]'),p=s.createSVGPoint();p.x=${x};p.y=${-y};const q=p.matrixTransform(s.getScreenCTM());return {x:q.x,y:q.y}})()`);
 const dragPalette=async(id,x,y)=>{
  await b.evaluate(`document.querySelector('[data-testid=part-catalog-item-${id}]').scrollIntoView({block:'center'})`);await b.pause(200);
  const start=await b.evaluate(`(()=>{const r=document.querySelector('[data-testid=part-catalog-item-${id}]').getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()`);
  await mouse('mousePressed',start,{button:'left',clickCount:1});await b.wait(b.exists('held-part'));await b.pause(200);const end=await gridPoint(x,y);
  for(let i=1;i<=8;i++){await mouse('mouseMoved',{x:start.x+(end.x-start.x)*i/8,y:start.y+(end.y-start.y)*i/8},{button:'left',buttons:1});await b.pause(20);}
  await mouse('mouseReleased',end,{button:'left',clickCount:1});await b.wait("!document.querySelector('[data-testid=held-part]')");
 };
 try{
  await b.call('Network.enable');await b.call('Network.clearBrowserCache');await b.call('Network.setCacheDisabled',{cacheDisabled:true});await b.call('Emulation.setTouchEmulationEnabled',{enabled:false});
  await b.viewport(1440,1000);await b.home();await b.evaluate("localStorage.clear();localStorage.setItem('mf.settings',JSON.stringify({graphics:'low',touchControls:'auto',reduceMotion:true}));window.missionForgeData.flush()");await b.home();
  await b.click('menu-new-mission-btn');await b.click('mission-card-first_orbit');await b.click('planner-open-hangar-btn');
  const original=await saved(),layout=layoutDesign(original),parent=layout.items.find(n=>n.partId==='tank_k_37_l')||layout.items.at(-2);
  assert.equal(await b.evaluate("!!document.querySelector('[data-testid=attach-mode-above]')"),false);
  await dragPalette('tank_k_37_s',6,parent.y);let d=await saved(),tank=d.stack.find(n=>!original.stack.some(o=>o.uid===n.uid));assert.ok(tank.mount);assert.equal(d.stack.length,original.stack.length+1);
  await dragPalette('eng_k1',6,parent.y-PARTS.eng_k1.height);d=await saved();const engine=d.stack.find(n=>n.mount?.parentUid===tank.uid);assert.ok(engine);assert.ok(designStats(d).liftoffThrustSL>designStats(original).liftoffThrustSL);console.log('PASS: native palette drag creates side tank and connected liquid engine with increased real thrust');
  const item=layoutDesign(d).items.find(n=>n.uid===tank.uid),start=await gridPoint(item.x,item.y+item.height/2),end={x:start.x+35,y:start.y-20};
  await mouse('mousePressed',start,{button:'left',clickCount:1});await mouse('mouseMoved',end,{button:'left',buttons:1});await mouse('mouseReleased',end,{button:'left',clickCount:1});
  const moved=await saved();assert.notEqual(moved.stack.find(n=>n.uid===tank.uid).mount.x,tank.mount.x);assert.ok(moved.stack.some(n=>n.uid===engine.uid));
  const vb=()=>b.evaluate("document.querySelector('[data-testid=assembly-placement-grid]').getAttribute('viewBox')");let before=await vb();await b.click('assembly-zoom-in');assert.notEqual(await vb(),before);await b.click('assembly-fit');before=await vb();
  const blank=await b.evaluate("(()=>{const r=document.querySelector('[data-testid=assembly-placement-grid]').getBoundingClientRect();return {x:r.left+10,y:r.top+r.height*.7}})()");await mouse('mousePressed',blank,{button:'left',clickCount:1});await mouse('mouseMoved',{x:blank.x,y:blank.y-70},{button:'left',buttons:1});await mouse('mouseReleased',{x:blank.x,y:blank.y-70},{button:'left',clickCount:1});await b.pause(200);assert.notEqual(await vb(),before);await b.click('assembly-fit');console.log('PASS: placed assembly drags, grid pans/zooms and Fit restores whole craft');
  await b.screenshot('free-placement-desktop');
  await b.click('save-design-btn');await b.home();await b.click('menu-continue-btn');const restored=await saved();assert.ok(restored.stack.some(n=>n.uid===engine.uid&&n.mount));
  await b.viewport(390,844);await b.click('workspace-blueprint');await b.click('assembly-zoom-in');await b.click('assembly-fit');assert.ok(await b.evaluate("(()=>{const r=document.querySelector('[data-testid=assembly-placement-grid]').getBoundingClientRect();return r.width>180&&r.height>200})()"));await b.screenshot('free-placement-phone');
  await b.viewport(1440,1000);await b.click('open-readiness-btn');await b.click('proceed-to-launch-btn');await b.click('start-countdown-btn');await b.wait(b.exists('cockpit-pause'),25000);await b.click('cockpit-pause');
  for(const id of ['cockpit-throttle','touch-throttleUp','touch-throttleDown','touch-fullThrottle','touch-cutThrottle','touch-guidance','touch-stage','cockpit-fuel'])assert.ok(await b.evaluate(b.exists(id)),id+' missing on default desktop');
  assert.match(await b.evaluate("document.querySelector('[data-testid=touch-throttleUp] kbd').textContent"),/Shift/);
  assert.ok(await b.evaluate("getComputedStyle(document.querySelector('[data-testid=touch-throttleUp] kbd')).display!=='none'"));
  await b.click('display-settings-btn');await b.click('settings-tab-controls');await b.click('binding-throttleUp');await b.call('Input.dispatchKeyEvent',{type:'keyDown',code:'KeyU',key:'u'});await b.call('Input.dispatchKeyEvent',{type:'keyUp',code:'KeyU',key:'u'});await b.click('settings-done');assert.equal(await b.evaluate("document.querySelector('[data-testid=touch-throttleUp] kbd').textContent"),'U');
  await b.screenshot('desktop-controls-with-keys');console.log('PASS: desktop Auto shows throttle/percentage, +/-/full/cut, guidance and stage fuel; key hints follow remapping');
  await b.click('cockpit-pause');await b.click('time-warp-10');await b.wait(b.exists('complete-mission-btn'),300000);await b.click('complete-mission-btn');await b.wait(b.exists('results-outcome'));assert.match(await b.evaluate("document.querySelector('[data-testid=results-outcome]').textContent"),/success/i);console.log('PASS: side-tank/side-engine design completes guided orbital flight and report');
  assert.deepEqual(b.errors,[]);
 }finally{b.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
