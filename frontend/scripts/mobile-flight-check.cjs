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
  await b.clickSelector(".builder-mobile-tabs button:first-child");
  await click("part-filter-control");
  await b.clickSelector(".builder-mobile-tabs button:nth-child(2)");
  await click("workspace-blueprint");
  await b.clickSelector("[data-testid^=blueprint-part-]");
  await wait(exists("part-inspector"));
  await click("duplicate-inspected-btn");
  await click("undo-btn");
  await b.clickSelector(".builder-mobile-tabs button:nth-child(2)");
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
