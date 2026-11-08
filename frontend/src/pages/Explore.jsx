import {CockpitChrome} from "../components/game/CockpitChrome";
import { localData } from "../persistence/localData";
import { InstrumentShelf } from "../components/sandbox/InstrumentShelf";
import { EncounterPlanner } from "../components/sandbox/EncounterPlanner";
import { AerobrakingPanel } from "../components/sandbox/AerobrakingPanel";
import { loadWeatherModel } from "../sim/advanced/weatherAtmosphere";
import { ControlRecorder } from "../components/sandbox/ControlRecorder";
import { FlightAutomation } from "../components/sandbox/FlightAutomation";
import { FlightGraphs } from "../components/sandbox/FlightGraphs";
import { FleetWorld } from "../sim/advanced/fleetWorld";
import { FleetPanel } from "../components/sandbox/FleetPanel";
import { PhysicsSettings } from "../components/sandbox/PhysicsSettings";
import { AttitudeSphere } from "../components/instruments/AttitudeSphere";
import { PhysicsBadge } from "../components/instruments/PhysicsBadge";
import { ExplorationEngineering } from "../components/instruments/EngineeringInspector";
import { OrbitalElements } from "../components/instruments/OrbitalElements";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  Compass,
  Globe2,
  Map,
  Orbit,
  Pause,
  Play,
  Save,
  Rocket,
  Download,
  Upload,
} from "lucide-react";
import { toast } from "sonner";
import {
  useFlightInput,
  useTouchControlsVisible,
} from "../input/useFlightInput";
import { keyLabel, steeringAxes } from "../input/bindings";
import { TouchFlightControls } from "../components/game/TouchFlightControls";
import { DisplayButton } from "../components/app/Appearance";
import { useGame } from "../game/GameContext";
import { PLANETS, MOONS, BODY_BY_ID, AU, DAY } from "../sim/solarSystem";
import { ExplorationSim, EXPLORERS, FLIGHT_MODES } from "../sim/exploration";
import { ExplorationTransfer } from "../components/game/ExplorationTransfer";
import { BodyScience } from "../components/science/BodyScience";
import { ExplorationView } from "../three/ExplorationView";
import { downloadJSON, readJSONFile } from "../sim/storage";

const SAVE_KEY = "mf.exploration";
const WARPS = [1, 10, 100, 1000, 10000, 100000, 1000000];
const labels = {
  prograde: "Prograde +",
  retrograde: "Retrograde −",
  radialOut: "Radial +",
  radialIn: "Radial −",
  normal: "Normal +",
  antinormal: "Normal −",
};
const number = (n, d = 1) =>
  Number.isFinite(n)
    ? n.toLocaleString("en-US", { maximumFractionDigits: d })
    : "Escape";
const distance = (n) =>
  Math.abs(n) > AU * 0.1 ? `${number(n / AU, 3)} AU` : `${number(n / 1000)} km`;
const readSave = () => {
  try {
    const value = localData.getItem(SAVE_KEY);
    return value ? ExplorationSim.restore(JSON.parse(value)) : null;
  } catch {
    return null;
  }
};

