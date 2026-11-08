const assert = require("node:assert/strict"),
  fs = require("node:fs"),
  path = require("node:path");
const { browserSession } = require("./browser-session.cjs");
const input = (id, value, area = false) =>
  `(()=>{const e=document.querySelector('[data-testid=${id}]');Object.getOwnPropertyDescriptor(${area ? "HTMLTextAreaElement" : "HTMLInputElement"}.prototype,'value').set.call(e,${JSON.stringify(value)});e.dispatchEvent(new Event('input',{bubbles:true}));})()`;
(async () => {
  const b = await browserSession(),
    checks = [];
  try {
    await b.viewport(390, 844);
    await b.home();
    await b.evaluate(
      "localStorage.clear();localStorage.setItem('mf.settings',JSON.stringify({graphics:'low',reduceMotion:true}))",
    );
    await b.home();
    for (const [width, height] of [
      [320, 568],
      [568, 320],
      [1440, 1000],
    ]) {
      await b.viewport(width, height);
      await b.home();
      await b.click("menu-data-explorer");
      await b.wait(b.exists("nasa-explorer"));
      assert.match(await b.evaluate("document.body.innerText"), /Earth/);
      assert.match(await b.evaluate("document.body.innerText"), /Mars/);
      assert.match(await b.evaluate("document.body.innerText"), /source/i);
      assert.equal(
        await b.evaluate("document.documentElement.scrollWidth>innerWidth"),
        false,
      );
      await b.evaluate(input("data-altitude", "500"));
      await b.wait(
        "document.querySelector('[data-testid=data-comparison]').textContent.includes('500')",
      );
      await b.select("data-body", "titan");
      assert.match(
        await b.evaluate("document.body.innerText"),
        /Existing game input/,
      );
      await b.screenshot("connected-data-" + width);
      await b.home();
      await b.click("menu-academy");
      await b.wait(b.exists("academy"));
      await b.click("academy-lesson-staging");
      await b.select("academy-choice", "1");
      await b.click("academy-run");
      await b.wait(b.exists("academy-observation"));
      assert.match(
        await b.evaluate(
          "document.querySelector('[data-testid=academy-observation]').textContent",
        ),
        /Compare the evidence/,
      );
      await b.evaluate(
        input(
          "academy-reflection",
          "Discarding the empty stage increased ideal delta-v; I changed my prediction.",
          true,
        ),
      );
      await b.click("academy-save");
      await b.wait(b.exists("academy-completed"));
      assert.equal(
        await b.evaluate("document.documentElement.scrollWidth>innerWidth"),
        false,
      );
      await b.screenshot("connected-academy-" + width);
    }
    for (const id of ["altitude", "inclination", "heat"]) {
      await b.click("academy-lesson-" + id);
      await b.select("academy-choice", "1");
      await b.click("academy-run");
      await b.wait(b.exists("academy-observation"));
      await b.evaluate(
        input(
          "academy-reflection",
          "I compared my prediction with the calculated evidence for " +
            id +
            ".",
          true,
        ),
      );
      await b.click("academy-save");
      await b.wait(b.exists("academy-completed"));
    }
    checks.push(
      "NASA source-to-value comparison and Academy prediction/experiment/reflection on phone, landscape and desktop",
    );
    await b.home();
    await b.click("menu-model-comparison");
    await b.select("comparison-model", "central");
    await b.evaluate(input("comparison-horizon", "600"));
    await b.click("comparison-run");
    await b.wait(b.exists("comparison-result"));
    assert.match(
      await b.evaluate(
        "document.querySelector('[data-testid=comparison-result]').textContent",
      ),
      /0\.000 m/,
    );
    await b.select("comparison-model", "j2");
    assert.equal(
      await b.evaluate(
        "!!document.querySelector('[data-testid=comparison-result]')",
      ),
      false,
    );
    await b.click("comparison-run");
    await b.wait(b.exists("comparison-result"));
    assert.doesNotMatch(
      await b.evaluate(
        "document.querySelector('[data-testid=comparison-result] h2').textContent",
      ),
      /: 0\.000 m/,
    );
    await b.evaluate(
      "window.__Worker=window.Worker;window.__workerTerminated=false;window.Worker=class{postMessage(){}terminate(){window.__workerTerminated=true}};true",
    );
    await b.click("comparison-run");
    await b.wait(b.exists("comparison-cancel"));
    await b.click("comparison-cancel");
    assert.equal(await b.evaluate("window.__workerTerminated"), true);
    assert.equal(
      await b.evaluate(
        "!!document.querySelector('[data-testid=comparison-result]')",
      ),
      false,
    );
    await b.evaluate("window.Worker=undefined;true");
    await b.select("comparison-model", "central");
    await b.click("comparison-run");
    await b.wait(b.exists("comparison-result"));
    assert.match(
      await b.evaluate(
        "document.querySelector('[data-testid=comparison-result]').textContent",
      ),
      /0\.000 m/,
    );
    await b.evaluate("window.Worker=window.__Worker;true");
    await b.screenshot("connected-model-comparison");
    checks.push(
      "Real worker zero-difference/J2 runs, stale-result clearing, synthetic worker cancellation and Worker-absent yielding fallback",
    );
    await b.home();
    await b.click("palette-open");
    await b.evaluate(input("command-search", "rocket builder"));
    await b.key("Enter");
    await b.wait(b.exists("assembly-placement-grid"));
    await b.click("tab-staging");
    await b.clickSelector("[data-testid=build-to-exploration]>summary");
    await b.wait(b.exists("bridge-incompatible"));
    await b.click("bridge-starter");
    await b.wait(b.exists("bridge-mass"));
    assert.match(
      await b.evaluate(
        "document.querySelector('[data-testid=bridge-mass]').textContent",
      ),
      /3475\.0/,
    );
    await b.click("bridge-prepare");
    await b.evaluate(
      "window.__importEntries=window.missionForgeData.importEntries;window.__oldExpedition=window.missionForgeData.getItem('mf.exploration');window.__oldFleet=window.missionForgeData.getItem('mf.fleet-world');window.missionForgeData.importEntries=async()=>{throw Error('Injected replacement failure')};true",
    );
    await b.click("bridge-confirm");
    await b.wait(
      "document.body.textContent.includes('Injected replacement failure')",
    );
    assert.equal(
      await b.evaluate(
        "window.missionForgeData.getItem('mf.exploration')===window.__oldExpedition && window.missionForgeData.getItem('mf.fleet-world')===window.__oldFleet",
      ),
      true,
    );
    await b.evaluate(
      "window.missionForgeData.importEntries=window.__importEntries;true",
    );
    await b.click("bridge-confirm");
    await b.wait(b.exists("exploration-viewport"));
    await b.wait(
      "document.querySelector('[data-testid=exploration-viewport]').dataset.craft==='hangar'",
    );
    await b.click("explore-save");
    let saved = await b.evaluate(
      "JSON.parse(localStorage.getItem('mf.exploration'))",
    );
    assert.equal(saved.craftId, "hangar");
    assert.equal(saved.fuel, 40000);
    assert.equal(saved.batteryWh, 6000);
    assert.equal(saved.hangarDesign.name, "Workshop single-stage");
    await b.click("explore-play");
    await b.key("e");
    await b.wait(
      "Number(document.querySelector('[data-testid=explore-fuel]').dataset.kg)<40000",
    );
    await b.key("q");
    await b.click("explore-play");
    await b.click("explore-save");
    saved = await b.evaluate(
      "JSON.parse(localStorage.getItem('mf.exploration'))",
    );
    assert.ok(saved.fuel < 40000);
    const remaining = saved.fuel;
    await b.click("explore-view-craft");
    await b.screenshot("connected-hangar-exploration");
    await b.home();
    await b.click("menu-explore-btn");
    await b.wait(
      "document.querySelector('[data-testid=exploration-viewport]').dataset.craft==='hangar'",
    );
    await b.click("explore-save");
    saved = await b.evaluate(
      "JSON.parse(localStorage.getItem('mf.exploration'))",
    );
    assert.equal(saved.fuel, remaining);
    checks.push(
      "Restricted builder adapter, actual craft rendering, fuel use, explicit replacement and paused persistence",
    );
    await b.home();
    await b.click("menu-academy");
    await b.select("academy-choice", "1");
    await b.evaluate(input("academy-speed", "3000"));
    await b.click("academy-launch");
    await b.viewport(320, 568);
    await b.wait(b.exists("first-flight-guide"));
    await b.click("proceed-to-launch-btn");
    await b.wait(b.exists("first-flight-guide"));
    assert.equal(
      await b.evaluate("document.documentElement.scrollWidth>innerWidth"),
      false,
    );
    await b.screenshot("connected-guide-phone");
    await b.viewport(1440, 1000);
    await b.click("start-countdown-btn");
    await b.wait(
      '!document.querySelector("[data-testid=countdown-overlay]") && !document.querySelector("[data-testid=launch-checklist]")',
      25000,
    );
    await b.click("time-warp-10");
    await b.wait(b.exists("complete-mission-btn"), 300000);
    await b.click("complete-mission-btn");
    await b.wait(b.exists("interactive-debrief"));
    assert.match(
      await b.evaluate(
        "document.querySelector('[data-testid=results-outcome]').textContent",
      ),
      /success/i,
    );
    await b.wait(b.exists("debrief-evidence"));
    assert.match(
      await b.evaluate(
        "document.querySelector('[data-testid=debrief-prediction]').textContent",
      ),
      /3,000/,
    );
    assert.equal(
      await b.evaluate(
        "!!document.querySelector('[data-testid=learning-reflection]')",
      ),
      false,
    );
    assert.match(
      await b.evaluate(
        "document.querySelector('[data-testid=interactive-debrief]').textContent",
      ),
      /does not include horizontal speed/,
    );
    await b.evaluate(
      input(
        "debrief-reflection",
        "My height-only prediction was wrong: the recorded periapsis clears the atmosphere after sideways acceleration.",
        true,
      ),
    );
    await b.click("debrief-save");
    await b.wait(b.exists("debrief-saved"));
    const journal = await b.evaluate(
      "JSON.parse(localStorage.getItem('mf.learning-journal'))",
    );
    assert.match(journal[0].reflection, /periapsis/);
    await b.click("debrief-academy");
    const progress = await b.evaluate(
      "JSON.parse(localStorage.getItem('mf.academy'))",
    );
    assert.equal(progress.lessons.orbit.choice, 1);
    assert.equal(Object.keys(progress.lessons).length, 5);
    assert.match(progress.lessons.orbit.reflection, /periapsis/);
    await b.screenshot("connected-guided-debrief-complete");
    checks.push(
      "Complete beginner predict/review/countdown/flight/debrief/reflection loop retains an incorrect original prediction",
    );
    assert.deepEqual(b.errors, []);
    const identity = await b.evaluate(
      "fetch('/build-info.json').then(r=>r.json())",
    );
    fs.writeFileSync(
      path.resolve(
        __dirname,
        "../../docs/submission/education-validation.json",
      ),
      JSON.stringify(
        {
          status: "PASS",
          checkedAt: new Date().toISOString(),
          build: identity.id,
          checks,
          scope:
            "Chromium software WebGL with emulated layouts; one real guided campaign flight. Hardware and learner outcomes are not established.",
        },
        null,
        2,
      ) + "\n",
    );
    console.log("PASS: " + checks.join("; "));
  } finally {
    b.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
