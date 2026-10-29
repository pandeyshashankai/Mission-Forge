import { useState } from "react";
import { ArrowLeft, Lock, Rocket, MapPin, Target, Users, Wallet, Clock } from "lucide-react";
import { useGame } from "../game/GameContext";
import { allMissions, getMission, missionBudget, requiredDeltaV, DIFFICULTIES, deleteCustomMission } from "../sim/missions";
import { MarsWindow, MissionCreator } from "../components/game/PlannerExtras";
import { LAUNCH_SITES } from "../sim/constants";
import { PRESETS } from "../sim/presets";

const Row = ({ icon: Icon, label, value, testId }) => (
  <div className="flex items-start gap-3 border-t border-slate-800/80 py-2.5">
    <Icon size={14} className="mt-0.5 text-slate-500" />
    <div className="eyebrow w-32 shrink-0 !text-[10px]">{label}</div>
    <div className="font-mono text-sm text-slate-200" data-testid={testId}>{value}</div>
  </div>
);

export default function MissionPlanner() {
  const g = useGame();
  const [sel, setSel] = useState(g.missionId);
  const [creating, setCreating] = useState(false);
  const [, bump] = useState(0);
  const m = getMission(sel) || getMission("first_orbit");
  const [preset, setPreset] = useState(m.preset || (m.payload ? "orbiter9eo" : "orbiter9"));
  const req = m.available ? requiredDeltaV(m) : null;

  const start = () => {
    g.setMissionId(m.id);
    g.loadDesign(PRESETS.find((p) => p.id === preset).make());
    g.setProfile({ ...g.profile, targetAltitude: m.target.parkingAltitude ?? m.target.altitude, targetInclination: m.target.inclination });
    g.go("hangar");
  };

  return (
    <div className="flex h-full w-full flex-col grid-bg">
      <header className="flex items-center justify-between border-b border-slate-800 bg-slate-950/80 px-6 py-3 backdrop-blur-md">
        <button data-testid="planner-back-btn" onClick={() => g.go("menu")} className="flex items-center gap-2 text-sm text-slate-400 hover:text-slate-100"><ArrowLeft size={16} /> Menu</button>
        <div className="eyebrow">Mission Planner · {DIFFICULTIES[g.difficulty].label}</div>
        <div className="w-16" />
      </header>
      <div className="grid flex-1 grid-cols-1 gap-6 overflow-hidden p-6 lg:grid-cols-[380px_1fr]">
        <div className="space-y-2 overflow-y-auto scroll-thin pr-1">
          <div className="eyebrow mb-2">Mission templates</div>
          {allMissions().map((x, i) => (
            <button key={x.id} data-testid={`mission-card-${x.id}`} disabled={!x.available} onClick={() => { setSel(x.id); setPreset(x.preset || (x.payload ? "orbiter9eo" : "orbiter9")); }} style={{ animationDelay: `${i * 60}ms` }}
              className={`rise relative w-full border p-4 text-left transition-colors ${sel === x.id ? "border-cyan-400 bg-cyan-500/10" : "border-slate-800 bg-slate-950/60 hover:border-slate-600"} ${!x.available ? "cursor-not-allowed opacity-50" : ""}`}>
              <div className="flex items-center justify-between">
                <div className="font-display text-xl font-semibold uppercase tracking-wider">{x.name}</div>
                {!x.available ? <span className="flex items-center gap-1 font-mono text-[10px] text-slate-500"><Lock size={11} /> MILESTONE {x.milestone}</span> : <span className="font-mono text-[10px] text-emerald-400">AVAILABLE</span>}
              </div>
              <div className="mt-1 text-xs text-slate-400">{x.destination} · {x.crewed ? "Crewed" : "Uncrewed"}</div>
              <div className="mt-1 text-[11px] italic text-slate-600">{x.inspiredBy}</div>
              {x.custom && <span role="button" data-testid={`mission-delete-${x.id}`} onClick={(e) => { e.stopPropagation(); deleteCustomMission(x.id); if (sel === x.id) setSel("first_orbit"); bump((n) => n + 1); }} className="absolute bottom-2 right-3 font-mono text-[10px] text-red-400 hover:text-red-300">delete</span>}
            </button>
          ))}
          <button data-testid="open-mission-creator-btn" onClick={() => setCreating(true)} className="w-full border border-dashed border-cyan-500/50 p-4 text-left text-xs text-cyan-300 hover:bg-cyan-500/5">
            <div className="font-display text-base uppercase tracking-wider">+ Custom Mission Creator</div>
            Define your own Earth-orbit target, site, payload and budget.
          </button>
          {creating && <MissionCreator onClose={() => setCreating(false)} onCreated={(x) => { setCreating(false); setSel(x.id); setPreset("orbiter9"); }} />}
        </div>

        <div className="panel overflow-y-auto rounded-sm p-8 scroll-thin" data-testid="mission-details-panel">
          <div className="eyebrow text-cyan-400">Mission brief</div>
          <h2 className="mt-2 font-display text-4xl font-bold uppercase tracking-tight">{m.name}</h2>
          <p className="mt-1 text-xs italic text-slate-500">{m.inspiredBy}. Not affiliated with or endorsed by NASA.</p>
          {m.kind === "mars" && <MarsWindow profile={g.profile} setProfile={g.setProfile} />}
          <div className="mt-6 grid grid-cols-1 gap-x-10 xl:grid-cols-2">
            <div>
              <Row icon={Target} label="Destination" value={m.destination} />
              <Row icon={Target} label="Target orbit" value={`${m.target.altitude / 1000} km circular · i ${m.target.inclination}°`} testId="mission-target-orbit" />
              <Row icon={Users} label="Crew" value={m.crewed ? "Crewed" : "Uncrewed"} />
              <Row icon={MapPin} label="Launch site" value={LAUNCH_SITES[m.site].name} />
              <Row icon={Wallet} label="Budget" value={`$${missionBudget(m, g.difficulty)}M`} testId="mission-budget" />
              <Row icon={Clock} label="Duration" value={m.duration} />
              <Row icon={Rocket} label="Δv estimate" value={`${Math.round(req.value).toLocaleString()} m/s + ${m.reserve * 100}% reserve`} testId="mission-dv-estimate" />
            </div>
            <div>
              <div className="eyebrow mb-2 mt-3 xl:mt-0">Objectives</div>
              <ol className="space-y-2 text-sm text-slate-300">
                {m.objectives.map((o, i) => (
                  <li key={i} className="flex gap-3"><span className="font-mono text-cyan-500">{String(i + 1).padStart(2, "0")}</span>{o}</li>
                ))}
              </ol>
              <div className="eyebrow mb-2 mt-6">Constraints</div>
              <ul className="space-y-1 text-sm text-slate-400">
                {m.constraints.map((c, i) => <li key={i}>— {c}</li>)}
              </ul>
            </div>
          </div>
          <div className="mt-8 border-t border-slate-800 pt-6">
            <div className="eyebrow mb-2">Starting design</div>
            <div className="flex flex-wrap gap-2">
              {PRESETS.map((p) => (
                <button key={p.id} data-testid={`preset-${p.id}-btn`} onClick={() => setPreset(p.id)} className={`border px-3 py-2 text-xs ${preset === p.id ? "border-cyan-400 text-cyan-200" : "border-slate-800 text-slate-400 hover:border-slate-600"}`}>{p.label}</button>
              ))}
            </div>
            <button data-testid="planner-open-hangar-btn" onClick={start} className="mt-6 inline-flex items-center gap-3 border border-cyan-400 bg-cyan-500/15 px-6 py-3 font-display text-lg font-semibold uppercase tracking-widest text-cyan-200 transition-colors hover:bg-cyan-500/25">
              <Rocket size={18} /> Open Hangar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
