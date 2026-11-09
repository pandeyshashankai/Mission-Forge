const assert = require('node:assert/strict');
const fs = require('node:fs');
const { browserSession } = require('./browser-session.cjs');
(async () => {
  const b = await browserSession();
  try {
    await b.viewport(1440, 1000);
    await b.call('Emulation.setTouchEmulationEnabled', { enabled: false });
    await b.home();
    await b.evaluate('localStorage.clear()');
    await b.home();
    await b.click('menu-new-mission-btn');
    await b.click('mission-card-first_orbit');
    await b.click('planner-open-hangar-btn');
    const file = '/tmp/mission-forge-empty-vehicle.json';
    fs.writeFileSync(file, JSON.stringify({
      name: 'Empty vehicle failure regression',
      stack: [{ uid: 'only-fairing', partId: 'fairing_37' }],
      radials: [],
    }));
    await b.upload('[data-testid=hangar-import-input]', [file]);
    await b.click('open-readiness-btn');
    await b.click('launch-anyway-btn');
    await b.click('launch-anyway-confirm-btn');
    await b.click('start-countdown-btn');
    await b.wait(b.exists('flight-pause-btn'), 25000);
    await b.wait('!document.querySelector("[data-testid=countdown-overlay]")', 25000);
    // Stage immediately with the desktop binding, before the no-thrust pad timeout.
    // Blur the launch button so Space stages instead of activating that button.
    await b.evaluate('document.activeElement?.blur()');
    await b.call('Input.dispatchKeyEvent', { type: 'keyDown', code: 'Space', key: ' ' });
    await b.call('Input.dispatchKeyEvent', { type: 'keyUp', code: 'Space', key: ' ' });
    await b.wait('document.body.innerText.includes("All vehicle structure has been jettisoned")');
    assert.equal(await b.evaluate('document.body.innerText.includes("NaN")'), false);
    assert.deepEqual(b.errors, []);
    console.log('PASS: forced fairing-only launch ends cleanly after jettison, with readable failure UI and no NaN or browser exceptions');
  } finally {
    b.close();
  }
})().catch(error => { console.error(error); process.exit(1); });
