import {thermalSummary} from '../sim/flightThermal';
import {CockpitChrome} from "../components/game/CockpitChrome";
import { localData } from "../persistence/localData";
import { PhysicsBadge } from "../components/instruments/PhysicsBadge";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Rocket,
  FastForward,
  Flag,
  Pause,
  Play,
  X,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  SlidersHorizontal,
  Save,
  Map,
} from "lucide-react";
import { toast } from "sonner";
import { useGame } from "../game/GameContext";
import {
  useFlightInput,
  useTouchControlsVisible,
} from "../input/useFlightInput";
import { keyLabel, steeringAxes } from "../input/bindings";
import { TouchFlightControls, HeatGauge } from "../components/game/TouchFlightControls";
import { DisplayButton } from "../components/app/Appearance";
import { FlightView } from "../three/FlightView";
import { FlightSim } from "../sim/flight";
import { getMission } from "../sim/missions";
import { runReadiness } from "../sim/readiness";
import { describeEvent } from "../sim/design";
import { buildLearningReview, saveLearningReview } from "../science/learning";
import { evaluateFlight } from "../sim/scoring";
import { storage } from "../sim/storage";
import { ATMOS_TOP } from "../sim/atmosphere";
import { DEG, LAUNCH_SITES } from "../sim/constants";
import { GuidancePanel } from "../components/game/GuidancePanel";
import {
  TelemetryPanel,
  OrbitPanel,
  PropulsionPanel,
  EventLog,
} from "../components/game/FlightHud";
import { GoNoGo } from "../components/game/Status";
import {
  AttitudePanel,
  ManeuverPanel,
  CheckpointList,
} from "../components/game/FlightPanels";
import { CrewPanel } from "../components/game/CrewPanel";
import { SystemsPanel, AlarmPanel } from "../components/game/SystemsPanel";
import { isLunar } from "../sim/missions";
import { moonState, j2NodeRate, sunBeta, MOON } from "../sim/bodies";
import { lifeSupportStatus } from "../sim/crew";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "../components/ui/dialog";

const WARPS = [1, 10, 100, 1000, 20000];
const CAMS = ["side", "chase", "cinematic", "free", "map"];
const fmtT = (n) =>
  `T${n <= 0 ? "-" : "+"}${String(Math.abs(n)).padStart(2, "0")}`;

