import aluminium from "../../science/data/materials.json";
export { aluminium };
export function aluminiumCp(temperature) {
  if (
    !Number.isFinite(temperature) ||
    temperature < 300 ||
    temperature > 933.61
  )
    throw Error("Aluminium fit is valid only from 300 to 933.61 K");
  const powers = [-2, -1, 0, 1, 2, 3, 4];
  return (
    (8.31446261815324 / aluminium.molarMass) *
    aluminium.cpCoefficients.reduce(
      (s, a, i) => s + a * temperature ** powers[i],
      0,
    )
  );
}
// Identify total heat capacity and emissivity from independent heating-rate measurements.
// q is absorbed incident W/m²; area is known m²; rate is measured K/s.
export function calibrateThermal(
  records,
  { area = 8, ambient = 300, source } = {},
) {
  if (
    typeof source !== "string" ||
    !source.trim() ||
    source.length > 500 ||
    !Array.isArray(records) ||
    records.length < 8 ||
    records.length > 2000 ||
    !Number.isFinite(area) ||
    area <= 0 ||
    area > 1000 ||
    !Number.isFinite(ambient) ||
    ambient < 1 ||
    ambient > 2000
  )
    throw Error(
      "Provide traceable experimental data, known area, ambient temperature and at least eight observations",
    );
  const rows = records.map((r) => {
    if (
      ![r.temperature, r.rate, r.flux].every(Number.isFinite) ||
      r.temperature < ambient ||
      r.temperature > 5000 ||
      Math.abs(r.rate) > 10000 ||
      r.flux < 0 ||
      r.flux > 1e9
    )
      throw Error("Invalid thermal observation");
    return {
      x: r.rate,
      y: 5.670374419e-8 * area * (r.temperature ** 4 - ambient ** 4),
      z: r.flux * area,
    };
  });
  const train = rows.filter((_, i) => i % 4 !== 3),
    held = rows.filter((_, i) => i % 4 === 3);
  const xx = train.reduce((s, r) => s + r.x * r.x, 0),
    yy = train.reduce((s, r) => s + r.y * r.y, 0),
    xy = train.reduce((s, r) => s + r.x * r.y, 0),
    xz = train.reduce((s, r) => s + r.x * r.z, 0),
    yz = train.reduce((s, r) => s + r.y * r.z, 0),
    det = xx * yy - xy * xy;
  if (!(xx > 0 && yy > 0) || det / (xx * yy) < 1e-6)
    throw Error(
      "Measurements cannot independently identify capacity and emissivity",
    );
  const heatCapacity = (xz * yy - yz * xy) / det,
    emissivity = (yz * xx - xz * xy) / det;
  if (
    heatCapacity < 100 ||
    heatCapacity > 1e9 ||
    emissivity < 0.01 ||
    emissivity > 1
  )
    throw Error("Fitted material properties are outside physical bounds");
  const error = (data) =>
      Math.sqrt(
        data.reduce(
          (s, r) => s + (heatCapacity * r.x + emissivity * r.y - r.z) ** 2,
          0,
        ) / data.length,
      ),
    heldoutRmsW = error(held),
    scale = Math.max(
      1,
      Math.sqrt(held.reduce((s, r) => s + r.z * r.z, 0) / held.length),
    );
  if (heldoutRmsW / scale > 0.05)
    throw Error("Independent held-out error exceeds 5%; calibration rejected");
  return {
    version: 1,
    records: records.map((r) => ({
      temperature: r.temperature,
      rate: r.rate,
      flux: r.flux,
    })),
    source: source.trim(),
    area,
    ambient,
    heatCapacity,
    emissivity,
    trainingCount: train.length,
    heldoutCount: held.length,
    heldoutRmsW,
    range: [
      Math.min(...records.map((r) => r.temperature)),
      Math.max(...records.map((r) => r.temperature)),
    ],
    notice:
      "Fit to supplied measurements; data authenticity and spacecraft applicability require experimental review.",
  };
}
