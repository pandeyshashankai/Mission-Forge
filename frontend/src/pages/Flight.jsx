import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Camera, FastForward, Flag, Pause, Play, X, CheckCircle2, XCircle, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { useGame } from "../game/GameContext";
import { FlightView } from "../three/FlightView";
import { FlightSim } from "../sim/flight";
import { getMission } from "../sim/missions";
import { runReadiness } from "../sim/readiness";
import { describeEvent } from "../sim/design";
import { evaluateFlight } from "../sim/scoring";
import { storage } from "../sim/storage";
import { ATMOS_TOP } from "../sim/atmosphere";
import { DEG } from "../sim/constants";
import { GuidancePanel } from "../components/game/GuidancePanel";
import { TelemetryPanel, OrbitPanel, PropulsionPanel, EventLog } from "../components/game/FlightHud";
import { GoNoGo } from "../components/game/Status";

const WARPS = [1, 2, 5, 10, 50, 100, 1000];
const fmtT = (n) => `T${n <= 0 ? "-" : "+"}${String(Math.abs(n)).padStart(2, "0")}`;

function snapshot(sim, warp) {
  const n = sim.nav;
  const fuel = sim.rt.sections
    .filter((s) => s.attached && Object.keys(s.tanksFull).length)
    .map((s) => {
      const full = Object.values(s.tanksFull).reduce((a, b) => a + b, 0);
      const now = Object.values(s.tanks).reduce((a, b) => a + b, 0);
      return { label: `Stage ${s.index + 1}`, pct: (100 * now) / full };
    });
  sim.rt.radials.filter((r) => r.attached).forEach((r) => fuel.push({ label: `SRB ×${r.n}`, pct: (100 * r.fuel) / r.fuelFull }));
  const next = sim.rt.events[sim.rt.eventIndex];
  return {
    t: sim.t, alt: n.alt, surfSpeed: n.surfSpeed, speed: n.speed, vr: n.vr, accelG: n.accel / 9.80665, q: n.q, mach: n.mach, mass: n.mass,
    pitch: sim.att.pitch, heading: sim.att.heading, apo: n.el.apoapsis, peri: n.el.periapsis, inc: n.el.inc / DEG, tApo: n.el.timeToApo, period: n.el.period,
    throttle: n.Fmax > 0 ? n.F / n.Fmax : 0, thrust: n.F, fuel, nextEvent: next && next !== "ignite-0" ? describeEvent(next, sim.sections).label : null,
    status: sim.status, guidance: !!sim.guidance && !sim.guidance.disengaged, guidancePhase: sim.guidance ? sim.guidance.phase : "", guidanceDone: sim.guidance?.done,
    log: [...sim.log], warp, orbitAt: sim.orbitAt, clamped: sim.clamped,
  };
}

