const assert = require("node:assert/strict"),
  fs = require("node:fs");
const { browserSession } = require("./browser-session.cjs");
(async () => {
  const b = await browserSession(),
    cases = [];
  const geometry = async (selector, mode, w, h) => {
    const result = await b.evaluate(
      `(()=>{const e=document.querySelector(${JSON.stringify(selector)}),r=e.getBoundingClientRect(),hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);const controls=[...document.querySelectorAll('[data-testid=touch-flight-controls] button, .explore-view-tabs button, [data-testid=explore-capture]')].map(e=>{const q=e.getBoundingClientRect(),p=document.elementFromPoint(q.x+q.width/2,q.y+q.height/2);return {id:e.dataset.testid,w:q.width,h:q.height,visible:q.x>=0&&q.y>=0&&q.right<=innerWidth+1&&q.bottom<=innerHeight+1,hit:p===e||e.contains(p),overlapsCamera:q.left<r.right&&q.right>r.left&&q.top<r.bottom&&q.bottom>r.top}});return {width:r.width,height:r.height,center:hit?.tagName,controls,overflow:document.documentElement.scrollWidth>innerWidth};})()`,
    );
    assert.equal(
      result.center,
      "CANVAS",
      mode + "/" + w + " camera center obstructed",
    );
    // Overlay controls never reduce the rendered flight area.
    assert.ok(
      result.width >= w * (0.99),
      JSON.stringify(result),
    );
    assert.ok(
      result.height >= h * (w > h ? 0.45 : 0.32),
      mode + " insufficient camera space " + JSON.stringify(result),
    );
    for (const c of result.controls) {
      assert.ok(
        c.visible && c.hit && c.w >= 40 && c.h >= 40,
        mode + "/" + w + " " + JSON.stringify(c),
      );
    }
    assert.equal(result.overflow, false);
    cases.push({ mode, w, h, ...result });
  };
  try {
    await b.viewport(390, 844);
    await b.home();
    await b.evaluate(
      "localStorage.clear();localStorage.setItem('mf.settings',JSON.stringify({graphics:'low',touchControls:'on',reduceMotion:true}))",
    );
    await b.home();
    await b.click("menu-explore-btn");
    await b.click("explore-view-craft");
    for (const [w, h] of [
      [320, 568],
      [390, 844],
      [430, 932],
      [568, 320],
      [844, 390],
      [768, 1024],
    ]) {
      await b.viewport(w, h);
      await b.pause(400);
      await geometry("[data-testid=exploration-viewport]", "explore", w, h);
      await b.click("explore-instruments-toggle");
      await b.wait(
        "getComputedStyle(document.querySelector('.explore-inspector')).display!=='none'",
      );
      await b.select("explore-destination-select", "earth");
      await b.click("explore-instruments-toggle");
      await b.screenshot("clear-exploration-" + w);
    }
    await b.viewport(390, 844);
    await b.home();
    await b.click("quick-first-orbit");
    await b.click("start-countdown-btn");
    await b.wait(
      '!document.querySelector("[data-testid=countdown-overlay]") && !document.querySelector("[data-testid=launch-checklist]")',
      25000,
    );
    await b.click("flight-pause-btn");
    for (const [w, h] of [
      [320, 568],
      [390, 844],
      [430, 932],
      [568, 320],
      [844, 390],
      [768, 1024],
    ]) {
      await b.viewport(w, h);
      await b.pause(400);
      await geometry("[data-testid=flight-3d-viewport]", "campaign", w, h);
      await b.click("engineering-toggle-btn");
      await b.wait(
        "getComputedStyle(document.querySelector('.flight-instrument-panels')).display==='grid'",
      );
      await b.click("engineering-toggle-btn");
      await b.screenshot("clear-campaign-" + w);
    }
    for (const [w, h, insets] of [
      [390, 844, { top: 59, bottom: 34, left: 0, right: 0 }],
      [844, 390, { top: 0, bottom: 21, left: 44, right: 44 }],
    ]) {
      await b.viewport(w, h);
      await b.call("Emulation.setSafeAreaInsetsOverride", { insets });
      await b.pause(300);
      await geometry(
        "[data-testid=flight-3d-viewport]",
        "campaign-safe-area",
        w,
        h,
      );
      const bounds = await b.evaluate(
        "[...document.querySelectorAll('[data-testid=touch-flight-controls] button')].map(e=>{const r=e.getBoundingClientRect();return {left:r.left,right:r.right,bottom:r.bottom}})",
      );
      for (const r of bounds) {
        assert.ok(
          r.left >= insets.left &&
            r.right <= w - insets.right &&
            r.bottom <= h - insets.bottom,
          JSON.stringify(r),
        );
      }
    }
    await b.call("Emulation.setSafeAreaInsetsOverride", {
      insets: { top: 0, bottom: 0, left: 0, right: 0 },
    });
    await b.click("display-settings-btn");
    await b.click("settings-tab-controls");
    await b.select("touch-controls-select", "off");
    await b.click("settings-done");
    await b.viewport(1440, 1000);
    await b.pause(300);
    assert.equal(
      await b.evaluate(
        "getComputedStyle(document.querySelector('.flight-instrument-panels')).display",
      ),
      "none",
    );
    assert.deepEqual(b.errors, []);
    fs.writeFileSync(
      "/tmp/mission-forge-mobile-visibility.json",
      JSON.stringify(
        {
          status: "PASS",
          cases,
          scope:
            "Camera space and all primary button hit targets, portrait/landscape, drawer access and desktop layout. Chromium emulation, not hardware certification.",
        },
        null,
        2,
      ),
    );
    console.log(
      "PASS: 14 camera/control layouts including safe areas, instrument drawers and desktop layout",
    );
  } finally {
    b.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
