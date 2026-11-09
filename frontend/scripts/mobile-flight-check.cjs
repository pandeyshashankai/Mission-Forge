const assert = require("node:assert/strict");
const { browserSession } = require("./browser-session.cjs");
(async () => {
  const b = await browserSession();
  const { click, wait, exists, evaluate, pause } = b;
  await b.viewport(390, 844);
  await b.home();
  await evaluate(
    'localStorage.setItem("mf.settings",JSON.stringify({graphics:"low",theme:"daylight",reduceMotion:true}))',
  );
  await b.home();
  await click("menu-new-mission-btn");
  await click("mission-card-first_orbit");
  await click("planner-open-hangar-btn");
  await click("builder-panel-parts");
  await click("part-filter-control");
  await click("builder-panel-parts");
  await click("workspace-blueprint");
  await b.clickSelector("[data-testid^=blueprint-part-]");
  await click("inspect-selection");
  await wait(exists("part-inspector"));
  await click("inspect-selection");
  const count = () => evaluate('JSON.parse(localStorage.getItem("mf.autosave")).design.stack.length');
  const before = await count();
  await click("duplicate-selected-btn");
  await wait(`JSON.parse(localStorage.getItem("mf.autosave")).design.stack.length>${before}`);
  await click("studio-undo");
  assert.equal(await count(), before);
  await click("open-readiness-btn");
  await click("proceed-to-launch-btn");
  await click("start-countdown-btn");
  await wait(exists("flight-pause-btn"), 25000);
  await click("flight-pause-btn");
  await b.screenshot("flight-phone-daylight");
  await click("engineering-toggle-btn");
  await wait(exists("telemetry-mass-value"));
  await click("engineering-toggle-btn");
  await b.select("flight-camera-select", "map");
  await pause(200);
  await b.select("flight-camera-select", "chase");
  await click("end-flight-btn");
  await wait(exists("finish-flight-dialog"));
  await click("keep-flying-btn");
  await click("end-flight-btn");
  await click("confirm-finish-btn");
  await wait(exists("results-outcome"));
  await b.screenshot("results-phone-daylight");
  await click("display-settings-btn");
  await click("large-text-toggle");
  await click("theme-nebula");
  await click("settings-done");
  await click("results-menu-btn");
  await click("menu-explore-btn");
  await b.screenshot("exploration-phone");
  await click("explore-view-system");
  await click("explore-view-orbit");
  await click("explore-save");
  await click("explore-back");
  assert.deepEqual(b.errors, []);
  console.log(
    "PASS: phone builder panels, selection/duplicate/undo, preflight, countdown, flight controls, map, finish/cancel, results, themes, larger text and exploration; no uncaught errors",
  );
  b.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
