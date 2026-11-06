const assert = require('node:assert/strict');
const fs = require('node:fs');
const {browserSession} = require('./browser-session.cjs');
(async()=>{
 const b=await browserSession(), checks=[];
 try {
  await b.viewport(1440,1000); await b.home();
  await b.click('menu-sandbox-btn'); await b.click('sandbox-tab-loading');
  await b.click('loading-run'); await b.wait(b.exists('loading-result'));
  assert.match(await b.evaluate("document.querySelector('[data-testid=loading-result]').textContent"),/342/);
  await b.screenshot('release-ocean-loading'); checks.push('342-constituent loading and hourly displacement table');
  await b.upload('[data-testid=loading-import]',[require('node:path').resolve(__dirname,'../public/science/ocean-loading.blq')]);
  await b.click('loading-run'); await b.wait(b.exists('loading-result'));
  await b.click('sandbox-tab-fracture');
  for(const n of ['2','4','8']) { await b.select('fracture-count',n); await b.click('fracture-run'); await b.wait(b.exists('fracture-result')); assert.match(await b.evaluate("document.querySelector('[data-testid=fracture-result]').textContent"),new RegExp(n+' closed convex pieces')); }
  await b.screenshot('release-mesh-fracture'); checks.push('2/4/8 closed fracture meshes and conservation diagnostics');
  await b.click('sandbox-tab-engine'); await b.click('engine-full-forces'); await b.click('engine-initialize');
  await b.wait(b.exists('engine-state'),60000); await b.wait("!document.querySelector('[data-testid=engine-advance]').disabled",60000);
  await b.click('engine-full'); await b.click('engine-advance');
  await b.wait("!document.querySelector('[data-testid=engine-advance]').disabled",60000);
  await b.click('engine-cut'); await b.click('engine-companion');
  await b.wait("document.querySelector('[data-testid=engine-state]').textContent.includes('2 vessel(s)')");
  await b.click('engine-fracture'); await b.click('engine-verify');
  await b.wait(b.exists('engine-verification'),60000);
  await b.screenshot('release-full-wasm-engine'); checks.push('actual Wasm worker, advanced atmosphere/forces, powered flight, fleet and paired parity');
  await b.click('engine-stop'); await b.select('engine-mode','campaign'); await b.click('engine-initialize');
  await b.wait(b.exists('engine-launch'),60000); await b.click('engine-launch'); await b.click('engine-advance');
  await b.wait("!document.querySelector('[data-testid=engine-advance]').disabled",60000);
  await b.click('engine-stage'); await b.click('engine-verify'); await b.wait(b.exists('engine-verification'),60000);
  await b.clickSelector('[data-testid=full-engine-lab] details > summary'); await b.click('engine-handoff');
  await b.wait(b.exists('flight-status'),30000);
  checks.push('campaign launch, staging, paired verification and standard-renderer handoff');
  await b.home(); await b.viewport(390,844); await b.click('menu-sandbox-btn');
  for(const tab of ['loading','fracture','engine']) { await b.click('sandbox-tab-'+tab); assert.equal(await b.evaluate('document.documentElement.scrollWidth>innerWidth'),false); }
  await b.click('engine-initialize'); await b.wait(b.exists('engine-state'),60000); await b.click('engine-stop');
  await b.screenshot('release-labs-mobile'); checks.push('phone layout, Wasm initialization and cancellation');
  assert.deepEqual(b.errors,[]);
  fs.writeFileSync('/tmp/mission-forge-milestones-browser.json',JSON.stringify({status:'PASS',checks},null,2)+'\n');
  console.log('PASS: '+checks.join('; '));
 } finally {b.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
