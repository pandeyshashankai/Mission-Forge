require('./register.cjs');
const assert=require('node:assert/strict'),fs=require('node:fs');
const {browserSession}=require('./browser-session.cjs');
const fixture={name:'Magnetic assembly audit',editorLayout:true,stack:[
 {uid:'core',partId:'probe_core',position:{x:0,y:24,z:0}},
 {uid:'tank-a',partId:'tank_k_37_s',position:{x:0,y:16,z:0}},
 {uid:'engine-a',partId:'eng_k1',position:{x:0,y:13.5,z:0}},
 {uid:'tank-b',partId:'tank_k_37_s',position:{x:12,y:16,z:0},mount:{parentUid:'tank-a',x:12,y:0,z:0}},
 {uid:'engine-b',partId:'eng_k1',position:{x:12,y:13.5,z:0},mount:{parentUid:'tank-b',x:0,y:-2.5,z:0}},
],radials:[],events:null};
(async()=>{
 const b=await browserSession(),world=async(x,y)=>b.evaluate(`(()=>{const s=document.querySelector('[data-testid=assembly-placement-grid]'),p=s.createSVGPoint();p.x=${x};p.y=${-y};const q=p.matrixTransform(s.getScreenCTM());return {x:q.x,y:q.y}})()`);
 const read=async()=>{await b.pause(200);return b.evaluate("(()=>{window.missionForgeData.flush();return JSON.parse(localStorage.getItem('mf.autosave')).design})()");};
 try{
  await b.call('Network.enable');await b.call('Network.emulateNetworkConditions',{offline:false,latency:0,downloadThroughput:-1,uploadThroughput:-1});await b.viewport(1440,1000);await b.home();await b.evaluate("localStorage.clear();localStorage.setItem('mf.settings',JSON.stringify({graphics:'medium',reduceMotion:true}));window.missionForgeData.flush()");await b.home();await b.click('menu-new-mission-btn');await b.click('mission-card-first_orbit');await b.click('planner-open-hangar-btn');
  fs.writeFileSync('/tmp/mf-magnet-fixture.json',JSON.stringify(fixture));
  for(const touch of [false,true]){
   await b.viewport(touch?390:1440,touch?844:1000);await b.call('Emulation.setTouchEmulationEnabled',{enabled:touch,maxTouchPoints:5});await b.upload('[data-testid=hangar-import-input]',['/tmp/mf-magnet-fixture.json']);await b.click('assembly-fit');
   const start=await world(12,19),end=await world(4.1,19.25);
   const pointer=async(type,p)=>touch?b.call('Input.dispatchTouchEvent',{type:({down:'touchStart',move:'touchMove',up:'touchEnd'})[type],touchPoints:type==='up'?[]:[{...p,id:1,radiusX:4,radiusY:4,force:1}]}):b.call('Input.dispatchMouseEvent',{type:({down:'mousePressed',move:'mouseMoved',up:'mouseReleased'})[type],...p,button:'left',buttons:type==='up'?0:1,clickCount:1});
   await pointer('down',start);for(let i=1;i<=8;i++){await pointer('move',{x:start.x+(end.x-start.x)*i/8,y:start.y+(end.y-start.y)*i/8});await b.pause(20);}
   const live=await b.evaluate("(()=>{const e=document.querySelector('[data-assembly-uid=tank-b]');return e.getAttribute('transform')})()");assert.match(live,/translate\(3\.699|translate\(3\.7/,'Magnet must be visible before release');
   await pointer('up',end);const saved=await read(),tank=saved.stack.find(n=>n.uid==='tank-b'),engine=saved.stack.find(n=>n.uid==='engine-b');assert.ok(Math.abs(tank.position.x-3.7)<1e-8&&Math.abs(tank.position.y-16)<1e-8);assert.equal(engine.position.x,tank.position.x);assert.equal(engine.position.y,13.5);
   const border=await b.evaluate("(()=>{const e=document.querySelector('[data-testid=part-selection-border]');return {color:e.getAttribute('stroke'),width:e.getAttribute('stroke-width'),fill:e.getAttribute('fill')}})()");assert.deepEqual(border,{color:'#111',width:'1',fill:'none'});await b.screenshot(touch?'magnetic-builder-phone':'magnetic-builder-desktop');
  }
  const pointerStyle=await b.evaluate("(()=>{const e=document.querySelector('[data-assembly-uid=tank-b]'),s=getComputedStyle(e),p=getComputedStyle(document.querySelector('[data-testid=part-catalog-item-chute_pack]'));return {outline:s.outlineStyle,shadow:s.boxShadow,tap:s.webkitTapHighlightColor,select:p.userSelect}})()");assert.deepEqual(pointerStyle,{outline:'none',shadow:'none',tap:'rgba(0, 0, 0, 0)',select:'none'});
  assert.equal(await b.evaluate("document.querySelector('[data-assembly-uid=tank-b]').dispatchEvent(new MouseEvent('contextmenu',{bubbles:true,cancelable:true}))"),false);
  await b.call('Input.dispatchKeyEvent',{type:'keyDown',key:'Tab',code:'Tab'});await b.call('Input.dispatchKeyEvent',{type:'keyUp',key:'Tab',code:'Tab'});
  await b.evaluate("document.querySelector('[data-assembly-uid=core]').focus({preventScroll:true})");await b.pause(100);
  const keyboard=await b.evaluate("(()=>{const e=document.querySelector('[data-assembly-uid=core]'),r=e.querySelector('[data-testid=part-selection-border]');return {visible:e.matches(':focus-visible'),outline:getComputedStyle(e).outlineStyle,color:r?.getAttribute('stroke'),width:r?.getAttribute('stroke-width')}})()");assert.deepEqual(keyboard,{visible:true,outline:'none',color:'#111',width:'1'});
  console.log('PASS: pointer/touch native halos and long-press callouts suppressed; keyboard focus selects with the single thin SVG border');
  console.log('PASS: real mouse and finger drags snap before release, commit flush tank edges, carry engines, and use a one-pixel black selection border');
  await b.home();await b.click('quick-first-orbit');await b.click('start-countdown-btn');await b.wait(b.exists('cockpit-pause'),25000);await b.click('cockpit-pause');await b.pause(1200);await b.screenshot('launch-station-phone');await b.call('Emulation.setTouchEmulationEnabled',{enabled:false});await b.viewport(1440,1000);await b.pause(800);await b.screenshot('launch-station-desktop');assert.deepEqual(b.errors,[]);console.log('PASS: detailed instanced launch station renders on phone and desktop without uncaught errors');
 }finally{b.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
