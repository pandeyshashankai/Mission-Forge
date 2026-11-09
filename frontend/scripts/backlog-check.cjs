const assert = require('node:assert/strict'),
  fs = require('node:fs'),
  path = require('node:path');
const {
  browserSession
} = require('./browser-session.cjs');
const setInput = (selector, value) => `(()=>{const e=document.querySelector(${JSON.stringify(selector)});Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(e,${JSON.stringify(value)});e.dispatchEvent(new Event('input',{bubbles:true}));})()`;
(async () => {
  const b = await browserSession(),
    results = [];
  try {
    await b.viewport(390, 844);
    await b.home();
    await b.evaluate("localStorage.clear();localStorage.setItem('mf.settings',JSON.stringify({graphics:'low',reduceMotion:true,touchControls:'on',gamepadEnabled:true,keepAwake:true,haptics:true}))");
    await b.home();
    await b.click('palette-open');
    await b.evaluate(setInput('[data-testid=command-search]', 'NASA source'));
    await b.key('Enter');
    await b.wait(b.exists('science-lab'));
    await b.home();
    await b.key('k', 2);
    await b.wait(b.exists('command-palette'));
    await b.key('Escape');
    await b.wait('!document.querySelector("[data-testid=command-palette]")');
    results.push('Command search, keyboard selection, Ctrl+K and Escape');
    await b.click('menu-challenges-btn');
    await b.evaluate(setInput('[data-testid=challenge-seed]', 'backlog-proof'));
    await b.click('challenge-generate');
    const preview = await b.evaluate("document.querySelector('[data-testid=challenge-preview]').textContent");
    await b.click('challenge-generate');
    assert.equal(await b.evaluate("document.querySelector('[data-testid=challenge-preview]').textContent"), preview);
    await b.click('challenge-fly');
    await b.wait(b.exists('readiness-checks'));
    await b.home();
    const pack = await b.evaluate("JSON.parse(localStorage.getItem('mf.local-content'))");
    assert.equal(pack.missions.length, 1);
    results.push('Seed repeatability, safe challenge installation and preflight');
    await b.evaluate(`localStorage.setItem('mf.attempts.first_orbit.amateur',JSON.stringify([{at:'2026-11-05T01:00:00Z',designName:'Fixture A',outcome:'success',total:90,peri:190000,cost:40,events:[{t:10,text:'Stage event'}]},{at:'2026-11-05T00:00:00Z',designName:'Fixture B',outcome:'failure',total:40,peri:-100,cost:50}]))`);
    await b.click('menu-logbook-btn');
    await b.wait(b.exists('flight-comparison'));
    assert.match(await b.evaluate('document.body.textContent'), /Stage event/);
    assert.match(await b.evaluate("document.querySelector('[data-testid=flight-comparison]').textContent"), /Cost/);
    results.push('Logbook, milestones, comparison and retained events');
    await b.home();
    await b.click('menu-explore-btn');
    await b.evaluate(`window.__wake={requests:0,releases:0};Object.defineProperty(navigator,'wakeLock',{configurable:true,value:{request:async()=>{window.__wake.requests++;const target=new EventTarget();target.release=async()=>{window.__wake.releases++;target.dispatchEvent(new Event('release'))};return target;}}});window.__pad={index:0,id:'Synthetic standard controller',connected:true,axes:[0,0,0,0],buttons:Array.from({length:12},()=>({pressed:false,value:0}))};window.__pad.buttons[0].pressed=true;Object.defineProperty(navigator,'getGamepads',{configurable:true,value:()=>window.__pad?[window.__pad]:[]});window.__haptics=[];Object.defineProperty(navigator,'vibrate',{configurable:true,value:duration=>{window.__haptics.push(duration);return true}});`);
    // Toggle comfort to exercise request/release with a deterministic browser-API fixture.
    await b.click('display-settings-btn');
    await b.click('settings-tab-controls');
    await b.click('wake-enable');
    await b.click('wake-enable');
    await b.click('settings-done');
    await b.wait('window.__wake.requests>0');
    await b.click('explore-play');
    await b.pause(300);
    assert.equal(await b.evaluate("Number(document.querySelector('[data-testid=explore-throttle]').value)"), 0);
    await b.evaluate('window.__pad.buttons[0].pressed=false');
    await b.pause(150);
    await b.evaluate('window.__pad.buttons[0].pressed=true');
    await b.wait("Number(document.querySelector('[data-testid=explore-throttle]').value)===100");
    await b.evaluate('window.__pad.buttons[0].pressed=false;window.__pad.buttons[1].pressed=true');
    await b.wait("Number(document.querySelector('[data-testid=explore-throttle]').value)===0");
    await b.evaluate('window.__pad.buttons[1].pressed=false;window.__pad.axes[1]=-.8');
    await b.wait("document.querySelector('[data-testid=touch-pitchForward]').getAttribute('aria-pressed')==='true'");
    await b.key('k', 2);
    await b.wait(b.exists('command-palette'));
    await b.evaluate('window.missionForgeData.flush()');
    await b.pause(250);
    assert.equal(await b.evaluate("document.querySelector('[data-testid=touch-pitchForward]').getAttribute('aria-pressed')"), 'false');
    await b.key('Escape');
    await b.evaluate('window.__pad.axes[1]=0');
    await b.pause(200);
    await b.evaluate('window.__pad.axes[1]=-.8');
    await b.wait("document.querySelector('[data-testid=touch-pitchForward]').getAttribute('aria-pressed')==='true'");
    await b.evaluate('window.__pad=null');
    await b.wait("document.querySelector('[data-testid=touch-pitchForward]').getAttribute('aria-pressed')==='false'");
    await b.click('explore-play');
    await b.click('display-settings-btn');
    await b.click('settings-tab-controls');
    await b.clickSelector('[data-testid=gamepad-settings] details > summary');
    await b.select('pad-binding-rcs', '6');
    await b.click('settings-done');
    await b.evaluate("window.__pad={index:1,id:'Remapped synthetic controller',connected:true,axes:[0,0,0,0],buttons:Array.from({length:12},()=>({pressed:false,value:0}))}");
    await b.click('explore-play');
    await b.pause(200);
    await b.evaluate('window.__pad.buttons[6].pressed=true');
    await b.wait("window.__haptics.length>0");
    await b.evaluate('window.__pad=null');
    await b.click('explore-back');
    await b.wait('window.__wake.releases>0');
    results.push('Controller neutral arming, full/cut, held axis, modal isolation, disconnect, mapping and optional comfort API lifecycle');
    await b.click('menu-storage-btn');
    while (await b.evaluate("document.querySelectorAll('[data-testid=archive-delete]').length")) {
      await b.click('archive-delete');
      await b.click('archive-delete');
      await b.wait("!document.querySelector('[data-testid=archive-delete]')||!document.querySelector('[data-testid=archive-delete]').disabled");
    }
    const replayPath = path.resolve(__dirname, '../public/science/showcase-replay.json');
    await b.upload('[data-testid=archive-upload]', [replayPath]);
    await b.wait("document.querySelector('[data-testid=archive-status]').textContent.includes('Archived and verified')");
    await b.click('archive-download');
    await b.wait("document.querySelector('[data-testid=archive-status]').textContent.includes('Verified and downloaded')");
    fs.writeFileSync('/tmp/unsupported-replay.json', '{}');
    await b.upload('[data-testid=archive-upload]', ['/tmp/unsupported-replay.json']);
    await b.wait("document.querySelector('[data-testid=archive-status]').textContent.includes('Unsupported replay header')");
    assert.equal(await b.evaluate("document.querySelectorAll('[data-testid=archive-delete]').length"), 1);
    const huge = fs.openSync('/tmp/oversized-replay.json', 'w');
    fs.ftruncateSync(huge, 51 * 1024 * 1024);
    fs.closeSync(huge);
    await b.upload('[data-testid=archive-upload]', ['/tmp/oversized-replay.json']);
    await b.wait("document.querySelector('[data-testid=archive-status]').textContent.includes('50 MiB')");
    await b.click('archive-delete');
    await b.click('archive-delete');
    await b.wait('document.body.textContent.includes("No archived replay files")');
    await b.click('archive-opfs');
    await b.upload('[data-testid=archive-upload]', [replayPath]);
    await b.wait("document.querySelector('[data-testid=archive-status]').textContent.includes('indexeddb')");
    await b.click('archive-download');
    await b.wait("document.querySelector('[data-testid=archive-status]').textContent.includes('Verified and downloaded')");
    results.push('OPFS file archive, checksum download, confirmed delete and IndexedDB fallback');
    await b.home();
    await b.click('menu-sandbox-btn');
    await b.click('sandbox-tab-performance');
    await b.click('performance-run');
    await b.wait(b.exists('performance-result'));
    await b.wait("document.querySelector('[data-testid=plot-backend]').textContent.length>0");
    const performance = await b.evaluate("document.querySelector('[data-testid=performance-result]').textContent");
    assert.match(performance, /Acceleration disagreement/);
    results.push('Measured JS/Wasm central gravity, invariant check and worker-rendered orbit plot');
    await b.evaluate("window.__offscreenDescriptor=Object.getOwnPropertyDescriptor(HTMLCanvasElement.prototype,'transferControlToOffscreen');Object.defineProperty(HTMLCanvasElement.prototype,'transferControlToOffscreen',{configurable:true,value:undefined});true");
    await b.click('performance-run');
    await b.wait("document.querySelector('[data-testid=plot-backend]').textContent.includes('fallback')");
    await b.evaluate("if(window.__offscreenDescriptor)Object.defineProperty(HTMLCanvasElement.prototype,'transferControlToOffscreen',window.__offscreenDescriptor);true");
    results.push('Canvas fallback when OffscreenCanvas is unavailable');
    await b.screenshot('backlog-performance-phone');
    assert.equal(await b.evaluate('document.documentElement.scrollWidth>innerWidth'), false);
    assert.deepEqual(b.errors, []);
    fs.writeFileSync(path.resolve(require('./audit-output.cjs'), 'backlog-validation.json'), JSON.stringify({
      status: 'PASS',
      scope: 'Chromium integration; synthetic gamepad/wake/haptic API fixtures, not physical-device certification',
      results,
      performance
    }, null, 2) + '\n');
    console.log('PASS:', results.join('; '));
  } finally {
    b.close();
  }
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
