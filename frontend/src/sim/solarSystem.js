import { readLocalContent, validateLocalBodies } from "./advanced/localContent";
import { physicalConstants } from "../science/catalog";
import { add, scale } from "./vec";
export const AU = 149597870700;
export const DAY = 86400;
export const SUN = {
  id: "sun",
  ...physicalConstants("sun"),
  name: "Sun",
  color: "#ffcb65"
};
// Mean J2000 elements, fixed Kepler ellipses. SI units internally; angles below in degrees.
// JPL approximate planetary elements and NASA planetary fact sheets; not precision navigation ephemerides.
export const PLANETS = [{
  id: "mercury",
  ...physicalConstants("mercury"),
  name: "Mercury",
  a: 0.38709927,
  e: 0.20563593,
  inc: 7.004979,
  node: 48.330766,
  peri: 77.457796,
  L: 252.250324,
  color: "#aaa39a",
  description: "A cratered inner world. No atmosphere to slow a descent."
}, {
  id: "venus",
  ...physicalConstants("venus"),
  name: "Venus",
  a: 0.72333566,
  e: 0.00677672,
  inc: 3.394676,
  node: 76.679843,
  peri: 131.602467,
  L: 181.9791,
  color: "#e5c18b",
  atmosphere: {
    rho: 65,
    height: 15900,
    top: 200000
  },
  description: "A dense atmosphere and a harsh surface. Approach with care."
}, {
  id: "earth",
  ...physicalConstants("earth"),
  name: "Earth",
  a: 1.00000261,
  e: 0.01671123,
  inc: -0.000015,
  node: 0,
  peri: 102.937682,
  L: 100.464572,
  color: "#60a5fa",
  atmosphere: {
    rho: 1.225,
    height: 8500,
    top: 160000,
    dragTop: 1000000,
    nasa: true
  },
  description: "Our home world. A forgiving place to learn orbital flight."
}, {
  id: "mars",
  ...physicalConstants("mars"),
  name: "Mars",
  a: 1.52371034,
  e: 0.0933941,
  inc: 1.849691,
  node: 49.559539,
  peri: -23.94363,
  L: -4.553432,
  color: "#ef906a",
  atmosphere: {
    rho: 0.02,
    height: 11100,
    top: 120000,
    dragTop: 2980000,
    nasa: true
  },
  description: "A thin atmosphere, rusty deserts, and a smaller gravity well."
}, {
  id: "jupiter",
  ...physicalConstants("jupiter"),
  name: "Jupiter",
  a: 5.202887,
  e: 0.04838624,
  inc: 1.304397,
  node: 100.473909,
  peri: 14.72848,
  L: 34.396441,
  color: "#d4b397",
  gas: true,
  description: "A gas giant with an enormous gravity well. No solid landing surface."
}, {
  id: "saturn",
  ...physicalConstants("saturn"),
  name: "Saturn",
  a: 9.536676,
  e: 0.05386179,
  inc: 2.485992,
  node: 113.662424,
  peri: 92.598878,
  L: 49.954244,
  color: "#e6d2a1",
  gas: true,
  description: "An immense ringed world. Explore its moons rather than its cloud tops."
}, {
  id: "uranus",
  ...physicalConstants("uranus"),
  name: "Uranus",
  a: 19.189165,
  e: 0.04725744,
  inc: 0.772638,
  node: 74.016925,
  peri: 170.954276,
  L: 313.238105,
  color: "#9dd9df",
  gas: true,
  description: "A pale ice giant far beyond the inner planets."
}, {
  id: "neptune",
  ...physicalConstants("neptune"),
  name: "Neptune",
  a: 30.069923,
  e: 0.00859048,
  inc: 1.770043,
  node: 131.784226,
  peri: 44.964762,
  L: -55.12003,
  color: "#6385f3",
  gas: true,
  description: "The outermost planet. Long coasts need careful planning."
}].map(p => ({
  ...p,
  a: p.a * AU,
  parent: "sun"
}));
export const MOONS = [{
  id: "moon",
  ...physicalConstants("moon"),
  name: "Moon",
  parent: "earth",
  a: 384400000,
  e: 0.0549,
  inc: 5.145,
  node: 125.08,
  peri: 83.35,
  L: 218.32,
  color: "#c7c9d1",
  description: "Earth's airless companion. Low gravity makes it a useful landing practice ground."
}, {
  id: "europa",
  ...physicalConstants("europa"),
  name: "Europa",
  parent: "jupiter",
  mu: 3.2027e12,
  a: 671100000,
  e: 0.009,
  inc: 0.47,
  node: 0,
  peri: 0,
  L: 90,
  color: "#d8cfbd",
  description: "An icy moon in Jupiter's deep gravity well."
}, {
  id: "titan",
  ...physicalConstants("titan"),
  name: "Titan",
  parent: "saturn",
  mu: 8.97814e12,
  a: 1221870000,
  e: 0.0288,
  inc: 0.35,
  node: 0,
  peri: 0,
  L: 210,
  color: "#dda75c",
  atmosphere: {
    rho: 5.3,
    height: 20000,
    top: 300000
  },
  description: "A large moon with a thick atmosphere and low gravity."
}];
export const BODIES = [SUN, ...PLANETS, ...MOONS];
export const BODY_BY_ID = Object.fromEntries(BODIES.map(b => [b.id, b]));
export function installLocalBodies(records) {
  const builtin = Object.fromEntries(BODIES.filter(b => !b.custom).map(b => [b.id, b]));
  const bodies = validateLocalBodies(records, builtin);
  for (const b of bodies) if (BODY_BY_ID[b.id] && !BODY_BY_ID[b.id].custom) throw Error("Cannot replace a standard body");
  for (const list of [PLANETS, MOONS, BODIES]) for (let i = list.length - 1; i >= 0; i--) if (list[i].custom) list.splice(i, 1);
  for (const key of Object.keys(BODY_BY_ID)) if (BODY_BY_ID[key].custom) delete BODY_BY_ID[key];
  for (const b of bodies) {
    (b.parent === 'sun' ? PLANETS : MOONS).push(b);
    BODIES.push(b);
    BODY_BY_ID[b.id] = b;
  }
  return bodies;
}
try {
  installLocalBodies(readLocalContent().bodies);
} catch {/* Invalid local content cannot replace standard worlds. */}
const rad = Math.PI / 180;
export function bodyState(id, t = 0) {
  const b = BODY_BY_ID[id];
  if (!b) throw new Error(`Unknown body: ${id}`);
  if (id === "sun") return {
    r: [0, 0, 0],
    v: [0, 0, 0]
  };
  const parent = BODY_BY_ID[b.parent];
  const n = Math.sqrt(parent.mu / b.a ** 3);
  const M = ((b.L - b.peri) * rad + n * t) % (2 * Math.PI);
  let E = M;
  // Stop only at an exact floating-point fixed point; retain the 12-iteration limit.
  for (let j = 0; j < 12; j++) {
    const previous = E;
    E -= (E - b.e * Math.sin(E) - M) / (1 - b.e * Math.cos(E));
    if (Object.is(E, previous)) break;
  }
  const sinE = Math.sin(E),
    cosE = Math.cos(E),
    eccentricFactor = Math.sqrt(1 - b.e ** 2);
  const x = b.a * (cosE - b.e),
    y = b.a * eccentricFactor * sinE;
  const ed = n / (1 - b.e * cosE),
    vx = -b.a * sinE * ed,
    vy = b.a * eccentricFactor * cosE * ed;
  const O = b.node * rad,
    i = b.inc * rad,
    w = (b.peri - b.node) * rad;
  const cO = Math.cos(O),
    sO = Math.sin(O),
    ci = Math.cos(i),
    si = Math.sin(i),
    cw = Math.cos(w),
    sw = Math.sin(w);
  const P = [cO * cw - sO * sw * ci, sO * cw + cO * sw * ci, sw * si];
  const Q = [-cO * sw - sO * cw * ci, -sO * sw + cO * cw * ci, cw * si];
  const base = bodyState(b.parent, t);
  return {
    r: add(base.r, add(scale(P, x), scale(Q, y))),
    v: add(base.v, add(scale(P, vx), scale(Q, vy)))
  };
}
export const sphereOfInfluence = b => b.parent ? b.a * (b.mu / BODY_BY_ID[b.parent].mu) ** 0.4 : Infinity;
