const fmt = (x, d = 0) => (Number.isFinite(x) ? Number(x).toLocaleString("en-US", { maximumFractionDigits: d, minimumFractionDigits: d }) : "—");
const mmss = (s) => {
  if (!Number.isFinite(s)) return "—";
  const sign = s < 0 ? "-" : "";
  s = Math.abs(s);
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = Math.floor(s % 60);
  return `${sign}${h ? `${h}:` : ""}${String(m).padStart(2, "0")}:${String(x).padStart(2, "0")}`;
};

const Row = ({ label, value, unit, testId, tone }) => (
  <div className="flex items-baseline justify-between border-b border-slate-800/60 py-1">
    <span className="eyebrow !text-[9px]">{label}</span>
    <span data-testid={testId} className={`whitespace-nowrap font-mono text-sm font-bold ${tone || "text-sky-300"}`}>
      {value}
      <span className="ml-1 text-[9px] font-normal text-slate-500">{unit}</span>
    </span>
  </div>
);

export const TelemetryPanel = ({ s }) => (
  <div className="panel w-60 rounded-sm p-3" data-testid="hud-telemetry">
    <div className="eyebrow mb-1 text-cyan-400">Telemetry</div>
    <Row label="MET" value={`T+${mmss(s.t)}`} testId="telemetry-met-value" />
    <Row label="Altitude" value={fmt(s.alt / 1000, 2)} unit="km" testId="telemetry-altitude-value" />
    <Row label="Surface speed" value={fmt(s.surfSpeed)} unit="m/s" testId="telemetry-surface-speed-value" />
    <Row label="Orbital speed" value={fmt(s.speed)} unit="m/s" testId="telemetry-velocity-value" />
    <Row label="Vertical speed" value={fmt(s.vr)} unit="m/s" testId="telemetry-vertical-speed-value" />
    <Row label="Acceleration" value={fmt(s.accelG, 2)} unit="g" testId="telemetry-accel-value" />
    <Row label="Dyn. pressure" value={fmt(s.q / 1000, 1)} unit="kPa" testId="telemetry-q-value" />
    <Row label="Mach" value={fmt(s.mach, 2)} testId="telemetry-mach-value" />
    <Row label="Mass" value={fmt(s.mass / 1000, 1)} unit="t" testId="telemetry-mass-value" />
    <Row label="Pitch/Hdg" value={`${fmt(s.pitch, 1)}° / ${fmt(s.heading, 1)}°`} testId="telemetry-attitude-value" />
  </div>
);

export const OrbitPanel = ({ s }) => (
  <div className="panel w-60 rounded-sm p-3" data-testid="hud-orbit">
    <div className="eyebrow mb-1 text-cyan-400">Orbit</div>
    <Row label="Region" value={s.body === "moon" ? "Moon SOI" : "Earth"} testId="telemetry-region-value" tone={s.body === "moon" ? "text-amber-300" : undefined} />
    <Row label={s.body === "moon" ? "Aposelene" : "Apoapsis"} value={!Number.isFinite(s.apo) || s.apo > 1e9 ? "ESCAPE" : fmt(s.apo / 1000, 1)} unit="km" testId="telemetry-apoapsis-value" />
    <Row label={s.body === "moon" ? "Periselene" : "Periapsis"} value={s.peri < -6e6 ? "—" : fmt(s.peri / 1000, 1)} unit="km" testId="telemetry-periapsis-value" tone={s.peri >= 140000 ? "text-emerald-400" : s.peri > 0 ? "text-amber-400" : "text-sky-300"} />
    <Row label="Inclination" value={fmt(s.inc, 2)} unit="°" testId="telemetry-inclination-value" />
    <Row label="Time to apo" value={mmss(s.tApo)} testId="telemetry-time-to-apo-value" />
    <Row label="Period" value={mmss(s.period)} testId="telemetry-period-value" />
    {s.moonDist !== null && <Row label="Moon alt." value={fmt(s.moonDist / 1000)} unit="km" testId="telemetry-moon-distance-value" />}
    {s.nodeDrift !== null && s.status === "orbit" && s.apo < 1e8 && <Row label="Node drift (J2)" value={fmt(s.nodeDrift, 3)} unit="°/d" testId="telemetry-node-drift-value" />}
    <Row label="Sun β angle" value={fmt(s.beta, 1)} unit="°" testId="telemetry-beta-value" />
    <div className="eyebrow mb-1 mt-3 text-cyan-400">Guidance</div>
    <div className="font-mono text-xs" data-testid="guidance-status">
      {s.guidance ? <span className="text-emerald-400">AUTO · {s.guidancePhase.toUpperCase()}</span> : <span className="text-amber-400">MANUAL</span>}
    </div>
  </div>
);

export const PropulsionPanel = ({ s, onStage }) => (
  <div className="panel flex items-stretch gap-4 rounded-sm p-3" data-testid="hud-propulsion">
    <div className="w-40">
      <div className="eyebrow !text-[9px]">Throttle</div>
      <div className="mt-1 h-3 w-full bg-slate-900">
        <div className="h-full bg-gradient-to-r from-orange-500 to-amber-300 transition-[width] duration-150" style={{ width: `${s.throttle * 100}%` }} />
      </div>
      <div className="mt-1 font-mono text-sm font-bold text-amber-300" data-testid="telemetry-throttle-value">{fmt(s.throttle * 100)}%</div>
      <div className="font-mono text-[10px] text-slate-500" data-testid="telemetry-thrust-value">{fmt(s.thrust / 1000)} kN</div>
    </div>
    <div className="w-48">
      <div className="eyebrow !text-[9px]">Propellant</div>
      <div className="mt-1 space-y-1">
        {s.fuel.map((f) => (
          <div key={f.label} className="flex items-center gap-2" data-testid={`fuel-bar-${f.label.replace(/\s+/g, "-").toLowerCase()}`}>
            <span className="w-14 font-mono text-[10px] text-slate-400">{f.label}</span>
            <div className="h-2 flex-1 bg-slate-900"><div className={`h-full ${f.pct < 10 ? "bg-red-500" : "bg-sky-400"}`} style={{ width: `${f.pct}%` }} /></div>
            <span className="w-8 text-right font-mono text-[10px] text-slate-400">{fmt(f.pct)}%</span>
          </div>
        ))}
      </div>
    </div>
    <div className="flex flex-col justify-between">
      <div className="eyebrow !text-[9px]">Next stage</div>
      <div className="max-w-[180px] text-[11px] text-slate-300" data-testid="next-stage-label">{s.nextEvent || "No more stages"}</div>
      <button data-testid="stage-button" disabled={!s.nextEvent} onClick={onStage} className="hazard mt-1 border border-amber-500/60 px-3 py-1 font-mono text-xs uppercase tracking-widest text-amber-300 disabled:opacity-30">Stage [Space]</button>
    </div>
  </div>
);

export const EventLog = ({ log }) => (
  <div className="panel w-80 rounded-sm p-3" data-testid="hud-event-log">
    <div className="eyebrow mb-1">Event log</div>
    <div className="space-y-0.5">
      {log.slice(-6).map((e, i) => (
        <div key={i} className={`font-mono text-[10px] ${e.type === "fail" ? "text-red-400" : e.type === "success" ? "text-emerald-400" : e.type === "stage" ? "text-amber-300" : "text-slate-400"}`}>
          T+{mmss(e.t)} {e.text}
        </div>
      ))}
    </div>
  </div>
);

export { mmss, fmt };
