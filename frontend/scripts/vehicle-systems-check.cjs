const assert = require("node:assert/strict");
const { browserSession } = require("./browser-session.cjs");
(async () => {
  const b = await browserSession();
  try {
    await b.viewport(390, 844);
    await b.home();
    await b.evaluate("localStorage.clear()");
    await b.home();
    await b.click("menu-explore-btn");
    await b.click("instrument-tab-systems");
    await b.clickSelector("[data-testid=advanced-physics] > summary");
    await b.click("physics-damage");
    await b.click("physics-tides");
    await b.click("physics-advancedTides");
    await b.evaluate(
      `(()=>{const e=document.querySelector('option[value=de421]').parentElement;e.value='de421';e.dispatchEvent(new Event('change',{bubbles:true}))})()`,
    );
    await b.click("explore-play");
    await b.pause(400);
    await b.click("explore-play");
    await b.click("explore-save");
    const saved = await b.evaluate(
      'JSON.parse(localStorage.getItem("mf.exploration"))',
    );
    assert.equal(saved.physics.ephemeris, "de421");
    assert.equal(saved.physics.damage, true);
    assert.equal(saved.physics.advancedTides, true);
    assert.ok(saved.damage.temperature > 0);
    await b.wait(b.exists("damage-status"));
    assert.ok(
      await b.evaluate("document.documentElement.scrollWidth<=innerWidth"),
    );
    await b.click("instrument-tab-fleet");
    await b.clickSelector("[data-testid=fleet-panel] > summary");
    await b.evaluate(
      `(()=>{const e=[...document.querySelectorAll('[data-testid=fleet-panel] label')].find(e=>e.textContent.includes('Port geometry'));e.querySelector('input').click()})()`,
    );
    await b.click("explore-save");
    assert.equal(
      (await b.evaluate('JSON.parse(localStorage.getItem("mf.fleet-world"))'))
        .strictDocking,
      true,
    );
    assert.deepEqual(b.errors, []);
    console.log(
      "PASS: phone thermal, degree-three tides, JPL flight, saved damage and strict docking controls; no browser exceptions",
    );
  } finally {
    b.close();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
