import { Switch } from "../ui/switch";

const Field = ({ label, unit, value, onChange, step = 1, min, max, testId, hint }) => (
  <label className="block">
    <div className="eyebrow !text-[9px]">{label}</div>
    <div className="mt-1 flex items-center border border-slate-800 bg-slate-950 focus-within:border-cyan-500/60">
      <input data-testid={testId} type="number" step={step} min={min} max={max} value={value} onChange={(e) => onChange(Math.min(max ?? Infinity, Math.max(min ?? -Infinity, parseFloat(e.target.value))))} className="w-full bg-transparent px-2 py-1.5 font-mono text-sm text-sky-300 outline-none" />
      <span className="pr-2 font-mono text-[10px] text-slate-500">{unit}</span>
    </div>
    {hint && <div className="mt-0.5 text-[10px] text-slate-600">{hint}</div>}
  </label>
);

export const GuidancePanel = ({ profile, setProfile, enabled, setEnabled }) => {
  const set = (k, scale = 1) => (v) => Number.isFinite(v) && setProfile({ ...profile, [k]: v * scale });
  return (
    <div data-testid="guidance-panel">
      <div className="flex items-center justify-between">
        <div>
          <div className="font-display text-lg font-semibold uppercase tracking-wider">Flight Guidance Computer</div>
          <div className="text-[11px] text-slate-500">Flies with the same physics and limits as you. Steering keys hand control back to you.</div>
        </div>
        <Switch data-testid="guidance-enabled-switch" checked={enabled} onCheckedChange={setEnabled} />
      </div>
      <p className="mt-4 text-sm text-slate-300">Target: {profile.targetAltitude / 1000} km orbit · {profile.targetInclination}°. Guidance handles the gravity turn, throttle limits and staging.</p>
      <details className="mt-3">
        <summary className="cursor-pointer text-xs text-cyan-300">Tune ascent guidance</summary>
        <div className={`mt-3 grid grid-cols-2 gap-3 ${enabled ? "" : "pointer-events-none opacity-40"}`}>
        <Field label="Target orbit altitude" unit="km" value={profile.targetAltitude / 1000} onChange={set("targetAltitude", 1000)} min={150} max={2000} testId="guidance-target-alt-input" />
        <Field label="Target inclination" unit="°" value={profile.targetInclination} step={0.1} onChange={set("targetInclination")} min={0} max={180} testId="guidance-target-inc-input" hint="≥ launch-site latitude; > 90° = retrograde" />
        <Field label="Gravity-turn start speed" unit="m/s" value={profile.turnStartSpeed} onChange={set("turnStartSpeed")} min={10} max={300} testId="guidance-turn-speed-input" />
        <Field label="Pitch-over angle" unit="°" value={profile.pitchKick} step={0.5} onChange={set("pitchKick")} min={0.5} max={20} testId="guidance-pitch-kick-input" />
        <Field label="Max acceleration" unit="g" value={profile.maxAccelG} step={0.1} onChange={set("maxAccelG")} min={1.5} max={8} testId="guidance-max-accel-input" />
        <Field label="Max dynamic pressure" unit="kPa" value={profile.maxQ / 1000} onChange={set("maxQ", 1000)} min={10} max={80} testId="guidance-max-q-input" />
      </div>
      </details>
      <div className="mt-3 flex items-center justify-between border-t border-slate-800 pt-3">
        <span className="text-xs text-slate-300">Automatic staging <span className="text-slate-500">(on flameout; fairing above 100 km)</span></span>
        <Switch data-testid="autostage-switch" checked={profile.autoStage} onCheckedChange={(v) => setProfile({ ...profile, autoStage: v })} />
      </div>
    </div>
  );
};
