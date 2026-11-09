const assert=require('node:assert/strict'),fs=require('node:fs');
const {browserSession}=require('./browser-session.cjs');
const fixture={name:'Placed-part tap regression',editorLayout:true,stack:[
 {uid:'probe',partId:'probe_core',position:{x:0,y:32,z:0}},
 {uid:'tank',partId:'tank_k_37_l',position:{x:0,y:8,z:0}},
 {uid:'engine',partId:'eng_k9',position:{x:0,y:5.2,z:0}},
 {uid:'side',partId:'tank_k_37_s',position:{x:8,y:8,z:0},mount:{parentUid:'tank',x:8,y:0,z:0}}
],radials:[],events:null};
(async()=>{
 const b=await browserSession(),touch=(type,p)=>b.call('Input.dispatchTouchEvent',{type,touchPoints:p?[{...p,id:1,radiusX:4,radiusY:4,force:1}]:[]});
 const saved=()=>b.evaluate("(()=>{window.missionForgeData.flush();return localStorage.getItem('mf.autosave')})()");
 try{
  await b.viewport(390,844);await b.home();await b.evaluate("localStorage.clear();localStorage.setItem('mf.settings',JSON.stringify({graphics:'low',reduceMotion:true}));window.missionForgeData.flush()");await b.home();
  await b.click('menu-new-mission-btn');await b.click('mission-card-first_orbit');await b.click('planner-open-hangar-btn');
  fs.writeFileSync('/tmp/mf-placed-part-tap.json',JSON.stringify(fixture));await b.upload('[data-testid=hangar-import-input]',['/tmp/mf-placed-part-tap.json']);await b.pause(4200);
  await b.call('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:5});
  await b.evaluate("window.__partTap=null;window.addEventListener('pointerdown',e=>{if(e.target.closest('[data-testid=assembly-placement-grid]'))window.__partTap={prevented:e.defaultPrevented,type:e.pointerType}},false)");
  for(const [width,height,dpr]of [[360,720,2],[390,844,3],[320,568,2],[844,390,2]]){
   await b.call('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:dpr,mobile:true,screenWidth:width,screenHeight:height});await b.pause(250);await b.click('assembly-fit');
   const original=await saved(),camera=await b.evaluate("document.querySelector('[data-testid=assembly-placement-grid]').getAttribute('viewBox')"),scale=await b.evaluate('visualViewport.scale');
   for(const id of ['tank','probe','side'])for(const hold of [0,180,650]){
    const before=await b.evaluate(`(()=>{const e=document.querySelector('[data-assembly-uid=${id}]'),r=e.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2,width:r.width,height:r.height}})()`);
    await touch('touchStart',{x:before.x,y:before.y});if(hold)await touch('touchMove',{x:before.x+2,y:before.y+2});await b.pause(Math.max(40,hold));
    const downBounds=await b.evaluate(`(()=>{const r=document.querySelector('[data-assembly-uid=${id}]').getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2,w:r.width,h:r.height}})()`);assert.ok(Math.abs(downBounds.x-before.x)<1&&Math.abs(downBounds.y-before.y)<1&&Math.abs(downBounds.w-before.width)<2&&Math.abs(downBounds.h-before.height)<2,'Normal finger jitter must not move or magnify the selected part');
    assert.ok(await b.evaluate(`!!document.querySelector('[data-assembly-uid=${id}]>[data-testid=part-selection-border]')`),'Part must select while the finger is down: '+id);
    for(const control of ['inspect-selection','duplicate-selected-btn','remove-selected-btn'])assert.ok(await b.evaluate(`(()=>{const e=document.querySelector('[data-testid=${control}]'),r=e?.getBoundingClientRect();return !!r&&r.width>0&&r.height>0&&r.left>=0&&r.right<=innerWidth+1})()`),'Editing control missing: '+control);
    await touch('touchEnd');await b.pause(120);
    const after=await b.evaluate(`(()=>{const e=document.querySelector('[data-assembly-uid=${id}]'),r=e.getBoundingClientRect(),border=e.querySelector('[data-testid=part-selection-border]'),at=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return {w:r.width,h:r.height,outline:getComputedStyle(e).outlineStyle,nativeFocus:document.activeElement===e,color:border?.getAttribute('stroke'),stroke:border?.getAttribute('stroke-width'),fill:border?.getAttribute('fill'),unobstructed:at?.closest('[data-assembly-uid]')===e,held:!!document.querySelector('[data-testid=held-part]'),selectionBox:document.querySelector('.studio-grid>svg>rect[stroke]')!==null}})()`);
    assert.ok(Math.abs(after.w-before.width)<2&&Math.abs(after.h-before.height)<2,'Tap enlarged the part: '+JSON.stringify({before,after}));
    assert.equal(after.outline,'none');assert.equal(after.nativeFocus,false);assert.equal(after.color,'#111');assert.equal(after.stroke,'1');assert.equal(after.fill,'none');assert.equal(after.unobstructed,true);assert.equal(after.held,false);assert.equal(after.selectionBox,false);
    assert.deepEqual(await b.evaluate('window.__partTap'),{prevented:true,type:'touch'});
    assert.equal(await b.evaluate("document.querySelector('.builder-screen').dataset.builderPane"),'build');assert.equal(await b.evaluate("document.querySelector('[data-testid=assembly-placement-grid]').getAttribute('viewBox')"),camera);assert.equal(await b.evaluate('visualViewport.scale'),scale);assert.equal(await saved(),original);
   }
   const nearProbe=await b.evaluate("(()=>{const r=document.querySelector('[data-assembly-uid=probe]').getBoundingClientRect();return {x:r.x+r.width/2,y:r.top-6}})()");await touch('touchStart',nearProbe);await touch('touchEnd');await b.pause(100);assert.ok(await b.evaluate("!!document.querySelector('[data-assembly-uid=probe]>[data-testid=part-selection-border]')"),'Small parts must be finger-selectable without enlarging their artwork');assert.equal(await saved(),original);
   await b.screenshot('placed-part-selection-'+width+'x'+height);
   const selection=await b.evaluate("[...document.querySelectorAll('[data-testid=part-selection-border]')].map(e=>e.closest('[data-assembly-uid]').dataset.assemblyUid)");
   const start=await b.evaluate("(()=>{const r=document.querySelector('[data-assembly-uid=tank]').getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()");
   await touch('touchStart',start);
   await b.call('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{...start,id:1},{x:start.x+50,y:start.y,id:2}]});
   await b.call('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:start.x-15,y:start.y,id:1},{x:start.x+70,y:start.y,id:2}]});await touch('touchEnd');await b.pause(100);
   assert.deepEqual(await b.evaluate("[...document.querySelectorAll('[data-testid=part-selection-border]')].map(e=>e.closest('[data-assembly-uid]').dataset.assemblyUid)"),selection,'Pinching over another part must preserve the prior selection');
   assert.equal(await b.evaluate('visualViewport.scale'),scale);assert.equal(await saved(),original);
   console.log(`PASS: mobile ${width}x${height} DPR ${dpr}: repeated/held taps select small, long and side parts; controls visible, no enlargement/overlay, no page zoom or design edits`);
  }
  await b.click('studio-select-area');
  const center=await b.evaluate("(()=>{const r=document.querySelector('[data-testid=assembly-placement-grid]').getBoundingClientRect();return {x:r.x+r.width*.55,y:r.y+r.height*.5}})()");
  await touch('touchStart',center);await b.call('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{...center,id:1},{x:center.x+45,y:center.y,id:2}]});await touch('touchEnd');await b.pause(100);
  assert.equal(await b.evaluate("document.querySelector('[data-testid=studio-select-area]').getAttribute('aria-pressed')"),'false');
  assert.equal(await b.evaluate("!!document.querySelector('.studio-grid>svg>rect[stroke]')"),false);
  const prior=await b.evaluate("[...document.querySelectorAll('[data-testid=part-selection-border]')].map(e=>e.closest('[data-assembly-uid]').dataset.assemblyUid)");
  const target=await b.evaluate("(()=>{const r=document.querySelector('[data-assembly-uid=tank]').getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()");await touch('touchStart',target);await b.call('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});await b.pause(100);assert.deepEqual(await b.evaluate("[...document.querySelectorAll('[data-testid=part-selection-border]')].map(e=>e.closest('[data-assembly-uid]').dataset.assemblyUid)"),prior);
  console.log('PASS: pinch retains the previous part selection and cancels the rectangle tool without leaving a blocking box');
  assert.deepEqual(b.errors,[]);
 }finally{await b.call('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});await b.call('Emulation.setTouchEmulationEnabled',{enabled:false});b.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
