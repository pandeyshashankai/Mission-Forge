const assert = require("node:assert/strict"),
  fs = require("node:fs");
const { browserSession } = require("./browser-session.cjs");
(async () => {
  const b = await browserSession();
  try {
    await b.viewport(390, 844);
    await b.home();
    await b.click("menu-sandbox-btn");
    await b.click("sandbox-tab-thermal");
    await b.click("thermal-run");
    await b.wait(b.exists("thermal-results"));
    assert.equal(
      await b.evaluate(
        'document.querySelectorAll("[data-testid=thermal-results] article").length',
      ),
      3,
    );
    assert.match(
      await b.evaluate(
        'document.querySelector("[data-testid=thermal-results]").textContent',
      ),
      /58\.08 MJ/,
    );
    assert.ok(
      await b.evaluate("document.documentElement.scrollWidth<=innerWidth"),
    );
    await b.evaluate(
      `(()=>{const e=[...document.querySelectorAll('[data-testid=thermal-bench] select')][1];e.value='cold';e.dispatchEvent(new Event('change',{bubbles:true}))})()`,
    );
    await b.wait('!document.querySelector("[data-testid=thermal-results]")');
    await b.click("thermal-run");
    await b.wait(b.exists("thermal-results"));
    assert.match(
      await b.evaluate(
        'document.querySelector("[data-testid=thermal-results]").textContent',
      ),
      /69\.30 MJ/,
    );
    const dir = "/tmp/mission-forge-thermal-exports-" + Date.now();
    fs.mkdirSync(dir, { recursive: true });
    await b.call("Browser.setDownloadBehavior", {
      behavior: "allow",
      downloadPath: dir,
    });
    await b.clickSelector("[data-testid=thermal-results] article button");
    await b.pause(500);
    assert.match(
      fs.readFileSync(dir + "/pica-virgin-prediction.csv", "utf8"),
      /^time_s,surface_K,backing_K,shield_kg/,
    );
    await b.clickSelector("[data-testid=thermal-results] > button");
    await b.pause(500);
    const records = JSON.parse(
      fs.readFileSync(dir + "/thermal-comparison.json", "utf8"),
    );
    assert.equal(records.length, 3);
    assert.ok(
      records.every(
        (r) =>
          r.kind === "nominal-arcjet-model-prediction" &&
          r.inputs.wall === "cold",
      ),
    );
    await b.screenshot("thermal-lab-phone");
    assert.deepEqual(b.errors, []);
    console.log(
      "PASS: phone thermal comparison, reference switching, reset, three graphs, CSV/JSON downloads and no browser exceptions",
    );
  } finally {
    b.close();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
