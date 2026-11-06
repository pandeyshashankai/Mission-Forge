require("../scripts/register.cjs");
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { createHash } = require("node:crypto");
const { NASA_DATA } = require("../src/science/catalog");
const { BODIES, BODY_BY_ID } = require("../src/sim/solarSystem");
const { EARTH } = require("../src/sim/constants");
const { MOON } = require("../src/sim/bodies");
const { runScienceValidation } = require("../src/science/validation");
const {
  makePrediction,
  validPrediction,
  buildLearningReview,
  readJournal,
  saveLearningReview,
} = require("../src/science/learning");
const root = path.resolve(__dirname, "../..");

test("original NASA files match pinned hashes and generated public data", () => {
  for (const source of NASA_DATA.sources) {
    const bytes = fs.readFileSync(path.join(root, "data/nasa", source.file));
    assert.equal(
      createHash("sha256").update(bytes).digest("hex"),
      source.sha256,
    );
    assert.ok(
      source.url.startsWith(
        `https://raw.githubusercontent.com/nasa/GMAT/${NASA_DATA.commit}/`,
      ),
    );
  }
  assert.deepEqual(
    JSON.parse(
      fs.readFileSync(
        path.join(root, "frontend/public/science/planetary-data.json"),
      ),
    ),
    NASA_DATA,
  );
});
for (const body of BODIES)
  test(`${body.name}: simulation uses imported spherical radius and identified gravity`, () => {
    const row = NASA_DATA.bodies[body.id];
    assert.ok(
      Math.abs(
        body.radius - Math.cbrt(row.radiiKm.reduce((a, b) => a * b, 1)) * 1000,
      ) < 0.001,
    );
    assert.equal(body.radius, row.radius);
    if (row.muSource) {
      assert.equal(body.mu, row.muKm3s2 * 1e9);
      assert.equal(body.mu, row.mu);
    } else assert.ok(["europa", "titan"].includes(body.id));
  });
test("scored Earth and Moon use the imported gravity; Earth radius has documented km rounding", () => {
  assert.equal(EARTH.mu, NASA_DATA.bodies.earth.mu);
  assert.equal(
    EARTH.radius,
    Math.round(NASA_DATA.bodies.earth.radius / 1000) * 1000,
  );
  assert.equal(MOON.mu, NASA_DATA.bodies.moon.mu);
  assert.equal(MOON.radius, NASA_DATA.bodies.moon.radius);
});
const checks = runScienceValidation();
for (const check of checks)
  test(`${check.name}: independent analytic benchmark and full-orbit closure/energy checks pass`, () => {
    assert.equal(check.pass, true, JSON.stringify(check));
    assert.equal(check.analytic.length, 3);
    assert.ok(check.integration.steps > 100);
  });
test("learning prediction rejects invalid choices and non-finite speeds", () => {
  assert.equal(validPrediction(null), false);
  for (const speed of [NaN, Infinity, -1, 20001])
    assert.throws(() => makePrediction("sideways", speed));
  assert.throws(() => makePrediction("invented", 7700));
  assert.ok(validPrediction(makePrediction("sideways", 7700)));
});
test("learning report uses recorded telemetry and preserves incorrect predictions", () => {
  const prediction = makePrediction("height", 3000);
  const review = buildLearningReview(
    {
      missionId: "first_orbit",
      at: "2026-11-04",
      summary: { peri: 180000 },
      telemetry: [
        { t: 1, alt: 1, speed: 200 },
        { t: 500, alt: 199, speed: 7700 },
      ],
    },
    prediction,
  );
  assert.equal(review.prediction.choice, "height");
  assert.equal(review.conceptCorrect, false);
  assert.equal(review.nearestSample.t, 500);
  assert.equal(review.reachedOrbit, true);
  assert.ok(review.targetSpeed > 7700 && review.targetSpeed < 7900);
});
test("reaching space without periapsis clearance gives an orbital-speed explanation", () => {
  const review = buildLearningReview(
    {
      missionId: "first_orbit",
      summary: { peri: -100000 },
      telemetry: [{ t: 200, alt: 200, speed: 1500 }],
    },
    makePrediction("engine", 8000),
  );
  assert.equal(review.reachedOrbit, false);
  assert.match(review.explanation, /Altitude alone was insufficient/);
});
test("no telemetry does not fabricate a measured comparison or attach to another mission", () => {
  const prediction = makePrediction("sideways", 7700);
  assert.equal(
    buildLearningReview({ missionId: "earth_observer" }, prediction),
    null,
  );
  assert.equal(
    buildLearningReview(
      { missionId: "first_orbit", summary: { peri: -1 }, telemetry: [] },
      prediction,
    ).nearestSample,
    null,
  );
});
test("learning journal stores reflections, deduplicates predictions, and tolerates malformed/full storage", () => {
  const memory = new Map();
  global.localStorage = {
    getItem: (k) => memory.get(k) || null,
    setItem: (k, v) => memory.set(k, v),
  };
  const review = buildLearningReview(
    { missionId: "first_orbit", summary: { peri: 180000 }, telemetry: [] },
    makePrediction("sideways", 7700),
  );
  assert.equal(saveLearningReview(review, "More coast time"), true);
  assert.equal(saveLearningReview(review, "Use periapsis"), true);
  assert.equal(readJournal().length, 1);
  assert.equal(readJournal()[0].reflection, "Use periapsis");
  memory.set(
    "mf.learning-journal",
    JSON.stringify([{ ...review, reflection: { bad: true } }]),
  );
  assert.equal(readJournal()[0].reflection, "");
  memory.set("mf.learning-journal", '{"bad":true}');
  assert.deepEqual(readJournal(), []);
  localStorage.setItem = () => {
    throw Error("full");
  };
  assert.equal(saveLearningReview(review), false);
});
