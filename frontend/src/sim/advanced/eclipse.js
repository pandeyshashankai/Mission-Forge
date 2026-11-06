import { sub, len, dot } from "../vec";

const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
// Uniform-brightness apparent solar disk: analytic overlap of two angular disks.
// No limb darkening, atmospheric refraction or scattering is included.
export function visibleDiskFraction(sunRadius, occultorRadius, separation) {
  if (
    ![sunRadius, occultorRadius, separation].every(Number.isFinite) ||
    sunRadius <= 0 ||
    occultorRadius < 0 ||
    separation < 0
  )
    throw Error("Invalid apparent disk geometry");
  if (!occultorRadius || separation >= sunRadius + occultorRadius) return 1;
  if (occultorRadius >= separation + sunRadius) return 0;
  if (sunRadius >= separation + occultorRadius)
    return Math.max(0, 1 - (occultorRadius / sunRadius) ** 2);
  // Normalize to the solar radius to avoid squaring very small angular sizes.
  const r = occultorRadius / sunRadius,
    d = separation / sunRadius;
  const solarSector = Math.acos(clamp((d * d + 1 - r * r) / (2 * d), -1, 1));
  const occultorSector = Math.acos(
    clamp((d * d + r * r - 1) / (2 * d * r), -1, 1),
  );
  const triangle = Math.sqrt(
    Math.max(0, (-d + 1 + r) * (d + 1 - r) * (d - 1 + r) * (d + 1 + r)),
  );
  return clamp(
    1 - (solarSector + r * r * occultorSector - triangle / 2) / Math.PI,
    0,
    1,
  );
}
export function apparentEclipse(position, sun, sunRadius, center, radius) {
  const toSun = sub(sun, position),
    toBody = sub(center, position);
  const sunDistance = len(toSun),
    bodyDistance = len(toBody);
  if (bodyDistance <= radius)
    return {
      fraction: 0,
      separation: 0,
      solarAngle: 0,
      bodyAngle: Math.PI / 2,
    };
  if (!(sunDistance > sunRadius))
    return { fraction: 1, separation: Math.PI, solarAngle: 0, bodyAngle: 0 };
  const solarAngle = Math.asin(sunRadius / sunDistance),
    bodyAngle = Math.asin(radius / bodyDistance);
  const separation = Math.acos(
    clamp(dot(toSun, toBody) / (sunDistance * bodyDistance), -1, 1),
  );
  // A body behind the Sun cannot occult it.
  const fraction =
    bodyDistance - radius >= sunDistance + sunRadius
      ? 1
      : visibleDiskFraction(solarAngle, bodyAngle, separation);
  return { fraction, separation, solarAngle, bodyAngle };
}
