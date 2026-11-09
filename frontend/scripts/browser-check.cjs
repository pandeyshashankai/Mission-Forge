const assert = require("node:assert/strict");
const { browserSession } = require("./browser-session.cjs");
(async () => {
  const b = await browserSession();
  const { call, evaluate, wait, exists, click, pause, errors } = b;
  const screen = name => b.screenshot(name);
  try {
  await call("Runtime.enable");
  await call("Page.enable");
  await call("Emulation.setDeviceMetricsOverride", {
    width: 1440,
    height: 1000,
    deviceScaleFactor: 0.5,
    mobile: false,
  });
  await call("Page.navigate", {
    url: process.env.MISSION_FORGE_URL || "http://127.0.0.1:8080/",
  });
  await wait(exists("main-title"));
  await evaluate('localStorage.clear();localStorage.setItem("mf.settings",JSON.stringify({graphics:"low",reduceMotion:true}))');
  await evaluate("window.missionForgeData.flush()");
  await call("Page.reload");
  await wait(exists("main-title"));
  await click("menu-explore-btn");
  await wait(exists("exploration-viewport"));
  await screen("exploration-earth");
  await click("destination-mars");
  await click("explore-start-orbit");
  await click("explore-save");
  assert.equal(await evaluate('JSON.parse(localStorage.getItem("mf.exploration")).primary'), "mars");
  await click("explore-view-system");
  await wait(exists("solar-map"));
  await screen("solar-system");
  await click("destination-europa");
  await click("explore-start-orbit");
  await click("explore-play");
  await evaluate(
    `(()=>{const el=document.getElementById('explore-throttle');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(el,'20');el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));})()`,
  );
  await pause(1500);
  await click("explore-play");
  await click("explore-save");
  assert.equal(
    await evaluate(
      'JSON.parse(localStorage.getItem("mf.exploration")).primary',
    ),
    "europa",
  );
  assert.ok(
    (await evaluate(
      'JSON.parse(localStorage.getItem("mf.exploration")).fuel',
    )) < 3200,
    "Browser throttle must consume propellant",
  );
  await click("explore-back");
  await click("menu-new-mission-btn");
  await click("mission-card-first_orbit");
  await click("planner-open-hangar-btn");
  await wait(exists("assembly-placement-grid"));
  await screen("hangar");
  await click("workspace-blueprint");
  await wait(exists("blueprint-workspace"));
  await b.clickSelector('[data-testid^=blueprint-part-]');
  const before = await evaluate(
    'JSON.parse(localStorage.getItem("mf.autosave")).design.stack.length',
  );
  await b.key('d', 2);
  await pause(400);
  assert.equal(
    await evaluate(
      'JSON.parse(localStorage.getItem("mf.autosave")).design.stack.length',
    ),
    before + 1,
  );
  await click("studio-undo");
  await pause(300);
  assert.equal(
    await evaluate(
      'JSON.parse(localStorage.getItem("mf.autosave")).design.stack.length',
    ),
    before,
  );
  await click("part-filter-engine");
  assert.ok(
    (await evaluate(
      '[...document.querySelectorAll("[data-testid^=part-catalog-item]")].length',
    )) > 0,
  );
  await screen("blueprint");
  await click("open-readiness-btn");
  await click("proceed-to-launch-btn");
  await wait(exists("launch-checklist"));
  await click("start-countdown-btn");
  await wait(exists("countdown-overlay"));
  await click("countdown-hold-btn");
  const count = await evaluate(
    'document.querySelector("[data-testid=countdown-value]").textContent',
  );
  await pause(1100);
  assert.equal(
    await evaluate(
      'document.querySelector("[data-testid=countdown-value]").textContent',
    ),
    count,
  );
  await click("countdown-hold-btn");
  await wait('!document.querySelector("[data-testid=countdown-overlay]")',25000);
  await wait(exists("time-warp-10"), 20000);
  await click("engineering-toggle-btn");
  await wait(exists("telemetry-mass-value"));
  await click("engineering-toggle-btn");
  await click("end-flight-btn");
  await wait(exists("finish-flight-dialog"));
  await click("keep-flying-btn");
  await wait('!document.querySelector("[data-testid=finish-flight-dialog]")');
  await click("checkpoints-btn");
  await click("checkpoint-save-btn");
  const savedId = await evaluate(
    'JSON.parse(localStorage.getItem("mf.checkpoints"))[0].id',
  );
  await click("checkpoint-restore-" + savedId);
  await wait('!document.querySelector("[data-testid=checkpoint-dialog]")');
  await click("time-warp-10");
  await wait(
    'Number(document.querySelector("[data-testid=telemetry-altitude-value]")?.textContent.replace(/[^0-9.]/g,""))>1',
    30000,
  );
  await click("flight-pause-btn");
  const met = await evaluate(
    'document.querySelector("[data-testid=telemetry-met-value]").textContent',
  );
  await pause(1000);
  assert.equal(
    await evaluate(
      'document.querySelector("[data-testid=telemetry-met-value]").textContent',
    ),
    met,
  );
  await screen("launch");
  await click("flight-pause-btn");
  console.log(
    "PASS: exploration, system map, Europa orbit/save, builder, blueprint, filters, duplicate/undo, review, countdown hold, liftoff, pause",
  );
  if (process.argv.includes("--full-flight")) {
    await wait(exists("complete-mission-btn"), 300000);
    await screen("orbit");
    await click("complete-mission-btn");
    await wait(exists("results-outcome"));
    assert.match(
      await evaluate(
        'document.querySelector("[data-testid=results-outcome]").textContent',
      ),
      /success/i,
    );
    await screen("results");
    console.log(
      "PASS: full browser launch, staging, orbital insertion and successful report",
    );
  }
  assert.deepEqual(errors, [], "Uncaught browser exceptions");
  console.log("PASS: no uncaught browser exceptions");
  } finally { b.close(); }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
