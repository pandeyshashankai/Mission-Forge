const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {browserSession} = require('./browser-session.cjs');
(async () => {
  const base = 'http://127.0.0.1:8080';
  const frontend = path.resolve(__dirname, '..');
  assert.equal(fs.existsSync(path.join(frontend, 'public/submission')), false);
  assert.equal(fs.existsSync(path.join(frontend, 'build/submission')), false);
  const identity = await (await fetch(base + '/build-info.json')).json();
  assert.ok(identity.assets.every(a => !a.path.startsWith('/submission/')));
  for (const name of ['project-report.html','project-report.pdf','presentation.html','presentation.pdf','demo-script.html','demo-script.pdf','user-testing-protocol.html','user-testing-protocol.pdf','showcase-replay.html','showcase-result.json','validation-results.json']) {
    const response = await fetch(base + '/submission/' + name);
    assert.ok([404,410].includes(response.status), `${name} still served: ${response.status}`);
  }
  assert.equal(fs.existsSync(path.resolve(frontend, '../docs/submission')), false);
  const data = await (await fetch(base + '/science/planetary-data.json')).json();
  assert.equal(data.atmospheres.earth.bands.length,28);
  assert.equal(data.atmospheres.mars.bands.length,150);
  const csv = await fetch(base + '/science/analysis.csv');
  assert.equal(csv.status,200);
  assert.equal((await csv.text()).trim().split('\n').length,13);
  const b = await browserSession();
  try {
    await b.viewport(390,844);
    await b.home();
    assert.equal(await b.evaluate("Boolean(document.querySelector('[data-testid=menu-evidence-btn]'))"),false);
    await b.click('palette-open');
    assert.equal(await b.evaluate("Boolean(document.querySelector('[data-testid=command-evidence]'))"),false);
    await b.key('Escape');
    for (const id of ['menu-showcase-btn','menu-science-btn']) {
      await b.home();await b.click(id);
      assert.equal(await b.evaluate("Boolean(document.querySelector('a[href^=\"/submission/\"]'))"),false);
    }
    assert.deepEqual(b.errors,[]);
  } finally {b.close();}
  console.log('PASS: private handouts absent from public source/build, legacy document URLs unavailable, menu/search/download links removed, scientific data remains accessible');
})().catch(error=>{console.error(error);process.exitCode=1;});
