const assert = require('node:assert/strict');
const fs = require('node:fs');
const { browserSession } = require('./browser-session.cjs');
(async () => {
  const b = await browserSession();
  try {
    await b.viewport(1440, 900);
    await b.home();
    await b.evaluate('localStorage.setItem("mf.settings",JSON.stringify({graphics:"low",reduceMotion:false}));localStorage.removeItem("mf.exploration")');
    await b.home();
    await b.click('menu-explore-btn');
    await b.wait(b.exists('exploration-viewport'));
    await b.click('explore-view-craft');
    for (const id of ['pathfinder', 'voyager', 'lander']) {
      await b.select('explore-craft-select', id);
      await b.click('explore-start-orbit');
      await b.wait(`document.querySelector('[data-testid="exploration-viewport"]').dataset.craft==='${id}'`);
      await b.click('explore-view-craft');
      await b.pause(500);
      await b.screenshot(`craft-${id}`);
      assert.equal(await b.evaluate('document.querySelectorAll("[data-testid=exploration-viewport] canvas").length'), 1);
    }
    await b.call('Browser.setDownloadBehavior', {behavior:'allow',downloadPath:'/tmp/mission-forge-view-downloads'});
    await b.click('explore-capture');
    await b.wait('document.querySelector(".exploration-capture [role=status]").textContent.includes("saved")');
    await b.pause(500);
    const png = fs.readFileSync('/tmp/mission-forge-view-downloads/mission-forge-lander-earth.png');
    assert.equal(png.subarray(1,4).toString(), 'PNG');
    assert.ok(png.length>10000);
    await b.click('explore-view-orbit');
    await b.wait('document.querySelector("[data-testid=exploration-viewport]").dataset.camera==="orbit"');
    assert.match(await b.evaluate('document.querySelector(".orbit-legend").textContent'), /lowest point/);
    await b.screenshot('orbital-navigation');
    await b.call('Emulation.setEmulatedMedia', {features:[{name:'prefers-reduced-motion',value:'reduce'}]});
    await b.click('explore-view-craft');
    assert.equal(await b.evaluate('document.querySelector("[data-testid=exploration-viewport]").getAnimations().length'), 0);
    await b.viewport(390,844);
    await b.screenshot('craft-phone');
    assert.equal(await b.evaluate('document.documentElement.scrollWidth <= innerWidth'), true);
    const size=await b.evaluate('(()=>{const r=document.querySelector("[data-testid=explore-capture]").getBoundingClientRect();return {width:r.width,height:r.height}})()');
    assert.ok(size.width>=44&&size.height>=44);
    await b.click('explore-view-system');
    assert.equal(await b.evaluate('Boolean(document.querySelector("[data-testid=explore-capture]"))'),false);
    await b.click('explore-view-craft');
    assert.equal(b.errors.length,0,JSON.stringify(b.errors));
    console.log('PASS: three models, view switching, PNG export, reduced motion, phone layout, touch target, no browser exceptions.');
  } finally {
    await b.call('Emulation.setEmulatedMedia', {features:[]});
    b.close();
  }
})().catch(e=>{console.error(e);process.exit(1)});
