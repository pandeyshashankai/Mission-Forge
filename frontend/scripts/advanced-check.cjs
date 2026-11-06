const assert = require("node:assert/strict"),
  fs = require("node:fs");
const { browserSession } = require("./browser-session.cjs");
require("./register.cjs");
const { FleetWorld } = require("../src/sim/advanced/fleetWorld");
const { add } = require("../src/sim/vec");
(async () => {
  const b = await browserSession();
  const input = async (id, value) => {
    await b.evaluate(
      `(()=>{const e=document.querySelector('[data-testid="${id}"]');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(e,${JSON.stringify(String(value))});e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}));})()`,
    );
    await b.pause(150);
  };
  const open = async (id) => {
    if (
      !(await b.evaluate(
        `document.querySelector('[data-testid="${id}"]').open`,
      ))
    )
      await b.clickSelector(`[data-testid="${id}"] > summary`);
  };
  const saved = () =>
    b.evaluate('JSON.parse(localStorage.getItem("mf.fleet-world"))');
  try {
    await b.viewport(390, 844);
    await b.home();
    await b.evaluate(
      'localStorage.clear();localStorage.setItem("mf.settings",JSON.stringify({graphics:"low",reduceMotion:true}))',
    );
    await b.home();
    assert.equal(
      await b.evaluate("document.documentElement.scrollWidth<=innerWidth"),
      true,
    );
    await b.screenshot("local-home-phone");
    await b.click("menu-sandbox-btn");
    await b.click("window-calculate");
    await b.wait(b.exists("window-result"));
    assert.equal(
      await b.evaluate(
        'document.querySelectorAll(".transfer-heatmap button").length',
      ),
      84,
    );
    assert.equal(
      await b.evaluate("document.documentElement.scrollWidth<=innerWidth"),
      true,
    );
    await b.screenshot("transfer-windows-phone");
    await b.click("sandbox-tab-threebody");
    await b.click("three-body-run");
    await b.wait(b.exists("three-body-result"));
    await b.screenshot("restricted-three-body");
    await b.click("sandbox-tab-frames");
    await b.click("precision-frames-run");
    await b.wait(b.exists("precision-frame-result"));
    await b.screenshot("standards-frames-phone");
    await b.click("sandbox-tab-worlds");
    await b.click("world-create");
    await b.wait(
      'document.querySelector("[data-testid=world-status]").textContent.includes("installed")',
    );
    await b.click("mission-create");
    const content = await b.evaluate(
      'JSON.parse(localStorage.getItem("mf.local-content"))',
    );
    assert.equal(content.bodies.length, 1);
    assert.equal(content.missions.length, 1);
    await b.clickSelector(
      "[data-testid=local-content-editor] .showcase-actions button:last-child",
    );
    await b.select("explore-destination-select", content.bodies[0].id);
    await b.click("explore-start-orbit");
    await b.click("explore-save");
    assert.equal(
      (await b.evaluate('JSON.parse(localStorage.getItem("mf.exploration"))'))
        .primary,
      content.bodies[0].id,
    );
    await b.screenshot("custom-world-flight");
    await b.select("explore-destination-select", "earth");
    await b.click("explore-start-orbit");
    await b.click("instrument-tab-systems");
    await open("advanced-physics");
    await b.select("physics-integrator", "accurate");
    await b.select("physics-harmonics", "8");
    await b.click("physics-relativity");
    await b.click("physics-thirdBody");
    await b.click("physics-srp");
    await b.click("physics-power");
    await b.select("physics-atmosphere", "msis");
    await b.wait(
      'document.querySelector("[data-testid=advanced-physics]").textContent.includes("NRLMSISE loaded locally")',
    );
    await b.click("explore-play");
    await b.pause(700);
    await b.click("explore-play");
    await b.click("explore-save");
    assert.equal((await saved()).entries[0].state.physics.atmosphere, "msis");
    assert.equal((await saved()).entries[0].state.physics.relativity, true);
    assert.match(
      await b.evaluate(
        'document.querySelector("[data-testid=physics-badge]").textContent',
      ),
      /1PN/,
    );
    await b.screenshot("advanced-physics-phone");
    await open("control-recorder");
    await b.click("record-start");
    await input("explore-throttle", 0.2);
    await b.click("explore-play");
    await b.pause(1000);
    await b.click("explore-play");
    await b.click("record-stop");
    await b.click("record-verify");
    await b.wait(
      'document.querySelector("[data-testid=record-status]").textContent.includes("Verified")',
      30000,
    );
    console.log(
      "PASS: browser control trace replay, including WASM density and degree-8 gravity.",
    );
    await open("flight-automation");
    await b.click("program-save");
    assert.equal(
      (
        await b.evaluate(
          'JSON.parse(localStorage.getItem("mf.flight-program"))',
        )
      ).length,
      2,
    );
    await b.click("program-arm");
    await b.click("explore-play");
    await b.pause(450);
    await b.click("touch-cutThrottle");
    await b.click("explore-play");
    assert.match(
      await b.evaluate(
        'document.querySelector("[data-testid=flight-automation] > summary").textContent',
      ),
      /disarmed/,
    );
    await b.click("instrument-tab-plan");
    await open("aerobraking-panel");
    await b.click("aerobrake-predict");
    await b.wait(b.exists("aerobrake-result"), 30000);
    await b.select("explore-destination-select", "moon");
    await open("encounter-planner");
    await input("encounter-hours", 1);
    await b.click("encounter-predict");
    await b.wait(b.exists("encounter-result"), 30000);
    await b.screenshot("coast-and-entry-planning-phone");
    await b.select("explore-destination-select", "earth");
    console.log(
      "PASS: persistent visual program, manual cutoff, non-blocking entry and closest-approach workers.",
    );
    await b.click("instrument-tab-fleet");
    await open("fleet-panel");
    await b.click("fleet-create");
    await b.click("explore-save");
    const fleet = await saved();
    assert.equal(fleet.entries.length, 2);
    await b.select("fleet-target", fleet.entries[1].id);
    await b.click("fleet-approach");
    await b.click("explore-play");
    await b.pause(500);
    await b.click("explore-play");
    await b.click("explore-save");
    await b.click("explore-view-fleet");
    await b.screenshot("fleet-rendezvous-phone");
    await b.click("fleet-dock");
    assert.match(
      await b.evaluate(
        'document.querySelector("[data-testid=fleet-panel] [role=status]").textContent',
      ),
      /25 m/,
    );
    const fixture = new FleetWorld(),
      guest = fixture.create("pathfinder");
    fixture.active.fuel -= 100;
    guest.sim.r = add(fixture.active.r, [10, 0, 0]);
    guest.sim.v = add(fixture.active.v, [0.1, 0, 0]);
    fs.writeFileSync(
      "/tmp/mission-forge-dock-fixture.json",
      JSON.stringify(fixture.serialize()),
    );
    await b.upload(".explore-header input[type=file]", [
      "/tmp/mission-forge-dock-fixture.json",
    ]);
    await b.select("fleet-target", guest.id);
    await b.click("fleet-dock");
    await b.click("explore-save");
    const docked = await saved();
    assert.equal(docked.links.length, 1);
    const beforeFuel = docked.entries.reduce((sum, e) => sum + e.state.fuel, 0);
    // Use labelled controls; avoid selecting the export action.

    await b.click("fleet-receive");
    await b.click("explore-save");
    assert.equal(
      (await saved()).entries.reduce((sum, e) => sum + e.state.fuel, 0),
      beforeFuel,
    );
    assert.equal((await saved()).entries[0].state.fuel, 3200);
    await b.click("fleet-undock");
    await b.click("explore-save");
    assert.equal((await saved()).links.length, 0);
    await b.click("explore-back");
    await b.home();
    await b.click("menu-explore-btn");
    await b.click("explore-save");
    assert.equal((await saved()).entries.length, 2);
    console.log(
      "PASS: persistent fleet, formation camera, invalid/valid docking, conserved fuel transfer and undocking.",
    );
    await b.home();
    await b.click("menu-science-btn");
    await b.click("science-tab-validation");
    await b.click("advanced-checks-run");
    await b.wait(
      'document.querySelector("[data-testid=advanced-checks-summary]")?.textContent.includes("4 / 4 Orekit")',
    );
    assert.match(
      await b.evaluate(
        'document.querySelector("[data-testid=advanced-checks-summary]").textContent',
      ),
      /6 \/ 6/,
    );
    await b.wait(
      'document.querySelector("[data-testid=precision-checks-summary]")?.textContent.includes("27 / 27")',
    );
    assert.match(
      await b.evaluate(
        'document.querySelector("[data-testid=precision-checks-summary]").textContent',
      ),
      /5 \/ 5/,
    );
    assert.match(
      await b.evaluate(
        'document.querySelector("[data-testid=precision-checks-summary]").textContent',
      ),
      /2 \/ 2/,
    );
    await b.screenshot("external-validation-phone");
    assert.equal(b.errors.length, 0, JSON.stringify(b.errors));
    console.log(
      "PASS: local Lambert grid, CR3BP, standards frames, playable custom world, custom mission and external-tool validation; no browser exceptions.",
    );
  } finally {
    b.close();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
