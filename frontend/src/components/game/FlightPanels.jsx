import { useMemo, useState } from "react";
import { Trash2, Save, RotateCcw } from "lucide-react";
import { nodePrediction, burnTime, raiseApoDv, stateAt } from "../../sim/maneuver";
import { EARTH } from "../../sim/constants";
import { mmss, fmt } from "./FlightHud";

const MODES = [
  ["auto", "Auto"], ["hold", "Hold"], ["prograde", "Pro"], ["retrograde", "Retro"], ["normal", "Nrm"],
  ["antinormal", "Anti"], ["radialOut", "Rad+"], ["radialIn", "Rad−"], ["sun", "Sun"], ["free", "Free"],
];

export const AttitudePanel = ({ s, sim }) => {
  const a = s.attStatus || {};
  return (
    <div className="panel w-60 rounded-sm p-3" data-testid="hud-attitude">
      <div className="eyebrow mb-2 text-cyan-400">Attitude control</div>
      <div className="grid grid-cols-5 gap-1">
        {MODES.map(([id, label]) => (
          <button key={id} data-testid={`att-mode-${id}`} onClick={() => sim.setAttMode(id)} disabled={id === "auto" && !sim.guidance}
            className={`py-0.5 font-mono text-[10px] ${s.attMode === id ? "bg-cyan-500/25 text-cyan-200" : "bg-slate-900 text-slate-400 hover:text-white"} disabled:opacity-30`}>{label}</button>
        ))}
      </div>
      <div className="mt-2 space-y-1 font-mono text-[10px]">
        <div className="flex justify-between"><span className="text-slate-500">Wheel momentum</span><span data-testid="att-wheel-pct" className={a.wheelPct > 95 ? "text-red-400" : a.wheelPct > 70 ? "text-amber-400" : "text-sky-300"}>{fmt(a.wheelPct || 0)}%</span></div>
        <div className="h-1.5 bg-slate-900"><div className={`h-full ${a.wheelPct > 95 ? "bg-red-500" : "bg-sky-400"}`} style={{ width: `${Math.min(100, a.wheelPct || 0)}%` }} /></div>
        <div className="flex justify-between"><span className="text-slate-500">RCS propellant</span><span data-testid="att-rcs-fuel" className="text-sky-300">{fmt(a.rcsFuel || 0, 1)} kg</span></div>
        <div className="flex justify-between"><span className="text-slate-500">Torque avail.</span><span data-testid="att-torque" className="text-sky-300">{fmt((a.torqueAvail || 0) / 1000, 1)} kN·m</span></div>
        <div className="flex justify-between"><span className="text-slate-500">Rate</span><span className="text-sky-300">{fmt(a.rate || 0, 2)} °/s</span></div>
      </div>
      <button data-testid="rcs-toggle-btn" onClick={() => (sim.rcsEnabled = !sim.rcsEnabled)} className={`mt-2 w-full border py-1 font-mono text-[10px] uppercase tracking-widest ${s.rcsEnabled ? "border-emerald-500/50 text-emerald-300" : "border-slate-700 text-slate-500"}`}>RCS {s.rcsEnabled ? "on" : "off"} [R]</button>
    </div>
  );
};

const Adj = ({ label, value, onChange, testId }) => (
  <div className="flex items-center gap-1">
    <span className="w-16 font-mono text-[10px] text-slate-400">{label}</span>
    {[-10, -1, -0.1].map((d) => <button key={d} data-testid={`${testId}-${d}`} onClick={() => onChange(value + d)} className="bg-slate-900 px-1 font-mono text-[10px] text-slate-400 hover:text-white">{d}</button>)}
    <input data-testid={testId} type="number" step="0.1" value={Number(value.toFixed(2))} onChange={(e) => onChange(parseFloat(e.target.value) || 0)} className="w-16 border border-slate-800 bg-slate-950 px-1 text-right font-mono text-[11px] text-sky-300" />
    {[0.1, 1, 10].map((d) => <button key={d} data-testid={`${testId}-plus-${d}`} onClick={() => onChange(value + d)} className="bg-slate-900 px-1 font-mono text-[10px] text-slate-400 hover:text-white">+{d}</button>)}
  </div>
);

