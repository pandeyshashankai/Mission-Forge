import { validateArchive } from "../persistence/domain";
import { presetFalconLike } from "../sim/presets";
import { DEFAULT_PROFILE } from "../sim/guidance";
import { localData } from "../persistence/localData";
import { OfflinePlay } from "../components/app/OfflinePlay";
import { useRef, useState } from "react";
import { Rocket, FlaskConical, Compass, Play, FolderOpen, Upload, Trash2, History, ArrowRight, CheckCircle2 } from "lucide-react";
import { CheckpointList } from "../components/game/FlightPanels";
import { toast } from "sonner";
import { useGame } from "../game/GameContext";
import { DIFFICULTIES } from "../sim/missions";
import { startTutorial, TUTORIALS } from "../components/game/Tutorial";
import { storage, readJSONFile, isValidDesign } from "../sim/storage";
import { DisplayButton } from "../components/app/Appearance";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "../components/ui/dialog";
export default function MainMenu() {
  const g = useGame();
  let recovery = null;
  try {
    const candidate = JSON.parse(localData.getItem('mf.recovery-flight'));
    if (candidate?.state) {
      validateArchive([['mf.recovery-flight', JSON.stringify(candidate)]]);
      recovery = candidate;
    }
  } catch {}
  const fileRef = useRef(null);
  const [dlg, setDlg] = useState(null);
  const [designs, setDesigns] = useState(storage.designs());
  const [cks, setCks] = useState(storage.checkpoints());
  const resume = ck => {
    g.loadDesign(ck.design);
    g.setMissionId(ck.missionId);
    g.setDifficulty(ck.difficulty);
    g.setProfile(ck.profile);
    g.setPendingCheckpoint(ck);
    g.go("flight");
  };
  const onImport = async e => {
    const f = e.target.files[0];
    e.target.value = "";
    if (!f) return;
    try {
      const d = await readJSONFile(f);
      if (!isValidDesign(d)) throw new Error("bad");
      g.loadDesign(d);
      storage.saveDesign(d);
      toast.success(`Imported design "${d.name}"`);
      g.go("hangar");
    } catch {
      toast.error("That file is not a valid MissionForge design.");
    }
  };
  return <div className="home-screen" data-testid="home-screen">
      <header className="home-header">
        <div className="home-brand">
          <span className="brand-symbol">
            <Rocket size={20} />
          </span>
          MissionForge<span className="brand-tag">Spaceflight sandbox</span>
        </div>
        <div className="showcase-actions"><button className="ui-button" data-testid="palette-open" onClick={()=>g.setOverlayOpen(true)}>Search · Ctrl+K</button><button className="ui-button" data-testid="menu-evidence-btn" onClick={() => g.go("evidence")}>Mission evidence</button><button className="ui-button" data-testid="menu-storage-btn" onClick={() => g.go("storage")}>Data & recovery</button>{recovery && <button className="ui-button" data-testid="resume-recovery" onClick={() => resume(recovery)}>Recover flight (paused)</button>}<button className="ui-button" data-testid="menu-sandbox-btn" onClick={() => g.go("sandbox")}>Sandbox lab</button><button className="ui-button" data-testid="menu-showcase-btn" onClick={() => g.go("showcase")}>Guided showcase</button><DisplayButton /></div>
      </header>
      <main className="home-content">
        <div className="home-welcome">
          <span className="section-kicker">
            <span className="live-dot" /> Your mission starts here
          </span>
          <h1 data-testid="main-title">
            A little curiosity.
            <br />
            <span>A whole solar system.</span>
          </h1>
          <p>Build your rocket, find your orbit, and see how far you can go.</p>
          <button className="ui-button" data-testid="quick-first-orbit" onClick={() => {
          g.setLearningPrediction(null);
          localData.removeItem('mf.academy-flight');
          g.loadDesign(presetFalconLike());
          g.setMissionId('first_orbit');
          g.setDifficulty('amateur');
          g.setProfile({
            ...DEFAULT_PROFILE,
            targetAltitude: 200000,
            targetInclination: 28.6
          });
          g.setPendingCheckpoint(null);
          g.go('flight');
        }}>Quick First Orbit · ready-to-fly preset</button><div className="showcase-actions mt-3"><button className="ui-button" data-testid="menu-challenges-btn" onClick={()=>g.go("challenges")}>Challenges</button><button className="ui-button" data-testid="menu-logbook-btn" onClick={()=>g.go("logbook")}>Logbook</button></div>
        </div>
        <section className="education-home science-card" data-testid="first-time-experience"><span className="science-kicker">New to orbital flight?</span><h2>Predict, launch, then explain your orbit.</h2><p>The optional Academy starts with a tested rocket and a short guide. Your existing missions and designs remain available.</p><div className="showcase-actions"><button className="ui-button ui-button-primary" data-testid="menu-academy" onClick={()=>g.go('academy')}>Start Mission Control Academy</button><button className="ui-button" data-testid="menu-data-explorer" onClick={()=>g.go('data')}>NASA Data Explorer</button><button className="ui-button" data-testid="menu-model-comparison" onClick={()=>g.go('comparison')}>Compare physics models</button></div></section><div className="home-paths">
          <button className="home-path mission-path" data-testid="menu-new-mission-btn" onClick={() => g.go("planner")}>
            <span className="path-topline">
              <span className="path-icon">
                <Rocket size={24} />
              </span>
              <span className="path-tag">Start here</span>
            </span>
            <span className="path-copy">
              <strong>Fly a mission</strong>
              <span>
                A clear goal. A ready-to-fly rocket.
                <br />
                From your first launch to a lunar return.
              </span>
            </span>
            <span className="path-action">
              Choose a mission <ArrowRight size={18} />
            </span>
            <span className="path-planet earth-illustration" style={{
            backgroundImage: "url(/textures/earth_atmos_2048.jpg)"
          }} aria-hidden="true" />
          </button>
          <button className="home-path explore-path" data-testid="menu-explore-btn" onClick={() => g.go("explore")}>
            <span className="path-topline">
              <span className="path-icon">
                <Compass size={24} />
              </span>
              <span className="path-tag">Play your way</span>
            </span>
            <span className="path-copy">
              <strong>Explore freely</strong>
              <span>
                Eight planets. Three moons.
                <br />
                No score, no countdown. Just you and space.
              </span>
            </span>
            <span className="path-action">
              Open solar system <ArrowRight size={18} />
            </span>
            <span className="path-planet ringed-illustration" aria-hidden="true" />
          </button>
        </div>
        <button className="home-science-link" data-testid="menu-science-btn" onClick={() => g.go("science")}>
          <FlaskConical size={23} />
          <span>
            <strong>Mission Lab</strong>
            <small>Predict, fly, explain · NASA data & science checks</small>
          </span>
          <ArrowRight size={19} />
        </button>
        <div className="home-utilities" aria-label="Your saved work">
          <button data-testid="menu-continue-btn" disabled={!g.hasAutosave} onClick={() => g.go("hangar")}>
            <Play size={19} />
            <span>
              <strong>Continue building</strong>
              <small>
                {g.hasAutosave ? g.design.name : "Your next rocket will appear here"}
              </small>
            </span>
            <ArrowRight size={15} />
          </button>
          <button data-testid="menu-resume-flight-btn" disabled={!cks.length} onClick={() => {
          setCks(storage.checkpoints());
          setDlg("resume");
        }}>
            <History size={19} />
            <span>
              <strong>Resume a flight</strong>
              <small>
                {cks.length ? `${cks.length} saved checkpoints` : "No flights saved yet"}
              </small>
            </span>
            <ArrowRight size={15} />
          </button>
          <button data-testid="menu-load-btn" onClick={() => {
          setDesigns(storage.designs());
          setDlg("load");
        }}>
            <FolderOpen size={19} />
            <span>
              <strong>Saved rockets</strong>
              <small>{designs.length} designs in this browser</small>
            </span>
            <ArrowRight size={15} />
          </button>
          <button data-testid="menu-import-btn" onClick={() => fileRef.current.click()}>
            <Upload size={19} />
            <span>
              <strong>Import a rocket</strong>
              <small>Open a design file</small>
            </span>
            <ArrowRight size={15} />
          </button>
          <input ref={fileRef} type="file" accept=".json,application/json" className="hidden" onChange={onImport} data-testid="menu-import-input" />
        </div>
        <section className="home-bottom">
          <div className="home-difficulty">
            <div>
              <h2>Choose your pace</h2>
              <p>Same flight physics. Different budgets and assistance.</p>
            </div>
            <div className="difficulty-pills">
              {Object.values(DIFFICULTIES).map(d => <button key={d.id} aria-pressed={g.difficulty === d.id} data-testid={`difficulty-${d.id}-btn`} onClick={() => g.setDifficulty(d.id)}>
                  {g.difficulty === d.id && <CheckCircle2 size={14} />}
                  {d.label}
                </button>)}
            </div>
            <p className="difficulty-explanation" data-testid="difficulty-description">
              {DIFFICULTIES[g.difficulty].desc}
            </p>
          </div>
          <details className="home-tutorials">
            <summary>Need a hand? Try a short tutorial.</summary>
            <div data-testid="tutorial-list">
              {Object.entries(TUTORIALS).map(([id, t]) => <button key={id} data-testid={`tutorial-start-${id}`} onClick={() => startTutorial(id)}>
                  {t.title}
                  <ArrowRight size={13} />
                </button>)}
            </div>
          </details>
        </section>
      </main>
      <footer className="home-footer">
        <OfflinePlay />
        <span>Built for curious minds. Ready for liftoff.</span>
        <span>
          Your saves stay in this browser. Export them to keep a copy.
        </span>
        <button data-testid="menu-settings-btn" onClick={() => g.setSettingsOpen(true)}>
          Settings & controls
        </button>
      </footer>

      <Dialog open={dlg === "load"} onOpenChange={o => !o && setDlg(null)}>
        <DialogContent className="dark border-slate-800 bg-slate-950 text-slate-100" data-testid="load-dialog">
          <DialogHeader>
            <DialogTitle className="font-display">Saved rockets</DialogTitle>
            <DialogDescription>
              Open a rocket to keep building, or remove an old design.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-80 space-y-1 overflow-y-auto scroll-thin">
            {designs.length === 0 && <div className="text-sm text-slate-500">
                No saved designs yet. Save one from the Hangar.
              </div>}
            {designs.map(d => <div key={d.name} className="flex items-center justify-between border border-slate-800 px-3 py-2">
                <button className="text-left" data-testid={`load-design-${d.name}`} onClick={() => {
              g.loadDesign(d);
              setDlg(null);
              g.go("hangar");
            }}>
                  <div className="text-sm">{d.name}</div>
                  <div className="font-mono text-[10px] text-slate-500">
                    {d.stack.length + (d.radials || []).reduce((a, r) => a + r.symmetry, 0)}{" "}
                    parts · {new Date(d.savedAt).toLocaleString()}
                  </div>
                </button>
                <button aria-label={`Delete ${d.name}`} data-testid={`delete-design-${d.name}`} onClick={() => {
              storage.deleteDesign(d.name);
              setDesigns(storage.designs());
            }} className="p-1 text-slate-500 hover:text-red-400">
                  <Trash2 size={14} />
                </button>
              </div>)}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={dlg === "resume"} onOpenChange={o => !o && setDlg(null)}>
        <DialogContent className="dark max-w-xl border-slate-800 bg-slate-950 text-slate-100" data-testid="resume-dialog">
          <DialogHeader>
            <DialogTitle className="font-display">Resume a flight</DialogTitle>
            <DialogDescription>
              Choose a checkpoint to pick up where you left off.
            </DialogDescription>
          </DialogHeader>
          <CheckpointList list={cks} onRestore={resume} onDelete={id => {
          storage.deleteCheckpoint(id);
          setCks(storage.checkpoints());
        }} />
        </DialogContent>
      </Dialog>
    </div>;
}
