import re
p='/app/frontend/src/components/game/FlightHud.jsx'
s=open(p).read()
def R(a,b):
    global s
    assert a in s, a[:70]
    s=s.replace(a,b)
R('''    <span data-testid={testId} className={`font-mono text-sm font-bold ${tone || "text-sky-300"}`}>''','''    <span data-testid={testId} className={`whitespace-nowrap font-mono text-sm font-bold ${tone || "text-sky-300"}`}>''')
R('''    <Row label="Apoapsis" value={s.apo > 1e8 ? "ESCAPE" : fmt(s.apo / 1000, 1)} unit="km" testId="telemetry-apoapsis-value" />
    <Row label="Periapsis"''','''    <Row label="Region" value={s.body === "moon" ? "Moon SOI" : "Earth"} testId="telemetry-region-value" tone={s.body === "moon" ? "text-amber-300" : undefined} />
    <Row label={s.body === "moon" ? "Aposelene" : "Apoapsis"} value={!Number.isFinite(s.apo) || s.apo > 1e9 ? "ESCAPE" : fmt(s.apo / 1000, 1)} unit="km" testId="telemetry-apoapsis-value" />
    <Row label={s.body === "moon" ? "Periselene" : "Periapsis"}''')
R('''    <Row label="Period" value={mmss(s.period)} testId="telemetry-period-value" />''','''    <Row label="Period" value={mmss(s.period)} testId="telemetry-period-value" />
    {s.moonDist !== null && <Row label="Moon alt." value={fmt(s.moonDist / 1000)} unit="km" testId="telemetry-moon-distance-value" />}
    {s.nodeDrift !== null && s.status === "orbit" && s.apo < 1e8 && <Row label="Node drift (J2)" value={fmt(s.nodeDrift, 3)} unit="°/d" testId="telemetry-node-drift-value" />}
    <Row label="Sun β angle" value={fmt(s.beta, 1)} unit="°" testId="telemetry-beta-value" />''')
open(p,'w').write(s)

p='/app/frontend/src/components/game/FlightPanels.jsx'
s=open(p).read()
R('''import { nodePrediction, burnTime, raiseApoDv, stateAt } from "../../sim/maneuver";''','''import { nodePrediction, burnTime, raiseApoDv, stateAt } from "../../sim/maneuver";
import { planTLI, planMCC, planLOI, planCorridor } from "../../sim/transfer";
import { toast } from "sonner";''')
R('''export const ManeuverPanel = ({ s, sim, targetAlt, onWarpTo }) => {
  const [, force] = useState(0);''','''const LunarPlanner = ({ sim, mission, set, busy, setBusy }) => {
  const flyby = mission.kind === "lunar_flyby";
  const periAlt = flyby ? mission.flyby.periAlt : mission.lunar.altitude;
  const run = (label, fn) => {
    setBusy(label);
    setTimeout(() => {
      try {
        const r = fn();
        if (r && r.t) set(r);
        else toast.error(`${label}: no solution from the current state`);
      } finally {
        setBusy(null);
      }
    }, 30);
  };
  const body = sim.nav.body;
  const B = ({ id, label, fn, disabled }) => (
    <button data-testid={id} disabled={!!busy || disabled} onClick={() => run(label, fn)} className="border border-amber-500/40 py-1 text-[11px] text-amber-200 hover:border-amber-400 disabled:opacity-30">{busy === label ? "Computing…" : label}</button>
  );
  return (
    <div className="mt-1 grid grid-cols-2 gap-1" data-testid="lunar-planner">
      <B id="node-tli-btn" label="Trans-lunar injection" disabled={body !== "earth" || !(sim.nav.el.apoapsis < 2e6)} fn={() => planTLI(sim, { periAlt, apogeeFactor: flyby ? mission.flyby.apogeeFactor : 1 }).node} />
      <B id="node-mcc-btn" label={flyby ? "Mid-course (free return)" : "Mid-course correction"} disabled={body !== "earth" || sim.nav.el.apoapsis < 2e7} fn={() => planMCC(sim, { periAlt, freeReturn: flyby })?.node} />
      {!flyby && <B id="node-loi-btn" label="Lunar orbit insertion" disabled={body !== "moon"} fn={() => planLOI(sim)} />}
      {flyby && <B id="node-corridor-btn" label="Return corridor (40 km)" disabled={body !== "earth" || !sim.moonClosest} fn={() => planCorridor(sim, 40000, 600)} />}
    </div>
  );
};

export const ManeuverPanel = ({ s, sim, mission, targetAlt, onWarpTo }) => {
  const [, force] = useState(0);
  const [busy, setBusy] = useState(null);
  const lunar = mission && mission.kind && mission.kind.startsWith("lunar");''')
R('''  const pred = useMemo(() => (node ? nodePrediction(sim, node) : null), [node, sim, s.t]); // eslint-disable-line react-hooks/exhaustive-deps''','''  const tKey = Math.floor(s.t / (lunar ? 5 : 1));
  const pred = useMemo(() => (node ? nodePrediction(sim, node) : null), [node, sim, tKey]); // eslint-disable-line react-hooks/exhaustive-deps''')
R('''          <button data-testid="node-suggest-circ-btn" disabled={!el.timeToApo} onClick={suggestCirc} className="w-full border border-slate-700 py-1 text-[11px] hover:border-amber-500/60 disabled:opacity-30">Circularize at apoapsis (vis-viva)</button>''','''          <button data-testid="node-suggest-circ-btn" disabled={!el.timeToApo} onClick={suggestCirc} className="w-full border border-slate-700 py-1 text-[11px] hover:border-amber-500/60 disabled:opacity-30">Circularize at apoapsis (vis-viva)</button>
          {lunar && <LunarPlanner sim={sim} mission={mission} set={set} busy={busy} setBusy={setBusy} />}''')
R('''            <span className="text-slate-500">After: Ap × Pe</span><span className="text-right text-sky-300" data-testid="node-after-orbit">{pred.after.e < 1 ? `${fmt(pred.after.apoapsis / 1000, 1)} × ${fmt(pred.after.periapsis / 1000, 1)} km` : "escape"}</span>''','''            <span className="text-slate-500">After: Ap × Pe{pred.body === "moon" ? " (Moon)" : ""}</span><span className="text-right text-sky-300" data-testid="node-after-orbit">{pred.after.e < 1 ? `${fmt(pred.after.apoapsis / 1000, 1)} × ${fmt(pred.after.periapsis / 1000, 1)} km` : `hyperbolic · Pe ${fmt(pred.after.periapsis / 1000, 1)} km`}</span>''')
R('''Model limits: Earth-only two-body gravity, no drag above 160 km.''','''Model limits: {lunar ? "patched conics — Earth (with J2) outside, Moon inside its 66,000 km sphere of influence; no Sun perturbation" : "Earth gravity with J2 oblateness, no drag above 160 km"}.''')
open(p,'w').write(s)
print("ok")
