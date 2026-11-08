const assert = require("node:assert/strict");
const { browserSession } = require("./browser-session.cjs");
(async () => {
  const b = await browserSession();
  try {
    await b.viewport(390, 844);
    await b.home();
    await b.evaluate("caches.open('mission-forge-offline-audit-old').then(async c=>{await c.put('/obsolete-audit',new Response('old'));await c.put('/submission/project-report.pdf',new Response('retired private handout'))})");
    await b.click("offline-prepare");
    await b.wait(
      'document.querySelector("[data-testid=offline-status]").textContent.includes("ready")',
      60000,
    );
    await b.wait("Boolean(navigator.serviceWorker.controller)");
    assert.equal(await b.evaluate("caches.has('mission-forge-offline-audit-old')"),false);
    const identity=await b.evaluate("fetch('/build-info.json').then(r=>r.json())");
    assert.equal(await b.evaluate("caches.keys().then(keys=>keys.filter(k=>k.startsWith('mission-forge-offline-'))[0])"),'mission-forge-offline-'+identity.id);

    await b.call("Network.enable");
    await b.call("Network.emulateNetworkConditions", {
      offline: true,
      latency: 0,
      downloadThroughput: 0,
      uploadThroughput: 0,
    });
    await b.home();
    await b.wait('document.querySelector("[data-testid=offline-status]").textContent.includes("ready")');
    const assets = await b.evaluate(
      `Promise.all(['/science/models/full-engine.js','/science/models/full-engine.json','/science/ocean-loading.blq','/science/precision-reference.json','/science/sources/EGM96.cof','/science/models/nrlmsise-browser.mjs','/science/models/tsofa/TSOFA.js','/science/advanced-validation-results.json'].map(async path=>{const r=await fetch(path);return {path,status:r.status,bytes:(await r.arrayBuffer()).byteLength}}))`,
    );
    assert.ok(assets.every((a) => a.status === 200 && a.bytes > 100));
    const privateRequests = await b.evaluate("Promise.all(['/submission/project-report.pdf','/submission/presentation.html'].map(async url => (await fetch(url)).status))");
    assert.deepEqual(privateRequests, [410, 410]);
    assert.equal(await b.evaluate("caches.keys().then(async keys => (await Promise.all(keys.filter(k=>k.startsWith('mission-forge-offline-')).map(async k=>(await (await caches.open(k)).keys()).some(r=>new URL(r.url).pathname.startsWith('/submission/'))))).some(Boolean))"),false);
    await b.click("menu-data-explorer");
    await b.wait(b.exists("data-comparison"));
    assert.match(await b.evaluate('document.body.textContent'), /NASA Data Explorer/);
    await b.home();
    await b.click("menu-academy");
    await b.click("academy-lesson-heat");
    await b.select("academy-choice", "1");
    await b.click("academy-run");
    await b.wait(b.exists("academy-observation"));
    await b.home();
    await b.click("menu-model-comparison");
    await b.select("comparison-model", "central");
    await b.click("comparison-run");
    await b.wait(b.exists("comparison-result"));
    assert.match(await b.evaluate('document.querySelector("[data-testid=comparison-result]").textContent'), /0\.000 m/);
    await b.home();
    await b.click("menu-sandbox-btn");
    await b.click("window-calculate");
    await b.wait(b.exists("window-result"));
    await b.click("sandbox-tab-performance");
    await b.click("performance-run");
    await b.wait(b.exists("performance-result"));
    assert.match(await b.evaluate('document.querySelector("[data-testid=performance-result]").textContent'), /Acceleration disagreement/);
    const gravity = await b.evaluate('(async()=>{const r=await fetch("/science/models/central-gravity.wasm");const {instance}=await WebAssembly.instantiate(await r.arrayBuffer());return instance.exports.accel(1,1,0,0)})()');
    assert.equal(gravity, -1);
    await b.click("sandbox-tab-loading");
    await b.click("loading-run"); await b.wait(b.exists("loading-result"));
    await b.click("sandbox-tab-fracture");
    await b.click("fracture-run"); await b.wait(b.exists("fracture-result"));
    await b.click("sandbox-tab-engine");
    await b.click("engine-initialize"); await b.wait(b.exists("engine-state"),60000);
    await b.click("engine-advance");
    await b.wait("!document.querySelector('[data-testid=engine-advance]').disabled",60000);
    await b.click("engine-stop");
    await b.click("sandbox-tab-thermal");
    await b.click("thermal-run");
    await b.wait(b.exists("thermal-results"));
    assert.equal(await b.evaluate('document.querySelectorAll("[data-testid=thermal-results] article").length'),3);
    await b.click("sandbox-tab-frames");
    await b.click("precision-frames-run");
    await b.wait(b.exists("precision-frame-result"));
    await b.home();
    await b.click("menu-explore-btn");
    await b.select("explore-destination-select", "earth");
    await b.click("explore-start-orbit");
    await b.click("instrument-tab-systems");
    await b.clickSelector("[data-testid=advanced-physics] > summary");
    await b.select("physics-atmosphere", "msis");
    await b.wait(
      'document.querySelector("[data-testid=advanced-physics]").textContent.includes("NRLMSISE loaded locally")',
    );
    await b.click("explore-play");
    await b.pause(500);
    await b.click("explore-play");
    await b.click("explore-save");
    assert.equal(
      (await b.evaluate('JSON.parse(localStorage.getItem("mf.exploration"))'))
        .physics.atmosphere,
      "msis",
    );
    await b.home();
    await b.click('quick-first-orbit');
    await b.click('start-countdown-btn');
    await b.wait('!document.querySelector("[data-testid=countdown-overlay]") && !document.querySelector("[data-testid=launch-checklist]")',25000);
    await b.click('time-warp-10');
    await b.wait(b.exists('complete-mission-btn'),300000);
    await b.click('complete-mission-btn');
    await b.wait(b.exists('results-outcome'));
    assert.match(await b.evaluate('document.querySelector("[data-testid=results-outcome]").textContent'),/success/i);
    assert.deepEqual(b.errors, []);
    console.log(
      "PASS: versioned cache cleanup, persistent offline status, offline First Orbit through successful report, Lambert calculation, lazy standards model, source snapshot, local WASM and source assets",
      assets.map((a) => a.path),
    );
  } finally {
    await b.call("Network.emulateNetworkConditions", {
      offline: false,
      latency: 0,
      downloadThroughput: -1,
      uploadThroughput: -1,
    });
    await b.evaluate(
      `(async()=>{for(const r of await navigator.serviceWorker.getRegistrations())if(r.active?.scriptURL.endsWith('/offline-worker.js'))await r.unregister();for(const k of await caches.keys())if(k.startsWith('mission-forge-offline-'))await caches.delete(k)})()`,
    );
    b.close();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