export default function Flight() {
  const g = useGame();
  const mission = getMission(g.missionId);
  const review = useMemo(() => runReadiness(g.design, mission, g.difficulty), [g.design, mission, g.difficulty]);
  const [phase, setPhase] = useState("checklist");
  const [guidanceOn, setGuidanceOn] = useState(true);
  const [count, setCount] = useState(10);
  const [hold, setHold] = useState(false);
  const [cam, setCam] = useState(g.settings.camera || "chase");
  const [snap, setSnap] = useState(null);
  const simRef = useRef(null);
  if (!simRef.current) simRef.current = new FlightSim({ design: g.design, mission, profile: g.profile, guidanceOn: true });
  const phaseRef = useRef(phase);
  phaseRef.current = phase;
  const warpRef = useRef(1);
  const keys = useRef(new Set());
  const snapTimer = useRef(0);
  const endedRef = useRef(false);

  const rebuildSim = useCallback((on) => {
    simRef.current = new FlightSim({ design: g.design, mission, profile: g.profile, guidanceOn: on });
  }, [g.design, mission, g.profile]);

  useEffect(() => {
    if (phase === "checklist") rebuildSim(guidanceOn);
  }, [phase, guidanceOn, rebuildSim]);

  useEffect(() => {
    if (phase !== "countdown" || hold) return;
    if (count <= 0) {
      simRef.current.launch();
      setPhase("flight");
      return;
    }
    const id = setTimeout(() => setCount((c) => c - 1), 1000);
    return () => clearTimeout(id);
  }, [phase, count, hold]);

  const setWarp = (w) => {
    const sim = simRef.current;
    const limited = sim.nav.F > 0 || sim.nav.alt < ATMOS_TOP;
    const max = limited ? 10 : 1000;
    warpRef.current = Math.min(w, max);
    if (w > max) toast.message(`Warp limited to ×${max} while ${sim.nav.F > 0 ? "engines are firing" : "inside the atmosphere"}`);
  };

  const finish = useCallback(() => {
    if (endedRef.current) return;
    endedRef.current = true;
    const sim = simRef.current;
    if (!sim.isEnded()) sim.end("ended", "Flight ended by the flight director");
    const res = evaluateFlight(sim, g.design, mission, g.difficulty);
    storage.addAttempt(res);
    g.setResult(res);
    g.go("results");
  }, [g, mission]);

  const stage = useCallback(() => {
    const sim = simRef.current;
    if (phaseRef.current !== "flight") return;
    if (sim.stage()) toast.message("Staging");
  }, []);

  const disengage = () => {
    const sim = simRef.current;
    if (sim.guidance && !sim.guidance.disengaged) {
      sim.guidance.disengaged = true;
      toast.warning("Guidance disengaged — manual control");
    }
  };

  useEffect(() => {
    const down = (e) => {
      if (phaseRef.current !== "flight" || e.target.tagName === "INPUT") return;
      const k = e.key.toLowerCase();
      const sim = simRef.current;
      if (k === " ") { e.preventDefault(); stage(); return; }
      if (k === "c") { setCam((c) => (c === "chase" ? "free" : "chase")); return; }
      if (k === "." || k === ",") { const i = WARPS.indexOf(warpRef.current); setWarp(WARPS[Math.max(0, Math.min(WARPS.length - 1, i + (k === "." ? 1 : -1)))]); return; }
      if (k === "g" && sim.guidance) { sim.guidance.disengaged = !sim.guidance.disengaged; toast.message(sim.guidance.disengaged ? "Guidance disengaged" : "Guidance engaged"); return; }
      if (k === "z") { disengage(); sim.throttle = 1; return; }
      if (k === "x") { disengage(); sim.throttle = 0; return; }
      if (["w", "a", "s", "d", "shift", "control"].includes(k)) { disengage(); keys.current.add(k); }
    };
    const up = (e) => keys.current.delete(e.key.toLowerCase());
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => { window.removeEventListener("keydown", down); window.removeEventListener("keyup", up); };
  }, [stage]);

  const onFrame = useCallback((dtReal) => {
    const sim = simRef.current;
    let simDt = 0;
    if (phaseRef.current === "flight") {
      const k = keys.current;
      sim.input = { pitch: (k.has("s") ? 1 : 0) - (k.has("w") ? 1 : 0), yaw: (k.has("d") ? 1 : 0) - (k.has("a") ? 1 : 0) };
      if (k.has("shift")) sim.throttle = Math.min(1, sim.throttle + dtReal * 0.6);
      if (k.has("control")) sim.throttle = Math.max(0, sim.throttle - dtReal * 0.6);
      if ((sim.nav.F > 0 || sim.nav.alt < ATMOS_TOP) && warpRef.current > 10) warpRef.current = 10;
      const t0 = sim.t;
      sim.advance(dtReal * warpRef.current);
      simDt = sim.t - t0;
    }
    snapTimer.current -= dtReal;
    if (snapTimer.current <= 0) {
      snapTimer.current = 0.1;
      setSnap(snapshot(sim, warpRef.current));
    }
    return simDt;
  }, []);

  const s = snap;
  const crashed = s?.status === "crashed";

  return (
    <div className="relative h-full w-full overflow-hidden bg-black">
      <FlightView simRef={simRef} cameraMode={cam} quality={g.settings.graphics} onFrame={onFrame} />

      <div className="pointer-events-none absolute inset-x-0 top-0 flex items-center justify-between p-3">
        <div className="panel pointer-events-auto flex items-center gap-3 rounded-sm px-3 py-2">
          <span className="font-display text-base font-semibold uppercase tracking-wider">{mission.name}</span>
          <span className="font-mono text-xs text-slate-500">{g.design.name}</span>
          {s && <span data-testid="flight-status" className={`font-mono text-[10px] uppercase tracking-widest ${crashed ? "text-red-400" : s.status === "orbit" ? "text-emerald-400" : "text-cyan-300"}`}>{s.clamped && phase === "flight" ? "on pad" : s.status}</span>}
        </div>
        {phase === "flight" && s && (
          <div className="panel pointer-events-auto flex items-center gap-1 rounded-sm p-1">
            <FastForward size={13} className="mx-1 text-slate-500" />
            {WARPS.map((w) => (
              <button key={w} data-testid={`time-warp-${w}`} onClick={() => setWarp(w)} className={`px-1.5 py-0.5 font-mono text-[11px] ${s.warp === w ? "bg-cyan-500/20 text-cyan-200" : "text-slate-400 hover:text-white"}`}>×{w}</button>
            ))}
            <span className="mx-1 h-4 w-px bg-slate-700" />
            {["chase", "free"].map((c) => (
              <button key={c} data-testid={`camera-${c}-btn`} onClick={() => setCam(c)} className={`flex items-center gap-1 px-2 py-0.5 font-mono text-[11px] uppercase ${cam === c ? "bg-cyan-500/20 text-cyan-200" : "text-slate-400 hover:text-white"}`}><Camera size={11} />{c}</button>
            ))}
            <span className="mx-1 h-4 w-px bg-slate-700" />
            {s.guidance !== undefined && simRef.current.guidance && (
              <button data-testid="guidance-toggle-btn" onClick={() => { const gd = simRef.current.guidance; gd.disengaged = !gd.disengaged; }} className={`px-2 py-0.5 font-mono text-[11px] uppercase ${s.guidance ? "text-emerald-400" : "text-amber-400"}`}>{s.guidance ? "Auto" : "Manual"} [G]</button>
            )}
            <button data-testid="end-flight-btn" onClick={finish} className="flex items-center gap-1 px-2 py-0.5 font-mono text-[11px] uppercase text-red-300 hover:text-red-200"><Flag size={11} /> End flight</button>
          </div>
        )}
      </div>

      {phase === "flight" && s && (
        <>
          <div className="absolute left-3 top-20"><TelemetryPanel s={s} /></div>
          <div className="absolute right-3 top-20"><OrbitPanel s={s} /></div>
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2"><PropulsionPanel s={s} onStage={stage} /></div>
          <div className="absolute bottom-3 left-3"><EventLog log={s.log} /></div>
          <div className="pointer-events-none absolute bottom-3 right-3 text-right font-mono text-[10px] leading-relaxed text-slate-500">
            SPACE stage · SHIFT/CTRL throttle · Z full · X cut<br />W/S pitch · A/D heading · G guidance · C camera · , . warp
          </div>
          {s.status === "orbit" && !crashed && (
            <div className="panel absolute left-1/2 top-20 -translate-x-1/2 rounded-sm border-emerald-500/50 px-5 py-3 text-center rise" data-testid="orbit-achieved-banner">
              <div className="flex items-center justify-center gap-2 font-display text-xl font-bold uppercase tracking-widest text-emerald-400"><CheckCircle2 size={18} /> Stable orbit</div>
              <div className="font-mono text-xs text-slate-300">{(s.apo / 1000).toFixed(1)} × {(s.peri / 1000).toFixed(1)} km · i {s.inc.toFixed(2)}°</div>
              <button data-testid="complete-mission-btn" onClick={finish} className="mt-2 border border-emerald-500/60 px-4 py-1 font-mono text-xs uppercase tracking-widest text-emerald-300 hover:bg-emerald-500/10">Complete mission → report</button>
            </div>
          )}
          {crashed && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/50" data-testid="vehicle-lost-overlay">
              <div className="panel rounded-sm border-red-500/60 p-6 text-center">
                <div className="flex items-center justify-center gap-2 font-display text-3xl font-bold uppercase tracking-widest text-red-400"><XCircle /> Vehicle lost</div>
                <div className="mt-1 font-mono text-xs text-slate-400">{simRef.current.endReason}</div>
                <button data-testid="view-report-btn" onClick={finish} className="mt-4 border border-red-500/60 px-4 py-1.5 font-mono text-xs uppercase tracking-widest text-red-300 hover:bg-red-500/10">View mission report</button>
              </div>
            </div>
          )}
        </>
      )}

      {phase === "checklist" && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/40 p-6">
          <div className="panel grid w-full max-w-4xl grid-cols-2 gap-8 rounded-sm p-6 rise" data-testid="launch-checklist">
            <div>
              <div className="eyebrow text-cyan-400">Launch checklist</div>
              <div className="mt-2 font-display text-3xl font-bold uppercase tracking-tight">Pad 39A — {g.design.name}</div>
              <ul className="mt-4 space-y-2 text-sm">
                <li className="flex items-center gap-2" data-testid="checklist-readiness">{review.overall === "NO-GO" ? <AlertTriangle size={15} className="text-red-400" /> : <CheckCircle2 size={15} className="text-emerald-400" />} Readiness review <span className="ml-auto"><GoNoGo overall={review.overall} testId="checklist-go-nogo" /></span></li>
                <li className="flex items-center gap-2"><CheckCircle2 size={15} className="text-emerald-400" /> Propellant loaded — {(review.stats.mass / 1000).toFixed(1)} t on the pad</li>
                <li className="flex items-center gap-2"><CheckCircle2 size={15} className="text-emerald-400" /> Flight mode — {guidanceOn ? "Guidance computer" : "Manual"}</li>
                <li className="flex items-center gap-2"><CheckCircle2 size={15} className="text-emerald-400" /> Range clear · weather GO (not simulated in Milestone 1)</li>
              </ul>
              <div className="mt-6 flex gap-2">
                <button data-testid="start-countdown-btn" onClick={() => { setCount(10); setHold(false); setPhase("countdown"); }} className="hazard border border-emerald-500/60 bg-emerald-500/10 px-5 py-2.5 font-display text-lg font-semibold uppercase tracking-widest text-emerald-300">Start countdown</button>
                <button data-testid="checklist-back-btn" onClick={() => g.go("review")} className="border border-slate-700 px-4 py-2.5 font-mono text-xs uppercase tracking-widest text-slate-400 hover:text-white">Back to review</button>
              </div>
            </div>
            <GuidancePanel profile={g.profile} setProfile={g.setProfile} enabled={guidanceOn} setEnabled={setGuidanceOn} />
          </div>
        </div>
      )}

      {phase === "countdown" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/30" data-testid="countdown-overlay">
          <div className="eyebrow">Terminal count {hold && <span className="text-amber-400">· HOLD</span>}</div>
          <div className="font-mono text-8xl font-bold text-white" data-testid="countdown-value">{fmtT(-count)}</div>
          <div className="mt-6 flex gap-2">
            <button data-testid="countdown-hold-btn" onClick={() => setHold(!hold)} className="flex items-center gap-2 border border-amber-500/60 px-4 py-2 font-mono text-xs uppercase tracking-widest text-amber-300">{hold ? <Play size={13} /> : <Pause size={13} />} {hold ? "Resume" : "Hold"}</button>
            <button data-testid="countdown-scrub-btn" onClick={() => setPhase("checklist")} className="flex items-center gap-2 border border-red-500/60 px-4 py-2 font-mono text-xs uppercase tracking-widest text-red-300"><X size={13} /> Scrub</button>
          </div>
        </div>
      )}
    </div>
  );
}
