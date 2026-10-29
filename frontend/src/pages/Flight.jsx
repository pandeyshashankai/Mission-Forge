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
import { DEG, LAUNCH_SITES } from "../sim/constants";
import { GuidancePanel } from "../components/game/GuidancePanel";
import { TelemetryPanel, OrbitPanel, PropulsionPanel, EventLog } from "../components/game/FlightHud";
import { GoNoGo } from "../components/game/Status";
import { AttitudePanel, ManeuverPanel, CheckpointList } from "../components/game/FlightPanels";
import { CrewPanel } from "../components/game/CrewPanel";
import { SystemsPanel, AlarmPanel } from "../components/game/SystemsPanel";
import { isLunar } from "../sim/missions";
import { moonState, j2NodeRate, sunBeta, MOON } from "../sim/bodies";
import { lifeSupportStatus } from "../sim/crew";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../components/ui/dialog";

const WARPS = [1, 2, 5, 10, 50, 100, 1000, 5000, 20000];
const CAMS = ["chase", "cinematic", "free", "map"];
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
    attStatus: sim.attStatus, attMode: sim.attMode, rcsEnabled: sim.rcsEnabled, hasNode: !!sim.node,
    sys: { ...sim.sys, alarms: sim.sys.alarms.map((a) => ({ ...a })) }, marsOrbitAt: sim.marsOrbitAt, cruise: sim.mars && sim.mars.arrival,
    body: n.body, moonDist: sim.eph && !sim.eph.central ? Math.hypot(...sim.r.map((x, i) => x - moonState(sim.t, sim.eph).r[i])) - MOON.radius : null,
    beta: (sunBeta(sim.sunDir, n.el.h) * 180) / Math.PI, nodeDrift: n.body === "earth" ? (j2NodeRate(n.el) * 86400 * 180) / Math.PI : null,
    lunarOrbitAt: sim.lunarOrbitAt, crew: sim.aero.crew, ls: sim.aero.crew ? lifeSupportStatus(sim) : null, entry: { ...sim.entry }, blunt: sim.aero.blunt, hasChute: !!sim.aero.chute,
  };
}

// Highest warp that keeps the fixed-step integrator real-time: ~1000x per 0.1 s of coast step.
function coastWarpCap(sim) {
  const raw = Math.min(20000, Math.max(1000, (1000 * sim.coastDt()) / 0.1));
  return WARPS.filter((w) => w <= raw).pop();
}

function maneuverWarpCap(sim) {
  const m = sim.maneuver;
  if (!m || m.done) return 20000;
  if (m.phase === "burn") return 1;
  const rem = m.tStart - sim.t;
  return rem > 30000 ? 20000 : rem > 600 ? 1000 : rem > 120 ? 100 : rem > 45 ? 10 : 1;
}

