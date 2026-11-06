require('./register.cjs');
const assert = require('node:assert/strict'),
  fs = require('node:fs'),
  path = require('node:path');
const {
  browserSession
} = require('./browser-session.cjs');
const {
    BODIES
  } = require('../src/sim/solarSystem'),
  {
    EXPLORERS
  } = require('../src/sim/exploration');
const devices = [['small-phone',320,568,true,2], ['phone',360,640,true,3], ['tall-phone',390,844,true,3], ['large-phone',430,932,true,3], ['short-landscape',568,320,true,2], ['phone-landscape',844,390,true,3], ['portrait-tablet',768,1024,true,2], ['landscape-tablet',1024,768,true,2], ['laptop',1366,768,false,1.25], ['wide-desktop',1920,1080,false,1]];
const requested=process.argv.find(arg=>arg.startsWith('--profile='))?.slice(10);
const selected=requested?devices.filter(d=>d[0]===requested):process.argv.includes('--sample')?devices.slice(0,1):devices;
assert.ok(selected.length,'Unknown device profile');
const report = {
  schemaVersion: 1,
  startedAt: new Date().toISOString(),
  profiles: devices.map(([name, width, height, touch, dpr]) => ({
    name,
    width,
    height,
    touch,
    dpr
  })),
  cases: [],
  limitations: 'Chromium emulation with software WebGL, not physical device or browser-engine certification.'
};
(async () => {
  const b = await browserSession();
  try {
    await b.home();
    await b.evaluate(`localStorage.clear();localStorage.setItem('mf.settings',JSON.stringify({graphics:'low',reduceMotion:true,touchControls:'auto'}))`);
    await b.home();
    for (const [name, width, height, touch, dpr] of selected) {
      await b.viewport(width, height, dpr);
      await b.call('Emulation.setTouchEmulationEnabled', {
        enabled: touch,
        maxTouchPoints: 5
      });
      await b.home();
      await b.click('menu-explore-btn');
      for (const craft of EXPLORERS) {
        await b.select('explore-craft-select', craft.id);
        for (const body of BODIES.filter(b => b.parent)) {
          const label = `${name}/${craft.id}/${body.id}`;
          if (await b.evaluate(`!!document.querySelector('[data-testid=explore-destination-select]')?.offsetWidth`)) await b.select('explore-destination-select', body.id);else await b.click('destination-' + body.id);
          await b.click('explore-start-orbit');
          await b.wait(`document.querySelector('[data-testid=exploration-viewport]')?.dataset.craft===${JSON.stringify(craft.id)}`);
          await b.evaluate('window.missionForgeData.flush()');
          const saved = await b.evaluate(`JSON.parse(localStorage.getItem('mf.exploration'))`);
          assert.equal(saved.primary, body.id, label);
          assert.equal(saved.craftId, craft.id, label);
          const fleet = await b.evaluate(`JSON.parse(localStorage.getItem('mf.fleet-world'))`),
            active = fleet.entries.find(e => e.id === fleet.activeId);
          assert.equal(active.state.primary, body.id, label + ' active fleet body');
          assert.equal(active.state.craftId, craft.id, label + ' active fleet craft');
          assert.equal(await b.evaluate('document.documentElement.scrollWidth>innerWidth'),false,label+' page overflow');
          assert.equal(await b.evaluate(`(()=>{const e=document.querySelector('.explore-workspace');return e.scrollWidth>e.clientWidth+1})()`),false,label+' workspace overflow');
          assert.ok(await b.evaluate(`(()=>{const c=document.querySelector('[data-testid=exploration-viewport] canvas');return c?.width>0&&c?.height>0})()`), label + ' canvas');
          assert.ok([...saved.r, ...saved.v, saved.t, saved.fuel].every(Number.isFinite), label + ' finite state');
          await b.click('explore-view-system');
          await b.wait(b.exists('solar-map'));
          await b.click('explore-view-orbit');
          report.cases.push({
            profile: name,
            craft: craft.id,
            body: body.id,
            status: 'PASS'
          });
        }
      }
      await b.screenshot('device-'+name);
      console.log(`PASS: ${name} ${width}x${height}, 33 world/craft starts, save readback and both maps`);
    }
    assert.deepEqual(b.errors, []);
    report.status = 'PASS';
  } catch (error) {
    report.status = 'FAIL';
    report.error = error.stack;
    throw error;
  } finally {
    report.finishedAt = new Date().toISOString();
    report.total = report.cases.length;
    report.sample = selected.length!==devices.length;report.executedProfiles=selected.map(d=>d[0]);
    fs.writeFileSync(path.resolve(__dirname, '../../docs/submission/device-matrix-results.json'), JSON.stringify(report, null, 2) + '\n');
    await b.call('Emulation.setTouchEmulationEnabled', {
      enabled: false
    });
    b.close();
  }
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