export const ManeuverPanel = ({ s, sim, targetAlt, onWarpTo }) => {
  const [, force] = useState(0);
  const node = sim.node;
  const set = (n) => {
    sim.node = n;
    sim.maneuver = null;
    force((x) => x + 1);
  };
  const pred = useMemo(() => (node ? nodePrediction(sim, node) : null), [node, sim, s.t]); // eslint-disable-line react-hooks/exhaustive-deps
  const bt = pred ? burnTime(sim, pred.dv) : null;
  const el = sim.nav.el;
  const add = (t) => set({ t, dv: [0, 0, 0] });
  const suggestRaise = () => {
    const t = sim.t + 120;
    const at = stateAt(sim.r, sim.v, 120);
    set({ t, dv: [raiseApoDv(at.r, at.v, EARTH.radius + targetAlt), 0, 0] });
  };
  const suggestCirc = () => {
    if (!el.timeToApo) return;
    const at = stateAt(sim.r, sim.v, el.timeToApo);
    set({ t: sim.t + el.timeToApo, dv: [Math.sqrt(EARTH.mu / Math.hypot(...at.r)) - Math.hypot(...at.v), 0, 0] });
  };
  const m = sim.maneuver;
  return (
    <div className="panel w-[380px] rounded-sm p-3" data-testid="maneuver-panel">
      <div className="eyebrow mb-2 text-amber-400">Maneuver planner</div>
      {!node && (
        <div className="space-y-1">
          <div className="grid grid-cols-2 gap-1">
            <button data-testid="node-add-apo-btn" disabled={!el.timeToApo} onClick={() => add(sim.t + el.timeToApo)} className="border border-slate-700 py-1 text-[11px] hover:border-amber-500/60 disabled:opacity-30">Node at apoapsis</button>
            <button data-testid="node-add-peri-btn" disabled={!el.period} onClick={() => add(sim.t + ((el.timeToApo + el.period / 2) % el.period))} className="border border-slate-700 py-1 text-[11px] hover:border-amber-500/60 disabled:opacity-30">Node at periapsis</button>
            <button data-testid="node-add-now-btn" onClick={() => add(sim.t + 120)} className="border border-slate-700 py-1 text-[11px] hover:border-amber-500/60">Node in 2 min</button>
            <button data-testid="node-suggest-raise-btn" onClick={suggestRaise} className="border border-slate-700 py-1 text-[11px] hover:border-amber-500/60">Raise Ap to {fmt(targetAlt / 1000)} km</button>
          </div>
          <button data-testid="node-suggest-circ-btn" disabled={!el.timeToApo} onClick={suggestCirc} className="w-full border border-slate-700 py-1 text-[11px] hover:border-amber-500/60 disabled:opacity-30">Circularize at apoapsis (vis-viva)</button>
        </div>
      )}
      {node && pred && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between font-mono text-[11px]">
            <span className="text-slate-400">Node in <span className="text-sky-300" data-testid="node-time-to">{mmss(node.t - sim.t)}</span></span>
            <span className="flex gap-1">
              {[-60, -10, 10, 60].map((d) => <button key={d} data-testid={`node-time-${d}`} onClick={() => set({ ...node, t: Math.max(sim.t + 5, node.t + d) })} className="bg-slate-900 px-1 text-[10px] text-slate-400 hover:text-white">{d > 0 ? "+" : ""}{d}s</button>)}
            </span>
          </div>
          <Adj label="Prograde" value={node.dv[0]} onChange={(v) => set({ ...node, dv: [v, node.dv[1], node.dv[2]] })} testId="node-dv-prograde" />
          <Adj label="Normal" value={node.dv[1]} onChange={(v) => set({ ...node, dv: [node.dv[0], v, node.dv[2]] })} testId="node-dv-normal" />
          <Adj label="Radial" value={node.dv[2]} onChange={(v) => set({ ...node, dv: [node.dv[0], node.dv[1], v] })} testId="node-dv-radial" />
          <div className="grid grid-cols-2 gap-x-3 border-t border-slate-800 pt-1.5 font-mono text-[10px]">
            <span className="text-slate-500">Δv total</span><span className="text-right text-amber-300" data-testid="node-dv-total">{fmt(pred.dv, 1)} m/s</span>
            <span className="text-slate-500">Burn time</span><span className="text-right text-sky-300">{bt ? `${fmt(bt, 1)} s` : "no engine"}</span>
            <span className="text-slate-500">After: Ap × Pe</span><span className="text-right text-sky-300" data-testid="node-after-orbit">{pred.after.e < 1 ? `${fmt(pred.after.apoapsis / 1000, 1)} × ${fmt(pred.after.periapsis / 1000, 1)} km` : "escape"}</span>
            <span className="text-slate-500">After: incl.</span><span className="text-right text-sky-300">{fmt((pred.after.inc * 180) / Math.PI, 2)}°</span>
          </div>
          <div className="flex gap-1 pt-1">
            {!m && <button data-testid="node-execute-btn" disabled={!bt} onClick={() => { sim.planManeuver(node); force((x) => x + 1); }} className="flex-1 border border-emerald-500/60 bg-emerald-500/10 py-1 font-mono text-[10px] uppercase tracking-widest text-emerald-300 disabled:opacity-30">Execute with guidance</button>}
            {m && <div className="flex-1 py-1 text-center font-mono text-[10px] uppercase text-emerald-300" data-testid="maneuver-status">Guidance: {m.phase} {m.phase === "burn" ? `· ${fmt(Math.hypot(...m.remaining()), 1)} m/s left` : `· starts in ${mmss(m.tStart - sim.t)}`}</div>}
            <button data-testid="node-warp-btn" onClick={onWarpTo} className="border border-slate-700 px-2 py-1 font-mono text-[10px] uppercase text-slate-300 hover:text-white">Warp to</button>
            <button data-testid="node-delete-btn" onClick={() => set(null)} className="border border-slate-700 px-2 py-1 text-slate-400 hover:text-red-400"><Trash2 size={12} /></button>
          </div>
        </div>
      )}
      {m && m.done && <div className="mt-1 font-mono text-[10px] text-emerald-400">Last maneuver complete.</div>}
      <p className="mt-2 text-[10px] leading-snug text-slate-600">Model limits: Earth-only two-body gravity, no drag above 160 km. Paths are predicted by stepping the motion forward (RK4). Burn time from the rocket equation with the current stage.</p>
    </div>
  );
};