function snapshot(sim, warp) {
  const n = sim.nav;
  const fuel = sim.rt.sections
    .filter((s) => s.attached && Object.keys(s.tanksFull).length)
    .map((s) => {
      const full = Object.values(s.tanksFull).reduce((a, b) => a + b, 0);
      const now = Object.values(s.tanks).reduce((a, b) => a + b, 0);
      return { label: `Stage ${s.index + 1}`, pct: (100 * now) / full };
    });
  sim.rt.radials
    .filter((r) => r.attached)
    .forEach((r) =>
      fuel.push({ label: `SRB ×${r.n}`, pct: (100 * r.fuel) / r.fuelFull }),
    );
  const next = sim.rt.events[sim.rt.eventIndex];
  return {
    heat:thermalSummary(sim),
    t: sim.t,
    alt: n.alt,
    surfSpeed: n.surfSpeed,
    speed: n.speed,
    vr: n.vr,
    accelG: n.accel / 9.80665,
    q: n.q,
    mach: n.mach,
    mass: n.mass,
    pitch: sim.att.pitch,
    heading: sim.att.heading,
    apo: n.el.apoapsis,
    peri: n.el.periapsis,
    inc: n.el.inc / DEG,
    tApo: n.el.timeToApo,
    period: n.el.period,
    throttle: n.Fmax > 0 ? n.F / n.Fmax : 0,
    thrust: n.F,
    fuel,
    nextEvent:
      next && next !== "ignite-0"
        ? describeEvent(next, sim.sections).label
        : null,
    status: sim.status,
    guidance: !!sim.guidance && !sim.guidance.disengaged,
    guidancePhase: sim.guidance ? sim.guidance.phase : "",
    guidanceDone: sim.guidance?.done,
    guidanceHoldReason:sim.guidance?.holdReason||null,
    log: [...sim.log],
    warp,
    orbitAt: sim.orbitAt,
    clamped: sim.clamped,
    attStatus: sim.attStatus,
    attMode: sim.attMode,
    rcsEnabled: sim.rcsEnabled,
    hasNode: !!sim.node,
    sys: { ...sim.sys, alarms: sim.sys.alarms.map((a) => ({ ...a })) },
    body: n.body,
    moonDist: sim.eph
      ? Math.hypot(...sim.r.map((x, i) => x - moonState(sim.t, sim.eph).r[i])) -
        MOON.radius
      : null,
    beta: (sunBeta(sim.sunDir, n.el.h) * 180) / Math.PI,
    nodeDrift:
      n.body === "earth" ? (j2NodeRate(n.el) * 86400 * 180) / Math.PI : null,
    lunarOrbitAt: sim.lunarOrbitAt,
    crew: sim.aero.crew,
    ls: sim.aero.crew ? lifeSupportStatus(sim) : null,
    entry: { ...sim.entry },
    blunt: sim.aero.blunt,
    hasChute: !!sim.aero.chute,
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
  return rem > 30000
    ? 20000
    : rem > 600
      ? 1000
      : rem > 120
        ? 100
        : rem > 45
          ? 10
          : 1;
}

export default function Flight() {
  const g = useGame();
  const mission = getMission(g.missionId);
  const review = useMemo(
    () => runReadiness(g.design, mission, g.difficulty),
    [g.design, mission, g.difficulty],
  );
  const pending = useRef(g.pendingCheckpoint);
  const [phase, setPhase] = useState(pending.current ? "flight" : "checklist");
  const [cockpitMenu,setCockpitMenu]=useState(false);
  const [showEngineering, setShowEngineering] = useState(false);
  const [ckOpen, setCkOpen] = useState(false);
  const [endConfirm, setEndConfirm] = useState(false);
  const [cks, setCks] = useState([]);
  const [guidanceOn, setGuidanceOn] = useState(true);
  const [count, setCount] = useState(10);
  const [hold, setHold] = useState(false);
  const [paused, setPaused] = useState(!!pending.current);
  const pausedRef = useRef(false);
  const modalOpenRef = useRef(false);
  modalOpenRef.current = ckOpen || endConfirm || g.settingsOpen;
  pausedRef.current =
    paused || ckOpen || endConfirm || g.settingsOpen || g.overlayOpen;
  const [viewCommand,setViewCommand]=useState(0);
  const lastCraftCamera=useRef(g.settings.camera==="map"?"side":g.settings.camera||"side");
  const [cam, setCam] = useState(g.settings.camera || "side");
  if(cam!=="map")lastCraftCamera.current=cam;
  const [snap, setSnap] = useState(null);
  const simRef = useRef(null);
  if (!simRef.current) {
    simRef.current = new FlightSim({
      design: g.design,
      mission,
      profile: g.profile,
      guidanceOn: true,
      difficulty: g.difficulty,
    });
    if (pending.current) simRef.current.restore(pending.current.state);
  }
  const phaseRef = useRef(phase);
  phaseRef.current = phase;
  const warpRef = useRef(1);
  const touchVisible = useTouchControlsVisible(g.settings.touchControls);
  const sensitivityRef = useRef(g.settings.steeringSensitivity);
  sensitivityRef.current = g.settings.steeringSensitivity;
  const snapTimer = useRef(0);
  const endedRef = useRef(false);

  const rebuildSim = useCallback(
    (on) => {
      simRef.current = new FlightSim({
        design: g.design,
        mission,
        profile: g.profile,
        guidanceOn: on,
        difficulty: g.difficulty,
      });
    },
    [g.design, mission, g.profile, g.difficulty],
  );

  useEffect(() => {
    if (pending.current) {
      g.setPendingCheckpoint(null);
      pending.current = null;

      return;
    }
    if (phase === "checklist") rebuildSim(guidanceOn);
  }, [phase, guidanceOn, rebuildSim]); // eslint-disable-line react-hooks/exhaustive-deps

  const saveCheckpoint = useCallback(
    async (label, auto, state) => {
      const sim = simRef.current;
      const ck = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        label,
        schemaVersion: 1,
        auto,
        at: new Date().toISOString(),
        missionId: mission.id,
        missionName: mission.name,
        difficulty: g.difficulty,
        design: sim.design,
        designName: sim.design.name,
        profile: g.profile,
        simT: state ? state.t : sim.t,
        state: state || sim.serialize(),
      };
      if (storage.saveCheckpoint(ck)) {
        try {
          await localData.flush();
          toast.success(`Checkpoint saved — ${label}`);
        } catch (e) {
          toast.error(e.message);
        }
      } else toast.error("Browser storage is full — delete old checkpoints");
    },
    [g.profile, g.difficulty, mission],
  );

  useEffect(() => {
    const preserve = () => {
      const sim = simRef.current;
      if (phaseRef.current !== "flight") return;
      try {
        if (sim.isEnded()) {
          localData.removeItem("mf.recovery-flight");
          return;
        }
        localData.setItem(
          "mf.recovery-flight",
          JSON.stringify({
            id: "recovery-flight",
            schemaVersion: 1,
            label: "Automatic recovery",
            auto: true,
            at: new Date().toISOString(),
            missionId: mission.id,
            missionName: mission.name,
            difficulty: g.difficulty,
            design: sim.design,
            designName: sim.design.name,
            profile: g.profile,
            simT: sim.t,
            state: sim.serialize(),
          }),
        );
      } catch {
        /* The storage status banner reports failures. */
      }
    };
    preserve();
    const timer = setInterval(preserve, 15000),
      hidden = () => {
        if (document.hidden) preserve();
      };
    window.addEventListener("pagehide", preserve);
    document.addEventListener("visibilitychange", hidden);
    return () => {
      clearInterval(timer);
      preserve();
      window.removeEventListener("pagehide", preserve);
      document.removeEventListener("visibilitychange", hidden);
    };
  }, [phase, mission.id, mission.name, g.difficulty, g.profile]);

  const restoreCheckpoint = (ck) => {
    const sim = new FlightSim({
      design: ck.design,
      mission,
      profile: ck.profile,
      guidanceOn: true,
      difficulty: ck.difficulty,
    });
    sim.restore(ck.state);
    simRef.current = sim;
    g.loadDesign(ck.design);
    if (ck.profile) g.setProfile(ck.profile);
    warpRef.current = 1;
    endedRef.current = false;
    setCkOpen(false);

  };

  useEffect(() => {
    if (phase !== "countdown" || hold || g.settingsOpen) return;
    if (count <= 0) {
      simRef.current.launch();
      setPhase("flight");
      return;
    }
    const id = setTimeout(() => setCount((c) => c - 1), 1000);
    return () => clearTimeout(id);
  }, [phase, count, hold, g.settingsOpen]);

  const setWarp = (w) => {
    const sim = simRef.current;
    const limited =
      sim.nav.F > 0 || (sim.nav.body === "earth" && sim.nav.alt < ATMOS_TOP);
    const max = Math.min(
      limited ? 10 : coastWarpCap(sim),
      maneuverWarpCap(sim),
    );
    warpRef.current = Math.min(w, max);
    const why =
      sim.nav.F > 0
        ? "engines are firing"
        : limited
          ? "inside the atmosphere"
          : max === maneuverWarpCap(sim) && max < coastWarpCap(sim)
            ? "approaching a maneuver node"
            : `the integrator step is ${sim.coastDt().toFixed(2)} s this close to ${sim.nav.body === "moon" ? "the Moon" : "Earth"}`;
    if (w > max) toast.message(`Warp limited to ×${max} while ${why}`);
  };

  const finish = useCallback((destination="results") => {
    if (endedRef.current) return;
    endedRef.current = true;
    const sim = simRef.current;
    if (!sim.isEnded())
      sim.end(
        "ended",
        sim.orbitAt
          ? "Mission completed — flight director closed the flight"
          : "Flight ended by the flight director",
      );
    const res = evaluateFlight(sim, sim.design, mission, g.difficulty);
    res.learning = buildLearningReview(res, g.learningPrediction);
    if (res.learning) saveLearningReview(res.learning);
    storage.addAttempt(res);
    g.setResult(res);
    g.setPendingCheckpoint(null);
    g.go(typeof destination==="string"?destination:"results");
  }, [g, mission]);

  const stage = useCallback(() => {
    const sim = simRef.current;
    if (phaseRef.current !== "flight" || pausedRef.current) return;
    sim.stage();
  }, []);

  const disengage = () => {
    const sim = simRef.current;
    if (sim.guidance && !sim.guidance.disengaged) {
      sim.guidance.disengaged = true;
      toast.warning("Guidance disengaged — manual control");
    }
  };

  const input = useFlightInput({
    settings: g.settings,
    bindings: g.settings.bindings,
    onMenu: () => g.setSettingsOpen(true),
    enabled:
      !g.overlayOpen &&
      phase === "flight" &&
      !modalOpenRef.current &&
      !simRef.current.isEnded(),
    moving: !paused,
    onManual: () => {
      disengage();
      warpRef.current = 1;
    },
    onAction: (action) => {
      const sim = simRef.current;
      if (action === "pause") {
        setPaused((p) => !p);
        return;
      }
      if (action === "cutThrottle") {
        disengage();
        sim.throttle = 0;
        return;
      }
      if (action === "map") {
        setCam((c) => {if(c!=="map")lastCraftCamera.current=c;return c === "map" ? lastCraftCamera.current : "map";});
        return;
      }
      if (action === "camera") {
        setCam((c) => CAMS[(CAMS.indexOf(c) + 1) % CAMS.length]);
        return;
      }
      if (action === "warpUp" || action === "warpDown") {
        setWarp(
          WARPS[
            Math.max(
              0,
              Math.min(
                WARPS.length - 1,
                WARPS.indexOf(warpRef.current) + (action === "warpUp" ? 1 : -1),
              ),
            )
          ],
        );
        return;
      }
      if (pausedRef.current) return;
      if (action === "stage") stage();
      else if (action === "fullThrottle") {
        disengage();
        sim.throttle = 1;
        warpRef.current = 1;
      } else if (action === "rcs") sim.rcsEnabled = !sim.rcsEnabled;
      else if (action === "guidance" && sim.guidance) {
        input.clear();
        sim.guidance.disengaged = !sim.guidance.disengaged;
      }
    },
  });
  const inputRef = useRef(input);
  inputRef.current = input;
  useEffect(() => {
    const hidden = () => {
      if (document.hidden) setPaused(true);
    };
    document.addEventListener("visibilitychange", hidden);
    return () => document.removeEventListener("visibilitychange", hidden);
  }, []);

  const saveRef = useRef(saveCheckpoint);
  saveRef.current = saveCheckpoint;
  const onFrame = useCallback((dtReal) => {
    const sim = simRef.current;
    let simDt = 0;
    if (phaseRef.current === "flight" && !pausedRef.current) {
      const controls = inputRef.current;
      const axes = steeringAxes(controls.active);
      sim.input = {
        pitch: axes.pitch * sensitivityRef.current,
        yaw: axes.yaw * sensitivityRef.current,
      };
      if (controls.active("throttleUp"))
        sim.throttle = Math.min(1, sim.throttle + dtReal * 0.6);
      if (controls.active("throttleDown"))
        sim.throttle = Math.max(0, sim.throttle - dtReal * 0.6);
      if (
        (sim.nav.F > 0 ||
          (sim.nav.body === "earth" && sim.nav.alt < ATMOS_TOP)) &&
        warpRef.current > 10
      )
        warpRef.current = 10;
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
    <div
      onClickCapture={(e) => {
        if (e.detail > 0) e.target.closest?.("button")?.blur();
        if(e.target.closest?.(".flight-top-console button"))setCockpitMenu(false);
      }}
      style={{"--flight-sky":s?.body==="earth"?`rgb(${[91,143,199].map(c=>Math.round(c*(1-Math.min(1,Math.max(0,s.alt/60000))))).join(" ")})`:"#000"}}
      data-phase={phase}
      data-steering={g.settings.steeringSide}
      data-cockpit-menu={cockpitMenu?"open":"closed"}
      data-camera={cam}
      data-touch="on"
      data-input-touch={touchVisible ? "on" : "off"}
      data-instruments={showEngineering ? "detailed" : "simple"}
      className="flight-screen relative h-full w-full overflow-hidden bg-black"
    >
      <div className="flight-camera-window">
        <FlightView
          simRef={simRef}
          cameraMode={cam}
          viewCommand={viewCommand}
          quality={g.settings.graphics}
          onFrame={onFrame}
        />
      </div>
      {phase==="flight"&&!cockpitMenu&&!showEngineering&&<div className="flight-view-shortcuts" aria-label="Flight view"><button data-testid="camera-side-btn" aria-pressed={cam==="side"} onClick={()=>setCam("side")}>Side</button><button data-testid="camera-3d-btn" aria-pressed={cam==="chase"} onClick={()=>setCam("chase")}>3D</button><button data-testid="camera-fit-btn" onClick={()=>setViewCommand(v=>v+1)}>Focus</button></div>}
      {phase==="flight"&&s?.guidance&&!cockpitMenu&&!showEngineering&&<output className="flight-guidance-note" data-testid="guidance-flight-note">{s.guidanceHoldReason?"Waiting for thrust":({vertical:"Vertical ascent",pitchover:"Gentle pitch-over",gravityTurn:"Gravity turn",ascent:"Building orbital speed",insert:"Orbit correction",done:"Orbit complete · holding"}[s.guidancePhase]||"Guidance active")}</output>}
      {s?.heat&&g.settings.touchControls==="off"&&<aside className="standalone-heat"><HeatGauge heat={s.heat}/></aside>}
      {s && (
        <div
          className="mobile-flight-summary"
          data-testid="mobile-flight-summary"
        >
          <span>Alt {(s.alt / 1000).toFixed(1)} km</span>
          <span>Speed {Math.round(s.speed)} m/s</span>
          <span>Throttle {Math.round(simRef.current.throttle * 100)}%</span>
        </div>
      )}

      {phase==="flight"&&s&&<CockpitChrome visible menuOpen={cockpitMenu} onMenu={()=>setCockpitMenu(v=>!v)} onMap={()=>input.trigger("map")} onPause={()=>input.trigger("pause")} onInstruments={()=>setShowEngineering(v=>!v)} paused={paused} warp={s.warp} onWarp={action=>input.trigger(action)} altitude={s.alt} speed={s.alt<100000?s.surfSpeed:s.speed} speedLabel={s.alt<100000?"Surface speed":"Orbital speed"}/>}
      <div className="flight-top-console">
      <header className="flight-bar">
        <div className="flight-identity">
          <span className="flight-mission-icon">
            <Rocket size={19} />
          </span>
          <div>
            <strong>{mission.name}</strong>
            <span data-testid="flight-design-name">
              {simRef.current.design.name}
            </span>
          </div>
          {s && (
            <span
              className={`flight-state ${crashed ? "is-danger" : ""}`}
              data-testid="flight-status"
            >
              {paused
                ? "Paused"
                : s.clamped
                  ? "On pad"
                  : s.body === "moon"
                    ? "Moon flight"
                    : s.status === "orbit"
                      ? "In orbit"
                      : s.status === "prelaunch"
                        ? "Prelaunch"
                        : "Flying"}
            </span>
          )}
        </div>
        {phase === "flight" && s && (
          <div className="flight-actions">
            <button
              className="ui-button"
              data-testid="flight-pause-btn"
              onClick={() => setPaused((p) => !p)}
            >
              {paused ? <Play size={15} /> : <Pause size={15} />}{" "}
              {paused ? "Resume" : "Pause"}
            </button>
            <div className="flight-camera-controls">
              <button
                data-testid="camera-chase-btn"
                aria-pressed={cam !== "map"}
                onClick={() => setCam("chase")}
              >
                <Rocket size={15} /> Rocket
              </button>
              <button
                data-testid="camera-map-btn"
                aria-pressed={cam === "map"}
                onClick={() => setCam("map")}
              >
                <Map size={15} /> Orbit map
              </button>
              <select
                aria-label="Camera view"
                data-testid="flight-camera-select"
                value={cam}
                onChange={(e) => {setCam(e.target.value);setCockpitMenu(false);}}
              >
                {CAMS.map((c) => (
                  <option key={c} value={c}>
                    {touchVisible
                      ? {
                          side: "Side",
                          chase: "Rocket",
                          map: "Orbit",
                          free: "Free",
                          cinematic: "Cinema",
                        }[c]
                      : c === "side" ? "Side profile" : c === "chase"
                        ? "Follow rocket"
                        : c === "map"
                          ? "Orbital map"
                          : c === "free"
                            ? "Free camera"
                            : "Cinematic"}
                  </option>
                ))}
              </select>
            </div>
            <button
              className={`ui-button ${showEngineering ? "ui-button-selected" : ""}`}
              aria-pressed={showEngineering}
              data-testid="engineering-toggle-btn"
              onClick={() => setShowEngineering((v) => !v)}
            >
              <SlidersHorizontal size={15} /> Instruments
            </button>
            <button
              className="ui-button"
              data-testid="checkpoints-btn"
              onClick={() => {
                setCks(
                  storage
                    .checkpoints()
                    .filter((c) => c.missionId === mission.id),
                );
                setCkOpen(true);
              }}
            >
              <Save size={15} /> Saves
            </button>
            <button
              className="ui-button flight-end"
              data-testid="end-flight-btn"
              onClick={() => setEndConfirm(true)}
            >
              <Flag size={14} /> Finish
            </button>
          </div>
        )}
        <PhysicsBadge />
        <DisplayButton compact />
      </header>
      {phase === "flight" && s && (
        <div className="flight-context-bar">
          <div className="flight-guidance">
            {simRef.current.guidance && (
              <button
                data-testid="guidance-toggle-btn"
                onClick={() => {
                  const gd = simRef.current.guidance;
                  gd.disengaged = !gd.disengaged;
                }}
              >
                <span
                  className={`guidance-light ${s.guidance ? "is-on" : ""}`}
                />
                {s.guidance ? "Guidance is flying" : "You are flying"}
                <span>{keyLabel(g.settings.bindings.guidance)} to switch</span>
              </button>
            )}
          </div>
          <div className="flight-warp">
            <FastForward size={14} />
            <span>Time speed</span>
            {WARPS.map((w) => (
              <button
                key={w}
                data-testid={`time-warp-${w}`}
                aria-pressed={s.warp === w}
                onClick={() => setWarp(w)}
              >
                ×{w.toLocaleString()}
              </button>
            ))}
          </div>
        </div>
      )}

      </div>
      {phase === "flight" && s && (
        <>
          <div className="flight-instrument-panels">
            <div className="flight-telemetry">
              <TelemetryPanel s={s} detailed={showEngineering} />
            </div>
            <div className="flight-orbit scroll-thin">
              <OrbitPanel s={s} detailed={showEngineering} />
              <div className="mobile-physics-model">
                <PhysicsBadge />
              </div>
              {showEngineering && <SystemsPanel s={s} sim={simRef.current} />}
              {s.crew > 0 && <CrewPanel s={s} sim={simRef.current} />}
              {showEngineering && (
                <AttitudePanel
                  s={s}
                  sim={simRef.current}
                  rcsKey={keyLabel(g.settings.bindings.rcs)}
                />
              )}
            </div>
            {(cam === "map" || s.hasNode) &&
              s.status !== "prelaunch" &&
              !s.clamped && (
                <div className="flight-maneuver">
                  <ManeuverPanel
                    s={s}
                    sim={simRef.current}
                    mission={mission}
                    targetAlt={mission.target.altitude}
                    onWarpTo={() => setWarp(20000)}
                  />
                </div>
              )}
            <div className="flight-propulsion">
              <PropulsionPanel
                s={s}
                stageKey={keyLabel(g.settings.bindings.stage)}
                onStage={stage}
                onThrottle={(value) => {
                  disengage();
                  simRef.current.throttle = value;
                }}
              />
            </div>
            <div className="flight-events">
              <EventLog log={s.log} />
            </div>
          </div>
          <div className="flight-alarms">
            <AlarmPanel
              s={s}
              sim={simRef.current}
              onChange={() =>
                setSnap(snapshot(simRef.current, warpRef.current))
              }
            />
          </div>
          <details className="flight-keyboard-hint">
            <summary>Controls</summary>
            <p>
              {keyLabel(g.settings.bindings.pitchForward)} /{" "}
              {keyLabel(g.settings.bindings.pitchBack)} pitch ·{" "}
              {keyLabel(g.settings.bindings.yawLeft)} /{" "}
              {keyLabel(g.settings.bindings.yawRight)} turn
              <br />
              {keyLabel(g.settings.bindings.throttleUp)} /{" "}
              {keyLabel(g.settings.bindings.throttleDown)} throttle ·{" "}
              {keyLabel(g.settings.bindings.fullThrottle)} full ·{" "}
              {keyLabel(g.settings.bindings.cutThrottle)} cut
              <br />
              {keyLabel(g.settings.bindings.stage)} stage ·{" "}
              {keyLabel(g.settings.bindings.rcs)} RCS ·{" "}
              {keyLabel(g.settings.bindings.pause)} pause
              <br />
              Change keys in Settings → Controls.
            </p>
          </details>
          <TouchFlightControls
            controls={input}
            visible={touchVisible || g.settings.touchControls !== "off"}
            disabled={
              paused || modalOpenRef.current || simRef.current.isEnded()
            }
            settings={g.settings}
            fuel={s.fuel}
            heat={s.heat}
            onThrottle={value=>{disengage();warpRef.current=1;simRef.current.throttle=value;}}
            throttle={simRef.current.throttle}
            rcs={s.rcsEnabled}
            guidance={s.guidance}
            canStage={!!s.nextEvent}
            stageLabel={s.nextEvent}
          />

          {((s.status === "orbit" && !isLunar(mission)) ||
            (mission.kind === "lunar_orbit" &&
              s.lunarOrbitAt &&
              s.body === "moon")) &&
            !crashed && (
              <div
                className="flight-success panel border-emerald-500/50 px-5 py-3 text-center rise"
                data-testid="orbit-achieved-banner"
              >
                <div className="flex items-center justify-center gap-2 font-display text-xl font-bold uppercase tracking-widest text-emerald-400">
                  <CheckCircle2 size={18} />{" "}
                  {s.body === "moon" ? "Lunar orbit" : "Stable orbit"}
                </div>
                <div className="font-mono text-xs text-slate-300">
                  {(s.apo / 1000).toFixed(1)} × {(s.peri / 1000).toFixed(1)} km
                  · i {s.inc.toFixed(2)}°
                </div>
                <button
                  data-testid="complete-mission-btn"
                  onClick={finish}
                  className="mt-2 border border-emerald-500/60 px-4 py-1 font-mono text-xs uppercase tracking-widest text-emerald-300 hover:bg-emerald-500/10"
                >
                  Complete mission → report
                </button>
              </div>
            )}
          {["splashdown", "landed"].includes(s.status) && (
            <div
              className="absolute inset-0 flex items-center justify-center bg-black/40"
              data-testid="splashdown-overlay"
            >
              <div className="panel rounded-sm border-emerald-500/60 p-6 text-center">
                <div className="flex items-center justify-center gap-2 font-display text-3xl font-bold uppercase tracking-widest text-emerald-400">
                  <CheckCircle2 /> {s.status === "landed" ? "Touchdown" : "Splashdown"}
                </div>
                <div className="mt-1 font-mono text-xs text-slate-400">
                  {simRef.current.endReason}
                </div>
                <button
                  data-testid="splashdown-report-btn"
                  onClick={finish}
                  className="mt-4 border border-emerald-500/60 px-4 py-1.5 font-mono text-xs uppercase tracking-widest text-emerald-300 hover:bg-emerald-500/10"
                >
                  View mission report
                </button>
                <div className="flight-end-choices"><button data-testid="end-edit-rocket" onClick={()=>finish("hangar")}>Edit rocket</button><button data-testid="end-retry-launch" onClick={()=>finish("review")}>Retry launch</button></div>
              </div>
            </div>
          )}
          {crashed && (
            <div
              className={`absolute inset-0 flex items-center justify-center bg-black/50 ${s.heat?.failed?"thermal-failure":""}`}
              data-testid="vehicle-lost-overlay"
            >
              <div className="panel rounded-sm border-red-500/60 p-6 text-center">
                <div className="flex items-center justify-center gap-2 font-display text-3xl font-bold uppercase tracking-widest text-red-400">
                  <XCircle /> Vehicle lost
                </div>
                <div className="mt-1 font-mono text-xs text-slate-400">
                  {simRef.current.endReason}
                </div>
                <button
                  data-testid="view-report-btn"
                  onClick={finish}
                  className="mt-4 border border-red-500/60 px-4 py-1.5 font-mono text-xs uppercase tracking-widest text-red-300 hover:bg-red-500/10"
                >
                  View mission report
                </button>
                <div className="flight-end-choices"><button data-testid="end-edit-rocket" onClick={()=>finish("hangar")}>Edit rocket</button><button data-testid="end-retry-launch" onClick={()=>finish("review")}>Retry launch</button></div>
              </div>
            </div>
          )}
        </>
      )}

      <Dialog open={endConfirm} onOpenChange={setEndConfirm}>
        <DialogContent
          className="settings-surface"
          data-testid="finish-flight-dialog"
        >
          <DialogHeader>
            <DialogTitle>Finish this flight?</DialogTitle>
          </DialogHeader>
          <DialogDescription className="ui-help">
            Your flight is paused. Finish to see the mission report, or keep
            flying to continue your mission.
          </DialogDescription>
          <div className="flex gap-3">
            <button
              className="ui-button"
              data-testid="keep-flying-btn"
              onClick={() => setEndConfirm(false)}
            >
              Keep flying
            </button>
            <button
              className="ui-button ui-button-primary"
              data-testid="confirm-finish-btn"
              onClick={finish}
            >
              Finish & view report
            </button>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog open={ckOpen} onOpenChange={setCkOpen}>
        <DialogContent
          className="dark max-w-xl border-slate-800 bg-slate-950 text-slate-100"
          data-testid="checkpoint-dialog"
        >
          <DialogHeader>
            <DialogTitle className="font-display">Flight saves</DialogTitle>
            <DialogDescription>
              Save this moment or return to an earlier checkpoint. The flight is
              paused while you choose.
            </DialogDescription>
          </DialogHeader>
          <CheckpointList
            list={cks}
            onSave={
              phase === "flight"
                ? () => {
                    saveCheckpoint("Manual", false);
                    setCks(
                      storage
                        .checkpoints()
                        .filter((c) => c.missionId === mission.id),
                    );
                  }
                : null
            }
            onRestore={restoreCheckpoint}
            onDelete={(id) => {
              storage.deleteCheckpoint(id);
              setCks(
                storage.checkpoints().filter((c) => c.missionId === mission.id),
              );
            }}
          />
        </DialogContent>
      </Dialog>

      {phase === "checklist" && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/40 p-6">
          <div
            className="launch-checklist panel grid w-full max-w-4xl grid-cols-2 gap-8 p-6 rise"
            data-testid="launch-checklist"
          >
            <div>
              <div className="eyebrow text-cyan-400">Launch checklist</div>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight">
                Ready for liftoff?
              </h1>
              <p className="mt-3 text-sm text-slate-400">
                {g.design.name} ·{" "}
                {LAUNCH_SITES[mission.site].name.replace(" (approx.)", "")}
              </p>
              <ul className="mt-4 space-y-2 text-sm">
                <li
                  className="flex items-center gap-2"
                  data-testid="checklist-readiness"
                >
                  {review.overall === "NO-GO" ? (
                    <AlertTriangle size={15} className="text-red-400" />
                  ) : (
                    <CheckCircle2 size={15} className="text-emerald-400" />
                  )}{" "}
                  Readiness review{" "}
                  <span className="ml-auto">
                    <GoNoGo
                      overall={review.overall}
                      testId="checklist-go-nogo"
                    />
                  </span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 size={15} className="text-emerald-400" />{" "}
                  Propellant loaded — {(review.stats.mass / 1000).toFixed(1)} t
                  on the pad
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 size={15} className="text-emerald-400" /> Flight
                  mode — {guidanceOn ? "Guidance computer" : "Manual"}
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 size={15} className="text-emerald-400" /> Launch
                  range ready
                </li>
              </ul>
              <div className="mt-6 flex gap-2">
                <button
                  data-testid="start-countdown-btn"
                  onClick={() => {
                    setCount(10);
                    setHold(false);
                    setPhase("countdown");
                  }}
                  className="ui-button ui-button-primary"
                >
                  Start countdown
                </button>
                <button
                  data-testid="checklist-back-btn"
                  onClick={() => g.go("review")}
                  className="border border-slate-700 px-4 py-2.5 font-mono text-xs uppercase tracking-widest text-slate-400 hover:text-white"
                >
                  Back to review
                </button>
              </div>
            </div>
            <GuidancePanel
              profile={g.profile}
              setProfile={g.setProfile}
              enabled={guidanceOn}
              setEnabled={setGuidanceOn}
            />
          </div>
        </div>
      )}

      {phase === "countdown" && (
        <div
          className="absolute inset-0 flex flex-col items-center justify-center bg-black/30"
          data-testid="countdown-overlay"
        >
          <div className="eyebrow">
            Terminal count{" "}
            {hold && <span className="text-amber-400">· HOLD</span>}
          </div>
          <div
            className="font-mono text-8xl font-bold text-white"
            data-testid="countdown-value"
          >
            {fmtT(-count)}
          </div>
          <div className="mt-6 flex gap-2">
            <button
              data-testid="countdown-hold-btn"
              onClick={() => setHold(!hold)}
              className="flex items-center gap-2 border border-amber-500/60 px-4 py-2 font-mono text-xs uppercase tracking-widest text-amber-300"
            >
              {hold ? <Play size={13} /> : <Pause size={13} />}{" "}
              {hold ? "Resume" : "Hold"}
            </button>
            <button
              data-testid="countdown-scrub-btn"
              onClick={() => setPhase("checklist")}
              className="flex items-center gap-2 border border-red-500/60 px-4 py-2 font-mono text-xs uppercase tracking-widest text-red-300"
            >
              <X size={13} /> Scrub
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
