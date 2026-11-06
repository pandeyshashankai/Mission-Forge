import { aluminiumCp } from "./materials";
import { add, scale, sub, len, dot } from "../vec";
export const DAMAGE_DEFAULT = Object.freeze({
  temperature: 290,
  backTemperature: 290,
  shieldKg: 120,
  integrity: 1,
  absorbedJ: 0,
  propertyRangeExceeded: false,
});
export function damageState(value = DAMAGE_DEFAULT) {
  const s = { ...DAMAGE_DEFAULT, ...value };
  for (const [key, min, max] of [
    ["temperature", 1, 10000],
    ["backTemperature", 1, 10000],
    ["shieldKg", 0, 120],
    ["integrity", 0, 1],
    ["absorbedJ", 0, 1e20],
  ])
    if (!Number.isFinite(s[key]) || s[key] < min || s[key] > max)
      throw Error("Invalid saved thermal/structural state");
  if (typeof s.propertyRangeExceeded !== "boolean")
    throw Error("Invalid thermal range flag");
  return Object.fromEntries(Object.keys(DAMAGE_DEFAULT).map((k) => [k, s[k]]));
}
// Lumped thermal balance, fixed educational material properties, not a certified TPS.
export function thermalStep(
  initial,
  heatFlux,
  pressure,
  acceleration,
  seconds,
  material = null,
) {
  if (
    ![heatFlux, pressure, acceleration, seconds].every(Number.isFinite) ||
    Math.min(heatFlux, pressure, acceleration, seconds) < 0
  )
    throw Error("Invalid damage forcing");
  const s = damageState(initial),
    area = material?.area || 8,
    heatCapacity = material?.heatCapacity || 180000,
    ambient = material?.ambient || 220,
    sigma = 5.670374419e-8;
  if(material?.type === "exposed")s.temperature=s.backTemperature;
  let remaining = seconds;
  while (remaining > 1e-9) {
    const dt = Math.min(0.1, remaining),
      incoming = heatFlux * area;
    const radiated =
      (material?.emissivity ?? 0.8) *
      sigma *
      area *
      (s.temperature ** 4 - ambient ** 4);
    let net = incoming - radiated;
    const ablationEnergy =
      material?.type === "tpsx" ? material.ablationEnergy : 2.5e7;
    if (
      s.temperature >= (material?.ablationOnset ?? 900) &&
      net > 0 &&
      s.shieldKg > 0 &&
      ablationEnergy > 0
    ) {
      const lost = Math.min(s.shieldKg, (net * dt) / ablationEnergy);
      s.shieldKg -= lost;
      net -= (lost * ablationEnergy) / dt;
    }
    const capacity =
      material?.type === "aluminium"
        ? 200 * aluminiumCp(Math.max(300, Math.min(933.61, s.temperature)))
        : heatCapacity;
    if (material?.type === "tpsx") {
      const G = (material.conductivity * area) / material.thickness,
        Cb = material.backCapacity;
      const oldT = s.temperature,
        oldB = s.backTemperature;
      const backing = (T) => (Cb * oldB + dt * G * T) / (Cb + dt * G);
      // Implicit conduction and radiation avoid instability in thin shields.
      const residual = (T) =>
        capacity * (T - oldT) +
        Cb * (backing(T) - oldB) -
        dt *
          (incoming -
            material.emissivity * sigma * area * (T ** 4 - ambient ** 4) -
            (incoming - radiated - net));
      let low = 1,
        high = 10000;
      for (let i = 0; i < 45; i++) {
        const middle = (low + high) / 2;
        if (residual(middle) > 0) high = middle;
        else low = middle;
      }
      s.temperature = (low + high) / 2;
      s.backTemperature = backing(s.temperature);
      s.propertyRangeExceeded = true;
    } else {
      if (material?.type === "exposed") s.temperature = s.backTemperature;
      s.temperature = Math.max(
        1,
        Math.min(10000, s.temperature + (net * dt) / capacity),
      );
      if (material?.type === "exposed") s.backTemperature = s.temperature;
    }
    if (
      material?.type === "aluminium" &&
      (s.temperature < 300 || s.temperature > 933.61)
    )
      s.propertyRangeExceeded = true;
    if (
      material?.range &&
      (s.temperature < material.range[0] || s.temperature > material.range[1])
    )
      s.propertyRangeExceeded = true;
    const limit = material?.type === "aluminium" ? 933.61 : 1000;
    const thermal =
      Math.max(
        0,
        (material?.type === "tpsx" ? s.backTemperature : s.temperature) - limit,
      ) / limit;
    const stress =
      Math.max(0, pressure / 60000 - 1) +
      Math.max(0, acceleration / (12 * 9.80665) - 1);
    s.integrity = Math.max(
      0,
      s.integrity - dt * (thermal * 0.015 + stress * 0.04),
    );
    s.absorbedJ = Math.min(1e20, s.absorbedJ + incoming * dt);
    remaining -= dt;
  }
  return s;
}
// Swept-sphere contact prevents a fast vessel tunnelling through another vessel.
export function sweptContact(a0, a1, b0, b1, radius) {
  const p = sub(a0, b0),
    d = sub(sub(a1, a0), sub(b1, b0)),
    dd = dot(d, d);
  const u = dd > 0 ? Math.max(0, Math.min(1, -dot(p, d) / dd)) : 0;
  return { hit: len(add(p, scale(d, u))) <= radius, fraction: u };
}
export function breakup(r, v, mass, count = 8) {
  // Opposite paired impulses conserve linear momentum; mass is partitioned exactly.
  if (
    !Number.isFinite(mass) ||
    mass <= 0 ||
    !Number.isInteger(count) ||
    count < 2 ||
    count > 32 ||
    count % 2
  )
    throw Error("Invalid fragmentation");
  return Array.from({ length: count }, (_, i) => {
    const pair = Math.floor(i / 2),
      sign = i % 2 ? 1 : -1,
      angle = pair * 2.3999632297;
    const impulse = scale([Math.cos(angle), Math.sin(angle), 0.4], sign * 2);
    return {
      r: add(r, scale(impulse, 0.5)),
      v: add(v, impulse),
      mass: mass / count,
      radius: 0.4,
    };
  });
}