export const CheckpointList = ({ list, onRestore, onDelete, onSave }) => (
  <div className="space-y-1" data-testid="checkpoint-list">
    {onSave && <button data-testid="checkpoint-save-btn" onClick={onSave} className="mb-2 flex w-full items-center justify-center gap-2 border border-cyan-500/60 py-1.5 font-mono text-xs uppercase tracking-widest text-cyan-200 hover:bg-cyan-500/10"><Save size={13} /> Save checkpoint now</button>}
    {list.length === 0 && <div className="text-sm text-slate-500">No checkpoints yet.</div>}
    {list.map((c) => (
      <div key={c.id} className="flex items-center justify-between border border-slate-800 px-3 py-2">
        <button className="flex-1 text-left" data-testid={`checkpoint-restore-${c.id}`} onClick={() => onRestore(c)}>
          <div className="text-sm">{c.label} <span className="font-mono text-[10px] text-slate-500">{c.auto ? "AUTO" : "MANUAL"}</span></div>
          <div className="font-mono text-[10px] text-slate-500">{c.missionName} · {c.designName} · T+{mmss(c.simT)} · {new Date(c.at).toLocaleString()}</div>
        </button>
        <RotateCcw size={13} className="mx-2 text-slate-600" />
        <button data-testid={`checkpoint-delete-${c.id}`} onClick={() => onDelete(c.id)} className="p-1 text-slate-500 hover:text-red-400"><Trash2 size={13} /></button>
      </div>
    ))}
  </div>
);
