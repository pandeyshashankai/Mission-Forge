import { useMemo } from "react";
import { ArrowRight, Download, RotateCcw, Wrench, Home } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { useGame } from "../game/GameContext";
import { downloadJSON, storage } from "../sim/storage";
import { mmss } from "../components/game/FlightHud";

const fmt = (x, d = 0) => Number(x).toLocaleString("en-US", { maximumFractionDigits: d, minimumFractionDigits: d });
const OUT = {
  success: { label: "Mission success", cls: "text-emerald-400 border-emerald-500/60" },
  partial: { label: "Partial success", cls: "text-amber-400 border-amber-500/60" },
  failed: { label: "Mission failed", cls: "text-red-400 border-red-500/70" },
};

const Chart = ({ data, k, label, unit, color, testId }) => (
  <div className="inset rounded-sm p-3" data-testid={testId}>
    <div className="eyebrow mb-2 !text-[9px]">{label} ({unit})</div>
    <div className="h-36">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 4, right: 8, left: -14, bottom: 0 }}>
          <CartesianGrid stroke="#1e293b" strokeDasharray="2 4" />
          <XAxis dataKey="t" tick={{ fill: "#64748b", fontSize: 10, fontFamily: "JetBrains Mono" }} tickFormatter={(v) => `${Math.round(v)}s`} />
          <YAxis tick={{ fill: "#64748b", fontSize: 10, fontFamily: "JetBrains Mono" }} />
          <Tooltip contentStyle={{ background: "#0f172a", border: "1px solid #1e293b", fontFamily: "JetBrains Mono", fontSize: 11 }} formatter={(v) => fmt(v, 1)} labelFormatter={(v) => `T+${v}s`} />
          <Line type="monotone" dataKey={k} stroke={color} dot={false} strokeWidth={1.6} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  </div>
);

