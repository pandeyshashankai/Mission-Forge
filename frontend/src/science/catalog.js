import dataset from "./data/planetary.json";

export const NASA_DATA = dataset;
export const NASA_SOURCES = dataset.sources;
export function physicalConstants(id) {
  const b = dataset.bodies[id];
  return b
    ? { radius: b.radius, rotation: b.rotation, ...(b.mu ? { mu: b.mu } : {}) }
    : {};
}
export function sourceFor(id) {
  return NASA_SOURCES.find((source) => source.id === id);
}
export function orbitFacts(body, altitude = 200000) {
  const r = body.radius + altitude;
  return {
    gravity: body.mu / body.radius ** 2,
    circularSpeed: Math.sqrt(body.mu / r),
    escapeSpeed: Math.sqrt((2 * body.mu) / r),
    period: 2 * Math.PI * Math.sqrt(r ** 3 / body.mu),
    altitude,
  };
}
