const assert = require("node:assert/strict");
const fs = require("node:fs");
const { browserSession } = require("./browser-session.cjs");
(async () => {
  const b = await browserSession(),
    { evaluate, click, wait, exists } = b;
  await b.viewport(390, 844);
  await b.home();
  await evaluate(
    'localStorage.clear();localStorage.setItem("mf.settings",JSON.stringify({graphics:"low",reduceMotion:true}))',
  );
  await b.home();
  await click("menu-science-btn");
  await wait(exists("science-lab"));
  assert.ok(
    await evaluate(
      'document.querySelector("[data-testid=showcase-start]").disabled',
    ),
  );
  await click("science-tab-data");
  await wait(exists("body-science-earth"));
  await b.select("science-body", "moon");
  await wait(exists("body-science-moon"));
  assert.match(
    await evaluate(
      'document.querySelector("[data-testid=body-science-moon]").innerText',
    ),
    /JPL\/NAIF/,
  );
  assert.ok(
    Number(
      (
        await evaluate(
          'document.querySelector("[data-testid=science-selected-speed]").textContent',
        )
      ).replace(/[^0-9]/g, ""),
    ) < 2000,
  );
  assert.ok(
    await evaluate(
      'document.querySelector(".science-source-links a").href.includes("github.com/nasa/GMAT/blob/")',
    ),
  );
  const response = await fetch(
    "http://127.0.0.1:8080/science/planetary-data.json",
  );
  assert.equal(response.status, 200);
  assert.equal(Object.keys((await response.json()).bodies).length, 12);
  await b.screenshot("science-data-phone");
  await click("science-tab-validation");
  await click("science-run-checks");
  await wait(
    'document.querySelectorAll(".science-check[data-status=pass]").length===3',
  );
  assert.match(
    await evaluate(
      'document.querySelector("[data-testid=science-check-summary]").textContent',
    ),
    /All 3/,
  );
  await b.screenshot("science-checks-phone");
  console.log(
    "PASS: phone NASA provenance, Moon comparison, downloadable dataset, and three live scientific benchmarks",
  );
  await b.viewport(1440, 1000);
  await click("science-tab-mission");
  await b.select("learning-choice", "height");
  await evaluate(
    `(()=>{const e=document.querySelector('[data-testid="learning-speed"]');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(e,'3000');e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}));})()`,
  );
  await wait(
    '!document.querySelector("[data-testid=showcase-start]").disabled',
  );
  await click("showcase-start");
  await wait(exists("learning-prediction-saved"));
  assert.ok(
    await evaluate(
      'document.querySelector("[data-testid=learning-prediction-saved]").innerText.includes("3,000")',
    ),
  );
  await click("proceed-to-launch-btn");
  await click("start-countdown-btn");
  await wait(exists("flight-pause-btn"), 25000);
  await click("time-warp-10");
  await wait(exists("complete-mission-btn"), 300000);
  await click("complete-mission-btn");
  await wait(exists("results-outcome"));
  assert.match(
    await evaluate(
      'document.querySelector("[data-testid=results-outcome]").textContent',
    ),
    /success/i,
  );
  await wait(exists("learning-review"));
  assert.match(
    await evaluate(
      'document.querySelector("[data-testid=learning-review]").innerText',
    ),
    /3,000 m\/s/,
  );
  assert.match(
    await evaluate(
      'document.querySelector("[data-testid=learning-flight-explanation]").textContent',
    ),
    /periapsis stayed above/,
  );
  const reflection =
    "I will check periapsis and sideways speed before cutting thrust.";
  await evaluate(
    `(()=>{const e=document.querySelector('[data-testid="learning-reflection"]');Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set.call(e,${JSON.stringify(reflection)});e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}));})()`,
  );
  await click("learning-save-reflection");
  const journal = await evaluate(
    'JSON.parse(localStorage.getItem("mf.learning-journal"))',
  );
  assert.equal(journal.length, 1);
  assert.equal(journal[0].reflection, reflection);
  assert.equal(journal[0].prediction.choice, "height");
  assert.equal(journal[0].conceptCorrect, false);
  assert.ok(journal[0].nearestSample.speed > 7000);
  await b.screenshot("science-showcase-report");
  await evaluate(
    `window.__scienceExport=null;const original=URL.createObjectURL;URL.createObjectURL=function(blob){if(blob.type==='application/json')blob.text().then(text=>window.__scienceExport=JSON.parse(text));return original.call(URL,blob)}`,
  );
  await click("results-export-btn");
  await wait("Boolean(window.__scienceExport?.learning)");
  assert.equal(
    await evaluate("window.__scienceExport.learning.reflection"),
    reflection,
  );
  await click("results-menu-btn");
  await click("menu-science-btn");
  assert.match(
    await evaluate(
      'document.querySelector("[data-testid=showcase-mission]").innerText',
    ),
    /1 completed learning flights/,
  );
  assert.ok(
    await evaluate(
      `document.querySelector('[data-testid="showcase-mission"]').innerText.includes(${JSON.stringify(reflection)})`,
    ),
  );
  await b.call("Page.reload");
  await wait(exists("main-title"));
  await click("menu-science-btn");
  assert.ok(
    await evaluate(
      `document.querySelector('[data-testid="showcase-mission"]').innerText.includes(${JSON.stringify(reflection)})`,
    ),
  );
  console.log(
    "PASS: prediction, guided NASA-data-backed launch, orbital insertion, successful report, measured explanation, saved reflection, JSON export, journal reload",
  );
  assert.deepEqual(b.errors, [], "Uncaught browser exceptions");
  fs.writeFileSync(
    "/tmp/mission-forge-showcase-report.json",
    JSON.stringify({ status: "pass", journal, exceptions: b.errors }, null, 2),
  );
  console.log("PASS: no uncaught browser exceptions");
  b.close();
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
