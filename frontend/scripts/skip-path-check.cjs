require('./register.cjs');
const assert = require('node:assert/strict'),
  fs = require('node:fs'),
  path = require('node:path');
const {
  browserSession
} = require('./browser-session.cjs');
// Derive step counts from the displayed progression, instead of duplicating UI instructions.
(async () => {
  const b = await browserSession(),
    results = [];
  try {
    for (const raw of ['{bad', JSON.stringify({
      id: 'first_orbit',
      step: 999
    }), JSON.stringify({
      id: 'constructor',
      step: 0
    })]) {
      await b.home();
      await b.evaluate(`localStorage.setItem('mf.tutorial',${JSON.stringify(raw)});window.missionForgeData.flush()`);
      await b.home();
      assert.equal(await b.evaluate(b.exists('tutorial-hint')), false);
      results.push({
        corruptTutorialIgnored: raw
      });
    }
    for (const [width, height] of [[320, 568], [390, 844], [568, 320], [1366, 768]]) {
      await b.viewport(width, height);
      await b.home();
      await b.clickSelector('.home-tutorials > summary');
      const ids = await b.evaluate(`Array.from(document.querySelectorAll('[data-testid^=tutorial-start-]'),e=>e.dataset.testid)`);
      assert.deepEqual(ids.sort(), ['tutorial-start-first_orbit', 'tutorial-start-maneuvers']);
      for (const id of ids) {
        await b.click(id);
        let steps = 0;
        while (await b.evaluate(b.exists('tutorial-skip-btn'))) {
          assert.ok(++steps <= 30, 'tutorial must terminate');
          await b.click('tutorial-skip-btn');
        }
        assert.ok(steps > 0);
        results.push({
          viewport: [width, height],
          tutorial: id,
          skipped: steps
        });
        await b.click(id);
        await b.click('tutorial-close-btn');
        assert.equal(await b.evaluate(b.exists('tutorial-hint')), false);
      }
      await b.home();
      await b.click('quick-first-orbit');
      await b.click('checklist-back-btn');
      await b.wait(b.exists('proceed-to-launch-btn'));
      await b.click('proceed-to-launch-btn');
      await b.click('start-countdown-btn');
      await b.click('countdown-hold-btn');
      const count = await b.evaluate(`document.querySelector('[data-testid=countdown-value]').textContent`);
      await b.pause(1200);
      assert.equal(await b.evaluate(`document.querySelector('[data-testid=countdown-value]').textContent`), count);
      await b.click('countdown-scrub-btn');
      await b.wait(b.exists('launch-checklist'));
      assert.equal(await b.evaluate(b.exists('countdown-overlay')), false);
      results.push({
        viewport: [width, height],
        checklistBack: true,
        countdownHold: true,
        countdownScrub: true
      });
      await b.home();
      await b.click('quick-first-orbit');
      await b.click('start-countdown-btn');
      await b.wait('!document.querySelector("[data-testid=countdown-overlay]")&&!document.querySelector("[data-testid=launch-checklist]")', 25000);
      await b.click('flight-pause-btn');
      await b.click('end-flight-btn');
      await b.click('keep-flying-btn');
      assert.equal(await b.evaluate(b.exists('finish-flight-dialog')), false);
      await b.click('end-flight-btn');
      await b.click('confirm-finish-btn');
      await b.wait(b.exists('results-outcome'));
      results.push({
        viewport: [width, height],
        finishCancel: true,
        finishConfirm: true
      });
    }
    assert.deepEqual(b.errors, []);
    fs.writeFileSync(path.resolve(require('./audit-output.cjs'), 'skip-path-results.json'), JSON.stringify({
      status: 'PASS',
      results
    }, null, 2) + '\n');
    console.log('PASS: all tutorial skip/close paths and checklist back, countdown hold/scrub, finish cancel/confirm on four viewport profiles');
  } finally {
    b.close();
  }
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
