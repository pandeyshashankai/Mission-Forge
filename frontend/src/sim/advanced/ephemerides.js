import data from "../../science/data/de421.json";
import { bodyState, BODY_BY_ID } from "../solarSystem";
export { data as ephemerisData };
export function de421State(id, t) {
  if (!Number.isFinite(t) || t < data.start || t > data.end)
    throw Error(
      "DE421 pack covers 1 January–1 February 2000 TDB only. Reduce the coast horizon or select Kepler.",
    );
  if (id === "sun") return { r: [0, 0, 0], v: [0, 0, 0] };
  const rows = data.states[id];
  if (!rows) {
    const fallback = bodyState(id, t),
      parent = BODY_BY_ID[id]?.parent;
    if (!parent) return fallback;
    const oldParent = bodyState(parent, t),
      preciseParent = de421State(parent, t);
    return {
      r: fallback.r.map((x, i) => x - oldParent.r[i] + preciseParent.r[i]),
      v: fallback.v.map((x, i) => x - oldParent.v[i] + preciseParent.v[i]),
    };
  }
  const i = Math.min(rows.length - 2, Math.floor((t - data.start) / data.step)),
    u = (t - data.start - i * data.step) / data.step,
    h = data.step,
    a = rows[i],
    b = rows[i + 1];
  return {
    r: a.r.map(
      (x, k) =>
        (2 * u ** 3 - 3 * u * u + 1) * x +
        (u ** 3 - 2 * u * u + u) * h * a.v[k] +
        (-2 * u ** 3 + 3 * u * u) * b.r[k] +
        (u ** 3 - u * u) * h * b.v[k],
    ),
    v: a.r.map(
      (x, k) =>
        ((6 * u * u - 6 * u) * x) / h +
        (3 * u * u - 4 * u + 1) * a.v[k] +
        ((-6 * u * u + 6 * u) * b.r[k]) / h +
        (3 * u * u - 2 * u) * b.v[k],
    ),
  };
}
export const stateFor = (options, id, t) =>
  options?.ephemeris === "de421" ? de421State(id, t) : bodyState(id, t);
