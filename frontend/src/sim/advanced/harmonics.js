import gravity from "../../science/data/egm96.json";
import { rotateZ } from "./frames";
import { len, sub, scale, dot } from "../vec";
export const GRAVITY_DATA = gravity;
const factorial = n => {
  let p = 1;
  for (let i = 2; i <= n; i++) p *= i;
  return p;
};
const normalizations = new Map();
function normalization(n, m) {
  const key = n + ':' + m;
  if (normalizations.has(key)) return normalizations.get(key);
  const value = Math.sqrt((m === 0 ? 1 : 2) * (2 * n + 1) * factorial(n - m) / factorial(n + m));
  if (Number.isInteger(n) && n <= 64 && Number.isInteger(m) && m >= 0 && m <= n) {
    if (normalizations.size >= 512) normalizations.clear();
    normalizations.set(key, value);
  }
  return value;
}
function workspace(degree) {
  return {
    p: Array.from({
      length: degree + 1
    }, () => new Float64Array(degree + 1)),
    cos: new Float64Array(degree + 1),
    sin: new Float64Array(degree + 1),
    powers: new Float64Array(degree + 1)
  };
}
const coefficients = gravity.coefficients.map(c => ({
  ...c,
  normalization: normalization(c.n, c.m)
}));
export function harmonicPotential(r, mu, degree, terms = coefficients, radius = gravity.radius, scratch) {
  const distance = len(r),
    x = r[2] / distance,
    longitude = Math.atan2(r[1], r[0]),
    root = Math.sqrt(Math.max(0, 1 - x * x));
  const work = scratch || workspace(degree),
    p = work.p;
  for (let m = 0; m <= degree; m++) {
    work.cos[m] = Math.cos(m * longitude);
    work.sin[m] = Math.sin(m * longitude);
    work.powers[m] = (radius / distance) ** m;
  }
  p[0][0] = 1;
  for (let m = 0; m <= degree; m++) {
    if (m) p[m][m] = (2 * m - 1) * root * p[m - 1][m - 1];
    if (m < degree) p[m + 1][m] = (2 * m + 1) * x * p[m][m];
    for (let n = m + 2; n <= degree; n++) p[n][m] = ((2 * n - 1) * x * p[n - 1][m] - (n + m - 1) * p[n - 2][m]) / (n - m);
  }
  let sum = 0;
  for (const term of terms) if (term.n <= degree) {
    const nrm = term.normalization ?? normalization(term.n, term.m);
    sum += work.powers[term.n] * p[term.n][term.m] * nrm * (term.c * work.cos[term.m] + term.s * work.sin[term.m]);
  }
  return mu / distance * sum;
}
export function harmonicAcceleration(r, mu, time, rotation, degree, terms) {
  const angle = 2 * Math.PI * time / rotation,
    fixed = rotateZ(r, -angle),
    h = Math.max(0.5, len(r) * 1e-7),
    gradient = [],
    scratch = workspace(degree);
  for (let axis = 0; axis < 3; axis++) {
    const plus = [...fixed],
      minus = [...fixed];
    plus[axis] += h;
    minus[axis] -= h;
    gradient.push((harmonicPotential(plus, mu, degree, terms, gravity.radius, scratch) - harmonicPotential(minus, mu, degree, terms, gravity.radius, scratch)) / (2 * h));
  }
  return rotateZ(gradient, angle);
}
// Instantaneous elastic solid-Earth response, no ocean loading or frequency dependence.
export function elasticTide(r, source, sourceMu, radius, k2 = 0.3) {
  const distance = len(r),
    direction = scale(source, 1 / len(source)),
    projection = dot(r, direction),
    A = k2 * sourceMu * radius ** 5 / len(source) ** 3;
  return scale(sub(scale(sub(scale(direction, 6 * projection), scale(r, 2)), 1 / distance ** 5), scale(r, 5 * (3 * projection * projection - distance * distance) / distance ** 7)), A / 2);
}

// Degree-three elastic response; k3 is an explicit educational Love-number choice.
export function degreeThreeTide(r, source, sourceMu, radius, k3 = 0.093) {
  const d = len(r),
    D = len(source),
    n = scale(r, 1 / d),
    u = scale(source, 1 / D),
    c = dot(n, u);
  const P = (5 * c ** 3 - 3 * c) / 2,
    derivative = (15 * c * c - 3) / 2;
  return scale(sub(scale(u, derivative), scale(n, 4 * P + c * derivative)), k3 * sourceMu * radius ** 7 / (D ** 4 * d ** 5));
}
