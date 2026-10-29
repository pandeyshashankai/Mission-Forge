import { useMemo, useState } from "react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine } from "recharts";
import { launchWindowChart, bestDepartureDay, EPOCH_LABEL } from "../../sim/mars";
import { makeCustomMission, saveCustomMission } from "../../sim/missions";
import { LAUNCH_SITES } from "../../sim/constants";
import { PARTS } from "../../sim/parts";

const dateOf = (day) => new Date(Date.parse(EPOCH_LABEL) + day * 86400000).toISOString().slice(0, 10);

export const MarsWindow = ({ profile, setProfile }) => {
  const data = useMemo(() => launchWindowChart(0, 900, 6), []);
  const day = profile.marsDepartDay ?? bestDepartureDay();
  const sel = data.reduce((a, b) => (Math.abs(b.day - day) < Math.abs(a.day - day) ? b : a));
  return (
    <div className="panel mt-6 rounded-sm p-4" data-testid="mars-launch-window">
      <div className="eyebrow mb-1">Launch-window chart · departure v∞ (km/s) vs departure date</div>
      <div className="h-44">
        <ResponsiveContainer>
          <LineChart data={data} margin={{ top: 4, right: 8, left: -14, bottom: 0 }} onClick={(e) => e && e.activePayload && setProfile({ ...profile, marsDepartDay: e.activePayload[0].payload.day })}>
            <CartesianGrid stroke="#1e293b" strokeDasharray="2 4" />
            <XAxis dataKey="day" tick={{ fontSize: 9, fill: "#64748b" }} tickFormatter={(d) => dateOf(d).slice(0, 7)} />
            <YAxis domain={[2, 10]} allowDataOverflow tick={{ fontSize: 9, fill: "#64748b" }} />
            <Tooltip contentStyle={{ background: "#0b1220", border: "1px solid #1e293b", fontSize: 11 }} labelFormatter={(d) => dateOf(d)} />
            <ReferenceLine x={sel.day} stroke="#f59e0b" />
            <Line type="monotone" dataKey="vinf" stroke="#ef4444" dot={false} strokeWidth={2} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-3 font-mono text-[11px] text-slate-400">
        <span data-testid="mars-departure-date">Departure {dateOf(sel.day)} · v∞ {sel.vinf} km/s · cruise {sel.tof} d · arrival v∞ {sel.arr} km/s</span>
        <input data-testid="mars-departure-slider" type="range" min={0} max={900} step={6} value={sel.day} onChange={(e) => setProfile({ ...profile, marsDepartDay: +e.target.value })} className="w-56 accent-amber-500" />
        <button data-testid="mars-best-window-btn" onClick={() => setProfile({ ...profile, marsDepartDay: bestDepartureDay() })} className="border border-amber-500/50 px-2 py-0.5 text-amber-200">Best window</button>
      </div>
      <p className="mt-1 text-[10px] text-slate-500">Lambert transfers between Earth and Mars on JPL mean elements (coplanar). Click the chart or drag the slider to pick a day; the minimum is the 2026 window.</p>
    </div>
  );
};

const PAYLOADS = Object.values(PARTS).filter((p) => p.payload);

export const MissionCreator = ({ onCreated, onClose }) => {
  const [f, setF] = useState({ name: "My orbit", site: "cape", altitude: 400, inclination: 51.6, payload: "sat_small", budget: 90 });
  const set = (k, num) => (e) => setF({ ...f, [k]: num ? +e.target.value : e.target.value });
  const inp = "w-full border border-slate-700 bg-slate-950 px-2 py-1 font-mono text-xs";
  const minInc = Math.abs(LAUNCH_SITES[f.site].lat);
  const ok = f.altitude >= 160 && f.altitude <= 2000 && f.inclination >= minInc - 0.01 && f.inclination <= 180 - minInc + 0.01 && f.budget > 0;
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60" data-testid="mission-creator">
      <div className="panel w-[420px] space-y-2 rounded-sm p-5">
        <div className="eyebrow">Custom mission creator</div>
        <label className="block text-xs text-slate-400">Name<input data-testid="creator-name" className={inp} value={f.name} onChange={set("name")} /></label>
        <label className="block text-xs text-slate-400">Launch site<select data-testid="creator-site" className={inp} value={f.site} onChange={set("site")}>{Object.entries(LAUNCH_SITES).map(([k, v]) => <option key={k} value={k}>{v.name}</option>)}</select></label>
        <div className="grid grid-cols-2 gap-2">
          <label className="block text-xs text-slate-400">Altitude (km)<input data-testid="creator-altitude" type="number" className={inp} value={f.altitude} onChange={set("altitude", 1)} /></label>
          <label className="block text-xs text-slate-400">Inclination (°)<input data-testid="creator-inclination" type="number" className={inp} value={f.inclination} onChange={set("inclination", 1)} /></label>
          <label className="block text-xs text-slate-400">Payload<select data-testid="creator-payload" className={inp} value={f.payload} onChange={set("payload")}>{PAYLOADS.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
          <label className="block text-xs text-slate-400">Budget ($M)<input data-testid="creator-budget" type="number" className={inp} value={f.budget} onChange={set("budget", 1)} /></label>
        </div>
        <p className="text-[10px] text-slate-500" data-testid="creator-hint">Altitude 160–2,000 km. Inclination must be between {minInc.toFixed(1)}° and {(180 - minInc).toFixed(1)}° from this site (a direct launch cannot go below the site latitude).</p>
        <div className="flex justify-end gap-2 pt-2">
          <button data-testid="creator-cancel-btn" onClick={onClose} className="border border-slate-700 px-3 py-1 text-xs">Cancel</button>
          <button data-testid="creator-save-btn" disabled={!ok} onClick={() => { const m = makeCustomMission(f); saveCustomMission(m); onCreated(m); }} className="border border-cyan-500/60 px-3 py-1 text-xs text-cyan-200 disabled:opacity-30">Create mission</button>
        </div>
      </div>
    </div>
  );
};
