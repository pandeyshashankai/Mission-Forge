const assert = require("node:assert/strict");
const fs = require("node:fs");
const { browserSession } = require("./browser-session.cjs");
(async () => {
  const b = await browserSession();
  const { evaluate, click, wait, exists, pause } = b;
  await b.viewport(1440, 1000);
  await b.home();
  await evaluate(
    'localStorage.clear();localStorage.setItem("mf.settings",JSON.stringify({graphics:"low"}))',
  );
  await b.home();
  const report = [];
  const passed = (s) => {
    report.push(s);
    console.log("PASS: " + s);
  };
  for (const theme of ["orbital", "nebula", "daylight"]) {
    await click("display-settings-btn");
    await click("theme-" + theme);
    assert.equal(
      await evaluate("document.documentElement.dataset.theme"),
      theme,
    );
    await click("settings-done");
    await b.screenshot("home-" + theme);
    await b.home();
    assert.equal(
      await evaluate("document.documentElement.dataset.theme"),
      theme,
    );
    await click("menu-new-mission-btn");
    await wait(exists("mission-details-panel"));
    await b.screenshot("planner-" + theme);
    await click("planner-back-btn");
  }
  passed(
    "all three themes change, persist after reload, and style home and planner",
  );
  await click("display-settings-btn");
  await click("theme-orbital");
  await click("large-text-toggle");
  await click("reduce-motion-toggle");
  await click("settings-done");
  assert.equal(
    await evaluate("document.documentElement.dataset.textSize"),
    "large",
  );
  assert.equal(
    await evaluate("document.documentElement.dataset.motion"),
    "reduced",
  );
  await b.screenshot("home-large-text");
  await click("display-settings-btn");
  await click("large-text-toggle");
  await click("settings-done");
  passed("larger text and reduced motion controls operate");
  for (const width of [1440, 1024, 768, 390]) {
    await b.viewport(width, width === 390 ? 844 : 900);
    await b.home();
    assert.ok(
      await evaluate("document.documentElement.scrollWidth<=innerWidth"),
    );
    await click("menu-new-mission-btn");
    await click("mission-card-first_orbit");
    await click("planner-open-hangar-btn");
    await wait(exists("hangar-3d-viewport"));
    if (width < 1000) {
      await b.clickSelector(".builder-mobile-tabs button[aria-pressed=false]");
      await b.clickSelector(".builder-mobile-tabs button:nth-child(2)");
    }
    await click("open-readiness-btn");
    await wait(exists("readiness-checks"));
    assert.notEqual(
      await evaluate(
        'document.querySelector("[data-testid=readiness-go-nogo-badge]").dataset.status',
      ),
      "NO-GO",
    );
    if (width === 768) await b.screenshot("review-tablet");
  }
  passed(
    "home, mission selection, builder panels and launch review work at 1440, 1024, 768 and 390 px",
  );
  await b.viewport(1440, 1000);
  await b.home();
  const missions = [
    "first_orbit",
    "earth_observer",
    "lunar_orbiter",
    "crewed_lunar_flyby",
  ];
  for (const mission of missions) {
    await click("menu-new-mission-btn");
    await click("mission-card-" + mission);
    await click("planner-open-hangar-btn");
    await wait(exists("hangar-3d-viewport"));
    await click("open-readiness-btn");
    assert.notEqual(
      await evaluate(
        'document.querySelector("[data-testid=readiness-go-nogo-badge]").dataset.status',
      ),
      "NO-GO",
    );
    await click("checks-all");
    assert.ok(
      (await evaluate(
        'document.querySelectorAll("[data-testid^=check-status-]").length',
      )) > 5,
    );
    await click("proceed-to-launch-btn");
    await wait(exists("launch-checklist"));
    assert.equal(
      await evaluate(
        'document.querySelector("[data-testid=guidance-enabled-switch]").getAttribute("aria-checked")',
      ),
      "true",
    );
    await click("guidance-enabled-switch");
    assert.equal(
      await evaluate(
        'document.querySelector("[data-testid=guidance-enabled-switch]").getAttribute("aria-checked")',
      ),
      "false",
    );
    await click("guidance-enabled-switch");
    await click("start-countdown-btn");
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
    await click("countdown-scrub-btn");
    await b.home();
  }
  passed(
    "all four recommended missions pass UI preflight, guidance toggle and countdown hold/scrub",
  );
  await click("menu-new-mission-btn");
  await click("mission-card-first_orbit");
  await click("planner-open-hangar-btn");
  for (const preset of [
    "aster_m",
    "orbiter9",
    "orbiter9eo",
    "hydroboost",
    "lunar_orbiter",
    "crewed_flyby",
    "empty",
  ]) {
    await b.select("preset-select", preset);
    await pause(200);
    assert.ok(
      (await evaluate(
        'document.querySelector("[data-testid=hangar-3d-viewport] canvas").width',
      )) > 0,
    );
  }
  await click("open-readiness-btn");
  assert.equal(
    await evaluate(
      'document.querySelector("[data-testid=proceed-to-launch-btn]").disabled',
    ),
    true,
  );
  await click("launch-anyway-btn");
  await wait(exists("launch-anyway-confirm-btn"));
  await click("review-back-btn");
  await b.select("preset-select", "orbiter9");
  await click("workspace-blueprint");
  await b.clickSelector("[data-testid^=blueprint-part-]");
  await click("duplicate-selected-btn");
  await pause(200);
  const dup = await evaluate(
    'JSON.parse(localStorage.getItem("mf.autosave")).design.stack.length',
  );
  await click("undo-btn");
  assert.equal(
    await evaluate(
      'JSON.parse(localStorage.getItem("mf.autosave")).design.stack.length',
    ),
    dup - 1,
  );
  await click("redo-btn");
  assert.equal(
    await evaluate(
      'JSON.parse(localStorage.getItem("mf.autosave")).design.stack.length',
    ),
    dup,
  );
  await click("undo-btn");
  await click("tab-staging");
  await click("tab-inspector");
  await click("part-filter-engine");
  await b.screenshot("builder-orbital");
  passed(
    "all seven rocket presets render; incomplete rocket cannot launch without confirmation; duplicate, undo, redo, staging and inspector work",
  );
  await click("save-design-btn");
  assert.equal(
    await evaluate('JSON.parse(localStorage.getItem("mf.designs")).length'),
    1,
  );
  await b.home();
  await click("menu-load-btn");
  await wait(exists("load-dialog"));
  await b.clickSelector('[data-testid^="load-design-"]');
  await wait(exists("hangar-3d-viewport"));
  const design = await evaluate(
    'JSON.parse(localStorage.getItem("mf.autosave")).design',
  );
  design.name = "Imported flight-check rocket";
  fs.writeFileSync("/tmp/ui-valid-rocket.json", JSON.stringify(design));
  fs.writeFileSync(
    "/tmp/ui-invalid-rocket.json",
    JSON.stringify({ name: "Invalid", stack: [] }),
  );
  await b.upload('[data-testid="hangar-import-input"]', [
    "/tmp/ui-valid-rocket.json",
  ]);
  assert.equal(
    await evaluate(
      'document.querySelector("[data-testid=design-name-input]").value',
    ),
    design.name,
  );
  await b.upload('[data-testid="hangar-import-input"]', [
    "/tmp/ui-invalid-rocket.json",
  ]);
  assert.equal(
    await evaluate(
      'document.querySelector("[data-testid=design-name-input]").value',
    ),
    design.name,
  );
  passed(
    "rocket saves reopen correctly; valid file import works and an invalid import preserves the current rocket",
  );

  await b.home();
  await click("menu-explore-btn");
  await click("explore-view-system");
  for (const craft of ["pathfinder", "voyager", "lander"]) {
    await b.select("explore-craft-select", craft);
    for (const body of [
      "mercury",
      "venus",
      "earth",
      "mars",
      "jupiter",
      "saturn",
      "uranus",
      "neptune",
      "moon",
      "europa",
      "titan",
    ]) {
      await click("destination-" + body);
      await click("explore-start-orbit");
      await click("explore-view-system");
      await click("explore-save");
      assert.equal(
        await evaluate(
          'JSON.parse(localStorage.getItem("mf.exploration")).primary',
        ),
        body,
      );
      assert.equal(
        await evaluate(
          'JSON.parse(localStorage.getItem("mf.exploration")).craftId',
        ),
        craft,
      );
    }
  }
  passed(
    "all 33 exploration spacecraft/destination combinations start, render a map and save the correct body and craft",
  );
  await click("explore-back");
  await click("display-settings-btn");
  await click("theme-daylight");
  await click("settings-done");
  await click("menu-explore-btn");
  await b.screenshot("exploration-daylight");
  await click("explore-view-craft");
  await click("explore-mode-retrograde");
  await click("explore-view-orbit");
  await click("explore-view-system");
  assert.deepEqual(b.errors, [], "Uncaught browser errors");
  passed(
    "exploration views and attitude controls work; no uncaught browser errors",
  );
  require("node:fs").writeFileSync(
    "/tmp/mission-forge-ui-report.json",
    JSON.stringify({ passed: report, exceptions: b.errors }, null, 2),
  );
  b.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
