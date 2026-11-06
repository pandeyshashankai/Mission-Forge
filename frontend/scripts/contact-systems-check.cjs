const assert = require("node:assert/strict"),
  fs = require("node:fs");
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
    await b.click("physics-oceanTides");
    await b.click("physics-damage");
    await b.evaluate(
      `(()=>{const e=document.querySelector('option[value=aluminium]').parentElement;e.value='aluminium';e.dispatchEvent(new Event('change',{bubbles:true}))})()`,
    );
    await b.click("explore-play");
    await b.pause(400);
    await b.click("explore-play");
    await b.click("explore-save");
    let saved = await b.evaluate(
      'JSON.parse(localStorage.getItem("mf.exploration"))',
    );
    assert.equal(saved.physics.oceanTides, true);
    assert.equal(saved.physics.thermalMaterial, "aluminium");
    const records = Array.from({ length: 12 }, (_, i) => {
      const temperature = 300 + 20 * i,
        rate = 0.2 + 0.02 * i;
      return {
        temperature,
        rate,
        flux:
          (180000 * rate +
            0.8 * 5.670374419e-8 * 8 * (temperature ** 4 - 300 ** 4)) /
          8,
      };
    });
    fs.writeFileSync(
      "/tmp/mission-forge-thermal-test.json",
      JSON.stringify({
        source: "Synthetic browser fixture, not measured spacecraft",
        records,
      }),
    );
    await b.evaluate(
      `(()=>{const label=[...document.querySelectorAll('label')].find(e=>e.textContent.includes('Import thermal measurements'));label.querySelector('input').id='thermal-measurements-test'})()`,
    );
    await b.upload("#thermal-measurements-test", [
      "/tmp/mission-forge-thermal-test.json",
    ]);
    await b.wait(
      '!document.querySelector("option[value=calibrated]").disabled',
    );
    await b.evaluate(
      `(()=>{const e=document.querySelector('option[value=calibrated]').parentElement;e.value='calibrated';e.dispatchEvent(new Event('change',{bubbles:true}))})()`,
    );
    await b.click("explore-save");
    saved = await b.evaluate(
      'JSON.parse(localStorage.getItem("mf.exploration"))',
    );
    assert.equal(saved.thermalCalibration.records.length, 12);
    await b.click("instrument-tab-fleet");
    await b.clickSelector("[data-testid=fleet-panel] > summary");
    await b.evaluate(
      `(()=>{const label=[...document.querySelectorAll('label')].find(e=>e.textContent.includes('Rigid-body hull contacts'));label.querySelector('input').click()})()`,
    );
    await b.click("explore-play");
    await b.pause(500);
    await b.click("explore-play");
    await b.click("explore-save");
    const world = await b.evaluate(
      'JSON.parse(localStorage.getItem("mf.fleet-world"))',
    );
    assert.equal(world.rigidContacts, true);
    assert.ok(world.entries[0].state.rigidEnabled);
    assert.ok(world.entries[0].state.rigid.q.every(Number.isFinite));
    await b.click("fleet-create");
    await b.click("explore-save");
    let fleet = await b.evaluate(
      'JSON.parse(localStorage.getItem("mf.fleet-world"))',
    );
    assert.equal(fleet.entries.length, 2);
    assert.ok(
      fleet.entries.every(
        (e) => e.state.thermalCalibration.records.length === 12,
      ),
    );
    await b.home();
    await b.click("menu-explore-btn");
    await b.click("explore-save");
    fleet = await b.evaluate(
      'JSON.parse(localStorage.getItem("mf.fleet-world"))',
    );
    assert.equal(fleet.entries.length, 2);
    assert.ok(
      fleet.entries.every(
        (e) => e.state.physics.thermalMaterial === "calibrated",
      ),
    );
    await b.click("instrument-tab-fleet");
    await b.evaluate(
      `(()=>{const d=document.querySelector('[data-testid=fleet-panel]');d.open=true;const label=[...d.querySelectorAll('label')].find(e=>e.textContent.includes('Vessel collision damage'));if(!label.querySelector('input').checked)throw Error('Rigid mode must enable collision switch');label.querySelector('input').click()})()`,
    );
    await b.click("explore-save");
    fleet = await b.evaluate(
      'JSON.parse(localStorage.getItem("mf.fleet-world"))',
    );
    assert.equal(fleet.collisions, false);
    assert.equal(fleet.rigidContacts, false);
    assert.ok(fleet.entries.every((e) => !e.state.rigidEnabled));
    assert.deepEqual(b.errors, []);
    console.log(
      "PASS: phone ocean tides, source-backed material, measured-data fitter, calibration save and rigid-body contact controls; no browser exceptions",
    );
  } finally {
    b.close();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
