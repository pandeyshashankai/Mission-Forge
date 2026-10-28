// U.S. Standard Atmosphere 1976 (layers to 86 km), exponential tail above.
const R0 = 6356766;
const RAIR = 287.053;
const GMR = 0.0341632;
const LAYERS = [
  { h: 0, T: 288.15, L: -0.0065, P: 101325 },
  { h: 11000, T: 216.65, L: 0, P: 22632.06 },
  { h: 20000, T: 216.65, L: 0.001, P: 5474.889 },
  { h: 32000, T: 228.65, L: 0.0028, P: 868.0187 },
  { h: 47000, T: 270.65, L: 0, P: 110.9063 },
  { h: 51000, T: 270.65, L: -0.0028, P: 66.93887 },
  { h: 71000, T: 214.65, L: -0.002, P: 3.95642 },
];
const H86 = (R0 * 86000) / (R0 + 86000);
const TAIL_SCALE = 7000;
export const ATMOS_TOP = 160000;

function layerAt(hgp) {
  let b = LAYERS[0];
  for (const l of LAYERS) if (hgp >= l.h) b = l;
  return b;
}

function lower(hgp) {
  const b = layerAt(hgp);
  const dh = hgp - b.h;
  const T = b.T + b.L * dh;
  const P = b.L === 0 ? b.P * Math.exp((-GMR * dh) / b.T) : b.P * Math.pow(b.T / T, GMR / b.L);
  return { T, P };
}

const BASE86 = lower(H86);

export function atmosphere(z) {
  if (z >= ATMOS_TOP) return { T: 186.9, P: 0, rho: 0, a: 274 };
  const alt = Math.max(0, z);
  const hgp = (R0 * alt) / (R0 + alt);
  let T, P;
  if (hgp <= H86) ({ T, P } = lower(hgp));
  else {
    T = BASE86.T;
    P = BASE86.P * Math.exp(-(alt - 86000) / TAIL_SCALE);
  }
  return { T, P, rho: P / (RAIR * T), a: Math.sqrt(1.4 * RAIR * T) };
}

// Drag coefficient vs Mach for a slender launch vehicle (approximate public wind-tunnel trend).
const CD_TABLE = [
  [0, 0.3], [0.8, 0.32], [1.0, 0.45], [1.2, 0.5], [1.5, 0.42], [2, 0.36], [3, 0.3], [5, 0.26], [10, 0.25],
];
export function dragCoefficient(mach) {
  if (mach >= CD_TABLE[CD_TABLE.length - 1][0]) return CD_TABLE[CD_TABLE.length - 1][1];
  for (let i = 1; i < CD_TABLE.length; i++) {
    const [m1, c1] = CD_TABLE[i];
    const [m0, c0] = CD_TABLE[i - 1];
    if (mach <= m1) return c0 + ((c1 - c0) * (mach - m0)) / (m1 - m0);
  }
  return 0.25;
}
