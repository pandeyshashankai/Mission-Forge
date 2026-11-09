const assert = require("node:assert/strict");
const fs = require("node:fs");
const { browserSession } = require("./browser-session.cjs");
require("./register.cjs");
const { ExplorationSim } = require("../src/sim/exploration");
(async () => {
  const b = await browserSession(),
    { evaluate, click, wait, exists, call } = b;
  const setInput = async (id, value) => {
    await evaluate(
      `(()=>{const e=document.querySelector('[data-testid="${id}"]');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(e,${JSON.stringify(String(value))});e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}));})()`,
    );
    await b.pause(150);
  };
  const saved = () =>
    evaluate('JSON.parse(localStorage.getItem("mf.exploration"))');
  const phase = (name) =>
    `document.querySelector('[data-testid="transfer-phase"]')?.textContent.includes(${JSON.stringify(name)})`;
  await b.viewport(390, 844);
  await b.home();
  await evaluate(
    'localStorage.clear();localStorage.setItem("mf.settings",JSON.stringify({graphics:"low",reduceMotion:true}))',
  );
  await b.home();
  await click("menu-science-btn");
  await click("science-tab-engineering");
  await wait(exists("engineering-lab"));
  await setInput("engineering-speed", 4000);
  const q1 = await evaluate(
    'Number(document.querySelector("[data-testid=engineering-q]").textContent.replace(/[^0-9.]/g,""))',
  );
  await setInput("engineering-speed", 8000);
  const q2 = await evaluate(
    'Number(document.querySelector("[data-testid=engineering-q]").textContent.replace(/[^0-9.]/g,""))',
  );
  assert.ok(Math.abs(q2 / q1 - 4) < 0.05);
  const earthDensity = await evaluate(
    'document.querySelector("[data-testid=engineering-density]").textContent',
  );
  await b.select("engineering-world", "mars");
  assert.notEqual(
    await evaluate(
      'document.querySelector("[data-testid=engineering-density]").textContent',
    ),
    earthDensity,
  );
  await setInput("engineering-fuel", 0);
  assert.match(
    await evaluate(
      'document.querySelector("[data-testid=engineering-delta-v]").textContent',
    ),
    /^0 m\/s/,
  );
  await setInput("engineering-fuel", 3200);
  await b.screenshot("engineering-workbench-phone");
  await click("science-tab-validation");
  await click("science-run-checks");
  await wait(exists("engineering-checks"));
  assert.match(
    await evaluate(
      'document.querySelector("[data-testid=engineering-checks]").textContent',
    ),
    /6 \/ 6 pass/,
  );
  console.log(
    "PASS: phone engineering workbench uses NASA densities, speed-squared dynamic pressure, rocket equation and six independent engineering checks",
  );
  await click("science-home");
  await click("menu-explore-btn");
  await wait(exists("exploration-viewport"));
  await b.viewport(1440, 1000);
  await click('instrument-tab-plan');
  await b.clickSelector('[data-testid="explore-transfer-panel"] > summary');
  await setInput("transfer-target", 500);
  await click("explore-save");
  const initial = await saved();
  await click("transfer-start");
  await wait(phase("Coast"), 45000);
  await click("explore-save");
  const burned = await saved();
  assert.ok(burned.fuel < initial.fuel);
  assert.ok(burned.t > initial.t);
  await b.screenshot("engineering-transfer-coast");
  await click("explore-warp-1000");
  await wait(phase("Ready"), 30000);
  await click("explore-save");
  const ready = await saved();
  await b.pause(500);
  await click("explore-save");
  assert.equal((await saved()).t, ready.t);
  await click("transfer-circularize");
  await wait(exists("transfer-complete"), 45000);
  await click("explore-save");
  const finished = await saved(),
    nav = ExplorationSim.restore(finished).navigation();
  assert.ok(Math.abs(nav.el.apoapsis - 500000) < 1500);
  assert.ok(Math.abs(nav.el.periapsis - 500000) < 1500);
  assert.ok(finished.fuel < burned.fuel);
  await b.screenshot("engineering-transfer-complete");
  await setInput("transfer-target", 800);
  await click("transfer-start");
  await wait(phase("First burn"));
  await call("Input.dispatchKeyEvent", {
    type: "keyDown",
    code: "KeyW",
    key: "w",
  });
  await call("Input.dispatchKeyEvent", {
    type: "keyUp",
    code: "KeyW",
    key: "w",
  });
  await wait(`!(${exists("transfer-phase")})`);
  await click("explore-save");
  const cancelled = await saved();
  await b.pause(400);
  await click("explore-save");
  assert.equal((await saved()).fuel, cancelled.fuel);
  assert.match(cancelled.log.at(-1).text, /cancelled/);
  await b.viewport(390, 844);
  await call("Emulation.setTouchEmulationEnabled", {
    enabled: true,
    maxTouchPoints: 5,
  });
  // Resizing closes the mobile drawer; open it through the visible UI before touch.
  await click("explore-instruments-toggle");
  const tap = async (id) => {
    await evaluate(
      `document.querySelector('[data-testid="${id}"]').scrollIntoView({block:'center',behavior:'instant'})`,
    );
    await b.pause(150);
    const p = await evaluate(
      `(()=>{const e=document.querySelector('[data-testid="${id}"]'),r=e.getBoundingClientRect(),x=r.x+r.width/2,y=r.y+r.height/2,hit=document.elementFromPoint(x,y);return {x,y,width:r.width,height:r.height,ok:e===hit||e.contains(hit)}})()`,
    );
    assert.ok(
      p.ok && p.height >= 44 && p.width >= 44,
      `${id} touch target must be reachable: ${JSON.stringify(p)}`,
    );
    await call("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [
        { x: p.x, y: p.y, id: 1, radiusX: 5, radiusY: 5, force: 1 },
      ],
    });
    await call("Input.dispatchTouchEvent", {
      type: "touchEnd",
      touchPoints: [],
    });
  };
  await tap("transfer-start");
  await wait(phase("First burn"));
  await b.screenshot("engineering-transfer-phone");
  await tap("transfer-cancel");
  await wait(`!(${exists("transfer-phase")})`);
  console.log(
    "PASS: real phone touch starts and cancels transfer assistance with reachable 44px targets",
  );
  assert.deepEqual(b.errors, []);
  fs.writeFileSync(
    "/tmp/mission-forge-engineering-browser.json",
    JSON.stringify(
      {
        status: "pass",
        initialFuel: initial.fuel,
        finalFuel: finished.fuel,
        apoapsis: nav.el.apoapsis,
        periapsis: nav.el.periapsis,
        exceptions: b.errors,
      },
      null,
      2,
    ),
  );
  console.log(
    "PASS: real browser finite transfer, coast hold, confirmed circularization, achieved orbit, fuel use, and keyboard takeover; no uncaught exceptions",
  );
  b.close();
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
