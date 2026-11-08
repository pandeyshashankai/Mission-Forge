const assert = require("node:assert/strict"),
  fs = require("node:fs");
require("./register.cjs");
const { PART_LIST } = require("../src/sim/parts");
const { browserSession } = require("./browser-session.cjs");
(async () => {
  const b = await browserSession(),
    cases = [];
  try {
    await b.viewport(1440, 1000);
    await b.home();
    await b.click("menu-new-mission-btn");
    await b.click("mission-card-first_orbit");
    await b.click("planner-open-hangar-btn");
    await b.click("workspace-3d");
    const importDesign = async (design) => {
      fs.writeFileSync(
        "/tmp/mission-forge-catalogue-case.json",
        JSON.stringify(design),
      );
      await b.upload("[data-testid=hangar-import-input]", [
        "/tmp/mission-forge-catalogue-case.json",
      ]);
      await b.wait(
        `document.querySelector('[data-testid=design-name-input]')?.value===${JSON.stringify(design.name)}`,
      );
      await b.pause(80);
      assert.ok(
        await b.evaluate(
          'document.querySelector("[data-testid=hangar-3d-viewport] canvas").width>0',
        ),
      );
      cases.push(design.name);
    };
    for (const part of PART_LIST) {
      const design = {
        name: "Single " + part.id,
        stack: [
          { uid: "single", partId: part.radialOnly ? "tank_k_37_m" : part.id },
        ],
        radials: part.radialOnly
          ? [
              {
                uid: "radial",
                partId: part.id,
                parentUid: "single",
                symmetry: 2,
              },
            ]
          : [],
      };
      await importDesign(design);
    }
    for (const part of PART_LIST.filter((p) => !p.radialOnly)) {
      await importDesign({
        name: "Grouped " + part.id,
        stack: [
          { uid: "core", partId: "probe_core" },
          { uid: "other", partId: part.id },
        ],
        radials: [],
      });
    }
    for (const symmetry of [2, 3, 4])
      await importDesign({
        name: "Booster group " + symmetry,
        stack: [
          { uid: "parent", partId: "tank_k_37_m" },
          { uid: "engine", partId: "eng_k9" },
        ],
        radials: [
          { uid: "boost", parentUid: "parent", partId: "srb_63", symmetry },
        ],
      });
    const prior = await b.evaluate(
      'document.querySelector("[data-testid=design-name-input]").value',
    );
    for (const design of [
      {
        name: "Invalid duplicate axial/radial",
        stack: [{ uid: "parent", partId: "tank_k_37_m" }],
        radials: [
          { uid: "parent", parentUid: "parent", partId: "srb_63", symmetry: 2 },
        ],
      },
      {
        name: "Invalid duplicate radial",
        stack: [{ uid: "parent", partId: "tank_k_37_m" }],
        radials: [
          { uid: "boost", parentUid: "parent", partId: "srb_63", symmetry: 2 },
          { uid: "boost", parentUid: "parent", partId: "srb_63", symmetry: 2 },
        ],
      },
    ]) {
      fs.writeFileSync(
        "/tmp/mission-forge-invalid-identifiers.json",
        JSON.stringify(design),
      );
      await b.upload("[data-testid=hangar-import-input]", [
        "/tmp/mission-forge-invalid-identifiers.json",
      ]);
      assert.equal(
        await b.evaluate(
          'document.querySelector("[data-testid=design-name-input]").value',
        ),
        prior,
      );
    }
    assert.deepEqual(b.errors, []);
    fs.writeFileSync(
      "/tmp/mission-forge-catalogue-browser-audit.json",
      JSON.stringify(
        {
          passed: true,
          cases: cases.length,
          individual: PART_LIST.length,
          groupedAxial: PART_LIST.filter((p) => !p.radialOnly).length,
          boosterSymmetries: 3,
          invalidImports: 2,
          exceptions: b.errors,
          caseNames: cases,
        },
        null,
        2,
      ),
    );
    console.log(
      `PASS: ${cases.length} real-browser catalogue assemblies and 2 invalid grouped imports; no exceptions`,
    );
  } finally {
    b.close();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
