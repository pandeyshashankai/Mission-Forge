const { spawnSync } = require("node:child_process");
const path = require("node:path");
const fs = require("node:fs");
const golden = require("../tests/golden-missions.json");
const missions = [
  "first_orbit",
  "earth_observer",
  "lunar_orbiter",
  "crewed_lunar_flyby",
];
let failed = false;
const rows = [];
for (const difficulty of ["amateur", "intermediate", "expert"])
  for (const mission of missions) {
    const r = spawnSync(
      process.execPath,
      [path.join(__dirname, "mission-check.cjs"), mission, difficulty],
      { encoding: "utf8", timeout: 120000 },
    );
    const expectedBudgetChallenge =
      mission === "lunar_orbiter" && difficulty === "expert";
    // The stock Selene-1 exceeds the deliberately tighter Expert budget. Require flight success and only that budget objective to miss.
    const jsonStart = r.stdout?.indexOf('{\n  "outcome"');
    let result = null;
    try {
      result = JSON.parse(r.stdout.slice(jsonStart));
    } catch {}
    const budgetOnly =
      expectedBudgetChallenge &&
      result?.outcome === "partial" &&
      result.objectives.filter((o) => !o.met).length === 1 &&
      result.objectives.find((o) => !o.met)?.id === "budget";
    const envelopeMisses = Object.entries(golden.cases[mission]).filter(([key,[lo,hi]])=>!Number.isFinite(result?.summary?.[key])||result.summary[key]<lo||result.summary[key]>hi).map(([key])=>key);
    const ok = (r.status === 0 || budgetOnly) && envelopeMisses.length===0;
    failed ||= !ok;
    const row = {
      mission,
      difficulty,
      outcome: result?.outcome || "error",
      validation: ok ? "pass" : "fail",
      envelopeMisses,
      summary:result?.summary,
      note: budgetOnly
        ? "Stock rocket flies successfully but exceeds Expert budget; customise before launch."
        : null,
    };
    rows.push(row);
    console.log(JSON.stringify(row));
    if (!ok) console.error(r.stdout, r.stderr);
  }
fs.writeFileSync(
  "/tmp/mission-forge-campaign-report.json",
  JSON.stringify(rows, null, 2),
);
if (failed) process.exitCode = 1;
