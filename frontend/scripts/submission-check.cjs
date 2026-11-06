const assert = require("node:assert/strict");
const { browserSession } = require("./browser-session.cjs");
(async () => {
  const base = "http://127.0.0.1:8080";
  for (const name of [
    "project-report",
    "presentation",
    "demo-script",
    "user-testing-protocol",
  ]) {
    for (const extension of ["html", "pdf"]) {
      const response = await fetch(`${base}/submission/${name}.${extension}`);
      assert.equal(response.status, 200, `${name}.${extension}`);
      const bytes = Buffer.from(await response.arrayBuffer());
      assert.ok(bytes.length > 1000);
      if (extension === "pdf")
        assert.equal(bytes.subarray(0, 4).toString(), "%PDF");
    }
  }
  const response = await fetch(`${base}/submission/validation-results.json`);
  assert.equal(response.status, 200);
  const result = await response.json();
  assert.equal(result.regressionChecks, 321);
  assert.equal(result.campaign.length, 12);
  assert.ok(result.campaign.every((row) => row.validation === "pass"));
  assert.ok(result.science.every((row) => row.pass));
  const recordedResponse = await fetch(
    `${base}/submission/showcase-result.json`,
  );
  assert.equal(recordedResponse.status, 200);
  const recorded = await recordedResponse.json();
  assert.equal(recorded.kind, "recorded-simulation-example");
  assert.equal(recorded.result.outcome, "success");
  assert.ok(recorded.result.telemetry.length > 100);
  const replay = await fetch(`${base}/submission/showcase-replay.html`);
  assert.equal(replay.status, 200);
  assert.match(await replay.text(), /Recorded simulation example/);
  const csv = await fetch(`${base}/science/analysis.csv`);
  assert.equal(csv.status, 200);
  assert.equal((await csv.text()).trim().split("\n").length, 13);
  console.log(
    "PASS: all report/deck/guide/protocol HTML and PDFs, validation snapshot, and analysis CSV are served",
  );
  const atmosphereCsv = await fetch(`${base}/science/atmospheres.csv`);
  assert.equal(atmosphereCsv.status, 200);
  assert.equal((await atmosphereCsv.text()).trim().split("\n").length, 179);
  const dataset = await (
    await fetch(`${base}/science/planetary-data.json`)
  ).json();
  assert.equal(dataset.sources.length, 7);
  assert.equal(dataset.atmospheres.earth.bands.length, 28);
  assert.equal(dataset.atmospheres.mars.bands.length, 150);
  const b = await browserSession();
  await b.viewport(1440, 1000);
  await b.call("Page.navigate", {
    url: `${base}/submission/presentation.html`,
  });
  await b.wait('document.querySelector("#count")?.textContent==="1 / 7"');
  await b.clickSelector("#next");
  await b.wait('document.querySelector("#count").textContent==="2 / 7"');
  await b.call("Input.dispatchKeyEvent", {
    type: "keyDown",
    code: "End",
    key: "End",
  });
  await b.call("Input.dispatchKeyEvent", {
    type: "keyUp",
    code: "End",
    key: "End",
  });
  await b.wait('document.querySelector("#count").textContent==="7 / 7"');
  assert.ok(await b.evaluate('document.querySelector("#next").disabled'));
  await b.screenshot("science-presentation");
  await b.viewport(390, 844);
  await b.call("Page.navigate", {
    url: `${base}/submission/project-report.html`,
  });
  await b.wait('Boolean(document.querySelector("main h1"))');
  assert.ok(
    await b.evaluate("document.documentElement.scrollWidth<=innerWidth+1"),
  );
  assert.match(
    await b.evaluate("document.body.innerText"),
    /NASA data acquisition and provenance/,
  );
  await b.screenshot("science-report-phone");
  assert.deepEqual(b.errors, []);
  b.close();
  console.log(
    "PASS: presentation pointer/keyboard navigation and readable phone report, with no uncaught exceptions",
  );
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
