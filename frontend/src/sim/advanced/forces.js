import {validateLoadingStation} from './oceanLoading';
import { oceanAcceleration } from "./oceanTides";
import { rotateZ } from "./frames";
import { stateFor } from "./ephemerides";
import { apparentEclipse } from "./eclipse";
import {
  harmonicAcceleration,
  elasticTide,
  degreeThreeTide,
} from "./harmonics";
import { weatherReady, weatherDensityForState } from "./weatherAtmosphere";
import { add, sub, scale, len, dot, cross } from "../vec";
import { BODY_BY_ID, AU } from "../solarSystem";
import { nasaDensity } from "../../science/atmospheres";

export const PHYSICS_REVISION = 5;
export const DEFAULT_FORCES = Object.freeze({
  j2: false,
  relativity: false,
  damage: false,
  advancedTides: false,
  oceanTides: false,
  thermalMaterial: "baseline",
  tideLag: 0,
  ephemeris: "kepler",
  harmonicDegree: 0,
  tides: false,
  thirdBody: false,
  srp: false,
  integrator: "rk4",
  power: false,
  communications: false,
  atmosphere: "nasa",
  f107: 150,
  f107a: 150,
  ap: 4,
});
export function forceOptions(input = {}) {
  const result = { ...DEFAULT_FORCES };
  if(input.oceanLoading!=null){const offset=input.oceanLoading.ttMinusUt1;if(!Number.isFinite(offset)||offset< -100||offset>200)throw Error('Enter TT−UT1 from −100 to 200 seconds.');const station=validateLoadingStation(input.oceanLoading.station);if(station.geographyWarning)throw Error('This reference fixture has invalid geographic coordinates. Import a valid station for ground-link use.');result.oceanLoading={station,ttMinusUt1:offset};}
  if (
    input.thermalMaterial !== undefined &&
    ![
      "baseline",
      "aluminium",
      "calibrated",
      "pica-virgin",
      "avcoat-virgin",
      "avcoat-char",
    ].includes(input.thermalMaterial)
  )
    throw Error("Unknown thermal material");
  result.thermalMaterial = input.thermalMaterial || "baseline";
  if (
    input.ephemeris !== undefined &&
    !["kepler", "de421"].includes(input.ephemeris)
  )
    throw Error("Unknown ephemeris");
  result.ephemeris = input.ephemeris || "kepler";
  if (
    input.tideLag !== undefined &&
    (!Number.isFinite(input.tideLag) ||
      input.tideLag < 0 ||
      input.tideLag > 600)
  )
    throw Error("Tide lag must be 0–600 seconds");
  result.tideLag = input.tideLag || 0;
  for (const key of [
    "j2",
    "relativity",
    "damage",
    "advancedTides",
    "oceanTides",
    "thirdBody",
    "srp",
    "power",
    "communications",
    "tides",
  ]) {
    if (input[key] !== undefined && typeof input[key] !== "boolean")
      throw Error(`Invalid ${key} option`);
    if (input[key] !== undefined) result[key] = input[key];
  }
  if (
    input.integrator !== undefined &&
    !["rk4", "accurate"].includes(input.integrator)
  )
    throw Error("Unknown integrator");
  result.integrator = input.integrator || "rk4";
  if (
    input.atmosphere !== undefined &&
    !["nasa", "msis"].includes(input.atmosphere)
  )
    throw Error("Unknown atmosphere model");
  result.atmosphere = input.atmosphere || "nasa";
  for (const key of ["f107", "f107a", "ap"]) {
    const value = input[key] ?? result[key];
    if (
      !Number.isFinite(value) ||
      value < (key === "ap" ? 0 : 50) ||
      value > 400
    )
      throw Error("Invalid space-weather input");
    result[key] = value;
  }
  if (
    input.harmonicDegree !== undefined &&
    ![0, 2, 4, 8].includes(input.harmonicDegree)
  )
    throw Error("Choose harmonic degree 0, 2, 4 or 8");
  result.harmonicDegree = input.harmonicDegree || 0;
  return result;
}
export function centralGravity(r, mu) {
  return scale(r, -mu / len(r) ** 3);
}
// Fixed WGS-84-class Earth coefficient, also used by the campaign. Axis is the model's +Z.
export function j2Acceleration(r, mu, radius = 6378137, j2 = 1.08262668e-3) {
  const d = len(r),
    z2 = (r[2] / d) ** 2,
    k = (-mu / d ** 3) * 1.5 * j2 * (radius / d) ** 2;
  return [
    k * r[0] * (1 - 5 * z2),
    k * r[1] * (1 - 5 * z2),
    k * r[2] * (3 - 5 * z2),
  ];
}
// Relative acceleration in the primary's accelerating frame, including the indirect term.
export function thirdBodyAcceleration(r, sourceFromPrimary, mu) {
  const delta = sub(sourceFromPrimary, r);
  return sub(
    scale(delta, mu / len(delta) ** 3),
    scale(sourceFromPrimary, mu / len(sourceFromPrimary) ** 3),
  );
}
export function occluded(position, lightPosition, center, radius) {
  const ray = sub(lightPosition, position),
    toCenter = sub(center, position),
    d2 = dot(ray, ray);
  if (!(d2 > 0)) return false;
  const t = dot(toCenter, ray) / d2;
  if (t <= 0 || t >= 1) return false;
  return len(sub(toCenter, scale(ray, t))) < radius;
}
export function illumination(position, time, primaryId, options) {
  const bodyState = (id, t) => stateFor(options, id, t);
  const sun = bodyState("sun", time).r;
  const primary = BODY_BY_ID[primaryId];
  let fraction = 1;
  // Primary/parent shadows share the same Sun. Use the strongest obscuration,
  // avoiding double counting when the apparent occultor disks overlap.
  for (const id of new Set(
    [primaryId, primary?.parent].filter((id) => id && id !== "sun"),
  )) {
    const body = BODY_BY_ID[id];
    fraction = Math.min(
      fraction,
      apparentEclipse(
        position,
        sun,
        BODY_BY_ID.sun.radius,
        bodyState(id, time).r,
        body.radius,
      ).fraction,
    );
  }
  return fraction;
}
// Resolve ingress/egress instead of stepping across a narrow penumbra at high warp.
export function eclipseStepLimit(position, velocity, time, primaryId, options) {
  const bodyState = (id, t) => stateFor(options, id, t);
  const sun = bodyState("sun", time),
    primary = BODY_BY_ID[primaryId];
  let limit = Infinity;
  for (const id of new Set(
    [primaryId, primary?.parent].filter((id) => id && id !== "sun"),
  )) {
    const body = BODY_BY_ID[id],
      center = bodyState(id, time);
    const geometry = apparentEclipse(
      position,
      sun.r,
      BODY_BY_ID.sun.radius,
      center.r,
      body.radius,
    );
    const rateBound =
      len(sub(velocity, center.v)) /
        Math.max(body.radius, len(sub(position, center.r))) +
      len(sub(velocity, sun.v)) / Math.max(1, len(sub(position, sun.r))) +
      1e-8;
    const gap = Math.min(
      Math.abs(geometry.separation - geometry.solarAngle - geometry.bodyAngle),
      Math.abs(
        geometry.separation -
          Math.abs(geometry.bodyAngle - geometry.solarAngle),
      ),
    );
    limit = Math.min(limit, Math.max(0.1, (0.25 * gap) / rateBound));
  }
  return limit;
}
// First post-Newtonian Schwarzschild correction in the central body's rest frame.
// Spherical, non-rotating source; excludes frame dragging and multi-body relativistic terms.
export function relativisticAcceleration(r, v, mu) {
  const radius = len(r),
    c = 299792458;
  return scale(
    add(scale(r, (4 * mu) / radius - dot(v, v)), scale(v, 4 * dot(r, v))),
    mu / (c * c * radius ** 3),
  );
}
export function densityAt(body, altitude, context = null) {
  const a = body.atmosphere;
  if (!a || altitude >= (a.dragTop || a.top)) return 0;
  if (body.id === "earth" && context?.options?.atmosphere === "msis")
    return weatherReady()
      ? weatherDensityForState(body, context.r, context.t, context.options)
      : 0;
  return a.nasa
    ? nasaDensity(body.id, altitude)
    : a.rho * Math.exp(-Math.max(0, altitude) / a.height);
}
export function dragAcceleration(
  r,
  v,
  body,
  mass,
  area = 8,
  cd = 0.5,
  context = null,
) {
  const rel = sub(
    v,
    cross([0, 0, body.rotation ? (2 * Math.PI) / body.rotation : 0], r),
  );
  return scale(
    rel,
    (-0.5 *
      densityAt(body, len(r) - body.radius, context) *
      len(rel) *
      cd *
      area) /
      mass,
  );
}
export function solarPressure(
  position,
  mass,
  area = 8,
  reflectivity = 1.3,
  lit = 1,
) {
  const distance = len(position);
  return scale(
    position,
    (((lit * 4.56e-6 * reflectivity * area) / mass) * (AU / distance) ** 2) /
      distance,
  );
}
export function environmentAcceleration({
  r,
  v,
  t,
  body,
  mass,
  drag,
  options,
  thrust = [0, 0, 0],
}) {
  const bodyState = (id, t) => stateFor(options, id, t);
  let a = add(centralGravity(r, body.mu), thrust);
  if (options.relativity) a = add(a, relativisticAcceleration(r, v, body.mu));
  if (drag)
    a = add(a, dragAcceleration(r, v, body, mass, 8, 0.5, { r, t, options }));
  if (body.id === "earth") {
    if (options.harmonicDegree)
      a = add(
        a,
        harmonicAcceleration(
          r,
          body.mu,
          t,
          body.rotation,
          options.harmonicDegree,
        ),
      );
    else if (options.j2) a = add(a, j2Acceleration(r, body.mu));
  }
  const base = bodyState(body.id, t).r;
  if (options.tides && body.id === "earth") {
    const lag = options.advancedTides ? options.tideLag : 0;
    for (const id of ["sun", "moon"]) {
      const source = rotateZ(
        sub(bodyState(id, t - lag).r, bodyState(body.id, t - lag).r),
        (2 * Math.PI * lag) / body.rotation,
      );
      a = add(a, elasticTide(r, source, BODY_BY_ID[id].mu, 6378137));
      if (options.advancedTides)
        a = add(a, degreeThreeTide(r, source, BODY_BY_ID[id].mu, 6378137));
    }
  }
  if (options.oceanTides && body.id === "earth")
    a = add(a, oceanAcceleration(r, body.mu, t, body.rotation));
  if (options.thirdBody) {
    const sources =
      body.id === "sun"
        ? ["earth", "jupiter"]
        : [
            "sun",
            ...(body.id === "earth"
              ? ["moon"]
              : body.parent !== "sun"
                ? [body.parent]
                : []),
          ];
    for (const id of new Set(sources))
      if (id !== body.id)
        a = add(
          a,
          thirdBodyAcceleration(
            r,
            sub(bodyState(id, t).r, base),
            BODY_BY_ID[id].mu,
          ),
        );
  }
  if (options.srp) {
    const absolute = add(base, r);
    a = add(
      a,
      solarPressure(
        sub(absolute, bodyState("sun", t).r),
        mass,
        8,
        1.3,
        illumination(absolute, t, body.id, options),
      ),
    );
  }
  return a;
}
