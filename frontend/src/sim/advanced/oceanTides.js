import data from "../../science/data/ocean-tides.json";
import { harmonicAcceleration } from "./harmonics";
export { data as oceanTideData };
const arc = Math.PI / (180 * 3600),
  tau = 2 * Math.PI;
export function tidalArguments(seconds) {
  const T = seconds / (36525 * 86400),
    poly = a => a.reduce((s, x, i) => s + x * T ** i, 0) * arc;
  const l = poly([485868.249036, 1717915923.2178, 31.8792, 0.051635, -0.0002447]);
  const lp = poly([1287104.793048, 129596581.0481, -0.5532, 0.000136, -0.00001149]);
  const F = poly([335779.526232, 1739527262.8478, -12.7512, -0.001037, 0.00000417]);
  const D = poly([1072260.703692, 1602961601.209, -6.3706, 0.006593, -0.00003169]);
  const O = poly([450160.398036, -6962890.5431, 7.4722, 0.007702, -0.00005939]);
  const gamma = tau * (0.779057273264 + 1.00273781191135448 * seconds / 86400) + poly([0.014506, 4612.156534, 1.3915817, -0.00000044, -0.000029956, -0.0000000368]) + Math.PI;
  return {
    gamma,
    l,
    lp,
    F,
    D,
    O
  };
}
export function wavePhase(code, a) {
  const d = String(code).padStart(6, "0").split("").map(Number);
  for (let i = 1; i < 6; i++) d[i] -= 5;
  const [t, s, h, p, n, ps] = d;
  return t * a.gamma - p * a.l - ps * a.lp + (-t + s + h + p + ps) * a.F + (-h - ps) * a.D + (-t + s + h + p - n + ps) * a.O;
}
let compiled = null;
function planRows() {
  const rows = data.rows;
  if (compiled && compiled.rows === rows && compiled.entries.length === rows.length && compiled.entries.every((e, i) => e.row === rows[i] && e.n === rows[i].n && e.m === rows[i].m && e.code === rows[i].doodson)) return compiled;
  const codes = [],
    groups = [],
    phaseIndices = new Map(),
    termIndices = new Map();
  const entries = rows.map(row => {
    const n = row.n,
      m = row.m,
      code = row.doodson;
    if (n < 2) return {
      row,
      n,
      m,
      code,
      skip: true
    };
    if (!phaseIndices.has(code)) {
      phaseIndices.set(code, codes.length);
      codes.push(code);
    }
    const key = n + ':' + m;
    if (!termIndices.has(key)) {
      termIndices.set(key, groups.length);
      groups.push({
        n,
        m
      });
    }
    return {
      row,
      n,
      m,
      code,
      phase: phaseIndices.get(code),
      term: termIndices.get(key)
    };
  });
  return compiled = {
    rows,
    entries,
    codes,
    groups
  };
}
export function oceanCoefficients(seconds) {
  if (!Number.isFinite(seconds) || Math.abs(seconds) > 36525 * 86400) throw Error('Ocean tide epoch out of supported range');
  const plan = planRows(),
    arguments_ = tidalArguments(seconds),
    cos = new Float64Array(plan.codes.length),
    sin = new Float64Array(plan.codes.length),
    c = new Float64Array(plan.groups.length),
    s = new Float64Array(plan.groups.length);
  for (let i = 0; i < plan.codes.length; i++) {
    const phase = wavePhase(plan.codes[i], arguments_);
    cos[i] = Math.cos(phase);
    sin[i] = Math.sin(phase);
  }
  for (const entry of plan.entries) {
    if (entry.skip) continue;
    const r = entry.row,
      phase = entry.phase,
      index = entry.term;
    c[index] += (r.cp + r.cm) * cos[phase] + (r.sp + r.sm) * sin[phase];
    s[index] += (r.sp - r.sm) * cos[phase] - (r.cp - r.cm) * sin[phase];
  }
  return plan.groups.map((g, i) => ({
    n: g.n,
    m: g.m,
    c: c[i],
    s: s[i]
  }));
}
export function oceanAcceleration(r, mu, seconds, rotation, terms) {
  return harmonicAcceleration(r, mu, seconds, rotation, 8, terms || oceanCoefficients(seconds));
}
