import { NASA_DATA } from "./catalog";

// Piecewise exponential model matching the archived NASA GMAT table method.
// Input is spherical geometric altitude, rather than GMAT's ellipsoid geodetic altitude.
export function nasaDensity(bodyId, altitude) {
  const model = NASA_DATA.atmospheres[bodyId];
  if (!model || !Number.isFinite(altitude) || altitude > model.maximumAltitude)
    return 0;
  const h = Math.max(0, altitude);
  let band = model.bands[0];
  for (const row of model.bands) {
    if (row.altitude > h) break;
    band = row;
  }
  return band.density * Math.exp(-(h - band.altitude) / band.scaleHeight);
}
export function dragEnvironment(bodyId, altitude, speed, area = 8, cd = 0.5) {
  const density = nasaDensity(bodyId, altitude);
  const dynamicPressure = 0.5 * density * speed ** 2;
  return { density, dynamicPressure, force: dynamicPressure * area * cd };
}