function SystemMap({ sim, selected, onSelect, scope, onScope }) {
  const parent =
    selected.parent !== "sun" && selected.parent
      ? BODY_BY_ID[selected.parent]
      : null;
  const center = scope === "moons" && parent ? parent : BODY_BY_ID.sun;
  const satellites =
    center.id === "sun" ? PLANETS : MOONS.filter((b) => b.parent === center.id);
  const extent =
    scope === "inner"
      ? 1.9 * AU
      : center.id === "sun"
        ? Math.max(34 * AU, ...PLANETS.map((b) => b.a * 1.2))
        : Math.max(...satellites.map((b) => b.a)) * 1.35;
  const origin = sim.state(center.id, sim.t).r;
  const project = (r) => [
    450 + ((r[0] - origin[0]) / extent) * 390,
    340 - ((r[1] - origin[1]) / extent) * 280,
  ];
  const vessel = project(sim.r);
  return (
    <div className="absolute inset-0 bg-[#030711]" data-testid="solar-map">
      <div className="absolute left-6 top-5 z-10 flex gap-1">
        {[
          ["inner", "Inner system"],
          ["system", "Solar system"],
          ...(parent ? [["moons", `${parent.name} moons`]] : []),
        ].map(([id, label]) => (
          <button
            key={id}
            onClick={() => onScope(id)}
            className={`explore-chip ${scope === id ? "active" : ""}`}
          >
            {label}
          </button>
        ))}
      </div>
      <svg
        viewBox="0 0 900 680"
        className="h-full w-full"
        aria-label="Interactive solar system map"
      >
        <defs>
          <radialGradient id="sun-glow">
            <stop stopColor="#ffc65b" stopOpacity=".3" />
            <stop offset="1" stopColor="#ffc65b" stopOpacity="0" />
          </radialGradient>
          <pattern
            id="space-grid"
            width="45"
            height="45"
            patternUnits="userSpaceOnUse"
          >
            <path
              d="M45 0H0V45"
              fill="none"
              stroke="#192333"
              strokeWidth=".5"
            />
          </pattern>
        </defs>
        <rect width="900" height="680" fill="url(#space-grid)" />
        <circle cx="450" cy="340" r="85" fill="url(#sun-glow)" />
        <circle
          cx="450"
          cy="340"
          r={center.id === "sun" ? 9 : 15}
          fill={center.color}
        />
        <text x="450" y="370" textAnchor="middle" fill="#8b9ab0" fontSize="11">
          {center.name.toUpperCase()}
        </text>
        {satellites.map((b) => {
          const [x, y] = project(sim.state(b.id, sim.t).r);
          const rx = (b.a / extent) * 390,
            ry = (b.a / extent) * 280;
          return (
            <g key={b.id}>
              <ellipse
                cx="450"
                cy="340"
                rx={rx}
                ry={ry}
                fill="none"
                stroke={b.id === selected.id ? "#647b99" : "#243147"}
                strokeDasharray={b.id === selected.id ? undefined : "3 5"}
              />
              <g
                role="button"
                tabIndex="0"
                aria-label={`Select ${b.name}`}
                onClick={() => onSelect(b.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onSelect(b.id);
                  }
                }}
                className="cursor-pointer"
              >
                <circle cx={x} cy={y} r="22" fill="transparent" />
                {b.id === selected.id && (
                  <circle
                    cx={x}
                    cy={y}
                    r="14"
                    fill="none"
                    stroke={b.color}
                    strokeOpacity=".6"
                  />
                )}
                <circle
                  cx={x}
                  cy={y}
                  r={b.radius > 20000000 ? 7 : 4}
                  fill={b.color}
                />
                <text
                  x={x + 13}
                  y={y + 4}
                  fill={b.id === selected.id ? "#f1f5f9" : "#8495ae"}
                  fontSize="11"
                >
                  {b.name}
                </text>
              </g>
            </g>
          );
        })}
        {vessel.every(Number.isFinite) &&
          Math.abs(vessel[0] - 450) < 450 &&
          Math.abs(vessel[1] - 340) < 330 && (
            <g transform={`translate(${vessel[0]},${vessel[1]})`}>
              <circle
                r="16"
                fill="none"
                stroke="#67e8f9"
                strokeDasharray="2 3"
              />
              <path d="M0 -7L5 5L0 2L-5 5Z" fill="#67e8f9" />
              <text x="18" y="-14" fill="#67e8f9" fontSize="10">
                {sim.craft.name}
              </text>
            </g>
          )}
        <text x="30" y="650" fill="#64748b" fontSize="10">
          ECLIPTIC PROJECTION · ORBIT GUIDES SHOW MEAN DISTANCE · BODY SIZES
          ENLARGED
        </text>
      </svg>
    </div>
  );
}

