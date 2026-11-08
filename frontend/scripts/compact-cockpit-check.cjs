const assert=require('node:assert/strict');
const {browserSession}=require('./browser-session.cjs');
(async()=>{
 const b=await browserSession(),cases=[];
 const viewport=async(w,h)=>{await b.viewport(w,h,2);await b.call('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:5});};
 const point=async(id)=>b.evaluate(`(()=>{const r=document.querySelector('[data-testid="${id}"]').getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2,id:1}})()`);
 const touch=(type,points)=>b.call('Input.dispatchTouchEvent',{type,touchPoints:points});
 async function geometry(selector,label){
  const result=await b.evaluate(`(()=>{const camera=document.querySelector(${JSON.stringify(selector)}),r=camera.getBoundingClientRect(),center=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return {width:r.width,height:r.height,w:innerWidth,h:innerHeight,center:center?.tagName,overflow:document.documentElement.scrollWidth>innerWidth,controls:[...document.querySelectorAll('[data-testid=touch-flight-controls] button,[data-testid=cockpit-shortcuts] button,[data-testid=cockpit-throttle]')].map(e=>{const q=e.getBoundingClientRect(),hit=document.elementFromPoint(q.x+q.width/2,q.y+q.height/2);return {id:e.dataset.testid,w:q.width,h:q.height,x:q.x,y:q.y,right:q.right,bottom:q.bottom,hit:hit===e||e.contains(hit),overlap:q.left<r.right&&q.right>r.left&&q.top<r.bottom&&q.bottom>r.top};})};})()`);
  assert.equal(result.center,'CANVAS',label+' spacecraft centre obstructed');
  const workspace=await b.evaluate(`(()=>{const r=document.querySelector(${JSON.stringify(selector)}).closest('.flight-screen,.explore-workspace').getBoundingClientRect();return {width:r.width,height:r.height}})()`);
  assert.ok(Math.abs(result.height-workspace.height)<=1&&Math.abs(result.width-workspace.width)<=1,label+' camera must fill workspace: '+JSON.stringify(result));
  assert.equal(result.overflow,false,label+' document overflow');
  for(const c of result.controls)assert.ok(c.w>=40&&c.h>=40&&c.x>=0&&c.y>=0&&c.right<=result.w+1&&c.bottom<=result.h+1&&c.hit,label+' '+JSON.stringify(c));
  cases.push(label);console.log('PASS:',label);
 }
 try{
  await b.call('Network.enable');await b.call('Network.clearBrowserCache');await b.call('Network.setCacheDisabled',{cacheDisabled:true});
  await viewport(390,844);await b.home();await b.evaluate("localStorage.clear();localStorage.setItem('mf.settings',JSON.stringify({graphics:'low',touchControls:'on',reduceMotion:true}));window.missionForgeData.flush()");await b.home();
  for(const id of ['menu-data-explorer','menu-academy','menu-sandbox-btn','menu-science-btn'])assert.ok(await b.evaluate(b.exists(id)),id+' missing from home');
  for(const [w,h] of [[320,568],[390,844],[844,390],[768,1024],[1440,1000]]){await viewport(w,h);await b.pause(200);assert.ok(await b.evaluate('document.documentElement.scrollWidth<=innerWidth'));for(const id of ['menu-new-mission-btn','menu-explore-btn','menu-data-explorer','menu-academy','menu-sandbox-btn','menu-science-btn','menu-storage-btn','palette-open','display-settings-btn']){await b.evaluate(`document.querySelector('[data-testid="${id}"]').scrollIntoView({block:'center'})`);assert.ok(await b.evaluate(`(()=>{const e=document.querySelector('[data-testid="${id}"]'),r=e.getBoundingClientRect(),hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return r.width>=44&&r.height>=40&&r.left>=0&&r.right<=innerWidth&&(hit===e||e.contains(hit))})()`),id+' unreachable at '+w);}await b.evaluate("document.querySelector('.home-screen').scrollTop=0");await b.screenshot('home-clean-'+w);}await viewport(390,844);
  await b.click('menu-new-mission-btn');await b.click('mission-card-first_orbit');await b.click('planner-open-hangar-btn');await b.wait(b.exists('assembly-placement-grid'));
  assert.ok(await b.evaluate("document.querySelector('.assembly-catalog').offsetWidth>0"));
  await b.click('workspace-blueprint');await b.clickSelector('[data-testid^="blueprint-part-"]');
  assert.equal(await b.evaluate("document.querySelector('.builder-screen').dataset.builderPane"),'build','Selection hid the workspace');
  await b.click('builder-stats-toggle');assert.ok(await b.evaluate("document.querySelector('[data-testid=stat-dv]').offsetWidth>0"));await b.click('builder-stats-toggle');
  await b.click('builder-panel-parts');assert.ok(await b.evaluate("document.querySelector('[data-testid=part-search-input]').offsetWidth>0"));await b.click('builder-panel-parts');
  const before=await b.evaluate("document.querySelector('[data-testid=stat-mass]').textContent");await b.click('part-catalog-item-probe_core');assert.notEqual(await b.evaluate("document.querySelector('[data-testid=stat-mass]').textContent"),before);
  await b.click('workspace-3d');await b.screenshot('compact-builder-phone');
  await b.home();await b.click('menu-explore-btn');await b.click('explore-view-craft');await b.wait(b.exists('cockpit-throttle'));
  for(const [w,h]of [[320,568],[390,844],[430,932],[568,320],[844,390],[768,1024]]){await viewport(w,h);await b.pause(350);await geometry('[data-testid=exploration-viewport]',`explore ${w}x${h}`);}
  await b.click('display-settings-btn');await b.click('settings-tab-controls');await b.select('touch-side-select','right');await b.click('settings-done');
  for(const [w,h]of [[390,844],[568,320]]){await viewport(w,h);await b.pause(350);await geometry('[data-testid=exploration-viewport]',`right-handed ${w}x${h}`);}
  for(const [w,h,insets]of [[390,844,{top:59,bottom:34,left:0,right:0}],[844,390,{top:0,bottom:21,left:44,right:0}]]){
    await viewport(w,h);await b.call('Emulation.setSafeAreaInsetsOverride',{insets});await b.pause(350);await geometry('[data-testid=exploration-viewport]',`safe area ${w}x${h}`);
  }
  await b.call('Emulation.setSafeAreaInsetsOverride',{insets:{top:0,bottom:0,left:0,right:0}});
  await viewport(390,844);await b.click('display-settings-btn');await b.click('settings-tab-controls');await b.select('touch-side-select','left');await b.click('settings-done');
  await viewport(390,844);await b.click('explore-play');
  if(await b.evaluate("document.querySelector('[data-testid=touch-rcs]').getAttribute('aria-pressed')!=='true'"))await b.click('touch-rcs');
  const steering=await point('touch-yawLeft'),rail=await b.evaluate("(()=>{const r=document.querySelector('[data-testid=cockpit-throttle]').getBoundingClientRect();return {x:r.x+r.width/2,top:r.top+3,bottom:r.bottom-3};})()");
  await touch('touchStart',[steering]);await touch('touchStart',[steering,{x:rail.x,y:rail.bottom,id:2}]);
  for(let i=1;i<=10;i++){await touch('touchMove',[steering,{x:rail.x,y:rail.bottom+(rail.top-rail.bottom)*i/10,id:2}]);await b.pause(25);}
  await b.pause(250);assert.equal(await b.evaluate("document.querySelector('[data-testid=touch-yawLeft]').getAttribute('aria-pressed')"),'true');
  assert.ok(Number(await b.evaluate("document.querySelector('[data-testid=cockpit-throttle]').value"))>=90,'Vertical throttle did not reach high power');
  await touch('touchEnd',[{x:rail.x,y:rail.top,id:2}]);await b.pause(100);assert.equal(await b.evaluate("document.querySelector('[data-testid=touch-yawLeft]').getAttribute('aria-pressed')"),'true');await touch('touchEnd',[]);
  await b.click('touch-cutThrottle');await b.wait("document.querySelector('[data-testid=cockpit-throttle]').value==='0'");
  await b.click('cockpit-pause');assert.ok(await b.evaluate("document.querySelector('[data-testid=cockpit-throttle]').disabled"));
  await b.click('explore-instruments-toggle');assert.ok(await b.evaluate("document.querySelector('.explore-inspector').offsetWidth>0"));await b.click('explore-instruments-toggle');
  await b.click('explore-view-system');await b.click('explore-view-orbit');await b.click('explore-view-craft');
  await b.screenshot('compact-exploration-phone');console.log('PASS: native vertical throttle, simultaneous steering, independent pointer release, cut, pause and instrument drawer');
  await b.home();await b.click('quick-first-orbit');await b.click('start-countdown-btn');await b.wait(b.exists('cockpit-pause'),25000);await b.click('cockpit-pause');
  for(const [w,h]of [[320,568],[390,844],[568,320],[844,390],[768,1024]]){await viewport(w,h);await b.pause(350);await geometry('[data-testid=flight-3d-viewport]',`campaign ${w}x${h}`);}
  await viewport(390,844);await b.click('cockpit-map');assert.equal(await b.evaluate("document.querySelector('.flight-screen').dataset.camera"),'map');await b.click('cockpit-map');
  await b.click('engineering-toggle-btn');assert.ok(await b.evaluate("document.querySelector('.flight-instrument-panels').offsetWidth>0"));await b.click('cockpit-instruments');
  await b.click('checkpoints-btn');await b.key('Escape');await b.wait("!document.querySelector('[role=dialog]')");await b.screenshot('compact-campaign-phone');
  await b.click('display-settings-btn');await b.click('settings-tab-controls');await b.select('touch-controls-select','off');await b.click('settings-done');await viewport(1440,1000);await b.pause(250);assert.equal(await b.evaluate("!!document.querySelector('[data-testid=touch-flight-controls]')"),false);await geometry('[data-testid=flight-3d-viewport]','desktop keyboard-only');await b.click('cockpit-menu');assert.ok(await b.evaluate("document.querySelector('.flight-bar').offsetWidth>0"));await b.click('cockpit-menu');await b.screenshot('fullscreen-campaign-desktop');
  assert.deepEqual(b.errors,[]);console.log(`PASS: ${cases.length} full-screen overlay layouts; original menus, cameras, saves and engineering remain accessible`);
 }finally{b.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