export default function Flight() {
  const g = useGame();
  const mission = getMission(g.missionId);
  const review = useMemo(() => runReadiness(g.design, mission, g.difficulty), [g.design, mission, g.difficulty]);
  const pending = useRef(g.pendingCheckpoint);
  const [phase, setPhase] = useState(pending.current ? "flight" : "checklist");
  const [ckOpen, setCkOpen] = useState(false);
  const [cks, setCks] = useState([]);
  const [guidanceOn, setGuidanceOn] = useState(true);
  const [count, setCount] = useState(10);
  const [hold, setHold] = useState(false);
  const [cam, setCam] = useState(g.settings.camera || "chase");
  const [snap, setSnap] = useState(null);
  const simRef = useRef(null);
  if (!simRef.current) {
    simRef.current = new FlightSim({ design: g.design, mission, profile: g.profile, guidanceOn: true, difficulty: g.difficulty });
    if (pending.current) simRef.current.restore(pending.current.state);
  }
  const phaseRef = useRef(phase);
  phaseRef.current = phase;
  const warpRef = useRef(1);
  const keys = useRef(new Set());
  const snapTimer = useRef(0);
  const endedRef = useRef(false);

  const rebuildSim = useCallback((on) => {
    simRef.current = new FlightSim({ design: g.design, mission, profile: g.profile, guidanceOn: on, difficulty: g.difficulty });
  }, [g.design, mission, g.profile, g.difficulty]);

  useEffect(() => {
    if (pending.current) {
      g.setPendingCheckpoint(null);
      pending.current = null;
      toast.success("Flight resumed from checkpoint");
      return;
    }
    if (phase === "checklist") rebuildSim(guidanceOn);
  }, [phase, guidanceOn, rebuildSim]); // eslint-disable-line react-hooks/exhaustive-deps

  const saveCheckpoint = useCallback((label, auto, state) => {
    const sim = simRef.current;
    const ck = { id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, label, auto, at: new Date().toISOString(), missionId: mission.id, missionName: mission.name, difficulty: g.difficulty, design: sim.design, designName: sim.design.name, profile: g.profile, simT: state ? state.t : sim.t, state: state || sim.serialize() };
    if (storage.saveCheckpoint(ck)) toast.success(`Checkpoint saved — ${label}`);
    else toast.error("Browser storage is full — delete old checkpoints");
  }, [g.profile, g.difficulty, mission]);

  const restoreCheckpoint = (ck) => {
    const sim = new FlightSim({ design: ck.design, mission, profile: ck.profile, guidanceOn: true, difficulty: ck.difficulty });
    sim.restore(ck.state);
    simRef.current = sim;
    g.loadDesign(ck.design);
    if (ck.profile) g.setProfile(ck.profile);
    warpRef.current = 1;
    endedRef.current = false;
    setCkOpen(false);
    toast.success(`Restored "${ck.label}"`);
  };

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
    const limited = sim.nav.F > 0 || (sim.nav.body === "earth" && sim.nav.alt < ATMOS_TOP);
    const max = Math.min(limited ? 10 : coastWarpCap(sim), maneuverWarpCap(sim));
    warpRef.current = Math.min(w, max);
    const why = sim.nav.F > 0 ? "engines are firing" : limited ? "inside the atmosphere" : max === maneuverWarpCap(sim) && max < coastWarpCap(sim) ? "approaching a maneuver node" : `the integrator step is ${sim.coastDt().toFixed(2)} s this close to ${sim.nav.body === "moon" ? "the Moon" : "Earth"}`;
    if (w > max) toast.message(`Warp limited to ×${max} while ${why}`);
  };

  const finish = useCallback(() => {
    if (endedRef.current) return;
    endedRef.current = true;
    const sim = simRef.current;
    if (!sim.isEnded()) sim.end("ended", sim.orbitAt ? "Mission completed — flight director closed the flight" : "Flight ended by the flight director");
    const res = evaluateFlight(sim, sim.design, mission, g.difficulty);
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
      if (k === "c") { setCam((c) => CAMS[(CAMS.indexOf(c) + 1) % CAMS.length]); return; }
      if (k === "m") { setCam((c) => (c === "map" ? "chase" : "map")); return; }
      if (k === "r") { sim.rcsEnabled = !sim.rcsEnabled; return; }
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

  const saveRef = useRef(saveCheckpoint);
  saveRef.current = saveCheckpoint;
  const onFrame = useCallback((dtReal) => {
    const sim = simRef.current;
    let simDt = 0;
    if (phaseRef.current === "flight") {
      const k = keys.current;
      sim.input = { pitch: (k.has("s") ? 1 : 0) - (k.has("w") ? 1 : 0), yaw: (k.has("d") ? 1 : 0) - (k.has("a") ? 1 : 0) };
      if (k.has("shift")) sim.throttle = Math.min(1, sim.throttle + dtReal * 0.6);
      if (k.has("control")) sim.throttle = Math.max(0, sim.throttle - dtReal * 0.6);
      if ((sim.nav.F > 0 || (sim.nav.body === "earth" && sim.nav.alt < ATMOS_TOP)) && warpRef.current > 10) warpRef.current = 10;
      warpRef.current = Math.min(warpRef.current, coastWarpCap(sim));
      warpRef.current = Math.min(warpRef.current, maneuverWarpCap(sim));
      const t0 = sim.t;
      sim.advance(dtReal * warpRef.current);
      simDt = sim.t - t0;
    }
    while (sim.checkpointQueue.length) {
      const c = sim.checkpointQueue.shift();
      saveRef.current(c.label, true, c.state);
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
          <span className="font-mono text-xs text-slate-500" data-testid="flight-design-name">{simRef.current.design.name}</span>
          {s && <span data-testid="flight-status" className={`font-mono text-[10px] uppercase tracking-widest ${crashed ? "text-red-400" : s.status === "orbit" ? "text-emerald-400" : "text-cyan-300"}`}>{s.clamped && phase === "flight" ? "on pad" : s.status === "orbit" || s.status === "flight" ? (s.body === "earth" && s.orbitAt && s.alt < 160000 && (s.vr < 0 || s.entry.ei) ? (s.entry.chute === "drogue" || s.entry.chute === "main" ? "descent" : "entry") : s.body === "mars" ? (s.marsOrbitAt ? "mars orbit" : "mars SOI") : s.body === "moon" ? (s.lunarOrbitAt ? "lunar orbit" : "lunar SOI") : s.status === "orbit" && s.apo > 1e8 ? "cislunar" : s.status) : s.status}</span>}
        </div>
        {phase === "flight" && s && (
          <div className="panel pointer-events-auto flex items-center gap-1 rounded-sm p-1">
            <FastForward size={13} className="mx-1 text-slate-500" />
            {WARPS.map((w) => (
              <button key={w} data-testid={`time-warp-${w}`} onClick={() => setWarp(w)} className={`px-1.5 py-0.5 font-mono text-[11px] ${s.warp === w ? "bg-cyan-500/20 text-cyan-200" : "text-slate-400 hover:text-white"}`}>×{w}</button>
            ))}
            <span className="mx-1 h-4 w-px bg-slate-700" />
            {CAMS.map((c) => (
              <button key={c} data-testid={`camera-${c}-btn`} onClick={(e) => { setCam(c); e.currentTarget.blur(); }} className={`flex items-center gap-1 px-2 py-0.5 font-mono text-[11px] uppercase focus:outline-none ${cam === c ? "bg-cyan-500/20 text-cyan-200" : "text-slate-400 hover:text-white"}`}><Camera size={11} />{c}</button>
            ))}
            <span className="mx-1 h-4 w-px bg-slate-700" />
            {s.guidance !== undefined && simRef.current.guidance && (
              <button data-testid="guidance-toggle-btn" onClick={() => { const gd = simRef.current.guidance; gd.disengaged = !gd.disengaged; }} className={`px-2 py-0.5 font-mono text-[11px] uppercase ${s.guidance ? "text-emerald-400" : "text-amber-400"}`}>{s.guidance ? "Auto" : "Manual"} [G]</button>
            )}
            <button data-testid="checkpoints-btn" onClick={() => { setCks(storage.checkpoints().filter((c) => c.missionId === mission.id)); setCkOpen(true); }} className="px-2 py-0.5 font-mono text-[11px] uppercase text-slate-300 hover:text-white">Checkpoints</button>
            <button data-testid="end-flight-btn" onClick={finish} className="flex items-center gap-1 px-2 py-0.5 font-mono text-[11px] uppercase text-red-300 hover:text-red-200"><Flag size={11} /> End flight</button>
          </div>
        )}
      </div>

      {phase === "flight" && s && (
        <>
          <div className="absolute left-3 top-20"><TelemetryPanel s={s} /></div>
          <div className="absolute right-3 top-20 flex max-h-[calc(100%-160px)] flex-col gap-2 overflow-y-auto scroll-thin"><OrbitPanel s={s} /><SystemsPanel s={s} sim={simRef.current} />{s.crew > 0 && <CrewPanel s={s} sim={simRef.current} />}<AttitudePanel s={s} sim={simRef.current} /></div>
          {(cam === "map" || s.hasNode) && s.status !== "prelaunch" && !s.clamped && (
            <div className="absolute right-[264px] top-20"><ManeuverPanel s={s} sim={simRef.current} mission={mission} targetAlt={mission.target.altitude} onWarpTo={() => setWarp(20000)} /></div>
          )}
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2"><PropulsionPanel s={s} onStage={stage} /></div>
          <div className="absolute bottom-3 left-3"><EventLog log={s.log} /></div>
          <div className="absolute left-1/2 top-16 -translate-x-1/2"><AlarmPanel s={s} sim={simRef.current} onChange={() => setSnap(snapshot(simRef.current, warpRef.current))} /></div>
          <div className="pointer-events-none absolute bottom-3 right-3 text-right font-mono text-[10px] leading-relaxed text-slate-500">
            SPACE stage · SHIFT/CTRL throttle · Z full · X cut · R RCS<br />W/S pitch · A/D heading · G guidance · C camera · M map · , . warp
          </div>
          {((s.status === "orbit" && !isLunar(mission) && mission.kind !== "mars") || (mission.kind === "lunar_orbit" && s.lunarOrbitAt && s.body === "moon") || (mission.kind === "mars" && s.marsOrbitAt && s.body === "mars")) && !crashed && (
            <div className="panel absolute left-1/2 top-20 -translate-x-1/2 rounded-sm border-emerald-500/50 px-5 py-3 text-center rise" data-testid="orbit-achieved-banner">
              <div className="flex items-center justify-center gap-2 font-display text-xl font-bold uppercase tracking-widest text-emerald-400"><CheckCircle2 size={18} /> {s.body === "moon" ? "Lunar orbit" : s.body === "mars" ? "Mars orbit" : "Stable orbit"}</div>
              <div className="font-mono text-xs text-slate-300">{(s.apo / 1000).toFixed(1)} × {(s.peri / 1000).toFixed(1)} km · i {s.inc.toFixed(2)}°</div>
              <button data-testid="complete-mission-btn" onClick={finish} className="mt-2 border border-emerald-500/60 px-4 py-1 font-mono text-xs uppercase tracking-widest text-emerald-300 hover:bg-emerald-500/10">Complete mission → report</button>
            </div>
          )}
          {s.status === "splashdown" && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/40" data-testid="splashdown-overlay">
              <div className="panel rounded-sm border-emerald-500/60 p-6 text-center">
                <div className="flex items-center justify-center gap-2 font-display text-3xl font-bold uppercase tracking-widest text-emerald-400"><CheckCircle2 /> Splashdown</div>
                <div className="mt-1 font-mono text-xs text-slate-400">{simRef.current.endReason}</div>
                <button data-testid="splashdown-report-btn" onClick={finish} className="mt-4 border border-emerald-500/60 px-4 py-1.5 font-mono text-xs uppercase tracking-widest text-emerald-300 hover:bg-emerald-500/10">View mission report</button>
              </div>
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

      <Dialog open={ckOpen} onOpenChange={setCkOpen}>
        <DialogContent className="dark max-w-xl border-slate-800 bg-slate-950 text-slate-100" data-testid="checkpoint-dialog">
          <DialogHeader><DialogTitle className="font-display uppercase tracking-wider">Flight checkpoints</DialogTitle></DialogHeader>
          <CheckpointList list={cks} onSave={phase === "flight" ? () => { saveCheckpoint("Manual", false); setCks(storage.checkpoints().filter((c) => c.missionId === mission.id)); } : null} onRestore={restoreCheckpoint} onDelete={(id) => { storage.deleteCheckpoint(id); setCks(storage.checkpoints().filter((c) => c.missionId === mission.id)); }} />
        </DialogContent>
      </Dialog>

      {phase === "checklist" && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/40 p-6">
          <div className="panel grid w-full max-w-4xl grid-cols-2 gap-8 rounded-sm p-6 rise" data-testid="launch-checklist">
            <div>
              <div className="eyebrow text-cyan-400">Launch checklist</div>
              <div className="mt-2 font-display text-3xl font-bold uppercase tracking-tight">{LAUNCH_SITES[mission.site].name.replace(" (approx.)", "")} — {g.design.name}</div>
              <ul className="mt-4 space-y-2 text-sm">
                <li className="flex items-center gap-2" data-testid="checklist-readiness">{review.overall === "NO-GO" ? <AlertTriangle size={15} className="text-red-400" /> : <CheckCircle2 size={15} className="text-emerald-400" />} Readiness review <span className="ml-auto"><GoNoGo overall={review.overall} testId="checklist-go-nogo" /></span></li>
                <li className="flex items-center gap-2"><CheckCircle2 size={15} className="text-emerald-400" /> Propellant loaded — {(review.stats.mass / 1000).toFixed(1)} t on the pad</li>
                <li className="flex items-center gap-2"><CheckCircle2 size={15} className="text-emerald-400" /> Flight mode — {guidanceOn ? "Guidance computer" : "Manual"}</li>
                <li className="flex items-center gap-2"><CheckCircle2 size={15} className="text-emerald-400" /> Range clear · weather GO (weather not simulated)</li>
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
