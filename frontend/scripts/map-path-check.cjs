require('./register.cjs');
const assert=require('node:assert/strict');
const {browserSession}=require('./browser-session.cjs');
const {FlightSim}=require('../src/sim/flight');
const {presetFalconLike,presetLunarOrbiter}=require('../src/sim/presets');
const {getMission}=require('../src/sim/missions');
const {DEFAULT_PROFILE}=require('../src/sim/guidance');
const {EARTH}=require('../src/sim/constants');
(async()=>{
 const b=await browserSession();
 const seed=async(lunar)=>{
  const sim=new FlightSim({design:lunar?presetLunarOrbiter():presetFalconLike(),mission:getMission(lunar?'lunar_orbiter':'first_orbit'),difficulty:'amateur',profile:DEFAULT_PROFILE});
  sim.launch();
  if(lunar){const radius=EARTH.radius+185000;sim.r=[radius,0,0];sim.v=[0,Math.sqrt(EARTH.mu/radius),0];sim.clamped=false;sim.throttle=0;sim.guidance.disengaged=true;sim.nav=sim.computeNav();}
  else {sim.advance(60);sim.advance(60);}
  const ck={id:'map-path',label:'Map controls test',at:new Date().toISOString(),missionId:sim.mission.id,difficulty:'amateur',design:sim.design,profile:DEFAULT_PROFILE,state:sim.serialize(),simT:sim.t};
  await b.home();await b.evaluate(`localStorage.setItem('mf.recovery-flight',${JSON.stringify(JSON.stringify(ck))});window.missionForgeData.flush()`);await b.home();await b.click('resume-recovery');await b.wait(b.exists('flight-3d-viewport'));
 };
 try{
  await b.viewport(390,844);await b.home();await b.evaluate("localStorage.clear();localStorage.setItem('mf.settings',JSON.stringify({graphics:'low',reduceMotion:true,camera:'side'}));window.missionForgeData.flush()");
  await seed(false);
  await b.wait("document.querySelector('[data-testid=flight-3d-viewport]').dataset.trajectoryVisible==='true'");
  const before=Number(await b.evaluate("document.querySelector('[data-testid=flight-3d-viewport]').dataset.stageIndex"));
  await b.click('cockpit-pause');await b.key('g');await b.evaluate('document.activeElement?.blur()');await b.key(' ');
  await b.wait(`Number(document.querySelector('[data-testid=flight-3d-viewport]').dataset.stageIndex)>${before}`);
  await b.pause(1200);await b.click('cockpit-pause');
  assert.equal(await b.evaluate("document.querySelector('[data-testid=flight-3d-viewport]').dataset.trajectoryMode"),'local');
  await b.screenshot('trajectory-after-staging-phone');
  console.log('PASS: live ascent stages through keyboard and retains one local forecast renderer');
  await seed(true);await b.click('cockpit-map');await b.clickSelector('[data-testid=flight-map-planner] > details > summary');
  await b.wait("document.querySelector('[data-testid=map-encounter-status]').textContent.includes('Closest sampled altitude')");
  assert.ok(await b.evaluate("document.querySelector('[data-testid=node-tli-btn]').getBoundingClientRect().width>0"));
  await b.click('map-focus-encounter');await b.screenshot('moon-encounter-map-phone');
  await b.click('node-tli-btn');await b.wait(b.exists('node-time-to'),120000);
  await b.wait("document.querySelector('[data-testid=map-encounter-status]').textContent.includes('After planned burn')");
  assert.match(await b.evaluate("document.querySelector('[data-testid=map-transfer-window]').textContent"),/Planned departure/);
  await b.viewport(1440,1000);await b.screenshot('moon-encounter-map-desktop');
  await b.home();await b.click('menu-explore-btn');await b.click('explore-view-orbit');await b.click('map-planning-shortcut');
  assert.equal(await b.evaluate("document.querySelector('[data-testid=instrument-tab-plan]').getAttribute('aria-selected')"),'true');
  await b.clickSelector('[data-testid=map-transfer-windows] > summary');await b.click('window-calculate');await b.wait(b.exists('window-result'));
  await b.clickSelector('[data-testid=encounter-planner] > summary');await b.click('encounter-predict');await b.wait(b.exists('encounter-result'));
  assert.deepEqual(b.errors,[]);
  console.log('PASS: phone/desktop campaign map transfer controls, sampled Moon approach, overview focus and exploration window/encounter tools');
 }finally{b.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