export default function Explore() {
  const g = useGame();
  const simRef = useRef(null);
  if (!simRef.current) simRef.current = readSave() || new ExplorationSim();
  const fleetRef = useRef(null);
  if (!fleetRef.current) {
    try {
      const saved = JSON.parse(localData.getItem("mf.fleet-world"));
      fleetRef.current = saved
        ? FleetWorld.restore(saved)
        : new FleetWorld(simRef.current);
    } catch {
      fleetRef.current = new FleetWorld(simRef.current);
    }
    simRef.current = fleetRef.current.active;
  }
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (
      fleetRef.current.entries.some((e) => e.sim.physics.atmosphere === "msis")
    )
      loadWeatherModel()
        .then(() => setTick((n) => n + 1))
        .catch((error) => toast.error(error.message));
  }, []);
  const [cockpitMenu,setCockpitMenu]=useState(false);
  const [view, setView] = useState("orbit");
  const [scope, setScope] = useState("inner");
  const [search, setSearch] = useState("");
  const [instrumentTab, setInstrumentTab] = useState("flight");
  const [selectedId, setSelectedId] = useState(
    simRef.current.primary === "sun" ? "earth" : simRef.current.primary,
  );
  const [craftId, setCraftId] = useState(simRef.current.craft.id);
  const [paused, setPaused] = useState(true);
  const [warp, setWarp] = useState(1);
  const [help, setHelp] = useState(false);
  const [mobilePanel, setMobilePanel] = useState(false);
  const [effectiveWarp, setEffectiveWarp] = useState(0);
  const touchVisible = useTouchControlsVisible(g.settings.touchControls);
  const input = useFlightInput({
    settings: g.settings,
    bindings: g.settings.bindings,
    onMenu: () => g.setSettingsOpen(true),
    enabled:
      !g.overlayOpen &&
      !g.settingsOpen &&
      !help &&
      (simRef.current.status === "flying" || fleetRef.current.hasMeshDebris),
    moving: !paused,
    onManual: () => {
      simRef.current.cancelTransfer();
      setWarp(1);
    },
    onAction: (action) => {
      const sim = simRef.current;
      if (action === "pause") {
        setPaused((p) => !p);
        return;
      }
      if (action === "cutThrottle") {
        sim.cancelTransfer("Engine cutoff");
        sim.throttle = 0;
        return;
      }
      if (action === "map") {
        setView((v) => (v === "system" ? "orbit" : "system"));
        return;
      }
      if (action === "camera") {
        setView(
          (v) =>
            ["craft", "fleet", "orbit", "system"][
              (["craft", "fleet", "orbit", "system"].indexOf(v) + 1) % 4
            ],
        );
        return;
      }
      if (action === "warpUp" || action === "warpDown") {
        if (sim.throttle > 0 && sim.fuel > 0) {
          setWarp(1);
          return;
        }
        setWarp(
          (w) =>
            WARPS[
              Math.max(
                0,
                Math.min(
                  WARPS.length - 1,
                  WARPS.indexOf(w) + (action === "warpUp" ? 1 : -1),
                ),
              )
            ],
        );
        return;
      }
      if (paused || sim.status !== "flying") return;
      if (["fullThrottle", "rcs"].includes(action)) sim.cancelTransfer();
      if (action === "fullThrottle") {
        sim.throttle = 1;
        setWarp(1);
      } else if (action === "rcs") sim.toggleRcs();
    },
  });
  const inputRef = useRef(input);
  inputRef.current = input;
  const control = useRef({ paused: true, warp: 1, sensitivity: 1 });
  control.current.paused = paused || g.settingsOpen || help || g.overlayOpen;
  control.current.warp = warp;
  control.current.sensitivity = g.settings.steeringSensitivity;
  const fileInput = useRef(null);
  const save = useCallback(async (notify = false) => {
    try {
      fleetRef.current.replaceActive(simRef.current);
      localData.setItem(
        "mf.fleet-world",
        JSON.stringify(fleetRef.current.serialize()),
      );
      localData.setItem(SAVE_KEY, JSON.stringify(simRef.current.serialize()));
      await localData.flush();
      if (notify) toast.success("Expedition saved to this browser");
    } catch {
      if (notify) toast.error("Could not save: browser storage is full");
    }
  }, []);
  useEffect(() => {
    let raf,
      last = performance.now(),
      ui = 0,
      saveTime = 0;
    const frame = (now) => {
      const dt = Math.min((now - last) / 1000, 0.1);
      last = now;
      const sim = simRef.current,
        c = control.current;
      let advanced = 0;
      fleetRef.current.replaceActive(sim);
      if (
        !c.paused &&
        (sim.status === "flying" || fleetRef.current.hasMeshDebris)
      ) {
        const controls = inputRef.current;
        const axes = steeringAxes(controls.active);
        if (sim.rcsEnabled) {
          sim.pitch = Math.max(
            -90,
            Math.min(90, sim.pitch + axes.pitch * dt * 25 * c.sensitivity),
          );
          sim.yaw =
            ((sim.yaw + axes.yaw * dt * 25 * c.sensitivity + 540) % 360) - 180;
        }
        if (controls.active("throttleUp"))
          sim.throttle = Math.min(1, sim.throttle + dt * 0.4);
        if (controls.active("throttleDown"))
          sim.throttle = Math.max(0, sim.throttle - dt * 0.4);
        const burning = sim.throttle > 0 && sim.fuel > 0;
        const started = performance.now();
        try {
          advanced = fleetRef.current.advance(
            dt * (burning || sim.rendezvous ? 1 : c.warp),
          );
        } catch (error) {
          sim.cancelTransfer("Physics error");
          sim.throttle = 0;
          setPaused(true);
          toast.error(error.message);
        }
        sim.lastPhysicsMs = performance.now() - started;
        if (sim.transfer?.phase === "ready") setPaused(true);
        if (fleetRef.current.approachReady) {
          c.paused = true;
          c.warp = 1;
          setPaused(true);
          setWarp(1);
          fleetRef.current.approachReady = null;
        }
      }
      if (c.paused) fleetRef.current.syncOthers();
      ui += dt;
      saveTime += dt;
      if (ui >= 0.15) {
        setTick((n) => n + 1);
        setEffectiveWarp(dt > 0 ? advanced / dt : 0);
        ui = 0;
      }
      if (saveTime >= 30) {
        save();
        saveTime = 0;
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    const hidden = () => {
      if (document.hidden) {
        setPaused(true);
        save();
      }
    };
    document.addEventListener("visibilitychange", hidden);
    return () => {
      cancelAnimationFrame(raf);
      save();
      document.removeEventListener("visibilitychange", hidden);
    };
  }, [save]);
  const sim = simRef.current,
    nav = sim.navigation(),
    selected = BODY_BY_ID[selectedId];
  const select = (id) => {
    const b = BODY_BY_ID[id];
    setSelectedId(id);
    setScope(b.parent !== "sun" ? "moons" : b.a > 2 * AU ? "system" : "inner");
  };
  const start = () => {
    if (
      fleetRef.current.links.some((l) => l.includes(fleetRef.current.activeId))
    ) {
      toast.error("Undock before placing a new orbit.");
      return;
    }
    simRef.current = new ExplorationSim(
      selectedId,
      craftId,
      sim.t,
      undefined,
      craftId === "hangar"
        ? { hangarDesign: sim.baseCraft.design, power: true }
        : {},
    );
    input.clear();
    setPaused(true);
    setWarp(1);
    setView("orbit");
    save();
    setTick((n) => n + 1);
    toast.success(
      `New expedition in ${selected.name} orbit — press Play when ready`,
    );
  };
  const setMode = (m) => {
    sim.cancelTransfer("Burn direction changed");
    sim.mode = m;
    sim.pitch = 0;
    sim.yaw = 0;
    setTick((n) => n + 1);
  };
  const importSave = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      if (file.size > 256000) throw new Error("Save is too large");
      const data = await readJSONFile(file);
      const world = Array.isArray(data.entries)
        ? FleetWorld.restore(data)
        : new FleetWorld(ExplorationSim.restore(data));
      fleetRef.current = world;
      simRef.current = world.active;
      setSelectedId(world.active.primary);
      setCraftId(world.active.craft.id);
      input.clear();
      setPaused(true);
      setWarp(1);
      setTick((n) => n + 1);
      save();
      toast.success("Expedition restored — engines off");
    } catch {
      toast.error("That file is not a valid expedition save");
    }
  };
  const flightFooter=(
      <footer className="explore-footer">
        <button
          data-testid="explore-play"
          disabled={sim.status !== "flying" && !fleetRef.current.hasMeshDebris}
          onClick={() => setPaused((p) => !p)}
          className="flex items-center gap-2 text-xs text-cyan-200 disabled:opacity-40"
        >
          {paused ? <Play size={15} /> : <Pause size={15} />}
          {paused ? "Play" : "Pause"}
        </button>
        <span className="mx-3 h-5 w-px bg-slate-800" />
        <div className="flex flex-wrap gap-1">
          {WARPS.map((w) => (
            <button
              data-testid={`explore-warp-${w}`}
              key={w}
              disabled={sim.throttle > 0 && sim.fuel > 0 && w > 1}
              className={`explore-warp ${warp === w ? "active" : ""}`}
              onClick={() => setWarp(w)}
            >
              ×{number(w, 0)}
            </button>
          ))}
        </div>
        <span className="ml-auto hidden font-mono text-[10px] text-slate-500 xl:block">
          {sim.throttle > 0 && sim.fuel > 0
            ? "POWERED FLIGHT · ×1"
            : `${number(effectiveWarp, 0)}× ACTUAL · COAST`}{" "}
          / {sim.visited.length} REGIONS VISITED
        </span>
      </footer>
  );
  return (
    <div
      onClickCapture={(e) => {
        if (e.detail > 0) e.target.closest?.("button")?.blur();
        if(e.target.closest?.(".explore-header button,.explore-footer button"))setCockpitMenu(false);
      }}
      data-steering={g.settings.steeringSide}
      data-cockpit-menu={cockpitMenu?"open":"closed"}
      data-touch={touchVisible ? "on" : "off"}
      data-panel={mobilePanel ? "open" : "closed"}
      className="explore-workspace"
      data-testid="explore-workspace"
      data-frame={tick}
    >
      <CockpitChrome visible={touchVisible} menuOpen={cockpitMenu} onMenu={()=>setCockpitMenu(v=>!v)} onMap={()=>setView(v=>v==="craft"?"orbit":"craft")} onPause={()=>input.trigger("pause")} onInstruments={()=>setMobilePanel(v=>!v)} paused={paused} warp={Math.max(1,Math.round(paused?warp:effectiveWarp||warp))} onWarp={action=>input.trigger(action)} altitude={nav.altitude} speed={nav.speed} exploration/>
      <div className="explore-top-console">
      <header className="explore-header">
        <button
          className="explore-icon"
          aria-label="Back to menu"
          data-testid="explore-back"
          onClick={() => {
            save();
            g.go("menu");
          }}
        >
          <ArrowLeft size={17} />
        </button>
        <div>
          <div className="eyebrow text-cyan-300">
            MissionForge / Exploration
          </div>
          <div className="mt-1 text-sm font-medium">
            The solar system is your flight plan.
          </div>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <span className="mr-3 hidden font-mono text-xs text-slate-400 lg:block">
            J2000 + {number(sim.t / DAY, 3)} days
          </span>
          <DisplayButton compact />
          <button className="explore-chip" onClick={() => setHelp((h) => !h)}>
            Flight guide
          </button>
          <button
            className="explore-chip"
            data-testid="explore-save"
            onClick={() => save(true)}
          >
            <Save size={13} /> Save
          </button>
          <button
            className="explore-icon"
            title="Export expedition"
            aria-label="Export expedition"
            onClick={() =>
              downloadJSON("expedition.mfspace.json", sim.serialize())
            }
          >
            <Download size={15} />
          </button>
          <button
            className="explore-icon"
            title="Import expedition"
            aria-label="Import expedition"
            onClick={() => fileInput.current.click()}
          >
            <Upload size={15} />
          </button>
          <input
            ref={fileInput}
            type="file"
            accept=".json"
            onChange={importSave}
            className="hidden"
          />
        </div>
      </header>
      {touchVisible&&flightFooter}
      </div>
      <aside className="explore-destinations">
        <div className="px-5 pb-3 pt-5">
          <div className="eyebrow text-slate-500">DESTINATIONS</div>
          <h2 className="mt-1 font-display text-2xl uppercase">Beyond Earth</h2>
          <p className="mt-2 text-xs leading-relaxed text-slate-500">
            {PLANETS.length} planets. {MOONS.length} moons.
            <br />
            One continuous flight space.
          </p>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-3 scroll-thin">
          <label className="destination-search">
            Find a world
            <input
              type="search"
              aria-label="Search destinations"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>
          {PLANETS.filter(
            (b) =>
              !search ||
              b.name.toLowerCase().includes(search.toLowerCase()) ||
              MOONS.some(
                (m) =>
                  m.parent === b.id &&
                  m.name.toLowerCase().includes(search.toLowerCase()),
              ),
          ).map((b, index) => (
            <div key={b.id}>
              <button
                data-testid={`destination-${b.id}`}
                className={`destination-row ${selectedId === b.id ? "selected" : ""}`}
                onClick={() => select(b.id)}
              >
                <span
                  className="destination-globe"
                  style={{ "--body-color": b.color }}
                />
                <span className="flex-1">
                  <span className="block text-sm">{b.name}</span>
                  <span className="block font-mono text-[9px] text-slate-500">
                    {number(b.a / AU, 2)} AU / {b.gas ? "GIANT" : "TERRESTRIAL"}
                  </span>
                </span>
                <span className="font-mono text-[10px] text-slate-600">
                  0{index + 1}
                </span>
              </button>
              {MOONS.filter((m) => m.parent === b.id).map((m) => (
                <button
                  data-testid={`destination-${m.id}`}
                  key={m.id}
                  className={`destination-row moon ${selectedId === m.id ? "selected" : ""}`}
                  onClick={() => select(m.id)}
                >
                  <span className="h-1 w-1 rounded-full bg-slate-500" />
                  <span className="flex-1 text-xs">{m.name}</span>
                  <span className="font-mono text-[9px] text-slate-600">
                    MOON
                  </span>
                </button>
              ))}
            </div>
          ))}
        </div>
        <div className="border-t border-slate-800 p-5">
          <div className="eyebrow mb-2 text-cyan-300">EXPEDITION LOG</div>
          <div className="space-y-2 text-[10px] leading-relaxed text-slate-400">
            {sim.log.slice(-3).map((e, i) => (
              <div key={i}>
                <span className="font-mono text-slate-600">
                  D+{number(e.t / DAY, 2)}{" "}
                </span>
                {e.text}
              </div>
            ))}
          </div>
        </div>
      </aside>
      <main className="explore-scene">
        <ExplorationView
          fleetRef={fleetRef}
          active={view !== "system"}
          simRef={simRef}
          overview={view === "orbit"}
          formation={view === "fleet"}
          quality={g.settings.graphics}
          reduceMotion={g.settings.reduceMotion}
        />
        {view === "system" && (
          <SystemMap
            sim={sim}
            selected={selected}
            onSelect={select}
            scope={scope}
            onScope={setScope}
          />
        )}
        {view !== "system" && (
          <div className="pointer-events-none absolute left-6 top-6">
            <div className="eyebrow text-cyan-400">
              {view === "orbit"
                ? "ORBITAL VIEW"
                : view === "fleet"
                  ? "RENDEZVOUS CAMERA"
                  : "FLIGHT CAMERA"}
            </div>
            <h1 className="mt-1 font-display text-4xl uppercase tracking-wide">
              {nav.body.name}
            </h1>
            <p className="mt-1 font-mono text-[10px] text-slate-500">
              {view === "orbit"
                ? "DRAG TO ORBIT · PINCH / SCROLL TO ZOOM"
                : `${keyLabel(g.settings.bindings.pitchForward)} / ${keyLabel(g.settings.bindings.pitchBack)} pitch · ${keyLabel(g.settings.bindings.yawLeft)} / ${keyLabel(g.settings.bindings.yawRight)} turn`}
            </p>
            {view === "orbit" && (
              <p className="orbit-legend">
                <span>Pe · lowest point</span>
                <span>Ap · highest point</span>
                <small>
                  Markers appear on eccentric, closed orbits. Craft enlarged for
                  visibility.
                </small>
              </p>
            )}
          </div>
        )}
        <div className="explore-view-tabs absolute bottom-5 left-1/2 flex -translate-x-1/2 gap-1 rounded-full border border-slate-700/60 bg-slate-950/90 p-1.5 backdrop-blur-xl">
          {[
            ["craft", Rocket, "Craft"],
            ["fleet", Rocket, "Fleet"],
            ["orbit", Orbit, "Orbit"],
            ["system", Map, "System"],
          ].map(([id, Icon, label]) => (
            <button
              key={id}
              data-testid={`explore-view-${id}`}
              onClick={() => setView(id)}
              className={`explore-chip rounded-full ${view === id ? "active" : ""}`}
            >
              <Icon size={13} />
              {label}
            </button>
          ))}
        </div>
        {paused && sim.status === "flying" && (
          <span className="explore-paused absolute right-5 top-5 rounded-full border border-amber-300/20 bg-amber-300/5 px-3 py-1 font-mono text-[10px] tracking-widest text-amber-200">
            PAUSED
          </span>
        )}
        {sim.status !== "flying" && (
          <div
            className="absolute inset-x-6 top-20 rounded-xl border border-slate-700 bg-slate-950/90 p-5 text-center"
            data-testid="exploration-outcome"
          >
            <h2
              className={`font-display text-3xl uppercase ${sim.status === "landed" ? "text-emerald-300" : "text-amber-300"}`}
            >
              {sim.status === "landed" ? "Touchdown" : "Vehicle lost"}
            </h2>
            <p className="mt-2 text-sm text-slate-400">
              {sim.log.at(-1)?.text}. Start a new expedition from the
              destination panel.
            </p>
          </div>
        )}
        {help && (
          <div
            className="absolute left-5 right-5 top-24 z-20 max-w-lg rounded-xl border border-slate-700 bg-slate-950/95 p-6 shadow-2xl"
            data-testid="explore-guide"
          >
            <div className="flex justify-between">
              <h2 className="font-display text-2xl uppercase">
                Your first expedition
              </h2>
              <button
                onClick={() => setHelp(false)}
                className="text-xs text-cyan-300"
              >
                Close
              </button>
            </div>
            <ol className="mt-4 list-decimal space-y-3 pl-5 text-sm leading-relaxed text-slate-300">
              <li>
                Start in a circular orbit. Press Play, choose Prograde, and
                gently raise the throttle to lift your apoapsis.
              </li>
              <li>
                Cut the engine with {keyLabel(g.settings.bindings.cutThrottle)}{" "}
                or the Cut button. Coast to apoapsis, then burn prograde to lift
                periapsis. Retrograde lowers the orbit.
              </li>
              <li>
                Time warp works while coasting. Burns always run at real time.{" "}
                {keyLabel(g.settings.bindings.pause)} pauses;{" "}
                {keyLabel(g.settings.bindings.map)} opens the system map.
              </li>
              <li>
                The steering arrows or your configured steering keys offset the
                burn direction. Reset trim before a precise burn.
              </li>
              <li>
                RCS off holds the burn direction. Turn it on before steering.
                Exploration uses ideal attitude control without separate RCS
                fuel.
              </li>
              <li>
                Save an expedition before a risky maneuver. Starting an orbit at
                another destination replaces your current expedition and refills
                the selected craft.
              </li>
            </ol>
            <p className="mt-4 text-[11px] leading-relaxed text-slate-500">
              Sandbox model: patched-conic exploration with selectable
              ephemerides, gravity and integration models. Systems includes
              optional thermal damage; Fleet offers rendezvous and docking; Plan
              provides transfer assistance. Terrain is not simulated. Use scored
              missions for detailed ascent, crew and re-entry objectives.
            </p>
          </div>
        )}
      </main>
      <aside
        id="exploration-instruments"
        className="explore-inspector scroll-thin"
        aria-label="Expedition instruments"
      >
        <label className="explore-mobile-destination">
          Choose a destination
          <select
            data-testid="explore-destination-select"
            aria-label="Exploration destination"
            value={selectedId}
            onChange={(e) => select(e.target.value)}
          >
            {[...PLANETS, ...MOONS].map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
                {b.parent !== "sun" ? ` · ${BODY_BY_ID[b.parent].name}` : ""}
              </option>
            ))}
          </select>
        </label>
        <div className="border-b border-slate-800 p-5">
          <div className="flex items-center gap-2 text-cyan-300">
            <Compass size={15} />
            <span className="eyebrow">Your spacecraft</span>
          </div>
          <h2 className="mt-3 text-xl font-medium">{sim.craft.name}</h2>
          <div className="mt-1 text-xs text-slate-500">{sim.craft.role}</div>
          <div className="mt-5 grid grid-cols-2 gap-4">
            <Metric
              label="Altitude"
              value={distance(nav.altitude)}
              testId="explore-altitude"
            />
            <Metric label="Orbital speed" value={`${number(nav.speed)} m/s`} />
            <Metric
              label="Farthest point (Ap)"
              value={distance(nav.el.apoapsis)}
              testId="explore-apoapsis"
            />
            <Metric
              label="Closest point (Pe)"
              value={distance(nav.el.periapsis)}
            />
            <Metric
              label="Vertical speed"
              value={`${number(nav.vertical)} m/s`}
            />
            <Metric
              label="Burn capacity (Δv)"
              value={`${number(nav.deltaV, 0)} m/s`}
            />
          </div>
        </div>
        <PhysicsBadge
          exploration
          drag={sim.dragEnabled}
          options={sim.physics}
        />
        <InstrumentShelf
          tab={instrumentTab}
          onTab={setInstrumentTab}
          panels={{
            flight: (
              <>
                <ExplorationEngineering sim={sim} nav={nav} />
                <OrbitalElements nav={nav} />
                <AttitudeSphere
                  nav={nav}
                  onMode={(mode) => {
                    sim.cancelTransfer("Pilot selected attitude hold");
                    sim.mode = mode;
                    sim.pitch = sim.yaw = 0;
                    if (!sim.rcsEnabled) sim.toggleRcs();
                    setTick((n) => n + 1);
                  }}
                />
                <FlightGraphs sim={sim} />
              </>
            ),
            plan: (
              <>
                <ExplorationTransfer
                  sim={sim}
                  nav={nav}
                  onStart={(altitude) => {
                    sim.startTransfer(altitude);
                    input.clear();
                    setWarp(1);
                    setPaused(false);
                    setTick((n) => n + 1);
                  }}
                  onCircularize={() => {
                    try {
                      sim.circularizeTransfer();
                      setWarp(1);
                      setPaused(false);
                      setTick((n) => n + 1);
                    } catch (e) {
                      toast.error(e.message);
                    }
                  }}
                  onCancel={() => {
                    sim.cancelTransfer("Pilot cancelled");
                    setTick((n) => n + 1);
                  }}
                />

                <EncounterPlanner sim={sim} selectedId={selectedId} />
                <AerobrakingPanel sim={sim} />
              </>
            ),
            systems: (
              <>
                <PhysicsSettings
                  sim={sim}
                  onDrag={(enabled) => {
                    sim.cancelTransfer("Drag model changed");
                    sim.dragEnabled = enabled;
                    setTick((n) => n + 1);
                  }}
                  onChange={(options) => {
                    sim.setPhysics(options);
                    setTick((n) => n + 1);
                  }}
                />
                <FlightAutomation
                  sim={sim}
                  onChange={() => {
                    setWarp(1);
                    setTick((n) => n + 1);
                  }}
                />
                <ControlRecorder
                  sim={sim}
                  world={fleetRef.current}
                  onChange={() => setTick((n) => n + 1)}
                />
              </>
            ),
            fleet: (
              <>
                <FleetPanel
                  world={fleetRef.current}
                  onSwitch={(id) => {
                    simRef.current = fleetRef.current.switchTo(id);
                    setWarp(1);
                    setSelectedId(simRef.current.primary);
                    setCraftId(simRef.current.craft.id);
                    setPaused(true);
                    input.clear();
                  }}
                  onCreate={(craft) => {
                    const entry = fleetRef.current.create(craft);
                    setPaused(true);
                    setWarp(1);
                    setTick((n) => n + 1);
                    return entry;
                  }}
                  onUpdate={() => {
                    setWarp(1);
                    setTick((n) => n + 1);
                    save();
                  }}
                />
              </>
            ),
          }}
        />
        <div className="border-b border-slate-800 p-5">
          <div className="eyebrow mb-3 text-slate-500">
            Burn direction · {nav.body.name}
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            {FLIGHT_MODES.map((m) => (
              <button
                data-testid={`explore-mode-${m}`}
                key={m}
                onClick={() => setMode(m)}
                className={`explore-chip justify-center ${sim.mode === m ? "active" : ""}`}
              >
                {labels[m]}
              </button>
            ))}
          </div>
          <div className="mt-3 flex items-center justify-between font-mono text-[10px] text-slate-400">
            <span>
              Trim {number(sim.pitch, 0)}° / {number(sim.yaw, 0)}°
            </span>
            <button
              className="text-cyan-300"
              onClick={() => {
                sim.cancelTransfer("Attitude trim changed");
                sim.pitch = sim.yaw = 0;
                setTick((n) => n + 1);
              }}
            >
              Reset
            </button>
          </div>
          <label
            className="mt-5 flex justify-between font-mono text-[10px] text-slate-400"
            htmlFor="explore-throttle"
          >
            <span>Throttle</span>
            <span className="text-amber-200">
              {number(sim.throttle * 100, 0)}%
            </span>
          </label>
          <input
            id="explore-throttle"
            data-testid="explore-throttle"
            className="mt-2 w-full accent-cyan-300"
            type="range"
            min="0"
            max="100"
            value={sim.throttle * 100}
            disabled={sim.status !== "flying" || !sim.fuel}
            onChange={(e) => {
              sim.cancelTransfer("Manual throttle");
              sim.throttle = Number(e.target.value) / 100;
              setTick((n) => n + 1);
            }}
          />
          <div className="mt-1 flex justify-between font-mono text-[9px] text-slate-500">
            <span data-testid="explore-fuel" data-kg={sim.fuel}>
              {number(sim.fuel, 0)} KG PROPELLANT
            </span>
            <span>{number((sim.fuel / sim.craft.fuel) * 100, 0)}%</span>
          </div>
          <div className="mt-2 h-1 overflow-hidden rounded-full bg-slate-800">
            <div
              className="h-full bg-cyan-400"
              style={{ width: `${(100 * sim.fuel) / sim.craft.fuel}%` }}
            />
          </div>
        </div>
        <div className="p-5">
          <div className="eyebrow mb-3 text-slate-500">Next destination</div>
          <div className="flex items-center gap-3">
            <Globe2 size={24} style={{ color: selected.color }} />
            <h3 className="font-display text-2xl uppercase">{selected.name}</h3>
          </div>
          <p className="mt-3 text-xs leading-relaxed text-slate-400">
            {selected.description}
          </p>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <Metric
              label="SURFACE GRAVITY"
              value={`${number(selected.mu / selected.radius ** 2, 2)} m/s²`}
            />
            <Metric label="RADIUS" value={distance(selected.radius)} />
          </div>
          <BodyScience body={selected} />
          <label
            htmlFor="explore-craft"
            className="eyebrow mb-2 mt-5 block text-slate-500"
          >
            Choose a starting spacecraft
          </label>
          <select
            id="explore-craft"
            data-testid="explore-craft-select"
            className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-xs"
            value={craftId}
            onChange={(e) => setCraftId(e.target.value)}
          >
            {sim.baseCraft?.id === "hangar" && (
              <option value="hangar">
                {sim.baseCraft.name} · Hangar design
              </option>
            )}
            {EXPLORERS.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} · {c.role}
              </option>
            ))}
          </select>
          <button
            data-testid="explore-start-orbit"
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-md border border-cyan-400/50 bg-cyan-400/10 py-2.5 text-xs font-medium text-cyan-200 hover:bg-cyan-400/20"
            onClick={start}
          >
            <Orbit size={14} /> Start new orbit at {selected.name}
          </button>
          <p className="mt-2 text-[10px] leading-relaxed text-slate-600">
            Replaces this expedition. Save or export first to keep your flight.
            No travel time or fuel is charged for a new starting orbit.
          </p>
        </div>
      </aside>
      <TouchFlightControls
        controls={input}
        visible={touchVisible}
        disabled={
          paused ||
          g.settingsOpen ||
          help ||
          g.overlayOpen ||
          sim.status !== "flying"
        }
        settings={g.settings}
        fuel={[{label:"Fuel",pct:sim.craft.fuel?100*sim.fuel/sim.craft.fuel:0}]}
        onThrottle={value=>{sim.cancelTransfer();sim.throttle=value;setWarp(1);}}
        throttle={sim.throttle}
        rcs={sim.rcsEnabled}
        canStage={false}
        exploration
      />
      {!touchVisible&&flightFooter}
    </div>
  );
}

function Metric({ label, value, testId }) {
  return (
    <div>
      <div className="font-mono text-[9px] tracking-wider text-slate-500">
        {label}
      </div>
      <div
        data-testid={testId}
        className="mt-1 font-mono text-xs text-slate-200"
      >
        {value}
      </div>
    </div>
  );
}
