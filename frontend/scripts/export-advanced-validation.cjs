require("./register.cjs");
const fs = require("node:fs"),
  path = require("node:path"),
  { pathToFileURL } = require("node:url");
(async () => {
  const root = path.resolve(__dirname, "../..");
  const factory = (
    await import(
      pathToFileURL(
        path.join(root, "frontend/public/science/models/nrlmsise-browser.mjs"),
      ).href
    )
  ).default;
  require("../src/sim/advanced/weatherAtmosphere").initializeWeatherModel(
    await factory(),
  );
  const standards = await import(
    pathToFileURL(
      path.join(root, "frontend/public/science/models/tsofa/TSOFA.js"),
    ).href
  );
  require("../src/sim/advanced/precisionFrames").initializePrecisionFrames(
    standards,
  );
  const validation = require("../src/science/advancedValidation");
  const precision = require("../src/science/precisionValidation");
  const result = {
    checkedOn: "2026-11-05",
    timezone: "Asia/Calcutta",
    orekitVersion: "13.1.9",
    orbits: validation.validateOrekit(),
    gravity: validation.validateHarmonics(),
    atmospheres: validation.validateAtmosphere(),
    frames: validation.validateFrames(),
    ocean: validation.validateOcean(),
    precision: precision.validatePrecisionForces(),
    relativisticOrbits: precision.validateRelativisticTrajectories(),
    notice:
      "Matched simplified configurations and port checks. Not a claim of operational mission precision or validation against observed space-weather densities.",
  };
  result.pass = [
    ...result.orbits,
    ...result.gravity,
    ...result.atmospheres,
    result.frames,
    ...result.ocean,
    ...result.precision.forces,
    ...result.precision.eclipses,
    ...result.relativisticOrbits,
  ].every((r) => r.pass);
  if (!result.pass) throw Error("Advanced reference validation failed");
  for (const target of [
    "frontend/public/science/advanced-validation-results.json",
  ])
    fs.writeFileSync(
      path.join(root, target),
      JSON.stringify(result, null, 2) + "\n",
    );
  console.log(
    "Passed 51 external-reference checks (6 trajectories, 8 gravity/relativity vectors, 27 eclipses, 6 atmosphere cases, 1 standards matrix, 3 ocean coefficient cases).",
  );
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