export default function Results() {
  const g = useGame();
  const r = g.result;
  const attempts = useMemo(() => (r ? storage.attempts(r.missionId, r.difficulty) : []), [r]);
  if (!r) return <div className="p-10"><button onClick={() => g.go("menu")} data-testid="results-menu-btn">No results — back to menu</button></div>;
  const o = OUT[r.outcome];
  const data = r.telemetry.filter((_, i, a) => a.length < 600 || i % Math.ceil(a.length / 600) === 0);

  return (
    <div className="h-full w-full overflow-y-auto grid-bg scroll-thin">
      <header className="sticky top-0 z-10 flex h-12 items-center justify-between border-b border-slate-800 bg-slate-950/90 px-5 backdrop-blur-md">
        <div className="eyebrow">Mission Results · {r.missionName} · {r.difficultyLabel}</div>
        <div className="flex gap-2">
          <button data-testid="results-retry-btn" onClick={() => g.go("flight")} className="flex items-center gap-1.5 border border-slate-700 px-3 py-1.5 text-xs hover:border-slate-500"><RotateCcw size={13} /> Retry flight</button>
          <button data-testid="results-hangar-btn" onClick={() => g.go("hangar")} className="flex items-center gap-1.5 border border-cyan-500/60 px-3 py-1.5 text-xs text-cyan-200 hover:bg-cyan-500/10"><Wrench size={13} /> Adjust design</button>
          <button data-testid="results-export-btn" onClick={() => downloadJSON(`missionforge_results_${r.at.slice(0, 19).replace(/\W/g, "")}.json`, r)} className="flex items-center gap-1.5 border border-slate-700 px-3 py-1.5 text-xs hover:border-slate-500"><Download size={13} /> Export</button>
          <button data-testid="results-menu-btn" onClick={() => g.go("menu")} className="flex items-center gap-1.5 border border-slate-700 px-3 py-1.5 text-xs hover:border-slate-500"><Home size={13} /></button>
        </div>
      </header>

      <div className="mx-auto max-w-7xl space-y-6 p-6">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_360px]">
          <div className="panel rounded-sm p-6 rise">
            <div className={`inline-block border px-3 py-1 font-display text-xl font-bold uppercase tracking-widest ${o.cls}`} data-testid="results-outcome">{o.label}</div>
            <h1 className="mt-3 font-display text-4xl font-bold uppercase tracking-tight sm:text-5xl">{r.designName}</h1>
            <div className="mt-4 grid grid-cols-2 gap-x-8 gap-y-2 font-mono text-xs text-slate-400 md:grid-cols-4">
              <div>Orbit <span className="block text-sm text-sky-300">{r.summary.peri > 0 ? `${fmt(r.summary.apo / 1000, 1)} × ${fmt(r.summary.peri / 1000, 1)} km` : "—"}</span></div>
              <div>Inclination <span className="block text-sm text-sky-300">{fmt(r.summary.inc, 2)}°</span></div>
              <div>Δv remaining <span className="block text-sm text-sky-300">{fmt(r.summary.remDv)} m/s</span></div>
              <div>Max-Q <span className="block text-sm text-sky-300">{fmt(r.summary.maxQ / 1000, 1)} kPa</span></div>
              <div>Liftoff mass <span className="block text-sm text-sky-300">{fmt(r.summary.mass / 1000, 1)} t</span></div>
              <div>Cost <span className="block text-sm text-sky-300">${fmt(r.summary.cost, 1)}M</span></div>
              <div>Flight time <span className="block text-sm text-sky-300">{mmss(r.summary.flightTime)}</span></div>
              <div>Flown by <span className="block text-sm text-sky-300">{r.summary.guidance ? "Guidance computer" : "Manual / mixed"}</span></div>
            </div>
            <div className="eyebrow mb-2 mt-6">Objectives</div>
            <ul className="space-y-1.5" data-testid="results-objectives">
              {r.objectives.map((ob) => (
                <li key={ob.id} className="flex items-center gap-3 text-sm" data-testid={`objective-${ob.id}`}>
                  <span className={`font-mono text-[10px] tracking-widest ${ob.met ? "text-emerald-400" : "text-red-400"}`}>{ob.met ? "MET " : "MISS"}</span>
                  <span className="text-slate-200">{ob.label}</span>
                  <span className="ml-auto font-mono text-xs text-slate-500">{ob.detail}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="panel rounded-sm p-6 rise" style={{ animationDelay: "100ms" }} data-testid="results-score">
            <div className="eyebrow">Score</div>
            <div className="font-mono text-6xl font-bold text-white" data-testid="results-total-score">{fmt(r.total)}<span className="text-xl text-slate-500">/100</span></div>
            <table className="mt-4 w-full text-xs">
              <tbody>
                {r.score.map((c) => (
                  <tr key={c.name} className="border-t border-slate-800">
                    <td className="py-2 pr-2">
                      <div className="text-slate-200">{c.name}</div>
                      <div className="font-mono text-[10px] text-slate-500">{c.basis}</div>
                    </td>
                    <td className="py-2 text-right font-mono text-sky-300">{c.max ? `${fmt(c.points, 1)}/${c.max}` : "n/a"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="panel rounded-sm p-5" data-testid="results-cause-chain">
            <div className="eyebrow mb-3">What happened — cause chain</div>
            <div className="flex flex-wrap items-center gap-2">
              {r.causeChain.map((c, i) => (
                <span key={i} className="flex items-center gap-2">
                  <span className="inset rounded-sm px-2.5 py-1.5 font-mono text-[11px] text-slate-200">{c}</span>
                  {i < r.causeChain.length - 1 && <ArrowRight size={13} className="text-slate-600" />}
                </span>
              ))}
            </div>
          </div>
          <div className="panel rounded-sm p-5" data-testid="results-recommendations">
            <div className="eyebrow mb-3">Engineering recommendations</div>
            <ul className="space-y-2 text-sm text-slate-300">
              {r.recommendations.map((x, i) => <li key={i}>→ {x}</li>)}
            </ul>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Chart data={data} k="alt" label="Altitude" unit="km" color="#38bdf8" testId="chart-altitude" />
          <Chart data={data} k="speed" label="Orbital speed" unit="m/s" color="#10b981" testId="chart-speed" />
          <Chart data={data} k="fuel" label="Propellant remaining" unit="%" color="#f59e0b" testId="chart-fuel" />
          <Chart data={data} k="q" label="Dynamic pressure" unit="kPa" color="#ef4444" testId="chart-q" />
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="panel rounded-sm p-5" data-testid="results-event-log">
            <div className="eyebrow mb-2">Event log</div>
            <div className="max-h-72 space-y-0.5 overflow-y-auto font-mono text-[11px] scroll-thin">
              {r.log.map((e, i) => (
                <div key={i} className={e.type === "fail" ? "text-red-400" : e.type === "success" ? "text-emerald-400" : e.type === "stage" ? "text-amber-300" : "text-slate-400"}>
                  T+{mmss(e.t)} · {fmt(e.alt / 1000, 1)} km · {e.text}
                </div>
              ))}
            </div>
          </div>
          <div className="panel rounded-sm p-5" data-testid="results-attempts">
            <div className="eyebrow mb-2">Previous attempts · this mission &amp; difficulty</div>
            <table className="w-full font-mono text-[11px]">
              <thead>
                <tr className="text-left text-slate-500"><th className="py-1 font-normal">Design</th><th className="font-normal">Mass</th><th className="font-normal">Cost</th><th className="font-normal">Δv</th><th className="font-normal">Result</th><th className="text-right font-normal">Score</th></tr>
              </thead>
              <tbody>
                {attempts.map((a, i) => (
                  <tr key={i} className="border-t border-slate-800 text-slate-300">
                    <td className="py-1">{a.designName}</td>
                    <td>{fmt(a.mass / 1000, 1)} t</td>
                    <td>${fmt(a.cost, 1)}M</td>
                    <td>{fmt(a.dv)}</td>
                    <td className={a.outcome === "success" ? "text-emerald-400" : a.outcome === "partial" ? "text-amber-400" : "text-red-400"}>{a.outcome}</td>
                    <td className="text-right">{fmt(a.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-2 text-[10px] text-slate-600">Full side-by-side design comparison arrives in Milestone 6.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
