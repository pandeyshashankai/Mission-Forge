import { fmt } from "./FlightHud";
import { AlertTriangle, BellOff } from "lucide-react";

const R = ({ k, v, tone, id }) => (
  <>
    <span className="text-slate-500">{k}</span>
    <span className={`text-right ${tone || "text-sky-300"}`} data-testid={id}>{v}</span>
  </>
);

export const SystemsPanel = ({ s, sim }) => {
  const y = s.sys;
  const c = sim.pcfg;
  const socPct = c && c.battery ? (100 * y.soc) / c.battery : 0;
  const tC = y.temp - 273.15;
  return (
    <div className="panel w-60 rounded-sm p-3" data-testid="hud-systems">
      <div className="eyebrow mb-1 text-cyan-400">Power · thermal · comms</div>
      <div className="grid grid-cols-2 gap-x-2 font-mono text-[10px]">
        <R k="Sunlight" v={y.lit ? "LIT" : "ECLIPSE"} tone={y.lit ? "text-amber-300" : "text-slate-400"} id="sys-lit" />
        <R k="Gen / load" v={`${fmt(y.gen || 0)} / ${fmt(y.load || 0)} W`} id="sys-power" />
        <R k="Battery" v={`${fmt(socPct, 0)}% of ${fmt((c ? c.battery : 0) / 1000, 1)} kWh`} tone={y.powerOut ? "text-red-400" : socPct < 20 ? "text-amber-400" : "text-sky-300"} id="sys-battery" />
        <R k="Avionics temp" v={`${fmt(tC, 1)} °C`} tone={tC > 45 || tC < -10 ? "text-amber-400" : "text-sky-300"} id="sys-temp" />
        <R k="Signal delay" v={y.delay > 60 ? `${fmt(y.delay / 60, 1)} min` : `${fmt(y.delay, 2)} s`} id="sys-delay" />
        <R k="Link" v={y.link ? "LOCK" : "LOS"} tone={y.link ? "text-emerald-400" : "text-red-400"} id="sys-link" />
      </div>
    </div>
  );
};

export const AlarmPanel = ({ s, sim, onChange }) => {
  const active = s.sys.alarms.filter((a) => !a.cleared || !a.ack);
  if (!active.length) return null;
  const unacked = active.some((a) => !a.ack);
  return (
    <div className={`panel w-72 rounded-sm p-2 ${unacked ? "border-red-500/70 animate-pulse" : "border-amber-500/40"}`} data-testid="alarm-panel">
      <div className="mb-1 flex items-center justify-between">
        <span className="flex items-center gap-1 font-mono text-[10px] uppercase tracking-widest text-red-400"><AlertTriangle size={12} /> Master alarm</span>
        <button data-testid="alarm-ack-btn" onClick={() => { sim.sys.alarms.forEach((a) => (a.ack = true)); onChange(); }} className="flex items-center gap-1 border border-slate-700 px-1.5 font-mono text-[9px] uppercase text-slate-300 hover:border-slate-500"><BellOff size={10} /> Ack</button>
      </div>
      <ul className="max-h-28 space-y-0.5 overflow-y-auto font-mono text-[10px]">
        {active.slice(0, 6).map((a, i) => (
          <li key={i} data-testid={`alarm-${a.id}`} className={a.cleared ? "text-slate-500 line-through" : a.sev === "critical" ? "text-red-300" : "text-amber-300"}>T+{fmt(a.t / 3600, 1)} h · {a.text}</li>
        ))}
      </ul>
    </div>
  );
};
