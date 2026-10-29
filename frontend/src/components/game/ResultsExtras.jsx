import { useState } from "react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

const fmt = (x, d = 0) => (Number.isFinite(x) ? Number(x).toLocaleString("en-US", { maximumFractionDigits: d, minimumFractionDigits: d }) : "—");
const METRICS = [
  ["total", "Score", 0, 1], ["mass", "Liftoff mass (t)", 1, -1, 1e-3], ["cost", "Cost ($M)", 1, -1], ["dv", "Total Δv (m/s)", 0, 1], ["twr", "Liftoff TWR", 2, 0], ["stages", "Stages", 0, 0], ["remDv", "Δv left (m/s)", 0, 1], ["maxG", "Peak load (g)", 1, -1],
];

export const DesignCompare = ({ current, attempts }) => {
  const others = attempts.slice(1);
  const best = others.length ? others.reduce((a, b) => (b.total > a.total ? b : a)) : null;
  const [idx, setIdx] = useState(best ? others.indexOf(best) : 0);
  const other = others[idx];
  if (!other) return <p className="text-xs text-slate-500" data-testid="compare-empty">Fly this mission again with another design to compare side by side.</p>;
  const cur = { ...current.summary, total: current.total, designName: current.designName };
  return (
    <div data-testid="design-compare">
      <select data-testid="compare-select" value={idx} onChange={(e) => setIdx(+e.target.value)} className="mb-2 w-full border border-slate-700 bg-slate-950 px-2 py-1 font-mono text-[11px]">
        {others.map((a, i) => <option key={i} value={i}>{a.designName} · {a.outcome} · {fmt(a.total)} pts{a === best ? " (best)" : ""}</option>)}
      </select>
      <table className="w-full font-mono text-[11px]">
        <thead><tr className="text-left text-slate-500"><th className="py-1 font-normal">Metric</th><th className="font-normal">This flight</th><th className="font-normal">{other.designName}</th><th className="text-right font-normal">Δ</th></tr></thead>
        <tbody>
          {METRICS.map(([k, label, d, better, sc = 1]) => {
            const a = cur[k] * sc, b = other[k] * sc, diff = a - b;
            const good = better === 0 || !Number.isFinite(diff) || diff === 0 ? "text-slate-400" : diff * better > 0 ? "text-emerald-400" : "text-red-400";
            return (
              <tr key={k} className="border-t border-slate-800 text-slate-300" data-testid={`compare-row-${k}`}>
                <td className="py-1 text-slate-500">{label}</td><td>{fmt(a, d)}</td><td>{fmt(b, d)}</td><td className={`text-right ${good}`}>{Number.isFinite(diff) ? `${diff > 0 ? "+" : ""}${fmt(diff, d)}` : "—"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

const Mini = ({ data, x, k, label, unit, color, testId, xLabel }) => (
  <div className="panel rounded-sm p-3" data-testid={testId}>
    <div className="eyebrow mb-1">{label} <span className="text-slate-600">({unit}{xLabel ? ` vs ${xLabel}` : ""})</span></div>
    <div className="h-36">
      <ResponsiveContainer>
        <LineChart data={data} margin={{ top: 4, right: 8, left: -14, bottom: 0 }}>
          <CartesianGrid stroke="#1e293b" strokeDasharray="2 4" />
          <XAxis dataKey={x} type="number" domain={["dataMin", "dataMax"]} reversed={x === "alt"} tick={{ fontSize: 9, fill: "#64748b" }} tickFormatter={(v) => fmt(v)} />
          <YAxis tick={{ fontSize: 9, fill: "#64748b" }} />
          <Tooltip contentStyle={{ background: "#0b1220", border: "1px solid #1e293b", fontSize: 11 }} formatter={(v) => fmt(v, 2)} labelFormatter={(v) => `${x === "alt" ? "alt" : "t"} ${fmt(v, 1)}`} />
          <Line type="monotone" dataKey={k} stroke={color} dot={false} strokeWidth={2} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  </div>
);

export const ReentryReplay = ({ r }) => {
  if (!r.entry) return null;
  const pts = r.telemetry.filter((p) => p.t >= r.entry.t - 60).map((p) => ({ ...p, te: +(p.t - r.entry.t).toFixed(1) }));
  if (pts.length < 3) return null;
  return (
    <div className="space-y-2" data-testid="reentry-replay">
      <div className="eyebrow">Re-entry replay · from entry interface (122 km, {fmt(r.entry.speed)} m/s, {fmt(r.entry.fpa, 2)}°) · peak {fmt(r.entry.maxG, 1)} g · {fmt(r.entry.maxFlux / 1e6, 2)} MW/m² · {fmt(r.entry.heatLoad / 1e7, 1)} kJ/cm²</div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
        <Mini data={pts} x="te" k="alt" label="Altitude" unit="km" color="#38bdf8" testId="replay-altitude" />
        <Mini data={pts} x="te" k="g" label="Crew g-load" unit="g" color="#f59e0b" testId="replay-g" />
        <Mini data={pts} x="te" k="flux" label="Stagnation heat flux" unit="MW/m²" color="#ef4444" testId="replay-flux" />
        <Mini data={pts} x="alt" k="g" xLabel="altitude km" label="g-load" unit="g" color="#a78bfa" testId="replay-g-vs-alt" />
      </div>
      <p className="text-[10px] text-slate-500">Time axis in seconds from entry interface. Heat flux: Sutton–Graves convective stagnation heating; g-load: sensed non-gravitational acceleration.</p>
    </div>
  );
};
